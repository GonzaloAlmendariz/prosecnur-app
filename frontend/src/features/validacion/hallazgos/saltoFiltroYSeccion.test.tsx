// @vitest-environment happy-dom
// Ítems 41 y 42 del checklist de Validación usada por un practicante: la
// pregunta filtro de un salto con un código fuera de su lista y el salto de una
// sección, en la tabla de casos, las pautas y la Decisión.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { InstrumentoDrillResult } from "../../../api/validacion";
import { AvisoFiltroFueraDeLista } from "./AvisoFiltroFueraDeLista";
import { filtroFueraDeLista, pautaDelFiltro } from "./filtroFueraDeLista";
import { opcionesDeTratamiento, tablaDeCasos } from "./modeloHallazgos";
import { pautasDelHallazgo } from "./pautasDelHallazgo";
import { lecturaDeSeccion } from "./seccionDelSalto";
import { compactarTabla } from "./vistas/modeloTablaDeCasos";
import { TablaDeCasos } from "./vistas/TablaDeCasos";

const TEXTO_P6 = "p6 vale 77 en los 2 casos, un código que no está en sus opciones; puede ser el de \"Otro motivo\" (4 en el formulario): revisa el formulario antes de corregir respuestas.";

const esperado = (subtipo: string, hecho: string, choque: string) => ({
  anomalia_tipo: "contradiccion", subtipo, sujeto: null, hecho, choque, accion: null, texto: null,
});

/** Salto de p6_1 con p6 = 77 en los dos casos (formulario original de Ser Adolescente). */
const DRILL_P6 = {
  ok: true,
  regla: {
    familia: "salto",
    variable_roles: { target: "p6_1", gate: ["p6"], drivers: ["p6"], compare: [], labels: { p6: "P6. Motivo", p6_1: "P6. Otro motivo (especificar)" } },
    value_labels: { p6: { "1": "Trabajo", "4": "Otro motivo" } },
  },
  uuid_col: null,
  case_ids: ["principal::idx::16", "principal::idx::17"],
  casos: [{ p6: 77, p6_1: "TÍO" }, { p6: 77, p6_1: "MI ABUELA" }],
  esperado: [
    esperado("salto_nodebe", "respondió \"TÍO\" en P6. Otro motivo (especificar)", "que no correspondía porque declaró \"77\" en P6. Motivo"),
    esperado("salto_nodebe", "respondió \"MI ABUELA\" en P6. Otro motivo (especificar)", "que no correspondía porque declaró \"77\" en P6. Motivo"),
  ],
  filtro_fuera_de_lista: [{
    variable: "p6", valores: [{ valor: "77", n: 2 }], n_casos: 2, n_marcados: 2,
    otro: { codigo: "4", etiqueta: "Otro motivo" }, texto: TEXTO_P6,
  }],
} as unknown as InstrumentoDrillResult;

/** Salto de la sección "Familia" con el consentimiento en "No" o vacío. */
const DRILL_SECCION = {
  ok: true,
  regla: {
    familia: "salto",
    variable_roles: { target: "seccion_D", gate: ["consentimiento"], drivers: ["p7_1", "p7_2", "consentimiento"], compare: ["p7_1", "p7_2"], labels: { consentimiento: "Consentimiento" } },
    value_labels: { consentimiento: { "1": "Sí", "2": "No" } },
  },
  uuid_col: null,
  case_ids: ["principal::idx::110", "principal::idx::208"],
  casos: [{ consentimiento: null }, { consentimiento: 2 }],
  esperado: [
    esperado("seccion_nodebe", "respondió 18 de las 20 preguntas de la sección \"Familia\"", "que no correspondía porque dejó vacía Consentimiento"),
    esperado("seccion_nodebe", "respondió las 20 preguntas de la sección \"Familia\"", "que no correspondía porque declaró \"No\" (2) en Consentimiento"),
  ],
  filtro_fuera_de_lista: [],
} as unknown as InstrumentoDrillResult;

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  root = null; host = null;
});
function pintar(nodo: React.ReactNode): HTMLDivElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root?.render(nodo));
  return host;
}

