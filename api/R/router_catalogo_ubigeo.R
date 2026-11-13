# =============================================================================
# Catálogo de ubigeos: búsqueda, cascada y propuesta de papeles
# =============================================================================
# Lectura pura: ningún endpoint guarda ni marca el proyecto.
#
#   GET /api/catalogos/ubigeo/buscar?q=&nivel=&limite=
#       Texto libre normalizado -> lugares con su ruta completa (distrito,
#       provincia, departamento y ubigeo). `nivel`: todos (por defecto),
#       departamento, provincia o distrito.
#   GET /api/catalogos/ubigeo/cascada?departamento=&provincia=
#       Sin parámetros, los departamentos; con departamento, sus provincias;
#       con los dos, sus distritos.
#   GET /api/validacion/v2/reglas_custom/catalogo/proponer  (X-Base-Nombre)
#       Qué columna de la base cumple cada papel, por contenido
#       (reglas_custom_catalogo_proponer.R).
#
# La lógica vive en catalogo_ubigeo.R; aquí solo se valida y se serializa.

.ruta_ubigeo_nivel <- function(nivel) {
  nivel <- trimws(as.character(nivel %||% "todos")[1])
  if (is.na(nivel) || !nzchar(nivel)) nivel <- "todos"
  validos <- c("todos", .CATALOGO_UBIGEO_NIVELES)
  if (!(nivel %in% validos)) {
    stop_api(400, "E_BAD_REQUEST", sprintf("Nivel \"%s\" no existe. Válidos: %s.", nivel, paste(validos, collapse = ", ")))
  }
  nivel
}

.ruta_ubigeo_limite <- function(limite) {
  n <- suppressWarnings(as.integer(as.character(limite %||% "20")[1]))
  if (is.na(n) || n < 1L || n > 200L) stop_api(400, "E_BAD_REQUEST", "El límite va de 1 a 200.")
  n
}

mount_catalogo_ubigeo <- function(pr) {
  pr |>
    plumber::pr_get("/api/catalogos/ubigeo/buscar",
      wrap_endpoint(function(req, res, q = "", nivel = "todos", limite = "20") {
        items <- catalogo_ubigeo_buscar(q, .ruta_ubigeo_nivel(nivel), .ruta_ubigeo_limite(limite))
        list(ok = TRUE, q = as.character(q %||% ""), n = length(items), items = items)
      })) |>
    plumber::pr_get("/api/catalogos/ubigeo/cascada",
      wrap_endpoint(function(req, res, departamento = "", provincia = "") {
        dep <- if (nzchar(trimws(departamento %||% ""))) departamento else NULL
        prov <- if (nzchar(trimws(provincia %||% ""))) provincia else NULL
        if (is.null(dep) && !is.null(prov)) {
          stop_api(400, "E_BAD_REQUEST", "Para listar distritos se pide el departamento y la provincia.")
        }
        c(list(ok = TRUE), catalogo_ubigeo_cascada(dep, prov))
      })) |>
    plumber::pr_get("/api/validacion/v2/reglas_custom/catalogo/proponer",
      wrap_endpoint(function(req, res, catalogo = "ubigeo_peru") {
        sid <- session_header(req)
        reglas_custom_catalogo_proponer(sid, .get_base_nombre(req), catalogo)
      }))
}
