# =============================================================================
# Export del dashboard a HTML autosuficiente.
#
# Lee el bundle de `api/inst/standalone/` (build separado con
# `inlineDynamicImports: true`, todo en un único standalone.js + index.css),
# inlinea CSS + JS dentro del HTML y antepone un `<script>` con el
# payload (`rp_data`, `rp_inst`, `dashboard_config`) que el bridge
# `webrBridge.ts` consume al cargar la página.
#
# El archivo resultante es un único .html que se puede subir a un host
# estático (Netlify, S3, GitHub Pages con headers COOP/COEP) o servir
# desde un mini-server local. WebR + R wasm se cargan desde
# `https://webr.r-wasm.org/` la primera vez (cacheable).
# =============================================================================

# Carpeta del build standalone, relativa al package.
.dashboard_standalone_dir <- function() {
  d <- system.file("standalone", package = "prosecnur")
  if (nzchar(d) && dir.exists(d)) return(d)
  # Fallback: cuando se corre con `devtools::load_all` o desde el repo
  # sin instalar el paquete, el build vive en `api/inst/standalone/`.
  here <- normalizePath(file.path(dirname(getwd()), "api", "inst", "standalone"),
                        mustWork = FALSE)
  if (dir.exists(here)) return(here)
  here2 <- normalizePath(file.path(getwd(), "api", "inst", "standalone"),
                         mustWork = FALSE)
  if (dir.exists(here2)) return(here2)
  NULL
}

# Lee un asset del bundle standalone como string. Falla con error claro
# si el bundle no existe (significa que el dev olvidó correr
# `pnpm build:standalone`).
.dashboard_standalone_asset <- function(name) {
  d <- .dashboard_standalone_dir()
  if (is.null(d)) {
    stop_api(500, "E_NO_STANDALONE_BUILD",
      "El bundle standalone no existe. Corre `cd frontend && pnpm build:standalone`.")
  }
  p <- file.path(d, name)
  if (!file.exists(p)) {
    stop_api(500, "E_MISSING_ASSET",
      sprintf("Falta el asset %s en el bundle standalone (%s).", name, d))
  }
  paste(readLines(p, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
}

# Serializa el dataframe a una list of columnas (más compacto que rows
# en JSON). Convierte factores a character.
.dashboard_df_to_payload <- function(df) {
  if (is.null(df) || !nrow(df)) return(list())
  out <- lapply(df, function(col) {
    if (is.factor(col)) col <- as.character(col)
    if (is.logical(col)) col <- as.integer(col)
    unname(col)
  })
  out
}

# Construye el payload que se inyecta en `window.PULSO_STANDALONE_PAYLOAD`.
.dashboard_export_payload <- function(s) {
  s <- .dashboard_ctx(s)
  if (is.null(s$rp_data) || is.null(s$rp_inst)) {
    stop_api(409, "E_NO_DATA",
      "El dashboard no tiene fuente cargada — no hay nada que exportar.")
  }
  list(
    rp_data = .dashboard_df_to_payload(s$rp_data),
    rp_inst = list(
      survey = .dashboard_df_to_payload(s$rp_inst$survey),
      choices = .dashboard_df_to_payload(s$rp_inst$choices)
    ),
    dashboard_config = .dashboard_config_with_defaults(s$dashboard_config),
    # Etiquetas humanas de los grupos recodificados (si las hay) — el
    # bridge offline las usa para mostrar "Grupo X" en lugar de "recod.N"
    # cuando el modo es "recod".
    codif_por_base = if (is.list(s$codif_por_base)) {
      lapply(s$codif_por_base, function(per_src) {
        gr <- per_src$grupos_recod
        if (is.list(gr)) list(grupos_recod = gr) else list()
      })
    } else list()
  )
}

# Función principal — devuelve el HTML completo como string.
.dashboard_export_html <- function(s) {
  payload <- .dashboard_export_payload(s)
  payload_json <- jsonlite::toJSON(payload, auto_unbox = TRUE,
                                    dataframe = "columns", null = "null",
                                    na = "null", force = TRUE)
  css <- .dashboard_standalone_asset("index.css")
  js  <- .dashboard_standalone_asset("standalone.js")

  cfg <- payload$dashboard_config
  titulo <- if (is.character(cfg$titulo) && nzchar(cfg$titulo)) cfg$titulo else "Dashboard"
  # Escape mínimo del título para inyectarlo en <title>.
  titulo_esc <- gsub("<", "&lt;", titulo, fixed = TRUE)

  # `</script>` dentro del payload JSON rompería el bloque <script>.
  # Escape estándar.
  payload_safe <- gsub("</script", "<\\/script", payload_json, fixed = TRUE)

  paste0(
    "<!doctype html>\n",
    "<html lang=\"es\">\n",
    "<head>\n",
    "  <meta charset=\"UTF-8\" />\n",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n",
    "  <title>", titulo_esc, "</title>\n",
    "  <style>\n", css, "\n  </style>\n",
    "</head>\n",
    "<body>\n",
    "  <div id=\"root\"></div>\n",
    "  <script>\n",
    "    window.PULSO_STANDALONE_PAYLOAD = ", payload_safe, ";\n",
    "  </script>\n",
    "  <script type=\"module\">\n", js, "\n  </script>\n",
    "</body>\n",
    "</html>\n"
  )
}
