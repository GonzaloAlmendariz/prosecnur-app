/**
 * Qué lleva dentro el libro que se acaba de generar.
 *
 * El libro se descargaba en silencio. Quien lo abre no sabía si trae el trabajo
 * ya registrado o si va a pisar su Excel con columnas vacías — que es justo el
 * miedo que impide usar la función a mitad de operativo.
 *
 * Vive fuera de la página porque es una frase con reglas —singulares, qué se
 * omite, qué se dice cuando no hay nada— y una frase con reglas se prueba.
 */
export function avisoLibroGenerado(res: {
  unidades: number;
  partes: number;
  control: number;
}): string {
  const dentro = [
    res.partes > 0
      ? `${res.partes} ${res.partes === 1 ? "parte de campo" : "partes de campo"}`
      : "",
    res.control > 0
      ? `${res.control} ${res.control === 1 ? "fila de control" : "filas de control"}`
      : "",
  ].filter(Boolean);
  if (!dentro.length) {
    // Y se dice POR QUÉ salen vacías, no solo que lo están.
    return `Libro de ${res.unidades} aulas. Las columnas del equipo salen vacías: todavía no hay nada registrado.`;
  }
  return `Libro de ${res.unidades} aulas, con ${dentro.join(" y ")} ya registrados dentro.`;
}
