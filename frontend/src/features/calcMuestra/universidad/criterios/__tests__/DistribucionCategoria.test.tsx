import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalcMuestraAulasCriterioRadiografiaV2Distribution } from "../../../../../api/calcMuestraCriteriosRadiografia";
import { DistribucionCategoria, dominioComun } from "../DistribucionCategoria";
import { dominioCategorias } from "../CategoriaEvidencia";

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

function render(over: Partial<Dist> = {}) {
  return renderToStaticMarkup(
    <DistribucionCategoria elegible={{ nCh: 554, distribucion: dist(over) }} dominio={dominio} />,
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
    expect(html).toContain("Mediana");
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

describe("DistribucionCategoria · guías y cuartiles (F116)", () => {
  // Gonzalo: «si el boxplot tiene una caja que muestra Q1, la mediana y Q3, los
  // cuantiles de abajo tienen que reflejar eso — no el P10 ni el P90, sino los
  // cuartiles, para que haya una línea punteada que atraviese los tres
  // gráficos».
  it("las guías son exactamente las cuatro que la caja dibuja", () => {
    const html = render();
    for (const g of ["p25", "p50", "media", "p75"]) {
      expect(html, g).toContain(`data-guia="${g}"`);
    }
    // Una guía en P10 apuntaría a una marca que el boxplot no tiene.
    expect(html).not.toContain('data-guia="p10"');
    expect(html).not.toContain('data-guia="p90"');
  });

  it("la fila de abajo nombra los cuartiles, no los percentiles extremos", () => {
    const html = render();
    expect(html).toContain("<dt>Q1</dt><dd>24</dd>");
    expect(html).toContain("<dt>Mediana</dt><dd>33</dd>");
    expect(html).toContain("<dt>Q3</dt><dd>39</dd>");
    expect(html).toContain("<dt>Media</dt>");
    expect(html).not.toContain("<dt>P10</dt>");
    expect(html).not.toContain("<dt>P90</dt>");
  });

  it("la guía cae en la misma x que su marca en la caja", () => {
    // Es lo único que hace útil una guía: si se desviara, señalaría un punto
    // que el gráfico no tiene.
    const html = render({ p50: 50 });
    const guia = /data-guia="p50" style="left:([\d.]+)%"/.exec(html)?.[1];
    const marca = /class="cmv2-dist-mediana" style="left:([\d.]+)%"/.exec(html)?.[1];
    expect(guia).toBeDefined();
    expect(guia).toBe(marca);
  });

  it("una guía sin valor publicado no se dibuja", () => {
    const html = render({ media: null });
    expect(html).not.toContain('data-guia="media"');
    expect(html).toContain('data-guia="p50"');
  });

  it("las etiquetas se separan sin mover la guía", () => {
    // Distribución apretada: Q1, mediana y Q3 casi encima. Las etiquetas se
    // reparten, la guía conserva su posición.
    const html = render({ p25: 31, p50: 32, p75: 33, media: 32.5 });
    expect(html).toContain('data-guia="p25" style="left:31%"');
    expect(html).toContain('data-guia="p75" style="left:33%"');
  });
});

describe("DistribucionCategoria · el eje (F112)", () => {
  // Gonzalo: «no sólo debe estar claro cuáles son los puntos del eje x que
  // forman parte de los cuartiles, sino el eje en general — cuáles son los
  // límites, cuáles son los puntos más importantes».
  it("rotula el eje con números redondos, no con los extremos del dominio", () => {
    const html = render();
    const eje = /<div class="cmv2-dist-eje"[^>]*>([\s\S]*?)<\/div><div class="cmv2-dist-cuantiles"/.exec(html)?.[1] ?? html;
    // Dominio 0..100 → cortes de 20 en 20. Un eje rotulado con 6,4 · 21,7 se
    // lee peor que 20 · 40 aunque describa lo mismo.
    for (const v of ["0", "20", "40", "60", "80", "100"]) {
      expect(eje).toContain(`<b>${v}</b>`);
    }
  });

  it("los cortes del eje caen en su posición real de la escala", () => {
    const html = render();
    // 20 sobre 0..100 → 20%. Si el eje se repartiera por igual, no coincidiría.
    expect(html).toContain("left:20%");
    expect(html).toContain("left:60%");
  });

  it("no dibuja eje cuando la escala es degenerada", () => {
    const html = renderToStaticMarkup(
      <DistribucionCategoria
        elegible={{ nCh: 1, distribucion: dist() }}
        dominio={{ min: 5, max: 5 }}
      />,
    );
    expect(html).not.toContain("cmv2-dist-eje");
  });

  it("ya no ofrece conmutador: la distribución que decide es la de elegibles", () => {
    expect(render()).not.toContain("cmv2-dist-switch");
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
    expect(label).toContain("7 atípicos");  // el equivalente en texto sí los enumera
  });

  it("los atípicos son marcas en el gráfico, no una frase al pie", () => {
    // F114 · «19 atípicos fuera de los bigotes» obliga a traducir una oración a
    // una posición. La marca se lee donde ocurre.
    const html = render({ n_atipicos: 7, n_atipicos_inf: 2, n_atipicos_sup: 5 });
    expect(html).not.toContain("fuera de los bigotes");
    expect(html).toContain('data-lado="inf"');
    expect(html).toContain('data-n="2"');
    expect(html).toContain('data-lado="sup"');
    expect(html).toContain('data-n="5"');
  });

  it("sólo marca el lado que tiene atípicos", () => {
    const html = render({ n_atipicos: 5, n_atipicos_inf: 0, n_atipicos_sup: 5 });
    expect(html).not.toContain('data-lado="inf"');
    expect(html).toContain('data-lado="sup"');
  });

  it("sin atípicos no dibuja ninguna marca", () => {
    const html = render({ n_atipicos: 0, n_atipicos_inf: 0, n_atipicos_sup: 0 });
    expect(html).not.toContain("cmv2-dist-atipico");
  });

  it("sin el desglose por lado no inventa marcas", () => {
    // Un marco anterior a F114 publica el total pero no los lados.
    const html = render({ n_atipicos: 7, n_atipicos_inf: null, n_atipicos_sup: null });
    expect(html).not.toContain("cmv2-dist-atipico");
  });

  it("sin distribución ni escala declara la ausencia", () => {
    const html = renderToStaticMarkup(
      <DistribucionCategoria elegible={{ nCh: 0, distribucion: null }} dominio={null} />,
    );
    expect(html).toContain("sin distribución publicada");
  });
});

describe("DistribucionCategoria · nada se dibuja fuera de su caja (F113)", () => {
  /**
   * Medido en la app con datos del motor: el gráfico pintaba `left: -11%`,
   * `width: 178%`, topes en `167%` y un polígono de densidad de −66 a 592. La
   * escala salía sólo de P10..P90 y la media, mientras el dibujo incluye los
   * bigotes de Tukey y el histograma — que van mucho más lejos.
   *
   * **Ninguna prueba lo vio porque todos los fixtures usaban un dominio 0..100
   * que cubría cualquier valor.** Un dominio holgado en el fixture esconde
   * exactamente el defecto que produce un dominio ajustado.
   */
  const REAL = {
    media: 31.1, p10: 17.8, p25: 23, p50: 30, p75: 38, p90: 43,
    min: 6, max: 90, bigote_inf: 15, bigote_sup: 60, n_atipicos: 12,
    hist_breaks: [6, 20, 34, 48, 62, 76, 90],
    hist_counts: [30, 210, 190, 80, 20, 4],
  } as Dist;

  function porcentajes(html: string): number[] {
    const out: number[] = [];
    for (const m of html.matchAll(/(?:left|width):\s*(-?[\d.]+)%/g)) out.push(Number(m[1]));
    // El polígono de la densidad también va en coordenadas del viewBox 0..100.
    const poly = /points="([^"]+)"/.exec(html)?.[1];
    if (poly) for (const par of poly.split(" ")) out.push(Number(par.split(",")[0]));
    return out.filter((n) => Number.isFinite(n));
  }

  it("con la escala ajustada al dato, todo cae dentro de 0–100", () => {
    // El dominio se toma de la MISMA función que usa la tarjeta, no a mano.
    const html = renderToStaticMarkup(
      <DistribucionCategoria
        elegible={{ nCh: 639, distribucion: REAL }}
        dominio={dominioComun([REAL])}
      />,
    );
    const fuera = porcentajes(html).filter((v) => v < -0.01 || v > 100.01);
    expect(fuera, `posiciones fuera de rango: ${fuera.join(", ")}`).toEqual([]);
  });

  it("el dominio abarca bigotes e histograma, no sólo los cuantiles", () => {
    // Si volviera a calcularse con P10..P90 daría [17,8 · 43] y el bigote
    // inferior (15) quedaría a la izquierda del origen.
    const d = dominioComun([REAL])!;
    expect(d.min).toBeLessThanOrEqual(6);
    expect(d.max).toBeGreaterThanOrEqual(90);
  });
});

