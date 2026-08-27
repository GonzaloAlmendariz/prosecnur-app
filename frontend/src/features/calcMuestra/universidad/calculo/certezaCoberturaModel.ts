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
 * Con cuánta evidencia se tomó el veredicto de una facultad.
 *
 * El motor no corre las mil simulaciones que se le piden: las reduce en los
 * marcos grandes porque cada sorteo cuesta más (`.cm_certeza_corridas` escala
 * como `pedidas · 60 / n_aulas`). En HSVG2026 fueron de 144 en Ciencias e
 * Ingeniería, con 417 aulas, a 1 000 en las pequeñas — y eso invierte la
 * precisión justo donde más pesa, porque las facultades de mayor cuota son las
 * de marco más grande.
 *
 * Derecho pasó el umbral con 195 sorteos de 205: su margen sobre el 0,95 es
 * doce veces menor que el error de muestreo con el que se midió. Con esa
 * evidencia no se puede distinguir si cumple, y el panel publicaba el veredicto
 * sin decir con cuántos sorteos se tomó.
 *
 * El error es el estándar de una proporción binomial, √(p·(1−p)/n).
 */
export function precisionVeredicto(
  fila: Pick<CalcMuestraAulasCertezaFila, "probabilidad_certeza" | "corridas"> | null | undefined,
  nivel: number,
): { corridas: number | null; error: number; margen: number; dentroDelRuido: boolean } {
  const corridas = Number.isFinite(fila?.corridas) ? (fila!.corridas as number) : null;
  const p = Number.isFinite(fila?.probabilidad_certeza) ? (fila!.probabilidad_certeza as number) : null;
  if (corridas == null || p == null || corridas <= 0) {
    return { corridas, error: 0, margen: 0, dentroDelRuido: false };
  }
  const error = Math.sqrt((p * (1 - p)) / corridas);
  const margen = p - nivel;
  return { corridas, error, margen, dentroDelRuido: error > 0 && margen < error };
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
  aulasCerteza: number;
  brecha: number;
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

  const hashVigente = typeof frameHashVigente === "string" ? frameHashVigente.trim() : "";
  return {
    certeza,
    filas: ordenadas,
    nivelPct: certeza.nivel,
    criticos: ordenadas.filter((fila) => fila.estado === "agotado" || fila.estado === "corta"),
    aulasFormula: certeza.total.aulas_formula,
    aulasCerteza: certeza.total.aulas_certeza,
    brecha: certeza.total.brecha,
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
