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

export const PENDIENTES_EXPLORAR = "preguntas y casos: se leen al cargar la lista de preguntas y la primera pregunta";
export const PENDIENTES_REGLAS = "reglas activas, sin evaluar y última auditoría: se leen del catálogo de reglas (M3) y llegan con la mesa (rebanada V1)";
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

/** Lo que Explorar ya leyó y la cabecera cuenta (rebanada V5). */
export type DatosDeCabeceraExplorar = {
  /** Preguntas de la lista (la del servicio elegido en una base de grupo repetido). */
  preguntas: number | null;
  /** Casos de la base explorada (`n_total` del univariado). */
  casos: number | null;
  /** Casos que quedan con los filtros (`n_tras_filtro`). */
  casosTrasFiltro: number | null;
  /** Filtros que el motor aplicó (`filtros_aplicados`). */
  filtros: number;
  /** Hay una pregunta de cruce elegida. */
  cruce: boolean;
};

/**
 * Explorar, como el prototipo: "63 preguntas", "178 casos" (o "142/178 casos
 * tras el filtro"), "1 cruce activo" y "1 filtro activo". Mientras no hay
 * lectura no afirma nada. La versión de la base (Cargada / Limpia) es la
 * acción de la cabecera, no una cifra.
 */
export function cabeceraDeExplorar(datos: DatosDeCabeceraExplorar | null = null): CabeceraDeDatos {
  if (!datos) return { estado: null, cifras: [], pendientes: PENDIENTES_EXPLORAR };
  const cifras: CifraDePestana[] = [];
  if (datos.preguntas !== null) {
    cifras.push({ clave: "preguntas", valor: formatoConteo(datos.preguntas), rotulo: datos.preguntas === 1 ? "pregunta" : "preguntas", rango: 1 });
  }
  if (datos.casos !== null) {
    const filtrado = datos.filtros > 0 && datos.casosTrasFiltro !== null;
    cifras.push(
      filtrado
        ? { clave: "casos", valor: formatoConteo(datos.casosTrasFiltro), base: formatoConteo(datos.casos), rotulo: "casos tras el filtro", rango: 1 }
        : { clave: "casos", valor: formatoConteo(datos.casos), rotulo: datos.casos === 1 ? "caso" : "casos", rango: 1 },
    );
  }
  if (datos.cruce) cifras.push({ clave: "cruce", valor: "1", rotulo: "cruce activo", rango: 3 });
  if (datos.filtros > 0) {
    cifras.push({ clave: "filtros", valor: formatoConteo(datos.filtros), rotulo: datos.filtros === 1 ? "filtro activo" : "filtros activos", rango: 3 });
  }
  return { estado: null, cifras, pendientes: "" };
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
