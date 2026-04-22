# =============================================================================
# PPRA – Adaptación de datos con soporte para repeats y export preservando hojas
# (con armonización de clave para joins: evita _index double vs character)
# =============================================================================

`%||%` <- function(a,b) if (is.null(a) || (length(a)==1 && is.na(a))) b else a
nz      <- function(x) !is.na(x) & nzchar(trimws(as.character(x)))

# -------- utilidades básicas ---------------------------------------------------
pick_join_key <- function(df){
  cands <- c("_uuid","uuid","meta_instance_id","instanceid","_id",
             "_index","Codigo pulso","Código pulso","Pulso_code","pulso_code")
  hit <- cands[cands %in% names(df)]
  if (length(hit)) hit[1] else NA_character_
}

# elige una clave que exista en x e y (en orden de prioridad)
pick_join_key_pair <- function(x, y){
  cands <- c("_uuid","uuid","meta_instance_id","instanceid","_id",
             "_index","Codigo pulso","Código pulso","Pulso_code","pulso_code")
  for (k in cands) {
    if ((k %in% names(x)) && (k %in% names(y))) return(k)
  }
  NA_character_
}

# asegura nombres únicos (evita "Input columns in `y` must be unique")
.ensure_unique_names <- function(df){
  names(df) <- make.unique(names(df), sep = "__")
  df
}

# ---- armonización de clave para joins (ambos lados a texto) ------------------
.to_key_char <- function(v){
  if (inherits(v, "POSIXct") || inherits(v, "Date")) return(as.character(v))
  if (is.numeric(v)) return(ifelse(is.na(v), NA_character_, format(v, trim = TRUE, scientific = FALSE, digits = 22)))
  as.character(v)
}

.harmonize_key <- function(df, key){
  if (!key %in% names(df)) return(df)
  df[[key]] <- .to_key_char(df[[key]])
  df
}

.safe_left_join_by <- function(x, y, key, cols_right = NULL){
  y <- .ensure_unique_names(y)
  x <- .harmonize_key(x, key)
  y <- .harmonize_key(y, key)
  if (!is.null(cols_right)) {
    keep <- unique(c(key, cols_right))
    keep <- keep[keep %in% names(y)]
    y <- y[, keep, drop = FALSE]
  }
  dplyr::left_join(x, y, by = key)
}

# normalizar valores 0/1/NA (NO nombres de columnas)
.norm01 <- function(v){
  if (is.numeric(v)) return(ifelse(is.na(v), NA_integer_, ifelse(v!=0,1L,0L)))
  s <- tolower(trimws(as.character(v)))
  s <- iconv(s, from="", to="ASCII//TRANSLIT")
  out <- rep(NA_integer_, length(s))
  out[s %in% c("1","t","true","si","s","yes","y","verdadero")] <- 1L
  out[s %in% c("0","f","false","no","n","falso")]               <- 0L
  out
}

# normaliza códigos (valores), NO se usa en nombres de columnas
.normcode <- function(x){
  x <- trimws(as.character(x))
  x <- iconv(x, from="", to="ASCII//TRANSLIT")
  tolower(x)
}

leer_datos_generico <- function(path_data, sheet = NULL){
  ext <- tolower(tools::file_ext(path_data))
  if (ext %in% c("csv","txt")) {
    suppressWarnings(readr::read_csv(path_data, show_col_types = FALSE))
  } else {
    readxl::read_excel(path_data, sheet = sheet %||% 1)
  }
}

# Resuelve el text_col asociado a una parent en el xlsx de familias.
# Devuelve "" si no puede resolverlo (archivo ausente, sin columna, etc.).
# Usado por ppra_so_parent para saber qué filas de la data corresponden al
# caso "Otros" (text_col no vacío) y así distinguirlas del resto.
.resolve_text_col_for_parent <- function(parent, path_familias) {
  if (is.null(path_familias) || !file.exists(path_familias)) return("")
  fam <- tryCatch(readxl::read_excel(path_familias), error = function(e) NULL)
  if (is.null(fam)) return("")
  fam <- tryCatch(janitor::clean_names(fam), error = function(e) fam)
  if (!("text_col" %in% names(fam))) return("")
  parent_key <- if ("parent" %in% names(fam)) "parent"
                else if ("parent_col" %in% names(fam)) "parent_col"
                else return("")
  ix <- which(as.character(fam[[parent_key]]) == as.character(parent))
  if (length(ix) == 0L) return("")
  tc <- as.character(fam$text_col[ix[1]])
  if (is.na(tc)) return("")
  tc
}

# leer hoja con nombre insensible a mayúsculas
read_sheet_ci <- function(path_xlsx, sheet_name){
  sh <- readxl::excel_sheets(path_xlsx)
  i  <- match(tolower(sheet_name), tolower(sh))
  if (is.na(i)) stop("No existe la hoja '", sheet_name, "' en: ", path_xlsx)
  df <- readxl::read_excel(path_xlsx, sheet = sh[i])
  .ensure_unique_names(df)
}

# -------- plantilla: resolver hoja --------------------------------------------
.ppra_clean <- function(x) gsub("[^A-Za-z0-9]+", "", tolower(trimws(as.character(x))))
ppra_resolve_template_sheet <- function(path_plantilla, parent_var){
  sh <- readxl::excel_sheets(path_plantilla)
  hit <- which(sh == parent_var); if (length(hit)) return(sh[hit[1]])
  hit <- which(tolower(sh) == tolower(parent_var)); if (length(hit)) return(sh[hit[1]])
  p31 <- substr(parent_var, 1, 31)
  hit <- which(sh == p31 | tolower(sh) == tolower(p31)); if (length(hit)) return(sh[hit[1]])
  cl_parent <- .ppra_clean(parent_var); cl_sheets <- .ppra_clean(sh)
  hit <- which(cl_sheets == cl_parent); if (length(hit)) return(sh[hit[1]])
  d <- adist(cl_parent, cl_sheets); j <- which.min(d)
  if (length(j) && is.finite(d[j]) && d[j] <= 5) return(sh[j])
  NA_character_
}

