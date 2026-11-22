import { strToU8, zipSync } from "fflate";

export const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
export const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG = "http://schemas.openxmlformats.org/package/2006/relationships";
export const mainTypes = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.main+xml",
  xltx: "application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml",
  xltm: "application/vnd.ms-excel.template.macroEnabled.main+xml",
};
export function fixtureParts(options: {
  format?: keyof typeof mainTypes;
  sheetLock?: string;
  workbookLock?: string;
  extra?: Record<string, Uint8Array>;
} = {}) {
  const format = options.format ?? "xlsx";
  return {
    "[Content_Types].xml": strToU8(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="${mainTypes[format]}"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`),
    "_rels/.rels": strToU8(`<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<workbook xmlns="${NS}" xmlns:r="${REL}">${options.workbookLock ?? '<workbookProtection lockStructure="1"/>'}<sheets><sheet name="Budget" sheetId="1" r:id="rId1"/><sheet name="Notes" sheetId="2" r:id="rId2"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(`<worksheet xmlns="${NS}"><sheetData><row r="1"><c r="A1"><f>SUM(1,2)</f><v>3</v></c></row></sheetData>${options.sheetLock ?? '<sheetProtection sheet="1"/>'}</worksheet>`),
    "xl/worksheets/sheet2.xml": strToU8(`<worksheet xmlns="${NS}"><sheetData/></worksheet>`),
    "xl/media/image1.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0xff, 0xfe, 0x80]),
    ...options.extra,
  };
}
export function fixture(options: Parameters<typeof fixtureParts>[0] = {}) {
  return zipSync(fixtureParts(options));
}
