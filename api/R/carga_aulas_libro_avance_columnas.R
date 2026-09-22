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
    # **Las tres de aulas, pegadas a «Efectivas»** (dictado 2026-09-15: «que la
    # columna de aulas aplicadas esté a su derecha y también la de aulas
    # planificadas para que podamos ver si se están aplicando el número que se
    # tenía previsto o más incluso, partiendo del hecho que se han pedido
    # refuerzos»). «Aulas aplicadas» cerraba la tabla veinte columnas más allá,
    # donde no se compara con nada.
    #
    # «Aulas proyectadas al cierre» es la suma de las aplicadas y las que ya
    # tienen fecha: cuántas habrá cuando el operativo termine si todo lo
    # agendado se aplica. Contra «Aulas planificadas» dice de un vistazo si una
    # facultad va a cerrar por encima de su plan —que es lo que los refuerzos
    # buscan— o por debajo.
    # **«originalmente» no es adorno** (dictado 2026-09-16): es lo que separa
    # las dos cuentas que ahora van pegadas. Las planificadas son las que el
    # sorteo asignó y NO se mueven; las proyectadas cambian cada día con lo que
    # se agenda. Llamándolas las dos «aulas» y ya, la columna de la izquierda se
    # leía como «las que quedan por hacer».
    "Aulas aplicadas", "Aulas planificadas originalmente", "Aulas proyectadas al cierre",
    # Y la resta, que es la pregunta (dictado 2026-09-16, con la hoja
    # publicada delante): «hay que diferenciar cuántas se tenían planificadas
    # originalmente de cuántas se tienen proyectadas al cierre; puede ser que
    # hayamos o vayamos a aplicar más o menos». Las dos columnas ya estaban
    # juntas y aun así había que hacer la resta con el ojo, quince veces.
    #
    # **No se llama «Diferencia».** Ese rótulo está reservado a las diferencias
    # con signo que el semáforo pinta de verde y rojo, y aquí pasarse del plan
    # no es bueno ni malo: una facultad con refuerzos cierra por encima porque
    # sus aulas rindieron poco. El número lleva su signo; el color, no.
    "Aulas sobre el plan",
    "Efectivas hombres", "Avance muestra hombres",
    "Efectivas mujeres", "Avance muestra mujeres",
    "Muestra", "Faltantes muestra",
    "Muestra hombres", "Faltantes hombres muestra",
    "Muestra mujeres", "Faltantes mujeres muestra",
    "Sobremuestra", "Faltantes sobremuestra",
    "Sobremuestra hombres", "Faltantes hombres sobremuestra",
    "Sobremuestra mujeres", "Faltantes mujeres sobremuestra"
  ),
  rendimiento = c(
    "Facultad", "Aulas aplicadas", "Aulas planificadas originalmente",
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
    # **CADA COLUMNA NOMBRA SU BASE** (Gonzalo, 2026-09-22, sobre la hoja
    # publicada: «esto sigue mintiendo»). Se llamaba «Efectivas obtenidas» y
    # contaba TODOS los cuestionarios aplicados en un aula, mientras el bloque
    # del eje —dos tablas más arriba, en el mismo documento— decía «86 de 400»
    # contando sólo las que caen en una celda de la cuota. 114 contra 86, los dos
    # rótulos casi iguales, ninguno diciendo sobre qué contaba, y la diferencia
    # pintada en VERDE: quien abría la hoja entendía que iba doce puntos sobrado
    # cuando iba por debajo.
    #
    # **El vocabulario es el del diseño muestral del estudio**, no uno inventado
    # (Gonzalo: «cuidado con el uso de jergas para explicar estos términos, es
    # una investigación formal»): cuestionarios aplicados, entrevistas
    # efectivas, casos fuera del universo, casos no resueltos. La cadena que el
    # marco declara es asistencia × respuesta × validez → efectividad.
    #
    # **Las tres disposiciones que no son entrevista efectiva van en columnas
    # distintas y nunca bajo un rótulo común.** Los casos fuera del universo no
    # son pérdida —no pertenecen a la población medida y no entran en el
    # denominador de la efectividad—; los no resueltos sí se recuperan
    # preguntando; y un duplicado es una persona del universo que contestó dos
    # veces, que no es ninguna de las dos cosas. Juntarlos invita a sumar cosas
    # que no se suman, y además deja la fila sin cuadrar con sus partes.
    #
    # Las tres del medio sólo existen cuando el eje se atribuye por PERSONA: con
    # el eje en el aula todo cuestionario de un aula aplicada es una entrevista
    # efectiva de su celda y no hay disposición que repartir
    # (`carga_aulas_libro_avance_declaradas.R`).
    "Efectivas esperadas",
    "Cuestionarios aplicados", "Entrevistas efectivas",
    "Casos fuera del universo", "Casos no resueltos", "Casos duplicados",
    "Diferencia de efectivas",
    "Muestra hombres",
    "Efectivas esperadas hombres", "Cuestionarios aplicados hombres",
    "Diferencia de efectivas hombres",
    "Muestra mujeres",
    "Efectivas esperadas mujeres", "Cuestionarios aplicados mujeres",
    "Diferencia de efectivas mujeres",
    "Tasa de rendimiento de la facultad esperada",
    "Tasa de rendimiento de la facultad obtenida",
    "Diferencia de tasa",
    "Aulas adicionales solicitadas hasta el momento"
  ),
  aplicador = c(
    "Facultad", "Aplicador",
    # **«Asignadas» antes que «aplicadas», y «esperadas» antes que «en la
    # base».** Las dos son añadidos al dictado, no reemplazos, y existen porque
    # sin ellas la tabla no se deja leer: el 2026-09-08 tenía 72 filas y sólo 14
    # con un aula aplicada. Las otras 58 salían con ceros y tasas vacías, y no
    # había forma de distinguir a quien va retrasado de quien todavía no tiene
    # nada que hacer — la fila es idéntica. Con «Aulas asignadas» al lado, un
    # «0 de 3» dice «le tocan tres» y un «0 de 0» dice «no le toca nada».
    #
    # «Efectivas esperadas» hace lo mismo por «Efectivas faltantes»: una brecha
    # sin su denominador es un número suelto. Es la misma cifra que «Efectivas
    # esperadas» de «Rendimiento por facultad», restringida a las aulas de esa
    # persona.
    #
    # **Estas tres se llamaban «Fichas …», y el nombre estaba mal.** Venía del
    # dictado con el que se pidió la tabla, pero el 2026-09-09 Gonzalo fijó qué
    # es una ficha en este operativo: «la ficha es solo una por CH… es si el
    # coordinador de campo registró manualmente lo que el aplicador llenó en su
    # ficha en papel y el coordinador lo ingresa al sheets de registro de campo
    # aulas aplicadas». Es decir, UNA por curso-horario, y de papel.
    #
    # Lo que estas columnas cuentan son ENCUESTAS EFECTIVAS de la plataforma:
    # decenas por aula. Publicado, «Efectivas en la base: 27» junto a «Aulas
    # aplicadas: 3» se leía como veintisiete fichas de tres aulas. Y el resto
    # del libro ya usaba «ficha» en el sentido de él —«ENLACE DE LA FICHA»,
    # «FICHA QR», «Fichas PDF/Word»—, así que la palabra significaba dos cosas
    # a la vez dentro del mismo documento.
    #
    # Se renombran al vocabulario que «Rendimiento por facultad» y «Avance
    # diario» ya usaban para esta misma cifra. La DEFINICIÓN no cambia: sigue
    # siendo lo que sus aulas ya aplicadas rindieron por debajo de lo esperado,
    # sin compensar entre aulas.
    "Aulas asignadas", "Aulas aplicadas",
    "Efectivas esperadas", "Efectivas en la base", "Efectivas faltantes",
    "Tasa de rendimiento esperada en facultad",
    "Tasa de rendimiento obtenida",
    # **La diferencia va AQUÍ, entre sus dos términos y la siguiente sección.**
    # Sus dos tablas hermanas —«Rendimiento por facultad» y «Avance diario»— ya
    # la traen pegada a las dos tasas; ésta obligaba a restar de cabeza para
    # contestar lo único que la fila se pregunta: si esta persona va por encima
    # o por debajo de lo que su facultad espera. Es el mismo dictado que ordenó
    # las columnas de la hermana («hay que intercalar bien el orden de las
    # columnas para que sea fácilmente comparable, no pongas las metas todas al
    # final»), aplicado a la que se quedó sin él.
    "Diferencia de tasa",
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
  "Aulas aplicadas", "Aulas asignadas", "Aulas planificadas originalmente"
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
    "Tasa de rendimiento obtenida",
    "Diferencia de tasa"
  ),
  diario = c(
    "Tasa de rendimiento de la facultad esperada",
    "Tasa de rendimiento de la facultad obtenida",
    "Diferencia de tasa"
  ),
  # «Cobertura» (`carga_aulas_libro_avance_cobertura.R`) es UNA cabecera para N
  # tablas —una por dimensión descriptiva— así que no entra en
  # `AULAS_AVANCE_CABECERAS`, que es un mapa 1:1. Sus proporciones sí viven
  # aquí: es lo que hace que los dos renderers y el formateador de Sheets le den
  # formato de porcentaje sin saber nada de este bloque.
  cobertura = c("% de la población", "% de lo alcanzado")
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
  "Efectivas faltantes"
)

