# La facultad del AULA contra la que el alumno DECLARA — control de calidad.
#
# Pedido de Gonzalo (2026-09-14, textual): «hasta ahora hemos estado midiendo el
# avance de las facultades por la facultad establecida en la base, pero no hemos
# hecho el control sobre lo que los alumnos reportan, no hemos cruzado ambas»;
# y sobre la forma: «me gustaría que quedara en una hoja del excel como control
# de calidad para tenerlo de referencia».
#
# **Qué compara y por qué importa.** El avance por facultad se cuenta con la
# facultad del curso-horario —la que el diseño le puso—, y las cuotas son por
# facultad. Pero en un curso de Estudios Generales o en un electivo se sienta
# gente de otras: esa respuesta suma a la cuota del aula, no a la de quien
# respondió. Medido sobre HSVG2026 el 2026-09-14: de 1.390 respuestas
# comparables, **80 (5,8 %) declaran otra facultad**; los cruces más gruesos son
# Arte y Diseño ↔ Arquitectura en los dos sentidos, y Estudios Generales hacia
# la facultad de destino.
#
# **Es un control, no una reatribución.** La hoja NO cambia ningún conteo: pone
# los dos lados al lado y deja ver el desacuerdo. Reatribuir es una decisión
# metodológica y tiene su propio sitio (`reatribuciones` del config).
#
# **El estudio DECLARA su variable**, igual que con el sexo: sin
# `source_mapping$faculty_var` esta hoja no se produce. Adivinar cuál de las
# preguntas es la facultad —«P7» aquí, otra cosa en el siguiente estudio— sería
# inventar el dato que el control existe para vigilar.

# **No confundir con `monitoreo_aulas_control_facultad.R`**, que es su vecino y
# hace otra cosa: aquél ADOSA la facultad del plan a las filas de «Base de
# control» —un dato que la hoja del equipo no trae—. Éste CRUZA esa facultad
# contra la que declara quien respondió. Uno completa, el otro vigila.

#' ¿Son la misma facultad dos nombres que llegan de sitios distintos?
#'
#' El marco abrevia («CIENCIAS Y ARTES DE LA COMUN.») y el cuestionario no
#' («…COMUNICACIÓN»). Comparar el texto entero daba 65 falsos desacuerdos en
#' HSVG2026, y recortar a un número fijo de letras fundía «ESTUDIOS GENERALES
#' LETRAS» con «…CIENCIAS», que son dos. Se acepta como igual sólo si una es
#' PREFIJO de la otra con al menos diez caracteres: es justo lo que distingue
#' una abreviatura de dos facultades distintas.
#'
#' @param a,b nombres de facultad.
#' @return `TRUE`, `FALSE`, o `NA` si falta alguno.
#' @keywords internal
.mcfd_misma_facultad <- function(a, b) {
  na <- .mcfd_norm(a); nb <- .mcfd_norm(b)
  if (!nzchar(na) || !nzchar(nb)) return(NA)
  if (identical(na, nb)) return(TRUE)
  n <- min(nchar(na), nchar(nb))
  n >= 10L && identical(substr(na, 1L, n), substr(nb, 1L, n))
}

.mcfd_norm <- function(x) {
  k <- toupper(trimws(as.character(x %||% "")[1]))
  k <- suppressWarnings(iconv(k, to = "ASCII//TRANSLIT"))
  if (is.na(k)) return("")
  gsub("[^A-Z]", "", k)
}

