# Vista previa de las tablas de Cruces (POST /api/analitica/cruces/preview).
#
# Devuelve, como datos, las tablas categóricas que el archivo de Cruces escribiría para la base activa con la
# configuración guardada. No recalcula nada por su cuenta:
#
#   - las bases, el instrumento, las secciones, las variables de cruce, las exclusiones, la ponderación, las notas y
#     la regla de diferencias salen de `.analitica_cruces_preparar()` (analitica_cruces_export.R), la misma
#     preparación que recibe el trabajo del archivo;
#   - qué variables entran y en qué orden lo decide `.cruces_plan_archivo()`, y cada tabla sale de
#     `.cruces_tabla_archivo()` (reporte_cruces_tabla.R), que es lo que escribe `exportar_cruces_multi()`.
#
# Cifras (definición única, la del archivo):
#   - `n` de una celda: suma de `peso` de los casos de la fila en la columna; sin ponderación, un conteo.
#   - `n` de una columna (y de `total`): su denominador, la suma de pesos de los casos de la columna que respondieron
#     una de las categorías de la tabla (única) o marcaron al menos una (múltiple), sin redondear. El archivo escribe
#     en la fila Total ese número redondeado; la pantalla redondea igual. Un solo significado de `n`, como en
#     Frecuencias.
#   - `pct`: `n` de la celda sobre `n` de su columna, de 0 a 1, sin redondear; nulo cuando ese denominador es 0.
#   - `base_n` (regla I1): el mismo denominador contado en casos SIN ponderar, con peso mayor que cero. Entero.
#
# Base y alcance: la base ACTIVA del estudio y, en ella, las filas que deja la preparación (universo de análisis y
# exclusión de categorías de cruce, que quita filas de toda la base). Las numéricas y el modo dimensiones no tienen
# vista previa en esta versión: el archivo sí las trae y la respuesta lo dice en `sin_tabla` o en `avisos`.

.CRUCES_PREVIEW_LIMITE_DEFECTO <- 20L
.CRUCES_PREVIEW_LIMITE_MAX <- 200L

# Valida el cuerpo del pedido. Todo es opcional:
#   variables: lista de nombres de variable de fila; ausente = las primeras del archivo.
#   cruces:    lista de variables de cruce, subconjunto de las configuradas; ausente = todas.
#   limite:    tope de tablas a devolver (1 a .CRUCES_PREVIEW_LIMITE_MAX).
.cruces_preview_entrada <- function(body) {
  mal <- function(campo, mensaje) {
    stop_api(400, "E_BAD_REQUEST", mensaje, details = list(campo = campo))
  }
  if (is.null(body)) body <- list()
  if (!is.list(body) || (length(body) > 0L && is.null(names(body)))) {
    mal("cuerpo", "El cuerpo del pedido debe ser un objeto JSON.")
  }
  ajenas <- setdiff(names(body), c("variables", "cruces", "limite"))
  if (length(ajenas)) {
    mal(ajenas[[1]], sprintf(
      "El pedido trae un campo que la vista previa de Cruces no reconoce: '%s'. Admite 'variables', 'cruces' y 'limite'.",
      ajenas[[1]]
    ))
  }
  nombres <- function(campo) {
    v <- body[[campo]]
    if (is.null(v)) return(NULL)
    es_nombre <- function(x) is.character(x) && length(x) == 1L && !is.na(x) && nzchar(trimws(x))
    if (!(is.list(v) && is.null(names(v))) || !all(vapply(v, es_nombre, logical(1)))) {
      mal(campo, sprintf("'%s' debe ser una lista de nombres de variable.", campo))
    }
    unique(trimws(vapply(v, as.character, character(1))))
  }
  limite <- .CRUCES_PREVIEW_LIMITE_DEFECTO
  if (!is.null(body$limite)) {
    l <- body$limite
    ok <- is.numeric(l) && length(l) == 1L && is.finite(l) && l == round(l) &&
      l >= 1 && l <= .CRUCES_PREVIEW_LIMITE_MAX
    if (!isTRUE(ok)) {
      mal("limite", sprintf("'limite' debe ser un número entero entre 1 y %d.", .CRUCES_PREVIEW_LIMITE_MAX))
    }
    limite <- as.integer(l)
  }
  list(variables = nombres("variables"), cruces = nombres("cruces"), limite = limite)
}