#' Rótulos donde un CERO significa «esta celda ya cubrió la SOBREMUESTRA» → celeste.
#' @keywords internal
AULAS_AVANCE_FALTAN_SOBREMUESTRA <- c(
  "Faltantes para la sobremuestra", "Faltantes sobremuestra",
  "Faltantes hombres sobremuestra", "Faltantes mujeres sobremuestra"
)

#' Los rótulos cuya celda es TEXTO: ni conteo ni proporción.
#'
#' Se declaran porque la naturaleza de una columna no puede inferirse de sus
#' valores. La versión anterior lo hacía —«una columna sin ninguna cifra
#' publicada es de texto»— y con eso **una columna sin formato propio se queda
#' con el que tuviera esa celda en la publicación anterior**: el 2026-09-22 la
#' hoja salió con «Casos fuera del universo 27» pintado «2700,0 %» y la tasa
#' esperada 0,6651 pintada «1», porque las tablas se movieron de sitio al ganar
#' columnas y bloques, y Google conserva el formato de la celda que había
#' debajo. Los valores eran correctos y la hoja mentía igual.
#'
#' La primera columna se declara con su rótulo del vocabulario; el satélite del
#' eje puede publicarla como «Nivel» o «Carrera» y
#' [.calac_naturaleza()] lo resuelve.
#' @keywords internal
AULAS_AVANCE_TEXTO <- list(
  general = "Indicadores",
  facultad = "Facultad",
  rendimiento = "Facultad",
  aplicador = c("Facultad", "Aplicador"),
  diario = c("Facultad", "Día", "Día de la semana"),
  cobertura = "Categoría"
)

