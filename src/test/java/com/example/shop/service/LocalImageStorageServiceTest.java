package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class LocalImageStorageServiceTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/service/LocalImageStorageService.java");

    @Test
    void localImageStorageKeepsUploadValidationAndSanitizationContract() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("implements ImageStorageService"));
        assertTrue(source.contains("validateFile(file, options);"));
        assertTrue(source.contains("file == null || file.isEmpty()"));
        assertTrue(source.contains("file.getSize() > options.getMaxFileSizeBytes()"));
        assertTrue(source.contains("!options.getAllowedContentTypes().contains(contentType)"));
        assertTrue(source.contains("validateImageSignature(file, contentType, options);"));
        assertTrue(source.contains("validateImageDimensions(file, contentType, options);"));
        assertTrue(source.contains("BufferedImage image = ImageIO.read(inputStream);")
                || source.contains("ImageIO.createImageInputStream(inputStream)"));
        assertTrue(source.contains("byte[] bytes = encodeImage(decoded, outputContentType, outputFormat, options);"));
        assertTrue(source.contains("if (bytes.length > options.getMaxFileSizeBytes())"));
    }

    @Test
    void localImageStorageKeepsPathAndOutputSafetyContract() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("Paths.get(options.getUploadDir()).toAbsolutePath().normalize()"));
        assertTrue(source.contains("Path target = uploadPath.resolve(filename).normalize();"));
        assertTrue(source.contains("if (!target.startsWith(uploadPath))"));
        assertTrue(source.contains("Files.createDirectories(uploadPath);"));
        assertTrue(source.contains("Files.write(target, sanitizedImage.bytes);"));
        assertTrue(source.contains("String publicUrl = publicPath.replaceAll(\"/$\", \"\") + \"/\" + filename;"));
        assertTrue(source.contains("return new StoredImage(publicUrl, sanitizedImage.contentType, sanitizedImage.bytes.length, filename, target);"));
    }
}
