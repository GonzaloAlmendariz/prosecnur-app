# Helpers para clasificacion de modalidad en reporte_enumeradores()

#' @keywords internal
.enum_norm_text <- function(x) {
  x <- as.character(x)
  x[is.na(x)] <- ""
  x <- trimws(x)
  x <- stringi::stri_trans_general(x, "Latin-ASCII")
  tolower(x)
}

#' @keywords internal
.enum_resolve_col_alias <- function(key, data_names) {
  key <- as.character(key)[1]
  if (!nzchar(trimws(key))) return(NA_character_)

  if (key %in% data_names) return(key)

  key_norm <- .enum_norm_text(key)
  names_norm <- .enum_norm_text(data_names)

  hit <- which(names_norm == key_norm)
  if (length(hit)) return(data_names[[hit[1]]])

  # Intento simple para plural -> singular (ej. "distritos" -> "distrito")
  if (grepl("s$", key_norm)) {
    key_singular <- sub("s$", "", key_norm)
    hit2 <- which(names_norm == key_singular)
    if (length(hit2)) return(data_names[[hit2[1]]])
  }

  NA_character_
}

#' @keywords internal
normalizar_reglas_modalidad_enumeradores <- function(modalidad_reglas, data_names) {
  if (is.null(modalidad_reglas)) return(list())

  rules <- list()

  if (is.data.frame(modalidad_reglas)) {
    if (!"modalidad" %in% names(modalidad_reglas)) {
      stop("`modalidad_reglas` (data.frame) debe incluir la columna `modalidad`.", call. = FALSE)
    }

    cols_filtro <- setdiff(names(modalidad_reglas), "modalidad")

    for (i in seq_len(nrow(modalidad_reglas))) {
      modalidad_i <- as.character(modalidad_reglas$modalidad[[i]])
      filtros_i <- list()

      for (col in cols_filtro) {
        val <- modalidad_reglas[[col]][[i]]
        if (is.na(val) || !nzchar(trimws(as.character(val)))) next
        col_real <- .enum_resolve_col_alias(col, data_names)
        if (is.na(col_real)) {
          stop(
            "No se pudo mapear la columna de regla `", col, "` a una columna real en `data`.",
            call. = FALSE
          )
        }
        filtros_i[[col_real]] <- as.character(val)
      }

      rules[[length(rules) + 1L]] <- list(
        modalidad = modalidad_i,
        filters = filtros_i
      )
    }
    return(rules)
  }

  if (!is.list(modalidad_reglas) || !length(modalidad_reglas)) {
    stop(
      "`modalidad_reglas` debe ser `NULL`, un `data.frame` o una lista de reglas.",
      call. = FALSE
    )
  }

  for (i in seq_along(modalidad_reglas)) {
    rule <- modalidad_reglas[[i]]
    if (!is.list(rule) || !length(rule)) next

    modalidad_i <- if (is.null(rule$modalidad)) NA_character_ else as.character(rule$modalidad)[1]
    if (!nzchar(trimws(modalidad_i))) next

    filtros_i <- list()

    filtros_raw <- rule$filtros
    if (is.null(filtros_raw) || !is.list(filtros_raw)) {
      filtros_raw <- rule[setdiff(names(rule), c("modalidad", "filtros"))]
    }

    if (length(filtros_raw)) {
      for (nm in names(filtros_raw)) {
        val <- filtros_raw[[nm]]
        if (is.null(val) || !length(val)) next

        col_real <- .enum_resolve_col_alias(nm, data_names)
        if (is.na(col_real)) {
          stop(
            "No se pudo mapear la columna de regla `", nm, "` a una columna real en `data`.",
            call. = FALSE
          )
        }

        vals_chr <- as.character(val)
        vals_chr <- vals_chr[!is.na(vals_chr) & nzchar(trimws(vals_chr))]
        if (!length(vals_chr)) next

        filtros_i[[col_real]] <- vals_chr
      }
    }

    rules[[length(rules) + 1L]] <- list(
      modalidad = modalidad_i,
      filters = filtros_i
    )
  }

  rules
}

#' @keywords internal
resolver_modalidad_enumeradores <- function(
    data,
    col_modalidad = NULL,
    modalidad_reglas = NULL,
    modalidad_fn = NULL,
    modalidad_default = "Presencial"
) {
  if (!is.data.frame(data)) {
    stop("`data` debe ser un data.frame o tibble.", call. = FALSE)
  }

  modalidad_default <- as.character(modalidad_default)[1]
  if (!nzchar(trimws(modalidad_default))) {
    stop("`modalidad_default` debe ser una cadena no vacia.", call. = FALSE)
  }

  out <- rep(NA_character_, nrow(data))

  # Precedencia 1: funcion custom
  if (!is.null(modalidad_fn)) {
    if (!is.function(modalidad_fn)) {
      stop("`modalidad_fn` debe ser una funcion.", call. = FALSE)
    }
    out <- modalidad_fn(data)
    if (length(out) != nrow(data)) {
      stop("`modalidad_fn(data)` debe devolver un vector de largo nrow(data).", call. = FALSE)
    }
  } else if (!is.null(col_modalidad)) {
    # Precedencia 2: columna existente
    col_modalidad <- as.character(col_modalidad)[1]
    if (!col_modalidad %in% names(data)) {
      stop("`col_modalidad` no existe en `data`: ", col_modalidad, call. = FALSE)
    }
    out <- data[[col_modalidad]]
  } else if (!is.null(modalidad_reglas)) {
    # Precedencia 3: reglas explicitas
    rules <- normalizar_reglas_modalidad_enumeradores(
      modalidad_reglas = modalidad_reglas,
      data_names = names(data)
    )

    if (length(rules)) {
      for (rule in rules) {
        modalidad_i <- as.character(rule$modalidad)[1]
        if (!nzchar(trimws(modalidad_i))) next

        if (!length(rule$filters)) {
          idx <- is.na(out)
          out[idx] <- modalidad_i
          next
        }

        idx_rule <- rep(TRUE, nrow(data))
        for (col in names(rule$filters)) {
          vals <- rule$filters[[col]]
          vals_norm <- unique(.enum_norm_text(vals))
          lhs <- .enum_norm_text(data[[col]])
          idx_rule <- idx_rule & (lhs %in% vals_norm)
        }

        idx <- is.na(out) & idx_rule
        out[idx] <- modalidad_i
      }
    }
  }

  out <- as.character(out)
  out <- trimws(out)
  out[!nzchar(out)] <- NA_character_
  out[is.na(out)] <- modalidad_default
  out
}
