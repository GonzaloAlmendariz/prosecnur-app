// Carga › Revisión (ADR 0142, P4b R4; prototipo "carga-revision"): de la
// revisión que publica el motor (`/api/carga/review`) a la lista de
// comprobaciones de la mesa, la cifra y el estado de la cabecera, y la decisión
// sobre las columnas fuera del formulario. Lógica pura: la vista solo pinta.

import type {
  CargaReviewPayload,
  CargaReviewReconciliationExtra,
  CargaReviewSummaryPayload,
} from "../../../../api/client";
import type { EstadoDePestana } from "../../../../components/procesamiento/CabeceraDePestana";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { cargaReviewFuentesHallazgos } from "../../cargaReviewFuentesModel";
import { textoPorcentajeConDato, vieneMarcadaPorDefecto } from "../../reconciliacionModel";

export type TonoDeComprobacion = "ok" | "aviso" | "error" | "info" | "neutro";

export type ClaveDeComprobacion =
  | "formulario"
  | "respuestas"
  | "columnas"
  | "extra"
  | "codigos"
  | "fuentes"
  | "versiones"
  | "orden"
  | "opciones-sin-leer"
  | "universo"
  | "origen-externo";

export type Comprobacion = {
  clave: ClaveDeComprobacion;
  titulo: string;
  detalle: string;
  tono: TonoDeComprobacion;
  /** Lo que queda por decidir, en la pastilla de la fila. */
  pendientes?: number;
  /** "comprobacion" cuenta en la cifra de la cabecera; "declaracion" es opcional y no se juzga. */
  grupo: "comprobacion" | "declaracion";
};

export type EntradaDeRevision = {
  revision: CargaReviewPayload | null;
  leyendo: boolean;
  tieneFormulario: boolean;
  tieneRespuestas: boolean;
  /** El mapeo de códigos que la vista previa de la subida dejó por confirmar. */
  mapeoPendiente: boolean;
  /** Filas de la base revisada, si el estudio las publica. */
  filas: number | null;
  /** Se ofrece declarar el universo de análisis (misma condición con que se monta el filtro). */
  conUniverso: boolean;
  conOrigenExterno: boolean;
};

const plural = (n: number, uno: string, varios: string) => `${formatoConteo(n)} ${n === 1 ? uno : varios}`;

export function codigosPendientes(entrada: Pick<EntradaDeRevision, "revision" | "mapeoPendiente">): boolean {
  return entrada.mapeoPendiente || Boolean(entrada.revision?.choice_mapping.pending);
}

/** La base no coincide con el formulario: faltan columnas que el formulario pide. */
export function estructuraIncompatible(revision: CargaReviewPayload | null): boolean {
  if (!revision) return false;
  const c = revision.compatibility;
  return !c.ok || c.status === "incompatible" || c.n_missing > 0;
}

