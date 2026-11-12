# =============================================================================
# Avisos de la auditoría: reglas cuya condición no se pudo evaluar
# =============================================================================
# Defecto previo del evaluador (no se cambia aquí): si la base guarda la
# etiqueta de una opción ("Sí") y el formulario compara con su código ('1'), la
# condición de la regla sale NA en todas las filas, la regla reporta 0 casos y
# queda "correcta". Este archivo no cambia cómo se evalúa: hace que la auditoría
# lo diga.
#
# Cálculo: el mismo `n_base_indeterminada` del catálogo (validacion_reglas_base.R),
# sobre las filas que auditó la última auditoría.
#
# Umbrales (decisión del lead), sobre las filas que la regla debía revisar: 90 %
# o más, la regla no revisó prácticamente nada (`condicion_indeterminada`);
# de 10 % a 90 %, su conteo puede quedarse corto (`cuenta_incompleta`).
#
# La pregunta culpable se busca entre las que compara la condición: la que
# tiene opciones en el formulario y cuyos valores en la base son, en su mayoría,
# rótulos de esas opciones y no sus códigos.

.VRA_UMBRAL_INDETERMINADA <- 0.9
.VRA_UMBRAL_INCOMPLETA <- 0.1

.vra_pregunta_con_rotulos <- function(cond_ast, datos, opciones) {
  if (is.null(cond_ast) || !is.data.frame(datos)) return(NA_character_)
  vars <- unique(vapply(.ast_positive_equality_literals(cond_ast), function(l) as.character(l$var)[1], character(1)))
  for (v in vars) {
    ops <- opciones[[v]]
    if (is.null(ops) || !length(ops) || !(v %in% names(datos))) next
    obs <- trimws(as.character(datos[[v]]))
    obs <- obs[!is.na(obs) & nzchar(obs)]
    if (!length(obs)) next
    codigos <- names(ops)
    rotulos <- trimws(as.character(unlist(ops)))
    if (mean(obs %in% rotulos & !(obs %in% codigos)) >= 0.5) return(v)
  }
  NA_character_
}

# Una pregunta comparada con otra en la regla (para nombrar la causa).
.vra_par_comparado <- function(ast) {
  if (!is_ast(ast)) return(NULL)
  if (identical(ast_op(ast), "compare_vars")) return(c(as.character(ast$var_a), as.character(ast$var_b)))
  for (h in c(ast$args %||% list(), if (is_ast(ast$arg)) list(ast$arg) else list())) {
    r <- .vra_par_comparado(h)
    if (!is.null(r)) return(r)
  }
  NULL
}

.vra_cuenta <- function(n, unidad) {
  sprintf("%d %s", n, if (n == 1L) sub("s$", "", unidad) else unidad)
}

# Avisos de regla que no se pudo evaluar en parte o en todo de lo que debía
# revisar. Denominador (decisión del lead): las filas donde la regla podía
# evaluarse, es decir su base más las filas donde la condición de la base salió
# indeterminada. Indeterminadas: lo mayor entre las de la condición de la base y
# las filas donde la marca de la regla quedó NA (lo que la regla compara no se
# pudo decidir: texto contra número, por ejemplo). Con 90 % o más,
# `condicion_indeterminada`; entre 10 % y 90 %, `cuenta_incompleta`.
#
# @return lista de avisos `{codigo, id_regla, pregunta, n_indeterminadas,
#   n_a_revisar, n_casos, texto}`.
# @keywords internal
validacion_avisos_condicion <- function(sid, base_eff, ev, propias = list()) {
  if (is.null(ev) || !is.data.frame(ev$resumen)) return(list())
  reglas <- .vrb_reglas_evaluadas(ev, propias)
  if (!length(reglas)) return(list())
  # Una vez por evaluación: el estado de la auditoría lo pide seguido.
  clave <- tryCatch(digest::digest(list("avisos", sid, base_eff, .vrb_huella_evaluacion(ev), propias,
                                        .validacion_mb_collection_exclusions_for_base(sid, base_eff),
                                        (session_get(sid) %||% list())$label_overrides), algo = "xxhash64"),
                    # Sin firma se calcula sin caché: la caché es una optimización.
                    error = function(e) NULL)
  hit <- .validacion_reglas_cache_get(clave)
  if (!is.null(hit)) return(hit$avisos)
  # Etiquetas del formulario para nombrar las preguntas (sin formulario, las
  # de los papeles de la regla).
  etiquetas <- .vrf_contexto(.vrc_instrumento(sid, base_eff)$inst)$etiquetas
  out <- .vra_avisos(sid, base_eff, ev, reglas, etiquetas)
  .validacion_reglas_cache_put(clave, list(avisos = out))
  out
}

