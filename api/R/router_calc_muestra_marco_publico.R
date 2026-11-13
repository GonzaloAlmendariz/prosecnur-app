# Rutas del marco de un público en un estudio por correo o teléfono (barrido,
# ADR 0143). Router delgado: lee el archivo subido y llama al engine
# (calc_muestra_marco_publico.R y calc_muestra_segmentos.R). Sin estado: guardar la receta del marco en el
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

# Marco de los invitados: aplica las reglas del body si las trae.
.cm_mp_invitados_df <- function(sid, body) {
  df <- .cm_mp_leer(.cm_mp_archivo(sid, calc_str(body$file_id, "")), calc_str(body$hoja, ""))
  reglas <- body$reglas %||% list()
  if (!length(reglas)) return(df)
  otros <- .cm_mp_otros(sid, body$otros %||% list())
  inv <- calc_muestra_marco_invitados(df, calc_str(body$columna_correo, ""), reglas, otros)
  df[inv$incluidos, , drop = FALSE]
}

.cm_mp_otros <- function(sid, otros) {
  lapply(otros, function(o) {
    otro <- .cm_mp_leer(.cm_mp_archivo(sid, calc_str(o$file_id, "")), calc_str(o$hoja, ""))
    col <- calc_str(o$columna_correo, "")
    if (!col %in% names(otro)) {
      stop_api(400, "E_BAD_REQUEST", sprintf("La columna de correo \"%s\" no está en la base de %s.", col, calc_str(o$publico, "otro público")))
    }
    list(publico = calc_str(o$publico, "Otro público"), correos = otro[[col]])
  })
}

