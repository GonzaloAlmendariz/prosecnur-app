import { describe, expect, it } from "vitest";
import { avisoAsistenciaSinParte } from "./avisoAsistenciaSinParte";

/**
 * A3 (loop estética-aulas-sheets, 2026-09-07). «ALUMNOS EN AULA» es la única
 * columna del bloque de campo que no se deriva de la plataforma: sólo la sabe
 * quien estuvo en el salón. De ella salen «% ASISTENCIA» y «ALUMNOS QUE NO
 * RESPONDIERON». Si el encargado deja de llenar el parte, las tres se apagan
 * en silencio. Medido el día 1 con el estado real: 9 aulas en la Base de
 * control, 7 partes, 2 cursos-horario sin parte (CH 7, CH 55) y 6 con parte que el
 * libro leído todavía no traía. Cada aviso dice causa y salida, y nombra.
 */

const fila = (code: string, observed?: number) => ({
  operational_code: code,
  observed_students: observed ?? "NA",
});
const parte = (code: string, observed = 20) => ({ operational_code: code, observed_students: observed });

describe("avisoAsistenciaSinParte", () => {
  const filas = [
    fila("CH 43"), fila("CH 108"), fila("CH 7"), fila("CH 38"), fila("CH 55"),
    fila("CH 72", 53), fila("CH 76"), fila("CH 79"), fila("CH 103"),
  ];
  const partes = ["CH 72", "CH 43", "CH 38", "CH 76", "CH 79", "CH 103", "CH 108"].map((c) => parte(c));

  it("nombra los cursos-horario aplicados sin parte, dice qué se apaga y dónde se llena", () => {
    const a = avisoAsistenciaSinParte(filas, partes);
    expect(a.sinParte).toEqual(["CH 7", "CH 55"]);
    expect(a.texto).toMatch(/^2 cursos-horario aplicados sin parte de campo \(CH 7, CH 55\)/);
    expect(a.texto).toContain("ALUMNOS EN AULA");
    expect(a.texto).toContain("% ASISTENCIA");
    expect(a.texto).toContain("ALUMNOS QUE NO RESPONDIERON");
    expect(a.texto).toContain("Registro de campo");
    expect(a.tono).toBe("atencion");
  });

  it("distingue el parte que existe pero el libro leído no trae todavía", () => {
    const a = avisoAsistenciaSinParte(filas, partes);
    expect(a.parteNoLeido).toEqual(["CH 43", "CH 108", "CH 38", "CH 76", "CH 79", "CH 103"]);
    expect(a.texto).toContain("6 ya tienen parte");
    expect(a.texto).toContain("CH 43");
    expect(a.texto).toMatch(/y 1 más/);
    expect(a.texto).toContain("la próxima publicación");
  });

  it("una sola va en singular", () => {
    const a = avisoAsistenciaSinParte([fila("CH 7"), fila("CH 72", 53)], [parte("CH 72")]);
    expect(a.texto).toMatch(/^1 curso-horario aplicado sin parte de campo \(CH 7\)/);
    expect(a.texto).not.toContain("ya tienen parte");
  });

  it("con todo cubierto no dice nada", () => {
    const a = avisoAsistenciaSinParte([fila("CH 72", 53)], [parte("CH 72", 53)]);
    expect(a.texto).toBe("");
    expect(a.sinParte).toEqual([]);
    expect(a.parteNoLeido).toEqual([]);
  });

  it("sin filas de control no inventa cursos-horario", () => {
    expect(avisoAsistenciaSinParte([], partes).texto).toBe("");
  });

  it("casa códigos sin importar espacios ni mayúsculas, y no usa em dashes", () => {
    const a = avisoAsistenciaSinParte([fila("ch 7 ")], [parte("CH 7")]);
    expect(a.sinParte).toEqual([]);
    const b = avisoAsistenciaSinParte(filas, partes);
    expect(b.texto).not.toContain("—");
  });
});
