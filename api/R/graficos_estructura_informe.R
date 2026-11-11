# =============================================================================
# graficos_estructura_informe.R — secciones y preguntas del informe para la pestaña Plantillas
# =============================================================================
#
# La pestaña Plantillas muestra, en el orden del cuestionario, cada sección con sus preguntas: si entran al informe,
# cuántas láminas suman, su tipo y el gráfico con que salen (checklist-pestana-plantillas-2026-11-11, ítems 3 y 4).
#
# La estructura se lee del mismo plan sugerido que después crea las láminas, armado SIN las exclusiones del analista:
# así cada pregunta aparece en la sección donde el plan la pondría (con los grupos repetibles ya ubicados en su
# sección) y con sus láminas reales (una lista larga paginada suma más de una), también las que hoy están fuera.

#' ¿La opción es residual (otro, no sabe, no responde, ninguno, no aplica)? El detector del motor más las fórmulas que
#' no reconoce ("Prefiere no responder")
#' @keywords internal
.graficos_rotulo_residual <- function(etiquetas) {
  et <- as.character(etiquetas %||% character(0))
  propio <- grepl("^(otr[oa]s?\\b|no sab|no s[eé]\\b|ningun[oa]|prefier[eo] no|no respond|no aplica)", et, ignore.case = TRUE, perl = TRUE)
  !is.na(et) & (propio | .graficos_no_sustantivos_rotulo(et))
}

#' Tipo de pregunta en palabras del analista
#' @keywords internal
.graficos_tipo_de_pregunta <- function(v) {
  tipo <- .graficos_base_type(v$tipo %||% "")
  if (identical(tipo, "select_multiple")) return("Opción múltiple")
  et <- vapply(v$choices %||% list(), function(x) .graficos_scalar_chr((x %||% list())$label %||% (x %||% list())$name, ""), "")
  # Las respuestas de no respuesta no cambian el tipo: "Sí, No, No sabe, Prefiere no responder" sigue siendo Sí / No.
  et <- et[nzchar(et) & !.graficos_rotulo_residual(et)]
  if (length(et) == 2L) return("Sí / No")
  if (length(et) >= 3L && length(et) <= 7L && .goc_pistas_orden(et) && !any(grepl("[0-9]", et))) return("Escala")
  if (tipo %in% c("integer", "decimal")) return("Numérica")
  "Opción única"
}

#' Gráficos que se ofrecen para un tipo de pregunta (la primera es la de la plantilla)
#' @keywords internal
.graficos_opciones_de_grafico <- function(tipo, n_opciones = NA_integer_) {
  # Una escala y una dicotomía conservan su orden: ordenarlas por frecuencia desarma la escala. La torta sólo para
  # dos opciones (más la no respuesta) y las columnas hasta seis: con más, los rótulos del eje no se leen. La barra al
  # 100 % sólo para una escala o una dicotomía: en opción múltiple las opciones no suman 100 % y con una lista larga
  # los segmentos no se leen.
  opciones <- switch(tipo,
    "Sí / No" = c("barras", "torta", "barra_100", "barras_verticales"),
    "Escala" = c("barras", "barra_100", "barras_verticales"),
    "Opción múltiple" = c("barras_ordenadas", "barras"),
    c("barras", "barras_ordenadas", "barras_verticales")
  )
  n <- suppressWarnings(as.integer(n_opciones)[1])
  if (!is.na(n) && n > 6L) opciones <- setdiff(opciones, "barras_verticales")
  opciones
}

#' Opciones de respuesta de una pregunta, residuales incluidas (lo que dibujan columnas y torta)
#' @keywords internal
.graficos_n_opciones <- function(v) length(v$choices %||% list())

#' Referencias de pregunta que dibuja una lámina (un gráfico, dos, o una batería)
#' @keywords internal
.graficos_refs_de_lamina <- function(s) {
  p <- s$payload %||% list()
  grafs <- Filter(Negate(is.null), list(p$grafico, p$izquierda, p$derecha))
  unique(unlist(lapply(grafs, function(g) {
    a <- g$args %||% list()
    c(.graficos_scalar_chr(a$var, ""), unlist(a$vars %||% list(), use.names = FALSE))
  }), use.names = FALSE))
}

