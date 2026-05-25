package com.example.cdrtool.service;

import com.example.cdrtool.model.CdrJobStatus;
import com.example.cdrtool.model.CdrRunResult;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class CdrJobService {
    private static final DateTimeFormatter START_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd");
    private final ConcurrentHashMap<String, JobRecord> jobs = new ConcurrentHashMap<String, JobRecord>();
    private final ExecutorService jobExecutor = Executors.newCachedThreadPool();
    private final CdrProcessingService processingService;
    private final CdrResultZipService zipService;

    public CdrJobService(CdrProcessingService processingService, CdrResultZipService zipService) {
        this.processingService = processingService;
        this.zipService = zipService;
    }

    public CdrJobStatus start(final List<String> numbers, LocalDate date, int threads) {
        String id = UUID.randomUUID().toString();
        final JobRecord record = new JobRecord(id, numbers.size());
        jobs.put(id, record);
        final String startTime = date.format(START_TIME_FORMATTER) + "000000";
        final int workerCount = Math.max(1, Math.min(500, threads));

        jobExecutor.submit(new Runnable() {
            @Override
            public void run() {
                record.state = "RUNNING";
                try {
                    CdrRunResult result = processingService.process(numbers, startTime, workerCount, new CdrProcessingService.ProgressListener() {
                        @Override
                        public void onProgress(int completed, int total) {
                            record.completed.set(completed);
                            record.total = total;
                        }
                    });
                    record.summaryText = zipService.summaryText(result);
                    record.zipBytes = zipService.zip(result);
                    record.completed.set(record.total);
                    record.state = "DONE";
                } catch (Exception e) {
                    record.state = "FAILED";
                    record.error = e.getMessage();
                }
            }
        });

        return status(id);
    }

    public CdrJobStatus status(String id) {
        JobRecord record = requireJob(id);
        CdrJobStatus status = new CdrJobStatus();
        status.setId(record.id);
        status.setState(record.state);
        status.setTotal(record.total);
        status.setCompleted(record.completed.get());
        status.setPercent(record.total <= 0 ? 0 : Math.min(100, (int) Math.round(record.completed.get() * 100.0 / record.total)));
        status.setError(record.error);
        status.setDownloadable(record.zipBytes != null);
        status.setSummaryText(record.summaryText);
        return status;
    }

    public byte[] download(String id) {
        JobRecord record = requireJob(id);
        if (record.zipBytes == null) {
            throw new IllegalStateException("Result is not ready");
        }
        return record.zipBytes;
    }

    private JobRecord requireJob(String id) {
        JobRecord record = jobs.get(id);
        if (record == null) {
            throw new IllegalArgumentException("Job not found: " + id);
        }
        return record;
    }

    private static final class JobRecord {
        private final String id;
        private volatile String state = "QUEUED";
        private volatile int total;
        private final AtomicInteger completed = new AtomicInteger(0);
        private volatile String error;
        private volatile String summaryText;
        private volatile byte[] zipBytes;

        private JobRecord(String id, int total) {
            this.id = id;
            this.total = total;
        }
    }
}
