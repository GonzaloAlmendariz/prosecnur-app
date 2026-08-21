/**
 * Qué entró al releer el libro que el equipo llenó.
 *
 * La importación sólo avisaba de las hojas que faltaban. Las seis cifras del
 * resumen no se enseñaban nunca: quien importa no sabía si entraron sus 152
 * partes o ninguno.
 *
 * Lo de las columnas sin nombre es un matiz, no una ausencia: la tarjeta
 * «Libro del operativo» de Fuentes ya las cuenta desde el recibo guardado
 * («7 columnas sin nombre en la hoja» en el estudio real). Lo que faltaba era
 * decirlo EN EL MOMENTO de importar, que es cuando alguien puede ir a mirar su
 * Excel — no dos secciones más allá y sin saber que hay algo que mirar.
 *
 * Es la contraparte de `avisoLibroGenerado`: generar dice qué salió, importar
 * dice qué entró.
 */
export type ResumenLibroImportado = {
  unidades: number;
  titulares: number;
  reservas: number;
  contactadas: number;
  partes_de_campo: number;
  filas_de_control: number;
};

/**
 * `atencion` cuando el libro no trajo una hoja o dejó columnas sin leer.
 *
 * Con un solo tono, una importación limpia se anunciaba con el mismo ámbar que
 * una que se dejó columnas con datos sin leer: el rótulo valía igual para dos
 * diagnósticos opuestos y escondía justo el que pide actuar.
 */
export type TonoAviso = "ok" | "atencion";

export function avisoLibroImportado(res: {
  resumen?: Partial<ResumenLibroImportado>;
  hojas_ausentes?: string[];
  control_sin_nombre?: number[];
}): { texto: string; tono: TonoAviso } {
  const r = res.resumen ?? {};
  const frases: string[] = [];

  if (r.unidades) {
    const cadena = [
      r.titulares ? `${r.titulares} ${r.titulares === 1 ? "titular" : "titulares"}` : "",
      r.reservas ? `${r.reservas} ${r.reservas === 1 ? "reserva" : "reservas"}` : "",
    ].filter(Boolean);
    frases.push(
      cadena.length
        ? `Entraron ${r.unidades} aulas (${cadena.join(" y ")})`
        : `Entraron ${r.unidades} aulas`,
    );
  }
  const registros = [
    r.partes_de_campo ? `${r.partes_de_campo} ${r.partes_de_campo === 1 ? "parte de campo" : "partes de campo"}` : "",
    r.filas_de_control ? `${r.filas_de_control} ${r.filas_de_control === 1 ? "fila de control" : "filas de control"}` : "",
  ].filter(Boolean);
  if (registros.length) frases.push(registros.join(" y "));

  const texto: string[] = [];
  if (frases.length) texto.push(`${frases.join(", ")}.`);

  if (res.hojas_ausentes?.length) {
    texto.push(`El libro no traía ${res.hojas_ausentes.join(" ni ")}. Lo demás se leyó; queda anotado en Fuentes.`);
  }
  // La causa, no sólo el hecho: no es que se descartaran columnas, es que su
  // cabecera no las nombra y por eso el lector no supo qué eran.
  const n = res.control_sin_nombre?.length ?? 0;
  if (n) {
    texto.push(
      `${n} ${n === 1 ? "columna" : "columnas"} de la base de control ${n === 1 ? "traía" : "traían"} datos y no se ${n === 1 ? "leyó" : "leyeron"}: su cabecera no ${n === 1 ? "la" : "las"} nombra.`,
    );
  }

  const tono: TonoAviso =
    res.hojas_ausentes?.length || (res.control_sin_nombre?.length ?? 0) > 0 || !texto.length
      ? "atencion"
      : "ok";
  if (!texto.length) return { texto: "El libro no traía nada que leer.", tono };
  return { texto: texto.join(" "), tono };
}