export function comprobacionesDeRevision(entrada: EntradaDeRevision): Comprobacion[] {
  const { revision, leyendo, tieneFormulario, tieneRespuestas, filas } = entrada;
  const lista: Comprobacion[] = [
    {
      clave: "formulario",
      titulo: "Formulario",
      detalle: tieneFormulario ? "Cargado" : "Falta cargarlo en Bases",
      tono: tieneFormulario ? "ok" : "error",
      grupo: "comprobacion",
    },
    {
      clave: "respuestas",
      titulo: "Respuestas",
      detalle: !tieneRespuestas
        ? "Faltan cargarlas en Bases"
        : filas !== null
          ? plural(filas, "fila", "filas")
          : "Cargadas",
      tono: tieneRespuestas ? "ok" : "error",
      grupo: "comprobacion",
    },
  ];
  // Lo que sigue lo dice el motor: mientras lee, o sin revisión, no se afirma nada.
  if (revision && !leyendo) {
    const c = revision.compatibility;
    if (c.applied || c.expected_columns > 0) {
      const incompatible = estructuraIncompatible(revision);
      lista.push({
        clave: "columnas",
        titulo: "Preguntas con su columna",
        detalle: incompatible && c.n_missing > 0
          ? `Faltan ${plural(c.n_missing, "columna", "columnas")} del formulario`
          : `${formatoConteo(c.matched_columns)} de ${formatoConteo(c.expected_columns)}`,
        tono: incompatible ? "error" : "ok",
        pendientes: incompatible && c.n_missing > 0 ? c.n_missing : undefined,
        grupo: "comprobacion",
      });
    }
    const r = revision.reconciliation;
    lista.push({
      clave: "extra",
      titulo: "Columnas fuera del formulario",
      detalle: r.n_extra === 0
        ? "Ninguna"
        : r.n_pendientes > 0
          ? `${plural(r.n_pendientes, "columna", "columnas")} por decidir`
          : `${plural(r.n_incluidas, "incorporada", "incorporadas")}, ${formatoConteo(r.n_excluidas)} fuera`,
      tono: r.n_pendientes > 0 ? "aviso" : "ok",
      pendientes: r.n_pendientes > 0 ? r.n_pendientes : undefined,
      grupo: "comprobacion",
    });
    const mapeo = revision.choice_mapping;
    const pendiente = codigosPendientes(entrada);
    lista.push({
      clave: "codigos",
      titulo: "Códigos de las opciones",
      detalle: pendiente
        ? `${plural(mapeo.n_questions, "pregunta", "preguntas")} con códigos por confirmar`
        : mapeo.status === "confirmed"
          ? "Mapeo confirmado"
          : "Coinciden con su lista",
      tono: pendiente ? "aviso" : "ok",
      pendientes: pendiente && mapeo.n_questions > 0 ? mapeo.n_questions : undefined,
      grupo: "comprobacion",
    });
    const hallazgos = cargaReviewFuentesHallazgos(revision.fuentes);
    if (hallazgos.length > 0) {
      const incompatibles = hallazgos.filter((h) => h.tono === "incompatible").length;
      const porRevisar = hallazgos.filter((h) => h.tono === "pending").length;
      lista.push({
        clave: "fuentes",
        titulo: "Emparejamiento entre fuentes",
        detalle: incompatibles > 0
          ? `${plural(incompatibles, "fuente quedó fuera", "fuentes quedaron fuera")}`
          : porRevisar > 0
            ? `${plural(porRevisar, "aviso", "avisos")} por revisar`
            : plural(hallazgos.length, "fuente emparejada", "fuentes emparejadas"),
        tono: incompatibles > 0 ? "error" : porRevisar > 0 ? "aviso" : "info",
        pendientes: incompatibles + porRevisar > 0 ? incompatibles + porRevisar : undefined,
        grupo: "comprobacion",
      });
    }
    if (revision.procedencia) {
      lista.push({
        clave: "versiones",
        titulo: "Versiones del formulario",
        detalle: `Se recolectó con ${formatoConteo(revision.procedencia.n_versiones)} versiones`,
        tono: "aviso",
        grupo: "comprobacion",
      });
    }
    const sinLeer = revision.opciones_sin_leer;
    if (sinLeer && sinLeer.n > 0) {
      lista.push({
        clave: "opciones-sin-leer",
        titulo: "Columnas de opción sin leer",
        detalle: `${plural(sinLeer.n, "columna no entró", "columnas no entraron")} a su pregunta`,
        tono: "aviso",
        pendientes: sinLeer.n,
        grupo: "comprobacion",
      });
    }
    const orden = revision.orden_editor;
    if (orden) {
      const omitidas = orden.omitidas.length;
      lista.push({
        clave: "orden",
        titulo: "Orden de opciones del editor",
        detalle: omitidas > 0
          ? `${plural(omitidas, "pregunta no lo sigue", "preguntas no lo siguen")}`
          : `${plural(orden.adoptadas.length, "pregunta lo usa", "preguntas lo usan")}`,
        tono: omitidas > 0 || orden.editor_distinto.length > 0 ? "aviso" : "info",
        grupo: "comprobacion",
      });
    }
  }
  if (entrada.conUniverso) {
    lista.push({ clave: "universo", titulo: "Universo de análisis", detalle: "Qué registros cuentan", tono: "neutro", grupo: "declaracion" });
  }
  if (entrada.conOrigenExterno) {
    lista.push({ clave: "origen-externo", titulo: "Base preparada fuera", detalle: "Casos y variables retirados antes", tono: "neutro", grupo: "declaracion" });
  }
  return lista;
}

/** Las comprobaciones que piden una decisión o impiden seguir. */
export function pideDecision(c: Comprobacion): boolean {
  return c.grupo === "comprobacion" && (c.tono === "aviso" || c.tono === "error");
}

/**
 * La comprobación que se abre sin que nadie elija: la primera que pide algo.
 * Sin pendientes no se abre ninguna y la mesa dice que no hay nada por decidir.
 */
export function comprobacionInicial(lista: readonly Comprobacion[]): ClaveDeComprobacion | null {
  const error = lista.find((c) => pideDecision(c) && c.tono === "error" && c.clave !== "formulario" && c.clave !== "respuestas");
  return (error ?? lista.find(pideDecision))?.clave ?? null;
}

export type CifrasDeRevision = { conformes: number; total: number };

export function cifrasDeRevision(lista: readonly Comprobacion[]): CifrasDeRevision {
  const juzgadas = lista.filter((c) => c.grupo === "comprobacion");
  return { conformes: juzgadas.filter((c) => c.tono === "ok" || c.tono === "info").length, total: juzgadas.length };
}

