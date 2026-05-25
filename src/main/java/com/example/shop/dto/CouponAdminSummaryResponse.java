package com.example.shop.dto;

public class CouponAdminSummaryResponse {
    private long totalCoupons;
    private long activeCoupons;
    private long inactiveCoupons;
    private long publicActiveCoupons;
    private long expiringSoonCoupons;
    private long lowRemainingCoupons;
    private int maxSearchRows;
    private int maxGrantUsers;
    private int maxPublicRows;
    private int walletMaxRows;
    private int availableMaxRows;
    private int nameMaxChars;
    private int descriptionMaxChars;
    private int totalQuantityMax;
    private int expiringSoonDays;
    private int lowRemainingThreshold;
    private String checkedAt;

    public long getTotalCoupons() {
        return totalCoupons;
    }

    public void setTotalCoupons(long totalCoupons) {
        this.totalCoupons = totalCoupons;
    }

    public long getActiveCoupons() {
        return activeCoupons;
    }

    public void setActiveCoupons(long activeCoupons) {
        this.activeCoupons = activeCoupons;
    }

    public long getInactiveCoupons() {
        return inactiveCoupons;
    }

    public void setInactiveCoupons(long inactiveCoupons) {
        this.inactiveCoupons = inactiveCoupons;
    }

    public long getPublicActiveCoupons() {
        return publicActiveCoupons;
    }

    public void setPublicActiveCoupons(long publicActiveCoupons) {
        this.publicActiveCoupons = publicActiveCoupons;
    }

    public long getExpiringSoonCoupons() {
        return expiringSoonCoupons;
    }

    public void setExpiringSoonCoupons(long expiringSoonCoupons) {
        this.expiringSoonCoupons = expiringSoonCoupons;
    }

    public long getLowRemainingCoupons() {
        return lowRemainingCoupons;
    }

    public void setLowRemainingCoupons(long lowRemainingCoupons) {
        this.lowRemainingCoupons = lowRemainingCoupons;
    }

    public int getMaxSearchRows() {
        return maxSearchRows;
    }

    public void setMaxSearchRows(int maxSearchRows) {
        this.maxSearchRows = maxSearchRows;
    }

    public int getMaxGrantUsers() {
        return maxGrantUsers;
    }

    public void setMaxGrantUsers(int maxGrantUsers) {
        this.maxGrantUsers = maxGrantUsers;
    }

    public int getMaxPublicRows() {
        return maxPublicRows;
    }

    public void setMaxPublicRows(int maxPublicRows) {
        this.maxPublicRows = maxPublicRows;
    }

    public int getWalletMaxRows() {
        return walletMaxRows;
    }

    public void setWalletMaxRows(int walletMaxRows) {
        this.walletMaxRows = walletMaxRows;
    }

    public int getAvailableMaxRows() {
        return availableMaxRows;
    }

    public void setAvailableMaxRows(int availableMaxRows) {
        this.availableMaxRows = availableMaxRows;
    }

    public int getNameMaxChars() {
        return nameMaxChars;
    }

    public void setNameMaxChars(int nameMaxChars) {
        this.nameMaxChars = nameMaxChars;
    }

    public int getDescriptionMaxChars() {
        return descriptionMaxChars;
    }

    public void setDescriptionMaxChars(int descriptionMaxChars) {
        this.descriptionMaxChars = descriptionMaxChars;
    }

    public int getTotalQuantityMax() {
        return totalQuantityMax;
    }

    public void setTotalQuantityMax(int totalQuantityMax) {
        this.totalQuantityMax = totalQuantityMax;
    }

    public int getExpiringSoonDays() {
        return expiringSoonDays;
    }

    public void setExpiringSoonDays(int expiringSoonDays) {
        this.expiringSoonDays = expiringSoonDays;
    }

    public int getLowRemainingThreshold() {
        return lowRemainingThreshold;
    }

    public void setLowRemainingThreshold(int lowRemainingThreshold) {
        this.lowRemainingThreshold = lowRemainingThreshold;
    }

    public String getCheckedAt() {
        return checkedAt;
    }

    public void setCheckedAt(String checkedAt) {
        this.checkedAt = checkedAt;
    }
}
