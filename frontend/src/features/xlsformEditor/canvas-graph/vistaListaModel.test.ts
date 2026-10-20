import { describe, expect, test } from "vitest";
import { parseBuilderStructure } from "../parsing/buildIndex";
import { alcanceDelMapa } from "./lecturaMapa";
import { leerFormaLogica, searchConFormaLogica } from "./formaLogica";
import { vistaListaLogica } from "./vistaListaModel";

const D = "$";
const survey = {
  columns: ["type", "name", "label", "relevant", "choice_filter"],
  rows: [
    ["select_one yn", "trabaja", "¿Trabaja?", "", ""],
    ["begin_group", "g_empleo", "Empleo", `${D}{trabaja} = 'si'`, ""],
    ["text", "sector", "Sector", "", ""],
    ["integer", "horas", "Horas", `${D}{sector} != ''`, ""],
    ["end_group", "", "", "", ""],
    ["begin_group", "g_cierre", "Cierre", "", ""],
    ["note", "fin", "Gracias", "", ""],
    ["end_group", "", "", "", ""],
  ],
};

describe("vista de lista de la lógica", () => {
  const structure = parseBuilderStructure(survey);
  const vista = vistaListaLogica(structure, alcanceDelMapa(structure, []));

  test("agrupa en orden del formulario y deja fuera las secciones sin lógica", () => {
    expect(vista.grupos.map((g) => `${g.letra}:${g.nombre}`)).toEqual(["A:Empleo"]);
    expect(vista.sinLogica).toBe(1);
    expect(vista.total).toBe(2);
  });

  test("cada fila lleva la lectura del motor y de qué depende", () => {
    const empleo = vista.grupos[0]!;
    expect(empleo.regla?.depende).toEqual(["¿Trabaja?"]);
    const horas = empleo.filas[0]!;
    expect(horas.name).toBe("horas");
    expect(horas.lecturas).toHaveLength(1);
    expect(horas.lecturas[0]!.tipo).toBe("aparece");
    expect(horas.lecturas[0]!.texto).not.toContain("${");
    expect(horas.lecturas[0]!.depende).toEqual(["Sector"]);
  });
});

describe("forma de la pestaña Lógica en la dirección", () => {
  test("lista se escribe, mapa es el valor por defecto y no se escribe", () => {
    expect(leerFormaLogica("?pestana=logica&forma=lista")).toBe("lista");
    expect(leerFormaLogica("?pestana=logica")).toBe("mapa");
    expect(searchConFormaLogica("?pestana=logica&form_id=x", "lista")).toBe("?pestana=logica&form_id=x&forma=lista");
    expect(searchConFormaLogica("?pestana=logica&forma=lista", "mapa")).toBe("?pestana=logica");
  });
});
