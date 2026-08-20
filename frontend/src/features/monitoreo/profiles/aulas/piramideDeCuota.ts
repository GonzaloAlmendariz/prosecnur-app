import type { MonitoreoRow } from "../../../../api/monitoreo";
import type { ProyeccionDeFacultad } from "./proyeccionPorAgenda";

/**
 * La cuota como pirámide: una facultad por fila, un sexo a cada lado.
 *
 * La lista de doce celdas ordenada por cumplimiento contesta «qué celda se va a
 * incumplir», pero deja las dos celdas de una misma facultad lejos una de otra,
 * y la pregunta de campo es la contraria: **en esta facultad, ¿de qué lado voy
 * corto?** Enfrentadas se ve de un vistazo, y como cada lado se mide contra SU
 * propia meta, los dos son comparables aunque las metas sean distintas.
 *
 * Sólo hay dos lados. Si el estudio declarara un tercer valor de sexo, la
 * pirámide dejaría de servir: se devuelve `otros` con esos valores y quien
 * llama decide —hoy, seguir mostrando la lista—. No se descartan en silencio.
 *
 * ## Y además PREDICE
 *
 * El comentario de arriba dice que la lista que se retiró contestaba «qué celda
 * se va a incumplir» y esa pregunta se quedó sin responder en ninguna parte del
 * perfil —siendo que el estudio se aprueba o no por estas cuarenta celdas—. No
 * se repone como panel aparte: sería una segunda forma del MISMO cruce, que es
 * justo lo que hay que evitar. Se responde AQUÍ.
 *
 * Cada lado recibe lo que la agenda ya comprometida le va a aportar
 * (`proyeccionPorAgenda`), así que la barra deja de decir sólo dónde está y
 * pasa a decir **dónde va a acabar**. Un lado cuya sombra no llega a su meta no
 * cierra con lo que hay agendado, y eso se ve sin leer un número.
 */

export type LadoDeCuota = {
  sexo: string;
  meta: number;
  observadas: number;
  faltan: number;
  /** Cumplimiento en puntos porcentuales; puede pasar de 100. */
  avance: number;
  cumple: boolean;
  /**
   * Lo que le añadirían las aulas YA AGENDADAS, en puntos de su propia meta.
   * `null` cuando el estudio no publica agenda: no saber qué va a llegar no es
   * lo mismo que saber que no llega nada, y pintar cero acusaría de una
   * parálisis que nadie midió.
   */
  previsto: number | null;
  /** Si con lo agendado esta celda llega a su meta. */
  cierra: boolean | null;
  /** El día en que la cerraría. `null` si no la cierra o si ya está cumplida. */
  cierraEl: string | null;
  /** Lo que seguiría faltando cuando se acabe la agenda. */
  faltanAlCerrar: number;
};

export type FilaDePiramide = {
  facultad: string;
  izquierda: LadoDeCuota | null;
  derecha: LadoDeCuota | null;
  /** Lo que le falta a la facultad, sumando sus dos lados. */
  faltan: number;
};

function numero(valor: unknown) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function lado(
  sexo: string,
  filas: ReadonlyArray<MonitoreoRow>,
  pronostico: CeldaPrevista | null,
): LadoDeCuota | null {
  const propias = filas.filter((fila) => texto(fila.sex) === sexo);
  if (!propias.length) return null;
  const meta = propias.reduce((s, f) => s + numero(f.target), 0);
  const observadas = propias.reduce((s, f) => s + numero(f.observed), 0);
  if (meta <= 0) return null;
  const cumple = observadas >= meta;
  // Lo previsto se mide en puntos de SU meta y se recorta a lo que queda por
  // cubrir: una celda que ya cumplió no crece, y una sombra que se pasara de la
  // meta diria que el excedente sirve para algo, que es justo lo que no hace.
  const previsto = pronostico
    ? Math.max(0, Math.min(
        100 - Math.min(100, (100 * observadas) / meta),
        (100 * pronostico.esperadas) / meta,
      ))
    : null;
  return {
    sexo,
    meta,
    observadas,
    // Celda a celda, como en el resto del módulo: pasarse en una no cubre otra.
    faltan: propias.reduce((s, f) => s + Math.max(0, numero(f.target) - numero(f.observed)), 0),
    avance: Math.round((1000 * observadas) / meta) / 10,
    cumple,
    previsto,
    cierra: pronostico ? (cumple || pronostico.alcanza) : null,
    cierraEl: cumple ? null : (pronostico?.fechaDeCruce ?? null),
    faltanAlCerrar: pronostico?.faltanAlCerrarAgenda ?? 0,
  };
}

