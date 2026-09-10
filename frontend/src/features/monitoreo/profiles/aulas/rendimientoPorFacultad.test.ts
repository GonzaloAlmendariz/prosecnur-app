import { describe, expect, it, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { diaDeSemanaDeAplicacion, franjaDeAplicacion, partesSinCifraDeEfectivas, rendimientoPorFacultad } from "./rendimientoPorFacultad";
import { fuenteDelPerfilDeAulas } from "./fuenteDelPerfil";

const parte = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;

describe("rendimientoPorFacultad", () => {
  it("ordena por lo que deja cada visita, NO por porcentaje", () => {
    // El caso que Gonzalo describió: un aula de 100 elegibles al 40 % rinde más
    // que una de 20 al 70 %. Ordenar por porcentaje pondría primero a la que
    // menos aporta, que es exactamente el error que hay que no cometer.
    const salida = rendimientoPorFacultad(
      [
        parte({ operational_code: "G", faculty: "Grande", effective_surveys: 40, observed_students: 100 }),
        parte({ operational_code: "P", faculty: "Pequena", effective_surveys: 14, observed_students: 20 }),
      ],
    );
    expect(salida.map((f) => f.facultad)).toEqual(["Grande", "Pequena"]);
    expect(salida[0].porAula).toBe(40);
    // Y la tasa sobre asistentes dice lo contrario: por eso convive, no sustituye.
    expect(salida[0].deLosAsistentes).toBe(40);
    expect(salida[1].deLosAsistentes).toBe(70);
  });

  it("una facultad con menos de tres visitas se aparta y NO encabeza el ranking", () => {
    // Lo que se vio en pantalla el 2026-09-10: PSICOLOGÍA con el 100,0 % de UN
    // curso-horario y LETRAS Y CIENCIAS HUMANAS con el 90,0 % de otro, por
    // delante de facultades con doce visitas. El potencial crudo normaliza el
    // tamaño del aula, no cuántas hay detrás del número.
    //
    // **Y por qué un corte y no sólo el encogimiento.** Se probó encoger hacia
    // la media —`delPotencialAjustado`, que se queda publicado en la línea de
    // cada fila— y en pantalla las seis primeras barras salieron a 69,0 · 66,5
    // · 65,1 · 64,8 · 63,8 · 62,7 %: seis puntos en toda la cabeza de la lista
    // y seis barras del mismo largo. Con casi todas las facultades por debajo
    // del prior, el encogimiento las aplasta contra la media y el ranking deja
    // de rankear.
    const plan = [
      parte({ operational_code: "U", eligible_n: 20 }),
      ...Array.from({ length: 12 }, (_, i) => parte({ operational_code: `D${i}`, eligible_n: 40 })),
      ...Array.from({ length: 20 }, (_, i) => parte({ operational_code: `V${i}`, eligible_n: 40 })),
    ];
    const partes = [
      parte({ operational_code: "U", faculty: "DeUnAula", effective_surveys: 20, observed_students: 20 }),
      ...Array.from({ length: 12 }, (_, i) =>
        parte({ operational_code: `D${i}`, faculty: "DeDoce", effective_surveys: 38, observed_students: 39 })),
      ...Array.from({ length: 20 }, (_, i) =>
        parte({ operational_code: `V${i}`, faculty: "DeVeinte", effective_surveys: 10, observed_students: 34 })),
    ];
    const salida = rendimientoPorFacultad(partes, plan);
    const uno = salida.find((f) => f.facultad === "DeUnAula")!;

    // El crudo del apartado sigue siendo el más alto de los tres, y se publica:
    // apartarlo no es esconderlo.
    expect(uno.delPotencial).toBe(100);
    expect(Math.max(...salida.map((f) => f.delPotencial ?? 0))).toBe(100);
    // Pero va DETRÁS de las dos que sí se comparan, incluso de la que rinde al
    // 25 %: el corte separa por evidencia, no por resultado.
    expect(salida.map((f) => f.facultad)).toEqual(["DeDoce", "DeVeinte", "DeUnAula"]);
    // Y dentro del grupo comparable manda el crudo.
    expect(salida[0].delPotencial).toBe(95);
    expect(salida[1].delPotencial).toBe(25);
    // El encogimiento sigue calculado y publicado al lado.
    expect(uno.delPotencialAjustado).toBeLessThan(100);
  });

  it("sin elegibles no hay nada que encoger y el ajustado es null, no un cero", () => {
    const salida = rendimientoPorFacultad(
      [parte({ operational_code: "X", faculty: "SinPlan", effective_surveys: 10, observed_students: 12 })],
    );
    expect(salida[0].delPotencial).toBeNull();
    expect(salida[0].delPotencialAjustado).toBeNull();
  });

  it("el encogimiento CAMBIA el orden cuando las facultades son de tamaños distintos", () => {
    // El caso real: en el estudio de 2025 las facultades van de 2 a 39 aulas
    // (Ciencias Contables 2, Ciencias e Ingeniería 39). Una facultad con dos
    // aulas afortunadas encabeza la lista cruda y no debería.
    const partes = [
      // Chica: 2 aulas, 40 efectivas cada una. Tasa cruda 40.
      parte({ operational_code: "A", faculty: "Chica", effective_surveys: 40, observed_students: 45 }),
      parte({ operational_code: "B", faculty: "Chica", effective_surveys: 40, observed_students: 45 }),
      // Grande: 10 aulas de 30. Tasa cruda 30, con cinco veces más evidencia.
      ...Array.from({ length: 10 }, (_, i) =>
        parte({ operational_code: `G${i}`, faculty: "Grande", effective_surveys: 30, observed_students: 35 })),
    ];
    const salida = rendimientoPorFacultad(partes);
    const chica = salida.find((f) => f.facultad === "Chica")!;
    const grande = salida.find((f) => f.facultad === "Grande")!;
    // Cruda: la chica gana.
    expect(chica.porAula).toBe(40);
    expect(grande.porAula).toBe(30);
    // Ajustada: la chica se acerca a la media y la grande apenas se mueve.
    expect(chica.porAulaAjustado!).toBeLessThan(chica.porAula!);
    expect(Math.abs(grande.porAulaAjustado! - grande.porAula!))
      .toBeLessThan(Math.abs(chica.porAulaAjustado! - chica.porAula!));
    // Y el dato observado SIGUE estando: el encogido no lo sustituye.
    expect(chica.porAula).toBe(40);
  });

  it("con muchas aulas el encogimiento casi no mueve la cifra", () => {
    const partes = Array.from({ length: 40 }, (_, i) =>
      parte({ operational_code: `A${i}`, faculty: "X", effective_surveys: 20, observed_students: 25 }));
    const [f] = rendimientoPorFacultad(partes);
    // Con una sola facultad, la media del estudio ES su propia tasa: el prior
    // no puede moverla, que es lo correcto.
    expect(f.porAulaAjustado).toBe(20);
  });

  it("un parte vacío no hunde la tasa de su facultad", () => {
    // Sin efectivas NI asistentes no es un aula que rindió cero: es un parte que
    // nadie llenó todavía.
    const [f] = rendimientoPorFacultad([
      parte({ operational_code: "A", faculty: "X", effective_surveys: 20, observed_students: 25 }),
      parte({ operational_code: "B", faculty: "X" }),
    ]);
    expect(f.aulas).toBe(1);
    expect(f.porAula).toBe(20);
  });

  it("el potencial sale de los elegibles del plan", () => {
    const [f] = rendimientoPorFacultad(
      [parte({ operational_code: "A", faculty: "X", effective_surveys: 30, observed_students: 40 })],
      [parte({ operational_code: "A", eligible_n: 60 })],
    );
    expect(f.elegibles).toBe(60);
    expect(f.delPotencial).toBe(50);
  });

  it("agrupa por aplicador con la MISMA función", () => {
    const salida = rendimientoPorFacultad(
      [
        parte({ operational_code: "A", applied_by: "Equipo 1", effective_surveys: 30, observed_students: 40 }),
        parte({ operational_code: "B", applied_by: "Equipo 1", effective_surveys: 10, observed_students: 20 }),
        parte({ operational_code: "C", applied_by: "Equipo 2", effective_surveys: 25, observed_students: 30 }),
      ],
      [],
      "applied_by",
    );
    expect(salida.map((f) => f.facultad)).toEqual(["Equipo 2", "Equipo 1"]);
    expect(salida[0].porAula).toBe(25);
    expect(salida[1].porAula).toBe(20);
  });

  it("las franjas son las del libro, y lo raro se declara aparte", () => {
    // 7:00–9:00 · 9:01–19:00 · 19:01–22:00, de la hoja «planilla». Un aula a las
    // 6 de la mañana es un dato que hay que ver, no un caso de «mañana».
    expect(franjaDeAplicacion("08:00")).toBe("7:00 – 9:00");
    expect(franjaDeAplicacion("09:01")).toBe("9:01 – 19:00");
    expect(franjaDeAplicacion("19:00")).toBe("9:01 – 19:00");
    expect(franjaDeAplicacion("20:30")).toBe("19:01 – 22:00");
    expect(franjaDeAplicacion("06:00")).toBe("Fuera de franja");
    expect(franjaDeAplicacion("23:10")).toBe("Fuera de franja");
    expect(franjaDeAplicacion("")).toBe("Sin hora");
    expect(franjaDeAplicacion("mediodía")).toBe("Sin hora");
    // El parte publicado manda fecha y hora juntas, no la hora sola.
    expect(franjaDeAplicacion("2026-08-11 10:00")).toBe("9:01 – 19:00");
    expect(franjaDeAplicacion("2026-08-11 08:30")).toBe("7:00 – 9:00");
  });

  it("sin elegibles conocidos el potencial es nulo, no cero", () => {
    // Un cero se leería como «no queda nada por exprimir», que es lo contrario
    // de «no se sabe».
    const [f] = rendimientoPorFacultad([
      parte({ operational_code: "A", faculty: "X", effective_surveys: 10, observed_students: 12 }),
    ]);
    expect(f.delPotencial).toBeNull();
    expect(f.deLosAsistentes).toBeCloseTo(83.3, 1);
  });
});

describe("el panel nombra de qué fuente son sus encuestas", () => {
  // Medido en el fixture: las efectivas del rendimiento suman 4 863 sobre 210
  // aulas, y la pestaña vecina de la MISMA sección muestra «VÁLIDAS 3 700 ·
  // respuestas de Kobo que pasan el filtro». Son 1 163 de diferencia entre dos
  // cifras que un lector natural toma por la misma: unas las anotó el equipo
  // aula por aula, las otras llegaron a Kobo y pasaron el filtro.
  //
  // El resumen ya nombraba su fuente («de Kobo»); este panel no nombraba la
  // suya.
  // El perfil entero: la pista se busca donde sea que viva. Ver
  // `fuenteDelPerfil.ts` para el porqué.
  const page = fuenteDelPerfilDeAulas();

  test("el subtítulo dice que las encuestas son del parte", () => {
    expect(page).toContain("<span>encuestas del parte, por curso-horario visitado</span>");
  });

  test("la fuente vecina sigue nombrando la suya", () => {
    // Vive en `kpisDeAulas.ts`, no en el page-file: si alguien le quita la
    // pista a VÁLIDAS, las dos cifras vuelven a ser indistinguibles y este
    // panel se queda solo nombrando la suya.
    const kpis = fs.readFileSync(path.resolve(__dirname, "kpisDeAulas.ts"), "utf8");
    // La pista se volvió condicional al desagregar la tarjeta, así que ya no hay
    // un literal fijo: lo que se exige es que **las dos ramas nombren Kobo**, que
    // es lo que este guard protege —sin eso, «3 700» y las «4 863» del parte
    // vuelven a ser indistinguibles—.
    // `validasKpi` se retiró el 2026-09-08 con la banda que dictó Gonzalo; la
    // tarjeta de Efectivas es ahora la primera de Avance y se escribe inline.
    const bloque = kpis.slice(kpis.indexOf('label: "Efectivas"'));
    const cuerpo = bloque.slice(0, bloque.indexOf("\n}"));
    // Lo protegido es que la tarjeta **nombre su fuente**, no la marca concreta.
    // Decía «de Kobo»; ahora dice «de la plataforma», que además de leerse sin
    // saber qué es Kobo no se vuelve falso en un estudio que recoja por
    // SurveyMonkey. El guard mide por eso la propiedad —las dos ramas nombran
    // la fuente— y no el literal, que es lo que convertía cada mejora de
    // redacción en un rojo ajeno.
    const nombraLaFuente = /de (la plataforma|Kobo|SurveyMonkey)/g;
    const menciones = cuerpo.match(nombraLaFuente) ?? [];
    expect(
      menciones.length,
      `la tarjeta de Válidas dejó de nombrar su fuente: sin eso, sus respuestas y las del parte de campo vuelven a ser indistinguibles`,
    ).toBeGreaterThanOrEqual(2);
  });
});

describe("la cuarta unidad de esfuerzo: el día de la semana", () => {
  // El pronóstico de cierre proyecta «al ritmo observado de N aulas por día de
  // campo», o sea tratando todos los días como iguales. Hay panel para la hora
  // del día y no lo había para el día, que es la única de las cuatro sobre la
  // que el equipo decide al agendar: la hora la pone el curso, el aplicador la
  // asignación y la facultad la muestra.
  const parte = (applied_at: string, efectivas: number) =>
    ({ operational_code: `CH ${applied_at}${efectivas}`, applied_at,
       effective_surveys: efectivas, observed_students: efectivas + 2 }) as unknown as MonitoreoRow;

  it("nombra el día correcto, en UTC", () => {
    // 2026-08-16 es domingo; el 17, lunes. En hora local, una aplicación a las
    // 00:30 caería en el día anterior al oeste de Greenwich.
    expect(diaDeSemanaDeAplicacion("2026-08-16")).toBe("Domingo");
    expect(diaDeSemanaDeAplicacion("2026-08-17 08:00")).toBe("Lunes");
    expect(diaDeSemanaDeAplicacion("2026-08-21T23:59:00")).toBe("Viernes");
  });

  it("sin fecha no inventa un día", () => {
    expect(diaDeSemanaDeAplicacion("")).toBe("Sin fecha");
    expect(diaDeSemanaDeAplicacion("mañana")).toBe("Sin fecha");
    expect(diaDeSemanaDeAplicacion(null)).toBe("Sin fecha");
  });

  it("agrupa los partes por su día y ordena por lo que deja cada visita", () => {
    const filas = rendimientoPorFacultad([
      parte("2026-08-17", 10), parte("2026-08-17", 20),  // lunes: 15 por aula
      parte("2026-08-21", 40),                            // viernes: 40 por aula
    ], [], "dia_semana");
    expect(filas.map((f) => f.facultad)).toEqual(["Viernes", "Lunes"]);
    expect(filas[0].porAula).toBe(40);
    expect(filas[1].porAula).toBe(15);
  });

  it("si un parte cae en domingo, se dice: no se esconde", () => {
    // El domingo no se aplica, pero un parte que diga domingo es un dato del
    // libro y esconderlo dejaría aulas fuera de la cuenta sin avisar.
    const filas = rendimientoPorFacultad([parte("2026-08-16", 5)], [], "dia_semana");
    expect(filas.map((f) => f.facultad)).toEqual(["Domingo"]);
  });
});

describe("las columnas se explican solas en los cuatro paneles", () => {
  /**
   * El pie define las cuatro columnas de cifras, pero **sólo lo pinta el primero de los cuatro paneles que usan
   * esta tabla**: «Quién consigue más», «Franja horaria del operativo» y «Día
   * de la semana» llegan con `explicaLasColumnas={false}` para no repetir el
   * párrafo cuatro veces. Comprobado en pantalla el 2026-08-29: uno con leyenda
   * y tres sin ella, publicando «Ajustado» y «Del potencial» sin decir qué son.
   *
   * La definición se ató al `title` de cada cabecera, que viaja con la columna
   * en los cuatro. Este guard mira el fuente porque es donde vive la regla: en
   * un render de un solo panel no se distingue el que sí lleva pie del que no.
   */
  const fuente = fs.readFileSync(
    path.resolve(__dirname, "AulasRendimientoPorFacultad.tsx"),
    "utf8",
  );

  // Los rotulos cambiaron el 2026-08-31: decian el METODO y no el dato, y
  // Gonzalo no podia leerlos —«no entiendo a que te refieres con ajustado, no se
  // si asistentes efectivos o matriculados... son muchas jergas»—. Ahora cada
  // uno nombra el dato y su denominador. El guard es el mismo: que cada cabecera
  // siga declarando QUE mide en su `title`, se llame como se llame.
  // «De los elegibles» salió el 2026-09-09: era exactamente lo que dibuja la
  // barra —la lista pasó a ordenar por el potencial— y tenerla dos veces en la
  // misma fila obligaba a comprobar que coincidían. Entra «Por visita», que
  // bajó de barra a columna.
  // El 2026-09-10 «Ajustado por tamaño» pasó a «Por visita, ajustado»: nombra su
  // base ahora que el encogimiento del potencial también se publica, en la línea
  // de evidencia de cada fila.
  it.each([
    "Del potencial", "Por visita", "Por visita, ajustado",
    "De los que asistieron",
  ])(
    "«%s» lleva su definición en la cabecera",
    (columna) => {
      // La cabecera y su `title` en el mismo elemento: se busca el bloque que
      // abre con `title=` y contiene el nombre de la columna.
      const bloque = new RegExp(
        `<span role="columnheader" title=[^>]+>\\s*${columna}\\s*<`,
      );
      expect(bloque.test(fuente), `«${columna}» no declara qué mide`).toBe(true);
    },
  );

  it("y el pie sigue existiendo para el panel que sí lo pinta", () => {
    // El control: si alguien retirase el párrafo pensando que los `title` lo
    // sustituyen, el panel principal perdería su explicación visible.
    //
    // **Anclado en los NOMBRES de las columnas y no en una frase suelta.**
    // Antes se agarraba a «corrige el tamaño de la muestra» y se puso rojo el
    // 2026-09-10 por reescribir el párrafo sin quitarlo: un guard que muere al
    // reescribir la prosa que vigila no vigila la prosa, vigila una cadena.
    const pie = fuente.slice(fuente.indexOf("explicaLasColumnas ? ("));
    for (const etiqueta of ["Del potencial", "Ajustado", "Por visita", "De los asistentes"]) {
      expect(pie, `el pie ya no explica «${etiqueta}»`)
        .toContain(`<strong>${etiqueta}</strong>`);
    }
  });
});

describe("una celda de efectivas vacía no es un cero", () => {
  it("no publica «0 efectivas» por un parte al que le falta la cifra", () => {
    // **El defecto, medido el 2026-09-08.** CH 7 viene del parte con
    // `application_status: "APLICADA"`, 29 asistentes y `effective_surveys`
    // VACÍA, mientras la Base de control le cuenta 27 encuestas por sexo: el
    // aula se aplicó y lo que falta es que alguien escribiera la cifra.
    //
    // Pasaba el guard del «parte vacío» por sus asistentes, la coerción a número
    // convertía el hueco en 0, y el ranking publicaba «Aguilar Cuya, Renzo
    // Mariano · 1 curso-horario · 0 efectivas · 0.0 %». Un cero inventado con el
    // nombre de una persona al lado.
    const partes = [
      { operational_code: "CH 7", applied_by: "Aguilar Cuya", effective_surveys: "NA", observed_students: 29 },
      { operational_code: "CH 5", applied_by: "Puchuri Chamorro", effective_surveys: 17, observed_students: 20 },
    ] as unknown as Parameters<typeof rendimientoPorFacultad>[0];

    const filas = rendimientoPorFacultad(partes, [], "applied_by");
    expect(filas.map((f) => f.facultad)).not.toContain("Aguilar Cuya");
    expect(filas.find((f) => f.facultad === "Puchuri Chamorro")?.efectivas).toBe(17);
  });

  it("un CERO de verdad sí se cuenta: es una medición", () => {
    const partes = [
      { operational_code: "CH 9", applied_by: "Quien sea", effective_surveys: 0, observed_students: 12 },
    ] as unknown as Parameters<typeof rendimientoPorFacultad>[0];
    const filas = rendimientoPorFacultad(partes, [], "applied_by");
    expect(filas.find((f) => f.facultad === "Quien sea")?.efectivas).toBe(0);
    expect(filas.find((f) => f.facultad === "Quien sea")?.aulas).toBe(1);
  });
});

describe("el descarte se puede contar con la misma regla que lo produce", () => {
  it("cuenta los partes aplicados que vinieron sin su cifra", () => {
    const partes = [
      { operational_code: "CH 7", effective_surveys: "NA", observed_students: 29 },
      { operational_code: "CH 47", effective_surveys: "", observed_students: 33 },
      { operational_code: "CH 5", effective_surveys: 17, observed_students: 20 },
    ] as unknown as Parameters<typeof partesSinCifraDeEfectivas>[0];
    expect(partesSinCifraDeEfectivas(partes)).toBe(2);
  });

  it("un parte ENTERO vacío no cuenta como descarte", () => {
    // Ése nunca estuvo en el ranking; decir que «falta su cifra» sugeriría que
    // alguien fue al aula y no la apuntó.
    const partes = [
      { operational_code: "CH 9", effective_surveys: "", observed_students: 0 },
    ] as unknown as Parameters<typeof partesSinCifraDeEfectivas>[0];
    expect(partesSinCifraDeEfectivas(partes)).toBe(0);
  });
});
