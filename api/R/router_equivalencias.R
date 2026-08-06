# Router de la equivalencia entre públicos (ADR 0062)
# ===================================================
#
# Delgado: valida input, delega en `equivalencias_publicos.R` (motor puro) y
# serializa. Vive en archivo propio y no dentro de `router_carga.R` porque ese ya
# pasa de 2.000 líneas; la regla de la casa es que la funcionalidad nueva estrena
# archivo y el grande la llama, no al revés.

# Instrumentos por base del estudio, que es contra lo que se arma la plantilla y
# se mide la cobertura.
.equiv_inst_por_base <- function(sid) {
  s <- session_get(sid, required = FALSE)
  bases <- names(((s %||% list())$estudio %||% list())$bases %||% list())
  out <- list()
  for (b in bases) {
    inst <- (s$rp_inst_sources %||% list())[[b]]
    if (!is.null(inst)) out[[b]] <- inst
  }
  out
}

.equiv_get <- function(sid) {
  s <- session_get(sid, required = FALSE)
  (s %||% list())$equivalencias_publicos
}

# ¿Este estudio puede declarar equivalencias? Reusa el predicado del ADR 0061 en
# vez de reimplementar la condición: si mañana se afina qué cuenta como «bases
# separadas», el scoping de Analítica y esta pestaña se mueven juntos.
.equiv_disponible <- function(sid) {
  if (!exists(".analitica_config_es_por_base", mode = "function")) return(FALSE)
  isTRUE(.analitica_config_es_por_base(sid))
}

.equiv_requiere_disponible <- function(sid) {
  if (!.equiv_disponible(sid)) {
    stop_api(409, "E_EQUIV_NO_APLICA",
             paste("La equivalencia entre públicos sólo aplica a estudios con varias bases",
                   "que no comparten instrumento."))
  }
}

# Escribe las etiquetas de la declaración en la config de CADA base.
#
# Nunca en la global: ese es el guard directo contra la regresión del ADR 0061 —
# en el estudio medido serían 152 etiquetas filtrándose entre públicos en vez de
# las 10 que ya causaron el defecto.
#
# Una entrada que ya existe NO se pisa: se cuenta y se reporta. No podemos saber
# si es anterior o posterior a esta importación, y destruir en silencio el
# trabajo manual del analista es peor que dejar dos verdades visibles y dichas
# (ADR 0062, regla 6).
.equiv_aplicar_a_analitica <- function(sid, equiv) {
  labels_por_base <- .equiv_variable_labels_por_base(equiv)
  s <- session_get(sid)
  configs <- s$analitica_config_por_base
  if (!is.list(configs)) configs <- list()

  resumen <- list()
  for (b in names(labels_por_base)) {
    nuevas <- labels_por_base[[b]]
    if (!length(nuevas)) {
      resumen[[b]] <- list(aplicadas = 0L, conservadas = 0L)
      next
    }
    cfg <- configs[[b]]
    if (is.null(cfg)) cfg <- .analitica_default_config()
    if (!is.list(cfg$datos)) cfg$datos <- list()
    actuales <- cfg$datos$variable_labels
    if (!is.list(actuales)) actuales <- list()

    aplicadas <- 0L
    conservadas <- 0L
    for (var in names(nuevas)) {
      previo <- actuales[[var]]
      if (!is.null(previo) && nzchar(as.character(previo)) &&
          !identical(as.character(previo), as.character(nuevas[[var]]))) {
        conservadas <- conservadas + 1L
        next
      }
      actuales[[var]] <- as.character(nuevas[[var]])
      aplicadas <- aplicadas + 1L
    }
    cfg$datos$variable_labels <- actuales
    configs[[b]] <- cfg
    resumen[[b]] <- list(aplicadas = aplicadas, conservadas = conservadas)
  }

  session_set(sid, "analitica_config_por_base", configs)
  resumen
}

# Estado que consume la pestaña: la declaración vigente, su cobertura contra los
# instrumentos de hoy y si algún sello dejó de coincidir.
.equiv_estado <- function(sid) {
  disponible <- .equiv_disponible(sid)
  equiv <- .equiv_get(sid)
  if (!disponible || is.null(equiv)) {
    return(list(
      ok = TRUE, disponible = disponible, declarada = FALSE,
      n_filas = 0L, bases = character(0), cobertura = list(), desfasadas = character(0),
      revision = ""
    ))
  }

  inst_por_base <- .equiv_inst_por_base(sid)
  cobertura <- .equiv_cobertura(equiv, inst_por_base)

  # Sello: comparar el de hoy contra el guardado. Un instrumento que cambió no
  # invalida la declaración entera —sus otras filas siguen sirviendo— pero sí
  # tiene que decirse, porque un artefacto manual no avisa de su propio desfase.
  sellos_guardados <- equiv$sellos %||% list()
  desfasadas <- character(0)
  for (b in names(cobertura)) {
    guardado <- as.character(sellos_guardados[[b]] %||% "")
    actual <- as.character(cobertura[[b]]$sello %||% "")
    if (nzchar(guardado) && nzchar(actual) && !identical(guardado, actual)) {
      desfasadas <- c(desfasadas, b)
    }
  }

  list(
    ok = TRUE,
    disponible = TRUE,
    declarada = TRUE,
    schema = equiv$schema,
    n_filas = as.integer(equiv$n_filas %||% length(equiv$filas)),
    n_sin_etiqueta = as.integer(equiv$n_sin_etiqueta %||% 0L),
    bases = as.character(equiv$bases %||% character(0)),
    importada_en = as.character(equiv$importada_en %||% ""),
    # Huella del contenido: Gráficos la compara contra la que quedó grabada al
    # aplicar el mazo para saber si la propuesta envejeció (ADR 0063).
    revision = .equiv_declaracion_revision(equiv),
    cobertura = cobertura,
    desfasadas = desfasadas,
    filas = equiv$filas
  )
}

