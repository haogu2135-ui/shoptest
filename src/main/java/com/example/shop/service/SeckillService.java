package com.example.shop.service;

import com.example.shop.dto.SeckillCampaignResponse;
import com.example.shop.dto.SeckillCampaignWriteRequest;
import com.example.shop.dto.SeckillItemResponse;
import com.example.shop.dto.SeckillItemWriteRequest;
import com.example.shop.dto.SeckillPurchaseRequest;
import com.example.shop.entity.Order;
import com.example.shop.entity.OrderItem;
import com.example.shop.entity.Product;
import com.example.shop.entity.SeckillCampaign;
import com.example.shop.entity.SeckillClaim;
import com.example.shop.entity.SeckillItem;
import com.example.shop.entity.User;
import com.example.shop.repository.OrderItemRepository;
import com.example.shop.repository.OrderRepository;
import com.example.shop.repository.ProductRepository;
import com.example.shop.repository.SeckillCampaignRepository;
import com.example.shop.repository.SeckillClaimRepository;
import com.example.shop.repository.SeckillItemRepository;
import com.example.shop.repository.UserRepository;
import com.example.shop.service.ProductService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Slf4j
public class SeckillService {
    private static final DateTimeFormatter ORDER_NO_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final Set<String> CAMPAIGN_STATUSES = Set.of("DRAFT", "PUBLISHED", "PAUSED");

    @Autowired
    private SeckillCampaignRepository campaignRepository;
    @Autowired
    private SeckillItemRepository itemRepository;
    @Autowired
    private SeckillClaimRepository claimRepository;
    @Autowired
    private ProductRepository productRepository;
    @Autowired
    private ProductService productService;
    @Autowired
    private ProductVariantService productVariantService;
    @Autowired
    private OrderRepository orderRepository;
    @Autowired
    private OrderItemRepository orderItemRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RuntimeConfigService runtimeConfig;
    @Autowired(required = false)
    private PaymentChannelAvailabilityService paymentChannelAvailabilityService;

    /**
     * Releases a pending-payment reservation so an unpaid seckill order does
     * not permanently consume campaign quota or the per-user claim.
     */
    @Transactional
    public void releaseClaimForOrder(Long orderId) {
        if (orderId == null) {
            return;
        }
        SeckillClaim claim = claimRepository.findByOrderIdForUpdate(orderId).orElse(null);
        if (claim == null) {
            return;
        }

        SeckillItem item = itemRepository.findByIdAndCampaignIdForUpdate(claim.getItemId(), claim.getCampaignId());
        if (item == null) {
            log.warn("Seckill claim item missing during release: orderId={}, claimId={}, itemId={}",
                    orderId, claim.getId(), claim.getItemId());
        } else {
            int sold = item.getSold() == null ? 0 : item.getSold();
            int quantity = claim.getQuantity() == null ? 0 : Math.max(0, claim.getQuantity());
            item.setSold(Math.max(0, sold - quantity));
            item.setUpdatedAt(LocalDateTime.now());
            itemRepository.save(item);
        }
        claimRepository.delete(claim);
    }

