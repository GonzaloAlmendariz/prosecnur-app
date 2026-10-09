/**
 * E12 · A5 — C1 declarado donde el runner encontró colecciones sin contrato:
 * `ul.cmv2-salud-lista` (Marco), `.cmv2-calc-supuestos` (Cálculo) y las
 * `section.cmv2-generales-card` apiladas en Entrega > Coincidencia.
 *
 * Además fija la regla que obliga a no marcar los grupos de Coincidencia como
 * miembros: el runner asigna cada `data-qa-geometry-member` al grupo más
 * cercano (`closest`, que se incluye a sí mismo), así que un grupo que además
 * fuera miembro dejaría al de arriba sin él.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CalcMuestraSaludCriterioFila } from "../../../../api/calcMuestra";
import { CALC_MUESTRA_SALUD_CRITERIOS_SCHEMA } from "../../../../api/calcMuestra";
import { SaludCriteriosCard } from "../criterios/SaludCriteriosCard";
import { SalidasCoincidenciaTab } from "./SalidasCoincidenciaTab";

function fila(id: string): CalcMuestraSaludCriterioFila {
  return {
    criterion_id: id,
    label: id,
    columna: id,
    columna_en_el_marco: true,
    aulas: 10,
    aulas_con_valor: 8,
    kind: "categorica",
    categorias_declaradas: 2,
    categorias_presentes: 0,
    categorias_ausentes: [],
    estado: "sin_coincidencia",
    aviso: "",
    por_facultad: [],
  };
}

/** Etiquetas de apertura que declaran grupo, en orden de documento. */
function etiquetasDeGrupo(html: string): string[] {
  return html.match(/<[a-z]+[^>]*data-qa-geometry-group="[^"]*"[^>]*>/g) ?? [];
}

function grupos(html: string): Array<{ grupo: string; contrato: string }> {
  return etiquetasDeGrupo(html).map((tag) => ({
    grupo: /data-qa-geometry-group="([^"]*)"/.exec(tag)?.[1] ?? "",
    contrato: /data-qa-geometry-contract="([^"]*)"/.exec(tag)?.[1] ?? "",
  }));
}

describe("E12 A5 · C1 en las colecciones de aulas", () => {
  it("la lista de salud de criterios declara grupo intrinsic", () => {
    const html = renderToStaticMarkup(
      <SaludCriteriosCard
        salud={{
          schema: CALC_MUESTRA_SALUD_CRITERIOS_SCHEMA,
          grain: "criterio",
          unit: "aula",
          momento: "marco",
          filas: [fila("teacher_type"), fila("session_type")],
        }}
      />,
    );
    expect(grupos(html)).toEqual([{ grupo: "calc-muestra/salud-criterios", contrato: "intrinsic" }]);
  });

  it("Coincidencia: «El método» es grupo propio; resultado y detalle, miembros de la sección", () => {
    const html = renderToStaticMarkup(
      <SalidasCoincidenciaTab criteriosGenerales={[]} criteriosMarco={[]} fichas={[]} referencia={null} />,
    );
    expect(grupos(html).map((g) => g.grupo)).toEqual([
      "calc-muestra/salidas-coincidencia",
      "calc-muestra/salidas-coincidencia-metodo",
    ]);
    expect(grupos(html).every((g) => g.contrato === "intrinsic")).toBe(true);
    // Un grupo nunca es a la vez miembro del de arriba.
    expect(etiquetasDeGrupo(html).filter((tag) => tag.includes("data-qa-geometry-member"))).toEqual([]);
    // Resultado y detalle: miembros (como grupos medían el interlineado como capacidad ociosa).
    expect(html).toMatch(/aria-label="El resultado" data-qa-geometry-member/);
    expect(html).toMatch(/aria-label="El detalle por facultad" data-qa-geometry-member/);
  });
});
