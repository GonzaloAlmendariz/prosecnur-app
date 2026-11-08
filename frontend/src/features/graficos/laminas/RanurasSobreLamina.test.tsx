// R8-9: el rótulo de la ranura nombra su lugar cuando hay varias; con un solo gráfico no se pinta (tapaba el subtítulo).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RanurasSobreLamina } from "./RanurasSobreLamina";
import type { RanuraSobreLamina } from "./ranurasLamina";

const ranura = (k: number, slot: string): RanuraSobreLamina =>
  ({ k, slot, rect: { x: 0, y: 0.2, width: 0.5, height: 0.6 } });

const pintar = (ranuras: RanuraSobreLamina[]) => renderToStaticMarkup(
  <RanurasSobreLamina ranuras={ranuras} activa={1} nombre={() => "Barras"} onRanura={() => undefined} onCambiar={() => undefined}
    lugar={(s) => (s === "izquierda" ? "Izquierda" : "Derecha")} />,
);

describe("RanurasSobreLamina", () => {
  it("con un solo gráfico no pinta el rótulo «Gráfico»; el nombre accesible sigue", () => {
    const html = pintar([ranura(1, "grafico")]);
    expect(html).not.toContain("pulso-f6-ranura-etiqueta");
    expect(html).toContain('aria-label="Gráfico: Barras"');
  });

  it("con varias, cada una dice su lugar", () => {
    const html = pintar([ranura(1, "izquierda"), ranura(2, "derecha")]);
    expect(html.match(/pulso-f6-ranura-etiqueta/g)).toHaveLength(2);
    expect(html).toContain(">Izquierda<");
  });
});
