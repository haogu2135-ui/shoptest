package com.example.shop.security;

import com.example.shop.service.RuntimeConfigService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;

@Service
public class JwtService {
    private final RuntimeConfigService runtimeConfig;

    public JwtService(RuntimeConfigService runtimeConfig) {
        this.runtimeConfig = runtimeConfig;
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    public String generateToken(UserDetails userDetails) {
        return generateToken(new HashMap<>(), userDetails);
    }

    public String generateToken(Map<String, Object> extraClaims, UserDetails userDetails) {
        ensureJwtSecretConfigured();
        return Jwts.builder()
                .setClaims(extraClaims)
                .setSubject(userDetails.getUsername())
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + runtimeConfig.getInt("app.jwtExpirationInMs", 86400000)))
                .signWith(SignatureAlgorithm.HS256, jwtSecret())
                .compact();
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return (username.equals(userDetails.getUsername())) && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    private Claims extractAllClaims(String token) {
        ensureJwtSecretConfigured();
        return Jwts.parser()
                .setSigningKey(jwtSecret())
                .parseClaimsJws(token)
                .getBody();
    }

    private void ensureJwtSecretConfigured() {
        if (!isProductionMode()) {
            return;
        }
        String secret = jwtSecret().trim();
        if (secret.isEmpty()
                || "your-secret-key".equals(secret)
                || "your-secret-key-here".equals(secret)
                || secret.length() < 32) {
            throw new IllegalStateException("JWT secret is not configured for production");
        }
    }

    private boolean isProductionMode() {
        String mode = runtimeConfig.getString("app.runtime-mode", "production").trim().toLowerCase(Locale.ROOT);
        return "production".equals(mode) || "prod".equals(mode);
    }

    private String jwtSecret() {
        return runtimeConfig.getString("app.jwtSecret", "");
    }
}
