import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CategoriaEvidencia, dominioCategorias, EjeCategorias } from "../CategoriaEvidencia";
import type { AporteCategoria } from "../controles";

/**
 * ADR 0057 · La categoría es la unidad de decisión.
 *
 * Estos casos fijan las dos reglas que más veces se rompieron en el módulo: la
 * escala es del criterio y no de cada caja, y React no calcula lo que el motor
 * no publicó.
 */
function aporte(over: Partial<AporteCategoria> = {}): AporteCategoria {
  return {
    ch: 120,
    chContraste: 200,
    elegibles: 3400,
    tasaAsistencia: 0.7,
    distribucion: { media: 28, p10: 10, p25: 18, p50: 26, p75: 38, p90: 55 } as never,
    ...over,
  };
}

describe("CategoriaEvidencia", () => {
  it("comparte una sola escala entre categorías, no una por caja", () => {
    // Una caja normalizada contra su propio rango sale del mismo ancho que las
    // demás y sugiere que todas las categorías se parecen. Comparar es lo único
    // para lo que este gráfico existe.
    const dominio = dominioCategorias([
      aporte(),
      aporte({ distribucion: { media: 90, p10: 70, p25: 80, p50: 88, p75: 96, p90: 120 } as never }),
    ]);
    expect(dominio).toEqual({ min: 10, max: 120 });
  });

  it("sin ninguna distribución publicada no inventa una escala", () => {
    expect(dominioCategorias([aporte({ distribucion: null }), null, undefined])).toBeNull();
  });

  it("publica CH, alumnos, cuantiles y presentes esperados en el mismo bloque", () => {
    const dominio = dominioCategorias([aporte()])!;
    const html = renderToStaticMarkup(<CategoriaEvidencia aporte={aporte()} dominio={dominio} />);
    // F111 · Las cuatro cifras que Gonzalo fijó: CH totales, CH elegibles,
    // alumnos elegibles y la tasa de asistencia previa. Sale «matrículas».
    expect(html).toContain("CH totales");
    expect(html).toContain("CH elegibles");
    expect(html).toContain("alumnos elegibles");
    expect(html).toContain("una persona cuenta una vez");
    expect(html).toContain("P50");
    expect(html).toContain("P25");
    // Presentes esperados = elegibles × tasa, redondeado. 3400 × 0,7 = 2.380.
    expect(html).toContain("2,380");
    expect(html).toContain("70%");
    expect(html).toContain("asistencia previa");
    expect(html).not.toContain("matrículas");
  });

  it("sin tasa de asistencia no la muestra ni estima presentes", () => {
    const dominio = dominioCategorias([aporte()])!;
    const html = renderToStaticMarkup(
      <CategoriaEvidencia aporte={aporte({ tasaAsistencia: null })} dominio={dominio} />,
    );
    expect(html).not.toContain("presentes");
  });

  it("declara la ausencia en vez de dibujar una caja vacía", () => {
    const html = renderToStaticMarkup(
      <CategoriaEvidencia
        aporte={aporte({ distribucion: { media: null, p25: null, p75: null } as never })}
        dominio={{ min: 0, max: 10 }}
      />,
    );
    expect(html).toContain("sin distribución publicada");
  });

  it("la escala se declara en palabras, con sus extremos y su unidad", () => {
    // Antes dibujaba marcas que NO estaban encima de las cajas —eje en x=159,
    // cajas en 637–693, cada una en su columna—. Unas marcas desalineadas son
    // decoración con aspecto de precisión: peor que no tener eje. Los extremos
    // viajan ahora pegados a cada caja, donde sí alinean.
    const html = renderToStaticMarkup(<EjeCategorias dominio={{ min: 10, max: 120 }} />);
    // Los extremos se comprueban DENTRO de la frase de la escala, no sueltos:
    // un «10» o un «120» pueden venir de cualquier parte del HTML —una clase,
    // otra cifra— y la aserción pasaría sin probar nada.
    const nota = /<p class="cmv2-cat-escala-nota">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
    expect(nota).toContain("Escala común del criterio");
    expect(nota).toContain("estudiantes elegibles por curso-horario");
    expect(nota).toContain(">10<");
    expect(nota).toContain(">120<");
  });

  it("declara qué significa cada marca del gráfico", () => {
    // La tarjeta dibuja cuatro marcas y no decía qué era ninguna: sólo el
    // `aria-label` lo explicaba, así que quien VE el gráfico tenía menos
    // información que quien no lo ve. La leyenda va una vez por criterio.
    const html = renderToStaticMarkup(<EjeCategorias dominio={{ min: 10, max: 120 }} />);
    // F111 · La leyenda describe el gráfico ACTUAL. Decía «de P10 a P90» para
    // los bigotes; con el boxplot estándar son los de Tukey. Una leyenda que
    // sobrevive al gráfico que describía se lee con la misma confianza que una
    // cifra, y es igual de falsa.
    expect(html).toContain("densidad");
    expect(html).toContain("mitad central (P25–P75)");
    expect(html).toContain("mediana");
    expect(html).toContain("media");
    expect(html).toContain("bigotes de Tukey");
    expect(html).not.toContain("de P10 a P90");
  });

  it("el gráfico declara la escala común bajo el que la usa", () => {
    const dominio = dominioCategorias([aporte()])!;
    const html = renderToStaticMarkup(<CategoriaEvidencia aporte={aporte()} dominio={dominio} />);
    expect(html).toContain("escala común del criterio");
  });
});

