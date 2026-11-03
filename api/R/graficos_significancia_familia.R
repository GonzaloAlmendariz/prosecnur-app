# Comparaciones del estudio: la familia de BH y la lámina vista desde el plan (ADR 0128 §3 y §5)
# =============================================================================================
#
# La primera pasada del cálculo en dos pasadas. Recorre todas las comparaciones del estudio —cada pregunta de las
# secciones de Analítica por cada variable de cruce declarada, más cada lámina con cruce— y junta sus p. Con eso, la
# segunda pasada (el render de cada lámina, la tabla de cruces y los endpoints de la UI) ajusta cada p contra la misma
# familia, y la lámina y la tabla dan las mismas letras sin importar qué entregable se genera.
#
# La familia no depende del entregable: depende de los datos, la regla y la declaración de cruces. Se guarda en memoria
# por huella para no recalcularla en cada lámina.

.sig_cache <- new.env(parent = emptyenv())

#' Fuente única de datos e instrumento para la prueba
#' @keywords internal
.sig_fuente <- function(data, inst = NULL) {
  list(data = as.data.frame(data, stringsAsFactors = FALSE), survey = inst$survey %||% NULL,
       choices = inst$choices %||% NULL, orders_list = inst$orders_list %||% NULL)
}

#' Nombre de variable sin el prefijo de base («estudiantes$sexo» → «sexo»)
#' @keywords internal
.sig_var_local <- function(x) {
  x <- as.character(unlist(x %||% character(0)))[1]
  if (is.na(x)) return(NA_character_)
  sub("^.*\\$", "", trimws(x))
}

#' Grupos de un cruce: código por caso, orden del instrumento y rótulo
#' @keywords internal
.sig_grupos_cruce <- function(fuente, cruce) {
  d <- fuente$data
  if (!cruce %in% names(d)) return(NULL)
  g <- .reporte_plan_clean_chr(d[[cruce]])
  g[!nzchar(g)] <- NA_character_
  presentes <- unique(g[!is.na(g)])
  ln <- .list_name_of_var_local(cruce, fuente$survey)
  niveles <- .reporte_plan_choice_levels_for_list(ln, fuente$choices)
  orden <- if (nrow(niveles)) c(intersect(as.character(niveles$code), presentes), setdiff(presentes, niveles$code)) else
    sort(presentes)
  etiquetas <- .reporte_plan_labels_for_levels(ln, orden, fuente$choices)
  etiquetas[!nzchar(etiquetas)] <- orden[!nzchar(etiquetas)]
  list(g = g, grupos = orden, etiquetas = etiquetas)
}

#' Evalúa una pregunta por un cruce sobre la fuente, sin ajustar el p
#'
#' @param top2box Rótulos que suman el *top two box*. Con ellos se prueba solo esa fila (propuesta §4.1.6).
#' @param solo_principal En una dicotómica se prueba solo la opción principal.
#' @keywords internal
.sig_evaluar_pregunta <- function(fuente, var, cruce, regla, top2box = NULL, solo_principal = TRUE) {
  if (!is.null(.sig_diseno_invalido(fuente$data, regla))) return(NULL)   # ADR 0127 §1: no entra a la familia
  var <- .sig_var_local(var); cruce <- .sig_var_local(cruce)
  gr <- .sig_grupos_cruce(fuente, cruce)
  if (is.null(gr) || length(gr$grupos) < 2L) return(NULL)
  ind <- tryCatch(.sig_indicadores(fuente$data, var, survey = fuente$survey, orders_list = fuente$orders_list),
                  error = function(e) NULL)
  if (is.null(ind) || !ncol(ind$Y)) return(NULL)
  orden_inst <- .freq_orders_entry(fuente$orders_list, var)
  etiquetas <- colnames(ind$Y)
  if (!is.null(orden_inst)) {
    etiquetas <- c(intersect(as.character(orden_inst$labels), etiquetas), setdiff(etiquetas, orden_inst$labels))
  }
  if (length(top2box)) {
    rot <- paste(top2box, collapse = " + ")
    ind <- .sig_indicadores_derivar(ind, rot, top2box)
    filas <- if (rot %in% colnames(ind$Y)) rot else character(0)
  } else {
    filas <- .sig_filas_a_probar(etiquetas, ind$codigos, regla, solo_principal = solo_principal)
  }
  sustantivas <- .sig_filas_a_probar(etiquetas, ind$codigos, regla, solo_principal = FALSE)
  binaria <- identical(ind$tipo, "so") && length(sustantivas) == 2L
  cl <- if (identical(regla$prueba, "rao_scott") && !is.null(regla$conglomerado) && regla$conglomerado %in% names(fuente$data))
    fuente$data[[regla$conglomerado]] else NULL
  st <- if (!is.null(regla$estrato) && regla$estrato %in% names(fuente$data)) fuente$data[[regla$estrato]] else NULL
  ev <- .sig_evaluar(ind, gr$g, gr$grupos, gr$etiquetas, cluster = cl, estrato = st, regla = regla, filas = filas,
                     binaria = binaria && !length(top2box))
  ev$var <- var; ev$cruce <- cruce
  ev
}

