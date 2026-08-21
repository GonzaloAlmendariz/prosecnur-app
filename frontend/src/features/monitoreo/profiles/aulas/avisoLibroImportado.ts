/**
 * Qué entró al releer el libro que el equipo llenó.
 *
 * La importación sólo avisaba de las hojas que faltaban. Las seis cifras del
 * resumen no se enseñaban nunca —quien importa no sabía si entraron sus 152
 * partes o ninguno— y `control_sin_nombre` se calculaba *precisamente* para
 * avisar de que no se leyó todo, y no avisaba de nada.
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

export function avisoLibroImportado(res: {
  resumen?: Partial<ResumenLibroImportado>;
  hojas_ausentes?: string[];
  control_sin_nombre?: number[];
}): string {
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

  if (!texto.length) return "El libro no traía nada que leer.";
  return texto.join(" ");
}
