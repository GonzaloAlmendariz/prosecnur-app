# El VOCABULARIO de «Avance de campo»: qué tablas tiene, cómo se llaman sus
# columnas y de qué naturaleza es cada una.
#
# Dictado de Gonzalo (2026-09-08, segundo día de campo, con el Sheets delante):
# la hoja pasa a CINCO tablas y él las dictó columna a columna. Dos frases
# gobiernan este archivo:
#
#   · «Recuerda que los que tienen un (%) no se pone en el titulo, es el formato
#     de la celda.» El porcentaje es una PROPIEDAD DE LA CELDA, no un sufijo del
#     rótulo. Para eso la celda tiene que ser un número, y hasta hoy toda esta
#     hoja viajaba a Sheets como texto («19.2 %»): sobre texto no hay numFmt que
#     valga ni regla de color que compare.
#   · «la "tasa de facultad" es en realidad la "Tasa de rendimiento de la
#     facultad" y debe tener ese nombre». Los rótulos completos viven aquí y en
#     ningún otro sitio.
#
# **Por qué el vocabulario es un archivo y no una constante en cada renderer.**
# La hoja se escribe DOS veces —imperativa en el xlsx del libro, declarativa en
# la pestaña de Sheets— y el formato se decide en una tercera
# (`monitoreo_aulas_avance_formato.R`). Con la lista repetida tres veces, el día
# que una columna cambie de nombre habrá dos sitios que sigan pintando la
# anterior y ninguno lo dirá: es exactamente la avería del anclaje por rótulo
# que ya costó seis fallos mudos en este mismo libro. Aquí la lista es UNA, los
# tres la leen, y quien la mueva mueve las tres salidas a la vez.

# --- Los rótulos, tal como se dictaron ---------------------------------------

#' Cabecera de cada tabla de «Avance de campo», en el orden dictado.
#'
#' El orden ES el dictado; el único ajuste sobre su transcripción es de
#' registro: escribió «Faltantes hombre muestra» y «Faltantes mujeres» para la
#' misma familia, y van en plural y con su meta explícita, que es lo que pidió
#' para un Excel formal.
#'
#' **Hombres antes que mujeres, en toda la hoja.** La versión anterior iba
#' mujeres→hombres por una decisión mía; el dictado del 2026-09-08 alterna a
#' hombres→mujeres de forma consistente (`Total · Hombres · Mujeres`,
#' `Efectivas hombres · Efectivas mujeres`). Manda el dictado.
#' @keywords internal
AULAS_AVANCE_CABECERAS <- list(
  general = c("Indicadores", "Total", "Hombres", "Mujeres"),
  facultad = c(
    "Facultad",
    # Cada «Efectivas» lleva a su derecha cuánto es eso sobre la meta de la
    # muestra (Gonzalo, 2026-09-08: «al lado de cada "Efectivas..." tiene que
    # haber un porcentaje de avance»). Un conteo suelto no dice si 109 es mucho
    # o poco sin buscar la muestra siete columnas más allá.
    "Efectivas", "Avance muestra",
    "Efectivas hombres", "Avance muestra hombres",
    "Efectivas mujeres", "Avance muestra mujeres",
    "Muestra", "Faltantes muestra",
    "Muestra hombres", "Faltantes hombres muestra",
    "Muestra mujeres", "Faltantes mujeres muestra",
    "Sobremuestra", "Faltantes sobremuestra",
    "Sobremuestra hombres", "Faltantes hombres sobremuestra",
    "Sobremuestra mujeres", "Faltantes mujeres sobremuestra",
    "Aulas aplicadas"
  ),
  rendimiento = c(
    "Facultad", "Aulas aplicadas", "Aulas planificadas",
    # Las dos tasas en ENCUESTAS antes que en porcentaje (Gonzalo, 2026-09-08:
    # «las esperadas hasta ahora en base a las aulas aplicadas hasta hoy y la
    # tasa de rendimiento de facultad, y cuántas vamos»). Una tasa dice si el
    # aula rinde; el conteo dice cuántas encuestas son, que es lo que se recoge.
    #
    # **La meta abre su bloque, no cierra la tabla** (Gonzalo, 2026-09-08: «hay
    # que intercalar bien el orden de las columnas para que sea fácilmente
    # comparable, no pongas las metas todas al final»). Cada meta va pegada a lo
    # que se lleva contra ella y a la diferencia, y el juego se repite tal cual
    # en hombres y en mujeres: el ojo compara en horizontal sin contar columnas.
    "Muestra",
    "Efectivas esperadas", "Efectivas obtenidas", "Diferencia de efectivas",
    "Muestra hombres",
    "Efectivas esperadas hombres", "Efectivas obtenidas hombres",
    "Diferencia de efectivas hombres",
    "Muestra mujeres",
    "Efectivas esperadas mujeres", "Efectivas obtenidas mujeres",
    "Diferencia de efectivas mujeres",
    "Tasa de rendimiento de la facultad esperada",
    "Tasa de rendimiento de la facultad obtenida",
    "Diferencia de tasa",
    "Aulas adicionales solicitadas hasta el momento"
  ),
  aplicador = c(
    "Facultad", "Aplicador", "Aulas aplicadas",
    "Fichas en la base", "Fichas faltantes",
    "Tasa de rendimiento esperada en facultad",
    "Tasa de rendimiento obtenida",
    "Aplicaciones regulares", "Aplicaciones especial mañana",
    "Aplicaciones especial noche"
  ),
  diario = c(
    "Facultad", "Día", "Día de la semana",
    "Efectivas del día", "Efectivas esperadas", "Diferencia de efectivas",
    "Efectivas acumuladas", "Faltantes para la meta",
    "Tasa de rendimiento de la facultad esperada",
    "Tasa de rendimiento de la facultad obtenida",
    "Diferencia de tasa"
  )
)

