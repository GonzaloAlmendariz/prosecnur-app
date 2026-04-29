// Código R que se ejecuta DENTRO de WebR cuando el dashboard corre en
// modo standalone (HTML autosuficiente exportado). Re-implementa el
// subset mínimo de los handlers del backend Plumber, pero asume que las
// variables globales `rp_data`, `rp_inst` y `dashboard_config` ya viven
// en `globalEnv` (las inyecta el bridge desde `window.PULSO_STANDALONE_PAYLOAD`).
//
// Mantenerlo compacto: cada función nueva agrega bytes al HTML exportado.
// Si una función crece mucho, vale la pena romperla en otro string y
// solo cargarla cuando el endpoint se invoque.

export const PULSO_R_RUNTIME = String.raw`
suppressMessages({ library(jsonlite); library(dplyr) })

\`%||%\` <- function(a, b) if (is.null(a) || (length(a) == 1L && is.na(a))) b else a

# ─────────────────────────────────────────────────────────────────────
# Helpers — espejos compactos de api/R/dashboard_pane.R / dashboard_resumen.R
# ─────────────────────────────────────────────────────────────────────

.label_col <- function(df) {
  if (is.null(df)) return(NULL)
  if ("label" %in% names(df)) return("label")
  hits <- grep("^label(::|$)", names(df), value = TRUE)
  if (length(hits)) hits[1] else NULL
}

.label_var <- function(var, rp_inst) {
  surv <- rp_inst$survey
  if (is.null(surv) || !"name" %in% names(surv)) return(var)
  i <- which(!is.na(surv$name) & surv$name == var)[1]
  if (is.na(i)) return(var)
  lc <- .label_col(surv)
  if (is.null(lc)) return(var)
  out <- as.character(surv[[lc]][i])
  if (is.na(out) || !nzchar(out)) var else out
}

.tipo_var <- function(var, df) {
  if (var %in% names(df)) {
    # tiene columna directa: probablemente SO. Pero si TAMBIÉN tiene dummies,
    # priorizamos SM.
    px_dot <- paste0("^", gsub("([\\W])", "\\\\\\1", paste0(var, ".")))
    if (any(grepl(px_dot, names(df)))) return("sm")
    px_sl <- paste0("^", gsub("([\\W])", "\\\\\\1", paste0(var, "/")))
    if (any(grepl(px_sl, names(df)))) return("sm")
    return("so")
  }
  # No hay columna directa pero podría haber dummies SM.
  px_dot <- paste0("^", gsub("([\\W])", "\\\\\\1", paste0(var, ".")))
  if (any(grepl(px_dot, names(df)))) return("sm")
  px_sl <- paste0("^", gsub("([\\W])", "\\\\\\1", paste0(var, "/")))
  if (any(grepl(px_sl, names(df)))) return("sm")
  "so"
}

.list_name_of <- function(var, rp_inst) {
  surv <- rp_inst$survey
  if (is.null(surv) || !"name" %in% names(surv) || !"list_name" %in% names(surv)) return(NULL)
  i <- which(!is.na(surv$name) & surv$name == var)[1]
  if (is.na(i)) return(NULL)
  ln <- as.character(surv$list_name[i])
  if (is.na(ln) || !nzchar(ln)) NULL else ln
}

.choices_for <- function(var, rp_inst) {
  ln <- .list_name_of(var, rp_inst)
  ch <- rp_inst$choices
  if (is.null(ln) || is.null(ch) || !"list_name" %in% names(ch)) return(NULL)
  ch_v <- ch[as.character(ch$list_name) == ln, , drop = FALSE]
  if (!nrow(ch_v)) return(NULL)
  lc <- .label_col(ch)
  if (is.null(lc)) return(NULL)
  stats::setNames(as.character(ch_v[[lc]]), as.character(ch_v$name))
}

# ── Filtros: aplica la lista de {var, valores} sobre el df ─────────
.apply_filtros <- function(df, filtros) {
  if (!is.list(filtros) || !length(filtros)) return(df)
  for (f in filtros) {
    var <- as.character(f$var %||% "")
    if (!nzchar(var) || !(var %in% names(df))) next
    vals <- as.character(unlist(f$valores %||% list()))
    if (!length(vals)) next
    df <- df[!is.na(df[[var]]) & as.character(df[[var]]) %in% vals, , drop = FALSE]
  }
  df
}

# ── Distribución SO ────────────────────────────────────────────────
.dist_so <- function(df, var, rp_inst) {
  if (!(var %in% names(df))) return(list())
  x <- as.character(df[[var]])
  x <- x[!is.na(x) & nzchar(x) & x != "NA"]
  if (!length(x)) return(list())
  map_lbl <- .choices_for(var, rp_inst)
  tab <- as.data.frame(table(x), stringsAsFactors = FALSE)
  names(tab) <- c("code", "n")
  tab$label <- vapply(tab$code, function(c) {
    lbl <- if (!is.null(map_lbl)) map_lbl[[c]] else NULL
    if (is.null(lbl) || !nzchar(lbl)) c else lbl
  }, character(1))
  tab$pct <- round(as.numeric(tab$n) / sum(as.numeric(tab$n)), 6)
  if (!is.null(map_lbl)) {
    orden <- unname(map_lbl)
    orden <- orden[!is.na(orden) & nzchar(orden)]
    if (length(orden)) {
      idx <- order(match(tab$label, orden, nomatch = .Machine$integer.max))
      tab <- tab[idx, , drop = FALSE]
    }
  }
  lapply(seq_len(nrow(tab)), function(k) list(
    code = as.character(tab$code[k]),
    label = as.character(tab$label[k]),
    n = as.integer(tab$n[k]),
    pct = as.numeric(tab$pct[k])
  ))
}

# ── Distribución SM (cada dummy) ───────────────────────────────────
.dist_sm <- function(df, var, rp_inst) {
  prefix_dot <- paste0(var, ".")
  cols <- grep(paste0("^", gsub("([\\W])", "\\\\\\1", prefix_dot)),
               names(df), value = TRUE)
  separator <- "."
  if (!length(cols)) {
    prefix_slash <- paste0(var, "/")
    cols <- grep(paste0("^", gsub("([\\W])", "\\\\\\1", prefix_slash)),
                 names(df), value = TRUE)
    if (length(cols)) separator <- "/"
  }
  if (!length(cols)) return(list())
  map_lbl <- .choices_for(var, rp_inst) %||% list()
  # Excluir dummies recod (mantener solo opciones del XLSForm).
  cols <- cols[!grepl("^recod(\\.[0-9]+)?$|_recod$",
    substring(cols, nchar(var) + nchar(separator) + 1L))]

  lapply(cols, function(col) {
    code <- substring(col, nchar(var) + nchar(separator) + 1L)
    lbl <- map_lbl[[code]]
    if (is.null(lbl) || !nzchar(lbl)) lbl <- code
    x <- df[[col]]
    x2 <- suppressWarnings(as.numeric(as.character(x)))
    if (all(is.na(x2)) && is.logical(x)) x2 <- as.numeric(x)
    ok <- !is.na(x2) & x2 %in% c(0, 1)
    x2 <- x2[ok]
    n_total <- length(x2)
    n_yes <- sum(x2 == 1)
    list(
      code = as.character(code),
      label = as.character(lbl),
      col_dummy = as.character(col),
      n_yes = as.integer(n_yes),
      n_total = as.integer(n_total),
      pct_yes = if (n_total) round(n_yes / n_total, 6) else 0
    )
  })
}

# ── Catálogo de secciones desde el XLSForm ─────────────────────────
.build_secciones <- function(rp_inst, rp_data) {
  surv <- rp_inst$survey
  if (is.null(surv) || !"name" %in% names(surv) || !"type" %in% names(surv)) {
    return(list())
  }
  is_section <- grepl("^begin", as.character(surv$type %||% ""))
  is_end <- grepl("^end", as.character(surv$type %||% ""))
  out <- list()
  current <- NULL
  for (i in seq_len(nrow(surv))) {
    nm <- as.character(surv$name[i])
    tp <- as.character(surv$type[i])
    if (is_section[i]) {
      current <- nm
      if (is.null(out[[current]])) out[[current]] <- character(0)
    } else if (is_end[i]) {
      current <- NULL
    } else if (!is.null(current) && nzchar(nm) && nm %in% names(rp_data)) {
      # Solo agregamos preguntas SO/SM; ignoramos calculate, note, etc.
      tp_clean <- sub(" .*$", "", tp)
      if (tp_clean %in% c("select_one", "select_multiple", "integer", "decimal", "text")) {
        out[[current]] <- c(out[[current]], nm)
      }
    }
  }
  out
}

.secciones_payload <- function() {
  secs <- .build_secciones(rp_inst, rp_data)
  if (!length(secs)) return(list(secciones = list(), kpi_vars = list()))
  list(
    secciones = unname(lapply(names(secs), function(sn) {
      list(
        nombre = sn,
        vars = lapply(secs[[sn]], function(v) list(
          name = v,
          label = .label_var(v, rp_inst),
          tipo = .tipo_var(v, rp_data)
        ))
      )
    })),
    kpi_vars = list()
  )
}

.list_name_payload <- function(var) {
  ln <- .list_name_of(var, rp_inst)
  if (is.null(ln)) "" else ln
}

# ── Resumen de una sección ─────────────────────────────────────────
.resumen_seccion <- function(seccion, filtros) {
  if (is.null(seccion) || !nzchar(seccion)) {
    return(list(seccion = "", n_total = 0L, rows = list()))
  }
  data <- .apply_filtros(rp_data, filtros)
  secs <- .build_secciones(rp_inst, rp_data)
  vars <- secs[[seccion]] %||% character(0)
  if (!length(vars)) return(list(seccion = seccion, n_total = nrow(data), rows = list()))

  # Aplicar overrides del config (excluir / relabel).
  overrides <- dashboard_config$dashboard_var_overrides %||% list()
  rows <- lapply(vars, function(var) {
    ov <- overrides[[var]]
    if (is.list(ov) && isFALSE(ov$enabled)) return(NULL)
    label <- if (is.list(ov) && is.character(ov$label) && nzchar(ov$label)) {
      as.character(ov$label)
    } else {
      .label_var(var, rp_inst)
    }
    tipo <- .tipo_var(var, data)
    row <- list(
      var = as.character(var),
      label = as.character(label),
      type = as.character(tipo),
      list_name = .list_name_payload(var)
    )
    if (identical(tipo, "so")) {
      row$dist <- .dist_so(data, var, rp_inst)
    } else {
      row$options <- .dist_sm(data, var, rp_inst)
    }
    row
  })
  rows <- Filter(Negate(is.null), rows)
  list(seccion = seccion, n_total = as.integer(nrow(data)), rows = rows)
}

# ── Manifest mínimo ────────────────────────────────────────────────
.manifest <- function() {
  enabled <- dashboard_config$tabs_enabled %||% list(
    resumen = TRUE, relaciones = FALSE, base_datos = FALSE, dimensiones = FALSE
  )
  tabs <- list(
    list(id = "resumen", label = "Resumen", available = TRUE, reason = NULL)
  )
  # En offline v1 solo Resumen está implementado. Los demás aparecen
  # como deshabilitados con un mensaje claro.
  if (isTRUE(enabled$relaciones)) {
    tabs <- c(tabs, list(list(id = "relaciones", label = "Relaciones", available = FALSE,
                              reason = "Disponible solo en la app de escritorio")))
  }
  if (isTRUE(enabled$dimensiones)) {
    tabs <- c(tabs, list(list(id = "dimensiones", label = "Dimensiones", available = FALSE,
                              reason = "Disponible solo en la app de escritorio")))
  }
  list(
    ready = TRUE,
    estado = list(tiene_data = TRUE, curacion_confirmed = TRUE),
    tabs = tabs
  )
}

# ─────────────────────────────────────────────────────────────────────
# Dispatcher — única puerta de entrada desde JS.
# JS llama: pulso_handle("manifest", "{}") → string JSON
# ─────────────────────────────────────────────────────────────────────
pulso_handle <- function(endpoint, body_json) {
  body <- if (is.character(body_json) && nzchar(body_json)) {
    tryCatch(jsonlite::fromJSON(body_json, simplifyVector = FALSE),
             error = function(e) list())
  } else list()

  out <- tryCatch({
    switch(endpoint,
      "manifest" = .manifest(),
      "config" = list(ok = TRUE, config = dashboard_config),
      "secciones" = c(list(ok = TRUE), .secciones_payload()),
      "resumen_seccion" = list(
        ok = TRUE,
        payload = .resumen_seccion(body$seccion %||% "", body$filtros %||% list())
      ),
      "resumen_kpis" = list(
        ok = TRUE,
        payload = list(n_total = as.integer(nrow(.apply_filtros(rp_data, body$filtros %||% list()))),
                       kpis = list())
      ),
      list(error = list(code = "E_OFFLINE_UNSUPPORTED",
                        message = paste("endpoint no soportado offline:", endpoint)))
    )
  }, error = function(e) {
    list(error = list(code = "E_OFFLINE_HANDLER", message = conditionMessage(e)))
  })

  jsonlite::toJSON(out, auto_unbox = TRUE, dataframe = "rows", null = "null", na = "null")
}
`;
