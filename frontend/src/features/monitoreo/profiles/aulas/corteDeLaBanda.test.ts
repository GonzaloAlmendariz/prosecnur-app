import { describe, expect, it } from "vitest";

import { aulasKpis } from "./kpisDeAulas";

/**
 * La tarjeta «Corte» dice el día del campo, no cuándo se abrió el tablero.
 *
 * `corteDelEstudio.ts` ya resolvía el «hoy» del estudio —el último día con parte
 * de campo— y su cabecera explica por qué `generated_at` no sirve: es el reloj
 * de la máquina que abrió el proyecto, y sobre un estudio reabierto o simulado
 * dice cualquier cosa. La tarjeta que publica la palabra «Corte» en la banda
 * seguía leyendo ese sello.
 *
 * Medido el 2026-08-29 sobre `aulas_con_respuestas.pulso`: decía 29/8/2026 con
 * partes del 1/9 al 5/9 y con Salidas diciendo «corte 05/09/26».
 */

const tablero = (generated_at: string, partes: Array<Record<string, unknown>>) =>
  ({ generated_at, partes_campo: partes, kpis: {} }) as never;

const corte = (t: never) => aulasKpis(t, "fuentes").find((k) => k.label === "Corte");

describe("la tarjeta Corte de la banda", () => {
  it("toma el último día con parte, no el sello del tablero", () => {
    const k = corte(tablero("2026-08-29T10:00:00Z", [
      { applied_at: "2026-09-01" }, { applied_at: "2026-09-05" }, { applied_at: "2026-09-03" },
    ]));
    expect(k?.value).toContain("5");
    expect(k?.value).not.toContain("29");
    expect(k?.pista).toContain("último día con parte");
  });

  it("sin partes cae al sello Y LO DECLARA, en vez de afirmar un corte", () => {
    // Un sello presentado como corte del campo es peor que un sello declarado:
    // el primero afirma algo que nadie midió.
    const k = corte(tablero("2026-08-29T10:00:00Z", []));
    expect(k?.value).toContain("29");
    expect(k?.pista).toContain("todavía no hay ningún parte");
  });

  it("un parte sin fecha utilizable no adelanta el corte", () => {
    // El control: si una fila vacía contara, el corte saltaría a "" y la tarjeta
    // diría «Pendiente» sobre un estudio que sí tiene campo.
    const k = corte(tablero("2026-08-29T10:00:00Z", [
      { applied_at: "" }, { applied_at: "2026-09-02" }, {},
    ]));
    expect(k?.value).toContain("2");
    expect(k?.pista).toContain("último día con parte");
  });
});