.ppra_blank_to_na <- function(x){
  x <- trimws(as.character(x))
  x[x == ""] <- NA_character_
  x
}

.ppra_read_template_layout <- function(path_plantilla, parent_var){
  if (!file.exists(path_plantilla)) return(NULL)
  sheet <- ppra_resolve_template_sheet(path_plantilla, parent_var)
  if (is.na(sheet)) return(NULL)

  raw <- suppressWarnings(
    readxl::read_excel(
      path_plantilla,
      sheet = sheet,
      col_names = FALSE,
      col_types = "text"
    )
  )
  raw <- as.data.frame(raw, stringsAsFactors = FALSE, check.names = FALSE)
  if (!nrow(raw) || !ncol(raw)) {
    return(list(sheet = sheet, main = NULL, main_label = character(0), aux = tibble::tibble()))
  }
  if (nrow(raw) < 2L) {
    raw[2, ] <- NA
  }

  hdr_raw <- .ppra_blank_to_na(unlist(raw[1, , drop = TRUE], use.names = FALSE))
  hdr_lab <- as.character(unlist(raw[2, , drop = TRUE], use.names = FALSE))
  nonblank <- which(!is.na(hdr_raw))
  if (!length(nonblank)) {
    return(list(sheet = sheet, main = NULL, main_label = character(0), aux = tibble::tibble()))
  }

  sep_idx <- which(is.na(hdr_raw))[1]
  if (!is.na(sep_idx)) {
    main_cols <- seq_len(sep_idx - 1L)
    aux_cols <- nonblank[nonblank > sep_idx]
  } else {
    main_cols <- nonblank
    aux_cols <- integer(0)
  }

  if (!length(aux_cols)) {
    aux_mark <- which(tolower(as.character(hdr_raw)) %in% c("nuevo_codigo", "nueva_etiqueta"))
    if (length(aux_mark)) {
      aux_cols <- aux_mark
      main_cols <- setdiff(nonblank, aux_cols)
    }
  }

  main <- NULL
  main_label <- character(0)
  if (length(main_cols)) {
    main <- raw[-c(1, 2), main_cols, drop = FALSE]
    main_names <- make.unique(as.character(hdr_raw[main_cols]), sep = "__")
    names(main) <- main_names
    main <- .ensure_unique_names(main)
    main_label_vals <- .ppra_blank_to_na(hdr_lab[main_cols])
    if (length(main_label_vals) != length(names(main))) {
      main_label_vals <- rep(NA_character_, length(names(main)))
    }
    main_label <- stats::setNames(as.character(main_label_vals), names(main))
  }

  aux <- tibble::tibble()
  if (length(aux_cols)) {
    aux_names <- tolower(as.character(hdr_raw[aux_cols]))
    code_col <- aux_cols[match("nuevo_codigo", aux_names)]
    label_col <- aux_cols[match("nueva_etiqueta", aux_names)]
    if (length(code_col) && length(label_col) && !is.na(code_col) && !is.na(label_col)) {
      aux <- tibble::tibble(
        nuevo_codigo = .ppra_blank_to_na(raw[-c(1, 2), code_col]),
        nueva_etiqueta = .ppra_blank_to_na(raw[-c(1, 2), label_col])
      )
    }
  }

  list(
    sheet = sheet,
    main = main,
    main_label = main_label,
    aux = aux,
    header_raw = hdr_raw,
    header_label = hdr_lab
  )
}

.ppra_collect_aux_codebook <- function(aux_df,
                                       sheet_label,
                                       target_col,
                                       required_codes = character(0)){
  if (is.null(aux_df) || !nrow(aux_df)) {
    aux_df <- tibble::tibble(nuevo_codigo = character(0), nueva_etiqueta = character(0))
  }

  codes <- .ppra_blank_to_na(aux_df$nuevo_codigo)
  labels <- .ppra_blank_to_na(aux_df$nueva_etiqueta)
  has_code <- !is.na(codes)
  has_label <- !is.na(labels)

  if (any(has_label & !has_code)) {
    stop(
      "[Recodificación] En la hoja '", sheet_label,
      "', el bloque auxiliar de nuevas categorías para '", target_col,
      "' tiene etiquetas sin código en 'nuevo_codigo'.",
      call. = FALSE
    )
  }
  if (any(has_code & !has_label)) {
    miss <- unique(codes[has_code & !has_label])
    stop(
      "[Recodificación] En la hoja '", sheet_label,
      "', el bloque auxiliar de nuevas categorías para '", target_col,
      "' tiene códigos sin etiqueta en 'nueva_etiqueta': ",
      paste(shQuote(miss), collapse = ", "),
      ".",
      call. = FALSE
    )
  }

  keep <- has_code & has_label
  if (!any(keep)) {
    required_codes <- unique(.ppra_blank_to_na(required_codes))
    required_codes <- required_codes[!is.na(required_codes)]
    if (length(required_codes)) {
      stop(
        "[Recodificación] En la hoja '", sheet_label,
        "', los códigos nuevos de '", target_col,
        "' deben declararse en el bloque auxiliar 'nuevo_codigo' / 'nueva_etiqueta'.",
        call. = FALSE
      )
    }
    return(character(0))
  }

  acc <- tibble::tibble(code = codes[keep], label = labels[keep])
  out <- character(0)
  for (code in unique(acc$code)) {
    labs <- unique(acc$label[acc$code == code])
    if (length(labs) > 1L) {
      stop(
        "[Recodificación] En la hoja '", sheet_label,
        "', el código nuevo '", code,
        "' para '", target_col,
        "' tiene más de una etiqueta declarada en el bloque auxiliar: ",
        paste(shQuote(labs), collapse = ", "),
        ". Usa una sola etiqueta por código.",
        call. = FALSE
      )
    }
    out[code] <- labs[1]
  }

  required_codes <- unique(.ppra_blank_to_na(required_codes))
  required_codes <- required_codes[!is.na(required_codes)]
  missing_codes <- setdiff(required_codes, names(out))
  if (length(missing_codes)) {
    stop(
      "[Recodificación] En la hoja '", sheet_label,
      "', los códigos nuevos ",
      paste(shQuote(missing_codes), collapse = ", "),
      " de '", target_col,
      "' no tienen etiqueta declarada en el bloque auxiliar 'nuevo_codigo' / 'nueva_etiqueta'.",
      call. = FALSE
    )
  }

  out
}

