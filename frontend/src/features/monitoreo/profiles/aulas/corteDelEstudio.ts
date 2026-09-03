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
  // El sello del tablero viene en UTC («…T03:16:00Z»): rebanarle los diez
  // primeros caracteres devolvía la fecha de LONDRES, y desde las ~7 pm de
  // Lima el corte decía MAÑANA — cada «qué toca» corría contra un día que el
  // campo no vivió y las aulas vencían un día antes (visto en vivo 2026-09-02
  // 22:16: «CORTE 3/9/2026»). El instante se convierte al día LOCAL del
  // navegador, que es donde vive el operativo; lo no parseable conserva la
  // rebanada de siempre.
  const crudo = String(generatedAt ?? "");
  // Solo el INSTANTE (con hora) se convierte: una fecha sin hora no tiene
  // zona que arrastrar — y `new Date("2026-09-02")` la parsearía como
  // medianoche UTC, retrocediéndola un día en Lima: el error espejo.
  const esInstante = /\d{2}:\d{2}/.test(crudo);
  const instante = esInstante ? new Date(crudo) : new Date(NaN);
  if (Number.isNaN(instante.getTime())) return { dia: crudo.slice(0, 10), esDelCampo: false };
  const dia = `${instante.getFullYear()}-${String(instante.getMonth() + 1).padStart(2, "0")}-${
    String(instante.getDate()).padStart(2, "0")}`;
  return { dia, esDelCampo: false };
}
