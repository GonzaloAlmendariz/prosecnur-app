import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalcMuestraAulasCriterioRadiografiaV2Distribution } from "../../../../../api/calcMuestraCriteriosRadiografia";
import { DistribucionCategoria, dominioComun } from "../DistribucionCategoria";

type Dist = CalcMuestraAulasCriterioRadiografiaV2Distribution;

/**
 * F111 · Densidad, boxplot y cuantiles sobre un solo eje.
 *
 * Lo que estas pruebas vigilan es que React **no calcule** lo que el motor no
 * publicó, y que las tres capas se proyecten sobre la MISMA escala: sin eso el
 * gráfico deja de comparar, que es lo único para lo que existe.
 */
function dist(over: Partial<Dist> = {}): Dist {
  return {
    media: 32.3,
    p10: 17,
    p25: 24,
    p50: 33,
    p75: 39,
    p90: 45,
    min: 4,
    max: 96,
    bigote_inf: 6,
    bigote_sup: 61,
    n_atipicos: 7,
    hist_breaks: [0, 20, 40, 60, 80, 100],
    hist_counts: [40, 210, 190, 90, 24],
    ...over,
  };
}

const dominio = { min: 0, max: 100 };

function render(over: Partial<Dist> = {}, conTotal = true) {
  return renderToStaticMarkup(
    <DistribucionCategoria
      elegible={{ nCh: 554, distribucion: dist(over) }}
      total={{ nCh: 697, distribucion: conTotal ? dist({ media: 28.3 }) : null }}
      dominio={dominio}
    />,
  );
}

describe("dominioComun", () => {
  it("abarca los extremos de todas las categorías, no los de cada una", () => {
    const d = dominioComun([
      dist({ min: 4, max: 96, hist_breaks: [4, 50, 96], hist_counts: [1, 1] }),
      dist({ min: 120, max: 300, bigote_inf: 120, bigote_sup: 300, p10: 130, p90: 280, media: 200, hist_breaks: [120, 200, 300], hist_counts: [1, 1] }),
    ]);
    expect(d).toEqual({ min: 4, max: 300 });
  });

  it("sin ninguna distribución no inventa una escala", () => {
    expect(dominioComun([null, undefined])).toBeNull();
  });

  it("un solo valor no colapsa la escala a ancho cero", () => {
    const d = dominioComun([
      { media: 5, p10: 5, p25: 5, p50: 5, p75: 5, p90: 5, min: 5, max: 5 } as Dist,
    ]);
    // Un ancho cero haría que toda posición cayera en el mismo píxel.
    expect(d!.max).toBeGreaterThan(d!.min);
  });
});

describe("DistribucionCategoria · las tres capas", () => {
  it("dibuja la densidad desde el histograma del motor", () => {
    const html = render();
    expect(html).toContain("cmv2-dist-densidad");
    expect(html).toContain("<polygon");
  });

  it("sin histograma no dibuja densidad, y el resto sigue", () => {
    // Entre P10 y P90 hay infinitas formas: interpolar una es inventarla.
    const html = render({ hist_breaks: undefined, hist_counts: undefined });
    expect(html).not.toContain("cmv2-dist-densidad");
    expect(html).toContain("cmv2-dist-caja");
    expect(html).toContain("P50");
  });

  it("los bigotes son los de Tukey que publica el motor, no P10/P90", () => {
    const html = render();
    // bigote_inf=6 sobre dominio 0..100 → 6%. P10=17 daría 17%.
    expect(html).toContain("left:6%");
    expect(html).not.toContain("left:17%;width:");
  });

  it("sin bigotes de Tukey cae a P10/P90 y lo DECLARA", () => {
    // Cambiar de convención en silencio es peor que no dibujar la caja.
    const html = render({ bigote_inf: null, bigote_sup: null });
    expect(html).toContain("bigotes en P10–P90");
  });

  it("las tres capas se proyectan sobre la misma escala", () => {
    const html = render();
    // La mediana (33 de 0..100) cae en 33% tanto en la caja como en su tick.
    expect(html.match(/left:33%/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("DistribucionCategoria · cuantiles bajo su posición", () => {
  it("cada etiqueta lleva su valor y su marca", () => {
    const html = render();
    for (const [label, valor] of [["P10", "17"], ["P25", "24"], ["P50", "33"], ["P75", "39"], ["P90", "45"]]) {
      expect(html).toContain(`<dt>${label}</dt><dd>${valor}</dd>`);
    }
  });

  it("las marcas NO se desplazan aunque las etiquetas se separen", () => {
    // Distribución apretada: P25 y P50 caen a 1 punto de distancia. Las
    // etiquetas se reparten para no solaparse, pero mover la marca cambiaría
    // dónde el lector cree que está el dato.
    const html = render({ p10: 30, p25: 31, p50: 32, p75: 33, p90: 34 });
    const ticks = /<div class="cmv2-dist-ticks"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "";
    for (const x of ["30%", "31%", "32%", "33%", "34%"]) expect(ticks).toContain(`left:${x}`);
  });

  it("un cuantil ausente no deja hueco ni corre a los demás", () => {
    const html = render({ p10: null });
    expect(html).not.toContain("<dt>P10</dt>");
    expect(html).toContain("<dt>P25</dt><dd>24</dd>");
  });
});

describe("DistribucionCategoria · el conmutador", () => {
  it("ofrece elegibles y todos, con sus CH", () => {
    const html = render();
    expect(html).toContain("Elegibles");
    expect(html).toContain("554");
    expect(html).toContain("697");
  });

  it("arranca en elegibles: es la vista que decide", () => {
    const html = render();
    const eleg = /<button[^>]*aria-pressed="true"[^>]*>([\s\S]*?)<\/button>/.exec(html)?.[1] ?? "";
    expect(eleg).toContain("Elegibles");
  });

  it("sin distribución total no ofrece un conmutador de una sola opción", () => {
    const html = render({}, false);
    expect(html).not.toContain("cmv2-dist-switch");
    expect(html).toContain("cmv2-dist-caja");
  });
});

describe("DistribucionCategoria · lo que no se ve", () => {
  it("el gráfico publica su equivalente en texto", () => {
    // Quien ve el gráfico no puede tener más información que quien no lo ve.
    const html = render();
    const label = /role="img" aria-label="([^"]+)"/.exec(html)?.[1] ?? "";
    expect(label).toContain("media");
    expect(label).toContain("mediana");
    expect(label).toContain("mitad central");
    expect(label).toContain("bigotes");
    expect(label).toContain("7 atípicos");
  });

  it("declara cuántos quedan fuera de los bigotes", () => {
    expect(render()).toContain("7 atípicos fuera de los bigotes");
  });

  it("un solo atípico concuerda en singular", () => {
    const html = render({ n_atipicos: 1 });
    expect(html).toContain("1 atípico fuera");
    expect(html).not.toContain("atípicos fuera");
  });

  it("sin atípicos no menciona el asunto", () => {
    expect(render({ n_atipicos: 0 })).not.toContain("fuera de los bigotes");
  });

  it("sin distribución ni escala declara la ausencia", () => {
    const html = renderToStaticMarkup(
      <DistribucionCategoria
        elegible={{ nCh: 0, distribucion: null }}
        total={{ nCh: 0, distribucion: null }}
        dominio={null}
      />,
    );
    expect(html).toContain("sin distribución publicada");
  });
});
