import { describe, expect, it, test } from "vitest";

import type { MonitoreoAulasDashboard } from "../../../../api/monitoreo";
import { cuotasResumen } from "./cuotasResumen";
import { aulasKpis } from "./kpisDeAulas";

/**
 * El KPI de cuota y el panel de Avance no pueden decir cosas distintas.
 *
 * Decían: arriba «2/12» —celdas— y abajo «701 personas por recoger». Las dos
 * cifras eran correctas y juntas se leían como una contradicción, además de
 * contestar en una unidad que no es la del operativo: doce celdas pueden estar a
 * una respuesta o a doscientas y el contador se ve igual.
 */

/** Doce celdas como las del estudio: dos cumplidas y mucha gente por recoger. */
const celdas = [
  { faculty: "Derecho", sex: "F", target: 300, observed: 300 },
  { faculty: "Derecho", sex: "M", target: 100, observed: 100 },
  { faculty: "Ciencias", sex: "F", target: 300, observed: 12 },
  { faculty: "Ciencias", sex: "M", target: 100, observed: 4 },
];

function tablero(extra: Record<string, unknown> = {}): MonitoreoAulasDashboard {
  return {
    kpis: { total_aulas: 196, aulas_aplicadas: 0, respuestas_validas: 3700, brechas: 92 },
    quotas_sex_faculty: celdas,
    ...extra,
  } as unknown as MonitoreoAulasDashboard;
}

function cuotaKpi(tab: MonitoreoAulasDashboard) {
  return aulasKpis(tab, "avance").find((k) => k.label.toLowerCase().includes("cuota"));
}

const SECCIONES = ["fuentes", "modelo", "calidad", "consultas", "avance"] as const;

