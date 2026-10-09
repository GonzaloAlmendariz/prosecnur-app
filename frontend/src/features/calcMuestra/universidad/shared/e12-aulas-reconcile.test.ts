/**
 * E12 · A1 — abrir un proyecto de aulas no debe escribir el estudio.
 *
 * El efecto de CalcMuestraPage que reconcilia `aulas_config.n_aulas` escribe
 * cuando `reconcileUniversityAulasTarget` devuelve algo distinto del workspace
 * que recibió. Antes normalizaba TODO `aulas_config` en cada pasada, y el
 * payload de R nunca coincide con esa normalización (sirve los mapas vacíos
 * como `[]` y omite defaults como `docente_unico`): medido sobre HSVG2026, cada
 * apertura marcaba `dirty`, disparaba el PUT y dejaba el proyecto «sin
 * guardar» sin que nadie tocara nada.
 */
import { describe, expect, it } from "vitest";
import type {
  CalcMuestraComponente,
  CalcMuestraResultado,
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { defaultComponente } from "../../sharedCore";
import { reconcileUniversityAulasTarget, universityDefaultWorkspace } from "./study";

type AulasConfigConObjetivo = CalcMuestraWorkspaceAulasConfig & { n_aulas?: number };

function componente(actorId: string, aulasBaseTotal?: number): CalcMuestraComponente {
  const resultado: CalcMuestraResultado | null = aulasBaseTotal == null
    ? null
    : {
        n_teorico: null,
        n_objetivo: 100,
        n_operativo: 100,
        origen_tamano: "formula",
        tecnica: "prob_conglomerado_multietapico",
        computado_at: "2026-08-01T00:00:00Z",
        inferencia: { permitido: true, motivos: null },
        aulas_base_total: aulasBaseTotal,
      };
  return defaultComponente({ id: actorId, actor_id: actorId, tecnica: "prob_conglomerado_multietapico", resultado });
}

/** Workspace tal como lo sirve R: config parcial, mapas vacíos como `[]`. */
function workspaceDelBackend(nAulas?: number): CalcMuestraWorkspace {
  const base = universityDefaultWorkspace();
  const crudo = {
    min_eligible_per_class: 15,
    session_type_excepciones: [],
    nivel_por_unidad: [],
    ...(nAulas == null ? {} : { n_aulas: nAulas }),
  } as unknown as AulasConfigConObjetivo;
  return { ...base, aulas_config: crudo };
}

describe("E12 A1 · reconcileUniversityAulasTarget no reescribe al abrir", () => {
  it("sin cálculo y sin target devuelve el mismo workspace", () => {
    const ws = workspaceDelBackend();
    const componentes = [componente("estudiantes_universidad"), componente("estudiantes_facultad")];
    expect(reconcileUniversityAulasTarget(ws, componentes)).toBe(ws);
  });

  it("con el target ya materializado devuelve el mismo workspace", () => {
    const ws = workspaceDelBackend(13);
    const componentes = [componente("estudiantes_universidad", 13), componente("estudiantes_facultad", 29)];
    expect(reconcileUniversityAulasTarget(ws, componentes)).toBe(ws);
  });

  it("si el target cambia, sí lo reescribe", () => {
    const ws = workspaceDelBackend(13);
    const componentes = [componente("estudiantes_universidad", 17), componente("estudiantes_facultad", 29)];
    const next = reconcileUniversityAulasTarget(ws, componentes);
    expect(next).not.toBe(ws);
    expect((next.aulas_config as AulasConfigConObjetivo).n_aulas).toBe(17);
  });

  it("si el cálculo desaparece, retira el target", () => {
    const ws = workspaceDelBackend(13);
    const componentes = [componente("estudiantes_universidad"), componente("estudiantes_facultad")];
    const next = reconcileUniversityAulasTarget(ws, componentes);
    expect(next.aulas_config).not.toHaveProperty("n_aulas");
  });
});
