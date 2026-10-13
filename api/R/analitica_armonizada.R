# Analítica armonizada: series de mediciones comparables (contrato E4-E7, R4)
# =========================================================================
#
# PROBLEMA. HSyVbG 2024, 2025 y 2026 preguntan lo mismo con listas distintas.
# La armonización de cada pregunta vive en su fila de la matriz de
# equivalencias (R3, `equivalencias_armonizacion.R`): una escala común y, por
# base, un mapa de códigos o la marca «no comparable». Este archivo apila las
# bases de la serie con esa escala y calcula lo que los comparativos imprimen.
#
# GRANO Y DENOMINADOR. Cada período es una base completa con su propio peso
# (`.analitica_ponderacion_cfg_base`: columna, calibración o ninguno). El peso
# que se usa es el de la columna `peso` tras aplicar esa config, igual que en
# frecuencias y cruces (`get_pesos`); sin columna, 1. El denominador de un
# período es la suma de pesos de los casos con código armonizado (un código
# sin mapa queda NA y sale del denominador, igual que en el preview de R3).
# Nunca se suma un total entre períodos.
#
# MARCAS.
#   «n.c.» la fila no es comparable en ese período (sin entrada en `por_base`
#          o `comparable = false`). Vale para la pregunta y para cada cruce.
#   «n.a.» una categoría de cruce sin casos en ese período (N == 0).
#
# Este archivo es motor puro salvo `.armz_preparar()`, que lee la sesión. Los
# writers viven en `reporte_comparativo.R` y el router en `router_armonizada.R`.

.armz_txt <- function(x) .notas_pie_texto(x)

# ---- Períodos y rótulos -------------------------------------------------------

#' Rótulo de cada período: el parámetro manda, si no el año del nombre de base.
#' @noRd
.armz_rotulos <- function(periodos, rotulos = NULL) {
  periodos <- as.character(periodos)
  out <- stats::setNames(periodos, periodos)
  anio <- regmatches(periodos, regexpr("(19|20)[0-9]{2}", periodos))
  con_anio <- grepl("(19|20)[0-9]{2}", periodos)
  out[con_anio] <- anio
  if (is.null(rotulos) || !length(rotulos)) return(out)
  nms <- names(rotulos)
  vals <- vapply(seq_along(rotulos), function(i) .armz_txt(rotulos[i]), character(1))
  if (!is.null(nms) && any(nzchar(nms))) {
    for (i in seq_along(vals)) {
      if (nzchar(nms[i]) && nms[i] %in% periodos && nzchar(vals[i])) out[[nms[i]]] <- vals[i]
    }
  } else {
    k <- min(length(vals), length(periodos))
    for (i in seq_len(k)) if (nzchar(vals[i])) out[[periodos[i]]] <- vals[i]
  }
  out
}

# ---- Apilado ---------------------------------------------------------------

.armz_escala <- function(fila) {
  esc <- (fila$armonizacion %||% list())$escala %||% list()
  list(
    codigos = vapply(esc, function(e) as.character(e$codigo), character(1)),
    etiquetas = vapply(esc, function(e) .armz_txt(e$etiqueta %||% e$codigo), character(1))
  )
}

.armz_titulo_fila <- function(fila) {
  enun <- .armz_txt(fila$enunciado)
  if (nzchar(enun)) return(enun)
  .armz_txt(fila$etiqueta_estandar)
}

.armz_nota_base <- function(fila, base) {
  .armz_txt((((fila$armonizacion %||% list())$por_base %||% list())[[base]] %||% list())$nota)
}

#' Apila las bases de la serie con la escala armonizada.
#'
#' @param datos Lista nombrada base -> data.frame, ya con la ponderación de
#'   su base aplicada (columna `peso` si pondera).
#' @param filas Filas de la matriz (preguntas) con `armonizacion`.
#' @param cruces Filas de la matriz que hacen de variables de cruce.
#' @param periodos Nombres de base en el orden de la serie.
#' @return list(periodos, data, preguntas, cruces). `data` lleva `periodo`,
#'   `peso` y una columna por pregunta (`q1`…) y por cruce (`x1`…) con el
#'   código de la escala o NA. Una base no comparable deja la columna en NA y
#'   la marca en `comparable`.
#' @keywords internal
armonizada_apilar <- function(datos, filas, cruces = list(), periodos = names(datos)) {
  periodos <- as.character(periodos)
  faltan <- setdiff(periodos, names(datos))
  if (length(faltan)) {
    stop_api(409, "E_NO_DATA",
             sprintf("La base «%s» no tiene data cargada.", faltan[[1]]), list(base = faltan[[1]]))
  }
  describir <- function(lista, prefijo) {
    lapply(seq_along(lista), function(i) {
      f <- lista[[i]]
      comp <- vapply(periodos, function(b) !is.null(.equiv_armon_spec(f, b)), logical(1))
      notas <- vapply(periodos, function(b) .armz_nota_base(f, b), character(1))
      claves <- unique(c(.armz_txt(f$id), .armz_txt(f$etiqueta_estandar),
                         as.character(unlist(f$variables %||% list(), use.names = FALSE))))
      list(key = paste0(prefijo, i), fila = f, titulo = .armz_titulo_fila(f),
           claves = claves[nzchar(claves)],
           etiqueta = .armz_txt(f$etiqueta_estandar) %||% "",
           seccion = .armz_txt(f$seccion), escala = .armz_escala(f),
           comparable = stats::setNames(comp, periodos),
           notas = stats::setNames(notas, periodos))
    })
  }
  preguntas <- describir(filas, "q")
  xs <- describir(cruces, "x")

  partes <- lapply(periodos, function(b) {
    df <- datos[[b]]
    n <- nrow(df)
    out <- data.frame(periodo = rep(b, n), peso = get_pesos(df, "peso"),
                      stringsAsFactors = FALSE)
    for (d in c(preguntas, xs)) {
      v <- equiv_armonizar_base(df, d$fila, b)
      out[[d$key]] <- if (is.null(v)) rep(NA_character_, n) else as.character(v)
    }
    out
  })
  data <- do.call(rbind, partes)
  if (is.null(data)) data <- data.frame(periodo = character(0), peso = numeric(0))
  list(periodos = periodos, data = data, preguntas = preguntas, cruces = xs)
}

