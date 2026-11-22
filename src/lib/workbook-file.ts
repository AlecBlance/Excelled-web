export const LIMITS = {
  file: 20 * 1024 * 1024,
  expanded: 80 * 1024 * 1024,
  entry: 32 * 1024 * 1024,
  xml: 8 * 1024 * 1024,
  entries: 2000,
  timeout: 30_000,
} as const;

export const FORMATS = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
  xltx: "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
  xltm: "application/vnd.ms-excel.template.macroEnabled.12",
} as const;

export class WorkbookError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "WorkbookError";
  }
}

export function fail(code: string, message: string): never {
  throw new WorkbookError(code, message);
}

export function outputFilename(name: string): string {
  const safe = name.replace(/[\\/\u0000-\u001f\u007f]/g, "_");
  const dot = safe.lastIndexOf(".");
  return dot > 0 ? `${safe.slice(0, dot)}-excelled${safe.slice(dot)}` : `${safe}-excelled`;
}

export function validateFile(name: string, size: number) {
  const extension = name.split(".").pop()?.toLowerCase();
  if (!extension || !Object.hasOwn(FORMATS, extension)) {
    fail("unsupported-format", "Choose an .xlsx, .xlsm, .xltx, or .xltm file. Legacy .xls and binary .xlsb files are not supported. Open them in Excel and save a separate .xlsx copy first.");
  }
  if (!size) fail("empty-file", "This file is empty. Choose the original Excel workbook.");
  if (size > LIMITS.file) fail("file-too-large", "This file exceeds the 20 MB limit. Try a smaller copy of the workbook.");
  return extension as keyof typeof FORMATS;
}
