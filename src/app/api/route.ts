import JSZip from "jszip";

const newZip = new JSZip();

export const POST = async (req: Request) => {
  // * Regex for tags to be deleted
  const sheetRegex = /<sheetProtection(.*?)\/>/g;
  const workBookRegex = /<workbookProtection(.*?)\/>/g;

  // * Getting the file from the form
  const formData = await req.formData();
  const file = formData.get("file") as unknown as File;
  const buffer = await file.arrayBuffer();

  // * Loading the xlsx file
  const zip = await JSZip.loadAsync(buffer);
  for (const [filePath, zipObject] of Object.entries(zip.files)) {
    // * Getting the contents of each file inside xlsx
    let content = await zipObject.async("string");
    // * Removing tags from content
    content = content.replaceAll(sheetRegex, "").replaceAll(workBookRegex, "");
    // * Adding the file to the zip
    newZip.file(filePath, content);
  }

  // * Generate zip blob
  const unlockedExcel = await newZip.generateAsync({ type: "blob" });

  // * Returning the zip as spreedsheet
  return new Response(unlockedExcel, {
    status: 200,
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
};