describe("la pregunta filtro con un código fuera de su lista (ítem 41)", () => {
  it("lee el aviso del motor tal cual, con su cifra", () => {
    const f = filtroFueraDeLista(DRILL_P6);
    expect(f).toEqual([{ variable: "p6", valores: ["77"], nCasos: 2, nMarcados: 2, otro: { codigo: "4", etiqueta: "Otro motivo" }, texto: TEXTO_P6 }]);
    expect(filtroFueraDeLista(DRILL_SECCION)).toEqual([]);
    expect(filtroFueraDeLista({ ...DRILL_P6, filtro_fuera_de_lista: undefined } as unknown as InstrumentoDrillResult)).toEqual([]);
  });

  it("las pautas empiezan por revisar el formulario y la opción Dejar dice cuándo corregirlo", () => {
    const p = pautasDelHallazgo({
      vista: "salto", familia: "salto", direccion: "nodebe", subtipo: "salto_nodebe", tipoRegla: "skip", semillaOrigen: null,
      filtroFueraDeLista: filtroFueraDeLista(DRILL_P6),
    });
    expect(p?.revisar[0]).toBe("Revisa primero las opciones de p6 en el formulario: el 77 de los casos no está en su lista. Si es el código de otra opción, corrige el formulario y vuelve a auditar antes de tocar las respuestas.");
    expect(p?.revisar.length).toBeGreaterThan(1);
    expect(p?.situaciones.dejar).toMatch(/corrige el formulario/);
    // Sin código fuera de lista, las pautas de siempre.
    const sin = pautasDelHallazgo({ vista: "salto", familia: "salto", direccion: "nodebe", subtipo: "salto_nodebe", tipoRegla: "skip", semillaOrigen: null });
    expect(sin?.revisar[0]).toMatch(/^Revisa la respuesta que cierra la pregunta/);
    expect(pautaDelFiltro({ ...filtroFueraDeLista(DRILL_P6)[0], valores: ["77", "99"] })).toMatch(/los códigos 77 y 99 de los casos no están/);
  });

  it("en la tabla, el valor fuera de lista lleva su marca y la respuesta abierta no va con el tono del error", () => {
    const t = tablaDeCasos(DRILL_P6, null);
    const p61 = t.columnas.find((c) => c.clave === "p6_1");
    expect(p61).toMatchObject({ tipo: "falla", neutra: true });
    expect(t.filas.map((f) => f.fueraDeLista)).toEqual([["p6"], ["p6"]]);
    const compacta = compactarTabla(t.columnas, t.filas);
    // p6 vale 77 en los dos casos: sube a "Común a los 2 casos" con su marca.
    expect(compacta.comunes.map((c) => [c.clave, c.celda.valor, c.celda.fueraDeLista])).toEqual([["p6", "77", true]]);

    const el = pintar(
      <TablaDeCasos columnas={t.columnas} filas={t.filas} marcados={new Set()} onMarcar={() => undefined}
        onMarcarTodos={() => undefined} onAbrirCaso={() => undefined} tono="inconsistencia" marcable />,
    );
    const comun = el.querySelector(".pulso-hz-comunes dd");
    expect(comun?.textContent).toBe("77Fuera de la lista");
    expect(comun?.getAttribute("data-falla")).toBeNull();
    const cabecera = Array.from(el.querySelectorAll("[role=columnheader]")).find((x) => x.textContent?.includes("Otro motivo"));
    expect(cabecera?.getAttribute("data-falla")).toBeNull();
    const valores = Array.from(el.querySelectorAll(".pulso-hz-tabla-fila [role=cell] .pulso-hz-celda-valor")).filter((x) => /TÍO|ABUELA/.test(x.textContent ?? ""));
    expect(valores).toHaveLength(2);
    for (const v of valores) expect(v.getAttribute("data-falla")).toBeNull();
  });

  it("el aviso va arriba con el texto del motor", () => {
    const el = pintar(<AvisoFiltroFueraDeLista filtros={filtroFueraDeLista(DRILL_P6)} />);
    expect(el.querySelector("[role=note]")?.textContent).toBe(TEXTO_P6);
    const vacio = pintar(<AvisoFiltroFueraDeLista filtros={[]} />);
    expect(vacio.querySelector("[role=note]")).toBeNull();
  });
});

describe("el salto de una sección (ítem 42)", () => {
  it("lee cuántas preguntas respondió cada caso", () => {
    expect(lecturaDeSeccion("respondió 18 de las 20 preguntas de la sección \"Familia\"")).toEqual({ n: 18, k: 20, seccion: "Familia" });
    expect(lecturaDeSeccion("respondió las 20 preguntas de la sección \"Familia\"")).toEqual({ n: 20, k: 20, seccion: "Familia" });
    expect(lecturaDeSeccion("respondió la pregunta de la sección \"A\"")).toEqual({ n: 1, k: 1, seccion: "A" });
    expect(lecturaDeSeccion("respondió \"TÍO\" en P6")).toBeNull();
  });

  it("la tabla lleva la respuesta que abre la sección y las preguntas respondidas, no una columna por pregunta", () => {
    const t = tablaDeCasos(DRILL_SECCION, null);
    expect(t.columnas.map((c) => [c.clave, c.tipo])).toEqual([["consentimiento", "pregunta"], ["seccion:respondidas", "falla"]]);
    const compacta = compactarTabla(t.columnas, t.filas);
    const respondidas = compacta.columnas.find((c) => c.clave === "seccion:respondidas");
    expect(respondidas).toMatchObject({ rotulo: "Preguntas respondidas", detalle: "De 20 en \"Familia\"" });
    expect(t.filas.map((f) => compacta.celdas.get(f.clave)?.["seccion:respondidas"]?.valor)).toEqual(["18 de 20", "Las 20"]);
  });

  it("la Decisión cubre la encuesta: dejar o excluir", () => {
    const o = opcionesDeTratamiento({ vista: "salto", etiquetaPregunta: null, prevista: null, seleccionMultiple: false, fueraDeLista: false, especial: null, seccion: true });
    expect(o.map((x) => x.accion)).toEqual(["ignore_rule", "exclude_cases"]);
    const p = pautasDelHallazgo({ vista: "salto", familia: "salto", direccion: "nodebe", subtipo: "seccion_nodebe", tipoRegla: "skip", semillaOrigen: null });
    expect(p?.tipo).toBe("seccion_sobra");
    expect(Object.keys(p?.situaciones ?? {}).sort()).toEqual(["dejar", "excluir"]);
  });
});
