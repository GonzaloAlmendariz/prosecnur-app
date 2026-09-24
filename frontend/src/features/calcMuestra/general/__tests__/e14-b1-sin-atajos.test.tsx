/**
 * B1 (Gonzalo, 2026-09-24): «el calculo de aulas no los tenia alli, porque
 * cada tab y subtab tenia una fucion especificas que no era necesario hacerle
 * bypass». La barra del módulo no lleva Calcular/Reporte/Cambiar tipo en
 * Muestra general ni Acreditación: el reporte vive en Resultados y el cambio
 * de tipo en la ficha del estudio.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalcMuestraEstudio } from "../../../../api/calcMuestra";
import { DEFAULT_CALC_MUESTRA_ESTUDIO } from "../../../../api/client";
import { CambiarTipoEstudio } from "../CambiarTipoEstudio";
import { FichaEstudio } from "../FichaEstudio";
import { SalidaReporte, type ReporteEstudio } from "../SalidaReporte";

const noop = () => {};
const reporte = (p: Partial<ReporteEstudio> = {}): ReporteEstudio => ({
  resultados: 1, enCurso: false, disponible: false, verUrl: null, onGenerar: noop, ...p,
});

describe("la barra del módulo no hace bypass de las secciones", () => {
  const pagina = readFileSync(new URL("../../CalcMuestraPage.tsx", import.meta.url), "utf8");
  it("sin Calcular ni Reporte en `acciones`; Cambiar tipo sólo para el traspaso territorial", () => {
    // El bloque entero de la prop, hasta el cierre del componente de la barra.
    const inicio = pagina.indexOf("acciones={");
    const acciones = pagina.slice(inicio, pagina.indexOf("\n          />", inicio));
    expect(acciones.length).toBeGreaterThan(20);
    expect(acciones).not.toMatch(/id: "calcular"/);
    expect(acciones).not.toMatch(/id: "reporte"/);
    // Tampoco por la puerta de atrás: ninguna acción de la barra definida aparte.
    expect(pagina).not.toMatch(/id: "calcular",\s*label: "Calcular"/);
    expect(acciones).toMatch(/territorial_handoff.*cambiar-tipo/s);
  });
  it("la barra muestra el indicador de guardado en toda mesa, como aulas", () => {
    expect(pagina).toMatch(/herramientas=\{desk === "sin_definir" \? undefined : <IndicadorGuardadoCalcMuestra \/>\}/);
  });
});

describe("SalidaReporte", () => {
  it("sin resultados, el botón está deshabilitado y dice por qué", () => {
    const html = renderToStaticMarkup(<SalidaReporte reporte={reporte({ resultados: 0 })} />);
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).toContain('aria-describedby="cmg-reporte-motivo"');
    expect(html).toContain("Calcula primero");
  });
  it("con reporte disponible ofrece verlo y regenerarlo", () => {
    const html = renderToStaticMarkup(<SalidaReporte reporte={reporte({ disponible: true, verUrl: "/r.html" })} />);
    expect(html).toContain("Regenerar reporte");
    expect(html).toContain('href="/r.html"');
    expect(html).not.toMatch(/<button[^>]*disabled/);
  });
  it("mientras se genera, lo dice y no se puede volver a pedir", () => {
    const html = renderToStaticMarkup(<SalidaReporte reporte={reporte({ enCurso: true })} />);
    expect(html).toContain("Generando reporte");
    expect(html).toMatch(/<button[^>]*disabled/);
  });
});

describe("Cambiar el tipo de estudio vive en la ficha", () => {
  it("la ficha lo ofrece sólo si recibe el handler", () => {
    const estudio = DEFAULT_CALC_MUESTRA_ESTUDIO as CalcMuestraEstudio;
    const ws = estudio.workspace ?? ({} as never);
    const con = renderToStaticMarkup(
      <FichaEstudio variante="general" estudio={estudio} workspace={ws} onTitulo={noop} onContexto={noop} onWorkspace={noop} onCambiarTipo={noop} />,
    );
    const sin = renderToStaticMarkup(
      <FichaEstudio variante="general" estudio={estudio} workspace={ws} onTitulo={noop} onContexto={noop} onWorkspace={noop} />,
    );
    expect(con).toContain("Cambiar el tipo de estudio");
    expect(sin).not.toContain("Cambiar el tipo de estudio");
    expect(renderToStaticMarkup(<CambiarTipoEstudio onCambiarTipo={noop} />)).toContain('aria-describedby="cmg-cambiar-tipo-nota"');
  });
});