#' Qué campo del modelo (`aulas_libro_indicadores()`) lleva cada tabla.
#'
#' No es redundante con `AULAS_AVANCE_CABECERAS`: la clave de la tabla es
#' singular («facultad», «aplicador») porque nombra UNA fila de la tabla, y el
#' campo del modelo va en plural porque nombra la colección. Vivía implícito, y
#' `ind[["facultad"]]` devolvía NULL sin avisar: el ancho de la hoja del xlsx
#' salía de 10 columnas en vez de 17 y todas las bandas y notas se quedaban
#' cortas. Aquí está escrito, y hay un test que exige que los cinco campos
#' existan en el modelo.
#' @keywords internal
AULAS_AVANCE_CAMPOS <- c(
  general = "general", facultad = "facultades", rendimiento = "rendimiento",
  aplicador = "aplicadores", diario = "diario"
)

#' El título de bloque de cada tabla, en el orden en que se publican.
#' @keywords internal
AULAS_AVANCE_TITULOS <- c(
  general = "Avance general",
  facultad = "Avance por facultad",
  rendimiento = "Rendimiento por facultad",
  aplicador = "Producción por aplicador",
  diario = "Avance diario"
)

#' Las FILAS de «Avance general», que es la única tabla traspuesta.
#'
#' Una fila por concepto y una columna por sexo, así que su naturaleza —qué es
#' porcentaje, qué es meta cubierta— se decide por FILA y no por columna.
#' @keywords internal
AULAS_AVANCE_FILAS_GENERAL <- c(
  "Efectivas", "Muestra", "Avance muestra", "Faltantes para la muestra",
  "Sobremuestra", "Avance sobremuestra", "Faltantes para la sobremuestra",
  "Aulas aplicadas", "Aulas asignadas", "Aulas planificadas"
)

# --- La naturaleza de cada rótulo --------------------------------------------
#
# Cuatro familias, y cada una decide a la vez el formato de número y la regla de
# color. Se nombran por rótulo y NUNCA por posición: insertar una columna no
# puede mover un porcentaje a la columna de al lado (pasó, y salió publicado un
# techo de 188 aulas pintado como «18800,0 %»).

#' Rótulos cuya celda es una PROPORCIÓN: numFmt de porcentaje, valor 0–1.
#'
#' Gonzalo: «los que tienen un (%) no se pone en el titulo, es el formato de la
#' celda». Ningún rótulo de esta lista lleva «(%)».
#'
#' **Va POR TABLA y no por rótulo suelto, y eso no es burocracia.** «Diferencia»
#' se llama igual en dos tablas y no es lo mismo: en «Rendimiento por facultad»
#' es la resta de dos tasas —puntos porcentuales— y en «Avance diario» es la
#' resta de dos conteos de encuestas. Con una lista plana, el −35 encuestas del
#' martes de Derecho salía publicado como «−3 500,0 %». Se vio en la primera
#' corrida de humo, antes de publicar; con la lista por tabla no puede volver.
#' @keywords internal
AULAS_AVANCE_PROPORCIONES <- list(
  general = c("Avance muestra", "Avance sobremuestra"),
  facultad = c("Avance muestra", "Avance muestra hombres", "Avance muestra mujeres"),
  rendimiento = c(
    "Tasa de rendimiento de la facultad esperada",
    "Tasa de rendimiento de la facultad obtenida",
    "Diferencia de tasa"
  ),
  aplicador = c(
    "Tasa de rendimiento esperada en facultad",
    "Tasa de rendimiento obtenida"
  ),
  diario = c(
    "Tasa de rendimiento de la facultad esperada",
    "Tasa de rendimiento de la facultad obtenida",
    "Diferencia de tasa"
  )
)

