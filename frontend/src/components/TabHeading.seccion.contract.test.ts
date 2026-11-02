// L14 opción a: la variante «sección» del TabHeading del kit mide lo mismo que la cabecera de pestaña de Monitoreo
// (features/monitoreo/core/cabeceraDePestana, estándar §2b G1), que la adopta. Mientras las dos convivan, este
// contrato falla si una cambia la geometría sin la otra: alto, tile, antetítulo y título.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");
const leer = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

/** Declaraciones del primer bloque cuyo selector es exactamente `selector`. */
function bloque(css: string, selector: string): Record<string, string> {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(?:^|\\n)${escapado}\\s*\\{([^}]*)\\}`).exec(css);
  if (!m) throw new Error(`no encontré el bloque ${selector}`);
  return Object.fromEntries(
    m[1]!.split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
      const i = d.indexOf(":");
      return [d.slice(0, i).trim(), d.slice(i + 1).trim()];
    }),
  );
}

const KIT = leer("components/kit-tab-heading.css");
const MON = leer("features/monitoreo/core/cabeceraDePestana/cabeceraDePestana.css");
const V = '.pulso-tab-heading[data-variante="seccion"]';
const TIPO_MICRO = "var(--pulso-type-micro-size)"; // 10px en app/tipografia.css

describe("variante sección del kit = cabecera de pestaña de Monitoreo", () => {
  it("mismo alto", () => {
    expect(bloque(KIT, V)["block-size"]).toBe(bloque(MON, ".mon-pcab").height);
  });

  it("mismo tile", () => {
    const kit = bloque(KIT, `${V} .pulso-tab-heading-icon`);
    const mon = bloque(MON, ".mon-pcab-icono");
    expect([kit["inline-size"], kit["block-size"], kit["border-radius"]]).toEqual([mon.width, mon.height, mon["border-radius"]]);
  });

  it("mismo antetítulo y mismo título", () => {
    const ante = bloque(KIT, `${V} .pulso-tab-heading-eyebrow`);
    const monAnte = bloque(MON, ".mon-pcab-antetitulo");
    expect(ante["font-size"]).toBe(TIPO_MICRO);
    expect(monAnte["font-size"]).toBe("10px");
    expect([ante["font-weight"], ante["letter-spacing"], ante["text-transform"]])
      .toEqual([monAnte["font-weight"], monAnte["letter-spacing"], monAnte["text-transform"]]);
    const h2 = bloque(KIT, `${V} .pulso-tab-heading-title h2`);
    const monH2 = bloque(MON, ".mon-pcab-copia h2");
    expect([h2["font-size"], h2["font-weight"], h2["letter-spacing"], h2["line-height"]])
      .toEqual([monH2["font-size"], monH2["font-weight"], monH2["letter-spacing"], monH2["line-height"]]);
  });
});
