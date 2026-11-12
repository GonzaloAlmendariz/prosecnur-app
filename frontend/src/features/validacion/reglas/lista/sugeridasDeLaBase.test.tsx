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
