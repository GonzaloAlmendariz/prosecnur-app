# Lectura de la base DAA de IAGEN y su cruce con el plan de aulas — B8h
# (docs/qa/checklist-operativo-aulas-2026-08-31.md).
#
# La base que entrego el dueño («BD Muestra IAGEN (Pulso PUCP).xlsx»), medida:
# 15 hojas —un resumen «N» TECLEADO y 14 de facultad—, filas por CURSO-HORARIO
# (Clave Curso + Horario numerico), SIN docente, y la calidad POR COLOR de
# celda segun la leyenda de la hoja «N»: blanco = titular, gris FFD9D9D9 =
# complementario. Los fills son legibles por maquina via `styleObjects`.
#
# Dos decisiones que vienen de lecciones pagadas:
#
#   1. **La hoja «N» no es fuente.** Es un resumen tecleado a mano, y un
#      resumen tecleado puede decir OK porque alguien lo tecleo (la hoja de
#      «Validaciones» de 36 filas literales). Se usa SOLO como contraste: si no
#      cuadra con lo contado, un aviso dice la causa y las dos cifras — y las
#      hojas de facultad mandan igual.
#
#   2. **El horario se cero-padea a 4.** Llega NUMERICO (101, 703.0, 1015) y
#      sin el pad «0101»/«0703» jamas casarian con un `classroom_id`
#      («eco101_0101»): el cero a la izquierda es parte de la identidad.
#
# El cruce (`aulas_daa_traslape`) va en DOS niveles con el catalogo DTI de
# puente: AULA EN DAA (el classroom_id muestreado esta en la DAA) y DOCENTE EN
# DAA (el docente del aula dicta OTRO curso-horario que si esta). Precedencias:
# aula > docente entre niveles, titular > complementario dentro de cada nivel.
#
# La columna «TRASLAPE DAA» del libro es CONDICIONAL y de IDA (dictado del
# dueño: «la DAA es algo particular de este año, no es una columna que se
# emplee para otros estudios»): la escribe `aulas_libro_hoja_agendadas` solo
# cuando recibe un cruce, y ningun lector la devuelve al plan.

# El gris de «complementario» segun la leyenda de la hoja N. Se acepta con y
# sin canal alfa: openxlsx serializa FFD9D9D9 pero un editor puede dejar D9D9D9.
.DAA_GRIS_COMPLEMENTARIO <- "D9D9D9"

# ¿El estilo lleva el fill gris de la leyenda? Se mira el `fill` completo del
# estilo y no una ruta interna exacta: la forma del objeto Style de openxlsx no
# es contrato publico y un upgrade no debe volver «titular» todas las filas.
.daa_estilo_gris <- function(style) {
  fill <- tryCatch(unlist(style$fill, use.names = FALSE), error = function(e) NULL)
  if (is.null(fill) || !length(fill)) return(FALSE)
  any(grepl(.DAA_GRIS_COMPLEMENTARIO, toupper(as.character(fill)), fixed = TRUE))
}

# Las FILAS (indices de hoja, 1-based) con fill gris, por hoja. El gris de la
# base real va en toda la fila de datos, asi que basta con que ALGUNA celda de
# la fila lo lleve — no se depende de en cual columna miro.
.daa_filas_grises <- function(wb) {
  out <- list()
  estilos <- tryCatch(wb$styleObjects, error = function(e) list())
  for (so in (estilos %||% list())) {
    hoja <- tryCatch(as.character(so$sheet)[[1]], error = function(e) "")
    if (!nzchar(hoja)) next
    if (!.daa_estilo_gris(so$style)) next
    filas <- suppressWarnings(as.integer(so$rows))
    filas <- filas[is.finite(filas) & filas > 0L]
    if (!length(filas)) next
    out[[hoja]] <- sort(unique(c(out[[hoja]] %||% integer(0), filas)))
  }
  out
}

# El horario con su cero a la izquierda: numerico se padea a 4; lo que no
# parsea como numero se conserva tal cual (ya venia como texto con su forma).
.daa_horario_pad <- function(x) {
  txt <- trimws(as.character(x %||% "")[1])
  if (is.na(txt) || !nzchar(txt)) return("")
  n <- suppressWarnings(as.numeric(txt))
  if (length(n) == 1L && is.finite(n)) sprintf("%04d", as.integer(round(n))) else txt
}

# Columna de una cabecera por CONTENIDO normalizado, no por posicion.
.daa_col_de <- function(titulos, patron) {
  claves <- .caa_key(titulos)
  hit <- which(grepl(patron, claves))
  if (length(hit)) hit[[1]] else 0L
}

