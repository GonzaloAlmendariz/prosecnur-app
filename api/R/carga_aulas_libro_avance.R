# La hoja «Avance de campo» como celdas para Sheets — unidad B2.2.
#
# El xlsx la escribe IMPERATIVO (`aulas_libro_escribir_indicadores`, celda a
# celda con openxlsx) y el publicador del libro sólo habla con generadores
# modelo→filas. Este renderer es el otro camino: el MISMO modelo de
# `aulas_libro_indicadores()` —las cinco tablas dictadas— como filas de celdas
# que el motor de publicación adapta una a una.
#
# TRES DECISIONES QUE ESTA HOJA RESUELVE, Y UNA QUE CAMBIÓ HOY
#
#   · **La fecha del corte jamás sale del reloj.** El imperativo escribe «Al
#     DD/MM/YYYY» con `Sys.Date()` y por eso el xlsx cambia de un día para otro.
#     La pestaña publicada viaja por el motor batch+hash: si leyera el reloj, dos
#     publicaciones del MISMO estado en días distintos darían hashes distintos y
#     la hoja se reescribiría sin que nada haya cambiado. `fecha` se inyecta; sin
#     inyección se DERIVA del modelo (el último día del avance diario), y sin
#     diario la celda declara por qué no hay corte fechado (C3).
#
#   · **Un vacío se declara, nunca se calla.** Una sección sin datos conserva su
#     título y dice por qué está vacía: en una pestaña que convive con la Base de
#     control llena, la ausencia se leería como retiro y no como falta de dato.
#
#   · **LAS CIFRAS VIAJAN COMO NÚMEROS.** Hasta el 2026-09-08 esta hoja emitía
#     TEXTO —«480», «19.2 %»— porque el libro publica en RAW y nadie le pedía
#     formato a la pestaña. Gonzalo, ese día: «los que tienen un (%) no se pone
#     en el título, es el formato de la celda», y además pidió color que siga al
#     valor. Ninguna de las dos cosas existe sobre una celda de texto: no hay
#     numFmt que aplicar ni condición numérica que comparar, y encima la columna
#     no se puede ordenar ni sumar en el propio Sheets. Así que las cifras salen
#     como números y el formato lo pone `monitoreo_aulas_avance_formato.R`. Las
#     proporciones salen entre 0 y 1, que es lo que el numFmt de porcentaje
#     espera; escribir 19.2 con formato de porcentaje daría «1920 %».
#
# Lo que NO cambia: el «—» de una celda sin dato. Sin dato y cero son dos
# noticias distintas, y en Sheets un hueco se lee como «se olvidaron».

# El vacío declarado de una celda numérica. Es texto a propósito: una celda que
# dice «—» no puede confundirse con un cero ni entrar en una regla de color.
.CALA_SIN_DATO <- "—"

# Número → celda. Los conteos salen enteros del modelo; lo fraccionario legítimo
# (una tasa, una media) conserva su precisión útil. Cuatro decimales en las
# proporciones porque el porcentaje se muestra con uno: 0.1923 → «19,2 %».
.cala_celda_num <- function(v, proporcion = FALSE) {
  x <- suppressWarnings(as.numeric(v))
  if (length(x) != 1L || !is.finite(x)) return(.CALA_SIN_DATO)
  if (isTRUE(proporcion)) return(round(x, 4))
  if (abs(x - round(x)) < 1e-9) return(round(x))
  round(x, 2)
}

