// Defectos vistos en la app (2026-10-20). Mata: la barra espaciadora que «no escribe» en «Pregunta» porque el nodo
// publica el texto recortado y el campo pintaba ese valor; «Crear lista nueva» que sólo escribía el nombre en el
// `type` sin crear la lista; la nota del código larga; y el menú de alta con tipos fuera de su familia.
import { describe, expect, test } from "vitest";
import { buildXlsformIndex } from "../../parsing/buildIndex";
import { getCell, setCell } from "../../parsing/sheetUtils";
import { agruparAlta, familiaDeAlta } from "../../shell/familiasAlta";
import { itemsInsertar } from "../../outline/tiposInsertables";
import type { XlsformEditorWorkbook } from "../../types";
import { crearListaEnPregunta } from "./accionesNuevasFicha";
import { borradorCampo, estadoCodigo, nombreListaNueva, notaReferencias, type BorradorCampo } from "./modeloFicha";

function wb(): XlsformEditorWorkbook {
  return {
    survey: { name: "survey", columns: ["type", "name", "label"], rows: [["select_one", "acepta", "Acepta?"], ["select_one sino", "otra", "Otra"]] },
    choices: { name: "choices", columns: ["list_name", "name", "label"], rows: [["sino", "1", "Sí"]] },
    settings: { name: "settings", columns: [], rows: [] },
  };
}

describe("campo Pregunta: la barra espaciadora escribe", () => {
  test("un espacio tecleado al final sigue en el valor aunque el nodo lo publique recortado", () => {
    const libro = wb();
    let campo: BorradorCampo = borradorCampo({ texto: "Acepta?", enFoco: false }, { tipo: "foco" });
    for (const texto of ["Acepta? ", "Acepta? s", "Acepta? sí"]) {
      campo = borradorCampo(campo, { tipo: "tecleo", texto });
      setCell(libro.survey, 0, "label", texto);
      // El nodo vuelve recortado en el render siguiente: «Acepta?» sin el espacio.
      const node = buildXlsformIndex(libro).structure.outline[0];
      campo = borradorCampo(campo, { tipo: "valor", valor: node.label });
    }
    expect(campo.texto).toBe("Acepta? sí");
    expect(getCell(libro.survey, 0, "label")).toBe("Acepta? sí");
  });
  test("fuera de foco se realinea con el valor del nodo", () => {
    expect(borradorCampo({ texto: "viejo", enFoco: false }, { tipo: "valor", valor: "nuevo" }).texto).toBe("nuevo");
  });
});

describe("Crear lista nueva", () => {
  test("crea la lista en choices con una opción, se la asigna a la pregunta y no choca con otra", () => {
    const libro = wb();
    const nombre = crearListaEnPregunta(libro, 0);
    expect(nombre).toBe("lst_acepta");
    expect(getCell(libro.survey, 0, "type")).toBe("select_one lst_acepta");
    const idx = buildXlsformIndex(libro);
    expect(idx.catalogs.find((c) => c.listName === "lst_acepta")?.items.length).toBe(1);
    // Otra vez sobre la misma pregunta: un nombre nuevo, no el mismo (antes el botón «no hacía nada»).
    expect(crearListaEnPregunta(libro, 0)).toBe("lst_acepta_2");
    expect(nombreListaNueva("9 edad", [])).toBe("lst_l_9_edad");
  });
  test("una pregunta que no es de selección no recibe lista", () => {
    const libro = wb();
    setCell(libro.survey, 0, "type", "text");
    expect(crearListaEnPregunta(libro, 0)).toBeNull();
  });
});

describe("código en la base", () => {
  test("nota corta y estado del borrador", () => {
    expect(notaReferencias(0)).toBe("Nadie usa este código.");
    expect(notaReferencias(1)).toBe("Se actualiza 1 referencia.");
    expect(notaReferencias(3)).toBe("Se actualizan 3 referencias.");
    expect(estadoCodigo("p1", "p1").cambio).toBe(false);
    expect(estadoCodigo("p1_x", "p1").puedeAplicar).toBe(true);
    expect(estadoCodigo("1p", "p1").problema).toMatch(/número/);
  });
});

describe("menú de alta por familias", () => {
  test("cada tipo cae en la familia de su sello y los grupos salen en orden", () => {
    expect(familiaDeAlta("geopoint")).toBe("fecha");
    expect(familiaDeAlta("section")).toBe("estructura");
    expect(familiaDeAlta("note")).toBe("calculo");
    const grupos = agruparAlta(itemsInsertar(() => undefined));
    expect(grupos.map((g) => g.nombre)).toEqual(["Texto y números", "Opciones", "Fecha y lugar", "Multimedia", "Estructura", "Cálculo y nota"]);
    expect(grupos.reduce((n, g) => n + g.items.length, 0)).toBe(itemsInsertar(() => undefined).length);
  });
});