#' El cruce entre la facultad del aula y la declarada por quien respondió.
#'
#' @param plan filas del plan.
#' @param responses `data.frame` de respuestas de la plataforma.
#' @param cfg config de aulas universitarias (`source_mapping$faculty_var` y,
#'   opcionalmente, `faculty_labels`: código declarado → nombre).
#' @return lista `{ok, comparables, coinciden, discrepan, por_facultad, pares,
#'   sin_aula, sin_declarar}`; `ok = FALSE` cuando el estudio no declara su
#'   variable o no hay con qué cruzar.
#' @export
monitoreo_aulas_cruce_facultad_declarada <- function(plan, responses, cfg = list()) {
  vacio <- function(motivo = "") list(
    ok = FALSE, motivo = motivo, comparables = 0L, coinciden = 0L, discrepan = 0L,
    por_facultad = list(), pares = list(), sin_aula = 0L, sin_declarar = 0L)
  if (!length(plan) || !is.data.frame(responses) || !nrow(responses)) {
    return(vacio("sin plan o sin respuestas"))
  }
  mapping <- cfg[["source_mapping"]] %||% list()
  var_fac <- .monitoreo_scalar(mapping[["faculty_var"]] %||% "", "")
  if (!nzchar(var_fac)) return(vacio("el estudio no declara su variable de facultad"))
  if (!(var_fac %in% names(responses))) {
    return(vacio(sprintf("la variable declarada («%s») no está en la base", var_fac)))
  }

  # Código de aula → facultad del marco. Es la misma resolución que usa el
  # resto del perfil, no una propia: la respuesta se ata a su aula por el
  # `collector_var` declarado.
  aula <- .monitoreo_aulas_response_classroom(responses, cfg)
  valid <- .monitoreo_aulas_valid_response(responses, cfg)
  del_marco <- new.env(parent = emptyenv())
  unidades <- if (is.data.frame(plan)) split(plan, seq_len(nrow(plan))) else plan
  for (u in unidades) {
    cod <- .monitoreo_scalar(u[["operational_code"]] %||% u[["classroom_id"]], "")
    if (nzchar(cod) && is.null(del_marco[[cod]])) {
      del_marco[[cod]] <- .monitoreo_scalar(u[["faculty"]], "")
    }
  }

  etiqueta <- .mcfd_etiquetas(mapping)
  crudo <- trimws(as.character(responses[[var_fac]]))
  declarada <- vapply(crudo, function(v) {
    if (is.na(v) || !nzchar(v)) return("")
    e <- etiqueta[[v]]
    if (is.null(e)) v else e
  }, character(1), USE.NAMES = FALSE)

  fac_aula <- vapply(as.character(aula), function(c) {
    v <- if (!is.na(c) && nzchar(c)) del_marco[[c]] else NULL
    if (is.null(v)) "" else v
  }, character(1), USE.NAMES = FALSE)

  # Sólo las válidas: una respuesta descartada no es un desacuerdo de campo.
  en_juego <- valid
  comparables <- en_juego & nzchar(fac_aula) & nzchar(declarada)
  if (!any(comparables)) return(vacio("ninguna respuesta tiene aula del plan y facultad declarada"))

  igual <- mapply(.mcfd_misma_facultad, fac_aula[comparables], declarada[comparables],
                  USE.NAMES = FALSE)
  igual[is.na(igual)] <- FALSE

  # **Si NADA coincide, lo que falla es la comparación, no el campo.** Se vio
  # generando el .xlsx de verdad en vez de mirar el motor: un estudio que
  # declara `faculty_var` pero no `faculty_labels` trae el código crudo («7»),
  # que no casa con ningún nombre del marco, y la hoja salía —bien formada,
  # sin fallar— diciendo «1.390 · 100,0 % DE OTRA FACULTAD». Un control que da
  # la alarma máxima porque está comparando un número contra un nombre es peor
  # que no tener control: se lee como una catástrofe de campo. Cero
  # coincidencias sobre cientos de comparables no ocurre en un operativo real;
  # ocurre cuando los dos lados hablan idiomas distintos.
  if (!any(igual)) {
    return(vacio(paste(
      "los dos lados no hablan el mismo idioma: ninguna de las",
      sum(comparables), "respuestas comparables casa con la facultad de su aula.",
      "Suele faltar `faculty_labels` (código declarado → nombre) en el mapping.")))
  }

  facs <- sort(unique(fac_aula[comparables]), method = "radix")
  por_facultad <- lapply(facs, function(f) {
    i <- .mcfd_norm(f) == vapply(fac_aula[comparables], .mcfd_norm, character(1),
                                 USE.NAMES = FALSE)
    # Declaradas: cuántas respuestas dicen SER de esta facultad, esté donde esté
    # el aula. Es el otro lado del control y lo que dice si la cuota se llena
    # por gente de fuera.
    j <- vapply(declarada[comparables], function(x) isTRUE(.mcfd_misma_facultad(x, f)),
                logical(1), USE.NAMES = FALSE)
    list(facultad = f, respuestas = sum(i), coinciden = sum(i & igual),
         discrepan = sum(i & !igual), declaradas = sum(j))
  })
  # Facultades que NADIE tiene como aula pero alguien declara: hoy son
  # invisibles en el avance por facultad, y es justo lo que hay que ver.
  solo_declaradas <- setdiff(
    unique(declarada[comparables]),
    unique(unlist(lapply(facs, function(f) {
      declarada[comparables][vapply(declarada[comparables], function(x)
        isTRUE(.mcfd_misma_facultad(x, f)), logical(1), USE.NAMES = FALSE)]
    })))
  )
  for (f in sort(solo_declaradas, method = "radix")) {
    j <- vapply(declarada[comparables], function(x) isTRUE(.mcfd_misma_facultad(x, f)),
                logical(1), USE.NAMES = FALSE)
    por_facultad[[length(por_facultad) + 1L]] <- list(
      facultad = f, respuestas = 0L, coinciden = 0L, discrepan = 0L,
      declaradas = sum(j))
  }

  pares <- if (any(!igual)) {
    p <- paste(fac_aula[comparables][!igual], "→", declarada[comparables][!igual])
    t <- sort(table(p), decreasing = TRUE)
    lapply(seq_along(t), function(i) list(par = names(t)[i], n = as.integer(t[[i]])))
  } else {
    list()
  }

  list(
    ok = TRUE,
    motivo = "",
    comparables = as.integer(sum(comparables)),
    coinciden = as.integer(sum(igual)),
    discrepan = as.integer(sum(!igual)),
    por_facultad = por_facultad,
    pares = pares,
    sin_aula = as.integer(sum(en_juego & !nzchar(fac_aula))),
    sin_declarar = as.integer(sum(en_juego & nzchar(fac_aula) & !nzchar(declarada)))
  )
}

