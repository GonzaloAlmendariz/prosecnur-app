# Perfil descriptivo de una base declarada, ANTES del marco.
#
# G49 · Gonzalo: «¿por qué este explorador de variables te pediría tener un
# marco completo si se supone que este es un paso previo al marco? Lo que yo
# quería simplemente son las variables de las bases, tanto de estudiantes como
# de cursos-horario […] con las dos bases iniciales y crudas teníamos suficiente
# para poder ir mapeando qué teníamos».
#
# La primera versión del explorador describía `aula_frame`, que es PRODUCTO del
# marco: exigía construirlo para mirar las bases y mezclaba las columnas del
# archivo con las que el motor deriva (`included`, `exclude_reason`,
# `size_group`…). Justo al revés del orden de trabajo: primero se mira lo que se
# subió, después se mapea, y sólo entonces se construye.
#
# Este perfil se calcula sobre el ARCHIVO declarado en Datos › Fuentes, hoja
# incluida. No necesita marco, no inventa columnas y no reordena nada: describe
# lo que hay.
#
# Vive en R y no en la superficie porque la base real tiene 136.284 filas: traer
# eso al cliente para contar categorías sería mover un archivo entero por cada
# clic. Aquí se leen las columnas y se devuelven agregados.

.cm_expl_vacio <- function(x) {
  if (length(x) == 0) return(logical(0))
  texto <- trimws(as.character(x))
  is.na(x) | !nzchar(texto) | toupper(texto) %in% c("NA", "NAN", "NULL")
}

# Una columna es numérica cuando todo lo que trae dato es número y hay más de
# dos valores distintos: un 0/1 es una bandera y describirla con media y
# cuartiles responde a una pregunta que nadie hace.
.cm_expl_es_numerica <- function(x) {
  vacios <- .cm_expl_vacio(x)
  con_dato <- x[!vacios]
  if (!length(con_dato)) return(FALSE)
  if (is.numeric(con_dato)) return(length(unique(con_dato)) > 2)
  num <- suppressWarnings(as.numeric(trimws(as.character(con_dato))))
  if (anyNA(num)) return(FALSE)
  length(unique(num)) > 2
}

.cm_expl_cuantil <- function(valores, q) {
  as.numeric(stats::quantile(valores, probs = q, names = FALSE, type = 7))
}

.cm_expl_perfil_numerico <- function(x) {
  num <- suppressWarnings(as.numeric(trimws(as.character(x[!.cm_expl_vacio(x)]))))
  num <- num[is.finite(num)]
  if (!length(num)) return(NULL)
  minimo <- min(num)
  maximo <- max(num)
  n_bins <- max(6L, min(24L, as.integer(round(sqrt(length(num))))))
  ancho <- if (maximo > minimo) (maximo - minimo) / n_bins else 1
  cortes <- if (maximo > minimo) {
    idx <- pmin(n_bins - 1L, pmax(0L, as.integer(floor((num - minimo) / ancho))))
    tabulate(idx + 1L, nbins = n_bins)
  } else {
    length(num)
  }
  list(
    min = minimo, max = maximo,
    media = mean(num),
    p25 = .cm_expl_cuantil(num, 0.25),
    p50 = .cm_expl_cuantil(num, 0.50),
    p75 = .cm_expl_cuantil(num, 0.75),
    bins = lapply(seq_along(cortes), function(i) list(
      desde = minimo + ancho * (i - 1L),
      hasta = minimo + ancho * i,
      n = as.integer(cortes[[i]])
    ))
  )
}

.cm_expl_top <- function(x, top, cola_max) {
  valores <- trimws(as.character(x[!.cm_expl_vacio(x)]))
  if (!length(valores)) return(NULL)
  tabla <- sort(table(valores), decreasing = TRUE)
  claves <- names(tabla)
  n <- as.integer(tabla)
  cabeza <- seq_len(min(top, length(claves)))
  resto <- setdiff(seq_along(claves), cabeza)
  list(
    categorias = lapply(cabeza, function(i) list(clave = claves[[i]], n = n[[i]])),
    otras = if (length(resto)) {
      listadas <- utils::head(resto, cola_max)
      list(
        n = sum(n[resto]),
        categorias = length(resto),
        truncadas = as.integer(max(0L, length(resto) - length(listadas))),
        filas = lapply(listadas, function(i) list(clave = claves[[i]], n = n[[i]]))
      )
    } else NULL
  )
}

