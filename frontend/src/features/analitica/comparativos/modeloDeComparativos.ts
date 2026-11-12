// Modelo puro de la mesa de Comparativos (prototipo "Analítica, Comparativos"):
// las cifras de la cabecera, los filtros por cobertura de la tabla, la fila en
// `?foco=`, el estado de la pestaña y el de cada archivo. Lo que decide qué filas
// entran, el body y los errores sigue en `panes/comparativosModel.ts`.

import type { ComparativoResultado, ComparativoTipo } from "../../../api/analitica";
import type { EquivalenciasEstado } from "../../../api/equivalencias";
import type { EstadoDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import type { CifraDePestana } from "../../../components/procesamiento/CifrasDePestana";
import { formatoConteo } from "../../../lib/formatoNumero";
import { DIRECCION_EQUIVALENCIAS, filtrarFilas, type FilaArmonizada } from "../panes/comparativosModel";

// ---- Cabecera -----------------------------------------------------------------

export type CifrasDeComparativos = {
  bases: number;
  /** Filas de la matriz que el comparativo puede tabular (armonizadas o de misma escala). */
  armonizadas: number;
  /** Filas de la matriz de equivalencias: la base de las dos cifras siguientes. */
  filasDeLaMatriz: number;
  /** Armonizadas comparables en todas las bases de la serie. */
  enTodas: number;
  /** Bases cuyo formulario cambió después de declarar la matriz (`desfasadas`). */
  cambiadas: number;
};

export function cifrasDeComparativos(
  estado: Pick<EquivalenciasEstado, "filas" | "desfasadas">,
  filas: readonly FilaArmonizada[],
  periodos: readonly string[],
): CifrasDeComparativos {
  const n = periodos.length;
  return {
    bases: n,
    armonizadas: filas.length,
    filasDeLaMatriz: (estado.filas ?? []).length,
    enTodas: filas.filter((f) => n > 0 && f.basesComparables.length === n).length,
    cambiadas: estado.desfasadas.filter((b) => periodos.includes(b)).length,
  };
}

export function cifrasDeLaCabecera(c: CifrasDeComparativos): CifraDePestana[] {
  const base = formatoConteo(c.filasDeLaMatriz);
  const cifras: CifraDePestana[] = [
    { clave: "bases", valor: formatoConteo(c.bases), rotulo: c.bases === 1 ? "base comparada" : "bases comparadas", rango: 1 },
    {
      clave: "armonizadas",
      valor: formatoConteo(c.armonizadas),
      base,
      rotulo: c.armonizadas === 1 ? "pregunta armonizada" : "preguntas armonizadas",
      titulo: "Filas de la matriz de equivalencias que el comparativo puede tabular",
      ...(c.armonizadas > 0 && c.armonizadas === c.filasDeLaMatriz ? { tono: "ok" as const } : {}),
    },
    {
      clave: "en-todas",
      valor: formatoConteo(c.enTodas),
      base,
      rotulo: `en las ${formatoConteo(c.bases)} bases`,
      titulo: "Preguntas armonizadas que tienen variable comparable en todas las bases",
      rango: 3,
    },
  ];
  if (c.cambiadas > 0) {
    cifras.push({
      clave: "cambiadas",
      valor: formatoConteo(c.cambiadas),
      base: formatoConteo(c.bases),
      rotulo: c.cambiadas === 1 ? "base cambió desde la matriz" : "bases cambiaron desde la matriz",
      titulo: "Bases cuyo formulario cambió después de declarar la matriz de equivalencias",
      tono: "alerta",
      enlace: DIRECCION_EQUIVALENCIAS,
    });
  }
  return cifras;
}

/** Fase del archivo que se está generando, la del kit de entregables (`useGeneracion`). */
export type FaseDeEntrega = "inactiva" | "en_curso" | "lista" | "fallo" | string;

/** Estado de la pestaña. Sin generar en esta vista no se afirma nada: el motor no publica el último archivo. */
export function estadoDeComparativos(fase: FaseDeEntrega, generado: boolean): EstadoDePestana | null {
  if (fase === "en_curso") return { tono: "parcial", texto: "Generando" };
  if (fase === "fallo") return { tono: "atencion", texto: "No se generó" };
  if (generado) return { tono: "listo", texto: "Generado" };
  return null;
}

// ---- Tabla de preguntas ---------------------------------------------------------

export type FiltroDeCobertura = "todas-las-bases" | "una-menos" | "todas";

export type OpcionDeFiltro = { id: FiltroDeCobertura; rotulo: string; conteo: number };

/**
 * Los filtros del prototipo: en todas las bases, en una menos y todas. "En una
 * menos" solo existe con tres bases o más; con dos sería "en 1".
 */
export function opcionesDeFiltro(filas: readonly FilaArmonizada[], nBases: number): OpcionDeFiltro[] {
  const opciones: OpcionDeFiltro[] = [
    { id: "todas-las-bases", rotulo: `En las ${formatoConteo(nBases)} bases`, conteo: filas.filter((f) => f.basesComparables.length === nBases).length },
  ];
  if (nBases >= 3) {
    opciones.push({ id: "una-menos", rotulo: `En ${formatoConteo(nBases - 1)}`, conteo: filas.filter((f) => f.basesComparables.length === nBases - 1).length });
  }
  opciones.push({ id: "todas", rotulo: "Todas", conteo: filas.length });
  return opciones;
}

/** El filtro con el que abre la tabla: el de todas las bases si tiene filas; si no, todas. */
export function filtroInicial(filas: readonly FilaArmonizada[], nBases: number): FiltroDeCobertura {
  return filas.some((f) => f.basesComparables.length === nBases) ? "todas-las-bases" : "todas";
}

export function filasVisibles(
  filas: readonly FilaArmonizada[],
  filtro: FiltroDeCobertura,
  nBases: number,
  consulta: string,
): FilaArmonizada[] {
  const porCobertura = filas.filter((f) =>
    filtro === "todas"
      ? true
      : f.basesComparables.length === (filtro === "todas-las-bases" ? nBases : nBases - 1));
  return filtrarFilas(porCobertura, consulta);
}

/** Lo que va en `?foco=`: el id de la fila en la matriz o, si no tiene, su índice. */
export function claveDeFoco(fila: Pick<FilaArmonizada, "ref">): string {
  return String(fila.ref);
}

export function filaEnFoco(filas: readonly FilaArmonizada[], foco: string | null): FilaArmonizada | null {
  if (!foco) return null;
  return filas.find((f) => claveDeFoco(f) === foco) ?? null;
}

/** Elegidas entre las que se ven: si las visibles ya están todas elegidas, la acción es quitarlas. */
export function todasElegidas(visibles: readonly FilaArmonizada[], elegidas: readonly string[]): boolean {
  const seleccionables = visibles.filter((f) => f.seleccionable);
  return seleccionables.length > 0 && seleccionables.every((f) => elegidas.includes(f.clave));
}

// ---- Archivos -------------------------------------------------------------------

export type EstadoDeArchivo =
  | { tipo: "generando" }
  | { tipo: "generado"; filename: string; nPreguntas: number; nOmitidas: number }
  | { tipo: "bloqueado"; motivo: string }
  | { tipo: "listo" };

export function estadoDeArchivo(
  tipo: ComparativoTipo,
  args: {
    pedido: ComparativoTipo | null;
    enCurso: boolean;
    resultado: { tipo: ComparativoTipo; datos: ComparativoResultado } | null;
    nOmitidas: number;
    bloqueo: string | null;
  },
): EstadoDeArchivo {
  if (args.enCurso && args.pedido === tipo) return { tipo: "generando" };
  if (args.resultado?.tipo === tipo) {
    return {
      tipo: "generado",
      filename: args.resultado.datos.filename,
      nPreguntas: args.resultado.datos.resumen.n_preguntas,
      nOmitidas: args.nOmitidas,
    };
  }
  if (args.bloqueo) return { tipo: "bloqueado", motivo: args.bloqueo };
  return { tipo: "listo" };
}
