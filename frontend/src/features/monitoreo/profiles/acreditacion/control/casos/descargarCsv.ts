/** Descarga un CSV con la marca UTF-8 para que Excel lea las tildes. */
export function descargarCsv(contenido: string, nombre: string) {
  if (typeof document === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") return;
  const url = URL.createObjectURL(new Blob([`﻿${contenido}`], { type: "text/csv;charset=utf-8" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}
