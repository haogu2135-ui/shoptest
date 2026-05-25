package com.example.cdrtool.service;

import com.example.cdrtool.model.CdrRunResult;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class CdrResultZipService {
    public byte[] zip(CdrRunResult result) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ZipOutputStream zip = new ZipOutputStream(output, StandardCharsets.UTF_8);
        try {
            for (Map.Entry<String, List<String>> entry : result.getFiles().entrySet()) {
                addText(zip, entry.getKey() + ".txt", joinLines(entry.getValue()));
            }
            addText(zip, "summary.txt", summaryText(result));
        } finally {
            zip.close();
        }
        return output.toByteArray();
    }

    private void addText(ZipOutputStream zip, String name, String content) throws Exception {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private String joinLines(List<String> lines) {
        if (lines == null || lines.isEmpty()) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        for (String line : lines) {
            builder.append(line).append('\n');
        }
        return builder.toString();
    }

    public String summaryText(CdrRunResult result) {
        StringBuilder builder = new StringBuilder();
        builder.append("total=").append(result.getTotal()).append('\n');
        builder.append("failed=").append(result.getFailed()).append('\n');
        for (Map.Entry<String, List<String>> entry : result.getFiles().entrySet()) {
            List<String> lines = entry.getValue();
            builder.append(entry.getKey()).append('=').append(lines == null ? 0 : lines.size()).append('\n');
        }
        return builder.toString();
    }
}
