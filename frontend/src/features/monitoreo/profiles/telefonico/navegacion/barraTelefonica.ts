import { useMemo, useRef } from "react";
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import type { BarraDelModo, EstadoDelModo } from "../../../shell/BarraDelModo";
import { fmt } from "../formato";
import { nombreDelSegmento } from "../segmentoDeCuotas";
import { filasDeBloque } from "./bloques";
import { chipsDeInsistencia } from "../control/insistenciaModel";

/**
 * Lo que la barra del modo telefónico dice en todas las pestañas: el eje de
 * cuota, cuánto falta, el corte, el estado y las insignias de Control y
 * Avance. Las cifras salen de los mismos bloques que Avance › Cuotas
 * (`cuotas_variable`) y Control › Discrepancias (`comparacion_codpulso`).
 */

export type CuotaParaLaBarra = {
  actor: string;
  meta: number | null;
  effective: number;
  missing: number | null;
};

export type ResumenDelModoTelefonico = {
  ejeDeCuota: string | null;
  meta: number | null;
  faltan: number | null;
  efectivas: number;
  /** Casos en que Kobo y la hoja no dicen lo mismo (insignia de Control). */
  porRevisar: number | null;
};

export { filasDeBloque } from "./bloques";

export function resumenDelModo({
  cuotas,
  variables,
  porRevisar,
}: {
  cuotas: readonly CuotaParaLaBarra[];
  /** Columna `Variable` de las filas de cuota, para nombrar el eje. */
  variables: readonly string[];
  porRevisar: number | null;
}): ResumenDelModoTelefonico {
  const conMeta = cuotas.filter((item) => item.meta != null && item.meta > 0);
  const segmento = cuotas.length ? nombreDelSegmento(variables, "") : "";
  return {
    ejeDeCuota: segmento ? `${segmento}, ${fmt(cuotas.length)} ${cuotas.length === 1 ? "valor" : "valores"}` : null,
    meta: conMeta.length ? conMeta.reduce((suma, item) => suma + (item.meta ?? 0), 0) : null,
    faltan: conMeta.length ? conMeta.reduce((suma, item) => suma + (item.missing ?? 0), 0) : null,
    efectivas: conMeta.reduce((suma, item) => suma + item.effective, 0),
    porRevisar,
  };
}

/** «27/07/26 09:04», sin la coma que pone el locale. */
export function corteCorto(valor: string | null | undefined): string {
  const texto = String(valor ?? "").trim();
  if (!texto) return "";
  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) return texto;
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${dos(fecha.getFullYear() % 100)} ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

export function estadoDelModo({
  actualizando,
  cargando,
  hayEstado,
  generationStatus,
  pendienteDeRecalcular,
  error,
}: {
  actualizando: boolean;
  cargando: boolean;
  hayEstado: boolean;
  generationStatus: string;
  pendienteDeRecalcular: boolean;
  error: string;
}): EstadoDelModo {
  if (actualizando) return { clave: "actualizando" };
  if (error) return { clave: "fallo", detalle: error };
  if (generationStatus === "failed" || generationStatus === "partial") return { clave: "fallo" };
  if (!hayEstado || cargando) return { clave: "preparando" };
  if (pendienteDeRecalcular || generationStatus === "stale") return { clave: "pendiente" };
  return { clave: "al-dia" };
}

export function indicadoresDelModo(resumen: ResumenDelModoTelefonico): BarraDelModo["indicadores"] {
  return [
    {
      etiqueta: "Eje de cuota",
      valor: resumen.ejeDeCuota ?? "Por definir",
    },
    resumen.meta != null && resumen.faltan != null
      ? {
        etiqueta: "Faltan",
        valor: `${fmt(resumen.faltan)} de ${fmt(resumen.meta)}`,
        tono: resumen.faltan > 0 ? "falta" as const : "cumple" as const,
        detalle: `${fmt(resumen.efectivas)} efectivas de una meta de ${fmt(resumen.meta)}`,
      }
      : { etiqueta: "Faltan", valor: "Sin metas" },
  ];
}

/** Insignias de las píldoras: casos por revisar en Control y avance en Avance. */
export function insigniasDelModo(resumen: ResumenDelModoTelefonico): Partial<Record<"control" | "avance", string>> {
  const insignias: Partial<Record<"control" | "avance", string>> = {};
  if (resumen.porRevisar != null && resumen.porRevisar > 0) insignias.control = fmt(resumen.porRevisar);
  if (resumen.meta != null && resumen.meta > 0) {
    insignias.avance = `${fmt(Math.round((resumen.efectivas / resumen.meta) * 100))} %`;
  }
  return insignias;
}

/**
 * El resumen del corte que esté a la vista y, si la sección cargada no trae
 * los bloques de cuota (cada sección pide su propio corte), el último que sí
 * los trajo: la barra no puede decir «Sin metas» sólo porque se pasó a Insumos.
 */
export function useResumenDelModo(
  reports: MonitoreoAcreditacionReports | null,
  leerCuotas: (reports: MonitoreoAcreditacionReports) => readonly CuotaParaLaBarra[],
  leerComparacion: (filas: Array<Record<string, unknown>>) => { mismatch: number },
): ResumenDelModoTelefonico | null {
  const ultimo = useRef<ResumenDelModoTelefonico | null>(null);
  return useMemo(() => {
    if (!reports) return ultimo.current;
    const filasDeCuota = filasDeBloque(reports, ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]);
    const comparacion = filasDeBloque(reports, ["comparacion_codpulso", "campo_vs_plataforma_codpulso"]);
    if (!filasDeCuota.length && !comparacion.length) return ultimo.current;
    const cuotas = filasDeCuota.length ? leerCuotas(reports) : [];
    const nuevo = resumenDelModo({
      cuotas,
      variables: filasDeCuota.map((fila) => String(fila.Variable ?? "")),
      porRevisar: comparacion.length ? leerComparacion(comparacion).mismatch : ultimo.current?.porRevisar ?? null,
    });
    const fusionado = cuotas.length || !ultimo.current
      ? nuevo
      : { ...ultimo.current, porRevisar: nuevo.porRevisar };
    ultimo.current = fusionado;
    return fusionado;
  }, [reports, leerCuotas, leerComparacion]);
}

/** Chips de contexto de la cabecera de pestaña: Avance › Cuotas y Control › Insistencia. */
export function chipsDeCabecera(
  direccion: { seccion: string; pestana: string },
  resumen: ResumenDelModoTelefonico | null,
  reports: MonitoreoAcreditacionReports | null,
): string[] {
  if (direccion.seccion === "avance" && direccion.pestana === "cuotas" && resumen?.meta) {
    return [`${fmt(resumen.efectivas)} de ${fmt(resumen.meta)} efectivas`];
  }
  if (direccion.seccion === "control" && direccion.pestana === "insistencia") return chipsDeInsistencia(reports);
  return [];
}

/** Pestañas ya rediseñadas: traen sus propios paneles y piden el lienzo desnudo. */
export function pestanaConLienzo(direccion: { seccion: string; pestana: string }): boolean {
  const clave = `${direccion.seccion}/${direccion.pestana}`;
  return clave === "avance/cuotas" || clave === "control/insistencia";
}
