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
    // Desde 2026-09-08 Avance abre por las metas, no por la cuota pendiente:
    // el detalle de qué falta lo lleva la tabla de la pestaña.
    expect(etiquetas("avance")).toContain("Efectivas");
    expect(etiquetas("avance")).toContain("Avance a la muestra");
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

/**
 * Los SIETE KPIs de Avance, en el orden que dictó Gonzalo (2026-09-08).
 *
 * Textual: «No me interesa saber cuántos llegaron a su meta sino el porcentaje
 * de avance hacia la muestra (en este caso 2500), no me interesa saber cuántas
 * cierran con lo agendado. Me interesa que los KPIs sean los siguientes y en
 * este orden: Efectivas · Muestra (meta) · Avance (%) en base a la muestra ·
 * Sobremuestra · Avance (%) en base a la sobremuestra · Cursos horario
 * aplicados · Cursos horarios planificados.»
 *
 * Contrato anterior, citado para quien lea un diff: la banda era «Cursos-horario
 * aplicados · Efectivas · Llegaron a su meta · Cierran con lo agendado · Cuota
 * por recoger · Cursos-horario bajo su meta». Las tres que se fueron eran, en
 * ese orden, una cifra por curso-horario (no por muestra), una proyección —que
 * vive en la pestaña de predicción— y una brecha que la tabla ya detalla.
 */
