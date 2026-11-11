# Vista previa de las tablas de Frecuencias (POST /api/analitica/frecuencias/preview).
#
# Devuelve, como datos, las tablas que el archivo de Frecuencias escribiría para
# la base activa con la configuración guardada. No recalcula nada por su cuenta:
#
#   - la base, el instrumento, las secciones, el orden, las numéricas, los
#     códigos especiales, la ponderación y las notas salen de
#     `.analitica_frecuencias_args_fn()` (analitica_frecuencias_export.R), la
#     misma preparación que usa el render del archivo;
#   - qué variables entran y en qué orden lo decide `.freq_plan_archivo()`;
#   - cada tabla sale de `.freq_tabla_archivo()` o `.freq_resumen_archivo()`, y su
#     título y sus notas de `.freq_titulo_archivo()` y `.freq_notas_archivo()`
#     (reporte_frecuencias.R), las mismas piezas que consumen los writers.
#
# Cifras (definición única, la del archivo):
#   - `n`: suma de `peso` de los casos de la fila; sin ponderación es un conteo.
#   - `pct`: proporción de 0 a 1 sobre el Total de la tabla, sin redondear.
#   - Total de respuesta única: casos que respondieron la pregunta.
#   - Total de respuesta múltiple: casos que marcaron al menos una opción (no la
#     suma de las opciones, que puede pasar de 1).
#   - Resumen numérico: "Casos válidos" es un conteo SIN ponderar de las filas con
#     valor numérico y peso mayor que cero; el resto usa `peso` y viene
#     redondeado a un decimal por el motor.
#
# Base de cada tabla (`base.n` de `base.de`): casos SIN ponderar, enteros, con
# peso mayor que cero (regla I1). `base.n` es el denominador del porcentaje
# contado en casos; `base.de`, los casos que cuentan. Sale de
# `analitica_frecuencias_base.R`; el archivo no la escribe.
#
# Casos: `casos$cuentan` son las filas de la base que entran a las tablas, con el
# universo de análisis ("qué casos cuentan") ya aplicado al preparar la fuente.
#
# Multibase: la vista previa es de la base ACTIVA. El archivo puede traer más
# bases (una hoja de cálculo por base dentro de un ZIP); `base$bases_del_archivo`
# las lista y aquí nunca se mezclan.

.FRECUENCIAS_PREVIEW_LIMITE_DEFECTO <- 50L
.FRECUENCIAS_PREVIEW_LIMITE_MAX <- 500L

# Valida el cuerpo del pedido. Todo es opcional:
#   variables: lista de nombres de variable; ausente = todas las del archivo.
#   limite:    tope de tablas a devolver (1 a .FRECUENCIAS_PREVIEW_LIMITE_MAX).
# Una clave que no se conoce se rechaza: un `variable` en singular devolvería
# todas las tablas sin avisar de que el filtro no se aplicó.
.frecuencias_preview_entrada <- function(body) {
  mal <- function(campo, mensaje) {
    stop_api(400, "E_BAD_REQUEST", mensaje, details = list(campo = campo))
  }
  if (is.null(body)) body <- list()
  if (!is.list(body) || (length(body) > 0L && is.null(names(body)))) {
    mal("cuerpo", "El cuerpo del pedido debe ser un objeto JSON.")
  }
  ajenas <- setdiff(names(body), c("variables", "limite"))
  if (length(ajenas)) {
    mal(ajenas[[1]], sprintf(
      "El pedido trae un campo que la vista previa de Frecuencias no reconoce: '%s'. Admite 'variables' y 'limite'.",
      ajenas[[1]]
    ))
  }

  variables <- NULL
  if (!is.null(body$variables)) {
    v <- body$variables
    es_lista <- is.list(v) && is.null(names(v))
    es_nombre <- function(x) is.character(x) && length(x) == 1L && !is.na(x) && nzchar(trimws(x))
    if (!es_lista || !all(vapply(v, es_nombre, logical(1)))) {
      mal("variables", "'variables' debe ser una lista de nombres de variable.")
    }
    variables <- unique(trimws(vapply(v, as.character, character(1))))
  }

  limite <- .FRECUENCIAS_PREVIEW_LIMITE_DEFECTO
  if (!is.null(body$limite)) {
    l <- body$limite
    ok <- is.numeric(l) && length(l) == 1L && is.finite(l) && l == round(l) &&
      l >= 1 && l <= .FRECUENCIAS_PREVIEW_LIMITE_MAX
    if (!isTRUE(ok)) {
      mal("limite", sprintf("'limite' debe ser un número entero entre 1 y %d.",
                            .FRECUENCIAS_PREVIEW_LIMITE_MAX))
    }
    limite <- as.integer(l)
  }

  list(variables = variables, limite = limite)
}

