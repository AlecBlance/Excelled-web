import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { Unzip, UnzipInflate, zipSync } from "fflate";
import { fail, FORMATS, LIMITS, outputFilename, validateFile, WorkbookError } from "./workbook-file";
import { preflightArchive, crc32 } from "./zip-safety";
export { LIMITS, outputFilename, validateFile, WorkbookError } from "./workbook-file";
const MAIN_TYPES = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.main+xml",
  xltx: "application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml",
  xltm: "application/vnd.ms-excel.template.macroEnabled.main+xml",
} as const;
const SPREADSHEET_NS = [
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  "http://purl.oclc.org/ooxml/spreadsheetml/main",
];
const REL_NS = [
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  "http://purl.oclc.org/ooxml/officeDocument/relationships",
];
const PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const CONTENT_NS = "http://schemas.openxmlformats.org/package/2006/content-types";

export type SheetInfo = { path: string; name: string; protected: boolean };
export type WorkbookSummary = {
  name: string;
  outputName: string;
  mime: string;
  sheets: SheetInfo[];
  workbookProtected: boolean;
  warnings: string[];
};
export type Selection = { sheets: string[]; workbook: boolean };
export type PreparedWorkbook = {
  files: Record<string, Uint8Array>;
  summary: WorkbookSummary;
};


