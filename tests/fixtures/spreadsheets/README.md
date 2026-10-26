# Synthetic spreadsheet characterization fixtures

Generated locally with the pre-remediation SheetJS 0.18.5 on 2026-10-02 before
the dependency change. No real tenant, vehicle or personal data is included.

- `trees.xlsx` / `trees.xls`: same first-sheet rows, leading-zero identifiers,
  formatted decimal/date cells, blank row, unknown/whitespace column names;
  a second sheet must be ignored.
- `trees.csv`: leading zeros, decimal strings, a quoted comma and blank field.
- `empty.xlsx`: valid workbook with an empty first sheet.
- `fleet.xlsx`: existing model-column CRLF header, category, synthetic plate,
  registration month/year and inspection month/year.

The old-version characterization passed 14/14. The patched distribution
normalizes the XML CRLF header to LF; the fleet adapter explicitly restores the
existing model-column key. Its characterization keeps the original expected
values. Other existing formats, dates, numbers, blanks and unknown columns keep
their original assertions. Corrupt/oversized inputs are generated in tests;
compressed-container tests use the patched writer and are additional coverage,
not replacements for these static old-version fixtures.