# Código del instrumento de cada fila de una tabla.
#
# El motor del archivo tabula por código y después lo reemplaza por su rótulo;
# la tabla que escribe ya no trae el código. Aquí se recupera con las mismas
# fuentes de rótulos del motor (`labels` del dato y la lista de respuestas del
# instrumento) y solo cuando UN código lleva ese rótulo: si dos opciones
# comparten rótulo, el archivo las suma en una fila y el código queda vacío.
.frecuencias_preview_codigos <- function(etiquetas, var, data, orders_list) {
  codigos <- character(0)
  rotulos <- character(0)
  if (is.data.frame(data) && var %in% names(data)) {
    lab_attr <- attr(data[[var]], "labels", exact = TRUE)
    if (!is.null(lab_attr) && length(lab_attr)) {
      codigos <- c(codigos, as.character(names(lab_attr)))
      rotulos <- c(rotulos, as.character(unname(lab_attr)))
    }
  }
  entrada <- .freq_orders_entry(orders_list, var)
  if (!is.null(entrada)) {
    codigos <- c(codigos, as.character(entrada$names))
    rotulos <- c(rotulos, as.character(entrada$labels))
  }
  if (!length(codigos)) return(rep(NA_character_, length(etiquetas)))
  rotulos <- .freq_clean_other_label_es(rotulos)
  vapply(as.character(etiquetas), function(e) {
    cand <- unique(codigos[!is.na(rotulos) & rotulos == e])
    cand <- cand[!is.na(cand) & nzchar(cand)]
    if (length(cand) == 1L) cand else NA_character_
  }, character(1), USE.NAMES = FALSE)
}

