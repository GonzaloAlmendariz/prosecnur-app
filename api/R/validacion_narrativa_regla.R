# =============================================================================
# Validación (M4): una sola narrativa y una sola severidad por regla
# =============================================================================
# El catálogo de reglas (M3, validacion_reglas_catalogo.R) escribe el nombre y
# la frase de cada regla. Hasta M4 la cola de decisiones, el detalle de una
# regla (POST /instrumento/regla) y GET /caso seguían con el nombre del lector
# del formulario ("[edad] Consistencia", con punto medio y comillas angulares), y la cola calculaba su
# propia severidad por porcentaje: una misma regla tenía dos textos y dos
# severidades según la ruta. Aquí se toman del catálogo, por el id del motor
# (`id_motor`, el mismo `source_id` de la cola), nunca por el nombre.
#
# Severidad (`validacion_severidad_regla()`): la que declara la regla, una
# sola para todas las rutas:
#   - propia: la que guardó el equipo (`.regla_severidad()`, "error" si falta);
#   - formulario y operativo: la que le fija el lector del formulario o el
#     control operativo al crear la regla (`rule$severidad`: "error" en casi
#     todas, "advertencia" en registros repetidos de un grupo, periodo de campo
#     y respuestas casi iguales).
#   NA si la regla no está ni en el plan ni en la auditoría: no se inventa.
# La severidad por porcentaje de la cola (>= 20 % de todas las filas = error)
# se retira: mezclaba el tamaño del hallazgo con su gravedad.

#' Severidad de una regla
#'
#' @param rule regla del motor (lista con `severidad`), o NULL.
#' @param propia regla propia del equipo, si lo es.
#' @return "error", "advertencia", "info" o NA.
#' @keywords internal
validacion_severidad_regla <- function(rule = NULL, propia = NULL) {
  if (!is.null(propia)) return(.regla_severidad(propia))
  sev <- as.character((rule %||% list())$severidad %||% NA_character_)[1]
  if (is.na(sev) || !(sev %in% c("error", "advertencia", "info"))) return(NA_character_)
  sev
}

# Severidad por id del motor desde el scope: la regla propia, si no la del plan
# vigente (la misma que lee el catálogo) y, si no está, la de la auditoría.
.validacion_severidad_por_id <- function(scope, ids) {
  propias <- scope$reglas_custom %||% list()
  ids_propias <- vapply(propias, function(r) as.character(r$id %||% ""), character(1))
  reglas <- c(scope$plan_result$bundle$rules %||% list(), scope$evaluacion$bundle$rules %||% list())
  ids_reglas <- vapply(reglas, function(r) as.character(r$id %||% ""), character(1))
  vapply(as.character(ids), function(id) {
    k <- match(id, ids_propias)
    if (!is.na(k)) return(validacion_severidad_regla(propia = propias[[k]]))
    j <- match(id, ids_reglas)
    if (!is.na(j)) return(validacion_severidad_regla(reglas[[j]]))
    NA_character_
  }, character(1), USE.NAMES = FALSE)
}

# --- Índice de la narrativa del catálogo --------------------------------------
# Lo que la cola, el detalle y el caso toman del catálogo, por id del motor.
# Tiene su propia caché, cuya firma no lleva las decisiones ni la evaluación:
# la frase de una regla no depende de ellas, y guardar una decisión no tiene
# por qué volver a escribir todas las frases. Si no hay caché, se lee el
# catálogo (que tiene la suya).

.VNR_CAMPOS <- c("nombre", "frase", "frase_completa", "familia", "familia_nombre",
                 "origen", "clase", "hallazgo_kind", "severidad", "direccion", "pareja",
                 "limites", "tabla", "detalle")

.vnr_firma <- function(sid, base_eff, scope) {
  tryCatch({
    s <- session_get(sid)
    meta_b <- if (!is.null(base_eff)) s$estudio$bases[[base_eff]] else NULL
    archivo <- function(fid) if (is.null(fid)) NULL else .analitica_lectura_file_stamp(get_file(sid, fid))
    digest::digest(list(
      "narrativa", sid, base_eff, archivo(meta_b$xlsform_file_id), s$label_overrides,
      scope$plan_result, scope$reglas_custom, scope$variables_excluidas
    ), algo = "xxhash64")
  }, error = function(e) NULL)
}

