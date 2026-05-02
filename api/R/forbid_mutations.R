# Filtro de seguridad para deploy web (modo público).
#
# Cuando `PULSO_PUBLIC_MODE=1` (lo activa `launch_server.R` antes de
# construir el plumber app), se inserta un filtro que actúa como una
# whitelist: solo deja pasar los endpoints estrictamente necesarios
# para que el dashboard read-only funcione end-to-end.
#
# Cualquier otro path (uploads, edición, codificación, exports masivos,
# shutdown, etc.) responde 403 con `E_FORBIDDEN_PUBLIC`.
#
# Estrategia de whitelist (no blacklist) — más seguro: si en el futuro
# se agrega un endpoint nuevo de mutación, queda bloqueado por default.

is_public_mode <- function() {
  v <- Sys.getenv("PULSO_PUBLIC_MODE", "")
  nzchar(v) && !tolower(v) %in% c("0", "false", "no", "off")
}

# Endpoints permitidos en modo público. Cada entrada es "METHOD PATH".
# Los paths con `<...>` son patrones de plumber; los matcheamos como
# prefijos sobre `req$PATH_INFO` con la regla simple de la función.
PUBLIC_MODE_WHITELIST <- c(
  # Infra mínima
  "GET /api/system/health",
  "GET /api/system/bootstrap",
  "GET /api/session/state",
  # Dashboard read-only
  "GET /api/dashboard/manifest",
  "GET /api/dashboard/source",
  "GET /api/dashboard/paletas-listas",
  "GET /api/dashboard/secciones",
  "GET /api/dashboard/config",
  "GET /api/dashboard/all-vars",
  "GET /api/dashboard/recod-vars",
  "GET /api/dashboard/curacion",
  "GET /api/dashboard/base-datos",
  "GET /api/dashboard/base-datos/diccionario",
  "GET /api/dashboard/dimensiones/catalogo",
  "GET /api/dashboard/dimensiones/secciones-vars",
  "GET /api/dashboard/dimensiones/iconos-defaults",
  # Dashboard cómputo (POST con body, no mutan estado)
  "POST /api/dashboard/categorias-var",
  "POST /api/dashboard/resumen/seccion",
  "POST /api/dashboard/resumen/kpis",
  "POST /api/dashboard/relacion/cross",
  "POST /api/dashboard/base-datos/data",
  "POST /api/dashboard/dimensiones/payload",
  "POST /api/dashboard/dimensiones/categorias-var",
  "POST /api/dashboard/dimensiones/foda",
  "POST /api/dashboard/dimensiones/matriz_unidades"
)

# Devuelve TRUE si la combinación METHOD + PATH está autorizada en modo
# público. El static handler (`/`, `/<path:path>`) siempre pasa — los
# assets del frontend NO viven bajo `/api/`.
public_request_allowed <- function(method, path) {
  if (!startsWith(path, "/api/")) return(TRUE)
  key <- paste(toupper(method), path)
  key %in% PUBLIC_MODE_WHITELIST
}

# Aplica el filtro al objeto plumber. Se llama desde `build_plumber_app`
# después de montar todos los routers.
apply_public_mode_filter <- function(pr) {
  if (!is_public_mode()) return(pr)
  message("[forbid_mutations] PULSO_PUBLIC_MODE=1 — whitelist activa (",
          length(PUBLIC_MODE_WHITELIST), " endpoints permitidos).")

  plumber::pr_filter(pr, "public_mode_guard", function(req, res) {
    method <- req$REQUEST_METHOD %||% "GET"
    path <- req$PATH_INFO %||% ""
    if (public_request_allowed(method, path)) {
      plumber::forward()
    } else {
      res$status <- 403L
      list(error = list(
        code = "E_FORBIDDEN_PUBLIC",
        message = sprintf("Endpoint '%s %s' no disponible en modo público.",
                          method, path)
      ))
    }
  })
}

# `%||%` para no depender de magrittr/rlang acá.
`%||%` <- function(a, b) if (is.null(a) || identical(a, "")) b else a