# Bloque de UNA variable tal como sale en el archivo.
.frecuencias_preview_tabla <- function(args, ctx, plan, sec, p) {
  v <- p$var
  # La base va en casos sin ponderar (I1): analitica_frecuencias_base.R.
  con_peso <- .frecuencias_base_con_peso(args$data)
  out <- list(
    variable = v,
    variable_origen = if (grepl("_recod$", v)) sub("_recod$", "", v) else NA_character_,
    etiqueta = .freq_titulo_archivo(v, ctx$dic_vars, NULL, ctx$orders_list, args$data),
    tipo = NA_character_,
    seccion = list(
      nombre = sec$nombre,
      # El archivo solo escribe el rótulo de sección si la opción está encendida.
      rotulo = if (isTRUE(args$incluir_secciones)) sec$rotulo else NA_character_
    ),
    orden = NA_character_,
    lista_ordinal = isTRUE(p$ordinal),
    sin_datos = FALSE,
    filas = list(),
    total = list(n = NA_real_, pct = NA_real_),
    base = list(n = NA_integer_, de = con_peso, denominador = NA_character_),
    resumen = list(),
    notas = list()
  )
  notas <- .freq_notas_archivo(plan$fuente, p$base_texto)

  if (isTRUE(p$numerica)) {
    tabn <- .freq_resumen_archivo(args$data, v)
    out$tipo <- "numerica"
    out$sin_datos <- !nrow(tabn)
    out$resumen <- lapply(seq_len(nrow(tabn)), function(i) {
      list(estadistico = as.character(tabn$estadistico[[i]]), valor = as.numeric(tabn$valor[[i]]))
    })
    out$base$n <- .frecuencias_base_numerica(tabn)
    out$base$denominador <- "casos_validos"
    if (!out$sin_datos) out$notas <- as.list(notas)
    return(out)
  }

  det <- .freq_deteccion_variable(args$data, v, ctx$survey, args$sm_vars_force, ctx$orders_list)
  multiple <- identical(det$tipo, "sm")
  tab <- .freq_tabla_archivo(
    args$data, v,
    survey = ctx$survey,
    sm_vars_force = args$sm_vars_force,
    orders_list = ctx$orders_list,
    mostrar_todo = args$mostrar_todo,
    codigos_solo_si_presentes = args$codigos_solo_si_presentes,
    orden = p$orden,
    incluir_porcentajes = args$incluir_porcentajes %||% TRUE
  )
  out$tipo <- if (multiple) "multiple" else "unica"
  out$orden <- as.character(p$orden)
  out$base$denominador <- if (multiple) "marcaron_alguna_opcion" else "respondieron"

  if (!nrow(tab)) {
    # El archivo escribe "Sin datos" y no pone notas al pie.
    out$sin_datos <- TRUE
    out$total <- list(n = 0, pct = NA_real_)
    out$base$n <- 0L
    return(out)
  }
  out$base$n <- .frecuencias_base_categorica(
    args$data, v,
    survey = ctx$survey,
    sm_vars_force = args$sm_vars_force,
    orders_list = ctx$orders_list,
    mostrar_todo = args$mostrar_todo,
    codigos_solo_si_presentes = args$codigos_solo_si_presentes
  )

  pct <- if ("pct" %in% names(tab)) as.numeric(tab$pct) else rep(NA_real_, nrow(tab))
  es_total <- as.character(tab$Opciones) == "Total"
  # El Total es la última fila con ese rótulo; una opción que se llame "Total"
  # queda entre las filas, no se pierde.
  i_total <- if (any(es_total)) max(which(es_total)) else NA_integer_
  i_filas <- setdiff(seq_len(nrow(tab)), i_total)
  etiquetas <- as.character(tab$Opciones[i_filas])
  codigos <- .frecuencias_preview_codigos(etiquetas, v, args$data, ctx$orders_list)
  especiales <- as.character(args$codigos_solo_si_presentes %||% character(0))
  out$filas <- lapply(seq_along(i_filas), function(k) {
    i <- i_filas[[k]]
    codigo <- codigos[[k]]
    list(
      codigo = codigo,
      etiqueta = etiquetas[[k]],
      n = as.numeric(tab$n[[i]]),
      pct = pct[[i]],
      # Sin código resuelto, la fila muestra el valor crudo: se compara ese.
      especial = (if (is.na(codigo)) etiquetas[[k]] else codigo) %in% especiales
    )
  })
  if (!is.na(i_total)) {
    out$total <- list(n = as.numeric(tab$n[[i_total]]), pct = pct[[i_total]])
  }
  out$notas <- as.list(notas)
  out
}

# Tablas del archivo a partir de los argumentos de `reporte_frecuencias()`.
#
# `args` es la salida de `.analitica_frecuencias_args_fn()`. `variables` filtra
# por nombre (el que se tabula, o el de la pregunta original cuando el archivo
# la sustituye por su `_recod`); el orden siempre es el del archivo. Un nombre
# pedido que no tiene tabla nunca se descarta callado: va en `sin_tabla` con su
# motivo. `excluidas` solo sirve para decir ese motivo.
frecuencias_preview_tablas <- function(args, variables = NULL,
                                       limite = .FRECUENCIAS_PREVIEW_LIMITE_DEFECTO,
                                       excluidas = character(0)) {
  vacio <- list(total_variables = 0L, devueltas = 0L, recortado = FALSE,
                tablas = list(), sin_tabla = list(), sin_tablas_en_el_archivo = TRUE)
  ctx <- tryCatch(
    .freq_reporte_contexto(args$data, args$instrumento, args$secciones),
    freq_sin_tablas = function(e) NULL
  )
  entradas <- list()
  plan <- NULL
  if (!is.null(ctx)) {
    plan <- .freq_plan_archivo(
      args$data, ctx$SECCIONES,
      numericas = args$numericas, orden = args$orden,
      ordinal_lists = args$ordinal_lists, survey = ctx$survey,
      notas = args$notas, fuente = args$fuente
    )
    for (sec in plan$secciones) {
      for (p in sec$variables) entradas[[length(entradas) + 1L]] <- list(sec = sec, p = p)
    }
  }
  nombres <- vapply(entradas, function(e) as.character(e$p$var), character(1))

  elegidas <- seq_along(entradas)
  sin_tabla <- list()
  if (!is.null(variables)) {
    elegidas <- integer(0)
    en_base <- unique(c(names(args$data), as.character((args$instrumento$survey %||% list())$name)))
    for (r in as.character(variables)) {
      hit <- which(nombres == r)
      # Misma sustitución que el archivo: la pregunta original sale por su `_recod`.
      if (!length(hit)) hit <- which(nombres == paste0(r, "_recod"))
      if (length(hit)) {
        elegidas <- c(elegidas, hit)
        next
      }
      motivo <- if (r %in% excluidas) {
        "excluida"
      } else if (r %in% en_base) {
        "fuera_del_archivo"
      } else {
        "desconocida"
      }
      sin_tabla[[length(sin_tabla) + 1L]] <- list(variable = r, motivo = motivo)
    }
    elegidas <- sort(unique(elegidas))
  }
  if (!length(entradas)) {
    vacio$sin_tabla <- sin_tabla
    return(vacio)
  }

  recortado <- length(elegidas) > limite
  if (recortado) elegidas <- elegidas[seq_len(limite)]
  tablas <- lapply(entradas[elegidas], function(e) {
    .frecuencias_preview_tabla(args, ctx, plan, e$sec, e$p)
  })
  list(
    total_variables = length(entradas),
    devueltas = length(tablas),
    recortado = recortado,
    tablas = tablas,
    sin_tabla = sin_tabla,
    sin_tablas_en_el_archivo = FALSE
  )
}

