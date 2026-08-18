/**
 * Las dos tarjetas comparativas que pidió Gonzalo: «hay que separar criterios
 * generales y luego el card de cada facultad con sus criterios específicos y
 * todas sus cuentas y compararlos con el 2025, sus cuentas y sus métodos».
 *
 * Y el comparativo es «no sólo de números sino de método»: por eso la tarjeta
 * general dice, decisión a decisión, si coincide con el estudio anterior.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  normalizeCalcMuestraReferenciaCriterios,
  type CalcMuestraAulasEstrato,
} from "../../../../../api/calcMuestra";
import { CriteriosGeneralesCard, type CriterioGeneralFila } from "../CriteriosGeneralesCard";
import {
  criteriosGeneralesDeEstudio,
  fmtCifra,
  fmtPorcentaje,
} from "../criteriosGeneralesModel";
import { FichaPorFacultadCard } from "../FichaPorFacultadCard";
import {
  claveFicha,
  claveMotor,
  criteriosPropiosDeFacultad,
  fichaDeFacultad,
  filasParaFichas,
} from "../fichaFacultadModel";

/** Cifras reales del libro de referencia de 2025. */
const REF_CRUDO = {
  schema: "calc_muestra_referencia_criterios_v1",
  periodo: "2025-2",
  estudio: "HSVBG2025_referencia_para_motor.xlsx",
  general: {
    muestra: "2500", ratio_sobremuestra: "1.5", aulas_marco: "1097",
    aulas_dimensionadas: "170", metodo_seleccion: "Sistemático sobre el marco",
    tasa_respuesta_asumida: "0.7038",
  },
  por_facultad: [
    {
      faculty_key: "letras_y_ciencias_humanas", facultad: "LETRAS Y CIENCIAS HUMANAS",
      poblacion: 225, cuota: 25, aulas_sorteadas: 9, aulas_titulares: 4,
      alumnos_por_ch: 12.5,
    },
  ],
};

const FILA = {
  estrato: "LETRAS Y CIENCIAS HUMANAS", N: 225, cuota: 26, avg_conglomerado: 16,
  tau: 0.53, aulas_base: 4, aulas_reemplazo: 0, aulas_total: 4, tipo_aula: "G1",
  precision_e: null,
  margen: {
    aulas_disponibles: 12, aulas_requeridas: 4, aulas_sobrantes: 8,
    reservas_sostenibles: 2, reservas_pedidas: 11, estado: "reservas_cortas",
    aviso: "LETRAS Y CIENCIAS HUMANAS sostiene 2 reservas por titular con 12 aulas para 4 titulares, por debajo de las 11 que pide el diseño.",
  },
} as unknown as CalcMuestraAulasEstrato;

describe("normalizador de la referencia histórica de criterios", () => {
  it("conserva el método general y las cuentas por facultad", () => {
    const r = normalizeCalcMuestraReferenciaCriterios(REF_CRUDO);
    expect(r?.periodo).toBe("2025-2");
    expect(r?.general.muestra).toBe("2500");
    expect(r?.por_facultad[0].cuota).toBe(25);
  });

  it("una fila sin facultad se descarta y sin filas no hay bloque", () => {
    expect(normalizeCalcMuestraReferenciaCriterios({ por_facultad: [{ cuota: 10 }] })).toBeNull();
    expect(normalizeCalcMuestraReferenciaCriterios(null)).toBeNull();
  });
});

describe("tarjeta de criterios generales", () => {
  const FILAS = [
    { concepto: "Muestra de diseño", hoy: "2500", claveHistorica: "muestra" },
    { concepto: "Método de selección", hoy: "cube balanceado", claveHistorica: "metodo_seleccion" },
    { concepto: "Aulas a visitar", hoy: "226", claveHistorica: "aulas_dimensionadas" },
  ];

  it("dice decisión a decisión si coincide con el estudio anterior", () => {
    const html = renderToStaticMarkup(
      <CriteriosGeneralesCard
        filas={FILAS}
        referencia={normalizeCalcMuestraReferenciaCriterios(REF_CRUDO)}
      />,
    );
    // La muestra coincide; el método y las aulas no.
    expect(html).toContain('data-igual="true"');
    expect(html).toContain('data-igual="false"');
    expect(html).toContain("<strong>2</strong> de 3 decisiones cambiaron");
    expect(html).toContain("2025-2");
  });

  it("sin histórico lo dice ARRIBA y retira las dos columnas vacías", () => {
    // Un hueco se lee como «igual», pero quince filas de «sin referencia» y
    // quince guiones tapan la única columna que sí tiene datos. El aviso del
    // encabezado dice lo mismo una vez.
    const html = renderToStaticMarkup(
      <CriteriosGeneralesCard filas={FILAS} referencia={null} />,
    );
    expect(html).toContain("Sin histórico cargado");
    expect(html).not.toContain("sin referencia");
    expect(html).not.toContain("¿Igual?");
    // CONTROL: la columna de este estudio sigue entera.
    expect(html).toContain("Este estudio");
    expect(html).not.toContain('data-igual="true"');
  });
});

