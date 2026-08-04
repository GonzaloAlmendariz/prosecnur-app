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
    // F114 · El dominio se redondea a marcas completas: empieza en 0 y termina
    // en un múltiplo del paso. Así el eje tiene tics desde el origen y todas
    // las categorías del criterio comparten exactamente las mismas marcas —que
    // es lo que hace que las tarjetas alineen entre sí por construcción.
    expect(dominio).toEqual({ min: 0, max: 140 });
  });

  it("sin ninguna distribución publicada no inventa una escala", () => {
    expect(dominioCategorias([aporte({ distribucion: null }), null, undefined])).toBeNull();
  });

  it("publica CH, alumnos, cuantiles y presentes esperados en el mismo bloque", () => {
    const dominio = dominioCategorias([aporte()])!;
    const html = renderToStaticMarkup(<CategoriaEvidencia aporte={aporte()} dominio={dominio} />);
    // F111 · Las cuatro cifras que Gonzalo fijó: CH totales, CH elegibles,
    // alumnos elegibles y la tasa de asistencia previa. Sale «matrículas».
    //
    // G41 · La segunda dejó de ser «CH elegibles»: ese nombre quedó reservado
    // para el número final de la facultad, y dentro del recorrido la casilla
    // dice «llegan hasta aquí» —o no dice nada, como en este caso, cuando el
    // motor no publica reparto para el criterio—. Dos nombres en la misma
    // posición se leían como dos versiones del mismo número.
    expect(html).toContain("CH totales");
    expect(html).not.toContain("CH elegibles");
    expect(html).toContain("alumnos elegibles");
    expect(html).toContain("una persona cuenta una vez");
    expect(html).toContain("Mediana");
    expect(html).toContain("Q1");
    // Presentes esperados = elegibles × tasa, redondeado. 3400 × 0,7 = 2.380.
    // F112 · La tasa es un parámetro del marco aplicado por igual a todas las
    // categorías, no una medición de ésta. Se dice de qué a qué convierte, con
    // las dos cifras a la vista: 3.400 × 0,7 = 2.380.
    expect(html).toContain("2,380");
    expect(html).toContain("presentes");
    expect(html).toContain("70% asistencia");
    expect(html).not.toContain("matrículas");
  });

  it("sin tasa de asistencia la celda se reserva vacía, no desaparece", () => {
    // F114 · Gonzalo: «todas las tarjetas tienen que coincidir exactamente en la
    // alineación». Una celda que desaparece recoloca las tres de al lado y el
    // gráfico arranca a otra altura. El hueco vacío alinea; el hueco ausente no.
    const dominio = dominioCategorias([aporte()])!;
    const html = renderToStaticMarkup(
      <CategoriaEvidencia aporte={aporte({ tasaAsistencia: null })} dominio={dominio} />,
    );
    // Se mide el TEXTO visible, no el HTML entero: «de asistencia» vive también
    // en el `title` de la celda, y una aserción sobre el marcado completo la
    // encuentra ahí y falla sin que haya defecto. Es el mismo error de sonda
    // que el ADR recoge en el patrón 3.
    const visible = html.replace(/<[^>]+>/g, "");
    expect(visible).toContain("presentes");
    expect(visible).not.toContain("% asistencia");
    // Las cuatro celdas están siempre.
    const i = html.indexOf('class="cmv2-cat-cifras"');
    const j = html.indexOf('cmv2-cat-efecto', i);
    expect(((j > i ? html.slice(i, j) : html).match(/<span/g) ?? []).length).toBe(4);
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
    // F114 · La nota dice lo que el eje rotulado no puede decir por sí solo:
    // qué se mide. Los extremos siguen dentro de la frase, no sueltos.
    expect(nota).toContain("Estudiantes elegibles por curso-horario");
    expect(nota).toContain("escala común");
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

  it("el criterio declara su escala una vez, no cada categoría", () => {
    const html = renderToStaticMarkup(<EjeCategorias dominio={{ min: 10, max: 120 }} />);
    expect(html).toContain("escala común a las categorías");
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
    expect(html).not.toContain("Mediana");
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
    expect(html).not.toContain("Mediana");
    expect(html).not.toContain("cmv2-cat-caja");
  });

  it("con cursos, los cuantiles siguen enteros", () => {
    const html = renderToStaticMarkup(
      <CategoriaEvidencia aporte={aporte()} dominio={{ min: 10, max: 60 }} />,
    );
    expect(html).toContain("Mediana");
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
    // F112 · La línea de contraste se retiró; lo que dice cuánto se deja fuera
    // es ahora la propia línea de efecto, con la misma cifra. Y sin alumnos
    // elegibles no se estima asistencia sobre cero.
    expect(html).not.toContain("En todos los cursos-horario");
    expect(html).not.toContain("presentes de");
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

describe("CategoriaEvidencia · lo que F112 retiró", () => {
  // Gonzalo: «nos importa la distribución de los elegibles, no tanto la
  // distribución general de todo». La línea «En todos los cursos-horario: N CH,
  // media M» duplicaba «CH totales» y su otra mitad describía esa general.
  it("no repite el total como frase: ya está como cifra", () => {
    const html = renderToStaticMarkup(
      <CategoriaEvidencia
        aporte={aporte({ chContraste: 849, mediaContraste: 26.9 })}
        dominio={{ min: 10, max: 60 }}
      />,
    );
    expect(html).not.toContain("En todos los cursos-horario");
    // Pero el total sigue a la vista, que es lo que Gonzalo pidió conservar.
    expect(html).toContain("849");
    expect(html).toContain("CH totales");
  });
});

describe("CategoriaEvidencia · variante unidad (F115)", () => {
  // Gonzalo: «hay algunos selectores que no son criterios como tal; el último es
  // escoger cada curso-horario e individualmente validar si va a entrar. Para
  // ese caso no podemos tener densidad ni cursos-horario totales, pero sí
  // cuántos alumnos son elegibles y, si hay asistencia histórica, cuánto es y
  // cuánto representa».
  const unidad = (over: Partial<AporteCategoria> = {}) =>
    renderToStaticMarkup(
      <CategoriaEvidencia
        aporte={aporte({ ch: 1, chContraste: 1, elegibles: 34, tasaAsistencia: 0.78, ...over })}
        dominio={{ min: 0, max: 60 }}
        variante="unidad"
      />,
    );

  it("no dibuja gráfico: un solo curso-horario no tiene distribución", () => {
    const html = unidad();
    expect(html).not.toContain("cmv2-dist-densidad");
    expect(html).not.toContain("cmv2-dist-caja");
    expect(html).not.toContain("cmv2-dist-eje");
  });

  it("no muestra CH totales ni elegibles: valdrían 1", () => {
    const html = unidad();
    expect(html).not.toContain("CH totales");
    expect(html).not.toContain("CH elegibles");
  });

  it("da la precisión que sí decide: alumnos y presentes esperados", () => {
    const html = unidad();
    expect(html).toContain("34");
    expect(html).toContain("alumnos elegibles");
    // 34 × 0,78 = 26,52 → 27.
    expect(html).toContain("27");
    expect(html).toContain("78% de asistencia histórica");
  });

  it("sin asistencia histórica lo declara y conserva la celda", () => {
    // La lista de cursos-horario es larga: si la celda desapareciera, cada fila
    // desplazaría a la siguiente y la columna dejaría de leerse en vertical.
    const html = unidad({ tasaAsistencia: null });
    expect(html).toContain("sin asistencia histórica");
    const i = html.indexOf('class="cmv2-cat-cifras"');
    expect((html.slice(i).match(/<span/g) ?? []).length).toBe(2);
  });

  it("un solo alumno concuerda en singular", () => {
    expect(unidad({ elegibles: 1 })).toContain("alumno elegible");
  });
});

describe("CategoriaEvidencia · variantes de umbral y proporción (F118)", () => {
  // Gonzalo: «así como hemos definido este estándar para el categórico, poder
  // definir un estándar para cada uno; nos falta el de umbral rango y el de
  // proporción». No es cosmética: cada tipo hace una pregunta distinta.
  const conUmbral = (variante: "umbral" | "proporcion", over: Partial<AporteCategoria> = {}) =>
    renderToStaticMarkup(
      <CategoriaEvidencia
        aporte={aporte({ ch: 84, chContraste: 120, elegibles: 2110, umbral: { valor: 20 }, ...over })}
        dominio={{ min: 0, max: 100 }}
        variante={variante}
      />,
    );

  it("las cifras responden «qué deja fuera», no «cuántos hay»", () => {
    const html = conUmbral("umbral");
    expect(html).toContain("que cumplen");
    expect(html).toContain("quedan fuera");
    // 120 − 84 = 36. Es resta de dos cifras publicadas, no un estadístico nuevo.
    expect(html).toContain("<strong>36</strong>quedan fuera");
  });

  it("no inventa el descarte cuando falta una de las dos cifras", () => {
    const html = conUmbral("umbral", { chContraste: null });
    expect(html).toContain("<strong>—</strong>quedan fuera");
  });

  it("dibuja el corte sobre la distribución", () => {
    expect(conUmbral("umbral")).toContain("cmv2-dist-umbral");
  });

  it("una proporción rotula su eje en porcentaje", () => {
    // La escala de una proporción ES 0–100 %: no la fija el dato, la fija la
    // unidad — y sin el «%» el eje se lee como un conteo.
    // Se comprueba en una marca del EJE (40, 60) y no en 20, que es también la
    // etiqueta del corte: una aserción sobre «20%» pasaría por el corte aunque
    // el eje siguiera en conteo.
    const html = conUmbral("proporcion");
    expect(html).toContain("<b>40%</b>");
    expect(html).toContain("<b>60%</b>");
  });

  it("un umbral NO rotula en porcentaje", () => {
    const html = conUmbral("umbral");
    expect(html).toContain("<b>40</b>");
    expect(html).not.toContain("<b>40%</b>");
  });
});

describe("cada variante declara qué es (G36)", () => {
  /*
   * Contrato de Superficie, C1 · Medido en la app: los tres criterios
   * categóricos —Modalidad, Condición del curso, Tipo de sesión— salían **sin
   * `data-variante`** mientras umbral y unidad sí lo declaraban. Era la rama
   * por defecto del componente, y una rama por defecto omite en silencio.
   *
   * El coste no es cosmético: sin declaración no hay forma de distinguir «esta
   * tarjeta es categórica» de «esta tarjeta se rompió y cayó al caso por
   * defecto», ni de auditar la superficie sin abrirla criterio a criterio.
   */
  const render = (variante: "categoria" | "umbral" | "proporcion" | "unidad") =>
    renderToStaticMarkup(
      <CategoriaEvidencia
        aporte={aporte({ umbral: { valor: 20 } })}
        dominio={{ min: 0, max: 100 }}
        variante={variante}
      />,
    );

  it.each(["categoria", "umbral", "proporcion", "unidad"] as const)(
    "«%s» sale declarada en el marcado",
    (variante) => {
      expect(render(variante)).toContain(`data-variante="${variante}"`);
    },
  );

  it("una rama nueva no puede salir sin declarar", () => {
    // Cubre lo que el caso anterior no ve: una quinta rama añadida más adelante
    // que vuelva a omitir el atributo. Busca la clase **sin** `data-variante`
    // detrás — mi primera versión buscaba la clase a secas y casaba también con
    // las tarjetas correctas: un detector que no distingue no detecta nada.
    for (const v of ["categoria", "umbral", "proporcion", "unidad"] as const) {
      const sinDeclarar = render(v).match(/class="cmv2-cat-evidencia"(?! data-variante)/g) ?? [];
      expect(sinDeclarar).toHaveLength(0);
    }
  });
});

/**
 * G41 · Un solo nombre por posición.
 *
 * Gonzalo: «en algunos casos sigue siendo CH elegibles y en otros llegan hasta
 * aquí. La idea es que el número final sea CH elegibles de la facultad, pero
 * antes de eso mantener la nomenclatura, llegan hasta aquí».
 */
describe("CategoriaEvidencia · nomenclatura del recorrido", () => {
  it("con reparto del motor la casilla dice «llegan hasta aquí»", () => {
    const dato = aporte({ llegan: 587 });
    const html = renderToStaticMarkup(
      <CategoriaEvidencia aporte={dato} dominio={dominioCategorias([dato])!} />,
    );
    expect(html).toContain("llegan hasta aquí");
    expect(html).toContain("587");
    expect(html).not.toContain("CH elegibles");
  });

  it("sin reparto no cae en «CH elegibles»: deja la casilla vacía", () => {
    const dato = aporte();
    const html = renderToStaticMarkup(
      <CategoriaEvidencia aporte={dato} dominio={dominioCategorias([dato])!} />,
    );
    expect(html).not.toContain("CH elegibles");
    expect(html).not.toContain("llegan hasta aquí");
    // La casilla sigue existiendo aunque esté vacía: la rejilla de cuatro
    // columnas alinea las tarjetas entre sí, y una que se recoloca rompe la
    // lectura en columna de todo el criterio.
    expect(html).toContain('<span aria-hidden="true"></span>');
  });
});
