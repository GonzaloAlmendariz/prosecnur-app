/**
 * El STATUS DE MUESTRA, dicho de forma que no se contradiga con la fila.
 *
 * `monitoreo_aulas_estado_muestra()` es una **lista cerrada**: reconoce
 * `agendada`, `reagendada`, `reemplazada` y `en reserva N`, y todo lo demás cae
 * al default `sin_contactar`. Medido en `monitoreo_aulas_estados_no_reconocidos.R`:
 * «aplicada», «contactada», «en campo», «cerrada», «parcial» y «efectiva» salen
 * **las seis** como `sin_contactar` —y son palabras que los equipos escriben de
 * verdad en la hoja—.
 *
 * En blanco y `-` sí significan «todavía nada aquí» y el default es correcto.
 * El problema es el resto, y en pantalla se ve así: **la misma fila dice
 * «Aplicada» en qué toca y «Sin contactar» en status**. Sobre la selección real
 * de HSVG2026 con una semana de campo simulada, eso pasa en **78 de 174 filas**.
 *
 * Esto **no cambia el mapeo** —hacerlo tocaría todos los consumidores que hoy
 * switchean sobre `sin_contactar`, y el propio motor lo deja dicho—: sólo
 * impide que la tabla afirme una contradicción sin señalarla. La reparación de
 * fondo es abrir la lista, y es una decisión con su propio gate.
 *
 * La contradicción se detecta **sin ver el valor crudo**: si el eje operativo
 * dice que el aula ya se aplicó, se cerró o tiene cita, entonces «sin
 * contactar» no puede ser cierto, venga de donde venga.
 */

/**
 * Se exporta sólo para `listaCerradaSigueDetectada.contract.test.ts`, que
 * comprueba que las palabras que el motor NO reconoce siguen todas aquí. Si una
 * se cayera, su contradicción dejaría de señalarse en silencio.
 */
export const YA_SE_TOCO = new Set(["aplicada", "cerrada", "parcial", "en_campo", "agendada", "contactada"]);

const COMO_SE_LEE: Record<string, string> = {
  aplicada: "ya se aplicó",
  cerrada: "ya se cerró",
  parcial: "se aplicó a medias",
  en_campo: "está en campo",
  agendada: "tiene cita",
  contactada: "ya se contactó",
};

/** `null` cuando la fila no se contradice: entonces se enseña el valor tal cual. */
export function contradiccionDeEstado(
  sampleStatus: unknown,
  operationalStatus: unknown,
): string | null {
  const muestra = String(sampleStatus ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (muestra !== "sin_contactar") return null;
  const operativo = String(operationalStatus ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!YA_SE_TOCO.has(operativo)) return null;
  return COMO_SE_LEE[operativo] ?? "ya se tocó";
}

/**
 * Lo que se enseña en la columna. Conserva el valor cuando no hay contradicción
 * —no reescribe datos buenos— y lo anota cuando la hay.
 */
export function estadoDeMuestraLegible(
  sampleStatus: unknown,
  operationalStatus: unknown,
): string {
  const crudo = String(sampleStatus ?? "").trim();
  const choque = contradiccionDeEstado(sampleStatus, operationalStatus);
  return choque ? `${crudo} ⚠ pero ${choque}` : crudo;
}
