package com.example.cdrtool.service;

import com.example.cdrtool.config.CdrToolProperties;
import com.example.cdrtool.model.CdrRunResult;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class CdrProcessingService {
    private static final DateTimeFormatter SEQ_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private final AtomicLong sequenceCounter = new AtomicLong(1000L);
    private final CdrToolProperties properties;

    public CdrProcessingService(CdrToolProperties properties) {
        this.properties = properties;
    }

    public CdrRunResult process(List<String> numbers) {
        return process(numbers, properties.getStartTime(), properties.getMaxWorkers(), null);
    }

    public CdrRunResult process(List<String> numbers, String startTime, int requestedWorkers, ProgressListener progressListener) {
        validateConfig();
        List<String> normalizedNumbers = normalizeNumbers(numbers);
        CdrRunResult result = new CdrRunResult();
        result.setTotal(normalizedNumbers.size());

        int workers = bounded(requestedWorkers, 1, 500);
        int batchSize = bounded(properties.getBatchSize(), 1, workers);
        ExecutorService executor = Executors.newFixedThreadPool(workers);
        RestTemplate restTemplate = buildRestTemplate();
        int completed = 0;

        try {
            for (int i = 0; i < normalizedNumbers.size(); i += batchSize) {
                long batchStart = System.currentTimeMillis();
                int end = Math.min(i + batchSize, normalizedNumbers.size());
                List<Future<QueryOutcome>> futures = new ArrayList<Future<QueryOutcome>>();

                for (String number : normalizedNumbers.subList(i, end)) {
                    futures.add(executor.submit(new QueryTask(restTemplate, number, startTime)));
                }

                for (Future<QueryOutcome> future : futures) {
                    QueryOutcome outcome = await(future);
                    collect(result, outcome);
                    completed++;
                    if (progressListener != null) {
                        progressListener.onProgress(completed, normalizedNumbers.size());
                    }
                }

                sleepForRateLimit(batchStart);
            }
        } finally {
            executor.shutdownNow();
        }

        return result;
    }

    List<String> classify(String responseXml) {
        List<String> categories = new ArrayList<String>();
        if (responseXml == null) {
            return categories;
        }
        if (responseXml.contains("<bbs:ServiceCategory>1</bbs:ServiceCategory>")) {
            categories.add("voice");
        }
        if (responseXml.contains("<bbs:ServiceCategory>2</bbs:ServiceCategory>")) {
            categories.add("SMS");
        }
        if (responseXml.contains("<bbs:ServiceCategory>3</bbs:ServiceCategory>")) {
            categories.add("MMS");
        }
        if (responseXml.contains("<bbs:ServiceCategory>5</bbs:ServiceCategory>")) {
            categories.add("GPRS");
        }
        return categories;
    }

    private RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        int timeoutMillis = bounded(properties.getTimeoutSeconds(), 1, 300) * 1000;
        factory.setConnectTimeout(timeoutMillis);
        factory.setReadTimeout(timeoutMillis);
        return new RestTemplate(factory);
    }

    private QueryOutcome await(Future<QueryOutcome> future) {
        try {
            return future.get();
        } catch (Exception e) {
            return QueryOutcome.failed("unknown", e.getMessage());
        }
    }

    private void collect(CdrRunResult result, QueryOutcome outcome) {
        Map<String, List<String>> files = result.getFiles();
        if (!outcome.success) {
            result.setFailed(result.getFailed() + 1);
            files.get("failed").add(outcome.number);
            return;
        }
        if (outcome.categories.isEmpty()) {
            files.get("noservice").add(outcome.number);
            return;
        }
        files.get("withservice").add(outcome.number);
        for (String category : outcome.categories) {
            files.get(category).add(outcome.number);
        }
    }

    private void sleepForRateLimit(long batchStart) {
        long minBatchMillis = Math.max(0L, properties.getMinBatchMillis());
        long elapsed = System.currentTimeMillis() - batchStart;
        if (elapsed >= minBatchMillis) {
            return;
        }
        try {
            Thread.sleep(minBatchMillis - elapsed);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private List<String> normalizeNumbers(List<String> numbers) {
        if (numbers == null || numbers.isEmpty()) {
            throw new IllegalArgumentException("No numbers found in uploaded file");
        }
        int maxNumbers = bounded(properties.getMaxNumbers(), 1, 1000000);
        if (numbers.size() > maxNumbers) {
            throw new IllegalArgumentException("Number count exceeds limit: " + maxNumbers);
        }
        List<String> cleaned = new ArrayList<String>();
        for (String number : numbers) {
            String value = number == null ? "" : number.trim();
            if (!value.isEmpty()) {
                if (value.length() > 64) {
                    throw new IllegalArgumentException("Number length exceeds 64 chars: " + value);
                }
                cleaned.add(value);
            }
        }
        if (cleaned.isEmpty()) {
            throw new IllegalArgumentException("No valid numbers found in uploaded file");
        }
        return cleaned;
    }

    private void validateConfig() {
        if (!StringUtils.hasText(properties.getSoapUrl())) {
            throw new IllegalStateException("cdr.soap-url is not configured");
        }
        if (!StringUtils.hasText(properties.getPassword())) {
            throw new IllegalStateException("cdr.password is not configured");
        }
    }

    private String buildEnvelope(String number, String startTime) {
        return "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\" xmlns:bbs=\"http://www.huawei.com/bme/cbsinterface/bbservices\" xmlns:cbs=\"http://www.huawei.com/bme/cbsinterface/cbscommon\" xmlns:bbc=\"http://www.huawei.com/bme/cbsinterface/bbcommon\">"
                + "<soapenv:Header/>"
                + "<soapenv:Body>"
                + "<bbs:QueryCDRRequestMsg>"
                + "<RequestHeader>"
                + "<cbs:Version>" + xml(properties.getVersion()) + "</cbs:Version>"
                + "<cbs:BusinessCode>" + xml(properties.getBusinessCode()) + "</cbs:BusinessCode>"
                + "<cbs:MessageSeq>" + uniqueSeq() + "</cbs:MessageSeq>"
                + "<cbs:AccessSecurity>"
                + "<cbs:LoginSystemCode>" + xml(properties.getLoginSystemCode()) + "</cbs:LoginSystemCode>"
                + "<cbs:Password>" + xml(properties.getPassword()) + "</cbs:Password>"
                + "</cbs:AccessSecurity>"
                + "<cbs:OperatorInfo><cbs:OperatorID>" + xml(properties.getOperatorId()) + "</cbs:OperatorID></cbs:OperatorInfo>"
                + "<cbs:TimeFormat><cbs:TimeType>1</cbs:TimeType></cbs:TimeFormat>"
                + "</RequestHeader>"
                + "<QueryCDRRequest>"
                + "<bbs:SubAccessCode><bbc:PrimaryIdentity>" + xml(number) + "</bbc:PrimaryIdentity></bbs:SubAccessCode>"
                + "<bbs:TimePeriod><bbs:StartTime>" + xml(startTime) + "</bbs:StartTime></bbs:TimePeriod>"
                + "<bbs:TotalCDRNum>" + properties.getTotalCdrNum() + "</bbs:TotalCDRNum>"
                + "<bbs:BeginRowNum>" + properties.getBeginRowNum() + "</bbs:BeginRowNum>"
                + "<bbs:FetchRowNum>" + properties.getFetchRowNum() + "</bbs:FetchRowNum>"
                + "</QueryCDRRequest>"
                + "</bbs:QueryCDRRequestMsg>"
                + "</soapenv:Body>"
                + "</soapenv:Envelope>";
    }

    private String uniqueSeq() {
        return LocalDateTime.now().format(SEQ_TIME_FORMATTER) + sequenceCounter.getAndIncrement();
    }

    private String xml(String value) {
        String input = value == null ? "" : value;
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private int bounded(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    public interface ProgressListener {
        void onProgress(int completed, int total);
    }

    private final class QueryTask implements Callable<QueryOutcome> {
        private final RestTemplate restTemplate;
        private final String number;
        private final String startTime;

        private QueryTask(RestTemplate restTemplate, String number, String startTime) {
            this.restTemplate = restTemplate;
            this.number = number;
            this.startTime = startTime;
        }

        @Override
        public QueryOutcome call() {
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(new MediaType("text", "xml", StandardCharsets.UTF_8));
                headers.put("SOAPAction", Arrays.asList(""));
                String response = restTemplate.postForObject(
                        properties.getSoapUrl(),
                        new HttpEntity<String>(buildEnvelope(number, startTime), headers),
                        String.class
                );
                return QueryOutcome.success(number, classify(response));
            } catch (Exception e) {
                return QueryOutcome.failed(number, e.getMessage());
            }
        }
    }

    private static final class QueryOutcome {
        private final String number;
        private final boolean success;
        private final List<String> categories;
        @SuppressWarnings("unused")
        private final String error;

        private QueryOutcome(String number, boolean success, List<String> categories, String error) {
            this.number = number;
            this.success = success;
            this.categories = categories;
            this.error = error;
        }

        private static QueryOutcome success(String number, List<String> categories) {
            return new QueryOutcome(number, true, categories, null);
        }

        private static QueryOutcome failed(String number, String error) {
            return new QueryOutcome(number, false, new ArrayList<String>(), error);
        }
    }
}
