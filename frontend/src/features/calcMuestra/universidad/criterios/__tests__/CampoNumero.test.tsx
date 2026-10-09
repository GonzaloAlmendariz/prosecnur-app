import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CampoNumero, numeroConfirmable } from "../CampoNumero";

/**
 * Los casos son los que Gonzalo encontró el 2026-08-25 declarando los criterios
 * de HSVG 2026: el mínimo de elegibles saltando a 100 al intentar escribir 20
 * («agrego un valor y me agrega ceros»), y el rango de nivel intercambiándose a
 * mitad de teclear 10.
 *
 * La causa era emitir en cada pulsación y acotar el valor intermedio. Ahora el
 * texto vive en el campo hasta que se confirma; lo que se prueba aquí es la
 * decisión de qué texto merece emitirse.
 */
describe("numeroConfirmable", () => {
  it("un campo vacío NO es cero: se revierte", () => {
    // `Number("")` es 0 y `Number.isFinite(0)` es cierto — el bug entero cabía
    // en esas dos llamadas.
    expect(numeroConfirmable("")).toBeNull();
    expect(numeroConfirmable("   ")).toBeNull();
  });

  it("un texto ilegible se revierte en vez de emitir NaN", () => {
    expect(numeroConfirmable("abc")).toBeNull();
    expect(numeroConfirmable("-")).toBeNull();
  });

  it("emite el número tecleado tal cual, sin acotarlo", () => {
    // Acotar es del llamador: el campo no puede saber si un 5 por debajo del
    // mínimo debe subir a 10 o rechazarse, y decidirlo aquí fue lo que convertía
    // un «2» a medio escribir en un «10».
    expect(numeroConfirmable("20")).toBe(20);
    expect(numeroConfirmable("5")).toBe(5);
    expect(numeroConfirmable("0")).toBe(0);
  });

  it("acepta el cero EXPLÍCITO, que sí es una intención", () => {
    expect(numeroConfirmable("0")).toBe(0);
  });
});

describe("CampoNumero", () => {
  const render = (over: Partial<Parameters<typeof CampoNumero>[0]> = {}) =>
    renderToStaticMarkup(
      <CampoNumero valor={20} min={0} max={100} ariaLabel="umbral" onConfirmar={() => {}} {...over} />,
    );

  it("pinta el valor vigente y conserva el afijo", () => {
    const html = render({ sufijo: "%" });
    expect(html).toContain('type="number"');
    expect(html).toContain('value="20"');
    expect(html).toContain("%");
  });

  it("conserva el contrato del control: rango, paso e identificador", () => {
    const html = render({ min: 10, max: 40, paso: 5, id: "umbral-n" });
    expect(html).toContain('min="10"');
    expect(html).toContain('max="40"');
    expect(html).toContain('step="5"');
    expect(html).toContain('id="umbral-n"');
  });
});
