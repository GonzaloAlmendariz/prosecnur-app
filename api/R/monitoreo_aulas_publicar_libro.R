# Publicar el libro de aulas al Google Sheets del operativo — unidad B1.
#
# Decisión textual de Gonzalo (2026-08-31): «campo para poner el enlace del
# nuevo sheets y recordarlo, para escribir sobre él y leer, SIN sobreescribir
# las dos primeras hojas, que las llenan desde el sheets, no desde la app».
#
# Traducción a contrato — DUEÑO POR HOJA, no por documento:
#   - «Aulas Agendadas» y «Aulas Aplicadas (Campo)» son del EQUIPO. La app las
#     siembra solo si la pestaña no existe o está vacía; con CUALQUIER contenido
#     remoto no emite ni una escritura sobre ellas y las declara `respetada`.
#     La regla es de dueño, no de delta: un plan cambiado en la app NO abre la
#     puerta, y da igual quién puso el contenido (la propia siembra cuenta).
#   - «Base de control» es de la APP. Viaja por el motor batch+hash
#     (`monitoreo_sheets_publish_tabs`) y además se reasserta cuando el LIBRO
#     cambió aunque su rectángulo coincida con el último corte (ver
#     `.malp_control_forzado` abajo: cubre la edición manual del remoto que el
#     estado por metadata no ve).
#
# `valueInputOption` se queda en RAW — DECISIÓN DEL LEAD, deliberada: prioriza
# la fidelidad del round-trip con `aulas_libro_leer_de_sheets()` (todo texto;
# Sheets no parsea «0205» a 205 ni interpreta fechas por locale). El costo
# conocido: ordenar por fecha EN Sheets no funciona todavía; queda anotado para
# B2 (numberFormat por columna). Es el mismo RAW que ya usa el motor de
# publicación incremental.
#
# El id del spreadsheet NO es secreto (el token OAuth sí — ADR 0005): viaja en
# la config de monitoreo y por tanto en el `.pulso`, en
# `cfg$aulas_universitarias$libro_sheets`.

# --- destino recordado --------------------------------------------------------

#' El Google Sheets del operativo guardado en la config de monitoreo.
#'
#' Lectura con `[[` de punta a punta: el `$` de R parcial-matchea y una clave
#' hermana (`libro_sheets_borrador`) NO es el destino — es la misma trampa que
#' ya costó `config$plan` pescando `plan_rows`.
#'
#' @param cfg config de monitoreo completa (no solo la de aulas).
#' @return el spreadsheet id pelado, o `""` si no hay destino guardado.
#' @keywords internal
monitoreo_aulas_libro_destino <- function(cfg = list()) {
  if (!is.list(cfg)) return("")
  aulas <- cfg[["aulas_universitarias"]]
  if (!is.list(aulas)) return("")
  libro <- aulas[["libro_sheets"]]
  if (!is.list(libro)) return("")
  # Acepta que lo guardado sea el enlace completo: el helper lo pela igual.
  .monitoreo_extract_spreadsheet_id(libro[["spreadsheet_id"]] %||% "")
}

#' Recuerda (o olvida) el Sheets del operativo en la config de monitoreo.
#'
#' El campo del frontend trae el ENLACE que el equipo copia de la barra del
#' navegador; aquí se normaliza al id pelado y se guarda con su URL canónica
#' derivada, para que la UI pueda ofrecer el enlace sin reconstruirlo. Una
#' entrada vacía OLVIDA el destino (es la única forma de desasociarlo).
#'
#' @param cfg config de monitoreo completa.
#' @param enlace_o_id enlace de Google Sheets o id pelado; `""` para olvidar.
#' @return la config con `aulas_universitarias$libro_sheets` puesto o retirado.
#' @keywords internal
monitoreo_aulas_libro_destino_set <- function(cfg, enlace_o_id) {
  if (!is.list(cfg)) cfg <- list()
  aulas <- if (is.list(cfg[["aulas_universitarias"]])) cfg[["aulas_universitarias"]] else list()
  crudo <- trimws(.monitoreo_scalar(enlace_o_id, ""))
  if (!nzchar(crudo)) {
    aulas[["libro_sheets"]] <- NULL
    cfg[["aulas_universitarias"]] <- aulas
    return(cfg)
  }
  id <- .monitoreo_extract_spreadsheet_id(crudo)
  if (!nzchar(id)) {
    stop_api(
      400, "E_SHEETS_SPREADSHEET",
      "El enlace no parece de Google Sheets: no trae el identificador del documento.",
      details = list(entrada = crudo)
    )
  }
  aulas[["libro_sheets"]] <- list(
    spreadsheet_id = id,
    url = paste0("https://docs.google.com/spreadsheets/d/", id, "/edit"),
    updated_at = .monitoreo_now_iso()
  )
  cfg[["aulas_universitarias"]] <- aulas
  cfg
}

