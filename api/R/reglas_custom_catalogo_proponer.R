# =============================================================================
# "Combinación fuera de catálogo": propuesta de papeles sobre una base
# =============================================================================
# GET /api/validacion/v2/reglas_custom/catalogo/proponer (X-Base-Nombre).
# Lectura: no guarda nada ni marca el proyecto. Lee la base pedida con la misma
# lectura que la auditoría (la del conteo previo, reglas_custom_probar.R) y
# propone qué columna cumple cada papel mirando el contenido
# (`catalogo_ubigeo_proponer_roles()`). La base es la de la cabecera; sin
# cabecera, la activa. Nunca cae en la primera base por compatibilidad.
#
# Cifras: `columnas[].parte` es, por columna, la parte de sus valores no vacíos
# (base: valores no vacíos de esa columna en las filas que evalúa la
# auditoría) que casa con cada nivel del catálogo, de 0 a 1.

#' Propuesta de papeles de catálogo para una base de la sesión
#' @param sid sesión.
#' @param base base pedida (NULL = activa). Solo lectura.
#' @param catalogo id del catálogo.
#' @return lista con `estado` ("propuesta" o "sin_datos"), `base_nombre`,
#'   `catalogo`, `propuesta`, `propuestas`, `columnas` y `n_filas`.
#' @keywords internal
reglas_custom_catalogo_proponer <- function(sid, base = NULL, catalogo = "ubigeo_peru") {
  cat <- catalogo_ubigeo_cargar(catalogo)
  base_eff <- .validacion_auditoria_base(sid, base)
  scope <- .get_base_scope(sid, base_eff)
  vacio <- list(ok = TRUE, estado = "sin_datos", base_nombre = base_eff %||% NA_character_,
                catalogo = cat$id, catalogo_nombre = cat$nombre, n_filas = 0L,
                propuesta = stats::setNames(as.list(rep(NA_character_, 4L)), .CATALOGO_UBIGEO_ROLES),
                propuestas = list(), columnas = list())
  files <- .probar_archivos(sid, base_eff)
  if (is.null(files)) return(vacio)
  inst <- leer_xlsform_limpieza(files$xlsform$path, verbose = FALSE)
  datos <- .validacion_auditoria_leer_datos(
    files$data$path, files$data_ext, inst,
    repeat_children = .validacion_resolve_repeat_children(sid, base_eff),
    operational_config = scope$operational_config %||% NULL
  )
  principal <- as.data.frame(datos$principal %||% data.frame(), check.names = FALSE)
  if (!nrow(principal)) return(vacio)
  principal <- .limpieza_sin_columnas_internas(principal)
  pr <- catalogo_ubigeo_proponer_roles(principal, cat)
  # Asignación directa: `modifyList()` fusionaría las listas sin nombre.
  out <- vacio
  out$estado <- "propuesta"
  out$n_filas <- nrow(principal)
  out$propuesta <- pr$propuesta
  out$propuestas <- pr$propuestas
  out$columnas <- pr$columnas
  out
}
