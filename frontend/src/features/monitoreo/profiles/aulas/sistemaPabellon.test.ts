import { describe, expect, it } from "vitest";

import {
  TONOS_DE_PABELLON,
  esColumnaDeHora,
  esColumnaDeLugar,
  letraDePabellon,
  sesionYLugar,
  tonoDePabellon,
} from "./sistemaPabellon";

/**
 * El contrato del Sistema Pabellón (B31→B33): el color del chip se DERIVA de
 * la letra del edificio, con determinismo puro — misma letra, mismo tono,
 * siempre; sin reloj, sin azar, sin orden de llegada. Es el mismo contrato que
 * pinnea el test del paquete de Carga; si los dos divergen, el A206 de la
 * Agenda y el de Carga se pintarían distinto.
 */
describe("letraDePabellon", () => {
  it("saca la letra del edificio, mayúscula y sin tilde", () => {
    expect(letraDePabellon("A703")).toBe("A");
    expect(letraDePabellon("z101")).toBe("Z");
    expect(letraDePabellon("LFIA")).toBe("L");
    expect(letraDePabellon("Ñ201")).toBe("N");
  });

  it("sin letra inicial no hay letra que valga", () => {
    expect(letraDePabellon("101")).toBe("");
    expect(letraDePabellon("")).toBe("");
    expect(letraDePabellon("  ")).toBe("");
  });
});

describe("tonoDePabellon", () => {
  it("misma letra, mismo tono — determinista", () => {
    expect(tonoDePabellon("A703")).toBe(tonoDePabellon("A206"));
    expect(tonoDePabellon("a703")).toBe(tonoDePabellon("A703"));
  });

  it("la paleta es cíclica por letra: A y la letra a N posiciones comparten tono", () => {
    const a = tonoDePabellon("A100");
    const ciclada = String.fromCharCode(65 + TONOS_DE_PABELLON);
    expect(tonoDePabellon(`${ciclada}100`)).toBe(a);
    // Y dos letras contiguas no comparten: el ciclo reparte, no aplasta.
    expect(tonoDePabellon("B100")).not.toBe(a);
  });

  it("todo tono cae dentro de la paleta declarada", () => {
    for (let i = 0; i < 26; i += 1) {
      const tono = tonoDePabellon(`${String.fromCharCode(65 + i)}100`);
      expect(tono).not.toBeNull();
      expect(tono!).toBeGreaterThanOrEqual(0);
      expect(tono!).toBeLessThan(TONOS_DE_PABELLON);
    }
  });

  it("sin letra el chip queda neutro, no inventa un color", () => {
    expect(tonoDePabellon("101")).toBeNull();
    expect(tonoDePabellon("")).toBeNull();
  });
});

describe("sesionYLugar", () => {
  it("parte el texto descriptivo del equipo en sesión y aula", () => {
    expect(sesionYLugar("LUN 16:00 A206")).toEqual({ sesion: "LUN 16:00", lugar: "A206" });
    expect(sesionYLugar("MIÉ. 8:00 N121")).toEqual({ sesion: "MIÉ. 8:00", lugar: "N121" });
    // El aula puede llevar más de un token; la cola entera es el lugar.
    expect(sesionYLugar("MAR 14:00 Z 205")).toEqual({ sesion: "MAR 14:00", lugar: "Z 205" });
  });

  it("un código académico no es un lugar: sin el patrón, null", () => {
    // El caso medido el 2026-08-23: el plan del sorteo rellena la columna con
    // el código, 193/193. Chipearlo pintaría un pabellón «U» que no existe.
    expect(sesionYLugar("urb209_0601")).toBeNull();
    // Un aula suelta sin día ni hora tampoco se toca: adivinar sería peor.
    expect(sesionYLugar("V110")).toBeNull();
    expect(sesionYLugar("")).toBeNull();
    // Día y hora sin cola: no hay lugar que chipear.
    expect(sesionYLugar("LUN 16:00")).toBeNull();
  });
});

describe("las columnas de identidad son listas cerradas", () => {
  it("reconoce los lugares del libro y del motor", () => {
    for (const campo of ["venue", "actual_room", "room", "scheduled_venue"]) {
      expect(esColumnaDeLugar(campo), campo).toBe(true);
    }
    // Un código no es un lugar, por mucho que ocupe una columna vecina.
    expect(esColumnaDeLugar("operational_code")).toBe(false);
    expect(esColumnaDeLugar("label")).toBe(false);
  });

  it("reconoce las horas y los rangos declarados", () => {
    for (const campo of ["scheduled_time", "applied_time", "schedule", "sesiones_dia_hora"]) {
      expect(esColumnaDeHora(campo), campo).toBe(true);
    }
    // Las fechas NO son horas: en tabla quedan en texto (criterio de sobriedad).
    expect(esColumnaDeHora("scheduled_date")).toBe(false);
    expect(esColumnaDeHora("applied_date")).toBe(false);
  });
});
