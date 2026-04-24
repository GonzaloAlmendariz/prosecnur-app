# lector_limpieza_repeatscount.R
# ============================================================
#' @importFrom readxl excel_sheets read_excel
#' @importFrom dplyr mutate select rename left_join group_by summarise n ungroup bind_rows distinct arrange
#' @importFrom tibble tibble as_tibble
#' @importFrom purrr map set_names compact map_chr map_lgl
#' @importFrom rlang .data
#' @importFrom stringr str_replace_all str_squish str_detect str_match str_match_all
#' @importFrom tidyr complete
NULL

# ------------------------ Helpers ll_* ---------------------------------------

# Transliteración robusta de acentos → ASCII. chartr() falla en locales
# no-UTF-8 con "'old' is longer than 'new'". iconv con //TRANSLIT funciona
# de forma portable; fallback manual si iconv no está disponible.
.ll_translit <- function(x) {
  y <- tryCatch(iconv(x, from = "UTF-8", to = "ASCII//TRANSLIT"),
                error = function(e) NULL, warning = function(w) NULL)
  if (!is.null(y) && !any(is.na(y))) return(y)
  for (pair in list(c("[áàäâ]", "a"), c("[éèëê]", "e"), c("[íìïî]", "i"),
                     c("[óòöô]", "o"), c("[úùüû]", "u"), c("ñ", "n"),
                     c("[ÁÀÄÂ]", "A"), c("[ÉÈËÊ]", "E"), c("[ÍÌÏÎ]", "I"),
                     c("[ÓÒÖÔ]", "O"), c("[ÚÙÜÛ]", "U"), c("Ñ", "N"))) {
    x <- gsub(pair[1], pair[2], x, perl = TRUE)
  }
  x
}

ll_std_names <- function(df) {
  if (!is.data.frame(df)) return(df)
  nn <- names(df)
  norm <- function(s) {
    s0 <- gsub("\\s+", "_", trimws(tolower(as.character(s))))
    .ll_translit(s0)
  }
  names(df) <- vapply(nn, norm, character(1))
  df
}

ll_sheet_key_candidates <- function(df) {
  nms <- names(df)
  pick <- function(x) any(x == nms)
  if (pick("_id"))    return("_id")
  if (pick("_uuid"))  return("_uuid")
  if (pick("__id"))   return("__id")
  if (pick("__uuid")) return("__uuid")
  if (pick("_index")) return("_index")
  NA_character_
}

ll_find_col <- function(df, candidates) {
  nms <- names(df)
  i <- which(tolower(nms) %in% tolower(candidates))[1]
  if (length(i) == 1 && !is.na(i)) nms[i] else NA_character_
}

ll_canon <- function(x) {
  x <- tolower(trimws(as.character(x)))
  x <- gsub("\\s+", " ", x)
  .ll_translit(x)
}

ll_match_sheet <- function(target, pool) {
  if (is.null(target) || !nzchar(target)) return(NA_character_)
  ct <- ll_canon(target)
  canon_pool <- ll_canon(pool)
  j <- match(ct, canon_pool)
  if (is.na(j)) NA_character_ else pool[j]
}

ll_detect_main_sheet <- function(hojas, hoja_principal = NULL) {
  nms <- names(hojas)
  if (length(nms) == 0) return(NA_character_)
  if (nzchar(hoja_principal %||% "")) {
    mm <- ll_match_sheet(hoja_principal, nms)
    if (isTRUE(nzchar(mm))) return(mm)
    warning(sprintf("No se encontró la hoja principal '%s'. Se intentará inferirla.", hoja_principal), call. = FALSE)
  }
  sizes <- vapply(hojas, nrow, integer(1))
  order_idx <- order(sizes, decreasing = TRUE)
  for (i in order_idx) {
    key <- ll_sheet_key_candidates(hojas[[i]])
    if (!is.na(key)) return(nms[i])
  }
  nms[order_idx[1]]
}

ll_detect_repeats_infer <- function(hojas, main_name) {
  setdiff(names(hojas)[vapply(hojas, function(d) {
    d <- ll_std_names(d)
    any(c("_parent_index","_submission__id","_parent_table_name") %in% names(d))
  }, logical(1))], main_name)
}

# ------------------- Enlace padre ↔ hijo (elección de llaves) ----------------

