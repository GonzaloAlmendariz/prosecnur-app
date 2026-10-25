import type { TonoToast } from "../../../components/toasterStore";

/**
 * El recibo de «Actualizar» (L25 y §2b): un aviso no bloqueante que dice qué se
 * trajo de cada fuente y si se recalculó. Se arma con lo que devuelve el job
 * —`sync_summary` y `errors` de `/api/monitoreo/sync`, `n_rows` del job de
 * hojas—, no con lo que la interfaz supone que pasó.
 *
 * En una fuente incremental `rows` son las filas nuevas; en una lectura
 * completa, todas las que se leyeron. El recibo dice cuál de las dos es.
 */

export type ReciboDelSync = { tono: TonoToast; mensaje: string; detalle?: string };

type FilaDelResumen = { etiqueta: string; filas: number | null; incremental: boolean };
type ErrorDeFuente = { etiqueta: string };

function miles(n: number) {
  // Agrupación es-PE a mano («1,009»): el locale sin ICU de Node la cambia.
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function filasDelResumen(crudo: unknown): FilaDelResumen[] {
  if (!crudo || typeof crudo !== "object") return [];
  const entradas = Array.isArray(crudo) ? crudo : Object.values(crudo as Record<string, unknown>);
  return entradas.flatMap((entrada) => {
    if (!entrada || typeof entrada !== "object") return [];
    const raw = entrada as Record<string, unknown>;
    const filas = Number(raw.rows);
    return [{
      etiqueta: texto(raw.source_label) || texto(raw.source_id) || "Fuente",
      filas: Number.isFinite(filas) ? filas : null,
      incremental: texto(raw.mode) === "incremental",
    }];
  });
}

function erroresDelResultado(crudo: unknown): ErrorDeFuente[] {
  if (!Array.isArray(crudo)) return [];
  return crudo.flatMap((entrada) => {
    if (!entrada || typeof entrada !== "object") return [];
    const raw = entrada as Record<string, unknown>;
    return [{ etiqueta: texto(raw.source_label) || texto(raw.source_id) || "Una fuente" }];
  });
}

function lineaDeFila(fila: FilaDelResumen) {
  if (fila.filas == null) return `${fila.etiqueta}: leída`;
  if (fila.incremental) {
    if (fila.filas === 0) return `${fila.etiqueta}: sin nuevas`;
    return `${fila.etiqueta}: ${miles(fila.filas)} ${fila.filas === 1 ? "nueva" : "nuevas"}`;
  }
  return `${fila.etiqueta}: ${miles(fila.filas)} ${fila.filas === 1 ? "leída" : "leídas"}`;
}

/** Recibo de `/api/monitoreo/sync`. `recalculo` dice si la relectura del estado funcionó. */
export function reciboDeSync(resultado: unknown, recalculo: { ok: true } | { ok: false; mensaje: string }): ReciboDelSync {
  const raw = resultado && typeof resultado === "object" ? resultado as Record<string, unknown> : {};
  const filas = filasDelResumen(raw.sync_summary);
  const errores = erroresDelResultado(raw.errors);
  const partes = [
    ...filas.map(lineaDeFila),
    ...errores.map((error) => `${error.etiqueta}: falló`),
  ];
  if (!filas.length && errores.length) {
    return { tono: "error", mensaje: "No se pudo actualizar", detalle: partes.join(" · ") };
  }
  if (!recalculo.ok) {
    return { tono: "error", mensaje: "Se trajo, pero falló el recálculo", detalle: [...partes, recalculo.mensaje].filter(Boolean).join(" · ") };
  }
  partes.push("Recalculado");
  return errores.length
    ? { tono: "aviso", mensaje: "Actualizado en parte", detalle: partes.join(" · ") }
    : { tono: "exito", mensaje: "Actualizado", detalle: partes.join(" · ") };
}

/** Recibo del job de hojas (`/api/monitoreo/sheets/sync`), que sólo devuelve el total. */
export function reciboDeHojas(resultado: unknown, cuantas: number, recalculo: { ok: true } | { ok: false; mensaje: string }): ReciboDelSync {
  const raw = resultado && typeof resultado === "object" ? resultado as Record<string, unknown> : {};
  const filas = Number(raw.n_rows);
  const hojas = cuantas === 1 ? "1 hoja de Sheets" : `${cuantas} hojas de Sheets`;
  const leidas = Number.isFinite(filas) ? `${hojas}: ${miles(filas)} registros` : hojas;
  if (!recalculo.ok) {
    return { tono: "error", mensaje: "Se trajo, pero falló el recálculo", detalle: [leidas, recalculo.mensaje].filter(Boolean).join(" · ") };
  }
  return { tono: "exito", mensaje: "Actualizado", detalle: `${leidas} · Recalculado` };
}

export function reciboDeRecalcular(recalculo: { ok: true } | { ok: false; mensaje: string }): ReciboDelSync {
  return recalculo.ok
    ? { tono: "exito", mensaje: "Tablero recalculado", detalle: "Sin traer nada" }
    : { tono: "error", mensaje: "No se pudo recalcular", detalle: recalculo.mensaje };
}

export function reciboDeFallo(mensaje: string): ReciboDelSync {
  return { tono: "error", mensaje: "No se pudo actualizar", detalle: mensaje };
}
