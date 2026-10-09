import { describe, expect, it } from "vitest";

/**
 * De qué semestre son los datos del marco, en la ficha del diseño.
 *
 * El caso real (2026-08-24): `HSVG2026.pulso` tenía cargada la base de 2025 y
 * la app calculaba sin decir palabra. Contra la base correcta, ARTE Y DISEÑO
 * pasa de 63 cursos-horario elegibles a 228. La única señal era un aviso
 * genérico de distribución incompatible.
 *
 * Se prueba la regla de comparación —no el render—: es lo que decide si el
 * aviso sale, y es donde un cambio la rompe en silencio.
 */
const anio = (t: string) => (t.match(/20\d{2}/) ?? [""])[0];
const cuadra = (periodo: string, estudio: string): boolean | null =>
  periodo && anio(estudio) ? anio(periodo) === anio(estudio) : null;

describe("el periodo del marco contra el del estudio", () => {
  it("el caso real: base 2025 en un estudio de 2026 NO cuadra", () => {
    expect(cuadra("2025", "HSVG2026")).toBe(false);
  });

  it("la base del semestre correcto cuadra", () => {
    expect(cuadra("2026-2", "HSVG2026")).toBe(true);
  });

  it("el ciclo no invalida: puede no estar en el nombre del estudio", () => {
    // Saltar por el ciclo convertiría el aviso en ruido, y un aviso ruidoso se
    // ignora justo el día que dice la verdad.
    expect(cuadra("2026-1", "HSVG2026")).toBe(true);
  });

  it("sin periodo o sin año en el estudio no se afirma nada", () => {
    // Ni «cuadra» ni «no cuadra»: no se pudo mirar.
    expect(cuadra("", "HSVG2026")).toBeNull();
    expect(cuadra("2026-2", "Estudio piloto")).toBeNull();
  });
});
