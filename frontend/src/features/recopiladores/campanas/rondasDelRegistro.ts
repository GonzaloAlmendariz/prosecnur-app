// rondasDelRegistro.ts — el registro de campañas por público y ronda (revamp v5, ADR 0125
// §5 y A4). En acreditación cada público tiene sus rondas en orden (correo → llamadas →
// correo…) y la supervisión de un lote cuelga de la telefónica de la que viene. Sin
// `relacion` (estudios que no son de acreditación) la lista sigue como siempre.

import type { CampanaMaterial } from "../../../api/materialCampanas";

export type GrupoDePublico = { publico: string; campanas: CampanaMaterial[] };

/** Agrupa por público en orden de ronda; la supervisión va tras su telefónica. */
export function agruparPorPublico(campanas: readonly CampanaMaterial[]): { grupos: GrupoDePublico[]; sueltas: CampanaMaterial[] } {
  const grupos = new Map<string, CampanaMaterial[]>();
  const publicoDe = new Map<string, string>();
  for (const c of campanas) {
    const p = c.relacion?.publico;
    if (!p) continue;
    const lista = grupos.get(p) ?? [];
    lista.push(c);
    grupos.set(p, lista);
    publicoDe.set(c.id, p);
  }
  const sueltas: CampanaMaterial[] = [];
  const colgadas = new Map<string, CampanaMaterial[]>();
  for (const c of campanas) {
    if (c.relacion?.publico) continue;
    const madre = c.relacion?.viene_de ?? null;
    const p = madre ? publicoDe.get(madre) : undefined;
    if (madre && p) {
      const lista = colgadas.get(madre) ?? [];
      lista.push(c);
      colgadas.set(madre, lista);
    } else sueltas.push(c);
  }
  const salida: GrupoDePublico[] = [];
  for (const [publico, lista] of grupos) {
    const ordenadas = [...lista].sort((a, b) => (a.relacion?.ronda ?? 0) - (b.relacion?.ronda ?? 0));
    salida.push({ publico, campanas: ordenadas.flatMap((c) => [c, ...(colgadas.get(c.id) ?? [])]) });
  }
  return { grupos: salida, sueltas };
}

/** «Ronda 2, viene de «Invitación a egresados»» o, sin ronda, de qué campaña viene. */
export function procedenciaDe(c: CampanaMaterial, nombreDe: (id: string) => string | null): string | null {
  const ronda = c.relacion?.ronda ?? null;
  const madre = c.relacion?.viene_de ? nombreDe(c.relacion.viene_de) : null;
  if (ronda) return madre ? `Ronda ${ronda}, viene de «${madre}»` : `Ronda ${ronda}${ronda === 1 ? ", la primera" : ""}`;
  return madre ? `Viene de «${madre}»` : null;
}