# Letras de una columna, comprobando que la matriz del motor está indexada por las mismas filas y columnas que la
# tabla (por código o por rótulo de fila, según la prueba). Nunca se leen por posición sin esa comprobación.
.cruces_preview_letras <- function(bl, codes_row, opciones, codigo_col) {
  if (is.null(bl)) return(NULL)
  m <- bl$letras
  filas_ok <- identical(rownames(m), as.character(codes_row)) || identical(rownames(m), as.character(opciones))
  if (!filas_ok || !codigo_col %in% colnames(m)) {
    stop_internal("cruces/preview: las letras del motor no corresponden a las filas o columnas de la tabla.")
  }
  as.character(m[, codigo_col])
}

# Modo de las letras de una variable de cruce. Con la regla del estudio y más columnas que `max_letras`, la regla
# compara cada columna frente al resto y la celda lleva flechas, no letras (`.sig_evaluar`, misma cuenta: K columnas).
.cruces_preview_modo_letras <- function(bl, n_columnas) {
  regla <- bl$regla
  if (is.list(regla) && n_columnas > (regla$max_letras %||% 6L)) "frente_al_resto" else "letras"
}

# Una tabla del motor en el formato de la respuesta.
#   `excluidas`: categorías excluidas por variable de cruce. La exclusión quita filas de toda la base, pero el archivo
#     sigue escribiendo su columna; aquí se marca.
#   `unidad`: "encuestado" o "registro", el nivel de los casos de esta tabla.
#   `survey`: para saber si una variable de cruce es de selección múltiple.
.cruces_preview_tabla <- function(tb, sec, rotulo, grano, excluidas = list(), unidad = "encuestado", survey = NULL) {
  codes <- as.character(tb$codes_row)
  casos <- tb$casos %||% list()
  out <- list(
    variable = tb$var,
    etiqueta = as.character(tb$etiqueta),
    tipo = if (identical(tb$tp, "sm")) "multiple" else "unica",
    denominador = if (identical(tb$tp, "sm")) "marcaron_alguna_opcion" else "validos_de_la_columna",
    seccion = list(nombre = sec, rotulo = rotulo),
    grano = grano,
    base = list(n = 0L, de = as.integer(casos$con_peso %||% NA_integer_), unidad = unidad),
    sin_datos = isTRUE(tb$sin_datos),
    # "La tabla existe pero nadie respondió". Con `sin_datos` no hay tabla: falso.
    sin_respuestas = FALSE,
    filas = {
      probadas <- .cruces_preview_filas_probadas(tb)
      lapply(seq_along(codes), function(i) {
        list(codigo = codes[[i]], etiqueta = as.character(tb$opciones[[i]]), probada = probadas[[i]])
      })
    },
    filas_omitidas = tb$omitidas,
    total = NULL,
    cruces = list(),
    significancia = NULL,
    notas = as.list(unname(as.character(tb$pie)))
  )
  if (out$sin_datos) return(out)

  base_total <- as.integer(tb$total$casos)
  out$base$n <- base_total
  out$sin_respuestas <- identical(base_total, 0L)
  out$total <- list(
    n = as.numeric(tb$total$N),
    base_n = base_total,
    casos_sin_fila = as.integer(casos$con_respuesta %||% NA_integer_) - base_total,
    celdas = lapply(seq_along(codes), function(i) {
      list(fila = codes[[i]], n = tb$total$n[[i]], pct = tb$total$pct[[i]])
    })
  )
  out$cruces <- unname(lapply(names(tb$estratos), function(s) {
    e <- tb$estratos[[s]]
    bl <- (tb$sig %||% list())$bloques[[s]]
    multiple <- identical(tipo_pregunta(s, survey = survey), "sm")
    # Con la columna emparejada por rótulo, el motor calcula los porcentajes por rótulo pero compara las letras por
    # código: las letras del archivo no dicen nada. La vista previa no las publica y lo avisa.
    por_rotulo <- !is.null(bl) && identical(e$clave, "rotulo")
    modo <- if (is.null(bl)) NA_character_ else .cruces_preview_modo_letras(bl, length(e$codes))
    exc <- as.character(excluidas[[s]] %||% character(0))
    columnas <- lapply(seq_along(e$codes), function(j) {
      codigo <- as.character(e$codes[[j]])
      letras <- if (por_rotulo) NULL else .cruces_preview_letras(bl, codes, tb$opciones, codigo)
      excluida <- codigo %in% exc
      motivo <- if (excluida) {
        "excluida"
      } else if (!is.null(letras) && any(letras == ".b")) {
        "base_insuficiente"
      } else NA_character_
      list(
        codigo = codigo,
        etiqueta = as.character(e$labels[[j]]),
        letra = if (is.null(letras) || identical(modo, "frente_al_resto")) NA_character_ else openxlsx::int2col(j),
        n = as.numeric(e$N[[j]]),
        base_n = as.integer(e$casos[[j]]),
        excluida = excluida,
        # La exclusión dejó la columna sin casos. Falso en una excluida con datos: la base trae otro valor (D3).
        exclusion_aplicada = excluida && e$N[[j]] == 0 && e$casos[[j]] == 0,
        motivo = motivo,
        celdas = lapply(seq_along(codes), function(i) {
          list(fila = codes[[i]], n = e$n[i, j], pct = e$pct[i, j],
               letras = if (is.null(letras)) NA_character_ else letras[[i]])
        })
      )
    })
    list(
      variable = s,
      etiqueta = as.character(e$s_lbl),
      columnas_por = e$clave,
      multiple = multiple,
      # Total menos la suma de las columnas: casos sin valor en la variable de cruce o con un valor que no es clave
      # de ninguna columna (`valores_no_reconocidos`). En una variable de cruce múltiple las columnas se solapan y
      # la resta no tiene sentido.
      sin_columna = list(
        base_n = if (multiple) NA_integer_ else base_total - as.integer(sum(e$casos)),
        n = if (multiple) NA_real_ else .cruces_preview_resta(as.numeric(tb$total$N), sum(e$N)),
        valores_no_reconocidos = as.integer(e$valores_sin_columna)
      ),
      significancia = if (is.null(bl)) NULL else if (por_rotulo) list(
        metodo = "descriptivo",
        motivo = "letras_por_rotulo_no_calculadas",
        modo = modo
      ) else list(
        metodo = as.character(bl$method),
        motivo = if (nzchar(bl$reason %||% "")) as.character(bl$reason) else NA_character_,
        modo = modo
      ),
      columnas = columnas
    )
  }))
  if (!is.null(tb$sig) && !is.null(tb$sig$nota)) out$significancia <- list(nota = as.character(tb$sig$nota))
  out
}

