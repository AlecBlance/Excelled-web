"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, Check, CircleAlert, FileSpreadsheet, LoaderCircle, LockKeyhole, ShieldCheck, Upload, X } from "lucide-react";
import { LIMITS, validateFile } from "@/lib/workbook-file";
import type { WorkbookSummary } from "@/lib/workbook";
import type { WorkerRequest, WorkerResponse } from "@/lib/workbook-messages";

type Stage = "idle" | "checking" | "review" | "processing" | "done" | "error";
type Download = { url: string; name: string; sheets: number; workbook: boolean };

export default function InputFile() {
  const [stage, setStage] = useState<Stage>("idle");
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("");
  const [summary, setSummary] = useState<WorkbookSummary>();
  const [selected, setSelected] = useState<string[]>([]);
  const [workbook, setWorkbook] = useState(false);
  const [download, setDownload] = useState<Download>();
  const input = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const worker = useRef<Worker>();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const resultUrl = useRef<string>();
  const currentSummary = useRef<WorkbookSummary>();
  const busyRef = useRef(false);
  const busy = stage === "checking" || stage === "processing";

  function stopWorker() {
    worker.current?.terminate();
    worker.current = undefined;
    clearTimeout(timer.current);
    busyRef.current = false;
  }
  function releaseDownload() {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    resultUrl.current = undefined;
    setDownload(undefined);
  }
  useEffect(() => () => {
    worker.current?.terminate();
    clearTimeout(timer.current);
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
  }, []);
  useEffect(() => {
    if (stage === "review" || stage === "done" || stage === "error") heading.current?.focus();
  }, [stage]);

  function showError(message: string) {
    stopWorker();
    setError(message);
    setStage("error");
  }
  function startDeadline() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => showError(
      "This workbook took too long to process. Try a smaller copy or close other browser tabs. Your original file is unchanged.",
    ), LIMITS.timeout);
  }
  function send(message: WorkerRequest) {
    worker.current?.postMessage(message);
  }
  function chooseFile(file?: File) {
    if (!file || busyRef.current) return;
    stopWorker();
    releaseDownload();
    setSummary(undefined);
    currentSummary.current = undefined;
    setFilename(file.name);
    setError("");
    setDragging(false);
    try {
      validateFile(file.name, file.size);
      busyRef.current = true;
      setStatus("Reading your workbook locally…");
      setStage("checking");
      const processor = new Worker(new URL("../workers/workbook.worker.ts", import.meta.url));
      worker.current = processor;
      processor.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
        if (processor !== worker.current) return;
        if (data.type === "status") setStatus(data.message);
        if (data.type === "error") showError(data.message);
        if (data.type === "ready") {
          clearTimeout(timer.current);
          busyRef.current = false;
          currentSummary.current = data.summary;
          setSummary(data.summary);
          setSelected(data.summary.sheets.filter((sheet) => sheet.protected).map((sheet) => sheet.path));
          setWorkbook(data.summary.workbookProtected);
          setStage("review");
        }
        if (data.type === "complete") {
          const info = currentSummary.current;
          if (!info) return showError("The workbook review was lost. Please choose your file again.");
          const url = URL.createObjectURL(new Blob([data.data], { type: info.mime }));
          resultUrl.current = url;
          setDownload({ url, name: info.outputName, sheets: data.sheets, workbook: data.workbook });
          stopWorker();
          setStage("done");
        }
      };
      processor.onerror = (event) => {
        event.preventDefault();
        showError("The browser could not start or finish local processing. Try again in an up-to-date browser. Nothing was uploaded.");
      };
      startDeadline();
      send({ type: "inspect", file });
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "Choose a supported Excel file and try again.");
    }
  }
  function reset(message = "") {
    stopWorker();
    releaseDownload();
    currentSummary.current = undefined;
    setSummary(undefined);
    setFilename("");
    setStatus(message);
    setError("");
    setStage("idle");
    requestAnimationFrame(() => input.current?.focus());
  }
  function unlock() {
    if (busyRef.current || !worker.current || (!selected.length && !workbook)) return;
    busyRef.current = true;
    setStatus("Preparing your edited copy…");
    setStage("processing");
    startDeadline();
    send({ type: "unlock", selection: { sheets: selected, workbook } });
  }
  const lockCount = (summary?.sheets.filter((sheet) => sheet.protected).length ?? 0) + (summary?.workbookProtected ? 1 : 0);
  const showPicker = stage === "idle" || stage === "error";

  return (
    <section className="workbench" aria-labelledby="workbench-title">
      <ol className="steps" aria-label="Workbook progress">
        {["Choose file", "Review locks", "Save copy"].map((label, index) => {
          const active = stage === "done" ? 2 : stage === "review" || stage === "processing" ? 1 : 0;
          return <li key={label} aria-current={index === active ? "step" : undefined} className={index <= active ? "step-reached" : ""}>
            <span aria-hidden="true">{index < active ? <Check size={14} /> : index + 1}</span>{label}
          </li>;
        })}
      </ol>

      <div className="workbench-content">
        {showPicker && <>
          <h2 id="workbench-title" ref={heading} tabIndex={-1}>{stage === "error" ? "Let’s try another way" : "Start with your workbook"}</h2>
          <p className="section-description">We’ll check for editing locks before changing anything.</p>
          {stage === "error" && <div className="notice notice-error" role="alert">
            <CircleAlert size={20} aria-hidden="true" />
            <div><strong>File not processed</strong><p>{error}</p></div>
          </div>}
          <div
            className={`dropzone ${dragging ? "is-dragging" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (event.dataTransfer.files.length !== 1) return showError("Choose one workbook at a time. You can process another after saving your copy.");
              chooseFile(event.dataTransfer.files[0]);
            }}
          >
            <Upload className="upload-symbol" size={30} strokeWidth={1.5} aria-hidden="true" />
            <p className="drop-title">Drop your Excel file here</p>
            <p className="drop-alternative">or choose one from your device</p>
            <label className="file-picker">
              <input
                ref={input}
                type="file"
                aria-label="Choose Excel file"
                aria-describedby="file-formats file-permission"
                accept=".xlsx,.xlsm,.xltx,.xltm"
                onChange={(event) => {
                  chooseFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <span className="button button-primary"><FileSpreadsheet size={18} aria-hidden="true" />Choose Excel file</span>
            </label>
            <p id="file-formats" className="file-formats">XLSX, XLSM, XLTX, XLTM · Up to 20 MB</p>
          </div>
          <p className="permission-note" id="file-permission">Only use files you own or have permission to modify.</p>
        </>}

        {busy && <>
          <div className="processing">
            <LoaderCircle className="spin" size={32} aria-hidden="true" />
            <h2 id="workbench-title">{stage === "checking" ? "Checking your workbook" : "Creating your editable copy"}</h2>
            <p className="filename">{filename}</p>
            <p>{status}</p>
            <button className="button button-secondary" onClick={() => reset("Processing cancelled. Your original file is unchanged.")}><X size={16} aria-hidden="true" />Cancel</button>
          </div>
        </>}

        {stage === "review" && summary && <>
          <h2 id="workbench-title" ref={heading} tabIndex={-1}>{lockCount ? "Choose the locks to remove" : "No editing locks found"}</h2>
          <p className="filename review-filename"><FileSpreadsheet size={18} aria-hidden="true" />{summary.name}</p>
          {lockCount ? <>
            <p className="section-description">Selected locks will be removed in a new copy. Your original stays unchanged.</p>
            <fieldset className="lock-list">
              <legend className="sr-only">Editing locks to remove</legend>
              {summary.sheets.map((sheet) => <label key={sheet.path} className={`lock-row ${!sheet.protected ? "lock-clear" : ""}`}>
                {sheet.protected
                  ? <input type="checkbox" checked={selected.includes(sheet.path)} onChange={(event) =>
                    setSelected(event.target.checked ? [...selected, sheet.path] : selected.filter((path) => path !== sheet.path))} />
                  : <Check size={18} aria-hidden="true" />}
                <span className="lock-name">{sheet.name}</span>
                <span className="lock-kind">{sheet.protected ? "Worksheet lock" : "No sheet lock"}</span>
              </label>)}
              {summary.workbookProtected && <label className="lock-row">
                <input type="checkbox" checked={workbook} onChange={(event) => setWorkbook(event.target.checked)} />
                <span className="lock-name">Workbook structure / windows</span>
                <LockKeyhole size={16} aria-hidden="true" />
              </label>}
            </fieldset>
          </> : <p className="section-description">We found no worksheet or workbook-structure protection to remove. If editing is still blocked, check file permissions, read-only settings, or Protected View in Excel.</p>}
          {summary.warnings.map((warning) => <div className="notice notice-warning" key={warning}><CircleAlert size={18} aria-hidden="true" /><p>{warning}</p></div>)}
          <div className="workbench-actions">
            {lockCount > 0 && <button className="button button-primary" disabled={!selected.length && !workbook} onClick={unlock}>Create editable copy<ArrowRight size={18} aria-hidden="true" /></button>}
            <button className="button button-secondary" onClick={() => reset()}>Choose another file</button>
          </div>
          {lockCount > 0 && <p className="permission-note">Select at least one lock. This does not remove opening passwords or access permissions.</p>}
        </>}

        {stage === "done" && download && <>
          <div className="result-heading"><Check size={26} aria-hidden="true" /><h2 id="workbench-title" ref={heading} tabIndex={-1}>Your editable copy is ready</h2></div>
          <p className="section-description">Removed {download.sheets} worksheet {download.sheets === 1 ? "lock" : "locks"}{download.workbook ? " and workbook protection" : ""}. Your original file is unchanged.</p>
          <div className="download-file"><FileSpreadsheet size={25} aria-hidden="true" /><span className="filename">{download.name}</span></div>
          <div className="workbench-actions">
            <a className="button button-primary" href={download.url} download={download.name}><ArrowDownToLine size={18} aria-hidden="true" />Download copy</a>
            <button className="button button-secondary" onClick={() => reset()}>Process another file</button>
          </div>
          <p className="permission-note">Open the copy in Excel to check it before sharing. The download is kept in this tab until you choose another file or leave.</p>
        </>}
      </div>
      <div className="privacy-strip"><ShieldCheck size={18} aria-hidden="true" /><span>Processed in your browser. No file uploads.</span></div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {busy ? status : stage === "idle" ? status : stage === "review" ? "Workbook checked. Review the editing locks." : stage === "done" ? "Your copy is ready to download." : ""}
      </p>
    </section>
  );
}
