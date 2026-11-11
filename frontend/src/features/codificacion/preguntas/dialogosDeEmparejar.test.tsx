// @vitest-environment happy-dom
// Emparejar sin arrastrar: el selector de la otra pregunta y el diálogo que solo se abre cuando no se
// sabe cuál de las dos recibe los códigos. Se montan de verdad para leer lo que ve y oye el usuario.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { RelationDialog } from "../RelationDialog";
import { candidatasQueCoinciden, SelectorDePareja } from "./SelectorDePareja";
import { pregunta } from "./unidadesDePrueba";

let host: HTMLDivElement;
let root: Root;
let avisos: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  avisos = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  avisos.mockRestore();
});

const dialogo = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const boton = (texto: string) => Array.from(document.body.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.trim() === texto);

/** Vocabulario que la pestaña ya no usa: el del motor y el del diálogo anterior. */
const JERGA = /Relacionar|relación|Hija|Padre|\bTXT\b|\bSM\b|\bSO\b|\bINT\b|Paso \d|dummy|…|\.\.\./;

function conDescripcion() {
  const d = dialogo();
  const id = d?.getAttribute("aria-describedby") ?? "";
  expect(id, "aria-describedby").not.toBe("");
  expect(document.getElementById(id)?.textContent?.trim().length ?? 0, "descripción").toBeGreaterThan(10);
  expect(avisos.mock.calls.flat().join(" ")).not.toContain("Missing `Description`");
}

const cerrada = pregunta("p10", "select_one", { parent_label: "Sector de la empresa" });
const texto = pregunta("p10_otro", "text", { parent_label: "Otro sector, especifique", col_efectiva: "p10_otro" });
const multiple = pregunta("D1", "select_multiple", { parent_label: "¿Dónde vio los mensajes?", section_label: "Opinión" });

describe("selector de la otra pregunta", () => {
  test('se titula "Emparejar pregunta", sin jerga ni puntos suspensivos, y lleva descripción accesible', () => {
    act(() => root.render(<SelectorDePareja origen={texto} candidatas={[cerrada, multiple]} onElegir={() => undefined} onCancelar={() => undefined} />));
    expect(dialogo()?.querySelector("h2")?.textContent).toBe("Emparejar pregunta");
    expect(dialogo()?.textContent ?? "").not.toMatch(JERGA);
    conDescripcion();
  });

  test("lista las candidatas con su tipo en palabras y elegir una la devuelve", () => {
    const onElegir = vi.fn();
    act(() => root.render(<SelectorDePareja origen={texto} candidatas={[cerrada, multiple]} onElegir={onElegir} onCancelar={() => undefined} />));
    const opciones = Array.from(document.body.querySelectorAll<HTMLButtonElement>(".pulso-preg-selector-opcion"));
    expect(opciones.map((o) => o.textContent)).toEqual(["p10Sector de la empresaÚnicaDatos generales", "D1¿Dónde vio los mensajes?MúltipleOpinión"]);
    act(() => opciones[1].click());
    expect(onElegir).toHaveBeenCalledWith(multiple);
  });

  test("la búsqueda mira código, etiqueta y sección; sin candidatas lo dice", () => {
    expect(candidatasQueCoinciden([cerrada, multiple], "opini").map((c) => c.parent)).toEqual(["D1"]);
    expect(candidatasQueCoinciden([cerrada, multiple], "P10").map((c) => c.parent)).toEqual(["p10"]);
    expect(candidatasQueCoinciden([cerrada, multiple], "  ").length).toBe(2);
    act(() => root.render(<SelectorDePareja origen={texto} candidatas={[]} onElegir={() => undefined} onCancelar={() => undefined} />));
    expect(dialogo()?.textContent).toContain("Sin preguntas sueltas para emparejar");
  });
});

