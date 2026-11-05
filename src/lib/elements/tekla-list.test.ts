import { describe, expect, it } from "vitest";

import * as XLSX from "xlsx";

import { compareMarks, describeWorkbook, ElementListError, parseElementList } from "./tekla-list";

/** The shape Tekla exports: an HTML ".xls" with a project table and a list table (fictitious rows). */
function teklaHtml(header: string[], rows: Array<Array<string | number>>, total: Array<string | number>) {
  const tr = (cells: Array<string | number>) => `<TR>${cells.map((c) => `<TD>${c}</TD>`).join("")}</TR>`;
  return new TextEncoder().encode(
    `<HTML><BODY><TABLE>${tr([" Progetto numero: ", "0099"])}${tr([" Progetto ", "Kapanon Prove  "])}${tr([" Data", "01.11.2026 10:00:00"])}</TABLE>` +
      `<TABLE>${tr(header)}${rows.map(tr).join("")}${tr(total)}</TABLE></BODY></HTML>`,
  );
}

describe("Tekla element lists", () => {
  it("reads an assembly list with project number, marks, profiles and weights", () => {
    const file = teklaHtml(
      ["Assemb.", "Q.tà", "Nome", "Profilo", "Area(m²) un.", "Area(m²) tot.", "Peso(kg) un.", "Peso(kg) tot."],
      [
        ["B/10", 2, "BEAM", "IPE300", 16.04, 32.08, 582.89, 1165.77],
        ["C/2", 1, "COLUMN", "HEA240", 14.97, 14.97, 627.34, 627.34],
      ],
      ["Totale per  ", 3, "assemblaggi", " ", " ", 47.05, " ", 1793.11],
    );
    const list = parseElementList(file);
    expect(list).toMatchObject({ list: "assembly", projectNumber: "0099", projectName: "Kapanon Prove", totalPieces: 3 });
    expect(list.elements[0]).toEqual({ mark: "B/10", kind: "BEAM", profile: "IPE300", material: null, quantity: 2, lengthMm: null, weightKg: 582.89, areaM2: 16.04 });
    expect(list.totalKg).toBeCloseTo(1793.12, 1);
  });

  it("reads a part list with material and length, and stops at the total row", () => {
    const file = teklaHtml(
      ["Parte", "Profilo", "Q.tà", "Material", "Lungh. (mm)", "Area(m2) un.", "Area(m2) tot.", "Peso(kg) un.", "Peso(kg) tot."],
      [
        [1001, "PL20*450", 21, "S235JR", 450, 0.44, 9.26, 31.79, 667.64],
        ["c/83", "100*100", 2, "S235JR", 10, 0.02, 0.05, 0.78, 1.57],
      ],
      ["Totale per", " ", 23, "parti", "", "", 9.31, "", 669.21],
    );
    const list = parseElementList(file);
    expect(list.list).toBe("part");
    expect(list.elements.map((e) => [e.mark, e.material, e.lengthMm, e.quantity])).toEqual([
      ["1001", "S235JR", 450, 21],
      ["c/83", "S235JR", 10, 2],
    ]);
  });

  it("refuses a file that is neither list, also a material order with quantities", () => {
    expect(() => parseElementList(new TextEncoder().encode("<HTML><TABLE><TR><TD>NR</TD><TD>PERSHKRIMI</TD></TR></TABLE></HTML>"))).toThrow(ElementListError);
    const order = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(order, XLSX.utils.aoa_to_sheet([["NR", "PERSHKRIMI", "NJESIA", "SASIA"], [1, "HEA 200", "cope", 4]]), "Porosi");
    expect(() => parseElementList(new Uint8Array(XLSX.write(order, { type: "array", bookType: "xlsx" })))).toThrow(ElementListError);
  });

  it("reads the list re-saved in Excel, with the table shifted right and English titles", () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        ["", "Project number:", "0099"],
        [],
        ["", "Mark", "Qty", "Name", "Profile", "Weight(kg) tot."],
        ["", "B/1", 2, "BEAM", "IPE200", 100],
        ["", "C/1", 1, "COLUMN", "HEA200", 80],
        ["", "Total", 3],
      ]),
      "Sheet1",
    );
    for (const bookType of ["xlsx", "biff8"] as const) {
      const list = parseElementList(new Uint8Array(XLSX.write(book, { type: "array", bookType })));
      expect(list.list).toBe("assembly");
      expect(list.elements.map((e) => [e.mark, e.quantity, e.weightKg])).toEqual([
        ["B/1", 2, 50],
        ["C/1", 1, 80],
      ]);
    }
  });

  it("describes a file it could not read, only titles and the first cells", () => {
    const shape = describeWorkbook(new TextEncoder().encode("<HTML><TABLE><TR><TD>NR</TD><TD>PERSHKRIMI</TD></TR></TABLE></HTML>"));
    expect(shape).toContain("NR|PERSHKRIMI");
  });

  it("sorts marks the way people read them", () => {
    expect(["C/40", "B/10", "B/2", "C/9"].sort(compareMarks)).toEqual(["B/2", "B/10", "C/9", "C/40"]);
  });
});
