// I5 del rediseño (2026-10-14). Mata: un plegar sin `aria-expanded` que siga al estado, un conteo que no diga cuántas
// láminas piden atención, o un capítulo sin «+ Lámina».
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FilaCapitulo, textoConteo } from "./FilaCapitulo";
import type { FilaVistaGeneral } from "./modeloVistaGeneral";

const fila = { id: "c1", clase: "capitulo", numero: "1", titulo: "Satisfacción", rotulo: "1. Satisfacción", tarjetas: [], ids: ["a", "b"],
  conteo: { laminas: 2, conGrafico: 1, incompletas: 1 } } as unknown as FilaVistaGeneral;
const nada = () => undefined;
const pintar = (plegado: boolean, atencion: number) => renderToStaticMarkup(createElement(FilaCapitulo, {
  fila, indiceCapitulo: 0, totalCapitulos: 2, arrastrada: false, soltarCapitulo: null, soltarAlFinal: false,
  onMoverCapitulo: nada, onArrastrarCapitulo: nada, onSobreFila: nada, onSobreFinFila: nada, onSoltar: nada, onFinArrastre: nada,
  plegado, onPlegar: nada, atencion, onAgregar: nada, children: null,
}));

describe("capítulo plegable del Informe", () => {
  it("el botón de plegar dice su estado y controla el cuerpo", () => {
    expect(pintar(false, 0)).toContain('aria-expanded="true"');
    const plegada = pintar(true, 0);
    expect(plegada).toContain('aria-expanded="false"');
    expect(plegada).toContain("is-plegado");
    expect(plegada).toContain('aria-controls="pulso-f6-vg-fila-c1-cuerpo"');
    expect(plegada).toContain('id="pulso-f6-vg-fila-c1-cuerpo"');
  });

  it("lleva «+ Lámina» y el conteo con lo que pide atención", () => {
    expect(pintar(false, 1)).toContain('aria-label="Agregar una lámina al final de 1. Satisfacción"');
    expect(textoConteo(fila.conteo, 1)).toBe("2 láminas · 1 con gráfico · 1 pide atención");
    expect(textoConteo(fila.conteo)).toBe("2 láminas · 1 con gráfico · 1 incompleta");
  });
});
