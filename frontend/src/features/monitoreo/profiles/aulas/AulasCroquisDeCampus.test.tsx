import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasCroquisDeCampus } from "./AulasCroquisDeCampus";

/**
 * B32, mitad de app: el croquis SVG del campus con el pabellón de la cita
 * resaltado. Es el hermano en pantalla del verso de la ficha QR: mismas
 * posiciones, mismos tonos por letra (Sistema Pabellón), misma regla para el
 * venue de dos pabellones («cualquiera de los dos según el horario») y la
 * misma honestidad con lo que no tiene edificio.
 */
describe("el croquis de campus en pantalla", () => {
  it("sin lugar resaltado igual orienta: 22 pabellones, ninguno resaltado", () => {
    const html = renderToStaticMarkup(<AulasCroquisDeCampus />);
    // Un chip por letra, cada uno con el tono de su letra.
    expect(html.match(/aulas-croquis-pabellon\b/g)?.length).toBe(22);
    expect(html).not.toContain("es-resaltado");
    // Las puertas están: el aplicador entra por alguna.
    expect(html).toContain("Principal");
    expect(html).toContain("Riva-Agüero");
  });

  it("un venue simple resalta SU pabellón, con el aula en el rótulo", () => {
    const html = renderToStaticMarkup(<AulasCroquisDeCampus lugarResaltado="A206" />);
    expect(html.match(/es-resaltado/g)?.length).toBeGreaterThanOrEqual(1);
    // El resaltado es el de la A (tono 0, el mismo del chip B31).
    expect(html).toMatch(/es-resaltado[^>]*es-tono-0|es-tono-0[^>]*es-resaltado/);
    expect(html).toContain("A206");
  });

  it("un venue de dos pabellones resalta los dos — cualquiera según el horario", () => {
    const html = renderToStaticMarkup(<AulasCroquisDeCampus lugarResaltado="H404 · A608" />);
    // H y A, cada uno con su anillo: dos resaltados, no uno.
    const resaltados = html.match(/es-resaltado/g)?.length ?? 0;
    expect(resaltados).toBeGreaterThanOrEqual(2);
    expect(html).toContain("H404");
    expect(html).toContain("A608");
  });

  it("el token sin edificio se declara en pantalla, no se elige en silencio", () => {
    const html = renderToStaticMarkup(<AulasCroquisDeCampus lugarResaltado="TAMB · Z111" />);
    // Z se resalta; TAMB queda dicho como fuera del croquis (paridad con el
    // subtítulo impreso del verso).
    expect(html).toMatch(/es-resaltado/);
    expect(html).toContain("TAMB fuera del croquis");
  });
});

describe("la base PULSO PUCP se marca siempre", () => {
  it("con y sin venue, el croquis lleva el pin y el rótulo de la base", () => {
    // Dictado (2026-09-03): «resalta dónde está PULSO PUCP siempre» — es la
    // casa del equipo: el aplicador se orienta desde ella aunque su cita
    // esté en la otra punta del campus.
    for (const venue of [null, "A206"]) {
      const html = renderToStaticMarkup(<AulasCroquisDeCampus lugarResaltado={venue} />);
      expect(html).toContain("aulas-croquis-base");
      expect(html).toContain("PULSO PUCP");
    }
  });
});
