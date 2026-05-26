package com.example.shop.util;

import java.util.ArrayList;
import java.util.List;
import java.io.IOException;
import java.io.PushbackReader;
import java.io.Reader;

public final class CsvUtils {
    private CsvUtils() {
    }

    public static List<Record> parseRecords(Reader reader) throws IOException {
        List<Record> records = new ArrayList<>();
        PushbackReader pushbackReader = new PushbackReader(reader, 1);
        StringBuilder record = new StringBuilder();
        boolean quoted = false;
        int lineNumber = 1;
        int recordStartLine = 1;
        int value;

        while ((value = pushbackReader.read()) != -1) {
            char ch = (char) value;
            if (ch == '"') {
                record.append(ch);
                if (quoted) {
                    int next = pushbackReader.read();
                    if (next == '"') {
                        record.append((char) next);
                    } else {
                        quoted = false;
                        if (next != -1) {
                            pushbackReader.unread(next);
                        }
                    }
                } else {
                    quoted = true;
                }
                continue;
            }
            if (ch == '\r' || ch == '\n') {
                String newline = String.valueOf(ch);
                if (ch == '\r') {
                    int next = pushbackReader.read();
                    if (next == '\n') {
                        newline = "\r\n";
                    } else if (next != -1) {
                        pushbackReader.unread(next);
                    }
                }
                if (quoted) {
                    record.append(newline);
                } else if (record.length() > 0) {
                    records.add(new Record(recordStartLine, parseLine(record.toString())));
                    record.setLength(0);
                    recordStartLine = lineNumber + 1;
                } else {
                    recordStartLine = lineNumber + 1;
                }
                lineNumber++;
                continue;
            }
            record.append(ch);
        }

        if (quoted) {
            throw new IllegalArgumentException("CSV contains an unterminated quoted field");
        }
        if (record.length() > 0) {
            records.add(new Record(recordStartLine, parseLine(record.toString())));
        }
        return records;
    }

    public static List<String> parseLine(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean quoted = false;

        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') {
                if (quoted && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    current.append('"');
                    i++;
                } else {
                    quoted = !quoted;
                }
            } else if (ch == ',' && !quoted) {
                values.add(current.toString());
                current.setLength(0);
            } else {
                current.append(ch);
            }
        }

        values.add(current.toString());
        return values;
    }

    public static String row(List<?> values) {
        StringBuilder row = new StringBuilder();
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                row.append(',');
            }
            row.append(escape(values.get(i)));
        }
        return row.toString();
    }

    public static String escape(Object value) {
        if (value == null) {
            return "";
        }
        String text = preventFormulaInjection(String.valueOf(value));
        if (text.contains(",") || text.contains("\"") || text.contains("\r") || text.contains("\n")) {
            return "\"" + text.replace("\"", "\"\"") + "\"";
        }
        return text;
    }

    private static String preventFormulaInjection(String value) {
        if (value.isEmpty()) {
            return value;
        }
        char first = value.charAt(0);
        return first == '=' || first == '+' || first == '-' || first == '@'
                ? "'" + value
                : value;
    }

    public static final class Record {
        private final int lineNumber;
        private final List<String> values;

        private Record(int lineNumber, List<String> values) {
            this.lineNumber = lineNumber;
            this.values = values;
        }

        public int getLineNumber() {
            return lineNumber;
        }

        public List<String> getValues() {
            return values;
        }
    }
}
