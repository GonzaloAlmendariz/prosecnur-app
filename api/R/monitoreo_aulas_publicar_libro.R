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
#   - «Base de control», «Plan del día» (B2.1) y «Avance de campo» (B2.2) son
#     de la APP. Viajan por el
#     motor batch+hash (`monitoreo_sheets_publish_tabs`) y además se reassertan
#     cuando el LIBRO cambió aunque su rectángulo coincida con el último corte
#     (ver `.malp_hoja_app_forzada` abajo: cubre la edición manual del remoto
#     que el estado por metadata no ve). Contenido remoto NO las protege:
#     jamás salen `respetada`.
#
# `valueInputOption` se queda en RAW — DECISIÓN DEL LEAD, deliberada: prioriza
# la fidelidad del round-trip con `aulas_libro_leer_de_sheets()` (todo texto;
# Sheets no parsea «0205» a 205 ni interpreta fechas por locale). El costo
# conocido: ordenar por fecha EN Sheets no funciona todavía; queda anotado para
# B2 (numberFormat por columna). Es el mismo RAW que ya usa el motor de
# publicación incremental. UNA excepción declarada (B9): la siembra de «Aulas
# Aplicadas (Campo)» lleva FÓRMULAS de arrastre a «Aulas Agendadas»
# (monitoreo_aulas_libro_arrastre.R) y esa escritura —solo esa— va
# USER_ENTERED, porque con RAW la fórmula quedaría como texto sin computar. El
# round-trip no se resiente: la API de lectura devuelve valores computados.
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
.malp_hoja_plan_dia <- function() "Plan del día"
.malp_hoja_avance <- function() "Avance de campo"
# B68 tercera pata (dictado 2026-09-03: «¿el Sheets ya está listo para
# actualizarse con la nueva hoja?»): la asignación es la CUARTA hoja de la
# app, pero CONDICIONAL — entra al juego solo cuando la sesión tiene
# disponibilidad (hay reparto que contar). Sin ella ni se produce ni entra a
# `hojas_libro`: una pestaña remota previa queda intacta, ni un request.
.malp_hoja_asignacion <- function() "Asignación de aplicadores"
# Las hojas de la APP: se publican SIEMPRE (sembrada/actualizada/sin_cambios,
# jamás `respetada`) y comparten el trato de delta+reasserción. «Avance de
# campo» (B2.2) es la tercera: la hoja de indicadores que el xlsx escribe
# imperativa llega a Sheets por `aulas_libro_hoja_avance()`.
.malp_hojas_app <- function() c(.malp_hoja_control(), .malp_hoja_plan_dia(), .malp_hoja_avance())

