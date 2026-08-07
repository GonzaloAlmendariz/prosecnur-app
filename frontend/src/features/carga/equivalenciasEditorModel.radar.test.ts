import { describe, expect, it } from "vitest";
import { agruparEnDiapositivas, type FilaEditor } from "./equivalenciasEditorModel";

// La garantía que sostiene la pestaña es que lo declarado es lo que sale.
// Ofrecer aquí un radar que el mazo rechaza después la rompe: el analista lo
// declara, guarda, genera y recibe barras sin saber por qué.

const fila = (etiqueta: string, i: number): FilaEditor => ({
  id: `f${i}`,
  seccion: "",
  etiqueta_estandar: etiqueta,
  variables: { docentes: `p${i}` },
  diapositiva: "1",
  cantidad: 1,
});

const bloqueDe = (etiquetas: string[], max?: number) => {
  const filas = etiquetas.map(fila);
  const escala = {
    firma: "1=a|2=b",
    opciones: [{ codigo: "1", etiqueta: "a" }, { codigo: "2", etiqueta: "b" }],
  };
  const cat = {
    docentes: Object.fromEntries(filas.map((f) => [f.variables.docentes, escala])),
  } as never;
  return agruparEnDiapositivas(filas, cat, max)[0].bloques[0];
};

describe("elegibilidad del radar por largo de etiqueta", () => {
  const cortas = ["Estados Financieros", "Auditoría", "Finanzas", "Tributación", "Costos"];
  const largas = cortas.map((t) => `${t} — ${"palabra ".repeat(10)}`);

  it("un tema corto puede ser vértice", () => {
    const b = bloqueDe(cortas, 42);
    expect(b.ofrecerRadar).toBe(true);
    expect(b.motivoNoRadar).toBe("");
    expect(b.elegibleRadar).toBe(true);
  });

  it("una oración no cabe en un vértice, y se dice cuánto sobra", () => {
    const b = bloqueDe(largas, 42);
    // El control se sigue MOSTRANDO: esconderlo hacía que la función pareciera
    // inexistente. Lo que cambia es que no se puede activar, y con motivo.
    expect(b.ofrecerRadar).toBe(true);
    expect(b.elegibleRadar).toBe(false);
    expect(b.motivoNoRadar).toMatch(/demasiado largos/);
    expect(b.motivoNoRadar).toMatch(/máximo 42/);
  });

  it("sin límite del motor no se inventa uno", () => {
    // El límite viaja desde el backend. Copiarlo aquí lo dejaría divergir en
    // cuanto alguien lo afine allá.
    expect(bloqueDe(largas, undefined).elegibleRadar).toBe(true);
    expect(bloqueDe(largas, 0).elegibleRadar).toBe(true);
  });
});
