import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CifraMotor } from "./CifraMotor";
import { debeAnimarSwap, efectoValorSwap, esMarcadorDeValor, useValorSwap } from "./useValorSwap";

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

describe("efectoValorSwap: el efecto real del hook (sin DOM)", () => {
  function correr(anterior: string | null, value: string | null, reducedMotion = false) {
    const llamadas: boolean[] = [];
    const paso = efectoValorSwap({
      anterior,
      value,
      reducedMotion,
      setCambiando: (v) => llamadas.push(v),
      setTimeout: () => 1,
      clearTimeout: () => {},
    });
    return { paso, llamadas };
  }

  it("marcador → valor no enciende el cruce (la cifra aparece nítida)", () => {
    for (const marcador of ["pendiente", "—", null]) {
      const { llamadas } = correr(marcador, "186");
      expect(llamadas).not.toContain(true);
    }
  });

  it("valor → valor sí lo enciende y programa su apagado", () => {
    const { llamadas, paso } = correr("186", "190");
    expect(llamadas).toEqual([true]);
    expect(typeof paso?.cleanup).toBe("function");
  });

  it("con movimiento reducido nunca se enciende", () => {
    expect(correr("186", "190", true).llamadas).not.toContain(true);
  });

  it("sin cambio no hace nada", () => {
    expect(correr("186", "186").paso).toBeNull();
  });
});

