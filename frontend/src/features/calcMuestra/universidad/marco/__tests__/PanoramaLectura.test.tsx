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
      resumen: {
        minPropio: true,
        minRegla: "≥ 20",
        nivelRegla: "niveles 0 y 2–10",
        detalles: [
          { variableId: "modality", propia: false, regla: null },
          { variableId: "session_type", propia: true, regla: "además TALLER" },
        ],
      },
    },
    {
      bloque: { excKey: "gestion", facLabel: "Gestión", fac: { facultad: "Gestión", ch_elegibles: 10, ch_total: 20, est_aula_mediana: 12 } },
      resumen: {
        minPropio: false,
        minRegla: null,
        nivelRegla: "exenta",
        detalles: [
          { variableId: "modality", propia: false, regla: null },
          { variableId: "session_type", propia: false, regla: null },
        ],
      },
    },
    {
      bloque: { excKey: "psicologia", facLabel: "Psicología", fac: { facultad: "Psicología", ch_elegibles: 8, ch_total: 15, est_aula_mediana: 10 } },
      resumen: {
        minPropio: false,
        minRegla: null,
        nivelRegla: null,
        detalles: [
          { variableId: "modality", propia: false, regla: null },
          { variableId: "session_type", propia: false, regla: null },
        ],
      },
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

  it("la celda dice LA REGLA, no la palabra «propio»", () => {
    // Gonzalo, sobre la matriz: «¿cómo que "propio"?». La palabra sola no
    // comunica qué decide la facultad; la celda dice la regla en corto y el
    // `title` la frase entera.
    const html = renderToStaticMarkup(
      <PanoramaCursosHorario filas={filas()} criterios={criterios} facultadAbierta={null} onAbrirFacultad={vi.fn()} />,
    );
    expect(html).toContain("además TALLER");
    expect(html).toContain("≥ 20");
    expect(/data-propia="true"[^>]*>\s*propio</.test(html)).toBe(false);
    // Lo heredado sigue siendo legible para quien lo necesite: título y aria.
    expect(html).toContain("aplica el criterio general");
    // Y el punto se explica en la cabecera, no sólo al pasar el cursor.
    expect(html).toContain("hereda la regla general del estudio");
  });

  it("el nivel del curso tiene columna: rangos y exenciones se ven", () => {
    // El panorama existe para ver quién se aparta y omitía el criterio donde
    // más facultades se apartan (12 con rango y 3 exentas en HSVG2026).
    const html = renderToStaticMarkup(
      <PanoramaCursosHorario filas={filas()} criterios={criterios} facultadAbierta={null} onAbrirFacultad={vi.fn()} />,
    );
    expect(html).toContain("Nivel del curso");
    expect(html).toContain("niveles 0 y 2–10");
    expect(html).toContain("exenta");
    expect(html).toContain("admite todos los niveles");
  });
});
