# Marco de un público en un estudio por correo o teléfono (barrido, ADR 0143).
#
# Fase 5 del rediseño de Cálculo de muestra: lo que convierte el archivo que
# envía el cliente en un marco usable sin pasar por un Excel armado a mano.
#   - Lectura: Excel y CSV con coma o punto y coma, en UTF-8 o Latin-1 (así
#     exporta Excel en español).
#   - Hojas: en un libro se reconoce la hoja de datos y se descartan la consulta
#     (SQL) y las notas. Las bases reales de un estudio de acreditación traen, en
#     dos libros, una hoja "SQL" junto a la de datos.
#   - Perfil: tipo, valores, vacíos, distribución y uso sugerido de cada
#     columna, leídos del contenido y no del nombre (cada cliente nombra sus
#     columnas a su manera).
#   - Quién se invita: reglas que restan del marco y un embudo con la resta de
#     cada una.
# Todo es puro (sin sesión); las rutas viven en router_calc_muestra_marco_publico.R.

.CM_MARCO_MAX_CATEGORIAS <- 30L
.CM_MARCO_TOP <- 8L
.CM_MARCO_CORREO_RE <- "^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$"

# ---------------------------------------------------------------------------
# Lectura
# ---------------------------------------------------------------------------

#' Codificación de un CSV: UTF-8 si los bytes lo son, Latin-1 si no.
#' @keywords internal
.cm_marco_csv_codificacion <- function(path) {
  n <- min(file.size(path), 2e6)
  bytes <- readBin(path, "raw", n = n)
  if (!length(bytes)) return("UTF-8")
  # Un corte a mitad de un carácter multibyte no debe volverlo Latin-1.
  if (n < file.size(path)) {
    while (length(bytes) && bitwAnd(as.integer(bytes[length(bytes)]), 0xC0L) == 0x80L) bytes <- bytes[-length(bytes)]
    if (length(bytes) && as.integer(bytes[length(bytes)]) >= 0xC0L) bytes <- bytes[-length(bytes)]
  }
  if (isTRUE(stringi::stri_enc_isutf8(bytes))) "UTF-8" else "latin1"
}

#' Separador de un CSV: el que aparece la misma cantidad de veces (y más de
#' cero) en las primeras líneas. Entre empatados gana el que más columnas da.
#' @keywords internal
.cm_marco_csv_separador <- function(lineas) {
  lineas <- lineas[nzchar(trimws(lineas))]
  lineas <- utils::head(lineas, 20L)
  if (!length(lineas)) return(",")
  # Lo que va entre comillas no cuenta: "Lima, Perú" no parte una columna.
  limpias <- gsub('"[^"]*"', "", lineas)
  candidatos <- c(";", ",", "\t", "|")
  puntaje <- vapply(candidatos, function(sep) {
    cuentas <- lengths(regmatches(limpias, gregexpr(sep, limpias, fixed = TRUE)))
    if (cuentas[1] == 0L) return(0)
    # La mayoría de las líneas con la misma cuenta que el encabezado.
    mean(cuentas == cuentas[1]) * cuentas[1]
  }, numeric(1))
  if (max(puntaje) <= 0) return(",")
  candidatos[which.max(puntaje)]
}

#' Lee un CSV detectando separador y codificación.
#'
#' @param como_texto si TRUE, toda columna se lee como texto (conserva ceros a
#'   la izquierda de los códigos); si FALSE, R infiere el tipo como antes.
#' @return list(datos, separador, codificacion).
#' @keywords internal
.cm_marco_leer_csv <- function(path, como_texto = FALSE) {
  codificacion <- .cm_marco_csv_codificacion(path)
  enc_archivo <- if (identical(codificacion, "UTF-8")) "UTF-8-BOM" else "latin1"
  con <- file(path, encoding = enc_archivo)
  lineas <- tryCatch(readLines(con, n = 20L, warn = FALSE), finally = close(con))
  separador <- .cm_marco_csv_separador(lineas)
  datos <- utils::read.csv(
    path, sep = separador, fileEncoding = enc_archivo, stringsAsFactors = FALSE,
    check.names = FALSE, colClasses = if (isTRUE(como_texto)) "character" else NA,
    na.strings = if (isTRUE(como_texto)) character(0) else "NA"
  )
  list(datos = datos, separador = separador, codificacion = codificacion)
}

