package com.example.shop.dto;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class OrderTrackResponse {
    private OrderCustomerResponse order;
    private List<OrderItemCustomerResponse> items;
    private boolean detailsRestricted;
    private String restrictionReason;
    private String guestAccessToken;

    public OrderTrackResponse(OrderCustomerResponse order,
                               List<OrderItemCustomerResponse> items,
                               boolean detailsRestricted,
                               String restrictionReason) {
        this(order, items, detailsRestricted, restrictionReason, null);
    }
}