#' Normaliza el bloque `libro_sheets` para la whitelist de la config de aulas.
#'
#' `monitoreo_aulas_normalize_config()` es una lista CERRADA: lo que no nombra
#' no persiste (la trampa que ya se comió a `valid_filters`). Esta función es
#' la entrada que esa whitelist invoca; devuelve `NULL` cuando no hay destino,
#' que es como están todos los estudios de hoy.
#'
#' @param x el bloque crudo (de la config entrante, un `.pulso` o el cliente).
#' @return lista `{spreadsheet_id, url, updated_at}` o `NULL`.
#' @keywords internal
monitoreo_aulas_libro_sheets_normalizar <- function(x) {
  if (!is.list(x)) return(NULL)
  id <- .monitoreo_extract_spreadsheet_id(
    x[["spreadsheet_id"]] %||% x[["url"]] %||% x[["enlace"]] %||% ""
  )
  if (!nzchar(id)) return(NULL)
  list(
    spreadsheet_id = id,
    url = paste0("https://docs.google.com/spreadsheets/d/", id, "/edit"),
    updated_at = .monitoreo_scalar(x[["updated_at"]], "")
  )
}

# --- hojas del libro y sus values --------------------------------------------

.malp_hojas_equipo <- function() c("Aulas Agendadas", "Aulas Aplicadas (Campo)")
.malp_hoja_control <- function() "Base de control"

# Cuántas filas de cabecera lleva cada hoja. Es el MISMO reparto que usa el
# lector (`aulas_libro_desde_valores`): la agenda una, las otras dos (grupo y
# campo). Sirve para que `filas` del resumen cuente filas de DATOS.
.malp_cabeceras <- function(hoja) {
  if (identical(hoja, "Aulas Agendadas")) 1L else 2L
}

# data.frame del generador (cabecera como primera fila, todo texto) → filas de
# `values` para la API. Es el adaptador probado en
# test-carga-aulas-sheets-vuelta-tres-hojas.R: cada fila del df es una fila de
# celdas de texto.
.malp_df_a_values <- function(hoja) {
  if (!is.data.frame(hoja) || !nrow(hoja)) return(list())
  lapply(seq_len(nrow(hoja)), function(i) as.list(as.character(hoja[i, ])))
}

# Canoniza filas de values para poder COMPARAR lo producido con lo remoto: la
# API devuelve las filas dentadas (recorta celdas vacías del final) y omite las
# filas vacías del final, así que la comparación byte a byte daría «cambió»
# siempre. Se recortan colas de "" por fila y filas vacías por cola.
.malp_canonizar <- function(values) {
  filas <- lapply(values %||% list(), function(row) {
    celdas <- as.character(unlist(row %||% character(0), use.names = FALSE))
    celdas[is.na(celdas)] <- ""
    ultimo <- max(c(0L, which(nzchar(celdas))))
    as.list(celdas[seq_len(ultimo)])
  })
  ultimo <- max(c(0L, which(vapply(filas, length, integer(1)) > 0L)))
  filas[seq_len(ultimo)]
}

# ¿La pestaña remota tiene contenido? Cualquier celda no vacía cuenta: la regla
# de dueño es binaria a propósito (contenido = del equipo, da igual cuánto).
.malp_filas_con_contenido <- function(values) {
  filas <- values %||% list()
  sum(vapply(filas, function(row) {
    celdas <- trimws(as.character(unlist(row %||% character(0), use.names = FALSE)))
    celdas <- celdas[!is.na(celdas)]
    any(nzchar(celdas))
  }, logical(1)))
}

