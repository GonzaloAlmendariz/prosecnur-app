/**
 * Insumos › Fuentes (ficha I2): qué está conectado y por qué canal entra.
 * Maestro de fuentes agrupadas por público y detalle con sus recopiladores.
 * Las respuestas y efectivas de cada recopilador salen del cruce
 * (`internal_queries.totals.collector`), no del metadato de la plataforma, que
 * se desactualiza (H3). Puro y con test.
 */

import type { MonitoreoInternalQueryTotal, MonitoreoLinkCollector, MonitoreoSource } from "../../../../../api/client";
import { nombreDeFuente, servicioDeFuente } from "../../../fuentes/enlacesDeFuente";
import { acreditacionCollectorPlatformName, acreditacionCollectorsForSource, acreditacionSourceActor, acreditacionSourceResponseCount, type AcreditacionCollectorRow } from "../AcreditacionSourcesModel";
import { acreditacionChannelLabel } from "../fuentes/canales";
import { normalizeSourceMatch } from "../formato";

export type PapelDeFuente = "padron" | "respuestas" | "barrido";

const PAPEL: Record<PapelDeFuente, string> = { padron: "Padrón", respuestas: "Respuestas", barrido: "Barrido" };

export type FuenteDelMaestro = {
  id: string;
  nombre: string;
  servicio: string;
  papel: PapelDeFuente;
  papelRotulo: string;
  publico: string;
  activa: boolean;
  filas: number | null;
  ultimaLectura: string | null;
  fuente: MonitoreoSource;
};

export type GrupoDeFuentes = { publico: string; fuentes: FuenteDelMaestro[] };

export type RecopiladorDelDetalle = {
  fila: AcreditacionCollectorRow;
  nombre: string;
  tipo: string;
  canal: string;
  incluido: boolean;
  respuestas: number | null;
  efectivas: number | null;
  /** El mismo nombre aparece en otra encuesta: el cruce no los distingue. */
  ambiguo: boolean;
};

/** Cómo se llama el tipo de recopilador de SurveyMonkey, dicho para el equipo. */
export function tipoDeRecopilador(value: string) {
  const normalized = normalizeSourceMatch(value);
  if (normalized === "email") return "Envío por correo";
  if (normalized === "weblink" || normalized === "web_link" || normalized === "web link") return "Link abierto";
  if (normalized === "sms") return "SMS";
  return value || "Enlace";
}

export function papelDe(fuente: MonitoreoSource): PapelDeFuente {
  if (fuente.role === "universo") return "padron";
  if (fuente.role === "barrido") return "barrido";
  return "respuestas";
}

const ORDEN_DE_PAPEL: Record<PapelDeFuente, number> = { padron: 0, respuestas: 1, barrido: 2 };

export function fuentesPorPublico(fuentes: readonly MonitoreoSource[], recopiladores: MonitoreoLinkCollector[] = []): GrupoDeFuentes[] {
  const grupos = new Map<string, FuenteDelMaestro[]>();
  for (const fuente of fuentes) {
    const papel = papelDe(fuente);
    const publico = acreditacionSourceActor(fuente) || "Sin público";
    const leidas = Math.max(Number(fuente.sync_cursor?.fetched_count) || 0, Number(fuente.sync_cursor?.remote_total) || 0);
    const filas = papel === "respuestas" ? acreditacionSourceResponseCount(fuente, recopiladores) : leidas;
    const item: FuenteDelMaestro = {
      id: fuente.id,
      nombre: nombreDeFuente(fuente),
      servicio: servicioDeFuente(fuente),
      papel,
      papelRotulo: PAPEL[papel],
      publico,
      activa: fuente.enabled !== false,
      filas: filas > 0 ? filas : null,
      ultimaLectura: fuente.last_sync_at || null,
      fuente,
    };
    grupos.set(publico, [...(grupos.get(publico) ?? []), item]);
  }
  return [...grupos]
    .map(([publico, lista]) => ({
      publico,
      fuentes: lista.sort((a, b) => ORDEN_DE_PAPEL[a.papel] - ORDEN_DE_PAPEL[b.papel] || a.nombre.localeCompare(b.nombre, "es")),
    }))
    .sort((a, b) => Number(a.publico === "Sin público") - Number(b.publico === "Sin público") || a.publico.localeCompare(b.publico, "es"));
}

/** Los recopiladores con nombre en la plataforma, con sus cifras del cruce. */
export function recopiladoresDeLaFuente(
  fuente: MonitoreoSource,
  borrador: MonitoreoLinkCollector[],
  totales: readonly MonitoreoInternalQueryTotal[] | null,
  todasLasFuentes: readonly MonitoreoSource[],
): RecopiladorDelDetalle[] {
  const filas = acreditacionCollectorsForSource(fuente, borrador).filter((fila) => fila.hasPlatformMetadata);
  const porNombre = new Map<string, MonitoreoInternalQueryTotal>();
  for (const total of totales ?? []) {
    const clave = normalizeSourceMatch(total.collector);
    if (clave) porNombre.set(clave, total);
  }
  const vecesDelNombre = new Map<string, number>();
  for (const otra of todasLasFuentes) {
    for (const recopilador of otra.collectors ?? []) {
      const clave = normalizeSourceMatch(acreditacionCollectorPlatformName(recopilador));
      if (clave) vecesDelNombre.set(clave, (vecesDelNombre.get(clave) ?? 0) + 1);
    }
  }
  return filas.map((fila) => {
    const claves = [fila.platformName, fila.alias].map(normalizeSourceMatch).filter(Boolean);
    const ambiguo = claves.some((clave) => (vecesDelNombre.get(clave) ?? 0) > 1);
    const total = ambiguo || !totales ? undefined : claves.map((clave) => porNombre.get(clave)).find(Boolean);
    return {
      fila,
      nombre: fila.alias && fila.alias !== fila.platformName ? fila.alias : fila.platformName,
      tipo: tipoDeRecopilador(fila.collectorType),
      canal: fila.channel ? acreditacionChannelLabel(fila.channel) : "Sin canal",
      incluido: fila.enabled,
      respuestas: totales && !ambiguo ? total?.total ?? 0 : null,
      efectivas: totales && !ambiguo ? total?.efectivas ?? 0 : null,
      ambiguo,
    };
  });
}

/** Firma del borrador para saber si hay algo sin guardar. */
export function firmaDeRecopiladores(lista: readonly MonitoreoLinkCollector[]) {
  return lista
    .map((item) => `${item.source_id}:${item.collector_id}:${item.enabled}:${item.collector_name}:${item.channel}:${item.operational_use}`)
    .sort()
    .join("|");
}
