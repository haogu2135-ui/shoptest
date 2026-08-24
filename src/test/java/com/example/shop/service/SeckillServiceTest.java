package com.example.shop.service;

import com.example.shop.dto.SeckillPurchaseRequest;
import com.example.shop.entity.Order;
import com.example.shop.entity.Product;
import com.example.shop.entity.SeckillCampaign;
import com.example.shop.entity.SeckillClaim;
import com.example.shop.entity.SeckillItem;
import com.example.shop.repository.OrderItemRepository;
import com.example.shop.repository.OrderRepository;
import com.example.shop.repository.ProductRepository;
import com.example.shop.repository.SeckillCampaignRepository;
import com.example.shop.repository.SeckillClaimRepository;
import com.example.shop.repository.SeckillItemRepository;
import com.example.shop.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SeckillServiceTest {
    private SeckillService service;
    private SeckillCampaignRepository campaignRepository;
    private SeckillItemRepository itemRepository;
    private SeckillClaimRepository claimRepository;
    private ProductRepository productRepository;
    private ProductService productService;
    private ProductVariantService productVariantService;
    private OrderRepository orderRepository;
    private OrderItemRepository orderItemRepository;
    private RuntimeConfigService runtimeConfig;
    private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        service = new SeckillService();
        campaignRepository = mock(SeckillCampaignRepository.class);
        itemRepository = mock(SeckillItemRepository.class);
        claimRepository = mock(SeckillClaimRepository.class);
        productRepository = mock(ProductRepository.class);
        productService = mock(ProductService.class);
        productVariantService = mock(ProductVariantService.class);
        orderRepository = mock(OrderRepository.class);
        orderItemRepository = mock(OrderItemRepository.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        userRepository = mock(UserRepository.class);

        ReflectionTestUtils.setField(service, "campaignRepository", campaignRepository);
        ReflectionTestUtils.setField(service, "itemRepository", itemRepository);
        ReflectionTestUtils.setField(service, "claimRepository", claimRepository);
        ReflectionTestUtils.setField(service, "productRepository", productRepository);
        ReflectionTestUtils.setField(service, "productService", productService);
        ReflectionTestUtils.setField(service, "productVariantService", productVariantService);
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "orderItemRepository", orderItemRepository);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        ReflectionTestUtils.setField(service, "userRepository", userRepository);
        when(runtimeConfig.getBigDecimal(anyString(), any(BigDecimal.class)))
                .thenAnswer(invocation -> invocation.getArgument(1));
    }

    @Test
    void purchaseUsesServerPriceAndReservesBothCampaignAndProductStock() {
        SeckillCampaign campaign = campaign();
        SeckillItem item = item();
        Product product = product();
        when(campaignRepository.findByIdForUpdate(4L)).thenReturn(campaign);
        when(itemRepository.findByIdAndCampaignIdForUpdate(9L, 4L)).thenReturn(item);
        when(claimRepository.findByCampaignIdAndUserId(4L, 7L)).thenReturn(Optional.empty());
        when(productRepository.findByIdForUpdate(12L)).thenReturn(product);
        when(productVariantService.resolveStock(product, null)).thenReturn(8);
        when(productVariantService.decreaseVariantStock(product, null, 2)).thenReturn(false);
        when(productRepository.decreaseStock(12L, 2)).thenReturn(1);
        doAnswer(invocation -> {
            invocation.getArgument(0, Order.class).setId(88L);
            return 1;
        }).when(orderRepository).insert(any(Order.class));
        when(userRepository.findById(7L)).thenReturn(Optional.empty());

        Order result = service.purchase(7L, 4L, request(9L, 2), "seckill-key");

        assertEquals(new BigDecimal("15.00"), result.getOriginalAmount());
        assertEquals(new BigDecimal("45.00"), result.getTotalAmount());
        assertEquals(2, item.getSold());
        verify(productRepository).decreaseStock(12L, 2);
        verify(orderItemRepository).insert(any());
        verify(claimRepository).save(any(SeckillClaim.class));
    }

    @Test
    void sameIdempotencyKeyReturnsExistingOrderWithoutChargingAgain() {
        SeckillCampaign campaign = campaign();
        SeckillItem item = item();
        SeckillClaim claim = new SeckillClaim();
        claim.setIdempotencyKey("seckill-key");
        claim.setOrderId(88L);
        Order existing = new Order();
        existing.setId(88L);
        when(campaignRepository.findByIdForUpdate(4L)).thenReturn(campaign);
        when(itemRepository.findByIdAndCampaignIdForUpdate(9L, 4L)).thenReturn(item);
        when(claimRepository.findByCampaignIdAndUserId(4L, 7L)).thenReturn(Optional.of(claim));
        when(orderRepository.findById(88L)).thenReturn(existing);

        assertSame(existing, service.purchase(7L, 4L, request(9L, 1), "seckill-key"));
        verify(productRepository, org.mockito.Mockito.never()).decreaseStock(12L, 1);
    }

    @Test
    void releaseClaimForOrderReturnsQuotaAndDeletesClaim() {
        SeckillClaim claim = new SeckillClaim();
        claim.setId(31L);
        claim.setCampaignId(4L);
        claim.setItemId(9L);
        claim.setOrderId(88L);
        claim.setQuantity(2);
        SeckillItem item = item();
        item.setSold(6);
        when(claimRepository.findByOrderIdForUpdate(88L)).thenReturn(Optional.of(claim));
        when(itemRepository.findByIdAndCampaignIdForUpdate(9L, 4L)).thenReturn(item);

        service.releaseClaimForOrder(88L);

        assertEquals(4, item.getSold());
        verify(itemRepository).save(item);
        verify(claimRepository).delete(claim);
    }

    @Test
    void releaseClaimForOrderIsIdempotentWhenClaimWasAlreadyDeleted() {
        when(claimRepository.findByOrderIdForUpdate(88L)).thenReturn(Optional.empty());

        service.releaseClaimForOrder(88L);

        verify(itemRepository, never()).findByIdAndCampaignIdForUpdate(9L, 4L);
        verify(itemRepository, never()).save(any(SeckillItem.class));
        verify(claimRepository, never()).delete(any(SeckillClaim.class));
    }

    @Test
    void purchaseRejectsMissingPayloadBeforeTouchingRepositories() {
        assertThrows(IllegalArgumentException.class, () -> service.purchase(7L, 4L, null, "seckill-key"));

        verify(campaignRepository, never()).findByIdForUpdate(4L);
        verify(itemRepository, never()).findByIdAndCampaignIdForUpdate(9L, 4L);
    }

    @Test
    void campaignWriteRejectsInvalidQuotaAndBlankTitle() {
        com.example.shop.dto.SeckillCampaignWriteRequest blankTitle = new com.example.shop.dto.SeckillCampaignWriteRequest();
        blankTitle.setTitle("  ");
        blankTitle.setStartAt(LocalDateTime.now().plusMinutes(1));
        blankTitle.setEndAt(LocalDateTime.now().plusMinutes(10));

        assertThrows(IllegalArgumentException.class, () -> service.createCampaign(blankTitle));

        com.example.shop.dto.SeckillCampaignWriteRequest invalidQuota = campaignWriteRequest();
        invalidQuota.getItems().get(0).setQuota(0);
        when(productService.findById(12L)).thenReturn(Optional.of(product()));

        assertThrows(IllegalArgumentException.class, () -> service.createCampaign(invalidQuota));
    }

    @Test
    void purchaseRejectsUnsafeIdempotencyKeyBeforeLoadingCampaign() {
        assertThrows(IllegalArgumentException.class, () -> service.purchase(7L, 4L, request(9L, 1), "bad key"));

        verify(campaignRepository, never()).findByIdForUpdate(4L);
    }

    private SeckillCampaign campaign() {
        SeckillCampaign campaign = new SeckillCampaign();
        campaign.setId(4L);
        campaign.setStatus("PUBLISHED");
        campaign.setStartAt(LocalDateTime.now().minusMinutes(1));
        campaign.setEndAt(LocalDateTime.now().plusMinutes(10));
        return campaign;
    }

    private SeckillItem item() {
        SeckillItem item = new SeckillItem();
        item.setId(9L);
        item.setCampaignId(4L);
        item.setProductId(12L);
        item.setSeckillPrice(new BigDecimal("7.50"));
        item.setQuota(10);
        item.setSold(0);
        item.setLimitPerUser(2);
        return item;
    }

    private Product product() {
        Product product = new Product();
        product.setId(12L);
        product.setName("Flash product");
        product.setPrice(new BigDecimal("10.00"));
        product.setStock(20);
        product.setCategoryId(1L);
        product.setStatus("ACTIVE");
        return product;
    }

    private SeckillPurchaseRequest request(Long itemId, int quantity) {
        SeckillPurchaseRequest request = new SeckillPurchaseRequest();
        request.setItemId(itemId);
        request.setQuantity(quantity);
        request.setShippingAddress("Test address");
        request.setRecipientName("Test user");
        request.setRecipientPhone("1234567890");
        request.setPaymentMethod("TEST");
        return request;
    }

    private com.example.shop.dto.SeckillCampaignWriteRequest campaignWriteRequest() {
        com.example.shop.dto.SeckillCampaignWriteRequest request = new com.example.shop.dto.SeckillCampaignWriteRequest();
        request.setTitle("Flash campaign");
        request.setStatus("DRAFT");
        request.setStartAt(LocalDateTime.now().plusMinutes(1));
        request.setEndAt(LocalDateTime.now().plusMinutes(10));
        com.example.shop.dto.SeckillItemWriteRequest item = new com.example.shop.dto.SeckillItemWriteRequest();
        item.setProductId(12L);
        item.setSeckillPrice(new BigDecimal("5.00"));
        item.setQuota(10);
        item.setLimitPerUser(1);
        request.setItems(java.util.List.of(item));
        return request;
    }
}
