# Armonización de mediciones en la fila de la matriz (contrato E4-E7, R3)
# ======================================================================
#
# PROBLEMA. Una serie de mediciones (HSyVbG 2024, 2025, 2026) pregunta lo mismo
# con otra lista: en 2022 «Hombre homosexual [1]» y «Mujer lesbiana [2]» son dos
# opciones; desde 2024 son una sola, «Homosexual (gay/lesbiana) [2]». Comparar
# por código o por posición mezcla categorías distintas; la regla de la guía de
# la matriz del proyecto es recodificar POR ETIQUETA hacia una escala común.
#
# DISEÑO. La armonización vive en la fila de la matriz de equivalencias (ADR
# 0062), no en un script aparte:
#
#   armonizacion = {
#     escala:   [{codigo, etiqueta}],                 # la escala común
#     por_base: {<base>: {comparable, nota?, mapa: {<cód base>: <cód escala>}}}
#   }
#
# y en la raíz de la declaración `armonizacion_periodos`: el orden de las BASES
# en la serie (nombres de base del estudio, no rótulos de año).
#
# Reglas:
#   - Mapa vacío es identidad: el código de la base ES el código de la escala.
#   - Un código sin mapear queda NA; los especiales 80-99 nunca caen en «resto»
#     (lo garantiza `codif_agrupar_df`, que es quien aplica el mapa).
#   - Una base sin entrada en `por_base`, o con `comparable = false`, no se
#     armoniza: no hay spec. Declarar es obligatorio; no se presume comparable.
#
# Este archivo es motor: normaliza, valida, construye la spec y la aplica. El
# router sólo lo llama.

.EQUIV_ARMON_CODIGO_RE <- "^[A-Za-z0-9_.-]+$"

.equiv_armon_chr <- function(x, default = "") {
  if (is.null(x) || !length(x)) return(default)
  v <- as.character(unlist(x, use.names = FALSE))[1]
  if (is.na(v)) return(default)
  v <- trimws(v)
  if (nzchar(v)) v else default
}

# Lista con nombres vacía: jsonlite la serializa como `{}` y no como `[]`, que
# es lo que el cliente espera para un mapa.
.equiv_armon_mapa_vacio <- function() stats::setNames(list(), character(0))

.equiv_armon_invalida <- function(etiqueta, motivo) {
  stop_api(400, "E_EQUIV_ARMONIZACION_INVALIDA",
           sprintf("La armonización de «%s» no es válida: %s", etiqueta, motivo),
           list(fila = etiqueta, motivo = motivo))
}

