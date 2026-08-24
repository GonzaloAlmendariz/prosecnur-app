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