/** Lo que la agenda comprometida aporta a una celda concreta. */
type CeldaPrevista = {
  esperadas: number;
  alcanza: boolean;
  fechaDeCruce: string | null;
  faltanAlCerrarAgenda: number;
};

/**
 * Indexa la proyección por `facultad|sexo`, que es la clave de una celda.
 *
 * Se hace aquí y no en el componente para que la pirámide siga siendo una
 * función pura sobre datos y se pueda probar sin montar nada.
 */
export function celdasPrevistas(
  proyeccion: ReadonlyArray<ProyeccionDeFacultad>,
): Map<string, CeldaPrevista> {
  const mapa = new Map<string, CeldaPrevista>();
  for (const f of proyeccion) {
    for (const c of f.cuotas) {
      mapa.set(`${f.facultad}|${c.sexo}`, {
        esperadas: c.esperadasDeLaAgenda,
        alcanza: c.alcanza,
        fechaDeCruce: c.fechaDeCruce,
        faltanAlCerrarAgenda: c.faltanAlCerrarAgenda,
      });
    }
  }
  return mapa;
}

/**
 * Arma la pirámide y dice qué se quedó fuera.
 *
 * El orden de los lados lo fija la frecuencia —el sexo con más metas declaradas
 * va a la izquierda— para que no dependa del alfabeto ni del orden en que el
 * motor devolvió las filas.
 */
export function piramideDeCuota(
  filas: ReadonlyArray<MonitoreoRow>,
  previstas: ReadonlyMap<string, CeldaPrevista> = new Map(),
) {
  const conMeta = filas.filter((fila) => numero(fila.target) > 0 && texto(fila.sex));
  const cuenta = new Map<string, number>();
  for (const fila of conMeta) {
    const sexo = texto(fila.sex);
    cuenta.set(sexo, (cuenta.get(sexo) ?? 0) + 1);
  }
  const sexos = [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
  const [izq, der] = sexos.map(([sexo]) => sexo);
  const otros = sexos.slice(2).map(([sexo]) => sexo);

  const porFacultad = new Map<string, MonitoreoRow[]>();
  for (const fila of conMeta) {
    const facultad = texto(fila.faculty) || "Sin facultad";
    const actual = porFacultad.get(facultad);
    if (actual) actual.push(fila);
    else porFacultad.set(facultad, [fila]);
  }

  const facultades: FilaDePiramide[] = [...porFacultad.entries()]
    .map(([facultad, propias]) => {
      const izquierda = izq ? lado(izq, propias, previstas.get(`${facultad}|${izq}`) ?? null) : null;
      const derecha = der ? lado(der, propias, previstas.get(`${facultad}|${der}`) ?? null) : null;
      return {
        facultad,
        izquierda,
        derecha,
        faltan: (izquierda?.faltan ?? 0) + (derecha?.faltan ?? 0),
      };
    })
    // **Primero las que NO van a cerrar**, y sólo después las que más deben.
    //
    // Ordenar por lo que falta pone arriba a la facultad más grande, que es la
    // que más debe por tamaño y no la que está en peligro. Con la proyección
    // encima, la pregunta que ordena es otra: de éstas, ¿cuáles no llegan con lo
    // que ya está agendado? Sin proyección el orden es el de antes, así que un
    // estudio sin agenda no cambia de aspecto.
    //
    // Ordena lo que va a FALTAR al acabar la agenda, no cuántas celdas están en
    // peligro. Llevaba las dos claves y la segunda nunca decidía nada: una celda
    // que no cierra tiene por construcción `faltanAlCerrar > 0`
    // —`alcanza` es falso exactamente cuando lo esperado no cubre lo que falta—
    // así que contar celdas en peligro daba siempre el mismo orden que sumar lo
    // que les falta. Lo destapó un mutante que sobrevivió: anular la primera
    // clave no movió ni un test.
    .sort((a, b) => {
      const faltaAlCerrar = (f: FilaDePiramide) =>
        (f.izquierda?.faltanAlCerrar ?? 0) + (f.derecha?.faltanAlCerrar ?? 0);
      return faltaAlCerrar(b) - faltaAlCerrar(a)
        || b.faltan - a.faltan
        || a.facultad.localeCompare(b.facultad, "es");
    });

  return {
    facultades,
    izquierda: izq ?? "",
    derecha: der ?? "",
    /** Valores de sexo que no caben en una pirámide de dos lados. */
    otros,
    /** La meta más alta de un lado; marca la escala de los dos. */
    tope: facultades.reduce(
      (max, f) => Math.max(max, f.izquierda?.meta ?? 0, f.derecha?.meta ?? 0),
      0,
    ),
    sinMeta: filas.length - conMeta.length,
  };
}
