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

# Marco de los invitados: aplica las reglas del body si las trae y, después, los rótulos corregidos.
.cm_mp_invitados_df <- function(sid, body) {
  df <- .cm_mp_leer(.cm_mp_archivo(sid, calc_str(body$file_id, "")), calc_str(body$hoja, ""))
  reglas <- body$reglas %||% list()
  rotulos <- .cm_receta_rotulos(body$rotulos)
  if (!length(reglas)) return(.cm_receta_rotular(df, rotulos))
  otros <- .cm_mp_otros(sid, body$otros %||% list())
  inv <- calc_muestra_marco_invitados(df, calc_str(body$columna_correo, ""), reglas, otros)
  .cm_receta_rotular(df[inv$incluidos, , drop = FALSE], rotulos)
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
      # El cruce sale con los rótulos corregidos; el original sirve para corregirlos en pantalla.
      c(list(ok = TRUE, categoria = lec$categoria, conteo_columnas = lec$conteo_columnas,
             calculadas = lec$calculadas, avisos = lec$avisos, cruce_original = calc_muestra_cruce_json(lec$cruce)),
        .cm_mp_segmentos(.cm_conteos_rotular(lec$cruce, body$rotulos), body))
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
                                                 columna_variable = calc_str(body$columna_variable, ""),
                                                 rotulos = body$rotulos %||% list())
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
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/marco-publico/cruce-publicos
    # Body: { metas?: {<componente_id>: n}, tasas?: {<componente_id>: proporción} }
    # Personas que figuran en más de un público, por correo, entre los actores con
    # base por persona y columna de correo (D9: se muestra, no se descuenta).
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/marco-publico/cruce-publicos",
                     serializer = .cm_serializer_sin_redondeo(),
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      s <- session_get(sid)
      estudio <- s$calc_muestra_estudio %||% calc_muestra_normalize_estudio(list())
      marcos <- .cm_general_estado(s$calc_muestra_general)$marcos
      out <- .cm_cruce_publicos_de_sesion(sid, estudio, marcos, body$metas %||% list(), body$tasas %||% list())
      list(ok = TRUE, publicos = out$publicos, hay_cruce = out$hay_cruce, sin_correo = out$sin_correo)
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/marco-publico/listado
    # Body: { decisiones?: [{ a, b, va }], tandas?: { n, semilla } }
    # Listado de envío (D9): con `decisiones` las guarda en el estudio; devuelve, por público, cuántos quedan y
    # cuántos se ceden, y los pares con personas en común con su decisión.
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/marco-publico/listado",
                     serializer = .cm_serializer_sin_redondeo(),
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      s <- session_get(sid)
      estudio <- s$calc_muestra_estudio %||% calc_muestra_normalize_estudio(list())
      estado <- .cm_general_estado(s$calc_muestra_general)
      if (!is.null(body$decisiones) || !is.null(body$tandas)) {
        if (!is.null(body$decisiones)) estado$envio$decisiones <- calc_muestra_listado_decisiones(body$decisiones)
        if (!is.null(body$tandas)) estado$envio$tandas <- calc_muestra_listado_tandas_config(body$tandas)
        session_set(sid, "calc_muestra_general", estado)
      }
      leidos <- .cm_publicos_con_correo(sid, estudio, estado$marcos)
      out <- calc_muestra_listado_asignar(leidos$publicos, estado$envio$decisiones %||% list())
      out$destino <- NULL
      c(list(ok = TRUE, sin_correo = leidos$fuera, tandas = calc_muestra_listado_tandas_config(estado$envio$tandas)), out)
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/marco-publico/listado/descargar
    # Excel del listado de envío con las decisiones guardadas; 400 si falta decidir algún par.
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/marco-publico/listado/descargar",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      estudio <- s$calc_muestra_estudio %||% calc_muestra_normalize_estudio(list())
      estado <- .cm_general_estado(s$calc_muestra_general)
      leidos <- .cm_publicos_con_correo(sid, estudio, estado$marcos)
      asignacion <- calc_muestra_listado_asignar(leidos$publicos, estado$envio$decisiones %||% list())
      out_path <- tempfile("listado_envio_", fileext = ".xlsx")
      calc_muestra_listado_xlsx(leidos$publicos, asignacion, out_path, estado$envio$tandas %||% list())
      out_name <- .export_filename(sid, "listado_de_envio", "xlsx")
      meta <- .register_output_file(sid, "calc_muestra_listado_envio", out_path, original_name = out_name)
      list(ok = TRUE, export = entregable_respuesta(list(file_id = meta$file_id, filename = meta$original_name,
                                                         size = meta$size), meta))
    }))
}
