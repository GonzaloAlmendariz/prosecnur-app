# Resumen de diferencias por capítulo: el modelo (especificación CCSS del 2026-11-04, §1)
# ======================================================================================
#
# Una tabla de resumen ejecutivo: filas agrupadas por capítulo, la columna «Total» y una columna por grupo de los cruces
# del estudio. Cada celda dice los puntos de diferencia del grupo FRENTE AL RESTO (p_grupo − p_resto), que es lo que se
# probó; nunca la diferencia contra el total (en la ronda 1 eso marcaba un +7 y dejaba sin marcar un −12).
#
# Este archivo NO prueba nada por su cuenta: cada celda sale de `.tarjetas_evaluar_cruce` (graficos_tarjetas_
# diferencias.R), con la regla y la familia de BH que fijó el worker (ADR 0128 y 0129). Las firmes (p ajustado < 0.01)
# llevan ▲▼; las frágiles (entre 0.01 y alfa), △▽. Lo que queda fuera siempre:
#   - el cruce tautológico (una variable contra el cruce que se deriva de ella): la celda dice «n. a.»;
#   - la segunda opción de una dicotómica (es el complemento de la primera) y las filas de NS/NR, «Otro» y similares.
#
# Aquí también viven las piezas que comparte la lámina de hallazgos (graficos_hallazgos.R): la fuente del render, el
# indicador de una fila del plan (`.dif_indicador`) y su evaluación por cruce (`.dif_evaluar`).
#
# El dibujo nativo vive en `lamina_resumen_diferencias.R`. La lámina se engancha como un `slide_1` cuyo elemento es
# `resumen_diferencias`: su renderer (`.render_resumen_diferencias`) devuelve un ggplot de respaldo (Word y
# `meta$motor_nativo = FALSE`) con la espec en `attr(p, "pulso_espec")`.

# Cruces que se derivan de otra variable por convención del plan de análisis PULSO: «primera generación universitaria»
# se construye con la educación de los padres. La lámina puede declarar los suyos con `tautologicos`.
.DIF_TAUTOLOGICOS <- list(primera_gen = c("educ_padre", "educ_madre", "educ_max"))

.RESUMEN_MAX_FILAS <- 18L
.RESUMEN_MAX_POR_CAPITULO <- 4L

#' Aviso de la lámina en manual sin filas completas: en lenguaje de analista, sin nombres de argumentos (H3 de usabilidad)
#' @keywords internal
.RESUMEN_DIF_SIN_FILAS <- "escribe al menos un capítulo con una fila completa, o elige que las proponga el motor."

#' Aviso del motor con el prefijo de la lámina
#' @keywords internal
.dif_aviso <- function(prefijo, ...) {
  if (exists(".pulso_aviso", mode = "function")) .pulso_aviso(paste0(prefijo, ": ", ...))
  invisible(NULL)
}

#' Texto de un campo del payload (NULL si viene vacío)
#' @keywords internal
.dif_chr1 <- function(x) {
  v <- as.character(unlist(x %||% character(0)))
  if (!length(v) || is.na(v[1]) || !nzchar(trimws(v[1]))) NULL else trimws(v[1])
}

#' Vector de textos de un campo del payload (sin vacíos)
#' @keywords internal
.dif_chr <- function(x) {
  v <- trimws(as.character(unlist(x %||% character(0))))
  v[!is.na(v) & nzchar(v)]
}

#' Mapa nombrado de textos (`{"area": "Área"}`) como vector con nombres
#' @keywords internal
.dif_mapa <- function(m) {
  m <- m %||% list()
  if (!length(m) || is.null(names(m))) return(character(0))
  v <- vapply(m, function(z) as.character(unlist(z))[1], character(1))
  v[!is.na(v) & nzchar(v)]
}

#' Fuente del render para una variable: la base de la referencia («base$var») o la primera de la corrida
#'
#' Lee del motor (`reporte_ppt_plan`, congelado) `data_sources` e `instrument_sources`, como `.render_cifra`.
#' @keywords internal
.dif_fuente_render <- function(ref = NULL) {
  data_sources <- dynGet("data_sources", ifnotfound = NULL)
  inst_sources <- dynGet("instrument_sources", ifnotfound = NULL)
  if (!length(data_sources)) stop("el render no expone las fuentes del estudio.", call. = FALSE)
  f <- .cifra_fuente(as.character(ref %||% "")[1], data_sources, inst_sources)
  .sig_fuente(f$data, f$inst)
}

