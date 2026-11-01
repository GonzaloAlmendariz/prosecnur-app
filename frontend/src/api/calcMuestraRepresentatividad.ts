// calcMuestraRepresentatividad.ts — Cálculo de muestra declara en el Planner el
// universo y las variables de cuota de su escenario (ADR 0121 F4).
//
// Contrato: `api/R/router_calc_muestra_representatividad.R`.
//   GET  /api/calc-muestra/representatividad           vista previa, no escribe
//   POST /api/calc-muestra/representatividad/declarar  escribe por la puerta del
//        Planner con su revisión vigente (409 E_PLANNER_DESACTUALIZADO)
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
  return { disponible: booleano(r.disponible) && representatividad !== null, representatividad };
}

export async function apiCalcMuestraRepresentatividad(): Promise<VistaPreviaDeRepresentatividad> {
  return normalizarVistaPreviaDeRepresentatividad(
    await handle<unknown>(await apiFetch("/api/calc-muestra/representatividad", { headers: headers() })),
  );
}

export async function apiCalcMuestraDeclararRepresentatividad(
  expectedRevision: number,
  poblacionId = "principal",
): Promise<RepresentatividadDeclarable | null> {
  const r = await handle<unknown>(
    await apiFetch("/api/calc-muestra/representatividad/declarar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ tipo: "aulas", poblacion_id: poblacionId, expected_revision: expectedRevision }),
    }),
  );
  return normalizarBloque(registro(r).representatividad);
}
