import type { MonitoreoRow } from "../../../../api/monitoreo";
import { fechaDeAplicacion } from "./ritmoPorFacultad";
import { PESO_DEL_PRIOR } from "./rendimientoPorFacultad";

/**
 * El rendimiento de cada facultad, día a día, y el que cabe esperar.
 *
 * `ritmoPorFacultad` ya contaba las efectivas de cada facultad por día, pero eso
 * es PRODUCCIÓN, no rendimiento: una facultad que aplica seis aulas y saca 120
 * encuestas no rinde más que otra que aplica dos y saca 44. Lo que decide a
 * dónde mandar gente mañana es **cuánto deja cada visita**, y eso no estaba en
 * ninguna serie.
 *
 * ## El esperado, y por qué es bayesiano de verdad
 *
 * El rendimiento observado de UN día es casi siempre el promedio de una o dos
 * aulas: salta de 30 a 12 sin que la facultad haya cambiado en nada. Dibujar esa
 * línea sola invita a decidir sobre ruido.
 *
 * Al lado va el **esperado**, que es la media posterior de un modelo
 * Gamma-Poisson: a lo observado por la facultad hasta ese día se le suman
 * `PESO_DEL_PRIOR` aulas imaginarias con el rendimiento medio del estudio.
 *
 *     esperado = (efectivas + peso × media) / (aulas + peso)
 *
 * Es el mismo prior declarado que ya usa el ranking de `rendimientoPorFacultad`
 * —cinco aulas, elegido y no estimado—, aplicado ahora a lo que sirve: **cuánto
 * cabe esperar de la próxima aula de esa facultad**. Con una aula observada el
 * esperado está pegado a la media del estudio; con treinta, a lo suyo.
 *
 * **La media del estudio es la de ESE DÍA, no la final.** Usar el total del
 * corte metería información del futuro en los primeros días y haría que la línea
 * de ayer cambiara al llegar la de mañana.
 *
 * **No proyecta hacia adelante.** Esta serie termina en el último día con campo;
 * lo que venga después es pronóstico y tiene su propio contrato.
 *
 * ## El supuesto que hay que decir en voz alta
 *
 * **El esperado asume que el rendimiento de una facultad no cambia con los
 * días.** No modela agotamiento: ni el cansancio del equipo ni —lo que más pesa—
 * que a medida que avanza el campo sea más probable que la gente del aula ya haya
 * respondido.
 *
 * Se midió en el libro real de 2025 (194 aulas con fecha y enviadas, hoja «Base de
 * control»): ponderando por población, la primera mitad del campo consiguió el
 * **61,1 %** de los elegibles y la segunda el **55,6 %** —**5,5 puntos menos**—.
 * Pero **no es monótono**: por semana fue 60,4 · 57,4 · **64,0** · 34,7, y esta
 * última con cuatro aulas. El promedio simple de las medias diarias daba −12,3 pp,
 * inflado por días de una o dos aulas.
 *
 * O sea: hay una señal débil y no una ley. Meter una pendiente fija sería darle al
 * modelo una precisión que el dato no sostiene, y por eso **se asume constante y
 * se declara en la pantalla** en vez de asumirlo en silencio, que es lo peor de
 * los dos mundos.
 *
 * ## Lo que el diseño supuso, que es la tercera altura
 *
 * La serie tenía dos alturas por día: el **techo** —los elegibles de esas aulas,
 * toda la gente que podía responder— y lo **conseguido**. Entre las dos hay una
 * tercera que decide y no estaba: **cuánto supuso el diseño que dejaría cada una
 * de esas aulas**. Sin ella el gráfico compara el campo consigo mismo y con la
 * media del estudio, pero nunca contra la vara con la que se dimensionó.
 *
 * Sale de `expected_valid` del plan, que para las aulas del diseño es
 * `eligible_n × rendimiento_ref × factor_facultad` —o sea la τ prevista de esa
 * facultad aplicada a ESA aula—, y por eso está en las mismas unidades que el
 * eje: encuestas por aula. No hay que convertir nada ni cruzar fuentes: plan y
 * parte, el mismo par de siempre.
 *
 * **Pero `expected_valid` colapsa tres cosas distintas**, y el propio motor lo
 * dice al publicar `meta_origen` junto a ella: `diseno` es lo que el cálculo de
 * muestra computó, `declarada` es lo que alguien escribió a mano, y `elegibles`
 * **no es una meta**: es el techo, puesto ahí porque no había ninguna. Promediar
 * las tres daría una vara que en parte es la vara y en parte es el techo, y
 * dibujarla pegada al techo se leería como que el diseño esperaba el 100 %.
 *
 * Así que la tercera altura **sólo cuenta las aulas con `meta_origen === "diseno"`**
 * y se divide entre ESAS, no entre todas las del día: si de tres aulas sólo una
 * viene del diseño, la altura es la de esa una. Los días sin ninguna no tienen
 * vara y devuelven `null`, que se dibuja como ausencia y no como cero.
 */

