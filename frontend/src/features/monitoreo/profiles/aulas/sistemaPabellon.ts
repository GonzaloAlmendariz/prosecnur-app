/**
 * «Sistema Pabellón» — los helpers puros del lenguaje de identidad del perfil
 * (B33, dictado 2026-09-02: «cuadros jerárquicos, boxes de colores
 * distinguibles — eso debe tener un nombre y debe aplicarse a todo el resto de
 * Monitoreo de aulas»).
 *
 * Nació en Carga de campo (B31) y éste es su módulo compartido: TODA vista del
 * perfil que pinte un lugar, una hora o una sesión importa de aquí, para que el
 * A206 de la Agenda, el de la ficha y el del popover de reemplazo se pinten
 * idénticos. El contrato de color es el aprobado en B31 —nació como
 * `chipDePabellon.ts` en la oleada de cuadros y se unificó aquí (P8) cuando
 * aquel paquete aterrizó—.
 *
 * El contrato es determinismo puro: misma letra, mismo tono, siempre — sin
 * reloj, sin azar y sin depender del orden en que aparezcan los lugares. Los
 * tonos son índices, no colores: la paleta vive en `sistemaPabellon.css`
 * (clases `es-tono-*` sobre tokens `--pulso-*`), única dueña del color.
 */

/** Cuántos tonos declara la hoja. Subirlo exige declarar la clase nueva. */
export const TONOS_DE_PABELLON = 8;

/** «A703» → «A»; «lfia» → «L»; «Ñ201» → «N»; sin letra inicial → "". */
export function letraDePabellon(lugar: string): string {
  const crudo = String(lugar ?? "").trim().toUpperCase();
  const m = /^\p{L}/u.exec(crudo);
  if (!m) return "";
  // Sin tildes ni virgulilla: «Ñ» comparte tono con «N» en vez de caer fuera
  // del alfabeto y quedarse sin color.
  return m[0].normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Índice cíclico `0..TONOS-1` por letra; `null` sin letra → chip neutro. */
export function tonoDePabellon(lugar: string): number | null {
  const letra = letraDePabellon(lugar);
  if (!letra) return null;
  const codigo = letra.charCodeAt(0) - 65;
  if (codigo < 0 || codigo > 25) return null;
  return codigo % TONOS_DE_PABELLON;
}

/**
 * De «LUN 16:00 A206», las dos mitades: la sesión («LUN 16:00») y el aula
 * («A206»).
 *
 * `SESIONES Y AULA` del Excel es un texto descriptivo que el equipo escribe
 * entero, y ésta es la única forma segura de saber que su cola es un LUGAR: en
 * un plan que viene del sorteo esa misma columna trae el código académico
 * (`urb209_0601` en las 193 filas, medido el 2026-08-23) y un código no es un
 * aula — es el mismo criterio con el que `soloElAula` se niega a adivinar. Lo
 * que no calza con el patrón día + hora + resto devuelve `null` y se pinta tal
 * cual llegó.
 */
export function sesionYLugar(texto: string): { sesion: string; lugar: string } | null {
  const limpio = String(texto ?? "").trim();
  // El mismo prefijo que reconoce `soloElAula`: día (3-10 letras, punto
  // opcional) y hora `H:MM`. Divergir aquí pintaría con chip lo que aquella
  // función se niega a recortar.
  const m = /^([A-Za-zÁÉÍÓÚÑáéíóúñ]{3,10}\.?\s+\d{1,2}:\d{2})\s+(\S.*)$/.exec(limpio);
  if (!m) return null;
  return { sesion: m[1], lugar: m[2].trim() };
}

/**
 * Qué columnas de las tablas del perfil son un LUGAR y cuáles una HORA.
 *
 * Listas cerradas a propósito, como `COLUMNAS_DE_PORCENTAJE`: deducir «esto
 * parece un aula» del dato acabaría coloreando códigos académicos, que es el
 * defecto que este perfil ya reparó dos veces. Sólo entra lo que el libro o el
 * motor declaran como sitio o como hora.
 */
const COLUMNAS_DE_LUGAR = new Set([
  // El salón del catálogo, el aula del parte, la de la Base de control y el
  // lugar acordado con el docente (B30).
  "venue",
  "actual_room",
  "room",
  "scheduled_venue",
]);

const COLUMNAS_DE_HORA = new Set([
  // Cuándo se agendó, cuándo se aplicó y los rangos declarados del curso.
  "scheduled_time",
  "applied_time",
  "schedule",
  "schedule_range",
  "sesiones_dia_hora",
]);

export function esColumnaDeLugar(campo: string): boolean {
  return COLUMNAS_DE_LUGAR.has(campo);
}

export function esColumnaDeHora(campo: string): boolean {
  return COLUMNAS_DE_HORA.has(campo);
}