# Una tabla del modelo como filas de celdas: la cabecera con sus nombres y cada
# celda según la naturaleza de SU RÓTULO, que decide el vocabulario compartido
# (`carga_aulas_libro_avance_columnas.R`).
#
# `traspuesta` es «Avance general», la única tabla con una fila por concepto: ahí
# la naturaleza se decide por FILA y no por columna, porque sus proporciones
# viven en dos renglones y no en una columna.
.cala_tabla_filas <- function(tabla, clave, traspuesta = FALSE) {
  if (!is.data.frame(tabla) || !nrow(tabla)) return(list())
  nombres <- names(tabla)
  filas <- lapply(seq_len(nrow(tabla)), function(i) {
    pct_fila <- traspuesta && .calac_es_proporcion(tabla[[1L]][[i]], clave)
    celdas <- lapply(seq_along(nombres), function(j) {
      v <- tabla[[j]][[i]]
      if (is.character(tabla[[j]])) return(trimws(as.character(v %||% "")))
      .cala_celda_num(v, proporcion = pct_fila || .calac_es_proporcion(nombres[[j]], clave))
    })
    celdas
  })
  c(list(as.list(nombres)), filas)
}

#' Arma la hoja «Avance de campo» del libro como filas de celdas para Sheets.
#'
#' @param ind el modelo de `aulas_libro_indicadores()`: las cinco tablas
#'   (`general`, `facultades`, `rendimiento`, `aplicadores`, `diario`) más
#'   `meta`.
#' @param fecha `Date` del corte, inyectada por quien publica. `NULL` deriva el
#'   corte del propio modelo (el último día del avance diario); sin diario la
#'   celda del corte declara la causa. Nunca se consulta el reloj aquí.
#' @return lista de filas; cada fila es una lista de celdas que pueden ser texto
#'   o NÚMERO. No es un data.frame a propósito: un data.frame de caracteres no
#'   puede llevar los dos tipos, y el tipo es justo lo que hace posible el
#'   formato de porcentaje y el color por valor.
#' @export
aulas_libro_hoja_avance <- function(ind, fecha = NULL) {
  ind <- if (is.list(ind)) ind else list()

  # El corte: inyectado, o derivado del último día del diario (ISO ordena
  # lexicográfico = cronológico). Sin ninguno de los dos, la causa en la celda.
  if (is.null(fecha) || !length(fecha)) {
    dias <- if (is.data.frame(ind$diario) && nrow(ind$diario)) {
      as.character(ind$diario[["Día"]])
    } else {
      character(0)
    }
    dias <- dias[!is.na(dias) & nzchar(dias)]
    fecha <- if (length(dias)) max(dias) else NULL
  }
  fecha <- if (is.null(fecha)) as.Date(NA) else suppressWarnings(as.Date(fecha[[1]]))
  corte <- if (length(fecha) == 1L && !is.na(fecha)) {
    paste("Al", format(fecha, "%d/%m/%Y"))
  } else {
    "Sin fecha de corte: el avance diario aun no trae respuestas de plataforma fechadas."
  }

  filas <- list()
  poner <- function(...) {
    celdas <- list(...)
    if (length(celdas) == 1L && is.list(celdas[[1]])) celdas <- celdas[[1]]
    filas[[length(filas) + 1L]] <<- celdas
  }

  poner("Avance de campo")
  poner(corte)
  poner("")

  # Un bloque: título, nota de arriba, tabla, cierre opcional, nota de abajo.
  # Los cinco se escriben con la misma rutina para que ninguno se quede sin su
  # vacío declarado ni sin su cabecera reconocible por el formateador.
  bloque <- function(clave, tabla, nota_arriba = NULL, nota_abajo = NULL,
                     vacio = NULL, con_total = FALSE, traspuesta = FALSE) {
    poner(AULAS_AVANCE_TITULOS[[clave]])
    if (!is.data.frame(tabla) || !nrow(tabla)) {
      if (!is.null(vacio)) poner(vacio)
      poner("")
      return(invisible(NULL))
    }
    if (!is.null(nota_arriba)) poner(nota_arriba)
    for (f in .cala_tabla_filas(tabla, clave, traspuesta = traspuesta)) poner(f)
    if (isTRUE(con_total)) {
      total <- .calaf_fila_total(tabla)
      if (!is.null(total)) poner(.cala_tabla_filas(total, clave)[[2]])
    }
    if (!is.null(nota_abajo)) poner(nota_abajo)
    poner("")
    invisible(NULL)
  }

  # --- 1. AVANCE GENERAL ------------------------------------------------------
  if (is.data.frame(ind$general) && nrow(ind$general)) {
    bloque("general", ind$general, nota_arriba = .calam_titular(ind$facultades),
           traspuesta = TRUE)
  } else {
    # Sin cuotas del diseño la tabla no se puede derivar (la cuota no se
    # reconstruye) y queda el bloque de siempre, que es lo único computable.
    m <- if (is.list(ind$meta)) ind$meta else list()
    poner(AULAS_AVANCE_TITULOS[["general"]])
    sin_dato <- 0L
    for (f in list(list("Encuestas de la meta", m$meta_total, FALSE),
                   list("Efectivas conseguidas", m$logrado, FALSE),
                   list("Avance", m$avance, TRUE),
                   list("Faltan", m$falta, FALSE),
                   list("Aulas del operativo", m$aulas, FALSE))) {
      celda <- .cala_celda_num(f[[2]], proporcion = isTRUE(f[[3]]))
      if (identical(celda, .CALA_SIN_DATO)) sin_dato <- sin_dato + 1L
      poner(f[[1]], celda)
    }
    if (sin_dato) {
      poner("Estas cifras salen de la plataforma, no del parte de campo: se llenan al cargar la base de respuestas.")
    }
    poner("")
  }

  # --- 2. AVANCE POR FACULTAD -------------------------------------------------
  bloque(
    "facultad", ind$facultades,
    nota_arriba = "La cuota es de cada facultad y de cada sexo: pasarse en una no cubre lo que falta en otra.",
    nota_abajo = if (is.data.frame(ind$facultades) && nrow(ind$facultades)) {
      .calaf_nota_metas(ind$facultades)
    } else NULL,
    vacio = "El estudio todavía no publica cuotas por facultad, así que no hay contra qué medir el avance.",
    con_total = TRUE
  )

  # --- 3. RENDIMIENTO POR FACULTAD --------------------------------------------
  bloque(
    "rendimiento", ind$rendimiento,
    nota_arriba = paste(
      "La tasa obtenida se mide sobre los elegibles de las aulas YA APLICADAS, no",
      "sobre el plan entero: así dice cómo rinden las aulas a las que se fue, y no",
      "que todavía queda por ir — eso ya lo dicen las dos primeras columnas."
    ),
    vacio = "El plan todavía no trae facultades con aulas que medir."
  )

  # --- 4. PRODUCCIÓN POR APLICADOR --------------------------------------------
  bloque(
    "aplicador", ind$aplicadores,
    nota_arriba = paste(
      "Una fila por persona EN CADA FACULTAD: la tasa esperada es la de la facultad,",
      "y quien cubre dos se mide contra la vara de cada una.",
      "«Fichas faltantes» es lo que sus aulas ya aplicadas rindieron por debajo de lo",
      "esperado; sobre las que aún no aplica no falta ninguna ficha, falta ir."
    ),
    vacio = .cali_motivo_sin_aplicadores()
  )

  # --- 5. AVANCE DIARIO -------------------------------------------------------
  bloque(
    "diario", ind$diario,
    nota_arriba = paste(
      "Una fila por facultad y día. Las efectivas esperadas son las de las aulas",
      "aplicadas ESE día, y el día de aplicación sale de la plataforma (la primera",
      "jornada en que el aula produjo una efectiva), no del parte."
    ),
    vacio = .cali_motivo_sin_diario(ind)
  )

  # Rectángulo uniforme: el motor de publicación lo volvería a rellenar, pero
  # el formateador deriva de aquí sus anchos y sus rangos y necesita filas de
  # la misma longitud para no salirse de la tabla.
  ancho <- max(1L, max(vapply(filas, length, integer(1))))
  lapply(filas, function(f) {
    if (length(f) < ancho) f <- c(f, rep(list(""), ancho - length(f)))
    f
  })
}