describe("ficha por facultad", () => {
  const ficha = (ref: unknown) =>
    fichaDeFacultad(FILA, 149, 12, 16, normalizeCalcMuestraReferenciaCriterios(ref));

  it("arma los seis pasos con su columna del estudio anterior", () => {
    const f = ficha(REF_CRUDO);
    expect(f.pasos).toHaveLength(6);
    expect(f.pasos[0]).toMatchObject({ n: 1, hoy: 225, antes: 225 });
    expect(f.pasos[1]).toMatchObject({ n: 2, hoy: 26, antes: 25 });
    expect(f.pasos[2]).toMatchObject({ n: 3, hoy: 12, antes: 9 });
    expect(f.pasos[4]).toMatchObject({ n: 5, hoy: 4, antes: 4 });
    expect(f.reservasSostenibles).toBe(2);
    expect(f.reservasPedidas).toBe(11);
  });

  it("sin histórico la columna anterior es null, no 0", () => {
    // Un 0 se leería como «el estudio anterior no visitó ninguna».
    const f = ficha(null);
    expect(f.pasos[1].antes).toBeNull();
    expect(f.pasos[4].antes).toBeNull();
  });

  it("empareja la facultad aunque cambien acentos y puntuación", () => {
    expect(claveFicha("GASTRONOMÍA, HOTELERÍA Y TURISMO")).toBe(
      claveFicha("GASTRONOMIA HOTELERIA Y TURISMO"),
    );
    // CONTROL: dos facultades distintas NO se funden.
    expect(claveFicha("ESTUDIOS GENERALES LETRAS")).not.toBe(
      claveFicha("ESTUDIOS GENERALES CIENCIAS"),
    );
  });

  it("la tarjeta resume si le alcanzan las aulas antes de abrirla", () => {
    const html = renderToStaticMarkup(
      <FichaPorFacultadCard fichas={[ficha(REF_CRUDO)]} periodo="2025-2" />,
    );
    expect(html).toContain("necesita 4");
    expect(html).toContain("tiene 12");
    expect(html).toContain("2 reservas por titular de 11");
    expect(html).toContain('data-alcanza="true"');
  });

  it("marca la facultad a la que NO le alcanzan las aulas", () => {
    const corta = fichaDeFacultad(
      { ...FILA, estrato: "ESTUDIOS GENERALES LETRAS", cuota: 389,
        margen: { ...(FILA.margen ?? {}), aulas_requeridas: 49, aulas_disponibles: 12,
                  aulas_sobrantes: 0, reservas_sostenibles: 0 } } as unknown as CalcMuestraAulasEstrato,
      482, 12, 15, null,
    );
    const html = renderToStaticMarkup(<FichaPorFacultadCard fichas={[corta]} />);
    expect(html).toContain('data-alcanza="false"');
    expect(html).toContain("necesita 49");
    expect(html).toContain("tiene 12");
  });

  it("sin fichas no dibuja nada", () => {
    // Sin fichas la tarjeta NO desaparece: dice por qué está vacía. Medido con
    // HSVG2026 abierto, donde el marco existe pero los estratos aún no, y la
    // pestaña no dejaba distinguir eso de una tarjeta inexistente.
    const vacia = renderToStaticMarkup(<FichaPorFacultadCard fichas={[]} />);
    expect(vacia).toContain("Todavía no hay estratos calculados");
    expect(vacia).toContain("Cálculo");
    // CONTROL: no finge una lista.
    expect(vacia).not.toContain("cmv2-ficha-lista");
  });
});