#' El plan del motor (lista de `ppt_slide`), o una lista vacía si el render no lo expone
#' @keywords internal
.dif_plan_render <- function() {
  plan <- dynGet("plan", ifnotfound = NULL)
  if (!is.list(plan) || !length(plan) || !all(vapply(plan, inherits, logical(1), what = "ppt_slide"))) return(list())
  plan
}

#' La opción de tarjetas que declara el plan (cruces, rótulos y cortos), para no teclearla dos veces
#' @keywords internal
.dif_opcion_del_plan <- function(plan) {
  for (s in plan) {
    o <- tryCatch(.tarjetas_opcion(s$meta), error = function(e) NULL)
    if (!is.null(o)) return(o)
  }
  NULL
}

#' Rótulo corto de un grupo: el declarado en `cortos`, siempre (en la tabla y en las tarjetas de cifras el ancho es fijo)
#' @keywords internal
.dif_corto <- function(etiqueta, cortos) {
  if (!length(cortos)) return(etiqueta)
  out <- unname(cortos[etiqueta])
  ifelse(is.na(out), etiqueta, out)
}

#' Cruces, rótulos y cortos de la lámina: los suyos; si no, los de las tarjetas del plan; si no, los del estudio
#' @keywords internal
.dif_cruces <- function(el, plan, sig, fuente) {
  opt <- .dif_opcion_del_plan(plan)
  cruces <- .dif_chr(el$cruces)
  # Sin `cruces`, los que la lámina rotula: sus `rotulos` ya dicen cuáles quiere. Antes caía a los de Analítica y perdía
  # en silencio los estudios de los padres (CCSS v7.22, resumen de diferencias y resumen ejecutivo).
  if (!length(cruces)) cruces <- names(.dif_mapa(el$rotulos))
  if (!length(cruces)) cruces <- opt$cruces %||% character(0)
  if (!length(cruces)) cruces <- .dif_chr(sig$cruces)
  cruces <- unique(vapply(cruces, .sig_var_local, character(1)))
  fuera <- setdiff(names(.dif_mapa(el$rotulos)), cruces[cruces %in% names(fuente$data)])
  if (length(fuera)) .dif_aviso("Diferencias", sprintf("%s rotulado(s) sin columna en la base: %s; no entran a la tabla.",
                                                       if (length(fuera) == 1L) "un cruce" else "cruces", paste(fuera, collapse = ", ")))
  cruces <- cruces[cruces %in% names(fuente$data)]
  rotulos <- c(.dif_mapa(el$rotulos), opt$rotulos %||% character(0))
  rotulos <- rotulos[!duplicated(names(rotulos))]
  cortos <- c(.dif_mapa(el$cortos), opt$cortos %||% character(0))
  cortos <- cortos[!duplicated(names(cortos))]
  rot <- vapply(cruces, function(cr) if (cr %in% names(rotulos)) unname(rotulos[[cr]]) else .tarjetas_rotulo_var(cr, fuente$survey),
                character(1))
  list(cruces = cruces, rotulos = stats::setNames(rot, cruces), cortos = cortos,
       publico = .dif_chr1(el$publico) %||% opt$publico %||% "personas encuestadas")
}

#' ¿El cruce se deriva de la variable? (declarado, por convención o porque la variable lo determina caso a caso)
#' @keywords internal
.dif_tautologico <- function(var, cruce, fuente = NULL, extra = list()) {
  v0 <- sub("_recod$", "", var); c0 <- sub("_recod$", "", cruce)
  if (identical(v0, c0)) return(TRUE)
  mapa <- c(.DIF_TAUTOLOGICOS, extra %||% list())
  for (k in which(names(mapa) %in% c(cruce, c0))) if (v0 %in% sub("_recod$", "", as.character(unlist(mapa[[k]])))) return(TRUE)
  # La variable fija el cruce en cada caso (el cruce es una recodificación de ella): ninguna diferencia es un hallazgo.
  d <- fuente$data
  if (is.data.frame(d) && var %in% names(d) && cruce %in% names(d)) {
    a <- .reporte_plan_clean_chr(d[[var]]); b <- .reporte_plan_clean_chr(d[[cruce]])
    ok <- !is.na(a) & nzchar(a) & !is.na(b) & nzchar(b)
    if (sum(ok) >= 10L && length(unique(a[ok])) >= 2L) {
      por <- tapply(b[ok], a[ok], function(z) length(unique(z)))
      if (all(por == 1L)) return(TRUE)
    }
  }
  FALSE
}

