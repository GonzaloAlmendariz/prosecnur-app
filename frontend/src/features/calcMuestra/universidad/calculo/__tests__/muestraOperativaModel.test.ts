import { describe, expect, it } from "vitest";
import { muestraOperativa } from "../muestraOperativaModel";

describe("muestraOperativa", () => {
  it("lee los tres números del resultado y deriva el porcentaje", () => {
    const m = muestraOperativa({
      resultado: { n_teorico: 2371, n_objetivo: 2500, n_operativo: 3750, sobremuestra: 1250 },
    });
    expect(m.nFormula).toBe(2371);
    expect(m.nObjetivo).toBe(2500);
    expect(m.sobremuestra).toBe(1250);
    expect(m.nOperativo).toBe(3750);
    expect(m.sobremuestraPct).toBeCloseTo(0.5, 4);
    expect(m.listo).toBe(true);
  });

  it("deduce la sobremuestra de la diferencia si el motor no la publica", () => {
    const m = muestraOperativa({ resultado: { n_objetivo: 2500, n_operativo: 3750 } });
    expect(m.sobremuestra).toBe(1250);
    expect(m.listo).toBe(true);
  });

  it("un cero o un nulo NO son una muestra resuelta", () => {
    // Number(null) === 0: si el «sin dato» se colara como cero, la pestaña
    // anunciaría una muestra de 0 en vez de decir que falta calcularla.
    expect(muestraOperativa({ resultado: { n_objetivo: 0, n_operativo: 0 } }).listo).toBe(false);
    expect(muestraOperativa({ resultado: { n_objetivo: null, n_operativo: null } }).listo).toBe(false);
    expect(muestraOperativa({ resultado: {} }).listo).toBe(false);
    expect(muestraOperativa({ resultado: null }).listo).toBe(false);
    expect(muestraOperativa(null).listo).toBe(false);
  });

  it("con objetivo pero sin operativa NO está listo: no hay nada que repartir", () => {
    // La cuota es el reparto de la OPERATIVA. Dar esto por resuelto dejaría al
    // paso siguiente prometiendo titulares que no puede calcular.
    const m = muestraOperativa({ resultado: { n_teorico: 2371, n_objetivo: 2500 } });
    expect(m.nObjetivo).toBe(2500);
    expect(m.nOperativo).toBeNull();
    expect(m.sobremuestra).toBeNull();
    expect(m.listo).toBe(false);
  });

  it("una operativa que no supera al objetivo no inventa sobremuestra", () => {
    const m = muestraOperativa({ resultado: { n_objetivo: 2500, n_operativo: 2500 } });
    expect(m.sobremuestra).toBeNull();
    expect(m.sobremuestraPct).toBeNull();
    // Pero la muestra SÍ está resuelta: se sale a buscar 2.500 sin colchón.
    expect(m.listo).toBe(true);
  });
});
