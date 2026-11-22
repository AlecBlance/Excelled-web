# Validation and release checks

## Automated coverage

`npm test` exercises the repository’s actual protected sample plus generated fixtures:

- Sheet/workbook detection and selective removal; no-lock and invalid-selection outcomes.
- Multiline, paired and prefixed protection elements; Strict OOXML namespaces.
- Untouched ZIP member byte equality, including images, VBA, OLE, other XML and unselected sheets.
- Independent repeated/concurrent operations, without shared archive state.
- XLSX/XLSM/XLTX/XLTM package MIME/extension fidelity and multi-dot/Unicode names.
- Truncation, CRC corruption, unsafe paths, unsupported/encrypted containers, signatures, DTDs, malformed XML, missing parts, entry/expansion/XML limits.
- UTF-16 input and UTF-8 output declaration consistency.
- Retired API status and response contract.

`npm run test:e2e` uses production-built desktop and mobile-emulated Chromium:

- Actual worker inspection, selective editing and downloaded ZIP verification.
- No non-GET/HEAD requests during the main file workflow.
- axe checks on initial/help, review, result and error states.
- Keyboard focus, narrow-screen overflow, cancellation and no-JavaScript instructions.

Screenshots are captured in ignored `test-results/`; the README uses reviewed examples from that run.

## Manual release gate

These checks require real Office fixtures/applications or human review and are **not claimed completed** by automated tests:

- [ ] Open the supplied sample and its result in supported desktop Microsoft Excel versions without a repair warning.
- [ ] Verify formulas/calculation, styles, charts, images, pivots, external links and embedded objects with representative workbooks.
- [ ] Open XLSM/XLTM results with a benign real VBA project; verify macro bytes and workbook behavior without enabling untrusted content.
- [ ] Open real XLTX/XLTM templates and create a new workbook from them.
- [ ] Check workbook-window/structure locks and modern salted worksheet hashes in Excel.
- [ ] Check real opening-encrypted, signed, legacy XLS, XLSB and organization-controlled files receive appropriate outcomes.
- [ ] Test Safari/WebKit, Firefox, physical mobile devices and constrained-memory devices.
- [ ] Perform screen-reader, 200% zoom, high-contrast and keyboard-only reviews.
- [ ] Review hosting logs/body limits for direct requests to the retired API; the app no longer sends uploads.

## Dependency review

Next.js 14.1.3 was replaced by 15.5.29. Production framework advisory matches were addressed without treating version matches as proof of exploitation. A patched PostCSS override is explicit in `package.json`.

Remaining moderate registry advisories in transitive Tailwind/Sucrase/Glob/Minimatch tooling need follow-up. Do not force incompatible major-version overrides solely to make an audit counter zero. Re-run `npm audit` when reviewing or deploying; advisory data changes.