describe("diálogo de cuál recibe los códigos", () => {
  test('habla con las palabras de la pantalla: "Emparejar", quién recibe los códigos y quién aporta, sin jerga ni pasos', () => {
    act(() => root.render(<RelationDialog source={cerrada} target={texto} onConfirm={() => undefined} onCancel={() => undefined} />));
    const visto = dialogo()?.textContent ?? "";
    expect(dialogo()?.querySelector("h2")?.textContent).toBe("Emparejar preguntas");
    expect(visto).toContain("Recibe los códigos");
    expect(visto).toContain("Aporta las respuestas");
    expect(boton("Emparejar")).toBeDefined();
    expect(visto).not.toMatch(JERGA);
    expect(dialogo()?.querySelector(".pulso-section-eyebrow")).toBeNull();
    conDescripcion();
  });

  const radios = () => Array.from(document.body.querySelectorAll<HTMLInputElement>('[role="radiogroup"] input[type="radio"]'));
  const primeraOpcion = () => document.body.querySelector('[role="radiogroup"] label')?.textContent ?? "";

  test("pregunta una sola cosa: dos opciones excluyentes, sin más campos", () => {
    act(() => root.render(<RelationDialog source={cerrada} target={texto} onConfirm={() => undefined} onCancel={() => undefined} />));
    expect(radios().map((r) => r.checked)).toEqual([true, false]);
    expect(document.body.querySelectorAll('[role="dialog"] input:not([type="radio"])').length).toBe(0);
  });

  test("si solo una es cerrada, por defecto recibe la cerrada, se arrastre en el sentido que se arrastre", () => {
    // La única arrastrada sobre su texto: es el caso en que antes recibía el texto y la pareja no se veía.
    act(() => root.render(<RelationDialog source={cerrada} target={texto} onConfirm={() => undefined} onCancel={() => undefined} />));
    expect(primeraOpcion()).toBe("Recibe los códigosp10Sector de la empresaAporta las respuestasp10_otroOtro sector, especifique");
    act(() => root.unmount());
    root = createRoot(host);
    act(() => root.render(<RelationDialog source={texto} target={cerrada} onConfirm={() => undefined} onCancel={() => undefined} />));
    expect(radios().map((r) => r.checked)).toEqual([true, false]);
    expect(primeraOpcion()).toBe("Recibe los códigosp10Sector de la empresaAporta las respuestasp10_otroOtro sector, especifique");
  });

  test("entre dos del mismo tipo recibe por defecto la de destino", () => {
    const otro = pregunta("p9", "text", { parent_label: "Ocupación principal", col_efectiva: "p9" });
    const onConfirm = vi.fn();
    act(() => root.render(<RelationDialog source={texto} target={otro} onConfirm={onConfirm} onCancel={() => undefined} />));
    act(() => boton("Emparejar")?.click());
    expect(onConfirm).toHaveBeenLastCalledWith({ parent: "p9", child_col: "p10_otro" });
  });

  test("emparejar envía quien recibe, la columna de quien aporta y, si recibe una de opción única, su modo por defecto", () => {
    const onConfirm = vi.fn();
    act(() => root.render(<RelationDialog source={cerrada} target={texto} onConfirm={onConfirm} onCancel={() => undefined} />));
    act(() => boton("Emparejar")?.click());
    expect(onConfirm).toHaveBeenLastCalledWith({ parent: "p10", child_col: "p10_otro", modo_so: "padre" });
    act(() => radios()[1].click());
    act(() => boton("Emparejar")?.click());
    // Recibe el texto: no es de opción única, así que no lleva modo.
    expect(onConfirm).toHaveBeenLastCalledWith({ parent: "p10_otro", child_col: "p10" });
  });

  test("si se elige que reciba el texto, avisa de la consecuencia: se codifica con las respuestas de la otra", () => {
    act(() => root.render(<RelationDialog source={cerrada} target={texto} onConfirm={() => undefined} onCancel={() => undefined} />));
    expect(document.body.querySelector('[role="note"]')).toBeNull();
    act(() => radios()[1].click());
    expect(document.body.querySelector('[role="note"]')?.textContent).toBe(
      "p10_otro es una pregunta de texto: si recibe los códigos, se codifica con las respuestas de p10 y deja de leerse su propio texto.",
    );
  });
});

describe("las dos vías de emparejar pasan por el mismo sitio", () => {
  // Con happy-dom, `URL` es la del navegador simulado: las rutas se arman con `path`.
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const fuente = fs.readFileSync(path.join(aqui, "usePreguntasCodificacion.ts"), "utf8");
  const cuerpo = (nombre: string) => {
    const inicio = fuente.indexOf(`${nombre}: (`);
    expect(inicio, nombre).toBeGreaterThan(-1);
    return fuente.slice(inicio, fuente.indexOf("},", inicio));
  };

  test("elegir en el selector hace lo mismo que soltar: no abre por su cuenta el diálogo de quién recibe los códigos", () => {
    expect(cuerpo("elegirPareja")).toMatch(/soltar\(origen\.parent, target\.parent\)/);
    expect(cuerpo("elegirPareja")).not.toContain("setRelacion");
  });

  test("la pestaña monta su selector, no el de \"Relacionar con\"", () => {
    const landing = fs.readFileSync(path.join(aqui, "..", "PreguntasLanding.tsx"), "utf8");
    expect(landing).toContain("<SelectorDePareja");
    expect(landing).not.toContain("RelationTargetDialog");
  });
});
