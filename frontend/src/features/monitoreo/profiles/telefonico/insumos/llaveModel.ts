/**
 * Insumos › Llave y filtros del telefónico: con qué columna cruza cada
 * respuesta con la hoja y cómo cruzaron las efectivas de este corte.
 *
 * La llave se lee, no se edita: las columnas candidatas viven en
 * `monitoreo_profile.key_rules` y ninguna superficie de la app las cambia hoy
 * (pregunta en el plan). El cruce de cada efectiva sale de `respuestasModel`,
 * el mismo que usa Control › Respuestas: exacta, por sus dígitos o no cruza.
 */

import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import type { EnvioEfectivo, Respuestas } from "../control/respuestasModel";
import { filasDeBloque } from "../navegacion/bloques";

function texto(valor: unknown) {
  return valor == null ? "" : String(valor).trim();
}

function unicos(valores: readonly string[]) {
  return [...new Set(valores.map(texto).filter(Boolean))];
}

export type LlaveDeclarada = {
  /** Columnas que se prueban en la hoja, en orden. */
  base: string[];
  /** Columnas que se prueban en las respuestas, en orden; primero la que declara la encuesta. */
  respuestas: string[];
  automatica: boolean;
};

export function llaveDeclarada(state: MonitoreoState | null | undefined): LlaveDeclarada {
  const reglas = state?.config?.monitoreo_profile?.key_rules;
  const declaradas = (state?.sources ?? [])
    .filter((fuente) => fuente.enabled && fuente.kind === "kobo")
    .map((fuente) => texto(fuente.declared_person_code_var));
  return {
    base: unicos(reglas?.universe_fields ?? []),
    respuestas: unicos([...declaradas, ...(reglas?.response_fields ?? [])]),
    automatica: reglas?.automatic_detection !== false,
  };
}

export function ejemplosDeLlave(reports: MonitoreoAcreditacionReports | null | undefined) {
  const base = filasDeBloque(reports, ["comparacion_codpulso", "campo_vs_plataforma_codpulso"])
    .filter((fila) => texto(fila["Estado telefónico"] ?? fila["Estado telefonico"]) !== "Fuera de base")
    .map((fila) => texto(fila.CodPulso))
    .filter(Boolean);
  const respuestas = filasDeBloque(reports, ["control_tiempo_kobo", "tiempos_kobo", "validacion_tiempos"])
    .map((fila) => texto(fila.CodPulso))
    .filter(Boolean);
  return {
    base: unicos(base).slice(0, 3),
    respuestas: unicos(respuestas).slice(0, 3),
    distintosEnLaBase: unicos(base).length,
    filasEnLaBase: base.length,
  };
}

/** Con menos filas, un código repetido puede ser un caso con varios envíos. */
export const FILAS_PARA_JUZGAR_LA_LLAVE = 5;

/**
 * Una llave que da el mismo código a todas las filas no está leyendo un
 * identificador: el cruce casaría cualquier envío con cualquier caso.
 */
export function llaveSinIdentificador(ejemplos: { distintosEnLaBase: number; filasEnLaBase: number }) {
  return ejemplos.filasEnLaBase >= FILAS_PARA_JUZGAR_LA_LLAVE && ejemplos.distintosEnLaBase === 1;
}

export type CruceDeLlave = {
  exacta: number;
  normalizada: number;
  noCruza: number;
  total: number;
  cruzan: number;
  /** Proporción de 0 a 1, o null sin envíos. */
  tasa: number | null;
};

export function cruceDeLlave(respuestas: Pick<Respuestas, "envios">): CruceDeLlave {
  const contar = (llave: EnvioEfectivo["llave"]) => respuestas.envios.filter((envio) => envio.llave === llave).length;
  const exacta = contar("exacta");
  const normalizada = contar("normalizada");
  const noCruza = contar("no-cruza");
  const total = respuestas.envios.length;
  return { exacta, normalizada, noCruza, total, cruzan: exacta + normalizada, tasa: total ? (exacta + normalizada) / total : null };
}

/** Umbral del aviso `cruce_llave_bajo` del motor (`monitoreo_avisos_telefonico.R`). */
export const UMBRAL_DE_CRUCE = 0.5;

/** Lo que no cruza primero, luego lo que cruzó por sus dígitos; dentro, por código. */
export function enviosPorLlave(envios: readonly EnvioEfectivo[]): EnvioEfectivo[] {
  const orden: Record<EnvioEfectivo["llave"], number> = { "no-cruza": 0, normalizada: 1, exacta: 2 };
  return [...envios].sort((a, b) => orden[a.llave] - orden[b.llave] || a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
}

/** El filtro de envíos de prueba, dicho en una frase; null si no está encendido. */
export function filtroDePrueba(state: MonitoreoState | null | undefined): string | null {
  const filtro = state?.config?.monitoreo_profile?.platform_test_filter;
  if (!filtro?.enabled || !texto(filtro.variable)) return null;
  const valores = unicos(filtro.values ?? []);
  const nombre = texto(filtro.label) || texto(filtro.variable);
  return valores.length
    ? `Quedan fuera los envíos de prueba: ${nombre}, ${valores.length === 1 ? "valor" : "valores"} ${valores.join(" o ")}.`
    : `Quedan fuera los envíos de prueba según ${nombre}.`;
}

/** Lo que no cruzó tal cual, con cómo se leyó: «se lee PDM1218» o «no cruza con ningún caso». */
export function porRevisarEnLaLlave(envios: readonly EnvioEfectivo[]) {
  return enviosPorLlave(envios.filter((envio) => envio.llave !== "exacta")).map((envio) => ({
    codigo: envio.codigo,
    llave: envio.llave,
    lectura: envio.llave === "normalizada" && envio.codigoEnHoja ? `se lee ${envio.codigoEnHoja}` : "no cruza con ningún caso de la hoja",
    fecha: envio.fecha,
  }));
}