# Segmentos y cuotas sobre un cruce: grupos y cuotas son opcionales. Con
# grupos, la cuota se reparte por grupo; sin ellos, por celda del cruce.
.cm_mp_segmentos <- function(cruce, body) {
  out <- list(cruce = calc_muestra_cruce_json(cruce))
  base <- cruce
  if (length(body$grupos)) {
    ag <- calc_muestra_segmento_agrupar(cruce, body$grupos)
    out$agrupado <- ag
    base <- .cm_seg_cruce(cruce$fila_variable, "", vapply(ag$grupos, `[[`, "", "nombre"), "Total",
                          vapply(ag$grupos, function(g) as.numeric(g$N), numeric(1)))
  }
  if (!is.null(body$cuotas)) {
    q <- body$cuotas
    cu <- calc_muestra_cuotas_cruce(base, q$meta, calc_str(q$modo, "celda"), q$minimo %||% 10L)
    cu$cuotas <- .cm_seg_matriz_json(cu$cuotas, base$filas)
    cu$esperadas <- .cm_seg_matriz_json(cu$esperadas, base$filas)
    out$cuotas <- cu
  }
  out
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
      otros <- .cm_mp_otros(sid, body$otros %||% list())
      out <- calc_muestra_marco_invitados(df, calc_str(body$columna_correo, ""), body$reglas %||% list(), otros)
      out$incluidos <- NULL
      c(list(ok = TRUE), out)
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/marco-publico/cruce
    # Body: { file_id, hoja?, fila, columna?, reglas?, columna_correo?, otros?,
    #         grupos?: [{nombre, celdas: [{fila, columna}]}],
    #         cuotas?: {meta, modo: celda|control|minimo, minimo?} }
    # Cruce de quienes se invitan por una o dos columnas, con grupos y cuotas.
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/marco-publico/cruce",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      df <- .cm_mp_invitados_df(sid, body)
      cruce <- calc_muestra_segmento_cruce(df, calc_str(body$fila, ""), calc_str(body$columna, ""))
      c(list(ok = TRUE, invitados = nrow(df)), .cm_mp_segmentos(cruce, body))
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/marco-publico/conteos
    # Body: { file_id, hoja?, columna_variable?, grupos?, cuotas? }
    # Tabla de conteos del cliente leída como cruce, con grupos y cuotas.
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/marco-publico/conteos",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      df <- .cm_mp_leer(.cm_mp_archivo(sid, calc_str(body$file_id, "")), calc_str(body$hoja, ""))
      lec <- calc_muestra_conteos_leer(df, calc_str(body$columna_variable, ""))
      c(list(ok = TRUE, categoria = lec$categoria, conteo_columnas = lec$conteo_columnas,
             calculadas = lec$calculadas, avisos = lec$avisos), .cm_mp_segmentos(lec$cruce, body))
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/marco-publico/declarar
    # Body: { componente_id, file_id, hoja?, receta: { columnas: {id, correo},
    #         usos, reglas, segmento: {nombre, fila, columna?, grupos?} } }
    # Guarda el marco del actor con su receta: N y un estrato por segmento.
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/marco-publico/declarar",
                     serializer = .cm_serializer_sin_redondeo(),
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      componente_id <- calc_str(body$componente_id, "")
      file_id <- calc_str(body$file_id, "")
      hoja <- calc_str(body$hoja, "")
      datos <- .cm_general_leer_marco(sid, file_id, hoja)
      s <- session_get(sid)
      estudio <- s$calc_muestra_estudio %||% calc_muestra_normalize_estudio(list())
      out <- calc_muestra_marco_publico_declarar(estudio, s$calc_muestra_general, componente_id, datos,
                                                 file_id = file_id, hoja = hoja, receta = body$receta)
      session_set(sid, "calc_muestra_estudio", out$estudio)
      session_set(sid, "calc_muestra_general", out$estado)
      list(ok = TRUE, marco = out$marco, componente = out$componente, estudio = out$estudio)
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/marco-publico/declarar-conteos
    # Body: { componente_id, file_id, hoja?, columna_variable? }
    # Guarda como marco del actor una tabla de conteos: N y un segmento por fila.
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/marco-publico/declarar-conteos",
                     serializer = .cm_serializer_sin_redondeo(),
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      componente_id <- calc_str(body$componente_id, "")
      file_id <- calc_str(body$file_id, "")
      hoja <- calc_str(body$hoja, "")
      df <- .cm_mp_leer(.cm_mp_archivo(sid, file_id), hoja)
      s <- session_get(sid)
      estudio <- s$calc_muestra_estudio %||% calc_muestra_normalize_estudio(list())
      out <- calc_muestra_marco_conteos_declarar(estudio, s$calc_muestra_general, componente_id, df,
                                                 file_id = file_id, hoja = hoja,
                                                 columna_variable = calc_str(body$columna_variable, ""))
      session_set(sid, "calc_muestra_estudio", out$estudio)
      session_set(sid, "calc_muestra_general", out$estado)
      list(ok = TRUE, marco = out$marco, componente = out$componente, estudio = out$estudio)
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/marco-publico/cuotas
    # Body: { componente_id, meta, modo: celda|control|minimo, minimo?, columna? }
    # Reparte la meta del actor por sus segmentos (y una segunda variable si se
    # pide) sobre su marco guardado con receta.
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/marco-publico/cuotas",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      componente_id <- calc_str(body$componente_id, "")
      marco <- .cm_general_estado(session_get(sid)$calc_muestra_general)$marcos[[componente_id]]
      if (is.null(marco) || is.null(marco$receta)) {
        stop_api(400, "E_BAD_REQUEST", "Este actor no tiene una base cargada en Marco.")
      }
      out <- if (identical(calc_str(marco$receta$tipo, ""), "conteos")) {
        calc_muestra_marco_cuotas_conteos(.cm_mp_leer(.cm_mp_archivo(sid, marco$file_id), marco$hoja %||% ""), marco$receta,
                                          body$meta, calc_str(body$modo, "celda"), body$minimo %||% 10L, calc_str(body$columna, ""))
      } else {
        datos <- .cm_general_leer_marco(sid, marco$file_id, marco$hoja %||% "")
        calc_muestra_marco_cuotas(datos, marco$receta, body$meta, calc_str(body$modo, "celda"),
                                  body$minimo %||% 10L, calc_str(body$columna, ""))
      }
      cu <- out$cuotas
      cu$cuotas <- .cm_seg_matriz_json(cu$cuotas, out$cruce$filas)
      cu$esperadas <- .cm_seg_matriz_json(cu$esperadas, out$cruce$filas)
      list(ok = TRUE, cruce = calc_muestra_cruce_json(out$cruce), cuotas = cu, columnas_cuota = out$columnas_cuota)
    }))
}
