# Experience decisions

## 2026-11-22 · Workbook processing runs locally in a browser worker
- Decided by: implementation default for this PR.
- Why: removes the upload path, shared server archive state and mismatch between privacy claims and actual behavior; cancellation can terminate parsing.
- Rejected: retaining a request-local server uploader, because it retains infrastructure exposure and requires a separately hardened API.
- Rests on: audit of `6d5392847ca47916d2edf8d5e62ba9a540a78238`, whose client posts files to `/api` and whose route shares a module-level ZIP.

## 2026-11-22 · Keep the original visual identity and improve the task flow
- Decided by: implementation default for this PR.
- Why: the request is an experience improvement, not a rebrand; dark/green and Montserrat are existing project choices.
- Rejected: an unrelated visual world and decorative feature-heavy landing page, because file diagnosis, preservation and recovery are the verified gaps.
- Rests on: incumbent UI, [Impeccable](https://impeccable.style/) Operate guidance and [Design with Intent](https://designwithintent.ai/) principles.

## 2026-11-22 · Inspect before modification and require an explicit download
- Decided by: implementation default for this PR.
- Why: users need to distinguish editing locks from unsupported encryption and select changes; successful parsing alone is not successful removal.
- Rejected: automatically changing every lock and downloading a response before checking its outcome.
- Rests on: original component and route lack lock counts, status checking, a no-op state and user selection.

## 2026-11-22 · Macro/template compatibility remains beta until application checks
- Decided by: implementation default for this PR.
- Why: byte-preservation and generated-package tests are necessary but do not establish interoperability with all Excel features and versions.
- Rejected: a universal compatibility claim based on synthetic fixtures.
- Rests on: automated tests and the uncompleted manual checks in [validation.md](validation.md).
