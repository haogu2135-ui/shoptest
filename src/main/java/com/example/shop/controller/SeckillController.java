package com.example.shop.controller;

import com.example.shop.dto.OrderCustomerResponse;
import com.example.shop.dto.SeckillCampaignResponse;
import com.example.shop.dto.SeckillPurchaseRequest;
import com.example.shop.entity.Order;
import com.example.shop.security.SecurityUtils;
import com.example.shop.service.SeckillService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/seckill")
@RequiredArgsConstructor
public class SeckillController {
    private final SeckillService seckillService;

    @GetMapping("/campaigns")
    public ResponseEntity<List<SeckillCampaignResponse>> campaigns() {
        return ResponseEntity.ok(seckillService.findPublicCampaigns());
    }

    @GetMapping("/campaigns/{campaignId}")
    public ResponseEntity<SeckillCampaignResponse> campaign(@PathVariable Long campaignId) {
        SeckillCampaignResponse response = seckillService.findPublicCampaign(campaignId);
        return response == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(response);
    }

    @PostMapping("/campaigns/{campaignId}/purchase")
    public ResponseEntity<?> purchase(@PathVariable Long campaignId,
                                      @Valid @RequestBody(required = false) SeckillPurchaseRequest request,
                                      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
                                      Authentication authentication) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Seckill purchase payload is required");
        }
        try {
            Long userId = SecurityUtils.requireUser(authentication).getId();
            Order order = seckillService.purchase(userId, campaignId, request, idempotencyKey);
            return ResponseEntity.ok(OrderCustomerResponse.from(order));
        } catch (IllegalArgumentException | IllegalStateException exception) {
            return ResponseEntity.badRequest().body(Map.of("error", safeMessage(exception)));
        }
    }

    private String safeMessage(RuntimeException exception) {
        return exception.getMessage() == null ? "Seckill purchase failed" : exception.getMessage();
    }
}