#' Estructura del informe: secciones con sus preguntas, dentro o fuera, con láminas, tipo y gráfico
#'
#' @param sid Sesión.
#' @param config Config de Gráficos con la plantilla elegida (`profile_id`, `acnur_mode`…) y `scope_rules`.
#' @return `list(ok, perfil, laminas_fijas, secciones = list(list(titulo, preguntas = list(...))))`.
#' @keywords internal
.graficos_estructura_informe <- function(sid, config = NULL) {
  cfg <- config %||% list()
  excluidas <- .graficos_coverage_exclusions(cfg)
  elegidos <- .graficos_grafico_por_pregunta(cfg)
  sin_exclusiones <- cfg
  sin_exclusiones$scope_rules <- (cfg$scope_rules %||% list())
  sin_exclusiones$scope_rules$coverage_exclusions <- list()
  sin_exclusiones$scope_rules$coverageExclusions <- NULL
  sin_exclusiones$scope_rules$grafico_por_pregunta <- NULL
  propuesta <- .graficos_suggested_plan(sid, sin_exclusiones)
  if (!isTRUE(propuesta$ok)) return(propuesta)

  indice_excl <- .graficos_ref_indice(excluidas)
  principal <- .graficos_scalar_chr((((propuesta$coverage %||% list())$sources %||% list())[[1]] %||% list())$name, "default")
  vars <- list()
  for (src in (propuesta$coverage %||% list())$sources %||% list()) {
    fuente <- .graficos_scalar_chr(src$name, "default")
    for (v in src$variables %||% list()) {
      nombre <- .graficos_scalar_chr(v$name, "")
      ref <- if (identical(fuente, "default")) nombre else paste0(fuente, "$", nombre)
      vars[[ref]] <- v
      if (identical(fuente, "default") || !nzchar(nombre)) next
      if (is.null(vars[[nombre]])) vars[[nombre]] <- v   # la referencia del plan puede venir sin la fuente principal
    }
  }

  secciones <- list(); actual <- 0L; fijas <- 0L
  nueva <- function(titulo) { secciones[[length(secciones) + 1L]] <<- list(titulo = titulo, preguntas = list()); length(secciones) }
  for (s in propuesta$plan$slides %||% list()) {
    if (identical(s$tipo, "p_slide_seccion")) { actual <- nueva(.graficos_scalar_chr(s$payload$titulo, "")); next }
    refs <- .graficos_refs_de_lamina(s)
    refs <- refs[nzchar(refs)]
    if (!length(refs)) { fijas <- fijas + 1L; next }
    if (actual == 0L) actual <- nueva("Sin sección")
    for (ref in refs) {
      qs <- secciones[[actual]]$preguntas
      if (!is.null(qs[[ref]])) { secciones[[actual]]$preguntas[[ref]]$laminas <- qs[[ref]]$laminas + 1L; next }
      partes <- .graficos_ref_parts(ref)
      if (!nzchar(partes$source)) partes$source <- "default"
      v <- vars[[ref]] %||% vars[[partes$name]] %||% list()
      tipo <- .graficos_tipo_de_pregunta(v)
      opciones <- .graficos_opciones_de_grafico(tipo, .graficos_n_opciones(v))
      secciones[[actual]]$preguntas[[ref]] <- list(
        ref = ref,
        etiqueta = .graficos_scalar_chr(s$payload$titulo, "") %||% .graficos_scalar_chr(v$label, ref),
        tipo = tipo,
        laminas = 1L,
        dentro = !.graficos_is_var_ref_in(indice_excl, partes$source %||% "default", partes$name),
        grafico = if (!is.null(elegidos[[ref]]) && elegidos[[ref]] %in% opciones) elegidos[[ref]] else opciones[[1]],
        graficos_posibles = as.list(opciones),
        por_registro = nzchar(partes$source) && !identical(partes$source, principal)   # pregunta de un grupo repetible
      )
    }
  }
  secciones <- lapply(secciones, function(x) { x$preguntas <- unname(x$preguntas); x })
  secciones <- Filter(function(x) length(x$preguntas) > 0L, secciones)
  list(
    ok = TRUE,
    perfil = .graficos_scalar_chr(propuesta$profile_id, ""),
    laminas_fijas = fijas,
    secciones = secciones,
    avisos = propuesta$warnings %||% list()
  )
}
