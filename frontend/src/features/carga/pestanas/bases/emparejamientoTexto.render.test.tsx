// @vitest-environment happy-dom
// Emparejamiento de columnas por el texto de la pregunta (ítem 4 del checklist
// de validación del practicante): la propuesta se revisa y nada se aplica sin aceptar.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { normalizarPropuestaEmparejamiento } from "../../../../api/cargaEmparejamiento";
import { EmparejamientoPorTextoDialog } from "./EmparejamientoPorTextoDialog";
import {
  columnasEnConflicto,
  conteoEleccion,
  elegir,
  eleccionInicial,
  gruposDeColumnas,
  parejasAceptadas,
  rotuloOfertaEmparejamiento,
  SIN_PAREJA,
} from "./emparejamientoTextoModelo";

// Forma en que Plumber serializa la propuesta (escalares como vectores de largo uno).
const crudo = {
  ok: [true],
  resumen: { n_columnas: [4], n_ya_calzan: [0], n_propuestas: [2], n_dudosas: [1], n_ambiguas: [0], n_sin_pareja: [1], n_preguntas: [3], n_preguntas_sin_columna: [0] },
  columnas: [
    { columna: [1], encabezado: ["Nro. De Encuesta"], estado: ["sin_pareja"], name: [""], pregunta: [""], confianza: [""], causa: ["Ninguna pregunta del formulario tiene un texto parecido"], candidatos: [] },
    { columna: [2], encabezado: ["P1. Edad cumplida"], estado: ["exacta"], name: ["edad"], pregunta: ["Edad cumplida"], confianza: ["alta"], causa: ["Mismo texto que la pregunta, sin contar la numeración"], candidatos: [{ name: ["edad"], pregunta: ["Edad cumplida"] }] },
    { columna: [3], encabezado: ["P2. Distrito de residencia\r\n"], estado: ["contenida"], name: ["distrito"], pregunta: ["Distrito"], confianza: ["media"], causa: ["El encabezado contiene el texto de la pregunta"], candidatos: [{ name: ["distrito"], pregunta: ["Distrito"] }] },
    { columna: [4], encabezado: ["Distrito"], estado: ["dudosa"], name: ["distrito"], pregunta: ["Distrito"], confianza: ["baja"], causa: ["Mismo texto que la pregunta, pero el texto también aparece en \"P2. Distrito de residencia\""], candidatos: [{ name: ["distrito"], pregunta: ["Distrito"] }] },
  ],
  sin_columna: [],
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("modelo del emparejamiento por texto", () => {
  const propuesta = normalizarPropuestaEmparejamiento(crudo);

  it("normaliza la propuesta sin recortar el encabezado, que el backend compara literal", () => {
    expect(propuesta.resumen.n_propuestas).toBe(2);
    expect(propuesta.columnas[2]!.encabezado).toBe("P2. Distrito de residencia\r\n");
    expect(propuesta.columnas[1]!.candidatos).toEqual([{ name: "edad", pregunta: "Edad cumplida" }]);
  });

  it("el rótulo de la oferta dice la cifra sobre las columnas de la base", () => {
    expect(rotuloOfertaEmparejamiento(propuesta.resumen)).toBe("Emparejar por el texto de la pregunta: 2 de 4 columnas coinciden");
    expect(rotuloOfertaEmparejamiento({ ...propuesta.resumen, n_propuestas: 1, n_columnas: 1 }))
      .toBe("Emparejar por el texto de la pregunta: 1 de 1 columna coincide");
  });

  it("vienen elegidas solo las coincidencias seguras; las dudosas se eligen al revisar", () => {
    const e = eleccionInicial(propuesta);
    expect(e).toEqual({ 1: "", 2: "edad", 3: "distrito", 4: "" });
    expect(parejasAceptadas(propuesta, e)).toEqual([
      { columna: 2, encabezado: "P1. Edad cumplida", name: "edad" },
      { columna: 3, encabezado: "P2. Distrito de residencia\r\n", name: "distrito" },
    ]);
  });

  it("dos columnas con la misma pregunta se marcan y no se pueden cargar", () => {
    const e = elegir(eleccionInicial(propuesta), 4, "distrito");
    const conflictos = columnasEnConflicto(e);
    expect([...conflictos].sort()).toEqual([3, 4]);
    expect(conteoEleccion(parejasAceptadas(propuesta, e), conflictos)).toContain("2 columnas eligieron una pregunta repetida");
    const resuelto = elegir(e, 3, SIN_PAREJA);
    expect(columnasEnConflicto(resuelto).size).toBe(0);
    expect(conteoEleccion(parejasAceptadas(propuesta, resuelto), new Set())).toBe("2 columnas se renombrarán con el nombre de su pregunta");
  });

  it("agrupa primero lo que pide revisión y no muestra grupos vacíos", () => {
    expect(gruposDeColumnas(propuesta).map((g) => g.titulo)).toEqual([
      "Para revisar (1)",
      "Coinciden con el texto de una pregunta (2)",
      "Sin pareja (1)",
    ]);
  });
});

describe("diálogo del emparejamiento por texto", () => {
  it("muestra cada columna con su pregunta, la coincidencia y la causa, y carga solo al aceptar", async () => {
    const propuesta = normalizarPropuestaEmparejamiento(crudo);
    const onAceptar = vi.fn(async () => undefined);
    act(() => root.render(<EmparejamientoPorTextoDialog propuesta={propuesta} onAceptar={onAceptar} onCerrar={() => undefined} />));
    const texto = document.body.textContent ?? "";
    expect(texto).toContain("Emparejamiento por el texto de la pregunta");
    expect(texto).toContain("2 de 4 columnas coinciden, 1 para revisar y 1 sin pareja");
    expect(texto).toContain("P1. Edad cumplida");
    expect(texto).toContain("Mismo texto que la pregunta, sin contar la numeración");
    expect(texto).toContain("Ninguna pregunta del formulario tiene un texto parecido");
    expect(texto).toContain("2 columnas se renombrarán con el nombre de su pregunta");
    expect(onAceptar).not.toHaveBeenCalled();
    const boton = Array.from(document.body.querySelectorAll("button")).find((b) => b.textContent?.includes("Cargar con los nombres del formulario"));
    expect(boton).toBeTruthy();
    await act(async () => boton!.click());
    expect(onAceptar).toHaveBeenCalledWith([
      { columna: 2, encabezado: "P1. Edad cumplida", name: "edad" },
      { columna: 3, encabezado: "P2. Distrito de residencia\r\n", name: "distrito" },
    ]);
  });
});
