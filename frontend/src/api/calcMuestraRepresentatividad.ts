// calcMuestraRepresentatividad.ts — Cálculo de muestra guarda el universo y las
// variables de cuota de su escenario en su clave propia (ADR 0121, 0123 Q1);
// Monitoreo los recibe en la foto `design_targets` al importar el plan.
//
// Contrato: `api/R/router_calc_muestra_representatividad.R`.
//   GET  /api/calc-muestra/representatividad           vista previa y lo guardado
//   POST /api/calc-muestra/representatividad/declarar  guarda en Cálculo
//
// Sólo universo y variables: las celdas con meta se quedan en el escenario.
// Normalizador defensivo: Plumber serializa con auto_unbox.

import { apiFetch, handle, headers } from "./core";
import { booleano, lista, registro, texto } from "./normalizarR";

export type VariableDeclarable = { clave: string; etiqueta: string; atribucion: string; categorias: number };

export type UniversoDeclarable = { nivel: string; valor: string; etiqueta: string };

export type RepresentatividadDeclarable = {
  universo: UniversoDeclarable;
  variables: VariableDeclarable[];
};

export type VistaPreviaDeRepresentatividad = {
  disponible: boolean;
  representatividad: RepresentatividadDeclarable | null;
  /** Lo que Cálculo ya guardó; `null` si nunca se guardó. */
  declarada?: RepresentatividadDeclarable | null;
  /** La foto que mide Monitoreo ya trae lo guardado (se guardó después de importar si es `false`). */
  enLaFoto?: boolean;
  /** Lo guardado es del sorteo que hoy mide Monitoreo (`false`: hay que volver a guardar). */
  sorteoVigente?: boolean;
};

function normalizarBloque(raw: unknown): RepresentatividadDeclarable | null {
  const r = registro(raw);
  const variables = lista(r.variables).map((v) => ({
    clave: texto(v.clave),
    etiqueta: texto(v.etiqueta) || texto(v.clave),
    atribucion: texto(v.atribucion),
    categorias: lista(v.categorias).length,
  })).filter((v) => v.clave);
  if (!variables.length) return null;
  const u = registro(r.universo);
  return {
    universo: { nivel: texto(u.nivel), valor: texto(u.valor), etiqueta: texto(u.etiqueta) },
    variables,
  };
}

export function normalizarVistaPreviaDeRepresentatividad(raw: unknown): VistaPreviaDeRepresentatividad {
  const r = registro(raw);
  const representatividad = normalizarBloque(r.representatividad);
  return {
    disponible: booleano(r.disponible) && representatividad !== null,
    representatividad,
    declarada: normalizarBloque(r.declarada),
    enLaFoto: booleano(r.en_la_foto),
    sorteoVigente: r.sorteo_vigente === undefined || r.sorteo_vigente === null ? true : booleano(r.sorteo_vigente),
  };
}

export async function apiCalcMuestraRepresentatividad(): Promise<VistaPreviaDeRepresentatividad> {
  return normalizarVistaPreviaDeRepresentatividad(
    await handle<unknown>(await apiFetch("/api/calc-muestra/representatividad", { headers: headers() })),
  );
}

export async function apiCalcMuestraDeclararRepresentatividad(): Promise<RepresentatividadDeclarable | null> {
  const r = await handle<unknown>(
    await apiFetch("/api/calc-muestra/representatividad/declarar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    }),
  );
  return normalizarBloque(registro(r).representatividad);
}