export type DiaDeRendimiento = {
  fecha: string;
  /** Aulas de esa facultad con parte ese día. */
  aulas: number;
  /**
   * Los elegibles de esas aulas: el techo del día, toda la gente que PODÍA
   * responder. Va aparte de las efectivas porque la distancia entre las dos es
   * la efectividad, y es la misma lectura que la agenda hace hacia adelante:
   * «la barra representa cuánto se esperaba y la línea, a cuánto se llegó [...]
   * no sólo aplica al futuro, aplica también a lo que ya se aplicó en el pasado».
   */
  elegibles: number;
  efectivas: number;
  /**
   * Las efectivas de ese día repartidas por sexo, cuando la Base de control las
   * declara aula por aula (`women_n` / `men_n`).
   *
   * Sale de la MISMA familia que el total —plan, parte y libro— y por eso se
   * puede dibujar junto a él. La cuota por sexo, en cambio, se mide sobre
   * respuestas atribuidas a un curso-horario, que es otra fuente: mezclarlas fue
   * el defecto que hizo que el gráfico dijera «llegamos» junto a un «0 de 196».
   *
   * `null` cuando el libro no trae el reparto: entonces no hay serie por sexo que
   * dibujar y se dice, en vez de repartir el total por una proporción inventada.
   */
  mujeres: number | null;
  hombres: number | null;
  /** Lo observado ESE día. `null` si la facultad no visitó ninguna aula. */
  porAula: number | null;
  aulasAcumuladas: number;
  efectivasAcumuladas: number;
  /** Media posterior Gamma-Poisson con el prior del estudio a esa fecha. */
  esperado: number;
  /**
   * La banda del 90 % alrededor de ese esperado, o `null` cuando la posterior
   * es demasiado débil para que la aproximación valga.
   *
   * El esperado es una media posterior y se dibujaba como una línea sola, que
   * es exactamente el defecto que la probabilidad de cierre repara en las
   * celdas: un estimador puntual leído como si fuera cierto. Con dos aulas
   * visitadas y con treinta el punteado se ve igual, y no significa lo mismo.
   */
  esperadoBanda: { bajo: number; alto: number } | null;
  /**
   * Lo que el DISEÑO supuso que dejaría cada una de las aulas de ese día, en
   * encuestas por aula. `null` cuando ninguna trae meta del diseño.
   *
   * Se promedia sobre `aulasConDiseno`, no sobre `aulas`: mezclar las que no
   * tienen vara hundiría la altura sin que nada lo dijera.
   */
  esperadoPorAulaDelDiseno: number | null;
  /** Cuántas de las aulas del día traen meta del diseño. El denominador de arriba. */
  aulasConDiseno: number;
};

export type RendimientoDiarioDeFacultad = {
  facultad: string;
  dias: DiaDeRendimiento[];
  aulas: number;
  efectivas: number;
  /** El esperado del último día, que es el que vale para decidir mañana. */
  esperadoFinal: number;
  /**
   * Lo que el PLAN espera de las aulas que ya se visitaron: la suma de su
   * `expected_valid`.
   *
   * Es la meta con la que se puede comparar el acumulado del parte **sin cruzar
   * fuentes**: las dos cifras salen del par plan+parte. La cuota por sexo, en
   * cambio, se mide sobre respuestas atribuidas a un curso-horario, y compararla
   * con el parte fue el defecto que hizo que el gráfico dijera «llegamos»
   * mientras su pie decía «0 de 196».
   */
  esperadoDeLoVisitado: number;
  /** Lo observado en todo el corte, sin encoger. Se enseña al lado. */
  observadoFinal: number | null;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor).trim();
}

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

const redondea = (n: number) => Math.round(n * 10) / 10;

/**
 * @param partes filas del parte YA unidas a su facultad (`parteDeCampo`), por la
 *   misma razón que en `rendimientoPorFacultad`: si cada superficie uniera por su
 *   cuenta podrían discrepar en de qué facultad es un aula.
 */
