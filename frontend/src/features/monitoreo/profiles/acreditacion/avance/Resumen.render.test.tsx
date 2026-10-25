/**
 * Avance › Resumen, «Por público» (ronda 4): la tesela dice la cifra mínima
 * («N % de la meta») sin explicación encadenada, no monta la serie de 14
 * días sobre el texto y declara su densidad: cómoda hasta seis públicos,
 * compacta con más.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { MonitoreoCorte } from "../../../corte/corteContract";
import { ResumenVista } from "./Resumen";
import { advanceCardsFromRows } from "./tarjetasDeAvance";

const CORTE = { hasSnapshot: true, ingesta: 488, procesable: 470, oficial: 418, saltos: [] } as unknown as MonitoreoCorte;
const DIARIO = [
  { Fecha: "2026-05-25", Efectivas: 25, Acumulado: 25 },
  { Fecha: "2026-05-27", Efectivas: 80, Acumulado: 105 },
];
const DIARIO_PUBLICO = [{ Actor: "Egresados", Fecha: "2026-05-27", Efectivas: 80 }];

function publicos(cuantos: number) {
  const filas = Array.from({ length: cuantos }, (_, indice) => ({
    Actor: `Público ${indice + 1}`, Universo: 200, Efectivas: 100 + indice, Parciales: 2, "Rechazos plataforma": 1, "Sin respuesta": 97 - indice,
  }));
  const metas = filas.map((fila) => ({ id: fila.Actor, label: fila.Actor, meta: 120, filters: { dim_actor: fila.Actor } }));
  return advanceCardsFromRows(filas, metas as never);
}

function pintar(cuantos: number) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/monitoreo?modo=acreditacion&seccion=avance&pestana=resumen"]}>
      <ResumenVista tarjetas={publicos(cuantos)} diarioGeneral={DIARIO} diarioPorPublico={DIARIO_PUBLICO} corte={CORTE} casos={null} />
    </MemoryRouter>,
  );
}

function textosVisibles(html: string): string[] {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, " ")
    .replace(/<!-- -->/g, "")
    .split(/<[^>]+>/)
    .map((texto) => texto.trim())
    .filter(Boolean);
}

describe("Avance › Resumen › Por público", () => {
  it("con cuatro públicos la densidad es cómoda y cada tesela dice solo «N % de la meta»", () => {
    const html = pintar(4);
    expect(html).toContain('data-density="comoda"');
    const pies = [...html.matchAll(/class="acr-res-publico-pie[^"]*">([^<]+)</g)].map((m) => m[1]);
    expect(pies).toHaveLength(4);
    for (const pie of pies) expect(pie).toMatch(/^\d+ % de la meta$/);
  });

  it("con diez públicos la densidad es compacta y la tesela es nombre, cifra y barra", () => {
    const html = pintar(10);
    expect(html).toContain('data-density="compacta"');
    expect(html).not.toContain("acr-res-publico-pie");
  });

  it("no monta la serie de 14 días en la tesela ni encadena explicaciones", () => {
    const html = pintar(4);
    expect(html).not.toContain("acr-av-minibarras");
    const encadenados = textosVisibles(html).filter((texto) => /; | · /.test(texto));
    expect(encadenados).toEqual([]);
    expect(html).not.toContain("Rezagados primero;");
  });
});
