package com.example.shop.service;

import com.example.shop.entity.PetGalleryPhoto;
import com.example.shop.repository.PetGalleryPhotoLikeRepository;
import com.example.shop.repository.PetGalleryPhotoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PetGalleryServiceTest {
    private PetGalleryPhotoRepository photoRepository;
    private RuntimeConfigService runtimeConfig;
    private PetGalleryService service;

    @BeforeEach
    void setUp() {
        photoRepository = mock(PetGalleryPhotoRepository.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getLong(eq("pet-gallery.max-file-size-bytes"), org.mockito.ArgumentMatchers.anyLong())).thenReturn(5242880L);
        when(runtimeConfig.getInt(eq("pet-gallery.max-image-width"), org.mockito.ArgumentMatchers.anyInt())).thenReturn(8000);
        when(runtimeConfig.getInt(eq("pet-gallery.max-image-height"), org.mockito.ArgumentMatchers.anyInt())).thenReturn(8000);
        when(runtimeConfig.getInt(eq("pet-gallery.max-photos-per-user"), org.mockito.ArgumentMatchers.anyInt())).thenReturn(3);
        when(runtimeConfig.getInt(eq("pet-gallery.max-photos-per-ip"), org.mockito.ArgumentMatchers.anyInt())).thenReturn(3);
        when(runtimeConfig.getString(eq("pet-gallery.upload-dir"), anyString())).thenReturn("target/test-pet-gallery");
        when(runtimeConfig.getString(eq("pet-gallery.public-path"), anyString())).thenReturn("/uploads/pet-gallery");
        service = new PetGalleryService(
                photoRepository,
                mock(PetGalleryPhotoLikeRepository.class),
                runtimeConfig);
    }

    @Test
    void findPublicPhotosBoundsInvalidPageAndSize() {
        when(photoRepository.findByStatusOrderByLikeCountDescCreatedAtDescIdDesc(eq("ACTIVE"), org.mockito.ArgumentMatchers.any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(new PetGalleryPhoto())));

        service.findPublicPhotos(null, "203.0.113.10", -3, -50);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(photoRepository).findByStatusOrderByLikeCountDescCreatedAtDescIdDesc(eq("ACTIVE"), pageable.capture());
        assertEquals(0, pageable.getValue().getPageNumber());
        assertEquals(24, pageable.getValue().getPageSize());
    }

    @Test
    void findPublicPhotosCapsLargePageSize() {
        when(photoRepository.findByStatusOrderByLikeCountDescCreatedAtDescIdDesc(eq("ACTIVE"), org.mockito.ArgumentMatchers.any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        service.findPublicPhotos(null, "203.0.113.10", 2, 500);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(photoRepository).findByStatusOrderByLikeCountDescCreatedAtDescIdDesc(eq("ACTIVE"), pageable.capture());
        assertEquals(2, pageable.getValue().getPageNumber());
        assertEquals(50, pageable.getValue().getPageSize());
    }

    @Test
    void uploadRejectsOversizedImageDimensionsBeforeWritingMetadata() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "huge.png",
                "image/png",
                pngHeader(8001, 100)
        );

        assertThrows(ResponseStatusException.class, () -> service.upload(7L, "mia", "203.0.113.10", file));

        verify(photoRepository, never()).saveAndFlush(org.mockito.ArgumentMatchers.any(PetGalleryPhoto.class));
    }

    @Test
    void uploadRejectsImageWhenDimensionsCannotBeRead() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "tiny.png",
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}
        );

        assertThrows(ResponseStatusException.class, () -> service.upload(7L, "mia", "203.0.113.10", file));

        verify(photoRepository, never()).saveAndFlush(org.mockito.ArgumentMatchers.any(PetGalleryPhoto.class));
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
