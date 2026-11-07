import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { ResumenAulas } from "./ResumenAulas";

const dashboard = {
  avance_cuota: {
    schema: "monitoreo_aulas_avance_cuota_v1",
    fuente: "design_targets",
    vigencia: "vigente",
    motivo: "",
    eje: { clave: "nivel", columna: "nivel", etiqueta: "Nivel", etiqueta_plural: "Niveles", etiqueta_sin: "Sin nivel", atribucion: "persona", fuente_valor: "padron", motivo: "" },
    tasa_esperada: null,
    tasa_fuente: "",
    total: {
      cuota: 400, respuestas_validas: 465, brecha: 5, avance_pct: 116.2,
      fuera_universo: 0, huerfanas: 2, sin_eje: 22, duplicadas: 15, sin_celda: 140,
      invariante: { ok: true, suma: 644, total: 644, solapadas: 0 },
    },
    facultades: [
      { facultad: "9", faculty_key: "9", cuota: 62, tau_prevista: null, respuestas_validas: 57, brecha: 5, avance_pct: 91.9, fuente_fila: "diseno", estado: "ok", fuera_universo: 0, respuestas_sin_sexo: 0 },
    ],
  },
  ritmo_diario: {
    dias: [{ fecha: "2026-09-22", validas: 120, acumulado: 120 }, { fecha: "2026-09-23", validas: 80, acumulado: 200 }],
    dias_con_campo: 2,
    mejor_dia: { fecha: "2026-09-22", validas: 120 },
    media_diaria: 100,
    meta: 400,
  },
} as unknown as MonitoreoAulasDashboard;

function pintar(props: { dashboard: MonitoreoAulasDashboard | null; cargando?: boolean }, url = "/monitoreo?modo=aulas") {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <ResumenAulas dashboard={props.dashboard} cargando={props.cargando ?? false} vacioSinTablero={<p>Sin tablero</p>} />
    </MemoryRouter>,
  );
}

describe("ResumenAulas", () => {
  it("publica su marca y declara sus superficies (C1)", () => {
    const html = pintar({ dashboard });
    expect(html).toContain('data-audit-ready="monitoreo-aulas-avance-resumen"');
    expect(html).toContain('data-qa-geometry-group="aulas-resumen"');
    expect(html).toContain('data-qa-geometry-group="aulas-resumen-grupos"');
    expect(html).toContain("Faltan 5 en el nivel 9");
    expect(html).toContain("Por nivel");
    expect(html).toContain("Muestra, 400");
  });

  it("las tarjetas son botones que ponen y quitan el foco del eje", () => {
    expect(pintar({ dashboard })).toContain('aria-pressed="false"');
    expect(pintar({ dashboard }, "/monitoreo?modo=aulas&foco=nivel%3A9")).toContain('aria-pressed="true"');
  });

  it("mientras carga pinta la silueta con la marca en false", () => {
    const html = pintar({ dashboard: null, cargando: true });
    expect(html).toContain('data-audit-ready="false"');
    expect(html).toContain("Preparando el corte");
  });

  it("sin tablero monta el vacío del perfil con su motivo", () => {
    const html = pintar({ dashboard: null });
    expect(html).toContain('data-audit-ready="vacio:sin-tablero"');
    expect(html).toContain("Sin tablero");
  });
});
