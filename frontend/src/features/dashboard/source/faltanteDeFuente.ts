// Qué le falta a un origen de la fuente del dashboard (proyecto o sesión).
//
// El aviso decía «Proyecto: falta XLSForm o data» aunque los dos selectores
// mostraran un archivo: hablaba del origen que NO estaba elegido y no decía
// cuál de las dos piezas faltaba (L16 de la maqueta de Meta B).

export type CandidatosDeOrigen = {
  xlsforms: readonly unknown[];
  data: readonly unknown[];
};

/** La pieza que le falta al origen, en palabras, o `null` si tiene las dos. */
export function faltanteDeOrigen(candidatos: CandidatosDeOrigen | null | undefined): string | null {
  const sinXls = (candidatos?.xlsforms.length ?? 0) === 0;
  const sinData = (candidatos?.data.length ?? 0) === 0;
  if (sinXls && sinData) return "XLSForm ni base de datos";
  if (sinXls) return "XLSForm";
  if (sinData) return "base de datos";
  return null;
}

/**
 * El aviso del origen que no está en uso, o `null` si no hace falta decir
 * nada. Del origen activo no se avisa: sus selectores ya muestran lo que hay
 * y el botón de carga dice qué falta elegir.
 */
export function avisoDeOrigenInactivo(
  origen: "project" | "session",
  candidatos: CandidatosDeOrigen | null | undefined,
): string | null {
  const falta = faltanteDeOrigen(candidatos);
  if (!falta) return null;
  return origen === "project"
    ? `El proyecto no tiene ${falta}.`
    : `La sesión no tiene ${falta}.`;
}