.ppra_is_sm_example_col <- function(parent, cols){
  if (!length(cols)) return(logical(0))
  targets <- tolower(c(
    paste0(parent, "/ejemplo_recod"),
    paste0(parent, "/__ejemplo__recod")
  ))
  tolower(as.character(cols)) %in% targets
}

# -------- localizar hoja de datos donde vive el parent -------------------------
locate_var_sheet <- function(parent, path_datos, path_familias = NULL){
  sheets <- readxl::excel_sheets(path_datos)
  hoja <- NA_character_
  if (!is.null(path_familias) && file.exists(path_familias)) {
    fam <- tryCatch(readxl::read_excel(path_familias), error = function(e) NULL)
    if (!is.null(fam) && ncol(fam)) {
      cn <- tolower(gsub("[^a-z0-9_]+","_", names(fam)))
      col_parent <- names(fam)[match("parent", cn)]
      col_hoja   <- names(fam)[match("hoja_datos", cn)]
      if (!is.na(col_parent) && !is.na(col_hoja)) {
        fila <- fam[trimws(as.character(fam[[col_parent]])) == parent, , drop = FALSE]
        if (nrow(fila)) hoja <- tolower(as.character(fila[[col_hoja]][1]))
      }
    }
  }
  if (is.na(hoja) || hoja %in% c("", "main")) {
    for (s in sheets) {
      hdr <- tryCatch(names(readxl::read_excel(path_datos, sheet = s, n_max = 0)),
                      error = function(e) character(0))
      if (length(hdr) && any(tolower(hdr) == tolower(parent))) {
        return(list(source = if (s == sheets[1]) "main" else "repeat", sheet = s))
      }
    }
    return(list(source = "main", sheet = sheets[1]))
  } else {
    mi <- match(hoja, tolower(sheets))
    if (!is.na(mi)) {
      s <- sheets[mi]
      return(list(source = if (s == sheets[1]) "main" else "repeat", sheet = s))
    } else {
      for (s in sheets) {
        hdr <- tryCatch(names(readxl::read_excel(path_datos, sheet = s, n_max = 0)),
                        error = function(e) character(0))
        if (length(hdr) && any(tolower(hdr) == tolower(parent))) {
          return(list(source = if (s == sheets[1]) "main" else "repeat", sheet = s))
        }
      }
      return(list(source = "main", sheet = sheets[1]))
    }
  }
}

# -------- XLSForm: choices por parent -----------------------------------------
ppra_get_choices_parent <- function(path_instrumento, parent_var){
  survey  <- readxl::read_excel(path_instrumento, sheet = "survey")
  choices <- readxl::read_excel(path_instrumento, sheet = "choices")

  i <- which(survey$name == parent_var)
  if (!length(i)) {
    clean <- function(x) gsub("[^A-Za-z0-9_]+","", as.character(x))
    i <- which(clean(as.character(survey$name)) == clean(parent_var))
  }
  if (!length(i)) stop("No encontré la pregunta en survey: ", parent_var)

  ty <- as.character(survey$type[i][1] %||% "")
  ln <- trimws(sub("^\\S+\\s+", "", ty))
  if (!nzchar(ln)) stop("No pude determinar list_name desde 'type' para: ", parent_var)

  nmsl <- tolower(names(choices))
  label_es_col <- names(choices)[match(TRUE, nmsl %in% c(
    "label::spanish (es)","label::spanish(es)","label::spanish_es",
    "label_spanish_es","label::spanish","label","label::es"
  ))]
  if (is.na(label_es_col)) label_es_col <- if ("label" %in% names(choices)) "label" else NA_character_

  ch <- choices[ trimws(choices$list_name) == trimws(ln), , drop = FALSE ]
  if (!nrow(ch)) stop("El list_name '", ln, "' no tiene choices en 'choices'.")

  tibble::tibble(
    order = seq_len(nrow(ch)),
    code  = as.character(ch$name),
    label = if (!is.na(label_es_col)) as.character(ch[[label_es_col]]) else as.character(ch$name)
  )
}

# -------- FAMILIAS: detectar text_col por variable (opcional) -----------------
ppra_get_textcol_from_familias <- function(path_familias, parent_var){
  if (is.null(path_familias) || !file.exists(path_familias)) return(NA_character_)
  sh <- readxl::excel_sheets(path_familias)
  out <- NA_character_
  for (s in sh){
    df <- tryCatch(readxl::read_excel(path_familias, sheet = s), error = function(e) NULL)
    if (is.null(df) || !ncol(df)) next
    cn <- tolower(trimws(names(df)))
    i_parent <- match(TRUE, cn %in% c("parent_col","parent","variable","var"))
    i_tipo   <- match(TRUE, cn %in% c("tipo","type"))
    i_text   <- match(TRUE, cn %in% c("text_col","texto_col","text","textcol","text_column"))
    if (is.na(i_parent) || is.na(i_tipo) || is.na(i_text)) next
    pv <- df[[i_parent]]
    if (is.factor(pv)) pv <- as.character(pv)
    hit <- which(trimws(as.character(pv)) == parent_var)
    if (length(hit)) {
      val <- df[[i_text]][hit[1]]
      if (length(val)) { out <- as.character(val); break }
    }
  }
  if (!nz(out)) NA_character_ else out
}

# -------- insertar a la derecha con fallback ----------------------------------
insert_right_of <- function(df, anchor, cols_to_insert){
  cols_to_insert <- cols_to_insert[cols_to_insert %in% names(df)]
  if (!length(cols_to_insert)) return(df)
  nms <- names(df)
  base <- setdiff(nms, cols_to_insert)
  apos <- match(anchor, base)
  if (is.na(apos)) {
    apos <- match("_index", base)
    if (is.na(apos)) {
      return(df[, c(base, cols_to_insert), drop = FALSE])
    }
  }
  left <- if (apos <= 0L) character(0) else base[seq_len(apos)]
  right <- if (apos >= length(base)) character(0) else base[(apos + 1L):length(base)]
  df[, c(left, cols_to_insert, right), drop = FALSE]
}

