# =============================================================================
# monitoreo_publicar_ensayo.R — Salidas › Publicar con ensayo Revisar → Aplicar
# (Meta B, L38, fila 12 de la auditoría).
#
# Regla de L38: nada se escribe hacia afuera sin un ensayo previo que diga qué
# filas se añaden, cambian y borran, y qué hojas encogen. Este archivo tiene las
# tres capas separadas, como pide el contrato de integraciones:
#
#   1. Destino (lo que se publicará). `monitoreo_publicar_destino_*` arman el
#      MISMO `tabs` que escribe cada endpoint de publicación. Los endpoints de
#      Aplicar y de Revisar los llaman a los dos, así que el ensayo no puede
#      describir otra cosa que lo que Aplicar escribe.
#   2. Transporte + traducción del proveedor. `.mpe_leer_libro()` lee metadata y
#      values por las funciones existentes (`.monitoreo_sheets_metadata`,
#      `.monitoreo_sync_sheets_valores_remotos`, que van por
#      `.monitoreo_google_api`); no hay cliente HTTP nuevo. `.mpe_filas_texto()`
#      traduce `values` (filas de largo desigual, cola vacía omitida) a filas de
#      texto.
#   3. Normalización / comparación. `monitoreo_publicar_ensayo_comparar()` es
#      pura: recibe filas de texto y devuelve el diff de una pestaña.
#
# Grano (contrato del lead, dominio-prosecnur): cada pestaña de `names(tabs)` se
# sobrescribe ENTERA. La identidad de fila es la primera columna cuando es única
# y no vacía a los dos lados; si no, se compara la fila completa como
# multiconjunto y solo hay añadidas y borradas (`sin_clave = TRUE`). La cabecera
# (fila 1) se compara aparte. Las pestañas del libro fuera de `names(tabs)` son
# ajenas: nunca se tocan y el ensayo las lista como intactas.
#
# El ensayo NO escribe nada y no toca secretos: la credencial la resuelve
# `.monitoreo_google_api` como siempre.
# =============================================================================

# ---------- 1. Destino: lo que escribirá cada publicación ----------

# `POST /api/monitoreo/sheets/publish` (publicación interna de pestañas).
monitoreo_publicar_destino_interno <- function(sid, s, parsed = list()) {
  snapshot <- s$monitoreo_snapshot %||% NULL
  if (is.null(snapshot) || !is.data.frame(snapshot$data)) {
    stop_api(409, "E_NO_MONITOREO_DATA", "Sincroniza datos antes de publicar pestanas Prosecnur.")
  }
  cfg <- monitoreo_normalize_config(parsed$config %||% s$monitoreo_config %||% list(), snapshot$data)
  spreadsheet_id <- .monitoreo_resolve_publication_spreadsheet_id(parsed, s, "internal")
  if (!nzchar(spreadsheet_id)) stop_api(400, "E_SHEETS_SPREADSHEET", "Falta spreadsheet_id destino.")
  monitoreo_guarda_destino_no_barrido(s, spreadsheet_id, "la base de control")
  tabs <- .monitoreo_sheets_publish_payload(snapshot, cfg)
  list(
    spreadsheet_id = spreadsheet_id,
    tabs = tabs,
    event_key = "monitoreo_sheet_publish_events",
    event_extra = list(tabs = names(tabs))
  )
}

# `POST /api/monitoreo/client-report/sheets/publish` (reporte a cliente).
monitoreo_publicar_destino_cliente <- function(sid, s, parsed = list()) {
  snapshot <- monitoreo_client_snapshot_with_carga_universe(s$monitoreo_snapshot %||% NULL, s)
  cfg <- monitoreo_normalize_config(parsed$config %||% s$monitoreo_config %||% list(), snapshot$data %||% data.frame())
  include_targets <- .monitoreo_bool(parsed$include_targets %||% parsed$includeTargets, FALSE)
  model <- .monitoreo_client_report_model_for_snapshot(snapshot, cfg, include_targets = include_targets,
                                                      padron = s[["monitoreo_aulas_padron"]])
  spreadsheet_id <- .monitoreo_resolve_publication_spreadsheet_id(parsed, s, "client")
  if (!nzchar(spreadsheet_id)) stop_api(400, "E_SHEETS_SPREADSHEET", "Falta spreadsheet_id destino para el reporte a cliente.")
  monitoreo_guarda_destino_no_barrido(s, spreadsheet_id, "el reporte a cliente")
  tabs <- .monitoreo_client_report_tabs_payload(model)
  list(
    spreadsheet_id = spreadsheet_id,
    tabs = tabs,
    event_key = "monitoreo_client_report_sheet_events",
    event_extra = list(tabs = names(tabs), include_targets = include_targets)
  )
}