/**
 * Los extremos de la banda creíble del esperado.
 *
 * La posterior de un Gamma-Poisson conjugado es `Gamma(alfa, beta)` con
 * `alfa = efectivas + peso*media` y `beta = aulas + peso`, y su media es
 * `alfa/beta` — que es justo lo que ya se dibuja. Los cuantiles salen por
 * **Wilson-Hilferty**, que aproxima la Gamma con un cubo de una normal:
 *
 *     q(p) ~= (alfa/beta) * (1 - 1/(9*alfa) + z_p/(3*sqrt(alfa)))^3
 *
 * Se usa porque no hay `qgamma` en el navegador y traer una libreria de
 * estadistica por dos cuantiles no se paga. **La aproximacion se degrada con
 * `alfa` pequeña**, asi que por debajo de `ALFA_MINIMA` se devuelve `null` en
 * vez de una banda que no vale: una banda inventada es peor que ninguna, porque
 * la banda es justo la promesa de que se conoce la incertidumbre.
 */
const Z_90 = 1.6448536269514722;   // cuantil 0,95 de la normal: banda central del 90 %
const ALFA_MINIMA = 5;

export function bandaDelEsperado(alfa: number, beta: number): { bajo: number; alto: number } | null {
  if (!Number.isFinite(alfa) || !Number.isFinite(beta) || alfa < ALFA_MINIMA || beta <= 0) return null;
  const media = alfa / beta;
  const cuantil = (z: number) => {
    const t = 1 - 1 / (9 * alfa) + z / (3 * Math.sqrt(alfa));
    return media * Math.max(0, t) ** 3;
  };
  const bajo = cuantil(-Z_90);
  const alto = cuantil(Z_90);
  if (!Number.isFinite(bajo) || !Number.isFinite(alto) || alto <= bajo) return null;
  return { bajo: redondea(bajo), alto: redondea(alto) };
}