# El contraste con la hoja «N» tecleada: avisos con causa y las dos cifras.
.daa_contraste_n <- function(df_n, contadas) {
  avisos <- character(0)
  if (is.null(df_n) || !is.data.frame(df_n) || nrow(df_n) < 2L) return(avisos)
  titulos <- as.character(unlist(df_n[1, ], use.names = FALSE))
  col_fac <- .daa_col_de(titulos, "FACULTAD")
  if (col_fac == 0L) col_fac <- 1L
  col_n <- which(.caa_key(titulos) == "N")
  col_n <- if (length(col_n)) col_n[[1]] else if (ncol(df_n) >= 2L) 2L else 0L
  if (col_n == 0L) return(avisos)

  claves_contadas <- .caa_key(names(contadas))
  vistas <- character(0)
  for (i in seq.int(2L, nrow(df_n))) {
    fac <- trimws(as.character(df_n[i, col_fac]))
    if (is.na(fac) || !nzchar(fac)) next
    tecleado <- suppressWarnings(as.numeric(df_n[i, col_n]))
    if (!length(tecleado) || !is.finite(tecleado)) next
    idx <- match(.caa_key(fac), claves_contadas)
    contado <- if (is.na(idx)) 0L else unname(contadas[[idx]])
    vistas <- c(vistas, .caa_key(fac))
    if (!identical(as.numeric(contado), as.numeric(tecleado))) {
      avisos <- c(avisos, sprintf(
        paste0(
          "La hoja «N» tecleada dice %s curso-horarios en «%s» y sus hojas de ",
          "facultad traen %s: mandan las hojas contadas, no el resumen tecleado."
        ),
        format(tecleado, trim = TRUE, scientific = FALSE), fac,
        format(contado, trim = TRUE, scientific = FALSE)
      ))
    }
  }
  sin_resumen <- names(contadas)[!(claves_contadas %in% vistas)]
  for (fac in sin_resumen) {
    avisos <- c(avisos, sprintf(
      "La hoja de facultad «%s» trae %s curso-horarios y el resumen «N» tecleado no la lista.",
      fac, format(unname(contadas[[fac]]), trim = TRUE, scientific = FALSE)
    ))
  }
  avisos
}

#' Lee la base DAA de IAGEN: clave normalizada y calidad por color.
#'
#' Recorre las hojas de facultad (todas menos «N»), arma la clave
#' `tolower(clave)_horario` con el horario cero-padeado a 4, y lee la calidad
#' del FILL de la fila: gris `FFD9D9D9` = complementario, blanco/sin fill =
#' titular (leyenda de la hoja «N»). El resumen «N» tecleado se usa solo como
#' contraste: un descuadre deja un aviso con la causa y las dos cifras, jamas
#' cambia lo leido.
#'
#' @param path ruta al `.xlsx` de la DAA.
#' @return data.frame con `clave`, `calidad` y `facultad`; los avisos del
#'   contraste viajan en `attr(, "avisos")` (character, vacio si cuadra).
#' @export
carga_daa_iagen <- function(path) {
  if (!is.character(path) || length(path) != 1L || !nzchar(path) || !file.exists(path)) {
    stop_api(400, "E_DAA_IAGEN_NO_EXISTE", "No se encontro la base DAA de IAGEN.")
  }
  wb <- tryCatch(openxlsx::loadWorkbook(path), error = function(e) NULL)
  hojas <- if (is.null(wb)) character(0) else tryCatch(names(wb), error = function(e) character(0))
  hojas_facultad <- setdiff(hojas, "N")
  if (!length(hojas_facultad)) {
    stop_api(
      422, "E_DAA_IAGEN_SIN_HOJAS",
      "La base DAA no trae hojas de facultad legibles (solo se encontro el resumen «N», o nada).",
      details = list(hojas = as.list(hojas))
    )
  }
  grises <- .daa_filas_grises(wb)

  filas <- list()
  contadas <- integer(0)
  for (hoja in hojas_facultad) {
    # `skipEmptyRows/Cols = FALSE`: los indices de fila del data.frame tienen
    # que ser los de la HOJA, porque contra ellos casan los fills.
    df <- tryCatch(
      openxlsx::read.xlsx(path, sheet = hoja, colNames = FALSE,
                          skipEmptyRows = FALSE, skipEmptyCols = FALSE),
      error = function(e) NULL
    )
    if (is.null(df) || !is.data.frame(df) || nrow(df) < 2L) next
    titulos <- as.character(unlist(df[1, ], use.names = FALSE))
    col_clave <- .daa_col_de(titulos, "CLAVE")
    col_horario <- .daa_col_de(titulos, "HORARIO")
    if (col_clave == 0L || col_horario == 0L) next
    filas_gris <- grises[[hoja]] %||% integer(0)
    n_hoja <- 0L
    for (i in seq.int(2L, nrow(df))) {
      clave_cruda <- trimws(as.character(df[i, col_clave]))
      if (is.na(clave_cruda) || !nzchar(clave_cruda)) next
      horario <- .daa_horario_pad(df[i, col_horario])
      if (!nzchar(horario)) next
      n_hoja <- n_hoja + 1L
      filas[[length(filas) + 1L]] <- list(
        clave = paste0(tolower(gsub("[[:space:]]+", "", clave_cruda)), "_", horario),
        calidad = if (i %in% filas_gris) "complementario" else "titular",
        facultad = hoja
      )
    }
    contadas[[hoja]] <- n_hoja
  }

  out <- data.frame(
    clave = vapply(filas, function(f) f$clave, character(1)),
    calidad = vapply(filas, function(f) f$calidad, character(1)),
    facultad = vapply(filas, function(f) f$facultad, character(1)),
    stringsAsFactors = FALSE
  )

  df_n <- if ("N" %in% hojas) tryCatch(
    openxlsx::read.xlsx(path, sheet = "N", colNames = FALSE,
                        skipEmptyRows = FALSE, skipEmptyCols = FALSE),
    error = function(e) NULL
  ) else NULL
  attr(out, "avisos") <- .daa_contraste_n(df_n, contadas)
  out
}

