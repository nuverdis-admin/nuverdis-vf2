export function descargarBlob(buffer: number[], filename: string): void {
  const uint8 = new Uint8Array(buffer);
  const blob = new Blob([uint8], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
