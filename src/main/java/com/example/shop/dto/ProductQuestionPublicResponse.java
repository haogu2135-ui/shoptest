package com.example.shop.dto;

import com.example.shop.entity.ProductQuestion;

import java.time.LocalDateTime;

public class ProductQuestionPublicResponse {
    private Long id;
    private Long productId;
    private String question;
    private String answer;
    private LocalDateTime answeredAt;
    private LocalDateTime createdAt;

    public static ProductQuestionPublicResponse from(ProductQuestion question, Long productId) {
        ProductQuestionPublicResponse response = new ProductQuestionPublicResponse();
        response.setId(question == null ? null : question.getId());
        response.setProductId(productId);
        response.setQuestion(question == null ? null : question.getQuestion());
        response.setAnswer(question == null ? null : question.getAnswer());
        response.setAnsweredAt(question == null ? null : question.getAnsweredAt());
        response.setCreatedAt(question == null ? null : question.getCreatedAt());
        return response;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public LocalDateTime getAnsweredAt() {
        return answeredAt;
    }

    public void setAnsweredAt(LocalDateTime answeredAt) {
        this.answeredAt = answeredAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