# Nombres de columna sin vacíos ni repetidos: "Columna 3" para el vacío y
# "SEXO (2)" para el segundo SEXO. Sin esto el perfil leería dos veces la
# primera columna repetida y la regla por columna sería ambigua.
.cm_marco_nombres_unicos <- function(df) {
  nms <- names(df)
  vacios <- is.na(nms) | !nzchar(nms)
  nms[vacios] <- paste0("Columna ", which(vacios))
  for (i in seq_along(nms)) {
    previos <- sum(nms[seq_len(i - 1L)] == nms[i])
    if (previos) {
      k <- previos + 1L
      while (paste0(nms[i], " (", k, ")") %in% nms) k <- k + 1L
      nms[i] <- paste0(nms[i], " (", k, ")")
    }
  }
  names(df) <- nms
  df
}

# Una hoja o un CSV leído entero como texto, con el encabezado donde esté.
.cm_marco_leer_hoja_texto <- function(path, hoja = NULL) {
  ext <- tolower(tools::file_ext(path))
  if (ext %in% c("csv", "txt")) {
    return(.cm_marco_nombres_unicos(.cm_aulas_clean_table_names(.cm_marco_leer_csv(path, como_texto = TRUE)$datos)))
  }
  skip <- .cm_aulas_encabezado_skip(path, hoja)
  df <- suppressMessages(suppressWarnings(readxl::read_excel(
    path, sheet = if (length(hoja) && nzchar(hoja)) hoja else 1L,
    skip = skip, col_types = "text", .name_repair = "minimal"
  )))
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  .cm_marco_nombres_unicos(.cm_aulas_clean_table_names(df))
}

# ---------------------------------------------------------------------------
# Hojas del libro
# ---------------------------------------------------------------------------

# Qué es una hoja: datos, consulta (SQL), notas o vacía.
.cm_marco_tipo_hoja <- function(df) {
  if (!is.data.frame(df) || !ncol(df)) return("vacia")
  # Una consulta pegada en una sola celda queda como encabezado y la hoja sin
  # filas: por eso el texto incluye los nombres de columna.
  texto <- unlist(lapply(df, function(v) v[!is.na(v) & nzchar(trimws(v))]), use.names = FALSE)
  texto <- c(names(df), texto)
  if (ncol(df) <= 2L) {
    if (any(grepl("^\\s*(select|with|from|insert|update)\\b", texto, ignore.case = TRUE, perl = TRUE)) ||
        any(grepl("\\bselect\\b[\\s\\S]*\\bfrom\\b", texto, ignore.case = TRUE, perl = TRUE))) {
      return("consulta")
    }
    if (nrow(df) < 2L || any(nchar(texto) > 200L)) return("notas")
  }
  if (!nrow(df)) return("vacia")
  if (nrow(df) < 2L) return("notas")
  "datos"
}

#' Hojas de un libro (o del CSV) con lo que tiene cada una y la sugerida.
#'
#' @param path ruta al archivo.
#' @return list(formato, separador, codificacion, hojas = [{nombre, tipo,
#'   filas, columnas, encabezado_fila}], sugerida).
calc_muestra_marco_hojas <- function(path) {
  ext <- tolower(tools::file_ext(path))
  if (ext %in% c("csv", "txt")) {
    lec <- .cm_marco_leer_csv(path, como_texto = TRUE)
    df <- lec$datos
    return(list(
      formato = "csv", separador = lec$separador, codificacion = lec$codificacion,
      hojas = list(list(nombre = "", tipo = .cm_marco_tipo_hoja(df), filas = nrow(df),
                        columnas = ncol(df), encabezado_fila = 1L)),
      sugerida = ""
    ))
  }
  if (!ext %in% c("xlsx", "xls")) {
    stop(sprintf("Formato de marco no soportado: .%s", ext), call. = FALSE)
  }
  nombres <- readxl::excel_sheets(path)
  hojas <- lapply(nombres, function(h) {
    skip <- .cm_aulas_encabezado_skip(path, h)
    df <- tryCatch(.cm_marco_leer_hoja_texto(path, h), error = function(e) data.frame())
    list(nombre = h, tipo = .cm_marco_tipo_hoja(df), filas = nrow(df), columnas = ncol(df),
         encabezado_fila = as.integer(skip) + 1L)
  })
  datos <- Filter(function(x) identical(x$tipo, "datos"), hojas)
  sugerida <- if (length(datos)) {
    tam <- vapply(datos, function(x) as.numeric(x$filas) * as.numeric(x$columnas), numeric(1))
    datos[[which.max(tam)]]$nombre
  } else if (length(hojas)) hojas[[1]]$nombre else ""
  list(formato = ext, separador = "", codificacion = "", hojas = hojas, sugerida = sugerida)
}

