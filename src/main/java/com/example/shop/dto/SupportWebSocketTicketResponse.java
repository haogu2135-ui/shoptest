package com.example.shop.dto;

import lombok.Data;

@Data
public class SupportWebSocketTicketResponse {
    private String ticket;
    private long expiresInMillis;

    public static SupportWebSocketTicketResponse of(String ticket, long expiresInMillis) {
        SupportWebSocketTicketResponse response = new SupportWebSocketTicketResponse();
        response.setTicket(ticket);
        response.setExpiresInMillis(expiresInMillis);
        return response;
    }
}
