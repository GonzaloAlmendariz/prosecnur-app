import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PanoramaCursosHorario } from "../PanoramaCursosHorario";

/**
 * ADR 0057 · El panorama informa quién se aparta, no quién hereda.
 *
 * Medido en la app: «global» aparecía **56 veces** en una sola pantalla. Una
 * palabra que se repite en casi todas las celdas no informa y además tapa las
 * pocas que sí —justo las facultades con criterio propio, que son las que hay
 * que revisar—. Heredar es el caso normal: se marca con un punto y se explica al
 * pasar el cursor; apartarse se nombra.
 */
function filas() {
  return [
    {
      bloque: { excKey: "derecho", facLabel: "Derecho", fac: { facultad: "Derecho", ch_elegibles: 40, ch_total: 60, est_aula_mediana: 30 } },
      resumen: { minPropio: false, detalles: [{ variableId: "modality", propia: false }, { variableId: "session_type", propia: true }] },
    },
  ] as never;
}

const criterios = [
  { id: "modality", label: "Modalidad" },
  { id: "session_type", label: "Tipo de sesión" },
];

describe("PanoramaCursosHorario", () => {
  it("no repite «global» en cada celda heredada", () => {
    const html = renderToStaticMarkup(
      <PanoramaCursosHorario filas={filas()} criterios={criterios} facultadAbierta={null} onAbrirFacultad={vi.fn()} />,
    );
    expect(html).not.toContain(">global<");
  });

  it("nombra sólo lo que se aparta, y explica el resto sin ocupar la celda", () => {
    const html = renderToStaticMarkup(
      <PanoramaCursosHorario filas={filas()} criterios={criterios} facultadAbierta={null} onAbrirFacultad={vi.fn()} />,
    );
    expect(html).toContain("propio");
    // Lo heredado sigue siendo legible para quien lo necesite: título y aria.
    expect(html).toContain("aplica el criterio general");
  });
});
