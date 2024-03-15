"use client";

import { ChangeEvent } from "react";

const InputFile = () => {
  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
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
    } catch (e: any) {
      console.error(e);
    }
  };

  return <input type="file" name="file" onChange={handleFile} />;
};

export default InputFile;
