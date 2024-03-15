"use client";

import React, { FormEvent, useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File>();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="file"
        name="file"
        onChange={(e) => setFile(e.target.files?.[0])}
      />
      <input type="submit" />
    </form>
  );
}
