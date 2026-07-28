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
export function textoDeActualizacion(fecha: string | null | undefined) {
  const valor = String(fecha ?? "").trim();
  if (!valor) return "Sin actualizar";
  const parsed = new Date(valor);
  if (Number.isNaN(parsed.getTime())) return "Sin actualizar";
  return `Actualizada ${parsed.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
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
