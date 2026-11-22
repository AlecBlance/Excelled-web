import type { Selection, WorkbookSummary } from "./workbook";

export type WorkerRequest =
  | { type: "inspect"; file: File }
  | { type: "unlock"; selection: Selection };
export type WorkerResponse =
  | { type: "status"; message: string }
  | { type: "ready"; summary: WorkbookSummary }
  | { type: "complete"; data: ArrayBuffer; sheets: number; workbook: boolean }
  | { type: "error"; code: string; message: string };