# Devuelve la mejor pareja (fk hijo, pk padre) priorizando:
# 1) _parent_index ↔ _index (prop=1)
# 2) _submission__id ↔ _id (prop=1)
# Si nada da 1, toma el mejor >= 0.95; si nada, devuelve NA.
ll_choose_link_keys <- function(parent_df, child_df) {
  cand_fk <- intersect(names(child_df),  c("_parent_index","parent_index","_submission__id"))
  cand_pk <- intersect(names(parent_df), c("_index","_id","__id","_submission__id"))
  if (!length(cand_fk) || !length(cand_pk)) {
    return(list(fk = NA_character_, pk = NA_character_, prop = NA_real_))
  }
  combos <- expand.grid(fk = cand_fk, pk = cand_pk, stringsAsFactors = FALSE)
  combos$prop <- apply(combos, 1, function(r) {
    fk <- r[["fk"]]; pk <- r[["pk"]]
    if (!nrow(child_df)) return(NA_real_)
    sum(as.character(na.omit(child_df[[fk]])) %in% as.character(na.omit(parent_df[[pk]]))) / nrow(child_df)
  })
  # preferir _parent_index ↔ _index con prop=1
  ix <- which(combos$fk %in% c("_parent_index","parent_index") & combos$pk == "_index" & combos$prop == 1)
  if (length(ix)) return(list(fk = combos$fk[ix[1]], pk = combos$pk[ix[1]], prop = 1))
  # fallback: _submission__id ↔ _id con prop=1
  ix <- which(combos$fk == "_submission__id" & combos$pk == "_id" & combos$prop == 1)
  if (length(ix)) return(list(fk = combos$fk[ix[1]], pk = combos$pk[ix[1]], prop = 1))
  # si nada es 1, tomar mejor >= 0.95
  ix <- which(combos$prop >= 0.95)
  if (length(ix)) {
    ix <- ix[order(-combos$prop[ix])][1]
    return(list(fk = combos$fk[ix], pk = combos$pk[ix], prop = combos$prop[ix]))
  }
  list(fk = NA_character_, pk = NA_character_, prop = NA_real_)
}

# Linker que usa la elección de llaves y crea n_<repeat> en el padre
ll_link_children <- function(parent_df, child_df, child_name, parent_label, fk = NULL, pk = NULL) {
  p <- parent_df
  c <- child_df

  # detectar llaves si no se pasan
  if (is.null(fk) || is.null(pk)) {
    chosen <- ll_choose_link_keys(p, c)
    fk <- chosen$fk; pk <- chosen$pk
  }
  # si no hay llaves válidas, aún así devolver n_<child>=0
  counts <- tibble::tibble(parent_key = character(), n = integer(),
                           repeats_name = character(), parent_table = character())
  parent_aug <- p

  if (!is.na(fk) && !is.na(pk) && fk %in% names(c) && pk %in% names(p)) {
    counts <- c %>%
      dplyr::group_by(.data[[fk]]) %>%
      dplyr::summarise(n = dplyr::n(), .groups = "drop") %>%
      dplyr::rename(parent_key = !!fk) %>%
      dplyr::mutate(parent_key = as.character(.data$parent_key),
                    repeats_name = child_name,
                    parent_table = parent_label)

    # join robusto, casteando ambos lados a character
    parent_aug <- parent_aug %>%
      dplyr::mutate(`__join_pk__` = as.character(.data[[pk]])) %>%
      dplyr::left_join(counts %>% dplyr::select(parent_key, n),
                       by = c("__join_pk__" = "parent_key")) %>%
      dplyr::rename(!!paste0("n_", child_name) := n) %>%
      dplyr::select(-"__join_pk__")
  }

  # asegurar columna n_<child>
  n_col <- paste0("n_", child_name)
  if (!n_col %in% names(parent_aug)) parent_aug[[n_col]] <- 0L
  parent_aug[[n_col]] <- suppressWarnings(as.integer(parent_aug[[n_col]]))
  parent_aug[[n_col]][is.na(parent_aug[[n_col]])] <- 0L

  list(counts = counts, parent_aug = parent_aug)
}

`%||%` <- function(a,b) if (is.null(a) || (length(a)==1 && is.na(a))) b else a

# -------------------- Helpers de repeat_count --------------------------------

ll_norm_expr <- function(x){
  x <- as.character(x %||% "")
  x <- stringr::str_replace_all(x, "\\r\\n|\\r|\\n", " ")
  x <- stringr::str_squish(x)
  x
}