# Sonda de contenido remoto: UN values:batchGet con todas las pestañas que
# existen. Siempre por `.monitoreo_google_api` (es lo que el entorno de test
# mockea y lo que refresca el token). Devuelve lista nombrada de values.
.malp_valores_remotos <- function(spreadsheet_id, pestanas) {
  if (!length(pestanas)) return(list())
  rangos <- vapply(pestanas, function(p) {
    utils::URLencode(.monitoreo_sheets_quote_sheet(p), reserved = TRUE)
  }, character(1))
  payload <- .monitoreo_google_api(paste0(
    .monitoreo_sheets_api_base(spreadsheet_id),
    "/values:batchGet?",
    paste0("ranges=", rangos, collapse = "&")
  ))
  vrs <- payload$valueRanges %||% list()
  out <- list()
  for (i in seq_along(pestanas)) {
    vr <- if (i <= length(vrs)) vrs[[i]] else list()
    out[[pestanas[[i]]]] <- vr$values %||% list()
  }
  out
}

# La reasserción de «Base de control» cuando el motor la saltó por hash. El
# tab_state por developerMetadata describe lo que la APP escribió, no lo que
# hay: si el equipo editó la pestaña a mano, el hash sigue coincidiendo y el
# motor no la toca. Cuando el ciclo detectó que el libro cambió (cualquiera de
# las tres hojas difiere del remoto), la hoja de la app se reescribe igual —
# mismo rectángulo canónico que describe el estado, así que el metadata remoto
# queda consistente sin tocarlo.
.malp_control_forzado <- function(spreadsheet_id, values) {
  padded <- .monitoreo_sync_sheets_padded_rows(.monitoreo_sheets_values_rows(values))
  .monitoreo_google_api(
    paste0(.monitoreo_sheets_api_base(spreadsheet_id), "/values:batchUpdate"),
    method = "POST",
    body = list(
      # RAW: ver la cabecera del archivo (fidelidad del round-trip).
      valueInputOption = "RAW",
      data = list(list(
        range = .monitoreo_sheets_quote_sheet(.malp_hoja_control()),
        majorDimension = "ROWS",
        values = padded
      ))
    )
  )
  invisible(TRUE)
}

# --- el publicador ------------------------------------------------------------