# `POST /api/monitoreo/publication/sheets` (el que usa Avance › Salidas, cliente
# e interno según `audience`). Un preflight bloqueado frena igual al ensayo que
# a la publicación: no se revisa lo que no se puede aplicar.
monitoreo_publicar_destino_publicacion <- function(sid, s, parsed = list()) {
  snapshot <- s$monitoreo_snapshot %||% NULL
  if (is.null(snapshot) || !is.data.frame(snapshot$data) || !nrow(snapshot$data)) {
    stop_api(409, "E_NO_MONITOREO_DATA", "Sincroniza datos antes de publicar el ejecutivo en Sheets.")
  }
  audience <- .monitoreo_public_audience(parsed$audience %||% parsed$public_audience %||% parsed$publicAudience)
  spreadsheet_id <- .monitoreo_resolve_publication_spreadsheet_id(parsed, s, audience)
  if (!nzchar(spreadsheet_id)) stop_api(400, "E_SHEETS_SPREADSHEET", "Falta spreadsheet_id destino para publicar el ejecutivo en Sheets.")
  monitoreo_guarda_destino_no_barrido(s, spreadsheet_id, "el ejecutivo")
  bundle <- .monitoreo_publication_preflight_bundle(sid, s, snapshot, parsed,
                                                    audience = audience, spreadsheet_id = spreadsheet_id)
  if (identical(bundle$preflight$status, "blocked")) {
    stop_api(409, "E_MONITOREO_PREFLIGHT_BLOCKED", "El preflight de entregables bloquea esta publicación.",
             details = list(preflight = bundle$preflight))
  }
  tabs <- bundle$tabs
  list(
    spreadsheet_id = spreadsheet_id,
    tabs = tabs,
    audience = audience,
    preflight = bundle$preflight,
    event_key = paste0("monitoreo_publication_sheet_events_", audience),
    event_extra = list(
      audience = audience,
      tabs = names(tabs),
      include_targets = bundle$include_targets,
      confirmed_full_data = .monitoreo_publication_confirmed_full_data(parsed),
      preflight = bundle$preflight$scorecard
    )
  )
}

# ---------- 2. Transporte y traducción del proveedor ----------

# Una celda del API (o del rectángulo local) a texto. Sheets devuelve el valor
# FORMATEADO; la app publica con RAW y casi todos los productores emiten texto,
# así que el texto es la forma común de los dos lados.
.mpe_celda_texto <- function(v) {
  if (is.null(v) || !length(v)) return("")
  x <- v[[1L]]
  if (is.null(x) || (length(x) == 1L && is.na(x))) return("")
  if (is.numeric(x)) return(format(x, scientific = FALSE, trim = TRUE, digits = 15))
  as.character(x)
}

# Fila del API → vector de texto sin la cola vacía (Sheets la omite; el
# rectángulo local la rellena con ""). Así una fila corta del API y la misma
# fila rellenada localmente son iguales.
.mpe_fila_texto <- function(row) {
  celdas <- vapply(unname(as.list(row %||% list())), .mpe_celda_texto, character(1))
  n <- length(celdas)
  while (n > 0L && !nzchar(trimws(celdas[[n]]))) n <- n - 1L
  celdas[seq_len(n)]
}

.mpe_filas_texto <- function(values) {
  lapply(values %||% list(), .mpe_fila_texto)
}

# El rectángulo que Aplicar escribiría, en la misma traducción que el remoto.
.mpe_filas_locales <- function(tab_rows) {
  .mpe_filas_texto(.monitoreo_sync_sheets_padded_rows(.monitoreo_sheets_values_rows(tab_rows)))
}

# Clasifica el fallo de la lectura y lo devuelve como error de API registrado.
# Ninguno publica nada: el ensayo solo lee.
.mpe_stop <- function(e) {
  if (inherits(e, "api_error")) stop(e)
  switch(
    .monitoreo_google_error_tipo(e),
    rate_limit = stop_api(429, "E_SHEETS_RATE_LIMIT",
                          "Google Sheets pidió esperar antes de seguir leyendo. Vuelve a revisar en un minuto; no se publicó nada."),
    timeout = stop_api(504, "E_SHEETS_TIMEOUT",
                       "Google Sheets no respondió a tiempo. No se publicó nada."),
    credencial = stop_api(401, "E_SHEETS_CREDENCIAL",
                          "Google Sheets rechazó la credencial o el permiso sobre el documento. Vuelve a autorizar Google Sheets; no se publicó nada."),
    stop_api(400, "E_GOOGLE_SHEETS", conditionMessage(e))
  )
}

