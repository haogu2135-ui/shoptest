package com.example.shop.security;

import com.example.shop.service.RuntimeConfigService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
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
        Map<String, Object> claims = new HashMap<>(extraClaims);
        if (userDetails instanceof UserDetailsImpl) {
            UserDetailsImpl user = (UserDetailsImpl) userDetails;
            claims.putIfAbsent("userId", user.getId());
            claims.putIfAbsent("email", user.getEmail());
        }
        String jti = UUID.randomUUID().toString();
        return Jwts.builder()
                .setClaims(claims)
                .setId(jti)
                .setSubject(userDetails.getUsername())
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + runtimeConfig.getInt("app.jwtExpirationInMs", 7200000)))
                .signWith(SignatureAlgorithm.HS256, jwtSecret())
                .compact();
    }

    public String extractJti(String token) {
        return extractClaim(token, Claims::getId);
    }

    public long getExpirationMs(String token) {
        Date exp = extractExpiration(token);
        return Math.max(0, exp.getTime() - System.currentTimeMillis());
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return username.equals(userDetails.getUsername())
                && !isTokenExpired(token)
                && !isTokenIssuedBeforePasswordChange(token, userDetails);
    }

    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    private boolean isTokenIssuedBeforePasswordChange(String token, UserDetails userDetails) {
        if (!(userDetails instanceof UserDetailsImpl)) {
            return false;
        }
        LocalDateTime passwordChangedAt = ((UserDetailsImpl) userDetails).getPasswordChangedAt();
        if (passwordChangedAt == null) {
            return false;
        }
        Date issuedAt = extractClaim(token, Claims::getIssuedAt);
        if (issuedAt == null) {
            return true;
        }
        long changedAtMillis = passwordChangedAt.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
        return issuedAt.getTime() < changedAtMillis;
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
        String secret = jwtSecret().trim();
        if (secret.isEmpty()
                || "your-secret-key".equals(secret)
                || "your-secret-key-here".equals(secret)
                || secret.length() < 32) {
            throw new IllegalStateException("JWT secret is not configured; set JWT_SECRET to at least 32 characters");
        }
    }

    private String jwtSecret() {
        return runtimeConfig.getString("app.jwtSecret", "");
    }
}
