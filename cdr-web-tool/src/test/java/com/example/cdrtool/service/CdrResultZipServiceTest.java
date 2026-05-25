package com.example.cdrtool.service;

import com.example.cdrtool.model.CdrRunResult;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CdrResultZipServiceTest {
    @Test
    void buildsSummaryTextInDisplayOrder() {
        CdrRunResult result = new CdrRunResult();
        result.setTotal(17140);
        result.setFailed(30);
        addRows(result, "voice", 19);
        addRows(result, "GPRS", 946);
        addRows(result, "withservice", 946);
        addRows(result, "noservice", 16164);
        addRows(result, "failed", 30);

        String summaryText = new CdrResultZipService().summaryText(result);

        assertThat(summaryText).isEqualTo(
                "total=17140\n"
                        + "failed=30\n"
                        + "voice=19\n"
                        + "SMS=0\n"
                        + "MMS=0\n"
                        + "GPRS=946\n"
                        + "withservice=946\n"
                        + "noservice=16164\n"
                        + "failed=30\n"
        );
    }

    private void addRows(CdrRunResult result, String name, int count) {
        for (int i = 0; i < count; i++) {
            result.getFiles().get(name).add(name + "-" + i);
        }
    }
}
