// =============================================================================
// Contrato del ítem 50: un clic dentro de una pestaña del editor nunca saca de
// la pestaña. Ir al Constructor es SIEMPRE «Editar en Constructor»
// (`data-accion="editar-en-constructor"`), y las pestañas no tienen «Cerrar».
//
// Sin DOM en vitest, el contrato se mide así: se graba cada elemento que el
// render crea (mock del runtime JSX), se dispara cada `onClick`/`onKeyDown`/
// `onChange` con un evento falso y se mira quién llamó a la salida al
// Constructor. Todo lo que no sea la acción declarada debe quedarse en casa.
// =============================================================================

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

const registro = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));

vi.mock("react/jsx-runtime", async (importOriginal) => {
  const real = await importOriginal<typeof import("react/jsx-runtime")>();
  const grabar = <F extends (...args: never[]) => unknown>(fn: F) =>
    ((type: unknown, props: Record<string, unknown> | null, ...resto: unknown[]) => {
      if (props && typeof props === "object") registro.props.push(props);
      return (fn as unknown as (...a: unknown[]) => unknown)(type, props, ...resto);
    }) as unknown as F;
  return { ...real, jsx: grabar(real.jsx), jsxs: grabar(real.jsxs) };
});
vi.mock("react/jsx-dev-runtime", async (importOriginal) => {
  const real = await importOriginal<typeof import("react/jsx-dev-runtime")>();
  const original = real.jsxDEV as unknown as (...a: unknown[]) => unknown;
  return {
    ...real,
    jsxDEV: (type: unknown, props: Record<string, unknown> | null, ...resto: unknown[]) => {
      if (props && typeof props === "object") registro.props.push(props);
      return original(type, props, ...resto);
    },
  };
});

import { VistaCuestionario } from "./VistaCuestionario";
import { ChoiceFiltersView } from "../choiceFilters/ChoiceFiltersView";
import { FormSimulator } from "./FormSimulator";
import { FormSummaryView } from "./FormSummaryView";
import { PestanaImpreso } from "../impreso/PestanaImpreso";
import { LogicCanvas } from "../canvas-graph/LogicCanvas";
import { DetalleNodo } from "../canvas-graph/DetalleNodo";
import { buildLogicGraph } from "../canvas-graph/buildGraph";
import { ACCION_EDITAR_EN_CONSTRUCTOR } from "./EditarEnConstructor";
import { CATALOGOS_SIN_SALTO, ESTRUCTURA_SIN_SALTO, WORKBOOK_SIN_SALTO } from "./pestanasSinSalto.fixture";

const HANDLERS = ["onClick", "onKeyDown", "onChange"] as const;
const TECLAS = ["Enter", " ", "Escape"];

function eventoFalso(key: string) {
  return {
    key,
    preventDefault() {},
    stopPropagation() {},
    currentTarget: { querySelector: () => null, open: false, getBoundingClientRect: () => ({ left: 0, top: 0 }) },
    target: { value: "3", checked: true },
    clientX: 0,
    clientY: 0,
  };
}

type Disparo = { accion: string | undefined; texto: string; salio: boolean };

/** Renderiza, dispara todo lo clicable y devuelve, por elemento, si llamó a la salida al Constructor. */
type Espia = Mock<(...args: unknown[]) => void>;
const espia = (): Espia => vi.fn<(...args: unknown[]) => void>();

function dispararTodo(vista: ReactElement, salida: Espia): { html: string; disparos: Disparo[] } {
  registro.props.length = 0;
  const html = renderToStaticMarkup(<MemoryRouter>{vista}</MemoryRouter>);
  const conHandler = registro.props.filter((p) => HANDLERS.some((h) => typeof p[h] === "function"));
  const disparos: Disparo[] = [];
  for (const props of conHandler) {
    salida.mockClear();
    for (const h of HANDLERS) {
      const fn = props[h];
      if (typeof fn !== "function") continue;
      for (const key of h === "onKeyDown" ? TECLAS : ["Enter"]) {
        try {
          (fn as (e: unknown) => void)(eventoFalso(key));
        } catch {
          // Un handler que necesita el DOM real no navega por eso; lo que importa es quién llamó a la salida.
        }
      }
    }
    disparos.push({
      accion: typeof props["data-accion"] === "string" ? (props["data-accion"] as string) : undefined,
      texto: String(props["aria-label"] ?? props.title ?? props.className ?? "?"),
      salio: salida.mock.calls.length > 0,
    });
  }
  return { html, disparos };
}