# Total menos la suma de las columnas, sin el residuo de coma flotante de las sumas de pesos (un -5e-12 no es
# un caso).
.cruces_preview_resta <- function(total, suma) {
  x <- total - suma
  if (abs(x) < 1e-9 * max(1, abs(total))) 0 else x
}

# Qué filas entran a la prueba de letras. Con la regla del estudio, las que elige `.sig_filas_a_probar()` con los
# mismos argumentos que `.cruces_comparar_con_regla()` (las no sustantivas quedan fuera salvo `incluir_ns`); con
# otra prueba, todas; si ningún bloque se probó (descriptivo), ninguna; sin letras, nulo. Una celda con letra vacía en una fila no probada no dice "sin diferencia".
.cruces_preview_filas_probadas <- function(tb) {
  n <- length(tb$codes_row)
  bloques <- (tb$sig %||% list())$bloques %||% list()
  if (!length(bloques)) return(rep(NA, n))
  regla <- .cruces_preview_regla_de_tabla(tb)
  if (is.null(regla)) {
    descriptivas <- all(vapply(bloques, function(bl) identical(as.character(bl$method), "descriptivo"), logical(1)))
    return(rep(!descriptivas, n))
  }
  opciones <- as.character(tb$opciones)
  codigos <- stats::setNames(as.list(as.character(tb$codes_row)), opciones)
  opciones %in% .sig_filas_a_probar(opciones, codigos, regla, solo_principal = FALSE)
}

# La regla que de verdad decidió las letras de una tabla: la del primer bloque cuyo método es `regla_*`. Un bloque
# `descriptivo` también trae la regla (no se pudo aplicar, por ejemplo por pocos conglomerados) y no cuenta.
.cruces_preview_regla_de_tabla <- function(tb) {
  bloques <- (tb$sig %||% list())$bloques %||% list()
  con_regla <- Filter(function(bl) is.list(bl$regla) && startsWith(as.character(bl$method %||% ""), "regla_"), bloques)
  if (length(con_regla)) con_regla[[1]]$regla else NULL
}

