// @vitest-environment happy-dom
// Planner › Muestra dice quién lee la representatividad declarada: hoy sólo
// Monitoreo de aulas (monitoreo_aulas_representatividad_planner.R).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test } from "vitest";

import { normalizarPlannerEstado } from "../../../api/planner";
import { PlannerMuestra } from "./PlannerMuestra";
import type { ControlPlanner } from "./usePlanner";

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

const rep = { universo: { nivel: "universidad", etiqueta: "Estudiantes de pregrado", poblacion: 18000 }, variables: [{ clave: "facultad", etiqueta: "Facultad" }] };

function control(tipos: string[]): ControlPlanner {
  const estado = normalizarPlannerEstado({
    planner: { perfiles: tipos.map((tipo) => ({ tipo, poblaciones: [{ id: "p", etiqueta: `Población ${tipo}`, representatividad: rep }] })) },
  });
  return { estado, cargando: false, guardando: null, error: null, recargar: async () => {}, declarar: async () => true };
}

test("dice qué módulo lee la representatividad de cada población", () => {
  act(() => root.render(<MemoryRouter><PlannerMuestra control={control(["aulas", "territorial"])} /></MemoryRouter>));
  const tarjeta = (nombre: string) => host.querySelector(`article[aria-label^="${nombre}"]`)?.textContent ?? "";
  expect(tarjeta("Población aulas")).toContain("Monitoreo de aulas, contra las celdas del diseño");
  expect(tarjeta("Población territorial")).toContain("Ningún módulo todavía");
});
