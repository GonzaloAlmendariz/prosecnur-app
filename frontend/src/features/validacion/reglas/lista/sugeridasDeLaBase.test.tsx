// @vitest-environment happy-dom
// Ítem 28: cada sugerida dice cuántos casos marcaría hoy, si el motor lo mide;
// "Añadir" la entrega tal cual para abrirla en el panel de regla.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ReglaSemilla } from "../../types";
import { SugeridasDeLaBase } from "./SugeridasDeLaBase";

// `ReglaCustomTipo` del cliente viejo no nombra "formato"; el panel lo lee como `TipoReglaPropia`.
const FORMATO = {
  tipo: "formato",
  variables: ["ubigeo"],
  params: { modo: "digitos", largo_min: 6, largo_max: 6 },
  nombre: "Ubigeo del distrito (ubigeo) con 6 dígitos",
  mensaje: "La respuesta no tiene 6 dígitos.",
  severidad: "error",
  activa: true,
  semilla: {
    origen: "formulario_digitos",
    porque: "El formulario pide un número de 6 dígitos.",
    n_casos_hoy: 98,
  },
} as unknown as ReglaSemilla;

const SIN_CIFRA: ReglaSemilla = {
  ...FORMATO,
  nombre: "Periodo de campo",
  semilla: { origen: "periodo", porque: "El grueso del campo va del 13 al 30." },
} as unknown as ReglaSemilla;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

// Ítem 40: el motor nombra la pregunta con su enunciado en el título y otra vez en el porqué.
const FUERA_DE_LISTA = {
  tipo: "fuera_catalogo",
  variables: ["p6"],
  params: { valores: ["1", "2"] },
  nombre: "Fuera de la lista de opciones: \u00abMarca SI estás o NO de acuerdo con participar\u00bb (p6)",
  mensaje: "Responde \u00ab77\u00bb, que no está entre las opciones de la pregunta.",
  severidad: "error",
  activa: true,
  semilla: {
    origen: "dominio",
    porque: "\u00abMarca SI estás o NO de acuerdo con participar\u00bb (p6) registra \u00ab77\u00bb, y su lista solo admite: \u00abSí (1)\u00bb, \u00abNo (2)\u00bb. Ninguna regla derivada del instrumento verifica que el valor pertenezca a su catálogo.",
  },
} as unknown as ReglaSemilla;

test("el enunciado de la pregunta sale una sola vez y los valores van como fichas, sin comillas", () => {
  act(() => root.render(<SugeridasDeLaBase semillas={[FUERA_DE_LISTA]} ocupada={false} onAnadir={vi.fn()} />));
  const tarjeta = host.querySelector("li")!;
  const texto = tarjeta.textContent ?? "";
  expect(texto.match(/Marca SI estás o NO de acuerdo con participar/g)).toHaveLength(1);
  expect(texto).not.toMatch(/[\u00ab\u00bb"]/);
  const valores = Array.from(tarjeta.querySelectorAll(".pulso-rl-rec-valor")).map((v) => v.textContent);
  expect(valores).toEqual(["77", "Sí (1)", "No (2)"]);
  expect(tarjeta.querySelector(".pulso-ficha-pregunta")?.textContent).toContain("p6");
});

test("mientras el motor calcula, el bloque muestra su carga; si falla, lo dice", () => {
  act(() => root.render(<SugeridasDeLaBase semillas={undefined} ocupada={false} onAnadir={vi.fn()} />));
  expect(host.querySelector("[role='status']")?.textContent).toContain("Buscando reglas sugeridas en la base");
  expect(host.querySelector("[data-audit-ready='false']")).not.toBeNull();
  act(() => root.render(<SugeridasDeLaBase semillas={null} ocupada={false} onAnadir={vi.fn()} />));
  expect(host.textContent).toContain("No se pudieron leer las reglas sugeridas.");
  expect(host.querySelector("[data-audit-ready]")).toBeNull();
});

test("cada sugerida muestra los casos que marca hoy y Añadir la entrega", () => {
  const onAnadir = vi.fn();
  act(() => root.render(<SugeridasDeLaBase semillas={[FORMATO, SIN_CIFRA]} ocupada={false} onAnadir={onAnadir} />));
  const filas = Array.from(host.querySelectorAll("li"));
  expect(filas[0].textContent).toContain("Casos que marca hoy: 98");
  // Sin cifra medida por el motor no se inventa una.
  expect(filas[1].textContent).not.toContain("Casos que marca hoy");
  act(() => filas[0].querySelector("button")!.click());
  expect(onAnadir).toHaveBeenCalledWith(FORMATO);
});