#' Rótulos que son una DIFERENCIA con signo: verde si es a favor, rojo si no.
#'
#' «las diferencia positivas (nos fue mejor de lo esperado) deben estar pintadas
#' en escalas de verde y en los que la diferencia sea negativa que vayan en
#' escalas de rojo».
#'
#' **El nombre dice la unidad, y eso no es cosmética.** Se llamaban las dos
#' «Diferencia» y significaban cosas distintas —encuestas en el avance diario,
#' puntos porcentuales en el rendimiento—; con la lista de proporciones plana,
#' el −35 encuestas de un martes salió como «−3 500,0 %». Ahora el rótulo lleva
#' su unidad y la ambigüedad no puede volver por otro camino.
#' @keywords internal
AULAS_AVANCE_DIFERENCIAS <- c(
  "Diferencia de efectivas", "Diferencia de tasa",
  "Diferencia de efectivas hombres", "Diferencia de efectivas mujeres"
)

#' Rótulos de AVANCE contra una meta: se pintan como un depósito que se llena.
#'
#' Gonzalo pidió primero «de rojo hasta verde y luego celeste» y se corrigió él
#' mismo en el mensaje siguiente: «quizás otra forma de mostrarlo, porque rojo
#' da a entender que es algo malo cuando puede ser sólo que recién esté
#' empezando». Tiene razón y por eso estos rótulos NO llevan rojo.
#'
#' Un avance del 19,8 % en el día 2 de un operativo de tres semanas no es malo:
#' es el día 2. La diferencia contra lo esperado sí admite un veredicto —ahí el
#' rojo es honesto y se conserva—; el avance contra el total sólo admite «cuánto
#' llevas». Va de un gris muy claro al verde en el 100 %, y al pasarse, celeste.
#' @keywords internal
AULAS_AVANCE_AVANCES <- c(
  "Avance muestra", "Avance sobremuestra",
  "Avance muestra hombres", "Avance muestra mujeres"
)

#' Rótulos donde un CERO significa «esta celda ya cubrió la MUESTRA» → verde.
#' @keywords internal
AULAS_AVANCE_FALTAN_MUESTRA <- c(
  "Faltantes para la muestra", "Faltantes muestra",
  "Faltantes hombres muestra", "Faltantes mujeres muestra",
  "Faltantes para la meta",
  # Cero fichas faltantes = todas sus aulas aplicadas llegaron a SU meta. Es la
  # misma noticia dicha sobre el aula en vez de sobre la cuota.
  "Fichas faltantes"
)

#' Rótulos donde un CERO significa «esta celda ya cubrió la SOBREMUESTRA» → celeste.
#' @keywords internal
AULAS_AVANCE_FALTAN_SOBREMUESTRA <- c(
  "Faltantes para la sobremuestra", "Faltantes sobremuestra",
  "Faltantes hombres sobremuestra", "Faltantes mujeres sobremuestra"
)

#' ¿Este rótulo es una proporción EN ESTA TABLA?
#'
#' Sin `tabla` la respuesta es «en alguna lo es», que sirve para heurísticas de
#' presentación pero NUNCA para decidir un numFmt: ahí siempre se pasa la tabla.
#' @keywords internal
.calac_es_proporcion <- function(rotulo, tabla = NULL) {
  r <- trimws(as.character(rotulo %||% ""))
  if (!length(r) || !nzchar(r)) return(FALSE)
  lista <- if (is.null(tabla) || !nzchar(tabla)) {
    unlist(AULAS_AVANCE_PROPORCIONES, use.names = FALSE)
  } else {
    AULAS_AVANCE_PROPORCIONES[[tabla]] %||% character(0)
  }
  r %in% lista
}

#' A qué tabla pertenece una fila de cabecera, por su cabecera COMPLETA.
#'
#' Tres tablas empiezan por «Facultad», así que la primera celda no basta: se
#' compara la fila entera contra las cabeceras declaradas. Devuelve `""` cuando
#' la fila no es cabecera de ninguna.
#' @keywords internal
.calac_tabla_de_cabecera <- function(celdas) {
  celdas <- trimws(as.character(celdas %||% character(0)))
  celdas <- celdas[seq_len(max(0L, max(c(0L, which(nzchar(celdas))))))]
  for (nombre in names(AULAS_AVANCE_CABECERAS)) {
    if (identical(celdas, AULAS_AVANCE_CABECERAS[[nombre]])) return(nombre)
  }
  ""
}
