// Riel y panel de marcas por render estático. Mata: casillas fuera de orden o sin nombre accesible, una casilla
// vacía que se pinta como encendida, y un panel que escribe frases propias en vez de las del motor (chips para
// preguntas, «El motor todavía no traduce esta regla» con sus dependencias y el código abierto si es técnica).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { buildXlsformIndex } from "../parsing/buildIndex";
import { rowToRecord } from "../parsing/sheetUtils";
import type { LogicScope } from "../logic";
import type { XlsformEditorWorkbook } from "../types";
import { leerRegla } from "../reglas/leerRegla";
import { CuerpoPanelMarca, PiezasLectura } from "./CuerpoPanelMarca";
import { Riel } from "./Riel";
import { marcasNodo, type CasillaRiel } from "./marcasNodo";

const wb: XlsformEditorWorkbook = {
  survey: {
    name: "survey",
    columns: ["type", "name", "label", "required", "relevant", "constraint", "constraint_message", "calculation", "choice_filter"],
    rows: [
      ["select_one sino", "acepta", "¿Acepta participar en la encuesta de hogares del distrito?", "yes", "", "", "", "", ""],
      ["begin_group", "hogar", "Datos del hogar", "", "${acepta} = '1'", "", "", "", ""],
      ["integer", "edad", "Edad", "${acepta} = '1'", "", "zzfuncion_rara(.)", "", "", ""],
      ["text", "nota", "Nota", "", "", ". != ''", "Escriba algo", "", ""],
      ["end_group", "", "", "", "", "", "", "", ""],
      ["select_one dist", "distrito", "Distrito", "", "", "", "", "", "prov = ${acepta}"],
    ],
  },
  choices: { name: "choices", columns: ["list_name", "name", "label"], rows: [["sino", "1", "Sí"], ["sino", "2", "No"], ["dist", "a", "A"]] },
  settings: { name: "settings", columns: [], rows: [] },
};
const idx = buildXlsformIndex(wb);
const scope: LogicScope = {
  variables: idx.structure.outline
    .filter((n) => n.name && n.kind !== "section" && n.kind !== "repeat")
    .map((n) => ({ rowIndex: n.rowIndex, name: n.name, label: n.label, baseType: n.typeInfo.base, listName: n.typeInfo.listName || undefined })),
  catalogsByListName: new Map(idx.catalogs.map((c) => [c.listName, { listName: c.listName, items: c.items }])),
  allowCurrent: false,
};
const nodo = (name: string) => idx.structure.outline.find((n) => n.name === name)!;
const marcas = (name: string) => marcasNodo(nodo(name), idx.structure, rowToRecord(wb.survey, nodo(name).rowIndex).required);
const panel = (name: string, clave: CasillaRiel) =>
  renderToStaticMarkup(<CuerpoPanelMarca clave={clave} marcas={marcas(name)} nodo={nodo(name)} scope={scope} idTitulo="t" />);

describe("Riel", () => {
  test("cinco casillas en orden fijo, con nombre accesible y sólo las marcadas encendidas", () => {
    const html = renderToStaticMarkup(<Riel nodo={nodo("edad")} marcas={marcas("edad")} scope={scope} />);
    expect([...html.matchAll(/data-casilla="([a-z]+)"/g)].map((m) => m[1])).toEqual(["oblig", "cond", "regla", "calc", "filtro"]);
    expect(html).toContain('role="group"');
    expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(5);
    expect(html).toContain('aria-label="Obligatoria en edad"');
    expect(html).toContain('aria-label="Condición de la sección en edad"');
    expect(html).toContain('aria-label="Cálculo: no en edad"');
    expect(html.match(/xfk-casilla is-on/g)).toHaveLength(3);
    expect(html).toContain('data-marca="hered"');
    expect(html).not.toContain('data-marca="calc"');
  });
});

describe("PanelMarca (contenido)", () => {
  test("obligatoria siempre", () => {
    const html = panel("acepta", "oblig");
    expect(html).toContain("Siempre");
    expect(html).toContain("La encuesta no se puede finalizar sin esta respuesta.");
    expect(html).toContain("required: yes");
    expect(html).toContain('aria-label="Cerrar"');
  });

  test("casilla vacía: rótulo y una línea, sin código", () => {
    const html = panel("acepta", "filtro");
    expect(html).toContain("Sin filtro");
    expect(html).toContain("Muestra todas sus opciones.");
    expect(html).not.toContain("Ver código XLSForm");
    expect(panel("acepta", "cond")).toContain("Aparece siempre");
    expect(panel("acepta", "calc")).toContain("No es un cálculo");
  });

  test("la condición heredada se lee como bloque con el nombre de la sección y la lectura del motor", () => {
    const html = panel("nota", "cond");
    expect(html).toContain("Heredada de la sección «Datos del hogar»");
    const l = leerRegla("relevant", "${acepta} = '1'", nodo("hogar"), scope);
    expect(renderToStaticMarkup(<PiezasLectura piezas={l.piezas} />).length).toBeGreaterThan(0);
    expect(html).toContain("relevant de la sección: ${acepta} = &#x27;1&#x27;");
  });

  test("restricción técnica: lo dice, lista sus dependencias y abre el código", () => {
    const html = panel("edad", "regla");
    const l = leerRegla("constraint", "zzfuncion_rara(.)", nodo("edad"), scope);
    if (l.tecnica) {
      expect(html).toContain("El motor todavía no traduce esta regla.");
      expect(html).toMatch(/<details class="xfk-pop__codigo" open="">/);
    } else {
      expect(html).toContain('<details class="xfk-pop__codigo">');
      expect(html).not.toContain("El motor todavía no traduce esta regla.");
    }
    expect(html).toContain("El formulario no trae mensaje para quien se equivoca.");
  });

  test("restricción con mensaje real del formulario", () => {
    const html = panel("nota", "regla");
    expect(html).toContain("Mensaje del formulario");
    expect(html).toContain("«Escriba algo»");
  });

  test("filtro: lista de opciones y dependencias como chips", () => {
    const html = panel("distrito", "filtro");
    expect(html).toContain("Opciones de la lista");
    expect(html).toContain("<code>dist</code>");
    expect(html).toContain("choice_filter: prov = ${acepta}");
    const l = leerRegla("choice_filter", "prov = ${acepta}", nodo("distrito"), scope);
    if (l.tecnica) {
      expect(html).toContain("Depende de");
      expect(html).toContain("xfk-pop__ref");
      expect(html).toContain("<code>acepta</code>");
    } else {
      expect(html).not.toContain("Depende de");
    }
  });

  test("las piezas de pregunta y opción van como chips con su código; el texto, tal cual", () => {
    const html = renderToStaticMarkup(
      <PiezasLectura
        piezas={[
          { tipo: "pregunta", name: "acepta", etiqueta: "¿Acepta participar en la encuesta de hogares del distrito?" },
          { tipo: "texto", texto: "es" },
          { tipo: "opcion", lista: "sino", valor: "1", etiqueta: "Sí" },
        ]}
      />,
    );
    expect(html).toContain('<span class="xfk-pop__ref" title="¿Acepta participar en la encuesta de hogares del distrito?">¿Acepta participar en la encuesta…<code>acepta</code></span>');
    expect(html).toContain(" es");
    expect(html).toContain("Sí<code>1</code>");
  });
});