    @Transactional(readOnly = true)
    public List<SeckillCampaignResponse> findPublicCampaigns() {
        LocalDateTime now = LocalDateTime.now();
        return campaignRepository.findByStatus("PUBLISHED", Sort.by(Sort.Direction.ASC, "startAt", "id"))
                .stream()
                .map(campaign -> toResponse(campaign, true, now))
                .filter(response -> response != null && response.getItems() != null && !response.getItems().isEmpty())
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SeckillCampaignResponse findPublicCampaign(Long campaignId) {
        SeckillCampaign campaign = campaignRepository.findById(campaignId).orElse(null);
        if (campaign == null || !"PUBLISHED".equalsIgnoreCase(campaign.getStatus())) {
            return null;
        }
        return toResponse(campaign, true, LocalDateTime.now());
    }

    @Transactional(readOnly = true)
    public List<SeckillCampaignResponse> findAdminCampaigns() {
        return campaignRepository.findAll(Sort.by(Sort.Direction.DESC, "startAt", "id"))
                .stream()
                .map(campaign -> toResponse(campaign, false, LocalDateTime.now()))
                .collect(Collectors.toList());
    }

    @Transactional
    public SeckillCampaignResponse createCampaign(SeckillCampaignWriteRequest request) {
        validateWriteRequest(request);
        SeckillCampaign campaign = new SeckillCampaign();
        applyCampaignFields(campaign, request);
        LocalDateTime now = LocalDateTime.now();
        campaign.setCreatedAt(now);
        campaign.setUpdatedAt(now);
        campaignRepository.save(campaign);
        saveItems(campaign, request.getItems());
        return toResponse(campaign, false, now);
    }

    @Transactional
    public SeckillCampaignResponse updateCampaign(Long campaignId, SeckillCampaignWriteRequest request) {
        validateWriteRequest(request);
        SeckillCampaign campaign = campaignRepository.findByIdForUpdate(campaignId);
        if (campaign == null) {
            return null;
        }
        if (claimRepository.existsByCampaignId(campaignId)) {
            throw new IllegalStateException("A campaign with completed purchases cannot be edited");
        }
        applyCampaignFields(campaign, request);
        campaign.setUpdatedAt(LocalDateTime.now());
        itemRepository.deleteByCampaignId(campaignId);
        campaignRepository.save(campaign);
        saveItems(campaign, request.getItems());
        return toResponse(campaign, false, LocalDateTime.now());
    }

    @Transactional
    public SeckillCampaignResponse updateStatus(Long campaignId, String status) {
        String normalized = normalizeStatus(status);
        if (normalized == null) {
            throw new IllegalArgumentException("status must be DRAFT, PUBLISHED or PAUSED");
        }
        SeckillCampaign campaign = campaignRepository.findByIdForUpdate(campaignId);
        if (campaign == null) {
            return null;
        }
        campaign.setStatus(normalized);
        campaign.setUpdatedAt(LocalDateTime.now());
        campaignRepository.save(campaign);
        return toResponse(campaign, false, LocalDateTime.now());
    }

    @Transactional
    public Order purchase(Long userId, Long campaignId, SeckillPurchaseRequest request, String idempotencyKey) {
        if (userId == null || userId <= 0) {
            throw new IllegalArgumentException("Login is required for seckill purchase");
        }
        String safeIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);
        SeckillCampaign campaign = campaignRepository.findByIdForUpdate(campaignId);
        if (campaign == null) {
            throw new IllegalArgumentException("Seckill campaign not found");
        }
        SeckillItem item = itemRepository.findByIdAndCampaignIdForUpdate(request.getItemId(), campaignId);
        if (item == null) {
            throw new IllegalArgumentException("Seckill item not found");
        }

        SeckillClaim previousClaim = claimRepository.findByCampaignIdAndUserId(campaignId, userId).orElse(null);
        if (previousClaim != null) {
            if (safeIdempotencyKey.equals(previousClaim.getIdempotencyKey())) {
                Order previousOrder = orderRepository.findById(previousClaim.getOrderId());
                if (previousOrder != null) {
                    return previousOrder;
                }
            }
            throw new IllegalStateException("You have already purchased from this seckill campaign");
        }
        assertCampaignOpen(campaign, LocalDateTime.now());
        validatePaymentMethod(request.getPaymentMethod());
        int quantity = normalizeQuantity(request.getQuantity());
        if (quantity > item.getLimitPerUser()) {
            throw new IllegalArgumentException("Quantity exceeds the per-user limit");
        }
        int remaining = item.getQuota() - item.getSold();
        if (quantity > remaining) {
            throw new IllegalArgumentException("Seckill item is sold out");
        }

        Product product = productRepository.findByIdForUpdate(item.getProductId());
        if (product == null || (product.getStatus() != null && !"ACTIVE".equalsIgnoreCase(product.getStatus()))) {
            throw new IllegalArgumentException("Product is no longer available");
        }
        String selectedSpecs = productVariantService.normalizeSpecs(request.getSelectedSpecs());
        productVariantService.validateSelection(product, selectedSpecs);
        Integer availableProductStock = productVariantService.resolveStock(product, selectedSpecs);
        if (availableProductStock == null || availableProductStock < quantity) {
            throw new IllegalArgumentException("Product stock is insufficient");
        }
        BigDecimal unitPrice = normalizeMoney(item.getSeckillPrice());
        if (unitPrice.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException("Seckill price must be greater than zero");
        }
        reserveProductStock(product, selectedSpecs, quantity);

        BigDecimal originalAmount = unitPrice.multiply(BigDecimal.valueOf(quantity)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal shippingFee = calculateShippingFee(product, originalAmount);
        LocalDateTime now = LocalDateTime.now();
        Order order = new Order();
        order.setOrderNo(nextOrderNo());
        order.setUserId(userId);
        order.setOriginalAmount(originalAmount);
        order.setDiscountAmount(BigDecimal.ZERO.setScale(2));
        order.setShippingFee(shippingFee);
        order.setTotalAmount(originalAmount.add(shippingFee).setScale(2, RoundingMode.HALF_UP));
        order.setStatus("PENDING_PAYMENT");
        order.setShippingAddress(request.getShippingAddress().trim());
        order.setRecipientName(request.getRecipientName().trim());
        order.setRecipientPhone(request.getRecipientPhone().trim());
        order.setContactEmail(resolveContactEmail(userId, request.getContactEmail()));
        order.setGuestOrder(false);
        order.setPaymentMethod(request.getPaymentMethod().trim());
        order.setCreatedAt(now);
        order.setUpdatedAt(now);
        orderRepository.insert(order);

        OrderItem orderItem = new OrderItem();
        orderItem.setOrderId(order.getId());
        orderItem.setProductId(product.getId());
        orderItem.setQuantity(quantity);
        orderItem.setPrice(unitPrice);
        orderItem.setProductNameSnapshot(product.getName());
        orderItem.setImageUrlSnapshot(product.getImageUrl());
        orderItem.setSelectedSpecs(selectedSpecs);
        orderItem.setCreatedAt(now);
        orderItemRepository.insert(orderItem);

        item.setSold(item.getSold() + quantity);
        item.setUpdatedAt(now);
        itemRepository.save(item);
        SeckillClaim claim = new SeckillClaim();
        claim.setCampaignId(campaignId);
        claim.setItemId(item.getId());
        claim.setUserId(userId);
        claim.setOrderId(order.getId());
        claim.setQuantity(quantity);
        claim.setUnitPrice(unitPrice);
        claim.setIdempotencyKey(safeIdempotencyKey);
        claim.setCreatedAt(now);
        try {
            claimRepository.save(claim);
        } catch (DataIntegrityViolationException exception) {
            throw new IllegalStateException("Seckill purchase is already being processed", exception);
        }
        return order;
    }

    private void validateWriteRequest(SeckillCampaignWriteRequest request) {
        if (request == null || request.getStartAt() == null || request.getEndAt() == null) {
            throw new IllegalArgumentException("Campaign time window is required");
        }
        if (!request.getEndAt().isAfter(request.getStartAt())) {
            throw new IllegalArgumentException("Campaign endAt must be after startAt");
        }
        if (normalizeStatus(request.getStatus()) == null) {
            throw new IllegalArgumentException("status must be DRAFT, PUBLISHED or PAUSED");
        }
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new IllegalArgumentException("At least one seckill item is required");
        }
        Set<Long> productIds = new HashSet<>();
        for (SeckillItemWriteRequest item : request.getItems()) {
            if (item == null || item.getProductId() == null || !productIds.add(item.getProductId())) {
                throw new IllegalArgumentException("Seckill products must be unique");
            }
            Product product = productService.findById(item.getProductId()).orElse(null);
            if (product == null || (product.getStatus() != null && !"ACTIVE".equalsIgnoreCase(product.getStatus()))) {
                throw new IllegalArgumentException("Product is unavailable: " + item.getProductId());
            }
            if (item.getSeckillPrice() == null || item.getSeckillPrice().compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Seckill price must be greater than zero");
            }
            if (product.getPrice() != null && item.getSeckillPrice().compareTo(product.getPrice()) > 0) {
                throw new IllegalArgumentException("Seckill price cannot exceed the product price");
            }
        }
    }

