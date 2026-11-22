// Do not read or retain upload bodies. Processing now runs in a browser worker.
export const POST = () =>
  Response.json(
    {
      code: "client-processing-only",
      message: "The upload API has been retired. Open Excelled to process your workbook locally in your browser.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
