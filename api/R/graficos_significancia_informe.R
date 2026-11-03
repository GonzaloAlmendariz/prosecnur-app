# Diferencias por lámina y del informe, para la UI (ADR 0126 §5)
# ==============================================================
#
# Lo que el inspector, la capa «Por qué» y la revisión en lote leen. Usa la misma evaluación que el render y la tabla
# (`.sig_evaluar_pregunta` + `.sig_veredictos` contra la familia del estudio), así que la UI explica exactamente las
# marcas que el PPT dibuja. El router (router_graficos_diferencias.R) solo valida y serializa.

#' Lámina del plan por id
#' @keywords internal
.sig_slide_por_id <- function(plan, slide_id) {
  slides <- if (is.list(plan)) plan$slides %||% plan else list()
  for (s in slides) if (identical(as.character(s$id %||% "")[1], as.character(slide_id)[1])) return(s)
  NULL
}

#' Pares de una evaluación con veredicto, en la forma del contrato (porcentajes y puntos enteros)
#' @keywords internal
.sig_pares_json <- function(ev) {
  p <- ev$pares
  if (is.null(p) || !nrow(p)) return(list())
  letra <- function(x) ifelse(x == ".resto", "resto", unname(ev$letras[x]))
  lapply(seq_len(nrow(p)), function(i) list(
    fila = p$fila[i], a = letra(p$a[i]), b = letra(p$b[i]),
    p_a = round(100 * p$p_a[i]), p_b = round(100 * p$p_b[i]), dif = round(100 * p$dif[i]),
    p = if (is.finite(p$p[i])) signif(p$p[i], 3) else NA,
    p_ajustado = if (is.finite(p$p_ajustado[i])) signif(p$p_ajustado[i], 3) else NA,
    deff = if (is.finite(p$deff[i])) round(p$deff[i], 2) else NA,
    ic = if (is.finite(p$ic_lo[i])) round(100 * c(p$ic_lo[i], p$ic_hi[i])) else NA,
    n_a = p$n_a[i], n_b = p$n_b[i],
    veredicto = p$veredicto[i], redaccion = if (is.na(p$redaccion[i])) NA else p$redaccion[i]
  ))
}

#' Grupos de una evaluación, en la forma del contrato
#' @keywords internal
.sig_grupos_json <- function(ev) {
  g <- ev$grupos
  if (is.null(g) || !nrow(g)) return(list())
  lapply(seq_len(nrow(g)), function(i) list(
    letra = g$letra[i], codigo = g$codigo[i], etiqueta = g$etiqueta[i], n = g$n[i],
    conglomerados = g$conglomerados[i], comparable = isTRUE(g$comparable[i]),
    motivo = if (is.na(g$motivo[i])) NA else g$motivo[i]
  ))
}

#' Qué conviene revisar en una lámina (filtro «Para revisar» de U4)
#' @keywords internal
.sig_revisar <- function(ev, titulo = "") {
  out <- character(0)
  if (is.null(ev) || is.null(ev$pares)) return("sin_prueba")
  v <- ev$pares$veredicto
  afirma <- grepl("\\b(m[aá]s|menos|mayor|menor|supera|duplica|triplica)\\b", titulo %||% "", ignore.case = TRUE)
  if (any(v == "fragil") && !any(v == "marcada") && afirma) out <- c(out, "titulo_afirma_fragil")
  if (!any(v %in% c("marcada", "fragil"))) out <- c(out, "sin_diferencias")
  if (any(v == "bajo_umbral")) out <- c(out, "bajo_umbral")
  if (!is.null(ev$grupos) && any(!ev$grupos$comparable)) out <- c(out, "base_chica")
  out
}