#' Una lista de registros del payload (capítulos, cifras), aunque llegue un registro suelto
#'
#' Los tres rearmados del plan JSON (`.graficos_rebuild_slide_json`, `.rebuild_slide`, `.mini_rebuild_slide`) desenvuelven
#' todo valor del payload que sea una lista de un solo elemento sin nombres, para que `["x"]` llegue como `"x"`. Una lista
#' con UN capítulo (`[{titulo, cifras}]`, lo que escribe el editor con un capítulo) llegaba así como el capítulo mismo, el
#' modelo recorría sus campos como si fueran capítulos y la lámina salía «Sin datos» en la vista previa y en el PPT
#' (H3 del checklist de usabilidad del editor, 2026-11-05). Un registro se reconoce por sus claves.
#' @param claves Claves que delatan un registro suelto (`titulo`/`cifras`/`filas` para un capítulo, `var` para una cifra).
#' @keywords internal
.dif_lista_registros <- function(x, claves) {
  if (is.null(x) || !is.list(x) || !length(x)) return(x %||% list())
  if (!is.null(names(x)) && any(names(x) %in% claves)) return(list(x))
  x
}

#' Normaliza una fila del payload: `{var, fila | filas | top2box, rotulo, base_rotulo, filtros}`
#' @keywords internal
.dif_item <- function(x) {
  x <- as.list(x %||% list())
  list(var = .sig_var_local(x$var), ref = .dif_chr1(x$var), fila = .dif_chr1(x$fila), filas = .dif_chr(x$filas),
       top2box = .dif_chr(x$top2box %||% x$top2box_labels), rotulo = .dif_chr1(x$rotulo), base_rotulo = .dif_chr1(x$base_rotulo),
       filtros = x$filtros %||% list())
}

#' Indicador de una fila: qué se cuenta por caso, con su base, su total y por qué queda fuera (si queda)
#'
#' @return `list(var, key, sumar, y, ind, tipo, n, total, excluir)`; `excluir` es NULL o el motivo («NS/NR»…).
#' @keywords internal
.dif_indicador <- function(fuente, it, regla) {
  var <- .reporte_plan_resolve_recod_var(it$var, fuente$data)
  ind <- tryCatch(.sig_indicadores(fuente$data, var, survey = fuente$survey, orders_list = fuente$orders_list),
                  error = function(e) NULL)
  fuera <- function(motivo) list(var = var, key = NA_character_, excluir = motivo)
  if (is.null(ind) || !ncol(ind$Y)) return(fuera(sprintf("la pregunta «%s» no está en la base", it$var)))
  sumar <- if (length(it$top2box)) it$top2box else if (length(it$filas) > 1L) it$filas else NULL
  sust <- .sig_filas_a_probar(colnames(ind$Y), ind$codigos, regla, solo_principal = FALSE)
  if (!is.null(sumar)) {
    faltan <- setdiff(sumar, colnames(ind$Y))
    if (length(faltan) == length(sumar)) return(fuera(sprintf("«%s» no tiene las opciones %s", var, paste0("«", sumar, "»", collapse = ", "))))
    sumar <- intersect(sumar, colnames(ind$Y))
    key <- paste(sumar, collapse = " + ")
    ind <- .sig_indicadores_derivar(ind, key, sumar)
  } else {
    key <- it$fila %||% if (length(it$filas)) it$filas[1] else NULL
    if (is.null(key)) key <- sust[1] %||% NA_character_
    if (is.na(key) || !key %in% colnames(ind$Y)) return(fuera(sprintf("«%s» no tiene la opción «%s»", var, key %||% "")))
    if (isTRUE(.sig_fuera_de_prueba(key, ind$codigos))) return(fuera(sprintf("«%s» es una opción de no sabe o no responde", key)))
  }
  y <- ind$Y[, key]
  w <- ind$w %||% rep(1, length(y)); ok <- !is.na(y) & w > 0
  total <- if (any(ok)) 100 * sum(w[ok] * y[ok]) / sum(w[ok]) else NA_real_
  tipo <- if (identical(ind$tipo, "sm")) "multiple" else if (length(sust) == 2L) "dicotomica" else "opcion_unica"
  list(var = var, key = key, sumar = sumar, y = y, ind = ind, tipo = tipo, n = sum(ok), total = total, excluir = NULL)
}

#' Opción principal de una dicotómica: «Sí» si la hay; si no, la primera del instrumento
#' @keywords internal
.dif_principal <- function(sust) {
  si <- which(tolower(trimws(sust)) %in% c("s\u00ed", "si"))
  if (length(si)) sust[si[1]] else sust[1]
}

