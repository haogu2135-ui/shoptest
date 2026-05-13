package com.example.shop.dto;

import com.example.shop.config.PaymentChannelConfig;
import lombok.Data;

@Data
public class PaymentChannelResponse {
    private String code;
    private String displayName;
    private String labelKey;
    private String descriptionKey;
    private String market;
    private String currency;
    private String provider;
    private String refundMode;
    private String badgeKey;
    private int sortOrder;

    public static PaymentChannelResponse from(PaymentChannelConfig.Channel channel) {
        PaymentChannelResponse response = new PaymentChannelResponse();
        response.setCode(channel.getCode());
        response.setDisplayName(channel.getDisplayName());
        response.setLabelKey(channel.getLabelKey());
        response.setDescriptionKey(channel.getDescriptionKey());
        response.setMarket(channel.getMarket());
        response.setCurrency(channel.getCurrency());
        response.setProvider(channel.getProvider());
        response.setRefundMode(channel.getRefundMode());
        response.setBadgeKey(channel.getBadgeKey());
        response.setSortOrder(channel.getSortOrder());
        return response;
    }
}
