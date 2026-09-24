import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CifraMotor } from "./CifraMotor";
import { debeAnimarSwap, esMarcadorDeValor, useValorSwap } from "./useValorSwap";

function Sonda({ value }: { value: string }) {
  const cambiando = useValorSwap(value);
  return <span data-cambiando={cambiando ? "true" : "false"}>{value}</span>;
}

describe("AD5 · useValorSwap no difumina al montar", () => {
  it("el primer render no marca «cambiando»", () => {
    expect(renderToStaticMarkup(<Sonda value="186" />)).toContain('data-cambiando="false"');
    expect(renderToStaticMarkup(<CifraMotor label="Titulares" value="186" origen="motor" />)).not.toContain("data-cambiando");
  });

  it("que aparezca el valor tras un marcador no es un cambio", () => {
    expect(debeAnimarSwap("pendiente", "186")).toBe(false);
    expect(debeAnimarSwap("—", "2,375")).toBe(false);
    expect(debeAnimarSwap(undefined, "disponible")).toBe(false);
    expect(debeAnimarSwap("186", "pendiente")).toBe(false);
  });

  it("sí cruza entre dos valores reales distintos, y no con el mismo", () => {
    expect(debeAnimarSwap("186", "190")).toBe(true);
    expect(debeAnimarSwap(3, 4)).toBe(true);
    expect(debeAnimarSwap("186", "186")).toBe(false);
  });

  it("reconoce los marcadores que pinta la UI", () => {
    for (const m of [null, undefined, "", "—", "pendiente", " Pendiente ", Number.NaN]) {
      expect(esMarcadorDeValor(m)).toBe(true);
    }
    expect(esMarcadorDeValor("0")).toBe(false);
  });
});
