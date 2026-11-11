// Qué dice la cabecera de cada pestaña de Validación en la rebanada V0 del plan
// de fidelidad: solo lo que hoy es inequívoco y sale de lo que la pestaña ya
// pide al motor (V0 no agrega pedidos). Lo demás queda como hueco declarado,
// con su causa, en `pendientes`: no se pinta, pero se lee en el marcado.
//
// Sin decidir D-F1 (qué se llama "hallazgo" en pantalla) no se escribe ninguna
// cifra que dependa de esa unidad: "5/19 hallazgos por decidir" y "6/6
// hallazgos decididos" esperan. "Casos con algún hallazgo" no depende de ella:
// cuenta encuestados marcados por alguna regla con cualquiera de las dos
// lecturas, y su base es la de la última auditoría (contrato M2).

import { normalizarCifrasHallazgos } from "../../../api/validacionAuditoria";
import type { CifraDePestana } from "../../../components/procesamiento/CifrasDePestana";
import type { EstadoDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import { formatoConteo } from "../../../lib/formatoNumero";
import type { LimpiezaArtifactsBundle, LimpiezaSummary } from "../types";

export type CabeceraDeDatos = {
  estado: EstadoDePestana | null;
  cifras: CifraDePestana[];
  /** Las cifras del diseño que faltan, con su causa (pedido de motor, decisión o rebanada). */
  pendientes: string;
};

export const PENDIENTES_EXPLORAR = "preguntas, casos y versión de la base: rebanada V5 (Explorar)";
export const PENDIENTES_REGLAS = "reglas activas y sin evaluar: pedido M3; última auditoría: rebanada V1 (estado de la auditoría); acciones Nueva regla y Auditar: V1 y V2";
export const PENDIENTES_HALLAZGOS = "hallazgos por decidir: decisión D-F1; reglas listas y casos por auditar: pedido M3; acción Volver a auditar: V3";
export const PENDIENTES_CIERRE = "hallazgos decididos: decisión D-F1; valores cambiados: pedido M5; última auditoría: rebanada V4; acción Reabrir la base: V4 y D-F8";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"] as const;

/** "6 nov" de una fecha ISO, en la hora local; `null` si no se puede leer. */
export function fechaCorta(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  return `${fecha.getDate()} ${MESES[fecha.getMonth()]}`;
}

export function cabeceraDeExplorar(): CabeceraDeDatos {
  return { estado: null, cifras: [], pendientes: PENDIENTES_EXPLORAR };
}

export function cabeceraDeReglas(): CabeceraDeDatos {
  return { estado: null, cifras: [], pendientes: PENDIENTES_REGLAS };
}

/**
 * Hallazgos, con la carga de `GET /limpieza` que la pestaña ya hace. Mientras
 * carga (`null`) la cabecera no afirma nada.
 */
export function cabeceraDeHallazgos(data: LimpiezaSummary | null): CabeceraDeDatos {
  const vacia: CabeceraDeDatos = { estado: null, cifras: [], pendientes: PENDIENTES_HALLAZGOS };
  if (!data) return vacia;
  if (!data.progreso?.auditoria_corrida) {
    return { ...vacia, estado: { tono: "parcial", texto: "Sin auditar" } };
  }

  const cifras = normalizarCifrasHallazgos(data.cifras_hallazgos);
  const porDecidir = (data.summary?.pendientes ?? 0) > 0;
  // Un motor anterior a la Corrección 15-M no publica las cifras: queda el estado.
  if (!cifras) return { ...vacia, estado: porDecidir ? { tono: "parcial", texto: "Por decidir" } : null };

  // Con 0 reglas evaluadas no hay "0 casos con hallazgos": no se evaluó nada (contrato M2).
  if (cifras.n_reglas_evaluadas === 0) {
    return { ...vacia, estado: { tono: "atencion", texto: "No hay reglas evaluadas" } };
  }

  const aplicadas: CifraDePestana = {
    clave: "reglas-aplicadas",
    valor: formatoConteo(cifras.n_reglas_evaluadas),
    rotulo: cifras.n_reglas_evaluadas === 1 ? "regla aplicada" : "reglas aplicadas",
    rango: 3,
  };

  if (cifras.n_hallazgos === 0) {
    return {
      ...vacia,
      estado: { tono: "listo", texto: "Sin hallazgos" },
      // Cero es cero con cualquier lectura de D-F1.
      cifras: [{ clave: "hallazgos", valor: "0", rotulo: "hallazgos", rango: 1 }, aplicadas],
    };
  }

  const casos: CifraDePestana[] =
    cifras.n_encuestados_con_hallazgos !== null && cifras.n_casos_evaluados !== null
      ? [{
          clave: "casos-con-hallazgo",
          valor: formatoConteo(cifras.n_encuestados_con_hallazgos),
          base: formatoConteo(cifras.n_casos_evaluados),
          rotulo: "casos con algún hallazgo",
          titulo: "Casos de la tabla principal con al menos un hallazgo, sobre los casos de la última auditoría.",
          rango: 1,
        }]
      : [];

  return {
    ...vacia,
    estado: porDecidir ? { tono: "parcial", texto: "Por decidir" } : null,
    cifras: [...casos, aplicadas],
  };
}

/** La base está cerrada si se generó la base limpia y la promoción no se revirtió. */
export function cabeceraDeCierre(data: LimpiezaSummary | null): CabeceraDeDatos {
  const vacia: CabeceraDeDatos = { estado: null, cifras: [], pendientes: PENDIENTES_CIERRE };
  if (!data) return vacia;
  const artefactos: Partial<LimpiezaArtifactsBundle> = data.artifacts ?? {};
  const promocion = artefactos.promocion;
  const revertida = !!promocion?.reverted_at && promocion.enabled === false;
  const fecha = revertida ? null : fechaCorta(artefactos.finalized_at);
  return fecha ? { ...vacia, estado: { tono: "listo", texto: `Cerrada el ${fecha}` } } : vacia;
}