#' Publica el libro de aulas en el Google Sheets del operativo.
#'
#' Produce las tres hojas de datos con los MISMOS generadores del `.xlsx`
#' (`aulas_libro_hoja_agendadas/aplicadas/control`), así que lo publicado se
#' relee con `aulas_libro_leer_de_sheets()` sin configurar nada. La siembra va
#' en UNA llamada a `monitoreo_sheets_publish_tabs()` (un solo
#' values:batchUpdate); el ciclo sin cambios cuesta a lo más tres requests.
#'
#' @param spreadsheet_id id o enlace del documento destino.
#' @param plan filas del plan (formato largo, como `aulas_libro_generar`).
#' @param partes partes de campo ya registrados.
#' @param control filas de «Base de control» ya registradas.
#' @param efectivas vector con nombre: efectivas de plataforma por código.
#' @return lista con `ok`, `spreadsheet_id`, `spreadsheet_url`, `updated_at` y
#'   `hojas`: una entrada `{hoja, accion, filas}` por hoja del libro, con
#'   `accion` en `sembrada | actualizada | sin_cambios | respetada` y `filas`
#'   contando filas de datos (sin cabeceras del layout estándar).
#' @keywords internal
monitoreo_aulas_publicar_libro <- function(spreadsheet_id,
                                           plan = list(),
                                           partes = list(),
                                           control = list(),
                                           efectivas = NULL) {
  id <- .monitoreo_extract_spreadsheet_id(spreadsheet_id)
  if (!nzchar(id)) {
    stop_api(400, "E_SHEETS_SPREADSHEET",
             "Falta el identificador del Google Sheets del operativo de aulas.")
  }
  # El banco de extras sin usar no va al libro; misma regla que el generador
  # del `.xlsx` (y mismo E_* cuando no queda nada que publicar).
  unidades <- .calg_unidades_del_libro(plan %||% list(), partes = partes, control = control)
  if (!length(unidades)) {
    stop_api(409, "E_AULAS_LIBRO_SIN_PLAN",
             "No hay plan de aulas del que publicar el libro.")
  }

  equipo <- .malp_hojas_equipo()
  hoja_control <- .malp_hoja_control()
  hojas_libro <- c(equipo, hoja_control)
  producidas <- list()
  producidas[[equipo[[1]]]] <- .malp_df_a_values(aulas_libro_hoja_agendadas(unidades))
  producidas[[equipo[[2]]]] <- .malp_df_a_values(aulas_libro_hoja_aplicadas(unidades, partes = partes))
  producidas[[hoja_control]] <- .malp_df_a_values(
    aulas_libro_hoja_control(unidades, control, efectivas, partes = partes)
  )

  # Qué hay en el remoto: metadata para saber qué pestañas existen y UNA sonda
  # de values para las que existen. Leer no es tocar: la regla de dueño
  # prohíbe escrituras sobre las hojas del equipo, no lecturas.
  meta <- .monitoreo_sheets_metadata(id)
  tab_map <- .monitoreo_sheets_tab_map(meta)
  existentes <- hojas_libro[hojas_libro %in% names(tab_map)]
  remotas <- .malp_valores_remotos(id, existentes)

  acciones <- list()
  filas <- list()
  tabs <- list()
  for (hoja in equipo) {
    contenido <- .malp_filas_con_contenido(remotas[[hoja]] %||% list())
    if (hoja %in% existentes && contenido > 0L) {
      # Del equipo y con contenido: ni un request sobre su sheetId. No entra a
      # `tabs`, así que el motor no puede tocarla ni para formato.
      acciones[[hoja]] <- "respetada"
      filas[[hoja]] <- max(0L, contenido - .malp_cabeceras(hoja))
    } else {
      tabs[[hoja]] <- producidas[[hoja]]
      acciones[[hoja]] <- "sembrada"
      filas[[hoja]] <- max(0L, length(producidas[[hoja]]) - .malp_cabeceras(hoja))
    }
  }
  tabs[[hoja_control]] <- producidas[[hoja_control]]
  filas[[hoja_control]] <- max(0L, length(producidas[[hoja_control]]) - .malp_cabeceras(hoja_control))
  control_nueva <- !(hoja_control %in% names(tab_map))

  # ¿Cambió el libro? Delta a nivel LIBRO contra los values REMOTOS (la verdad
  # observable, no la caché de metadata): una pestaña ausente o distinta de lo
  # producido cuenta como cambio. Decide la reasserción de la base de control.
  libro_cambio <- any(vapply(hojas_libro, function(hoja) {
    if (!(hoja %in% existentes)) return(TRUE)
    !identical(.malp_canonizar(producidas[[hoja]]), .malp_canonizar(remotas[[hoja]]))
  }, logical(1)))

  pub <- monitoreo_sheets_publish_tabs(id, tabs)
  saltadas <- as.character(unlist(pub$skipped_tabs %||% list(), use.names = FALSE))

  for (hoja in names(tabs)) {
    if (identical(hoja, hoja_control)) next
    # Una sembrada que el motor saltó (metadata rancio sobre pestaña vaciada a
    # mano) no se declara sembrada: no se escribió nada.
    if (hoja %in% saltadas) acciones[[hoja]] <- "sin_cambios"
  }
  if (control_nueva) {
    acciones[[hoja_control]] <- "sembrada"
  } else if (!(hoja_control %in% saltadas)) {
    acciones[[hoja_control]] <- "actualizada"
  } else if (libro_cambio) {
    # El motor la saltó por hash pero el libro cambió: la hoja de la app se
    # reasserta (ver `.malp_control_forzado`).
    .malp_control_forzado(id, producidas[[hoja_control]])
    acciones[[hoja_control]] <- "actualizada"
  } else {
    acciones[[hoja_control]] <- "sin_cambios"
  }

  list(
    ok = TRUE,
    spreadsheet_id = id,
    spreadsheet_url = .monitoreo_scalar(
      pub$spreadsheet_url,
      paste0("https://docs.google.com/spreadsheets/d/", id, "/edit")
    ),
    updated_at = .monitoreo_scalar(pub$updated_at, .monitoreo_now_iso()),
    hojas = lapply(hojas_libro, function(hoja) list(
      hoja = hoja,
      accion = acciones[[hoja]],
      filas = filas[[hoja]]
    ))
  )
}

