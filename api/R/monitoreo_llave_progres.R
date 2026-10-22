# =============================================================================
# monitoreo_llave_progres.R — «Código proGres» como llave de cruce de respaldo
# =============================================================================
#
# Contexto (ACNUR RMS 2026, checklist 1.1 y 1.2): el barrido trae la columna
# «Código proGres» y Kobo la variable `intro/Intro01` con esa misma etiqueta,
# pero el motor solo conocía la familia CodPulso/Pulso_code, así que sin declarar
# `key_rules` y `declared_person_code_var` ninguna respuesta cruzaba (0 de 180).
#
# Regla (opt-in por ausencia, así los proyectos existentes no mueven cifras):
# proGres es llave SOLO como respaldo.
#   - Barrido: si la tabla ya trae una columna de la familia Pulso/CodPulso, no se
#     usa.
#   - Respuestas: si hay una variable declarada (`declared_person_code_var`) que
#     existe en la tabla, o una columna de la familia Pulso, esas mandan.
# Una columna cuyo nombre o etiqueta habla de teléfono o correo no cuenta aunque
# contenga «progres».
#
# Plomería: `.monitoreo_report_key_details` vive aquí como envoltura. El cuerpo
# histórico quedó en monitoreo_engine.R con el nombre
# `.monitoreo_report_key_details_base` (archivo congelado a crecimiento: el
# engine solo cambia de nombre, no suma líneas) y esta envoltura le agrega las
# llaves proGres. Todos los llamadores (cruce telefónico, alertas, publicación)
# pasan por aquí sin cambiar.
# =============================================================================

.monitoreo_progres_texto <- function(x) {
  grepl("progres", .monitoreo_text_key(x), fixed = TRUE)
}

# Teléfono o correo: una columna así nunca es la llave proGres.
.monitoreo_progres_texto_contacto <- function(x) {
  grepl("telefono|celular|phone|fono|mail|correo|whatsapp", .monitoreo_text_key(x))
}

# Código plausible de proGres: alfanumérico de 6 a 14 caracteres sin guiones ni
# espacios (`CGU-26-7021494` pasa). No es el criterio «solo dígitos» del camino
# por etiqueta de la familia PUCP: el código proGres lleva letras.
.monitoreo_progres_valor_plausible <- function(value) {
  code <- gsub("[^A-Za-z0-9]+", "", as.character(value %||% ""))
  code[is.na(code)] <- ""
  nchar(code) >= 6L & nchar(code) <= 14L
}

# ¿La tabla ya tiene una llave "oficial" que debe mandar sobre proGres?
.monitoreo_progres_respaldo_permitido <- function(df, origin) {
  nms <- names(df)
  reales <- nms[!startsWith(nms, ".")]
  if (any(grepl("pulso", .monitoreo_text_key(reales), fixed = TRUE))) return(FALSE)
  if (identical(origin, "respuesta") && ".source_declared_person_code_var" %in% nms) {
    declaradas <- unique(trimws(as.character(df[[".source_declared_person_code_var"]])))
    declaradas <- declaradas[!is.na(declaradas) & nzchar(declaradas)]
    if (any(declaradas %in% nms)) return(FALSE)
  }
  TRUE
}

# Columnas candidatas a proGres (por nombre o por etiqueta de cualquier fuente).
.monitoreo_progres_columnas <- function(df, label_map, source_maps) {
  nms <- names(df)
  vapply(seq_along(nms), function(pos) {
    col <- nms[[pos]]
    if (startsWith(col, ".")) return(FALSE)
    etiquetas <- c(
      if (col %in% names(label_map)) as.character(label_map[[col]]) else character(0),
      unlist(lapply(source_maps, function(m) if (col %in% names(m)) as.character(m[[col]]) else character(0)), use.names = FALSE)
    )
    if (.monitoreo_progres_texto_contacto(col) || any(.monitoreo_progres_texto_contacto(etiquetas))) return(FALSE)
    .monitoreo_progres_texto(col) || any(.monitoreo_progres_texto(etiquetas))
  }, logical(1))
}

# Items de llave (mismo formato que `.monitoreo_report_key_details_base`) para
# las columnas proGres. Lista de largo `nrow(df)`; vacía por fila si no aplica.
.monitoreo_progres_items <- function(df, origin) {
  n <- nrow(df)
  out <- vector("list", n)
  label_map <- .monitoreo_variable_label_map(df)
  source_maps <- .monitoreo_source_variable_label_map(df)
  candidatas <- which(.monitoreo_progres_columnas(df, label_map, source_maps))
  if (!length(candidatas)) return(out)
  if (!.monitoreo_progres_respaldo_permitido(df, origin)) return(out)

  nms <- names(df)
  src <- if (".source_id" %in% nms) as.character(df[[".source_id"]]) else rep("", n)
  src[is.na(src)] <- ""
  for (pos in candidatas) {
    col <- nms[[pos]]
    fallback <- if (col %in% names(label_map)) .monitoreo_scalar(label_map[[col]], "") else ""
    valores <- trimws(as.character(df[[pos]] %||% ""))
    valores[is.na(valores)] <- ""
    filas <- which(nzchar(valores) & .monitoreo_progres_valor_plausible(valores))
    if (!length(filas)) next
    # La etiqueta se resuelve una vez por fuente, no por fila.
    etiqueta_fuente <- vapply(unique(src[filas]), function(sid) {
      lab <- if (nzchar(sid) && !is.null(source_maps[[sid]]) && col %in% names(source_maps[[sid]])) {
        .monitoreo_scalar(source_maps[[sid]][[col]], "")
      } else ""
      if (nzchar(lab)) lab else fallback
    }, character(1))
    for (i in filas) {
      etiqueta <- etiqueta_fuente[[src[[i]]]]
      if (.monitoreo_progres_texto_contacto(etiqueta)) next
      if (!(.monitoreo_progres_texto(col) || .monitoreo_progres_texto(etiqueta))) next
      claves <- .monitoreo_code_keys(valores[[i]])
      for (clave in claves) {
        out[[i]] <- c(out[[i]], list(list(
          key = clave,
          type = "codigo",
          column = col,
          label = if (nzchar(etiqueta)) etiqueta else col,
          value = valores[[i]],
          configured = FALSE
        )))
      }
    }
  }
  out
}

# ¿Este conjunto de filas se cruza hoy por una columna proGres de respaldo?
.monitoreo_progres_en_uso <- function(df, origin) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(FALSE)
  any(lengths(.monitoreo_progres_items(df, origin)) > 0L)
}

.monitoreo_report_key_details <- function(df, profile = list(), origin = c("universo", "respuesta")) {
  origin <- match.arg(origin)
  base <- .monitoreo_report_key_details_base(df, profile, origin)
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(base)
  extra <- .monitoreo_progres_items(df, origin)
  if (!any(lengths(extra) > 0L)) return(base)
  lapply(seq_len(nrow(df)), function(i) {
    items <- c(base[[i]], extra[[i]])
    if (!length(extra[[i]])) return(base[[i]])
    seen <- character(0)
    keep <- list()
    for (item in items) {
      huella <- paste(item$key %||% "", item$column %||% "", item$value %||% "", sep = "\r")
      if (huella %in% seen) next
      seen <- c(seen, huella)
      keep[[length(keep) + 1L]] <- item
    }
    if (length(keep) > 1L) {
      ranks <- vapply(keep, .monitoreo_report_key_detail_rank, integer(1))
      keep <- keep[order(ranks, seq_along(keep))]
    }
    keep
  })
}
