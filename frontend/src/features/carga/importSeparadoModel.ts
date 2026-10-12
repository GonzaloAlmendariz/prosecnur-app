// «Bases separadas» desde una plataforma (Arte y Diseño, 2026-10-11): cada encuesta importada entra como una base
// nueva del estudio (`POST /api/carga/platform/surveymonkey/import-separate`). Su nombre corto sale del título: las
// encuestas de acreditación se titulan «Acreditación Arte y Diseño PUCP - Docentes», y la base debe llamarse
// «docentes», no repetir el nombre del estudio. El motor no acepta «$» ni espacios en el nombre de una base.

/** «Acreditación Arte y Diseño PUCP - Docentes» → «docentes»; sin separador, el título entero en minúsculas. */
export function nombreCortoDeEncuesta(titulo: string): string {
  const t = titulo.trim();
  const partes = t.split(/\s+[-–—|:]\s+/);
  const cola = partes.length > 1 ? partes[partes.length - 1] : t;
  const limpio = cola
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return limpio || "base";
}

/** Un nombre que no choque con las bases que ya existen: «docentes», «docentes_2»… */
export function nombreLibreDeBase(base: string, existentes: readonly string[]): string {
  const usados = new Set(existentes);
  if (!usados.has(base)) return base;
  for (let i = 2; ; i += 1) if (!usados.has(`${base}_${i}`)) return `${base}_${i}`;
}