/**
 * Montaje, por contrato sobre la fuente.
 *
 * El mutante del montaje sobrevivió TRES veces hoy: con las tarjetas
 * desmontadas, más de 1.400 tests seguían en verde. Aquí no se puede renderizar
 * `UniversidadDesk` —pide una docena de props y un modelo completo—, así que se
 * comprueba el cableado sobre el archivo, que es el patrón que el repo ya usa
 * para las rutas (`auditReadyRoutes.contract.test.ts`).
 *
 * Es más débil que renderizar, pero mata al mutante: si alguien quita el
 * montaje, este test cae.
 */
describe("contrato: las dos tarjetas están cableadas en Entrega", () => {
  const desk = readFileSync(new URL("../../UniversidadDesk.tsx", import.meta.url), "utf8");
  const tab = readFileSync(
    new URL("../../salidas/SalidasCoincidenciaTab.tsx", import.meta.url),
    "utf8",
  );

  // La cadena tiene DOS eslabones desde que las tarjetas se mudaron a Entrega:
  // el desk monta la pestaña, y la pestaña pinta las tarjetas. Cubrir sólo uno
  // deja vivo el mutante que ya sobrevivió tres veces en este trabajo.
  it("el desk monta la pestaña de Entrega con las tres piezas", () => {
    expect(desk).toContain('from "./salidas/SalidasCoincidenciaTab"');
    // Anclado al `{` de apertura: con `toMatch` suelto, un `{false && …` deja
    // el texto intacto y el mutante sobrevive. Lo comprobé.
    expect(desk).toContain('{showLocalTab("salidas-coincidencia") && <div id="cmv2-local-salidas-coincidencia">');
    expect(desk).toMatch(/<SalidasCoincidenciaTab[\s\S]*?criteriosGenerales=\{criteriosGenerales\}/);
    expect(desk).toMatch(/<SalidasCoincidenciaTab[\s\S]*?fichas=\{fichasFacultad\}/);
    expect(desk).toMatch(/<SalidasCoincidenciaTab[\s\S]*?referencia=\{referenciaCriterios\}/);
  });

  it("la pestaña pinta las dos tarjetas", () => {
    expect(tab).toContain('from "../criterios/CriteriosGeneralesCard"');
    expect(tab).toContain('from "../criterios/FichaPorFacultadCard"');
    expect(tab).toMatch(/<CriteriosGeneralesCard[\s\S]*?referencia=\{referencia\}/);
    expect(tab).toMatch(/<FichaPorFacultadCard[\s\S]*?fichas=\{fichas\}/);
  });

  it("CONTROL: ya NO viven en Marco, donde no hay estratos resueltos", () => {
    // Gonzalo: «no sé qué hace en Marco cuando aún ni definimos los criterios de
    // estudiantes o de cursos horarios». Medido: ahí las fichas salían vacías.
    const marco = desk.slice(
      desk.indexOf('id="cmv2-local-marco-criterios-alumno"'),
      desk.indexOf('id="cmv2-local-marco-alumnos-ch"'),
    );
    expect(marco).not.toContain("<FichaPorFacultadCard");
    expect(marco).not.toContain("<CriteriosGeneralesCard");
  });

  it("las decisiones generales se leen del ESTUDIO, no de literales", () => {
    // El mutante que importa: pasar `undefined` como parámetros deja la columna
    // de este estudio en blanco sin que nada mas falle.
    expect(desk).toContain('from "./criterios/criteriosGeneralesModel"');
    expect(desk).toMatch(/criteriosGeneralesDeEstudio\(\{[\s\S]*?parametros: facultyComp\?\.parametros/);
    expect(desk).toMatch(/criteriosGeneralesDeEstudio\(\{[\s\S]*?selector: syncedWorkspace\.aulas_config/);
    // CONTROL: ningun valor de la tabla vuelve a estar escrito a mano.
    expect(desk).not.toContain('hoy: "1.5"');
    expect(desk).not.toContain('hoy: "cube balanceado"');
  });

  it("la referencia se lee del bloque `aulas` del payload", () => {
    // Vive dentro de `aulas` y no al lado de `referencia_asistencia` porque
    // `CalcMuestraPage.tsx` está congelada y no debe crecer para pasar una prop.
    expect(desk).toContain("aulasState?.referencia_criterios");
  });
});

/**
 * Los criterios que rigen SÓLO en una facultad.
 *
 * Gonzalo: «los criterios no son generales, son por facultad». Dos cosas se
 * declaran así hoy: el mínimo de elegibles propio y las excepciones de tipo de
 * sesión —«en arquitectura y arte y diseño el taller tiene muchas más clases con
 * muchos más alumnos»—. Sin verlas, la ficha muestra cuentas sin decir de qué
 * reglas salen.
 */
describe("criterios propios de una facultad", () => {
  const SUITE = {
    minEligible: { threshold: 15, byFaculty: { arte_y_diseno: 10 } },
    byVariable: {
      session_type: {
        scope: "aula", categories: ["teorico"],
        exceptions: {
          arte_y_diseno: { categories: ["taller"], op: "add" },
          artes_escenicas: { categories: ["taller"], op: "replace" },
        },
      },
    },
  };

  it("lee el mínimo propio y dice cuál es el general", () => {
    const c = criteriosPropiosDeFacultad("ARTE Y DISEÑO", SUITE, 15);
    const min = c.find((x) => x.clase === "minimo");
    expect(min?.etiqueta).toBe("Mínimo propio: 10 elegibles");
    expect(min?.detalle).toBe("el general es 15");
  });

  it("distingue una excepción que SUMA de una que SUSTITUYE", () => {
    const suma = criteriosPropiosDeFacultad("ARTE Y DISEÑO", SUITE, 15)
      .find((x) => x.clase === "excepcion");
    expect(suma?.etiqueta).toBe("session_type: además taller");
    expect(suma?.detalle).toContain("se suman");

    const sustituye = criteriosPropiosDeFacultad("ARTES ESCÉNICAS", SUITE, 15)
      .find((x) => x.clase === "excepcion");
    expect(sustituye?.etiqueta).toBe("session_type: sólo taller");
    expect(sustituye?.detalle).toContain("sustituye");
  });

  it("CONTROL: una facultad sin reglas propias no inventa ninguna", () => {
    expect(criteriosPropiosDeFacultad("DERECHO", SUITE, 15)).toHaveLength(0);
    expect(criteriosPropiosDeFacultad("ARTE Y DISEÑO", null, 15)).toHaveLength(0);
  });

  it("la clave usa el formato del MOTOR, con la ñ a n", () => {
    // Con otra normalización los criterios propios quedarían invisibles sin que
    // nada fallara.
    expect(claveMotor("ARTE Y DISEÑO")).toBe("arte_y_diseno");
    expect(claveMotor("GASTRONOMÍA, HOTELERÍA Y TURISMO")).toBe(
      "gastronomia_hoteleria_y_turismo",
    );
    // El apóstrofe se BORRA, no se vuelve guion bajo: el motor hace lo mismo en
    // una línea aparte, y `d_onofrio` no indexaría nada.
    expect(claveMotor("D'ONOFRIO")).toBe("donofrio");
    // CONTROL: dos facultades parecidas no colapsan.
    expect(claveMotor("ESTUDIOS GENERALES LETRAS")).not.toBe(
      claveMotor("ESTUDIOS GENERALES CIENCIAS"),
    );
  });

  it("la ficha los pinta, y dice cuándo no hay", () => {
    const con = fichaDeFacultad(
      { ...FILA, estrato: "ARTE Y DISEÑO" } as unknown as CalcMuestraAulasEstrato,
      320, 55, 17, null, SUITE, 15,
    );
    const html = renderToStaticMarkup(<FichaPorFacultadCard fichas={[con]} />);
    expect(html).toContain("Criterios propios:");
    expect(html).toContain("Mínimo propio: 10 elegibles");
    expect(html).toContain("session_type: además taller");

    // CONTROL: una facultad sin reglas propias no anuncia ninguna.
    const sin = fichaDeFacultad(FILA, 149, 12, 16, null, SUITE, 15);
    const htmlSin = renderToStaticMarkup(<FichaPorFacultadCard fichas={[sin]} />);
    expect(htmlSin).not.toContain("Criterios propios:");
  });
});

/**
 * De qué componente salen las cuentas — el defecto que Gonzalo vio en su propio
 * proyecto: «con todos los E que hicimos, todos los cálculos ya deberían estar
 * hechos», y la tarjeta mostraba cero facultades.
 */
describe("qué filas alimentan las fichas", () => {
  const fila = (estrato: string, margen: unknown = undefined) =>
    ({ estrato, N: 100, cuota: 20, aulas_base: 3, ...(margen === undefined ? {} : { margen }) });
  const comp = (id: string, filas: unknown[]) =>
    ({ actor_id: id, resultado: { aulas_por_estrato: filas } }) as never;

  it("prefiere el componente que SÍ publicó margen", () => {
    const sinM = comp("total", [fila("TOTAL")]);
    const conM = comp("facultad", [fila("DERECHO", { aulas_requeridas: 46 })]);
    expect(filasParaFichas([sinM, conM], conM)?.[0]).toMatchObject({ estrato: "DERECHO" });
  });

  it("sin margen en ningún componente usa el de FACULTAD, no el total", () => {
    // Es el caso de un estudio calculado antes de que R publicara `margen`.
    const total = comp("total", [fila("TOTAL")]);
    const fac = comp("facultad", [fila("DERECHO"), fila("EDUCACION")]);
    const filas = filasParaFichas([total, fac], fac);
    expect(filas).toHaveLength(2);
    expect(filas?.map((f) => (f as { estrato: string }).estrato)).toEqual(["DERECHO", "EDUCACION"]);
  });

  it("CONTROL: sin filas por facultad devuelve null, no una lista vacía disfrazada", () => {
    expect(filasParaFichas([comp("total", [])], comp("facultad", []))).toBeNull();
    expect(filasParaFichas([], null)).toBeNull();
  });
});

/**
 * Las decisiones generales, leídas de donde viven.
 *
 * Gonzalo las vio en su pantalla: la tarjeta decía «Ratio de sobremuestra 1.5»
 * mientras su estudio estaba configurado con 0,2. Estaba escrito a mano en el
 * código, igual que el método de selección. Una tarjeta cuyo trabajo es decir si
 * este estudio coincide con el anterior no puede inventar la mitad de la columna
 * de este estudio.
 */
describe("criterios generales del estudio", () => {
  const PARAMS = {
    oversample_pct: 0.2, tau: 0.53, deff: 1.5,
    estadistico_conglomerado: "media", promedio_conglomerado: 20,
  };
  const SELECTOR = { selector_engine: "cube_balanceado", method_family: "balanced_probability" };
  const FILAS_EST = [
    { cuota: 512, aulas_base: 49, margen: { aulas_requeridas: 49 } },
    { cuota: 483, aulas_base: 46, margen: null },
  ];
  const busca = (fs: CriterioGeneralFila[], c: string) => fs.find((f) => f.concepto === c)?.hoy;

  it("la sobremuestra sale de los PARÁMETROS, no de un literal", () => {
    const fs = criteriosGeneralesDeEstudio({
      parametros: PARAMS, selector: SELECTOR, aulasMarco: 2112, filas: FILAS_EST,
    });
    expect(busca(fs, "Sobremuestra")).toBe("20 %");
    // CONTROL: con otro estudio cambia. El literal «1.5» no cambiaba nunca.
    const otro = criteriosGeneralesDeEstudio({
      parametros: { ...PARAMS, oversample_pct: 0.5 }, selector: SELECTOR,
      aulasMarco: null, filas: null,
    });
    expect(busca(otro, "Sobremuestra")).toBe("50 %");
  });

  it("publica el ESTADÍSTICO, que es lo que decide cuántas aulas hacen falta", () => {
    const fs = criteriosGeneralesDeEstudio({
      parametros: PARAMS, selector: SELECTOR, aulasMarco: 2112, filas: FILAS_EST,
    });
    expect(busca(fs, "Estadístico por curso-horario")).toBe("media");
    const p25 = criteriosGeneralesDeEstudio({
      parametros: { ...PARAMS, estadistico_conglomerado: "p25" },
      selector: SELECTOR, aulasMarco: null, filas: null,
    });
    expect(busca(p25, "Estadístico por curso-horario")).toBe("primer cuartil (p25)");
  });

  it("el método de selección sale del config, anidado o plano", () => {
    // El motor lo anida bajo `selector`; el workspace del front lo trae plano.
    // Medido: leyendo sólo la forma anidada, la fila salía «—» en la app real.
    const plano = criteriosGeneralesDeEstudio({
      parametros: PARAMS, selector: { selector_engine: "sistematico" },
      aulasMarco: null, filas: null,
    });
    expect(busca(plano, "Método de selección")).toBe("sistemático");

    const anidado = criteriosGeneralesDeEstudio({
      parametros: PARAMS, selector: { selector: { selector_engine: "cube_balanceado" } },
      aulasMarco: null, filas: null,
    });
    expect(busca(anidado, "Método de selección")).toBe("cube balanceado");

    // El workspace trae además `selector` como string suelto.
    const texto = criteriosGeneralesDeEstudio({
      parametros: PARAMS, selector: { selector: "cube_balanceado" },
      aulasMarco: null, filas: null,
    });
    expect(busca(texto, "Método de selección")).toBe("cube balanceado");
  });

  it("las aulas a visitar caen a `aulas_base` cuando no hay margen", () => {
    // Dejarlo en «—» teniendo la cifra escondía justo el número que la tarjeta
    // existe para dar.
    const fs = criteriosGeneralesDeEstudio({
      parametros: PARAMS, selector: SELECTOR, aulasMarco: 2112, filas: FILAS_EST,
    });
    expect(busca(fs, "Aulas a visitar")).toBe("95");
    expect(busca(fs, "Muestra de diseño")).toBe("995");
  });

  it("CONTROL: lo no declarado queda VACÍO, nunca con un valor inventado", () => {
    const fs = criteriosGeneralesDeEstudio({
      parametros: null, selector: null, aulasMarco: null, filas: null,
    });
    for (const f of fs) expect(f.hoy).toBe("");
  });

  it("las cifras se formatean, y un AUSENTE nunca se vuelve «0»", () => {
    expect(fmtCifra(21365)).toMatch(/^21.365$/);
    expect(fmtCifra(0.53, 2)).toContain("53");
    expect(fmtPorcentaje(0.2)).toBe("20 %");
    // `Number(null)` y `Number("")` valen 0: sin filtro, un dato que falta se
    // pintaría «0» y se leería como medido.
    expect(fmtCifra(null)).toBe("");
    expect(fmtCifra("")).toBe("");
    expect(fmtCifra(undefined)).toBe("");
    expect(fmtPorcentaje(null)).toBe("");
    expect(fmtPorcentaje(undefined)).toBe("");
    // CONTROL: un cero DECLARADO sí se pinta.
    expect(fmtCifra(0)).toBe("0");
    expect(fmtPorcentaje(0)).toBe("0 %");
  });
});

/**
 * El paso de aulas se compara contra lo que el estudio anterior APLICÓ.
 *
 * 2025 declaró 170 titulares y aplicó 194: la diferencia son los reemplazos.
 * Comparar contra una u otra cifra cambia el diagnóstico — en DERECHO, contra el
 * objetivo de la plantilla nuestra cuenta parecía −6 y contra lo aplicado es −1.
 */
describe("la ficha compara contra las aulas aplicadas", () => {
  const conAplicadas = (extra: Record<string, unknown>) =>
    normalizeCalcMuestraReferenciaCriterios({
      ...REF_CRUDO,
      por_facultad: [{
        faculty_key: "letras_y_ciencias_humanas",
        facultad: "LETRAS Y CIENCIAS HUMANAS",
        ...extra,
      }],
    });

  it("prefiere las APLICADAS sobre los titulares", () => {
    const ref = conAplicadas({ aulas_titulares: 4, aulas_aplicadas: 7 });
    const paso = fichaDeFacultad(FILA, 149, 12, 16, ref).pasos.find((p) => p.n === 5);
    expect(paso?.antes).toBe(7);
  });

  it("cae a los titulares cuando no hay aplicadas", () => {
    // Un histórico que sólo trae el diseño sigue sirviendo para comparar.
    const ref = conAplicadas({ aulas_titulares: 4 });
    const paso = fichaDeFacultad(FILA, 149, 12, 16, ref).pasos.find((p) => p.n === 5);
    expect(paso?.antes).toBe(4);
  });

  it("CONTROL: sin ninguna de las dos, el paso queda en blanco y no en 0", () => {
    const ref = conAplicadas({ cuota: 25 });
    const paso = fichaDeFacultad(FILA, 149, 12, 16, ref).pasos.find((p) => p.n === 5);
    expect(paso?.antes).toBeNull();
  });

  it("el normalizador conserva aplicadas y asistentes", () => {
    const r = conAplicadas({ aulas_aplicadas: 7, asistentes: 215 });
    expect(r?.por_facultad[0].aulas_aplicadas).toBe(7);
    expect(r?.por_facultad[0].asistentes).toBe(215);
  });
});