# Fuentes del archivo de Frecuencias y cuál es la base activa. Mismas fuentes
# que recorre `run_report_per_base()`: las de Analítica, acotadas a la activa
# cuando el estudio procesa sus bases por separado.
.frecuencias_preview_fuentes <- function(sid) {
  src <- .load_rp_sources(sid)
  scoped <- estudio_processing_filter_sources(sid, src$data_sources, src$inst_sources)
  ds <- scoped$data_sources
  if (!length(ds)) {
    stop_api(409, "E_NO_RP_DATA",
             "El estudio no tiene base analítica preparada. Reingresa a Analítica para preparar la fuente activa.")
  }
  base <- .analitica_active_source_name(sid, names(ds))
  list(
    base = base,
    data = ds[[base]],
    inst = scoped$inst_sources[[base]],
    bases = names(ds)
  )
}

# Estado de la ponderación con que salen las cifras, para la respuesta.
.frecuencias_preview_ponderacion <- function(data, cfg_pond) {
  pond <- (cfg_pond %||% list())$ponderacion
  configurada <- is.list(pond) && isTRUE(.analitica_ponderacion_scalar(pond$enabled, FALSE))
  estado <- reporte_ponderacion_estado_corrida(data, cfg_pond)
  num <- function(x) {
    x <- suppressWarnings(as.numeric(x %||% NA_real_)[1])
    if (is.finite(x)) x else NA_real_
  }
  txt <- function(x) {
    x <- as.character(x %||% NA_character_)[1]
    if (is.na(x) || !nzchar(x)) NA_character_ else x
  }
  aplicada <- is.list(estado) && identical(as.character(estado$status %||% "")[1], "aplicada")
  list(
    configurada = configurada,
    estado = if (is.list(estado)) txt(estado$status) else "sin_config",
    # El modo y la columna solo describen pesos que sí se aplicaron.
    modo = if (aplicada) txt(estado$modo) else NA_character_,
    peso_columna = if (aplicada) txt(estado$peso_columna) else NA_character_,
    motivo = if (is.list(estado)) txt(estado$motivo) else NA_character_,
    n_efectivo = if (is.list(estado)) num(estado$n_eff) else NA_real_,
    deff = if (is.list(estado)) num(estado$deff) else NA_real_,
    sello = reporte_ponderacion_sello(estado),
    escala = .frecuencias_base_escala(estado, pond)
  )
}