#' Proporción ponderada (0-100) de un indicador entre los casos de `en`
#' @keywords internal
.dif_prop <- function(y, w, en) {
  ok <- en & !is.na(y) & w > 0
  if (!any(ok)) NA_real_ else 100 * sum(w[ok] * y[ok]) / sum(w[ok])
}

#' Evalúa una fila frente al resto en cada cruce, con la prueba de las tarjetas
#'
#' @param fi Indicador de `.dif_indicador()` (sin `excluir`).
#' @return `list(celdas, probados)`: `celdas` es un data.frame con una fila por (cruce, grupo): `estado` («dif»,
#'   «igual», «na» o «sin_prueba»), `valor` (p_grupo − p_resto, en puntos, solo con «dif»), `dir`, `fragil`, `p`,
#'   `p_resto`, `n` y `conglomerados`; `probados` son los cruces que se probaron de verdad.
#' @keywords internal
.dif_evaluar <- function(fuente, fi, cruces, sig, tautologicos = list()) {
  regla <- sig$regla
  d <- fuente$data
  w <- .peso_vec(d)
  cl <- if (!is.null(regla$conglomerado) && regla$conglomerado %in% names(d)) .sig_conglomerado_ultimo(d[[regla$conglomerado]], nrow(d)) else NULL
  filas <- list(); probados <- character(0)
  for (cr in cruces) {
    gr <- .sig_grupos_cruce(fuente, cr)
    if (is.null(gr) || length(gr$grupos) < 2L) next
    K <- length(gr$grupos)
    tauto <- .dif_tautologico(fi$var, cr, fuente, tautologicos)
    r <- if (tauto) NULL else tryCatch(
      .tarjetas_evaluar_cruce(fuente, fi$var, cr, regla, sig$familia, filas = if (is.null(fi$sumar)) fi$key else NULL,
                              top2box = fi$sumar),
      error = function(e) {
        .dif_aviso("Diferencias", sprintf("no se pudo probar «%s» por «%s» (%s).", fi$var, cr, conditionMessage(e)))
        NULL
      })
    if (!is.null(r)) probados <- c(probados, cr)
    pr <- if (is.null(r)) NULL else r$pruebas[r$pruebas$fila == fi$key, , drop = FALSE]
    for (k in seq_len(K)) {
      g <- gr$grupos[k]
      en_g <- !is.na(gr$g) & gr$g == g
      en_resto <- !is.na(gr$g) & gr$g != g
      estado <- if (tauto) "na" else if (is.null(r)) "sin_prueba" else "igual"
      dir <- NA_character_; fragil <- NA; valor <- NA_real_
      if (!is.null(pr) && nrow(pr)) {
        t <- pr[pr$grupo == g, , drop = FALSE]
        if (nrow(t)) {
          dir <- if (isTRUE(t$sube[1])) "up" else "down"; fragil <- isTRUE(t$fragil[1]); valor <- t$dif[1]
        } else if (K == 2L) {
          # Con dos grupos el resto ES el otro grupo: la misma prueba, con el signo al revés.
          dir <- if (isTRUE(pr$sube[1])) "down" else "up"; fragil <- isTRUE(pr$fragil[1]); valor <- pr$dif[1]
        }
        if (!is.na(dir)) { estado <- "dif"; valor <- if (identical(dir, "up")) abs(valor) else -abs(valor) }
      }
      ncl <- if (is.null(cl)) NA_integer_ else length(unique(cl[en_g & !is.na(fi$y)]))
      filas[[length(filas) + 1L]] <- data.frame(
        cruce = cr, codigo = g, etiqueta = unname(gr$etiquetas[k]), estado = estado, valor = valor, dir = dir,
        fragil = fragil, p = .dif_prop(fi$y, w, en_g), p_resto = .dif_prop(fi$y, w, en_resto),
        n = sum(en_g & !is.na(fi$y)), conglomerados = ncl, stringsAsFactors = FALSE)
    }
  }
  celdas <- if (length(filas)) do.call(rbind, filas) else
    data.frame(cruce = character(), codigo = character(), etiqueta = character(), estado = character(), valor = numeric(),
               dir = character(), fragil = logical(), p = numeric(), p_resto = numeric(), n = numeric(),
               conglomerados = integer(), stringsAsFactors = FALSE)
  list(celdas = celdas, probados = probados)
}

#' Fuerza de una fila para ordenar: las que tienen alguna firme primero, luego la mayor diferencia
#' @keywords internal
.dif_fuerza <- function(celdas) {
  dif <- celdas[celdas$estado == "dif", , drop = FALSE]
  if (!nrow(dif)) return(c(firme = 0, tam = 0))
  c(firme = as.numeric(any(!dif$fragil)), tam = max(abs(dif$valor)))
}