# ====================== SM =====================================================
ppra_sm_parent_recod <- function(df, parent, path_instrumento, path_plantilla,
                                 path_datos = NULL, path_familias = NULL){
  where <- if (!is.null(path_datos)) locate_var_sheet(parent, path_datos, path_familias) else list(source="main", sheet=NA)
  df_work <- if (identical(where$source, "main")) df else read_sheet_ci(path_datos, where$sheet)
  nms <- names(df_work)

  # catálogo clásico
  ch <- ppra_get_choices_parent(path_instrumento, parent)
  classic      <- as.character(ch$code)
  classic_norm <- .normcode(classic)

  # hoja de plantilla (opcional, dedup nombres) + fila de etiquetas (row 2)
  tpl <- NULL
  tpl_labels <- character(0)
  tpl_aux_map <- character(0)
  if (file.exists(path_plantilla)) {
    sheet <- ppra_resolve_template_sheet(path_plantilla, parent)
    if (!is.na(sheet)) {
      tpl_full <- suppressWarnings(
        readxl::read_excel(path_plantilla, sheet = sheet, col_types = "text")
      )
      tpl_full <- .ensure_unique_names(tpl_full)
      names(tpl_full) <- trimws(names(tpl_full))
      if (nrow(tpl_full)) {
        tpl_labels <- as.character(tpl_full[1, , drop = TRUE])
        names(tpl_labels) <- names(tpl_full)
        tpl <- tpl_full[-1, , drop = FALSE]
      } else {
        tpl <- tpl_full
      }

      layout <- .ppra_read_template_layout(path_plantilla, parent)
      if (!is.null(layout)) {
        tpl_aux_map <- .ppra_collect_aux_codebook(
          aux_df = layout$aux %||% tibble::tibble(),
          sheet_label = layout$sheet %||% parent,
          target_col = paste0(parent, "_recod"),
          required_codes = character(0)
        )
      }
    }
  }

  # tmp para overrides (join armonizado)
  if (!is.null(tpl)) {
    kd <- pick_join_key_pair(df_work, tpl)
    if (is.na(kd)) stop("No hay clave común para SM en ", ifelse(identical(where$source,"main"), "main: ", paste0("repeat '", where$sheet, "': ")), parent)
    tmp <- .safe_left_join_by(df_work[, kd, drop = FALSE], tpl, kd)
  } else {
    kd <- pick_join_key(df_work)
    tmp <- df_work[, kd, drop = FALSE]
  }
  tnames <- names(tmp)

  # matriz clásico desde crudo
  mat <- matrix(NA_integer_, nrow = nrow(df_work), ncol = length(classic))
  colnames(mat) <- classic
  for (code in classic) {
    raw_col <- paste0(parent, "/", code)
    if (raw_col %in% nms) {
      v <- .norm01(df_work[[raw_col]])
      mat[, code] <- v
    }
  }

  # overrides clásico desde plantilla
  if (!is.null(tpl)) {
    for (code in classic) {
      rc1 <- paste0(parent, "/", code, "_RECOD")
      rc2 <- paste0(parent, "/", code, "_recod")
      if (rc1 %in% tnames || rc2 %in% tnames) {
        v <- if (rc1 %in% tnames) tmp[[rc1]] else tmp[[rc2]]
        v <- .norm01(v)
        w1 <- which(!is.na(v) & v==1L); if (length(w1)) mat[w1, code] <- 1L
        w0 <- which(!is.na(v) & v==0L); if (length(w0)) mat[w0, code] <- 0L
      }
    }
  }

  # nuevas hijas en plantilla
  new_tokens <- vector("list", nrow(df_work))
  new_label_candidates <- list()
  if (!is.null(tpl)) {
    rx_new <- paste0("^", parent, "/[^/]+_(?i:recod)$")
    new_cols <- tnames[grepl(rx_new, tnames, perl = TRUE)]
    new_cols <- new_cols[!.ppra_is_sm_example_col(parent, new_cols)]
    if (length(new_cols)) {
      for (cc in new_cols) {
        base <- sub("^.+/", "", cc)
        base <- sub("_(?i:recod)$", "", base)
        base_norm <- .normcode(base)
        v <- .norm01(tmp[[cc]])
        if (length(classic) && base_norm %in% classic_norm) {
          can_code <- classic[match(base_norm, classic_norm)]
          w1 <- which(!is.na(v) & v==1L); if (length(w1)) mat[w1, can_code] <- 1L
          w0 <- which(!is.na(v) & v==0L); if (length(w0)) mat[w0, can_code] <- 0L
        } else {
          sel <- which(!is.na(v) & v==1L)
          if (length(sel)) for (i in sel) new_tokens[[i]] <- unique(c(new_tokens[[i]], base))
          if (!is.null(tpl_labels) && cc %in% names(tpl_labels)) {
            lab <- trimws(as.character(tpl_labels[[cc]]))
            if (nz(lab)) {
              key <- base
              prev <- new_label_candidates[[key]] %||% character(0)
              new_label_candidates[[key]] <- unique(c(prev, lab))
            }
          }
        }
      }
    }
  }

  # Identificar el/los código(s) de la opción "Otros" del SM, para poder
  # desmarcarlo cuando el analista ya clasificó la respuesta abierta en un
  # grupo nuevo. Heurísticas combinadas (any-match):
  #   1) `ch$code` cuyo normalize == "other" (cubre name="other")
  #   2) `ch$label` que empiece por "otro" o "other" (cubre codes
  #      numéricos tipo 70/99 cuya label es "Otros")
  # Si ninguna detecta nada, skip — no rompemos el comportamiento viejo.
  other_codes <- character(0)
  other_codes <- c(
    other_codes,
    classic[.normcode(classic) == "other"]
  )
  if ("label" %in% names(ch)) {
    lab_norm <- .normcode(ch$label)
    other_codes <- c(other_codes, as.character(ch$code[startsWith(lab_norm, "other") | startsWith(lab_norm, "otro")]))
  }
  other_codes <- unique(other_codes[!is.na(other_codes) & nzchar(other_codes)])
  other_col_idx <- match(other_codes, colnames(mat))
  other_col_idx <- other_col_idx[!is.na(other_col_idx)]

  # Pre-computar qué filas tienen respuesta en text_col (las que marcaron
  # "Otros" y escribieron algo abierto).
  text_col <- .resolve_text_col_for_parent(parent, path_familias)
  has_text_per_row <- rep(FALSE, nrow(df_work))
  if (nzchar(text_col) && text_col %in% names(df_work)) {
    t_vals <- as.character(df_work[[text_col]])
    has_text_per_row <- !is.na(t_vals) & nzchar(trimws(t_vals))
  }

  # tokens finales
  parent_recod <- character(nrow(df_work))
  for (i in seq_len(nrow(df_work))){
    # Fix bug #4 (SM): si la fila marcó "Otros" (text_col no vacío) Y fue
    # clasificada en al menos un grupo nuevo, desmarcar la columna "Otros"
    # original en `mat` antes de recolectar los codes. Sin esto, el usuario
    # ve en <parent>_recod algo como "70 4" (el 70 Otros viejo + el 4
    # Polideportivo nuevo) cuando espera "4" sólo. Las filas sin text libre
    # (no marcaron Otros) preservan su comportamiento anterior.
    if (has_text_per_row[i] && length(new_tokens[[i]] %||% character(0)) > 0L &&
        length(other_col_idx) > 0L) {
      for (j in other_col_idx) {
        if (!is.na(mat[i, j]) && mat[i, j] == 1L) mat[i, j] <- 0L
      }
    }

    from_classic <- colnames(mat)[which(mat[i, ] == 1L)]
    from_new     <- new_tokens[[i]] %||% character(0)
    other_idx <- match("other", .normcode(from_classic))
    if (is.na(other_idx)) {
      if ("Other" %in% classic) {
        j <- which(colnames(mat)=="Other")
        if (length(j) && !is.na(mat[i,j]) && mat[i,j]==0L) {
          from_new <- from_new[ .normcode(from_new) != "other" ]
        }
      }
    }
    allcodes <- unique(c(from_classic, from_new))
    parent_recod[i] <- if (length(allcodes)) paste(allcodes, collapse = " ") else NA_character_
  }

  out_col <- paste0(parent, "_recod")

  new_codes_used <- unique(unlist(new_tokens, use.names = FALSE))
  new_codes_used <- new_codes_used[nz(new_codes_used)]
  if (length(new_codes_used)) {
    for (code in new_codes_used) {
      labs <- new_label_candidates[[code]] %||% character(0)
      if (code %in% names(tpl_aux_map)) {
        labs <- c(labs, unname(tpl_aux_map[code]))
      }
      labs <- unique(trimws(as.character(labs)))
      labs <- labs[nz(labs)]
      if (length(labs) > 1L) {
        stop(
          "[Recodificación] En SM '", parent, "', el código nuevo '", code,
          "' tiene más de una etiqueta declarada: ",
          paste(shQuote(labs), collapse = ", "),
          ". Deja una sola etiqueta visible para ese código.",
          call. = FALSE
        )
      }
    }
  }

  if (identical(where$source, "main")) {
    df[[out_col]] <- parent_recod
    return(list(
      df = df, new_col = out_col,
      repeat_sheet = NULL, repeat_df = NULL,
      repeat_cols_to_color = character(0)
    ))
  } else {
    rep_df2 <- df_work
    rep_df2[[out_col]] <- parent_recod
    rep_df2 <- insert_right_of(rep_df2, parent, out_col)
    return(list(
      df = df, new_col = character(0),
      repeat_sheet = where$sheet, repeat_df = rep_df2,
      repeat_cols_to_color = out_col
    ))
  }
}

