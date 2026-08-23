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

const miles = (n: number) => n.toLocaleString("es-PE");

export function avisoLibroGenerado(res: {
  unidades: number;
  partes: number;
  control: number;
  titulares?: number | null;
  reservas?: number | null;
}): string {
  const dentro = [
    res.partes > 0
      ? `${miles(res.partes)} ${res.partes === 1 ? "parte de campo" : "partes de campo"}`
      : "",
    res.control > 0
      ? `${miles(res.control)} ${res.control === 1 ? "fila de control" : "filas de control"}`
      : "",
  ].filter(Boolean);
  if (!dentro.length) {
    // Y se dice POR QUÉ salen vacías, no solo que lo están.
    return `Libro de ${queLleva(res)}. Las columnas del equipo salen vacías: todavía no hay nada registrado.`;
  }
  return `Libro de ${queLleva(res)}, con ${dentro.join(" y ")} ya registrados dentro.`;
}

/**
 * El contenido del libro, desglosado.
 *
 * Decía «Libro de 700 aulas», y 700 no son 700 visitas: son **193
 * cursos-horario que se van a visitar y 507 reservas** que sólo entran si una
 * titular cae. Un total a secas vuelve a poner dos cosas distintas bajo la
 * misma palabra — el mismo efecto colateral que ya dejó «Libro de 2616 aulas»
 * sobre un libro de 190, y que se arregló ahí sin revisar quién más lo contaba.
 *
 * Si el backend no manda el desglose —un libro viejo, otro perfil— se dice el
 * total y ya: inventar un reparto sería peor que no darlo.
 */
function queLleva(res: { unidades: number; titulares?: number | null; reservas?: number | null }): string {
  const titulares = typeof res.titulares === "number" ? res.titulares : null;
  const reservas = typeof res.reservas === "number" ? res.reservas : null;
  if (titulares === null || reservas === null || titulares + reservas !== res.unidades) {
    return `${miles(res.unidades)} ${res.unidades === 1 ? "aula" : "aulas"}`;
  }
  const cursos = `${miles(titulares)} ${titulares === 1 ? "curso-horario" : "cursos-horario"}`;
  if (reservas === 0) return cursos;
  return `${cursos} y sus ${miles(reservas)} ${reservas === 1 ? "reserva" : "reservas"}`;
}
