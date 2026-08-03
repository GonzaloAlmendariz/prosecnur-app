# Identidad operativa legible para la selección de aulas.
#
# `CH n` identifica una clase-horario titular y `R n.k` su reemplazo k. El
# helper acepta también los formatos históricos `AULA n` y `Rn.k`; normalizar
# dos veces produce exactamente el mismo resultado. Solo transforma códigos
# operativos: no lee atributos del aula, no expone PII ni tiene efectos.

.cm_aulas_codigo_operativo <- function(code = NULL, role = NULL,
                                       slot_number = NULL,
                                       replacement_order = NULL,
                                       extra_index = NULL) {
  n <- max(c(
    length(code), length(role), length(slot_number),
    length(replacement_order), length(extra_index), 0L
  ))
  if (!n) return(character(0))

  recycle <- function(x, default) {
    if (is.null(x) || !length(x)) rep(default, n) else rep_len(x, n)
  }
  canonical_one <- function(value) {
    if (is.na(value)) return("")
    raw <- trimws(as.character(value))
    if (!nzchar(raw)) return("")
    key <- toupper(raw)

    titular <- regmatches(
      key,
      regexec("^(?:CH|AULA)[[:space:]]*([0-9]+)$", key, perl = TRUE)
    )[[1]]
    if (length(titular) == 2L) {
      number <- suppressWarnings(as.integer(titular[[2]]))
      if (is.finite(number)) return(sprintf("CH %s", number))
    }

    replacement <- regmatches(
      key,
      regexec(
        "^R[[:space:]]*([0-9]+)[[:space:]]*\\.[[:space:]]*([0-9]+)$",
        key,
        perl = TRUE
      )
    )[[1]]
    if (length(replacement) == 3L) {
      number <- suppressWarnings(as.integer(replacement[[2]]))
      order <- suppressWarnings(as.integer(replacement[[3]]))
      if (is.finite(number) && is.finite(order)) {
        return(sprintf("R %s.%s", number, order))
      }
    }

    raw
  }

  out <- vapply(recycle(code, ""), canonical_one, character(1))
  role_key <- tolower(trimws(as.character(recycle(role, ""))))
  role_key[is.na(role_key)] <- ""
  role_key <- gsub("[[:space:]-]+", "_", role_key)
  slot <- suppressWarnings(as.integer(recycle(slot_number, NA_integer_)))
  order <- suppressWarnings(as.integer(recycle(replacement_order, NA_integer_)))
  extra <- suppressWarnings(as.integer(recycle(extra_index, NA_integer_)))
  missing <- !nzchar(out)

  titular <- missing & role_key %in% c("titular", "m1") &
    is.finite(slot) & slot > 0L
  out[titular] <- sprintf("CH %s", slot[titular])

  replacement <- missing & role_key == "chain_reserve" &
    is.finite(slot) & slot > 0L & is.finite(order) & order > 0L
  out[replacement] <- sprintf(
    "R %s.%s",
    slot[replacement],
    order[replacement]
  )

  extra_pool <- missing & role_key == "extra_reserve_pool" &
    is.finite(extra) & extra > 0L
  out[extra_pool] <- sprintf("EXTRA %s", extra[extra_pool])

  vapply(out, canonical_one, character(1))
}

.cm_aulas_selection_slot_ids <- function(n, prefix = "slot") {
  sprintf("%s_%03d", prefix, seq_len(max(0L, as.integer(n))))
}

.cm_aulas_slot_number <- function(slot_id, fallback = NA_integer_) {
  raw <- .cm_aulas_scalar(slot_id, "")
  hit <- regmatches(raw, regexpr("[0-9]+", raw))
  if (!length(hit) || !nzchar(hit[[1]])) return(as.integer(fallback))
  out <- suppressWarnings(as.integer(hit[[1]]))
  if (!is.finite(out)) as.integer(fallback) else out
}