#' El traslape de cada unidad del plan con la DAA, en dos niveles.
#'
#' Nivel AULA: el `classroom_id` muestreado esta en la DAA — ese salon YA fue
#' contactado por IAGEN. Nivel DOCENTE: el aula no esta, pero su docente dicta
#' OTRO curso-horario que si (el catalogo DTI es el puente docente↔aulas).
#' Precedencias: **aula > docente** entre niveles (el contacto directo pesa mas
#' que el indirecto) y **titular > complementario** dentro del nivel docente
#' (si el docente aparece por las dos calidades, se reporta la mas fuerte).
#' Sin traslape por ningun nivel, la unidad queda VACIA — no un default.
#'
#' @param unidades filas del plan (con `operational_code`, `classroom_id` y
#'   `teacher`).
#' @param daa data.frame de `carga_daa_iagen` (`clave`, `calidad`).
#' @param catalogo catalogo DTI como puente: `classroom_id` y `teacher`.
#' @return character NOMBRADO por codigo operativo; el formato es el de la
#'   columna del libro («AULA EN DAA (TITULAR)», «DOCENTE EN DAA (COMPL.)», "").
#' @export
aulas_daa_traslape <- function(unidades, daa, catalogo) {
  calidad_de <- character(0)
  if (is.data.frame(daa) && nrow(daa) && all(c("clave", "calidad") %in% names(daa))) {
    calidad_de <- stats::setNames(
      tolower(trimws(as.character(daa$calidad))),
      tolower(trimws(as.character(daa$clave)))
    )
  }
  cat_id <- character(0)
  cat_doc <- character(0)
  if (is.data.frame(catalogo) && nrow(catalogo) &&
      all(c("classroom_id", "teacher") %in% names(catalogo))) {
    cat_id <- tolower(trimws(as.character(catalogo$classroom_id)))
    cat_doc <- toupper(trimws(as.character(catalogo$teacher)))
  }
  etiqueta <- function(nivel, calidad) {
    sprintf("%s EN DAA (%s)", nivel,
            if (identical(calidad, "titular")) "TITULAR" else "COMPL.")
  }

  out <- stats::setNames(character(0), character(0))
  for (u in (unidades %||% list())) {
    if (!is.list(u)) next
    cod <- trimws(as.character(u$operational_code %||% ""))
    if (!nzchar(cod)) next
    aula <- tolower(trimws(as.character(u$classroom_id %||% "")))
    veredicto <- ""
    if (nzchar(aula) && aula %in% names(calidad_de)) {
      veredicto <- etiqueta("AULA", calidad_de[[aula]])
    } else {
      docente <- toupper(trimws(as.character(u$teacher %||% "")))
      if (!nzchar(docente) && nzchar(aula) && length(cat_id)) {
        i <- match(aula, cat_id)
        if (!is.na(i)) docente <- cat_doc[[i]]
      }
      if (nzchar(docente) && length(cat_id)) {
        del_docente <- unique(cat_id[cat_doc == docente])
        en_daa <- del_docente[del_docente %in% names(calidad_de)]
        if (length(en_daa)) {
          calidades <- unname(calidad_de[en_daa])
          mejor <- if ("titular" %in% calidades) "titular" else "complementario"
          veredicto <- etiqueta("DOCENTE", mejor)
        }
      }
    }
    out[[cod]] <- veredicto
  }
  out
}