# Lee el libro destino: títulos de todas sus pestañas y los values de las que la
# publicación escribiría. Un nombre ausente en `valores` con la pestaña
# existente es una lectura incompleta, y sobre ella no se puede prometer nada.
.mpe_leer_libro <- function(spreadsheet_id, tab_names) {
  lectura <- tryCatch({
    tab_map <- .monitoreo_sheets_tab_map(.monitoreo_sheets_metadata(spreadsheet_id))
    existentes <- intersect(tab_names, names(tab_map))
    list(
      titulos = names(tab_map),
      existentes = existentes,
      valores = .monitoreo_sync_sheets_valores_remotos(spreadsheet_id, existentes)
    )
  }, error = .mpe_stop)
  faltan <- setdiff(lectura$existentes, names(lectura$valores))
  if (length(faltan)) {
    stop_api(502, "E_SHEETS_ENSAYO_INCOMPLETO",
             sprintf("Google Sheets no devolvió el contenido de %s. No se publicó nada; vuelve a revisar.",
                     paste(faltan, collapse = ", ")),
             details = list(pestanas = as.list(faltan)))
  }
  lectura
}

# ---------- 3. Normalización y comparación (pura) ----------

.mpe_tiene_contenido <- function(fila) any(nzchar(trimws(fila)))

.mpe_rellenar <- function(fila, ancho) {
  if (length(fila) < ancho) c(fila, rep("", ancho - length(fila))) else fila
}

.mpe_firma_fila <- function(fila) paste(fila, collapse = "\u001f")

.mpe_nombre_columna <- function(cabecera, j) {
  nombre <- if (j <= length(cabecera)) trimws(cabecera[[j]]) else ""
  if (nzchar(nombre)) nombre else sprintf("Columna %d", j)
}

# Diff de UNA pestaña. `actual` y `nuevo`: listas de filas de texto con la
# cabecera en la fila 1 (`list()` = pestaña vacía o inexistente).
monitoreo_publicar_ensayo_comparar <- function(actual, nuevo, limite_detalle = 50L) {
  actual <- actual %||% list()
  nuevo <- nuevo %||% list()
  cab_a <- if (length(actual)) actual[[1L]] else character(0)
  cab_n <- if (length(nuevo)) nuevo[[1L]] else character(0)
  datos_a <- Filter(.mpe_tiene_contenido, if (length(actual) > 1L) actual[-1L] else list())
  datos_n <- Filter(.mpe_tiene_contenido, if (length(nuevo) > 1L) nuevo[-1L] else list())
  ancho_a <- max(0L, lengths(c(list(cab_a), datos_a)))
  ancho_n <- max(0L, lengths(c(list(cab_n), datos_n)))
  ancho <- max(1L, ancho_a, ancho_n)
  datos_a <- lapply(datos_a, .mpe_rellenar, ancho)
  datos_n <- lapply(datos_n, .mpe_rellenar, ancho)

  # Cabecera aparte: columnas cuyo rótulo cambia, aparece o desaparece.
  ca <- .mpe_rellenar(cab_a, ancho)
  cn <- .mpe_rellenar(cab_n, ancho)
  columnas_cambiadas <- lapply(which(ca != cn), function(j) {
    list(columna = j, antes = ca[[j]], despues = cn[[j]])
  })

  clave_a <- vapply(datos_a, function(f) f[[1L]], character(1))
  clave_n <- vapply(datos_n, function(f) f[[1L]], character(1))
  con_clave <- !anyDuplicated(clave_a) && !anyDuplicated(clave_n) &&
    all(nzchar(trimws(clave_a))) && all(nzchar(trimws(clave_n)))

  recorte <- function(x) utils::head(x, limite_detalle)
  fila_det <- function(f) list(clave = f[[1L]], valores = as.list(f))
  if (con_clave) {
    idx_add <- which(!clave_n %in% clave_a)
    idx_del <- which(!clave_a %in% clave_n)
    comunes <- intersect(clave_n, clave_a)
    cambios <- list()
    for (k in comunes) {
      fa <- datos_a[[match(k, clave_a)]]
      fn <- datos_n[[match(k, clave_n)]]
      js <- which(fa != fn)
      if (length(js)) {
        cambios[[length(cambios) + 1L]] <- list(
          clave = k,
          celdas = lapply(js, function(j) list(columna = .mpe_nombre_columna(cn, j), antes = fa[[j]], despues = fn[[j]]))
        )
      }
    }
    anadidas <- lapply(datos_n[idx_add], fila_det)
    borradas <- lapply(datos_a[idx_del], fila_det)
  } else {
    # Multiconjunto de filas completas: una fila repetida cuenta tantas veces
    # como aparece.
    fa <- vapply(datos_a, .mpe_firma_fila, character(1))
    fn <- vapply(datos_n, .mpe_firma_fila, character(1))
    sobrante <- function(de, contra, filas) {
      quedan <- table(contra)
      out <- list()
      for (i in seq_along(de)) {
        f <- de[[i]]
        if (!is.na(quedan[f]) && quedan[[f]] > 0L) {
          quedan[[f]] <- quedan[[f]] - 1L
        } else {
          out[[length(out) + 1L]] <- fila_det(filas[[i]])
        }
      }
      out
    }
    anadidas <- sobrante(fn, fa, datos_n)
    borradas <- sobrante(fa, fn, datos_a)
    cambios <- list()
  }

  filas_antes <- .monitoreo_sync_sheets_filas_con_contenido(actual)
  filas_despues <- .monitoreo_sync_sheets_filas_con_contenido(nuevo)
  encoge <- length(actual) > 0L && (filas_despues < filas_antes || ancho_n < ancho_a)
  n_add <- length(anadidas)
  n_chg <- length(cambios)
  n_del <- length(borradas)
  list(
    clave = if (con_clave) .mpe_nombre_columna(cn, 1L) else "",
    sin_clave = !con_clave,
    anadidas = n_add,
    cambiadas = n_chg,
    borradas = n_del,
    columnas_cambiadas = columnas_cambiadas,
    filas_antes = filas_antes,
    filas_despues = filas_despues,
    columnas_antes = ancho_a,
    columnas_despues = ancho_n,
    encoge = encoge,
    destructiva = n_del > 0L || encoge,
    sin_cambios = n_add == 0L && n_chg == 0L && n_del == 0L && !length(columnas_cambiadas) && !encoge,
    detalle = list(anadidas = recorte(anadidas), cambiadas = recorte(cambios), borradas = recorte(borradas)),
    detalle_truncado = max(n_add, n_chg, n_del) > limite_detalle
  )
}

