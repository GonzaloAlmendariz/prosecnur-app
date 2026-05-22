# =============================================================================
# Endpoints HTTP de la Enciclopedia Metodológica
# =============================================================================
#
# Sirve el catálogo canónico de metodologías, glosario, tabla maestra de
# estudios y comparador, todo desde JSON estable en `api/inst/catalogos/`.
#
# Diseñado para reemplazar el contenido hardcoded en TypeScript del módulo
# `frontend/src/features/enciclopedia/`.

.enc_catalogo_path <- function(file) {
  p <- system.file("catalogos", file, package = "prosecnurapp")
  if (!nzchar(p) || !file.exists(p)) {
    stop_api(500, "E_CATALOGO_NOT_FOUND",
             sprintf("Catálogo '%s' no encontrado en la instalación.", file))
  }
  p
}

.enc_load <- function(file) {
  jsonlite::fromJSON(.enc_catalogo_path(file), simplifyVector = FALSE)
}

mount_enciclopedia <- function(pr) {
  pr |>
    # -----------------------------------------------------------------------
    # GET /api/enciclopedia/catalogo — las 10 fichas metodológicas
    # -----------------------------------------------------------------------
    plumber::pr_get("/api/enciclopedia/catalogo",
                    wrap_endpoint(function(req, res) {
      .enc_load("catalogo_metodologias.json")
    })) |>

    # -----------------------------------------------------------------------
    # GET /api/enciclopedia/glosario — los 17 términos canónicos
    # -----------------------------------------------------------------------
    plumber::pr_get("/api/enciclopedia/glosario",
                    wrap_endpoint(function(req, res) {
      .enc_load("glosario.json")
    })) |>

    # -----------------------------------------------------------------------
    # GET /api/enciclopedia/estudios — tabla maestra de estudios (códigos)
    # -----------------------------------------------------------------------
    plumber::pr_get("/api/enciclopedia/estudios",
                    wrap_endpoint(function(req, res) {
      .enc_load("tabla_maestra_estudios.json")
    })) |>

    # -----------------------------------------------------------------------
    # GET /api/enciclopedia/tipos-estudio — familias y rutas del evaluador
    # -----------------------------------------------------------------------
    plumber::pr_get("/api/enciclopedia/tipos-estudio",
                    wrap_endpoint(function(req, res) {
      .enc_load("catalogo_tipos_estudio.json")
    })) |>

    # -----------------------------------------------------------------------
    # GET /api/enciclopedia/comparador?ids=A,B,C
    # Devuelve matriz comparativa de 2-3 metodologías side-by-side.
    # -----------------------------------------------------------------------
    plumber::pr_get("/api/enciclopedia/comparador",
                    wrap_endpoint(function(req, res, ids = NULL) {
      if (is.null(ids) || !nzchar(as.character(ids[[1]]))) {
        stop_api(400, "E_NO_IDS",
                 "Parámetro 'ids' requerido (ej: ids=prob_aleatorio_simple,intencion_censal).")
      }
      ids_vec <- strsplit(as.character(ids[[1]]), ",")[[1]]
      ids_vec <- trimws(ids_vec)
      if (length(ids_vec) < 2L || length(ids_vec) > 3L) {
        stop_api(400, "E_IDS_RANGO",
                 "El comparador acepta entre 2 y 3 metodologías.")
      }
      cat <- .enc_load("catalogo_metodologias.json")
      fichas <- cat$metodologias
      by_id <- vapply(fichas, function(f) f$id, character(1))
      seleccionadas <- lapply(ids_vec, function(id) {
        idx <- match(id, by_id)
        if (is.na(idx)) {
          stop_api(404, "E_METODOLOGIA_NOT_FOUND",
                   sprintf("Metodología '%s' no existe en el catálogo.", id))
        }
        fichas[[idx]]
      })
      list(
        version = cat$version,
        seleccionadas = seleccionadas,
        ejes_comparacion = list(
          "naturaleza", "permite_margen_error", "definicion",
          "supuestos_formales", "formulas", "parametros_tipicos",
          "origen_tamano_aplicable", "escenarios_de_uso", "cuando_no_usar",
          "decisiones_tecnicas", "trade_offs", "salida_principal"
        )
      )
    })) |>

    # -----------------------------------------------------------------------
    # GET /api/enciclopedia/preset/acreditacion — cuadro maestro PUCP
    # -----------------------------------------------------------------------
    plumber::pr_get("/api/enciclopedia/preset/acreditacion",
                    wrap_endpoint(function(req, res) {
      .enc_load("preset_acreditacion_pucp.json")
    }))
}
