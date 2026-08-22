/**
 * El recorrido de preparación, renderizado de verdad.
 *
 * Este panel sólo aparece con `!selectionReady` y el proyecto de trabajo ya
 * tiene selección, así que no se puede observar en pantalla. Al repararlo se
 * aisló la decisión en `pasoMetodoElegido` afirmando que «el frontend no tiene
 * entorno DOM en los tests» — cierto que no hay jsdom, pero
 * `metodoGooEsquema.test.tsx` renderiza con `renderToStaticMarkup` y comprueba
 * el markup. La vía existía. Esto es lo que faltaba: verificar que el texto
 * reparado llega al HTML, no sólo que la función lo devuelve.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClassroomSelectionPreparationPanel } from "../ClassroomSelectionPanels";

const render = (props: Parameters<typeof ClassroomSelectionPreparationPanel>[0]) =>
  renderToStaticMarkup(<ClassroomSelectionPreparationPanel {...props} />);

const base = {
  frameReady: true,
  frameCount: 2616,
  targetForDisplay: 190,
  m1ForDisplay: 0,
};

describe("el panel de preparación pinta lo que decidió pasoMetodoElegido", () => {
  it("con método vigente y sin comparar, el paso sale resuelto y nombrado", () => {
    const html = render({ ...base, comparisonReady: false, recommendedMethodLabel: "", metodoVigenteLabel: "Sistemático por facultad" });
    expect(html).toContain("Método elegido");
    expect(html).toContain("Sistemático por facultad");
    // Lo que decía antes y era falso desde que comparar dejó de ser requisito.
    expect(html).not.toContain("Método comparado");
    expect(html).not.toContain("por comparar");
    expect(html).not.toContain("La app elige");
  });

  it("sin método vigente dice que falta elegir", () => {
    const html = render({ ...base, comparisonReady: false, recommendedMethodLabel: "", metodoVigenteLabel: undefined });
    expect(html).toContain("sin elegir");
  });

  it("el paso se marca listo por el método, no por la comparación", () => {
    const conMetodo = render({ ...base, comparisonReady: false, recommendedMethodLabel: "", metodoVigenteLabel: "Optimizar repetidos" });
    const sinMetodo = render({ ...base, comparisonReady: true, recommendedMethodLabel: "X", metodoVigenteLabel: undefined });
    expect(conMetodo).toContain("is-ready");
    // Con comparación pero sin método vigente, ese paso NO puede estar resuelto.
    expect(sinMetodo).toContain("is-working");
  });

  it("los otros tres pasos del recorrido siguen ahí", () => {
    const html = render({ ...base, comparisonReady: true, recommendedMethodLabel: "X", metodoVigenteLabel: "X" });
    for (const paso of ["1.", "2.", "3.", "4."]) {
      expect(html, `falta el paso ${paso}`).toContain(paso);
    }
  });
});
