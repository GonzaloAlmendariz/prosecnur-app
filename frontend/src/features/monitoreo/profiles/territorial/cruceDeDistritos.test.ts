import { describe, expect, it } from "vitest";

import { cruceDeDistritos } from "./cruceDeDistritos";

const fmt = (n: number) => n.toLocaleString("es-PE");

/**
 * `0 >= 0` es `true`, y de ahí salía «Hojas de Ruta y Kobo coinciden» en verde
 * sobre un cruce que no existe. Cuarta aparición de la misma veta en tres
 * ticks; ésta es la más barata de escribir por accidente.
 */
describe("el cruce de distritos no coincide si no hay distritos", () => {
  it("sin distritos no declara coincidencia ni se pinta ready", () => {
    const v = cruceDeDistritos(0, 0, fmt);
    expect(v.valor).not.toMatch(/0 de 0/);
    expect(v.pista).not.toMatch(/coinciden/i);
    expect(v.tono).toBe("warning");
  });

  it("con distritos y todos alineados SI coinciden — el control discrimina", () => {
    const v = cruceDeDistritos(12, 12, fmt);
    expect(v.valor).toBe("12 de 12");
    expect(v.pista).toMatch(/coinciden/i);
    expect(v.tono).toBe("ready");
  });

  it("con distritos y cobertura incompleta avisa", () => {
    const v = cruceDeDistritos(9, 12, fmt);
    expect(v.pista).toMatch(/Revisar cobertura/);
    expect(v.tono).toBe("warning");
  });

  it("alineados de más siguen contando como coincidencia", () => {
    // Kobo puede traer un distrito que la ruta no lista; el `>=` original lo
    // trataba como cuadre y eso NO cambia: la reparación es sólo sobre el cero.
    expect(cruceDeDistritos(13, 12, fmt).tono).toBe("ready");
  });
});