describe("CategoriaEvidencia · categoría sin cursos en la facultad", () => {
  it("dice que no hay cursos y calla los cuantiles vacíos", () => {
    // Cinco guiones (P10 — P25 — Mediana — …) no informan nada cuando la
    // categoría tiene 0 CH: sólo gastan atención. Quitarlos no quita
    // información; dejarlos sí quita foco de las categorías que sí deciden.
    // F105 · `chContraste: 0` es lo que hace de esta categoría una ausencia
    // real y no una exclusión. Antes el fixture heredaba 200 del contraste por
    // defecto, así que este caso probaba —sin saberlo— la categoría excluida.
    const html = renderToStaticMarkup(
      <CategoriaEvidencia
        aporte={aporte({ ch: 0, elegibles: 0, chContraste: 0, mediaContraste: null })}
        dominio={{ min: 10, max: 60 }}
      />,
    );
    expect(html).toContain("sin cursos-horario en esta facultad");
    expect(html).not.toContain("P50");
    expect(html).not.toContain("cmv2-dist-caja");
  });

  it("una categoría excluida tampoco dibuja caja ni cuantiles", () => {
    // El silencio de la distribución vale para los dos ceros: sin CH incluidos
    // no hay nada que distribuir, venga de donde venga el cero.
    const html = renderToStaticMarkup(
      <CategoriaEvidencia
        aporte={aporte({ ch: 0, elegibles: 0, chContraste: 200 })}
        dominio={{ min: 10, max: 60 }}
      />,
    );
    expect(html).not.toContain("P50");
    expect(html).not.toContain("cmv2-cat-caja");
  });

  it("con cursos, los cuantiles siguen enteros", () => {
    const html = renderToStaticMarkup(
      <CategoriaEvidencia aporte={aporte()} dominio={{ min: 10, max: 60 }} />,
    );
    expect(html).toContain("P50");
    expect(html).not.toContain("sin cursos-horario en esta facultad");
  });
});

describe("CategoriaEvidencia · lo que F111 retiró", () => {
  // Gonzalo: «sin matrículas elegibles, debe ser solo CH totales, CH elegibles,
  // alumnos elegibles y (si se tiene información) la tasa de asistencia previa».
  // F105 había puesto matrículas para separar los dos granos; con «alumnos
  // elegibles» rotulado y los CH al lado, era una casilla que no decidía nada.
  it("no muestra matrículas ni la cobertura parcial del dato", () => {
    const html = renderToStaticMarkup(
      <CategoriaEvidencia
        aporte={aporte({ matriculas: 19846, chConDato: 90, ch: 120 })}
        dominio={{ min: 10, max: 60 }}
      />,
    );
    expect(html).not.toContain("matrícula");
    expect(html).not.toContain("distribución sobre");
    // Lo que sí queda, con su grano dicho.
    expect(html).toContain("alumnos elegibles");
    expect(html).toContain("una persona cuenta una vez");
  });
});

describe("CategoriaEvidencia · los dos ceros no significan lo mismo (F105)", () => {
  // `ch` es el segmento ∩ lo que sigue incluido, así que llega a 0 por dos
  // caminos: la facultad no tiene esos cursos, o un criterio los dejó fuera.
  // Tratarlos igual mentía en el segundo caso y encima ocultaba el contraste.
  it("una categoría excluida dice que está fuera, no que no existe", () => {
    const html = renderToStaticMarkup(
      <CategoriaEvidencia
        aporte={aporte({ ch: 0, elegibles: 0, chContraste: 200, mediaContraste: 24 })}
        dominio={{ min: 10, max: 60 }}
      />,
    );
    expect(html).toContain("Fuera del marco");
    expect(html).toContain("200");
    expect(html).not.toContain("sin cursos-horario en esta facultad");
    // El contraste vuelve: es lo único que dice cuánto se está dejando fuera.
    expect(html).toContain("En todos los cursos-horario");
  });

  it("una categoría que de verdad no existe aquí lo dice tal cual", () => {
    const html = renderToStaticMarkup(
      <CategoriaEvidencia
        aporte={aporte({ ch: 0, elegibles: 0, chContraste: 0, mediaContraste: null })}
        dominio={{ min: 10, max: 60 }}
      />,
    );
    expect(html).toContain("sin cursos-horario en esta facultad");
    expect(html).not.toContain("Fuera del marco");
  });
});

