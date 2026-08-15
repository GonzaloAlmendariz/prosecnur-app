import { describe, expect, it } from "vitest";

import type { PreguntaAbierta } from "../../api/codificacion";
import {
  contarSinDecidir,
  decisionDePregunta,
  frasePendientes,
  presentarDecision,
} from "./decisionCodificacion";

function preg(over: Partial<PreguntaAbierta>): PreguntaAbierta {
  return {
    parent: "X", parent_label: "X", tipo: "text", subtipo: "text", modo_so: "",
    text_col: "", parent_col: "", list_norm: "", col_efectiva: "X",
    n_respuestas: 0, n_unicas: 0, n_codificadas: 0, status: "no-iniciado",
    habilitada: true, preview: [], section: "", section_label: "", q_order: null,
    candidatos_texto: [], pareja: null, marcada: true, marcada_auto: false,
    ...over,
  } as PreguntaAbierta;
}

describe("presentarDecision", () => {
  it("las cuatro situaciones que se veían iguales ahora se ven distintas", () => {
    // Es el defecto que el ADR 0078 nombra: cuatro estados, una sola pinta.
    const etiquetas = (["sin_material", "pendiente", "pendiente_parcial", "no_categorizar"] as const)
      .map((d) => presentarDecision(d)!.etiqueta);
    expect(new Set(etiquetas).size).toBe(4);
    expect(etiquetas).toEqual([
      "Sin respuestas",
      "Sin categorías",
      "A medias",
      "No se categoriza",
    ]);
  });

  it("sólo dejan trabajo abierto las tres que el ADR cuenta", () => {
    expect(presentarDecision("pendiente")!.abierta).toBe(true);
    expect(presentarDecision("pendiente_parcial")!.abierta).toBe(true);
    expect(presentarDecision("requiere_config")!.abierta).toBe(true);
    // El control: si `sin_material` contara, volveríamos al conteo que el ADR
    // llama defectuoso — 6 pendientes en ACNUR V3 en vez de 4.
    expect(presentarDecision("sin_material")!.abierta).toBe(false);
    expect(presentarDecision("no_categorizar")!.abierta).toBe(false);
    expect(presentarDecision("categorizada")!.abierta).toBe(false);
  });

  it("una pregunta sin marcar no muestra estado", () => {
    expect(presentarDecision("sin_marcar")).toBeNull();
    expect(presentarDecision(undefined)).toBeNull();
  });
});

describe("decisionDePregunta", () => {
  it("respeta lo que manda el backend", () => {
    expect(decisionDePregunta(preg({ decision: "pendiente_parcial" }))).toBe("pendiente_parcial");
  });

  it("sin `decision` lo deriva igual que el backend", () => {
    // Un .pulso abierto contra una versión anterior no deja la lista muda.
    expect(decisionDePregunta(preg({ status: "completo" }))).toBe("categorizada");
    expect(decisionDePregunta(preg({ status: "sin-datos" }))).toBe("sin_material");
    expect(decisionDePregunta(preg({ status: "en-curso" }))).toBe("pendiente_parcial");
    expect(decisionDePregunta(preg({ status: "requiere-config" }))).toBe("requiere_config");
    expect(decisionDePregunta(preg({ status: "no-iniciado" }))).toBe("pendiente");
    expect(decisionDePregunta(preg({ marcada: false }))).toBe("sin_marcar");
    expect(decisionDePregunta(preg({ status: "no-aplica" }))).toBe("sin_marcar");
  });

  it("una decisión registrada gana sobre el status derivado", () => {
    const p = preg({ status: "no-iniciado", no_categorizar: { motivo: "n=4", decidido_en: "z" } });
    expect(decisionDePregunta(p)).toBe("no_categorizar");
  });
});

describe("contarSinDecidir", () => {
  it("reproduce el conteo del ADR sobre el estado de ACNUR V3", () => {
    const preguntas = [
      preg({ parent: "ContextProfesion", status: "completo" }),
      preg({ parent: "reva_sit_why", status: "completo" }),
      preg({ parent: "psico_empleador_why", status: "completo" }),
      preg({ parent: "MesesReva", status: "no-iniciado", n_respuestas: 87 }),
      preg({ parent: "NowSalary", status: "no-iniciado", n_respuestas: 16 }),
      preg({ parent: "PastSalary", status: "no-iniciado", n_respuestas: 4 }),
      preg({ parent: "GeneralSatisfaction_why", status: "no-iniciado", n_respuestas: 1 }),
      preg({ parent: "ExpSatisfaction_why", status: "sin-datos" }),
      preg({ parent: "RecomendSatisfaction_text", status: "sin-datos" }),
      preg({ parent: "Sos_desarrollo", status: "en-curso", n_respuestas: 87 }),
      preg({ parent: "ObservacionesCampo", status: "no-iniciado", marcada: false }),
    ];
    // 4 pendientes + el catálogo a medias. No 6 (contando las sin material) ni
    // 7 (contando además la que nadie marcó).
    expect(contarSinDecidir(preguntas)).toBe(5);
  });

  it("registrar la decisión baja el conteo", () => {
    const base = [preg({ parent: "NowSalary", status: "no-iniciado", n_respuestas: 16 })];
    expect(contarSinDecidir(base)).toBe(1);
    const decidida = [preg({
      parent: "NowSalary", status: "no-iniciado", n_respuestas: 16,
      no_categorizar: { motivo: "n insuficiente", decidido_en: "z" },
    })];
    expect(contarSinDecidir(decidida)).toBe(0);
  });
});

describe("frasePendientes", () => {
  it("dice un número accionable y nunca un porcentaje", () => {
    expect(frasePendientes(3)).toBe("3 variables marcadas sin decidir");
    expect(frasePendientes(1)).toBe("1 variable marcada sin decidir");
    expect(frasePendientes(0)).toBe("Sin variables pendientes de decidir");
    expect(frasePendientes(3)).not.toMatch(/%/);
  });
});
