import JSZip from "jszip";

const newZip = new JSZip();

export const POST = async (req: Request) => {
  const sheetRegex = /<sheetProtection(.*?)\/>/g;
  const workBookRegex = /<workbookProtection(.*?)\/>/g;
  const formData = await req.formData();
  const file = formData.get("file") as unknown as File;
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  for (const [filePath, zipObject] of Object.entries(zip.files)) {
    let content = await zipObject.async("string");
    content = content.replaceAll(sheetRegex, "").replaceAll(workBookRegex, "");
    newZip.file(filePath, content);
  }

  const unlockedZip = await newZip.generateAsync({ type: "blob" });
  return new Response(unlockedZip, {
    status: 200,
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
};
