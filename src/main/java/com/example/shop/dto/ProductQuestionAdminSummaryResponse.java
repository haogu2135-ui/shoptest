package com.example.shop.dto;

public class ProductQuestionAdminSummaryResponse {
    private long totalQuestions;
    private long unansweredQuestions;
    private long answeredQuestions;
    private long staleUnansweredQuestions;
    private int staleHours;
    private int maxAdminRows;
    private int responseScore;
    private String checkedAt;

    public long getTotalQuestions() {
        return totalQuestions;
    }

    public void setTotalQuestions(long totalQuestions) {
        this.totalQuestions = totalQuestions;
    }

    public long getUnansweredQuestions() {
        return unansweredQuestions;
    }

    public void setUnansweredQuestions(long unansweredQuestions) {
        this.unansweredQuestions = unansweredQuestions;
    }

    public long getAnsweredQuestions() {
        return answeredQuestions;
    }

    public void setAnsweredQuestions(long answeredQuestions) {
        this.answeredQuestions = answeredQuestions;
    }

    public long getStaleUnansweredQuestions() {
        return staleUnansweredQuestions;
    }

    public void setStaleUnansweredQuestions(long staleUnansweredQuestions) {
        this.staleUnansweredQuestions = staleUnansweredQuestions;
    }

    public int getStaleHours() {
        return staleHours;
    }

    public void setStaleHours(int staleHours) {
        this.staleHours = staleHours;
    }

    public int getMaxAdminRows() {
        return maxAdminRows;
    }

    public void setMaxAdminRows(int maxAdminRows) {
        this.maxAdminRows = maxAdminRows;
    }

    public int getResponseScore() {
        return responseScore;
    }

    public void setResponseScore(int responseScore) {
        this.responseScore = responseScore;
    }

    public String getCheckedAt() {
        return checkedAt;
    }

    public void setCheckedAt(String checkedAt) {
        this.checkedAt = checkedAt;
    }
}
