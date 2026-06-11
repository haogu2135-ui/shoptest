package com.example.shop.controller;

import com.example.shop.dto.ReviewImageUploadResponse;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.ReviewImageService;
import com.example.shop.service.ReviewService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReviewControllerImageUploadValidationTest {

    @Test
    void uploadReviewImageRejectsMissingFileBeforeUpload() {
        ReviewImageService reviewImageService = mock(ReviewImageService.class);
        doThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a review photo to upload"))
                .when(reviewImageService).validateUploadRequest(null);
        ReviewController controller = new ReviewController(mock(ReviewService.class), reviewImageService);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> controller.uploadReviewImage(null, authenticatedUser()));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        verify(reviewImageService).validateUploadRequest(null);
        verify(reviewImageService, never()).upload(org.mockito.ArgumentMatchers.<MultipartFile>any());
    }

    @Test
    void uploadReviewImageValidatesBeforeUploading() {
        ReviewImageService reviewImageService = mock(ReviewImageService.class);
        MockMultipartFile file = new MockMultipartFile("file", "review.png", "image/png", new byte[]{1, 2, 3});
        when(reviewImageService.upload(file)).thenReturn("/uploads/reviews/photo.png");
        ReviewController controller = new ReviewController(mock(ReviewService.class), reviewImageService);

        ResponseEntity<ReviewImageUploadResponse> response = controller.uploadReviewImage(file, authenticatedUser());

        assertEquals(200, response.getStatusCodeValue());
        assertEquals("/uploads/reviews/photo.png", response.getBody().getImageUrl());
        org.mockito.InOrder ordered = inOrder(reviewImageService);
        ordered.verify(reviewImageService).validateUploadRequest(file);
        ordered.verify(reviewImageService).upload(file);
    }

    private Authentication authenticatedUser() {
        UserDetailsImpl principal = new UserDetailsImpl(
                42L,
                "buyer",
                "buyer@example.com",
                "ACTIVE",
                "secret",
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        return new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    }
}
