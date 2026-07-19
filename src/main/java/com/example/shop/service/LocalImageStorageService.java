package com.example.shop.service;

import lombok.extern.slf4j.Slf4j;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class LocalImageStorageService implements ImageStorageService {
    private static final Map<String, String> EXTENSIONS_BY_CONTENT_TYPE = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png"
    );
    private static final Map<String, String> OUTPUT_FORMAT_BY_CONTENT_TYPE = Map.of(
            "image/jpeg", "jpg",
            "image/png", "png"
    );

    @Override
    public StoredImage store(MultipartFile file, ImageUploadOptions options) {
        validateFile(file, options);
        String uploadedContentType = normalizeContentType(file.getContentType());
        SanitizedImage sanitizedImage = sanitizeImage(file, uploadedContentType, options);
        String filename = UUID.randomUUID() + EXTENSIONS_BY_CONTENT_TYPE.get(sanitizedImage.contentType);
        Path uploadPath = Paths.get(options.getUploadDir()).toAbsolutePath().normalize();
        Path target = uploadPath.resolve(filename).normalize();
        if (!target.startsWith(uploadPath)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, options.getMessages().getInvalidUploadPathMessage());
        }
        try {
            Files.createDirectories(uploadPath);
            Files.write(target, sanitizedImage.bytes);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, options.getMessages().getSaveFailedMessage());
        }
        String publicPath = options.getPublicPath() == null ? "" : options.getPublicPath();
        String publicUrl = publicPath.replaceAll("/$", "") + "/" + filename;
        return new StoredImage(publicUrl, sanitizedImage.contentType, sanitizedImage.bytes.length, filename, target);
    }

    private void validateFile(MultipartFile file, ImageUploadOptions options) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, options.getMessages().getEmptyFileMessage());
        }
        if (file.getSize() > options.getMaxFileSizeBytes()) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, options.getMessages().getMaxFileSizeMessage());
        }
        String contentType = normalizeContentType(file.getContentType());
        if (!options.getAllowedContentTypes().contains(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, options.getMessages().getUnsupportedContentTypeMessage());
        }
        validateImageSignature(file, contentType, options);
        validateImageDimensions(file, contentType, options);
    }

    private SanitizedImage sanitizeImage(MultipartFile file, String contentType, ImageUploadOptions options) {
        BufferedImage decoded = decodeImage(file, options);
        String outputContentType = "image/jpeg".equals(contentType) ? "image/jpeg" : "image/png";
        String outputFormat = OUTPUT_FORMAT_BY_CONTENT_TYPE.get(outputContentType);
        byte[] bytes = encodeImage(decoded, outputContentType, outputFormat, options);
        if (bytes.length > options.getMaxFileSizeBytes()) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    options.getMessages().getSanitizedTooLargeMessage());
        }
        return new SanitizedImage(outputContentType, bytes);
    }

    private BufferedImage decodeImage(MultipartFile file, ImageUploadOptions options) {
        try (InputStream inputStream = file.getInputStream();
             ImageInputStream imageInputStream = ImageIO.createImageInputStream(inputStream)) {
            if (imageInputStream == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        options.getMessages().getProcessFailedMessage());
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(imageInputStream);
            if (!readers.hasNext()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        options.getMessages().getProcessFailedMessage());
            }
            ImageReader reader = readers.next();
            BufferedImage image;
            try {
                reader.setInput(imageInputStream, true, true);
                image = reader.read(0);
            } finally {
                reader.dispose();
            }
            if (image == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        options.getMessages().getProcessFailedMessage());
            }
            return image;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, options.getMessages().getProcessFailedMessage());
        }
    }

    private byte[] encodeImage(BufferedImage image, String contentType, String outputFormat, ImageUploadOptions options) {
        if ("image/jpeg".equals(contentType)) {
            return encodeJpeg(image, options);
        }
        return encodeWithImageIo(copyImage(image, BufferedImage.TYPE_INT_ARGB, null), outputFormat, options);
    }

    private byte[] encodeJpeg(BufferedImage image, ImageUploadOptions options) {
        BufferedImage rgbImage = copyImage(image, BufferedImage.TYPE_INT_RGB, Color.WHITE);
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpg");
        if (!writers.hasNext()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, options.getMessages().getProcessFailedMessage());
        }
        ImageWriter writer = writers.next();
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
             ImageOutputStream imageOutputStream = ImageIO.createImageOutputStream(outputStream)) {
            if (imageOutputStream == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        options.getMessages().getProcessFailedMessage());
            }
            writer.setOutput(imageOutputStream);
            ImageWriteParam writeParam = writer.getDefaultWriteParam();
            if (writeParam.canWriteCompressed()) {
                writeParam.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                writeParam.setCompressionQuality(0.88f);
            }
            writer.write(null, new IIOImage(rgbImage, null, null), writeParam);
            return outputStream.toByteArray();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, options.getMessages().getProcessFailedMessage());
        } finally {
            writer.dispose();
        }
    }

    private byte[] encodeWithImageIo(BufferedImage image, String outputFormat, ImageUploadOptions options) {
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            if (!ImageIO.write(image, outputFormat, outputStream)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        options.getMessages().getProcessFailedMessage());
            }
            return outputStream.toByteArray();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, options.getMessages().getProcessFailedMessage());
        }
    }

    private BufferedImage copyImage(BufferedImage source, int targetType, Color background) {
        BufferedImage target = new BufferedImage(source.getWidth(), source.getHeight(), targetType);
        Graphics2D graphics = target.createGraphics();
        try {
            if (background != null) {
                graphics.setColor(background);
                graphics.fillRect(0, 0, target.getWidth(), target.getHeight());
            }
            graphics.drawImage(source, 0, 0, null);
        } finally {
            graphics.dispose();
        }
        return target;
    }

    private void validateImageSignature(MultipartFile file, String contentType, ImageUploadOptions options) {
        byte[] header = new byte[16];
        int read;
        try (InputStream inputStream = file.getInputStream()) {
            read = inputStream.read(header);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, options.getMessages().getReadFailedMessage());
        }

        boolean valid;
        switch (contentType) {
            case "image/jpeg":
                valid = read >= 3
                        && (header[0] & 0xff) == 0xff
                        && (header[1] & 0xff) == 0xd8
                        && (header[2] & 0xff) == 0xff;
                break;
            case "image/png":
                valid = read >= 8
                        && (header[0] & 0xff) == 0x89
                        && header[1] == 0x50
                        && header[2] == 0x4e
                        && header[3] == 0x47
                        && header[4] == 0x0d
                        && header[5] == 0x0a
                        && header[6] == 0x1a
                        && header[7] == 0x0a;
                break;
            case "image/gif":
                valid = read >= 6
                        && header[0] == 0x47
                        && header[1] == 0x49
                        && header[2] == 0x46
                        && header[3] == 0x38
                        && (header[4] == 0x37 || header[4] == 0x39)
                        && header[5] == 0x61;
                break;
            default:
                valid = false;
                break;
        }

        if (!valid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    options.getMessages().getInvalidSignatureMessage());
        }
    }

    private void validateImageDimensions(MultipartFile file, String contentType, ImageUploadOptions options) {
        byte[] bytes;
        try (InputStream inputStream = file.getInputStream()) {
            bytes = inputStream.readNBytes(65536);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, options.getMessages().getReadFailedMessage());
        }
        int[] dimensions = imageDimensions(bytes, contentType);
        if (dimensions == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    options.getMessages().getDimensionsUnavailableMessage());
        }
        if (dimensions[0] > options.getMaxImageWidth() || dimensions[1] > options.getMaxImageHeight()) {
            String message = String.format(Locale.ROOT,
                    options.getMessages().getDimensionsTooLargeMessageFormat(),
                    options.getMaxImageWidth(),
                    options.getMaxImageHeight());
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, message);
        }
    }

    private int[] imageDimensions(byte[] bytes, String contentType) {
        switch (contentType) {
            case "image/png":
                return pngDimensions(bytes);
            case "image/gif":
                return gifDimensions(bytes);
            case "image/jpeg":
                return jpegDimensions(bytes);
            default:
                return null;
        }
    }

    private int[] pngDimensions(byte[] bytes) {
        if (bytes.length < 24) {
            return null;
        }
        return new int[]{readIntBigEndian(bytes, 16), readIntBigEndian(bytes, 20)};
    }

    private int[] gifDimensions(byte[] bytes) {
        if (bytes.length < 10) {
            return null;
        }
        return new int[]{readUnsignedShortLittleEndian(bytes, 6), readUnsignedShortLittleEndian(bytes, 8)};
    }

    private int[] jpegDimensions(byte[] bytes) {
        if (bytes.length < 4) {
            return null;
        }
        int position = 2;
        while (position + 3 < bytes.length) {
            while (position < bytes.length && (bytes[position] & 0xff) != 0xff) {
                position++;
            }
            while (position < bytes.length && (bytes[position] & 0xff) == 0xff) {
                position++;
            }
            if (position >= bytes.length) {
                return null;
            }
            int marker = bytes[position++] & 0xff;
            if (marker == 0xd9 || marker == 0xda) {
                return null;
            }
            if (marker == 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
                continue;
            }
            if (position + 1 >= bytes.length) {
                return null;
            }
            int length = readUnsignedShortBigEndian(bytes, position);
            if (length < 2 || position + length > bytes.length) {
                return null;
            }
            if (isJpegStartOfFrame(marker) && length >= 7) {
                return new int[]{
                        readUnsignedShortBigEndian(bytes, position + 5),
                        readUnsignedShortBigEndian(bytes, position + 3)
                };
            }
            position += length;
        }
        return null;
    }

    private boolean isJpegStartOfFrame(int marker) {
        return (marker >= 0xc0 && marker <= 0xc3)
                || (marker >= 0xc5 && marker <= 0xc7)
                || (marker >= 0xc9 && marker <= 0xcb)
                || (marker >= 0xcd && marker <= 0xcf);
    }

    private int readIntBigEndian(byte[] bytes, int offset) {
        return ((bytes[offset] & 0xff) << 24)
                | ((bytes[offset + 1] & 0xff) << 16)
                | ((bytes[offset + 2] & 0xff) << 8)
                | (bytes[offset + 3] & 0xff);
    }

    private int readUnsignedShortBigEndian(byte[] bytes, int offset) {
        return ((bytes[offset] & 0xff) << 8) | (bytes[offset + 1] & 0xff);
    }

    private int readUnsignedShortLittleEndian(byte[] bytes, int offset) {
        return (bytes[offset] & 0xff) | ((bytes[offset + 1] & 0xff) << 8);
    }

    private String normalizeContentType(String contentType) {
        return contentType == null ? "" : contentType.trim().toLowerCase(Locale.ROOT);
    }

    private static class SanitizedImage {
        private final String contentType;
        private final byte[] bytes;

        private SanitizedImage(String contentType, byte[] bytes) {
            this.contentType = contentType;
            this.bytes = bytes;
        }
    }
}
