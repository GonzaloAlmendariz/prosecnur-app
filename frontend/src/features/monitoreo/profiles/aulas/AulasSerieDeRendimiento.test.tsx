import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { AulasSerieDeRendimiento, escalaDeEje } from "./AulasSerieDeRendimiento";

/**
 * El gráfico tiene que separar lo aplicado de lo agendado.
 *
 * Gonzalo: «el gráfico sigue sin diferenciar el pasado del futuro o lo previsto».
 * Y la separación EXISTÍA —una vertical punteada, con un comentario en el código
 * que decía «sin esta raya las dos mitades se leen igual»— sólo que estaba
 * pintada en `--pulso-border`, **el mismo gris exacto de la rejilla de fondo**.
 * Una frontera del color del fondo no es una frontera.
 *
 * Por eso este guard no comprueba que la raya exista: comprueba que **se
 * distinga**. Una superficie teñida sobre todo lo agendado, la frontera en un
 * color que no es el de la rejilla, y los dos lados nombrados.
 *
 * El componente no tenía ninguna prueba, y el defecto es de los que vuelven
 * solos: media hora antes, al neutralizar la barra observada por otro motivo, se
 * borró de paso la única señal de color que quedaba entre las dos mitades.
 */

const GRIS_DE_LA_REJILLA = "var(--pulso-border)";

function aplicada(fecha: string, efectivas: number, codigo: string): MonitoreoRow {
  return {
    faculty: "Derecho",
    applied_at: fecha,
    effective_surveys: efectivas,
    operational_code: codigo,
  } as unknown as MonitoreoRow;
}

function agendada(fecha: string, codigo: string): MonitoreoRow {
  return {
    faculty: "Derecho",
    scheduled_date: fecha,
    eligible_n: 40,
    operational_code: codigo,
  } as unknown as MonitoreoRow;
}

/** Cuatro días aplicados y dos agendados por delante. */
function pintar() {
  const partes = [
    aplicada("2026-08-10", 20, "A1"),
    aplicada("2026-08-11", 22, "A2"),
    aplicada("2026-08-12", 19, "A3"),
    aplicada("2026-08-13", 24, "A4"),
  ];
  const agenda = [agendada("2026-08-17", "B1"), agendada("2026-08-18", "B2")];
  return renderToStaticMarkup(
    <AulasSerieDeRendimiento partes={partes} agenda={agenda} />);
}

describe("la serie separa lo aplicado de lo agendado", () => {
  it("nombra los dos lados del corte", () => {
    const html = pintar();
    // Uno por gráfico: el acumulado y el diario.
    expect(html.match(/aulas-serie-zona es-aplicado/g)).toHaveLength(2);
    expect(html.match(/aulas-serie-zona es-agendado/g)).toHaveLength(2);
    expect(html).toContain(">aplicado<");
    expect(html).toContain(">agendado<");
  });

  it("tiñe la superficie de lo agendado, que es lo que se lee de un vistazo", () => {
    const html = pintar();
    // Se comprueba que la zona SE PINTE, no que exista: un `<rect>` con
    // `fill="none" opacity="0"` tiene la misma geometría y no se ve. La primera
    // versión de este aserto miraba sólo x/ancho/alto y ese mutante pasaba.
    const zonas = [...html.matchAll(
      /<rect x="([\d.]+)" y="4" width="([\d.]+)" height="92" fill="([^"]+)" opacity="([\d.]+)"/g)];
    expect(zonas).toHaveLength(2);
    for (const [, x, ancho, fill, opacidad] of zonas) {
      expect(Number(x)).toBeGreaterThan(4);
      expect(Number(ancho)).toBeGreaterThan(0);
      expect(fill).not.toBe("none");
      expect(Number(opacidad)).toBeGreaterThan(0.02);
    }
  });

  it("la frontera NO va del color de la rejilla", () => {
    const html = pintar();
    // Las verticales de corte: mismo x1 y x2, de arriba abajo del área.
    const cortes = [...html.matchAll(/<line x1="([\d.]+)" y1="4" x2="([\d.]+)" y2="96"[^>]*stroke="([^"]+)"/g)];
    expect(cortes).toHaveLength(2);
    for (const [, x1, x2, color] of cortes) {
      expect(x1).toBe(x2);
      expect(color).not.toBe(GRIS_DE_LA_REJILLA);
    }
  });

  it("sin nada agendado por delante no inventa una frontera", () => {
    const partes = [aplicada("2026-08-10", 20, "A1"), aplicada("2026-08-11", 22, "A2")];
    const html = renderToStaticMarkup(
      <AulasSerieDeRendimiento partes={partes} agenda={[]} />);
    expect(html).not.toContain("aulas-serie-zona");
  });
});

describe("la escala del eje vertical", () => {
  it("da pasos redondos, no fracciones del tope", () => {
    // Gonzalo: «los ticks del eje y pueden tener saltos más lógicos, como cada 20
    // o cada 10». Con fracciones del tope, 45 daba 34 · 23 · 11.
    expect(escalaDeEje(45)).toEqual({ tope: 50, escalones: [50, 40, 30, 20, 10, 0] });
    expect(escalaDeEje(23)).toEqual({ tope: 25, escalones: [25, 20, 15, 10, 5, 0] });
    expect(escalaDeEje(240)).toEqual({ tope: 250, escalones: [250, 200, 150, 100, 50, 0] });
    expect(escalaDeEje(4400)).toEqual({
      tope: 5000, escalones: [5000, 4000, 3000, 2000, 1000, 0],
    });
  });

  it("el tope nunca queda por debajo de lo que hay que dibujar", () => {
    // Si el tope se quedara corto, la serie saldría fuera del área: «un elemento
    // que no cabe en su eje es un eje mal calculado».
    for (const v of [1, 3, 7, 19, 45, 99, 101, 240, 999, 4400, 12345]) {
      expect(escalaDeEje(v).tope).toBeGreaterThanOrEqual(v);
    }
  });

  it("siempre cierra en cero y en el tope, y no pasa de seis escalones", () => {
    for (const v of [1, 7, 45, 240, 4400, 12345]) {
      const { tope, escalones } = escalaDeEje(v);
      expect(escalones[0]).toBe(tope);
      expect(escalones[escalones.length - 1]).toBe(0);
      expect(escalones.length).toBeGreaterThanOrEqual(4);
      expect(escalones.length).toBeLessThanOrEqual(6);
    }
  });
});