# Avisos que salen de las tablas devueltas: casos fuera de toda columna por un valor no reconocido, letras que no se
# pueden leer porque la columna se emparejó por rótulo y variables de cruce de selección múltiple.
.cruces_preview_avisos_tablas <- function(tablas) {
  avisos <- list()
  cruces <- unlist(lapply(tablas, function(t) lapply(t$cruces, function(c) c(list(tabla = t$variable), c))),
                   recursive = FALSE)
  nombres <- function(f) unique(vapply(Filter(f, cruces), function(c) c$variable, character(1)))
  ajenos <- nombres(function(c) isTRUE((c$sin_columna$valores_no_reconocidos %||% 0L) > 0L))
  if (length(ajenos)) {
    avisos[[length(avisos) + 1L]] <- .cruces_preview_aviso("casos_sin_columna", paste0(
      "Hay casos que no entran en ninguna columna porque la base trae en la variable de cruce valores que no son ",
      "categorías del instrumento (por ejemplo, códigos y rótulos mezclados): ", paste(ajenos, collapse = ", "),
      ". El Total sí los cuenta."))
  }
  rotulo <- nombres(function(c) identical((c$significancia %||% list())$motivo, "letras_por_rotulo_no_calculadas"))
  if (length(rotulo)) {
    avisos[[length(avisos) + 1L]] <- .cruces_preview_aviso("letras_por_rotulo_no_calculadas", paste0(
      "Sin letras de diferencias en ", paste(rotulo, collapse = ", "),
      ": la base guarda el rótulo de la categoría y no su código, y la prueba compara por código. ",
      "El archivo trae esas letras vacías o como base insuficiente."))
  }
  multiples <- nombres(function(c) isTRUE(c$multiple))
  if (length(multiples)) {
    avisos[[length(avisos) + 1L]] <- .cruces_preview_aviso("cruce_multiple", paste0(
      "Variables de cruce de selección múltiple: ", paste(multiples, collapse = ", "),
      ". Cada columna cuenta solo a quienes marcaron esa única opción; quien marcó varias no entra en ninguna."))
  }
  avisos
}

# Estado del proceso repuesto al salir, haya o no significancia: la vista previa corre en el proceso del servidor y
# la preparación de una base hija fija la regla de diferencias aunque no se pidan letras (`.cruces_grano_tabla`).
# Con significancia, la regla del estudio se fija como en el worker del archivo.
.cruces_preview_con_estado <- function(p, base, expr_fn) {
  previa <- options("prosecnur.sig_informe")
  tarjetas <- as.list(.tarjetas_estado, all.names = TRUE)
  on.exit({
    options(previa)
    rm(list = ls(.tarjetas_estado, all.names = TRUE), envir = .tarjetas_estado)
    list2env(tarjetas, envir = .tarjetas_estado)
  }, add = TRUE)
  if (isTRUE(p$show_sig)) {
    suppressMessages(.sig_informe_preparar(p$sig_estudio, p$data_sources, p$inst_sources, base))
  }
  expr_fn()
}

# Lo que la prueba de letras usó de verdad: la regla efectiva de la primera variable de cruce con letras (tras
# ajustarla a la base, `.sig_regla_de_datos`) y su origen. `n_prueba` dice con qué n se calcula el error estándar.
.cruces_preview_regla <- function(regla, origen) {
  if (!is.list(regla)) return(NULL)
  rao <- identical(regla$prueba, "rao_scott")
  txt <- function(x) if (is.null(x) || !length(x) || is.na(x[[1]])) NA_character_ else as.character(x[[1]])
  list(
    origen = txt(origen),
    prueba = txt(regla$prueba),
    correccion = txt(regla$correccion),
    alfa = as.numeric(regla$alfa %||% NA_real_),
    umbral_puntos = as.numeric(regla$umbral_puntos %||% NA_real_),
    base_minima = as.numeric(regla$base_minima %||% NA_real_),
    conglomerados_minimos = as.integer(regla$conglomerados_minimos %||% NA_integer_),
    conglomerado = txt(regla$conglomerado),
    max_letras = as.integer(regla$max_letras %||% 6L),
    # Si las filas de no sustantivas (98 No sabe, 99 No responde y afines) entran a la prueba.
    incluir_ns = isTRUE(regla$incluir_ns),
    n_prueba = if (rao) "linealizacion_con_pesos_y_conglomerado" else "pesos_llevados_a_media_1"
  )
}


