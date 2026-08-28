import { fechaDeAplicacion } from "./ritmoPorFacultad";

/**
 * El «hoy» del estudio: el último día con parte de campo.
 *
 * **No es `generated_at`.** Ese sello dice cuándo se calculó el tablero, o sea
 * el reloj de la máquina que lo abrió, y sobre un estudio reabierto o simulado
 * dice cualquier cosa. Medido sobre el proyecto simulado: el panel «Cursos-horario
 * vencidos sin aplicar» decía **«al 27 de agosto»** con el estudio sincronizado
 * al **12/09/2026**, y de ahí concluía «los 174 con fecha están por delante del
 * corte · 174 aún por venir» **con 78 ya aplicadas**.
 *
 * El módulo hermano `alertaDeAnticipacion` ya lo tenía resuelto y su comentario
 * lo dice: «con `Date.now()` un estudio de agosto abierto en septiembre saldría
 * entero [vencido]». `generated_at` tiene exactamente el mismo defecto por otra
 * puerta — **dos capas, dos lecturas de la misma regla**.
 *
 * Sin ningún parte no hay reloj de campo. Entonces se devuelve el sello del
 * tablero, que es lo único que hay, y **se declara** con `esDelCampo: false`
 * para que la superficie pueda decirlo en vez de afirmar un corte que no midió.
 */

type Fila = Readonly<Record<string, unknown>>;

export type CorteDelEstudio = {
  /** ISO `YYYY-MM-DD`, o `""` si no hay ni partes ni sello. */
  dia: string;
  /** `true` cuando sale de un parte de campo; `false` cuando es el sello del tablero. */
  esDelCampo: boolean;
};

export function corteDelEstudio(
  partes: ReadonlyArray<Fila>,
  generatedAt: unknown = "",
): CorteDelEstudio {
  let ultimo = "";
  for (const fila of partes) {
    const fecha = fechaDeAplicacion(
      (fila as { applied_at?: unknown; applied_date?: unknown }).applied_at
      ?? (fila as { applied_date?: unknown }).applied_date,
    );
    // Comparación de cadenas ISO: `2026-09-12` > `2026-09-07` sin parsear nada,
    // y sin arrastrar zonas horarias a una fecha que no las tiene.
    if (fecha && fecha > ultimo) ultimo = fecha;
  }
  if (ultimo) return { dia: ultimo, esDelCampo: true };
  return { dia: String(generatedAt ?? "").slice(0, 10), esDelCampo: false };
}