# ====================== SO (padre) — Opción B con familias --------------------
ppra_so_parent <- function(df, parent, path_instrumento, path_plantilla,
                           path_familias = NULL, path_datos = NULL){
  where   <- if (!is.null(path_datos)) locate_var_sheet(parent, path_datos, path_familias) else list(source="main", sheet=NA)
  df_work <- if (identical(where$source, "main")) df else read_sheet_ci(path_datos, where$sheet)

  ch <- ppra_get_choices_parent(path_instrumento, parent)
  cat_codes <- as.character(ch$code)

  layout <- .ppra_read_template_layout(path_plantilla, parent)
  tpl <- layout$main %||% NULL
  tpl_sheet <- layout$sheet %||% parent

  # tmp (join armonizado)
  if (!is.null(tpl)) {
    kd <- pick_join_key_pair(df_work, tpl)
    if (is.na(kd)) stop("Sin clave común para SO-padre en ", ifelse(identical(where$source,"main"), "main: ", paste0("repeat '", where$sheet, "': ")), parent)
    tmp <- .safe_left_join_by(df_work[, kd, drop = FALSE], tpl, kd)
  } else {
    kd <- pick_join_key(df_work); stopifnot(!is.na(kd))
    tmp <- df_work[, kd, drop = FALSE]
  }
  tnames <- names(tmp)

  .pick <- function(cands) {
    tl <- tolower(tnames)
    for (cand in cands) {
      j <- match(tolower(cand), tl)
      if (!is.na(j)) return(tnames[j])
    }
    NA_character_
  }

  rec_tpl <- .pick(c(paste0(parent,"_RECOD"), paste0(parent,"_recod")))

  base_code <- as.character(df_work[[parent]]); base_code[base_code==""] <- NA_character_
  code_final <- base_code
  if (!is.na(rec_tpl)) {
    x <- trimws(as.character(tmp[[rec_tpl]])); x[x==""] <- NA_character_
    i <- which(!is.na(x)); if (length(i)) code_final[i] <- x[i]

    # Filas "Otros" (text_col con respuesta abierta) que el analista NO
    # clasificó en ningún grupo: dejar NA en lugar de preservar el código
    # original "Otros" (ej. 70, 99) que venía de base_code. Sin esto, el
    # usuario ve p8_recod con una mezcla de códigos nuevos (4 Polideportivo)
    # Y el código "Otros" viejo (70) que supuestamente se desgranó. Las
    # filas con text_col vacío (no marcaron Otros) mantienen su código
    # original 1/2/3 como antes.
    text_col <- .resolve_text_col_for_parent(parent, path_familias)
    if (nzchar(text_col) && text_col %in% names(df_work)) {
      t_vals <- as.character(df_work[[text_col]])
      has_text <- !is.na(t_vals) & nzchar(trimws(t_vals))
      unclassified <- has_text & is.na(x)
      if (any(unclassified)) code_final[unclassified] <- NA_character_
    }
  }

  new_code <- !is.na(code_final) & !(code_final %in% cat_codes)
  aux_map <- .ppra_collect_aux_codebook(
    aux_df = layout$aux %||% tibble::tibble(),
    sheet_label = tpl_sheet,
    target_col = paste0(parent, "_recod"),
    required_codes = unique(code_final[new_code])
  )

  out_col <- paste0(parent, "_recod")

  if (identical(where$source, "main")) {
    df[[out_col]] <- code_final
    return(list(
      df = df, new_col = out_col,
      repeat_sheet = NULL, repeat_df = NULL,
      repeat_cols_to_color = character(0)
    ))
  } else {
    rep_df2 <- df_work
    rep_df2[[out_col]] <- code_final
    rep_df2 <- insert_right_of(rep_df2, parent, out_col)
    return(list(
      df = df, new_col = character(0),
      repeat_sheet = where$sheet, repeat_df = rep_df2,
      repeat_cols_to_color = out_col
    ))
  }
}

