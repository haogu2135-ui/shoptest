package com.example.shop.util;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
}