# ---- filas candidatas del plan (selección automática) -------------------------------------------------------------

#' Preguntas del plan con su capítulo: cada gráfico del total (sin cruce) de una lámina de un gráfico
#' @return Lista de `list(capitulo, titulo, vars, top2box)`.
#' @keywords internal
.resumen_dif_preguntas_plan <- function(plan) {
  cap <- ""; out <- list()
  for (s in plan) {
    st <- s$.slide_type %||% ""
    if (identical(st, "section")) { cap <- as.character(s$slots$title %||% s$title %||% "")[1]; next }
    if (!st %in% c("slide_1", "slide_1_narrativo")) next
    el <- (s$slots %||% list())$plot
    if (!inherits(el, "ppt_element") || el$.element_type %in% c("resumen_diferencias", "hallazgos")) next
    if (!el$.element_type %in% c("barras_agrupadas", "barras_categoricas", "barras_multiapiladas", "dicotomica")) next
    if (!is.null(el$cruces %||% el$cruce %||% (el$overrides %||% list())$cruces)) next
    vars <- vapply(as.character(unlist(el$vars %||% el$var)), .sig_var_local, character(1))
    if (!length(vars)) next
    ttb <- .dif_chr(el$top2box_labels %||% (el$overrides %||% list())$top2box_labels)
    if (length(vars) > 1L && !length(ttb)) next   # una batería sin Top Two Box no tiene una fila que resumir
    out[[length(out) + 1L]] <- list(capitulo = cap, titulo = as.character(s$title %||% "")[1], vars = unname(vars), top2box = ttb)
  }
  out
}

#' Filas candidatas de una pregunta del plan: cada ítem con su Top Two Box, o cada opción sustantiva
#' @keywords internal
.resumen_dif_candidatas <- function(fuente, q, regla) {
  if (length(q$top2box)) {
    return(lapply(q$vars, function(v) list(var = v, top2box = q$top2box, fila = NULL, filas = character(0),
                                           rotulo = .tarjetas_rotulo_var(v, fuente$survey), capitulo = q$capitulo)))
  }
  v <- .reporte_plan_resolve_recod_var(q$vars[[1]], fuente$data)
  ind <- tryCatch(.sig_indicadores(fuente$data, v, survey = fuente$survey, orders_list = fuente$orders_list), error = function(e) NULL)
  if (is.null(ind)) return(list())
  sust <- .sig_filas_a_probar(colnames(ind$Y), ind$codigos, regla, solo_principal = FALSE)
  if (!identical(ind$tipo, "sm") && length(sust) == 2L) sust <- .dif_principal(sust)
  pregunta <- q$titulo
  # Rótulo propuesto (el analista lo reescribe en la selección manual): la opción en una múltiple; la pregunta en una
  # dicotómica (su opción principal es la afirmativa); en una de opción única, «pregunta: opción» si la pregunta es corta.
  rotulo <- function(f) {
    if (identical(ind$tipo, "sm")) return(f)
    if (length(sust) == 1L) return(pregunta)
    if (nchar(pregunta) > 45L) f else paste0(pregunta, ": ", f)
  }
  lapply(sust, function(f) list(var = q$vars[[1]], fila = f, filas = character(0), top2box = character(0),
                                rotulo = rotulo(f), capitulo = q$capitulo))
}

# ---- el modelo de la lámina ----------------------------------------------------------------------------------------

#' Capítulos de la lámina (manual): los del payload, con cada fila normalizada
#' @keywords internal
.resumen_dif_capitulos_manuales <- function(capitulos) {
  lapply(capitulos %||% list(), function(c) {
    c <- as.list(c)
    list(titulo = .dif_chr1(c$titulo) %||% "", filas = lapply(c$filas %||% list(), .dif_item))
  })
}

#' Rótulo de una fila con su base cuando difiere de la de la lámina («base: 140 que trabajan»)
#' @keywords internal
.resumen_dif_rotulo <- function(it, fi, n_lamina, fuente) {
  r <- it$rotulo %||% {
    if (length(fi$sumar)) .tarjetas_rotulo_var(fi$var, fuente$survey) else paste0(.tarjetas_rotulo_var(fi$var, fuente$survey), ": ", fi$key)
  }
  if (is.finite(fi$n) && fi$n != n_lamina) {
    r <- sprintf("%s (base: %s%s)", r, format(fi$n, big.mark = ","), if (is.null(it$base_rotulo)) "" else paste0(" ", it$base_rotulo))
  }
  r
}