# ====================== SO (hijo) ==============================================
resolve_child_recod_col <- function(parent, colnames_tpl, text_col = NULL){
  nm  <- trimws(colnames_tpl)
  nml <- tolower(nm)

  # 1) Si familias da text_col: <text_col>_recod
  if (!is.null(text_col) && nzchar(text_col)) {
    target <- tolower(paste0(text_col, "_recod"))
    j <- which(nml == target)
    if (length(j)) return(nm[j[1]])
  }

  # 2) Si existe <parent>_recod
  targetp <- tolower(paste0(parent, "_recod"))
  j <- which(nml == targetp)
  if (length(j)) return(nm[j[1]])

  # 3) Fallback: parent/..._recod o parent_..._recod
  rx <- paste0("^(?:", parent, "([_/]).+_recod)$")
  cand <- nm[grepl(rx, nm, ignore.case = TRUE, perl = TRUE)]
  if (!length(cand)) return(NA_character_)
  cand[1]
}

ppra_so_child <- function(df, parent, path_plantilla, path_familias = NULL, path_datos = NULL){
  where   <- if (!is.null(path_datos)) locate_var_sheet(parent, path_datos, path_familias) else list(source="main", sheet=NA)
  df_work <- if (identical(where$source, "main")) df else read_sheet_ci(path_datos, where$sheet)

  layout <- .ppra_read_template_layout(path_plantilla, parent)
  tpl <- layout$main %||% NULL
  if (is.null(tpl)) {
    message("[SO-hijo] No hay hoja para '", parent, "'. Omito.")
    return(list(df=df, new_col=character(0),
                repeat_sheet=NULL, repeat_df=NULL, repeat_cols_to_color=character(0)))
  }

  kd <- pick_join_key_pair(df_work, tpl)
  if (is.na(kd)) {
    message("[SO-hijo] Sin clave común para '", parent, "'. Omito.")
    return(list(df=df, new_col=character(0),
                repeat_sheet=NULL, repeat_df=NULL, repeat_cols_to_color=character(0)))
  }

  text_col <- ppra_get_textcol_from_familias(path_familias, parent)
  recod_cols <- setdiff(names(tpl)[grepl("(?i)_recod$", names(tpl), perl = TRUE)], "control")
  src <- NA_character_
  if (nz(text_col)) {
    src <- recod_cols[match(tolower(paste0(text_col, "_recod")), tolower(recod_cols))]
  }
  if (is.na(src) && length(recod_cols) == 1L) {
    src <- recod_cols[1]
  }
  if (!nz(text_col) && !is.na(src)) {
    text_col <- sub("(?i)_recod$", "", src, perl = TRUE)
  }

  if (is.na(src)) {
    message("[SO-hijo] No hallé hija *_recod para '", parent, "'.")
    return(list(df=df, new_col=character(0),
                repeat_sheet=NULL, repeat_df=NULL, repeat_cols_to_color=character(0)))
  }

  tmp <- .safe_left_join_by(df_work[, c(kd), drop = FALSE], tpl[, c(kd, src), drop = FALSE], kd)
  val <- trimws(as.character(tmp[[src]])); val[val==""] <- NA_character_

  aux_map <- .ppra_collect_aux_codebook(
    aux_df = layout$aux %||% tibble::tibble(),
    sheet_label = layout$sheet %||% parent,
    target_col = src,
    required_codes = unique(val[!is.na(val)])
  )
  # --- salida: siempre la columna del texto recodificado ---
  out_col <- paste0(text_col, "_recod")
  anchor  <- if (nz(text_col) && (text_col %in% names(df_work))) text_col else parent

  if (identical(where$source, "main")) {
    if (!(out_col %in% names(df))) df[[out_col]] <- NA_character_
    i <- which(!is.na(val)); if (length(i)) df[[out_col]][i] <- val[i]
    df <- insert_right_of(df, anchor, out_col)
    return(list(df=df, new_col=out_col,
                repeat_sheet=NULL, repeat_df=NULL, repeat_cols_to_color=character(0)))
  } else {
    if (!(out_col %in% names(df_work))) df_work[[out_col]] <- NA_character_
    j <- which(!is.na(val)); if (length(j)) df_work[[out_col]][j] <- val[j]
    df_work <- insert_right_of(df_work, anchor, out_col)
    return(list(df=df, new_col=character(0),
                repeat_sheet=where$sheet, repeat_df=df_work, repeat_cols_to_color=out_col))
  }
}
# ====================== INTEGER ================================================
ppra_integer_recod <- function(df, parent, path_plantilla,
                               path_familias = NULL, path_datos = NULL){
  where   <- if (!is.null(path_datos)) locate_var_sheet(parent, path_datos, path_familias) else list(source="main", sheet=NA)
  df_work <- if (identical(where$source, "main")) df else read_sheet_ci(path_datos, where$sheet)

  layout <- .ppra_read_template_layout(path_plantilla, parent)
  tpl <- layout$main %||% NULL

  if (is.null(tpl)) {
    out_col <- paste0(parent, "_recod")
    if (identical(where$source, "main")) {
      if (!(out_col %in% names(df))) df[[out_col]] <- NA
      return(list(
        df = df, new_col = out_col,
        repeat_sheet = NULL, repeat_df = NULL, repeat_cols_to_color = character(0)
      ))
    } else {
      if (!(out_col %in% names(df_work))) df_work[[out_col]] <- NA
      df_work <- insert_right_of(df_work, parent, out_col)
      return(list(
        df = df, new_col = character(0),
        repeat_sheet = where$sheet, repeat_df = df_work, repeat_cols_to_color = out_col
      ))
    }
  }

  kd <- pick_join_key_pair(df_work, tpl)
  if (is.na(kd)) {
    message("[INTEGER] Sin clave común para '", parent, "'. Omito.")
    out_col <- paste0(parent, "_recod")
    if (identical(where$source, "main")) {
      if (!(out_col %in% names(df))) df[[out_col]] <- NA
      return(list(
        df = df, new_col = out_col,
        repeat_sheet = NULL, repeat_df = NULL, repeat_cols_to_color = character(0)
      ))
    } else {
      if (!(out_col %in% names(df_work))) df_work[[out_col]] <- NA
      df_work <- insert_right_of(df_work, parent, out_col)
      return(list(
        df = df, new_col = character(0),
        repeat_sheet = where$sheet, repeat_df = df_work, repeat_cols_to_color = out_col
      ))
    }
  }

  nm_tpl <- names(tpl)
  src <- nm_tpl[match(tolower(paste0(parent,"_recod")), tolower(nm_tpl))]
  if (is.na(src)) {
    message("[INTEGER] No hallé columna *_recod para '", parent, "'. Omito.")
    out_col <- paste0(parent, "_recod")
    if (identical(where$source, "main")) {
      if (!(out_col %in% names(df))) df[[out_col]] <- NA
      return(list(
        df = df, new_col = out_col,
        repeat_sheet = NULL, repeat_df = NULL, repeat_cols_to_color = character(0)
      ))
    } else {
      if (!(out_col %in% names(df_work))) df_work[[out_col]] <- NA
      df_work <- insert_right_of(df_work, parent, out_col)
      return(list(
        df = df, new_col = character(0),
        repeat_sheet = where$sheet, repeat_df = df_work, repeat_cols_to_color = out_col
      ))
    }
  }

  tmp <- .safe_left_join_by(df_work[, c(kd), drop = FALSE], tpl[, c(kd, src), drop = FALSE], kd)
  val <- trimws(as.character(tmp[[src]]))
  val[val==""] <- NA_character_

  aux_map <- .ppra_collect_aux_codebook(
    aux_df = layout$aux %||% tibble::tibble(),
    sheet_label = layout$sheet %||% parent,
    target_col = src,
    required_codes = unique(val[!is.na(val)])
  )
  out_col <- paste0(parent, "_recod")

  if (identical(where$source, "main")) {
    if (!(out_col %in% names(df))) df[[out_col]] <- NA
    i <- which(!is.na(val)); if (length(i)) df[[out_col]][i] <- val[i]
    return(list(
      df = df, new_col = out_col,
      repeat_sheet = NULL, repeat_df = NULL, repeat_cols_to_color = out_col
    ))
  } else {
    if (!(out_col %in% names(df_work))) df_work[[out_col]] <- NA
    j <- which(!is.na(val)); if (length(j)) df_work[[out_col]][j] <- val[j]
    df_work <- insert_right_of(df_work, parent, out_col)
    return(list(
      df = df, new_col = character(0),
      repeat_sheet = where$sheet, repeat_df = df_work, repeat_cols_to_color = out_col
    ))
  }
}

