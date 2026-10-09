/**
 * El eje de días que comparten los dos gráficos temporales de Resumen.
 *
 * Gonzalo, 2026-09-10: «tiene que estar alineado con el gráfico de abajo, de
 * cuándo se termina de aplicar el plan… los días del eje x de cuándo se termina
 * de aplicar el plan tienen que alinearse con el ritmo de recolección. Y ahorita
 * se ve vacío el ritmo de la recolección: igual entiendo que hay días que
 * todavía no hemos aplicado, pero pueden ponerse de todas formas para que se
 * complete el gráfico».
 *
 * **Por qué no se alineaban.** No era un descuido de maquetación: los dos ejes
 * medían cosas distintas. «Ritmo de la recolección» ponía UN punto por día CON
 * respuestas —tres, en el operativo— y «Cuándo se termina de aplicar el plan»
 * lleva escrito en su propio código que «el eje X son días de campo, no fechas
 * del calendario». Dos gráficos, dos unidades, uno encima del otro.
 *
 * Este módulo pone las dos en la misma: **fechas del calendario, de la primera
 * jornada a la última prevista**, con los días sin campo dibujados igual —que es
 * exactamente lo que él pide para que el ritmo deje de verse vacío—.
 *
 * El domingo no es día de campo, y la regla vive en `pronosticoDeCierre.ts`
 * (`sumarDiasDeCampo`). Aquí se pregunta, no se copia: una segunda copia de esa
 * regla ya se desincronizó una vez.
 */

export type DiaDelEje = {
  /** `2026-09-08`. */
  fecha: string;
  /** «08/09», que es como rotula el eje el boceto. */
  etiqueta: string;
  /** Los domingos no son jornada; se dibujan, pero apagados. */
  esDeCampo: boolean;
  /** Ya pasó al corte del estudio: separa lo hecho de lo proyectado. */
  pasado: boolean;
};

const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** En UTC como el resto del perfil: con hora local, un cambio de día se corre. */
function siguiente(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function esDomingo(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 0;
}

/**
 * Todos los días entre dos fechas, ambas incluidas.
 *
 * @param corte El último día con campo. Los días hasta ahí se marcan `pasado`.
 * @param tope Cuántos días como mucho. Un horizonte corrupto no puede colgar la
 *   vista, y por encima de dos meses el eje deja de leerse igual.
 */
export function ejeDeDias(desde: string, hasta: string, corte = "", tope = 70): DiaDelEje[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return [];
  if (hasta < desde) return [];
  const dias: DiaDelEje[] = [];
  let hoy = desde;
  for (let i = 0; i <= tope; i += 1) {
    dias.push({
      fecha: hoy,
      etiqueta: diaMes(hoy),
      esDeCampo: !esDomingo(hoy),
      pasado: Boolean(corte) && hoy <= corte,
    });
    if (hoy >= hasta) break;
    hoy = siguiente(hoy);
  }
  return dias;
}

/**
 * Cruza una serie de días con el eje, dejando en cero los que no están.
 *
 * Es la mitad que hacía que el ritmo «se viera vacío»: la serie trae los tres
 * días con respuestas y el eje tiene veinticinco. Los que faltan se dibujan
 * igual, sin barra, en vez de encoger el gráfico a tres columnas.
 *
 * **El acumulado NO se pone en cero cuando falta el día**: se arrastra el último
 * conocido. Un acumulado que baja a cero un domingo y vuelve a subir el lunes es
 * una línea que dice algo falso.
 */
export function serieSobreElEje<T extends { fecha: string; validas: number; acumulado: number }>(
  eje: ReadonlyArray<DiaDelEje>,
  serie: ReadonlyArray<T>,
): Array<DiaDelEje & { validas: number; acumulado: number; tieneDato: boolean }> {
  const porFecha = new Map(serie.map((d) => [d.fecha, d]));
  let ultimo = 0;
  return eje.map((d) => {
    const dato = porFecha.get(d.fecha);
    if (dato) ultimo = Number(dato.acumulado) || ultimo;
    return {
      ...d,
      validas: dato ? Number(dato.validas) || 0 : 0,
      acumulado: ultimo,
      tieneDato: Boolean(dato),
    };
  });
}
