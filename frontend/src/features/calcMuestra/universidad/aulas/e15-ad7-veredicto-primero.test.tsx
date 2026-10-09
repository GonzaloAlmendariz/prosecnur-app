import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  CalcMuestraAulasSelection,
  CalcMuestraComponente,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { CalculoCertezaTab } from "../calculo/CalculoCertezaTab";
import { AulasRerandomizacionTab } from "./AulasRerandomizacionTab";
import { veredictoRerandomizacion, type CorridaRerandomizacion } from "./rerandomizacionVeredicto";

const config = {
  schema: "calc_muestra_workspace_aulas_v1",
  rerandomizacion: {
    activa: true,
    tope: 50,
    criterio: { tipo: "cobertura_celdas", umbral: 1, celdas: [{ faculty_key: "derecho", cuota_f: 10, cuota_m: 10, tau: 0.5 }] },
  },
} as unknown as CalcMuestraWorkspaceAulasConfig;

const corrida = (extra: Partial<CorridaRerandomizacion>): CorridaRerandomizacion => ({
  schema: "x",
  aplicada: true,
  motivo: "aceptada_por_criterio",
  sorteos: 7,
  aceptados: 3,
  tasa_aceptacion: 3 / 7,
  cobertura_minima: 1.02,
  sorteo_elegido: 2,
  ...extra,
});

describe("AD7 · veredicto de la rerandomización", () => {
  it("dice si la muestra vigente pasó el criterio", () => {
    const v = veredictoRerandomizacion(corrida({}), { activa: true, hayCriterio: true });
    expect(v.tono).toBe("success");
    expect(v.titulo).toContain("pasó el criterio en el sorteo 2");
    expect(v.titulo).toContain("3 de 7 sorteos");
  });

  it("el agotamiento es el veredicto, en warn", () => {
    const v = veredictoRerandomizacion(corrida({ agotado: true, aceptados: 0 }), { activa: true, hayCriterio: true });
    expect(v.tono).toBe("warn");
    expect(v.titulo).toContain("Ninguno de los 7 sorteos");
  });

  it("encendida sin corrida aplicada pide volver a sortear", () => {
    expect(veredictoRerandomizacion(null, { activa: true, hayCriterio: true }).titulo).toContain("vuelve a sortear");
    expect(veredictoRerandomizacion(null, { activa: false, hayCriterio: true }).titulo).toContain("primer sorteo");
  });
});

describe("AD7 · veredicto primero, explicación plegada después", () => {
  it("«¿Este sorteo o otro?» abre con la corrida y pliega la prosa al final", () => {
    const selection = { rerandomizacion: corrida({}) } as unknown as CalcMuestraAulasSelection;
    const html = renderToStaticMarkup(<AulasRerandomizacionTab config={config} selection={selection} />);
    const iVeredicto = html.indexOf("Qué pasó en la última corrida");
    const iCriterio = html.indexOf("El criterio");
    const iExplica = html.indexOf("Sortear una vez, o sortear hasta que sirva");
    expect(iVeredicto).toBeGreaterThanOrEqual(0);
    expect(iVeredicto).toBeLessThan(iCriterio);
    expect(iCriterio).toBeLessThan(iExplica);
    // Abierta: aulas no pliega (ADR 0057); lo que cambia es el orden.
    expect(html).toMatch(/class="cmv2-uni-explica" open=""/);
    expect(html).toContain('data-tone="success"');
  });

  it("«¿Alcanza?» pone el resultado antes de la explicación, plegada", () => {
    const componentes = [
      { actor_id: "total", resultado: null },
      { actor_id: "facultad", resultado: null },
    ] as unknown as [CalcMuestraComponente, CalcMuestraComponente];
    const html = renderToStaticMarkup(
      <CalculoCertezaTab
        componentes={componentes}
        currentFrameHash="h"
        escenario="e1"
        certeza={null}
        certezaEnCurso={false}
      />,
    );
    const iResultado = html.indexOf("Todavía no hay un cálculo por facultad");
    const iExplica = html.indexOf("Cómo se decide si alcanza");
    expect(iResultado).toBeGreaterThanOrEqual(0);
    expect(iResultado).toBeLessThan(iExplica);
    expect(html).toContain('class="cmv2-uni-explica"');
    expect(html).not.toMatch(/class="cmv2-uni-explica" open/);
    expect(html).toContain("Por qué la división no basta");
  });
});