#' La naturaleza declarada de un rótulo en SU tabla.
#'
#' @param rotulo el rótulo publicado.
#' @param tabla la clave de la tabla.
#' @return `"texto"`, `"proporcion"`, `"conteo"` o `""` cuando el rótulo no
#'   pertenece al vocabulario de esa tabla — y entonces no se le inventa un
#'   formato: se publica sin tocar y hay un test que lo caza antes.
#' @keywords internal
.calac_naturaleza <- function(rotulo, tabla) {
  r <- trimws(as.character(rotulo %||% "")[1])
  t <- as.character(tabla %||% "")[1]
  if (!nzchar(r) || !nzchar(t)) return("")
  texto <- AULAS_AVANCE_TEXTO[[t]] %||% character(0)
  # La primera celda puede venir con la palabra del eje del estudio.
  if (r %in% texto) return("texto")
  if (length(texto) && identical(texto[[1]], .CALAE_CELDA_POR_DEFECTO) &&
      r %in% .calae_primeras_celdas()) {
    return("texto")
  }
  if (.calac_es_proporcion(r, t)) return("proporcion")
  universo <- if (identical(t, AULAS_COBERTURA_CLAVE)) {
    AULAS_COBERTURA_CABECERAS
  } else if (identical(t, "general")) {
    c(AULAS_AVANCE_CABECERAS$general, AULAS_AVANCE_FILAS_GENERAL)
  } else {
    AULAS_AVANCE_CABECERAS[[t]] %||% character(0)
  }
  if (r %in% universo) return("conteo")
  ""
}

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
#'
#' **Y contra todas las GRAFÍAS de cada una**, no sólo contra la constante: un
#' documento escrito con el eje de cuotas en nivel trae «Nivel» donde la
#' constante dice «Facultad» (`carga_aulas_libro_avance_eje.R`). Sin iterarlas,
#' ese documento pierde color y ancho **sin fallar** al republicarse, que es el
#' fallo mudo que el satélite del eje existe para evitar. La constante se
#' compara PRIMERO, así que el camino de siempre no paga nada.
#' @keywords internal
.calac_tabla_de_cabecera <- function(celdas) {
  celdas <- trimws(as.character(celdas %||% character(0)))
  celdas <- celdas[seq_len(max(0L, max(c(0L, which(nzchar(celdas))))))]
  for (nombre in names(AULAS_AVANCE_CABECERAS)) {
    if (identical(celdas, AULAS_AVANCE_CABECERAS[[nombre]])) return(nombre)
  }
  for (nombre in names(AULAS_AVANCE_CABECERAS)) {
    for (variante in .calae_cabeceras_posibles(nombre)) {
      if (identical(celdas, variante)) return(nombre)
    }
  }
  # «Cobertura»: una cabecera para las N tablas del bloque. No está en
  # `AULAS_AVANCE_CABECERAS` —ese mapa es 1:1— así que se compara aparte.
  if (identical(celdas, AULAS_COBERTURA_CABECERAS)) return(AULAS_COBERTURA_CLAVE)
  # **Y las cabeceras RECORTADAS.**
  #
  # Desde que las columnas se derivan de lo que el estudio declara
  # (`carga_aulas_libro_avance_declaradas.R`), un estudio sin sobremuestra y sin
  # cuota de sexo publica cinco de las veintitrés de «Avance por facultad», doce
  # de las dieciocho del rendimiento y dos de las cuatro del general. Ninguna
  # comparación literal las reconoce, y este reverso es el que decide si una
  # fila es cabecera: sin él la tabla se queda **sin banda, sin anchos y sin
  # color, en silencio** — el mismo fallo mudo que el satélite del eje vino a
  # evitar, por la otra puerta.
  .calac_recorte_de(celdas)
}

