# Excelled

## Users and task

People who can open an Excel workbook but cannot edit protected worksheets or change workbook structure. They need a usable copy without manually editing package files. The project originated from helping the author’s mother with protected workbooks; this is repository context, not usability-study evidence.

## Product boundaries

A free, open-source browser utility. One workbook at a time. Inspect before changing; allow a choice of locks; explicitly download a separate copy. No accounts, payments, analytics, workbook previews or persistent file storage.

Editing protection is not opening encryption. Organization permissions, Protected View, VBA locks, password-to-modify and document signatures are outside the removal workflow. Unsupported cases must explain what to do next without advertising universal unlocking.

## Constraints

Next.js, React, TypeScript and Tailwind. Retain the existing dark-and-green identity. ZIP/XML parsing belongs in a cancellable, time-bounded worker. Preserve untouched entry bytes and correct file types. Resource limits and support restrictions are visible before selection.

## Success

A user can determine whether their file is suitable, inspect actual locks, select changes, and download a copy without uploading workbook data. Unsupported or unprotected files never receive false success messages. Keyboard and small-screen users can complete the same flow.

## Research still needed

- Usability sessions with people who routinely handle protected workbooks.
- Representative Microsoft Excel version and macro/template compatibility checks.
- Physical-device, screen-reader and additional browser-engine validation.
