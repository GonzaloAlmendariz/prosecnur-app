import { describe, expect, it } from "vitest";
import { PULSO_PUCP_COLORS } from "../paletasSugeridas";
import {
  combinacionesPara,
  conColoresDelGrupo,
  esRespuestaResidual,
  estadoGrupo,
  grupoCoincide,
  gruposDeRespuestas,
  type ListaRespuestas,
} from "./modeloColoresRespuestas";

const sino = (n: string, vars: string[], fuentes: string[] = []): ListaRespuestas => ({
  list_name: n,
  choices: [{ name: "1", label: "Sí" }, { name: "2", label: "No" }],
  variables: vars,
  fuentes,
});
const acuerdo: ListaRespuestas = {
  list_name: "lst_p8",
  choices: ["Muy en desacuerdo", "En desacuerdo", "De acuerdo", "Muy de acuerdo", "No sabe"].map((label, i) => ({ name: String(i + 1), label })),
  variables: ["docentes$p8"],
  fuentes: ["docentes"],
};
const ETIQUETAS = new Map([["p1", "¿Trabaja actualmente?"], ["docentes$p8", "La facultad cumple lo que ofrece"]]);

describe("Colores de las respuestas", () => {
  it("las listas con las mismas opciones forman un grupo, con sus preguntas y bases", () => {
    const grupos = gruposDeRespuestas([sino("lst_p1", ["p1"]), { ...sino("lst_p2", ["p2"]), choices: [{ name: "a", label: "no" }, { name: "b", label: "SÍ" }] }, acuerdo], {}, {}, ETIQUETAS);
    expect(grupos).toHaveLength(2);
    const g = grupos.find((x) => x.listas.includes("lst_p1"))!;
    expect(g.listas).toEqual(["lst_p1", "lst_p2"]);
    expect(g.preguntas.map((p) => p.texto)).toEqual(["¿Trabaja actualmente?", "p2"]);
    expect(estadoGrupo(g)).toBe("sin-colores");
    const a = grupos.find((x) => x.listas.includes("lst_p8"))!;
    expect(a.preguntas[0]).toEqual({ ref: "docentes$p8", texto: "La facultad cumple lo que ofrece", base: "docentes" });
    expect(a.bases).toEqual(["docentes"]);
  });

  it("omite las columnas internas y las listas que ninguna pregunta usa", () => {
    const interna: ListaRespuestas = { list_name: "lst_d", choices: [{ name: "o", label: "Otros distritos" }], variables: ["__district"] };
    const grupos = gruposDeRespuestas([sino("lst_p1", ["p1"]), interna], {}, {}, ETIQUETAS);
    expect(grupos.map((g) => g.listas)).toEqual([["lst_p1"]]);
  });

  it("lee el color vigente, también el que llega por otra lista igual, y cuenta lo que falta", () => {
    const grupos = gruposDeRespuestas([sino("lst_p1", []), sino("lst_p2", [])], { lst_p2: { "Sí": "#081F5C" } }, {}, new Map());
    expect(grupos[0].colores).toEqual({ "Sí": "#081F5C" });
    expect(grupos[0].faltan).toBe(1);
    expect(estadoGrupo(grupos[0])).toBe("incompleto");
  });

  it("pinta todas las listas del grupo, cada una con su forma de escribir la opción, en un mapa nuevo", () => {
    const listas = [sino("lst_p1", []), { ...sino("lst_p2", []), choices: [{ name: "a", label: "SÍ" }, { name: "b", label: "no" }] }];
    const [g] = gruposDeRespuestas(listas, {}, {}, new Map());
    const antes = { otra: { X: "#000000" } };
    const despues = conColoresDelGrupo(antes, g, listas, { "Sí": "#081F5C", No: "#BFBFBF" });
    expect(despues).toEqual({ otra: { X: "#000000" }, lst_p1: { "Sí": "#081F5C", No: "#BFBFBF" }, lst_p2: { "SÍ": "#081F5C", no: "#BFBFBF" } });
    expect(antes).toEqual({ otra: { X: "#000000" } });
    // Quitar los colores deja la lista sin paleta, sin tocar las demás.
    expect(conColoresDelGrupo(despues, g, listas, { "Sí": null, No: null })).toEqual({ otra: { X: "#000000" } });
  });

  it("las combinaciones dan gris a las respuestas residuales y color a las demás", () => {
    expect(esRespuestaResidual("No sabe / No responde")).toBe(true);
    expect(esRespuestaResidual("Otro (especifique)")).toBe(true);
    expect(esRespuestaResidual("No")).toBe(false);
    const combos = combinacionesPara(acuerdo.choices.map((c) => c.label));
    expect(combos.length).toBeGreaterThan(0);
    for (const c of combos) {
      expect(c.colores["No sabe"]).toBe(PULSO_PUCP_COLORS.gris);
      expect(Object.keys(c.colores)).toHaveLength(5);
      expect(c.nombre).not.toMatch(/Pulso/);
    }
  });

  it("busca por opción, pregunta o base sin importar tildes", () => {
    const [g] = gruposDeRespuestas([acuerdo], {}, {}, ETIQUETAS);
    expect(grupoCoincide(g, "facultad")).toBe(true);
    expect(grupoCoincide(g, "DESACUERDO")).toBe(true);
    expect(grupoCoincide(g, "docentes")).toBe(true);
    expect(grupoCoincide(g, "egresados")).toBe(false);
  });
});