# Columnas que no se ofrecen: describir una columna de identificadores produce
# una lista de tantas categorías como filas, y ninguna dice nada.
.cm_expl_columna_identificadora <- function(nombre, x, filas) {
  clave <- .cm_aulas_text_key(nombre)
  if (grepl("correo|email|celular|telefono", clave)) return(TRUE)
  distintos <- length(unique(trimws(as.character(x[!.cm_expl_vacio(x)]))))
  # Casi tantos valores distintos como filas y sin repetición útil: es una clave.
  filas > 50 && distintos > filas * 0.9
}

#' Perfil descriptivo de una hoja de una base declarada.
#'
#' @param path ruta al archivo subido (xlsx/xls/csv).
#' @param sheet hoja a leer; vacío = la primera.
#' @param facultad valor de la columna de facultad para acotar la descripción.
#' @param top cuántas categorías se devuelven con conteo propio.
calc_muestra_explorar_base <- function(path, sheet = "", facultad = "",
                                       top = 40L, cola_max = 500L) {
  if (!nzchar(path %||% "") || !file.exists(path)) {
    stop_api(400, "E_CALC_MUESTRA_EXPLORAR_ARCHIVO", "El archivo declarado ya no esta disponible en la sesion.")
  }
  datos <- .cm_aulas_read_any(path, sheet)
  if (!is.data.frame(datos) || !nrow(datos)) {
    stop_api(400, "E_CALC_MUESTRA_EXPLORAR_HOJA", "La hoja indicada no trae filas legibles.")
  }
  # La columna de facultad se busca por los mismos alias que el resto del motor:
  # el explorador no puede tener su propia idea de cómo se llama una facultad.
  mapping <- .cm_aulas_config_mapping(list())
  col_facultad <- .cm_aulas_col(datos, mapping$faculty)
  facultades <- if (nzchar(col_facultad)) {
    valores <- trimws(as.character(datos[[col_facultad]]))
    valores <- valores[!.cm_expl_vacio(valores)]
    tabla <- sort(table(valores), decreasing = TRUE)
    lapply(seq_along(tabla), function(i) list(clave = names(tabla)[[i]], n = as.integer(tabla[[i]])))
  } else list()

  filas_totales <- nrow(datos)
  if (nzchar(facultad) && nzchar(col_facultad)) {
    datos <- datos[trimws(as.character(datos[[col_facultad]])) == facultad, , drop = FALSE]
  }
  filas <- nrow(datos)

  columnas <- lapply(names(datos), function(nombre) {
    x <- datos[[nombre]]
    vacios <- .cm_expl_vacio(x)
    con_dato <- sum(!vacios)
    if (!con_dato) return(NULL)
    if (.cm_expl_columna_identificadora(nombre, x, filas)) return(NULL)
    numerica <- .cm_expl_es_numerica(x)
    distintos <- length(unique(trimws(as.character(x[!vacios]))))
    base <- list(
      columna = nombre,
      tipo = if (numerica) "numerica" else "categorica",
      con_dato = as.integer(con_dato),
      sin_dato = as.integer(sum(vacios)),
      distintos = as.integer(distintos)
    )
    if (numerica) {
      base$resumen <- .cm_expl_perfil_numerico(x)
    } else {
      reparto <- .cm_expl_top(x, top, cola_max)
      base$categorias <- reparto$categorias
      base$otras <- reparto$otras
    }
    base
  })
  columnas <- Filter(Negate(is.null), columnas)

  list(
    schema = "calc_muestra_explorador_base_v1",
    sheet = sheet,
    filas = as.integer(filas),
    filas_base = as.integer(filas_totales),
    facultad = facultad,
    facultad_columna = col_facultad,
    facultades = facultades,
    columnas = columnas
  )
}
