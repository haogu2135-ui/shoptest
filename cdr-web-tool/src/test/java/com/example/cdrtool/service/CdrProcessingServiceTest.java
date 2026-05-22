package com.example.cdrtool.service;

import com.example.cdrtool.config.CdrToolProperties;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CdrProcessingServiceTest {
    @Test
    void classifiesKnownServiceCategories() {
        CdrProcessingService service = new CdrProcessingService(new CdrToolProperties());

        List<String> categories = service.classify(
                "<bbs:ServiceCategory>1</bbs:ServiceCategory>"
                        + "<bbs:ServiceCategory>2</bbs:ServiceCategory>"
                        + "<bbs:ServiceCategory>5</bbs:ServiceCategory>"
        );

        assertThat(categories).containsExactly("voice", "SMS", "GPRS");
    }
}
