import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { PestanaPropiaDeAulas } from "../navegacion/PestanaPropiaDeAulas";
import { PorFacultadAulas } from "./PorFacultadAulas";

const hsvg = {
  avance_cuota: {
    eje: { clave: "facultad", columna: "faculty", etiqueta: "Facultad", etiqueta_plural: "Facultades", etiqueta_sin: "Sin facultad", atribucion: "aula", fuente_valor: "plan", motivo: "" },
    total: { cuota: 24, respuestas_validas: 56, brecha: 0, avance_pct: 233 },
    facultades: [],
  },
  avance_sexo_facultad: [
    { faculty: "EDUCACION", sex: "F", grano: "", cuota: 20, logrado: 50, proyeccion: 50.4, estado: "asegurada", etiqueta: "Llega con todo el plan, con margen" },
    { faculty: "EDUCACION", sex: "M", grano: "", cuota: 4, logrado: 6, proyeccion: 6, estado: "asegurada", etiqueta: "Llega con todo el plan, con margen" },
  ],
  reemplazos_por_tipo: { reemplazadas: { total: 4 }, complementadas: { total: 0 }, refuerzos: { total: 6 }, caidos_sin_relevo: 0 },
  refuerzos: { ok: true, rendimiento: { titulares: { n: 154, elegibles: 5372, efectivas: 2827, tasa: 0.5262 } } },
  agenda: [
    { operational_code: "CH 1", faculty: "EDUCACION", sample_role: "titular", sample_status: "" },
    { operational_code: "R 1.1", faculty: "EDUCACION", sample_role: "chain_reserve", sample_status: "en_reserva", titular_operational_code: "CH 1" },
  ],
} as unknown as MonitoreoAulasDashboard;

const ccss = {
  avance_cuota: {
    eje: { clave: "nivel", columna: "level", etiqueta: "Nivel", etiqueta_plural: "Niveles", etiqueta_sin: "Sin nivel", atribucion: "persona", fuente_valor: "padron", motivo: "" },
    total: { cuota: 62, respuestas_validas: 57, brecha: 5, avance_pct: 91.9 },
    facultades: [
      { facultad: "9", faculty_key: "9", cuota: 62, tau_prevista: null, respuestas_validas: 57, brecha: 5, avance_pct: 91.9, fuente_fila: "diseno", estado: "ok", fuera_universo: 0, respuestas_sin_sexo: 0 },
    ],
    composicion: null,
  },
} as unknown as MonitoreoAulasDashboard;

function pintar(dashboard: MonitoreoAulasDashboard | null, { cargando = false, url = "/monitoreo?modo=aulas" } = {}) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <PorFacultadAulas dashboard={dashboard} cargando={cargando} vacioSinTablero={<p>Sin tablero</p>} />
    </MemoryRouter>,
  );
}

describe("PorFacultadAulas", () => {
  it("HSVG: publica su marca, declara sus superficies (C1) y pinta las cuatro piezas", () => {
    const html = pintar(hsvg);
    expect(html).toContain('data-audit-ready="monitoreo-aulas-avance-porfacultad"');
    expect(html).toContain('data-qa-geometry-group="aulas-porfacultad"');
    expect(html).toContain('data-qa-geometry-contract="intrinsic"');
    expect(html).toContain("Cuota por facultad y sexo");
    expect(html).toContain("2 grupos; 2 ya cumplen");
    expect(html).toContain("Al cierre");
    expect(html).toContain("Llega con todo el plan, con margen");
    expect(html).toContain("Caídos sin relevo");
    expect(html).toContain("Qué rindió cada tipo de curso-horario");
    expect(html).toContain("52.6 %");
    expect(html).toContain("Consumo de la reserva");
    expect(html).toContain("0 de 1");
  });

  it("la facultad agrupa sus dos filas en una cabecera de grupo con botón de foco", () => {
    const html = pintar(hsvg);
    expect(html).toMatch(/scope="rowgroup" rowSpan="2"/i);
    expect(html).toContain('aria-pressed="false"');
    expect(pintar(hsvg, { url: "/monitoreo?modo=aulas&foco=facultad%3AEducaci%C3%B3n" })).toContain('aria-pressed="true"');
  });

  it("CCSS: cuota por nivel y el vacío de la composición con su causa (C3)", () => {
    const html = pintar(ccss);
    expect(html).toContain("Cuota por nivel");
    expect(html).toContain("Faltan 5");
    expect(html).toContain("A quién se está alcanzando");
    expect(html).toContain('data-qa-geometry-empty="desconexion"');
    expect(html).not.toContain("Consumo de la reserva");
  });

  it("mientras carga pinta la silueta con la marca en false", () => {
    const html = pintar(null, { cargando: true });
    expect(html).toContain('data-audit-ready="false"');
    expect(html).toContain("Preparando el corte");
  });

  it("sin tablero monta el vacío del perfil con su motivo", () => {
    const html = pintar(null);
    expect(html).toContain('data-audit-ready="vacio:sin-tablero"');
    expect(html).toContain("Sin tablero");
  });
});

describe("PestanaPropiaDeAulas", () => {
  const props = { dashboard: hsvg, cargando: false, vacioSinTablero: null };
  const pinta = (seccion: "avance" | "control", pestana: string) => renderToStaticMarkup(
    <MemoryRouter><PestanaPropiaDeAulas direccion={{ seccion, pestana, panel: null }} {...props} /></MemoryRouter>,
  );

  it("monta Por facultad y Resumen, cada una con su marca", () => {
    expect(pinta("avance", "porfacultad")).toContain("monitoreo-aulas-avance-porfacultad");
    expect(pinta("avance", "resumen")).toContain("monitoreo-aulas-avance-resumen");
  });

  it("una pestaña sin contenido propio no pinta nada", () => {
    expect(pinta("control", "sin-contenido")).toBe("");
  });
});