# Código declarado → nombre, si el estudio lo trae. Sin él el valor crudo viaja
# tal cual y el cruce entero se cae por el guard de «vocabularios que no se
# tocan»: un «5» contra «CIENCIAS E INGENIERIA» no es un desacuerdo de campo,
# es una traducción que falta.
#' Deja el catálogo de facultades como una lista con nombre → nombre.
#'
#' Vive aquí y no en el normalizador de la config porque es la misma regla que
#' lee el cruce: un código sin nombre —o un nombre sin código— no traduce nada
#' y no debe persistir como si lo hiciera.
#' @keywords internal
.mcfd_normalizar_etiquetas <- function(x) {
  if (is.character(x)) x <- as.list(x)
  if (!is.list(x) || !length(x)) return(list())
  nombres <- names(x) %||% character(0)
  out <- list()
  for (i in seq_along(x)) {
    k <- trimws(as.character(nombres[[i]] %||% "")[1])
    v <- .monitoreo_scalar(x[[i]], "")
    if (nzchar(k) && !is.na(k) && nzchar(v)) out[[k]] <- v
  }
  out
}

.mcfd_etiquetas <- function(mapping) {
  .mcfd_normalizar_etiquetas(mapping[["faculty_labels"]] %||% list())
}

# --- la hoja del libro --------------------------------------------------------

.MCFD_HOJA <- "Control de facultad"
.MCFD_BLOQUES <- c("FACULTAD POR FACULTAD", "DÓNDE SE CRUZAN")

#' Las filas de la hoja de control, tipadas — mismo contrato que sus hermanas.
#'
#' @param plan filas del plan.
#' @param responses respuestas de la plataforma.
#' @param cfg config de aulas universitarias.
#' @return `NULL` si el estudio no declara su variable de facultad o no hay con
#'   qué cruzar; si no, lista de filas `{tipo, celdas}`.
#' @keywords internal
aulas_libro_filas_control_facultad <- function(plan = list(), responses = NULL,
                                               cfg = list()) {
  o <- monitoreo_aulas_cruce_facultad_declarada(plan, responses, cfg)
  if (!isTRUE(o$ok) || !o$comparables) return(NULL)

  filas <- list()
  poner <- function(tipo, celdas) {
    filas[[length(filas) + 1L]] <<- list(tipo = tipo, celdas = .alp_celdas(tipo, celdas))
  }
  pct <- function(n, d) if (d > 0) sprintf("%.1f %%", 100 * n / d) else ""

  poner("titulo", "CONTROL DE FACULTAD")
  poner("nota", sprintf(paste(
    "La facultad del AULA —la que el diseño le puso al curso-horario— contra la",
    "que el alumno DECLARA en el cuestionario. %d respuestas comparables: %d",
    "coinciden (%s) y %d no (%s)."),
    o$comparables, o$coinciden, pct(o$coinciden, o$comparables),
    o$discrepan, pct(o$discrepan, o$comparables)))
  poner("nota", paste(
    "Es un control, no una reatribución: esta hoja NO cambia ningún conteo del",
    "avance. Sirve para saber cuánta de la cuota de una facultad la está",
    "llenando gente de otra."))
  poner("nota", "")

  poner("bloque", .MCFD_BLOQUES[[1]])
  poner("nota", paste(
    "«Por el aula» son las respuestas recogidas en aulas de esa facultad;",
    "«declaradas» son las de quienes dicen ser de ella, estén donde estén. Una",
    "facultad con 0 aulas y declarantes es gente que hoy no se ve en su fila."))
  poner("cabecera", c("FACULTAD", "POR EL AULA", "COINCIDEN", "DE OTRA FACULTAD",
                      "% DE OTRA", "DECLARADAS", "DIFERENCIA"))
  for (f in o$por_facultad) {
    poner("dato", c(
      f$facultad, f$respuestas, f$coinciden, f$discrepan,
      pct(f$discrepan, f$respuestas), f$declaradas,
      sprintf("%+d", f$declaradas - f$respuestas)))
  }
  poner("dato", c("TOTAL", o$comparables, o$coinciden, o$discrepan,
                  pct(o$discrepan, o$comparables), o$comparables, "+0"))

  if (length(o$pares)) {
    poner("nota", "")
    poner("bloque", .MCFD_BLOQUES[[2]])
    poner("nota", paste(
      "De qué facultad era el aula y de cuál dice ser quien respondió. Lo que",
      "más se repite suele ser un curso compartido o un alumno de Estudios",
      "Generales que ya declara su facultad de destino."))
    poner("cabecera", c("AULA DE", "EL ALUMNO DECLARA", "RESPUESTAS"))
    for (x in o$pares) {
      lados <- strsplit(x$par, " → ", fixed = TRUE)[[1]]
      poner("dato", c(lados[[1]], if (length(lados) > 1L) lados[[2]] else "", x$n))
    }
  }
  filas
}