# Tablas del archivo para la base `base` de la preparación `p`.
.cruces_preview_tablas <- function(p, base, variables = NULL, cruces = NULL,
                                   limite = .CRUCES_PREVIEW_LIMITE_DEFECTO) {
  data <- p$data_sources[[base]]
  ctx <- .cruces_contexto_instrumento(p$inst_sources[[base]])
  repeat_design <- p$repeat_design_by_base[[base]]
  notas <- p$notas
  fuente <- (notas %||% list())$fuente %||% "Pulso PUCP"
  notas <- .notas_pie_normalizar(notas, fuente_defecto = fuente)
  plan <- .cruces_plan_archivo(data, p$secs, p$cruces_val)
  cruzar <- if (is.null(cruces)) plan$CRUZAR_CON else plan$CRUZAR_CON[plan$CRUZAR_CON %in% cruces]
  numericas <- as.character(p$numericas_arg %||% character(0))
  col_sin_peso <- ".pulso_sin_peso"
  while (col_sin_peso %in% names(data)) col_sin_peso <- paste0(col_sin_peso, "_")

  entradas <- list()
  for (sec in names(plan$SECCIONES)) {
    for (v in plan$SECCIONES[[sec]]) entradas[[length(entradas) + 1L]] <- list(sec = sec, var = v)
  }
  nombres <- vapply(entradas, function(e) e$var, character(1))
  es_numerica <- nombres %in% numericas

  sin_tabla <- list()
  elegidas <- seq_along(entradas)
  if (!is.null(variables)) {
    en_base <- unique(c(names(data), as.character((p$inst_sources[[base]]$survey %||% list())$name)))
    elegidas <- integer(0)
    for (r in variables) {
      hit <- which(nombres == r)
      if (length(hit)) {
        elegidas <- c(elegidas, hit)
        next
      }
      motivo <- if (r %in% p$excluidas) "excluida" else if (r %in% en_base) "fuera_del_archivo" else "desconocida"
      sin_tabla[[length(sin_tabla) + 1L]] <- list(variable = r, motivo = motivo, seccion = NA_character_)
    }
    elegidas <- sort(unique(elegidas))
  }
  # Las numéricas: el archivo escribe su tabla de resúmenes y esta versión no la devuelve.
  for (i in elegidas[es_numerica[elegidas]]) {
    sin_tabla[[length(sin_tabla) + 1L]] <- list(variable = nombres[[i]], motivo = "numerica", seccion = entradas[[i]]$sec)
  }
  categoricas <- elegidas[!es_numerica[elegidas]]
  recortado <- length(categoricas) > limite
  if (recortado) categoricas <- categoricas[seq_len(limite)]

  regla_usada <- NULL
  origen_regla <- NULL
  calcular <- function() {
    origen_regla <<- (.sig_informe_vigente() %||% list())$origen
    # Mismo orden que el worker y que exportar_cruces_multi(): la regla vigente decide el método de las letras.
    sig_spec <- .cruces_significancia_normalizar(.sig_spec_vigente(
      .cruces_significancia_normalizar(.sig_spec_vigente(p$significancia))
    ))
    grano <- .cruces_grano_preparar(data, repeat_design, plan$CRUZAR_CON)
    lapply(entradas[categoricas], function(e) {
      g <- .cruces_grano_tabla(grano, e$var, data, repeat_design, notas)
      tb <- .cruces_tabla_archivo(
        data = g$data, var = e$var, CRUZAR_CON = cruzar, survey = ctx$survey,
        orders_list = ctx$orders_list, orden = p$orden_cruces,
        ordinal_lists = p$ordinal_lists_by_base[[base]] %||% character(0),
        dic_vars = ctx$dic_vars, notas = g$notas, col_sin_peso = col_sin_peso,
        show_sig = p$show_sig, sig_spec = sig_spec, alpha = p$alpha,
        repeat_design = g$repeat_design, casos_sin_ponderar = TRUE
      )
      if (is.null(regla_usada)) regla_usada <<- .cruces_preview_regla_de_tabla(tb)
      rotulo <- if (isTRUE(p$incluir_secciones)) toupper(.freq_clean_section_label_for_export(e$sec)) else NA_character_
      grano_tabla <- if (is.null(grano)) NA_character_ else if (is.null(g$repeat_design)) "encuestado" else "registro"
      .cruces_preview_tabla(tb, e$sec, rotulo, grano_tabla, excluidas = p$cruces_map,
                            unidad = if (is.na(grano_tabla)) "encuestado" else grano_tabla, survey = ctx$survey)
    })
  }
  tablas <- if (!length(categoricas)) list() else .cruces_preview_con_estado(p, base, calcular)
  list(
    total_variables = sum(!es_numerica[elegidas]),
    total_en_archivo = length(entradas),
    devueltas = length(tablas),
    recortado = recortado,
    cruzar = cruzar,
    tablas = tablas,
    sin_tabla = sin_tabla,
    regla = .cruces_preview_regla(regla_usada, origen_regla)
  )
}

