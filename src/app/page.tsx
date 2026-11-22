import InputFile from "@/components/InputFile.components";
import { ArrowUpRight, FileSpreadsheet } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="site-shell">
      <a href="#main" className="skip-link">Skip to workbook tool</a>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Excelled home"><FileSpreadsheet size={25} strokeWidth={1.7} aria-hidden="true" />EXCELLED</Link>
        <a className="source-link" href="https://github.com/AlecBlance/Excelled-web">View source<ArrowUpRight size={16} aria-hidden="true" /></a>
      </header>
      <main id="main">
        <div className="tool-layout">
          <div className="introduction">
            <h1>Back to work.<br /><span>Without the editing locks.</span></h1>
            <p className="intro-copy">Open your Excel file but can’t edit it? Remove worksheet and workbook protection, and save a separate, editable copy.</p>
          </div>
          <InputFile />
          <aside className="scope-note">
            <h2>Can’t open the file at all?</h2>
            <p>Excelled doesn’t recover opening passwords. It also can’t override organization permissions or Protected View.</p>
            <a href="#supported-files">Check what’s supported<ArrowRightIcon /></a>
          </aside>
        </div>
        <noscript><p className="noscript">Excelled needs JavaScript to process files locally in your browser. Enable JavaScript and reload this page. Your workbook is never uploaded.</p></noscript>
        <section className="help-section" id="supported-files" aria-labelledby="help-title">
          <div className="help-heading"><h2 id="help-title">Know what to expect</h2><p>A small tool with a clear job.</p></div>
          <div className="help-questions">
            <details>
              <summary>Which files and locks are supported?</summary>
              <div className="answer"><p>Unencrypted .xlsx workbooks, .xlsm macro-enabled workbooks, and .xltx / .xltm templates with standard worksheet layouts. You can remove individual worksheet locks and workbook structure or window protection.</p><p>Macro-enabled workbooks and templates are beta: check the downloaded copy in Excel before sharing.</p><p>Legacy .xls, binary .xlsb, chart sheets, signed documents, and nonstandard package layouts aren’t supported. Password-to-modify and read-only settings are left unchanged. Files are limited to 20 MB, with additional safety limits on expanded contents.</p></div>
            </details>
            <details>
              <summary>Does my workbook leave this device?</summary>
              <div className="answer"><p>No. Inspection and editing run in a browser worker on your device. The tool does not send your workbook, sheet names, or passwords to a server. It has no password field, analytics, or file storage.</p><p>The website itself still loads from a web server. Closing the tab or choosing another file releases the tool’s in-memory copy; copies you download remain on your device.</p></div>
            </details>
            <details>
              <summary>What happens to formulas, images, and macros?</summary>
              <div className="answer"><p>Only the selected protection elements in worksheet or workbook XML are removed. Other package parts—including formulas in untouched sheets, images, charts, and macro binaries—are retained byte-for-byte. Changed XML parts are reserialized, and the ZIP container is rebuilt.</p><p>Excelled doesn’t run macros, refresh external links, or check active content for safety. Keep your original and check the downloaded copy in Excel before sharing it. Document-signed packages are rejected to avoid invalidating their signatures.</p></div>
            </details>
            <details>
              <summary>Why might Excel still block editing?</summary>
              <div className="answer"><p>Editing can also be blocked by file permissions, organization policies, sensitivity labels, Protected View, or password-to-modify settings. Excelled does not change those. If the workbook still won’t edit, ask its owner or your IT administrator for access.</p></div>
            </details>
          </div>
        </section>
      </main>
      <footer className="site-footer"><p>Excelled <span aria-hidden="true">/</span> By <a href="https://github.com/AlecBlance">Alec Blance</a></p><p>Free to use. Open source.</p></footer>
    </div>
  );
}

function ArrowRightIcon() {
  return <span aria-hidden="true">→</span>;
}
