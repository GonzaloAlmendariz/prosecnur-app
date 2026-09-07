import type { TonoAviso } from "./avisoLibroImportado";
import { fmt } from "./kpisDeAulas";

/**
 * Qué pasó con cada hoja al publicar el libro en el Sheets del operativo.
 *
 * La regla de dueño —«Aulas Agendadas» y «Aulas Aplicadas (Campo)» son del
 * equipo; «Base de control» es de la app— la cumple el motor, pero si la UI no
 * la cuenta, una hoja `respetada` se lee como una hoja que falló. Por eso
 * `respetada` lleva SIEMPRE su motivo: es la decisión de Gonzalo hecha
 * visible, no una omisión.
 *
 * La lista de acciones es ABIERTA a propósito: una acción que este código no
 * conoce viaja con su nombre en vez de tragarse la hoja —la lección más cara
 * del repo son las listas cerradas que descartan en silencio—.
 *
 * Tercera pieza de la familia: generar dice qué salió, importar qué entró,
 * publicar qué quedó escrito (y qué se respetó).
 */
export type HojaDelLibroPublicada = {
  hoja?: string;
  accion?: string;
  /** Filas de DATOS (sin cabeceras); en `respetada`, las que el equipo ya tiene. */
  filas?: number | null;
};

function conFilas(filas: number | null | undefined): string {
  const n = Number(filas);
  if (!Number.isFinite(n)) return "";
  return n === 1 ? " (1 fila)" : ` (${fmt(n)} filas)`;
}

// Exportada porque `avisoConversacion` cuenta la mitad publicada del sync con
// LA MISMA voz: dos redacciones de la regla de dueño divergirían tarde o
// temprano (la lección de «dos capas, dos lecturas de la misma regla»).
export function fraseDeHoja(h: HojaDelLibroPublicada): string {
  const nombre = String(h.hoja ?? "").trim() || "Una hoja sin nombre";
  const accion = String(h.accion ?? "").trim();
  switch (accion) {
    case "actualizada":
      return `«${nombre}» actualizada${conFilas(h.filas)}`;
    case "sembrada":
      // Sólo pasa cuando la pestaña no existía o estaba vacía: la primera y
      // única vez que la app escribe en una hoja que no es suya.
      return `«${nombre}» sembrada${conFilas(h.filas)}`;
    case "sin_cambios":
      return `«${nombre}» sin cambios`;
    case "respetada":
      return `«${nombre}» respetada${conFilas(h.filas)}: la llena el equipo, no la app`;
    default:
      return accion
        ? `«${nombre}» ${accion}${conFilas(h.filas)}`
        : `«${nombre}» sin acción declarada`;
  }
}

/**
 * Lo que publicar LEYÓ del equipo antes de escribir (A1, loop 2026-09-07).
 *
 * Desde `732c4221` el motor importa las hojas del equipo en el mismo acto de
 * publicar, y el recibo lo cuenta: `ok` con su `resumen`, `error` cuando el
 * Sheets no se dejó leer (se publica igual, con lo que la sesión tenía), u
 * `omitida` cuando quien llamó ya había leído. El día 1 de campo el encargado
 * llevaba siete partes tecleados y la Base de control publicada enseñaba uno;
 * nada en pantalla decía si se había leído. Esta frase es esa señal.
 */
export type LecturaPreviaDelLibro = {
  ok?: boolean;
  omitida?: boolean;
  error?: string;
  resumen?: {
    unidades?: number | null;
    partes_de_campo?: number | null;
    filas_de_control?: number | null;
  } | null;
};

function cuenta(n: number | null | undefined, uno: string, varios: string): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return `0 ${varios}`;
  return v === 1 ? `1 ${uno}` : `${fmt(v)} ${varios}`;
}

/**
 * La frase de la lectura previa, o vacía cuando no hay nada que contar
 * (omitida, o un recibo anterior a esta señal). Cada aviso dice causa y
 * salida: si falló, la salida es «Sincronizar campo» cuando el enlace responda.
 */
export function fraseDeLecturaPrevia(lp: LecturaPreviaDelLibro | null | undefined): {
  texto: string;
  tono: TonoAviso;
} {
  if (!lp || lp.omitida) return { texto: "", tono: "ok" };
  if (lp.ok) {
    const r = lp.resumen ?? {};
    return {
      texto:
        `Antes de escribir se leyó lo del equipo: ${cuenta(r.partes_de_campo, "parte de campo", "partes de campo")}` +
        ` y ${cuenta(r.filas_de_control, "fila de control", "filas de control")}.`,
      tono: "ok",
    };
  }
  const causa = String(lp.error ?? "").trim();
  return {
    texto:
      `No se pudo leer el Sheets antes de publicar${causa ? ` (${causa})` : ""}: ` +
      "se publicó con lo que la app ya tenía. Para traer lo que el equipo tecleó, usa Sincronizar campo cuando el enlace responda.",
    tono: "atencion",
  };
}

export function avisoLibroPublicado(res: {
  hojas?: HojaDelLibroPublicada[] | null;
  destino_guardado?: boolean;
  lectura_previa?: LecturaPreviaDelLibro | null;
}): { texto: string; tono: TonoAviso } {
  const hojas = res.hojas ?? [];
  if (!hojas.length) {
    // Sin resumen no se finge un verde: algo se publicó pero no se sabe qué.
    return {
      texto: "La publicación terminó pero no dijo qué pasó con cada hoja.",
      tono: "atencion",
    };
  }
  const lectura = fraseDeLecturaPrevia(res.lectura_previa);
  const partes = [
    ...(lectura.texto ? [lectura.texto] : []),
    `Libro publicado: ${hojas.map(fraseDeHoja).join(" · ")}.`,
  ];
  if (res.destino_guardado) {
    partes.push("El enlace quedó guardado: leer y publicar lo usarán sin volver a pedirlo.");
  }
  return { texto: partes.join(" "), tono: lectura.tono };
}
