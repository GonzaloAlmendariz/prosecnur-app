// avisoAsistenciaSinParte.ts — lo que sólo sabe quien estuvo en el salón.
//
// A3 (loop estética-aulas-sheets, 2026-09-07). En la «Base de control»,
// ALUMNOS EN AULA (`observed_students`) es la única columna del bloque de campo
// que la plataforma no puede derivar: cuántas personas había en el aula sólo
// lo sabe quien la aplicó, y el generador del libro lo deja vacío a propósito
// (`carga_aulas_libro_generar.R`: «derivarlo sería inventarlo»). De esa cifra
// salen % ASISTENCIA y ALUMNOS QUE NO RESPONDIERON. Si el encargado deja de
// rendir el parte, las tres columnas se apagan en silencio.
//
// Medido el día 1 de campo con el estado real: 9 aulas en la Base de control,
// 7 partes; 2 aulas sin parte (CH 7, CH 55) y 6 con parte registrado que el
// libro leído todavía no traía, porque la fila se leyó antes de publicarlo.
// Son dos causas con dos salidas, y el aviso las dice por separado y nombra
// las aulas (vara del loop: «los avisos tienen que permitirnos hacer algo»).
import type { TonoAviso } from "./avisoLibroImportado";
import { fmt } from "./kpisDeAulas";

type Fila = Record<string, unknown>;

const codigo = (fila: Fila): string => String(fila.operational_code ?? fila.codigo ?? "").trim();
const clave = (code: string): string => code.replace(/\s+/g, " ").trim().toUpperCase();

/** Un conteo real: número finito. «NA», vacío o texto no cuentan. */
const tieneCifra = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string" && (!v.trim() || v.trim().toUpperCase() === "NA")) return false;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0;
};

/** Hasta cinco códigos y «y N más»: el aviso nombra, no enumera. */
function nombres(codes: string[]): string {
  const vistos = codes.slice(0, 5).join(", ");
  const resto = codes.length - 5;
  return resto > 0 ? `${vistos} y ${fmt(resto)} más` : vistos;
}

export type AvisoAsistenciaSinParte = {
  texto: string;
  tono: TonoAviso;
  /** Cursos-horario de la Base de control sin ningún parte de campo registrado. */
  sinParte: string[];
  /** Cursos-horario con parte registrado cuya fila leída todavía no trae ALUMNOS EN AULA. */
  parteNoLeido: string[];
};

export function avisoAsistenciaSinParte(
  filas: ReadonlyArray<Fila> | null | undefined,
  partes: ReadonlyArray<Fila> | null | undefined,
): AvisoAsistenciaSinParte {
  const conParte = new Set(
    (partes ?? [])
      .filter((p) => tieneCifra(p.observed_students))
      .map((p) => clave(codigo(p))),
  );
  const sinParte: string[] = [];
  const parteNoLeido: string[] = [];
  for (const fila of filas ?? []) {
    const code = codigo(fila);
    if (!code) continue;
    if (tieneCifra(fila.observed_students)) continue;
    if (conParte.has(clave(code))) parteNoLeido.push(code);
    else sinParte.push(code);
  }
  if (!sinParte.length && !parteNoLeido.length) {
    return { texto: "", tono: "ok", sinParte, parteNoLeido };
  }
  const frases: string[] = [];
  if (sinParte.length) {
    const n = sinParte.length;
    frases.push(
      // La unidad se llama curso-horario (ADR 0060); «aula» aquí es sólo el
      // salón y el título de la columna del libro.
      `${fmt(n)} ${n === 1 ? "curso-horario aplicado" : "cursos-horario aplicados"} sin parte de campo (${nombres(sinParte)}): ` +
        `${n === 1 ? "en él" : "en ellos"} ALUMNOS EN AULA, % ASISTENCIA y ALUMNOS QUE NO RESPONDIERON quedan vacíos, ` +
        "porque cuántos había en el salón sólo lo sabe quien estuvo. Se llenan en Registro de campo o pidiéndole el parte al aplicador.",
    );
  }
  if (parteNoLeido.length) {
    const n = parteNoLeido.length;
    frases.push(
      `${sinParte.length ? "Otras " : ""}${fmt(n)} ya ${n === 1 ? "tiene" : "tienen"} parte (${nombres(parteNoLeido)}) ` +
        "pero la fila leída del libro es anterior: la próxima publicación las escribe.",
    );
  }
  return { texto: frases.join(" "), tono: "atencion", sinParte, parteNoLeido };
}