# A qué tabla pertenece una cabecera RECORTADA, o `""`.
#
# Se acepta como recorte lo que es subconjunto EN ORDEN de una constante, con la
# primera celda en cualquiera de las grafías de su eje. **Y sólo si encaja en
# UNA**: ante dos candidatas devuelve `""` y la tabla se queda sin formato, que
# es lo que ya pasaba antes de esto. Heredar el formato de la tabla equivocada
# —un porcentaje sobre un conteo, «18800,0 %»— es estrictamente peor que no
# tener formato.
.calac_recorte_de <- function(celdas) {
  if (length(celdas) < 2L) return("")
  candidatas <- character(0)
  for (nombre in names(AULAS_AVANCE_CABECERAS)) {
    base <- AULAS_AVANCE_CABECERAS[[nombre]]
    if (length(celdas) >= length(base)) next
    primeras <- if (identical(as.character(base[[1]]), .CALAE_CELDA_POR_DEFECTO)) {
      .calae_primeras_celdas()
    } else base[[1]]
    if (!(celdas[[1]] %in% primeras)) next
    resto <- celdas[-1]
    if (!all(resto %in% base[-1])) next
    # En ORDEN: las posiciones que ocupan en la constante tienen que crecer.
    if (is.unsorted(match(resto, base[-1]), strictly = TRUE)) next
    candidatas <- c(candidatas, nombre)
  }
  if (length(candidatas) == 1L) candidatas else ""
}