export function estadoDeRevision({
  lista,
  leyendo,
  conInsumos,
  resumen,
}: {
  lista: readonly Comprobacion[];
  leyendo: boolean;
  conInsumos: boolean;
  /** Varias bases: el avance del estudio entero. */
  resumen: CargaReviewSummaryPayload | null;
}): EstadoDePestana | null {
  if (!conInsumos) return null;
  if (leyendo) return { tono: "neutro", texto: "Revisando" };
  if (lista.some((c) => c.grupo === "comprobacion" && c.tono === "error")) return { tono: "bloqueado", texto: "Requiere atención" };
  if (lista.some(pideDecision)) return { tono: "atencion", texto: "Por decidir" };
  if (resumen && !resumen.all_ready) return { tono: "parcial", texto: "Otras bases por decidir" };
  return { tono: "listo", texto: "Sin pendientes" };
}

// ── Columnas fuera del formulario ────────────────────────────────────────────

export type FiltroDeColumnas = "pendiente" | "include" | "exclude" | "todas";

export const ROTULO_DE_DECISION: Record<Exclude<FiltroDeColumnas, "todas">, string> = {
  pendiente: "Por decidir",
  include: "Incorporada",
  exclude: "Fuera",
};

/** La decisión que guardó el motor; cualquier otro valor se lee como por decidir. */
export function decisionDeColumna(extra: CargaReviewReconciliationExtra): Exclude<FiltroDeColumnas, "todas"> {
  if (extra.decision === "include" || extra.incluida) return "include";
  if (extra.decision === "exclude") return "exclude";
  return "pendiente";
}

export function conteoPorDecision(extras: readonly CargaReviewReconciliationExtra[]): Record<FiltroDeColumnas, number> {
  const conteo: Record<FiltroDeColumnas, number> = { pendiente: 0, include: 0, exclude: 0, todas: extras.length };
  for (const e of extras) conteo[decisionDeColumna(e)] += 1;
  return conteo;
}

/** El filtro con que se abre la tabla: lo que falta decidir, si hay; si no, todas. */
export function filtroInicial(extras: readonly CargaReviewReconciliationExtra[]): FiltroDeColumnas {
  return extras.some((e) => decisionDeColumna(e) === "pendiente") ? "pendiente" : "todas";
}

export function columnasDelFiltro(
  extras: readonly CargaReviewReconciliationExtra[],
  filtro: FiltroDeColumnas,
): CargaReviewReconciliationExtra[] {
  return filtro === "todas" ? [...extras] : extras.filter((e) => decisionDeColumna(e) === filtro);
}

/**
 * Las marcadas al abrir: las que ya se incorporaron; si todavía no se decidió
 * ninguna, las que traen dato en más de la mitad de los casos (la regla única
 * `reconciliacionModel.vieneMarcadaPorDefecto`, la misma del diálogo).
 */
export function marcadasIniciales(extras: readonly CargaReviewReconciliationExtra[]): string[] {
  const incluidas = extras.filter((e) => decisionDeColumna(e) === "include");
  if (incluidas.length > 0) return incluidas.map((e) => e.name);
  return extras.filter(vieneMarcadaPorDefecto).map((e) => e.name);
}

/**
 * Lo que se guarda: la lista de columnas que entran, en el orden del motor. El
 * motor guarda la decisión de todas a la vez (`.carga_review_set_reconciliation`
 * marca revisadas todas las columnas): las no marcadas quedan fuera.
 */
export function incluidasAlGuardar(extras: readonly CargaReviewReconciliationExtra[], marcadas: readonly string[]): string[] {
  const set = new Set(marcadas);
  return extras.filter((e) => set.has(e.name)).map((e) => e.name);
}

/** Si guardar cambiaría algo: hay pendientes o la selección no es la guardada. */
export function hayCambiosPorGuardar(extras: readonly CargaReviewReconciliationExtra[], marcadas: readonly string[]): boolean {
  if (extras.some((e) => decisionDeColumna(e) === "pendiente")) return true;
  const guardadas = extras.filter((e) => decisionDeColumna(e) === "include").map((e) => e.name).sort();
  const elegidas = incluidasAlGuardar(extras, marcadas).sort();
  return guardadas.length !== elegidas.length || guardadas.some((n, i) => n !== elegidas[i]);
}

/** El dato que trae la columna: "48 (40 %)" o "Vacía". */
export function rotuloConDato(extra: CargaReviewReconciliationExtra): string {
  if (extra.kind === "vacia" || extra.n_fill <= 0) return "Vacía";
  return `${formatoConteo(extra.n_fill)} (${textoPorcentajeConDato(extra.fill_pct)} %)`;
}
