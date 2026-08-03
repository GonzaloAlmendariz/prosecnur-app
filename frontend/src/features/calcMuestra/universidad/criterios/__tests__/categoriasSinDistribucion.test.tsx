import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FacultadCategoriaToggles } from "../FacultadCategoriaToggles";
import type { CriterioVariable } from "../../../../../api/client";
import type { FilaFacultad } from "../tipoSesionModel";

/**
 * F50 · Cuando el catálogo no trae distribución, la lista son todos los valores
 * distintos de la columna.
 *
 * Caso reportado: la lista de tipo de docente mostraba las ocho categorías
 * reales junto a nombres de personas —«PRADO LOAYZA, ANDRES»—. El frontend
 * publica fielmente lo que el motor le da; lo que no puede es callar de dónde
 * sale la lista, porque sin esa frase el usuario cree que esos nombres son
 * categorías del estudio.
 *
 * No se filtra por heurística a propósito: cualquier regla del tipo «esto parece
 * un nombre» descartaría categorías legítimas, y descartar en silencio un
 * criterio real es peor que mostrar uno de más.
 */
const variable = { id: "teacher_type", label: "Tipo de docente", kind: "flat" } as unknown as CriterioVariable;

function fila(conDistribucion: boolean): FilaFacultad {
  return {
    facKey: "derecho",
    facLabel: "Derecho",
    decision: "hereda",
    chTotal: conDistribucion ? 100 : 0,
    tipos: [
      { key: "ordinario", label: "DOCENTE ORDINARIO - PRINCIPAL", ch: conDistribucion ? 60 : null, elegibles: null, activo: true },
      { key: "prado", label: "PRADO LOAYZA, ANDRES", ch: conDistribucion ? 0 : null, elegibles: null, activo: false },
    ],
  } as unknown as FilaFacultad;
}

describe("FacultadCategoriaToggles sin distribución", () => {
  it("declara que la lista son los valores distintos de la columna", () => {
    const html = renderToStaticMarkup(
      <FacultadCategoriaToggles fila={fila(false)} variable={variable} sel={{ mode: "include" }} onSel={vi.fn()} ariaLabel="x" />,
    );
    expect(html).toContain("todos los valores distintos de la columna");
    expect(html).toContain("la columna de origen los mezcla");
  });

  it("con distribución no acusa a la columna", () => {
    const html = renderToStaticMarkup(
      <FacultadCategoriaToggles fila={fila(true)} variable={variable} sel={{ mode: "include" }} onSel={vi.fn()} ariaLabel="x" />,
    );
    expect(html).not.toContain("todos los valores distintos de la columna");
  });

  it("no descarta ninguna categoría por parecer un nombre", () => {
    // Filtrar por heurística perdería categorías legítimas en silencio.
    const html = renderToStaticMarkup(
      <FacultadCategoriaToggles fila={fila(false)} variable={variable} sel={{ mode: "include" }} onSel={vi.fn()} ariaLabel="x" />,
    );
    expect(html).toContain("PRADO LOAYZA, ANDRES");
    expect(html).toContain("DOCENTE ORDINARIO - PRINCIPAL");
  });
});
