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

/**
 * Cómo se anuncia la tasa de efectividad entre los parámetros del diseño.
 *
 * Gonzalo, señalando el chip «tasa de efectividad 53%»: «creo que esto ya no es
 * cierto». Tenía razón: ese 53 % es el parámetro GLOBAL del componente y el
 * dimensionamiento usa la tasa de CADA facultad —0,4346 en EE.GG. Ciencias,
 * 0,7385 en Letras y Ciencias Humanas—. Anunciar un número plano entre z, p, e
 * y deff lo pone al mismo nivel que los parámetros que el analista fijó, cuando
 * ninguna facultad tiene por qué estar usándolo.
 *
 * Si las tasas del reparto difieren, se anuncia el rango y se dice que es por
 * facultad. Si coinciden con la global, el chip vuelve a ser exacto tal cual.
 */
export function resumenTasaEfectividad(
  estratos: Array<{ tau?: unknown }> | null | undefined,
  tauGlobal: number,
): { valor: string; nota: string } {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const notaGlobal = "valor de referencia heredado del estudio anterior; ajústalo cuando tengas datos propios";
  const taus: number[] = [];
  for (const e of estratos ?? []) {
    const v = Number(e?.tau);
    if (Number.isFinite(v) && v > 0) taus.push(v);
  }
  if (taus.length < 2) return { valor: pct(tauGlobal), nota: notaGlobal };
  const min = Math.min(...taus);
  const max = Math.max(...taus);
  // Un punto porcentual de diferencia no merece anunciarse como rango: se
  // redondea a lo mismo y el chip quedaría con «53%–53%».
  if (pct(min) === pct(max)) return { valor: pct(min), nota: notaGlobal };
  return {
    valor: `${pct(min)}–${pct(max)}`,
    nota: `cada facultad dimensiona con la suya; ${pct(tauGlobal)} es la de referencia para las que no tienen datos propios`,
  };
}