    private void applyCampaignFields(SeckillCampaign campaign, SeckillCampaignWriteRequest request) {
        campaign.setTitle(request.getTitle().trim());
        campaign.setSubtitle(trimToNull(request.getSubtitle()));
        campaign.setBannerUrl(trimToNull(request.getBannerUrl()));
        campaign.setStatus(normalizeStatus(request.getStatus()));
        campaign.setStartAt(request.getStartAt());
        campaign.setEndAt(request.getEndAt());
    }

    private void saveItems(SeckillCampaign campaign, List<SeckillItemWriteRequest> requests) {
        LocalDateTime now = LocalDateTime.now();
        List<SeckillItem> items = new ArrayList<>();
        for (SeckillItemWriteRequest request : requests) {
            SeckillItem item = new SeckillItem();
            item.setCampaignId(campaign.getId());
            item.setProductId(request.getProductId());
            item.setSeckillPrice(normalizeMoney(request.getSeckillPrice()));
            item.setQuota(request.getQuota());
            item.setSold(0);
            item.setLimitPerUser(request.getLimitPerUser());
            item.setCreatedAt(now);
            item.setUpdatedAt(now);
            items.add(item);
        }
        itemRepository.saveAll(items);
    }

    private SeckillCampaignResponse toResponse(SeckillCampaign campaign, boolean publicOnly, LocalDateTime now) {
        SeckillCampaignResponse response = new SeckillCampaignResponse();
        response.setId(campaign.getId());
        response.setTitle(campaign.getTitle());
        response.setSubtitle(campaign.getSubtitle());
        response.setBannerUrl(campaign.getBannerUrl());
        response.setStatus(campaign.getStatus());
        response.setState(campaignState(campaign, now));
        response.setStartAt(campaign.getStartAt());
        response.setEndAt(campaign.getEndAt());
        List<SeckillItemResponse> items = itemRepository.findByCampaignIdOrderByIdAsc(campaign.getId()).stream()
                .map(item -> {
                    Product product = publicOnly
                            ? productService.findPublicById(item.getProductId()).orElse(null)
                            : productService.findById(item.getProductId()).orElse(null);
                    return product == null ? null : SeckillItemResponse.from(item, product);
                })
                .filter(item -> item != null)
                .collect(Collectors.toList());
        response.setItems(items);
        return response;
    }

