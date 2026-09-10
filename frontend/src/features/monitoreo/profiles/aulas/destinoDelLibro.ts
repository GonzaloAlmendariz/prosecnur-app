// destinoDelLibro.ts — el Google Sheets del operativo, recordado en el proyecto.
//
// Decisión textual de Gonzalo (2026-08-31): «un campo para poner el enlace del
// nuevo sheets y recordarlo, para escribir sobre él y leer». El backend guarda
// el destino en `cfg.aulas_universitarias.libro_sheets` la primera vez que un
// publicar lo trae en el body; estas funciones deciden QUÉ enlace viaja en cada
// acción. Son puras porque esa decisión ES el contrato del campo —el escrito
// manda, el recordado respalda—, no un detalle de presentación del panel.

/** El bloque `libro_sheets` de la config de aulas, tal como viaja del backend. */
export type LibroSheetsRecordado = {
  spreadsheet_id?: string;
  url?: string;
  updated_at?: string;
} | null | undefined;

/**
 * El enlace recordado listo para enseñar: la URL guardada o, si un `.pulso`
 * viejo trae sólo el id, la URL canónica derivada — el mismo formato que el
 * backend construye al recordar.
 */
export function enlaceRecordado(libro: LibroSheetsRecordado): string {
  const url = String(libro?.url ?? "").trim();
  if (url) return url;
  const id = String(libro?.spreadsheet_id ?? "").trim();
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : "";
}

/**
 * Fecha corta en la voz de la casa (mismo formato que Fuentes). Sin ICU el
 * runner degrada el orden de los campos; por eso los tests afirman la frase y
 * no los dígitos.
 */
function fechaCorta(fecha: string | null | undefined) {
  const valor = String(fecha ?? "").trim();
  if (!valor) return "";
  const parsed = new Date(valor);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * La línea bajo el campo: si hay destino, desde cuándo está guardado y para
 * qué sirve; si no, la invitación —el mismo «pégalo una vez» que responde el
 * backend cuando falta—.
 */
export function textoDelRecordado(libro: LibroSheetsRecordado): string {
  if (!enlaceRecordado(libro)) return "Pégalo una vez y queda guardado para leer y publicar.";
  const cuando = fechaCorta(libro?.updated_at);
  return cuando
    ? `Guardado el ${cuando} · leer y publicar usan este enlace.`
    : "Guardado · leer y publicar usan este enlace.";
}

/**
 * Qué viaja al publicar: el enlace escrito (el backend lo recuerda ANTES de
 * publicar) o `undefined`, que significa «usa el recordado». Nunca `""`: un
 * body con url vacía olvidaría el destino en vez de usarlo.
 */
export function enlaceParaPublicar(escrito: string): string | undefined {
  const limpio = escrito.trim();
  return limpio ? limpio : undefined;
}

/**
 * Qué viaja al leer: el escrito manda; sin él, el recordado; sin ninguno, ""
 * —no hay de dónde leer y el botón lo dice en vez de dejar caer un 400—.
 * A diferencia de publicar, aquí el enlace SIEMPRE viaja: el endpoint de
 * importar exige el destino en el body.
 */
export function enlaceParaLeer(escrito: string, libro: LibroSheetsRecordado): string {
  const limpio = escrito.trim();
  return limpio || enlaceRecordado(libro);
}

/**
 * Si HAY destino: la misma pregunta que decide si el botón se enciende.
 *
 * Vive aquí, junto a las dos funciones que deciden qué enlace viaja, y no en el
 * panel, porque una guarda que se calcula aparte de su llamada acaba
 * contradiciéndola. No es una hipótesis: el 2026-09-09 pasó en el panel gemelo
 * —el del Sheets de los aplicadores—, donde la guarda contaba el enlace pegado
 * y la llamada no lo mandaba, y el usuario vio «pega su enlace una vez» con el
 * enlace ya pegado. Aquel se cerró con `destinoDeDistribucion.ts`; éste estaba
 * bien por suerte, no por construcción.
 *
 * La invariante que cierra el hueco: si esto dice que sí, `enlaceParaLeer`
 * devuelve algo — y `enlaceParaPublicar` devuelve algo o `undefined`, que el
 * backend resuelve con el recordado.
 */
export function hayDestinoDelLibro(escrito: string, libro: LibroSheetsRecordado): boolean {
  return Boolean(enlaceParaLeer(escrito, libro));
}