describe("la banda de KPIs", () => {
  it("cada cifra dice de dónde sale o sobre qué se cuenta, en las cinco secciones", () => {
    // El patrón viene de telefónico y acreditación, cuyas tarjetas llevan
    // `hint`. Sin él, «Aplicadas 0» al lado de «Válidas 3 700» se lee como app
    // rota, cuando son dos fuentes distintas: una la declara el aplicador y la
    // otra llega de Kobo.
    const sinPista = SECCIONES.flatMap((s) => aulasKpis(tablero(), s))
      .filter((k) => !k.pista?.trim());
    expect(sinPista.map((k) => k.label)).toEqual([]);
  });

  it("«Cursos-horario aplicados» dice las tres vías por las que se cuenta", () => {
    // El rótulo lleva la unidad porque la tarjeta vecina —«Válidas»— cuenta
    // personas, y 152 contra 2.668 no se comparan sin saberlo.
    //
    // La pista decía «declarados en el registro de campo» y prometía que la
    // cifra NO se derivaba de las respuestas. El 2026-09-07 pasó a derivarse
    // también de ellas: con ocho aulas produciendo encuestas la tarjeta
    // enseñaba UNA. Lo que se sujeta ahora es que nombre las tres.
    const aplicadas = aulasKpis(tablero(), "modelo")
      .find((k) => k.label === "Cursos-horario aplicados");
    expect(aplicadas?.value).toBe("0");
    expect(aplicadas?.pista).toContain("parte");
    expect(aplicadas?.pista).toContain("respuestas");
    expect(aplicadas?.detalle).toContain("Basta con uno");
  });

  it("contesta la pregunta de SU sección y no la de otra", () => {
    // La banda mostraba las mismas seis tarjetas en las cinco secciones: en
    // Fuentes presidía la pantalla un «Cuota por recoger» que no decide nada
    // ahí, y en Consultas no había ni una cifra de reemplazos.
    const etiquetas = (s: (typeof SECCIONES)[number]) => aulasKpis(tablero(), s).map((k) => k.label);
    expect(etiquetas("fuentes")).toContain("Respuestas leídas");
    expect(etiquetas("fuentes")).not.toContain("Cuota por recoger");
    expect(etiquetas("consultas")).toContain("Cerraron con reemplazo");
    expect(etiquetas("consultas")).toContain("Cadenas sin cerrar");
    expect(etiquetas("calidad")).toContain("Alertas");
    expect(etiquetas("avance")).toContain("Cuota por recoger");
    expect(etiquetas("avance")).toContain("Llegaron a su meta");
    // Y NO «Cumplen»: esa palabra la usaban a la vez este KPI, el tramo
    // `cerrando` del gráfico de estado y «Meta cumplida» del de cobertura, para
    // tres cosas distintas. El KPI decía 216 y el gráfico 0 en la misma
    // pantalla.
    expect(etiquetas("avance")).not.toContain("Cumplen");
  });

  it("las cadenas se cuentan con la misma función que las cuenta abajo", () => {
    // `reemplazos_usados` del motor decía «0» —cuenta reservas cuyo estado
    // operativo salió de «planificada», o sea depende del registro de campo—
    // mientras el panel de al lado decía «3 cerraron con un reemplazo».
    const agenda = [
      { operational_code: "CH 1", sample_role: "titular", faculty: "Derecho", respuestas_validas: 2, expected_valid: 30 },
      { operational_code: "R 1.1", sample_role: "chain_reserve", replacement_for: "CH 1", replacement_order: 1, respuestas_validas: 31, expected_valid: 30 },
    ];
    const kpi = aulasKpis(tablero({ agenda, kpis: { reemplazos_usados: 0 } }), "consultas")
      .find((k) => k.label === "Cerraron con reemplazo");
    expect(kpi?.value).toBe("1");
  });

  it("toda tarjeta lleva ícono", () => {
    // En una banda que cambia por sección, el ícono es lo que deja reconocer de
    // qué habla la cifra sin releer el rótulo. Una tarjeta sin él rompería la
    // rejilla de las otras.
    const sinIcono = SECCIONES.flatMap((s) => aulasKpis(tablero(), s))
      .filter((k) => typeof k.icono !== "function" && typeof k.icono !== "object");
    expect(sinIcono.map((k) => k.label)).toEqual([]);
  });

  it("ninguna sección se queda sin banda", () => {
    // Un `seccion` que no case con ningún `if` devolvería la de Avance por
    // defecto; lo que no puede pasar es una sección vacía, que dejaría la franja
    // superior como un marco sin contenido.
    for (const s of SECCIONES) {
      expect(aulasKpis(tablero(), s).length, `sección ${s}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("«Base de control» es la excepción declarada: no lleva banda", () => {
    // Esa pestaña abre con su propio encabezado —la matriz de los cuatro casos
    // y el titular de efectivas—, y encima llevaba tres tiles de la OTRA
    // pestaña. Tres estratos de cabecera y 111 px de banda para decir lo que la
    // pestaña ya dice mejor.
    expect(aulasKpis(tablero(), "calidad" as never, "base")).toEqual([]);
    // El control: la otra pestaña de la misma sección SÍ la lleva, así que la
    // excepción es de la pestaña y no un apagado de la sección entera.
    expect(aulasKpis(tablero(), "calidad" as never, "controles").length).toBeGreaterThan(0);
  });
});

describe("el KPI de cuota", () => {
  it("cuenta personas, no celdas", () => {
    const kpi = cuotaKpi(tablero());
    // 288 + 96 = 384 personas por recoger. Si volviera a contar celdas diría
    // «2/4», que es el defecto que este guard existe para atrapar.
    expect(kpi?.value).toBe("384");
    expect(kpi?.value).not.toContain("/");
  });

  it("dice lo mismo que el panel de Avance", () => {
    // La propiedad, no el número: las dos superficies leen la misma función.
    const general = cuotasResumen(celdas as never).general;
    expect(cuotaKpi(tablero())?.value).toBe(
      new Intl.NumberFormat("es-PE").format(general.faltan),
    );
  });

  it("guarda el detalle sin gastar alto", () => {
    // Va al `title`: la banda es un grupo de marco igual (C2) y una tarjeta con
    // una línea más rompería el marco de las otras cinco.
    expect(cuotaKpi(tablero())?.detalle).toContain("416 de 800 personas");
    expect(cuotaKpi(tablero())?.detalle).toContain("2 de 4 grupos de facultad y sexo");
    // 800 − 416 son 384 aquí por casualidad; con celdas pasadas de meta no
    // cuadraría, y por eso el detalle dice cómo se suma.
    expect(cuotaKpi(tablero())?.detalle).toContain("grupo a grupo");
  });

  it("distingue «sin cuotas declaradas» de «cuota cumplida»", () => {
    // Un plan sin cuotas y un plan con todo recogido darían ambos 0 por recoger.
    // «S/D» dice que no hay vara; «0» diría que ya no falta nadie.
    const sinCuotas = cuotaKpi(tablero({ quotas_sex_faculty: [] }));
    expect(sinCuotas?.value).toBe("S/D");
    expect(sinCuotas?.tone).toBe("neutral");

    const cumplida = cuotaKpi(tablero({
      quotas_sex_faculty: [{ faculty: "Derecho", sex: "F", target: 300, observed: 300 }],
    }));
    expect(cumplida?.value).toBe("0");
  });
});

describe("el puntaje de representatividad no se repite en la banda", () => {
  // Decía «95 de 100» a dos centímetros del control «Representatividad efectiva
  // · Puntaje 94,8 de 100»: la misma cifra dos veces en la misma pantalla, con
  // distinta precisión. Se quedó la que contesta —el control trae el desvío en
  // puntos y su escala— y se retiró la que sólo repetía.
  //
  // La lección del formato sigue viva donde el puntaje vive: **se escribe «de
  // 100» y nunca con «%»**, porque no es una parte de ninguna población sino un
  // índice de desvío. Ese texto lo compone el motor.
  it("ninguna pestaña de calidad lo vuelve a poner como tile", () => {
    for (const pestana of ["controles", "base"]) {
      const tiles = aulasKpis(
        { validation: [], kpis: { representativity_effective_score: 93.1 } } as never,
        "calidad" as never,
        pestana,
      );
      expect(tiles.find((k) => k.label === "Representatividad")).toBeUndefined();
    }
  });
});

describe("«llegaron a su meta» sale del motor y no del estado operativo", () => {
  // El KPI contaba el estado `cerrando`, que el motor define como
  // `operational_status in (aplicada, cerrada)` **O** `validas >= meta`. Con el
  // OR basta con haber salido a campo, asi que decia 216 mientras el grafico de
  // cobertura —dos paneles mas abajo, misma pantalla— decia 0.
  const conCobertura = (cumplida: number, total: number, sinMeta: number) => ({
    course_status_cobertura: [
      { clave: "nulo", aulas: total - sinMeta - cumplida },
      { clave: "pleno", aulas: cumplida },
    ],
    course_status_total: total,
    course_status_sin_meta: sinMeta,
    // Estado operativo que diria OTRA cosa: todas aplicadas.
    course_status: Array.from({ length: total }, (_, i) => ({
      operational_code: `CH ${i}`, operational_status: "aplicada", expected_valid: 20, respuestas_validas: 0,
    })),
  });

  it("toma la cifra del motor, no la de las aplicadas", () => {
    const kpi = aulasKpis(conCobertura(7, 269, 2) as never, "avance")
      .find((k) => k.label === "Llegaron a su meta");
    expect(kpi?.value).toBe("7");
    // 269 aplicadas habrian dado «269» con la cuenta vieja.
    expect(kpi?.value).not.toBe("269");
  });

  it("el denominador es el total del motor menos las que no declaran meta", () => {
    const kpi = aulasKpis(conCobertura(7, 269, 2) as never, "avance")
      .find((k) => k.label === "Llegaron a su meta");
    // 269 - 2. Contarlo sobre `course_status` lo dejaba a merced del recorte a
    // 500 filas del payload.
    expect(kpi?.pista).toContain("267");
  });

  it("cero es una cifra, no un vacio", () => {
    const kpi = aulasKpis(conCobertura(0, 269, 2) as never, "avance")
      .find((k) => k.label === "Llegaron a su meta");
    expect(kpi?.value).toBe("0");
  });
});

describe("«¿vamos a llegar?» tiene por fin una cifra", () => {
  // La banda decía «llegaron a su meta: 0», «cuota por recoger: 1 558» y
  // «brechas: 168»: tres formas de decir que se va atrás, y ninguna decía si con
  // lo que hay agendado se llega. El número existía desde que la pirámide
  // predice, pero vivía sólo en el detalle, a dos pestañas de distancia.
  const historia = Array.from({ length: 8 }, (_, i) => ({
    operational_code: `CH ${i}`, faculty: "Derecho", applied_at: "2026-08-10",
    applied_date: "2026-08-10", effective_surveys: 20,
  }));

  const tableroCon = (target: number, observed: number, aulasAgendadas: number) => ({
    partes_campo: historia,
    agenda: [
      ...historia.map((h) => ({ ...h, scheduled_date: "2026-08-10" })),
      ...Array.from({ length: aulasAgendadas }, (_, i) => ({
        operational_code: `CH 9${i}`, faculty: "Derecho", scheduled_date: "2026-08-20",
        sample_status: "agendada",
      })),
    ],
    quotas_sex_faculty: [
      { faculty: "Derecho", sex: "Mujer", target, observed },
      { faculty: "Derecho", sex: "Hombre", target, observed },
    ],
  });

  const cierre = (t: unknown) =>
    aulasKpis(t as never, "avance").find((k) => k.label === "Cierran con lo agendado");

  it("cuenta las celdas que la agenda cubre, con su denominador", () => {
    // Dos celdas de 30 con 10 recogidas: faltan 20 en cada una, y cinco aulas
    // agendadas a ~20 por aula las cubren de sobra.
    const k = cierre(tableroCon(30, 10, 5));
    expect(k?.value).toBe("2");
    expect(k?.pista).toContain("2 grupos");
  });

  it("sin nada agendado no cierra ninguna, y avisa", () => {
    const k = cierre(tableroCon(300, 10, 0));
    expect(k?.value).toBe("0");
    expect(k?.tone).toBe("warn");
  });

  it("cuando cierran todas deja de ser una alarma", () => {
    const k = cierre(tableroCon(10, 10, 0));
    expect(k?.value).toBe("2");
    expect(k?.tone).toBe("neutral");
  });

  it("sin cuotas declaradas dice S/D, no cero", () => {
    // Cero celdas cerrando y «no hay celdas» son cosas distintas: un 0 ahí
    // mandaria a buscar un problema que no existe.
    const k = cierre({ ...tableroCon(30, 10, 5), quotas_sex_faculty: [] });
    expect(k?.value).toBe("S/D");
    expect(k?.tone).toBe("neutral");
  });

  it("una celda sin objetivo no cuenta como cerrada ni infla el denominador", () => {
    // El defecto real, visible en la portada del perfil con el estudio de HSVG:
    // «CIERRAN CON LO AGENDADO 10 de 30» con CERO aulas agendadas y cero
    // aplicadas. Las diez eran justo las diez celdas sin cuota: con meta 0,
    // `faltan` da 0 y `alcanza` sale true. La ausencia de objetivo se contaba
    // como objetivo cumplido.
    const base = tableroCon(300, 0, 0);
    const k = cierre({
      ...base,
      quotas_sex_faculty: [
        ...base.quotas_sex_faculty,
        { faculty: "Artes Escenicas", sex: "Mujer", target: 0, observed: 0 },
        { faculty: "Artes Escenicas", sex: "Hombre", target: 0, observed: 0 },
      ],
    });
    expect(k?.value).toBe("0");
    expect(k?.pista).toBe("de 2 grupos de facultad y sexo con meta · 2 sin objetivo declarado");
    expect(k?.tone).toBe("warn");
  });

  it("sin celdas mudas la pista no menciona objetivos ausentes", () => {
    // El control del mutante: si el sufijo se imprimiera siempre, esta pista
    // diria «· 0 sin objetivo declarado» y estaria inventando un vacio.
    expect(cierre(tableroCon(30, 10, 5))?.pista).toBe("de 2 grupos de facultad y sexo con meta");
  });
});

describe("la tarjeta de Efectivas y las que no entran en ninguna celda", () => {
  const dashboard = (validas: number, celdas: Array<[number, number]>) => ({
    kpis: { respuestas_validas: validas },
    quotas_sex_faculty: celdas.map(([target, observed], i) => ({
      faculty: `F${i}`, sex: "F", target, observed,
    })),
  }) as never;

  it("dice cuántas encuestas hechas no cuentan para ninguna cuota", () => {
    // El caso real del corte: 2 220 válidas y 2 185 atribuidas. Antes esta
    // diferencia sólo se decía si era TOTAL —«ninguna atribuida»—, así que 35
    // encuestas hechas quedaban invisibles en un operativo al que le faltan
    // 1 558 y cuyo banco entero no alcanza.
    const kpi = aulasKpis(dashboard(2220, [[3743, 2185]]), "avance")
      .find((k) => k.label === "Efectivas")!;
    expect(kpi.pista).toBe("35 no entran en ningún grupo con cuota");
    expect(kpi.detalle).toContain("2,185 de 2,220");
    expect(kpi.detalle).toContain("lo que les falta es el sexo");
  });

  it("sin diferencia, la pista no inventa un problema", () => {
    // El control: si la resta se hiciera mal —o si `observed` viniera recortado
    // al target— esta tarjeta acusaría en un corte sano.
    const kpi = aulasKpis(dashboard(2185, [[3743, 2185]]), "avance")
      .find((k) => k.label === "Efectivas")!;
    expect(kpi.pista).toBe("respuestas de la plataforma que pasan los filtros");
    expect(kpi.detalle).toBeUndefined();
  });

  it("ninguna atribuida sigue siendo su propio caso", () => {
    const kpi = aulasKpis(dashboard(2220, [[3743, 0]]), "avance")
      .find((k) => k.label === "Efectivas")!;
    // Dice CELDA, no curso-horario: es lo que `quotas_sex_faculty` mide. Un
    // simulacro enseño la tarjeta diciendo «ninguna atribuida a un
    // curso-horario» con 20 aulas ya en su meta dos paneles mas abajo.
    expect(kpi.pista).toContain("grupo de facultad y sexo");
    expect(kpi.pista).not.toContain("curso-horario");
  });
});

describe("la tarjeta de brechas dice brecha de qué", () => {
  /**
   * Se llamaba «Brechas» a secas y compartía banda con «Cuota por recoger», que
   * también cuenta lo que falta pero en PERSONAS. Las dos se leían como dos
   * cuentas del mismo hueco cuando son dos ejes distintos: la cuota son alumnos
   * que faltan para el objetivo del estudio; la brecha, cursos-horario que no
   * llegaron a su propia meta (`sum(tracked_df$brecha > 0)` en
   * `monitoreo_aulas_universitarias.R:2342`).
   *
   * No tenía ni un test, que es por lo que el renombrado pasó el gate sin
   * despeinar a nadie.
   */
  const brechas = (extra: Record<string, unknown> = {}) =>
    aulasKpis(tablero(extra), "avance").find((k) => k.label === "Cursos-horario bajo su meta");

  it("el rótulo nombra la unidad que cuenta", () => {
    const k = brechas({
      course_status: [
        { faculty: "Derecho", brecha: 30 },
        { faculty: "Ciencias", brecha: 12 },
      ],
    });
    expect(k, "la tarjeta desapareció de la banda de Avance").toBeDefined();
    expect(k?.value).toBe("92");
    expect(k?.pista).toBe("en 2 facultades");
  });

  it("sin desglose no dice «ninguno»: dice que falta el reparto", () => {
    // `course_status` puede llegar recortado. Una pista que negara las brechas
    // contradiría al número grande, que sigue diciendo 92.
    const k = brechas();
    expect(k?.value).toBe("92");
    expect(k?.pista).toContain("desglose");
    expect(k?.pista).not.toContain("ninguno");
  });

  it("una sola facultad se dice en singular", () => {
    expect(brechas({ course_status: [{ faculty: "Derecho", brecha: 30 }] })?.pista)
      .toBe("en 1 facultad");
  });
});

describe("cuando los dos estados se contradicen, manda el operativo", () => {
  // Gonzalo, 2026-08-31: «se supone que en las aulas titulares se agendan a
  // primer momento antes del campo». La agenda es previa al campo por diseño,
  // así que un titular con fecha no puede estar sin contactar: el dato bueno es
  // la fecha y el que hay que corregir es `sample_status`.
  const conDesfase = (): MonitoreoAulasDashboard => ({
    course_status: [
      // Dos que concuerdan y tres con la muestra desactualizada. Las cinco
      // están agendadas en el operativo, o sea las cinco tienen cita.
      { application_state: "lista", sample_status: "agendada", operational_status: "agendada" },
      { application_state: "lista", sample_status: "agendada", operational_status: "agendada" },
      { application_state: "lista", sample_status: "sin_contactar", operational_status: "agendada" },
      { application_state: "lista", sample_status: "sin_contactar", operational_status: "agendada" },
      { application_state: "lista", sample_status: "sin_contactar", operational_status: "agendada" },
    ],
  } as unknown as MonitoreoAulasDashboard);

  it("las cuenta con cita, no como sin contactar", () => {
    const kpi = aulasKpis(conDesfase(), "modelo").find((k) => k.label === "Sin empezar");
    expect(kpi, "no está el KPI «Sin empezar»").toBeTruthy();
    // Las CINCO tienen cita. Antes decía «2 con cita · 3 sin contactar
    // todavía», que manda a llamar a docentes que ya dieron hora.
    expect(kpi?.pista).toContain("5 con cita");
    expect(kpi?.pista).not.toContain("sin contactar");
  });

  it("y declara cuántas tienen la muestra sin actualizar, en vez de esconderlo", () => {
    // Arreglar el recuento y callar el desfase sería tapar un dato que hay que
    // ir a corregir en el Excel.
    const kpi = aulasKpis(conDesfase(), "modelo").find((k) => k.label === "Sin empezar");
    expect(kpi?.pista).toContain("3 sin actualizar en la muestra");
  });

  it("sin desfase, la pista no inventa la advertencia", () => {
    const limpio = {
      course_status: [
        { application_state: "lista", sample_status: "agendada", operational_status: "agendada" },
      ],
    } as unknown as MonitoreoAulasDashboard;
    const kpi = aulasKpis(limpio, "modelo").find((k) => k.label === "Sin empezar");
    expect(kpi?.pista).not.toContain("sin actualizar");
  });
});