describe("DistribucionCategoria · el corte de un umbral (F117)", () => {
  // Gonzalo: «si vamos a definir un mínimo de alumnos por facultad, tenemos que
  // saber cuál es la cantidad de alumnos elegibles que hay, porque eso nos va a
  // permitir definir si el mínimo es de veinte o de diez».
  //
  // Un criterio de umbral no decide qué categorías entran: decide DÓNDE cortar.
  // Sin el corte dibujado, la tarjeta muestra una distribución que no responde
  // la única pregunta que se está haciendo.
  const conCorte = (valor: number) =>
    renderToStaticMarkup(
      <DistribucionCategoria
        elegible={{ nCh: 120, distribucion: dist() }}
        dominio={dominio}
        umbral={{ valor }}
      />,
    );

  it("dibuja el corte sobre la misma escala que la distribución", () => {
    // 20 sobre 0..100 → 20%. Si usara otra escala señalaría otro valor.
    expect(conCorte(20)).toContain('class="cmv2-dist-umbral" aria-hidden="true" style="left:20%"');
  });

  it("rotula el corte con su valor", () => {
    expect(conCorte(20)).toContain("<b>20</b>");
  });

  it("sin umbral no dibuja corte: los criterios categóricos no lo tienen", () => {
    expect(render()).not.toContain("cmv2-dist-umbral");
  });

  it("el corte entra en la escala: el caso grave es el que hay que ver", () => {
    // Un mínimo mayor que el máximo observado deja fuera TODOS los
    // cursos-horario. Si el dominio no lo incluyera, el corte se pintaría fuera
    // del contenedor y ese caso sería el único invisible. Misma regla que F113.
    const dom = dominioCategorias([{ distribucion: dist() } as never], 500)!;
    expect(dom.max).toBeGreaterThanOrEqual(500);
    const html = renderToStaticMarkup(
      <DistribucionCategoria
        elegible={{ nCh: 120, distribucion: dist() }}
        dominio={dom}
        umbral={{ valor: 500 }}
      />,
    );
    const x = Number(/class="cmv2-dist-umbral"[^>]*left:([\d.]+)%/.exec(html)?.[1]);
    expect(x).toBeLessThanOrEqual(100);
    // Y la distribución se apretuja a la izquierda, que es la lectura correcta.
    const caja = Number(/class="cmv2-dist-caja"[^>]*left:([\d.]+)%/.exec(html)?.[1]);
    expect(caja).toBeLessThan(20);
  });
});

