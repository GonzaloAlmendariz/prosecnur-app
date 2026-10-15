# Router de la equivalencia entre públicos (ADR 0062)
# ===================================================
#
# Delgado: valida input, delega en `equivalencias_publicos.R` (motor puro) y
# serializa. Vive en archivo propio y no dentro de `router_carga.R` porque ese ya
# pasa de 2.000 líneas; la regla de la casa es que la funcionalidad nueva estrena
# archivo y el grande la llama, no al revés.

# Instrumentos por base del estudio, que es contra lo que se mide la cobertura.
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
      revision = "", armonizacion_periodos = list()
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
    # Cuántas filas siguen siendo propuesta. Se cuenta aquí y no en el cliente
    # para que el chip de la pestaña y el pie del editor digan lo mismo.
    n_sugeridas = as.integer(sum(vapply(equiv$filas %||% list(),
                                        function(f) isTRUE(f$sugerida), logical(1)))),
    bases = as.character(equiv$bases %||% character(0)),
    # Contrato E4-E7 (R3): orden de la serie (nombres de base). Siempre arreglo:
    # una lista y no un vector, para que uno solo no viaje como escalar.
    armonizacion_periodos = as.list(as.character(unlist(equiv$armonizacion_periodos %||% character(0)))),
    importada_en = as.character(equiv$importada_en %||% ""),
    # Huella del contenido: Gráficos la compara contra la que quedó grabada al
    # aplicar el mazo para saber si la propuesta envejeció (ADR 0063). Con los
    # instrumentos: la huella de listas es parte de la revisión (ADR 0096).
    revision = .equiv_declaracion_revision(equiv, inst_por_base),
    cobertura = cobertura,
    desfasadas = desfasadas,
    filas = equiv$filas
  )
}

# Guarda la declaracion editada en la pestana. ADR 0104: la matriz se arma en la
# app; el editor es la unica via de declarar filas (la plantilla Excel, «Subir
# matriz» y «Proponer emparejados» se retiraron). «Importar por bloques» produce
# la misma forma para series de mediciones.
#
# Contrato E4-E7 (R3): `armonizacion` por fila y `armonizacion_periodos` en la
# raíz. Una fila que NO trae la clave `armonizacion` conserva la de la fila
# previa con las mismas variables (un editor que no conoce el campo no lo borra);
# una fila que la manda en null la borra. `armonizacion_periodos = NULL` conserva
# el orden vigente.
.equiv_guardar_declaracion <- function(sid, filas, armonizacion_periodos = NULL) {
  bases <- names(.equiv_inst_por_base(sid))
  previo <- .equiv_get(sid)
  limpias <- list()
  ausentes <- logical(0)
  ausentes_der <- logical(0)
  for (f in (filas %||% list())) {
    vars <- list()
    for (b in bases) {
      v <- .equiv_var_canonica((f$variables %||% list())[[b]] %||% "")
      if (nzchar(v)) vars[[b]] <- v
    }
    # ADR 0105: un indicador compuesto escribe su expresión `alguna(...)` en
    # `variables[base]`; por eso se normaliza antes de descartar filas vacías.
    der <- .equiv_deriv_normalizar(f$derivada, bases, trimws(as.character(f$etiqueta_estandar %||% "")))
    vars <- .equiv_deriv_variables(vars, der)
    # Una fila sin ninguna variable no declara nada; guardarla solo ensuciaria
    # la tabla y el conteo.
    if (!length(vars)) next
    limpia <- list(
      seccion = as.character(f$seccion %||% ""),
      etiqueta_estandar = trimws(as.character(f$etiqueta_estandar %||% "")),
      variables = vars,   # ADR 0103: sin diapositiva, enunciado, gráfico, corte ni estilo
      cantidad = length(vars)
    )
    # ADR 0064: la propuesta SE GUARDA, marcada. La regla anterior la descartaba
    # al guardar, y con la plantilla sembrada eso destruia el trabajo: confirmar
    # diez de cincuenta y ocho propuestas y pulsar Guardar borraba las otras
    # cuarenta y ocho sin ninguna senal. Lo que la prohibicion del ADR 0062
    # protege —que una sugerencia nunca actue como decision— se cumple en los dos
    # sitios donde importa: no escribe etiquetas y no llega al mazo.
    if (isTRUE(f$sugerida)) limpia$sugerida <- TRUE
    # El texto de la pregunta de una matriz por bloques (una serie) describe la pregunta y se queda (ADR 0103).
    enunciado <- trimws(as.character(f$enunciado %||% "")[1])
    if (!is.na(enunciado) && nzchar(enunciado)) limpia$enunciado <- enunciado
    id <- trimws(as.character(f$id %||% ""))[1]
    if (!is.na(id) && nzchar(id)) limpia$id <- id
    arm <- .equiv_armon_normalizar(f$armonizacion, bases, limpia$etiqueta_estandar)
    if (!is.null(arm)) limpia$armonizacion <- arm
    ausentes <- c(ausentes, !("armonizacion" %in% names(f)))
    if (!is.null(der)) limpia$derivada <- der
    ausentes_der <- c(ausentes_der, !("derivada" %in% names(f)))
    limpias[[length(limpias) + 1L]] <- limpia
  }
  limpias <- .equiv_armon_conservar(limpias, previo, solo_ausentes = ausentes)
  limpias <- .equiv_deriv_cerrar(limpias, previo, solo_ausentes = ausentes_der)
  periodos <- if (is.null(armonizacion_periodos)) {
    previo$armonizacion_periodos
  } else {
    .equiv_armon_periodos_normalizar(armonizacion_periodos, bases)
  }

  inst_por_base <- .equiv_inst_por_base(sid)
  equiv <- list(
    schema = "equivalencias_publicos/v1",
    bases = bases,
    filas = limpias,
    n_filas = length(limpias),
    n_sin_etiqueta = sum(vapply(limpias, function(f) !nzchar(f$etiqueta_estandar), logical(1))),
    n_sugeridas = sum(vapply(limpias, function(f) isTRUE(f$sugerida), logical(1))),
    sellos = lapply(inst_por_base, .equiv_sello_instrumento),
    importada_en = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    origen = list(hoja = "editor")
  )
  if (length(periodos)) equiv$armonizacion_periodos <- as.character(periodos)
  session_set(sid, "equivalencias_publicos", equiv)
  resumen <- .equiv_aplicar_a_analitica(sid, equiv)
  list(estado = .equiv_estado(sid), aplicacion = resumen)
}

