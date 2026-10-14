import { describe, expect, test } from "vitest";
import { panelAbiertoEn } from "../../../lib/navegacion/paneles";
import { PANELES_POR_MODULO } from "../../../lib/navegacion/manifiesto";
import type { CampanaVistaPrevia } from "../../../api/xlsformCampanas";
import {
  PANEL_CAMPANA_COMPLEMENTARIA,
  admiteCampana,
  agruparPorSeccion,
  leerVistaPrevia,
  preguntaMadre,
  motivoNoElegible,
  resumenCampanas,
  searchAbrirCampana,
  searchCerrarCampana,
  textoCobertura,
} from "./campanaComplementariaModel";
import { leerIdEncuesta } from "./surveyMonkeySurveySearch";

const VISTA: CampanaVistaPrevia = {
  survey_id: "423593924",
  titulo: "Estudiantes por correo",
  n_emparejadas: 73,
  n_preguntas_base: 74,
  cobertura: 0.986,
  cobertura_texto: "98.6 %",
  instrumento_distinto: false,
  faltan: [{ variable: "p4", etiqueta: "¿Cuál es su código PUCP?" }],
  extra: [],
  ambiguas: [],
};

describe("campaña complementaria: quién la admite", () => {
  test("sólo un formulario traducido de SurveyMonkey con su ID", () => {
    expect(admiteCampana({ kind: "surveymonkey", original_name: "X", survey_id: "528294775" })).toBe(true);
    expect(admiteCampana({ kind: "surveymonkey", original_name: "X" })).toBe(false);
    expect(admiteCampana({ kind: "surveymonkey", original_name: "X", survey_id: "  " })).toBe(false);
    expect(admiteCampana({ kind: "xlsform", original_name: "X", survey_id: "528294775" })).toBe(false);
    expect(admiteCampana(null)).toBe(false);
  });

  test("resume cuántas campañas tiene", () => {
    expect(resumenCampanas(1)).toBe("Principal + 1 campaña");
    expect(resumenCampanas(3)).toBe("Principal + 3 campañas");
  });

  test("no deja elegir la principal ni una ya declarada", () => {
    expect(motivoNoElegible("528294775", "528294775", [])).toBe("Es la encuesta principal");
    expect(motivoNoElegible("423593924", "528294775", ["423593924"])).toBe("Ya está declarada");
    expect(motivoNoElegible("423593924", "528294775", [])).toBeNull();
  });
});

describe("lectura de la vista previa", () => {
  test("calza con una diferencia: veredicto de alerta y tres contadores", () => {
    const lectura = leerVistaPrevia(VISTA);
    expect(lectura.estado).toBe("con_diferencias");
    expect(lectura.tono).toBe("warning");
    expect(lectura.calce).toBe("73 de 74 campos calzan");
    expect(lectura.cobertura).toBe("98.6 %");
    expect(lectura.porcentaje).toBe(98.6);
    expect(lectura.puedeDeclarar).toBe(true);
    expect(lectura.bloqueo).toBeNull();
    expect(lectura.contadores.map((c) => [c.id, c.n])).toEqual([["faltan", 1], ["extra", 0], ["ambiguas", 0]]);
    expect(lectura.contadores[0].abiertoPorDefecto).toBe(true);
  });

  test("sin diferencias: completa", () => {
    const lectura = leerVistaPrevia({ ...VISTA, faltan: [] });
    expect(lectura.estado).toBe("completa");
    expect(lectura.tono).toBe("success");
  });

  test("más de cinco arranca plegado", () => {
    const faltan = Array.from({ length: 6 }, (_, i) => ({ variable: `p${i}`, etiqueta: "x" }));
    expect(leerVistaPrevia({ ...VISTA, faltan }).contadores[0].abiertoPorDefecto).toBe(false);
  });

  test("el texto del servidor ya trae el signo y se usa tal cual", () => {
    expect(textoCobertura(0.986, "98.6 %")).toBe("98.6 %");
    expect(textoCobertura(null, "")).toBe("");
  });

  test("instrumento distinto bloquea con la salida del ADR y deja todo plegado", () => {
    const lectura = leerVistaPrevia({ ...VISTA, instrumento_distinto: true, n_emparejadas: 30, cobertura: 0.4, cobertura_texto: "40.5 %" });
    expect(lectura.estado).toBe("bloqueada");
    expect(lectura.tono).toBe("danger");
    expect(lectura.puedeDeclarar).toBe(false);
    expect(lectura.bloqueo).toMatch(/formulario propio/);
    expect(lectura.bloqueo).toMatch(/Equivalencias/);
    expect(lectura.contadores.every((c) => !c.abiertoPorDefecto)).toBe(true);
  });
});

describe("agrupación por sección", () => {
  test("las filas de una matriz van juntas; las sueltas consecutivas, en una tanda sin título", () => {
    const secciones = agruparPorSeccion([
      { variable: "p4", etiqueta: "a" },
      { variable: "p5", etiqueta: "b" },
      { variable: "p12_2", etiqueta: "c" },
      { variable: "p12_6", etiqueta: "d" },
      { variable: "p12_other", etiqueta: "e" },
      { variable: "p19", etiqueta: "f" },
    ]);
    expect(secciones.map((s) => [s.titulo, s.preguntas.length])).toEqual([
      [null, 2],
      ["Batería p12", 3],
      [null, 1],
    ]);
  });

  test("la madre de una variable", () => {
    expect(preguntaMadre("p13_1")).toBe("p13");
    expect(preguntaMadre("p4_other")).toBe("p4");
    expect(preguntaMadre("edad")).toBe("edad");
  });
});

describe("dirección del diálogo", () => {
  test("abre con panel y foco, y cierra sin dejar ninguno", () => {
    const abierto = searchAbrirCampana("?x=1", "form-7");
    expect(panelAbiertoEn(abierto, PANEL_CAMPANA_COMPLEMENTARIA)).toBe(true);
    expect(new URLSearchParams(abierto).get("foco")).toBe("form-7");
    const cerrado = searchCerrarCampana(abierto);
    expect(cerrado).toBe("?x=1");
  });

  test("el panel está declarado en el manifiesto del módulo", () => {
    expect(PANELES_POR_MODULO["editor-xlsform"]).toContain(PANEL_CAMPANA_COMPLEMENTARIA);
  });
});

describe("ID de SurveyMonkey pegado", () => {
  test("acepta el número o un enlace de la encuesta", () => {
    expect(leerIdEncuesta(" 423593924 ")).toEqual({ ok: true, id: "423593924" });
    expect(leerIdEncuesta("https://www.surveymonkey.com/analyze/423593924?x=1")).toEqual({ ok: true, id: "423593924" });
    expect(leerIdEncuesta("https://www.surveymonkey.com/r/abc")).toEqual({ ok: false, motivo: "enlace_sin_id" });
    expect(leerIdEncuesta("")).toEqual({ ok: false, motivo: "vacio" });
  });
});
