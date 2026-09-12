import type { MonitoreoAulasLibroConversacion } from "../../../../api/monitoreo";
import type { TonoAviso } from "./avisoLibroImportado";
import { fraseDeHoja } from "./avisoLibroPublicado";

/**
 * Qué cuenta el sync cuando conversó con el Sheets del operativo (unidad B7).
 *
 * Cuarta pieza de la familia: generar dice qué salió, importar qué entró,
 * publicar qué quedó escrito — conversar cuenta el ciclo entero en una línea,
 * porque las dos mitades pasan dentro del mismo Recargar y sin aviso nadie
 * sabe que corrieron.
 *
 * `null` cuando no hay bloque: sin destino recordado la conversación no
 * participa y el sync se comunica exactamente como siempre — cero ruido nuevo.
 *
 * Motivos y acciones son listas ABIERTAS: lo desconocido viaja con su nombre
 * en vez de tragarse el resultado (la lección más cara del repo son las listas
 * cerradas que descartan en silencio).
 */

type Leido = NonNullable<MonitoreoAulasLibroConversacion["leido"]>;

/** La mitad leída en una frase: cuántas partes del equipo entraron. */
function partesDelEquipo(leido: Leido | null | undefined): string {
  const n = Number(leido?.resumen?.partes_de_campo ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "sin partes nuevas del equipo";
  return n === 1 ? "1 parte del equipo entró" : `${n} partes del equipo entraron`;
}

/** Cierra la frase sin duplicar el punto que el mensaje del backend ya trae. */
function conPunto(s: string): string {
  return /[.!?…]$/.test(s) ? s : `${s}.`;
}

export function avisoConversacion(
  res: MonitoreoAulasLibroConversacion | null | undefined,
): { texto: string; tono: TonoAviso } | null {
  if (!res) return null;

  const mensaje = String(res.mensaje ?? "").trim();

  if (!res.conversado) {
    const motivo = String(res.motivo ?? "").trim();
    if (motivo === "lectura_fallo") {
      // La causa Y la consecuencia: el orden leer-antes-de-publicar existe
      // para no pisar el remoto, y si la lectura cayó no se escribió nada.
      const causa = mensaje
        ? conPunto(`No se pudo leer el Sheets del operativo: ${mensaje}`)
        : "No se pudo leer el Sheets del operativo.";
      return {
        texto: `${causa} No se publicó nada para no pisar el libro con datos viejos.`,
        tono: "atencion",
      };
    }
    if (motivo === "publicacion_fallo") {
      const partes: string[] = [];
      // Solo se afirma que algo entró si de verdad se leyó algo: en un
      // documento virgen cuya siembra falló, `leido` viene null y decir
      // «sí entró» sería mentir sobre la mitad que nunca corrió.
      if (res.leido) {
        partes.push(`Lo leído del equipo sí entró: ${partesDelEquipo(res.leido)}.`);
      }
      partes.push(
        mensaje
          ? conPunto(`La publicación al Sheets falló: ${mensaje}`)
          : "La publicación al Sheets falló y no dijo por qué.",
      );
      return { texto: partes.join(" "), tono: "atencion" };
    }
    // Motivo que este código no conoce: viaja con su nombre.
    const base = motivo
      ? `La conversación con el Sheets no terminó (${motivo})`
      : "La conversación con el Sheets no terminó y no declaró motivo";
    return {
      texto: mensaje ? conPunto(`${base}: ${mensaje}`) : conPunto(base),
      tono: "atencion",
    };
  }

  // DECISIÓN DEL LEAD (2026-08-31): la lectura vacía sobre un documento sin
  // ninguna pestaña del libro no es un fallo. `leido` viene null a propósito y
  // el copy es el dictado, entero: no hay mitades que contar en una siembra.
  const motivoLectura = String(res.motivo_lectura ?? "").trim();
  if (motivoLectura === "documento_virgen") {
    return {
      texto: "El Sheets estaba vacío: el libro completo se sembró por primera vez.",
      tono: "ok",
    };
  }

  let tono: TonoAviso = "ok";
  const mitades: string[] = [partesDelEquipo(res.leido)];
  const hojas = res.publicado?.hojas ?? [];
  if (hojas.length) mitades.push(...hojas.map(fraseDeHoja));

  const frases: string[] = [`Libro conversado con el Sheets: ${mitades.join(" · ")}.`];
  const ausentes = res.leido?.hojas_ausentes ?? [];
  if (ausentes.length) {
    // La causa, no solo el hecho: «sin partes nuevas» con la hoja ausente
    // escondería que no había dónde leerlas.
    frases.push(`El Sheets no traía ${ausentes.join(" ni ")}.`);
    tono = "atencion";
  }
  if (!hojas.length) {
    // Sin resumen no se finge un verde: algo se publicó pero no se sabe qué.
    frases.push("La publicación terminó pero no dijo qué pasó con cada hoja.");
    tono = "atencion";
  }
  // El bloque que contesta «qué toca hoy» quedó en error: se dice con su código
  // y con qué hacer. Publicar y callar esto es lo que dejó un `#REF!` diez
  // horas en la hoja que campo abre cada mañana.
  const formulaRota = String(res.publicado?.plan_dia_formula_error ?? "").trim();
  if (formulaRota) {
    frases.push(
      `El bloque «Plan del día» quedó en ${formulaRota}: ábrelo en el Sheets para que recalcule y, si sigue igual, vuelve a publicar.`,
    );
    tono = "atencion";
  }
  if (motivoLectura) {
    // Un motivo de lectura que este código no conoce: con su nombre.
    frases.push(`La lectura declaró «${motivoLectura}».`);
    tono = "atencion";
  }
  // Cuando NO hay nada que corregir, no se dice nada (Gonzalo, 2026-09-08:
  // «este mensaje no debería estar aquí»). El inventario de qué hoja se leyó y
  // cuál se respetó es la narración de una operación que salió bien: ocupa el
  // sitio de la pantalla que se mira y no pide ninguna decisión. Los avisos de
  // ATENCIÓN se quedan enteros —hoja ausente, publicación sin resumen, motivo
  // desconocido—, que son los que sí cambian lo que alguien hace.
  if (tono === "ok") return null;
  return { texto: frases.join(" "), tono };
}
