/**
 * Insumos › Reglas (ficha I3): todo lo que cambia una cifra antes de contarla.
 * Lee y edita las reglas del perfil (`monitoreo_profile`: llave, prioridad de
 * deduplicación y alertas) y la duración válida de la configuración. Lo que
 * se guarda es la misma configuración con esos campos cambiados; el resto viaja
 * tal cual. Puro y con test.
 */

import type { MonitoreoConfig, MonitoreoProfile } from "../../../../../../api/client";

export type ClaveDeAlerta = "no_answer_min_attempts" | "unassigned_cases_min" | "no_sweep_min_cases" | "no_sweep_pct" | "daily_effective_diff_min";

/** Las cinco alertas del perfil, con sus valores del motor cuando el proyecto no declara otro. */
export const ALERTAS: ReadonlyArray<{ clave: ClaveDeAlerta; rotulo: string; unidad: string; porDefecto: number; proporcion?: boolean }> = [
  { clave: "no_answer_min_attempts", rotulo: "Caso que no contesta, desde", unidad: "intentos", porDefecto: 4 },
  { clave: "unassigned_cases_min", rotulo: "Casos sin responsable, desde", unidad: "casos", porDefecto: 5 },
  { clave: "no_sweep_min_cases", rotulo: "Responsable con casos sin barrer, desde", unidad: "casos", porDefecto: 20 },
  { clave: "no_sweep_pct", rotulo: "Responsable con casos sin barrer, desde", unidad: "% de su carga", porDefecto: 0.5, proporcion: true },
  { clave: "daily_effective_diff_min", rotulo: "Diferencia diaria de efectivas, desde", unidad: "efectivas", porDefecto: 1 },
];

export type BorradorDeReglas = {
  automatica: boolean;
  respaldoNombre: boolean;
  duracionMinima: string;
  duracionMaxima: string;
  prioridad: string[];
  alertas: Record<ClaveDeAlerta, string>;
};

function texto(valor: number) {
  return Number.isFinite(valor) ? String(Math.round(valor * 1000) / 1000) : "";
}

export function borradorDeReglas(config: MonitoreoConfig): BorradorDeReglas {
  const perfil = config.monitoreo_profile;
  const alertas = {} as Record<ClaveDeAlerta, string>;
  for (const alerta of ALERTAS) {
    const crudo = Number(perfil?.alerts?.[alerta.clave]);
    const valor = Number.isFinite(crudo) ? crudo : alerta.porDefecto;
    alertas[alerta.clave] = texto(alerta.proporcion ? valor * 100 : valor);
  }
  return {
    automatica: perfil?.key_rules?.automatic_detection ?? true,
    respaldoNombre: perfil?.key_rules?.use_name_fallback ?? false,
    duracionMinima: texto(Number(config.min_duration_seconds)),
    duracionMaxima: texto(Number(config.max_duration_seconds)),
    prioridad: [...(perfil?.deduplication?.priority ?? [])],
    alertas,
  };
}

function numero(valor: string): number | null {
  const limpio = valor.trim().replace(",", ".");
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Lo que impide guardar, dicho para el equipo; vacío si se puede. */
export function problemasDelBorrador(borrador: BorradorDeReglas): string[] {
  const problemas: string[] = [];
  const minima = numero(borrador.duracionMinima);
  const maxima = numero(borrador.duracionMaxima);
  if (minima == null || maxima == null) problemas.push("La duración mínima y la máxima son números de segundos.");
  else if (minima >= maxima) problemas.push("La duración mínima debe ser menor que la máxima.");
  for (const alerta of ALERTAS) {
    const valor = numero(borrador.alertas[alerta.clave]);
    if (valor == null) problemas.push(`«${alerta.rotulo} ${alerta.unidad}» necesita un número.`);
    else if (alerta.proporcion && valor > 100) problemas.push(`«${alerta.rotulo} ${alerta.unidad}» va de 0 a 100.`);
  }
  return problemas;
}

/** La configuración con las reglas del borrador; el resto viaja como vino. */
export function configuracionConReglas(config: MonitoreoConfig, borrador: BorradorDeReglas): MonitoreoConfig {
  const perfil: MonitoreoProfile = config.monitoreo_profile;
  const alertas: Record<string, number> = { ...(perfil.alerts ?? {}) };
  for (const alerta of ALERTAS) {
    const valor = numero(borrador.alertas[alerta.clave]) ?? alerta.porDefecto;
    alertas[alerta.clave] = alerta.proporcion ? valor / 100 : Math.round(valor);
  }
  return {
    ...config,
    min_duration_seconds: numero(borrador.duracionMinima) ?? config.min_duration_seconds,
    max_duration_seconds: numero(borrador.duracionMaxima) ?? config.max_duration_seconds,
    monitoreo_profile: {
      ...perfil,
      key_rules: { ...perfil.key_rules, automatic_detection: borrador.automatica, use_name_fallback: borrador.respaldoNombre },
      deduplication: { ...perfil.deduplication, priority: [...borrador.prioridad] },
      alerts: alertas,
    },
  };
}

export function hayCambios(config: MonitoreoConfig, borrador: BorradorDeReglas) {
  return JSON.stringify(borradorDeReglas(config)) !== JSON.stringify(borrador);
}

/** Mueve un elemento de la prioridad una posición arriba (-1) o abajo (+1). */
export function mover(lista: readonly string[], indice: number, paso: -1 | 1): string[] {
  const destino = indice + paso;
  if (destino < 0 || destino >= lista.length) return [...lista];
  const copia = [...lista];
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}

function lista(valores: unknown): string[] {
  return Array.isArray(valores) ? valores.map((valor) => String(valor ?? "").trim()).filter(Boolean) : [];
}

function citar(valores: readonly string[]) {
  return valores.map((valor) => `«${valor}»`).join(" o ");
}

/** Las reglas que deciden qué cuenta como efectiva, en frases. */
export function frasesDeEfectiva(perfil: MonitoreoProfile | null | undefined): string[] {
  const frases: string[] = [];
  for (const regla of perfil?.rejection_rules ?? []) {
    if (regla.enabled === false) continue;
    const preguntas = lista(regla.question_patterns);
    const respuestas = lista(regla.rejection_answers);
    if (!preguntas.length || !respuestas.length) continue;
    const actor = String(regla.actor ?? "").trim();
    frases.push(`Si la pregunta ${citar(preguntas)} se responde ${citar(respuestas)}, la respuesta cuenta como rechazo${actor ? ` en ${actor}` : ""}.`);
  }
  const efectiva = perfil?.platform_effective_filter;
  if (efectiva?.enabled && efectiva.variable) {
    const valores = efectiva.value_label ? [efectiva.value_label] : lista(efectiva.values);
    frases.push(`Cuenta como efectiva la respuesta con ${efectiva.label || efectiva.variable}${valores.length ? ` igual a ${citar(valores)}` : ""}.`);
  }
  const prueba = perfil?.platform_test_filter;
  if (prueba?.enabled && prueba.variable) {
    const valores = prueba.value_label ? [prueba.value_label] : lista(prueba.values);
    frases.push(`Se excluyen como prueba las respuestas con ${prueba.label || prueba.variable}${valores.length ? ` igual a ${citar(valores)}` : ""}.`);
  }
  return frases;
}

/** Minutos de una duración en segundos, para leerla sin hacer la cuenta. */
export function enMinutos(segundos: string): string {
  const n = numero(segundos);
  if (n == null) return "";
  const minutos = n / 60;
  return `${minutos.toLocaleString("es-PE", { maximumFractionDigits: 1 })} min`;
}
