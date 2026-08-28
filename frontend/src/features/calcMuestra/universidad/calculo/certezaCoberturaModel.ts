/**
 * Certeza de cobertura — proyección del contrato de R.
 *
 * No recalcula nada. R es el único que sabe cuántas aulas hacen falta; acá solo
 * se decide qué mirar primero y cómo se llama cada estado, que es justo lo que
 * la tabla cruda no dice: una brecha de +1 en Derecho y un marco agotado en
 * Gastronomía son dos cifras del mismo signo y dos problemas distintos.
 */
import {
  CALC_MUESTRA_AULAS_CERTEZA_SCHEMA,
  type CalcMuestraAulasCerteza,
  type CalcMuestraAulasCertezaFila,
  type CalcMuestraAulasCertezaPunto,
  type CalcMuestraAulasEstrato,
} from "../../../../api/client";

/**
 * Estado de un estrato, en orden de urgencia operativa.
 *
 * - `agotado`   — ni con todas sus aulas llega. Se arregla con criterios o
 *                 cuota, nunca pidiendo más aulas.
 * - `corta`     — la fórmula pide menos de lo necesario: faltan aulas.
 * - `sobra`     — la fórmula pide de más; se pueden liberar aulas.
 * - `ajustada`  — la fórmula ya da el mínimo exacto.
 * - `sin_datos` — el estrato no tiene aulas en el marco o no se pudo evaluar.
 */
export type CertezaEstado = "agotado" | "corta" | "sobra" | "ajustada" | "sin_datos";

/**
 * La curva de la certeza, lista para dibujar, y el invariante que la juzga.
 *
 * El rendimiento de una facultad no puede quedarse quieto cuando se le suman
 * aulas: cada aula agrega estudiantes, aunque el traslape haga que sean pocos.
 * Una curva plana significa que el sorteo no evalua el candidato que la fila
 * nombra. Paso de verdad: con `faculty_targets` puestos, el motor sorteaba
 * siempre el reparto aplicado y devolvia 392,7 con 40 aulas y 394,6 con 55.
 * La pantalla no lo delataba porque publicaba una sola cifra final.
 *
 * El umbral es relativo al recorrido del candidato: se exige que el rendimiento
 * crezca al menos un 1 % entre el primer punto y el ultimo. Por debajo de eso
 * la curva no esta respondiendo a lo que se le pregunta.
 */
export function curvaResumen(
  curva: CalcMuestraAulasCertezaPunto[] | null | undefined,
): { puntos: CalcMuestraAulasCertezaPunto[]; plana: boolean } {
  const puntos = (curva ?? []).filter(
    (p) => Number.isFinite(p?.aulas) && Number.isFinite(p?.rendimiento_medio),
  );
  if (puntos.length < 2) return { puntos, plana: false };
  const primero = puntos[0]!.rendimiento_medio;
  const ultimo = puntos[puntos.length - 1]!.rendimiento_medio;
  if (!(primero > 0)) return { puntos, plana: false };
  return { puntos, plana: (ultimo - primero) / primero < 0.01 };
}

