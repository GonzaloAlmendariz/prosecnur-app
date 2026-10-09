// distribucionDeAplicadores.ts — el Sheets que leen los aplicadores, recordado
// en el proyecto, y si lo que dice sigue siendo el reparto vigente.
//
// S7 (loop estética-aulas-sheets, 2026-09-07). El día 1 de campo ese Sheets
// quedó viejo —85 citas vigentes contra 83 publicadas, 20 cambios de persona—
// y nada en pantalla lo decía: publicar no guardaba ni el id ni cuándo ni qué.
// Ahora el backend recuerda `distribucion_sheets` {id, url, updated_at,
// huella, citas} al publicar, y el tablero trae en `reparto.distribucion` la
// huella del reparto vigente. Comparar las dos huellas contesta la pregunta
// que hubo que responder a mano; el aviso dice causa y salida.
import type { TonoAviso } from "./avisoLibroImportado";
import { fmt } from "./kpisDeAulas";

/** El bloque `distribucion_sheets` de la config de aulas, tal como viaja. */
export type DistribucionSheetsRecordada = {
  spreadsheet_id?: string;
  url?: string;
  updated_at?: string;
  huella?: string;
  citas?: number;
} | null | undefined;

/** Una agendada a la que no va nadie, del bloque `reparto.distribucion`. */
export type AulaSinCita = { curso_horario?: string; fecha?: string; facultad?: string };

/** La huella del reparto vigente, del bloque `reparto.distribucion` del tablero. */
export type DistribucionVigente = {
  huella?: string;
  citas?: number;
  /** Cuántas aulas agendadas del rango no tienen a nadie asignado. */
  agendadas_sin_cita?: number;
  /** Y cuáles: un «faltan 6» sin los códigos obliga a cruzarlo otra vez a mano. */
  sin_cita?: ReadonlyArray<AulaSinCita>;
} | null | undefined;

export type EstadoDeDistribucion =
  | "nunca"
  | "vigente"
  | "cambiado"
  | "indeterminado"
  | "sin-cita";

export function enlaceDeDistribucion(d: DistribucionSheetsRecordada): string {
  const url = String(d?.url ?? "").trim();
  if (url) return url;
  const id = String(d?.spreadsheet_id ?? "").trim();
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : "";
}

function hace(iso: string | undefined): string {
  const valor = String(iso ?? "").trim();
  if (!valor) return "";
  const t = new Date(valor).getTime();
  if (Number.isNaN(t)) return "";
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 60) return `hace ${fmt(min)} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${fmt(h)} h`;
  return `hace ${fmt(Math.round(h / 24))} días`;
}

const citas = (n: number | undefined) => `${fmt(n ?? 0)} ${n === 1 ? "cita" : "citas"}`;

/**
 * Qué le pasa al Sheets de los aplicadores frente al reparto vigente.
 * Cada estado dice CAUSA y SALIDA (vara del loop: «los avisos tienen que
 * permitirnos hacer algo»).
 */
