// La regla de diferencias del estudio (ADR 0126/0128) contada en filas para la tarjeta de Cruces. Analítica no la edita:
// la misma regla gobierna las láminas, el Word y estas tablas, y se cambia en Gráficos › Láminas.

import type { ReglaDiferencias } from "../../../api/graficosDiferencias";
import { serializarDireccion } from "../../../lib/navegacion/direccion";

export type FilaRegla = { rotulo: string; valor: string };

/** La dirección canónica del diálogo de la regla: Procesamiento › Gráficos › Láminas, `panel=diferencias-regla`. */
export const DIRECCION_REGLA_ESTUDIO = serializarDireccion({
  modulo: "procesamiento",
  seccion: "graficos",
  pestana: "laminas",
  panel: "diferencias-regla",
});

export function filasRegla(regla: ReglaDiferencias): FilaRegla[] {
  const prueba = regla.prueba === "rao_scott"
    ? `Rao-Scott por ${regla.conglomerado ?? "conglomerado sin elegir"}${regla.estrato ? `, estrato ${regla.estrato}` : ""}`
    : "Prueba z de diferencia de proporciones";
  return [
    { rotulo: "Prueba", valor: prueba },
    { rotulo: "Corrección", valor: regla.correccion === "bh_informe" ? "Benjamini-Hochberg en todo el informe" : "Bonferroni dentro de cada fila" },
    { rotulo: "Nivel", valor: `p < ${regla.alfa.toFixed(2)}` },
    { rotulo: "Diferencia mínima", valor: regla.umbral_puntos > 0 ? `${regla.umbral_puntos} puntos` : "Sin mínimo" },
    { rotulo: "Base mínima", valor: `${regla.base_minima} casos por columna` },
  ];
}

/** «Del estudio» si está guardada en el proyecto; «Propuesta» si es la que sugiere el diseño y nadie la aplicó. */
export function origenRegla(origen: string | null): { rotulo: string; propuesta: boolean } {
  return origen === "estudio" ? { rotulo: "Del estudio", propuesta: false } : { rotulo: "Propuesta", propuesta: true };
}

/** Los dos 422 de la regla con su texto; cualquier otro error, su mensaje. */
export function textoErrorRegla(code: string, message: string): string {
  if (code === "E_SIG_SIN_CONGLOMERADO") return "La regla pide Rao-Scott y la base no tiene la columna de conglomerado.";
  if (code === "E_SIG_ESTRATO_NO_ANIDADO") return "El estrato no es constante dentro de cada conglomerado: no sirve como estrato del sorteo.";
  return message || "No se pudo leer la regla del estudio.";
}