#' Modelo de la lámina de resumen de diferencias (puro sobre la fuente, la regla y la familia)
#'
#' @param el Elemento `resumen_diferencias` (ver `p_slide_resumen_diferencias`).
#' @param fuente `.sig_fuente()` de la base.
#' @param sig Contexto `list(regla, familia, m, cruces)`.
#' @param plan Plan del motor (para la selección automática y la opción de tarjetas).
#' @return Espec `tipo = "resumen_diferencias"`.
#' @keywords internal
.resumen_dif_modelo <- function(el, fuente, sig, plan = list()) {
  aviso <- function(...) .dif_aviso("Resumen de diferencias", ...)
  regla <- sig$regla
  cx <- .dif_cruces(el, plan, sig, fuente)
  if (!length(cx$cruces)) aviso("el estudio no declara cruces; la tabla solo muestra el total.")
  motivo <- .sig_diseno_invalido(fuente$data, regla)
  if (!is.null(motivo)) aviso("el diseño de la base no permite probar diferencias («", motivo, "»).")
  n_lamina <- nrow(fuente$data)
  tauto <- el$tautologicos %||% list()
  seleccion <- if (identical(.dif_chr1(el$seleccion), "auto")) "auto" else "manual"
  max_total <- suppressWarnings(as.integer(el$max_filas %||% .RESUMEN_MAX_FILAS))[1]
  max_cap <- suppressWarnings(as.integer(el$max_por_capitulo %||% .RESUMEN_MAX_POR_CAPITULO))[1]
  if (is.na(max_total) || max_total < 1L) max_total <- .RESUMEN_MAX_FILAS
  if (is.na(max_cap) || max_cap < 1L) max_cap <- .RESUMEN_MAX_POR_CAPITULO

  dicotomicas <- character(0)   # una sola fila por dicotómica: la otra opción es su complemento y repite la diferencia
  evaluar <- function(it) {
    fi <- .dif_indicador(fuente, it, regla)
    if (is.null(fi$excluir) && identical(fi$tipo, "dicotomica") && is.null(fi$sumar)) {
      if (fi$var %in% names(dicotomicas)) {
        fi$excluir <- sprintf("«%s» es la otra opción de una dicotómica y repite la diferencia de «%s»", fi$key, dicotomicas[[fi$var]])
      } else dicotomicas[[fi$var]] <<- fi$key
    }
    if (!is.null(fi$excluir)) { if (seleccion == "manual") aviso("la fila «", it$rotulo %||% it$var, "» queda fuera: ", fi$excluir, "."); return(NULL) }
    ev <- if (is.null(motivo)) .dif_evaluar(fuente, fi, cx$cruces, sig, tauto) else list(celdas = NULL, probados = character(0))
    list(rotulo = .resumen_dif_rotulo(it, fi, n_lamina, fuente), var = fi$var, fila = fi$key, total = fi$total, n = fi$n,
         celdas = ev$celdas, fuerza = .dif_fuerza(ev$celdas %||% data.frame(estado = character())))
  }

  if (seleccion == "auto") {
    cands <- unlist(lapply(.resumen_dif_preguntas_plan(plan), function(q) .resumen_dif_candidatas(fuente, q, regla)), recursive = FALSE)
    filas <- list()
    for (cd in cands) {
      it <- .dif_item(cd); it$rotulo <- cd$rotulo
      e <- evaluar(it)
      if (is.null(e) || e$fuerza[["tam"]] <= 0) next
      e$capitulo <- cd$capitulo %||% ""
      e$candidata <- list(var = it$var, fila = it$fila, top2box = it$top2box, rotulo = it$rotulo)
      filas[[length(filas) + 1L]] <- e
    }
    orden <- order(-vapply(filas, function(f) f$fuerza[["firme"]], 0), -vapply(filas, function(f) f$fuerza[["tam"]], 0))
    elegidas <- list(); por_cap <- integer(0)
    for (i in orden) {
      cp <- filas[[i]]$capitulo
      if (length(elegidas) >= max_total) break
      if ((por_cap[cp] %||% 0L) >= max_cap) next
      if (is.na(por_cap[cp])) por_cap[cp] <- 0L
      por_cap[cp] <- por_cap[cp] + 1L
      elegidas[[length(elegidas) + 1L]] <- filas[[i]]
    }
    caps <- unique(vapply(filas, `[[`, "", "capitulo"))   # en el orden del plan
    capitulos <- lapply(caps, function(cp) list(titulo = cp, filas = Filter(function(f) identical(f$capitulo, cp), elegidas)))
    capitulos <- Filter(function(c) length(c$filas) > 0L, capitulos)
    if (length(filas)) {
      aviso(sprintf("el motor propone %d de %d filas con diferencias (hasta %d por capítulo y %d en total). Para cambiarlas, elige «Las escribo yo» en Selección de filas.",
                    length(elegidas), length(filas), max_cap, max_total))
    } else {
      aviso("ninguna pregunta del informe muestra diferencias entre grupos con la regla del informe.")
    }
  } else {
    capitulos <- lapply(.resumen_dif_capitulos_manuales(el$capitulos), function(c) {
      list(titulo = c$titulo, filas = Filter(Negate(is.null), lapply(c$filas, evaluar)))
    })
    capitulos <- Filter(function(c) length(c$filas) > 0L, capitulos)
    if (!length(capitulos)) aviso(.RESUMEN_DIF_SIN_FILAS)
  }

  columnas <- do.call(rbind, lapply(cx$cruces, function(cr) {
    gr <- .sig_grupos_cruce(fuente, cr)
    if (is.null(gr) || length(gr$grupos) < 2L) return(NULL)
    data.frame(cruce = cr, codigo = gr$grupos, etiqueta = unname(gr$etiquetas),
               corto = .dif_corto(unname(gr$etiquetas), cx$cortos), stringsAsFactors = FALSE)
  }))
  if (is.null(columnas)) columnas <- data.frame(cruce = character(), codigo = character(), etiqueta = character(), corto = character())
  list(tipo = "resumen_diferencias", capitulos = capitulos, columnas = columnas,
       rotulos_cruce = cx$rotulos[unique(columnas$cruce)], publico = cx$publico, n = n_lamina, regla = regla,
       m = sig$m %||% NA_integer_, seleccion = seleccion, nota = .resumen_dif_nota(regla, sig$m, cx$publico))
}

