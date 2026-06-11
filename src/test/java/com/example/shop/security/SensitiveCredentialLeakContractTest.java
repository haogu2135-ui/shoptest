package com.example.shop.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

class SensitiveCredentialLeakContractTest {

    @Test
    void staleRemoteDatabaseTestCredentialsAreNotTracked() throws Exception {
        String removedTestPath = "src/test/java/com/example/shop/service/impl/UserServiceImplTest.java";
        assertFalse(gitLines("ls-files").contains(removedTestPath),
                "legacy remote-database integration test must not be tracked");

        assertNoTrackedLiteral(String.join(".", "8", "219", "164", "50"));
        assertNoTrackedLiteral("guhao" + "de" + "guhao123");
        assertNoTrackedLiteral("jdbc:mysql://" + String.join(".", "8", "219", "164", "50"));
    }

    private static void assertNoTrackedLiteral(String literal) throws IOException, InterruptedException {
        GitResult result = runGitAllowingNoMatches("grep", "--cached", "-n", "-F", literal, "--");
        assertEquals(1, result.exitCode, () -> "sensitive credential literal is still tracked:\n" + result.output);
    }

    private static List<String> gitLines(String... args) throws IOException, InterruptedException {
        GitResult result = runGitAllowingNoMatches(args);
        if (result.exitCode != 0) {
            throw new IllegalStateException("git command failed: git " + String.join(" ", args) + "\n" + result.output);
        }
        if (result.output.isBlank()) {
            return List.of();
        }
        return result.output.lines()
                .filter(line -> !line.isBlank())
                .toList();
    }

    private static GitResult runGitAllowingNoMatches(String... args) throws IOException, InterruptedException {
        List<String> command = new ArrayList<>();
        command.add("git");
        command.addAll(List.of(args));
        Process process = new ProcessBuilder(command)
                .redirectErrorStream(true)
                .start();
        String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        int exitCode = process.waitFor();
        if (exitCode != 0 && exitCode != 1) {
            throw new IllegalStateException("git command failed: " + String.join(" ", command) + "\n" + output);
        }
        return new GitResult(exitCode, output);
    }

    private static final class GitResult {
        private final int exitCode;
        private final String output;

        private GitResult(int exitCode, String output) {
            this.exitCode = exitCode;
            this.output = output;
        }
    }
}
