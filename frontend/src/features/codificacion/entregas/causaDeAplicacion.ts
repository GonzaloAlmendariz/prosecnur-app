// El error de un trabajo de Aplicar, dicho en castellano: qué pasó, por qué y qué hacer. El texto que
// devuelve el motor (un error de R dentro de un proceso aparte) nunca llega tal cual a la pantalla.

const QUEDA = "La base no cambió.";

/** Los errores del motor que se conocen, con su causa y qué hacer. */
const CONOCIDOS: { patron: RegExp; causa: (m: RegExpMatchArray) => string }[] = [
  {
    // api/R/codificacion_aplicar_instrumento.R: un código que no es del formulario y no consta como nuevo.
    patron: /los códigos nuevos de '([^']+)' deben declararse/i,
    causa: (m) =>
      `Algunos códigos de ${m[1].replace(/_recod$/, "")} no son opciones del formulario y no constan como códigos nuevos en lo guardado. Revisa los códigos de esa pregunta en Codificar y vuelve a aplicar.`,
  },
  {
    patron: /faltan las columnas 'nuevo_codigo' y 'nueva_etiqueta'.*de '([^']+)'/i,
    causa: (m) => `Los códigos nuevos de ${m[1].replace(/_recod$/, "")} no quedaron declarados. Revisa los códigos de esa pregunta en Codificar y vuelve a aplicar.`,
  },
  {
    patron: /hay códigos sin etiqueta.*'([^']+)'/i,
    causa: (m) => `Hay códigos de ${m[1].replace(/_recod$/, "")} sin nombre. Ponles nombre en Codificar y vuelve a aplicar.`,
  },
];

export function causaDeAplicacion(crudo: string): string {
  const texto = (crudo ?? "").replace(/\s+/g, " ").trim();
  for (const { patron, causa } of CONOCIDOS) {
    const m = texto.match(patron);
    if (m) return `${causa(m)} ${QUEDA}`;
  }
  return `El motor no pudo terminar la aplicación. ${QUEDA} Vuelve a aplicar; si se repite, avisa al equipo con la hora del intento.`;
}