.ll_norm_name <- function(s) {
  s0 <- gsub("\\s+", "_", trimws(tolower(as.character(s))))
  .ll_translit(s0)
}

# Evaluador repeat_count con soporte de count(${repeat}) -> n_<repeat>
ll_eval_repeats_count_expr <- function(rc_expr, parent_row, map_count_prefix = "n_") {
  if (is.null(rc_expr) || is.na(rc_expr) || !nzchar(rc_expr)) return(NA_real_)
  ex <- ll_norm_expr(rc_expr)

  # literal
  if (suppressWarnings(!is.na(as.numeric(ex)))) {
    val <- as.numeric(ex); return(ifelse(is.finite(val), val, NA_real_))
  }

  # count(${repeat})
  m_count <- stringr::str_match(ex, "^\\s*count\\s*\\(\\s*\\$\\{([^}]+)\\}\\s*\\)\\s*$")
  if (!any(is.na(m_count))) {
    rep_raw  <- m_count[,2]
    rep_norm <- .ll_norm_name(rep_raw)
    col_n    <- paste0(map_count_prefix, rep_raw)
    col_n_norm <- paste0(map_count_prefix, rep_norm)

    val <- NA_real_
    if (col_n %in% names(parent_row)) {
      val <- suppressWarnings(as.numeric(parent_row[[col_n]]))
    } else if (col_n_norm %in% names(parent_row)) {
      val <- suppressWarnings(as.numeric(parent_row[[col_n_norm]]))
    }
    return(ifelse(length(val) && is.finite(val), val, NA_real_))
  }

  # ${var}, number/int/toint(${var}), coalesce(), min()/max()
  get_var <- function(v) {
    v_raw  <- as.character(v)
    v_norm <- .ll_norm_name(v_raw)
    cand <- c(v_raw, v_norm)
    col  <- cand[cand %in% names(parent_row)][1]
    if (length(col) && !is.na(col) && nzchar(col)) {
      suppressWarnings(as.numeric(parent_row[[col]]))
    } else {
      NA_real_
    }
  }

  if (grepl("^coalesce\\(", ex, ignore.case = TRUE)) {
    vs <- unique(unlist(stringr::str_match_all(ex, "\\$\\{([^}]+)\\}")[[1]][,2]))
    vals <- vapply(vs, get_var, numeric(1))
    v <- vals[which(!is.na(vals))[1]]
    return(ifelse(length(v), v, NA_real_))
  }

  if (grepl("^min\\(|^max\\(", ex, ignore.case = TRUE)) {
    vs <- unique(unlist(stringr::str_match_all(ex, "\\$\\{([^}]+)\\}")[[1]][,2]))
    vals <- vapply(vs, get_var, numeric(1))
    if (all(is.na(vals))) return(NA_real_)
    if (grepl("^min\\(", ex, ignore.case = TRUE)) return(min(vals, na.rm = TRUE))
    if (grepl("^max\\(", ex, ignore.case = TRUE)) return(max(vals, na.rm = TRUE))
  }

  if (grepl("\\$\\{[^}]+\\}", ex)) {
    var <- sub("^.*\\$\\{([^}]+)\\}.*$", "\\1", ex)
    v <- get_var(var)
    return(ifelse(is.finite(v), v, NA_real_))
  }

  NA_real_
}

# ----------------------------- Lector ----------------------------------------