#' Nota al pie fija: qué es la celda, que se muestran las principales y el método
#' @keywords internal
.resumen_dif_nota <- function(regla, m = NULL, publico = "personas encuestadas") {
  paste0("Puntos de diferencia entre el grupo y el resto de ", publico, ". Se muestran las diferencias principales de cada ",
         "capítulo. Las demás están en las láminas y en las tablas de cruces. ", .dif_texto_metodo(regla, m))
}

#' Frase del método de las diferencias frente al resto (compartida con la lámina de hallazgos)
#' @keywords internal
.dif_texto_metodo <- function(regla, m = NULL) {
  rao <- identical(regla$prueba, "rao_scott")
  bh <- identical(regla$correccion, "bh_informe")
  m <- suppressWarnings(as.integer(m %||% NA_integer_))[1]
  prueba <- if (rao) sprintf("Rao-Scott por %s", .sig_nombre_conglomerado(regla$conglomerado)) else "prueba z"
  corr <- if (bh) {
    if (!is.na(m) && m > 0L) sprintf("corrección de Benjamini-Hochberg sobre las %s comparaciones del informe", format(m, big.mark = ","))
    else "corrección de Benjamini-Hochberg sobre las comparaciones del informe"
  } else "corrección de Bonferroni"
  umbral <- regla$umbral_puntos %||% 0
  marcas <- if (umbral > 0) sprintf(" Solo se marcan las de al menos %s puntos", .sig_num(umbral)) else " Solo se marcan las diferencias"
  minimos <- sprintf(" en grupos con %s casos%s o más.", format(regla$base_minima %||% 30),
                     if (rao) sprintf(" y %s %ss", format(regla$conglomerados_minimos %||% 8L), .sig_nombre_conglomerado(regla$conglomerado)) else "")
  paste0("Diferencias: cada grupo frente al resto, ", prueba, " con ", corr, ".", marcas, minimos)
}

# ---- elemento y render ----------------------------------------------------------------------------------------------

#' Elemento del plan de la lámina de resumen (lo construye `p_slide_resumen_diferencias`)
#' @keywords internal
.el_resumen_diferencias <- function(capitulos = list(), cruces = NULL, seleccion = "manual", rotulos = list(), cortos = list(),
                                    tautologicos = list(), publico = NULL, max_filas = NULL, max_por_capitulo = NULL, fuente = NULL) {
  capitulos <- .dif_lista_registros(capitulos, c("titulo", "filas"))   # un capítulo suelto es una lista de uno
  el <- list(.element_type = "resumen_diferencias", capitulos = capitulos, cruces = cruces, seleccion = seleccion,
             rotulos = rotulos, cortos = cortos, tautologicos = tautologicos, publico = publico, max_filas = max_filas,
             max_por_capitulo = max_por_capitulo, fuente_ref = fuente, overrides = list())
  class(el) <- c("ppt_element", "list")
  el
}

