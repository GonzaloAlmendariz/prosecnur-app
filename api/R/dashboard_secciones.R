# ============================================================
# Construcción de "secciones del cuestionario" para el Dashboard.
#
# El paquete legacy `reporte_interactivo()` consume `secciones_limpias`
# como `list(nombre = c("v1","v2"), ...)`. Aquí derivamos eso desde el
# rp_inst del proyecto (idéntica lógica de walk begin/end_group que ya
# usa `.detect_secciones_analitica` en router_analitica.R:53).
#
# Diferencia respecto a Analítica:
# - Analítica devuelve `[{id, nombre, variables, oculto, orden}]` (lo
#   consume el frontend para la UI de gestión de secciones).
# - Dashboard devuelve `list(nombre -> vars)` filtrado contra `data` —
#   exactamente el shape que `.interactivo_resumen_build_rows` espera.
# ============================================================

# ------------------------------------------------------------
# Walk del survey por begin_group / end_group, asignando cada variable
# data al group más interno. Filtra contra `data` y descarta secciones
# vacías. Mismo algoritmo que .detect_secciones_analitica pero retorna
# shape `secciones_limpias` (nombrado).
.dashboard_build_secciones <- function(rp_inst, df) {
  if (is.null(rp_inst) || is.null(df)) return(list())
  sv <- rp_inst$survey
  if (is.null(sv) || nrow(sv) == 0L || !"name" %in% names(sv)) return(list())

  # Etiqueta preferida desde survey_raw label::Spanish, si existe.
  label_raw <- rep("", nrow(sv))
  if (!is.null(rp_inst$survey_raw)) {
    lab_idx <- grep("^label", tolower(names(rp_inst$survey_raw)))
    if (length(lab_idx) > 0L) {
      sp_idx <- grep("spanish|español", tolower(names(rp_inst$survey_raw)[lab_idx]))
      pick <- if (length(sp_idx) > 0L) lab_idx[sp_idx[1]] else lab_idx[1]
      lab_col <- as.character(rp_inst$survey_raw[[pick]])
      if (length(lab_col) == nrow(sv)) label_raw <- lab_col
    }
  }
  if (all(label_raw == "") && "label" %in% names(sv)) label_raw <- as.character(sv$label)
  label_raw[is.na(label_raw)] <- ""
  Encoding(label_raw) <- "UTF-8"

  stack_label <- character(0)
  out <- list()  # nombre -> character vector de vars en orden de aparición

  for (i in seq_len(nrow(sv))) {
    t <- as.character(sv$type[i] %||% "")
    nm <- as.character(sv$name[i] %||% "")
    lb <- label_raw[i]
    if (t == "begin_group" || t == "begin_repeat") {
      stack_label <- c(stack_label, if (nzchar(lb)) lb else nm)
    } else if (t == "end_group" || t == "end_repeat") {
      if (length(stack_label) > 0L) {
        stack_label <- stack_label[-length(stack_label)]
      }
    } else if (nzchar(nm)) {
      sec_label <- if (length(stack_label) > 0L) stack_label[length(stack_label)] else "General"
      if (is.null(out[[sec_label]])) out[[sec_label]] <- character(0)
      out[[sec_label]] <- c(out[[sec_label]], nm)
    }
  }

  # Filtrar contra columnas presentes en `data`. Para SM, la madre puede
  # NO existir como columna en df (vienen las dummies var.opt). Mantener
  # la madre si al menos una dummy `var.opt` o `var/opt` está en df.
  sm_madres <- .dashboard_sm_madres(rp_inst)
  out <- lapply(out, function(vs) {
    vs <- unique(vs)
    keep <- vs[vs %in% names(df)]
    falt <- setdiff(vs, keep)
    if (length(falt)) {
      falt_sm <- intersect(falt, sm_madres)
      falt_sm <- falt_sm[vapply(falt_sm, function(v) {
        prefix1 <- paste0("^", gsub("([\\W])", "\\\\\\1", paste0(v, ".")))
        prefix2 <- paste0("^", gsub("([\\W])", "\\\\\\1", paste0(v, "/")))
        any(grepl(prefix1, names(df))) || any(grepl(prefix2, names(df)))
      }, logical(1))]
      keep <- c(keep, falt_sm)
    }
    unique(keep)
  })

  # Descartar secciones vacías.
  out[vapply(out, length, integer(1)) > 0L]
}