# ---------------------------------------------------------------------------
# Perfil de columnas
# ---------------------------------------------------------------------------

.cm_marco_valores <- function(v) {
  v <- trimws(as.character(v))
  v[is.na(v) | v %in% c("NA", "NULL", "null")] <- ""
  v
}

.cm_marco_es_numero <- function(x) {
  !is.na(suppressWarnings(as.numeric(gsub(",", ".", x, fixed = TRUE))))
}

.cm_marco_es_telefono <- function(x) {
  d <- gsub("[[:space:]()+-]", "", x)
  grepl("^[0-9]{6,15}$", d)
}

# Tipo de una columna leído de su contenido.
.cm_marco_tipo_columna <- function(llenos, n_filas, distintos) {
  nv <- length(llenos)
  if (!nv) return("vacia")
  if (mean(grepl(.CM_MARCO_CORREO_RE, llenos)) >= 0.8) return("correo")
  # Un código no lleva espacios: así un nombre completo que no se repite no pasa por identificador.
  # Los umbrales no dependen del tamaño del marco: en una base de 20 filas un
  # código, un teléfono o un nombre tampoco pueden publicarse como categoría.
  if (distintos == nv && nv >= 0.98 * n_filas && nv >= 5L && mean(!grepl("[[:space:]]", llenos)) >= 0.95) return("codigo")
  numerico <- mean(.cm_marco_es_numero(llenos)) >= 0.95
  if (numerico && mean(.cm_marco_es_telefono(llenos)) >= 0.9 && distintos >= 0.8 * nv && nv >= 5L) {
    return("telefono")
  }
  # Casi un valor distinto por fila y sin ser número: texto libre (nombres).
  if (!numerico && nv >= 5L && distintos > 0.5 * nv) return("texto")
  if (distintos <= .CM_MARCO_MAX_CATEGORIAS) return("categoria")
  if (numerico) return("numero")
  if (distintos <= 0.02 * nv) return("categoria")
  "texto"
}

#' Perfil de las columnas de un marco: tipo, valores, vacíos, distribución y
#' uso sugerido. El uso se lee del contenido: un código que no se repite es
#' identificador, una columna con @ es correo, nombres y teléfonos son datos
#' personales y una categoría con 2 a 30 valores es candidata a cuota.
#'
#' Las columnas con datos personales (código, correo, teléfono, texto libre)
#' no publican valores: solo cuántos hay.
#'
#' @param df data.frame leído como texto.
#' @return lista de columnas {nombre, tipo, valores, vacios, unico,
#'   distribucion, otros, resumen, uso_sugerido}.
calc_muestra_marco_perfil <- function(df) {
  if (!is.data.frame(df) || !ncol(df)) return(list())
  n <- nrow(df)
  hay_id <- FALSE
  lapply(seq_along(df), function(i) {
    col <- names(df)[i]
    v <- .cm_marco_valores(df[[i]])
    llenos <- v[nzchar(v)]
    distintos <- length(unique(llenos))
    tipo <- .cm_marco_tipo_columna(llenos, n, distintos)
    uso <- switch(tipo,
      codigo = if (!hay_id) "id" else "no",
      correo = "correo",
      telefono = "personal",
      texto = if (distintos > 0.5 * length(llenos)) "personal" else "no",
      categoria = if (distintos >= 2L && distintos <= .CM_MARCO_MAX_CATEGORIAS) "cuota" else "no",
      "no"
    )
    if (identical(uso, "id")) hay_id <<- TRUE
    distribucion <- NULL
    otros <- 0L
    if (identical(tipo, "categoria")) {
      tab <- sort(table(llenos), decreasing = TRUE)
      top <- utils::head(tab, if (distintos <= .CM_MARCO_MAX_CATEGORIAS) .CM_MARCO_MAX_CATEGORIAS else .CM_MARCO_TOP)
      distribucion <- lapply(seq_along(top), function(i) list(valor = names(top)[i], n = as.integer(top[[i]])))
      otros <- as.integer(sum(tab) - sum(top))
    }
    resumen <- NULL
    if (identical(tipo, "numero")) {
      x <- suppressWarnings(as.numeric(gsub(",", ".", llenos, fixed = TRUE)))
      resumen <- list(min = min(x, na.rm = TRUE), mediana = stats::median(x, na.rm = TRUE), max = max(x, na.rm = TRUE))
    }
    list(
      nombre = col, tipo = tipo, valores = distintos, vacios = n - length(llenos),
      repetidos = length(llenos) - distintos, unico = distintos == length(llenos) && length(llenos) > 0,
      distribucion = distribucion, otros = otros, resumen = resumen, uso_sugerido = uso
    )
  })
}

