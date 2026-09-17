/**
 * Las TRES lecturas de «¿esta celda va a llegar?», juntas y sin contradecirse.
 *
 * Gonzalo, 2026-09-10: «creo que tanto b como c son importantes, deben servir
 * para mayor contexto». No se elige una: **la diferencia entre ellas es la
 * información**.
 *
 *   TECHO         todo el plan en juego, tenga fecha o no. Es el máximo posible
 *                 si absolutamente todo llega a aplicarse.
 *   COMPROMETIDO  sólo lo que YA TIENE FECHA. Es lo que hay cerrado hoy.
 *   CON EL CAMPO  lo comprometido, corregido por lo que esa celda está
 *                 rindiendo de verdad.
 *
 * **Por qué las tres y no una.** Sobre HSVG26ULT2 el 2026-09-10 el techo daba
 * 3 266 contra una cuota de 2 500 y ninguna celda en déficit, mientras lo
 * comprometido daba 2 640 y siete celdas por debajo. Con el techo solo, la
 * pantalla decía «va a llegar» en las 30 y el panel de refuerzo no se encendía
 * nunca. Con lo comprometido solo, se pierde de vista que el remedio existe —hay
 * plan de sobra— y que lo que falta es AGENDA.
 *
 * Ya hubo un panel que enseñaba el comprometido —«Metas y aulas»— y se
 * desconectó el 2026-09-09 porque discrepaba con éste en 28 de las 30 celdas.
 * Ninguno mentía: contaban universos distintos y nadie lo decía. Ahora las tres
 * salen del MISMO motor (`monitoreo_aulas_calibracion.R`), así que no pueden
 * discrepar: una es subconjunto de la otra por construcción.
 */

export type LecturaDeCuota = {
  facultad: string;
  /** «Mujeres» / «Hombres», ya en palabras. */
  sexo: string;
  cuota: number;
  logrado: number;
  /** (a) todo el plan en juego. */
  techo: number;
  /** (b) sólo lo que tiene fecha. */
  comprometido: number;
  /** (c) lo comprometido a la tasa que la celda está rindiendo. */
  conElCampo: number;
  /** El factor de la (c). >1 el campo rinde por encima de lo previsto. */
  factorDeCampo: number | null;
  /** Lo que falta con lo COMPROMETIDO, que es la lectura que pide acción. */
  faltaComprometido: number;
  /** `true` cuando el techo llega pero lo comprometido no: es un problema de agenda. */
  esFaltaDeAgenda: boolean;
};

function numero(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

function numeroONulo(x: unknown): number | null {
  if (x == null || x === "") return null;
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * `M`/`F` del motor a la palabra que usa el resto del perfil.
 *
 * **Con `grano = "eje"` no hay palabra que decir.** Esa celda no tiene dimensión
 * de sexo —es una cuota por nivel, no por nivel y sexo— y eso es distinto de no
 * conocer el sexo: rotularla «Sin sexo declarado» diría que falta un dato que
 * nadie pidió. El grano lo declara el motor; sin él, el trato es el de siempre.
 */
export function sexoEnPalabra(sex: unknown, grano?: unknown): string {
  if (String(grano ?? "").trim() === "eje") return "";
  const s = String(sex ?? "").trim().toUpperCase();
  if (s === "F") return "Mujeres";
  if (s === "M") return "Hombres";
  return "Sin sexo declarado";
}

export function tresLecturasDeCuota(
  celdas: ReadonlyArray<Record<string, unknown>>,
): LecturaDeCuota[] {
  return celdas.map((c) => {
    const cuota = numero(c.cuota);
    const techo = numero(c.proyeccion);
    const comprometido = numero(c.proyeccion_agendada);
    return {
      facultad: String(c.faculty ?? "").trim() || "Sin facultad declarada",
      sexo: sexoEnPalabra(c.sex, c.grano),
      cuota,
      logrado: numero(c.logrado),
      techo,
      comprometido,
      conElCampo: numero(c.proyeccion_agendada_observada),
      factorDeCampo: numeroONulo(c.factor_de_campo),
      // **Hacia ARRIBA y entera**, la misma regla que `.mac_brecha()` en el
      // motor: «si faltan 0,1 encuestas falta una persona». Sin el techo, la
      // celda de CIENCIAS Y ARTES DE LA COMUNICACIÓN —cuota 54 y 53,8
      // comprometidas— salía en la lista de las que no llegan diciendo
      // «faltan 0», que es una fila contradiciéndose a sí misma. Visto en
      // pantalla el 2026-09-10. Es lo único que se PIDE, y no se pide media
      // encuesta.
      faltaComprometido: Math.ceil(Math.max(0, cuota - comprometido)),
      // **La distinción que da el remedio.** Si el techo llega y lo comprometido
      // no, el plan tiene aulas de sobra y lo que falta es ponerles fecha; si no
      // llega ni el techo, agendar no basta y hay que ir al banco.
      esFaltaDeAgenda: techo >= cuota && comprometido < cuota,
    };
  });
}

/** Las que no llegan con lo comprometido, de mayor a menor brecha. */
export function lasQueNoLlegan(filas: ReadonlyArray<LecturaDeCuota>): LecturaDeCuota[] {
  return filas
    .filter((f) => f.faltaComprometido > 0)
    .slice()
    .sort((a, b) => b.faltaComprometido - a.faltaComprometido);
}