# ------------------------------------------------------------
# Payload para GET /api/dashboard/secciones — el frontend lo usa para
# poblar selectores y conocer los tipos.
.dashboard_secciones_payload <- function(s) {
  s <- .dashboard_ctx(s)
  if (is.null(s$rp_data) || is.null(s$rp_inst)) {
    return(list(secciones = list(), kpi_vars = list()))
  }
  secs <- .dashboard_visible_secciones(s)
  if (!length(secs)) return(list(secciones = list(), kpi_vars = list()))

  surv <- s$rp_inst$survey
  sm_madres <- .dashboard_sm_madres(s$rp_inst)

  out <- lapply(seq_along(secs), function(i) {
    nombre <- names(secs)[i]
    vars <- secs[[i]]
    list(
      nombre = nombre,
      vars = lapply(vars, function(v) {
        list(
          name = v,
          label = .dashboard_var_label_override(s, v) %||% .obtener_label_var(v, s$rp_inst, s$rp_data),
          tipo = .dashboard_tipo_pregunta(v, s$rp_inst, s$rp_data)
        )
      })
    )
  })

  # KPI vars: heurística simple — primeras 1-2 vars SO en la primera
  # sección con nivel bajo de categorías. Tras bambalinas el paquete
  # decidirá esto mejor; por ahora derivamos defaults razonables.
  kpi_vars <- character(0)
  for (sec in secs) {
    for (v in sec) {
      tipo <- .dashboard_tipo_pregunta(v, s$rp_inst, s$rp_data)
      if (identical(tipo, "so") && v %in% names(s$rp_data)) {
        x <- as.character(s$rp_data[[v]])
        x <- x[!is.na(x) & nzchar(x)]
        n_u <- length(unique(x))
        if (n_u >= 2L && n_u <= 8L) {
          kpi_vars <- c(kpi_vars, v)
          if (length(kpi_vars) >= 2L) break
        }
      }
    }
    if (length(kpi_vars) >= 2L) break
  }

  list(
    secciones = out,
    kpi_vars = as.list(kpi_vars)
  )
}

# ------------------------------------------------------------
# Catálogo de categorías de una variable — para poblar selectores de
# filtros en el frontend (espejo de .catalogo_categorias_filtro del
# legacy en interactivo_resumen.R:524).
.dashboard_categorias_var <- function(var, rp_inst, df) {
  if (!nzchar(var) || !(var %in% names(df))) return(list())
  vals_obs <- trimws(as.character(df[[var]]))
  vals_obs <- vals_obs[!is.na(vals_obs) & nzchar(vals_obs) & vals_obs != "NA"]
  vals_obs <- unique(vals_obs)

  out <- data.frame(value = character(0), label = character(0),
                    stringsAsFactors = FALSE)
  sv <- rp_inst$survey
  ch <- rp_inst$choices
  label_col <- if (!is.null(ch) && "label" %in% names(ch)) "label"
               else if (!is.null(ch)) grep("^label(::|$)", names(ch), value = TRUE)[1]
               else NULL

  if (!is.null(sv) && !is.null(ch) &&
      all(c("name", "list_name") %in% names(sv)) &&
      all(c("name", "list_name") %in% names(ch)) &&
      !is.null(label_col) && !is.na(label_col) && label_col %in% names(ch)) {
    i <- which(!is.na(sv$name) & sv$name == var)[1]
    if (!is.na(i)) {
      ln <- as.character(sv$list_name[i])
      if (!is.na(ln) && nzchar(ln)) {
        ch_v <- ch[ch$list_name == ln, , drop = FALSE]
        if (nrow(ch_v)) {
          out <- data.frame(
            value = as.character(ch_v$name),
            label = as.character(ch_v[[label_col]]),
            stringsAsFactors = FALSE
          )
          out$label[is.na(out$label) | !nzchar(trimws(out$label))] <-
            out$value[is.na(out$label) | !nzchar(trimws(out$label))]
        }
      }
    }
  }

  if (!nrow(out)) {
    labs_attr <- attr(df[[var]], "labels", exact = TRUE)
    if (!is.null(labs_attr) && length(labs_attr) > 0L) {
      out <- data.frame(
        value = as.character(names(labs_attr)),
        label = as.character(unname(labs_attr)),
        stringsAsFactors = FALSE
      )
    }
  }

  extra <- setdiff(vals_obs, out$value)
  if (length(extra)) {
    out <- rbind(out, data.frame(value = extra, label = extra,
                                 stringsAsFactors = FALSE))
  }
  out <- out[!duplicated(out$value), , drop = FALSE]
  lapply(seq_len(nrow(out)), function(k) {
    list(value = out$value[k], label = out$label[k])
  })
}
