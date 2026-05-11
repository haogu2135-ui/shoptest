package com.example.shop.dto;

import com.example.shop.entity.Order;
import com.example.shop.entity.OrderItem;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class OrderTrackResponse {
    private Order order;
    private List<OrderItem> items;
}
