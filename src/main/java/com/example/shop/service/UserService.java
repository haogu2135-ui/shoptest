package com.example.shop.service;

import lombok.extern.slf4j.Slf4j;
import com.example.shop.dto.UserAdminSummaryResponse;
import com.example.shop.entity.User;
import com.example.shop.repository.UserMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {
    private static final int USER_PHONE_MAX_CHARS = 20;
    private static final int PASSWORD_MIN_CHARS = 8;
    private static final int PASSWORD_MAX_CHARS = 128;
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$", Pattern.CASE_INSENSITIVE);

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    
    public User findByUsername(String username) {
        String login = normalizeLookupText(username);
        return login == null ? null : userMapper.findByUsername(login);
    }

    public User findByPhone(String phone) {
        String login = normalizeLookupText(phone);
        return login == null ? null : userMapper.findByPhone(login);
    }

    public User findByUsernameOrPhone(String login) {
        String normalizedLogin = normalizeLookupText(login);
        if (normalizedLogin == null) {
            return null;
        }
        User user = userMapper.findByUsernameOrPhone(normalizedLogin);
        if (user == null && !looksLikeEmail(normalizedLogin)) {
            user = findByCompactedLogin(normalizedLogin);
        }
        return user;
    }

    public User findByUsernameOrPhoneOrEmail(String login) {
        String normalizedLogin = normalizeLookupText(login);
        if (normalizedLogin == null) {
            return null;
        }
        User user = userMapper.findByUsernameOrPhoneOrEmail(normalizedLogin);
        if (user == null && !looksLikeEmail(normalizedLogin)) {
            user = findByCompactedLoginWithEmail(normalizedLogin);
        }
        return user;
    }
    
    public User findById(Long id) {
        return userMapper.findById(id);
    }
    
    @Transactional
    public User register(User user) {
        return register(user, false);
    }

    @Transactional
    public User register(User user, boolean guestEmailVerified) {
        if (user == null) {
            throw new IllegalArgumentException("Registration payload is required");
        }
        if (user.getUsername() == null || user.getUsername().trim().isEmpty()) {
            throw new IllegalArgumentException("Username is required");
        }
        if (user.getEmail() == null || user.getEmail().trim().isEmpty()) {
            throw new IllegalArgumentException("Email is required");
        }
        if (user.getPhone() == null || user.getPhone().trim().isEmpty()) {
            throw new IllegalArgumentException("Phone number is required");
        }
        assertStrongPassword(user.getPassword(), "Password");
        String normalizedPhone = normalizeRequiredPhoneText(user.getPhone(), "Phone number", USER_PHONE_MAX_CHARS);
        String normalizedEmail = normalizeRequiredStorageText(user.getEmail(), "Email", 100).toLowerCase();
        assertValidEmail(normalizedEmail, "Email");
        String normalizedUsername = normalizeUsernameText(user.getUsername(), "Username", 50);
        if (looksLikeEmail(normalizedUsername)) {
            normalizedUsername = normalizedUsername.toLowerCase(Locale.ROOT);
        }

        User existingEmail = userMapper.findByUsernameOrPhoneOrEmail(normalizedEmail);
        boolean upgradingGuestAccount = isGuestEmailOwner(existingEmail, normalizedEmail);
        User existingPhone = userMapper.findByPhone(normalizedPhone);
        if (existingPhone != null && !isSameUser(existingPhone, existingEmail)) {
            throw new IllegalArgumentException("Phone number already registered");
        }
        User existingUsername = userMapper.findByUsername(normalizedUsername);
        if (existingUsername != null && !isSameUser(existingUsername, existingEmail)) {
            throw new IllegalArgumentException("Username already registered");
        }
        if (existingEmail != null) {
            if (upgradingGuestAccount) {
                if (!guestEmailVerified) {
                    throw new IllegalArgumentException("Email verification is required to claim guest checkout history");
                }
                String rawPassword = user.getPassword();
                applyRegisteredUserFields(user, normalizedUsername, normalizedEmail, normalizedPhone, rawPassword);
                user.setId(existingEmail.getId());
                userMapper.update(user);
                return userMapper.findById(existingEmail.getId());
            }
            throw new IllegalArgumentException("Email already registered");
        }
        applyRegisteredUserFields(user, normalizedUsername, normalizedEmail, normalizedPhone, user.getPassword());
        LocalDateTime now = LocalDateTime.now();
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        user.setPasswordChangedAt(now);
        userMapper.insert(user);
        if (user.getId() != null) {
            User saved = userMapper.findById(user.getId());
            if (saved != null) {
                return saved;
            }
        }
        User saved = userMapper.findByUsernameOrPhoneOrEmail(normalizedEmail);
        return saved != null ? saved : userMapper.findByUsernameOrPhoneOrEmail(normalizedPhone);
    }

    @Transactional
    public void registerAdmin(User user) {
        assertAdminBootstrapLockAcquired();
        try {
            if (userMapper.countAdminUsers() > 0) {
                throw new IllegalArgumentException("Admin bootstrap is already completed");
            }
            if (user.getUsername() == null || user.getUsername().trim().isEmpty()) {
                throw new IllegalArgumentException("Admin username is required");
            }
            if (user.getEmail() == null || user.getEmail().trim().isEmpty()) {
                throw new IllegalArgumentException("Admin email is required");
            }
            assertStrongPassword(user.getPassword(), "Admin password");
            user.setUsername(normalizeRequiredStorageText(user.getUsername(), "Admin username", 50));
            user.setEmail(normalizeRequiredStorageText(user.getEmail(), "Admin email", 100).toLowerCase());
            assertValidEmail(user.getEmail(), "Admin email");
            if (userMapper.findByUsername(user.getUsername()) != null) {
                throw new IllegalArgumentException("Username already registered");
            }
            User existingEmail = userMapper.findByUsernameOrPhoneOrEmail(user.getEmail());
            if (existingEmail != null) {
                throw new IllegalArgumentException("Email already registered");
            }
            user.setPassword(passwordEncoder.encode(user.getPassword()));
            user.setRole("ADMIN");
            user.setRoleCode("ADMIN");
            user.setStatus("ACTIVE");
            user.setCreatedAt(LocalDateTime.now());
            user.setUpdatedAt(LocalDateTime.now());
            user.setPasswordChangedAt(user.getUpdatedAt());
            userMapper.insert(user);
        } finally {
            userMapper.releaseAdminBootstrapLock();
        }
    }
    
    @Transactional
    public void update(User user) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("User is required");
        }
        User current = userMapper.findById(user.getId());
        if (current == null) {
            throw new IllegalArgumentException("User not found");
        }
        normalizeMutableProfileFields(user, current);
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.update(user);
    }

    private void normalizeMutableProfileFields(User user, User current) {
        if (user.getEmail() != null && !Objects.equals(user.getEmail(), current.getEmail())) {
            user.setEmail(normalizeOptionalEmailForUpdate(user.getId(), user.getEmail()));
        }
        if (user.getPhone() != null && !Objects.equals(user.getPhone(), current.getPhone())) {
            user.setPhone(normalizeOptionalPhoneForUpdate(user.getId(), user.getPhone()));
        }
        if (user.getAddress() != null && !Objects.equals(user.getAddress(), current.getAddress())) {
            String normalizedAddress = normalizeOptionalStorageText(user.getAddress(), "Address", 260);
            user.setAddress(normalizedAddress == null ? "" : normalizedAddress);
        }
    }

    private String normalizeOptionalEmailForUpdate(Long userId, String email) {
        String normalizedEmail = normalizeOptionalStorageText(email, "Email", 100);
        if (normalizedEmail == null) {
            return "";
        }
        normalizedEmail = normalizedEmail.toLowerCase(Locale.ROOT);
        assertValidEmail(normalizedEmail, "Email");
        User existingEmail = userMapper.findByUsernameOrPhoneOrEmail(normalizedEmail);
        if (existingEmail != null && !userId.equals(existingEmail.getId())) {
            throw new IllegalArgumentException("Email already registered");
        }
        return normalizedEmail;
    }

    private String normalizeOptionalPhoneForUpdate(Long userId, String phone) {
        String normalizedPhone = normalizeOptionalPhoneText(phone, "Phone number", USER_PHONE_MAX_CHARS);
        if (normalizedPhone == null) {
            return "";
        }
        User existingPhone = userMapper.findByPhone(normalizedPhone);
        if (existingPhone != null && !userId.equals(existingPhone.getId())) {
            throw new IllegalArgumentException("Phone number already registered");
        }
        return normalizedPhone;
    }

    @Transactional
    public void updateProfileContact(Long userId, String email, String phone) {
        User current = userMapper.findById(userId);
        if (current == null) {
            throw new IllegalArgumentException("User not found");
        }
        String normalizedEmail = normalizeRequiredStorageText(email, "Email", 100);
        normalizedEmail = normalizedEmail.toLowerCase();
        assertValidEmail(normalizedEmail, "Email");
        String normalizedPhone = normalizeOptionalPhoneText(phone, "Phone number", USER_PHONE_MAX_CHARS);

        if (!normalizedEmail.equalsIgnoreCase(current.getEmail())) {
            User existingEmail = userMapper.findByUsernameOrPhoneOrEmail(normalizedEmail);
            if (existingEmail != null && !userId.equals(existingEmail.getId())) {
                throw new IllegalArgumentException("Email already registered");
            }
        }
        if (normalizedPhone != null && !normalizedPhone.equals(current.getPhone())) {
            User existingPhone = userMapper.findByPhone(normalizedPhone);
            if (existingPhone != null && !userId.equals(existingPhone.getId())) {
                throw new IllegalArgumentException("Phone number already registered");
            }
        }
        userMapper.updateProfileContact(userId, normalizedEmail, normalizedPhone, LocalDateTime.now());
    }

    @Transactional
    public void updateRoleAccess(Long userId, String role, String roleCode) {
        userMapper.updateRoleAccess(userId, role, roleCode, LocalDateTime.now());
    }
    
    @Transactional
    public void updatePassword(Long userId, String oldPassword, String newPassword) {
        assertStrongPassword(newPassword, "New password");
        User user = userMapper.findById(userId);
        if (user != null && passwordEncoder.matches(oldPassword, user.getPassword())) {
            userMapper.updatePassword(userId, passwordEncoder.encode(newPassword), LocalDateTime.now());
        } else {
            throw new IllegalArgumentException("Current password is incorrect");
        }
    }

    @Transactional
    public void resetPassword(String login, String email, String newPassword) {
        assertStrongPassword(newPassword, "New password");
        String normalizedLogin = normalizeLookupText(login);
        String normalizedEmail = normalizeRequiredStorageText(email, "Email", 100).toLowerCase(Locale.ROOT);
        assertValidEmail(normalizedEmail, "Email");
        User user = normalizedLogin == null ? null : findByUsernameOrPhoneOrEmail(normalizedLogin);
        if (user == null || user.getEmail() == null || !user.getEmail().equalsIgnoreCase(normalizedEmail)) {
            throw new IllegalArgumentException("Account information does not match");
        }
        userMapper.updatePassword(user.getId(), passwordEncoder.encode(newPassword), LocalDateTime.now());
    }

    public List<User> findAll() {
        return userMapper.findAll();
    }

    public List<User> search(String keyword, String role, String status) {
        return userMapper.search(
                normalizeText(keyword, 120),
                normalizeText(role, 40),
                normalizeText(status, 40));
    }

    public long countSearch(String keyword, String role, String status) {
        return userMapper.countSearch(
                normalizeText(keyword, 120),
                normalizeText(role, 40),
                normalizeText(status, 40));
    }

    public List<User> searchPage(String keyword, String role, String status, int page, int size) {
        int safeSize = Math.max(1, size);
        int safePage = Math.max(1, page);
        int offset = Math.max(0, (safePage - 1) * safeSize);
        return userMapper.searchPage(
                normalizeText(keyword, 120),
                normalizeText(role, 40),
                normalizeText(status, 40),
                safeSize,
                offset);
    }

    public UserAdminSummaryResponse adminSummary(String keyword, String role, String status) {
        Map<String, Object> row = userMapper.adminSummary(
                normalizeText(keyword, 120),
                normalizeText(role, 40),
                normalizeText(status, 40));
        UserAdminSummaryResponse response = new UserAdminSummaryResponse();
        response.setTotalUsers(numberValue(row, "totalUsers"));
        response.setActiveUsers(numberValue(row, "activeUsers"));
        response.setBannedUsers(numberValue(row, "bannedUsers"));
        response.setAdminUsers(numberValue(row, "adminUsers"));
        response.setCustomerUsers(numberValue(row, "customerUsers"));
        response.setMissingEmailUsers(numberValue(row, "missingEmailUsers"));
        response.setMissingPhoneUsers(numberValue(row, "missingPhoneUsers"));
        response.setReadyUsers(numberValue(row, "readyUsers"));
        response.setAdminRatioPercent(response.getTotalUsers() == 0
                ? 0
                : (int) Math.round(response.getAdminUsers() * 100.0 / response.getTotalUsers()));
        response.setHealthScore(calculateUserHealthScore(response));
        response.setCheckedAt(Instant.now().toString());
        return response;
    }

    @Transactional
    public void deleteById(Long id) {
        userMapper.deleteById(id);
    }

    public long count() {
        return userMapper.countAll();
    }

    private int calculateUserHealthScore(UserAdminSummaryResponse summary) {
        int adminRisk = summary.getAdminRatioPercent() > 25 && summary.getTotalUsers() >= 4 ? 18 : 0;
        long rawScore = 100
                - summary.getBannedUsers() * 8
                - summary.getMissingEmailUsers() * 10
                - summary.getMissingPhoneUsers() * 4
                - adminRisk;
        return (int) Math.max(0, Math.min(100, rawScore));
    }

    private long numberValue(Map<String, Object> row, String key) {
        if (row == null || row.isEmpty()) {
            return 0;
        }
        Object value = row.get(key);
        if (value == null) {
            value = row.get(camelToSnake(key));
        }
        if (value == null) {
            value = row.get(key.toLowerCase());
        }
        if (value == null) {
            value = row.get(key.toUpperCase());
        }
        if (value == null) {
            String snake = camelToSnake(key);
            value = row.get(snake.toLowerCase());
            if (value == null) {
                value = row.get(snake.toUpperCase());
            }
        }
        return value instanceof Number ? ((Number) value).longValue() : 0;
    }

    private String camelToSnake(String value) {
        return value.replaceAll("([a-z])([A-Z])", "$1_$2").toLowerCase();
    }

    private void assertAdminBootstrapLockAcquired() {
        Long acquired = userMapper.acquireAdminBootstrapLock();
        if (acquired == null || acquired.longValue() != 1L) {
            throw new IllegalStateException("Admin bootstrap is currently locked");
        }
    }

    private void applyRegisteredUserFields(User user, String username, String email, String phone, String rawPassword) {
        LocalDateTime now = LocalDateTime.now();
        user.setUsername(username);
        user.setEmail(email);
        user.setPhone(phone);
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setRole("USER");
        user.setStatus("ACTIVE");
        user.setUpdatedAt(now);
        user.setPasswordChangedAt(now);
    }

    private void assertStrongPassword(String password, String fieldName) {
        String normalizedFieldName = fieldName == null || fieldName.isBlank() ? "Password" : fieldName;
        if (password == null || password.trim().isEmpty()) {
            throw new IllegalArgumentException(normalizedFieldName + " is required");
        }
        if (password.length() < PASSWORD_MIN_CHARS || password.length() > PASSWORD_MAX_CHARS) {
            throw new IllegalArgumentException(normalizedFieldName + " must be 8 to 128 characters");
        }
        boolean hasLetter = password.chars().anyMatch(Character::isLetter);
        boolean hasDigit = password.chars().anyMatch(Character::isDigit);
        if (!hasLetter || !hasDigit) {
            throw new IllegalArgumentException(normalizedFieldName + " must include letters and numbers");
        }
    }

    private boolean isGuestEmailOwner(User user, String normalizedEmail) {
        return user != null
                && user.getId() != null
                && user.getEmail() != null
                && user.getEmail().equalsIgnoreCase(normalizedEmail)
                && "GUEST".equalsIgnoreCase(user.getStatus());
    }

    public boolean isGuestEmailOwner(String email) {
        String normalizedEmail = normalizeLookupText(email);
        if (normalizedEmail == null || !looksLikeEmail(normalizedEmail)) {
            return false;
        }
        User existingEmail = userMapper.findByUsernameOrPhoneOrEmail(normalizedEmail);
        return isGuestEmailOwner(existingEmail, normalizedEmail);
    }

    private boolean isSameUser(User left, User right) {
        return left != null
                && right != null
                && left.getId() != null
                && left.getId().equals(right.getId());
    }

    private String normalizeText(String value, int maxLength) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        String normalized = value.replaceAll("\\p{Cntrl}", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (normalized.isEmpty()) {
            return null;
        }
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }

    private String normalizeRequiredStorageText(String value, String field, int maxLength) {
        String normalized = normalizeStorageText(value, field, maxLength);
        if (normalized == null) {
            throw new IllegalArgumentException(field + " is required");
        }
        return normalized;
    }

    private String normalizeOptionalStorageText(String value, String field, int maxLength) {
        return normalizeStorageText(value, field, maxLength);
    }

    private String normalizeRequiredPhoneText(String value, String field, int maxLength) {
        String normalized = normalizePhoneText(value, field, maxLength);
        if (normalized == null) {
            throw new IllegalArgumentException(field + " is required");
        }
        return normalized;
    }

    private String normalizeOptionalPhoneText(String value, String field, int maxLength) {
        return normalizePhoneText(value, field, maxLength);
    }

    private String normalizePhoneText(String value, String field, int maxLength) {
        String normalized = normalizeStorageText(value, field, Math.max(maxLength * 2, maxLength));
        if (normalized == null) {
            return null;
        }
        if (normalized.startsWith("+")) {
            normalized = "+" + normalized.substring(1).replaceAll("\\D+", "");
        } else {
            normalized = normalized.replaceAll("\\D+", "");
        }
        if (normalized.isEmpty()) {
            return null;
        }
        if (normalized.length() > maxLength) {
            throw new IllegalArgumentException(field + " is too long");
        }
        return normalized;
    }

    private String normalizeStorageText(String value, String field, int maxLength) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        String normalized = value.replaceAll("\\p{Cntrl}", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (normalized.isEmpty()) {
            return null;
        }
        if (normalized.length() > maxLength) {
            throw new IllegalArgumentException(field + " is too long");
        }
        return normalized;
    }

    private String normalizeLookupText(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        String normalized = value.replaceAll("\\p{Cntrl}", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (normalized.isEmpty()) {
            return null;
        }
        return normalized.contains("@") ? normalized.toLowerCase(Locale.ROOT) : normalized;
    }

    private User findByCompactedLogin(String normalizedLogin) {
        for (String candidate : compactLoginCandidates(normalizedLogin)) {
            User user = userMapper.findByUsernameOrPhone(candidate);
            if (user != null) {
                return user;
            }
        }
        return null;
    }

    private User findByCompactedLoginWithEmail(String normalizedLogin) {
        for (String candidate : compactLoginCandidates(normalizedLogin)) {
            User user = userMapper.findByUsernameOrPhoneOrEmail(candidate);
            if (user != null) {
                return user;
            }
        }
        return null;
    }

    private List<String> compactLoginCandidates(String normalizedLogin) {
        String compactWhitespace = normalizedLogin.replaceAll("\\s+", "");
        String compactPhone = compactWhitespace.startsWith("+")
                ? "+" + compactWhitespace.substring(1).replaceAll("\\D+", "")
                : compactWhitespace.replaceAll("\\D+", "");
        if (compactPhone.startsWith("+")) {
            compactPhone = "+" + compactPhone.substring(1).replace("+", "");
        } else {
            compactPhone = compactPhone.replace("+", "");
        }
        compactPhone = compactPhone.equals("+") ? "" : compactPhone;
        List<String> candidates = new ArrayList<>();
        addCompactLoginCandidate(candidates, compactWhitespace, normalizedLogin);
        addCompactLoginCandidate(candidates, compactPhone, normalizedLogin);
        return candidates;
    }

    private void addCompactLoginCandidate(List<String> candidates, String candidate, String original) {
        if (candidate == null || candidate.isBlank() || candidate.equals(original) || candidates.contains(candidate)) {
            return;
        }
        candidates.add(candidate);
    }

    private String normalizeUsernameText(String value, String field, int maxLength) {
        String normalized = normalizeRequiredStorageText(value, field, maxLength);
        if (!looksLikeEmail(normalized)) {
            normalized = normalized.replaceAll("\\s+", "");
        }
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(field + " is required");
        }
        if (normalized.length() > maxLength) {
            throw new IllegalArgumentException(field + " is too long");
        }
        return normalized;
    }

    private void assertValidEmail(String value, String field) {
        if (value == null || !EMAIL_PATTERN.matcher(value).matches()) {
            throw new IllegalArgumentException(field + " format is invalid");
        }
    }

    private boolean looksLikeEmail(String value) {
        return value != null && value.indexOf('@') > 0;
    }
} 
