/**
 * Insumos › Públicos (ficha I1): quiénes responden y contra qué padrón.
 * Modelo puro sobre las fuentes del proyecto y el estado de cuotas
 * (`/api/monitoreo/cuotas`: personas por público y variables elegibles).
 * Lo que la app no recibe —las columnas del padrón con su completitud— no se
 * dibuja.
 */

import type { MonitoreoSource } from "../../../../../api/client";
import type { MonitoreoCuotaPublico } from "../../../../../api/monitoreoCuotas";
import { actorDeLaFuente, claveDeActor } from "../../../fuentes/rosterDeActores";
import { acreditacionSourceChannel } from "../AcreditacionSourcesModel";
import { acreditacionChannelLabel } from "../fuentes/canales";

export type CeldaDeCanal = { canal: string; fuentes: number; servicios: string[] };

export type PadronDelPublico = {
  publico: string;
  padrones: MonitoreoSource[];
  encuestas: MonitoreoSource[];
  barridos: MonitoreoSource[];
  canales: string[];
  personas: number | null;
  variables: Array<{ variable: string; categorias: number | null }>;
};

const SERVICIO: Record<string, string> = { google_sheets: "Google Sheets", surveymonkey: "SurveyMonkey", kobo: "Kobo" };

/**
 * El nombre de una fuente tal como se muestra: sin el prefijo de papel que lleva
 * la etiqueta guardada («Universo · Profesores» -> «Profesores»). La etiqueta no se
 * toca porque el motor lee de ella el público; lo que cambia es la lectura.
 */
export function nombreVisibleDeFuente(fuente: MonitoreoSource): string {
  const crudo = [fuente.label, fuente.survey_title, fuente.id].map((valor) => String(valor ?? "").trim()).find(Boolean) ?? "";
  // Sólo se quita el papel del inicio; el resto del nombre queda tal cual se escribió.
  const papel = crudo.match(/^(universo|padr[oó]n|base)\s+[·•|]\s+/i);
  const resto = papel ? crudo.slice(papel[0].length).trim() : "";
  return resto || crudo;
}

/** ¿El nombre visible de la fuente no dice más que el público? Entonces basta el servicio. */
export function fuenteRepiteAlPublico(fuente: MonitoreoSource, publico: string): boolean {
  const normal = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return normal(nombreVisibleDeFuente(fuente)) === normal(publico);
}

export function servicioDe(fuente: MonitoreoSource) {
  return SERVICIO[String(fuente.kind ?? "")] ?? "Fuente";
}

/** El canal con que entra una fuente de respuestas, dicho como lo dice el estudio. */
export function canalDeFuente(fuente: MonitoreoSource): string {
  const crudo = acreditacionSourceChannel(fuente);
  const rotulo = crudo ? acreditacionChannelLabel(crudo) : "";
  return rotulo && rotulo !== "Sin canal" ? rotulo : crudo || "Sin canal";
}

export function padronesPorPublico(
  publicos: readonly string[],
  fuentes: readonly MonitoreoSource[],
  cuotas: readonly MonitoreoCuotaPublico[],
): PadronDelPublico[] {
  return publicos.map((publico) => {
    const clave = claveDeActor(publico);
    const propias = fuentes.filter((fuente) => fuente.enabled !== false && claveDeActor(actorDeLaFuente(fuente)) === clave);
    const encuestas = propias.filter((fuente) => String(fuente.role ?? "") === "respuestas");
    const cuota = cuotas.find((item) => claveDeActor(item.actor) === clave);
    return {
      publico,
      padrones: propias.filter((fuente) => String(fuente.role ?? "") === "universo"),
      encuestas,
      barridos: propias.filter((fuente) => String(fuente.role ?? "") === "barrido"),
      canales: [...new Set(encuestas.map(canalDeFuente))],
      personas: cuota?.universo ?? null,
      variables: cuota?.variables ?? [],
    };
  });
}

/** Columnas de la matriz «Por dónde entra cada público»: el barrido y cada canal visto. */
export function canalesDeLaMatriz(filas: readonly PadronDelPublico[]): string[] {
  const canales = [...new Set(filas.flatMap((fila) => fila.canales))].sort((a, b) => a.localeCompare(b, "es"));
  return filas.some((fila) => fila.barridos.length) ? ["Barrido", ...canales] : canales;
}

export function celda(fila: PadronDelPublico, canal: string): CeldaDeCanal {
  const fuentes = canal === "Barrido" ? fila.barridos : fila.encuestas.filter((fuente) => canalDeFuente(fuente) === canal);
  return { canal, fuentes: fuentes.length, servicios: [...new Set(fuentes.map(servicioDe))] };
}
