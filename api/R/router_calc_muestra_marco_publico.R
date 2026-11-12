# Rutas del marco de un público en un estudio por correo o teléfono (barrido,
# ADR 0143). Router delgado: lee el archivo subido y llama al engine
# (calc_muestra_marco_publico.R). Sin estado: guardar la receta del marco en el
# estudio entra con el recorrido del marco en Actores.

# Ruta del archivo subido, con los errores de lectura como 400 accionables.
.cm_mp_archivo <- function(sid, file_id) {
  if (!nzchar(file_id)) {
    stop_api(400, "E_CALC_MUESTRA_FILE_REQUIRED", "Sube primero el archivo del marco.")
  }
  get_file(sid, file_id)$path
}

.cm_mp_leer <- function(path, hoja = "") {
  tryCatch({
    if (nzchar(hoja) && tolower(tools::file_ext(path)) %in% c("xlsx", "xls")) {
      disponibles <- readxl::excel_sheets(path)
      if (!hoja %in% disponibles) {
        stop(errorCondition(sprintf("No se encontro la pestana '%s' en el Excel. Hojas disponibles: %s.",
                                    hoja, paste(disponibles, collapse = ", ")), class = "cm_aulas_hoja_error"))
      }
    }
    .cm_marco_leer_hoja_texto(path, if (nzchar(hoja)) hoja else NULL)
  }, error = function(e) {
    if (inherits(e, "api_error")) stop(e)
    if (inherits(e, "cm_aulas_hoja_error")) stop_api(400, "E_CALC_MUESTRA_EXPLORAR_HOJA", conditionMessage(e))
    stop_api(400, "E_CALC_MUESTRA_EXPLORAR_ARCHIVO", conditionMessage(e))
  })
}

.cm_mp_hojas <- function(path) {
  tryCatch(calc_muestra_marco_hojas(path), error = function(e) {
    if (inherits(e, "api_error")) stop(e)
    stop_api(400, "E_CALC_MUESTRA_EXPLORAR_ARCHIVO", conditionMessage(e))
  })
}

mount_calc_muestra_marco_publico <- function(pr) {
  pr |>
    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/marco-publico/leer
    # Body: { file_id, hoja? }
    # Hojas del libro con su tipo (datos, consulta, notas) y el perfil de las
    # columnas de la hoja pedida o de la sugerida.
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/marco-publico/leer",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      path <- .cm_mp_archivo(sid, calc_str(body$file_id, ""))
      archivo <- .cm_mp_hojas(path)
      hoja <- calc_str(body$hoja, "")
      if (!nzchar(hoja)) hoja <- archivo$sugerida
      df <- .cm_mp_leer(path, hoja)
      list(ok = TRUE, archivo = archivo, hoja = hoja, filas = nrow(df),
           columnas = calc_muestra_marco_perfil(df))
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/marco-publico/invitados
    # Body: { file_id, hoja?, columna_correo?, reglas: [...],
    #         otros: [{ publico, file_id, hoja?, columna_correo }] }
    # Embudo de quién se invita. `otros` son los públicos con prioridad sobre
    # este: quien figure en uno de ellos se invita como ese público.
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/marco-publico/invitados",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      df <- .cm_mp_leer(.cm_mp_archivo(sid, calc_str(body$file_id, "")), calc_str(body$hoja, ""))
      otros <- lapply(body$otros %||% list(), function(o) {
        otro <- .cm_mp_leer(.cm_mp_archivo(sid, calc_str(o$file_id, "")), calc_str(o$hoja, ""))
        col <- calc_str(o$columna_correo, "")
        if (!col %in% names(otro)) {
          stop_api(400, "E_BAD_REQUEST", sprintf("La columna de correo \"%s\" no está en la base de %s.", col, calc_str(o$publico, "otro público")))
        }
        list(publico = calc_str(o$publico, "Otro público"), correos = otro[[col]])
      })
      out <- calc_muestra_marco_invitados(df, calc_str(body$columna_correo, ""), body$reglas %||% list(), otros)
      out$incluidos <- NULL
      c(list(ok = TRUE), out)
    }))
}