mount_equivalencias <- function(pr) {
  pr |>
    plumber::pr_get("/api/carga/equivalencias", wrap_endpoint(function(req, res) {
      .equiv_estado(session_header(req))
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
          # `firma` es lo que compara (ADR 0064, E1/E2); `escala` es lo que se
          # lee. Viajan juntas para que la tarjeta no tenga que derivar una de
          # la otra y acabar comparando por el texto truncado.
          list(name = vars$name[i], label = vars$label[i], seccion = vars$seccion[i],
               firma = .equiv_firma_escala(inst, vars$name[i]),
               # Las opciones viajan enteras: cuánto se muestra lo decide la
               # superficie, que es quien sabe cuánto espacio tiene.
               opciones = .equiv_escala_opciones(inst, vars$name[i]))
        })
      })
      list(ok = TRUE, variables = out)
    })) |>

    plumber::pr_post("/api/carga/equivalencias/declaracion", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      .equiv_requiere_disponible(sid)
      body <- .analitica_json_body(req)
      if (is.null(body$filas)) {
        stop_api(400, "E_EQUIV_FILAS_REQUERIDAS",
                 "Body debe incluir 'filas' con la declaracion editada.")
      }
      c(list(ok = TRUE), .equiv_guardar_declaracion(sid, body$filas, body$armonizacion_periodos))
    })) |>

    plumber::pr_get("/api/carga/equivalencias/armonizacion/preview",
                    wrap_endpoint(function(req, res, fila = "", base = "") {
      # Contrato E4-E7 (R3): cómo cae el mapa sobre los datos reales de una base.
      sid <- session_header(req)
      .equiv_requiere_disponible(sid)
      .equiv_armon_preview(sid, fila, base)
    })) |>

    plumber::pr_post("/api/carga/equivalencias/importar-bloques", wrap_endpoint(function(req, res, ...) {
      # Contrato E4-E7 (R3): matriz de correspondencias por bloques del proyecto.
      sid <- session_header(req)
      .equiv_requiere_disponible(sid)
      body <- .analitica_json_body(req)
      file_id <- as.character(body$file_id %||% "")
      if (!nzchar(file_id)) {
        stop_api(400, "E_EQUIV_FILE_ID_REQUERIDO",
                 "Body debe incluir 'file_id' del archivo de la matriz.")
      }
      modo <- as.character(body$modo %||% "previsualizar")[1]
      if (!modo %in% c("previsualizar", "aplicar")) {
        stop_api(400, "E_EQUIV_BLOQUES_MODO",
                 "'modo' debe ser «previsualizar» o «aplicar».")
      }
      c(list(ok = TRUE), equiv_bloques_importar(sid, file_id, body$mapa_periodos,
                                                modo = modo, hoja = body$hoja))
    }))
}