describe("DistribucionCategoria · coherencia y etiquetas (F119)", () => {
  it("no dibuja una densidad que no cubre la caja", () => {
    // Medido en la hoja de revisión: un histograma que acababa en 36 sobre una
    // caja que llegaba a 81 se veía como una rampa cortada a la mitad. Con datos
    // del motor ambos salen del mismo vector; un desajuste significa cifras de
    // dos sitios distintos. Media densidad sugiere que la masa se acaba donde
    // termina el trazo.
    const html = render({
      p25: 31, p75: 51, bigote_inf: 11, bigote_sup: 81,
      hist_breaks: [4, 12, 20, 28, 36], hist_counts: [1, 5, 14, 31],
    });
    expect(html).not.toContain("cmv2-dist-densidad");
    // El resto de las capas sigue: lo que falla es la densidad, no la tarjeta.
    expect(html).toContain("cmv2-dist-caja");
  });

  it("con el histograma cubriendo la caja sí la dibuja", () => {
    const html = render({
      p25: 31, p75: 51, bigote_inf: 11, bigote_sup: 81,
      hist_breaks: [4, 24, 44, 64, 84], hist_counts: [1, 5, 14, 31],
    });
    expect(html).toContain("cmv2-dist-densidad");
  });

  it("las etiquetas que chocan bajan de fila, no se desplazan", () => {
    // Mediana 40 y media 41,6: el empuje en cascada mandaba «MEDIA» lejos de su
    // guía y arrastraba «Q3» detrás. Una etiqueta que no está bajo su marca
    // deja de nombrarla.
    const html = render({ p25: 31, p50: 40, media: 41.6, p75: 51 });
    expect(html).toContain('data-fila="1"');
    // Lo que importa no es en qué fila cae cada una, sino que TODAS conserven
    // su x: una etiqueta desplazada deja de nombrar la marca que tiene encima.
    for (const [marca, x] of [["p25", "31%"], ["p50", "40%"], ["media", "41.6%"], ["p75", "51%"]]) {
      expect(html, marca).toContain(`data-marca="${marca}" data-fila=`);
      expect(html, marca).toMatch(new RegExp(`data-marca="${marca}" data-fila="[0-9]" style="left:${x.replace(".", "\\.")}"`));
    }
    // G18 · Ninguna pareja en la misma fila puede quedar a menos de la
    // separación mínima. Medido en la app antes de esto: 27 solapes.
    const pares = [...html.matchAll(/data-fila="(\d)" style="left:([\d.]+)%"/g)]
      .map((m) => ({ fila: m[1], x: Number(m[2]) }));
    for (let i = 0; i < pares.length; i++)
      for (let j = 0; j < i; j++)
        if (pares[i].fila === pares[j].fila)
          expect(Math.abs(pares[i].x - pares[j].x)).toBeGreaterThanOrEqual(13);

    // Y que dos etiquetas contiguas no acaben en la misma fila.
    const filas = [...html.matchAll(/data-marca="(\w+)" data-fila="(\d)"/g)].map((m) => m[2]);
    for (let i = 1; i < filas.length; i++) {
      if (filas[i] === filas[i - 1]) {
        // Permitido sólo si están lo bastante separadas para no chocar.
        const xs = [...html.matchAll(/data-fila="[0-9]" style="left:([\d.]+)%"/g)].map((m) => Number(m[1]));
        expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(13);
      }
    }
  });

  it("sin choques todas se quedan en la primera fila", () => {
    const html = render({ p25: 10, p50: 40, media: 55, p75: 80 });
    expect(html).not.toContain('data-fila="1"');
  });
});

describe("DistribucionCategoria · el solape es imposible por construcción (G18)", () => {
  it("cuatro marcas apiñadas usan cuatro filas, no dos encimadas", () => {
    // El caso real de la app: Q1 38, mediana 38, media 40, Q3 40 sobre 0..60.
    // Con dos filas se leía «QMEDIA» y «3840» — dos cifras superpuestas no son
    // una cifra difícil de leer, son una cifra falsa.
    const html = render({ p25: 38, p50: 38, media: 40, p75: 40 });
    const pares = [...html.matchAll(/data-fila="(\d)" style="left:([\d.]+)%"/g)]
      .map((m) => ({ fila: m[1], x: Number(m[2]) }));
    expect(pares).toHaveLength(4);
    for (let i = 0; i < pares.length; i++)
      for (let j = 0; j < i; j++)
        if (pares[i].fila === pares[j].fila)
          expect(Math.abs(pares[i].x - pares[j].x)).toBeGreaterThanOrEqual(13);
  });

  it("una distribución holgada sigue usando una sola fila", () => {
    const html = render({ p25: 10, p50: 35, media: 60, p75: 85 });
    expect(html).not.toContain('data-fila="1"');
  });
});
