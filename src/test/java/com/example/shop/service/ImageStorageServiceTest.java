package com.example.shop.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ImageStorageServiceTest {
    private final LocalImageStorageService service = new LocalImageStorageService();

    @TempDir
    Path tempDir;

    @Test
    void storesJpegUploadsWithSanitizedMetadata() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "photo.jpg",
                "image/jpeg",
                imageBytes("jpg"));

        ImageStorageService.StoredImage storedImage = service.store(file, options(5 * 1024 * 1024, 8000, 8000));

        assertEquals("image/jpeg", storedImage.getContentType());
        assertTrue(storedImage.getFilename().endsWith(".jpg"));
        assertTrue(storedImage.getPublicUrl().startsWith("/uploads/test/"));
        assertTrue(Files.isRegularFile(storedImage.getTarget()));
        assertEquals(Files.size(storedImage.getTarget()), storedImage.getFileSize());
        assertTrue(storedImage.getTarget().startsWith(tempDir.toAbsolutePath().normalize()));
    }

    @Test
    void storesGifUploadsAsSanitizedPng() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "photo.gif",
                "image/gif",
                tinyGifBytes());

        ImageStorageService.StoredImage storedImage = service.store(file, options(5 * 1024 * 1024, 8000, 8000));

        assertEquals("image/png", storedImage.getContentType());
        assertTrue(storedImage.getFilename().endsWith(".png"));
        assertTrue(Files.isRegularFile(storedImage.getTarget()));
    }

    @Test
    void rejectsBadSignatureWithCallerMessage() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "not-image.png",
                "image/png",
                "not an image".getBytes(StandardCharsets.UTF_8));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.store(file, options(5 * 1024 * 1024, 8000, 8000)));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        assertEquals("invalid signature", exception.getReason());
    }

    @Test
    void rejectsOversizedDimensionsBeforeWritingFile() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "huge.png",
                "image/png",
                pngHeader(101, 100));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.store(file, options(5 * 1024 * 1024, 100, 100)));

        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, exception.getStatus());
        assertEquals("dimensions too large 100x100", exception.getReason());
        try (var paths = Files.list(tempDir)) {
            assertFalse(paths.findAny().isPresent());
        }
    }

    @Test
    void localImageStorageDecodesWithDisposableImageReader() throws Exception {
        String source = Files.readString(
                Path.of("src/main/java/com/example/shop/service/LocalImageStorageService.java"),
                StandardCharsets.UTF_8);

        assertFalse(source.contains("ImageIO.read("));
        assertTrue(source.contains("ImageIO.createImageInputStream"));
        assertTrue(source.contains("ImageIO.getImageReaders(imageInputStream)"));
        assertTrue(source.contains("reader.dispose()"));
    }

    private ImageStorageService.ImageUploadOptions options(long maxFileSizeBytes, int maxWidth, int maxHeight) {
        return new ImageStorageService.ImageUploadOptions(
                tempDir.toString(),
                "/uploads/test/",
                maxFileSizeBytes,
                maxWidth,
                maxHeight,
                Set.of("image/jpeg", "image/png", "image/gif"),
                messages());
    }

    private ImageStorageService.ImageUploadMessages messages() {
        return new ImageStorageService.ImageUploadMessages(
                "empty",
                "too large",
                "unsupported",
                "invalid path",
                "save failed",
                "sanitized too large",
                "read failed",
                "invalid signature",
                "bad dimensions",
                "dimensions too large %dx%d",
                "process failed");
    }

    private byte[] imageBytes(String format) throws Exception {
        BufferedImage image = new BufferedImage(4, 3, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        try {
            graphics.setColor(Color.BLUE);
            graphics.fillRect(0, 0, image.getWidth(), image.getHeight());
        } finally {
            graphics.dispose();
        }
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            assertTrue(ImageIO.write(image, format, outputStream));
            return outputStream.toByteArray();
        }
    }

    private byte[] tinyGifBytes() {
        return Base64.getDecoder().decode("R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==");
    }

    private byte[] pngHeader(int width, int height) {
        byte[] bytes = new byte[33];
        bytes[0] = (byte) 0x89;
        bytes[1] = 0x50;
        bytes[2] = 0x4e;
        bytes[3] = 0x47;
        bytes[4] = 0x0d;
        bytes[5] = 0x0a;
        bytes[6] = 0x1a;
        bytes[7] = 0x0a;
        writeIntBigEndian(bytes, 16, width);
        writeIntBigEndian(bytes, 20, height);
        return bytes;
    }

    private void writeIntBigEndian(byte[] bytes, int offset, int value) {
        bytes[offset] = (byte) ((value >>> 24) & 0xff);
        bytes[offset + 1] = (byte) ((value >>> 16) & 0xff);
        bytes[offset + 2] = (byte) ((value >>> 8) & 0xff);
        bytes[offset + 3] = (byte) (value & 0xff);
    }
}
