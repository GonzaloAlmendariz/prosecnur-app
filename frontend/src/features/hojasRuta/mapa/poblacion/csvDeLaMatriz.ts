// El CSV de la matriz poblacional tal como se ve en el cajón: la agrupación, los
// rangos y, si se lee por sexo, una columna por sexo. Puro: el archivo (con la
// marca UTF-8 para Excel) lo arma `archivoCsv` del kit de entregables y lo
// entrega el contenedor, como el Excel del motor.

import type { HojasRutaAgeRange } from "../../../../api/hojasRuta";
import { nombreDistrito } from "../nombres";
import type { AgruparFilas, FilaMatriz } from "./matriz";

const ENCABEZADO: Record<AgruparFilas, string> = { distrito: "Distrito", ubigeo: "Ubigeo", provincia: "Provincia", zona: "Zona" };
const enRango = (f: FilaMatriz, i: number) => (f.porRango[i] ? f.porRango[i].H + f.porRango[i].M : 0);

/** Celda con comillas sólo si las necesita (coma, punto y coma, comillas o salto de línea). */
const celda = (v: string | number) => (typeof v === "string" && /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v));

export function csvDeLaMatriz(filasCsv: readonly FilaMatriz[], por: AgruparFilas, rangos: readonly HojasRutaAgeRange[], sexo: boolean): string {
  const distrito = por === "distrito" || por === "ubigeo";
  const cab = [
    por === "ubigeo" ? "Ubigeo" : ENCABEZADO[por],
    ...(distrito ? [por === "ubigeo" ? "Distrito" : "Ubigeo"] : []),
    ...rangos.flatMap((r) => (sexo ? [`${r.label} H`, `${r.label} M`] : [r.label])),
    "Total",
  ];
  const filas = filasCsv.map((f) => [
    por === "ubigeo" ? f.ubigeo : distrito ? nombreDistrito(f.territorio) : f.territorio,
    ...(distrito ? [por === "ubigeo" ? nombreDistrito(f.territorio) : f.ubigeo] : []),
    ...rangos.flatMap((_, i) => (sexo ? [f.porRango[i]?.H ?? 0, f.porRango[i]?.M ?? 0] : [enRango(f, i)])).map((n) => Math.round(n)),
    Math.round(f.total),
  ]);
  return [cab, ...filas].map((fila) => fila.map(celda).join(",")).join("\n");
}