describe("los siete KPIs de Avance", () => {
  const conMetas = {
    kpis: { aulas_aplicadas: 16, respuestas_validas: 212 },
    // **Las dos poblaciones, con cifras DISTINTAS a propósito.** El fixture las
    // tenía iguales en 174 y por eso este test estuvo verde mientras la tarjeta
    // publicaba 74 en el estudio real: `con_meta` («en juego y con meta») no es
    // «titulares del plan», que es lo que el rótulo promete y el denominador de
    // lo aplicado. Iguales, el test no puede distinguir de cuál lee.
    course_status_con_meta: 74,
    course_status_rol_y_estado: { titulares: { total: 174 } },
    avance_cuota: {
      total: { cuota: 2500, respuestas_validas: 212 },
      meta_diseno: 2500,
      meta_operativa: 3750,
    },
    quotas_sex_faculty: [
      { faculty: "F1", sex: "F", target: 1239, observed: 77 },
      { faculty: "F1", sex: "M", target: 1261, observed: 135 },
    ],
  } as unknown as MonitoreoAulasDashboard;

  it("son estos siete y en este orden", () => {
    expect(aulasKpis(conMetas, "avance").map((k) => k.label)).toEqual([
      "Efectivas",
      "Muestra",
      "Avance a la muestra",
      "Sobremuestra",
      "Avance a la sobremuestra",
      "Cursos-horario aplicados",
      "Cursos-horario planificados",
    ]);
  });

  it("las cinco cifras de meta salen de la misma fuente que la tabla", () => {
    const por = Object.fromEntries(aulasKpis(conMetas, "avance").map((k) => [k.label, k.value]));
    // Las mismas cifras medidas sobre el estado real de HSVG2026 y escritas en
    // la hoja «Avance de campo» del libro: 212 de 2 500 es 8,5 %, y de 3 750 es
    // 5,7 %. Si el KPI y la tabla discrepan, quien mira no puede saber cuál creer.
    expect(por.Efectivas).toBe("212");
    expect(por.Muestra).toBe("2,500");
    // El separador decimal se escribe como lo produzca el runner: `pctPerfil`
    // usa es-PE y el runner sin ICU degrada a punto. Lo que se pinea es la
    // CIFRA —un decimal, con su símbolo— no el locale de la máquina que corre
    // el test.
    expect(por["Avance a la muestra"]).toMatch(/^8[.,]5 %$/);
    expect(por.Sobremuestra).toBe("3,750");
    expect(por["Avance a la sobremuestra"]).toMatch(/^5[.,]7 %$/);
    expect(por["Cursos-horario aplicados"]).toBe("16");
    expect(por["Cursos-horario planificados"]).toBe("174");
  });

  it("lo que falta para la muestra se suma grupo a grupo, no se resta del total", () => {
    // 1 239 − 77 = 1 162 y 1 261 − 135 = 1 126: faltan 2 288. El neto
    // —2 500 − 212— da la misma cifra aquí porque ningún grupo se pasó; el
    // guard existe para el caso en que uno se pase (ADR 0079).
    const avance = aulasKpis(conMetas, "avance").find((k) => k.label === "Avance a la muestra");
    expect(avance?.pista).toBe("faltan 2,288");
  });

  it("sin cuotas del diseño ninguna tarjeta finge un cero", () => {
    const sinMetas = { kpis: { aulas_aplicadas: 3 } } as unknown as MonitoreoAulasDashboard;
    const por = Object.fromEntries(aulasKpis(sinMetas, "avance").map((k) => [k.label, k.value]));
    // «S/D» y «0» dicen cosas distintas: uno es que no hay meta declarada y el
    // otro que no se lleva nada de ella.
    expect(por.Muestra).toBe("S/D");
    expect(por["Avance a la muestra"]).toBe("S/D");
    expect(por.Sobremuestra).toBe("S/D");
    expect(por["Avance a la sobremuestra"]).toBe("S/D");
    expect(por.Efectivas).toBe("0");
  });

  it("las tres tarjetas que Gonzalo cortó no vuelven por la puerta de atrás", () => {
    const etiquetas = aulasKpis(conMetas, "avance").map((k) => k.label);
    for (const fuera of ["Llegaron a su meta", "Cierran con lo agendado", "Cuota por recoger"]) {
      expect(etiquetas).not.toContain(fuera);
    }
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
    // En CONSULTAS desde 2026-09-08: Gonzalo sacó de Avance la brecha por
    // curso-horario («no me interesa saber cuántos llegaron a su meta»), y la
    // tarjeta siguió viva donde se trabaja la cola de reemplazos.
    aulasKpis(tablero(extra), "consultas").find((k) => k.label === "Cursos-horario bajo su meta");

  it("el rótulo nombra la unidad que cuenta", () => {
    const k = brechas({
      course_status: [
        { faculty: "Derecho", brecha: 30 },
        { faculty: "Ciencias", brecha: 12 },
      ],
    });
    expect(k, "la tarjeta desapareció de la banda de Consultas").toBeDefined();
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

/**
 * A2 (loop estética-aulas-sheets, 2026-09-07). La tarjeta «Respuestas leídas»
 * decía 273 a secas y el embudo, en la misma pantalla, «273 · 37 fuera del
 * operativo · 24 no pasan el criterio · 212 que cuentan»: dos lecturas de la
 * misma cifra. `respuestas_total` cuenta TODAS las filas que llegaron,
 * incluidas las del QR de capacitación y prueba; la tarjeta lo dice con las
 * mismas claves y la misma regla que el embudo, no con una segunda cuenta.
 */
describe("A2: la tarjeta de respuestas dice lo mismo que el embudo", () => {
  const dashboard = {
    kpis: {
      aulas_titulares: 174,
      respuestas_total: 273,
      respuestas_validas: 212,
      respuestas_fuera_del_operativo: 37,
    },
  } as unknown as MonitoreoAulasDashboard;

  it("desglosa las recibidas en fuera del operativo, no pasan el criterio y efectivas", () => {
    const tarjeta = aulasKpis(dashboard, "fuentes").find((k) => k.label === "Respuestas leídas");
    expect(tarjeta).toBeDefined();
    expect(tarjeta?.value).toBe("273");
    expect(tarjeta?.pista).toBe("37 fuera del operativo · 24 no pasan el criterio · 212 efectivas");
  });

  it("los tres números salen de la misma regla que el embudo", async () => {
    const { embudoDelOperativo } = await import("./embudoDelOperativo");
    const recibidas = embudoDelOperativo(dashboard.kpis as never).find((e) => e.id === "recibidas");
    const tarjeta = aulasKpis(dashboard, "fuentes").find((k) => k.label === "Respuestas leídas");
    expect(recibidas?.merma?.label).toContain("37 fuera del operativo");
    expect(recibidas?.merma?.label).toContain("24 no pasan el criterio");
    expect(tarjeta?.pista).toContain("37 fuera del operativo");
    expect(tarjeta?.pista).toContain("24 no pasan el criterio");
  });

  it("sin filas de la plataforma declara el vacío en vez de un 0", () => {
    const vacio = { kpis: { aulas_titulares: 174, respuestas_total: 0 } } as unknown as MonitoreoAulasDashboard;
    const tarjeta = aulasKpis(vacio, "fuentes").find((k) => k.label === "Respuestas leídas");
    expect(tarjeta?.value).not.toBe("0");
    expect(tarjeta?.pista).toMatch(/todav[ií]a no/);
    expect(tarjeta?.tone).toBe("warn");
  });
});

/**
 * **La banda obedece al selector de la cabecera.**
 *
 * Captura del 2026-09-10 con Psicología puesta: el Resumen decía «12 de 99
 * respuestas que pide el plan» y la banda de arriba, «1 063 efectivas · Muestra
 * 2 500 · 56 cursos-horario aplicados». Dos lecturas contradictorias a diez
 * centímetros, y la de arriba se lee primero.
 */
describe("los KPIs de Avance con una facultad en el selector", () => {
  const tablero = {
    kpis: { aulas_aplicadas: 56, respuestas_validas: 1063 },
    course_status_con_meta: 74,
    course_status_rol_y_estado: { titulares: { total: 174 } },
    avance_cuota: {
      total: { cuota: 2500, respuestas_validas: 1063, brecha: 1437 },
      meta_diseno: 2500,
      meta_operativa: 3750,
      facultades: [
        { facultad: "PSICOLOGÍA", faculty_key: "psicologia", cuota: 75, respuestas_validas: 12, brecha: 63 },
        { facultad: "DERECHO", faculty_key: "derecho", cuota: 400, respuestas_validas: 300, brecha: 0 },
      ],
    },
    quotas_sex_faculty: [
      { faculty: "PSICOLOGÍA", sex: "F", target: 40, observed: 8 },
      { faculty: "PSICOLOGÍA", sex: "M", target: 35, observed: 4 },
      { faculty: "DERECHO", sex: "F", target: 200, observed: 200 },
      { faculty: "DERECHO", sex: "M", target: 200, observed: 100 },
    ],
    course_status_rol_y_estado_por_facultad: {
      "PSICOLOGÍA": { titulares: { total: 6, aplicado: 1 } },
      "DERECHO": { titulares: { total: 30, aplicado: 22 } },
    },
  } as unknown as MonitoreoAulasDashboard;

  const por = (facultad: string) =>
    Object.fromEntries(aulasKpis(tablero, "avance", "", facultad).map((k) => [k.label, k]));

  it("las cifras son las de la facultad, no las del estudio", () => {
    const k = por("PSICOLOGÍA");
    expect(k["Efectivas"].value).toBe("12");
    expect(k["Muestra"].value).toBe("75");
    expect(k["Avance a la muestra"].value).toBe("16.0 %");
    expect(k["Cursos-horario aplicados"].value).toBe("1");
    expect(k["Cursos-horario planificados"].value).toBe("6");
  });

  it("sin facultad puesta sigue diciendo las del estudio", () => {
    const k = Object.fromEntries(aulasKpis(tablero, "avance").map((x) => [x.label, x]));
    expect(k["Efectivas"].value).toBe("1,063");
    expect(k["Muestra"].value).toBe("2,500");
    expect(k["Cursos-horario aplicados"].value).toBe("56");
  });

  it("lo que falta es la BRECHA de su fila, no la resta de su cuota", () => {
    // 75 - 12 = 63 coincide aquí; lo que se comprueba es que sale del bloque.
    const conExcedente = {
      ...tablero,
      avance_cuota: {
        ...(tablero as unknown as { avance_cuota: Record<string, unknown> }).avance_cuota,
        facultades: [{ facultad: "PSICOLOGÍA", cuota: 75, respuestas_validas: 80, brecha: 17 }],
      },
    } as unknown as MonitoreoAulasDashboard;
    const k = Object.fromEntries(
      aulasKpis(conExcedente, "avance", "", "PSICOLOGÍA").map((x) => [x.label, x]),
    );
    // La resta daría CERO con 80 sobre 75, y hay diecisiete mujeres pendientes.
    expect(k["Avance a la muestra"].pista).toBe("faltan 17");
  });

  it("la sobremuestra no se prorratea, y la pista dice por qué", () => {
    const k = por("PSICOLOGÍA");
    expect(k["Sobremuestra"].value).toBe("S/D");
    expect(k["Sobremuestra"].pista).toContain("no por facultad");
    expect(k["Avance a la sobremuestra"].value).toBe("S/D");
  });

  it("empareja aunque la tilde de la facultad venga descompuesta", () => {
    expect(por("PSICOLOGÍA".normalize("NFD"))["Muestra"].value).toBe("75");
  });

  it("una facultad sin fila en el bloque no hereda las cifras del estudio", () => {
    const k = por("ARQUITECTURA");
    expect(k["Efectivas"].value).toBe("0");
    expect(k["Muestra"].value).toBe("S/D");
    expect(k["Cursos-horario aplicados"].value).toBe("0");
  });
});

/**
 * **EL GUARD DE LA CLASE: la misma cifra, dos fuentes según la rama.**
 *
 * El 2026-09-12 la tarjeta «Cursos-horario planificados» publicaba 74 sin foco y
 * el número correcto con una facultad puesta, porque cada rama leía un campo
 * distinto del tablero. Lo vio un ojo humano —87 aplicados sobre 74
 * planificados es imposible—, no un test: el fixture le daba el mismo valor a
 * las dos poblaciones y la aserción pasaba leyera de donde leyera.
 *
 * Una regresión sobre ese caso no cierra la clase; sólo cierra esa tarjeta. El
 * invariante que sí la cierra es de COHERENCIA y no depende de qué campo lea
 * cada rama: **lo general tiene que ser la suma de lo particular**. Si mañana
 * alguien cambia una de las dos ramas a otra fuente, esta suma deja de cuadrar
 * aunque el fixture mienta.
 */
describe("coherencia entre la banda general y la banda por facultad", () => {
  const tablero = {
    kpis: { aulas_aplicadas: 23, respuestas_validas: 312 },
    // Las dos poblaciones con cifras distintas, para que la aserción sea
    // falsable: `con_meta` NO es «titulares del plan».
    course_status_con_meta: 9,
    course_status_rol_y_estado: { titulares: { total: 36 } },
    avance_cuota: {
      total: { cuota: 475, respuestas_validas: 312 },
      meta_diseno: 475,
      facultades: [
        { facultad: "PSICOLOGÍA", faculty_key: "psicologia", cuota: 75, respuestas_validas: 12 },
        { facultad: "DERECHO", faculty_key: "derecho", cuota: 400, respuestas_validas: 300 },
      ],
    },
    quotas_sex_faculty: [],
    course_status_rol_y_estado_por_facultad: {
      "PSICOLOGÍA": { titulares: { total: 6, aplicado: 1 } },
      "DERECHO": { titulares: { total: 30, aplicado: 22 } },
    },
  } as unknown as MonitoreoAulasDashboard;

  const num = (v: string) => Number(String(v).replace(/[^\d.-]/g, ""));
  const kpi = (facultad: string, label: string) =>
    aulasKpis(tablero, "avance", "", facultad).find((k) => k.label === label);

  it("«Cursos-horario planificados» general es la suma de las facultades", () => {
    const general = num(kpi("", "Cursos-horario planificados")!.value);
    const suma = ["PSICOLOGÍA", "DERECHO"]
      .map((f) => num(kpi(f, "Cursos-horario planificados")!.value))
      .reduce((a, b) => a + b, 0);
    // 6 + 30 = 36, y NO 9, que es lo que devolvía la fuente equivocada.
    expect(suma).toBe(36);
    expect(general).toBe(suma);
  });

  it("«Efectivas» general es la suma de las facultades", () => {
    const general = num(kpi("", "Efectivas")!.value);
    const suma = ["PSICOLOGÍA", "DERECHO"]
      .map((f) => num(kpi(f, "Efectivas")!.value))
      .reduce((a, b) => a + b, 0);
    expect(general).toBe(suma);
  });
});

/**
 * **La banda de Consultas preside SEIS pestañas**, así que un desglose que no
 * desglosa se ve seis veces. Con la cuota por nivel, «Cursos-horario bajo su
 * meta · 50 · en 1 facultad» era eso: el reparto repartido por una columna que
 * en ese estudio vale lo mismo en las 136 unidades.
 *
 * Gonzalo, 2026-09-18: «una particularidad es eso; la app debe ser útil para
 * cualquier estudio, y por eso la importancia de que sea generalista y de
 * configuración». El reparto sigue la columna DECLARADA, no una fija.
 */
describe("Cursos-horario bajo su meta: el desglose sigue al eje", () => {
  const conEje = (eje: unknown, filas: unknown[]) =>
    aulasKpis(
      tablero({ course_status: filas, avance_cuota: { eje } } as Record<string, unknown>),
      "consultas",
    ).find((k) => k.label === "Cursos-horario bajo su meta");

  const NIVEL = {
    clave: "nivel", etiqueta: "Nivel", etiqueta_plural: "Niveles",
    etiqueta_sin: "Sin nivel", columna: "level", atribucion: "persona",
  };

  it("con el eje en nivel reparte por nivel, y lo dice con su palabra", () => {
    const k = conEje(NIVEL, [
      { faculty: "CIENCIAS SOCIALES", level: "6", brecha: 30 },
      { faculty: "CIENCIAS SOCIALES", level: "7", brecha: 12 },
      { faculty: "CIENCIAS SOCIALES", level: "8", brecha: 5 },
    ]);
    // Tres, no uno: es el desglose que la tarjeta promete.
    expect(k?.pista).toBe("en 3 niveles");
    expect(k?.detalle).toContain("La mayor es Nivel 6");
  });

  it("y el matiz del valor de PERSONA va al tooltip, no a la pista", () => {
    // Con un eje que resuelve por padrón, el valor de un curso-horario es el de
    // la mayoría de sus alumnos y el de una meta es el de cada persona: misma
    // palabra, dos poblaciones. En la pista no cabe; el tooltip existe para eso.
    const k = conEje(NIVEL, [{ level: "6", brecha: 30 }]);
    expect(k?.pista).toBe("en 1 nivel");
    expect(k?.detalle).toContain("la mayoría de los alumnos del curso-horario");
  });

  it("sin eje declarado no se mueve un byte", () => {
    // HSVG está en campo: su banda dice lo mismo que ayer.
    const k = conEje(undefined, [
      { faculty: "Derecho", brecha: 30 }, { faculty: "Ciencias", brecha: 12 },
    ]);
    expect(k?.pista).toBe("en 2 facultades");
    expect(k?.detalle).not.toContain("mayoría de los alumnos");
  });
});
