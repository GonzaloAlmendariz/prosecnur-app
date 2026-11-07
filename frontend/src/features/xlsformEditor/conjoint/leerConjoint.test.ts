// Mata: no reconocer un experimento escrito fuera del editor (otros nombres, el sorteo suelto al inicio y los pares
// dentro de una sección), perder pesos o condiciones al leerlo, declarar editable uno que no se regenera igual, y un
// reemplazo que renombra las variables, deja la sección vacía, duplica la lista o borra una variable que otra pregunta
// usa.
import { describe, expect, it } from "vitest";
import { insertRecord, makeSheet, rowToRecord } from "../parsing/sheetUtils";
import type { XlsformEditorWorkbook } from "../types";
import { reemplazarConjoint } from "./insertarConjoint";
import { leerConjoint } from "./leerConjoint";
import { generarConjoint, nombresDelEditor, type DisenoConjoint, type NombresConjoint } from "./modeloConjoint";

const diseno = (tareas = 3): DisenoConjoint => ({
  prefijo: "cj",
  tareas,
  rotulosPerfil: ["Persona A", "Persona B"],
  pregunta: "¿A cuál preferiría?",
  intro: "Le mostraré dos personas.",
  ordenAleatorio: false,
  atributos: [
    { clave: "curso", rotulo: "Curso", niveles: [{ codigo: "no", texto: "Ninguno", peso: 0.5 }, { codigo: "pe", texto: "Perú", peso: 0.3 }, { codigo: "us", texto: "EE. UU.", peso: 0.2 }] },
    { clave: "enfoque", rotulo: "Enfoque", niveles: [{ codigo: "t", texto: "Territorio" }, { codigo: "i", texto: "Insurgencia" }], soloSi: { atributo: "curso", noEs: ["no"] } },
    { clave: "edad", rotulo: "Edad", niveles: [{ codigo: "42", texto: "42" }, { codigo: "52", texto: "52" }, { codigo: "62", texto: "62" }] },
  ],
});

// Los nombres del XLSForm del v5: sin prefijo, el número al azar con «_r_» en medio.
const nombresV5: NombresConjoint = {
  azar: (t, p, c) => `t${t}${p}_r_${c}`,
  nivel: (t, p, c) => `t${t}${p}_${c}`,
  texto: (t, p, c) => `t${t}${p}_${c}_txt`,
  grupo: (t) => `tarea${t}`,
  tabla: (t) => `t${t}_tabla`,
  eleccion: (t) => `B1_t${t}`,
  lista: "ab",
  intro: "B_intro",
};

const COLS = ["type", "name", "label", "calculation", "appearance", "required"];

/** Un formulario con el experimento; `aLaV5`: sorteo suelto al inicio y pares dentro de «Sección B». */
function formulario(d: DisenoConjoint, nombres: NombresConjoint, aLaV5: boolean): XlsformEditorWorkbook {
  const wb: XlsformEditorWorkbook = {
    survey: makeSheet("survey", COLS),
    choices: makeSheet("choices", ["list_name", "name", "label"]),
    settings: makeSheet("settings", []),
  };
  const { survey, choices } = generarConjoint(d, nombres);
  const filas = aLaV5
    ? [
        ...survey.filter((f) => f.type === "calculate"),
        { type: "integer", name: "edad_resp", label: "Edad", calculation: "", appearance: "", required: "" },
        { type: "begin_group", name: "secB", label: "Sección B", calculation: "", appearance: "", required: "" },
        ...survey.filter((f) => f.type !== "calculate"),
        { type: "end_group", name: "", label: "", calculation: "", appearance: "", required: "" },
        { type: "note", name: "D_perfil", label: `Persona del último par: \${${nombres.texto(d.tareas, "A", "edad")}}`, calculation: "", appearance: "", required: "" },
      ]
    : [{ type: "integer", name: "edad_resp", label: "Edad", calculation: "", appearance: "", required: "" }, ...survey];
  filas.forEach((f, i) => insertRecord(wb.survey, i, { ...f }));
  choices.forEach((c, i) => insertRecord(wb.choices, i, { ...c }));
  insertRecord(wb.choices, wb.choices.rows.length, { list_name: "otra", name: "1", label: "Sí" });
  return wb;
}

