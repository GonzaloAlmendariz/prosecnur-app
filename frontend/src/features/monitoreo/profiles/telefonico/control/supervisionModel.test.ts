import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { Supervision } from "./Supervision";

// Supervisión abre sus diálogos por `?panel=`: se pinta dentro de un router.
function pintar(props: Parameters<typeof Supervision>[0]) {
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Supervision, props)));
}
import { construirSupervision, porcentajeLegible } from "./supervisionModel";

function reportes(bloques: Record<string, Array<Record<string, unknown>>>): MonitoreoAcreditacionReports {
  return {
    sheets: [{ id: "monitoreo_telefonico", blocks: Object.entries(bloques).map(([id, rows]) => ({ id, rows })) }],
  } as unknown as MonitoreoAcreditacionReports;
}

// Como PDM: 20 declarados sobre 423 efectivas; el mínimo sube enumeradores y el sorteo pasa a 24 (16 personas).
const CORTE = (hoja: "conectada" | "sin_hoja") => reportes({
  supervision_resumen: [
    { Indicador: "Base", Valor: "423" }, { Indicador: "Declarados", Valor: "20" }, { Indicador: "Casos", Valor: "24" },
    { Indicador: "Semilla", Valor: "20260514" }, { Indicador: "Hoja", Valor: hoja },
    { Indicador: "En hoja", Valor: hoja === "conectada" ? "1" : "0" }, { Indicador: "Controles", Valor: "4" },
  ],
  supervision_reparto: [
    { Enumerador: "Op-14", Efectivas: 57, Casos: 3, "Mínimo": false },
    { Enumerador: "Op-09", Efectivas: 4, Casos: 1, "Mínimo": true },
  ],
  supervision_controles: [
    { CodPulso: "PDM1001", Pregunta: "¿Recibió el efectivo el día que lo esperaba?", Hoja: "No", Kobo: "Sí", Coincide: "No" },
    { CodPulso: "PDM1001", Pregunta: "¿Acepta continuar con la encuesta?", Hoja: "Sí", Kobo: "Sí", Coincide: "Sí" },
  ],
  supervision_casos: [
    { N: 1, CodPulso: "PDM1001", proGres: "", Enumerador: "Op-14", "Categoría": "SJL", "Fecha Kobo": "2026-07-02", Resultado: "Efectivo", "Status final": "Conforme", Coincide: "Sí", "Observación": "", "Controles coinciden": "3 de 4" },
    { N: 2, CodPulso: "PDM1002", proGres: "", Enumerador: "Op-09", "Categoría": "SMP", "Fecha Kobo": "2026-07-03", Resultado: "", "Status final": "", Coincide: "", "Observación": "" },
  ],
});

describe("Control › Supervisión", () => {
  it("muestra la cantidad declarada y su porcentaje equivalente (P6) y lo que agrega el mínimo (P5)", () => {
    const modelo = construirSupervision(CORTE("sin_hoja"));
    expect(modelo).not.toBeNull();
    expect(modelo?.declarados).toBe(20);
    expect(modelo?.casos).toBe(24);
    expect(porcentajeLegible(modelo?.porcentaje ?? null)).toBe("5.7 %");
    expect(modelo?.porElMinimo).toBe(4);
    expect(modelo?.reparto.find((fila) => fila.enumerador === "Op-09")?.minimo).toBe(true);
  });

  it("sin hoja de supervisión lo dice en cada caso; con hoja, el resultado y si coincide (P7)", () => {
    const sin = pintar({ reports: CORTE("sin_hoja") });
    expect(sin).toContain("Sin hoja de supervisión");
    // La explicación va una sola vez (en la tarjeta de casos), no en cada fila.
    expect(sin.match(/Sin hoja de supervisión/g)).toHaveLength(1);
    // Sin proGres en ningún caso, la columna no aparece (es llave del proyecto, no del modo).
    expect(sin).not.toContain(">proGres<");
    expect(sin).toContain("5.7 %");
    const con = construirSupervision(CORTE("conectada"));
    expect(con?.resultados).toEqual({ coinciden: 1, noCoinciden: 0, sinResultado: 1 });
    const html = pintar({ reports: CORTE("conectada") });
    expect(html).toContain("Efectivo · Conforme (coincide)");
    expect(html).toContain("Sin rellamar");
    expect(html).toContain(">3 de 4<");
    expect(html).toContain("No coinciden: ¿Recibió el efectivo el día que lo esperaba?");
    expect(html).toContain("1 de 24");
    expect(con?.enHoja).toBe(1);
  });

  it("un corte sin los bloques no inventa un sorteo", () => {
    expect(construirSupervision(reportes({}))).toBeNull();
    expect(pintar({ reports: reportes({}) })).toContain("actualiza para sortear");
  });
});
