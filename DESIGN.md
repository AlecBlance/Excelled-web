# Excelled interface

## Mode and identity

**Operate:** completing a file task takes precedence over marketing. Preserve the incumbent dark canvas, Excel-associated green and Montserrat typography. Avoid gradients, decorative metrics, forced overlays and transient-toast-only feedback.

## Tokens

`src/app/globals.css` owns surface, text, accent, error and warning variables. Tailwind remains available for utilities.

- Canvas `#111614`, surface `#1a211e`, inset `#141b17`.
- Main text `#f0f4f1`, secondary text `#b4c3ba`.
- Accent `#6ce9a6`, button ink `#11251a`.
- Error `#ffb4a7`, warning `#e9d39d`.
- Montserrat, 16 px body; fluid headings with tight line height.
- Visible accent focus rings; no meaning conveyed by color alone.

## Layout and states

Desktop pairs a short explanation with the workbook tool. On narrow screens, put file selection before the longer opening-password explanation. Keep document order aligned with the task flow.

Progress labels: Choose file → Review locks → Save copy. These are a real sequence, not decorative section numbers. States: idle, checking, review, processing, ready and recoverable error. Busy states name the operation, offer cancellation and never invent percentage progress.

Keep one primary action per state. Show sheet names only locally. Locked rows use native checkboxes; clear rows are informational. Show complete filenames with wrapping. Do not auto-download. The explicit download link remains available until the file is replaced or the page is left.

## Accessibility and resilience

Semantic headings, section labels, fieldsets, details disclosures and real file inputs. Move focus to review/error/result headings; return it to the file input on reset. Announce processing via a polite live region. Respect reduced motion and forced colors. Long filenames and sheet names must not cause horizontal overflow.

## Design references

- [Impeccable](https://impeccable.style/): hierarchy, state coverage, restrained utility design and render verification.
- [Design with Intent](https://designwithintent.ai/): truthful consequences, user autonomy, task-centered flows and recoverable failures.

Decisions and evidence limits belong in [docs/decisions.md](docs/decisions.md). Product assumptions belong in [PRODUCT.md](PRODUCT.md).
