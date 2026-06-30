package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class AdminBugReportStatusRequest {
    @NotBlank
    @Size(max = 40)
    private String status;

    /**
     * Backward-compatible scan note alias for older clients.
     *
     * <p>When {@code scanNote} is blank, the service treats this value as the
     * scan note. It is not used as a fallback for fix or regression notes.</p>
     */
    @Size(max = 2000)
    private String note;

    @Size(max = 120)
    private String assignedTo;

    @Size(max = 2000)
    private String scanNote;

    @Size(max = 2000)
    private String fixSummary;

    @Size(max = 2000)
    private String regressionNote;
}