/**
 * Si el ruido de la simulación puede cambiar el VEREDICTO de una facultad.
 *
 * El motor no corre las mil simulaciones que se le piden: las reduce en los
 * marcos grandes porque cada sorteo cuesta más (`.cm_certeza_corridas` escala
 * como `pedidas · 60 / n_aulas`). En HSVG2026 fueron de 144 en Ciencias e
 * Ingeniería, con 417 aulas, a 1 000 en las pequeñas.
 *
 * **Esta función medía el estadístico equivocado, y la reescribo diciéndolo.**
 * Comparaba el margen de `p(n)` sobre el nivel contra el error binomial, o sea
 * cuán seguro es afirmar «este número alcanza el 95 %». Pero el veredicto no es
 * esa afirmación: es **qué entero es el mínimo**, y eso lo decide si el
 * candidato ANTERIOR llega o no al nivel. Con la vara vieja, HSVG2026 marcaba
 * tres facultades como ambiguas cuyo veredicto no lo era ni de lejos.
 *
 * Lo que gobierna la decisión es el hueco entre candidatos consecutivos, y es
 * enorme porque cada aula suma unos treinta alumnos. Medido sobre HSVG2026:
 * Derecho pasa de 28,29 % con 17 aulas a 95,12 % con 18 — para que el veredicto
 * bajara a 17 harían falta **21,2 errores estándar**; EE.GG. Ciencias 13,5;
 * Ciencias e Ingeniería 2,7. Y la prueba empírica: repetir la certificación de
 * Derecho con la misma configuración dio 96,10 % en vez de 95,12 % —casi un
 * punto de diferencia— y **el mínimo siguió siendo 18**.
 *
 * Así que el riesgo se mide contra `p(n−1)`: a cuántos errores estándar está de
 * alcanzar el nivel. Si no hay curva o no hay punto anterior, no se puede
 * juzgar y no se marca nada — una alarma que no se puede sostener es peor que
 * ninguna.
 *
 * El error es el estándar de una proporción binomial, √(p·(1−p)/n).
 */
/** Cuántos errores estándar por debajo del nivel hace falta que suba `p(n−1)`
 *  para que el mínimo baje un aula. Menos de dos = el veredicto está en riesgo. */
const ERRORES_PARA_VEREDICTO_FIRME = 2;

export function precisionVeredicto(
  fila:
    | Pick<CalcMuestraAulasCertezaFila, "probabilidad_certeza" | "corridas" | "aulas_certeza" | "curva">
    | null
    | undefined,
  nivel: number,
): {
  corridas: number | null;
  /** Error estándar del punto que decide, `p(n−1)`. */
  error: number;
  /** Cuánto le falta a `p(n−1)` para alcanzar el nivel, en puntos. */
  distancia: number;
  /** Esa distancia en errores estándar. `null` cuando no hay con qué juzgar. */
  erroresHastaVoltear: number | null;
  dentroDelRuido: boolean;
} {
  const corridas = Number.isFinite(fila?.corridas) ? (fila!.corridas as number) : null;
  const minimo = Number.isFinite(fila?.aulas_certeza) ? (fila!.aulas_certeza as number) : null;
  const vacio = { corridas, error: 0, distancia: 0, erroresHastaVoltear: null, dentroDelRuido: false };
  if (corridas == null || corridas <= 0 || minimo == null) return vacio;

  // El punto que decide es el candidato inmediatamente anterior al mínimo: si
  // ÉSE alcanzara el nivel, el mínimo sería él.
  const anterior = (fila?.curva ?? []).find((punto) => punto.aulas === minimo - 1);
  const pAnterior = Number.isFinite(anterior?.probabilidad) ? (anterior!.probabilidad as number) : null;
  if (pAnterior == null) return vacio;

  const error = Math.sqrt((pAnterior * (1 - pAnterior)) / corridas);
  const distancia = nivel - pAnterior;
  if (!(error > 0)) return { ...vacio, distancia };
  const erroresHastaVoltear = distancia / error;
  return {
    corridas,
    error,
    distancia,
    erroresHastaVoltear,
    dentroDelRuido: erroresHastaVoltear < ERRORES_PARA_VEREDICTO_FIRME,
  };
}

export type CertezaFilaVista = CalcMuestraAulasCertezaFila & {
  estado: CertezaEstado;
  /** El rendimiento esperado es una cota superior: el marco no trae ids. */
  cotaSuperior: boolean;
};