# Escribe la plantilla poblada y la registra como archivo descargable.
.equiv_escribir_plantilla <- function(sid) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop_api(500, "E_EQUIV_SIN_OPENXLSX", "El paquete R 'openxlsx' no está instalado.")
  }
  inst_por_base <- .equiv_inst_por_base(sid)
  df <- .equiv_plantilla_df(inst_por_base, .equiv_get(sid))

  s <- session_get(sid)
  dir_out <- file.path(s$dir, "downloads")
  dir.create(dir_out, recursive = TRUE, showWarnings = FALSE)
  path <- file.path(dir_out, sprintf("equivalencias_publicos_%s.xlsx",
                                     format(Sys.Date(), "%d_%m_%y")))

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, .EQUIV_HOJA_PLANTILLA)
  openxlsx::writeData(wb, .EQUIV_HOJA_PLANTILLA, df, withFilter = nrow(df) > 0L)
  # Las columnas `*_etiqueta` son ayuda de lectura y no entran a la declaración;
  # se marcan en gris para que se vean como lo que son y nadie las edite creyendo
  # que cambian algo.
  gris <- openxlsx::createStyle(fontColour = "#5F6368", textDecoration = "italic")
  cols_ayuda <- which(grepl(paste0(.EQUIV_SUFIJO_ETIQUETA, "$"), names(df)))
  if (length(cols_ayuda) && nrow(df) > 0L) {
    openxlsx::addStyle(wb, .EQUIV_HOJA_PLANTILLA, gris,
                       rows = seq_len(nrow(df)) + 1L, cols = cols_ayuda,
                       gridExpand = TRUE, stack = TRUE)
  }
  cabecera <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#E8EAED")
  openxlsx::addStyle(wb, .EQUIV_HOJA_PLANTILLA, cabecera, rows = 1L,
                     cols = seq_along(df), gridExpand = TRUE, stack = TRUE)
  openxlsx::freezePane(wb, .EQUIV_HOJA_PLANTILLA, firstRow = TRUE)
  openxlsx::setColWidths(wb, .EQUIV_HOJA_PLANTILLA, cols = seq_along(df), widths = "auto")
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)

  .register_output_file(sid, "equivalencias_plantilla", path)
}

# Importa desde un archivo ya subido al file store.
.equiv_importar_desde_file <- function(sid, file_id, hoja = NULL) {
  if (!requireNamespace("readxl", quietly = TRUE)) {
    stop_api(500, "E_EQUIV_SIN_READXL", "El paquete R 'readxl' no está instalado.")
  }
  s <- session_get(sid)
  meta <- s$files[[as.character(file_id %||% "")]]
  if (is.null(meta) || is.null(meta$path) || !file.exists(meta$path)) {
    stop_api(404, "E_EQUIV_ARCHIVO_NO_ENCONTRADO",
             "No se encontró el archivo de la matriz en el almacén de la sesión.")
  }

  hojas <- readxl::excel_sheets(meta$path)
  # Sin hoja pedida: la canónica si está, y si no la primera. Una matriz escrita
  # fuera de la app no tiene por qué llamar a su hoja como nosotros.
  hoja_sel <- if (!is.null(hoja) && nzchar(as.character(hoja)[1])) {
    as.character(hoja)[1]
  } else if (.EQUIV_HOJA_PLANTILLA %in% hojas) {
    .EQUIV_HOJA_PLANTILLA
  } else {
    hojas[1]
  }
  if (!hoja_sel %in% hojas) {
    stop_api(400, "E_EQUIV_HOJA_NO_ENCONTRADA",
             sprintf("La hoja '%s' no existe en el archivo. Disponibles: %s.",
                     hoja_sel, paste(hojas, collapse = ", ")))
  }

  df <- as.data.frame(
    readxl::read_excel(meta$path, sheet = hoja_sel, .name_repair = "unique"),
    stringsAsFactors = FALSE
  )
  bases <- names(.equiv_inst_por_base(sid))
  equiv <- .equiv_desde_df(df, bases)

  # Sello por base al momento de importar: es lo que permite decir después «esto
  # se validó contra otro instrumento».
  inst_por_base <- .equiv_inst_por_base(sid)
  equiv$sellos <- lapply(inst_por_base, .equiv_sello_instrumento)
  equiv$importada_en <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  equiv$origen <- list(file_id = as.character(file_id), hoja = hoja_sel)

  # Literal a proposito: el gate de session_schema.R escanea la clave en el
  # texto, y una constante lo dejaria ciego a esta escritura.
  session_set(sid, "equivalencias_publicos", equiv)
  resumen <- .equiv_aplicar_a_analitica(sid, equiv)

  list(estado = .equiv_estado(sid), aplicacion = resumen)
}