# Normaliza y valida el campo `armonizacion` de una fila. Devuelve NULL si la
# fila no armoniza nada (campo ausente, nulo o vacío).
#
# `bases` son las bases del estudio: una entrada de `por_base` que no nombra
# una base existente no significa nada y se rechaza en vez de guardarse muda.
.equiv_armon_normalizar <- function(arm, bases, etiqueta = "") {
  if (is.null(arm) || !length(arm)) return(NULL)
  if (!is.list(arm)) .equiv_armon_invalida(etiqueta, "debe ser un objeto {escala, por_base}.")

  escala_in <- arm$escala %||% list()
  if (!is.list(escala_in)) .equiv_armon_invalida(etiqueta, "'escala' debe ser una lista.")
  escala <- lapply(escala_in, function(e) {
    if (!is.list(e)) .equiv_armon_invalida(etiqueta, "cada categoría de la escala es {codigo, etiqueta}.")
    codigo <- .codif_agrupar_codigo_chr(.equiv_armon_chr(e$codigo, ""))
    if (is.na(codigo) || !nzchar(codigo)) {
      .equiv_armon_invalida(etiqueta, "cada categoría de la escala necesita un código.")
    }
    if (!grepl(.EQUIV_ARMON_CODIGO_RE, codigo)) {
      .equiv_armon_invalida(etiqueta, sprintf("el código «%s» lleva espacios o símbolos.", codigo))
    }
    list(codigo = codigo, etiqueta = .equiv_armon_chr(e$etiqueta, codigo))
  })
  codigos <- vapply(escala, function(e) e$codigo, character(1))
  dup <- unique(codigos[duplicated(codigos)])
  if (length(dup)) {
    .equiv_armon_invalida(etiqueta, sprintf("el código «%s» se repite en la escala.", dup[[1]]))
  }

  pb_in <- arm$por_base %||% list()
  if (length(pb_in) && (!is.list(pb_in) || is.null(names(pb_in)) || any(!nzchar(names(pb_in))))) {
    .equiv_armon_invalida(etiqueta, "'por_base' debe ser un objeto con el nombre de cada base.")
  }
  por_base <- list()
  for (b in names(pb_in)) {
    if (!b %in% bases) {
      .equiv_armon_invalida(etiqueta, sprintf("la base «%s» no existe en el estudio.", b))
    }
    e <- pb_in[[b]] %||% list()
    if (!is.list(e)) .equiv_armon_invalida(etiqueta, sprintf("la entrada de «%s» debe ser un objeto.", b))

    comparable <- e$comparable %||% TRUE
    if (!is.logical(comparable) || length(comparable) != 1L || is.na(comparable)) {
      .equiv_armon_invalida(etiqueta, sprintf("'comparable' de «%s» debe ser verdadero o falso.", b))
    }
    nota <- e$nota
    if (!is.null(nota) && !(is.character(nota) && length(nota) == 1L)) {
      .equiv_armon_invalida(etiqueta, sprintf("'nota' de «%s» debe ser texto.", b))
    }

    mapa_in <- e$mapa %||% list()
    if (length(mapa_in) && (!is.list(mapa_in) || is.null(names(mapa_in)))) {
      .equiv_armon_invalida(etiqueta, sprintf("el mapa de «%s» debe ser {código base: código escala}.", b))
    }
    mapa <- .equiv_armon_mapa_vacio()
    for (k in names(mapa_in)) {
      origen <- .codif_agrupar_codigo_chr(trimws(k))
      if (is.na(origen) || !nzchar(origen)) {
        .equiv_armon_invalida(etiqueta, sprintf("el mapa de «%s» trae un código de origen vacío.", b))
      }
      destino <- .equiv_armon_chr(mapa_in[[k]], "")
      # Un destino vacío es «sin mapear»: se omite, que es lo mismo que NA.
      if (!nzchar(destino)) next
      destino <- .codif_agrupar_codigo_chr(destino)
      if (!destino %in% codigos) {
        .equiv_armon_invalida(etiqueta, sprintf(
          "el mapa de «%s» lleva el código %s hacia «%s», que no está en la escala.", b, origen, destino))
      }
      if (!is.null(mapa[[origen]]) && !identical(mapa[[origen]], destino)) {
        .equiv_armon_invalida(etiqueta, sprintf(
          "el mapa de «%s» lleva el código %s a dos categorías.", b, origen))
      }
      mapa[[origen]] <- destino
    }

    entrada <- list(comparable = isTRUE(comparable), mapa = mapa)
    if (!is.null(nota) && nzchar(trimws(nota))) entrada$nota <- trimws(nota)
    por_base[[b]] <- entrada
  }

  if (!length(escala) && !length(por_base)) return(NULL)
  list(escala = escala, por_base = if (length(por_base)) por_base else .equiv_armon_mapa_vacio())
}

