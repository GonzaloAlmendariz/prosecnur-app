// Formato de literales para leer: fechas legibles («1 de enero de 2026»), cadenas entre comillas, vacío, sí/no.

import type { Expr } from "../../logic";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** «2026-01-01» → «1 de enero de 2026». null si no es una fecha ISO válida. */
export function fechaLegible(iso: string): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return `${dia} de ${MESES[mes - 1]} de ${m[1]}`;
}

export function literalLegible(value: string | number | boolean, comoTexto = false): string {
  if (typeof value === "boolean") return value ? "sí" : "no";
  if (typeof value === "number") return String(value);
  if (value === "") return "vacío";
  if (value === " ") return "un espacio";
  const fecha = fechaLegible(value);
  if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(value)) return fecha;
  return comoTexto ? `«${value}»` : value;
}

/** Número literal de una expresión, si lo es (también '3' entre comillas). */
export function numeroDe(e: Expr | undefined): number | null {
  if (!e || e.kind !== "literal") return null;
  if (typeof e.value === "number") return e.value;
  if (typeof e.value === "string" && /^-?\d+(\.\d+)?$/.test(e.value.trim())) return Number(e.value);
  return null;
}

export function textoDe(e: Expr | undefined): string | null {
  return e && e.kind === "literal" && typeof e.value === "string" ? e.value : null;
}