#' Vista previa de las tablas de Frecuencias de la base activa.
#'
#' @param sid Sesión.
#' @param variables Nombres de variable a devolver; `NULL` son todas las del archivo.
#' @param limite Tope de tablas a devolver.
#' @return Lista serializable: ver la cabecera del archivo y
#'   `test-analitica-frecuencias-preview.R`.
#' @keywords internal
analitica_frecuencias_preview <- function(sid, variables = NULL,
                                          limite = .FRECUENCIAS_PREVIEW_LIMITE_DEFECTO) {
  cfg <- .analitica_cfg_with_effective_source(sid, .analitica_get_config(sid))
  f <- .frecuencias_preview_fuentes(sid)

  # Lo que el motor avisa al preparar la base (por ejemplo, una ponderación
  # configurada que no se pudo aplicar) viaja tal cual en `avisos`.
  avisos <- list()
  args <- withCallingHandlers(
    .analitica_frecuencias_args_fn(sid, cfg)(f$data, f$inst, f$base),
    warning = function(w) {
      avisos[[length(avisos) + 1L]] <<- list(codigo = "motor", mensaje = conditionMessage(w))
      invokeRestart("muffleWarning")
    }
  )
  res <- frecuencias_preview_tablas(
    args, variables = variables, limite = limite,
    excluidas = .as_chr_vec(cfg$variables_excluidas)
  )

  if (isTRUE(res$sin_tablas_en_el_archivo)) {
    avisos[[length(avisos) + 1L]] <- list(
      codigo = "sin_tablas",
      mensaje = "El archivo no tendría tablas: ninguna variable de las secciones configuradas está en esta base."
    )
  }
  if (length(res$sin_tabla)) {
    faltan <- vapply(res$sin_tabla, function(x) x$variable, character(1))
    avisos[[length(avisos) + 1L]] <- list(
      codigo = "variables_sin_tabla",
      mensaje = sprintf(
        if (length(faltan) == 1L) "%d variable pedida no tiene tabla en el archivo: %s." else "%d variables pedidas no tienen tabla en el archivo: %s.",
        length(faltan), paste(faltan, collapse = ", ")
      )
    )
  }

  list(
    ok = TRUE,
    base = list(
      nombre = f$base,
      bases_del_archivo = as.list(f$bases),
      n_bases = length(f$bases),
      independientes = isTRUE(estudio_is_independent_siblings(sid))
    ),
    fuente = as.character(cfg$fuente_preferida %||% NA_character_)[1],
    ponderado = "peso" %in% names(args$data),
    ponderacion = .frecuencias_preview_ponderacion(
      args$data, .analitica_ponderacion_cfg_base(sid, f$base, cfg)
    ),
    # `cuentan` son las filas que entran a las tablas, con el universo de
    # análisis ya aplicado. Cuántas tenía la base antes de ese filtro lo publica
    # GET /api/analitica/universo, que es la única fuente de esa cifra.
    # `con_peso` son las que tienen peso > 0: el `base.de` de cada tabla.
    casos = list(
      cuentan = nrow(args$data),
      suma_pesos = sum(.peso_vec(args$data)),
      con_peso = .frecuencias_base_con_peso(args$data)
    ),
    escala_pct = "proporcion",
    opciones = list(
      orden = args$orden,
      mostrar_todo = isTRUE(args$mostrar_todo),
      incluir_secciones = isTRUE(args$incluir_secciones),
      codigos_especiales = as.list(as.character(args$codigos_solo_si_presentes %||% character(0)))
    ),
    limite = as.integer(limite),
    total_variables = as.integer(res$total_variables),
    devueltas = as.integer(res$devueltas),
    recortado = isTRUE(res$recortado),
    tablas = res$tablas,
    sin_tabla = res$sin_tabla,
    avisos = avisos
  )
}

# POST /api/analitica/frecuencias/preview  {variables?, limite?}
# Solo lectura: no marca el proyecto ni el estado de la etapa. Las cifras viajan
# sin redondear (el serializador global deja cuatro decimales y un 0.12345
# llegaría 0.1235, que al mostrarse con un decimal ya no coincide con el archivo).
mount_analitica_frecuencias_preview <- function(pr) {
  pr |>
    plumber::pr_post("/api/analitica/frecuencias/preview",
                     serializer = .cm_serializer_sin_redondeo(),
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      entrada <- .frecuencias_preview_entrada(.analitica_json_body(req))
      analitica_frecuencias_preview(sid, variables = entrada$variables, limite = entrada$limite)
    }))
}