# ---------------------------------------------------------------------------
# Quién se invita
# ---------------------------------------------------------------------------

.cm_marco_correo_clave <- function(x) tolower(trimws(as.character(x)))

#' Embudo de quién se invita: cada regla resta del marco en orden.
#'
#' Reglas (lista de listas, se aplican en el orden dado):
#'   - {tipo = "excluir_valores", columna, valores}: fuera quien tenga uno de
#'     esos valores en la columna.
#'   - {tipo = "excluir_sin_correo"}: fuera quien no tenga correo válido.
#'   - {tipo = "una_por_persona"}: fuera quien figura en un público de
#'     `otros`; se invita como ese público y recibe una sola encuesta. A qué
#'     público se asigna una persona lo decide quien llama (D9): `otros` lista
#'     solo los públicos que tienen prioridad sobre este.
#'
#' @param df data.frame del marco.
#' @param columna_correo columna con el correo (para las reglas de correo).
#' @param reglas lista de reglas.
#' @param otros lista de {publico, correos}.
#' @return list(base, invitados, pasos = [{tipo, etiqueta, columna, valores,
#'   quitadas, quedan, por_publico}], incluidos = lógico por fila).
calc_muestra_marco_invitados <- function(df, columna_correo = "", reglas = list(), otros = list()) {
  n <- nrow(df)
  dentro <- rep(TRUE, n)
  columna_correo <- calc_str(columna_correo, "")
  correos <- if (nzchar(columna_correo)) {
    if (!columna_correo %in% names(df)) {
      stop_api(400, "E_BAD_REQUEST", sprintf("La columna de correo \"%s\" no está en la base.", columna_correo))
    }
    .cm_marco_correo_clave(df[[columna_correo]])
  } else NULL
  exigir_correo <- function(tipo) {
    if (is.null(correos)) {
      stop_api(400, "E_BAD_REQUEST", sprintf("La regla \"%s\" necesita la columna de correo.", tipo))
    }
  }
  pasos <- lapply(reglas, function(r) {
    tipo <- calc_str(r$tipo, "")
    antes <- dentro
    por_publico <- NULL
    columna <- ""
    valores <- character(0)
    if (identical(tipo, "excluir_valores")) {
      columna <- calc_str(r$columna, "")
      if (!columna %in% names(df)) {
        stop_api(400, "E_BAD_REQUEST", sprintf("La columna \"%s\" no está en la base.", columna))
      }
      valores <- trimws(as.character(unlist(r$valores %||% list())))
      fuera <- trimws(as.character(df[[columna]])) %in% valores
      dentro <<- dentro & !fuera
      etiqueta <- sprintf("Fuera por regla: %s", paste(valores, collapse = ", "))
    } else if (identical(tipo, "excluir_sin_correo")) {
      exigir_correo(tipo)
      dentro <<- dentro & grepl(.CM_MARCO_CORREO_RE, correos)
      etiqueta <- "Sin correo"
    } else if (identical(tipo, "una_por_persona")) {
      exigir_correo(tipo)
      asignada <- rep("", n)
      for (o in otros) {
        claves <- unique(.cm_marco_correo_clave(unlist(o$correos %||% list())))
        claves <- claves[nzchar(claves)]
        libre <- !nzchar(asignada) & nzchar(correos)
        asignada[libre & correos %in% claves] <- calc_str(o$publico, "Otro público")
      }
      quitada <- dentro & nzchar(asignada)
      if (any(quitada)) {
        tab <- table(asignada[quitada])
        por_publico <- lapply(names(tab), function(p) list(publico = p, n = as.integer(tab[[p]])))
      } else {
        por_publico <- list()
      }
      dentro <<- dentro & !nzchar(asignada)
      etiqueta <- "Se invitan como otro público"
    } else {
      stop_api(400, "E_BAD_REQUEST", sprintf("Regla de invitación desconocida: \"%s\".", tipo))
    }
    list(tipo = tipo, etiqueta = etiqueta, columna = columna, valores = as.list(valores),
         quitadas = sum(antes & !dentro), quedan = sum(dentro), por_publico = por_publico)
  })
  list(base = n, invitados = sum(dentro), pasos = pasos, incluidos = dentro)
}
