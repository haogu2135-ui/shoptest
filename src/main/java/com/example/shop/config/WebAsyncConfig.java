package com.example.shop.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebAsyncConfig implements WebMvcConfigurer {
    private final int corePoolSize;
    private final int maxPoolSize;
    private final int queueCapacity;
    private final long defaultTimeoutMs;

    public WebAsyncConfig(@Value("${app.web.async.core-pool-size:8}") int corePoolSize,
                          @Value("${app.web.async.max-pool-size:32}") int maxPoolSize,
                          @Value("${app.web.async.queue-capacity:200}") int queueCapacity,
                          @Value("${app.web.async.default-timeout-ms:15000}") long defaultTimeoutMs) {
        this.corePoolSize = corePoolSize;
        this.maxPoolSize = Math.max(corePoolSize, maxPoolSize);
        this.queueCapacity = Math.max(0, queueCapacity);
        this.defaultTimeoutMs = Math.max(1000L, defaultTimeoutMs);
    }

    @Bean
    public ThreadPoolTaskExecutor mvcAsyncTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setThreadNamePrefix("mvc-async-");
        executor.setCorePoolSize(Math.max(1, corePoolSize));
        executor.setMaxPoolSize(Math.max(1, maxPoolSize));
        executor.setQueueCapacity(queueCapacity);
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(5);
        return executor;
    }

    @Override
    public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
        configurer.setTaskExecutor(mvcAsyncTaskExecutor());
        configurer.setDefaultTimeout(defaultTimeoutMs);
    }
}