    private void assertCampaignOpen(SeckillCampaign campaign, LocalDateTime now) {
        if (!"PUBLISHED".equalsIgnoreCase(campaign.getStatus())) {
            throw new IllegalStateException("Seckill campaign is not available");
        }
        if (now.isBefore(campaign.getStartAt())) {
            throw new IllegalStateException("Seckill campaign has not started");
        }
        if (!now.isBefore(campaign.getEndAt())) {
            throw new IllegalStateException("Seckill campaign has ended");
        }
    }

    private String campaignState(SeckillCampaign campaign, LocalDateTime now) {
        if (!"PUBLISHED".equalsIgnoreCase(campaign.getStatus())) {
            return normalizeStatus(campaign.getStatus());
        }
        if (now.isBefore(campaign.getStartAt())) {
            return "UPCOMING";
        }
        return now.isBefore(campaign.getEndAt()) ? "ONGOING" : "ENDED";
    }

    private void validatePaymentMethod(String paymentMethod) {
        if (paymentMethod == null || paymentMethod.trim().isEmpty()) {
            throw new IllegalArgumentException("Payment method is required");
        }
        if (paymentChannelAvailabilityService != null) {
            paymentChannelAvailabilityService.requireAvailableForCheckout(paymentMethod.trim());
        }
    }

    private void reserveProductStock(Product product, String selectedSpecs, int quantity) {
        boolean hasScalarStock = product.getStock() != null;
        if (hasScalarStock) {
            int currentStock = product.getStock();
            if (currentStock < quantity || productRepository.decreaseStock(product.getId(), quantity) <= 0) {
                throw new IllegalArgumentException("Product stock is insufficient");
            }
            product.setStock(currentStock - quantity);
            if (product.getStock() <= 0) {
                product.setIsFeatured(false);
            }
        }
        boolean hasVariantStock = productVariantService.decreaseVariantStock(product, selectedSpecs, quantity);
        if (!hasScalarStock && !hasVariantStock) {
            throw new IllegalArgumentException("Product stock is insufficient");
        }
        productRepository.save(product);
    }

    private BigDecimal calculateShippingFee(Product product, BigDecimal subtotal) {
        BigDecimal freeThreshold = runtimeConfig.getBigDecimal("order.free-shipping-threshold", new BigDecimal("899.00"));
        if (freeThreshold != null && freeThreshold.compareTo(BigDecimal.ZERO) > 0 && subtotal.compareTo(freeThreshold) >= 0) {
            return BigDecimal.ZERO.setScale(2);
        }
        boolean free = Boolean.TRUE.equals(product.getFreeShipping())
                || (product.getFreeShippingThreshold() != null
                && product.getFreeShippingThreshold().compareTo(BigDecimal.ZERO) > 0
                && subtotal.compareTo(product.getFreeShippingThreshold()) >= 0);
        return free ? BigDecimal.ZERO.setScale(2) : runtimeConfig.getBigDecimal("order.default-shipping-fee", new BigDecimal("30.00"));
    }

    private String resolveContactEmail(Long userId, String requestedEmail) {
        String requested = trimToNull(requestedEmail);
        if (requested != null) {
            return requested;
        }
        return userRepository.findById(userId).map(User::getEmail).orElse(null);
    }

    private int normalizeQuantity(Integer quantity) {
        if (quantity == null || quantity < 1 || quantity > 99) {
            throw new IllegalArgumentException("Quantity must be between 1 and 99");
        }
        return quantity;
    }

    private String normalizeIdempotencyKey(String key) {
        String normalized = trimToNull(key);
        if (normalized == null) {
            return "auto-" + UUID.randomUUID();
        }
        if (normalized.length() > 120) {
            throw new IllegalArgumentException("Idempotency-Key is too long");
        }
        return normalized;
    }

    private String normalizeStatus(String status) {
        String normalized = status == null ? "DRAFT" : status.trim().toUpperCase(Locale.ROOT);
        return CAMPAIGN_STATUSES.contains(normalized) ? normalized : null;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private BigDecimal normalizeMoney(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private String nextOrderNo() {
        return "SQ" + LocalDateTime.now().format(ORDER_NO_TIME)
                + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase(Locale.ROOT);
    }
}
