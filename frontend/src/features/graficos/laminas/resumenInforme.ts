// Cifras de la barra de la pestaña Láminas (F6.1, parte 2). Puras para poder probarlas: la barra no promete un número
// que no conoce.

import type { ValidationIssue } from "../usePlanValidator";
import type { ResumenLamina } from "./laminasStore";

/** «67 láminas» o, cuando ya se vio cómo sale cada una, «67 láminas · 70 partes». */
export function rotuloLaminasYPartes(ids: readonly string[], resumenes: Readonly<Record<string, ResumenLamina>>): string {
  const n = ids.length;
  const base = `${n} ${n === 1 ? "lámina" : "láminas"}`;
  if (n === 0 || !ids.every((id) => resumenes[id])) return base;
  const partes = ids.reduce((t, id) => t + Math.max(1, resumenes[id].partes), 0);
  return partes === n ? base : `${base}, ${partes} partes`;
}

export type GrupoAvisos = {
  /** Errores del validador: bloquean exportar. */
  bloquean: ValidationIssue[];
  /** Advertencias del validador: no bloquean. */
  revisar: ValidationIssue[];
  /** Avisos sellados del motor en las láminas ya vistas, por id de lámina. */
  motor: { slideId: string; avisos: string[] }[];
  /** Lo que el backend cambió en el plan al abrirlo (p. ej. la población antigua migrada); llega una vez por sesión. */
  plan: string[];
  /**
   * ADR 0096 decisión 8: avisos de la matriz de equivalencias —desfase de la declaración aplicada y lo que avisó la
   * siembra del informe compartido (sin matriz, bases excluidas, cobertura reducida, escala incompatible)—.
   */
  equivalencias: string[];
};

export function agruparAvisos(issues: readonly ValidationIssue[], resumenes: Readonly<Record<string, ResumenLamina>>, orden: readonly string[], plan: readonly string[] = [], equivalencias: readonly string[] = []): GrupoAvisos {
  const motor = orden
    .map((slideId) => ({ slideId, avisos: resumenes[slideId]?.avisosTexto ?? [] }))
    .filter((m) => m.avisos.length > 0);
  return {
    bloquean: issues.filter((i) => i.severity === "error"),
    revisar: issues.filter((i) => i.severity !== "error"),
    motor,
    plan: [...plan],
    equivalencias: [...equivalencias],
  };
}

/**
 * R7-9: el motor sella el aviso con el número que la lámina tenía al dibujarse («Lámina 25, "Gestión…": …»). Insertada
 * otra antes, ese número miente: se reemplaza por la posición actual (la del enlace). Sin posición conocida, se quita.
 */
export function avisoConLaminaActual(texto: string, posicion: number | undefined): string {
  const m = /^Lámina\s+\d+/.exec(texto);
  if (!m) return texto;
  if (posicion !== undefined) return `Lámina ${posicion}${texto.slice(m[0].length)}`;
  const resto = texto.slice(m[0].length).replace(/^[,:\s]+/, "");
  return resto ? `${resto.charAt(0).toLocaleUpperCase("es")}${resto.slice(1)}` : texto;
}

export function totalAvisos(g: GrupoAvisos): number {
  return g.bloquean.length + g.revisar.length + g.motor.reduce((t, m) => t + m.avisos.length, 0) + g.plan.length + g.equivalencias.length;
}
