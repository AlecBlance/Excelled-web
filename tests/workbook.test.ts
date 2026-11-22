import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { DOMParser } from "@xmldom/xmldom";
import { inspectWorkbook, unlockWorkbook, WorkbookError, LIMITS, outputFilename, validateFile } from "../src/lib/workbook";
import { POST } from "../src/app/api/route";
import { fixture, fixtureParts, mainTypes, NS, REL } from "./fixtures";

const selected = { sheets: ["xl/worksheets/sheet1.xml"], workbook: true };
function rejects(code: string) {
  return (error: unknown) => error instanceof WorkbookError && error.code === code;
}
function inspectParts(parts: Record<string, Uint8Array>, name = "book.xlsx") {
  return inspectWorkbook(zipSync(parts), name);
}
test("repository sample: detect protection, remove it, and retain all other entry bytes", async () => {
  const data = new Uint8Array(await readFile(new URL("../sample/cant edit.xlsx", import.meta.url)));
  const prepared = inspectWorkbook(data, "cant edit.xlsx");
  assert.equal(prepared.summary.sheets.filter((sheet) => sheet.protected).length, 1);
  const paths = prepared.summary.sheets.filter((sheet) => sheet.protected).map((sheet) => sheet.path);
  const result = unlockWorkbook(prepared, { sheets: paths, workbook: prepared.summary.workbookProtected });
  const output = unzipSync(result.data);
  assert.deepEqual(Object.keys(output).sort(), Object.keys(prepared.files).sort());
  for (const [path, original] of Object.entries(prepared.files)) {
    if (!paths.includes(path) && !(path === "xl/workbook.xml" && prepared.summary.workbookProtected)) {
      assert.deepEqual(output[path], original, path);
    }
  }
  assert.equal(inspectWorkbook(result.data, "cant edit.xlsx").summary.sheets.some((sheet) => sheet.protected), false);
});
test("binary media, VBA, OLE, unselected sheets and other XML survive byte-for-byte", () => {
  const source = fixture({
    format: "xlsm",
    extra: {
      "xl/vbaProject.bin": new Uint8Array([0, 0xff, 0xfe, 0x80, 0x89]),
      "xl/embeddings/oleObject1.bin": new Uint8Array([0xff, 0, 0x80, 1]),
      "customXml/item1.xml": strToU8('<sheetProtection sheet="1"/>'),
      "xl/charts/chart1.xml": strToU8("<chart/>"),
    },
  });
  const prepared = inspectWorkbook(source, "budget.final.xlsm");
  const output = unzipSync(unlockWorkbook(prepared, selected).data);
  assert.deepEqual(Object.keys(output).sort(), Object.keys(prepared.files).sort());
  for (const [path, bytes] of Object.entries(prepared.files)) {
    if (!["xl/worksheets/sheet1.xml", "xl/workbook.xml"].includes(path)) assert.deepEqual(output[path], bytes, path);
  }
  const document = new DOMParser().parseFromString(strFromU8(output["xl/worksheets/sheet1.xml"]), "application/xml");
  assert.equal(document.getElementsByTagNameNS(NS, "sheetProtection").length, 0);
  assert.equal(document.getElementsByTagNameNS(NS, "f")[0].textContent, "SUM(1,2)");
  assert.equal(prepared.summary.outputName, "budget.final-excelled.xlsm");
  assert.match(prepared.summary.mime, /macroEnabled/);
  assert.equal(prepared.summary.warnings.length, 1);
});
test("repeated independent and concurrent operations cannot carry foreign entries", async () => {
  const first = inspectWorkbook(fixture({ extra: { "xl/media/private.bin": strToU8("FIRST_USER") } }), "first.xlsx");
  const second = inspectWorkbook(fixture(), "second.xlsx");
  const results = await Promise.all([first, second, second].map(async (book) => unzipSync(unlockWorkbook(book, selected).data)));
  assert.ok(results[0]["xl/media/private.bin"]);
  assert.equal(results[1]["xl/media/private.bin"], undefined);
  assert.equal(results[2]["xl/media/private.bin"], undefined);
  assert.equal(first.summary.sheets[0].protected, true);
  assert.match(strFromU8(second.files["xl/worksheets/sheet1.xml"]), /sheetProtection/);
});
for (const lock of [
  '<sheetProtection\n sheet="1"\n algorithmName="SHA-512" hashValue="abc" spinCount="100000"/>',
  '<sheetProtection sheet="1"></sheetProtection>',
  `<s:sheetProtection xmlns:s="${NS}" sheet="1"/>`,
]) {
  test(`namespace-aware removal: ${lock.slice(0, 45)}`, () => {
    const prepared = inspectWorkbook(fixture({ sheetLock: lock }), "book.xlsx");
    const result = inspectWorkbook(unlockWorkbook(prepared, selected).data, "book.xlsx");
    assert.equal(result.summary.sheets[0].protected, false);
    assert.equal(result.summary.workbookProtected, false);
  });
}
test("strict OOXML namespaces are supported", () => {
  const parts = fixtureParts();
  for (const path of ["xl/workbook.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml", "_rels/.rels", "xl/_rels/workbook.xml.rels"]) {
    parts[path as keyof typeof parts] = strToU8(strFromU8(parts[path as keyof typeof parts])
      .replaceAll(NS, "http://purl.oclc.org/ooxml/spreadsheetml/main")
      .replaceAll(REL, "http://purl.oclc.org/ooxml/officeDocument/relationships"));
  }
  const prepared = inspectParts(parts);
  assert.equal(inspectWorkbook(unlockWorkbook(prepared, selected).data, "strict.xlsx").summary.workbookProtected, false);
});
test("selective removal leaves workbook protection and unselected sheet unchanged", () => {
  const prepared = inspectWorkbook(fixture(), "book.xlsx");
  const sheetOnly = inspectWorkbook(unlockWorkbook(prepared, { ...selected, workbook: false }).data, "book.xlsx");
  assert.equal(sheetOnly.summary.workbookProtected, true);
  assert.equal(sheetOnly.summary.sheets[0].protected, false);
  assert.deepEqual(sheetOnly.files["xl/workbook.xml"], prepared.files["xl/workbook.xml"]);
  const workbookOnly = inspectWorkbook(unlockWorkbook(prepared, { sheets: [], workbook: true }).data, "book.xlsx");
  assert.equal(workbookOnly.summary.sheets[0].protected, true);
  assert.equal(workbookOnly.summary.workbookProtected, false);
});
for (const format of Object.keys(mainTypes)) {
  test(`preserves ${format} format and extension`, () => {
    const prepared = inspectWorkbook(fixture({ format: format as keyof typeof mainTypes }), `report.final.${format}`);
    assert.equal(prepared.summary.outputName, `report.final-excelled.${format}`);
    assert.equal(inspectWorkbook(unlockWorkbook(prepared, selected).data, `copy.${format}`).summary.workbookProtected, false);
  });
}
test("no locks and invalid selections never produce a false successful rewrite", () => {
  const prepared = inspectWorkbook(fixture({ sheetLock: "", workbookLock: "" }), "book.xlsx");
  assert.equal(prepared.summary.workbookProtected, false);
  assert.equal(prepared.summary.sheets.some((sheet) => sheet.protected), false);
  assert.throws(() => unlockWorkbook(prepared, { sheets: [], workbook: false }), rejects("nothing-selected"));
  assert.throws(() => unlockWorkbook(prepared, selected), rejects("invalid-selection"));
});
test("file validation, filename fidelity and unsupported containers", () => {
  assert.equal(outputFilename("予算.final.XLSX"), "予算.final-excelled.XLSX");
  assert.equal(outputFilename("../../report.xlsx"), ".._.._report-excelled.xlsx");
  for (const extension of ["xls", "xlsb", "zip", "csv", "constructor", "__proto__"]) {
    assert.throws(() => validateFile(`file.${extension}`, 100), rejects("unsupported-format"));
  }
  assert.throws(() => validateFile("book.xlsx", 0), rejects("empty-file"));
  assert.throws(() => validateFile("book.xlsx", LIMITS.file + 1), rejects("file-too-large"));
  assert.throws(() => inspectWorkbook(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), "encrypted.xlsx"), rejects("encrypted-or-legacy"));
  assert.throws(() => inspectWorkbook(strToU8("not Excel"), "fake.xlsx"), rejects("invalid-archive"));
  assert.throws(() => inspectWorkbook(fixture({ format: "xlsm" }), "fake.xlsx"), rejects("format-mismatch"));
  assert.throws(() => inspectParts({ "text.txt": strToU8("not Excel") }), rejects("invalid-package"));
});
test("rejects signatures, DTD, malformed XML, missing parts, nonstandard sheets", () => {
  assert.throws(() => inspectWorkbook(fixture({ extra: { "_xmlsignatures/sig1.xml": strToU8("signature") } }), "book.xlsx"), rejects("signed-package"));
  const parts = fixtureParts();
  parts["xl/workbook.xml"] = strToU8(`<!DOCTYPE workbook [<!ENTITY x "unsafe">]><workbook xmlns="${NS}"/>`);
  assert.throws(() => inspectParts(parts), rejects("invalid-xml"));
  parts["xl/workbook.xml"] = strToU8(`<workbook xmlns="${NS}"><invalid></workbook>`);
  assert.throws(() => inspectParts(parts), rejects("invalid-xml"));
  const external = fixtureParts();
  external["xl/_rels/workbook.xml.rels"] = strToU8(strFromU8(external["xl/_rels/workbook.xml.rels"]).replace('Target="worksheets/sheet1.xml"', 'Target="../evil.xml"'));
  assert.throws(() => inspectParts(external), rejects("unsupported-layout"));
  external["xl/_rels/workbook.xml.rels"] = strToU8(strFromU8(external["xl/_rels/workbook.xml.rels"]).replaceAll("/worksheet", "/chartsheet"));
  assert.throws(() => inspectParts(external), rejects("unsupported-sheet"));
});
test("rejects truncated archives, CRC errors, encrypted flags, traversal and resource limits", () => {
  const data = fixture();
  assert.throws(() => inspectWorkbook(data.slice(0, -8), "truncated.xlsx"), rejects("invalid-archive"));
  const corrupt = fixture();
  const view = new DataView(corrupt.buffer);
  for (let i = 0; i < corrupt.length - 4; i++) {
    if (view.getUint32(i, true) === 0x02014b50) { view.setUint32(i + 16, 1, true); break; }
  }
  assert.throws(() => inspectWorkbook(corrupt, "corrupt.xlsx"), rejects("invalid-archive"));
  const encrypted = fixture();
  encrypted[6] |= 1;
  assert.throws(() => inspectWorkbook(encrypted, "encrypted.xlsx"), rejects("invalid-archive"));
  assert.throws(() => inspectWorkbook(fixture({ extra: { "../evil.xml": strToU8("x") } }), "traversal.xlsx"), rejects("unsafe-archive"));
  const entries: Record<string, Uint8Array> = {};
  for (let i = 0; i <= LIMITS.entries; i++) entries[`entry${i}`] = strToU8("x");
  assert.throws(() => inspectParts(entries), rejects("archive-limit"));
  assert.throws(() => inspectWorkbook(fixture({ extra: { "big.bin": new Uint8Array(LIMITS.entry + 1) } }), "large.xlsx"), rejects("archive-limit"));
  assert.throws(() => inspectWorkbook(fixture({ extra: { "xl/worksheets/sheet1.xml": new Uint8Array(LIMITS.xml + 1) } }), "large.xlsx"), rejects("xml-limit"));
});
test("password-to-modify and external content produce explicit warnings, not modifications", () => {
  const parts = fixtureParts();
  parts["xl/workbook.xml"] = strToU8(strFromU8(parts["xl/workbook.xml"]).replace("<sheets>", '<fileSharing readOnlyRecommended="1" reservationPassword="ABCD"/><sheets>'));
  const prepared = inspectParts({ ...parts, "xl/externalLinks/link1.xml": strToU8("<externalLink/>") });
  assert.equal(prepared.summary.warnings.length, 2);
  const output = unzipSync(unlockWorkbook(prepared, selected).data);
  assert.match(strFromU8(output["xl/workbook.xml"]), /reservationPassword="ABCD"/);
  assert.deepEqual(output["xl/externalLinks/link1.xml"], strToU8("<externalLink/>"));
});
test("UTF-16 changed parts are encoded consistently as UTF-8", () => {
  const parts = fixtureParts();
  parts["xl/worksheets/sheet1.xml"] = new Uint8Array(Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from(`<?xml version="1.0" encoding="UTF-16"?>${strFromU8(parts["xl/worksheets/sheet1.xml"])}`, "utf16le"),
  ]));
  const result = unlockWorkbook(inspectParts(parts), selected);
  const text = strFromU8(unzipSync(result.data)["xl/worksheets/sheet1.xml"]);
  assert.match(text, /encoding="UTF-8"/);
  assert.equal(inspectWorkbook(result.data, "copy.xlsx").summary.sheets[0].protected, false);
});
test("retired API returns 410 without accepting a workbook", async () => {
  const response = POST();
  assert.equal(response.status, 410);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal((await response.json()).code, "client-processing-only");
});