# ---- Cálculo ----------------------------------------------------------------

.armz_conteo <- function(codigos_escala, x, w) {
  ok <- !is.na(x)
  n <- vapply(codigos_escala, function(cd) sum(w[ok & x == cd]), numeric(1))
  list(n = stats::setNames(n, codigos_escala), N = sum(n),
       N_sin_peso = sum(ok & x %in% codigos_escala))
}

#' Modelo del comparativo simple: por pregunta y período, N y % ponderados.
#' @return list(periodos, preguntas).
#' @keywords internal
armonizada_modelo_frecuencias <- function(ap) {
  d <- ap$data
  preguntas <- lapply(ap$preguntas, function(q) {
    por_periodo <- lapply(ap$periodos, function(b) {
      if (!isTRUE(q$comparable[[b]])) return(list(estado = "n.c."))
      sel <- d$periodo == b
      ct <- .armz_conteo(q$escala$codigos, d[[q$key]][sel], d$peso[sel])
      pct <- if (ct$N > 0) ct$n / ct$N else rep(NA_real_, length(ct$n))
      list(estado = if (ct$N > 0) "ok" else "n.a.", n = ct$n, N = ct$N,
           pct = stats::setNames(pct, names(ct$n)), N_sin_peso = ct$N_sin_peso)
    })
    names(por_periodo) <- ap$periodos
    q$fila <- NULL
    c(q, list(periodos = por_periodo))
  })
  list(periodos = ap$periodos, preguntas = preguntas)
}

# Letras de una variable de cruce dentro de UN período. Usa la prueba de
# siempre (`comparar_columnas_sig`) sobre conteos ponderados, igual que
# `nN_para_sig_simple` en cruces. La matriz incluye las columnas sin casos para
# que las letras conserven su posición (A, B, C) en el encabezado; esas
# columnas se marcan «n.a.» y no participan (la prueba ya las bloquea).
.armz_letras <- function(n_mat, N_vec, alpha) {
  cmp <- comparar_columnas_sig(n_mat, N_vec, alpha = alpha)
  let <- trimws(cmp$letras)
  let[, N_vec <= 0] <- "n.a."
  let
}

#' Modelo del comparativo de cruces: por pregunta, período y variable de
#' cruce, n/N ponderados, N sin ponderar por columna y letras.
#' @return list(periodos, cruces, preguntas).
#' @keywords internal
armonizada_modelo_cruces <- function(ap, alpha = 0.05) {
  d <- ap$data
  cruces_meta <- lapply(ap$cruces, function(x) {
    list(key = x$key, etiqueta = x$etiqueta, escala = x$escala, claves = x$claves,
         comparable = x$comparable, notas = x$notas)
  })
  preguntas <- lapply(ap$preguntas, function(q) {
    por_periodo <- lapply(ap$periodos, function(b) {
      if (!isTRUE(q$comparable[[b]])) return(list(estado = "n.c."))
      sel <- d$periodo == b
      xq <- d[[q$key]][sel]
      w <- d$peso[sel]
      total <- .armz_conteo(q$escala$codigos, xq, w)
      por_cruce <- lapply(cruces_meta, function(x) {
        if (!isTRUE(x$comparable[[b]])) return(list(estado = "n.c."))
        xc <- d[[x$key]][sel]
        cats <- x$escala$codigos
        n_mat <- matrix(0, nrow = length(q$escala$codigos), ncol = length(cats),
                        dimnames = list(q$escala$codigos, cats))
        N_vec <- stats::setNames(numeric(length(cats)), cats)
        Nsp <- stats::setNames(integer(length(cats)), cats)
        for (j in seq_along(cats)) {
          m <- !is.na(xc) & xc == cats[j]
          ct <- .armz_conteo(q$escala$codigos, xq[m], w[m])
          n_mat[, j] <- ct$n
          N_vec[j] <- ct$N
          Nsp[j] <- as.integer(ct$N_sin_peso)
        }
        list(estado = "ok", n_mat = n_mat, N_vec = N_vec, N_sin_peso = Nsp,
             letras = .armz_letras(n_mat, N_vec, alpha))
      })
      names(por_cruce) <- vapply(cruces_meta, `[[`, character(1), "key")
      list(estado = "ok", total = total, cruces = por_cruce)
    })
    names(por_periodo) <- ap$periodos
    q$fila <- NULL
    c(q, list(periodos = por_periodo))
  })
  list(periodos = ap$periodos, cruces = cruces_meta, preguntas = preguntas)
}