export function serieDeRendimiento(
  partes: ReadonlyArray<MonitoreoRow>,
  /** El plan, sólo para los elegibles de cada aula: el parte no los trae. */
  plan: ReadonlyArray<MonitoreoRow> = [],
  /** La Base de control del libro, que trae el reparto por sexo de cada aula. */
  control: ReadonlyArray<MonitoreoRow> = [],
): {
  facultades: RendimientoDiarioDeFacultad[];
  fechas: string[];
  /** La media del estudio al cierre del último día. Es el prior de la última barra. */
  mediaDelEstudio: number;
} {
  const fechas = new Set<string>();
  const porFacultad = new Map<string, Map<string, { aulas: number; elegibles: number; efectivas: number; mujeres: number; hombres: number; conSexo: number; esperadoDiseno: number; aulasConDiseno: number }>>();
  const esperadoDeLoVisitadoPorFacultad = new Map<string, number>();
  // El reparto por sexo, aula por aula, tal como lo declara la Base de control.
  const sexoPorCodigo = new Map<string, { mujeres: number; hombres: number }>();
  for (const fila of control) {
    const codigo = texto(fila.operational_code);
    if (!codigo) continue;
    const m = numero(fila.women_n);
    const h = numero(fila.men_n);
    if (m || h) sexoPorCodigo.set(codigo, { mujeres: m, hombres: h });
  }
  const totalPorFecha = new Map<string, { aulas: number; efectivas: number }>();

  // Los elegibles viven en el plan, no en el parte. Se busca por
  // `operational_code`, la misma clave con la que `parteDeCampo` une las dos
  // hojas: si cada superficie uniera por su cuenta podrían discrepar.
  const elegiblesPorCodigo = new Map<string, number>();
  /**
   * **«Meta» estaba nombrando dos cantidades distintas en este archivo.**
   *
   * Aquí era `expected_valid` —lo que se espera de UN aula— y unas líneas más
   * abajo, en el acumulado por sexo, era la CUOTA de la celda: a lo que hay que
   * llegar. Son las dos cantidades que el encargo del 2026-08-30 pide separar, y
   * compartían palabra dentro del mismo módulo. En pantalla nunca colisionaron
   * —«Meta» es siempre la cuota y lo del aula se dice «el diseño pedía»— pero
   * leyendo el código sí, y me confundió a mí al auditarlo.
   *
   * `meta` queda para la cuota. Lo del aula se llama por lo que es: lo esperado.
   */
  const esperadoPorAula = new Map<string, number>();
  // Lo esperado por aula SEGÚN EL DISEÑO, aparte. `expected_valid` también llega con metas escritas
  // a mano y con el propio techo de elegibles cuando no había ninguna, y el motor
  // lo dice en `meta_origen`. Ver la cabecera: promediarlas juntas daría una vara
  // que en parte es el techo.
  const esperadoDelDisenoPorAula = new Map<string, number>();
  /**
   * **La facultad de cada curso-horario, del PLAN.**
   *
   * El parte de campo no la trae: medido sobre HSVG26ULT2 el 2026-09-11, cero
   * de 57 partes tienen `faculty`. Agrupando por la del parte, las quince
   * facultades caían en un único cubo «Sin facultad» y cualquier consumidor que
   * buscara la suya por nombre se iba de vacío —que es justo lo que le pasó a
   * la serie por jornada del ranking al estrenarse—.
   *
   * Es el mismo defecto que vigila el guard `elParteTraeSuFacultad`, y se
   * resuelve igual: el parte identifica el curso-horario, y la facultad se mira
   * en el plan, que es quien la declara.
   */
  const facultadPorCodigo = new Map<string, string>();
  for (const fila of plan) {
    const codigo = texto(fila.operational_code);
    if (!codigo) continue;
    const suya = texto(fila.faculty);
    if (suya) facultadPorCodigo.set(codigo, suya);
    elegiblesPorCodigo.set(codigo, numero(fila.eligible_n));
    const esperado = numero(fila.expected_valid);
    esperadoPorAula.set(codigo, esperado);
    if (texto(fila.meta_origen) === "diseno" && esperado > 0) esperadoDelDisenoPorAula.set(codigo, esperado);
  }

  for (const fila of partes) {
    const fecha = fechaDeAplicacion(fila.applied_at ?? fila.applied_date);
    if (!fecha) continue;
    const efectivas = numero(fila.effective_surveys);
    const codigo = texto(fila.operational_code);
    // La del parte primero —si algún día la trae, manda—, y si no la del plan.
    const facultad = texto(fila.faculty) || facultadPorCodigo.get(codigo) || "Sin facultad";
    const elegibles = elegiblesPorCodigo.get(codigo) ?? numero(fila.eligible_n);
    esperadoDeLoVisitadoPorFacultad.set(
      facultad,
      (esperadoDeLoVisitadoPorFacultad.get(facultad) ?? 0) + (esperadoPorAula.get(codigo) ?? 0),
    );
    fechas.add(fecha);
    if (!porFacultad.has(facultad)) porFacultad.set(facultad, new Map());
    const dias = porFacultad.get(facultad)!;
    const dia = dias.get(fecha) ?? { aulas: 0, elegibles: 0, efectivas: 0, mujeres: 0, hombres: 0, conSexo: 0, esperadoDiseno: 0, aulasConDiseno: 0 };
    dia.aulas += 1;
    dia.elegibles += elegibles;
    dia.efectivas += efectivas;
    const esperadoDiseno = esperadoDelDisenoPorAula.get(codigo);
    if (esperadoDiseno != null) {
      dia.esperadoDiseno += esperadoDiseno;
      dia.aulasConDiseno += 1;
    }
    const sexo = sexoPorCodigo.get(codigo);
    if (sexo) {
      dia.mujeres += sexo.mujeres;
      dia.hombres += sexo.hombres;
      dia.conSexo += 1;
    }
    dias.set(fecha, dia);
    const total = totalPorFecha.get(fecha) ?? { aulas: 0, efectivas: 0 };
    total.aulas += 1;
    total.efectivas += efectivas;
    totalPorFecha.set(fecha, total);
  }

  const orden = [...fechas].sort();

  // La media del estudio ACUMULADA hasta cada fecha: es el prior de ese día.
  const mediaHasta = new Map<string, number>();
  let aulasEstudio = 0;
  let efectivasEstudio = 0;
  for (const fecha of orden) {
    const t = totalPorFecha.get(fecha);
    if (t) {
      aulasEstudio += t.aulas;
      efectivasEstudio += t.efectivas;
    }
    mediaHasta.set(fecha, aulasEstudio ? efectivasEstudio / aulasEstudio : 0);
  }

  const facultades = [...porFacultad.entries()].map(([facultad, dias]) => {
    let aulasAcum = 0;
    let efectivasAcum = 0;
    const serie = orden.map((fecha) => {
      const dia = dias.get(fecha) ?? { aulas: 0, elegibles: 0, efectivas: 0, mujeres: 0, hombres: 0, conSexo: 0, esperadoDiseno: 0, aulasConDiseno: 0 };
      aulasAcum += dia.aulas;
      efectivasAcum += dia.efectivas;
      const media = mediaHasta.get(fecha) ?? 0;
      return {
        fecha,
        aulas: dia.aulas,
        elegibles: dia.elegibles,
        efectivas: dia.efectivas,
        // `null` y no 0 cuando NINGUNA aula del día trae reparto: un cero diría
        // que ese día no respondió ninguna mujer, y lo que pasa es que el libro
        // no lo dice.
        mujeres: dia.conSexo ? dia.mujeres : null,
        hombres: dia.conSexo ? dia.hombres : null,
        porAula: dia.aulas ? redondea(dia.efectivas / dia.aulas) : null,
        aulasAcumuladas: aulasAcum,
        efectivasAcumuladas: efectivasAcum,
        esperado: redondea((efectivasAcum + PESO_DEL_PRIOR * media) / (aulasAcum + PESO_DEL_PRIOR)),
        esperadoBanda: bandaDelEsperado(efectivasAcum + PESO_DEL_PRIOR * media, aulasAcum + PESO_DEL_PRIOR),
        esperadoPorAulaDelDiseno: dia.aulasConDiseno ? redondea(dia.esperadoDiseno / dia.aulasConDiseno) : null,
        aulasConDiseno: dia.aulasConDiseno,
      } satisfies DiaDeRendimiento;
    });
    const ultimo = serie[serie.length - 1];
    return {
      facultad,
      dias: serie,
      aulas: aulasAcum,
      efectivas: efectivasAcum,
      esperadoFinal: ultimo?.esperado ?? 0,
      esperadoDeLoVisitado: Math.round(esperadoDeLoVisitadoPorFacultad.get(facultad) ?? 0),
      observadoFinal: aulasAcum ? redondea(efectivasAcum / aulasAcum) : null,
    } satisfies RendimientoDiarioDeFacultad;
  });

  // Por lo que decide: lo que cabe esperar de la próxima aula, de mayor a menor.
  facultades.sort((a, b) => b.esperadoFinal - a.esperadoFinal || a.facultad.localeCompare(b.facultad, "es"));

  return {
    facultades,
    fechas: orden,
    mediaDelEstudio: redondea(aulasEstudio ? efectivasEstudio / aulasEstudio : 0),
  };
}

