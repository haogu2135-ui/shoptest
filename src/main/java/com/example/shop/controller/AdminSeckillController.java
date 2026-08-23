package com.example.shop.controller;

import com.example.shop.dto.SeckillCampaignResponse;
import com.example.shop.dto.SeckillCampaignWriteRequest;
import com.example.shop.service.SeckillService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin/seckill/campaigns")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminSeckillController {
    private final SeckillService seckillService;

    @GetMapping
    public ResponseEntity<List<SeckillCampaignResponse>> list() {
        return ResponseEntity.ok(seckillService.findAdminCampaigns());
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody(required = false) SeckillCampaignWriteRequest request) {
        try {
            return ResponseEntity.ok(seckillService.createCampaign(request));
        } catch (IllegalArgumentException | IllegalStateException exception) {
            return ResponseEntity.badRequest().body(Map.of("error", safeMessage(exception)));
        }
    }

    @PutMapping("/{campaignId}")
    public ResponseEntity<?> update(@PathVariable Long campaignId,
                                    @Valid @RequestBody(required = false) SeckillCampaignWriteRequest request) {
        try {
            SeckillCampaignResponse response = seckillService.updateCampaign(campaignId, request);
            return response == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(response);
        } catch (IllegalArgumentException | IllegalStateException exception) {
            return ResponseEntity.badRequest().body(Map.of("error", safeMessage(exception)));
        }
    }

    @PostMapping("/{campaignId}/status")
    public ResponseEntity<?> updateStatus(@PathVariable Long campaignId, @RequestParam String status) {
        try {
            SeckillCampaignResponse response = seckillService.updateStatus(campaignId, status);
            return response == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(response);
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(Map.of("error", safeMessage(exception)));
        }
    }

    private String safeMessage(RuntimeException exception) {
        return exception.getMessage() == null ? "Seckill operation failed" : exception.getMessage();
    }
}
