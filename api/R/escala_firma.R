# Identidad de una escala: cuándo dos preguntas «tienen la misma escala».
# =======================================================================
#
# La regla se decidió en el ADR 0064 y vivía SOLO dentro de las equivalencias.
# Gráficos tenía la suya, sin normalizar, y las dos discrepaban en el mismo
# proyecto: el mazo derivado agrupaba dos variables en un bloque —misma escala—
# y acto seguido el validador del plan declaraba «estas preguntas no comparten
# una escala compatible» y BLOQUEABA el export de un mazo que el motor renderiza
# perfectamente. Medido en Acreditación Contabilidad: 30 errores sobre 44
# láminas, todos por lo mismo.
#
# Aquí vive una sola vez. Si mañana se afina qué cuenta como la misma escala, las
# dos superficies se mueven juntas o ninguna.

# La caja y los espacios de una opción son un accidente de transcripción del
# cuestionario, no una diferencia de escala: «Totalmente en Desacuerdo» y
# «Totalmente en desacuerdo» son la misma categoría. Tratarlas como distintas
# dejaba fuera del mazo 56 de las preguntas que la matriz existe para comparar.
#
# El CÓDIGO no se normaliza: ahí un 1 contra un 2 sí cambia lo que la barra
# significa.
.escala_etiqueta_normalizada <- function(x) {
  tolower(gsub("\\s+", " ", trimws(as.character(x))))
}

# Firma canónica `codigo=etiqueta|codigo=etiqueta|…` a partir de códigos y
# etiquetas ya alineados.
.escala_firma <- function(codigos, etiquetas) {
  codigos <- as.character(codigos)
  if (!length(codigos)) return("")
  paste(codigos, .escala_etiqueta_normalizada(etiquetas), sep = "=", collapse = "|")
}