# Cuántas filas de cabecera lleva cada hoja. Es el MISMO reparto que usa el
# lector (`aulas_libro_desde_valores`) para las tres con lector —la agenda una,
# las otras dos (grupo y campo)—; «Plan del día» no tiene lector y lleva su
# cabecera como primera fila, y «Avance de campo» cae en el 2 del else: sus
# dos primeras filas son título y corte, no datos. Sirve para que `filas` del
# resumen cuente filas de DATOS. La agendadas Extra (B14) calca a su
# contraparte: una fila; la de campo Extra cae en el 2 del else, como la suya.
.malp_cabeceras <- function(hoja) {
  if (hoja %in% c("Aulas Agendadas", AULAS_LIBRO_HOJA_AGENDADAS_EXTRA,
                  .malp_hoja_plan_dia())) 1L else 2L
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

# La reasserción de una hoja de la APP cuando el motor la saltó por hash. El
# tab_state por developerMetadata describe lo que la APP escribió, no lo que
# hay: si el equipo editó la pestaña a mano, el hash sigue coincidiendo y el
# motor no la toca. Cuando el ciclo detectó que el libro cambió (cualquiera de
# sus hojas difiere del remoto), la hoja de la app se reescribe igual — mismo
# rectángulo canónico que describe el estado, así que el metadata remoto queda
# consistente sin tocarlo. Aplica a «Base de control» y «Plan del día» por
# igual: mismo trato, decidido en B2.1.
.malp_hoja_app_forzada <- function(spreadsheet_id, hoja, values) {
  padded <- .monitoreo_sync_sheets_padded_rows(.monitoreo_sheets_values_rows(values))
  .monitoreo_google_api(
    paste0(.monitoreo_sheets_api_base(spreadsheet_id), "/values:batchUpdate"),
    method = "POST",
    body = list(
      # RAW: ver la cabecera del archivo (fidelidad del round-trip).
      valueInputOption = "RAW",
      data = list(list(
        range = .monitoreo_sheets_quote_sheet(hoja),
        majorDimension = "ROWS",
        values = padded
      ))
    )
  )
  invisible(TRUE)
}

# La capa de formato+desplegables del libro para el batch-2 del motor (B8/W2).
# Misma firma que el formateador genérico del motor; delega en
# `monitoreo_aulas_sheets_formato.R`, que copia la paleta y los vocabularios
# del xlsx. Viaja por `.monitoreo_sync_sheets_publish_tabs(format_requests=)`
# y por tanto hereda sus dos reglas: DESPUÉS de los values (el reset de una
# pestaña con dims cambiadas borra formato Y dataValidation con su
# updateCells) y SOLO para pestañas nuevas o con dimensiones cambiadas —
# republicar sin cambios no reenvía nada, y las hojas del equipo solo pueden
# recibirlo en su siembra porque `respetada` ni siquiera las mete al motor.
.malp_formato_requests <- function(sheet_id, tab_name, rows, con_daa = FALSE) {
  rows <- rows %||% list()
  n_filas <- length(rows)
  n_cols <- if (n_filas) {
    max(1L, max(vapply(rows, function(row) length(row %||% list()), integer(1))))
  } else {
    1L
  }
  requests <- c(
    monitoreo_aulas_sheets_formato_requests(
      hoja = tab_name, sheet_id = sheet_id, n_filas = n_filas, n_cols = n_cols,
      con_daa = con_daa
    ),
    monitoreo_aulas_sheets_validaciones_requests(
      hoja = tab_name, sheet_id = sheet_id, n_filas = n_filas,
      # Eslabones en la agenda, intentos en la hoja de campo: se leen del
      # ancho publicado, que es el rectángulo que de verdad viajó — con el
      # ancho condicional del cruce DAA cuando está activo (B8h fase 2).
      profundidad = .mafs_bloques(tab_name, n_cols, con_daa),
      con_daa = con_daa
    )
  )
  # B20: el desplegable del selector de día, con la geometría derivada de los
  # rows realmente publicados (monitoreo_aulas_plan_dia_selector.R).
  if (identical(tab_name, .malp_hoja_plan_dia())) {
    requests <- c(requests, .mapds_validacion_requests(sheet_id, rows))
  }
  # B19: bandas de título de bloque y cabeceras de tabla de «Avance de campo»,
  # fila a fila del contenido (monitoreo_aulas_avance_formato.R).
  if (identical(tab_name, .malp_hoja_avance())) {
    requests <- c(requests, .maaf_requests(sheet_id, rows))
  }
  # B14: los desplegables y calendarios de las pestañas Extra — los mismos
  # vocabularios, a la geometría del bloque único (carga_aulas_libro_extras.R).
  # Para cualquier otra pestaña devuelve vacío.
  c(requests, aulas_libro_extras_sheets_requests(sheet_id, tab_name, rows))
}

# --- el publicador ------------------------------------------------------------

#' Publica el libro de aulas en el Google Sheets del operativo.
#'
#' Produce las hojas del libro con los MISMOS generadores del `.xlsx`
#' (`aulas_libro_hoja_agendadas/aplicadas/control/plan_dia/avance`), así que lo
#' publicado se relee con `aulas_libro_leer_de_sheets()` sin configurar nada
#' («Plan del día» y «Avance de campo» son de ida: el lector las ignora). La
#' siembra va
#' en UNA llamada a `monitoreo_sheets_publish_tabs()` (un solo
#' values:batchUpdate); el ciclo sin cambios cuesta a lo más tres requests.
#'
#' @param spreadsheet_id id o enlace del documento destino.
#' @param plan filas del plan (formato largo, como `aulas_libro_generar`).
#' @param partes partes de campo ya registrados.
#' @param control filas de «Base de control» ya registradas.
#' @param efectivas vector con nombre: efectivas de plataforma por código.
#' @param cuotas bloque `design_targets` de la config de aulas, para el avance
#'   por facultad de «Avance de campo»; sin él ese bloque no se publica (la
#'   cuota no se reconstruye, misma regla que el xlsx).
#' @param traslape_daa vector nombrado por código operativo con el veredicto
#'   del cruce DAA (`aulas_daa_traslape`), o `NULL`. B8h fase 2: viaja a
#'   `aulas_libro_hoja_agendadas` —cada bloque gana la columna condicional— y
#'   TODA la geometría derivada (arrastre, desplegables, calendarios, bandas)
#'   se emite con el ancho corrido. Sin cruce, ni una request cambia.
#' @return lista con `ok`, `spreadsheet_id`, `spreadsheet_url`, `updated_at` y
#'   `hojas`: una entrada `{hoja, accion, filas}` por hoja del libro, con
#'   `accion` en `sembrada | actualizada | sin_cambios | respetada` y `filas`
#'   contando filas de datos (sin cabeceras del layout estándar).
#' @keywords internal
monitoreo_aulas_publicar_libro <- function(spreadsheet_id,
                                           plan = list(),
                                           partes = list(),
                                           control = list(),
                                           efectivas = NULL,
                                           cuotas = NULL,
                                           traslape_daa = NULL,
                                           disponibilidad = NULL,
                                           config_reparto = list()) {
  id <- .monitoreo_extract_spreadsheet_id(spreadsheet_id)
  if (!nzchar(id)) {
    stop_api(400, "E_SHEETS_SPREADSHEET",
             "Falta el identificador del Google Sheets del operativo de aulas.")
  }
  # El banco de extras sin usar no va a las hojas PRINCIPALES; misma regla que
  # el generador del `.xlsx` (y mismo E_* cuando no queda nada que publicar).
  # B14: ese banco gana sus dos hojas Extra propias, capturado del plan CRUDO
  # antes del filtro y ya ordenado (facultad alfabetica, dentro por codigo).
  extras <- aulas_libro_extras_banco(plan %||% list(), partes = partes, control = control)
  unidades <- .calg_unidades_del_libro(plan %||% list(), partes = partes, control = control)
  if (!length(unidades)) {
    stop_api(409, "E_AULAS_LIBRO_SIN_PLAN",
             "No hay plan de aulas del que publicar el libro.")
  }

  equipo <- .malp_hojas_equipo()
  hojas_app <- .malp_hojas_app()
  # B68: los values de la asignación se construyen sobre el plan CRUDO (el
  # mismo insumo que la pestaña de la app) con la config vigente del reparto;
  # NULL = sin disponibilidad = la hoja no juega esta publicación.
  valores_asignacion <- aulas_libro_valores_asignacion(
    plan %||% list(), disponibilidad, cfg = config_reparto
  )
  if (!is.null(valores_asignacion)) {
    hojas_app <- c(hojas_app, .malp_hoja_asignacion())
  }
  con_extras <- length(extras) > 0L
  # Cada hoja Extra INMEDIATAMENTE despues de su contraparte (decision del
  # lead, B14): este orden manda tanto en el resumen como en el orden de
  # creacion de pestañas nuevas. Sin extras, el juego es identico al de hoy.
  hojas_libro <- c(
    equipo[[1]],
    if (con_extras) AULAS_LIBRO_HOJA_AGENDADAS_EXTRA,
    equipo[[2]],
    if (con_extras) AULAS_LIBRO_HOJA_APLICADAS_EXTRA,
    hojas_app
  )
  # Dueño por hoja: las Extra son del EQUIPO igual que sus contrapartes —
  # siembra unica y `respetada` al republicar (contrato 4 de B14).
  hojas_equipo <- setdiff(hojas_libro, hojas_app)
  # B8h fase 2: el cruce DAA es condicional y su flag gobierna toda la
  # geometría derivada de agendadas (arrastre y formato). Las hojas Extra
  # quedan FUERA del cruce a propósito (cola declarada del lead).
  con_daa <- .calg_daa_activo(traslape_daa)
  producidas <- list()
  producidas[[equipo[[1]]]] <- .malp_df_a_values(
    aulas_libro_hoja_agendadas(unidades, traslape_daa = traslape_daa)
  )
  producidas[[equipo[[2]]]] <- .malp_df_a_values(aulas_libro_hoja_aplicadas(unidades, partes = partes))
  if (con_extras) {
    producidas[[AULAS_LIBRO_HOJA_AGENDADAS_EXTRA]] <-
      .malp_df_a_values(aulas_libro_hoja_agendadas_extra(extras))
    producidas[[AULAS_LIBRO_HOJA_APLICADAS_EXTRA]] <-
      .malp_df_a_values(aulas_libro_hoja_aplicadas_extra(extras, partes = partes))
  }
  producidas[[.malp_hoja_control()]] <- .malp_df_a_values(
    aulas_libro_hoja_control(unidades, control, efectivas, partes = partes)
  )
  # B20: en Sheets el plan del día viaja coronado por el bloque selector
  # («VER EL DÍA:» + área por fórmula, monitoreo_aulas_plan_dia_selector.R);
  # el listado se conserva completo debajo. El resumen cuenta filas del
  # LISTADO: el bloque es chrome del selector, no datos.
  plan_dia_listado <- .malp_df_a_values(
    aulas_libro_hoja_plan_dia(unidades, partes = partes)
  )
  producidas[[.malp_hoja_plan_dia()]] <- .mapds_con_selector(plan_dia_listado)
  # «Avance de campo» (B2.2) se computa con lo que ESTE punto sí tiene: plan +
  # partes + efectivas (+ cuotas del diseño cuando llegan). Sin responses ni
  # validas aquí — el diario de plataforma no es computable y la hoja lo
  # declara en una celda (C3) — y sin fecha inyectada: el corte se deriva del
  # modelo, nunca del reloj, o el motor batch+hash compararía dos
  # publicaciones del MISMO estado como distintas.
  producidas[[.malp_hoja_avance()]] <- .malp_df_a_values(
    aulas_libro_hoja_avance(aulas_libro_indicadores(
      unidades, efectivas = efectivas, partes = partes, cuotas = cuotas
    ))
  )
  if (!is.null(valores_asignacion)) {
    producidas[[.malp_hoja_asignacion()]] <- valores_asignacion
  }

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
  for (hoja in hojas_equipo) {
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
  # Las hojas de la APP siempre entran al motor: la regla de dueño de arriba no
  # las alcanza y el contenido remoto no las protege.
  app_nuevas <- stats::setNames(!(hojas_app %in% names(tab_map)), hojas_app)
  for (hoja in hojas_app) {
    tabs[[hoja]] <- producidas[[hoja]]
    filas[[hoja]] <- if (identical(hoja, .malp_hoja_plan_dia())) {
      # Filas de DATOS del listado: el bloque selector de B20 no es un dato.
      max(0L, length(plan_dia_listado) - .malp_cabeceras(hoja))
    } else {
      max(0L, length(producidas[[hoja]]) - .malp_cabeceras(hoja))
    }
  }

  # ¿Cambió el libro? Delta a nivel LIBRO contra los values REMOTOS (la verdad
  # observable, no la caché de metadata): una pestaña ausente o distinta de lo
  # producido cuenta como cambio. Decide la reasserción de la base de control.
  # La hoja de campo se compara con sus celdas de ARRASTRE enmascaradas (B9):
  # son derivadas por fórmula y la API devuelve su resultado computado, que ya
  # no coincide celda a celda con la copia de valores; sin la máscara cada
  # republicación sin cambios declararía «cambió». Su fuente («Aulas
  # Agendadas») sí se compara entera, así que una edición de agenda sigue
  # contando como cambio del libro.
  # «Plan del día» se compara con su bloque selector enmascarado (B20, mismo
  # trato que el arrastre): la celda elegible es del USUARIO y el área de la
  # fórmula vuelve COMPUTADA de la API — compararlas declararía «cambió» en
  # cada Recargar y la reasserción pisaría la elección. La geometría sale de
  # los values LOCALES y se aplica igual a ambos lados.
  bloques_arrastre <- .malar_bloques_arrastre(producidas[[equipo[[2]]]], unidades)
  # B14: la hoja de campo Extra arrastra igual que la principal (un bloque) y
  # su mascara geometrica cubre las mismas columnas derivadas — sin ella cada
  # republicacion sin cambios declararia «cambio» por las formulas computadas.
  bloques_arrastre_extra <- if (con_extras) {
    .malar_bloques_arrastre(producidas[[AULAS_LIBRO_HOJA_APLICADAS_EXTRA]], extras)
  } else {
    0L
  }
  geo_selector <- .mapds_geometria(producidas[[.malp_hoja_plan_dia()]])
  libro_cambio <- any(vapply(hojas_libro, function(hoja) {
    if (!(hoja %in% existentes)) return(TRUE)
    local_v <- producidas[[hoja]]
    remoto_v <- remotas[[hoja]]
    if (identical(hoja, equipo[[2]])) {
      local_v <- .malar_mascara_arrastre(local_v, bloques_arrastre)
      remoto_v <- .malar_mascara_arrastre(remoto_v, bloques_arrastre)
    }
    if (identical(hoja, AULAS_LIBRO_HOJA_APLICADAS_EXTRA)) {
      local_v <- .malar_mascara_arrastre(local_v, bloques_arrastre_extra)
      remoto_v <- .malar_mascara_arrastre(remoto_v, bloques_arrastre_extra)
    }
    if (identical(hoja, .malp_hoja_plan_dia())) {
      local_v <- .mapds_mascara(local_v, geo_selector)
      remoto_v <- .mapds_mascara(remoto_v, geo_selector)
    }
    !identical(.malp_canonizar(local_v), .malp_canonizar(remoto_v))
  }, logical(1)))

  # Directo a la implementación del motor y no al wrapper del engine: el
  # wrapper (`monitoreo_sheets_publish_tabs`, archivo congelado) no expone
  # `format_requests`, y sin él el batch-2 formatearía el libro con el
  # formateador genérico — freeze de 1 para todas las hojas y un ancho POR
  # COLUMNA, que es justo lo que esta capa reemplaza.
  # El closure fija `con_daa` para el batch-2: la firma del motor es
  # `(sheet_id, tab_name, rows)` y el flag no puede viajar por ella.
  formato_libro <- function(sheet_id, tab_name, rows) {
    .malp_formato_requests(sheet_id, tab_name, rows, con_daa = con_daa)
  }
  pub <- .monitoreo_sync_sheets_publish_tabs(id, tabs, format_requests = formato_libro)
  saltadas <- as.character(unlist(pub$skipped_tabs %||% list(), use.names = FALSE))

  for (hoja in names(tabs)) {
    if (hoja %in% hojas_app) next
    # Una sembrada que el motor saltó (metadata rancio sobre pestaña vaciada a
    # mano) no se declara sembrada: no se escribió nada.
    if (hoja %in% saltadas) acciones[[hoja]] <- "sin_cambios"
  }

  # B9 — el M4 de 2025: recién sembrada la hoja de campo, sus columnas de
  # agenda (ID MATCH + las 20 de cada bloque) se sobreescriben como FÓRMULAS de
  # arrastre a «Aulas Agendadas» vía values.update USER_ENTERED (ver
  # monitoreo_aulas_libro_arrastre.R). Solo en la siembra efectiva: una hoja
  # respetada no llega aquí y una que el motor saltó no recibió values.
  if (equipo[[2]] %in% names(tabs) && !(equipo[[2]] %in% saltadas)) {
    monitoreo_aulas_libro_arrastre_publicar(
      id, equipo[[2]], producidas[[equipo[[2]]]], unidades,
      hoja_agendadas = equipo[[1]],
      # B8h fase 2: con el cruce, el bloque b de agendadas vive +(b-1)
      # columnas más allá y las fórmulas se emiten corridas.
      con_daa = con_daa
    )
  }
  # B14: el MISMO arrastre para el par Extra, parametrizado por hoja origen y
  # destino — la maquinaria de monitoreo_aulas_libro_arrastre.R ya ancla por
  # codigo y los extras (un bloque, una fila por codigo) caen en su geometria.
  if (con_extras && AULAS_LIBRO_HOJA_APLICADAS_EXTRA %in% names(tabs) &&
      !(AULAS_LIBRO_HOJA_APLICADAS_EXTRA %in% saltadas)) {
    monitoreo_aulas_libro_arrastre_publicar(
      id, AULAS_LIBRO_HOJA_APLICADAS_EXTRA,
      producidas[[AULAS_LIBRO_HOJA_APLICADAS_EXTRA]], extras,
      hoja_agendadas = AULAS_LIBRO_HOJA_AGENDADAS_EXTRA
    )
  }
  for (hoja in hojas_app) {
    if (app_nuevas[[hoja]]) {
      acciones[[hoja]] <- "sembrada"
    } else if (!(hoja %in% saltadas)) {
      acciones[[hoja]] <- "actualizada"
    } else if (libro_cambio) {
      # El motor la saltó por hash pero el libro cambió: la hoja de la app se
      # reasserta (ver `.malp_hoja_app_forzada`).
      .malp_hoja_app_forzada(id, hoja, producidas[[hoja]])
      acciones[[hoja]] <- "actualizada"
    } else {
      acciones[[hoja]] <- "sin_cambios"
    }
  }
  # B20: toda escritura efectiva de «Plan del día» (siembra, actualización del
  # motor o reasserción) dejó vacía la celda de la fórmula del área — el batch
  # RAW no puede computarla. Se re-PUT-ea por el canal del arrastre
  # (USER_ENTERED). En un ciclo sin_cambios no se emite nada: la fórmula ya
  # vive en el documento.
  hoja_pd <- .malp_hoja_plan_dia()
  if (acciones[[hoja_pd]] %in% c("sembrada", "actualizada")) {
    .mapds_formula_publicar(id, hoja_pd, producidas[[hoja_pd]])
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

# --- el núcleo publicable desde una sesión ------------------------------------

#' Publica el libro de aulas al destino recordado con los insumos de la sesión.
#'
#' Extraído del mount de `/api/monitoreo/aulas/publicar-libro` (unidad B7) SIN
#' cambiar conducta, para que la conversación del sync
#' (`monitoreo_aulas_conversar_libro()`) publique por el MISMO camino que el
#' botón: mismos insumos, mismos E_* y misma traducción de errores del motor.
#'
#' Los insumos son los mismos que /aulas/generar-libro: el libro publicado y el
#' descargado tienen que decir lo mismo.
#'
#' @param sid sesión.
#' @param cfg config de monitoreo; por defecto la de la sesión.
#' @param destino id del documento; por defecto el recordado en `cfg`. Va como
#'   parámetro para que la conversación publique EXACTAMENTE donde leyó.
#' @return el resumen de `monitoreo_aulas_publicar_libro()`.
#' @keywords internal
monitoreo_aulas_publicar_libro_en_sesion <- function(sid, cfg = NULL, destino = "") {
  s <- session_get(sid)
  if (!is.list(cfg)) cfg <- s$monitoreo_config %||% list()
  destino <- .monitoreo_scalar(destino, "")
  if (!nzchar(destino)) destino <- monitoreo_aulas_libro_destino(cfg)
  if (!nzchar(destino)) {
    stop_api(400, "E_SHEETS_SPREADSHEET",
             "Falta el enlace del Google Sheets del operativo: pégalo una vez y queda recordado.")
  }

  aulas_cfg <- if (is.list(cfg[["aulas_universitarias"]])) cfg[["aulas_universitarias"]] else list()
  unidades <- s$monitoreo_aulas_plan %||% aulas_cfg[["plan"]] %||% list()
  if (!length(unidades)) {
    stop_api(409, "E_AULAS_LIBRO_SIN_PLAN",
             "No hay plan de aulas del que publicar el libro. Importa la seleccion de calculo de muestra primero.")
  }
  partes <- s$monitoreo_aulas_partes_campo %||% aulas_cfg[["partes_campo"]] %||% list()
  control <- s$monitoreo_aulas_control %||% aulas_cfg[["control"]] %||% list()
  # Silencio deliberado: las efectivas por aula son un ENRIQUECIMIENTO de
  # la Base de control (mismo trato que en /aulas/generar-libro) y exigen
  # snapshot sincronizado; un estudio sin sync aun debe poder publicar su
  # libro igual. El error del PUBLICADOR, en cambio, si se propaga abajo.
  efectivas <- tryCatch(
    monitoreo_aulas_efectivas_por_aula(
      unidades,
      (s$monitoreo_snapshot %||% list())$data,
      aulas_cfg
    ),
    error = function(e) NULL
  )

  # B8h fase 2 (decisión del lead, cerrada): el cruce DAA vive en la SESIÓN —
  # quien lo computa (hoy el runner de siembra) hace
  # `session_set(sid, "monitoreo_aulas_daa_traslape", tras)` con el output de
  # `aulas_daa_traslape` (vector nombrado por código). Nada de config ni
  # whitelist; sin la clave, NULL y el libro sale como siempre. `[[` y no `$`:
  # el `$` parcial-matchea. La conversación del sync hereda sola: publica por
  # esta misma función.
  traslape_daa <- s[["monitoreo_aulas_daa_traslape"]]

  tryCatch(
    monitoreo_aulas_publicar_libro(
      destino,
      plan = unidades,
      partes = partes,
      control = control,
      efectivas = efectivas,
      # Las cuotas del diseño, para el avance por facultad de «Avance de
      # campo»: el mismo bloque que /aulas/generar-libro pasa al xlsx.
      cuotas = aulas_cfg[["design_targets"]],
      traslape_daa = traslape_daa,
      # B68 tercera pata: el reparto de la hoja es el de la app — misma
      # disponibilidad de sesión y misma config vigente (fijadas, duración,
      # rango, semilla).
      disponibilidad = s[["monitoreo_aulas_disponibilidad"]],
      config_reparto = aulas_cfg
    ),
    # Un api_error del propio publicador conserva su código; solo los
    # errores crudos del motor/HTTP se visten de E_GOOGLE_SHEETS.
    api_error = function(e) stop(e),
    error = .monitoreo_sheets_stop
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
      cfg <- session_get(sid)$monitoreo_config %||% list()

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
      }

      out <- monitoreo_aulas_publicar_libro_en_sesion(sid, cfg)
      .monitoreo_mark_project_dirty_if_open(sid)
      aulas_cfg <- if (is.list(cfg[["aulas_universitarias"]])) cfg[["aulas_universitarias"]] else list()
      c(out, list(
        destino_guardado = destino_guardado,
        libro_sheets = aulas_cfg[["libro_sheets"]]
      ))
    }))
}