const nombres = (wb: XlsformEditorWorkbook) => wb.survey.rows.map((_, i) => rowToRecord(wb.survey, i).name);

describe("leer un experimento de elección por pares", () => {
  it("el que genera el editor: diseño completo, con pesos y condición, y editable", () => {
    const l = leerConjoint(formulario(diseno(), nombresDelEditor("cj"), false))!;
    expect(l.fiel).toBe(true);
    expect(l.diseno).toEqual(diseno());
    expect(l.pares.map((p) => p.tarea)).toEqual([1, 2, 3]);
    expect(l.sorteo.size).toBe(3 * 2 * 3 * 3);
    expect(l.nombres.azar(5, "B", "nuevo")).toBe("cj_t5B_nuevo_r");
  });

  it("el del v5: otros nombres, sorteo suelto al inicio y pares dentro de una sección", () => {
    const l = leerConjoint(formulario(diseno(), nombresV5, true))!;
    expect(l.fiel).toBe(true);
    expect(l.diseno.atributos).toEqual(diseno().atributos);
    expect(l.diseno.intro).toBe("Le mostraré dos personas.");
    expect(l.nombres.azar(4, "B", "x")).toBe("t4B_r_x");
    expect(l.nombres.texto(2, "A", "edad")).toBe("t2A_edad_txt");
    expect(l.nombres.eleccion(7)).toBe("B1_t7");
    expect(l.nombres.lista).toBe("ab");
    expect([...new Set(l.sorteo.values())]).toEqual([1, 2, 3]);
  });

  it("un solo par también se lee", () => {
    const l = leerConjoint(formulario(diseno(1), nombresV5, false))!;
    expect(l.fiel).toBe(true);
    expect(l.nombres.grupo(2)).toBe("tarea2");
  });

  it("si algo no está escrito como lo escribe el editor, se reconoce pero no se edita", () => {
    const wb = formulario(diseno(), nombresV5, false);
    const i = nombres(wb).indexOf("tarea2");
    wb.survey.rows[i]![COLS.indexOf("label")] = "Segundo par";
    const l = leerConjoint(wb)!;
    expect(l.fiel).toBe(false);
    expect(l.motivo).toContain("tarea2");
    expect(l.sorteo.size).toBe(54);
  });

  it("un formulario sin experimento no devuelve nada", () => {
    const wb = formulario(diseno(), nombresV5, false);
    expect(leerConjoint({ ...wb, survey: makeSheet("survey", COLS) })).toBeNull();
  });
});

describe("reemplazar el experimento con el diseño editado", () => {
  it("conserva los nombres, recoge el sorteo dentro de cada par y no duplica la lista", () => {
    const wb = formulario(diseno(), nombresV5, true);
    const l = leerConjoint(wb)!;
    const d = { ...l.diseno, pregunta: "¿Cuál nombraría?" };
    const r = reemplazarConjoint(wb, l, d);
    expect(r.ok).toBe(true);
    const n = nombres(wb);
    expect(n[0]).toBe("edad_resp");
    expect(n[1]).toBe("secB");
    expect(n[2]).toBe("B_intro");
    expect(n[3]).toBe("tarea1");
    expect(n[4]).toBe("t1A_r_curso");
    expect(n.indexOf("t2A_r_curso")).toBeGreaterThan(n.indexOf("tarea2"));
    expect(n.indexOf("D_perfil")).toBeGreaterThan(n.indexOf("tarea3"));
    expect(wb.choices.rows.filter((_, i) => rowToRecord(wb.choices, i).list_name === "ab")).toHaveLength(2);
    expect(rowToRecord(wb.survey, n.indexOf("B1_t1")).label).toBe("¿Cuál nombraría?");
    const otra = leerConjoint(wb)!;
    expect(otra.fiel).toBe(true);
    expect(otra.diseno.pregunta).toBe("¿Cuál nombraría?");
  });

  it("no quita un par cuyo sorteo usa otra pregunta", () => {
    const wb = formulario(diseno(), nombresV5, true);
    const antes = wb.survey.rows.length;
    const r = reemplazarConjoint(wb, leerConjoint(wb)!, { ...diseno(), tareas: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivos[0]).toContain("D_perfil");
    expect(wb.survey.rows.length).toBe(antes);
  });
});