#' Una lámina, en la forma del contrato
#' @param ctx Contexto de `.sig_contexto_estudio()`.
#' @keywords internal
.sig_lamina_json <- function(slide, fuente, ctx) {
  titulo <- as.character(slide$payload$titulo %||% "")[1]
  # NA y no NULL: el serializador de la API escribe `null` para NA y `{}` para NULL.
  base <- list(slide_id = as.character(slide$id %||% "")[1], titulo = titulo, estado = "sin_cruce", activo = FALSE,
               motivo = NA, error = NA, variable = NA, cruce = NA, modo_letras = "letras",
               grupos = list(), pares = list(), nota = NA, revisar = list())
  l <- .sig_lamina_del_plan(slide)
  if (is.null(l)) return(base)
  base$variable <- l$var; base$cruce <- l$cruce; base$activo <- isTRUE(l$activo)
  diseno <- .graficos_sig_diseno_de_fuente(list(survey = fuente$survey, survey_raw = fuente$survey), l$var)
  if (identical(diseno, "cluster")) {
    base$estado <- "abstencion"
    base$motivo <- .sig_texto_abstencion("repeat")
    base$nota <- base$motivo
    return(base)
  }
  clave <- paste(l$var, l$cruce, paste(l$top2box, collapse = "+"), sep = "\r")
  ev <- ctx$familia_completa$evaluaciones[[clave]]
  res <- tryCatch({
    if (is.null(ev)) ev <- .sig_evaluar_pregunta(fuente, l$var, l$cruce, ctx$regla, top2box = l$top2box)
    if (is.null(ev)) NULL else .sig_veredictos(ev, ctx$regla, ctx$familia)
  }, error = function(e) e)
  if (inherits(res, "error")) {
    error_id <- substr(digest::digest(list(Sys.time(), base$slide_id), algo = "xxhash32"), 1, 8)
    message(sprintf("[E_SIG_PRUEBA_FALLO] error_id=%s lámina=%s: %s", error_id, base$slide_id, conditionMessage(res)))
    base$estado <- "error"
    base$error <- list(code = "E_SIG_PRUEBA_FALLO", message = "La prueba no pudo ejecutarse en esta lámina.",
                       error_id = error_id)
    base$revisar <- list("sin_prueba")
    return(base)
  }
  if (is.null(res) || is.null(res$pares)) {
    base$estado <- "sin_cruce"
    base$motivo <- "El cruce no tiene al menos dos grupos con datos."
    base$revisar <- list("sin_prueba")
    return(base)
  }
  base$estado <- .sig_estado(res)
  base$modo_letras <- res$modo
  base$grupos <- .sig_grupos_json(res)
  base$pares <- .sig_pares_json(res)
  base$nota <- .sig_nota_de_evaluacion(res, ctx$regla, niveles = grepl("nivel", l$cruce, ignore.case = TRUE))
  base$revisar <- as.list(.sig_revisar(res, titulo))
  base
}

#' Resumen del informe para U4
#' @keywords internal
.sig_resumen <- function(laminas, m) {
  conteo <- function(f) sum(vapply(laminas, f, numeric(1)))
  v <- function(l) vapply(l$pares, function(p) p$veredicto, character(1))
  list(
    cruces = sum(vapply(laminas, function(l) !identical(l$estado, "sin_cruce"), logical(1))),
    marcadas = conteo(function(l) sum(v(l) == "marcada")),
    fragiles = conteo(function(l) sum(v(l) == "fragil")),
    ninguna = sum(vapply(laminas, function(l) identical(l$estado, "ninguna"), logical(1))),
    bases_chicas = sum(vapply(laminas, function(l) "base_chica" %in% unlist(l$revisar), logical(1))),
    sin_prueba = sum(vapply(laminas, function(l) l$estado %in% c("error", "abstencion"), logical(1))),
    familia = as.integer(m %||% 0L)
  )
}

