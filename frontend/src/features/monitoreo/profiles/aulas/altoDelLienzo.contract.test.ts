import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * La constante del cálculo y el alto real del lienzo son el mismo número.
 *
 * `separaLasMetas` reparte las etiquetas en PORCENTAJE del lienzo, y convierte
 * los 14 px que necesita cada una con `ALTO_DEL_LIENZO`. Cuando esa constante
 * decía 368 y el CSS le daba 264 al acumulado, la separación real quedaba en
 * ~10 px: no se veía, porque en este corte las metas están lejos, pero con dos
 * metas próximas las etiquetas se habrían montado una encima de otra.
 *
 * Un número compartido entre TS y CSS que nadie ata se separa en cuanto alguien
 * ajusta el alto por razones visuales —que es exactamente lo que pasó—.
 */

const ts = readFileSync(path.join(__dirname, "AulasSerieDeRendimiento.tsx"), "utf8");
const css = readFileSync(path.join(__dirname, "aulasMonitoreo.css"), "utf8");

describe("el alto del lienzo del acumulado", () => {
  it("la constante del TS es la del CSS", () => {
    const constante = ts.match(/const ALTO_DEL_LIENZO = (\d+);/)?.[1];
    const regla = css.match(/\.aulas-serie-grafico\.es-acumulado \{ height: (\d+)px; \}/)?.[1];
    expect(constante, "no se encontró ALTO_DEL_LIENZO").toBeDefined();
    expect(regla, "no se encontró la regla del acumulado").toBeDefined();
    expect(regla).toBe(constante);
  });

  it("el acumulado no es más bajo que el diario que lo desglosa", () => {
    // La jerarquía declarada: «el acumulado va arriba y con más peso; el diario
    // de abajo es el detalle». Estuvo al revés —264 contra 368— con ese mismo
    // comentario encima.
    const acumulado = Number(css.match(/\.aulas-serie-grafico\.es-acumulado \{ height: (\d+)px; \}/)?.[1]);
    const diario = Number(css.match(/\.aulas-serie-grafico \{ width: 100%; height: (\d+)px;/)?.[1]);
    expect(acumulado).toBeGreaterThanOrEqual(diario);
  });
});
