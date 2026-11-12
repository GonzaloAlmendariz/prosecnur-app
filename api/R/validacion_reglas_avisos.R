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
# Umbral: se avisa cuando la condición es indeterminada en al menos el 90 % de
# las filas de la tabla de la regla (`.VRA_UMBRAL_INDETERMINADA`). Con menos, es
# un vacío parcial que el catálogo ya muestra en `n_base_indeterminada` y en el
# aviso `base_indeterminada`; con 90 % o más la regla no revisó prácticamente
# nada y su "0 casos" no significa que la base esté limpia.
#
# La pregunta culpable se busca entre las que compara la condición: la que
# tiene opciones en el formulario y cuyos valores en la base son, en su mayoría,
# rótulos de esas opciones y no sus códigos.

.VRA_UMBRAL_INDETERMINADA <- 0.9

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

# Avisos de condición indeterminada de una evaluación
#
# @param sid sesión. @param base_eff base ya resuelta. @param ev evaluación.
# @param propias reglas propias de la base (para su base, como el conteo previo).
# @return lista de avisos `{codigo, id_regla, pregunta, n_indeterminadas, n_filas, texto}`.
# @keywords internal
validacion_avisos_condicion <- function(sid, base_eff, ev, propias = list()) {
  if (is.null(ev) || !is.data.frame(ev$resumen)) return(list())
  reglas <- .vrb_reglas_evaluadas(ev, propias)
  if (!length(reglas)) return(list())
  bases <- .vrb_bases_cached(ev, reglas,
                             exclusiones = .validacion_mb_collection_exclusions_for_base(sid, base_eff),
                             compat = validation_profile_for_base(base_eff))
  opciones <- (ev$bundle %||% list())$choices_map %||% list()
  out <- list()
  for (r in reglas) {
    b <- bases[[r$id]]
    if (is.null(b) || is.na(b$n_base_indeterminada) || is.na(b$n_filas) || b$n_filas <= 0L) next
    if (b$n_base_indeterminada <= 0L || b$n_base_indeterminada / b$n_filas < .VRA_UMBRAL_INDETERMINADA) next
    cond <- .vrb_condicion(r$rule, r$propia)
    preg <- .vra_pregunta_con_rotulos(cond$ast, ev$datos_tablas[[b$tabla]], opciones)
    unidad <- if (identical(b$tabla, "principal")) "casos" else "registros"
    ctx <- list(etiquetas = character(0), roles = (r$rule$variable_roles %||% list())$labels %||% list())
    texto <- if (!is.na(preg)) {
      sprintf("La base guarda textos donde el formulario espera códigos en la pregunta \"%s\": la condición de la regla no se pudo evaluar en %d de %d %s y la regla no marcó ninguno.",
              .vrf_etiqueta(preg, ctx), b$n_base_indeterminada, b$n_filas, unidad)
    } else {
      sprintf("La condición de la regla no se pudo evaluar en %d de %d %s: la regla no revisó esas filas.",
              b$n_base_indeterminada, b$n_filas, unidad)
    }
    out[[length(out) + 1L]] <- list(codigo = "condicion_indeterminada", id_regla = r$id,
                                    pregunta = preg, n_indeterminadas = b$n_base_indeterminada,
                                    n_filas = b$n_filas, texto = texto)
  }
  out
}