#' Renderer del motor: calcula el modelo y devuelve el ggplot de respaldo con la espec
#' @keywords internal
.render_resumen_diferencias <- function(el, preset_args = list()) {
  fuente <- .dif_fuente_render(el$fuente_ref)
  sig <- .sig_contexto_render(fuente$data)
  plan_motor <- .dif_plan_render()   # antes de llamar: dentro del modelo, `plan` es una promesa y dynGet la encontraría
  espec <- .resumen_dif_modelo(el, fuente, sig, plan_motor)
  .resumen_dif_ggplot(espec)
}

#' Respaldo en ggplot (Word y `motor_nativo = FALSE`): la misma tabla con sus celdas, en un gráfico de mosaicos
#' @keywords internal
.resumen_dif_ggplot <- function(espec) {
  w <- .resumen_dif_word_ggplot(espec)   # la tabla de la lámina a escala de página (reporte_word_resumen_diferencias.R)
  if (!is.null(w)) return(w)
  filas <- unlist(lapply(espec$capitulos, function(c) lapply(c$filas, function(f) f$rotulo)))
  cols <- espec$columnas
  df <- do.call(rbind, lapply(seq_along(espec$capitulos), function(i) {
    c <- espec$capitulos[[i]]
    do.call(rbind, lapply(c$filas, function(f) {
      ce <- f$celdas
      if (is.null(ce) || !nrow(ce)) return(NULL)
      data.frame(fila = f$rotulo, col = paste(ce$cruce, ce$codigo, sep = "\r"), estado = ce$estado,
                 texto = ifelse(ce$estado == "dif", paste0(ifelse(ce$valor > 0, "+", "−"), round(abs(ce$valor)),
                                                           ifelse(ce$dir == "up", ifelse(ce$fragil, " △", " ▲"), ifelse(ce$fragil, " ▽", " ▼"))),
                                ifelse(ce$estado == "na", "n. a.", "·")),
                 tono = ifelse(ce$estado != "dif", "igual", paste0(ce$dir, ifelse(ce$fragil, "_95", "_99"))), stringsAsFactors = FALSE)
    }))
  }))
  if (is.null(df) || !nrow(df)) {
    p <- ggplot2::ggplot() + ggplot2::annotate("text", x = 0, y = 0, label = "Sin diferencias que resumir", colour = .std_color("texto_suave")) +
      ggplot2::theme_void()
    attr(p, "pulso_espec") <- espec
    return(p)
  }
  niveles_col <- paste(cols$cruce, cols$codigo, sep = "\r")
  df$col <- factor(df$col, levels = niveles_col, labels = cols$corto)
  df$fila <- factor(df$fila, levels = rev(unique(filas)))
  tonos <- c(igual = .std_color("tarjeta_fondo"), up_99 = .std_color("azul"), down_99 = .std_color("naranja_bottom_two_box"),
             up_95 = .std_color("tarjeta_fondo_95"), down_95 = .std_color("fondo_destacado"))
  texto <- c(igual = .std_color("texto_tenue"), up_99 = "#FFFFFF", down_99 = "#FFFFFF", up_95 = .std_color("tarjeta_borde_95"),
             down_95 = .std_color("naranja_bottom_two_box_texto"))
  p <- ggplot2::ggplot(df, ggplot2::aes(x = .data$col, y = .data$fila)) +
    ggplot2::geom_tile(ggplot2::aes(fill = .data$tono), colour = .std_color("filete"), width = 0.94, height = 0.86) +
    ggplot2::geom_text(ggplot2::aes(label = .data$texto, colour = .data$tono), size = 8 / ggplot2::.pt, fontface = "bold") +
    ggplot2::scale_fill_manual(values = tonos, guide = "none") + ggplot2::scale_colour_manual(values = texto, guide = "none") +
    ggplot2::scale_x_discrete(position = "top", labels = function(x) vapply(x, function(z) paste(strwrap(z, 9), collapse = "\n"), "")) +
    ggplot2::labs(x = NULL, y = NULL, caption = espec$nota) +
    ggplot2::theme_minimal(base_size = 9) +
    ggplot2::theme(panel.grid = ggplot2::element_blank(), axis.text = ggplot2::element_text(colour = .std_color("azul")),
                   plot.caption = ggplot2::element_text(colour = .std_color("texto_suave"), hjust = 0))
  attr(p, "pulso_espec") <- espec
  attr(p, "alto_word") <- min(8, 1 + 0.24 * length(filas))
  p
}
