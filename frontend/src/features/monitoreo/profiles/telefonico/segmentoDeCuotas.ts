/**
 * Cómo se llama el segmento por el que este estudio reparte sus cuotas.
 *
 * La vista lo llamaba «Sede», escrito a mano: el título («Cuotas Kobo por
 * sede»), el KPI de la cabecera, el recuento («2 sedes») y el rótulo de cada
 * tarjeta. En PDM MedVida 2026 el segmento es `Actor` —Homologación de Títulos
 * y Vinculación Laboral, que no son sedes de nada— y la pantalla llamaba sede a
 * un actor en cinco sitios distintos.
 *
 * El nombre lo declara el estudio en `control_vars` y viaja en cada fila del
 * bloque de cuotas, en la columna `Variable`. De ahí sale, y no de una
 * constante: el siguiente estudio reparte por distrito, por facultad o por
 * carrera, y ninguno de esos es una sede tampoco.
 */

/** La variable de cuota que el corte declara, ya humanizada. */
export function nombreDelSegmento(
  variablesDeLasFilas: ReadonlyArray<string>,
  porDefecto = "Cuota",
): string {
  // La más frecuente y no la primera: un corte puede traer una fila suelta de
  // otra variable —una meta global, un residuo— y esa no es el segmento.
  const cuenta = new Map<string, number>();
  for (const bruto of variablesDeLasFilas) {
    const limpio = String(bruto ?? "").trim();
    if (!limpio) continue;
    cuenta.set(limpio, (cuenta.get(limpio) ?? 0) + 1);
  }
  if (!cuenta.size) return porDefecto;

  let ganadora = porDefecto;
  let mejor = 0;
  for (const [nombre, veces] of cuenta) {
    // Ante empate gana la primera vista, que es el orden en que el motor las
    // emite: el de `control_vars`, o sea el que declaró el usuario.
    if (veces > mejor) {
      mejor = veces;
      ganadora = nombre;
    }
  }
  return ganadora;
}

/**
 * El plural del segmento, para los recuentos («2 actores», «2 sedes»).
 *
 * Reglas del español suficientes para nombres de variable, que son sustantivos
 * comunes en singular: vocal → `+s`, `z` → `ces`, consonante → `+es`. No
 * pretende cubrir el idioma entero; cubre lo que puede aparecer aquí, y
 * cualquier caso raro se lee mal pero no engaña sobre el dato.
 */
export function pluralDelSegmento(nombre: string): string {
  const limpio = String(nombre ?? "").trim();
  if (!limpio) return "";
  if (/s$/i.test(limpio)) return limpio;

  const ultima = limpio.slice(-1);
  if (/[aeiouáéíóú]/i.test(ultima)) return `${limpio}s`;
  if (/z/i.test(ultima)) return `${limpio.slice(0, -1)}ces`;
  return `${limpio}es`;
}

/** «2 actores», «1 sede». */
export function contarSegmentos(cantidad: number, nombre: string): string {
  const etiqueta = cantidad === 1 ? nombre : pluralDelSegmento(nombre);
  return `${cantidad.toLocaleString("es-PE")} ${etiqueta.toLocaleLowerCase("es")}`;
}