# ---- Lado sesión --------------------------------------------------------------

#' Orden de la serie: `armonizacion_periodos` de la matriz y, si no lo hay,
#' el orden de las bases del estudio.
#' @noRd
.armz_periodos_estudio <- function(sid, equiv) {
  s <- session_get(sid, required = FALSE)
  bases <- names(((s %||% list())$estudio %||% list())$bases %||% list())
  p <- as.character(unlist(equiv$armonizacion_periodos %||% character(0), use.names = FALSE))
  p <- p[nzchar(p)]
  if (!length(p)) p <- bases
  if (length(bases)) p <- p[p %in% bases]
  p
}

.armz_misma_fila <- function(a, b) {
  identical(.armz_txt(a$id), .armz_txt(b$id)) &&
    identical(.equiv_armon_clave_variables(a), .equiv_armon_clave_variables(b)) &&
    identical(.armz_txt(a$etiqueta_estandar), .armz_txt(b$etiqueta_estandar))
}

.armz_resolver <- function(equiv, refs) {
  lapply(refs, function(r) {
    f <- .equiv_armon_resolver_fila(equiv, r)
    if (is.null(f$armonizacion)) {
      stop_api(409, "E_EQUIV_SIN_ARMONIZACION",
               sprintf("La fila «%s» no declara armonización.", .armz_txt(f$etiqueta_estandar)),
               list(fila = as.character(r)))
    }
    f
  })
}

.armz_refs <- function(x) {
  v <- as.character(unlist(x %||% character(0), use.names = FALSE))
  v[!is.na(v) & nzchar(trimws(v))]
}

#' Resuelve filas y cruces, carga cada período con su ponderación y apila.
#'
#' @param filas_refs Índices 0-based, ids o etiquetas. Vacío = todas las filas
#'   con armonización que no se usan como cruce.
#' @param cruces_refs Igual, para las variables de cruce.
#' @return `armonizada_apilar()` más `ponderacion` (estado por período).
#' @keywords internal
.armz_preparar <- function(sid, cfg, filas_refs = NULL, cruces_refs = NULL) {
  equiv <- (session_get(sid, required = FALSE) %||% list())$equivalencias_publicos
  todas <- (equiv %||% list())$filas %||% list()
  con_arm <- Filter(function(f) !is.null(f$armonizacion), todas)
  if (!length(con_arm)) {
    stop_api(409, "E_ARMONIZADA_SIN_MATRIZ",
             "La matriz de equivalencias no tiene preguntas armonizadas.")
  }
  periodos <- .armz_periodos_estudio(sid, equiv)
  if (length(periodos) < 2L) {
    stop_api(409, "E_ARMONIZADA_PERIODOS",
             "El comparativo necesita al menos dos mediciones en la serie.",
             list(periodos = as.list(periodos)))
  }

  cruces <- .armz_resolver(equiv, .armz_refs(cruces_refs))
  refs <- .armz_refs(filas_refs)
  filas <- if (length(refs)) {
    .armz_resolver(equiv, refs)
  } else {
    Filter(function(f) !any(vapply(cruces, function(x) .armz_misma_fila(f, x), logical(1))), con_arm)
  }
  if (!length(filas)) {
    stop_api(409, "E_ARMONIZADA_SIN_FILAS",
             "No queda ninguna pregunta armonizada para el comparativo.")
  }

  datos <- list()
  pond <- list()
  for (b in periodos) {
    df <- .equiv_armon_datos_base(sid, b)
    avisos <- character(0)
    df <- withCallingHandlers(
      .analitica_ponderacion_apply(df, .analitica_ponderacion_cfg_base(sid, b, cfg)),
      warning = function(w) {
        avisos <<- c(avisos, conditionMessage(w))
        invokeRestart("muffleWarning")
      }
    )
    est <- attr(df, "ponderacion_estado")
    pond[[b]] <- list(
      pondera = "peso" %in% names(df),
      # «aplicada» / «no_aplicada» vienen del sello. Sin sello, una columna
      # `peso` que ya traía la base también pondera, como en frecuencias.
      estado = if (!is.null(est)) as.character(est$status) else
        if ("peso" %in% names(df)) "columna_peso_de_la_base" else "sin_ponderar",
      modo = if (!is.null(est)) as.character(est$modo %||% "") else "",
      peso_columna = as.character((est %||% list())$peso_columna %||% ""),
      avisos = as.list(avisos)
    )
    datos[[b]] <- df
  }
  ap <- armonizada_apilar(datos, filas, cruces, periodos)
  ap$ponderacion <- pond
  ap
}
