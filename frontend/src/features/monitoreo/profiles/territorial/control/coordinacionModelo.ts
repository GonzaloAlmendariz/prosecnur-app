import type { AsignacionPlanificada } from "../../../../../api/monitoreoAsignacionPlanificada";
import { fmt, pctEntero } from "../rotulos";

/**
 * El control de encuestadores con el registro del coordinador (2h, Gonzalo
 * 2026-10-31: «el control de los encuestadores o aplicadores debe ser de
 * Monitoreo»). Lo declarado por coordinación va AL LADO de Kobo validado, con
 * su diferencia: el avance oficial sigue siendo Kobo y nunca se suman.
 */

export type ControlDeCodigo = {
  declaradas: string;
  /** UMP del código donde coordinación y Kobo no coinciden. */
  noCuadran: number;
  rendimiento: string;
  supervision: string;
  tituloRendimiento: string;
};

export type ControlDeCoordinacion = {
  porCodigo: Map<string, ControlDeCodigo>;
  /** Una línea para la cabecera; `null` si nadie declaró nada. */
  resumen: string | null;
  hayAlerta: boolean;
};

export function controlDeCoordinacion(asig: AsignacionPlanificada | null): ControlDeCoordinacion | null {
  if (!asig || asig.estado !== "comparable" || !asig.resumen.conRegistroCoordinacion) return null;
  const porCodigo = new Map<string, ControlDeCodigo>();
  for (const e of asig.porEncuestador) {
    const sup = e.supervisionAprobadas == null && e.supervisionNoAprobadas == null
      ? "—"
      : `${fmt(e.supervisionAprobadas ?? 0)} / ${fmt(e.supervisionNoAprobadas ?? 0)}`;
    porCodigo.set(e.codigo.toUpperCase(), {
      declaradas: e.efectivasCoordinacion == null ? "—" : fmt(e.efectivasCoordinacion),
      noCuadran: e.umpQueNoCuadran,
      rendimiento: e.intentosDeclarados ? pctEntero(e.efectivasKobo, e.intentosDeclarados) : "—",
      supervision: sup,
      tituloRendimiento: e.intentosDeclarados == null
        ? "Sin intentos declarados por coordinación"
        : `${fmt(e.efectivasKobo)} efectivas en Kobo sobre ${fmt(e.intentosDeclarados)} intentos declarados`,
    });
  }
  const r = asig.resumen;
  const partes = [
    `Coordinación declara ${fmt(r.conRegistroCoordinacion)} UMP`,
    r.coordinacionDistinta ? `${fmt(r.coordinacionDistinta)} no cuadran con Kobo` : "todas cuadran con Kobo",
  ];
  if (r.supervisionAprobadas != null || r.supervisionNoAprobadas != null) {
    partes.push(`supervisión ${fmt(r.supervisionAprobadas ?? 0)} aprobadas y ${fmt(r.supervisionNoAprobadas ?? 0)} no aprobadas`);
  }
  return {
    porCodigo,
    resumen: `${partes.join(" · ")}. El avance oficial es Kobo validado; lo declarado no se suma.`,
    hayAlerta: r.coordinacionDistinta > 0,
  };
}