#' Todas las láminas con cruce del informe
#' @keywords internal
.sig_informe_json <- function(plan, fuente, ctx) {
  slides <- if (is.list(plan)) plan$slides %||% plan else list()
  laminas <- list()
  for (s in slides) {
    if (is.null(.sig_lamina_del_plan(s))) next
    laminas[[length(laminas) + 1L]] <- .sig_lamina_json(s, fuente, ctx)
  }
  list(laminas = laminas, resumen = .sig_resumen(laminas, ctx$m))
}

# --- Tablas de cruces: letras con la regla y cuántas celdas cambian (D1) -----------------------------------------

#' Regla de las tablas de siempre: z, Bonferroni por fila, sin umbral ni base mínima
#' @keywords internal
.sig_regla_legado <- function() {
  r <- .sig_regla_fabrica()
  r$prueba <- "z"; r$correccion <- "bonferroni_fila"; r$umbral_puntos <- 0; r$base_minima <- 1
  r$conglomerados_minimos <- 0L; r$incluir_ns <- TRUE; r$max_letras <- 26L; r$fragiles <- "contorno"
  r
}

#' Letras de una tabla (filas × grupos) bajo una regla. En la tabla se marcan las dos filas de una dicotómica
#' @keywords internal
.sig_letras_tabla <- function(fuente, var, cruce, regla, familia = NULL) {
  ev <- .sig_evaluar_pregunta(fuente, var, cruce, regla, solo_principal = FALSE)
  if (is.null(ev) || is.null(ev$pares)) return(NULL)
  ev <- .sig_veredictos(ev, regla, familia)
  filas <- unique(ev$celdas$fila)
  M <- matrix("", length(filas), length(ev$letras), dimnames = list(filas, names(ev$letras)))
  if (!is.null(ev$marcas)) for (k in seq_len(nrow(ev$marcas))) {
    M[ev$marcas$fila[k], ev$marcas$grupo[k]] <- paste0(ev$marcas$flecha[k], ev$marcas$letras[k])
  }
  M
}

#' Cuántas celdas de las tablas de cruces cambian de letras al pasar de la regla de siempre a `regla`
#' @keywords internal
.sig_cambios_tablas <- function(fuente, regla, familia, analitica_config) {
  cruces <- vapply(analitica_config$cruces_vars %||% list(), function(x) as.character(x$name %||% x)[1], character(1))
  cruces <- intersect(cruces, names(fuente$data))
  combos <- Filter(function(cb) cb$cruce %in% cruces && !length(cb$top2box),
                   .sig_combinaciones_estudio(fuente, NULL, analitica_config))
  legado <- .sig_regla_legado()
  total <- 0L; cambian <- 0L; ganan <- 0L; pierden <- 0L
  for (cb in combos) {
    nuevo <- tryCatch(.sig_letras_tabla(fuente, cb$var, cb$cruce, regla, familia), error = function(e) NULL)
    viejo <- tryCatch(.sig_letras_tabla(fuente, cb$var, cb$cruce, legado, NULL), error = function(e) NULL)
    if (is.null(nuevo) || is.null(viejo)) next
    f <- intersect(rownames(nuevo), rownames(viejo)); g <- intersect(colnames(nuevo), colnames(viejo))
    a <- gsub("[▲△▼▽]", "", viejo[f, g, drop = FALSE]); b <- gsub("[▲△▼▽]", "", nuevo[f, g, drop = FALSE])
    total <- total + length(a)
    cambian <- cambian + sum(a != b)
    ganan <- ganan + sum(!nzchar(a) & nzchar(b))
    pierden <- pierden + sum(nzchar(a) & !nzchar(b))
  }
  list(celdas_total = total, celdas_cambian = cambian, ganan_marca = ganan, pierden_marca = pierden,
       cambian_letras = cambian - ganan - pierden)
}

#' Regla lista para el JSON: las columnas sin declarar van como `null`
#' @keywords internal
.sig_regla_json <- function(regla) {
  if (!is.list(regla)) return(regla)
  for (k in c("conglomerado", "estrato")) if (is.null(regla[[k]])) regla[k] <- list(NA)
  regla
}