#' Narrativa de las reglas de una base, por id del motor
#'
#' @param sid sesión.
#' @param base base (NULL: la activa).
#' @return lista con `por_id` (lista nombrada por id del motor; si dos reglas
#'   comparten id, una entrada por tabla en `por_id_tabla`) o NULL si el
#'   catálogo no se pudo leer (quien la usa lo dice con `en_catalogo = FALSE`).
#' @keywords internal
validacion_narrativa_reglas <- function(sid, base = NULL) {
  if (is.null(sid)) return(NULL)
  base_eff <- tryCatch(.validacion_auditoria_base(sid, base), error = function(e) base)
  scope <- validacion_scope_get(sid, base_eff)
  clave <- .vnr_firma(sid, base_eff, scope)
  hit <- .validacion_reglas_cache_get(clave)
  if (!is.null(hit)) return(hit)
  # Si el catálogo entero ya está en caché, se usa; si no, se arma solo la
  # parte de redacción (sin contar bases): abrir un caso en frío no paga el
  # catálogo completo.
  completo <- .validacion_reglas_cache_get(.vrc_firma(sid, base_eff, scope))
  filas <- if (!is.null(completo)) completo$filas else .vrc_construir(sid, base_eff, scope, con_auditoria = FALSE)$filas
  por_id <- list(); por_id_tabla <- list()
  for (f in filas %||% list()) {
    id <- as.character(f$id_motor %||% NA_character_)[1]
    if (is.na(id) || !nzchar(id)) next
    entrada <- f[intersect(.VNR_CAMPOS, names(f))]
    entrada$id_catalogo <- f$id
    por_id_tabla[[paste(id, f$tabla, sep = "@")]] <- entrada
    if (is.null(por_id[[id]])) por_id[[id]] <- entrada
  }
  .validacion_reglas_cache_put(clave, list(por_id = por_id, por_id_tabla = por_id_tabla))
}

# La entrada de una regla: por id y tabla si se conoce la tabla, si no por id.
.vnr_entrada <- function(narrativa, id, tabla = NULL) {
  if (is.null(narrativa)) return(NULL)
  t <- as.character(tabla %||% NA_character_)[1]
  if (!is.na(t) && nzchar(t)) {
    e <- narrativa$por_id_tabla[[paste(id, t, sep = "@")]]
    if (!is.null(e)) return(e)
  }
  narrativa$por_id[[as.character(id)]]
}

# Campos que gana una regla en la cola, el detalle y el caso. `en_catalogo`
# FALSE (la regla de la auditoría ya no está en el plan, o el catálogo no se
# pudo leer) deja `frase` en null y el nombre del motor: se dice, no se calla.
.vnr_campos_publicos <- function(e) {
  if (is.null(e)) {
    return(list(en_catalogo = FALSE, id_catalogo = NA_character_, frase = NA,
                frase_completa = NA, familia = NA_character_, familia_nombre = NA_character_,
                origen_regla = NA_character_, clase = NA_character_, detalle = NA_character_))
  }
  list(en_catalogo = TRUE, id_catalogo = e$id_catalogo, frase = e$frase,
       frase_completa = isTRUE(e$frase_completa), familia = e$familia,
       familia_nombre = e$familia_nombre, origen_regla = e$origen, clase = e$clase,
       detalle = e$detalle %||% NA_character_)
}

#' La cola con la narrativa y la severidad del catálogo
#'
#' `nombre_regla` pasa a ser el nombre del catálogo; `severidad`, la de la
#' regla (`validacion_severidad_regla()`); se suman `frase`, `familia`,
#' `familia_nombre`, `origen_regla`, `clase`, `id_catalogo` y `en_catalogo`.
#' @keywords internal
validacion_cola_con_narrativa <- function(queue, narrativa, scope) {
  if (!length(queue)) return(queue)
  tablas <- .vnr_tablas_resumen(scope)
  lapply(queue, function(q) {
    id <- as.character(q$source_id)
    e <- .vnr_entrada(narrativa, id, tablas[[id]])
    if (!is.null(e) && !is.null(e$nombre) && !is.na(e$nombre)) q$nombre_regla <- as.character(e$nombre)
    c(q, .vnr_campos_publicos(e))
  })
}

.vnr_tablas_resumen <- function(scope) {
  res <- (scope$evaluacion %||% list())$resumen
  if (!is.data.frame(res) || !nrow(res) || !"tabla" %in% names(res)) return(list())
  stats::setNames(as.list(as.character(res$tabla)), as.character(res$id_regla))
}