# ====================== Export preservando hojas ===============================
ppra_export_preserving_sheets <- function(path_datos, out_path,
                                          df_main,
                                          main_cols_color = list(
                                            sm  = character(0),
                                            sop = character(0),
                                            soh = character(0),
                                            int = character(0)
                                          ),
                                          repeat_updates = list()) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    warning("No se encontró 'openxlsx'. No se exporta Excel.")
    return(invisible(NULL))
  }

  sheets <- readxl::excel_sheets(path_datos)
  main_sheet <- sheets[1]

  wb <- openxlsx::createWorkbook()

  paint_cols <- function(wb, sheet, df, cols, color){
    if (!length(cols)) return()
    idx <- match(cols, names(df))
    idx <- idx[!is.na(idx)]
    if (!length(idx)) return()
    openxlsx::addStyle(wb, sheet, openxlsx::createStyle(fgFill = color),
                       rows = 1:(nrow(df)+1), cols = idx,
                       gridExpand = TRUE, stack = TRUE)
  }

  for (s in sheets) {
    openxlsx::addWorksheet(wb, s)

    if (identical(s, main_sheet)) {
      openxlsx::writeData(wb, s, df_main)
      paint_cols(wb, s, df_main, unique(main_cols_color$sm),  "#DFF5DF")
      paint_cols(wb, s, df_main, unique(c(main_cols_color$sop, main_cols_color$soh)), "#DCEBFF")
      paint_cols(wb, s, df_main, unique(main_cols_color$int), "#E6D9F2")
    } else if (s %in% names(repeat_updates)) {
      df_rep  <- repeat_updates[[s]]$df
      cols_sm <- repeat_updates[[s]]$sm  %||% character(0)
      cols_so <- repeat_updates[[s]]$so  %||% character(0)
      cols_int<- repeat_updates[[s]]$int %||% character(0)
      openxlsx::writeData(wb, s, df_rep)
      paint_cols(wb, s, df_rep, unique(cols_sm),  "#DFF5DF")
      paint_cols(wb, s, df_rep, unique(cols_so),  "#DCEBFF")
      paint_cols(wb, s, df_rep, unique(cols_int), "#E6D9F2")
    } else {
      df0 <- read_sheet_ci(path_datos, s)
      openxlsx::writeData(wb, s, df0)
    }

    openxlsx::freezePane(wb, s, firstActiveRow = 2)
    openxlsx::setColWidths(wb, s, cols = 1:200, widths = "auto")
  }

  openxlsx::saveWorkbook(wb, out_path, overwrite = TRUE)
  invisible(out_path)
}