# Orden de la serie a nivel de estudio. Son NOMBRES DE BASE: es la única clave
# estable entre la matriz, Analítica y los entregables.
.equiv_armon_periodos_normalizar <- function(periodos, bases) {
  if (is.null(periodos) || !length(periodos)) return(NULL)
  p <- trimws(as.character(unlist(periodos, use.names = FALSE)))
  p <- p[!is.na(p) & nzchar(p)]
  if (!length(p)) return(NULL)
  if (any(duplicated(p))) {
    stop_api(400, "E_EQUIV_ARMONIZACION_INVALIDA",
             sprintf("'armonizacion_periodos' repite «%s».", p[duplicated(p)][1]),
             list(campo = "armonizacion_periodos"))
  }
  fuera <- setdiff(p, bases)
  if (length(fuera)) {
    stop_api(400, "E_EQUIV_ARMONIZACION_INVALIDA",
             sprintf("'armonizacion_periodos' nombra bases que no existen en el estudio: %s.",
                     paste(fuera, collapse = ", ")),
             list(campo = "armonizacion_periodos", desconocidas = fuera))
  }
  p
}

# Forma canónica para la huella de la declaración. Sólo se llama cuando la fila
# armoniza: una fila sin armonización conserva su huella anterior.
.equiv_armon_canonico <- function(arm) {
  if (is.null(arm)) return("")
  esc <- vapply(arm$escala %||% list(), function(e) {
    paste(e$codigo, e$etiqueta, sep = "=")
  }, character(1))
  pb <- arm$por_base %||% list()
  bases <- sort(names(pb))
  partes_pb <- vapply(bases, function(b) {
    e <- pb[[b]]
    m <- e$mapa %||% list()
    k <- sort(names(m))
    paste0(b, ":", if (isTRUE(e$comparable)) "1" else "0", ":",
           as.character(e$nota %||% ""), ":",
           paste(k, unlist(m[k]), sep = ">", collapse = ","))
  }, character(1))
  paste0("armon{", paste(esc, collapse = "|"), "}{", paste(partes_pb, collapse = ";"), "}")
}

# Clave de una fila por su juego de variables: es como se reconoce «la misma
# fila» al reimportar la plantilla, que no lleva la armonización.
.equiv_armon_clave_variables <- function(fila) {
  vars <- fila$variables %||% list()
  if (!length(vars)) return("")
  k <- sort(names(vars))
  paste(k, unlist(vars[k]), sep = "=", collapse = ",")
}

# Pasa la armonización (y el `id`) de la declaración previa a las filas nuevas
# que casan por variables y no traen la suya. `solo_ausentes` marca las filas
# que NO declararon el campo: una fila que lo manda en null lo está borrando.
.equiv_armon_conservar <- function(filas, previo, solo_ausentes = NULL) {
  prev_filas <- (previo %||% list())$filas %||% list()
  if (!length(prev_filas) || !length(filas)) return(filas)
  claves_prev <- vapply(prev_filas, .equiv_armon_clave_variables, character(1))
  for (i in seq_along(filas)) {
    if (!is.null(solo_ausentes) && !isTRUE(solo_ausentes[i])) next
    if (!is.null(filas[[i]]$armonizacion)) next
    clave <- .equiv_armon_clave_variables(filas[[i]])
    if (!nzchar(clave)) next
    j <- match(clave, claves_prev)
    if (is.na(j)) next
    arm <- prev_filas[[j]]$armonizacion
    if (!is.null(arm)) filas[[i]]$armonizacion <- arm
    if (is.null(filas[[i]]$id) && !is.null(prev_filas[[j]]$id)) filas[[i]]$id <- prev_filas[[j]]$id
  }
  filas
}