.cm_aulas_assign_operational_codes <- function(df) {
  df <- .cm_aulas_as_df(df, "selection_df")
  if (!nrow(df)) return(df)
  if (!"wave" %in% names(df)) df$wave <- ""
  if (!"classroom_id" %in% names(df)) df$classroom_id <- ""
  if (!"selection_slot_id" %in% names(df)) df$selection_slot_id <- ""
  if (!"replacement_order" %in% names(df)) {
    df$replacement_order <- ifelse(
      df$wave == "M1",
      0L,
      vapply(df$wave, .cm_aulas_wave_number, integer(1)) - 1L
    )
  }
  if (!"replacement_for" %in% names(df)) df$replacement_for <- ""
  roles <- .cm_aulas_role_values(df)
  titular_idx <- which(roles == "titular" | as.character(df$wave) == "M1")
  if (length(titular_idx)) {
    missing_slot <- !nzchar(as.character(df$selection_slot_id[titular_idx]))
    if (any(missing_slot)) {
      df$selection_slot_id[titular_idx[missing_slot]] <-
        .cm_aulas_selection_slot_ids(length(titular_idx))[missing_slot]
    }
  }

  titular_lookup <- stats::setNames(character(0), character(0))
  if (length(titular_idx)) {
    titular_lookup <- stats::setNames(
      as.character(df$selection_slot_id[titular_idx]),
      as.character(df$classroom_id[titular_idx])
    )
  }
  extra_idx <- which(roles == "extra_reserve_pool")
  chain_idx <- which(roles == "chain_reserve" &
    !seq_len(nrow(df)) %in% titular_idx)
  if (length(chain_idx)) {
    missing_slot <- !nzchar(as.character(df$selection_slot_id[chain_idx]))
    replacement_for <- as.character(df$replacement_for[chain_idx])
    from_titular <- unname(titular_lookup[replacement_for])
    fillable <- missing_slot & !is.na(from_titular) & nzchar(from_titular)
    if (any(fillable)) {
      df$selection_slot_id[chain_idx[fillable]] <- from_titular[fillable]
    }
  }

  operational_code <- rep("", nrow(df))
  titular_operational_code <- rep("", nrow(df))
  replacement_chain_code <- rep("", nrow(df))
  operational_sequence <- rep(NA_integer_, nrow(df))
  if (length(titular_idx)) {
    for (pos in seq_along(titular_idx)) {
      i <- titular_idx[[pos]]
      slot_num <- .cm_aulas_slot_number(df$selection_slot_id[[i]], pos)
      code <- .cm_aulas_codigo_operativo(
        role = "titular",
        slot_number = slot_num
      )
      operational_sequence[[i]] <- slot_num
      operational_code[[i]] <- code
      titular_operational_code[[i]] <- code
    }
  }
  if (length(chain_idx)) {
    for (i in chain_idx) {
      slot_num <- .cm_aulas_slot_number(
        df$selection_slot_id[[i]],
        NA_integer_
      )
      if (!is.finite(slot_num)) {
        replacement_for <- .cm_aulas_scalar(df$replacement_for[[i]], "")
        mapped_slot <- if (
          nzchar(replacement_for) && replacement_for %in% names(titular_lookup)
        ) titular_lookup[[replacement_for]] else ""
        slot_num <- .cm_aulas_slot_number(mapped_slot, NA_integer_)
      }
      order <- suppressWarnings(as.integer(df$replacement_order[[i]]))
      if (!is.finite(order) || order <= 0L) {
        order <- max(1L, .cm_aulas_wave_number(df$wave[[i]]) - 1L)
      }
      if (is.finite(slot_num)) {
        code <- .cm_aulas_codigo_operativo(
          role = "chain_reserve",
          slot_number = slot_num,
          replacement_order = order
        )
        operational_sequence[[i]] <- slot_num
        titular_operational_code[[i]] <- .cm_aulas_codigo_operativo(
          role = "titular",
          slot_number = slot_num
        )
        replacement_chain_code[[i]] <- code
        operational_code[[i]] <- code
      }
    }
  }
  if (length(extra_idx)) {
    operational_sequence[extra_idx] <- seq_along(extra_idx)
    operational_code[extra_idx] <- .cm_aulas_codigo_operativo(
      role = rep("extra_reserve_pool", length(extra_idx)),
      extra_index = seq_along(extra_idx)
    )
  }
  df$operational_code <- operational_code
  df$titular_operational_code <- titular_operational_code
  df$replacement_chain_code <- replacement_chain_code
  df$operational_sequence <- operational_sequence
  df
}