# Variables de cruce configuradas o pedidas que no tienen columnas en las tablas, con su motivo.
.cruces_preview_cruces_sin_columnas <- function(p, base, pedidas) {
  configuradas <- names(.cruces_vars_parse(((p$cfg %||% list())$cruces %||% list())$cruces_vars))
  data <- if (!is.null(base)) p$data_sources[[base]] else NULL
  out <- list()
  agregar <- function(v, motivo) out[[length(out) + 1L]] <<- list(variable = v, motivo = motivo)
  for (v in configuradas) {
    if (!is.null(pedidas) && !v %in% pedidas) next
    if (v %in% (p$excluidas %||% character(0))) agregar(v, "excluida")
    else if (!v %in% p$cruces_val) agregar(v, "no_categorica")
    else if (is.data.frame(data) && !v %in% names(data)) agregar(v, "fuera_de_la_base")
  }
  for (v in setdiff(pedidas %||% character(0), configuradas)) agregar(v, "no_configurada")
  out
}

# Categorías de cruce excluidas en la base activa y cuántas filas quitó cada una.
.cruces_preview_exclusiones <- function(p, base) {
  ex <- (p$exclusion_por_base %||% list())[[base]]
  if (is.null(ex)) return(list())
  unidad <- if (is.list(p$repeat_design_by_base[[base]])) "registro" else "encuestado"
  unname(lapply(names(ex$por_cruce), function(v) list(variable = v, unidad = unidad, categorias = ex$por_cruce[[v]])))
}

# Aviso de que la exclusión de categorías de cruce es global: quita los casos de toda la base, así que el Total y
# las columnas de las demás variables de cruce tampoco los cuentan. Solo si quitó alguno.
.cruces_preview_exclusion_global <- function(p, base, exclusiones) {
  ex <- (p$exclusion_por_base %||% list())[[base]]
  data <- p$data_sources[[base]]
  quitados <- as.integer((ex$filas_antes %||% nrow(data)) - nrow(data))
  if (!length(exclusiones) || quitados <= 0L) return(NULL)
  ctx <- .cruces_contexto_instrumento(p$inst_sources[[base]])
  partes <- unlist(lapply(exclusiones, function(x) {
    usadas <- Filter(function(c) c$filas > 0L, x$categorias)
    if (!length(usadas)) return(character(0))
    cats <- get_categorias(x$variable, data, survey = ctx$survey, orders_list = ctx$orders_list)
    etiq <- vapply(usadas, function(c) {
      i <- match(c$codigo, cats$codes)
      if (is.na(i)) c$codigo else as.character(cats$labels[[i]])
    }, character(1))
    sprintf("\"%s\" en \"%s\"", etiq, label_variable(x$variable, ctx$dic_vars, NULL, data))
  }))
  unidad <- if (is.list(p$repeat_design_by_base[[base]])) c("registro", "registros") else c("caso", "casos")
  .cruces_preview_aviso("exclusion_global", sprintf(
    "Se %s %d %s de toda la base al excluir %s. El Total y las columnas de las demás variables de cruce tampoco los cuentan.",
    if (quitados == 1L) "quitó" else "quitaron", quitados, if (quitados == 1L) unidad[1] else unidad[2],
    paste(partes, collapse = ", ")))
}

.cruces_preview_aviso <- function(codigo, mensaje) list(codigo = codigo, mensaje = mensaje)

.cruces_preview_plural <- function(n, uno, varios) sprintf(if (n == 1L) uno else varios, n)

