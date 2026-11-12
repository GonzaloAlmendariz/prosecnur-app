# =============================================================================
# Limpieza (M4): efecto previsto de una decisión, sin guardarla
# =============================================================================
# POST /api/validacion/v2/limpieza/decision/efecto. El cuerpo es el mismo de
# POST /limpieza/decision (el borrador que la pantalla tiene en la columna
# "Decisión"). Responde qué pasaría si se guardara lista, sin tocar la sesión:
#
#   accion, variable          la acción y la pregunta que cambia.
#   n_filas                   filas que la decisión toca: las que excluye o las
#                             que tienen al menos una celda que cambia.
#   n_celdas                  celdas que cambian (0 al excluir o ignorar).
#   n_casos_cuentan_antes     casos que cuentan con las demás decisiones listas.
#   n_casos_cuentan_despues   casos que cuentan si se guarda esta.
#   aplicable, motivo_no_aplicable  como en `decision_draft`.
#   alcance                   "caso" o "encuestado" (regla de un grupo
#                             repetido: la exclusión saca al encuestado entero,
#                             D-F3).
#   seguimiento, casos_nuevos, casos_que_ya_no_marca, n_casos_aplicados  como
#                             en `decision_draft` (limpieza_alcance_decision.R).
#
# Base de las cifras: la tabla principal de la última auditoría, es decir, los
# casos evaluados (universo del estudio; los casos fuera del universo no están
# en ella y no cuentan). Nivel: fila de esa tabla, un caso. "Cuentan" son las
# filas que no salen por una exclusión lista.
#
# Se mide aplicando las decisiones con el mismo motor que la limpieza
# (`.limpieza_apply_decisions_to_data()`), dos veces: con las demás decisiones
# listas y con esas más esta. La diferencia entre las dos bases es el efecto:
# por construcción, el efecto previsto es el que tendrá al aplicarse.

#' Efecto previsto de una decisión de limpieza
#'
#' @param sid sesión.
#' @param base base (NULL: la activa).
#' @param payload cuerpo de la decisión (lista, como POST /limpieza/decision).
#' @return lista con el efecto (ver encabezado del archivo).
#' @keywords internal
limpieza_efecto_previsto <- function(sid, base, payload) {
  scope <- validacion_scope_get(sid, base)
  if (is.null(scope$evaluacion)) {
    stop_api(409, "E_NO_AUDITORIA",
             "Esta base no tiene auditoría: el efecto de una decisión se mide sobre la última auditoría.")
  }
  if (!is.list(payload)) stop_api(400, "E_BAD_JSON", "El cuerpo debe ser un objeto JSON con la decisión.")
  # Se mide como si se guardara lista. El motivo no cambia el efecto: si falta,
  # no se exige aquí (sí al guardarla).
  payload$status <- "ready"
  if (!nzchar(trimws(as.character(payload$rationale %||% "")[1]))) payload$rationale <- "efecto previsto"
  existentes <- scope$limpieza_draft %||% list()
  up <- .limpieza_upsert_decision(existentes, payload, scope = scope)
  d <- up$decision
  otras <- Filter(function(x) identical(as.character(x$status %||% ""), "ready") &&
                    !identical(as.character(x$id %||% ""), as.character(d$id)), existentes)

  principal <- .limpieza_tabla_auditada(scope, "principal")
  medida <- .limpieza_efecto_medir(principal, scope, otras, d)
  apl <- .limpieza_aplicabilidad(d, scope)
  seg <- limpieza_seguimiento_decision(d, scope)
  list(
    ok = TRUE,
    base_nombre = .validacion_auditoria_base(sid, base) %||% NA_character_,
    accion = d$action_type,
    variable = as.character(d$target_variable %||% NA_character_),
    n_filas = medida$n_filas,
    n_celdas = medida$n_celdas,
    n_casos_cuentan_antes = medida$antes,
    n_casos_cuentan_despues = medida$despues,
    aplicable = isTRUE(apl$aplicable),
    motivo_no_aplicable = if (isTRUE(apl$aplicable)) NA_character_ else apl$motivo,
    texto_no_aplicable = if (isTRUE(apl$aplicable)) NA_character_ else .limpieza_texto_no_aplicable(apl$motivo),
    alcance = seg$alcance,
    seguimiento = seg$seguimiento,
    n_casos_al_decidir = seg$n_casos_al_decidir,
    casos_nuevos = seg$casos_nuevos,
    casos_que_ya_no_marca = seg$casos_que_ya_no_marca,
    n_casos_aplicados = seg$n_casos_aplicados,
    base_cifras = "casos evaluados en la última auditoría"
  )
}

# Aplica `otras` y `otras + d` sobre la tabla auditada y compara, fila por fila
# (por una columna de posición que la limpieza no toca), las dos bases.
.limpieza_efecto_medir <- function(df, scope, otras, d) {
  if (!is.data.frame(df)) return(list(n_filas = 0L, n_celdas = 0L, antes = 0L, despues = 0L))
  col <- ".__efecto_fila__"
  while (col %in% names(df)) col <- paste0(col, "_")
  df[[col]] <- seq_len(nrow(df))
  a <- .limpieza_apply_decisions_to_data(df, scope, otras)$data
  b <- .limpieza_apply_decisions_to_data(df, scope, c(otras, list(d)))$data
  quedan <- intersect(a[[col]], b[[col]])
  ia <- match(quedan, a[[col]]); ib <- match(quedan, b[[col]])
  vars <- setdiff(intersect(names(a), names(b)), col)
  cambia <- matrix(FALSE, nrow = length(quedan), ncol = length(vars))
  for (j in seq_along(vars)) {
    x <- .limpieza_efecto_texto(a[[vars[j]]][ia]); y <- .limpieza_efecto_texto(b[[vars[j]]][ib])
    cambia[, j] <- !(x == y | (is.na(x) & is.na(y))) | xor(is.na(x), is.na(y))
    cambia[is.na(cambia[, j]), j] <- TRUE
  }
  excluidas <- length(setdiff(a[[col]], b[[col]]))
  list(n_filas = as.integer(excluidas + sum(rowSums(cambia) > 0L)),
       n_celdas = as.integer(sum(cambia)),
       antes = as.integer(nrow(a)), despues = as.integer(nrow(b)))
}

.limpieza_efecto_texto <- function(x) {
  if (inherits(x, c("Date", "POSIXct"))) x <- format(x)
  if (inherits(x, "haven_labelled")) x <- unclass(x)
  v <- as.character(x)
  v[!is.na(v) & !nzchar(trimws(v))] <- NA_character_
  v
}