# --- montaje HTTP -------------------------------------------------------------

# Vive aquí y no en `router_monitoreo.R` porque el router está congelado a
# crecimiento; mismo patrón que `router_monitoreo_territorial_mapeo.R`. Se
# registra en `plumber_app.R` (solo fuera de modo público: es un endpoint que
# escribe en un servicio externo y muta la config).
#
# El destino viaja en el body del publicar y SE RECUERDA ahí mismo (la decisión
# es «pegar el enlace una vez»); `/api/monitoreo/aulas/config` también puede
# escribir `libro_sheets` porque la whitelist de la config lo nombra.
# `/api/monitoreo/sheets/source` NO sirve para esto: registra fuentes de
# LECTURA de respuestas, con binding de pestaña/cabecera, y el libro es un
# destino de escritura.
mount_monitoreo_aulas_libro <- function(pr) {
  pr |>
    plumber::pr_post("/api/monitoreo/aulas/publicar-libro", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      cfg <- s$monitoreo_config %||% list()

      # Todo el body con `[[` — el `$` parcial-matchea y este body viene del
      # cliente (la lección de `config$plan` pescando `plan_rows`).
      entrada <- .monitoreo_scalar(
        parsed[["spreadsheet_id"]] %||% parsed[["id"]] %||%
          parsed[["url"]] %||% parsed[["enlace"]],
        ""
      )
      destino_guardado <- FALSE
      if (nzchar(entrada)) {
        # Se recuerda ANTES de publicar: si la publicación falla (permisos,
        # red), el enlace pegado no se pierde.
        cfg <- monitoreo_aulas_libro_destino_set(cfg, entrada)
        cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = FALSE)
        .monitoreo_mark_project_dirty_if_open(sid)
        destino_guardado <- TRUE
        s <- session_get(sid)
      }
      destino <- monitoreo_aulas_libro_destino(cfg)
      if (!nzchar(destino)) {
        stop_api(400, "E_SHEETS_SPREADSHEET",
                 "Falta el enlace del Google Sheets del operativo: pégalo una vez y queda recordado.")
      }

      # Los mismos insumos que /aulas/generar-libro: el libro publicado y el
      # descargado tienen que decir lo mismo.
      aulas_cfg <- if (is.list(cfg[["aulas_universitarias"]])) cfg[["aulas_universitarias"]] else list()
      unidades <- s$monitoreo_aulas_plan %||% aulas_cfg[["plan"]] %||% list()
      if (!length(unidades)) {
        stop_api(409, "E_AULAS_LIBRO_SIN_PLAN",
                 "No hay plan de aulas del que publicar el libro. Importa la seleccion de calculo de muestra primero.")
      }
      partes <- s$monitoreo_aulas_partes_campo %||% aulas_cfg[["partes_campo"]] %||% list()
      control <- s$monitoreo_aulas_control %||% aulas_cfg[["control"]] %||% list()
      efectivas <- tryCatch(
        monitoreo_aulas_efectivas_por_aula(
          unidades,
          (s$monitoreo_snapshot %||% list())$data,
          aulas_cfg
        ),
        error = function(e) NULL
      )

      out <- tryCatch(
        monitoreo_aulas_publicar_libro(
          destino,
          plan = unidades,
          partes = partes,
          control = control,
          efectivas = efectivas
        ),
        # Un api_error del propio publicador conserva su código; solo los
        # errores crudos del motor/HTTP se visten de E_GOOGLE_SHEETS.
        api_error = function(e) stop(e),
        error = .monitoreo_sheets_stop
      )
      .monitoreo_mark_project_dirty_if_open(sid)
      c(out, list(
        destino_guardado = destino_guardado,
        libro_sheets = aulas_cfg[["libro_sheets"]]
      ))
    }))
}