# ====================== FUNCIÓN PRINCIPAL =====================================
#' @title ppra_adaptar_data
#' @description
#' - **SM**: `<parent>_recod` con overrides y nuevas hijas (verde).
#' - **SO-padre**: `<parent>_recod` con override por `text_col` de familias (azul).
#' - **SO-hijo**: `<parent>_<alias>_recod` (azul).
#' - **INTEGER**: `<var>_recod` desde plantilla (morado).
#' Escribe en la **hoja correcta** (main o repeat) e **inserta al lado del parent**.
#' Exporta un XLSX preservando **todas las hojas** del archivo de datos.
#' @family codificacion
#' @export
ppra_adaptar_data <- function(path_instrumento,
                              path_datos,
                              path_plantilla,
                              sm_vars        = character(0),
                              so_parent_vars = character(0),
                              so_child_vars  = character(0),
                              int_vars       = character(0),
                              out_path       = NULL,
                              path_familias  = NULL){

  stopifnot(file.exists(path_instrumento), file.exists(path_datos), file.exists(path_plantilla))

  df <- leer_datos_generico(path_datos)
  df <- .ensure_unique_names(df)

  sm_cols_to_color  <- character(0)
  sop_cols_to_color <- character(0)
  soh_cols_to_color <- character(0)
  int_cols_to_color <- character(0)

  # registro de hojas repeat modificadas
  rep_updates <- list()   # nombre_hoja -> list(df=..., sm=c(...), so=c(...), int=c(...))

  add_rep_update <- function(sheet, df_rep, cols, kind = c("sm","so","int")){
    kind <- match.arg(kind)
    if (!sheet %in% names(rep_updates)) {
      rep_updates[[sheet]] <<- list(df = df_rep, sm = character(0), so = character(0), int = character(0))
    } else {
      rep_updates[[sheet]]$df <<- df_rep
    }
    if (kind == "sm") {
      rep_updates[[sheet]]$sm <<- unique(c(rep_updates[[sheet]]$sm, cols))
    } else if (kind == "so") {
      rep_updates[[sheet]]$so <<- unique(c(rep_updates[[sheet]]$so, cols))
    } else {
      rep_updates[[sheet]]$int <<- unique(c(rep_updates[[sheet]]$int, cols))
    }
  }

  # ---- SM
  if (length(sm_vars)) {
    for (pv in sm_vars) {
      res <- ppra_sm_parent_recod(df, pv, path_instrumento, path_plantilla,
                                  path_datos = path_datos, path_familias = path_familias)
      df  <- res$df
      if (length(res$new_col)) {
        df  <- insert_right_of(df, pv, res$new_col)
        sm_cols_to_color <- c(sm_cols_to_color, res$new_col)
      }
      if (!is.null(res$repeat_sheet)) {
        add_rep_update(res$repeat_sheet, res$repeat_df, res$repeat_cols_to_color, kind = "sm")
      }
    }
  }

  # ---- SO padre
  if (length(so_parent_vars)) {
    for (pv in so_parent_vars) {
      res <- ppra_so_parent(df, pv, path_instrumento, path_plantilla,
                            path_familias = path_familias, path_datos = path_datos)
      df  <- res$df
      if (length(res$new_col)) {
        df  <- insert_right_of(df, pv, res$new_col)
        sop_cols_to_color <- c(sop_cols_to_color, res$new_col)
      }
      if (!is.null(res$repeat_sheet)) {
        add_rep_update(res$repeat_sheet, res$repeat_df, res$repeat_cols_to_color, kind = "so")
      }
    }
  }

  # ---- SO hijo
  if (length(so_child_vars)) {
    for (pv in so_child_vars) {
      res <- ppra_so_child(df, pv, path_plantilla,
                           path_familias = path_familias, path_datos = path_datos)
      df  <- res$df
      if (length(res$new_col)) {
        df  <- insert_right_of(df, pv, res$new_col)
        soh_cols_to_color <- c(soh_cols_to_color, res$new_col)
      }
      if (!is.null(res$repeat_sheet)) {
        add_rep_update(res$repeat_sheet, res$repeat_df, res$repeat_cols_to_color, kind = "so")
      }
    }
  }

  # ---- INTEGER
  if (length(int_vars)) {
    for (iv in int_vars) {
      res <- ppra_integer_recod(df, iv, path_plantilla,
                                path_familias = path_familias, path_datos = path_datos)
      df  <- res$df
      if (length(res$new_col)) {
        df  <- insert_right_of(df, iv, res$new_col)
        int_cols_to_color <- c(int_cols_to_color, res$new_col)
      }
      if (!is.null(res$repeat_sheet)) {
        add_rep_update(res$repeat_sheet, res$repeat_df, res$repeat_cols_to_color, kind = "int")
      }
    }
  }

  # Export preservando TODAS las hojas
  if (!is.null(out_path)) {
    ppra_export_preserving_sheets(
      path_datos  = path_datos,
      out_path    = out_path,
      df_main     = df,
      main_cols_color = list(
        sm  = unique(sm_cols_to_color),
        sop = unique(sop_cols_to_color),
        soh = unique(soh_cols_to_color),
        int = unique(int_cols_to_color)
      ),
      repeat_updates = rep_updates
    )
  }

  df
}
