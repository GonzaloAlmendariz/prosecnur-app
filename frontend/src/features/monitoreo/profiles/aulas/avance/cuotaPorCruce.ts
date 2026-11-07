import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { fmt } from "../kpisDeAulas";
import { sexoEnPalabra } from "../tresLecturasDeCuota";
import { nombreDelGrupo, type EjeDelResumen } from "./resumenAulasModelo";

/**
 * Las variables de cuota que declara el estudio (ADR 0121), en orden. La
 * primera agrupa; la segunda (y siguientes) se muestran dentro de cada grupo.
 *
 * Sale de `avance_cuota.celdas_declaradas` (F2) y, en un corte que todavía no lo
 * trae, de `representatividad_declarada` (F1). Sin ninguno de los dos, la del
 * eje sola: es lo que el estudio declaraba antes del ADR.
 */
export function variablesDeCuota(dashboard: MonitoreoAulasDashboard | null, eje: EjeDelResumen): string[] {
  const deCeldas = dashboard?.avance_cuota?.celdas_declaradas?.variables;
  if (Array.isArray(deCeldas) && deCeldas.length) return deCeldas.map(String);
  const declaradas = dashboard?.representatividad_declarada?.variables;
  if (Array.isArray(declaradas) && declaradas.length) return declaradas.map((v) => String(v.clave));
  return [eje.clave];
}

/** La etiqueta de una variable declarada («Sexo», «Nivel»), o su clave con mayúscula. */
export function etiquetaDeVariable(dashboard: MonitoreoAulasDashboard | null, clave: string): string {
  const v = dashboard?.representatividad_declarada?.variables?.find((x) => x.clave === clave);
  if (v?.etiqueta) return v.etiqueta;
  return clave ? clave[0].toLocaleUpperCase("es") + clave.slice(1) : "";
}

/** Cómo se nombra un valor de una variable dentro de un grupo: «Mujeres», «Nivel 7», «Derecho». */
export function nombreDeValor(clave: string, valor: string, etiqueta: string): string {
  if (clave === "sexo") return sexoEnPalabra(valor);
  return nombreDelGrupo(valor, { clave, etiqueta, plural: etiqueta, sin: "" });
}

export type FilaDeCruce = {
  clave: string;
  rotulo: string;
  logradas: number;
  cuota: number | null;
  relleno: number;
  cumple: boolean;
  /** Lo que falta en esta celda, o «Cumplida». */
  lectura: string;
  tono: "ok" | "aviso" | "neutro";
  aria: string;
};

export type GrupoDeCruce = { clave: string; valor: string; nombre: string; filas: FilaDeCruce[] };

/**
 * La cuota por la primera variable y, dentro, por las demás, desde las celdas
 * que publica el motor. Sirve para cualquier combinación que el estudio declare
 * (nivel × sexo, carrera × nivel…). La brecha de cada fila es la de su celda: no
 * se compensan entre sí.
 */
export function gruposPorCruce(dashboard: MonitoreoAulasDashboard | null, eje: EjeDelResumen): GrupoDeCruce[] {
  const bloque = dashboard?.avance_cuota?.celdas_declaradas;
  if (!bloque || !Array.isArray(bloque.celdas)) return [];
  const variables = variablesDeCuota(dashboard, eje);
  const [primera, ...resto] = variables;
  if (!primera || !resto.length) return [];
  const etiquetas = new Map(resto.map((k) => [k, etiquetaDeVariable(dashboard, k)]));
  const grupos = new Map<string, GrupoDeCruce>();
  for (const celda of bloque.celdas) {
    const valor = String(celda.valores?.[primera] ?? "");
    if (!valor) continue;
    const g = grupos.get(valor) ?? { clave: valor, valor, nombre: nombreDelGrupo(valor, eje), filas: [] };
    const rotulo = resto
      .map((k) => nombreDeValor(k, String(celda.valores?.[k] ?? ""), etiquetas.get(k) ?? k))
      .join(", ");
    const cuota = celda.cuota != null && celda.cuota > 0 ? celda.cuota : null;
    const logradas = Number(celda.logradas) || 0;
    const cumple = cuota != null && logradas >= cuota;
    const falta = cuota != null ? Math.max(0, cuota - logradas) : 0;
    g.filas.push({
      clave: `${valor}|${resto.map((k) => celda.valores?.[k] ?? "").join("|")}`,
      rotulo,
      logradas,
      cuota,
      relleno: cuota == null ? 0 : Math.max(0, Math.min(100, (100 * logradas) / cuota)),
      cumple,
      lectura: cuota == null ? "Sin cuota" : cumple ? "Cumplida" : `Faltan ${fmt(falta)}`,
      tono: cuota == null ? "neutro" : cumple ? "ok" : "aviso",
      aria: `${g.nombre}, ${rotulo}: ${fmt(logradas)}${cuota == null ? " sin cuota" : ` de ${fmt(cuota)}`}`,
    });
    grupos.set(valor, g);
  }
  // Primero los grupos a los que más les falta; entre iguales, por nombre.
  const falta = (g: GrupoDeCruce) => g.filas.reduce((s, f) => s + (f.cuota != null ? Math.max(0, f.cuota - f.logradas) : 0), 0);
  return [...grupos.values()].sort((a, b) => falta(b) - falta(a) || a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
}
