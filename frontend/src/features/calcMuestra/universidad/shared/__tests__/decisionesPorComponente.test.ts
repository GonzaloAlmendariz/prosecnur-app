/**
 * El marco se comparte entre los dos componentes; las DECISIONES no.
 *
 * `universityComponents` reparte un solo marco a los dos componentes de
 * universidad porque el marco —N, divisores, tau— es dato compartido. Pero
 * dentro del mismo objeto viajan las decisiones del analista sobre UN
 * componente: `aulas_base_fijas` y sus hermanas. Repartir el marco entero se
 * las lleva puestas.
 *
 * Medido en la app el 2026-08-27 con HSVG26ULT: el componente de facultad tenía
 * quince fijaciones que sumaban 175 y el de universidad ninguna. Pulsar
 * «Recalcular muestra» —que pasa por `prepareUniversityStudyForCalculation` y
 * persiste lo que sale— dejó el componente de facultad con CERO fijaciones y el
 * objetivo saltó de 175 a 294. No es un caso de borde: es el botón principal
 * del módulo, y borra en silencio todo el reparto por facultad.
 */
import { describe, expect, it } from "vitest";
import type { CalcMuestraComponente } from "../../../../../api/client";
import { universityComponents } from "../study";
import {
  UNIVERSITY_FACULTY_COMPONENT_ID,
  UNIVERSITY_TOTAL_COMPONENT_ID,
} from "../constants";

const estrato = (label: string, extra: Record<string, unknown> = {}) => ({
  id: `e-${label}`, label, N: 4000, promedio_conglomerado: 25, tau: 0.5, ...extra,
});

function estudioConDecisionesSoloEnFacultad(): CalcMuestraComponente[] {
  return [
    {
      id: "cmp-x",
      actor_id: UNIVERSITY_TOTAL_COMPONENT_ID,
      tecnica: "prob_conglomerado_multietapico",
      marco: { estado: "validado", estratos: [estrato("DERECHO"), estrato("PSICOLOGÍA")] },
      parametros: {},
      meta: {},
    },
    {
      id: "cmp-x-fac",
      actor_id: UNIVERSITY_FACULTY_COMPONENT_ID,
      tecnica: "prob_conglomerado_multietapico",
      marco: {
        estado: "validado",
        estratos: [
          estrato("DERECHO", { aulas_base_fijas: 19, aulas_base_origen: "operativa", aulas_base_nota: "va justa" }),
          estrato("PSICOLOGÍA", { aulas_base_fijas: 6, aulas_base_origen: "certificacion" }),
        ],
      },
      parametros: {},
      meta: {},
    },
  ] as unknown as CalcMuestraComponente[];
}

describe("universityComponents — el marco se comparte, las decisiones no", () => {
  it("el componente de facultad conserva sus fijaciones y su origen", () => {
    const [, faculty] = universityComponents(estudioConDecisionesSoloEnFacultad());
    const porLabel = new Map((faculty.marco.estratos ?? []).map((e) => [e.label, e]));

    const derecho = porLabel.get("DERECHO") as Record<string, unknown> | undefined;
    expect(derecho?.aulas_base_fijas).toBe(19);
    expect(derecho?.aulas_base_origen).toBe("operativa");
    expect(derecho?.aulas_base_nota).toBe("va justa");

    const psico = porLabel.get("PSICOLOGÍA") as Record<string, unknown> | undefined;
    expect(psico?.aulas_base_fijas).toBe(6);
    expect(psico?.aulas_base_origen).toBe("certificacion");
  });

  it("el de universidad NO hereda decisiones que no son suyas", () => {
    const [total] = universityComponents(estudioConDecisionesSoloEnFacultad());
    for (const e of total.marco.estratos ?? []) {
      expect((e as Record<string, unknown>).aulas_base_fijas ?? 0).toBe(0);
    }
  });

  it("el marco sí se comparte: N y divisores llegan a los dos", () => {
    const [total, faculty] = universityComponents(estudioConDecisionesSoloEnFacultad());
    expect((total.marco.estratos ?? []).map((e) => e.N)).toEqual([4000, 4000]);
    expect((faculty.marco.estratos ?? []).map((e) => e.N)).toEqual([4000, 4000]);
  });
});
