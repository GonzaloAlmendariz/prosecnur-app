/**
 * Cómo se llama el número que divide la cuota para dar los titulares.
 *
 * NO es siempre el P25. El analista lo decide en Marco › Alumnos por CH
 * (`alumnos_por_ch_decision.estadistico_default`) y el motor publica en cada
 * fila del reparto cuál usó (`estadistico_usado`). La UI, en cambio, tenía
 * «P25» escrito a mano en tres superficies de la misma pestaña.
 *
 * Medido en el proyecto de usuario nuevo, cuya decisión es `min_mediana_media`:
 * el motor divide entre 49,5 en EE.GG. Letras y la pantalla llamaba a ese
 * número «P25», cuando el P25 real de esa facultad es 25,0 — la mitad. El
 * valor mostrado era correcto; la etiqueta, falsa. Con el P25 de verdad esa
 * facultad pediría 33 titulares en vez de 17.
 *
 * La ironía está escrita en el repo: `distribucionElegiblesModel.ts` nació
 * «para que la confusión P25-vs-media no vuelva a existir», y es una de las
 * superficies que rotulaba mal. De ahí que el nombre se lea del dato y no se
 * escriba nunca a mano.
 */

/** Nombre corto para etiquetar una cifra («P25», «mediana»…). */
export function nombreEstadistico(clave: unknown): string {
  switch (String(clave ?? "").trim().toLowerCase()) {
    case "p25":
      return "P25";
    case "mediana":
    case "p50":
      return "mediana";
    case "media":
    case "promedio":
      return "media";
    case "min_mediana_media":
      return "mínimo entre media y mediana";
    case "p75":
      return "P75";
    default:
      // Sin dato no se inventa un nombre: «aula típica» es verdadero sea cual
      // sea el estadístico, y no compromete a uno que quizá no es.
      return "aula típica";
  }
}

/** Frase para el subtítulo: «su P25 de elegibles», «la menor entre…». */
export function fraseEstadistico(clave: unknown): string {
  const nombre = nombreEstadistico(clave);
  if (nombre === "aula típica") return "el tamaño típico de sus aulas";
  if (nombre === "mínimo entre media y mediana") return "el mínimo entre la media y la mediana de sus elegibles";
  return `su ${nombre} de elegibles`;
}

/**
 * El estadístico que el motor declara haber usado, leído del reparto. Si las
 * filas no coinciden entre sí devuelve null: mejor sin nombre que con uno que
 * sólo vale para algunas facultades.
 */
export function estadisticoDelReparto(
  estratos: Array<{ estadistico_usado?: unknown }> | null | undefined,
): string | null {
  const vistos = new Set<string>();
  for (const e of estratos ?? []) {
    const v = String(e.estadistico_usado ?? "").trim();
    if (v) vistos.add(v);
  }
  return vistos.size === 1 ? Array.from(vistos)[0] : null;
}
