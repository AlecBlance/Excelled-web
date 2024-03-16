"use client";

import { ChangeEvent } from "react";
import { Toaster, toast } from "sonner";

const InputFile = () => {
  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.info("Unlocking your excel file...");
      const fileName = file.name.split(".");
      const data = new FormData();
      data.set("file", file);

      const res = await fetch("/api", {
        method: "POST",
        body: data,
      });

      const blob = await res.blob();
      const newfile = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = newfile;
      link.setAttribute("download", `${fileName[0]}-excelled.${fileName[1]}`);
      document.body.appendChild(link);
      link.click();
      e.target.value = "";
      toast.success("Downloaded!");
    } catch (e: any) {
      console.error(e);
      toast.error("There seems to be a problem...");
    }
  };

  return (
    <>
      <label
        htmlFor="file"
        className="bg-excelled-text rounded-full text-sm w-full py-3 flex justify-center text-white"
      >
        UPLOAD
      </label>
      <input
        type="file"
        name="file"
        id="file"
        className="hidden"
        onChange={handleFile}
      />
    </>
  );
};

export default InputFile;