#' Lo que una lámina del plan compara: pregunta, cruce, *top two box* y si la marca está encendida
#' @keywords internal
.sig_lamina_del_plan <- function(slide) {
  grafs <- Filter(function(z) is.list(z) && !is.null(z$graficador), slide$payload %||% list())
  for (g in grafs) {
    a <- g$args %||% list()
    ov <- a$overrides %||% list()
    cruce <- .sig_var_local(a$cruces %||% a$cruce %||% ov$cruces %||% ov$cruce)
    if (is.na(cruce) || !nzchar(cruce)) next
    var <- .sig_var_local(a$var %||% a$vars)
    if (is.na(var) || !nzchar(var)) next
    ttb <- as.character(unlist(a$top2box_labels %||% ov$top2box_labels %||% character(0)))
    activo <- a$mostrar_significancia %||% ov$mostrar_significancia
    return(list(var = var, cruce = cruce, top2box = ttb, graficador = g$graficador,
                activo = isTRUE(activo)))
  }
  NULL
}

#' Comparaciones que forman la familia del estudio
#'
#' Cada pregunta de las secciones de Analítica por cada `cruces_vars`, y cada lámina con cruce (con su *top two box* si
#' lo declara). Solo variables categóricas: las que el instrumento ordena o las múltiples con dummies.
#' @keywords internal
.sig_combinaciones_estudio <- function(fuente, plan = NULL, analitica_config = NULL) {
  slides <- if (is.list(plan)) plan$slides %||% plan else list()
  filas <- list()
  for (s in slides) {
    l <- .sig_lamina_del_plan(s)
    if (is.null(l)) next
    filas[[length(filas) + 1L]] <- list(var = l$var, cruce = l$cruce, top2box = l$top2box)
  }
  cruces <- .sig_cruces_de_analitica(analitica_config)
  secciones <- analitica_config$secciones %||% list()
  vars <- unique(unlist(lapply(secciones, function(s) if (isTRUE(s$oculto)) NULL else unlist(s$variables))))
  ol <- names(fuente$orders_list %||% list())
  categoricas <- vars[vars %in% ol | vapply(vars, function(v) any(startsWith(names(fuente$data), paste0(v, "/"))), logical(1))]
  for (cr in intersect(cruces, names(fuente$data))) for (v in setdiff(categoricas, cr)) {
    filas[[length(filas) + 1L]] <- list(var = v, cruce = cr, top2box = character(0))
  }
  # Sin duplicados: misma pregunta, cruce y top two box.
  claves <- vapply(filas, function(f) paste(f$var, f$cruce, paste(f$top2box, collapse = "+"), sep = "\r"), character(1))
  filas[!duplicated(claves)]
}

#' Huella de lo que determina la familia
#' @keywords internal
.sig_huella <- function(fuente, regla, combos) {
  cols <- unique(c(unlist(lapply(combos, `[[`, "var")), unlist(lapply(combos, `[[`, "cruce")), regla$conglomerado,
                   regla$estrato))
  cols <- c(cols[cols %in% names(fuente$data)],
            grep(paste0("^(", paste(gsub("([\\W])", "\\\\\\1", cols, perl = TRUE), collapse = "|"), ")[/.]"),
                 names(fuente$data), value = TRUE, perl = TRUE))
  digest::digest(list(fuente$data[, unique(cols), drop = FALSE], regla, combos, fuente$orders_list), algo = "xxhash64")
}

#' Familia de BH del estudio (primera pasada)
#'
#' @return `list(tabla, m, evaluaciones)` con `tabla` de `.sig_bh_tabla()` y las evaluaciones sin ajustar, por clave
#'   «var\\rcruce\\rtop2box», para que la segunda pasada no recalcule.
#' @keywords internal
.sig_familia_estudio <- function(fuente, regla, combos) {
  huella <- .sig_huella(fuente, regla, combos)
  previa <- .sig_cache[[huella]]
  if (!is.null(previa)) return(previa)
  evs <- list()
  p <- list()
  for (cb in combos) {
    ev <- tryCatch(.sig_evaluar_pregunta(fuente, cb$var, cb$cruce, regla, top2box = cb$top2box),
                   error = function(e) NULL)
    clave <- paste(cb$var, cb$cruce, paste(cb$top2box, collapse = "+"), sep = "\r")
    evs[[clave]] <- ev
    if (!is.null(ev)) p[[clave]] <- .sig_p_para_familia(ev)
  }
  todos <- unlist(p, use.names = FALSE)
  out <- list(tabla = .sig_bh_tabla(todos), m = length(todos[is.finite(todos)]), evaluaciones = evs, huella = huella)
  # Una sola familia viva por proceso: la de la última huella.
  rm(list = ls(.sig_cache), envir = .sig_cache)
  assign(huella, out, envir = .sig_cache)
  out
}

#' Contexto completo del informe para un render o un endpoint: regla y familia
#' @keywords internal
.sig_contexto_estudio <- function(data, inst, graficos_config = NULL, analitica_config = NULL) {
  fuente <- .sig_fuente(data, inst)
  rr <- .sig_regla_del_estudio(graficos_config, fuente$data, analitica_config)
  regla <- rr$regla
  familia <- NULL
  if (identical(regla$correccion, "bh_informe")) {
    combos <- .sig_combinaciones_estudio(fuente, graficos_config$plan %||% NULL, analitica_config)
    familia <- .sig_familia_estudio(fuente, regla, combos)
  }
  list(regla = regla, origen = rr$origen, familia = familia$tabla %||% NULL, m = familia$m %||% 0L,
       familia_completa = familia)
}

#' Variables de cruce de Analítica: las de la raíz y las que exporta la tabla de cruces (`cruces$cruces_vars`)
#' @keywords internal
.sig_cruces_de_analitica <- function(analitica_config) {
  nombres <- function(l) vapply(l %||% list(), function(x) as.character(if (is.list(x)) x$name %||% NA else x)[1], character(1))
  out <- unique(c(nombres(analitica_config$cruces_vars), nombres(analitica_config$cruces$cruces_vars)))
  out[!is.na(out) & nzchar(out)]
}