export type CertezaVista = {
  certeza: CalcMuestraAulasCerteza;
  filas: CertezaFilaVista[];
  nivelPct: number;
  /** Estratos que exigen una decisión antes de salir a campo. */
  criticos: CertezaFilaVista[];
  aulasFormula: number;
  /**
   * El total que publica R: el neto, que compensa las facultades que piden
   * mas con las que piden menos.
   */
  aulasCerteza: number;
  brecha: number;
  /**
   * El total con la regla de la casa: se SUBE donde la certeza pide mas y no
   * se baja donde pide menos (Gonzalo, 2026-08-26: «no bajes ninguna, solo
   * sube donde haga falta»). Es el numero que el diseño va a usar de verdad.
   *
   * Medido en HSVG 2026 el 2026-08-27: el neto decia 167 —165 mas dos— porque
   * seis facultades pedian +8 y tres pedian -6. Con la regla de la casa son
   * 173, y el diseño ejecutado tiene 174: las ocho de la certeza mas una
   * agregacion operativa en Derecho. Un encabezado que dice 167 promete un
   * total que el estudio nunca va a tomar.
   */
  aulasSoloSubidas: number;
  /** Cuanto suman las subidas. Es `aulasSoloSubidas - aulasFormula`. */
  brechaSoloSubidas: number;
  /** Cuantas aulas se dejarian de sortear si tambien se bajara. */
  aulasQueNoSeBajan: number;
  hayCotaSuperior: boolean;
  /** El marco al que se le midió la certeza sigue siendo el vigente. */
  vigente: boolean;
};

const ORDEN_ESTADO: Record<CertezaEstado, number> = {
  agotado: 0,
  corta: 1,
  sin_datos: 2,
  sobra: 3,
  ajustada: 4,
};

function esFinito(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function certezaEstadoDeFila(fila: CalcMuestraAulasCertezaFila): CertezaEstado {
  if (fila.agotado) return "agotado";
  if (!fila.alcanzable || !esFinito(fila.brecha)) return "sin_datos";
  if (fila.brecha > 0) return "corta";
  if (fila.brecha < 0) return "sobra";
  return "ajustada";
}

/**
 * Valida el payload y lo ordena por urgencia. Devuelve `null` ante cualquier
 * duda: media certeza mostrada como certeza completa es peor que no mostrarla.
 */
export function certezaVistaDesdeEstado(
  certeza: CalcMuestraAulasCerteza | null | undefined,
  frameHashVigente: string | null | undefined,
): CertezaVista | null {
  if (
    !certeza ||
    certeza.schema !== CALC_MUESTRA_AULAS_CERTEZA_SCHEMA ||
    !Array.isArray(certeza.filas) ||
    certeza.filas.length === 0 ||
    !esFinito(certeza.nivel) ||
    !certeza.total
  ) return null;

  const filas: CertezaFilaVista[] = certeza.filas.map((fila) => ({
    ...fila,
    estado: certezaEstadoDeFila(fila),
    cotaSuperior: fila.base_conteo === "suma_elegibles",
  }));

  const ordenadas = [...filas].sort((a, b) => {
    const porEstado = ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado];
    if (porEstado !== 0) return porEstado;
    // Dentro del mismo estado manda el tamaño de la brecha: la facultad que
    // más aulas necesita es la que primero hay que resolver.
    const brechaA = esFinito(a.brecha) ? Math.abs(a.brecha) : 0;
    const brechaB = esFinito(b.brecha) ? Math.abs(b.brecha) : 0;
    if (brechaB !== brechaA) return brechaB - brechaA;
    return a.label.localeCompare(b.label, "es");
  });

  // Se deriva de las filas y no del total de R a proposito: el total de R es el
  // neto, y esta cifra tiene que sobrevivir a que R cambie como lo calcula.
  const soloSubidas = (() => {
    let subidas = 0;
    let noBajadas = 0;
    for (const fila of filas) {
      if (!esFinito(fila.brecha)) continue;
      if (fila.brecha > 0) subidas += fila.brecha;
      else if (fila.brecha < 0) noBajadas += -fila.brecha;
    }
    return {
      aulasSoloSubidas: certeza.total.aulas_formula + subidas,
      brechaSoloSubidas: subidas,
      aulasQueNoSeBajan: noBajadas,
    };
  })();

  const hashVigente = typeof frameHashVigente === "string" ? frameHashVigente.trim() : "";
  return {
    certeza,
    filas: ordenadas,
    nivelPct: certeza.nivel,
    criticos: ordenadas.filter((fila) => fila.estado === "agotado" || fila.estado === "corta"),
    aulasFormula: certeza.total.aulas_formula,
    aulasCerteza: certeza.total.aulas_certeza,
    brecha: certeza.total.brecha,
    ...soloSubidas,
    hayCotaSuperior: ordenadas.some((fila) => fila.cotaSuperior),
    vigente: Boolean(hashVigente) && certeza.frame_hash === hashVigente,
  };
}

