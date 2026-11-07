// Experimento de viñetas (C10, 2026-11-07). Mata: un texto con un hueco que no es atributo (o un atributo que el texto
// no usa) dado por bueno, una viñeta sin su sorteo adentro, un escenario que no se reconoce al volver a abrirlo o que
// pierde pesos, condición o escala al leerlo, y un reemplazo que renombra variables o duplica la escala.
import { describe, expect, it } from "vitest";
import { insertRecord, makeSheet, rowToRecord } from "../parsing/sheetUtils";
import type { XlsformEditorWorkbook } from "../types";
import { reemplazarVinetas } from "./insertarConjoint";
import { leerConjoint } from "./leerConjoint";
import { leerVinetas } from "./leerVinetas";
import { generarVinetas, nombresVinetasDelEditor, validarVinetas, type DisenoVinetas, type NombresVinetas } from "./modeloVinetas";

const diseno = (vinetas = 3): DisenoVinetas => ({
  prefijo: "vi",
  vinetas,
  texto: "Un candidato de {edad} que {pasado}. {partido}",
  pregunta: "¿Qué tan probable es que vote por él?",
  escala: { min: 0, max: 10, etiquetaMin: "Nada probable", etiquetaMax: "Muy probable" },
  intro: "Le leeré algunas situaciones.",
  atributos: [
    { clave: "edad", rotulo: "Edad", niveles: [{ codigo: "1", texto: "35 años", peso: 0.4 }, { codigo: "2", texto: "60 años", peso: 0.6 }] },
    { clave: "pasado", rotulo: "Pasado", niveles: [{ codigo: "1", texto: "fue militar" }, { codigo: "2", texto: "fue empresario" }] },
    { clave: "partido", rotulo: "Partido", niveles: [{ codigo: "1", texto: "Es independiente." }, { codigo: "2", texto: "Es del partido de gobierno." }], soloSi: { atributo: "pasado", noEs: ["1"] } },
  ],
});

const nombresAjenos: NombresVinetas = {
  azar: (v, c) => `esc${v}_r_${c}`,
  nivel: (v, c) => `esc${v}_${c}`,
  texto: (v, c) => `esc${v}_${c}_txt`,
  grupo: (v) => `escenario${v}`,
  nota: (v) => `E${v}_texto`,
  calificacion: (v) => `E${v}`,
  lista: "probabilidad",
  intro: "E_intro",
};

const COLS = ["type", "name", "label", "calculation", "appearance", "required"];
function formulario(d: DisenoVinetas, nombres?: NombresVinetas): XlsformEditorWorkbook {
  const wb: XlsformEditorWorkbook = { survey: makeSheet("survey", COLS), choices: makeSheet("choices", ["list_name", "name", "label"]), settings: makeSheet("settings", []) };
  const { survey, choices } = generarVinetas(d, nombres);
  insertRecord(wb.survey, 0, { type: "integer", name: "edad_resp", label: "Edad" });
  survey.forEach((f, i) => insertRecord(wb.survey, i + 1, { ...f }));
  insertRecord(wb.survey, wb.survey.rows.length, { type: "note", name: "despues", label: `Gracias. Última: \${${(nombres ?? nombresVinetasDelEditor("vi")).texto(d.vinetas, "edad")}}` });
  choices.forEach((c, i) => insertRecord(wb.choices, i, { ...c }));
  return wb;
}
const nombres = (wb: XlsformEditorWorkbook) => wb.survey.rows.map((_, i) => rowToRecord(wb.survey, i).name);

describe("diseño de viñetas", () => {
  it("el texto usa cada atributo y sólo atributos", () => {
    expect(validarVinetas(diseno())).toEqual([]);
    expect(validarVinetas({ ...diseno(), texto: "Un candidato de {edad}. {otro}" }).join(" ")).toMatch(/no usa «Pasado».*\{otro\}/);
  });

  it("cada viñeta es una página con su sorteo, su escenario y la escala con los extremos rotulados", () => {
    const { survey, choices } = generarVinetas(diseno());
    const n = survey.map((f) => f.name);
    expect(n.slice(0, 3)).toEqual(["vi_intro", "vi_vineta1", "vi_v1_edad_r"]);
    expect(survey.find((f) => f.name === "vi_v1_texto")!.label).toBe("Un candidato de ${vi_v1_edad_txt} que ${vi_v1_pasado_txt}. ${vi_v1_partido_txt}");
    expect(survey.find((f) => f.name === "vi_v2_calificacion")).toMatchObject({ type: "select_one vi_escala", appearance: "likert", required: "yes" });
    expect(choices.map((c) => c.label)).toEqual(["0 Nada probable", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10 Muy probable"]);
  });
});

describe("leer viñetas ya escritas", () => {
  it("las del editor: diseño completo, con pesos, condición, escala e introducción, y editables", () => {
    const l = leerVinetas(formulario(diseno()))!;
    expect(l.fiel).toBe(true);
    expect(l.diseno.texto).toBe(diseno().texto);
    expect(l.diseno.atributos.map(({ clave, niveles, soloSi }) => ({ clave, niveles, soloSi }))).toEqual(diseno().atributos.map(({ clave, niveles, soloSi }) => ({ clave, niveles, soloSi })));
    expect(l.diseno.escala).toEqual(diseno().escala);
    expect(l.diseno.intro).toBe("Le leeré algunas situaciones.");
    expect(l.sorteo.size).toBe(3 * 3 * 3);
    expect(leerConjoint(formulario(diseno()))).toBeNull();
  });

  it("escritas fuera, con otros nombres, también; y una sola viñeta", () => {
    const l = leerVinetas(formulario(diseno(), nombresAjenos))!;
    expect(l.fiel).toBe(true);
    expect(l.nombres.azar(5, "x")).toBe("esc5_r_x");
    expect(l.nombres.calificacion(4)).toBe("E4");
    expect(leerVinetas(formulario(diseno(1)))!.fiel).toBe(true);
  });
});

describe("reemplazar viñetas", () => {
  it("conserva los nombres y la escala no se duplica", () => {
    const wb = formulario(diseno(), nombresAjenos);
    const r = reemplazarVinetas(wb, leerVinetas(wb)!, { ...diseno(), pregunta: "¿Votaría por él?", escala: { ...diseno().escala, max: 4 } });
    expect(r.ok).toBe(true);
    expect(nombres(wb)[0]).toBe("edad_resp");
    expect(nombres(wb)[1]).toBe("E_intro");
    expect(rowToRecord(wb.survey, nombres(wb).indexOf("E2")).label).toBe("¿Votaría por él?");
    expect(wb.choices.rows.filter((_, i) => rowToRecord(wb.choices, i).list_name === "probabilidad").map((_, i) => i)).toHaveLength(5);
  });

  it("no quita una viñeta cuyo sorteo usa otra pregunta", () => {
    const wb = formulario(diseno(), nombresAjenos);
    const r = reemplazarVinetas(wb, leerVinetas(wb)!, { ...diseno(), vinetas: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivos[0]).toContain("despues");
  });
});
