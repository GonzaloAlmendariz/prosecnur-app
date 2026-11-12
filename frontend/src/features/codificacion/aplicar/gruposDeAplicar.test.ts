import { describe, expect, it } from "vitest";
import type { PlanPregunta } from "../../../api/dashboard";
import { estadoDeFila, gruposDeAplicar } from "./gruposDeAplicar";

const p = (parent: string): PlanPregunta => ({
  parent, parent_label: "", tipo: "text", modo_so: "", text_col: "", nueva_variable: `${parent}_recod`, n_grupos: 1,
  n_codigos_nuevos: 1, n_codigos_reutilizados: 0, n_respuestas_afectadas: 1, codigos_nuevos: [], codigos_reutilizados: [], bridge_soportado: true,
});

describe("gruposDeAplicar", () => {
  it("separa las completas (Listas) de las que se aplican a medias (En curso, Faltan N)", () => {
    const avances = new Map([["p9", { decididas: 97, total: 97 }], ["p21", { decididas: 37, total: 118 }]]);
    const g = gruposDeAplicar([p("p21"), p("p9")], avances);
    expect(g?.map((x) => [x.rotulo, x.preguntas.map((q) => q.parent)])).toEqual([["Listas", ["p9"]], ["En curso", ["p21"]]]);
    expect(estadoDeFila(avances.get("p21"))).toEqual({ texto: "Faltan 81", tono: "curso" });
    expect(estadoDeFila(avances.get("p9"))).toEqual({ texto: "Lista", tono: "listo" });
  });

  it("sin el avance de alguna pregunta no agrupa ni inventa su estado", () => {
    expect(gruposDeAplicar([p("p9")], null)).toBeNull();
    expect(gruposDeAplicar([p("p9")], new Map())).toBeNull();
    expect(estadoDeFila(undefined)).toBeNull();
  });
});