/** Payload que viaja al endpoint: una fila por estrato con cuota declarada. */
export type CertezaEstratoPayload = {
  label: string;
  faculty_key?: string;
  cuota: number;
  tau?: number | null;
  aulas_formula: number;
};

/**
 * Traduce las filas del resultado de R al payload del endpoint. `aulas_base`
 * son los titulares —lo que se mide es si la primera cadena alcanza—, no el
 * total con reservas.
 */
export function certezaEstratosDesdeResultado(
  filas: readonly CalcMuestraAulasEstrato[],
): CertezaEstratoPayload[] {
  return filas
    .filter((fila) => esFinito(fila.cuota) && fila.cuota > 0)
    .map((fila) => ({
      label: fila.estrato,
      ...(fila.alumnos_por_ch?.faculty_key ? { faculty_key: fila.alumnos_por_ch.faculty_key } : {}),
      cuota: fila.cuota,
      tau: esFinito(fila.tau) && fila.tau > 0 ? fila.tau : null,
      aulas_formula: fila.aulas_base,
    }));
}

/**
 * La probabilidad de cumplir de cada estrato, para pegarla al lado de su cupo.
 *
 * **Sólo entrega números de una medición VIGENTE.** Una certeza medida sobre
 * otro marco no es un dato viejo que redondear: es la respuesta a otra pregunta,
 * y ponerla junto a los cupos nuevos haría que la tabla pareciera auditada
 * cuando no lo está. Con el marco cambiado devuelve un mapa vacío y la
 * superficie dice por qué.
 */
export function probabilidadPorEstrato(vista: CertezaVista | null): Map<string, number> {
  if (!vista || !vista.vigente) return new Map();
  return new Map(
    vista.filas
      .filter((f) => typeof f.probabilidad_formula === "number" && Number.isFinite(f.probabilidad_formula))
      .map((f) => [f.label, f.probabilidad_formula as number])
  );
}

/**
 * Por qué una celda de probabilidad no trae número. **El motivo, no sólo el
 * hecho**: «sin medir» y «medida sobre otro marco» piden acciones distintas —la
 * primera pide apretar el botón, la segunda pide recalcular— y un guion las
 * volvía la misma cosa.
 */
export function motivoSinProbabilidad(vista: CertezaVista | null): string {
  if (!vista) return "sin medir";
  return vista.vigente ? "sin dato" : "medida sobre otro marco";
}

/**
 * Si la certeza debe medirse sola para este marco.
 *
 * Era un botón, y un botón que nadie aprieta deja los cupos yendo a campo sin
 * auditar. Pero un disparo automático mal guardado encola trabajo pesado en cada
 * repintado, así que las cuatro condiciones se declaran aquí y se prueban una
 * por una:
 *
 *   · hay un marco identificado y filas que medir;
 *   · **no** hay ya una medición vigente para ese marco;
 *   · **no** hay otra corriendo;
 *   · el resultado **no** está desactualizado —medirlo daría la certeza de unos
 *     estratos que ya no son los del marco—;
 *   · y no se disparó ya para este mismo `frame_hash`.
 *
 * El último se comprueba contra el hash que el llamador marca ANTES de disparar:
 * si la medición falla, no reintenta en bucle. Para eso sigue estando el botón.
 */
export function debeMedirCertezaSola(args: {
  vista: CertezaVista | null;
  frameHash: string | null | undefined;
  hayFilas: boolean;
  midiendo: boolean;
  resultadoDesactualizado: boolean;
  yaDisparadoPara: string | null;
}): boolean {
  const hash = typeof args.frameHash === "string" ? args.frameHash.trim() : "";
  if (!hash || !args.hayFilas) return false;
  if (args.midiendo || args.resultadoDesactualizado) return false;
  if (args.vista?.vigente) return false;
  return args.yaDisparadoPara !== hash;
}