#' Spec de `codif_agrupar_df` para armonizar la variable de una base.
#'
#' @param fila Fila de la matriz de equivalencias.
#' @param base Nombre de la base.
#' @return Spec de agrupación, o NULL si la fila no armoniza esa base (sin
#'   `armonizacion`, sin entrada para la base, no comparable o sin variable).
#' @keywords internal
.equiv_armon_spec <- function(fila, base) {
  arm <- fila$armonizacion
  if (is.null(arm)) return(NULL)
  entrada <- (arm$por_base %||% list())[[base]]
  if (is.null(entrada) || !isTRUE(entrada$comparable)) return(NULL)
  var <- .equiv_armon_chr((fila$variables %||% list())[[base]], "")
  if (!nzchar(var)) return(NULL)
  escala <- arm$escala %||% list()
  if (!length(escala)) return(NULL)

  mapa <- entrada$mapa %||% list()
  destinos <- as.character(unlist(mapa, use.names = FALSE))
  origenes <- names(mapa) %||% character(0)
  categorias <- lapply(escala, function(e) {
    codigos <- if (length(mapa)) origenes[destinos == e$codigo] else e$codigo
    list(codigo = e$codigo, etiqueta = e$etiqueta, codigos = as.list(codigos))
  })
  list(parent = var, target = paste0(var, "_armon"), text_col = NULL,
       codigo_otro = NULL, categorias = categorias)
}

#' Armoniza la variable de una base.
#'
#' @return Vector character con el código de la escala por fila (NA si no
#'   mapea), o NULL si la base no es comparable / no declarada para esa fila.
#' @keywords internal
equiv_armonizar_base <- function(df, fila, base) {
  spec <- .equiv_armon_spec(fila, base)
  if (is.null(spec)) return(NULL)
  if (!spec$parent %in% names(df)) {
    stop_api(409, "E_EQUIV_ARMONIZACION_VARIABLE_AUSENTE",
             sprintf("La variable «%s» no está en los datos de la base «%s».", spec$parent, base),
             list(base = base, variable = spec$parent))
  }
  codif_agrupar_df(df, spec)
}

# ---- Preview ------------------------------------------------------------------

# Resuelve la fila pedida: índice 0-based sobre `filas` (el arreglo que el
# cliente ya tiene), o `id` del bloque, o `etiqueta_estandar` exacta.
.equiv_armon_resolver_fila <- function(equiv, ref) {
  filas <- (equiv %||% list())$filas %||% list()
  ref <- .equiv_armon_chr(ref, "")
  if (!nzchar(ref)) {
    stop_api(400, "E_EQUIV_FILA_NO_ENCONTRADA", "Falta el parámetro 'fila'.")
  }
  if (grepl("^[0-9]+$", ref)) {
    i <- as.integer(ref) + 1L
    if (i >= 1L && i <= length(filas)) return(filas[[i]])
  }
  ids <- vapply(filas, function(f) .equiv_armon_chr(f$id, ""), character(1))
  hit <- which(nzchar(ids) & ids == ref)
  if (!length(hit)) {
    etq <- vapply(filas, function(f) .equiv_armon_chr(f$etiqueta_estandar, ""), character(1))
    hit <- which(etq == ref)
  }
  if (!length(hit)) {
    stop_api(404, "E_EQUIV_FILA_NO_ENCONTRADA",
             sprintf("No hay una fila «%s» en la matriz de equivalencias.", ref), list(fila = ref))
  }
  filas[[hit[1]]]
}

# Datos de una base para el preview: la tabla cargada en la sesión y, si no
# está en memoria, la de Codificación (que la lee del par de archivos).
.equiv_armon_datos_base <- function(sid, base) {
  ds <- estudio_data_sources(sid)
  df <- ds[[base]]
  if (is.data.frame(df)) return(df)
  codif_data_cached(sid, base)
}

.equiv_armon_orden_codigos <- function(x) {
  n <- suppressWarnings(as.numeric(x))
  x[order(is.na(n), n, x)]
}

