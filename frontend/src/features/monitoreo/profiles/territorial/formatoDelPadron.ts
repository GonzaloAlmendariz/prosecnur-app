import { useState } from "react";

import type { MonitoreoTerritorialEnumeratorRoster } from "../../../../api/monitoreo";

// El selector PXXX/DNI de la consola arrancaba siempre en PXXX. Mientras el
// backend ignoraba el campo no importaba; desde f425023ad lo respeta, y volver
// a subir el Excel de un padrón en DNI sin tocar el selector lo pasaba a PXXX
// con códigos aleatorios nuevos (los DNI previos no validan como PXXX). El
// selector nace del padrón guardado y vuelve a él cuando el padrón cambia.

export type FormatoPadron = "PXXX" | "DNI";

type PadronLeido = Pick<MonitoreoTerritorialEnumeratorRoster, "code_format" | "uploaded_at" | "generated_at" | "source_file_id">;

export type EleccionDeFormato = { padron: string; formato: FormatoPadron };

// Misma lectura que .monitoreo_territorial_code_format en el motor.
export function formatoDelPadron(codeFormat: string | null | undefined): FormatoPadron {
  const f = String(codeFormat ?? "").trim().toUpperCase();
  return f === "DNI" || f === "DOCUMENTO" ? "DNI" : "PXXX";
}

// Identidad del padrón: cambia con cada subida, así una elección hecha sobre el
// padrón anterior no sobrevive al nuevo.
export function claveDelPadron(roster: Partial<PadronLeido> | null | undefined): string {
  if (!roster) return "";
  return [roster.uploaded_at, roster.generated_at, roster.source_file_id, roster.code_format].map((v) => v ?? "").join("|");
}

export function formatoVigente(roster: Partial<PadronLeido> | null | undefined, eleccion: EleccionDeFormato | null): FormatoPadron {
  if (eleccion && eleccion.padron === claveDelPadron(roster)) return eleccion.formato;
  return formatoDelPadron(roster?.code_format);
}

export function useFormatoDelPadron(roster: Partial<PadronLeido> | null | undefined) {
  const [eleccion, setEleccion] = useState<EleccionDeFormato | null>(null);
  const formato = formatoVigente(roster, eleccion);
  const elegir = (next: FormatoPadron) => setEleccion({ padron: claveDelPadron(roster), formato: next });
  return [formato, elegir] as const;
}