#' Lector robusto de Excel RMS/ODK con verificación de repeat_count
#'
#' Lee un Excel exportado de KoBo/ODK, normaliza columnas, detecta relaciones
#' padre–hijo y, **si se provee `repeats_count_map`**, compara por fila del padre
#' el número de hijos que **tiene** vs. el que **debería tener** según el `repeat_count`.
#'
#' @param archivo Ruta al .xlsx
#' @param hoja_principal Nombre de la hoja principal (tolerante a acentos/espacios).
#'   Si no se proporciona, se infiere.
#' @param grupos_repetidos Vector opcional con nombres de hojas repetidas (tolerante).
#'   Si no se proporciona, se detectan por columnas típicas (`_parent_index`, etc.).
#' @param repeats_count_map (opcional) `tibble/data.frame` con columnas:
#'   - `repeats` = nombre de hoja “hijo” (coincide con el nombre de sheet exportado)
#'   - `repeat_count` (o `repeats_count`) = expresión del XLSForm
#'   - (opcional) `source_group` = nombre del group en survey (informativo)
#' @param warn Logical. Si `TRUE`, emite warnings con el resumen de discrepancias.
#'
#' @return Lista con:
#' \itemize{
#' \item \code{data}: lista de data.frames por hoja (normalizados). La hoja principal incluye columnas \code{n_<repeats>}.
#' \item \code{counts}: tibble con conteos por padre para cada repeats (\code{parent_key}, \code{n}, \code{repeats_name}).
#' \item \code{meta$main}: nombre de la hoja principal.
#' \item \code{meta$keys}: claves detectadas por hoja.
#' \item \code{meta$parent_map}: relaciones hijo→padre.
#' \item \code{meta$repeats_count}: mapa de repeat_count utilizado (si se pasó).
#' \item \code{rc_checks}: lista por repeats con \code{$by_parent} (fila a fila) y \code{$summary}.
#' }
#' @family validacion
#' @export
lector_limpieza <- function(archivo,
                            hoja_principal   = NULL,
                            grupos_repetidos = NULL,
                            repeats_count_map = NULL,
                            warn = TRUE) {

  # -------- 1) Leer todas las hojas ----------
  hojas_nombres <- readxl::excel_sheets(archivo)
  hojas <- purrr::map(hojas_nombres, ~ readxl::read_excel(archivo, sheet = .x))
  names(hojas) <- hojas_nombres

  # std names en todas (solo columnas, no renombra hojas)
  hojas <- purrr::map(hojas, ll_std_names)

  # -------- 2) Resolver hoja principal ----------
  main_name <- ll_detect_main_sheet(hojas, hoja_principal)
  if (is.na(main_name)) stop("No se pudo determinar la hoja principal.", call. = FALSE)

  # -------- 3) Resolver grupos repetidos ----------
  grupos_repetidos_can <- character(0)
  if (!is.null(grupos_repetidos) && length(grupos_repetidos)) {
    m <- vapply(grupos_repetidos, ll_match_sheet, character(1), pool = names(hojas))
    grupos_repetidos_can <- unique(na.omit(m))
  } else {
    grupos_repetidos_can <- ll_detect_repeats_infer(hojas, main_name)
  }

  # -------- 4) meta$keys (padre) ----------
  main_df  <- hojas[[main_name]]

  # 4a) Asegurar que exista _index (lo usan los hijos en _parent_index)
  if (!"_index" %in% names(main_df)) {
    main_df <- dplyr::mutate(main_df, `_index` = dplyr::row_number())
    hojas[[main_name]] <- main_df
  }

  # 4b) Clave "meta" del padre (para informar en meta$keys)
  main_key <- ll_sheet_key_candidates(main_df)
  if (is.na(main_key)) main_key <- "_index"

  keys_rows <- list(tibble::tibble(
    table = as.character(main_name),
    key   = as.character(main_key),
    parent_key = NA_character_
  ))

  # -------- 5) Vinculación y conteos ----------
  counts_all <- tibble::tibble(
    parent_key  = character(),
    n           = integer(),
    repeats_name = character(),
    parent_table= character()
  )

  parent_aug <- main_df
  for (child in grupos_repetidos_can) {
    child_df <- hojas[[child]]

    # registrar llaves detectadas (informativo)
    child_fk <- ll_find_col(child_df, c("_parent_index","parent_index","_submission__id"))
    child_pk <- ll_find_col(child_df, c("_index"))
    keys_rows[[length(keys_rows) + 1]] <- tibble::tibble(
      table = as.character(child),
      key   = if (!is.na(child_pk)) as.character(child_pk) else NA_character_,
      parent_key = if (!is.na(child_fk)) as.character(child_fk) else NA_character_
    )

    # *** ARREGLO: pasar parent_aug (acumulador), no main_df ***
    link <- ll_link_children(parent_aug, child_df, child_name = child, parent_label = main_name)
    counts_all <- dplyr::bind_rows(counts_all, link$counts)
    parent_aug <- link$parent_aug
  }

  hojas[[main_name]] <- parent_aug

  # -------- 6) meta$parent_map ----------
  parent_map <- tibble::tibble(
    child  = grupos_repetidos_can,
    parent = if (length(grupos_repetidos_can)) rep(main_name, length(grupos_repetidos_can)) else character(0)
  )

  # -------- 7) meta$keys ----------
  meta_keys <- dplyr::bind_rows(keys_rows) %>% dplyr::distinct()

  # -------- 8) repeat_count awareness (opcional) ----------
  rc_checks <- list()
  rc_map_use <- NULL

  if (!is.null(repeats_count_map) && nrow(repeats_count_map)) {
    nm <- ll_std_names(repeats_count_map)

    # aceptar 'repeat_count' o 'repeats_count'
    if (!"repeat_count" %in% names(nm) && "repeats_count" %in% names(nm)) {
      nm$repeat_count <- nm$repeats_count
    }
    need <- c("repeats","repeat_count")
    faltan <- setdiff(need, names(nm))
    if (length(faltan)) {
      warning("repeats_count_map no tiene columnas requeridas: ", paste(faltan, collapse=", "))
    } else {
      # resolver 'repeats' al nombre real de la hoja
      nm$sheet <- vapply(nm$repeats, ll_match_sheet, character(1), pool = names(hojas))
      nm <- nm[!is.na(nm$sheet), , drop = FALSE]
      # restringir a repeats detectados/forzados
      nm <- nm[nm$sheet %in% grupos_repetidos_can, , drop = FALSE]

      rc_map_use <- nm
      if (nrow(nm)) {
        parent_now <- hojas[[main_name]]
        parent_colname <- main_key
        if (is.na(parent_colname)) parent_colname <- names(parent_now)[1]

        for (i in seq_len(nrow(nm))) {
          r_sheet <- nm$sheet[i]
          expr    <- nm$repeat_count[i]
          ncol    <- paste0("n_", r_sheet)
          if (!ncol %in% names(parent_now)) parent_now[[ncol]] <- 0L

          want <- vapply(seq_len(nrow(parent_now)), function(ii) {
            ll_eval_repeats_count_expr(expr, parent_now[ii, , drop = FALSE])
          }, numeric(1))

          want[is.na(want)] <- NA_real_
          want[is.finite(want) & want < 0] <- 0
          want_int <- suppressWarnings(as.integer(round(want)))

          have_int <- suppressWarnings(as.integer(parent_now[[ncol]]))
          have_int[is.na(have_int)] <- 0L

          status <- ifelse(
            is.na(want_int), "sin_meta",
            ifelse(have_int == want_int, "ok",
                   ifelse(have_int < want_int, "faltan", "sobran"))
          )

          by_parent <- tibble::tibble(
            !!parent_colname := parent_now[[parent_colname]],
            repeats            = nm$repeats[i],   # nombre lógico
            sheet              = r_sheet,         # nombre real de hoja
            repeats_count_expr = expr,
            want_n             = want_int,
            have_n             = have_int,
            diff               = have_int - want_int,
            status             = status
          )

          summary <- by_parent %>%
            dplyr::group_by(.data$status) %>%
            dplyr::summarise(casos = dplyr::n(), .groups = "drop") %>%
            tidyr::complete(
              status = factor(c("ok","faltan","sobran","sin_meta"),
                              levels = c("ok","faltan","sobran","sin_meta")),
              fill = list(casos = 0L)
            ) %>%
            dplyr::arrange(dplyr::desc(.data$casos))

          rc_checks[[r_sheet]] <- list(by_parent = by_parent, summary = summary)
        }

        if (isTRUE(warn) && length(rc_checks)) {
          msgs <- purrr::map_chr(names(rc_checks), function(r){
            sm <- rc_checks[[r]]$summary
            tot <- sum(sm$casos)
            falt <- sm$casos[sm$status == "faltan"] %||% 0L
            sob  <- sm$casos[sm$status == "sobran"] %||% 0L
            sn   <- sm$casos[sm$status == "sin_meta"] %||% 0L
            sprintf("· %s → faltan:%d, sobran:%d, sin_meta:%d / N=%d", r, falt, sob, sn, tot)
          })
          warning("Verificación repeat_count:\n", paste(msgs, collapse = "\n"), call. = FALSE)
        }
      }
    }
  }

  # -------- 9) Salida ----------
  list(
    data = hojas,
    counts = counts_all,
    meta = list(
      main  = main_name,
      keys  = meta_keys,
      parent_map = parent_map,
      repeats_count = rc_map_use
    ),
    rc_checks = rc_checks
  )
}