// Enforce limits on actual inflated bytes, not just untrusted ZIP metadata.
// Entries are never written to disk or interpreted as active content.
function readArchive(data: Uint8Array): Record<string, Uint8Array> {
  if (data[0] === 0xd0 && data[1] === 0xcf && data[2] === 0x11 && data[3] === 0xe0) {
    fail("encrypted-or-legacy", "This is an encrypted or legacy Office container. If Excel asks for a password before opening, open it with that password and save an unencrypted copy first. Excelled cannot recover opening passwords.");
  }
  if (data[0] !== 0x50 || data[1] !== 0x4b || data[2] !== 3 || data[3] !== 4) {
    fail("invalid-archive", "This is not a readable Excel package. Choose the original file, not a renamed document.");
  }
  const expected = preflightArchive(data);
  const files: Record<string, Uint8Array> = Object.create(null);
  const names = new Set<string>();
  let expanded = 0;
  let completed = 0;
  const unzip = new Unzip((file) => {
    const name = file.name;
    const entry = expected.get(name);
    if (!entry) fail("invalid-archive", "The workbook package headers do not agree. Save a fresh copy in Excel and try again.");
    if (!name || name.includes("\\") || name.startsWith("/") ||
      name.split("/").some((part) => part === ".." || part === ".") ||
      /[\u0000-\u001f]/.test(name) || names.has(name)) {
      fail("unsafe-archive", "This workbook has duplicate or unsafe package paths. Save a fresh copy in Excel and try again.");
    }
    names.add(name);
    if (names.size > LIMITS.entries || (file.originalSize ?? 0) > LIMITS.entry) {
      fail("archive-limit", "This workbook expands beyond the safety limits. Try a smaller workbook.");
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    file.ondata = (error, chunk, final) => {
      if (error) throw error;
      size += chunk.length;
      expanded += chunk.length;
      if (size > LIMITS.entry || expanded > LIMITS.expanded || size > entry.size) {
        fail("archive-limit", "This workbook expands beyond the safety limits. Try a smaller workbook.");
      }
      chunks.push(chunk);
      if (final) {
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const part of chunks) {
          bytes.set(part, offset);
          offset += part.length;
        }
        if (bytes.length !== entry.size || crc32(bytes) !== entry.crc) {
          fail("invalid-archive", "The workbook package failed an integrity check. Save a fresh copy in Excel and try again.");
        }
        files[name] = bytes;
        completed++;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try {
    for (let offset = 0; offset < data.length; offset += 16 * 1024) {
      unzip.push(data.subarray(offset, offset + 16 * 1024), offset + 16 * 1024 >= data.length);
    }
    if (!names.size || completed !== expected.size || completed !== names.size) throw new Error("Incomplete archive");
  } catch (error) {
    if (error instanceof WorkbookError) throw error;
    fail("invalid-archive", "This Excel package is damaged or uses unsupported ZIP features. Save a fresh copy in Excel and try again.");
  }
  return files;
}

function xml(files: Record<string, Uint8Array>, path: string) {
  const bytes = files[path];
  if (!bytes) fail("invalid-package", "A required Excel package part is missing. Save a fresh copy in Excel and try again.");
  if (bytes.length > LIMITS.xml) fail("xml-limit", "A worksheet is too large to inspect safely (8 MB XML limit). Try splitting the workbook.");
  try {
    const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le"
      : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8";
    const text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("DTD is not supported");
    return new DOMParser({ onError: () => { throw new Error("Invalid XML"); } })
      .parseFromString(text, "application/xml");
  } catch {
    fail("invalid-xml", "A workbook XML part is unreadable or contains unsupported declarations. Save a fresh copy in Excel and try again.");
  }
}
type XmlDocument = ReturnType<typeof xml>;
type XmlElement = NonNullable<XmlDocument["documentElement"]>;
function children(element: XmlElement, name: string, namespaces: readonly string[]) {
  return Array.from(element.childNodes).filter(
    (node): node is XmlElement => node.nodeType === 1 && node.localName === name && namespaces.includes(node.namespaceURI ?? ""),
  );
}
function root(document: XmlDocument, name: string, namespaces: readonly string[]) {
  const element = document.documentElement;
  if (!element || element.localName !== name || !namespaces.includes(element.namespaceURI ?? "")) {
    fail("invalid-package", "This file is not a supported Excel workbook package. Save a fresh copy in Excel and try again.");
  }
  return element;
}
function sheetTarget(target: string) {
  const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  // Standard package layouts only; never guess at traversal or external targets.
  if (!/^xl\/worksheets\/[^/\\]+\.xml$/.test(path) || /[?#]/.test(path)) {
    fail("unsupported-layout", "This workbook uses an unsupported worksheet layout. Save a fresh copy in Excel and try again.");
  }
  return path;
}

export function inspectWorkbook(data: Uint8Array, name: string): PreparedWorkbook {
  const extension = validateFile(name, data.length);
  const files = readArchive(data);
  if (Object.keys(files).some((path) => path.toLowerCase().startsWith("_xmlsignatures/"))) {
    fail("signed-package", "This workbook has a document signature. Editing it can invalidate the signature, so Excelled has left it unchanged. Ask the owner for an unsigned copy.");
  }
  const types = root(xml(files, "[Content_Types].xml"), "Types", [CONTENT_NS]);
  if (children(types, "Override", [CONTENT_NS]).some((part) => part.getAttribute("ContentType")?.includes("digital-signature"))) {
    fail("signed-package", "This workbook has a document signature. Ask the owner for an unsigned copy before changing it.");
  }
  if (children(types, "Override", [CONTENT_NS]).some((part) => part.getAttribute("ContentType")?.includes("digital-signature"))) {
    fail("signed-package", "This workbook has a document signature. Ask the owner for an unsigned copy before changing it.");
  }
  if (!children(types, "Override", [CONTENT_NS]).some((part) => part.getAttribute("PartName") === "/xl/workbook.xml" &&
    part.getAttribute("ContentType") === MAIN_TYPES[extension])) {
    fail("format-mismatch", "The workbook contents do not match its file extension. Open it in Excel and save it in the correct format.");
  }
  const packageRels = root(xml(files, "_rels/.rels"), "Relationships", [PACKAGE_REL_NS]);
  if (children(packageRels, "Relationship", [PACKAGE_REL_NS]).some((rel) => rel.getAttribute("Type")?.includes("/digital-signature/"))) {
    fail("signed-package", "This workbook has a document signature. Ask the owner for an unsigned copy before changing it.");
  }
  if (children(packageRels, "Relationship", [PACKAGE_REL_NS]).some((rel) => rel.getAttribute("Type")?.includes("/digital-signature/"))) {
    fail("signed-package", "This workbook has a document signature. Ask the owner for an unsigned copy before changing it.");
  }
  if (!children(packageRels, "Relationship", [PACKAGE_REL_NS]).some((rel) =>
    REL_NS.some((ns) => rel.getAttribute("Type") === `${ns}/officeDocument`) &&
    ["xl/workbook.xml", "/xl/workbook.xml"].includes(rel.getAttribute("Target") ?? "") &&
    rel.getAttribute("TargetMode") !== "External")) {
    fail("invalid-package", "The package does not identify a supported Excel workbook.");
  }
  const workbook = root(xml(files, "xl/workbook.xml"), "workbook", SPREADSHEET_NS);
  const rels = root(xml(files, "xl/_rels/workbook.xml.rels"), "Relationships", [PACKAGE_REL_NS]);
  const relationships = children(rels, "Relationship", [PACKAGE_REL_NS]);
  const sheets: SheetInfo[] = [];
  for (const sheet of children(workbook, "sheets", SPREADSHEET_NS).flatMap((group) => children(group, "sheet", SPREADSHEET_NS))) {
    const id = REL_NS.map((ns) => sheet.getAttributeNS(ns, "id")).find(Boolean);
    const matching = relationships.filter((rel) => rel.getAttribute("Id") === id);
    if (!id || matching.length !== 1) fail("invalid-package", "A worksheet relationship is missing or ambiguous.");
    const rel = matching[0];
    if (!REL_NS.some((ns) => rel.getAttribute("Type") === `${ns}/worksheet`)) {
      fail("unsupported-sheet", "This workbook contains chart sheets or other non-worksheet sheets. They are not supported yet. Try a copy containing ordinary worksheets.");
    }
    if (rel.getAttribute("TargetMode") === "External") fail("invalid-package", "External worksheets are not supported.");
    const path = sheetTarget(rel.getAttribute("Target") ?? "");
    if (sheets.some((entry) => entry.path === path)) fail("invalid-package", "Two worksheets reference the same package part.");
    const worksheet = root(xml(files, path), "worksheet", SPREADSHEET_NS);
    sheets.push({
      path,
      name: sheet.getAttribute("name") || `Sheet ${sheets.length + 1}`,
      protected: children(worksheet, "sheetProtection", SPREADSHEET_NS).length > 0,
    });
  }
  if (!sheets.length) fail("invalid-package", "This workbook contains no supported worksheets.");
  const warnings: string[] = [];
  if (extension === "xlsm" || extension === "xltm") warnings.push("Macro content is kept, not run or checked for safety. Only enable macros from a source you trust.");
  if (children(workbook, "fileSharing", SPREADSHEET_NS).length) warnings.push("This file also has sharing or read-only settings. Password-to-modify and read-only recommendations are left unchanged.");
  if (Object.keys(files).some((path) => path.startsWith("xl/externalLinks/"))) warnings.push("External links are kept unchanged. Only allow external content from sources you trust.");
  return {
    files,
    summary: {
      name, outputName: outputFilename(name), mime: FORMATS[extension], sheets, warnings,
      workbookProtected: children(workbook, "workbookProtection", SPREADSHEET_NS).length > 0,
    },
  };
}

function removeProtection(files: Record<string, Uint8Array>, path: string, kind: string) {
  const document = xml(files, path);
  const element = document.documentElement!;
  const protections = children(element, kind, SPREADSHEET_NS);
  for (const protection of protections) element.removeChild(protection);
  if (protections.length) {
    const text = new XMLSerializer().serializeToString(document)
      .replace(/(<\?xml\b[^?]*\bencoding\s*=\s*)(["'])[^"']*\2/i, '$1"UTF-8"');
    files[path] = new TextEncoder().encode(text);
    if (children(xml(files, path).documentElement!, kind, SPREADSHEET_NS).length) {
      fail("verification-failed", "The edited workbook could not be verified. Your original file is unchanged.");
    }
  }
}
export function unlockWorkbook(prepared: PreparedWorkbook, selection: Selection) {
  const { summary } = prepared;
  const chosen = new Set(selection.sheets);
  const valid = new Set(summary.sheets.filter((sheet) => sheet.protected).map((sheet) => sheet.path));
  if ([...chosen].some((path) => !valid.has(path)) || (selection.workbook && !summary.workbookProtected)) {
    fail("invalid-selection", "The selected locks do not match this workbook. Choose the file again.");
  }
  if (!chosen.size && !selection.workbook) fail("nothing-selected", "Select at least one editing lock to remove.");
  // A fresh map per operation; untouched entries retain their original bytes.
  const files = { ...prepared.files };
  for (const path of chosen) removeProtection(files, path, "sheetProtection");
  if (selection.workbook) removeProtection(files, "xl/workbook.xml", "workbookProtection");
  return { data: zipSync(files, { level: 1 }), sheets: chosen.size, workbook: selection.workbook };
}
