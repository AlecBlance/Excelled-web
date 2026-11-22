import { inspectWorkbook, unlockWorkbook, validateFile, WorkbookError } from "../lib/workbook";
import type { PreparedWorkbook } from "../lib/workbook";
import type { WorkerRequest, WorkerResponse } from "../lib/workbook-messages";

let prepared: PreparedWorkbook | undefined;
const send = (message: WorkerResponse, transfer: Transferable[] = []) =>
  self.postMessage(message, { transfer });

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  try {
    if (data.type === "inspect") {
      prepared = undefined;
      validateFile(data.file.name, data.file.size);
      send({ type: "status", message: "Checking the workbook and its editing locks…" });
      prepared = inspectWorkbook(new Uint8Array(await data.file.arrayBuffer()), data.file.name);
      send({ type: "ready", summary: prepared.summary });
    } else {
      if (!prepared) throw new WorkbookError("missing-file", "Choose a workbook first.");
      send({ type: "status", message: "Removing selected locks and preparing your copy…" });
      const result = unlockWorkbook(prepared, data.selection);
      const buffer = result.data.buffer as ArrayBuffer;
      send({ type: "complete", data: buffer, sheets: result.sheets, workbook: result.workbook }, [buffer]);
      prepared = undefined;
      self.close();
    }
  } catch (error) {
    prepared = undefined;
    send({
      type: "error",
      code: error instanceof WorkbookError ? error.code : "processing-failed",
      message: error instanceof WorkbookError ? error.message
        : "This workbook could not be processed safely. Try saving a fresh copy in Excel. Your original file is unchanged.",
    });
    self.close();
  }
};
