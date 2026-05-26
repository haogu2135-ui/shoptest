package com.example.shop.util;

import org.junit.jupiter.api.Test;

import java.io.StringReader;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CsvUtilsTest {
    @Test
    void escapesFormulaLikeCellsForSpreadsheetExports() {
        assertEquals("'=SUM(A1:A2),'+1,'-2,'@cmd", CsvUtils.row(List.of(
                "=SUM(A1:A2)",
                "+1",
                "-2",
                "@cmd"
        )));
    }

    @Test
    void keepsCsvQuotingForCommasAndQuotes() {
        assertEquals("\"A, B\",\"He said \"\"hi\"\"\"", CsvUtils.row(List.of("A, B", "He said \"hi\"")));
    }

    @Test
    void parsesQuotedCsvRecordsAcrossPhysicalLines() throws Exception {
        List<CsvUtils.Record> records = CsvUtils.parseRecords(new StringReader(
                "id,name,description\r\n"
                        + "1,Harness,\"Line one\r\nLine two\"\r\n"
                        + "2,Leash,Plain\r\n"
        ));

        assertEquals(3, records.size());
        assertEquals(2, records.get(1).getLineNumber());
        assertEquals(List.of("1", "Harness", "Line one\r\nLine two"), records.get(1).getValues());
        assertEquals(4, records.get(2).getLineNumber());
        assertEquals(List.of("2", "Leash", "Plain"), records.get(2).getValues());
    }

    @Test
    void rejectsUnterminatedQuotedCsvRecord() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> CsvUtils.parseRecords(new StringReader("id,name\n1,\"Harness")));

        assertEquals("CSV contains an unterminated quoted field", ex.getMessage());
    }
}
