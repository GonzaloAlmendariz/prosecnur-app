import type { MonitoreoRow } from "../../../../api/monitoreo";

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
 */

export type LadoDeCuota = {
  sexo: string;
  meta: number;
  observadas: number;
  faltan: number;
  /** Cumplimiento en puntos porcentuales; puede pasar de 100. */
  avance: number;
  cumple: boolean;
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

function lado(sexo: string, filas: ReadonlyArray<MonitoreoRow>): LadoDeCuota | null {
  const propias = filas.filter((fila) => texto(fila.sex) === sexo);
  if (!propias.length) return null;
  const meta = propias.reduce((s, f) => s + numero(f.target), 0);
  const observadas = propias.reduce((s, f) => s + numero(f.observed), 0);
  if (meta <= 0) return null;
  return {
    sexo,
    meta,
    observadas,
    // Celda a celda, como en el resto del módulo: pasarse en una no cubre otra.
    faltan: propias.reduce((s, f) => s + Math.max(0, numero(f.target) - numero(f.observed)), 0),
    avance: Math.round((1000 * observadas) / meta) / 10,
    cumple: observadas >= meta,
  };
}

/**
 * Arma la pirámide y dice qué se quedó fuera.
 *
 * El orden de los lados lo fija la frecuencia —el sexo con más metas declaradas
 * va a la izquierda— para que no dependa del alfabeto ni del orden en que el
 * motor devolvió las filas.
 */
export function piramideDeCuota(filas: ReadonlyArray<MonitoreoRow>) {
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
      const izquierda = izq ? lado(izq, propias) : null;
      const derecha = der ? lado(der, propias) : null;
      return {
        facultad,
        izquierda,
        derecha,
        faltan: (izquierda?.faltan ?? 0) + (derecha?.faltan ?? 0),
      };
    })
    // Primero donde más falta, como el resto de las listas del perfil.
    .sort((a, b) => b.faltan - a.faltan || a.facultad.localeCompare(b.facultad, "es"));

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