/** El veredicto de una celda de cuota en la tabla de la serie. */
export type VeredictoDeCeldaDeCuota = {
  /** Clase de la fila. `es-sin-cuota` cuando no hay objetivo que cerrar. */
  clase: "es-sin-cuota" | "es-cumplida" | "es-llega" | "es-corta";
  /** Lo que dice la última columna. */
  texto: string;
  /** `true` cuando la celda no declara objetivo: la meta y lo que falta se callan. */
  sinCuota: boolean;
};

/**
 * Qué dice una celda de cuota de la tabla de la serie.
 *
 * Vive fuera del componente porque **el veredicto se comprobaba en el markup y
 * el markup no se podía comprobar**: la tabla sólo se monta con una facultad
 * elegida, así que un test sobre `renderToStaticMarkup` pasaba sin llegar a
 * verla nunca. Sacarlo a una función es lo que permite fijar el contrato.
 *
 * Y lo que había que fijar es el `0 >= 0` de siempre, en su tercera aparición
 * tras el KPI de cierre y el panel de avance proyectado: **una celda sin cuota
 * no es una cuota cumplida**. Con meta 0 la resta da 0, y la fila salía verde y
 * rotulada «cuota cumplida» sobre un objetivo que nadie pidió.
 */
export function veredictoDeCeldaDeCuota(
  celda: { meta: number; faltan: number; alcanza: boolean; fechaDeCruce: string | null; faltanAlCerrarAgenda: number },
  fmtNumero: (n: number) => string,
  fmtFecha: (f: string) => string,
): VeredictoDeCeldaDeCuota {
  if (!(celda.meta > 0)) {
    return { clase: "es-sin-cuota", texto: "sin cuota declarada", sinCuota: true };
  }
  if (celda.faltan === 0) return { clase: "es-cumplida", texto: "cuota cumplida", sinCuota: false };
  if (celda.fechaDeCruce) {
    return { clase: "es-llega", texto: `llega el ${fmtFecha(celda.fechaDeCruce)}`, sinCuota: false };
  }
  return {
    clase: celda.alcanza ? "es-llega" : "es-corta",
    texto: `no llega · faltarían ${fmtNumero(celda.faltanAlCerrarAgenda)}`,
    sinCuota: false,
  };
}