export function avisoDistribucion(
  recordado: DistribucionSheetsRecordada,
  vigente: DistribucionVigente,
): { estado: EstadoDeDistribucion; texto: string; tono: TonoAviso } {
  // **Un hueco manda sobre todo lo demás.** El Sheets puede estar al día y aun
  // así haber aulas agendadas a las que no va nadie: son dos preguntas y ésta
  // es la que deja a alguien sin ir. El 08/09 había seis y hubo que cruzarlas a
  // mano porque ninguna pantalla las decía; `no_cubiertos` no las veía, porque
  // sólo lista citas que ENTRARON al reparto y no hallaron a quién.
  const sinCita = Number(vigente?.agendadas_sin_cita ?? 0);
  if (Number.isFinite(sinCita) && sinCita > 0) {
    const cuales = (vigente?.sin_cita ?? [])
      .map((a) => `${String(a?.curso_horario ?? "").trim()}${a?.fecha ? ` (${a.fecha})` : ""}`)
      .filter((t) => t.trim().length > 0);
    return {
      estado: "sin-cita",
      texto:
        `${fmt(sinCita)} ${sinCita === 1 ? "aula agendada no tiene" : "aulas agendadas no tienen"} a nadie asignado` +
        `${cuales.length ? `: ${cuales.join(", ")}` : ""}. ` +
        "Asigna a alguien o añádelas a la hoja de los aplicadores con el aplicador en blanco.",
      tono: "atencion",
    };
  }
  if (!enlaceDeDistribucion(recordado)) {
    return {
      estado: "nunca",
      texto: "Todavía no se ha publicado la distribución a los aplicadores. Pega el enlace de su Sheets y publica: cada quien verá su semana.",
      tono: "atencion",
    };
  }
  const huellaPublicada = String(recordado?.huella ?? "").trim();
  const huellaVigente = String(vigente?.huella ?? "").trim();
  const cuando = hace(recordado?.updated_at);
  if (!huellaVigente || !huellaPublicada) {
    return {
      estado: "indeterminado",
      texto: `No se puede saber si el Sheets de los aplicadores sigue vigente (publicado ${cuando || "antes"}, sin huella para comparar). Publica de nuevo para dejarlo al día.`,
      tono: "atencion",
    };
  }
  if (huellaVigente === huellaPublicada) {
    return {
      estado: "vigente",
      texto: `El Sheets de los aplicadores está al día: ${citas(recordado?.citas)} publicadas ${cuando || ""}`.trim() + ".",
      tono: "ok",
    };
  }
  return {
    estado: "cambiado",
    texto:
      `El reparto cambió desde la última publicación (${cuando || "antes"}): ${citas(vigente?.citas)} ahora contra ${fmt(recordado?.citas ?? 0)} publicadas. ` +
      "Los aplicadores siguen leyendo el reparto viejo. Publica de nuevo desde aquí.",
    tono: "atencion",
  };
}

/**
 * El recibo tras publicar: qué se escribió, **qué NO** y que el enlace quedó
 * guardado.
 *
 * Desde que el documento lleva una pestaña por semana, publicar ya no es una
 * sola cosa: la semana que el coordinador está editando se RESPETA y no se
 * escribe. Este aviso sólo decía «N publicadas» —el total del reparto—, así que
 * una semana respetada era invisible y el número prometía más de lo que se
 * había escrito. Callar lo que no se hizo es la forma más cara de declarar
 * éxito.
 */
export function avisoDistribucionPublicada(res: {
  citas?: number;
  url?: string;
  hojas?: Array<{ hoja?: string; accion?: string; filas?: number }>;
}): { texto: string; tono: TonoAviso } {
  const n = Number(res.citas);
  const cuantas = Number.isFinite(n) ? `${citas(n)} publicadas` : "publicada";
  const hojas = res.hojas ?? [];
  const respetadas = hojas.filter((h) => String(h?.accion ?? "") === "respetada");
  const escritas = hojas.filter((h) => String(h?.accion ?? "") === "actualizada");

  const frases = [`Distribución de los aplicadores ${cuantas}.`];
  if (escritas.length) {
    frases.push(`Se escribió ${escritas.map((h) => `«${h.hoja}»`).join(" y ")}.`);
  }
  if (respetadas.length) {
    // Con su motivo, que es lo que distingue «no se pudo» de «no se debía».
    frases.push(
      `${respetadas.map((h) => `«${h.hoja}»`).join(" y ")} ${respetadas.length === 1 ? "no se tocó" : "no se tocaron"}: ` +
        "ya tiene citas escritas y ahí manda el equipo.",
    );
  }
  frases.push("El enlace quedó guardado: la próxima publicación lo usa sin pedirlo.");
  return {
    texto: frases.join(" "),
    // Respetar una semana es lo correcto, no un problema: el tono no sube.
    tono: "ok",
  };
}