#' Vista previa de las tablas de Cruces de la base activa.
#'
#' @param sid Sesión.
#' @param variables Variables de fila a devolver; `NULL` son las primeras del archivo.
#' @param cruces Variables de cruce a devolver, subconjunto de las configuradas; `NULL` son todas.
#' @param limite Tope de tablas a devolver.
#' @return Lista serializable: ver la cabecera del archivo y `test-analitica-cruces-preview.R`.
#' @keywords internal
analitica_cruces_preview <- function(sid, variables = NULL, cruces = NULL,
                                     limite = .CRUCES_PREVIEW_LIMITE_DEFECTO) {
  avisos <- list()
  motor <- function(w) {
    avisos[[length(avisos) + 1L]] <<- .cruces_preview_aviso("motor", conditionMessage(w))
    invokeRestart("muffleWarning")
  }
  # Sin base analítica preparada: 409 E_NO_RP_DATA, como la vista previa de Frecuencias.
  bases <- names(withCallingHandlers(.load_rp_sources(sid), warning = motor)$data_sources)
  # La ruta del archivo recibe `modo = "estandar"` por defecto y la pantalla no lo envía: el archivo sale en modo
  # estándar aunque la configuración diga otra cosa. La vista previa reproduce eso y publica los dos valores.
  p <- withCallingHandlers(.analitica_cruces_preparar(sid, modo = "estandar"), warning = motor)
  cfg <- p$cfg
  modo_configurado <- as.character(((cfg$cruces %||% list())$modo %||% "estandar"))[1]

  base <- .analitica_active_source_name(sid, bases)
  con_tablas <- is.null(p$vacio) && base %in% names(p$data_sources)
  data <- if (con_tablas) p$data_sources[[base]] else NULL

  res <- list(total_variables = 0L, total_en_archivo = 0L, devueltas = 0L, recortado = FALSE,
              cruzar = character(0), tablas = list(), sin_tabla = list(), regla = NULL)
  if (identical(p$vacio, "sin_configurar")) {
    avisos[[length(avisos) + 1L]] <- .cruces_preview_aviso("sin_variables_de_cruce",
      "No hay tablas porque no hay variables de cruce configuradas.")
  } else if (identical(p$vacio, "sin_categoricas")) {
    avisos[[length(avisos) + 1L]] <- .cruces_preview_aviso("sin_variables_de_cruce",
      "No hay tablas porque ninguna variable de cruce configurada es de selección única o múltiple.")
  } else if (!con_tablas) {
    avisos[[length(avisos) + 1L]] <- .cruces_preview_aviso("base_sin_variables_de_cruce",
      sprintf("El archivo no trae tablas de la base \"%s\" porque no tiene ninguna de las variables de cruce.", base))
  } else if (identical(p$modo, "dimensiones")) {
    avisos[[length(avisos) + 1L]] <- .cruces_preview_aviso("modo_dimensiones",
      "El archivo se genera en modo dimensiones, que todavía no tiene vista previa.")
  } else {
    res <- withCallingHandlers(
      .cruces_preview_tablas(p, base, variables = variables, cruces = cruces, limite = limite),
      warning = motor
    )
    if (!is.null(cruces) && !length(res$cruzar)) {
      avisos[[length(avisos) + 1L]] <- .cruces_preview_aviso("sin_variables_de_cruce",
        "Ninguna de las variables de cruce pedidas está entre las del archivo.")
    }
    avisos <- c(avisos, .cruces_preview_avisos_tablas(res$tablas))
  }
  if (is.null(p$vacio) && !identical(modo_configurado, p$modo)) {
    avisos[[length(avisos) + 1L]] <- .cruces_preview_aviso("modo_configurado_no_aplicado", sprintf(
      "La configuración pide el modo \"%s\", pero el archivo se genera en modo \"%s\": la generación no recibe el modo guardado.",
      modo_configurado, p$modo))
  }

  sin_columnas <- if (is.null(p$vacio)) .cruces_preview_cruces_sin_columnas(p, if (con_tablas) base else NULL, cruces) else list()
  if (length(sin_columnas)) {
    faltan <- vapply(sin_columnas, function(x) x$variable, character(1))
    avisos[[length(avisos) + 1L]] <- .cruces_preview_aviso("cruces_sin_columnas", paste0(
      .cruces_preview_plural(length(faltan), "%d variable de cruce no tiene columnas en las tablas: ",
                             "%d variables de cruce no tienen columnas en las tablas: "),
      paste(faltan, collapse = ", "), "."))
  }
  numericas <- Filter(function(x) identical(x$motivo, "numerica"), res$sin_tabla)
  if (length(numericas)) {
    avisos[[length(avisos) + 1L]] <- .cruces_preview_aviso("numericas_sin_vista_previa",
      .cruces_preview_plural(length(numericas),
        "El archivo trae %d tabla de una variable numérica que la vista previa todavía no muestra.",
        "El archivo trae %d tablas de variables numéricas que la vista previa todavía no muestra."))
  }
  otras <- Filter(function(x) !identical(x$motivo, "numerica"), res$sin_tabla)
  if (length(otras)) {
    faltan <- vapply(otras, function(x) x$variable, character(1))
    avisos[[length(avisos) + 1L]] <- .cruces_preview_aviso("variables_sin_tabla", paste0(
      .cruces_preview_plural(length(faltan), "%d variable pedida no tiene tabla en el archivo: ",
                             "%d variables pedidas no tienen tabla en el archivo: "),
      paste(faltan, collapse = ", "), "."))
  }
  exclusiones <- if (con_tablas) .cruces_preview_exclusiones(p, base) else list()
  vacias <- unlist(lapply(exclusiones, function(x) {
    vapply(Filter(function(c) c$filas == 0L, x$categorias), function(c) paste0(x$variable, " = ", c$codigo), character(1))
  }))
  if (length(vacias)) {
    avisos[[length(avisos) + 1L]] <- .cruces_preview_aviso("exclusion_sin_casos", paste0(
      "La exclusión no quitó ninguna fila porque la base no tiene esas categorías: ", paste(vacias, collapse = ", "), "."))
  }

  global <- if (con_tablas) .cruces_preview_exclusion_global(p, base, exclusiones) else NULL
  if (!is.null(global)) avisos[[length(avisos) + 1L]] <- global
  list(
    ok = TRUE,
    base = list(
      nombre = base,
      bases_del_archivo = as.list(names(p$data_sources %||% list())),
      bases_sin_cruces = as.list(setdiff(bases, names(p$data_sources %||% list()))),
      n_bases = length(bases),
      independientes = isTRUE(estudio_is_independent_siblings(sid))
    ),
    fuente = as.character(cfg$fuente_preferida %||% NA_character_)[1],
    modo = p$modo %||% NA_character_,
    modo_configurado = modo_configurado,
    ponderado = is.data.frame(data) && "peso" %in% names(data),
    ponderacion = if (is.data.frame(data)) {
      .frecuencias_preview_ponderacion(data, .analitica_ponderacion_cfg_base(sid, base, cfg))
    } else NULL,
    casos = if (is.data.frame(data)) list(
      cuentan = nrow(data),
      antes_de_excluir = as.integer(((p$exclusion_por_base %||% list())[[base]] %||% list())$filas_antes %||% nrow(data)),
      suma_pesos = sum(.peso_vec(data)),
      con_peso = .frecuencias_base_con_peso(data),
      # En una base hija repeat cada fila es un registro del grupo repetido; las tablas con grano "encuestado"
      # cuentan en la madre y declaran su propia base (`tablas[].base`).
      unidad = if (is.list(p$repeat_design_by_base[[base]])) "registro" else "encuestado"
    ) else NULL,
    escala_pct = "proporcion",
    opciones = list(
      orden = p$orden_cruces %||% NA_character_,
      incluir_secciones = isTRUE(p$incluir_secciones),
      significancia = isTRUE(p$show_sig),
      # El alfa guardado en Cruces. Con la regla del estudio la prueba usa el de la regla (`significancia_regla$alfa`).
      alfa_configurado = p$alpha %||% NA_real_
    ),
    significancia_regla = res$regla,
    cruces = lapply(res$cruzar, function(v) list(
      variable = v,
      excluidas = as.list(as.character((p$cruces_map %||% list())[[v]] %||% character(0)))
    )),
    cruces_sin_columnas = sin_columnas,
    exclusiones = exclusiones,
    limite = as.integer(limite),
    total_variables = as.integer(res$total_variables),
    total_en_archivo = as.integer(res$total_en_archivo),
    devueltas = as.integer(res$devueltas),
    recortado = isTRUE(res$recortado),
    tablas = res$tablas,
    sin_tabla = res$sin_tabla,
    avisos = avisos
  )
}

# POST /api/analitica/cruces/preview  {variables?, cruces?, limite?}
# Solo lectura: no marca el proyecto ni el estado de la etapa. Las cifras viajan sin redondear.
mount_analitica_cruces_preview <- function(pr) {
  pr |>
    plumber::pr_post("/api/analitica/cruces/preview",
                     serializer = .cm_serializer_sin_redondeo(),
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      entrada <- .cruces_preview_entrada(.analitica_json_body(req))
      analitica_cruces_preview(sid, variables = entrada$variables, cruces = entrada$cruces, limite = entrada$limite)
    }))
}