# Preview del mapa sobre los datos reales de una base: qué código cae en qué
# categoría y cuántos quedan sin mapa. Conteos SIN ponderar.
.equiv_armon_preview <- function(sid, fila_ref, base) {
  equiv <- (session_get(sid, required = FALSE) %||% list())$equivalencias_publicos
  if (is.null(equiv) || !length(equiv$filas %||% list())) {
    stop_api(404, "E_EQUIV_NO_DECLARADA", "El estudio todavía no tiene matriz de equivalencias.")
  }
  base <- .equiv_armon_chr(base, "")
  bases <- names(.equiv_inst_por_base(sid))
  if (!nzchar(base) || !base %in% bases) {
    stop_api(400, "E_EQUIV_BASE_DESCONOCIDA",
             sprintf("La base «%s» no existe en el estudio.", base), list(base = base, bases = bases))
  }
  fila <- .equiv_armon_resolver_fila(equiv, fila_ref)
  arm <- fila$armonizacion
  if (is.null(arm)) {
    stop_api(409, "E_EQUIV_SIN_ARMONIZACION",
             sprintf("La fila «%s» no declara armonización.", fila$etiqueta_estandar %||% ""))
  }
  var <- .equiv_armon_chr((fila$variables %||% list())[[base]], "")
  if (!nzchar(var)) {
    stop_api(409, "E_EQUIV_ARMONIZACION_SIN_VARIABLE",
             sprintf("La fila «%s» no tiene variable en la base «%s».", fila$etiqueta_estandar %||% "", base),
             list(base = base))
  }
  # ADR 0105: una fila compuesta se mira sobre su indicador materializado.
  df <- .equiv_deriv_preview_df(.equiv_armon_datos_base(sid, base), fila, base)
  if (!var %in% names(df)) {
    stop_api(409, "E_EQUIV_ARMONIZACION_VARIABLE_AUSENTE",
             sprintf("La variable «%s» no está en los datos de la base «%s».", var, base),
             list(base = base, variable = var))
  }

  entrada <- (arm$por_base %||% list())[[base]]
  comparable <- !is.null(entrada) && isTRUE(entrada$comparable)
  orig <- .codif_agrupar_codigo_chr(df[[var]])
  armon <- if (comparable) equiv_armonizar_base(df, fila, base) else rep(NA_character_, length(orig))

  inst <- .equiv_inst_por_base(sid)[[base]]
  compuesta <- !is.null(.equiv_deriv_entrada(fila, base))
  opciones <- if (compuesta) .equiv_deriv_opciones() else .equiv_escala_opciones(inst, var)
  etq_inst <- stats::setNames(
    vapply(opciones, function(o) o$etiqueta, character(1)),
    vapply(opciones, function(o) o$codigo, character(1))
  )
  observados <- unique(orig[!is.na(orig)])
  todos <- .equiv_armon_orden_codigos(unique(c(names(etq_inst), observados)))
  codigos <- lapply(todos, function(cd) {
    sel <- !is.na(orig) & orig == cd
    a <- unique(armon[sel & !is.na(armon)])
    if (!length(a) && comparable && !any(sel)) {
      # Código del instrumento sin casos: se resuelve igual, para que el editor
      # vea a dónde iría.
      a <- codif_agrupar_df(stats::setNames(data.frame(cd, stringsAsFactors = FALSE), var),
                            .equiv_armon_spec(fila, base))
      a <- a[!is.na(a)]
    }
    list(codigo = cd,
         etiqueta = if (cd %in% names(etq_inst)) unname(etq_inst[[cd]]) else NA_character_,
         n = as.integer(sum(sel)),
         armonizado = if (length(a)) a[[1]] else NA_character_)
  })
  escala <- lapply(arm$escala %||% list(), function(e) {
    list(codigo = e$codigo, etiqueta = e$etiqueta,
         n = as.integer(sum(!is.na(armon) & armon == e$codigo)))
  })
  out <- list(
    ok = TRUE,
    fila = fila$etiqueta_estandar %||% "",
    id = fila$id %||% NA_character_,
    base = base,
    variable = var,
    comparable = comparable,
    nota = (entrada %||% list())$nota %||% NA_character_,
    n_total = as.integer(sum(!is.na(orig))),
    n_sin_mapa = as.integer(sum(!is.na(orig) & is.na(armon))),
    codigos = codigos,
    escala = escala
  )
  if (compuesta) out$derivada <- .equiv_deriv_preview_resumen(fila, base, orig)
  out
}