function fugas(disparos: Disparo[], permitidas: readonly string[] = []): string[] {
  return disparos
    .filter((d) => d.salio && d.accion !== ACCION_EDITAR_EN_CONSTRUCTOR && !permitidas.includes(d.accion ?? ""))
    .map((d) => d.texto);
}

const salidaExplicita = (disparos: Disparo[]) =>
  disparos.filter((d) => d.salio && d.accion === ACCION_EDITAR_EN_CONSTRUCTOR).length;

/** Lo que una pestaña no puede tener: un «Cerrar»/«Volver al editor» que la cierre. */
const CERRAR_PESTANA = /aria-label="Cerrar(?! detalle)[^"]*"|title="Cerrar(?: \(Esc\))?"|Volver al editor/;

let salida: Espia;
let enSitio: Espia;
beforeEach(() => {
  salida = espia();
  enSitio = espia();
});

describe("ningún clic de las pestañas cambia de pestaña salvo «Editar en Constructor»", () => {
  test("Vista del cuestionario: la pregunta abre su ficha; sólo la ficha lleva al Constructor", () => {
    const { html, disparos } = dispararTodo(
      <VistaCuestionario workbook={WORKBOOK_SIN_SALTO} structure={ESTRUCTURA_SIN_SALTO} logicaPendiente={false}
        abierta="p2" onAbrir={enSitio} onEditar={salida} />,
      salida,
    );
    expect(fugas(disparos)).toEqual([]);
    expect(salidaExplicita(disparos)).toBeGreaterThan(0);
    expect(enSitio).toHaveBeenCalled();
    expect(html).toContain("Editar en Constructor");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toMatch(/Aparece[\s\S]*Si P1 es «Sí»/);
    expect(html).toContain("El valor va entre 18 y 99.");
    expect(html).not.toMatch(CERRAR_PESTANA);
  });

  test("Filtros de opciones: la fila elige su detalle; sólo el detalle lleva al Constructor", () => {
    const { html, disparos } = dispararTodo(
      <ChoiceFiltersView open structure={ESTRUCTURA_SIN_SALTO} choicesColumns={WORKBOOK_SIN_SALTO.choices.columns}
        choicesRows={WORKBOOK_SIN_SALTO.choices.rows} seleccionada={null} onSeleccionar={enSitio} onEditar={salida} />,
      salida,
    );
    expect(fugas(disparos)).toEqual([]);
    expect(salidaExplicita(disparos)).toBeGreaterThan(0);
    expect(enSitio).toHaveBeenCalledWith("p4");
    expect(html).toContain('aria-current="true"');
    expect(html).not.toMatch(CERRAR_PESTANA);
  });

  test("Mapa de lógica: el panel del nodo sólo sale con «Editar en Constructor»", () => {
    const grafo = buildLogicGraph(ESTRUCTURA_SIN_SALTO, CATALOGOS_SIN_SALTO);
    const nodo = [...grafo.byId.values()].find((n) => n.name === "p2");
    expect(nodo).toBeDefined();
    const { html, disparos } = dispararTodo(
      <DetalleNodo node={nodo!} graph={grafo} humanize={(e) => e} onElegir={enSitio} onCerrar={() => {}} onEditar={salida} />,
      salida,
    );
    expect(fugas(disparos)).toEqual([]);
    expect(salidaExplicita(disparos)).toBeGreaterThan(0);
    expect(enSitio).toHaveBeenCalled();
    expect(html).toContain("Depende de");
  });

  test("Mapa de lógica embebido: el lienzo no tiene «Cerrar» ni salida al Constructor", () => {
    const { html, disparos } = dispararTodo(
      <LogicCanvas embebido open structure={ESTRUCTURA_SIN_SALTO} catalogs={CATALOGOS_SIN_SALTO} onEditarEnConstructor={salida} />,
      salida,
    );
    expect(fugas(disparos)).toEqual([]);
    expect(html).not.toMatch(CERRAR_PESTANA);
  });

  test("Probar: sin «Cerrar»; el lápiz es «Editar en Constructor»", () => {
    const { html, disparos } = dispararTodo(
      <FormSimulator workbook={WORKBOOK_SIN_SALTO} structure={ESTRUCTURA_SIN_SALTO} onEditRow={salida} />,
      salida,
    );
    expect(fugas(disparos)).toEqual([]);
    expect(salidaExplicita(disparos)).toBeGreaterThan(0);
    expect(html).not.toMatch(CERRAR_PESTANA);
  });

  test("Resumen: la fila se despliega y el tramo resalta; salen sólo «Editar» y «Qué falta»", () => {
    const irImpreso = espia();
    const { html, disparos } = dispararTodo(
      <FormSummaryView workbook={WORKBOOK_SIN_SALTO} structure={ESTRUCTURA_SIN_SALTO} diagnostics={[]}
        onSelectRow={salida} seccionAbierta="s1" onSeccionAbierta={enSitio}
        contexto={{
          formId: "f1", logica: { pendiente: false, externa: null }, escalasRepetidas: 0, conteos: { errores: 0, avisos: 0, correcciones: 0 },
          onAbrirListas: () => {}, onIrAPregunta: salida, onIrImpreso: irImpreso,
        }} />,
      salida,
    );
    // «Qué falta» ya dice adónde lleva: es la otra acción explícita permitida.
    expect(fugas(disparos, ["ir-a-pendiente"])).toEqual([]);
    expect(salidaExplicita(disparos)).toBe(5);
    expect(enSitio).toHaveBeenCalled();
    expect(html).toContain("Edad");
    expect(html).not.toMatch(CERRAR_PESTANA);
  });

  test("Impreso: la fila abre sus ajustes de papel editables; sólo la ficha lleva al Constructor", () => {
    const campo = espia();
    const { html, disparos } = dispararTodo(
      <PestanaImpreso formId="f1" workbook={WORKBOOK_SIN_SALTO} structure={ESTRUCTURA_SIN_SALTO} storageKey={null}
        candidatas={[]} consentimiento={[]} nombrePdf="x.pdf" parte="papel" onParte={enSitio}
        onExportar={() => {}} onIrAPregunta={salida} onCampoPapel={campo} ocupado="" />,
      salida,
    );
    expect(fugas(disparos)).toEqual([]);
    expect(html).toContain("Papel por pregunta (1)");
    expect(html).toContain("Ajustar otra pregunta");
    expect(html).not.toMatch(CERRAR_PESTANA);
  });
});