.vra_avisos <- function(sid, base_eff, ev, reglas, etiquetas) {
  bases <- .vrb_bases_cached(ev, reglas,
                             exclusiones = .validacion_mb_collection_exclusions_for_base(sid, base_eff),
                             compat = validation_profile_for_base(base_eff), sid = sid, base = base_eff)
  opciones <- (ev$bundle %||% list())$choices_map %||% list()
  res <- ev$resumen
  out <- list()
  for (r in reglas) {
    b <- bases[[r$id]]
    if (is.null(b) || is.na(b$n_base)) next
    ind_base <- if (is.na(b$n_base_indeterminada)) 0L else b$n_base_indeterminada
    ind <- max(ind_base, if (is.na(b$n_casos_indeterminados %||% NA)) 0L else b$n_casos_indeterminados)
    a_revisar <- b$n_base + ind_base
    if (ind <= 0L || a_revisar <= 0L) next
    prop <- ind / a_revisar
    if (prop < .VRA_UMBRAL_INCOMPLETA) next
    n_casos <- as.integer(res$n_inconsistencias[match(r$id, as.character(res$id_regla))])
    if (is.na(n_casos)) n_casos <- 0L
    unidad <- if (identical(b$tabla, "principal")) "casos" else "registros"
    ctx <- list(etiquetas = etiquetas, roles = (r$rule$variable_roles %||% list())$labels %||% list())
    cond <- .vrb_condicion(r$rule, r$propia)
    preg <- .vra_pregunta_con_rotulos(cond$ast, ev$datos_tablas[[b$tabla]], opciones)
    if (is.na(preg)) preg <- .vra_pregunta_con_rotulos(r$rule$predicate, ev$datos_tablas[[b$tabla]], opciones)
    par <- .vra_par_comparado(r$rule$predicate)
    causa <- if (!is.na(preg)) {
      sprintf("La base guarda textos donde el formulario espera códigos en la pregunta \"%s\": ", .vrf_etiqueta(preg, ctx))
    } else if (!is.null(par)) {
      sprintf("La regla compara \"%s\" con \"%s\", que no tienen el mismo tipo de valor (número, fecha o texto): ",
              .vrf_etiqueta(par[1], ctx), .vrf_etiqueta(par[2], ctx))
    } else ""
    hecho <- sprintf("la regla no se pudo evaluar en %d de %s que debía revisar", ind, .vra_cuenta(a_revisar, unidad))
    completo <- prop >= .VRA_UMBRAL_INDETERMINADA
    cierre <- if (completo) {
      if (n_casos == 0L) " y no marcó ninguno." else sprintf(" y marcó %s.", .vra_cuenta(n_casos, unidad))
    } else sprintf("; su conteo de %s puede quedarse corto.", .vra_cuenta(n_casos, unidad))
    texto <- paste0(causa, hecho, cierre)
    texto <- paste0(toupper(substr(texto, 1L, 1L)), substr(texto, 2L, nchar(texto)))
    out[[length(out) + 1L]] <- list(
      codigo = if (completo) "condicion_indeterminada" else "cuenta_incompleta",
      id_regla = r$id, pregunta = preg, n_indeterminadas = ind, n_a_revisar = a_revisar,
      n_casos = n_casos, n_filas = b$n_filas, texto = texto)
  }
  out
}