# ---------- Ensayo completo ----------

# Lee el libro, compara cada pestaña que se escribiría y lista las ajenas. No
# escribe nada. `firma` identifica el contenido revisado (hash del payload).
monitoreo_publicar_ensayo <- function(spreadsheet_id, tabs, limite_detalle = 50L) {
  spreadsheet_id <- .monitoreo_extract_spreadsheet_id(spreadsheet_id)
  if (!nzchar(spreadsheet_id)) stop_api(400, "E_SHEETS_SPREADSHEET", "Falta spreadsheet_id destino.")
  tab_names <- names(tabs) %||% character(0)
  tryCatch(.monitoreo_sheets_validate_controlled_tabs(tab_names),
           error = function(e) stop_api(400, "E_GOOGLE_SHEETS", conditionMessage(e)))
  lectura <- .mpe_leer_libro(spreadsheet_id, tab_names)
  pestanas <- lapply(tab_names, function(tab_name) {
    existe <- tab_name %in% lectura$existentes
    actual <- if (existe) .mpe_filas_texto(lectura$valores[[tab_name]]) else list()
    diff <- monitoreo_publicar_ensayo_comparar(actual, .mpe_filas_locales(tabs[[tab_name]]), limite_detalle)
    c(list(pestana = tab_name, se_crea = !existe), diff)
  })
  suma <- function(campo) sum(vapply(pestanas, function(p) as.integer(p[[campo]]), integer(1)))
  intactas <- setdiff(lectura$titulos, tab_names)
  list(
    ok = TRUE,
    spreadsheet_id = spreadsheet_id,
    spreadsheet_url = paste0("https://docs.google.com/spreadsheets/d/", spreadsheet_id, "/edit"),
    generado_en = .monitoreo_now_iso(),
    firma = if (requireNamespace("digest", quietly = TRUE)) digest::digest(tabs, algo = "sha256") else "",
    pestanas = pestanas,
    intactas = as.list(intactas),
    resumen = list(
      anadidas = suma("anadidas"),
      cambiadas = suma("cambiadas"),
      borradas = suma("borradas"),
      pestanas_nuevas = suma("se_crea"),
      pestanas_que_encogen = suma("encoge"),
      destructivo = any(vapply(pestanas, function(p) isTRUE(p$destructiva), logical(1)))
    )
  )
}
