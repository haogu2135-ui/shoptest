package com.example.shop.config;

import com.example.shop.service.RuntimeConfigService;
import com.example.shop.websocket.SupportWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {
    private final SupportWebSocketHandler supportWebSocketHandler;
    private final CorsOriginProperties corsOriginProperties;
    private final RuntimeConfigService runtimeConfig;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(supportWebSocketHandler, "/ws/support")
                .setAllowedOriginPatterns(corsOriginProperties.getWebSocketAllowedOriginPatternArray());
    }

    @Bean
    public ServletServerContainerFactoryBean webSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxSessionIdleTimeout(Math.max(30_000L,
                runtimeConfig.getLong("support.websocket.max-idle-ms", 300_000L)));
        container.setMaxTextMessageBufferSize(Math.max(1024,
                runtimeConfig.getInt("support.websocket.max-text-message-bytes", 16_384)));
        container.setMaxBinaryMessageBufferSize(Math.max(1024,
                runtimeConfig.getInt("support.websocket.max-binary-message-bytes", 8192)));
        return container;
    }
}