describe("la página no conecta salidas implícitas", () => {
  const fuente = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "XlsformEditorPage.tsx"), "utf8");
  const inicio = fuente.indexOf('{pestana === "cuestionario" && (');
  const fin = fuente.indexOf("</EditorPestanas>", inicio);
  const pestanas = fuente.slice(inicio, fin);

  test("el bloque de pestañas se encuentra (si cambia de forma, este test lo dice)", () => {
    expect(inicio).toBeGreaterThan(0);
    expect(fin).toBeGreaterThan(inicio);
  });

  test("ninguna pestaña recibe un «Cerrar» que lleve al Constructor", () => {
    expect(pestanas).not.toMatch(/onClose=/);
    expect(pestanas).not.toMatch(/irPestana\("constructor"\)/);
  });

  test("irAPregunta e irAFila sólo llegan por props de edición explícita o de «Qué falta»", () => {
    const usos = [...pestanas.matchAll(/(\w+)(?:=\{|: )(irAPregunta|irAFila)\b/g)].map((m) => m[1]);
    const permitidos = new Set(["onEditar", "onEditarEnConstructor", "onEditRow", "onIrAPregunta", "onSelectRow"]);
    expect(usos.filter((u) => !permitidos.has(u))).toEqual([]);
    expect(usos.length).toBeGreaterThan(0);
  });
});
