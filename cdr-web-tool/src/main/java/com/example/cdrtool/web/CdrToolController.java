package com.example.cdrtool.web;

import com.example.cdrtool.model.CdrJobStatus;
import com.example.cdrtool.service.CdrJobService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@RestController
public class CdrToolController {
    private static final DateTimeFormatter FILE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");
    private final CdrJobService jobService;

    public CdrToolController(CdrJobService jobService) {
        this.jobService = jobService;
    }

    @PostMapping(value = "/api/cdr/jobs", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CdrJobStatus start(
            @RequestParam("file") MultipartFile file,
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(value = "threads", defaultValue = "200") int threads) throws Exception {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Please upload a txt file with one number per line");
        }
        if (threads < 1 || threads > 500) {
            throw new IllegalArgumentException("Thread count must be between 1 and 500");
        }
        return jobService.start(readNumbers(file), date, threads);
    }

    @GetMapping("/api/cdr/jobs/{id}")
    public CdrJobStatus status(@PathVariable String id) {
        return jobService.status(id);
    }

    @GetMapping("/api/cdr/jobs/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable String id) {
        byte[] zip = jobService.download(id);
        String filename = "cdr-results-" + LocalDateTime.now().format(FILE_TIME_FORMATTER) + ".zip";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(zip);
    }

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<String> badRequest(Exception e) {
        return ResponseEntity.badRequest()
                .contentType(new MediaType("text", "plain", StandardCharsets.UTF_8))
                .body(e.getMessage());
    }

    private List<String> readNumbers(MultipartFile file) throws Exception {
        List<String> numbers = new ArrayList<String>();
        BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
        try {
            String line;
            while ((line = reader.readLine()) != null) {
                String value = line.trim();
                if (!value.isEmpty()) {
                    numbers.add(value);
                }
            }
        } finally {
            reader.close();
        }
        return numbers;
    }
}
