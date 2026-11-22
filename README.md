# Excelled

Remove worksheet and workbook editing locks from Excel files you own or are authorized to modify. Inspect the file, choose the locks to remove, and download a separate copy. Your original file stays unchanged.

**This is not password recovery.** Excelled cannot decrypt opening-password protection, override organization permissions, remove Protected View, or unlock VBA projects.

![Excelled workbook tool](docs/experience-desktop.png)

## Use it

1. Choose or drop one workbook.
2. Review the detected worksheet and workbook locks.
3. Select which locks to remove and choose **Create editable copy**.
4. Choose **Download copy**. Open the result in Excel to check it before sharing.

Try the included [`cant edit.xlsx`](sample/cant%20edit.xlsx) sample.

### Compatibility

| File or protection | Behavior |
| --- | --- |
| Unencrypted `.xlsx` | Worksheet and workbook protection removal |
| Unencrypted `.xlsm`, `.xltx`, `.xltm` | Same package-based editing; macro/template compatibility is beta |
| Password required before opening | Not decrypted; explanatory error |
| `.xls`, `.xlsb`, non-Excel ZIPs | Not supported |
| Password-to-modify / read-only recommendation | Left unchanged; warning when sharing settings are detected |
| IRM, sensitivity-label access restrictions, Protected View | Not bypassed |
| Document-signed packages | Refused to avoid invalidating document signatures |
| VBA project locks | Left unchanged |
| Chart sheets, nonstandard worksheet paths, ZIP64, encrypted ZIPs | Not supported; save a standard copy in Excel |

Worksheets use namespace-aware XML editing, including Strict OOXML, multiline and paired protection elements. Only selected workbook/worksheet parts are reserialized. All other package-entry contents—including images, VBA, OLE, relationships and charts—retain their original bytes. ZIP compression, metadata and entry ordering are not guaranteed to be identical. Macros and external links are preserved, not executed or checked for safety.

Automated tests verify package integrity, selective editing and binary preservation. They do **not** replace opening representative outputs in supported Microsoft Excel versions; see [release checks](docs/validation.md).

## Privacy and resource limits

File processing runs in a dedicated **browser Web Worker**. There is no file upload, password prompt, analytics or browser persistence in this app. The website and application scripts still load from a web server. The browser may retain memory until garbage collection; this is not a secure-memory-erasure guarantee.

Cancellation terminates the worker. Choosing another file releases the previous worker and download URL. Leaving the page releases its resources; downloaded files remain on your device.

- Input: 20 MB maximum.
- Expanded archive: 80 MB total, 32 MB per entry, 2,000 entries.
- Inspected XML: 8 MB per part.
- Worker deadline: 30 seconds per inspection or editing operation.
- Rejects malformed ZIP directories, duplicate/unsafe entry paths, CRC failures, XML DTD/entity declarations, unsupported compression and ambiguous package relationships.

These bounds reduce resource-exhaustion risks; they are not a guarantee against every malicious file. Only process workbooks from sources you trust.

### Breaking API change

`POST /api` now returns **410 Gone** with JSON code `client-processing-only`. It does not parse or process the request body. Existing API integrations must stop sending files. No replacement upload API is provided; use the browser application.

The web host or reverse proxy may still receive bytes sent directly to this retired endpoint; “no uploads” describes the website’s local processing flow, not a promise that arbitrary HTTP requests cannot reach hosting infrastructure.

## Development

Node.js 20.9+ (Node 22 recommended):

```sh
npm ci
npm run dev
```

### Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests run against a production build on `127.0.0.1:3100`. They cover desktop and mobile-emulated Chromium, actual worker processing/downloads, no-upload request checks, axe accessibility scans, keyboard focus, cancellation, recoverable errors and the no-JavaScript explanation.

Next.js was upgraded from 14.1.3 to 15.5.29. PostCSS is overridden to the patched direct dependency; keep the override under review with framework upgrades. `npm audit` still reports moderate transitive tooling advisories in the Tailwind → Sucrase → Glob/Minimatch chain; no clean-audit or universal-security claim is made.

## Design and next steps

The experience preserves the original dark/green identity. [Impeccable](https://impeccable.style/) informs hierarchy, responsive composition and state hardening; [Design with Intent](https://designwithintent.ai/) informs clear scope, user control, privacy and recovery. See [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md) and the [decision log](docs/decisions.md).

Future work, after compatibility validation:

- Real-world Excel fixtures for images, pivots, external links, macros and templates.
- More browser engines and assistive-technology testing.
- Bounded batch processing with per-file outcomes.
- Broader package-layout support.
- Separately evaluated **user-supplied-password** decryption, without unknown-password recovery promises.

Created by [Alec Blance](https://github.com/AlecBlance). Free and open source under [MIT](LICENSE).
