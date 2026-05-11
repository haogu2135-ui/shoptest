package com.example.shop.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
public class LogisticsTrackResponse {
    private String trackingNumber;
    private String carrier;
    private String status;
    private String summary;
    private List<LogisticsTrackEvent> events = new ArrayList<>();
    private Map<String, Object> rawResponse;

    @Data
    public static class LogisticsTrackEvent {
        private LocalDateTime time;
        private String location;
        private String description;

        public LogisticsTrackEvent() {
        }

        public LogisticsTrackEvent(LocalDateTime time, String location, String description) {
            this.time = time;
            this.location = location;
            this.description = description;
        }
    }
}
