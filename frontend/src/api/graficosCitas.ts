// Candidatas de citas para la tarjeta de aprobación de `p_citas` (O3b, plan-texto-abierto-ccss-2026-10-24). Sólo
// lectura: GET /api/graficos/citas-candidatas (api/R/router_graficos_citas.R). Lo aprobado viaja en `citas_aprobadas`.
// R serializa con auto_unbox: un vector de uno puede llegar en caja o suelto.

import { apiFetch, handle, headers } from "./core";

export type CitaCandidata = { id: string; texto: string; chars: number; puntaje: number; revision: string; propuesta: boolean };
export type CitasCandidatas = {
  base: string;
  variable: string;
  candidatas: CitaCandidata[];
  /** Comentarios con contenido en la base filtrada. */
  comentarios: number;
  escribieron: number;
  avisos: string[];
};

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const uno = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);
const texto = (v: unknown): string => { const x = uno(v); return typeof x === "string" ? x : typeof x === "number" ? String(x) : ""; };
const numero = (v: unknown): number => { const x = Number(uno(v)); return Number.isFinite(x) ? x : 0; };
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);

export function normalizarCitasCandidatas(raw: unknown): CitasCandidatas {
  const r = esObjeto(raw) ? raw : {};
  const candidatas = lista(r.candidatas).filter(esObjeto).flatMap((c): CitaCandidata[] => {
    const id = texto(c.id);
    if (!id) return [];
    return [{ id, texto: texto(c.texto), chars: numero(c.chars), puntaje: numero(c.puntaje), revision: texto(c.revision), propuesta: uno(c.propuesta) === true }];
  });
  return {
    base: texto(r.base),
    variable: texto(r.variable),
    candidatas,
    comentarios: numero(r.comentarios),
    escribieron: numero(r.escribieron),
    avisos: lista(r.avisos).map(texto).filter(Boolean),
  };
}

export type ConsultaCitas = { variable: string; base?: string; filtros?: unknown; varPersona?: string };

export async function apiGraficosCitasCandidatas(q: ConsultaCitas): Promise<CitasCandidatas> {
  const p = new URLSearchParams({ variable: q.variable });
  if (q.base) p.set("base", q.base);
  if (Array.isArray(q.filtros) ? q.filtros.length : esObjeto(q.filtros) && Object.keys(q.filtros).length) p.set("filtros", JSON.stringify(q.filtros));
  if (q.varPersona) p.set("var_persona", q.varPersona);
  return normalizarCitasCandidatas(await handle<unknown>(await apiFetch(`/api/graficos/citas-candidatas?${p}`, { headers: headers() })));
}
