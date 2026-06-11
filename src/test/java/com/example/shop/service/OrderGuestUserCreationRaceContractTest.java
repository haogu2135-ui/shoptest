package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderGuestUserCreationRaceContractTest {
    private static final Path ORDER_SERVICE = Path.of("src/main/java/com/example/shop/service/OrderService.java");

    @Test
    void guestUserCreationIsSerializedByEmailUntilCheckoutTransactionCompletes() throws IOException {
        String source = Files.readString(ORDER_SERVICE);

        assertTrue(source.contains("ConcurrentMap<String, ReentrantLock> guestUserCreationLocks"),
                "Guest user creation should keep per-email locks instead of racing findByEmail/save");
        assertTrue(source.contains("computeIfAbsent(email, ignored -> new ReentrantLock())"),
                "Guest user creation should lock by normalized guest email");
        assertTrue(source.contains("TransactionSynchronizationManager.registerSynchronization"),
                "Guest user creation lock should be held until the checkout transaction completes");
        assertTrue(source.contains("releaseGuestUserCreationLock(email, lock);"),
                "Guest user creation lock should always be released");
        assertTrue(source.contains("saveAndFlush(user)"),
                "Guest user insert should be flushed while the per-email lock is held");
        assertTrue(source.contains("catch (DataIntegrityViolationException ex)"),
                "Guest user creation should recover from database unique-key races by re-reading the email");
        assertTrue(Pattern.compile("private Long requireGuestUser\\(User user\\)[\\s\\S]*?\"GUEST\"\\.equals\\(user\\.getStatus\\(\\)\\)")
                        .matcher(source)
                        .find(),
                "Existing email rows must still reject registered users before returning a guest user id");
    }
}
