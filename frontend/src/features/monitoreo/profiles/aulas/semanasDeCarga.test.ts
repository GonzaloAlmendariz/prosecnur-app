// semanasDeCarga.test.ts — el calendario de la carga se recorre POR SEMANA.
//
// Dictado en vivo (2026-09-02): «puede ser scrolleable por semana». Las filas
// de fecha del calendario se agrupan en semanas de lunes a domingo para el
// pager ‹ ›/«Hoy»; el carril de «por agendar» no es una semana y queda fuera
// del agrupado — se pinta siempre, lo decide la vista.
import { describe, expect, it } from "vitest";

import type { FilaDeCarga } from "./cargaDeCampo";
import { semanaInicial, semanasDeCarga } from "./semanasDeCarga";

const fecha = (iso: string): FilaDeCarga => ({ clave: iso, etiqueta: iso, dia: 0, fecha: iso });
const carril = (dia: number): FilaDeCarga => ({ clave: `por-agendar:${dia}`, etiqueta: "lunes", dia, porAgendar: true });

describe("semanasDeCarga agrupa las fechas en semanas de lunes a domingo", () => {
  const { semanas, sinSemana } = semanasDeCarga([
    fecha("2026-09-14"), fecha("2026-09-15"), fecha("2026-09-20"),
    fecha("2026-09-21"),
    carril(1),
  ]);

  it("cada semana junta sus fechas por índice de fila", () => {
    expect(semanas.map((s) => s.indices)).toEqual([[0, 1, 2], [3]]);
    expect(sinSemana).toEqual([]);
  });

  it("la etiqueta dice el rango de la semana de calendario, no de sus fechas", () => {
    // La semana ES de lunes a domingo aunque el campo solo pise dos días: así
    // «Hoy» cae siempre en alguna, esté agendado o no.
    expect(semanas[0].etiqueta).toBe("del 14/09 al 20/09");
    expect(semanas[1].etiqueta).toBe("del 21/09 al 27/09");
  });

  it("el carril no es una semana", () => {
    expect(semanas.flatMap((s) => s.indices)).not.toContain(4);
  });

  it("una fecha imposible no forma semana ni se pierde: va al balde declarado", () => {
    const r = semanasDeCarga([fecha("2026-09-14"), fecha("2026-09-31")]);
    expect(r.semanas).toHaveLength(1);
    expect(r.semanas[0].indices).toEqual([0]);
    // La vista la pinta SIEMPRE, en cualquier página: recortarla al paginar
    // sería perder una fila que la malla completa sí enseña.
    expect(r.sinSemana).toEqual([1]);
  });
});

describe("semanaInicial: dónde abre el pager", () => {
  const { semanas } = semanasDeCarga([fecha("2026-09-14"), fecha("2026-09-21")]);

  it("en la semana que contiene HOY, si el operativo la tiene", () => {
    expect(semanaInicial(semanas, "2026-09-16")).toBe(0);
    expect(semanaInicial(semanas, "2026-09-27")).toBe(1);
  });

  it("con hoy fuera del operativo abre en la primera", () => {
    expect(semanaInicial(semanas, "2026-01-01")).toBe(0);
    expect(semanaInicial([], "2026-09-16")).toBe(0);
  });
});