describe("CategoriaEvidencia · el singular existe (F107)", () => {
  // Medido en la app con datos reales: «sus 1 cursos-horario». Ninguna prueba
  // lo cazó porque todos los fixtures traían valores plurales, así que la rama
  // del singular no se ejecutaba. Un guard prueba lo que se le da a probar.
  it("una categoría excluida con un solo CH concuerda", () => {
    const html = renderToStaticMarkup(
      <CategoriaEvidencia
        aporte={aporte({ ch: 0, elegibles: 0, chContraste: 1, mediaContraste: 12 })}
        dominio={{ min: 10, max: 60 }}
      />,
    );
    const efecto = /<p class="cmv2-cat-efecto" data-estado="fuera">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
    expect(efecto).toContain("su <strong>1</strong> curso-horario");
    expect(efecto).toContain("no entra con");
    expect(efecto).not.toContain("cursos-horario");
  });

  it("una categoría dentro con un CH y un estudiante concuerda", () => {
    const html = renderToStaticMarkup(
      <CategoriaEvidencia aporte={aporte({ ch: 1, elegibles: 1 })} dominio={{ min: 10, max: 60 }} />,
    );
    const efecto = /<p class="cmv2-cat-efecto" data-estado="dentro">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
    expect(efecto).toContain("<strong>1</strong> curso-horario");
    expect(efecto).toContain("<strong>1</strong> estudiante");
    expect(efecto).not.toContain("estudiantes");
  });
});

describe("CategoriaEvidencia · efecto en el embudo (ADR 0057, contenido 5)", () => {
  it("una categoría dentro dice qué se pierde al quitarla", () => {
    const html = renderToStaticMarkup(
      <CategoriaEvidencia aporte={aporte({ ch: 120, elegibles: 3400 })} dominio={{ min: 10, max: 60 }} />,
    );
    // Se comprueba dentro de su propio párrafo: un «120» suelto puede venir de
    // cualquier cifra de la tarjeta y la aserción pasaría sin probar nada.
    const efecto = /<p class="cmv2-cat-efecto" data-estado="dentro">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
    expect(efecto).toContain("Quitarla deja fuera");
    expect(efecto).toContain(">120<");
    expect(efecto).toContain(">3,400<");
  });

  it("no inventa el conteo de estudiantes cuando el motor no lo publica", () => {
    const html = renderToStaticMarkup(
      <CategoriaEvidencia aporte={aporte({ ch: 120, elegibles: null })} dominio={{ min: 10, max: 60 }} />,
    );
    const efecto = /<p class="cmv2-cat-efecto" data-estado="dentro">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
    expect(efecto).toContain("Quitarla deja fuera");
    expect(efecto).not.toContain("estudiantes");
  });
});

describe("CategoriaEvidencia · contraste contra el total", () => {
  it("dice cómo se ve la categoría en todos los cursos-horario", () => {
    // Un criterio existe para recortar; sin el contraste no se sabe si el
    // subconjunto elegible se parece al total o si el recorte lo ha desplazado.
    const html = renderToStaticMarkup(
      <CategoriaEvidencia
        aporte={aporte({ chContraste: 849, mediaContraste: 26.9 })}
        dominio={{ min: 10, max: 60 }}
      />,
    );
    expect(html).toContain("En todos los cursos-horario");
    expect(html).toContain("849");
    expect(html).toContain("26.9");
  });

  it("no lo inventa cuando el motor no publica el contraste", () => {
    const html = renderToStaticMarkup(
      <CategoriaEvidencia
        aporte={aporte({ chContraste: null, mediaContraste: null })}
        dominio={{ min: 10, max: 60 }}
      />,
    );
    expect(html).not.toContain("En todos los cursos-horario");
  });

  it("una categoría que no existe en la facultad no muestra contraste", () => {
    // F105 · Esta prueba afirmaba lo contrario de lo correcto: usaba
    // `chContraste: 849` —una categoría con 849 CH en el marco, excluida— y
    // exigía que NO se mostrara el contraste. Justo entonces el contraste es lo
    // único que dice cuánto se está dejando fuera. El caso sin contraste es el
    // de la categoría que de verdad no está aquí.
    const html = renderToStaticMarkup(
      <CategoriaEvidencia
        aporte={aporte({ ch: 0, chContraste: 0, mediaContraste: null })}
        dominio={{ min: 10, max: 60 }}
      />,
    );
    expect(html).toContain("sin cursos-horario en esta facultad");
    expect(html).not.toContain("En todos los cursos-horario");
  });
});
