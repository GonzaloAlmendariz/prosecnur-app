// @vitest-environment happy-dom
// Render de las piezas nuevas del explorador: el selector de cruce lista todas
// las variables con el gráfico del par (E7), la tabla de calor marca ▲▼ (E9) y
// el panel de datos no inventa reglas (E11).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import CrossBar from "../../../components/CrossBar";
import type { ExploradorSeccion } from "../../../types";
import TablaCalor from "../TablaCalor";
import PanelDatos from "../PanelDatos";
import { modeloCalor } from "../explorarModelo";
import { normalizeExploradorFicha } from "../../../../../api/validacionExplorar";

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
  document.body.innerHTML = "";
});

const SECCIONES: ExploradorSeccion[] = [{
  nombre: "General",
  variables: [
    { name: "sexo", label: "Sexo", tipo: "so", n_validos: 10, n_nulos: 0 },
    { name: "fecha_ent", label: "Fecha de la entrevista", tipo: "fecha", n_validos: 10, n_nulos: 0 },
    { name: "p14_otro", label: "Otra situación", tipo: "texto", n_validos: 1, n_nulos: 9 },
    { name: "edad", label: "Edad", tipo: "num", n_validos: 10, n_nulos: 0 },
  ],
}];

test("el selector de cruce lista fecha y abierta y anticipa el gráfico del par", () => {
  const onChange = vi.fn();
  act(() => root.render(
    <CrossBar secciones={SECCIONES} selfVar="sexo" selfSeccion="General" cruzar={null} onChange={onChange} />,
  ));
  act(() => host.querySelector<HTMLButtonElement>("button[aria-haspopup='dialog']")!.click());
  const panel = document.querySelector<HTMLElement>(".pulso-popover.pulso-crossbar-popover")!;
  const texto = panel.textContent ?? "";
  expect(texto).toContain("fecha_ent");
  expect(texto).toContain("Casos por día, apilados");
  expect(texto).toContain("Respuestas por categoría");
  expect(texto).toContain("Cajas por categoría");
  expect(texto).not.toMatch(/\bsexo\b.*Tabla de calor/);
  // El chip «Abierta» filtra la lista.
  const abierta = Array.from(panel.querySelectorAll<HTMLButtonElement>(".vx-chip")).find((b) => b.querySelector("b")?.textContent === "Abierta")!;
  act(() => abierta.click());
  const opciones = Array.from(panel.querySelectorAll(".crossbar-opcion")).map((b) => b.textContent);
  expect(opciones).toHaveLength(1);
  expect(opciones[0]).toContain("p14_otro");
});

test("con una abierta, sólo las únicas se eligen; las demás quedan atenuadas y el pie dice la limitación", () => {
  const onChange = vi.fn();
  act(() => root.render(
    <CrossBar secciones={SECCIONES} selfVar="p14_otro" selfSeccion="General" cruzar={null} onChange={onChange} />,
  ));
  act(() => host.querySelector<HTMLButtonElement>("button[aria-haspopup='dialog']")!.click());
  const panel = document.querySelector<HTMLElement>(".pulso-popover.pulso-crossbar-popover")!;
  const opciones = Array.from(panel.querySelectorAll<HTMLButtonElement>(".crossbar-opcion"));
  const por = (codigo: string) => opciones.find((b) => b.textContent?.includes(codigo))!;
  expect(por("sexo").disabled).toBe(false);
  expect(por("fecha_ent").disabled).toBe(true);
  expect(por("edad").disabled).toBe(true);
  act(() => por("edad").click());
  expect(onChange).not.toHaveBeenCalled();
  expect(panel.querySelector(".crossbar-limite")?.textContent).toBe("Una abierta se cruza sólo con una pregunta de selección única.");
  expect(panel.textContent).not.toMatch(/codific/i);
});

test("la tabla de calor marca las celdas a 5 puntos del total y deja el Total aparte", () => {
  const modelo = modeloCalor({
    filas: [{ codigo: "1", etiqueta: "Hombre", n: 10 }, { codigo: "2", etiqueta: "Mujer", n: 10 }],
    columnas: [{ codigo: "a", etiqueta: "Ate", n: 10 }, { codigo: "b", etiqueta: "Breña", n: 10 }],
    n: [[7, 3], [3, 7]],
  }, "columna", 20);
  act(() => root.render(<TablaCalor modelo={modelo} rotuloFilas="Sexo" />));
  expect(host.querySelector("[role='table']")).toBeTruthy();
  expect(host.querySelectorAll("[role='columnheader']")).toHaveLength(4);
  expect(host.querySelectorAll(".vx-calor-celda.is-arriba")).toHaveLength(2);
  expect(host.querySelectorAll(".vx-calor-celda.is-abajo")).toHaveLength(2);
  expect(host.querySelectorAll(".vx-calor-celda.is-total")).toHaveLength(2);
  expect(host.textContent).toContain("▲");
});

test("el panel de datos dice que no hay reglas aplicadas y no pinta semáforos", () => {
  const ficha = normalizeExploradorFicha({
    var: "p14", tipo: "so", label: "Situación",
    datos: { n_total: 100, n_responden: 90, n_sin_respuesta: 10, n_fuera_de_lista: 2, n_otro_textos: null },
  })!;
  act(() => root.render(<PanelDatos ficha={ficha} filtrado={false} />));
  expect(host.textContent).toContain("Reglas de validación: aún no hay ninguna aplicada a esta pregunta.");
  expect(host.textContent).toContain("10 · 10.0%");
  expect(host.textContent).not.toContain("Textos en «Otro»");
});