#' Los valores planos de la hoja de control, para Sheets.
#' @keywords internal
aulas_libro_valores_control_facultad <- function(plan = list(), responses = NULL,
                                                 cfg = list()) {
  filas <- aulas_libro_filas_control_facultad(plan, responses, cfg)
  if (is.null(filas)) return(NULL)
  lapply(filas, function(f) as.list(f$celdas))
}

#' Escribe la hoja «Control de facultad» sobre el workbook del libro.
#' @keywords internal
aulas_libro_hoja_control_facultad <- function(wb, plan = list(), responses = NULL,
                                              cfg = list()) {
  filas <- aulas_libro_filas_control_facultad(plan, responses, cfg)
  if (is.null(filas)) return(invisible(FALSE))
  hoja <- .MCFD_HOJA
  openxlsx::addWorksheet(wb, hoja)
  estilos <- list(
    titulo = openxlsx::createStyle(fontSize = 14, textDecoration = "bold"),
    nota = openxlsx::createStyle(fontColour = "#6B6560", fontSize = 10),
    cabecera = openxlsx::createStyle(textDecoration = "bold", fgFill = "#F3EDEA",
                                     border = "bottom", borderColour = "#C9BEB8",
                                     fontSize = 10),
    bloque = openxlsx::createStyle(textDecoration = "bold", fontSize = 12)
  )
  for (i in seq_along(filas)) {
    f <- filas[[i]]
    openxlsx::writeData(wb, hoja, .alp_fila_df(f$celdas), startRow = i, colNames = FALSE)
    est <- estilos[[f$tipo]]
    if (!is.null(est)) {
      openxlsx::addStyle(wb, hoja, est, rows = i, cols = seq_along(f$celdas),
                         gridExpand = TRUE)
    }
  }
  total <- openxlsx::createStyle(textDecoration = "bold", border = "top",
                                 borderColour = "#C9BEB8")
  for (i in seq_along(filas)) {
    f <- filas[[i]]
    if (identical(f$tipo, "dato") && identical(as.character(f$celdas[[1]]), "TOTAL")) {
      openxlsx::addStyle(wb, hoja, total, rows = i, cols = seq_along(f$celdas),
                         gridExpand = TRUE, stack = TRUE)
    }
  }
  anchos <- c(38L, rep(16L, max(0L, max(vapply(filas, function(f) length(f$celdas),
                                               integer(1))) - 1L)))
  openxlsx::setColWidths(wb, hoja, cols = seq_along(anchos), widths = anchos)
  openxlsx::freezePane(wb, hoja, firstActiveRow = 2L)
  invisible(TRUE)
}

#' Requests de formato de la hoja de control en Sheets.
#' @keywords internal
aulas_libro_control_facultad_formato_requests <- function(sheet_id, rows) {
  rows <- rows %||% list()
  if (!length(rows)) return(list())
  n_cols <- max(1L, max(vapply(rows, function(r) length(r %||% list()), integer(1))))
  requests <- list()
  poner <- function(req) requests[[length(requests) + 1L]] <<- req
  for (i in seq_along(rows)) {
    celdas <- trimws(as.character(unlist(rows[[i]] %||% list(), use.names = FALSE)))
    primera <- if (length(celdas)) celdas[[1L]] else ""
    if (identical(primera, "CONTROL DE FACULTAD")) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#002457", "#FFFFFF", size = 13L))
      poner(.maaf_alto_fila(sheet_id, i, 36L))
    } else if (primera %in% .MCFD_BLOQUES) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#002457", "#FFFFFF", size = 11L))
      poner(.maaf_alto_fila(sheet_id, i, 28L))
    } else if (primera %in% c("FACULTAD", "AULA DE")) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#E7EEF9", "#1B4B8F", wrap = TRUE))
    } else if (identical(primera, "TOTAL")) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#F3EDEA", "#3A3532"))
    } else if (length(celdas) == 1L && nzchar(primera)) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#FFFFFF", "#6B6560",
                        size = 9L, italic = TRUE, bold = FALSE))
    }
  }
  requests
}
