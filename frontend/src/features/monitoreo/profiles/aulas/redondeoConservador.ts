/**
 * Encuestas por aula, en personas enteras y siempre hacia abajo.
 *
 * Gonzalo: «recuerda que estamos hablando de personas, entonces hablar de que
 * Educación deja veintiséis punto ocho encuestas por aula [...] no se entiende,
 * no se interpreta bien. Si se aproxima hacia abajo, de cero punto seis hacia
 * abajo, no tengo problema; **hay que tratar de ser más conservadores, más
 * cautos con la información**».
 *
 * Dos decisiones, y la segunda importa más que la primera:
 *
 * 1. **Entero**, porque no existe media persona encuestada.
 * 2. **Hacia abajo siempre**, incluso desde 26,9. Un decimal redondeado al alza
 *    promete una encuesta que puede no llegar; hacia abajo, el número que se lee
 *    es un piso. En una pantalla que decide si hace falta agendar más aulas, el
 *    error barato es quedarse corto.
 *
 * **Sólo para mostrar.** Los modelos siguen guardando el valor con decimales: si
 * el ranking ordenara por el número truncado, dos facultades de 28,9 y 28,1
 * quedarían empatadas y el orden lo decidiría el alfabeto.
 */
export function personasPorAula(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return "S/D";
  return Math.floor(valor).toLocaleString("es-PE");
}

/** El mismo criterio para un total proyectado: nunca promete de más. */
export function personasProyectadas(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return "S/D";
  return Math.max(0, Math.floor(valor)).toLocaleString("es-PE");
}
