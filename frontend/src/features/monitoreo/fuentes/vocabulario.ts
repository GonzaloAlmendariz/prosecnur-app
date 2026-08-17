// Vocabulario de la sección Fuentes.
//
// §3 de `docs/plan-fuentes-legibles-2026-07.md`. La regla de corte no es
// "traducir todo lo técnico": es distinguir dos vocabularios que hoy conviven
// sin marcar la diferencia.
//
//   Se CONSERVA el vocabulario del estudio —actor, canal, efectiva, cuota,
//   corte, UMP, Código Pulso, barrido, universo, recopilador—. El metodólogo lo
//   usa; traducirlo lo empobrece y lo desalinea del resto de la app.
//
//   Se TRADUCE el vocabulario de implementación —snapshot, choices, metadata,
//   asset, spreadsheet id—, que no significa nada fuera del código.
//
// Vive en un solo archivo a propósito: la deriva empieza cuando cada vista
// inventa su propia forma de decir "última lectura de la plataforma".

/** Cuántos recopiladores siguen el canal de su encuesta y cuántos no (A5). */
export function textoDeHerencia(heredan: number, excepciones: number) {
  const base = heredan === 1
    ? "1 recopilador usa este canal"
    : `${heredan} recopiladores usan este canal`;
  if (!heredan && !excepciones) return "Sin recopiladores";
  if (!excepciones) return `${base} · ninguno con excepción`;
  return `${base} · ${excepciones === 1 ? "1 con excepción" : `${excepciones} con excepción`}`;
}

/** Canal que una encuesta impone por defecto a sus recopiladores. */
export function textoDeCanalPorDefecto(canal: string) {
  const limpio = canal.trim();
  return limpio ? `Canal por defecto: ${limpio}` : "Sin canal por defecto";
}

/**
 * Nombre propio de un recopilador.
 *
 * El ANTES decía `Sin alias operativo`, que describe el campo de la base de
 * datos y no lo que el usuario tiene delante: un recopilador que se llama como
 * en la plataforma porque nadie le puso otro nombre.
 */
export function textoDeAlias(alias: string, nombreEnPlataforma: string) {
  const propio = alias.trim();
  if (propio) return propio;
  const plataforma = nombreEnPlataforma.trim();
  return plataforma ? `Usa el nombre de la plataforma` : "Sin nombre";
}

/**
 * Fecha de la última actualización, en la voz del usuario.
 *
 * Reemplaza los tres rótulos que hoy dicen lo mismo de tres formas
 * (`Snapshot local listo`, `Metadata real lista`, `ÚLTIMO SYNC`) y que además
 * no dicen *cuándo*, que es lo único que se quiere saber.
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

export function textoDeActualizacion(fecha: string | null | undefined) {
  const cuando = fechaCorta(fecha);
  return cuando ? `Actualizada ${cuando}` : "Sin actualizar";
}

/**
 * Fecha en que se leyó un archivo que alguien entregó.
 *
 * No es «Actualizada»: una fuente conectada se sincroniza sola y puede volver a
 * hacerlo, y un archivo se importó una vez. Usar el mismo verbo para las dos
 * cosas haría creer que el libro del operativo se refresca solo, que es
 * justamente lo contrario de cómo funciona —lo llena el equipo en Excel y la
 * app lo lee cuando se lo dan—.
 */
export function textoDeImportacion(fecha: string | null | undefined) {
  const cuando = fechaCorta(fecha);
  return cuando ? `Importado ${cuando}` : "Sin importar";
}

/**
 * Recuento con su unidad, para que ningún número quede pelado (R3).
 *
 * `contar(0, "encuesta", "encuestas")` → `"Sin encuestas"`, no `"0 encuestas"`:
 * un cero con unidad se lee como dato faltante, y un "sin" se lee como estado.
 */
export function contar(total: number, singular: string, plural: string) {
  if (!Number.isFinite(total) || total <= 0) return `Sin ${plural}`;
  return total === 1 ? `1 ${singular}` : `${total.toLocaleString("es-PE")} ${plural}`;
}

/**
 * Texto comparable: sin tildes, sin mayúsculas y sin espacios de sobra.
 *
 * Para comparar lo que escribe una persona con lo que viene de una plataforma.
 * `localeCompare` con `sensitivity: "base"` resuelve la igualdad, pero no sirve
 * para `includes`, que es lo que hace falta cuando se busca «Egresados» dentro
 * de «Encuesta de acreditación — Egresados 2026».
 */
export function sinTildes(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

/**
 * Los proveedores presentes en un juego de fuentes, en nombre propio.
 *
 * R1: la cabecera dice QU\u00c9 hay \u2014encuestas\u2014, y de d\u00f3nde viene es metadato para
 * el `title`. Vive aqu\u00ed y no en cada p\u00e1gina porque Acreditaci\u00f3n y Telef\u00f3nico
 * muestran la misma cabecera, y tenerlo dos veces es c\u00f3mo se desincronizan.
 */
export function proveedoresDeFuentes(fuentes: ReadonlyArray<{ kind?: string }>) {
  return Array.from(
    new Set(fuentes.map((fuente) => (fuente.kind === "kobo" ? "Kobo" : "SurveyMonkey"))),
  ).sort();
}

/**
 * \u00bfEl nombre de la fuente contradice el actor que se le est\u00e1 declarando?
 *
 * Al conectar una fuente el actor se elige en el paso 1, antes de ver de qu\u00e9
 * encuesta se trata. Guardar \u00abrespuestas de Administrativos\u00bb sobre una encuesta
 * llamada \u00ab\u2026Estudiantes\u00bb es un error silencioso: nada falla, y el corte reparte
 * las respuestas al actor equivocado hasta que alguien revisa los denominadores.
 *
 * Devuelve el actor que el nombre sugiere, o `null` si no hay contradicci\u00f3n. Se
 * exige que el sugerido est\u00e9 entre los actores conocidos del estudio: buscar
 * cualquier palabra suelta dar\u00eda falsos avisos con nombres gen\u00e9ricos.
 */
export function actorQueContradiceElNombre(
  nombreDeLaFuente: string,
  actorDeclarado: string,
  actoresConocidos: readonly string[],
) {
  const declarado = sinTildes(actorDeclarado);
  if (!declarado) return null;
  const nombre = sinTildes(nombreDeLaFuente);
  if (!nombre) return null;
  const sugerido = actoresConocidos.find(
    (item) => sinTildes(item) && nombre.includes(sinTildes(item)),
  );
  if (!sugerido || sinTildes(sugerido) === declarado) return null;
  // Si el nombre menciona AMBOS \u2014\u00abDocentes y Estudiantes\u00bb\u2014 no hay contradicci\u00f3n
  // que reportar: el nombre no desmiente lo declarado.
  if (nombre.includes(declarado)) return null;
  return sugerido;
}