# Guarda la declaracion editada en la pestana. Misma forma que la importada, asi
# que Excel y editor producen el MISMO artefacto — es lo que impide que las dos
# vias se separen y que una acabe pudiendo expresar cosas que la otra no.
.equiv_guardar_declaracion <- function(sid, filas) {
  bases <- names(.equiv_inst_por_base(sid))
  limpias <- list()
  for (f in (filas %||% list())) {
    vars <- list()
    for (b in bases) {
      v <- .equiv_var_canonica((f$variables %||% list())[[b]] %||% "")
      if (nzchar(v)) vars[[b]] <- v
    }
    # Una fila sin ninguna variable no declara nada; guardarla solo ensuciaria
    # la tabla y el conteo.
    if (!length(vars)) next
    limpias[[length(limpias) + 1L]] <- list(
      seccion = as.character(f$seccion %||% ""),
      etiqueta_estandar = trimws(as.character(f$etiqueta_estandar %||% "")),
      variables = vars,
      diapositiva = trimws(as.character(f$diapositiva %||% "")),
      cantidad = length(vars)
    )
  }

  inst_por_base <- .equiv_inst_por_base(sid)
  equiv <- list(
    schema = "equivalencias_publicos/v1",
    bases = bases,
    filas = limpias,
    n_filas = length(limpias),
    n_sin_etiqueta = sum(vapply(limpias, function(f) !nzchar(f$etiqueta_estandar), logical(1))),
    sellos = lapply(inst_por_base, .equiv_sello_instrumento),
    importada_en = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    origen = list(hoja = "editor")
  )
  session_set(sid, "equivalencias_publicos", equiv)
  resumen <- .equiv_aplicar_a_analitica(sid, equiv)
  list(estado = .equiv_estado(sid), aplicacion = resumen)
}

mount_equivalencias <- function(pr) {
  pr |>
    plumber::pr_get("/api/carga/equivalencias", wrap_endpoint(function(req, res) {
      .equiv_estado(session_header(req))
    })) |>

    plumber::pr_post("/api/carga/equivalencias/plantilla", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      .equiv_requiere_disponible(sid)
      meta <- .equiv_escribir_plantilla(sid)
      list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name,
           size = meta$size)
    })) |>

    plumber::pr_post("/api/carga/equivalencias/importar", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      .equiv_requiere_disponible(sid)
      body <- .analitica_json_body(req)
      file_id <- as.character(body$file_id %||% "")
      if (!nzchar(file_id)) {
        stop_api(400, "E_EQUIV_FILE_ID_REQUERIDO",
                 "Body debe incluir 'file_id' del archivo de la matriz.")
      }
      out <- .equiv_importar_desde_file(sid, file_id, body$hoja)
      c(list(ok = TRUE), out)
    })) |>

    plumber::pr_get("/api/carga/equivalencias/variables", wrap_endpoint(function(req, res) {
      # Catalogo por base para los selectores del editor. Va aparte del estado
      # porque son cientos de entradas (300 en el estudio medido) y el estado se
      # pide en cada montaje de la pestana.
      sid <- session_header(req)
      .equiv_requiere_disponible(sid)
      inst_por_base <- .equiv_inst_por_base(sid)
      out <- lapply(inst_por_base, function(inst) {
        vars <- .equiv_variables_de_base(inst)
        lapply(seq_len(nrow(vars)), function(i) {
          list(name = vars$name[i], label = vars$label[i], seccion = vars$seccion[i])
        })
      })
      list(ok = TRUE, variables = out)
    })) |>

    plumber::pr_get("/api/carga/equivalencias/sugerencias", wrap_endpoint(function(req, res) {
      # Se calculan a pedido y NUNCA se guardan solas: viajan marcadas para que
      # la pestana pueda mostrarlas como propuesta y no como decision tomada.
      sid <- session_header(req)
      .equiv_requiere_disponible(sid)
      list(ok = TRUE, sugerencias = .equiv_sugerir(.equiv_inst_por_base(sid)))
    })) |>

    plumber::pr_post("/api/carga/equivalencias/declaracion", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      .equiv_requiere_disponible(sid)
      body <- .analitica_json_body(req)
      if (is.null(body$filas)) {
        stop_api(400, "E_EQUIV_FILAS_REQUERIDAS",
                 "Body debe incluir 'filas' con la declaracion editada.")
      }
      c(list(ok = TRUE), .equiv_guardar_declaracion(sid, body$filas))
    }))
}
