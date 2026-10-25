// TXT-10/16: un enlace a una pregunta que no está en «Preguntas para codificar» no puede caer mudo en otra pregunta.
import { describe, expect, it } from "vitest";
import type { PreguntaAbierta } from "../../api/codificacion";
import { resolverFocoCodificar } from "./focoCodificar";

const preg = (parent: string, extra: Partial<PreguntaAbierta> = {}): PreguntaAbierta => ({
  parent, parent_label: parent, tipo: "text", col_efectiva: parent, marcada: false, marcada_auto: false, q_order: 1,
  ...extra,
} as PreguntaAbierta);

const DATOS = [
  preg("a1", { tipo: "select_one", marcada: true, q_order: 1, candidatos_texto: [{ col: "a1_otro" } as never] }),
  preg("b2", { marcada: true, q_order: 2 }),
  preg("coment", { q_order: 9 }),
  preg("edad", { tipo: "select_one", q_order: 3 }),
];
const marcadas = DATOS.filter((p) => p.marcada);

describe("resolverFocoCodificar", () => {
  it("sin foco: la primera marcada, como siempre", () => {
    expect(resolverFocoCodificar(DATOS, marcadas, null)).toEqual({ tipo: "activa", parent: "a1" });
  });

  it("foco marcado: esa pregunta", () => {
    expect(resolverFocoCodificar(DATOS, marcadas, "b2")).toEqual({ tipo: "activa", parent: "b2" });
  });

  it("foco que existe pero no está incluido: se avisa y se ofrece incluirla, no se cae en otra", () => {
    const r = resolverFocoCodificar(DATOS, marcadas, "coment");
    expect(r.tipo).toBe("sin-incluir");
    if (r.tipo === "sin-incluir") {
      expect(r.pregunta.parent).toBe("coment");
      expect(r.incluible).toBe(true);
    }
  });

  it("una select_one sin texto que codificar no se ofrece incluir (Preparar tampoco muestra el interruptor)", () => {
    const r = resolverFocoCodificar(DATOS, marcadas, "edad");
    expect(r).toMatchObject({ tipo: "sin-incluir", incluible: false });
  });

  it("la columna de texto también identifica la pregunta", () => {
    const r = resolverFocoCodificar([preg("p5", { col_efectiva: "p5_txt" })], [], "p5_txt");
    expect(r).toMatchObject({ tipo: "sin-incluir", incluible: true });
  });

  it("foco que no es una pregunta abierta de esta base: se dice, no se cae en otra", () => {
    expect(resolverFocoCodificar(DATOS, marcadas, "zzz")).toEqual({ tipo: "no-existe", foco: "zzz" });
  });

  it("sin foco ni marcadas: ninguna", () => {
    expect(resolverFocoCodificar(DATOS, [], null)).toEqual({ tipo: "ninguna" });
  });
});
