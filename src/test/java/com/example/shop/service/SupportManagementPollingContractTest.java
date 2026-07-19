package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class SupportManagementPollingContractTest {

    @Test
    void supportManagementQueueLoadSkipsStateUpdatesAfterDisposal() throws Exception {
        String source = Files.readString(Path.of("frontend/src/pages/SupportManagement.tsx"), StandardCharsets.UTF_8);
        String loadSessions = sliceBetween(source,
                "const loadSessions = useCallback",
                "const loadMessages = async");

        assertTrue(loadSessions.contains("isActive?: () => boolean"));
        assertTrue(loadSessions.contains("const shouldApply = () => options?.isActive?.() !== false;"));
        assertTrue(loadSessions.contains("if (!shouldApply()) return;"));
        assertTrue(loadSessions.indexOf("if (!shouldApply()) return;") < loadSessions.indexOf("sortSupportSessions(sessionsRes.data.items)"));
        assertTrue(loadSessions.contains("if (shouldApply()) {"));
        assertTrue(loadSessions.contains("message.error"));
        assertTrue(loadSessions.indexOf("if (shouldApply())") < loadSessions.indexOf("message.error"));
        assertTrue(loadSessions.contains("if (shouldApply()) {\n        setQueueLoading(false);"));
    }

    @Test
    void supportManagementPollingChecksDisposedBetweenAsyncSteps() throws Exception {
        String source = Files.readString(Path.of("frontend/src/pages/SupportManagement.tsx"), StandardCharsets.UTF_8);
        String pollingEffect = sliceBetween(source,
                "const timer = window.setInterval(async () => {",
                "}, [canUpdateSupportReadState, loadSessions]);");

        assertTrue(pollingEffect.contains("if (disposed || polling) return;"));
        assertTrue(pollingEffect.contains("await loadSessions({ isActive: () => !disposed });"));
        assertTrue(pollingEffect.contains("if (disposed) return;"));
        assertTrue(pollingEffect.contains("adminSupportApi.getMessages(activeSession.id, { afterId, limit: SUPPORT_MESSAGE_WINDOW })"));
        assertTrue(pollingEffect.contains("if (disposed || selectedSessionRef.current?.id !== activeSession.id) return;"));
        assertTrue(pollingEffect.indexOf("adminSupportApi.getMessages(activeSession.id, { afterId, limit: SUPPORT_MESSAGE_WINDOW })")
                < pollingEffect.indexOf("if (disposed || selectedSessionRef.current?.id !== activeSession.id) return;"));
        assertTrue(pollingEffect.indexOf("if (disposed || selectedSessionRef.current?.id !== activeSession.id) return;")
                < pollingEffect.indexOf("setMessages((items) => mergeSupportMessages(items, res.data));"));
        assertTrue(pollingEffect.contains("} finally {\n        polling = false;\n      }"));
        assertTrue(pollingEffect.contains("disposed = true;"));
        assertTrue(pollingEffect.contains("window.clearInterval(timer);"));
    }

    private static String trackedSource(String path) throws IOException, InterruptedException {
        return runGit("show", ":" + path);
    }

    private static String runGit(String... args) throws IOException, InterruptedException {
        List<String> command = new ArrayList<>();
        command.add("git");
        command.addAll(List.of(args));
        Process process = new ProcessBuilder(command)
                .redirectErrorStream(true)
                .start();
        String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        int exitCode = process.waitFor();
        if (exitCode != 0) {
            throw new IllegalStateException("git command failed: " + String.join(" ", command) + "\n" + output);
        }
        return output;
    }

    private static String sliceBetween(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, "Missing start marker: " + startMarker);
        int end = source.indexOf(endMarker, start + startMarker.length());
        assertTrue(end > start, "Missing end marker after " + startMarker + ": " + endMarker);
        return source.substring(start, end);
    }
}
