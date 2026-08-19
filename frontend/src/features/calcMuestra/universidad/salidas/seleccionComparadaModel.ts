/**
 * La selección nueva contra lo APLICADO del estudio anterior, por facultad.
 *
 * Pedido de Gonzalo (2026-08-19): «sería bueno usar la app para comparar lo
 * que se hizo en 2025 con la nueva selección a 2026». El embudo comparado ya
 * confronta los CONTEOS paso a paso; lo que faltaba es el RENDIMIENTO: las
 * efectivas que la selección nueva espera (efectivas_esperadas del motor,
 * calibradas con las tasas del estudio anterior) contra las efectivas que el
 * estudio anterior logró de verdad.
 *
 * Denominadores, dicho sin letra chica (la trampa conocida de «una palabra
 * para dos cosas»): la columna del estudio anterior es lo APLICADO — las k
 * aulas donde el equipo llegó a levantar datos —, no su selección original.
 * La columna nueva es lo SELECCIONADO — titulares planificados, nada más.
 * Son momentos distintos del operativo y la tarjeta los rotula como tales.
 */
import type {
  CalcMuestraAulasSelection,
  CalcMuestraReferenciaAsistencia,
} from "../../../../api/calcMuestra";

/** Fila cruda de la selección: el payload viaja como registros genéricos. */
type FilaSeleccion = Record<string, unknown>;
import { claveFacultad } from "../../dominio/rangosNivel";

export type SeleccionComparadaFila = {
  clave: string;
  facultad: string;
  /** Titulares seleccionados ahora. */
  aulasNuevas: number;
  /** Aulas APLICADAS del estudio anterior (k del embudo de asistencia). */
  aulasAplicadasRef: number | null;
  /** Elegibles sumados en los titulares nuevos. */
  elegiblesNuevos: number;
  elegiblesRef: number | null;
  /** Σ efectivas_esperadas de los titulares nuevos; null si el motor no anotó. */
  esperadasNuevas: number | null;
  /** Efectivas reales del estudio anterior. */
  efectivasRef: number | null;
};

export type SeleccionComparada = {
  filas: SeleccionComparadaFila[];
  totales: {
    aulasNuevas: number;
    aulasAplicadasRef: number | null;
    esperadasNuevas: number | null;
    efectivasRef: number | null;
  };
  /** true si alguna facultad seleccionada no aparece en la referencia. */
  sinReferencia: boolean;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const esTitular = (row: FilaSeleccion): boolean => {
  const rol = String(row.sample_role ?? "").toLowerCase();
  if (rol) return rol === "titular";
  return String(row.wave ?? "").toUpperCase() === "M1";
};

/** Arma la comparación; [] cuando falta la selección o no tiene titulares. */
export function seleccionComparada(
  seleccion: CalcMuestraAulasSelection | null | undefined,
  referencia: CalcMuestraReferenciaAsistencia | null | undefined,
): SeleccionComparada {
  const vacio: SeleccionComparada = {
    filas: [],
    totales: { aulasNuevas: 0, aulasAplicadasRef: null, esperadasNuevas: null, efectivasRef: null },
    sinReferencia: false,
  };
  const rows: FilaSeleccion[] = (seleccion?.selection ?? []) as unknown as FilaSeleccion[];
  if (!rows.length) return vacio;

  const porFacultad = new Map<string, SeleccionComparadaFila>();
  for (const row of rows) {
    if (!esTitular(row)) continue;
    const facultad = String(row.faculty ?? "").trim();
    if (!facultad) continue;
    const clave = claveFacultad(facultad);
    const fila = porFacultad.get(clave) ?? {
      clave,
      facultad,
      aulasNuevas: 0,
      aulasAplicadasRef: null,
      elegiblesNuevos: 0,
      elegiblesRef: null,
      esperadasNuevas: null,
      efectivasRef: null,
    };
    fila.aulasNuevas += 1;
    fila.elegiblesNuevos += num(row.eligible_n) ?? 0;
    const esperadas = num(row.efectivas_esperadas);
    if (esperadas != null) fila.esperadasNuevas = (fila.esperadasNuevas ?? 0) + esperadas;
    porFacultad.set(clave, fila);
  }
  if (!porFacultad.size) return vacio;

  const embudoFacultad = (referencia?.embudos ?? []).find(
    (e) => e.dimension_key === "facultad",
  );
  let sinReferencia = false;
  for (const fila of porFacultad.values()) {
    const ref = (embudoFacultad?.filas ?? []).find(
      (f) => f.celda_key === fila.clave || claveFacultad(f.celda_label) === fila.clave,
    );
    if (!ref) {
      sinReferencia = true;
      continue;
    }
    fila.aulasAplicadasRef = num(ref.k);
    fila.elegiblesRef = num(ref.elegibles);
    fila.efectivasRef = num(ref.efectivas);
  }

  const filas = [...porFacultad.values()].sort((a, b) => b.aulasNuevas - a.aulasNuevas);
  const sumaON = (vals: Array<number | null>): number | null =>
    vals.some((v) => v != null) ? vals.reduce<number>((s, v) => s + (v ?? 0), 0) : null;
  return {
    filas,
    totales: {
      aulasNuevas: filas.reduce((s, f) => s + f.aulasNuevas, 0),
      aulasAplicadasRef: sumaON(filas.map((f) => f.aulasAplicadasRef)),
      esperadasNuevas: sumaON(filas.map((f) => f.esperadasNuevas)),
      efectivasRef: sumaON(filas.map((f) => f.efectivasRef)),
    },
    sinReferencia,
  };
}
