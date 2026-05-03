#' PPRA – Flujo híbrido con Excel de especificación de familias
#'
#' Helpers y flujo para construir la plantilla de codificación PPRA
#' desde un XLSForm (survey/choices), datos crudos y una especificación
#' de familias en Excel.
#'
#' @keywords internal
#' @name ppra_flujo_hibrido
NULL

`%||%` <- function(x,y) if (is.null(x) || (length(x)==1 && is.na(x))) y else x
nzchr   <- function(x) is.character(x) && length(x)==1 && !is.na(x) && nzchar(x)

# -- utilidades ---------------------------------------------------------------
norm_list_name <- function(x){
  x <- tolower(trimws(as.character(x)))
  x <- gsub("\\s+", "_", x); gsub("[^a-z0-9_]", "_", x)
}
detect_label_col_robust <- function(nms){
  nms_l <- tolower(nms)
  exact <- which(nms_l %in% c("label::spanish (es)","label::spanish(es)","label::spanish","label::es","label::spanish_es"))
  if (length(exact)) return(nms[exact[1]])
  cand  <- which(grepl("^label($|[:_])", nms_l) | grepl("^label", nms_l))
  if (!length(cand)) return(NA_character_)
  nm_sub <- nms_l[cand]
  score <- 6*grepl("label::span|label::es", nm_sub) +
    4*grepl("span|españ|\\bes\\b|_es$|esp|cast", nm_sub) +
    2*grepl("^label($|[:_])", nm_sub) + 1*grepl("^label", nm_sub)
  cand[order(-score)][1] |> (\(i) nms[i])()
}
get_q_label_strict <- function(var, survey_clean, survey_raw){
  if (!nzchr(var)) return(NA_character_)
  var_clean <- janitor::make_clean_names(var)
  lc <- detect_label_col_robust(names(survey_clean)) %||% "label"
  if (!is.na(lc) && lc %in% names(survey_clean) && var_clean %in% survey_clean$name){
    v <- survey_clean[[lc]][match(var_clean, survey_clean$name)]
    if (!is.na(v) && nzchar(trimws(v))) return(v)
  }
  if (!is.null(survey_raw) && "name" %in% names(survey_raw)){
    idx <- which(janitor::make_clean_names(survey_raw$name) == var_clean)
    if (length(idx)){
      lc2 <- detect_label_col_robust(names(survey_raw))
      if (!is.na(lc2) && lc2 %in% names(survey_raw)){
        v <- survey_raw[[lc2]][idx]
        if (!is.na(v) && nzchar(trimws(v))) return(v)
      }
    }
  }
  NA_character_
}
# texto real (no binario)
is_textlike <- function(v){
  if (is.null(v)) return(FALSE)
  x <- as.character(v); x <- x[!is.na(x)]
  if (!length(x)) return(FALSE)
  if (all(x %in% c("0","1","TRUE","FALSE","T","F"))) return(FALSE)
  max(nchar(x), na.rm = TRUE) > 1
}


# Busca la primera columna de "label en español" (case-insensitive) en un data.frame
.detect_label_es_col <- function(df) {
  if (is.null(df) || !ncol(df)) return(NA_character_)
  nms <- names(df); nmsl <- tolower(nms)
  # orden de preferencia
  pats <- c(
    "^label::spanish \\(es\\)$",
    "^label::spanish\\(es\\)$",
    "^label::spanish$",
    "^label::es$",
    "^label_es$",
    "^label_spanish_es$",
    "^label\\b"         # último fallback (si solo hay 'label' y sí está en español)
  )
  for (p in pats) {
    hit <- which(grepl(p, nmsl, perl = TRUE))
    if (length(hit)) return(nms[hit[1]])
  }
  NA_character_
}

# Etiqueta en ES por nombre de variable (survey)
s_lab_from_original <- function(orig, inst){
  if (is.null(orig)) return(NA_character_)
  sr <- inst$survey_raw
  s  <- inst$survey
  col_sr <- .detect_label_es_col(sr)
  cand_s <- intersect(c("label_spanish_es","label_es","label"), names(s))

  vapply(as.list(orig), function(o){
    o <- as.character(o)[1]; if (is.na(o) || !nzchar(o)) return(NA_character_)
    nm <- janitor::make_clean_names(o)

    # 1) survey_raw (preferente)
    if (!is.null(sr) && !is.na(col_sr)) {
      i <- match(nm, janitor::make_clean_names(sr$name))
      if (!is.na(i)) {
        val <- as.character(sr[[col_sr]][i])
        if (length(val)==1 && !is.na(val) && nzchar(trimws(val))) return(val)
      }
    }
    # 2) survey (labels)
    if (length(cand_s)) {
      i2 <- match(nm, janitor::make_clean_names(s$name))
      if (!is.na(i2)) {
        for (cname in cand_s) {
          if (cname %in% names(s)) {
            val <- as.character(s[[cname]][i2])
            if (length(val)==1 && !is.na(val) && nzchar(trimws(val))) return(val)
          }
        }
      }
    }
    # 3) fallback: nombre limpio
    nm
  }, FUN.VALUE = character(1))
}



#' Resolver nombre limpio de parent (desde split)
#'
#' Toma `parent` si existe; si no, `parent_col`. Devuelve el equivalente
#' limpio (coincide con `survey$name`).
#'
#' @param df data.frame con `parent` y/o `parent_col`.
#' @return character con nombres limpios.
#' @family codificacion
#' @export
resolver_parent_limpio <- function(df){
  pc <- if ("parent" %in% names(df) && any(!is.na(df$parent))) df$parent else df$parent_col
  janitor::make_clean_names(pc)
}

# Alias interno para compatibilidad con código previo
#' @keywords internal
#' @noRd
resolve_parent_clean <- function(df) resolver_parent_limpio(df)


.norm_list_name <- function(x){
  x <- trimws(as.character(x))
  x <- tolower(x)
  x <- gsub("\\s+", "_", x)
  x <- gsub("[^a-z0-9_]", "_", x)
  x
}


#' Detectar la mejor columna de label en español (con fallback a "label")
#'
#' Busca primero variantes de español (label::Spanish (ES), etc.). Si no hay,
#' devuelve "label" si existe; si tampoco, NA.
#' @param nms character vector con nombres de columnas
#' @return nombre de columna o NA_character_
#' @family codificacion
#' @export
detect_spanish_col <- function(nms){
  if (is.null(nms) || !length(nms)) return(NA_character_)
  nmsl <- tolower(nms)

  # preferencia ES
  exact <- c(
    "label::spanish (es)", "label::spanish(es)", "label::spanish_es",
    "label_spanish_es", "label::spanish", "label::es"
  )
  hit <- which(nmsl %in% exact)
  if (length(hit)) return(nms[hit[1]])

  # patrón laxo por si hay variantes raras
  hit2 <- which(grepl("^label(::)?span|label[_:]spanish|label[_:]es$", nmsl, perl = TRUE))
  if (length(hit2)) return(nms[hit2[1]])

  # fallback: usar "label" si existe
  if ("label" %in% nmsl) return(nms[which(nmsl == "label")[1]])

  NA_character_
}

#' Label ES desde el instrumento (vectorizado; prioriza survey_raw)
#' @family codificacion
#' @export
s_lab_from_original <- function(orig, inst){
  if (is.null(orig)) return(NA_character_)
  v <- as.character(orig)
  nm_clean <- janitor::make_clean_names(v)

  # 1) survey_raw
  sr <- inst$survey_raw
  if (!is.null(sr) && "name" %in% names(sr)) {
    i <- match(nm_clean, janitor::make_clean_names(sr$name))
    col_es <- detect_spanish_col(names(sr))
    if (!is.na(col_es)) {
      out <- as.character(sr[[col_es]][i])
    } else {
      out <- rep(NA_character_, length(nm_clean))
    }
  } else {
    out <- rep(NA_character_, length(nm_clean))
  }

  # 2) fallback a survey (label_spanish_es / label_es / label)
  s <- inst$survey %||% inst$survey_raw
  if (!is.null(s) && "name" %in% names(s)) {
    i2 <- match(nm_clean, janitor::make_clean_names(s$name))
    col2 <- detect_spanish_col(names(s))
    add  <- if (!is.na(col2)) as.character(s[[col2]][i2]) else NA_character_
    out  <- ifelse(!nzchar(out) | is.na(out), add, out)
  }

  # 3) último recurso: nombre limpio
  out[!nzchar(out) | is.na(out)] <- nm_clean[!nzchar(out) | is.na(out)]
  out
}

#' Tabla de choices con label ES robusto (independiente del formato)
#' @family codificacion
#' @export
choices_es_tbl <- function(inst){
  ch <- inst$choices_raw %||% inst$choices
  if (is.null(ch)) {
    return(tibble::tibble(list_name=character(), list_norm=character(),
                          name=character(), label_es=character()))
  }

  # columna de label (ES si hay; si no, "label"; si no, name)
  col_es <- detect_spanish_col(names(ch))
  lbl    <- if (!is.na(col_es)) ch[[col_es]] else ch$name

  # asegurar list_norm
  if (!"list_norm" %in% names(ch)) {
    ln <- if ("list_name" %in% names(ch)) ch$list_name else NA_character_
    ln_chr <- tolower(trimws(as.character(ln)))
    ch$list_norm <- gsub(
      "[^a-z0-9_]", "_",
      gsub("\\s+", "_", ln_chr)
    )
  }

  tibble::tibble(
    list_name = ch$list_name %||% NA_character_,
    list_norm = ch$list_norm %||% NA_character_,
    code      = as.character(ch$name),
    label_es  = as.character(lbl)
  )
}


#' Normalizar etiquetas y listas en el instrumento (survey/choices)
#'
#' Asegura columnas estandarizadas para trabajar a gusto:
#' \itemize{
#'   \item En \code{survey}: crea/rellena \code{label_es} a partir de las columnas
#'         de label disponibles (preferencia ES > EN > label genérica > name).
#'         También garantiza \code{list_norm} (normalización de \code{list_name}).
#'   \item En \code{choices}: crea/rellena \code{choice_label} (preferencia ES > EN > label > name)
#'         y garantiza \code{list_norm}.
#' }
#'
#' La función tolera entradas con \code{survey}/\code{choices} limpios o
#' \code{survey_raw}/\code{choices_raw} (en cuyo caso limpia nombres primero).
#'
#' @param inst Lista con, idealmente, \code{$survey} y \code{$choices}. Si no existen,
#'   intenta usar \code{$survey_raw} y \code{$choices_raw}.
#'
#' @return La misma lista \code{inst}, con \code{$survey} y \code{$choices}
#'   normalizados (columnas \code{label_es}, \code{choice_label}, \code{list_norm} presentes).
#' @family codificacion
#' @export
#'
#' @examples
#' \dontrun{
#' inst <- leer_instrumento_xlsform("instrumento_pdm.xlsx")
#' inst <- normalizar_labels_inst(inst)
#' }
normalizar_labels_inst <- function(inst){
  stopifnot(is.list(inst))


  #' Resolver nombre limpio de parent desde split
  #'
  #' Función auxiliar para unificar la clave de las preguntas.
  #' Toma la columna `parent` si existe (y no está vacía); de lo contrario usa `parent_col`.
  #' Ambos se normalizan con \code{janitor::make_clean_names()} para que coincidan con `survey$name`.
  #'
  #' @param df Data frame que proviene de \code{split$select_one}, \code{split$select_multiple} o \code{split$text}.
  #' @return Un vector de nombres "clean" (caracter).
  #' @keywords internal
  #' @export
  resolver_parent_limpio <- function(df) {
    pc <- if ("parent" %in% names(df) && any(!is.na(df$parent))) {
      df$parent
    } else {
      df$parent_col
    }
    janitor::make_clean_names(pc)
  }

  # -- helpers locales --------------------------------------------------------
  `%||%` <- function(x, y) if (is.null(x) || (length(x) == 1 && is.na(x))) y else x

  norm_list_name <- function(x){
    x <- tolower(trimws(as.character(x)))
    x <- gsub("\\s+", "_", x)
    gsub("[^a-z0-9_]", "_", x)
  }

  detect_label_col_robust <- function(nms){
    nms_l <- tolower(nms)
    exact <- which(nms_l %in% c("label::spanish (es)","label::spanish(es)","label::spanish",
                                "label::es","label_spanish_es","label::spanish_es"))
    if (length(exact)) return(nms[exact[1]])
    cand  <- which(grepl("^label($|[:_])", nms_l) | grepl("^label", nms_l))
    if (!length(cand)) return(NA_character_)
    nms[cand[1]]
  }

  coalesce_first <- function(df, out_col, candidates, fallback){
    if (!out_col %in% names(df)) df[[out_col]] <- NA_character_
    for (c in candidates) if (c %in% names(df)) {
      df[[out_col]] <- dplyr::coalesce(df[[out_col]], as.character(df[[c]]))
    }
    df[[out_col]] <- dplyr::coalesce(df[[out_col]], as.character(df[[fallback]]))
    df
  }

  # -- resolver survey/choices base ------------------------------------------
  survey  <- inst$survey  %||% (inst$survey_raw  %||% NULL)
  choices <- inst$choices %||% (inst$choices_raw %||% NULL)

  if (is.null(survey) || is.null(choices)) {
    abort("`inst` debe incluir `survey` y `choices` (o `survey_raw`/`choices_raw`).")
  }

  # limpiar nombres si vienen crudos
  if (!"name" %in% names(survey))  survey  <- janitor::clean_names(survey)
  if (!"name" %in% names(choices)) choices <- janitor::clean_names(choices)

  # -- SURVEY -----------------------------------------------------------------
  # detectar label en survey (ES si existe, si no el mejor disponible)
  lab_s <- detect_label_col_robust(names(survey)) %||% (if ("label" %in% names(survey)) "label" else NA_character_)
  if (!"label_es" %in% names(survey)) survey$label_es <- NA_character_
  if (!is.na(lab_s) && lab_s %in% names(survey)) {
    survey$label_es <- dplyr::coalesce(survey$label_es, as.character(survey[[lab_s]]))
  }
  # fallback: inglés -> label genérica -> name
  for (alt in c("label_english_en","label")) {
    if (alt %in% names(survey)) {
      survey$label_es <- dplyr::coalesce(survey$label_es, as.character(survey[[alt]]))
    }
  }
  survey$label_es <- dplyr::coalesce(survey$label_es, as.character(survey$name))

  # list_name y list_norm desde type (si faltan)
  if (!"list_name" %in% names(survey)) {
    if (!"type" %in% names(survey)) survey$type <- NA_character_
    survey$list_name <- trimws(sub("^\\S+\\s+","", survey$type))
  }
  if (!"list_norm" %in% names(survey)) {
    survey$list_norm <- norm_list_name(survey$list_name)
  } else {
    survey$list_norm <- dplyr::coalesce(survey$list_norm, norm_list_name(survey$list_name))
  }

  # -- CHOICES ----------------------------------------------------------------
  # asegurar choice_label con preferencia ES -> EN -> label -> name
  # y completar list_norm
  if (!"list_name" %in% names(choices)) {
    abort("La hoja `choices` no tiene `list_name`. Renómbrala o provee un mapeo previo.")
  }

  # detectar label en choices
  lab_c <- detect_label_col_robust(names(choices)) %||% (if ("label" %in% names(choices)) "label" else NA_character_)
  if (!"choice_label" %in% names(choices)) choices$choice_label <- NA_character_
  if (!is.na(lab_c) && lab_c %in% names(choices)) {
    choices$choice_label <- dplyr::coalesce(choices$choice_label, as.character(choices[[lab_c]]))
  }
  for (alt in c("label_english_en","label")) {
    if (alt %in% names(choices)) {
      choices$choice_label <- dplyr::coalesce(choices$choice_label, as.character(choices[[alt]]))
    }
  }
  choices$choice_label <- dplyr::coalesce(choices$choice_label, as.character(choices$name))

  # list_norm
  if (!"list_norm" %in% names(choices)) {
    choices$list_norm <- norm_list_name(choices$list_name)
  } else {
    choices$list_norm <- dplyr::coalesce(choices$list_norm, norm_list_name(choices$list_name))
  }

  # homogenizar por si acaso
  choices$list_norm <- norm_list_name(choices$list_norm)
  survey$list_norm  <- norm_list_name(survey$list_norm)

  # -- devolver en inst -------------------------------------------------------
  inst$survey  <- survey
  inst$choices <- choices
  inst
}


# --- AUDITORÍA Y ENRIQUECIMIENTO -------------------------------------------

auditar_split <- function(split){
  req_common <- c("parent_col")
  req_one    <- c(req_common, "text_col")
  req_mult   <- c(req_common, "text_col", "other_dummy_col")
  req_text   <- c("parent_col")

  faltan <- function(df, req){
    setdiff(req, names(df))
  }

  cat("\n[AUDITORÍA split]\n")
  if (!is.null(split$select_one)) {
    f <- faltan(split$select_one, req_one)
    cat("select_one   -> faltan:", if (length(f)) paste(f, collapse=", ") else "ok", "\n")
  } else cat("select_one   -> objeto ausente\n")

  if (!is.null(split$select_multiple)) {
    f <- faltan(split$select_multiple, req_mult)
    cat("select_multiple -> faltan:", if (length(f)) paste(f, collapse=", ") else "ok", "\n")
  } else cat("select_multiple -> objeto ausente\n")

  if (!is.null(split$text)) {
    f <- faltan(split$text, req_text)
    cat("text         -> faltan:", if (length(f)) paste(f, collapse=", ") else "ok", "\n")
  } else cat("text         -> objeto ausente\n")
  invisible(split)
}

enriquecer_split_con_survey <- function(split, inst){
  survey <- inst$survey
  stopifnot(!is.null(survey), "name" %in% names(survey))

  # helper: a partir de parent_col (nombre original),
  # tratar de encontrar la fila del survey (por name ya "clean"):
  find_s_row <- function(parent_col){
    # parent_col viene en "original". Lo limpiamos para buscar en survey$name:
    nm_clean <- janitor::make_clean_names(parent_col)
    which(survey$name == nm_clean)[1] %||% NA_integer_
  }

  enrich_df <- function(df){
    if (is.null(df) || !nrow(df)) return(df)

    # columnas destino para no fallar
    for (k in c("parent","parent_label","q_order","list_name","list_norm","parent_key")) {
      if (!k %in% names(df)) df[[k]] <- NA
    }

    # 1) clave limpia para cruzar (NO tocar `parent` original del Excel)
    #    usamos parent si viene; si no, parent_col; y lo limpiamos -> parent_clean
    src_parent <- if ("parent" %in% names(df) && any(!is.na(df$parent))) df$parent else df$parent_col
    parent_clean <- janitor::make_clean_names(src_parent)

    # 2) match contra survey$name
    survey <- inst$survey
    idx <- match(parent_clean, survey$name)
    ok  <- !is.na(idx)

    # 3) parent_key: guardar SIEMPRE la clave limpia que matchea survey
    df$parent_key[ok] <- survey$name[idx[ok]]

    # 4) NO SOBREESCRIBIR `parent` si ya venía; si está vacío,
    #    preferimos mostrar el original de datos (parent_col) y, si no, la clave limpia
    df$parent <- dplyr::coalesce(df$parent, df$parent_col, df$parent_key)

    # 5) label en español usando survey_raw/survey (helper robusto)
    df$parent_label[ok] <- label_es_from_inst(df$parent[ok], inst)

    # 6) metadatos si existen en survey
    if ("q_order"   %in% names(survey))   df$q_order[ok]   <- survey$q_order[idx[ok]]
    if ("list_name" %in% names(survey))   df$list_name[ok] <- survey$list_name[idx[ok]]
    if ("list_norm" %in% names(survey))   df$list_norm[ok] <- survey$list_norm[idx[ok]]

    df
  }

  split$select_one      <- enrich_df(split$select_one)
  split$select_multiple <- enrich_df(split$select_multiple)
  split$text            <- enrich_df(split$text)
  split
}



# -- 1) Instrumento -----------------------------------------------------------
#' Leer XLSForm sin normalización agresiva (solo auxiliares mínimas)
#'
#' Lee `survey` y `choices` y NO mezcla idiomas ni reescribe labels.
#' Solo añade:
#' - `q_order` (número de fila),
#' - `type_base` (primer token de `type`),
#' - `list_name` (si falta, se extrae de `type`),
#' - `list_norm` (normalización de `list_name` para cruzar con choices),
#' - `label_spanish_es` en ambas hojas si existe alguna variante de columna ES.
#'
#' Nada más se modifica. Las columnas originales quedan intactas.
#'
#' @param path Ruta al XLSForm (.xlsx)
#' @return lista con `survey_raw`, `choices_raw`, `survey`, `choices`
#' @family codificacion
#' @export
leer_instrumento_xlsform <- function(path){
  # --- helpers locales, sin tocar labels originales ---
  .norm_list_name <- function(x){
    x <- tolower(trimws(as.character(x)))
    x <- gsub("\\s+", "_", x)
    gsub("[^a-z0-9_]", "_", x)
  }
  .find_spanish_col <- function(nms){
    nms_l <- tolower(nms)
    # preferimos coincidencias exactas comunes
    exact <- c(
      "label::spanish (es)","label::spanish(es)","label::spanish_es",
      "label_spanish_es","label::spanish","label::es"
    )
    hit <- which(nms_l %in% exact)
    if (length(hit)) return(nms[hit[1]])
    # fallback muy suave (si realmente hiciera falta)
    hit2 <- which(grepl("^label(::)?span|label[_:]es$", nms_l, perl = TRUE))
    if (length(hit2)) return(nms[hit2[1]])
    NA_character_
  }

  # --- leer crudo tal cual ---
  survey_raw  <- suppressWarnings(readxl::read_excel(path, sheet = "survey"))
  choices_raw <- suppressWarnings(readxl::read_excel(path, sheet = "choices"))

  # trabajamos sobre copias (no clean_names para no romper nada)
  survey  <- survey_raw
  choices <- choices_raw

  # columnas base en survey
  if (!"name" %in% names(survey)) stop("La hoja 'survey' debe tener columna 'name'.")
  if (!"type" %in% names(survey)) survey$type <- NA_character_

  # auxiliares mínimas
  survey$q_order   <- seq_len(nrow(survey))
  survey$type_base <- sub("\\s.*$", "", as.character(survey$type %||% ""))
  if (!"list_name" %in% names(survey) || all(is.na(survey$list_name))) {
    survey$list_name <- trimws(sub("^\\S+\\s+","", as.character(survey$type %||% "")))
  }
  survey$list_norm <- .norm_list_name(survey$list_name)

  # alias del label ES si existe alguna variante
  s_es_col <- .find_spanish_col(names(survey))
  survey$label_spanish_es <- if (!is.na(s_es_col)) as.character(survey[[s_es_col]]) else NA_character_

  # columnas base en choices
  if (!"list_name" %in% names(choices)) stop("La hoja 'choices' debe tener 'list_name'.")
  if (!"name" %in% names(choices))     stop("La hoja 'choices' debe tener 'name' (código).")

  choices$list_norm <- .norm_list_name(choices$list_name)
  choices$choice_code <- as.character(choices$name)

  c_es_col <- .find_spanish_col(names(choices))
  choices$label_spanish_es <- if (!is.na(c_es_col)) as.character(choices[[c_es_col]]) else NA_character_

  list(
    survey_raw  = survey_raw,
    choices_raw = choices_raw,
    survey      = survey,
    choices     = choices
  )
}

#' Auditoría mínima (sin normalizar)
#' @param inst lista devuelta por `leer_instrumento_xlsform_min()`
#' @family codificacion
#' @export
auditar_inst_min <- function(inst){
  cat("[inst] elementos:", paste(names(inst), collapse=", "), "\n")
  s <- inst$survey; c <- inst$choices
  cat("\n[survey] filas/cols:", nrow(s), "/", ncol(s), "\n")
  cat("  columnas claves presentes:",
      paste(intersect(c("name","type","q_order","type_base","list_name","list_norm","label_spanish_es"), names(s)), collapse=", "),
      "\n")
  cat("  NAs en label_spanish_es:", sum(is.na(s$label_spanish_es)), "de", nrow(s), "\n")
  cat("\n[choices] filas/cols:", nrow(c), "/", ncol(c), "\n")
  cat("  columnas claves presentes:",
      paste(intersect(c("list_name","list_norm","name","choice_code","label_spanish_es"), names(c)), collapse=", "),
      "\n")
  cat("  NAs en label_spanish_es (choices):", sum(is.na(c$label_spanish_es)), "de", nrow(c), "\n")
  invisible(inst)
}




#' Detectar secciones repeat y relaciones SO/SM↔TEXT en el instrumento
#'
#' Escanea la hoja `survey` del XLSForm para clasificar cada variable por:
#' - `type_base` (select_one, select_multiple, text, calculate, etc.)
#' - `repeat_section` (nombre de la sección repeat a la que pertenece, o "main")
#' - `hoja_esperada` (igual a `repeat_section`, usable para enrutar a la hoja de datos)
#' - banderas `is_repeat`, `is_select`, `is_text`, `is_calc`
#' - relación padre→texto asociado: `parent_select` y `parent_text` (p.ej. *_other/_why/_specify/_text)
#'
#' La detección de secciones se basa exclusivamente en los pares `begin repeat` / `end repeat`
#' (también acepta `begin_repeat`/`end_repeat`). El enlace SO/SM→TEXT se resuelve por sufijos
#' comunes dentro de **la misma sección**.
#'
#' @param inst list. Instrumento leído (debes tener `inst$survey`), tal como lo entrega
#'   `leer_instrumento_xlsform()`. No se requiere normalización adicional.
#' @param sufijos_text character. Sufijos a considerar como texto asociado a un select.
#'   Default: c("_other","_otra","_otro","_specify","_text","_why")
#'
#' @return Un tibble con una fila por variable de `survey` y columnas:
#' \describe{
#'   \item{var_name}{Nombre según `survey$name` (original).}
#'   \item{var_clean}{Nombre normalizado (coincide con `janitor::make_clean_names(survey$name)`).}
#'   \item{type_base}{Primer token de `type`.}
#'   \item{repeat_section}{Nombre de la sección repeat a la que pertenece o "main".}
#'   \item{hoja_esperada}{Nombre de hoja donde se espera encontrar datos (igual a `repeat_section`).}
#'   \item{is_repeat}{TRUE si la variable está dentro de un repeat.}
#'   \item{is_select}{TRUE si `type_base` es select_one o select_multiple.}
#'   \item{is_text}{TRUE si `type_base` es text.}
#'   \item{is_calc}{TRUE si `type_base` es calculate.}
#'   \item{parent_select}{Para TEXT: nombre del select asociado. Para SELECT: su propio nombre.}
#'   \item{parent_text}{Para SELECT: texto asociado si existe (por sufijos). Para TEXT: su propio nombre.}
#' }
#'
#' @examples
#' \dontrun{
#' inst <- leer_instrumento_xlsform("RMS_instrumento.xlsx")
#' det  <- codif_detector_repeat(inst)
#' dplyr::count(det, repeat_section, type_base)
#' det %>% dplyr::filter(is_select) %>% dplyr::select(repeat_section, var_name, parent_text)
#' }
#' @family codificacion
#' @export
codif_detector_repeat <- function(inst,
                                  sufijos_text = c("_other","_otra","_otro","_specify","_text","_why")) {
  stopifnot(is.list(inst), "survey" %in% names(inst))
  s <- inst$survey
  stopifnot("name" %in% names(s), "type" %in% names(s))

  # columnas auxiliares mínimas
  n <- nrow(s)
  if (!n) {
    return(tibble::tibble(
      var_name=character(), var_clean=character(), type_base=character(),
      repeat_section=character(), hoja_esperada=character(),
      is_repeat=logical(), is_select=logical(), is_text=logical(), is_calc=logical(),
      parent_select=character(), parent_text=character()
    ))
  }

  name_orig  <- as.character(s$name)
  name_clean <- janitor::make_clean_names(name_orig)
  type_chr   <- as.character(s$type)
  type_base  <- sub("\\s.*$", "", tolower(type_chr))

  # detectar bloques repeat
  tb        <- tolower(gsub("\\s+", "_", type_chr))
  is_begin  <- grepl("^begin_?repeat\\b", tb)
  is_end    <- grepl("^end_?repeat\\b", tb)

  repeat_stack <- character(0)
  section      <- character(n)
  rep_name_cur <- NA_character_

  for (i in seq_len(n)) {
    if (is_begin[i]) {
      rep_name_cur <- janitor::make_clean_names(name_orig[i] %||% paste0("repeat_", i))
      repeat_stack <- c(repeat_stack, rep_name_cur)
      section[i]   <- rep_name_cur
      next
    }
    if (is_end[i]) {
      section[i] <- rep_name_cur %||% "main"
      if (length(repeat_stack)) repeat_stack <- repeat_stack[-length(repeat_stack)]
      rep_name_cur <- if (length(repeat_stack)) repeat_stack[length(repeat_stack)] else NA_character_
      next
    }
    section[i] <- if (!is.na(rep_name_cur)) rep_name_cur else "main"
  }

  # índice por sección para resolver vínculos SO/SM ↔ TEXT por sufijo
  df <- tibble::tibble(
    var_name      = name_orig,
    var_clean     = name_clean,
    type_base     = type_base,
    repeat_section= section,
    hoja_esperada = section
  )

  df$is_repeat <- df$repeat_section != "main"
  df$is_select <- df$type_base %in% c("select_one","select_multiple")
  df$is_text   <- df$type_base %in% c("text")
  df$is_calc   <- df$type_base %in% c("calculate")

  # resolver parent_text para cada SELECT dentro de su sección
  df$parent_text   <- NA_character_
  df$parent_select <- NA_character_

  # Para SELECT: parent_select = él mismo; parent_text = texto asociado (si existe)
  for (sec in unique(df$repeat_section)) {
    idx_sec <- which(df$repeat_section == sec)
    sec_vars <- df[idx_sec, , drop = FALSE]

    # mapa rápido var_clean -> var_name
    map_name_by_clean <- stats::setNames(sec_vars$var_name, sec_vars$var_clean)

    # para cada select, buscar text con sufijos
    sel_idx <- idx_sec[which(df$is_select[idx_sec])]
    for (i in sel_idx) {
      p_clean <- df$var_clean[i]
      # candidatos text por sufijo
      poss <- paste0(p_clean, sufijos_text)
      hit_clean <- intersect(poss, sec_vars$var_clean[sec_vars$is_text])
      if (length(hit_clean)) {
        df$parent_text[i] <- map_name_by_clean[hit_clean[1]]
      }
      df$parent_select[i] <- df$var_name[i]
    }

    # Para TEXT: intentar hallar su select padre por sufijo inverso
    txt_idx <- idx_sec[which(df$is_text[idx_sec])]
    for (i in txt_idx) {
      t_clean <- df$var_clean[i]
      # si t_clean termina en alguno de los sufijos, recorta y busca el select
      suf_hit <- sufijos_text[endsWith(t_clean, sufijos_text)]
      if (length(suf_hit)) {
        base_clean <- sub(paste0(suf_hit[1], "$"), "", t_clean)
        # ¿existe un select con ese base?
        sel_clean <- sec_vars$var_clean[sec_vars$is_select]
        if (base_clean %in% sel_clean) {
          df$parent_select[i] <- map_name_by_clean[base_clean]
        }
      }
      df$parent_text[i] <- df$var_name[i]
    }
  }

  df
}


# -- 2) Datos -----------------------------------------------------------------

#' Leer datos manteniendo nombres originales + mapa clean↔original
#'
#' Lee un archivo de datos (.xlsx/.csv) **sin alterar tipos ni valores** y
#' preservando los nombres de columnas tal como vienen. Además construye:
#' \itemize{
#'   \item \code{$clean}: una copia con nombres normalizados vía
#'         \code{janitor::make_clean_names()} (para cruzar con \code{survey$name}).
#'   \item \code{$name_map}: tibble con el mapeo \code{clean ↔ original}.
#' }
#'
#' @param path Ruta al archivo (xlsx/csv).
#' @param sheet Hoja (si aplica; usada solo si el archivo es Excel).
#'
#' @return Lista con \code{raw}, \code{clean}, \code{name_map}.
#' @family codificacion
#' @export
leer_datos <- function(path, sheet = NULL){
  ext <- tolower(tools::file_ext(path))

  raw <- if (ext %in% c("csv","txt")){
    # No forzar clases ni mostrar el banner de tipos
    suppressWarnings(readr::read_csv(path, show_col_types = FALSE))
  } else {
    # Excel: no tocar tipos; hoja opcional
    suppressWarnings(readxl::read_excel(path, sheet = sheet))
  }

  orig  <- names(raw)
  clean <- janitor::make_clean_names(orig)
  dfc   <- raw; names(dfc) <- clean

  name_map <- tibble::tibble(clean = clean, original = orig)

  list(raw = raw, clean = dfc, name_map = name_map)
}

# -- detectores con nombres ORIGINALES ----------------------------------------

#' Resolver la columna ORIGINAL en datos para un parent dado
#'
#' Prefiere coincidencia EXACTA con el nombre original; si no, usa el
#' equivalente \code{clean} para hallar el original en \code{name_map}.
#'
#' @param parent_name Nombre de variable (puede venir de \code{survey$name}).
#' @param name_map Tibble con columnas \code{clean, original} (de \code{leer_datos}).
#' @return Cadena con el nombre ORIGINAL en la base de datos, o NA si no se encuentra.
#' @family codificacion
#' @export
resolve_parent_col_original <- function(parent_name, name_map){
  if (is.null(parent_name) || is.na(parent_name)) return(NA_character_)
  # 1) exacto contra original
  if (parent_name %in% name_map$original) return(parent_name)
  # 2) por clean
  cl  <- janitor::make_clean_names(parent_name)
  hit <- name_map$original[name_map$clean == cl]
  hit[1] %||% NA_character_
}

#' Encontrar columna de TEXTO tipo *_other/_specify/_text para un parent ORIGINAL
#'
#' Busca una columna que siga la convención "parent + sufijo de texto".
#'
#' @param parent_original Nombre ORIGINAL del parent en los datos.
#' @param name_map Tibble \code{clean, original}.
#' @return Nombre ORIGINAL encontrado o NA.
#' @family codificacion
#' @export
find_text_other_for_parent <- function(parent_original, name_map){
  if (!nzchr(parent_original)) return(NA_character_)
  suf <- c("_other","_otra","_otro","_specify","_text","_elsewhere","_elswhere")
  rx  <- paste0("^", gsub("([\\W])","\\\\\\1", parent_original),
                "(", paste0(suf, collapse="|"), ")$")
  hit <- name_map$original[grepl(rx, name_map$original, ignore.case = TRUE, perl = TRUE)]
  hit[1] %||% NA_character_
}

#' Encontrar columnas dummy "Parent/Code" (select_multiple) para un parent ORIGINAL
#'
#' @param parent_original Nombre ORIGINAL del parent en los datos.
#' @param name_map Tibble \code{clean, original}.
#' @return Vector de nombres ORIGINALES que cumplen el patrón \code{"Parent/Algo"}.
#' @family codificacion
#' @export
find_dummy_cols_for_parent <- function(parent_original, name_map){
  if (!nzchr(parent_original)) return(character(0))
  rx  <- paste0("^", gsub("([\\W])","\\\\\\1", parent_original), "\\s*/\\s*[^/]+$")
  name_map$original[grepl(rx, name_map$original, perl = TRUE)]
}

#' Encontrar dummy específica "/Other" (u "Otro/Otra") para un parent ORIGINAL
#'
#' @param parent_original Nombre ORIGINAL del parent en los datos.
#' @param name_map Tibble \code{clean, original}.
#' @return Nombre ORIGINAL de la dummy "/Other" si existe; NA en caso contrario.
#' @family codificacion
#' @export
find_other_dummy_for_parent <- function(parent_original, name_map){
  dums <- find_dummy_cols_for_parent(parent_original, name_map)
  out  <- dums[grepl("/\\s*(other|otro|otra)\\s*$", dums, ignore.case = TRUE)]
  out[1] %||% NA_character_
}

.codif_regex_escape <- function(x){
  gsub("([\\W])", "\\\\\\1", as.character(x), perl = TRUE)
}

.codif_dummy_col_available <- function(cols, parent_col, dummy_col){
  parent_col <- as.character(parent_col %||% "")
  dummy_col <- as.character(dummy_col %||% "")
  if (!length(dummy_col) || is.na(dummy_col) || !nzchar(dummy_col)) return(FALSE)
  if (dummy_col %in% cols) return(TRUE)
  # Base ODK normalizada: la opción de un select_multiple puede no tener
  # dummy física; se marca como token dentro de la columna madre.
  length(parent_col) && !is.na(parent_col) && nzchar(parent_col) &&
    parent_col %in% cols &&
    startsWith(dummy_col, paste0(parent_col, "/")) &&
    nzchar(sub("^.+/", "", dummy_col))
}

.codif_norm_list_name <- function(x){
  x <- tolower(trimws(as.character(x)))
  x <- gsub("\\s+", "_", x)
  gsub("[^a-z0-9_]", "_", x)
}

.codif_build_survey_context <- function(inst){
  survey <- inst$survey %||% inst$survey_raw
  if (is.null(survey) || !nrow(survey) || !"name" %in% names(survey)) {
    return(tibble::tibble(
      survey_idx = integer(),
      q_order = integer(),
      name = character(),
      name_clean = character(),
      type = character(),
      type_base = character(),
      relevant = character(),
      repeat_section = character(),
      group_path = character()
    ))
  }

  if (!"type" %in% names(survey)) survey$type <- NA_character_
  if (!"q_order" %in% names(survey) || all(is.na(survey$q_order))) {
    survey$q_order <- seq_len(nrow(survey))
  }

  rel_col <- names(survey)[match(TRUE, tolower(names(survey)) %in% c("relevant", "relevance"))]
  relevant <- if (!is.na(rel_col)) as.character(survey[[rel_col]]) else rep(NA_character_, nrow(survey))
  type_chr <- as.character(survey$type)
  type_tok <- tolower(gsub("\\s+", "_", type_chr))
  type_base <- sub("\\s.*$", "", tolower(type_chr))
  name_clean <- janitor::make_clean_names(survey$name)

  repeat_stack <- character(0)
  group_stack  <- character(0)
  repeat_section <- character(nrow(survey))
  group_path     <- character(nrow(survey))

  for (i in seq_len(nrow(survey))) {
    repeat_section[i] <- if (length(repeat_stack)) repeat_stack[length(repeat_stack)] else "main"
    group_path[i]     <- if (length(group_stack)) paste(group_stack, collapse = "/") else "main"

    if (grepl("^begin_?repeat\\b", type_tok[i])) {
      nm <- name_clean[i] %||% paste0("repeat_", i)
      repeat_stack <- c(repeat_stack, nm)
      group_stack  <- c(group_stack, nm)
      next
    }
    if (grepl("^begin_?group\\b", type_tok[i])) {
      nm <- name_clean[i] %||% paste0("group_", i)
      group_stack <- c(group_stack, nm)
      next
    }
    if (grepl("^end_?repeat\\b", type_tok[i])) {
      if (length(group_stack)) group_stack <- head(group_stack, -1)
      if (length(repeat_stack)) repeat_stack <- head(repeat_stack, -1)
      next
    }
    if (grepl("^end_?group\\b", type_tok[i]) && length(group_stack)) {
      group_stack <- head(group_stack, -1)
    }
  }

  tibble::tibble(
    survey_idx = seq_len(nrow(survey)),
    q_order = as.integer(survey$q_order),
    name = as.character(survey$name),
    name_clean = name_clean,
    type = type_chr,
    type_base = type_base,
    relevant = relevant,
    repeat_section = repeat_section,
    group_path = group_path
  )
}

.codif_choices_lookup <- function(inst, survey_ctx = NULL){
  survey_ctx <- survey_ctx %||% .codif_build_survey_context(inst)
  if (!nrow(survey_ctx)) return(list())

  choices_es <- choices_es_tbl(inst)
  if (!nrow(choices_es)) return(list())

  survey <- inst$survey %||% inst$survey_raw
  if (is.null(survey) || !"name" %in% names(survey)) return(list())
  if (!"list_norm" %in% names(survey)) {
    if (!"list_name" %in% names(survey)) {
      survey$list_name <- trimws(sub("^\\S+\\s+", "", as.character(survey$type %||% "")))
    }
    survey$list_norm <- .codif_norm_list_name(survey$list_name)
  }

  sel_rows <- survey_ctx$type_base %in% c("select_one", "select_multiple")
  parent_map <- tibble::tibble(
    parent_clean = survey_ctx$name_clean[sel_rows],
    list_norm = as.character(survey$list_norm[match(survey_ctx$name[sel_rows], as.character(survey$name))])
  ) %>%
    dplyr::filter(!is.na(.data$list_norm) & nzchar(.data$list_norm)) %>%
    dplyr::distinct()

  out <- vector("list", nrow(parent_map))
  names(out) <- parent_map$parent_clean
  for (i in seq_len(nrow(parent_map))) {
    out[[i]] <- choices_es %>%
      dplyr::filter(.data$list_norm == !!parent_map$list_norm[i]) %>%
      dplyr::transmute(
        code = as.character(.data$code),
        label = as.character(dplyr::coalesce(.data$label_es, .data$code))
      )
  }
  out
}

.codif_extract_trigger_code <- function(relevant, parent_clean){
  if (!nzchr(parent_clean)) return(NA_character_)
  rel <- trimws(as.character(relevant)[1] %||% "")
  if (!nzchar(rel)) return(NA_character_)

  p_rx <- .codif_regex_escape(parent_clean)
  pats <- c(
    paste0("selected\\s*\\(\\s*\\$\\{", p_rx, "\\}\\s*,\\s*['\"]?([^'\"\\)\\s]+)['\"]?\\s*\\)"),
    paste0("\\$\\{", p_rx, "\\}\\s*=\\s*['\"]?([^'\"\\s\\)&|=]+)['\"]?")
  )

  for (pat in pats) {
    hit <- regmatches(rel, regexec(pat, rel, ignore.case = TRUE, perl = TRUE))[[1]]
    if (length(hit) >= 2 && nzchar(hit[2])) return(hit[2])
  }
  NA_character_
}

.codif_find_semantic_text_link <- function(parent_name,
                                           inst,
                                           survey_ctx = NULL,
                                           choices_lookup = NULL){
  survey_ctx <- survey_ctx %||% .codif_build_survey_context(inst)
  choices_lookup <- choices_lookup %||% .codif_choices_lookup(inst, survey_ctx)

  parent_clean <- janitor::make_clean_names(parent_name)
  parent_row <- survey_ctx %>%
    dplyr::filter(.data$name_clean == !!parent_clean,
                  .data$type_base %in% c("select_one", "select_multiple")) %>%
    dplyr::slice(1)
  if (!nrow(parent_row)) {
    return(list(text_name = NA_character_, trigger_code = NA_character_, source = NA_character_))
  }

  candidates <- survey_ctx %>%
    dplyr::filter(.data$type_base == "text",
                  .data$q_order > !!parent_row$q_order[[1]],
                  .data$repeat_section == !!parent_row$repeat_section[[1]])
  if (!nrow(candidates)) {
    return(list(text_name = NA_character_, trigger_code = NA_character_, source = NA_character_))
  }

  same_group <- candidates$group_path == parent_row$group_path[[1]]
  if (any(same_group, na.rm = TRUE)) {
    candidates <- candidates[same_group, , drop = FALSE]
  }

  candidates$trigger_code <- vapply(
    candidates$relevant,
    .codif_extract_trigger_code,
    FUN.VALUE = character(1),
    parent_clean = parent_clean
  )
  candidates <- candidates[!is.na(candidates$trigger_code) & nzchar(candidates$trigger_code), , drop = FALSE]
  if (!nrow(candidates)) {
    return(list(text_name = NA_character_, trigger_code = NA_character_, source = NA_character_))
  }

  valid_codes <- choices_lookup[[parent_clean]]
  if (!is.null(valid_codes) && nrow(valid_codes)) {
    candidates <- candidates[candidates$trigger_code %in% as.character(valid_codes$code), , drop = FALSE]
  }
  if (!nrow(candidates)) {
    return(list(text_name = NA_character_, trigger_code = NA_character_, source = NA_character_))
  }

  best <- candidates %>% dplyr::slice(1)
  list(
    text_name = as.character(best$name[[1]]),
    trigger_code = as.character(best$trigger_code[[1]]),
    source = "semantic"
  )
}

.codif_collapse_candidates <- function(...){
  vals <- unique(unlist(list(...), use.names = FALSE))
  vals <- vals[!is.na(vals) & nzchar(trimws(vals))]
  if (!length(vals)) NA_character_ else paste(vals, collapse = "; ")
}

.codif_resolve_family_links <- function(parent_name,
                                        tipo_sugerido,
                                        inst,
                                        name_map,
                                        cols_exist,
                                        survey_ctx = NULL,
                                        choices_lookup = NULL){
  parent_col <- resolve_parent_col_original(parent_name, name_map)
  survey_ctx <- survey_ctx %||% .codif_build_survey_context(inst)
  choices_lookup <- choices_lookup %||% .codif_choices_lookup(inst, survey_ctx)

  semantic <- .codif_find_semantic_text_link(parent_name, inst, survey_ctx, choices_lookup)
  text_semantic <- if (nzchr(semantic$text_name)) {
    resolve_parent_col_original(semantic$text_name, name_map)
  } else {
    NA_character_
  }
  text_fallback <- if (nzchr(parent_col)) find_text_other_for_parent(parent_col, name_map) else NA_character_
  text_col <- dplyr::coalesce(text_semantic, text_fallback)

  other_candidate <- NA_character_
  other_dummy_col <- NA_character_
  if (tolower(tipo_sugerido %||% "") == "select_multiple") {
    if (nzchr(parent_col) && nzchr(semantic$trigger_code)) {
      other_candidate <- paste0(parent_col, "/", semantic$trigger_code)
      if (other_candidate %in% cols_exist) other_dummy_col <- other_candidate
    }
    if (!nzchr(other_dummy_col) && nzchr(parent_col)) {
      other_dummy_col <- find_other_dummy_for_parent(parent_col, name_map)
    }
  }

  list(
    parent_col = parent_col,
    text_col = text_col %||% NA_character_,
    other_dummy_col = other_dummy_col %||% NA_character_,
    text_col_cands = .codif_collapse_candidates(text_semantic, text_fallback),
    other_dummy_cands = .codif_collapse_candidates(other_candidate, other_dummy_col),
    dummy_cands = if (nzchr(parent_col)) {
      .codif_collapse_candidates(find_dummy_cols_for_parent(parent_col, name_map))
    } else {
      NA_character_
    }
  )
}

.codif_build_family_tpl <- function(cand,
                                    inst,
                                    name_map,
                                    cols_exist,
                                    survey_ctx = NULL,
                                    choices_lookup = NULL,
                                    section = NULL,
                                    hoja_datos = NULL){
  if (!nrow(cand)) return(cand[0, , drop = FALSE])

  survey_ctx <- survey_ctx %||% .codif_build_survey_context(inst)
  choices_lookup <- choices_lookup %||% .codif_choices_lookup(inst, survey_ctx)

  resolved <- lapply(seq_len(nrow(cand)), function(i){
    .codif_resolve_family_links(
      parent_name = cand$parent[i],
      tipo_sugerido = cand$tipo_sugerido[i],
      inst = inst,
      name_map = name_map,
      cols_exist = cols_exist,
      survey_ctx = survey_ctx,
      choices_lookup = choices_lookup
    )
  })

  parent_col_sug <- vapply(resolved, `[[`, FUN.VALUE = character(1), "parent_col")
  text_col_sug <- vapply(resolved, `[[`, FUN.VALUE = character(1), "text_col")
  otherdum_sug <- vapply(resolved, `[[`, FUN.VALUE = character(1), "other_dummy_col")
  text_col_cands <- vapply(resolved, `[[`, FUN.VALUE = character(1), "text_col_cands")
  other_dummy_cands <- vapply(resolved, `[[`, FUN.VALUE = character(1), "other_dummy_cands")
  dummy_cands <- vapply(resolved, `[[`, FUN.VALUE = character(1), "dummy_cands")

  tpl <- cand %>%
    dplyr::mutate(
      use               = TRUE,
      tipo              = .data$tipo_sugerido,
      parent_col        = parent_col_sug,
      other_dummy_col   = otherdum_sug,
      text_col          = text_col_sug,
      parent_col_cands  = parent_col_sug,
      other_dummy_cands = other_dummy_cands,
      text_col_cands    = text_col_cands,
      dummy_cands       = dummy_cands
    )

  if (!is.null(section)) tpl$section <- section
  if (!is.null(hoja_datos)) tpl$hoja_datos <- hoja_datos
  tpl
}

.codif_apply_type_fill <- function(wb, sheet, tpl, idx_special, type_styles){
  idx_all <- seq_len(ncol(tpl))
  idx_body_fill <- setdiff(idx_all, idx_special)
  if (!nrow(tpl) || !length(idx_body_fill) || !"tipo" %in% names(tpl)) return(invisible(NULL))

  row_groups <- split(seq_len(nrow(tpl)) + 1L, tolower(as.character(tpl$tipo)))
  for (nm in names(row_groups)) {
    style <- type_styles[[nm]]
    if (is.null(style)) style <- type_styles[["default"]]
    openxlsx::addStyle(
      wb, sheet, style,
      rows = row_groups[[nm]], cols = idx_body_fill,
      gridExpand = TRUE, stack = TRUE
    )
  }
  invisible(NULL)
}

.codif_norm01 <- function(v){
  vv <- suppressWarnings(as.integer(as.character(v)))
  if (!all(is.na(vv))) return(vv)
  ifelse(
    tolower(as.character(v)) %in% c("true", "t", "1"), 1L,
    ifelse(tolower(as.character(v)) %in% c("false", "f", "0"), 0L, NA_integer_)
  )
}

.codif_interleave_recod_cols <- function(base){
  cn <- names(base)
  base_cols <- cn[!grepl("_recod$", cn)]
  rec_cols  <- cn[grepl("_recod$", cn)]
  order_cols <- c()
  for (b in base_cols) {
    order_cols <- c(order_cols, b)
    r <- paste0(b, "_recod")
    if (r %in% rec_cols) order_cols <- c(order_cols, r)
  }
  orphan_rec <- setdiff(rec_cols, paste0(base_cols, "_recod"))
  base[, unique(c(order_cols, orphan_rec)), drop = FALSE]
}

.codif_append_reference_tag <- function(x){
  x <- as.character(x)
  needs_tag <- !is.na(x) & nzchar(trimws(x)) & !grepl("\\(referencia\\)$", trimws(x), ignore.case = TRUE)
  x[needs_tag] <- paste0(trimws(x[needs_tag]), " (referencia)")
  x
}

.codif_refine_label_row <- function(hdr_base, hdr_lab, tipo_hoja, sheet_name = NULL){
  hdr_base <- as.character(hdr_base)
  out <- as.character(hdr_lab %||% hdr_base)
  tipo_norm <- tolower(as.character(tipo_hoja %||% "text"))

  id_cols <- c("_uuid", "_index", "Código pulso", "Codigo pulso", "pulso_code")
  base_non_recod <- hdr_base[!grepl("_recod$", hdr_base)]
  base_value_cols <- setdiff(base_non_recod, c(id_cols, "Control"))
  base_unpaired <- base_value_cols[!(paste0(base_value_cols, "_recod") %in% hdr_base)]

  out[hdr_base == "Control"] <- "Control / notas"

  if (identical(tipo_norm, "select_one")) {
    if ("Selección (label)" %in% hdr_base) {
      idx_sel_label <- hdr_base == "Selección (label)"
      out[idx_sel_label] <- .codif_append_reference_tag(out[idx_sel_label])
    }
    if ("Recodificación (código)" %in% hdr_base) {
      out[hdr_base == "Recodificación (código)"] <- "Recodificación (código)"
    }
    if ("Etiqueta nueva categoría" %in% hdr_base) {
      out[hdr_base == "Etiqueta nueva categoría"] <- "Etiqueta del código nuevo"
    }
    text_ref_cols <- setdiff(
      base_value_cols,
      c("Selección (código)", "Selección (label)", "Recodificación (código)", "Etiqueta nueva categoría")
    )
    if (length(text_ref_cols)) {
      idx_text_ref <- hdr_base %in% text_ref_cols
      out[idx_text_ref] <- .codif_append_reference_tag(out[idx_text_ref])
    }
    idx_text_recod <- grepl("_recod$", hdr_base)
    if ("Recodificación (código)" %in% hdr_base) idx_text_recod <- idx_text_recod & hdr_base != "Recodificación (código)"
    if ("Etiqueta nueva categoría" %in% hdr_base) idx_text_recod <- idx_text_recod & hdr_base != "Etiqueta nueva categoría"
    out[idx_text_recod] <- "Recodificación del texto"
  } else if (identical(tipo_norm, "select_multiple")) {
    text_ref_cols <- setdiff(base_unpaired, c("Seleccionadas", "Seleccionadas_cod"))
    if (length(text_ref_cols)) {
      idx_text_ref <- hdr_base %in% text_ref_cols
      out[idx_text_ref] <- .codif_append_reference_tag(out[idx_text_ref])
    }
    out[grepl("_recod$", hdr_base)] <- "Recodificación de esta opción"
  } else if (tipo_norm %in% c("integer", "text")) {
    ref_cols <- base_value_cols
    if (length(ref_cols)) {
      idx_ref <- hdr_base %in% ref_cols
      out[idx_ref] <- .codif_append_reference_tag(out[idx_ref])
    }
    out[grepl("_recod$", hdr_base)] <- "Recodificación"
  }

  out
}

.codif_sheet_column_roles <- function(hdr_base){
  hdr_base <- as.character(hdr_base)
  roles <- rep("reference", length(hdr_base))
  roles[hdr_base %in% c("_uuid", "_index", "Código pulso", "Codigo pulso", "pulso_code")] <- "id"
  roles[grepl("_recod$", hdr_base)] <- "editable"
  roles[hdr_base %in% c("Recodificación (código)", "Etiqueta nueva categoría")] <- "editable"
  roles[hdr_base == "Control"] <- "control"
  roles
}

.codif_edit_comment_text <- function(tipo_hoja,
                                     hdr_base,
                                     sheet_name = NULL,
                                     mode_so = NULL,
                                     aux_block = NULL){
  tipo_norm <- tolower(as.character(tipo_hoja %||% "text"))
  mode_so <- tolower(trimws(as.character(mode_so %||% "")))
  aux_target <- aux_block$target_col %||% "<target>_recod"
  if (identical(hdr_base, "Control")) {
    if (identical(tipo_norm, "select_multiple")) {
      parent_hint <- sheet_name %||% "<parent>"
      return(paste0(
        "Opcional: observación o validación. ",
        "Para agregar una opción nueva en select_multiple, inserte una columna antes de Control. ",
        "En la fila 1 use ", parent_hint, "/<nuevo_codigo>_recod; en la fila 2 escriba la etiqueta visible; ",
        "y en las filas de datos use 1 para marcar, 0 para desmarcar o deje vacío si no aplica. ",
        "A la derecha encontrará una columna reservada de ejemplo que no se adapta."
      ))
    }
    if (identical(tipo_norm, "select_one")) {
      return(paste0(
        "Opcional: observación o validación. ",
        "Si crea un código nuevo, declárelo una sola vez en el bloque auxiliar de nuevas categorías para ",
        aux_target, ". ",
        "Si un mismo código nuevo tiene más de una etiqueta o no tiene ninguna, el adaptador devolverá un error claro."
      ))
    }
    if (identical(tipo_norm, "integer")) {
      return(paste0(
        "Opcional: observación o validación. ",
        "Si crea un código nuevo, declárelo una sola vez en el bloque auxiliar de nuevas categorías para ",
        aux_target, "."
      ))
    }
    return("Opcional: observación o validación.")
  }
  if (identical(tipo_norm, "select_multiple")) {
    parent_hint <- sheet_name %||% "<parent>"
    return(paste0(
      "Editar aquí. Use 1 para marcar, 0 para desmarcar y deje vacío si no desea cambiar. ",
      "Si necesita una opción nueva, agregue una columna con fila 1 = ",
      parent_hint, "/<nuevo_codigo>_recod y fila 2 = etiqueta visible. ",
      "La posición no importa para el adaptador; la columna ", parent_hint, "/ejemplo_recod es solo referencia y no se adapta."
    ))
  }
  if (identical(tipo_norm, "select_one") && grepl("_recod$", hdr_base)) {
    if (identical(mode_so, "padre")) {
      return(paste0(
        "Editar aquí el código final de la variable. ",
        "Si usa un código nuevo, declárelo una sola vez en el bloque auxiliar de nuevas categorías."
      ))
    }
    return(paste0(
      "Editar aquí el código final del texto abierto. ",
      "Si usa un código nuevo, declárelo una sola vez en el bloque auxiliar de nuevas categorías."
    ))
  }
  if (identical(tipo_norm, "integer") && grepl("_recod$", hdr_base)) {
    return(paste0(
      "Editar aquí el código final. ",
      "Si usa un código nuevo, declárelo una sola vez en el bloque auxiliar de nuevas categorías."
    ))
  }
  "Editar aquí. Si no desea cambiar el valor, deje la celda vacía."
}

.codif_make_aux_block <- function(tipo,
                                  target_col,
                                  mode_so = NULL,
                                  sheet_name = NULL){
  tipo <- tolower(as.character(tipo %||% ""))
  mode_so <- tolower(trimws(as.character(mode_so %||% "")))

  title <- if (identical(tipo, "select_one") && identical(mode_so, "padre")) {
    paste0("Modo padre: nuevas categorias para ", sheet_name %||% target_col)
  } else if (identical(tipo, "select_one") && identical(mode_so, "hijo")) {
    paste0("Modo hijo: nuevas categorias para ", target_col)
  } else if (identical(tipo, "integer")) {
    paste0("Nuevas categorias para ", target_col)
  } else {
    "Nuevas categorias"
  }

  code_comment <- if (identical(tipo, "select_one") && identical(mode_so, "padre")) {
    paste0(
      "Declare aqui cada codigo nuevo de ", target_col,
      " una sola vez. Este bloque define las categorias nuevas de la variable principal."
    )
  } else if (identical(tipo, "select_one") && identical(mode_so, "hijo")) {
    paste0(
      "Declare aqui cada codigo nuevo de ", target_col,
      " una sola vez. Este bloque define las categorias del texto abierto recodificado."
    )
  } else if (identical(tipo, "integer")) {
    paste0(
      "Declare aqui cada codigo nuevo de ", target_col,
      " una sola vez. Si otra variable integer usa exactamente el mismo diccionario, el instrumento recodificado compartira la misma lista."
    )
  } else {
    "Declare aqui cada codigo nuevo una sola vez."
  }

  label_comment <- paste0(
    "Escriba la etiqueta visible del codigo nuevo. ",
    "No repita etiquetas con el mismo codigo y no deje codigos nuevos sin etiqueta."
  )

  list(
    raw = c("nuevo_codigo", "nueva_etiqueta"),
    label = c("Nuevo código", "Nueva etiqueta"),
    title = title,
    target_col = target_col,
    comments = c(code_comment, label_comment)
  )
}

.codif_make_sm_example_block <- function(parent_col){
  parent_col <- as.character(parent_col %||% "<parent>")
  list(
    raw = paste0(parent_col, "/ejemplo_recod"),
    label = "Ejemplo: etiqueta visible",
    values = c("1", "0", NA_character_),
    comment = paste0(
      "Columna de ejemplo. La fila 1 muestra el nombre técnico y la fila 2 la etiqueta visible. ",
      "Use 1 para marcar, 0 para desmarcar y deje vacío si no desea cambiar. ",
      "Esta columna reservada no se adapta; duplíquela o úsela como referencia para crear una opción real. ",
      "La posición de la nueva columna no es obligatoria: el adaptador la reconoce por el patrón <parent>/<codigo>_recod."
    )
  )
}

.codif_build_select_one_sheet <- function(dat_raw,
                                          id_base,
                                          row,
                                          opts,
                                          inst,
                                          label_pref = NULL,
                                          label_map = NULL){
  parent_col <- as.character(row$parent_col %||% "")
  text_col <- as.character(row$text_col %||% "")
  mode_so <- tolower(trimws(as.character(row$modo_so %||% "")))
  if (!nzchar(parent_col) || !(parent_col %in% names(dat_raw))) return(NULL)
  if (!(mode_so %in% c("padre", "hijo"))) {
    stop(
      "La familia select_one '", parent_col,
      "' debe definir modo_so como 'padre' o 'hijo'.",
      call. = FALSE
    )
  }

  parent_code <- as.character(dat_raw[[parent_col]] %||% NA_character_)
  parent_label_col <- paste0(parent_col, "_label")
  parent_label <- if (nrow(opts)) as.character(opts$label[match(parent_code, as.character(opts$code))]) else parent_code
  text_vec <- if (nzchar(text_col) && text_col %in% names(dat_raw)) as.character(dat_raw[[text_col]]) else NULL
  target_col <- if (identical(mode_so, "padre")) paste0(parent_col, "_recod") else paste0(text_col, "_recod")

  base <- id_base %>%
    dplyr::mutate(
      !!parent_col := parent_code,
      !!parent_label_col := parent_label
    )

  if (identical(mode_so, "padre")) {
    base[[target_col]] <- NA_character_
    if (!is.null(text_vec)) {
      base[[text_col]] <- text_vec
    }
  } else {
    if (!is.null(text_vec)) {
      base[[text_col]] <- text_vec
    }
    base[[target_col]] <- NA_character_
  }
  base[["Control"]] <- NA_character_

  hdr_raw <- names(base)
  hdr_lab <- hdr_raw
  main_label <- label_pref %||% .codif_label_get(parent_col, label_map)
  hdr_lab[hdr_raw == "_uuid"] <- "UUID"
  hdr_lab[hdr_raw == "_index"] <- "Índice"
  hdr_lab[hdr_raw == "Código pulso"] <- "Código pulso"
  hdr_lab[hdr_raw == parent_col] <- "Selección original (código)"
  hdr_lab[hdr_raw == parent_label_col] <- paste0(main_label, " (referencia)")
  if (!is.null(text_vec) && nzchar(text_col) && text_col %in% names(base)) {
    hdr_lab[hdr_raw == text_col] <- paste0(.codif_label_get(text_col, label_map), " (referencia)")
  }
  if (identical(mode_so, "padre")) {
    hdr_lab[hdr_raw == target_col] <- "Código final de la variable"
  } else {
    hdr_lab[hdr_raw == target_col] <- "Código final del texto abierto"
  }
  hdr_lab[hdr_raw == "Control"] <- "Control / notas"

  structure(
    base,
    header_raw = hdr_raw,
    label_row = hdr_lab,
    tipo = "select_one",
    modo_so = mode_so,
    layout_version = "recod_v2",
    aux_block = .codif_make_aux_block(
      tipo = "select_one",
      target_col = target_col,
      mode_so = mode_so,
      sheet_name = parent_col
    )
  )
}

.codif_build_integer_sheet <- function(dat_raw,
                                       id_base,
                                       row,
                                       inst,
                                       label_map = NULL){
  var_col <- if (!is.null(row$parent_col) && nzchar(row$parent_col)) as.character(row$parent_col) else as.character(row$parent)
  if (!nzchar(var_col) || !(var_col %in% names(dat_raw))) return(NULL)

  target_col <- paste0(var_col, "_recod")
  base <- id_base %>%
    dplyr::mutate(!!var_col := dat_raw[[var_col]])
  base[[target_col]] <- NA_character_
  base[["Control"]] <- NA_character_

  hdr_raw <- names(base)
  hdr_lab <- hdr_raw
  hdr_lab[hdr_raw == "_uuid"] <- "UUID"
  hdr_lab[hdr_raw == "_index"] <- "Índice"
  hdr_lab[hdr_raw == "Código pulso"] <- "Código pulso"
  hdr_lab[hdr_raw == var_col] <- paste0(.codif_label_get(var_col, label_map), " (referencia)")
  hdr_lab[hdr_raw == target_col] <- "Código final"
  hdr_lab[hdr_raw == "Control"] <- "Control / notas"

  structure(
    base,
    header_raw = hdr_raw,
    label_row = hdr_lab,
    tipo = "integer",
    layout_version = "recod_v2",
    aux_block = .codif_make_aux_block(
      tipo = "integer",
      target_col = target_col,
      sheet_name = var_col
    )
  )
}

.codif_validate_modo_so <- function(fam, path = NULL, repeat_aware = FALSE){
  if (is.null(fam) || !nrow(fam) || !"tipo" %in% names(fam)) return(invisible(NULL))
  if (!"modo_so" %in% names(fam)) fam$modo_so <- ""
  if (!"text_col" %in% names(fam)) fam$text_col <- ""

  tipo <- tolower(trimws(as.character(fam$tipo)))
  modo <- tolower(trimws(as.character(fam$modo_so)))
  text_col <- trimws(as.character(fam$text_col))
  use <- if ("use" %in% names(fam)) as.logical(fam$use) else rep(TRUE, nrow(fam))
  invalid <- which(use & tipo == "select_one" & nzchar(text_col) & !(modo %in% c("padre", "hijo")))
  if (!length(invalid)) return(invisible(NULL))

  var_col <- dplyr::coalesce(fam$parent_col %||% rep("", nrow(fam)), fam$parent %||% rep("", nrow(fam)))
  where_col <- if (repeat_aware && "hoja_datos" %in% names(fam)) {
    paste0(" (hoja_datos=", fam$hoja_datos, ")")
  } else {
    rep("", nrow(fam))
  }
  ejemplos <- paste0(var_col[invalid], where_col[invalid])
  ejemplos <- ejemplos[nzchar(trimws(ejemplos))]
  ejemplos <- utils::head(ejemplos, 5)

  msg <- c(
    "Las familias select_one deben definir 'modo_so' como 'padre' o 'hijo'.",
    if (!is.null(path)) paste0("Archivo: ", path),
    if (length(ejemplos)) paste0("Revisa: ", paste(ejemplos, collapse = ", "))
  )
  stop(paste(msg[nzchar(msg)], collapse = " "), call. = FALSE)
}

.codif_expand_sm_dummies <- function(dat_raw, parent_col, opts){
  n <- nrow(dat_raw)
  if (is.null(n)) n <- 0L
  if (!nrow(opts)) {
    out <- matrix(NA_integer_, nrow = n, ncol = 0)
    return(tibble::as_tibble(out))
  }

  out <- matrix(NA_integer_, nrow = n, ncol = nrow(opts))
  colnames(out) <- as.character(opts$code)
  for (j in seq_len(nrow(opts))) {
    slash <- paste0(parent_col, "/", opts$code[j])
    if (slash %in% names(dat_raw)) {
      out[, j] <- .codif_norm01(dat_raw[[slash]])
    }
  }
  miss <- which(apply(out, 2, function(z) all(is.na(z))))
  if (length(miss) && parent_col %in% names(dat_raw)) {
    toks <- strsplit(ifelse(is.na(dat_raw[[parent_col]]), "", as.character(dat_raw[[parent_col]])), "\\s+")
    for (j in miss) {
      code <- as.character(opts$code[j])
      out[, j] <- vapply(toks, function(tt) as.integer(code %in% tt), integer(1))
    }
  }
  tibble::as_tibble(out)
}

.codif_build_select_multiple_sheet <- function(dat_raw,
                                               id_base,
                                               row,
                                               opts,
                                               inst,
                                               label_pref = NULL,
                                               label_map = NULL){
  parent_col <- as.character(row$parent_col %||% "")
  other_dummy_col <- as.character(row$other_dummy_col %||% "")
  text_col <- as.character(row$text_col %||% "")
  if (!nzchar(parent_col) || !(parent_col %in% names(dat_raw))) return(NULL)

  opts <- opts %>%
    dplyr::mutate(
      code = as.character(.data$code),
      label = as.character(dplyr::coalesce(.data$label, .data$code))
    )

  dmm <- .codif_expand_sm_dummies(dat_raw, parent_col, opts)
  if (nrow(opts) && ncol(dmm)) {
    names(dmm) <- opts$label
  }

  other_label <- NA_character_
  if (nzchar(other_dummy_col) && nrow(opts)) {
    other_code <- sub("^.+/", "", other_dummy_col)
    other_label <- opts$label[match(other_code, opts$code)]
    if (is.na(other_label) || !nzchar(other_label)) other_label <- other_dummy_col
    if (other_dummy_col %in% names(dat_raw)) {
      dmm[[other_label]] <- .codif_norm01(dat_raw[[other_dummy_col]])
    } else if (!other_label %in% names(dmm)) {
      dmm[[other_label]] <- rep(NA_integer_, nrow(dat_raw))
    }

    ord_labels <- unique(c(setdiff(opts$label, other_label), other_label))
    ord_labels <- ord_labels[ord_labels %in% names(dmm)]
    if (length(ord_labels)) dmm <- dmm[, ord_labels, drop = FALSE]
  }

  nm <- names(dmm)
  nm <- nm[!is.na(nm) & nzchar(nm)]
  selected_cols <- nm

  lab2code <- opts$code
  names(lab2code) <- opts$label

  sel_labels <- if (length(selected_cols) && nrow(opts)) {
    apply(dmm[, selected_cols, drop = FALSE], 1, function(r){
      idx <- which(r == 1L)
      if (!length(idx)) "" else paste(names(r)[idx], collapse = "; ")
    })
  } else {
    rep("", nrow(dat_raw))
  }

  sel_codes <- if (length(selected_cols) && nrow(opts)) {
    apply(dmm[, selected_cols, drop = FALSE], 1, function(r){
      idx <- which(r == 1L)
      if (!length(idx)) return("")
      labs <- names(r)[idx]
      codes <- lab2code[labs]
      codes[is.na(codes) | !nzchar(codes)] <- labs[is.na(codes) | !nzchar(codes)]
      paste(codes, collapse = "; ")
    })
  } else {
    rep("", nrow(dat_raw))
  }

  base <- id_base %>%
    dplyr::mutate(
      Seleccionadas = sel_labels,
      Seleccionadas_cod = sel_codes
    ) %>%
    dplyr::bind_cols(dmm)

  if (nzchar(text_col) && text_col %in% names(dat_raw)) {
    base[[text_col]] <- as.character(dat_raw[[text_col]])
  }

  skip_cols <- c("_uuid", "_index", "Código pulso", "Seleccionadas", "Seleccionadas_cod")
  if (nzchar(text_col) && text_col %in% names(base)) skip_cols <- c(skip_cols, text_col)
  for (dc in setdiff(names(base), unique(skip_cols))) {
    base[[paste0(dc, "_recod")]] <- NA_character_
  }
  base[["Control"]] <- NA_character_
  base <- .codif_interleave_recod_cols(base)

  hdr_raw <- names(base)
  hdr_lab <- hdr_raw
  hdr_lab[hdr_raw == "_uuid"] <- "UUID"
  hdr_lab[hdr_raw == "_index"] <- "Índice"
  hdr_lab[hdr_raw == "Código pulso"] <- "Código pulso"
  hdr_lab[hdr_raw == "Seleccionadas"] <- label_pref %||% .codif_label_get(parent_col, label_map)
  hdr_lab[hdr_raw == "Seleccionadas_cod"] <- "Seleccionadas (código)"
  if (nzchar(text_col) && text_col %in% names(base)) {
    hdr_lab[hdr_raw == text_col] <- .codif_label_get(text_col, label_map)
  }
  hdr_lab[grepl("_recod$", hdr_raw)] <- "Recodificación"
  hdr_lab[hdr_raw == "Control"] <- "Control / notas"
  hdr_lab <- .codif_refine_label_row(hdr_raw, hdr_lab, "select_multiple")

  structure(
    base,
    header_raw = hdr_raw,
    label_row = hdr_lab,
    tipo = "select_multiple",
    example_block = .codif_make_sm_example_block(parent_col)
  )
}

.codif_add_classification_diagnostics <- function(fam, acc_sm, acc_so, acc_tx, acc_int = NULL, repeat_aware = FALSE){
  if (!nrow(fam)) return(tibble::tibble())
  if (is.null(acc_int)) acc_int <- rep(FALSE, nrow(fam))

  hoja_col <- if (repeat_aware && "hoja_datos" %in% names(fam)) fam$hoja_datos else rep("main", nrow(fam))
  other_cands <- if ("other_dummy_cands" %in% names(fam)) trimws(as.character(fam$other_dummy_cands)) else rep("", nrow(fam))
  parent_out <- if ("parent" %in% names(fam)) as.character(fam$parent) else rep(NA_character_, nrow(fam))
  parent_out[is.na(parent_out) | !nzchar(parent_out)] <- as.character(fam$parent_col[is.na(parent_out) | !nzchar(parent_out)])
  estado <- ifelse(acc_sm | acc_so | acc_tx | acc_int, "aceptada", "excluida")
  motivo <- dplyr::case_when(
    !fam$use ~ "Fila marcada con use = FALSE",
    fam$tipo == "select_multiple" & !fam$exists_parent_col ~ "parent_col no existe en la hoja de datos",
    fam$tipo == "select_multiple" & !fam$exists_text_col ~ "text_col no existe en la hoja de datos",
    fam$tipo == "select_multiple" & !fam$exists_dummy_col & nzchar(other_cands) ~ "Hay texto asociado, pero other_dummy_col no existe en la hoja de datos",
    fam$tipo == "select_multiple" & !fam$exists_dummy_col ~ "other_dummy_col no existe en la hoja de datos",
    fam$tipo == "select_one" & !fam$exists_parent_col ~ "parent_col no existe en la hoja de datos",
    fam$tipo == "select_one" & !fam$exists_text_col ~ "text_col no existe en la hoja de datos",
    fam$tipo == "integer" & !fam$exists_parent_col ~ "parent_col no existe en la hoja de datos",
    fam$tipo == "integer" & acc_int ~ "Integer aceptado",
    fam$tipo == "text" & acc_tx ~ "Texto huérfano aceptado",
    TRUE ~ "Fila aceptada"
  )

  tibble::tibble(
    tipo = fam$tipo,
    parent = parent_out,
    parent_col = fam$parent_col,
    hoja_datos = hoja_col,
    estado_clasificacion = estado,
    motivo_clasificacion = motivo
  )
}

#' Obtener catálogo de opciones (choices) para un parent dado
#'
#' Cruza \code{survey$name} → \code{list_norm} → \code{choices} y devuelve
#' \code{code/label} para esa lista si aplica.
#'
#' @param parent_name Nombre de pregunta (p. ej., \code{survey$name} o \code{parent}).
#' @param inst Objeto instrumento (lista) con \code{$survey} y \code{$choices} cargados por el lector minimalista.
#'
#' @return Tibble con columnas \code{code} y \code{label} (o \code{NULL} si no aplica).
#' @family codificacion
#' @export
choices_for_parent <- function(parent_name, inst){
  if (!nzchr(parent_name)) return(NULL)
  pv_clean <- janitor::make_clean_names(parent_name)
  row <- inst$survey %>%
    dplyr::filter(.data$name == pv_clean) %>%
    dplyr::slice(1)
  if (!nrow(row)) return(NULL)

  ln <- row$list_norm %||% row$list_name %||% NA_character_
  if (is.na(ln) || !nzchar(ln)) return(NULL)

  opts <- inst$choices %>%
    dplyr::filter(.data$list_norm == ln) %>%
    dplyr::transmute(code = .data$name, label = .data$label_spanish_es %||% .data$label)
  if (!nrow(opts)) NULL else opts
}

#' Label en español desde `survey` (nombre ORIGINAL o limpio)
#'
#' Dado un nombre ORIGINAL de columna (o un \code{parent}), obtiene su label ES
#' desde \code{inst$survey} sin mezclar idiomas. Orden de preferencia:
#' \code{label_spanish_es} > \code{label_es} > \code{label} > nombre limpio.
#'
#' @param var_orig Character (escalar o vector) con nombres ORIGINALES/parent.
#' @param survey Data frame de la hoja `survey` del lector minimalista.
#'
#' @return Character vector con el label en español (o el nombre limpio si no hay label).
#' @family codificacion
#' @export
label_es_from_survey <- function(var_orig, survey){
  if (is.null(var_orig)) return(NA_character_)
  labcol <- {
    nms <- tolower(names(survey))
    if ("label_spanish_es" %in% nms) "label_spanish_es"
    else if ("label_es" %in% nms) "label_es"
    else if ("label" %in% nms) "label"
    else NA_character_
  }
  vapply(as.list(var_orig), function(v){
    if (is.null(v)) return(NA_character_)
    v <- as.character(v)[1]
    if (is.na(v) || !nzchar(v)) return(NA_character_)
    nm <- janitor::make_clean_names(v)
    i  <- match(nm, survey$name)
    if (is.na(i) || is.na(labcol)) return(nm)
    val <- as.character(survey[[labcol]][i])
    if (length(val) == 1 && !is.na(val) && nzchar(trimws(val))) val else nm
  }, FUN.VALUE = character(1))
}

.codif_label_map <- function(inst){
  out <- character(0)
  add_source <- function(df){
    if (is.null(df) || !"name" %in% names(df)) return(invisible(NULL))
    col_es <- detect_spanish_col(names(df))
    if (is.na(col_es) || !(col_es %in% names(df))) return(invisible(NULL))
    keys <- janitor::make_clean_names(df$name)
    vals <- as.character(df[[col_es]])
    vals[is.na(vals) | !nzchar(trimws(vals))] <- NA_character_
    keep <- !is.na(vals) & nzchar(vals)
    if (any(keep)) out[keys[keep]] <<- vals[keep]
    invisible(NULL)
  }
  add_source(inst$survey)
  add_source(inst$survey_raw)
  out
}

.codif_label_get <- function(var, label_map = NULL){
  key <- janitor::make_clean_names(var)
  out <- if (is.null(label_map) || !length(label_map)) rep(NA_character_, length(key)) else unname(label_map[key])
  out[is.na(out) | !nzchar(out)] <- key[is.na(out) | !nzchar(out)]
  out
}

# ---- utilidades locales usadas arriba ---------------------------------------
`%||%` <- function(x, y) if (is.null(x) || (length(x) == 1 && is.na(x))) y else x
nzchr   <- function(x) is.character(x) && length(x) == 1 && !is.na(x) && nzchar(x)


# --- Utilidades para la contruccion de la plantilla-------------------------


# Label ES para survey, buscando primero en survey_raw (sin normalizar)
label_es_from_inst <- function(var, inst){
  if (is.null(var)) return(NA_character_)
  v <- as.character(var)
  nm_clean <- janitor::make_clean_names(v)

  # 1) survey_raw (mejor fuente)
  sr <- inst$survey_raw
  if (!is.null(sr) && "name" %in% names(sr)) {
    sr_clean_names <- janitor::make_clean_names(sr$name)
    i <- match(nm_clean, sr_clean_names)
    escol <- detect_spanish_col(names(sr))
    if (!is.na(escol)) {
      out <- sr[[escol]][i]
      out <- ifelse(is.na(out) | !nzchar(trimws(out)), nm_clean, out)
      return(out)
    }
  }

  # 2) fallback a survey (si trae alias ya)
  s <- inst$survey
  if (!is.null(s) && "name" %in% names(s)) {
    i <- match(nm_clean, s$name)
    escol <- detect_spanish_col(names(s))
    if (!is.na(escol)) {
      out <- s[[escol]][i]
    } else if ("label_es" %in% names(s)) {
      out <- s$label_es[i]
    } else if ("label" %in% names(s)) {
      out <- s$label[i]
    } else {
      out <- nm_clean
    }
    out <- ifelse(is.na(out) | !nzchar(trimws(out)), nm_clean, out)
    return(out)
  }

  nm_clean
}




#' Lector de datos con secciones repeat (main + hojas hijas)
#'
#' Lee de un mismo archivo Excel la hoja principal del estudio y,
#' opcionalmente, una o más hojas hijas correspondientes a secciones *repeat*.
#' Devuelve una lista con elementos nombrados (`main`, `s1`, `rpt_hhmnames`, etc.),
#' donde cada elemento contiene las tres estructuras estándar generadas por
#' \code{leer_datos()}:
#' \itemize{
#'   \item \code{raw}: datos crudos leídos directamente de Excel.
#'   \item \code{clean}: versión limpiada (nombres normalizados).
#'   \item \code{name_map}: correspondencia entre nombres originales y limpios.
#' }
#'
#' La función está diseñada para usarse antes de procesos de codificación o
#' construcción de plantillas, de modo que la lista resultante (\code{tabs})
#' pueda ser pasada directamente a funciones como
#' \code{escribir_plantilla_familias()} o \code{leer_familias_clasificar()}.
#'
#' @param path Ruta al archivo Excel de datos.
#' @param main_sheet Nombre de la hoja principal (por ejemplo, "RMS 2025 Perú - Q4").
#' @param repeat_sheets Vector opcional con los nombres exactos de las hojas hijas
#'   (por ejemplo, \code{c("S1", "rpt_hhmnames", "CHILDEDUPE")}).
#'
#' @details
#' Si alguna de las hojas especificadas no se encuentra en el archivo, la función
#' devuelve un mensaje de advertencia y omite esa hoja, sin interrumpir la ejecución.
#'
#' Los nombres de los elementos en la lista final se normalizan usando
#' \code{janitor::make_clean_names()} (en minúsculas y sin espacios).
#'
#' @return
#' Una lista con una entrada por hoja leída. Cada entrada contiene:
#' \itemize{
#'   \item \code{raw}: datos originales.
#'   \item \code{clean}: datos con nombres limpios.
#'   \item \code{name_map}: tabla de correspondencia de nombres.
#' }
#'
#' @examples
#' \dontrun{
#' # Ejemplo de uso
#' path_xlsx <- "RMS_datos_filtrado.xlsx"
#'
#' tabs <- lector_codif_repeat(
#'   path = path_xlsx,
#'   main_sheet = "RMS 2025 Perú - Q4",
#'   repeat_sheets = c("rpt_hhmnames", "S1", "CHILDEDUPE")
#' )
#'
#' names(tabs)
#' # [1] "main" "rpt_hhmnames" "s1" "childedupe"
#'
#' lapply(tabs, names)
#' # Cada elemento contiene: raw, clean, name_map
#' }
#'
#' @seealso \code{\link{leer_datos}}, \code{\link{escribir_plantilla_familias}}
#' @family codificacion
#' @export
lector_codif_repeat <- function(path, main_sheet, repeat_sheets = NULL) {
  stopifnot(file.exists(path), nzchar(main_sheet))

  # Helper interno que usa tu lector de datos estándar
  .leer_datos_seguro <- function(path, sheet) {
    if (!requireNamespace("readxl", quietly = TRUE)) stop("Falta paquete 'readxl'.")
    if (!sheet %in% readxl::excel_sheets(path)) {
      warning(sprintf("Hoja '%s' no encontrada en '%s'.", sheet, basename(path)))
      return(NULL)
    }
    leer_datos(path, sheet = sheet)
  }

  # 1) Leer hoja principal
  main_data <- .leer_datos_seguro(path, main_sheet)
  if (is.null(main_data))
    stop("No se pudo leer la hoja principal: ", main_sheet)

  # 2) Leer hojas hijas (si existen)
  out <- list(main = main_data)

  if (!is.null(repeat_sheets) && length(repeat_sheets) > 0) {
    for (sheet_name in repeat_sheets) {
      ent <- .leer_datos_seguro(path, sheet_name)
      if (!is.null(ent)) {
        nm <- janitor::make_clean_names(sheet_name)
        out[[nm]] <- ent
      }
    }
  }

  # 3) Normalizar nombres
  names(out) <- janitor::make_clean_names(names(out))

  message("✔ Se leyeron ", length(out), " hojas: ",
          paste(names(out), collapse = ", "))
  out
}





# ---- 3. Plantilla editable de familias (revisada) --------------------------
#' Escribir plantilla de familias (sin normalizar el instrumento)
#'
#' Genera un Excel \code{familias.xlsx} con sugerencias por cada pregunta
#' \code{select_one}, \code{select_multiple} (y opcionalmente \code{text})
#' detectada en \code{inst$survey}.
#' - NO reescribe/normaliza el instrumento: solo lee \code{type}, \code{name}
#'   y, si existen, \code{q_order}, \code{list_name}, \code{list_norm}.
#' - \strong{parent_label} se obtiene en \emph{español} usando
#'   \code{label_es_from_inst()} que prioriza \code{inst$survey_raw}.
#' - La columna \code{list_norm} se llama exactamente igual que en \code{choices}.
#' - Resalta filas por \code{tipo} en tonos pastel y:
#'     * NO colorea \code{other_dummy_col} ni \code{text_col}, pero les pone
#'       \emph{borde grueso} y \emph{encabezado pastel} para destacarlas.
#'
#' @param inst Objeto devuelto por el lector de XLSForm (con \code{$survey} y \code{$survey_raw}).
#' @param dat  Objeto de \code{leer_datos()} con \code{$raw}, \code{$name_map}.
#' @param path Ruta de salida (.xlsx). Default \code{"familias.xlsx"}.
#' @param incluir_text_vars Incluir preguntas \code{text} como filas (default \code{TRUE}).
#'
#' @return Ruta absoluta al archivo escrito (invisible).
#' @family codificacion
#' @export
escribir_plantilla_familias <- function(inst, dat, path = "familias.xlsx", incluir_text_vars = TRUE){
  stopifnot(is.list(inst), is.list(dat), "survey" %in% names(inst))
  survey <- inst$survey
  if (is.null(survey) || !("name" %in% names(survey))) {
    stop("inst$survey debe existir y tener columna 'name'.")
  }

  # --- auxiliares mínimos, SIN normalizar el instrumento ---
  `%||%` <- function(x, y) if (is.null(x) || (length(x) == 1 && is.na(x))) y else x
  .type_base <- function(x) sub("\\s.*$", "", as.character(x %||% ""))

  # columnas auxiliares locales (no modifican inst en disco)
  tb <- tibble::tibble(
    name       = as.character(survey$name),
    type       = as.character(survey$type %||% NA_character_),
    q_order    = if ("q_order" %in% names(survey)) as.integer(survey$q_order) else seq_len(nrow(survey)),
    type_base  = .type_base(survey$type),
    list_name  = if ("list_name" %in% names(survey)) survey$list_name else trimws(sub("^\\S+\\s+","", as.character(survey$type %||% ""))),
    list_norm  = if ("list_norm" %in% names(survey)) survey$list_norm else .norm_list_name(if ("list_name" %in% names(survey)) survey$list_name else trimws(sub("^\\S+\\s+","", as.character(survey$type %||% ""))))
  )

  # candidatos por tipo
  tipos_objetivo <- c(
    "select_one",
    "select_multiple",
    "integer",
    if (isTRUE(incluir_text_vars)) "text" else character(0)
  )
  cand <- tb %>%
    dplyr::filter(.data$type_base %in% tipos_objetivo) %>%
    dplyr::transmute(
      parent       = .data$name,
      parent_label = label_es_from_inst(.data$name, inst),  # <- ESPAÑOL desde survey_raw
      tipo_sugerido= .data$type_base,
      q_order      = .data$q_order,
      list_norm    = .data$list_norm
    )

  survey_ctx <- .codif_build_survey_context(inst)
  choices_lookup <- .codif_choices_lookup(inst, survey_ctx)

  if (nrow(cand)) {
    tpl <- .codif_build_family_tpl(
      cand = cand,
      inst = inst,
      name_map = dat$name_map,
      cols_exist = names(dat$raw),
      survey_ctx = survey_ctx,
      choices_lookup = choices_lookup
    )
  } else {
    tpl <- tibble::tibble(
      use = logical(),
      q_order = integer(),
      tipo = character(),
      parent = character(),
      parent_label = character(),
      list_norm = character(),
      parent_col = character(),
      other_dummy_col = character(),
      text_col = character(),
      parent_col_cands = character(),
      other_dummy_cands = character(),
      text_col_cands = character(),
      dummy_cands = character()
    )
  }
  tpl$modo_so <- if (nrow(tpl)) ifelse(tpl$tipo == "select_one", "", "") else character(0)
  tpl <- tpl %>%
    # ← q_order inmediatamente después de use (como pediste)
    dplyr::select(use, q_order, tipo, modo_so, parent, parent_label, list_norm,
                  parent_col, other_dummy_col, text_col,
                  parent_col_cands, other_dummy_cands, text_col_cands, dummy_cands)

  # --- Excel con formato -----------------------------------------------------
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "familias")

  # Estilos base
  style_hdr <- openxlsx::createStyle(
    textDecoration = "bold", halign = "center", valign = "center",
    border = "TopBottomLeftRight"
  )
  style_border_all <- openxlsx::createStyle(border = "TopBottomLeftRight", borderColour = "black")

  # Pastel para columnas especiales (sin negrita)
  style_special_hdr <- openxlsx::createStyle(
    fgFill = "#F9D5E5",  # pastel suave
    halign = "center", valign = "center",
    border = "TopBottomLeftRight", borderStyle = "thick"
  )
  style_special_body <- openxlsx::createStyle(
    fgFill = "#F9D5E5",
    border = "TopBottomLeftRight", borderStyle = "thick"
  )

  type_styles <- list(
    select_multiple = openxlsx::createStyle(fgFill = "#E2F0D9"),
    select_one = openxlsx::createStyle(fgFill = "#D9E1F2"),
    integer = openxlsx::createStyle(fgFill = "#E6D9F2"),
    text = openxlsx::createStyle(fgFill = "#FFF2CC"),
    default = openxlsx::createStyle(fgFill = "#EEEEEE")
  )

  # Escribir datos y header general
  openxlsx::writeData(wb, "familias", tpl, startRow = 1, colNames = TRUE)
  openxlsx::addStyle(wb, "familias", style_hdr, rows = 1, cols = 1:ncol(tpl), gridExpand = TRUE)

  # Índices de columnas especiales (solo estas van con color distinto)
  idx_other <- which(colnames(tpl) == "other_dummy_col")
  idx_text  <- which(colnames(tpl) == "text_col")
  idx_special <- c(idx_other, idx_text)

  .codif_apply_type_fill(wb, "familias", tpl, idx_special, type_styles)

  # 2) Aplicar estilo pastel a TODA la columna especial (encabezado + cuerpo)
  if (length(idx_special)){
    # Header (fila 1)
    openxlsx::addStyle(wb, "familias", style_special_hdr,
                       rows = 1, cols = idx_special, gridExpand = TRUE, stack = TRUE)
    # Cuerpo
    if (nrow(tpl)){
      openxlsx::addStyle(wb, "familias", style_special_body,
                         rows = 2:(nrow(tpl)+1), cols = idx_special, gridExpand = TRUE, stack = TRUE)
    }
  }

  # Nada especial para parent_label / list_norm: conservan el color por fila
  # (El resto de utilidades: filtros, freeze, anchos, bordes)
  openxlsx::addFilter(wb, "familias", rows = 1, cols = 1:ncol(tpl))
  openxlsx::freezePane(wb, "familias", firstActiveRow = 2, firstActiveCol = 2)
  openxlsx::setColWidths(wb, "familias", cols = 1:ncol(tpl), widths = "auto")
  openxlsx::addStyle(wb, "familias", style_border_all,
                     rows = 1:(nrow(tpl)+1), cols = 1:ncol(tpl), gridExpand = TRUE, stack = TRUE)


  # Hoja AYUDA mínima
  openxlsx::addWorksheet(wb, "ayuda")
  openxlsx::writeData(wb, "ayuda",
                      "Cómo usar 'familias':
- 'use' = TRUE/FALSE para incluir la fila.
- 'q_order' = número de la pregunta en el cuestionario (orden del survey).
- 'tipo' ∈ {select_one, select_multiple, integer, text}.
- 'modo_so' = obligatorio solo para select_one. Use 'padre' si el texto ayuda a recodificar la variable original, o 'hijo' si el texto se recodifica como variable independiente.
- 'parent' = nombre de la pregunta (survey$name).
- 'parent_label' = etiqueta en español tomada del XLSForm (survey_raw).
- 'list_norm' = nombre normalizado de la lista de opciones (igual que en CHOICES).
- 'parent_col' = nombre EXACTO en tus datos (columna padre).
- 'other_dummy_col' = solo select_multiple: dummy de la opción que habilita el texto asociado.
- 'text_col' = texto asociado detectado por semántica del XLSForm (o por nombre como fallback).
- 'integer' usa solo 'parent_col'; no requiere 'text_col' ni 'other_dummy_col'.
Las columnas *_cands son sugerencias hechas a partir de los nombres originales del dataset.")
  openxlsx::setColWidths(wb, "ayuda", cols = 1, widths = 120)

  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(normalizePath(path))
}

#' Escribir plantilla de familias (versión repeat-aware, enmascarada)
#'
#' Genera **un único Excel** con las sugerencias de familias para todas las
#' secciones del instrumento (main y repeats), **sin duplicar** el cuestionario.
#' Se apoya en `codif_detector_repeat()` para filtrar las preguntas que
#' pertenecen a cada sección, y resuelve `parent_col`, `text_col` y dummies
#' usando los nombres **originales** de la hoja de datos correspondiente
#' en `tabs` (tal como los creó `lector_codif_repeat()`).
#'
#' Colorea filas por `tipo` (select_one / select_multiple / text) y destaca
#' las columnas `other_dummy_col` y `text_col` con borde y encabezado pastel.
#'
#' @param inst list. Instrumento leído con `leer_instrumento_xlsform()` (debe
#'   traer `inst$survey` y, si es posible, `inst$survey_raw`).
#' @param tabs list. Salida de `lector_codif_repeat()` (nombres esperados:
#'   `main` y las hojas hijas en minúsculas y snake case), donde cada entrada
#'   es una lista con `raw`, `clean`, `name_map`.
#' @param path character. Ruta de salida del Excel único. Default `"familias_repeat.xlsx"`.
#' @param incluir_text_vars logical. Incluir preguntas `text` como filas. Default `TRUE`.
#' @param verbose logical. Mensajes por consola. Default `TRUE`.
#'
#' @return Ruta absoluta al archivo escrito (invisible).
#' @examples
#' \dontrun{
#' inst <- leer_instrumento_xlsform("RMS_instrumento.xlsx")
#' tabs <- lector_codif_repeat(path_xlsx, main_sheet="RMS 2025 Perú - Q4",
#'                             repeat_sheets=c("rpt_hhmnames","S1","CHILDEDUPE"))
#' escribir_plantilla_familias_repeat_mask(inst, tabs, path="RMS_familias.xlsx")
#' }
#' @family codificacion
#' @export
escribir_plantilla_familias_repeat <- function(inst,
                                                    tabs,
                                                    path = "familias_repeat.xlsx",
                                                    incluir_text_vars = TRUE,
                                                    verbose = TRUE){
  stopifnot(is.list(inst), is.list(tabs), "survey" %in% names(inst))

  `%||%` <- function(x, y) if (is.null(x) || (length(x)==1 && is.na(x))) y else x
  nzchr   <- function(x) is.character(x) && length(x)==1 && !is.na(x) && nzchar(x)

  # --- 1) Detector repeat-aware (no duplica el survey) -----------------------
  det <- codif_detector_repeat(inst)
  if (!nrow(det)) stop("El instrumento no tiene filas en survey.")

  tipos_obj <- c(
    "select_one",
    "select_multiple",
    "integer",
    if (isTRUE(incluir_text_vars)) "text" else character(0)
  )
  det <- det %>%
    dplyr::filter(.data$type_base %in% tipos_obj)

  # Secciones presentes en detector, ordenando "main" primero
  sections <- unique(det$repeat_section)
  sections <- c("main", setdiff(sections, "main"))
  survey_ctx <- .codif_build_survey_context(inst)
  choices_lookup <- .codif_choices_lookup(inst, survey_ctx)

  # --- 2) Sugerencias por sección (usando la hoja correcta de `tabs`) --------
  piezas <- list()

  for (sec in sections){
    sec_nm  <- janitor::make_clean_names(sec)
    dat_ent <- tabs[[sec_nm]]
    if (is.null(dat_ent) || !all(c("raw","name_map") %in% names(dat_ent))) {
      if (isTRUE(verbose)) message("• Sección '", sec, "': sin datos en `tabs` → omitida.")
      next
    }

    # Subconjunto de preguntas de ESTA sección
    det_sec <- det %>% dplyr::filter(.data$repeat_section == !!sec)
    if (!nrow(det_sec)) next

    if (isTRUE(verbose)) message("📄 Sección: ", sec, " → usando hoja de datos '", sec_nm, "'")

    # Construir "cand" como en el constructor base, pero SOLO con estas vars
    tb <- tibble::tibble(
      name       = det_sec$var_name,
      type_base  = det_sec$type_base,
      q_order    = seq_len(nrow(det_sec)), # si tienes q_order real, reemplázalo aquí
      list_name  = if ("list_name" %in% names(inst$survey)) {
        inst$survey$list_name[ match(janitor::make_clean_names(det_sec$var_name),
                                     janitor::make_clean_names(inst$survey$name))]
      } else NA_character_,
      list_norm  = if ("list_norm" %in% names(inst$survey)) {
        inst$survey$list_norm[ match(janitor::make_clean_names(det_sec$var_name),
                                     janitor::make_clean_names(inst$survey$name))]
      } else tolower(gsub("[^a-z0-9_]", "_", gsub("\\s+","_", as.character(list_name))))
    )

    cand <- tb %>%
      dplyr::transmute(
        parent       = .data$name,
        parent_label = label_es_from_inst(.data$name, inst),
        tipo_sugerido= .data$type_base,
        q_order      = .data$q_order,
        list_norm    = .data$list_norm
      )

    nmmap <- dat_ent$name_map
    cols_exist <- names(dat_ent$raw)

    tpl_sec <- .codif_build_family_tpl(
      cand = cand,
      inst = inst,
      name_map = nmmap,
      cols_exist = cols_exist,
      survey_ctx = survey_ctx,
      choices_lookup = choices_lookup,
      section = sec,
      hoja_datos = sec_nm
    )
    tpl_sec$modo_so <- if (nrow(tpl_sec)) ifelse(tpl_sec$tipo == "select_one", "", "") else character(0)
    tpl_sec <- tpl_sec %>%
      dplyr::mutate(
        exists_parent_col = !is.na(parent_col) & parent_col %in% cols_exist,
        exists_text_col   = is.na(text_col) | text_col %in% cols_exist,
        exists_dummy_col  = is.na(other_dummy_col) |
          mapply(.codif_dummy_col_available, list(cols_exist), parent_col, other_dummy_col, USE.NAMES = FALSE)
      ) %>%
      dplyr::select(section, hoja_datos,
                    use, q_order, tipo, modo_so, parent, parent_label, list_norm,
                    parent_col, other_dummy_col, text_col,
                    parent_col_cands, other_dummy_cands, text_col_cands, dummy_cands,
                    exists_parent_col, exists_text_col, exists_dummy_col)

    # Tipos robustos (evitar choques al bind_rows)
    chr_cols <- c("section","hoja_datos","tipo","parent","parent_label","list_norm",
                  "modo_so","parent_col","other_dummy_col","text_col",
                  "parent_col_cands","other_dummy_cands","text_col_cands","dummy_cands")
    for (cc in intersect(chr_cols, names(tpl_sec))) {
      tpl_sec[[cc]] <- as.character(tpl_sec[[cc]])
      tpl_sec[[cc]][is.na(tpl_sec[[cc]])] <- ""
    }
    tpl_sec$q_order <- suppressWarnings(as.integer(tpl_sec$q_order))
    tpl_sec$use     <- as.logical(tpl_sec$use)
    for (lc in c("exists_parent_col","exists_text_col","exists_dummy_col")) {
      if (lc %in% names(tpl_sec)) tpl_sec[[lc]] <- as.logical(tpl_sec[[lc]])
    }

    piezas[[sec]] <- tpl_sec
  }

  if (!length(piezas)) stop("No se generó contenido para ninguna sección.")

  tpl_all <- dplyr::bind_rows(piezas) %>%
    dplyr::arrange(factor(section, levels = sections), q_order, parent)

  # --- 3) Excel único con formato (estilo del constructor base) --------------
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "familias")

  style_hdr <- openxlsx::createStyle(
    textDecoration = "bold", halign = "center", valign = "center",
    border = "TopBottomLeftRight"
  )
  style_border_all <- openxlsx::createStyle(border = "TopBottomLeftRight", borderColour = "black")

  style_special_hdr <- openxlsx::createStyle(
    fgFill = "#F9D5E5",
    halign = "center", valign = "center",
    border = "TopBottomLeftRight", borderStyle = "thick"
  )
  style_special_body <- openxlsx::createStyle(
    fgFill = "#F9D5E5",
    border = "TopBottomLeftRight", borderStyle = "thick"
  )

  type_styles <- list(
    select_multiple = openxlsx::createStyle(fgFill = "#E2F0D9"),
    select_one = openxlsx::createStyle(fgFill = "#D9E1F2"),
    integer = openxlsx::createStyle(fgFill = "#E6D9F2"),
    text = openxlsx::createStyle(fgFill = "#FFF2CC"),
    default = openxlsx::createStyle(fgFill = "#EEEEEE")
  )

  openxlsx::writeData(wb, "familias", tpl_all, startRow = 1, colNames = TRUE)
  openxlsx::addStyle(wb, "familias", style_hdr, rows = 1, cols = 1:ncol(tpl_all), gridExpand = TRUE)

  # columnas a resaltar
  idx_other <- which(colnames(tpl_all) == "other_dummy_col")
  idx_text  <- which(colnames(tpl_all) == "text_col")
  idx_special <- c(idx_other, idx_text)

  .codif_apply_type_fill(wb, "familias", tpl_all, idx_special, type_styles)

  # Pastel para columnas especiales (encabezado + cuerpo)
  if (length(idx_special)){
    openxlsx::addStyle(wb, "familias", style_special_hdr,
                       rows = 1, cols = idx_special, gridExpand = TRUE, stack = TRUE)
    if (nrow(tpl_all)){
      openxlsx::addStyle(wb, "familias", style_special_body,
                         rows = 2:(nrow(tpl_all)+1), cols = idx_special, gridExpand = TRUE, stack = TRUE)
    }
  }

  openxlsx::addFilter(wb, "familias", rows = 1, cols = 1:ncol(tpl_all))
  openxlsx::freezePane(wb, "familias", firstActiveRow = 2, firstActiveCol = 3) # deja visible section+hoja
  openxlsx::setColWidths(wb, "familias", cols = 1:ncol(tpl_all), widths = "auto")
  openxlsx::addStyle(wb, "familias", style_border_all,
                     rows = 1:(nrow(tpl_all)+1), cols = 1:ncol(tpl_all), gridExpand = TRUE, stack = TRUE)

  # Hoja AYUDA
  openxlsx::addWorksheet(wb, "ayuda")
  openxlsx::writeData(wb, "ayuda",
                      "Cómo usar 'familias' (repeat-aware):
- 'section' = sección del instrumento (main o nombre del repeat).
- 'hoja_datos' = hoja de datos en la que buscar los nombres ORIGINALES.
- 'use' = TRUE/FALSE para incluir la fila.
- 'q_order' = orden aproximado de la pregunta (si tienes q_order real, úsalo allí).
- 'tipo' ∈ {select_one, select_multiple, integer, text}.
- 'modo_so' = obligatorio solo para select_one. Use 'padre' si el texto ayuda a recodificar la variable original, o 'hijo' si el texto se recodifica como variable independiente.
- 'parent' = nombre de la pregunta (survey$name).
- 'parent_label' = etiqueta en español (XLSForm).
- 'list_norm' = lista de opciones normalizada (CHOICES).
- 'parent_col' = nombre EXACTO en la hoja 'hoja_datos' (columna padre).
- 'other_dummy_col' = solo select_multiple: dummy de la opción que habilita el texto asociado.
- 'text_col' = texto asociado detectado por semántica del XLSForm (o por nombre como fallback).
- 'integer' usa solo 'parent_col'; no requiere 'text_col' ni 'other_dummy_col'.
- Las columnas *_cands son sugerencias iniciales a partir de los nombres ORIGINALES en la hoja indicada.
- Las columnas 'exists_*' indican existencia en la hoja de datos correspondiente.")
  openxlsx::setColWidths(wb, "ayuda", cols = 1, widths = 120)

  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  if (isTRUE(verbose)) message("✔ Excel consolidado creado: ", normalizePath(path))
  invisible(normalizePath(path))
}


# ----- 4. Lector de la plantilla de Excel de familias ---------------------
#' Leer y **clasificar** el Excel de familias (con adopciones y huérfanas)
#'
#' Lee la hoja \code{sheet} de un Excel de familias ya editado por la persona usuaria
#' y devuelve subconjuntos listos para construir la plantilla de codificación,
#' además de avisos útiles sobre \emph{adopciones} (qué \code{text_col} fue
#' adoptada por qué SO/SM) y \emph{textos huérfanos} (text sin padre asignado).
#'
#' @details
#' La función:
#' \itemize{
#'   \item Normaliza levemente las columnas de la hoja \code{sheet} (\code{use}, \code{tipo}, etc.).
#'   \item Verifica si \code{parent_col}, \code{text_col} y \code{other_dummy_col} existen en \code{dat$raw}.
#'   \item Acepta filas \strong{select\_multiple} solo si existen \code{text_col} y \code{other_dummy_col}.
#'   \item Acepta filas \strong{select\_one} solo si existe \code{text_col}.
#'   \item Considera \strong{text} finales únicamente si NO aparecen como \code{text_col}
#'         de alguna SO/SM con \code{use = TRUE} (es decir, ya “adoptadas”).
#'   \item Construye un cuadro de \strong{adopciones} (quién adopta a quién) y otro de
#'         \strong{textos huérfanos} (text que no fueron adoptadas por ninguna SO/SM).
#'   \item Enriquece \code{parent\_label\_es} desde el XLSForm (\code{inst$survey\_raw} en español
#'         cuando es posible; si no, \code{inst$survey}).
#'   \item Devuelve un catálogo de \emph{choices} utilizadas (por \code{list\_norm}) para las familias aceptadas.
#' }
#'
#' @param path \code{character}. Ruta al Excel de familias (p. ej. \code{"familias.xlsx"}).
#' @param inst \code{list}. Instrumento XLSForm leído con tu “lector minimalista”; debe contener
#'   al menos \code{$survey}, \code{$choices} (idealmente también \code{$survey\_raw}, \code{$choices\_raw}).
#' @param dat \code{list}. Objeto devuelto por \code{leer_datos()} con \code{$raw} (y usualmente \code{$name\_map}).
#' @param sheet \code{character}. Nombre de la hoja a leer del Excel de familias. Default: \code{"familias"}.
#' @param verbose \code{logical}. Si \code{TRUE}, imprime un resumen y ejemplos de adopciones/huérfanas. Default: \code{TRUE}.
#'
#' @return \code{list} con los elementos:
#' \describe{
#'   \item{\code{familias\_filtradas}}{Tibble con las filas aceptadas (SO/SM/TEXT), tras aplicar reglas y existencia en datos.}
#'   \item{\code{select\_multiple}}{Subconjunto aceptado de \code{familias\_filtradas} para \code{tipo == "select_multiple"}.}
#'   \item{\code{select\_one}}{Subconjunto aceptado de \code{familias\_filtradas} para \code{tipo == "select_one"}.}
#'   \item{\code{text}}{Subconjunto aceptado de \code{familias\_filtradas} para \code{tipo == "text"}
#'         (solo \emph{huérfanas}, i.e., no usadas como \code{text_col} en SO/SM con \code{use=TRUE}).}
#'   \item{\code{familias\_enriquecidas}}{Tibble con \code{parent\_label\_es} y banderas \code{falta\_dummy\_sm}, \code{falta\_text}.}
#'   \item{\code{choices\_usadas}}{Tibble con \code{parent}, \code{parent\_col}, \code{list\_norm}, \code{code}, \code{label\_es}
#'         para las listas utilizadas por las familias aceptadas.}
#'   \item{\code{adopciones}}{Tibble de mapeo de \code{text_col} adoptadas: incluye \code{adoptada\_por\_parent},
#'         \code{adoptada\_por\_label}, \code{tipo\_padre} y si el \emph{padre} existe en los datos.}
#'   \item{\code{textos\_huerfanos}}{Tibble con \code{text_col} de \code{tipo == "text"} que quedaron sin adopción y motivo.}
#'   \item{\code{resumen}}{Tibble con contadores: totales aceptados por tipo, excluidas, \#adopciones y \#huérfanas.}
#' }
#'
#' @section Reglas de aceptación:
#' \itemize{
#'   \item \strong{select\_multiple}: \code{use == TRUE} \emph{y} existen \code{text_col} \emph{y} \code{other_dummy_col} en \code{dat$raw}.
#'   \item \strong{select\_one}: \code{use == TRUE} \emph{y} existe \code{text_col} en \code{dat$raw}.
#'   \item \strong{text}: \code{use == TRUE} \emph{y} su \code{text_col} \emph{no} aparece como hija de una SO/SM aceptada.
#' }
#'
#' @examples
#' \dontrun{
#' inst <- leer_instrumento_xlsform("instrumento.xlsx")
#' dat  <- leer_datos("datos.xlsx")
#' fams <- leer_familias_clasificar("familias.xlsx", inst = inst, dat = dat, sheet = "familias")
#'
#' # inspección rápida:
#' fams$resumen
#' head(fams$adopciones)
#' head(fams$textos_huerfanos)
#' }
#'
#' @seealso \code{\link{construir_plantilla_desde_familias}}, \code{\link{escribir_plantilla_familias}}
#' @family codificacion
#' @export
leer_familias_clasificar <- function(path, inst, dat, sheet = "familias", verbose = TRUE){
  stopifnot(is.list(inst), is.list(dat), "survey" %in% names(inst), "choices" %in% names(inst))
  fam <- readxl::read_excel(path, sheet = sheet) %>%
    janitor::clean_names()

  # === SANITIZACIÓN CRÍTICA ==========================================
  chr_cols <- c("tipo","modo_so","parent","parent_label","list_norm",
                "parent_col","other_dummy_col","text_col",
                "parent_col_cands","other_dummy_cands","text_col_cands","dummy_cands")
  for (cc in intersect(chr_cols, names(fam))) {
    # fuerza a character y reemplaza NA por cadena vacía
    fam[[cc]] <- as.character(fam[[cc]])
    fam[[cc]][is.na(fam[[cc]])] <- ""
    # limpia espacios invisibles
    fam[[cc]] <- trimws(fam[[cc]])
  }
  # use → lógico robusto
  if (!"use" %in% names(fam)) fam$use <- TRUE
  fam$use <- dplyr::case_when(
    is.logical(fam$use) ~ fam$use,
    tolower(as.character(fam$use)) %in% c("1","true","t","si","sí","yes","y") ~ TRUE,
    tolower(as.character(fam$use)) %in% c("0","false","f","no","n") ~ FALSE,
    TRUE ~ TRUE
  )
  # tipo en minúsculas
  if ("tipo" %in% names(fam)) fam$tipo <- tolower(fam$tipo)
  # ==========================================================================

  # columnas esperadas (tolerante)
  need <- c("use","tipo","modo_so","parent","parent_label","q_order","list_norm",
            "parent_col","other_dummy_col","text_col")
  for (k in need) if (!k %in% names(fam)) fam[[k]] <- NA

  # normalizaciones suaves
  if (!"use" %in% names(fam)) fam$use <- TRUE
  fam$use  <- as.logical(fam$use)
  fam$tipo <- tolower(trimws(as.character(fam$tipo %||% "")))
  fam$modo_so <- tolower(trimws(as.character(fam$modo_so %||% "")))
  fam$parent_col <- trimws(as.character(fam$parent_col))
  fam$text_col   <- trimws(as.character(fam$text_col))

  .codif_validate_modo_so(fam, path = path, repeat_aware = FALSE)

  # existencia en datos crudos
  cols <- names(dat$raw)
  fam <- fam %>%
    dplyr::mutate(
      exists_parent_col = !is.na(.data$parent_col)      & .data$parent_col      %in% cols,
      exists_text_col   = !is.na(.data$text_col)        & .data$text_col        %in% cols,
      exists_dummy_col  = !is.na(.data$other_dummy_col) &
        mapply(.codif_dummy_col_available, list(cols), .data$parent_col, .data$other_dummy_col, USE.NAMES = FALSE)
    )

  # reglas de aceptación por tipo (igual que antes)
  acc_sm <- fam$use & fam$tipo == "select_multiple" & fam$exists_text_col & fam$exists_dummy_col
  acc_so <- fam$use & fam$tipo == "select_one"      & fam$exists_text_col
  acc_int <- fam$use & fam$tipo == "integer"        & fam$exists_parent_col

  # --- NUEVO: adopciones y huérfanas ---------------------------------------
  # Columna de texto EFECTIVA: si tipo=="text" y text_col está vacío, usar parent_col
  fam$text_col_eff <- fam$text_col
  fam$text_col_eff[ fam$tipo == "text" & (is.na(fam$text_col_eff) | !nzchar(fam$text_col_eff)) ] <- fam$parent_col[ fam$tipo == "text" ]

  # set de textos asignados como hijas por alguna SO/SM con use=TRUE
  text_cols_asignadas <- unique(
    fam$text_col[
      (acc_so | acc_sm) &
        !is.na(fam$text_col) & nzchar(fam$text_col)
    ]
  )

  # TEXTO finales: solo las 'text' cuya EFECTIVA NO esté asignada como hija
  acc_tx <- fam$use & fam$tipo == "text" & !(fam$text_col_eff %in% text_cols_asignadas)

  # construir fam_ok con acc_sm|acc_so|acc_tx|acc_int
  fam_ok <- fam[acc_sm | acc_so | acc_tx | acc_int, , drop = FALSE]

  # Para que aguas abajo “text” lleve el nombre correcto, clona text_col = text_col_eff
  fam_ok$text_col[ fam_ok$tipo == "text" ] <- fam_ok$text_col_eff[ fam_ok$tipo == "text" ]

  # --- adopciones pero ya no afecta el cálculo de 'text'
  adopt_rows <- fam[acc_so | acc_sm, , drop = FALSE]
  adopciones <- tibble::tibble(
    text_col              = text_cols_asignadas,
    adoptada_por_parent   = adopt_rows$parent_col[ match(text_cols_asignadas, adopt_rows$text_col) ] %||% NA_character_,
    adoptada_por_label    = adopt_rows$parent_label[ match(text_cols_asignadas, adopt_rows$text_col) ] %||% NA_character_,
    tipo_padre            = adopt_rows$tipo[ match(text_cols_asignadas, adopt_rows$text_col) ] %||% NA_character_,
    padre_existe_en_datos = adopt_rows$exists_parent_col[ match(text_cols_asignadas, adopt_rows$text_col) ] %||% NA
  )

  # --- huérfanas: usar la EFECTIVA y sacar las ya asignadas
  es_text <- fam$use & fam$tipo == "text"
  huerf <- fam[es_text & !(fam$text_col_eff %in% text_cols_asignadas), , drop = FALSE]
  textos_huerfanos <- tibble::tibble(
    text_col        = huerf$text_col_eff,
    parent_sugerido = huerf$parent_col,
    existe_en_datos = huerf$exists_text_col,   # (si quieres, reevalúa existencia usando text_col_eff)
    motivo          = "No asignada como text_col de ninguna SO/SM con use = TRUE"
  ) %>% dplyr::arrange(!existe_en_datos, text_col)

  # --- (resto) Enriquecer con label ES desde XLSForm  --
  if (exists("label_es_from_inst", mode = "function")) {
    fam_ok$parent_label_es <- label_es_from_inst(fam_ok$parent %||% fam_ok$parent_col, inst)
  } else {
    label_es_from_inst <- function(parent, inst){
      nm <- janitor::make_clean_names(parent)
      s <- inst$survey
      i <- match(nm, janitor::make_clean_names(s$name))
      lab <- rep(NA_character_, length(nm))
      if (!is.null(inst$survey_raw)) {
        sr <- inst$survey_raw
        col_es <- grep("^label(::)?spanish|label[_:]spanish|label[_:]es$", tolower(names(sr)), value = TRUE)[1]
        if (!is.na(col_es)) {
          j <- match(nm, janitor::make_clean_names(sr$name))
          lab_ok <- ifelse(!is.na(j), as.character(sr[[col_es]][j]), NA_character_)
          lab <- ifelse(!is.na(lab_ok) & nzchar(lab_ok), lab_ok, lab)
        }
      }
      if (any(is.na(lab))) {
        cand <- c("label_spanish_es","label_es","label")
        col2 <- cand[cand %in% names(s)]
        if (length(col2)) {
          v <- s[[col2[1]]]; lab2 <- ifelse(!is.na(i), as.character(v[i]), NA_character_)
          lab <- ifelse(is.na(lab) & !is.na(lab2) & nzchar(lab2), lab2, lab)
        }
      }
      lab[is.na(lab) | !nzchar(lab)] <- nm[is.na(lab) | !nzchar(lab)]
      lab
    }
    fam_ok$parent_label_es <- label_es_from_inst(fam_ok$parent %||% fam_ok$parent_col, inst)
  }

  # dividir por tipo (como ya lo tienes)
  sm  <- fam_ok[fam_ok$tipo == "select_multiple", , drop = FALSE]
  so  <- fam_ok[fam_ok$tipo == "select_one",      , drop = FALSE]
  int <- fam_ok[fam_ok$tipo == "integer",         , drop = FALSE]
  tx  <- fam_ok[fam_ok$tipo == "text",            , drop = FALSE]

  # catálogo de choices (igual que tu versión)
  choices_usadas <- NULL
  if (nrow(fam_ok)) {
    with_ln <- fam_ok %>% dplyr::filter(!is.na(.data$list_norm) & nzchar(.data$list_norm))
    if (nrow(with_ln)) {
      choices_usadas <- with_ln %>%
        dplyr::select(parent, parent_col, list_norm, tipo) %>%
        dplyr::distinct() %>%
        dplyr::left_join(
          inst$choices %>%
            dplyr::transmute(
              list_norm,
              code     = as.character(.data$name),
              label_es = as.character(
                if ("label_spanish_es" %in% names(inst$choices)) .data$label_spanish_es else
                  if ("label" %in% names(inst$choices)) .data$label else .data$name
              )
            ),
          by = "list_norm"
        ) %>%
        dplyr::arrange(.data$parent, .data$code)
    }
  }
  if (is.null(choices_usadas)) {
    choices_usadas <- tibble::tibble(parent = character(), parent_col = character(),
                                     list_norm = character(), tipo = character(),
                                     code = character(), label_es = character())
  }

  # Resumen + mini-avisos
  resumen <- tibble::tibble(
    total_filas_excel = nrow(fam),
    aceptadas_total   = nrow(fam_ok),
    aceptadas_sm      = nrow(sm),
    aceptadas_so      = nrow(so),
    aceptadas_int     = nrow(int),
    aceptadas_text    = nrow(tx),
    excluidas         = nrow(fam) - nrow(fam_ok),
    textos_adoptados  = nrow(adopciones),
    textos_huerfanos  = nrow(textos_huerfanos)
  )
  diagnostico_clasificacion <- .codif_add_classification_diagnostics(
    fam = fam,
    acc_sm = acc_sm,
    acc_so = acc_so,
    acc_tx = acc_tx,
    acc_int = acc_int
  )

  if (isTRUE(verbose)) {
    cat("\n[Familias] SO aceptadas:", nrow(so),
        "| SM aceptadas:", nrow(sm),
        "| INTEGER aceptadas:", nrow(int),
        "| TEXT finales:", nrow(tx), "\n")
    cat("[Adopciones] text_col adoptadas:", nrow(adopciones), "\n")
    if (nrow(adopciones)) {
      print(utils::head(adopciones, 5))
    }
    cat("[Huérfanas] text sin adopción:", nrow(textos_huerfanos), "\n")
    if (nrow(textos_huerfanos)) {
      print(utils::head(textos_huerfanos, 5))
      cat("→ Sugerencia: asigna estas 'text' en la columna 'text_col' de alguna SO/SM y marca 'use = TRUE'.\n")
    }
    excl_diag <- diagnostico_clasificacion %>% dplyr::filter(.data$estado_clasificacion == "excluida")
    if (nrow(excl_diag)) {
      cat("[Clasificación] principales motivos de exclusión:\n")
      print(excl_diag %>% dplyr::count(.data$motivo_clasificacion, sort = TRUE))
    }
  }

  list(
    familias_filtradas   = fam_ok,
    select_multiple      = sm,
    select_one           = so,
    integer              = int,
    text                 = tx,
    familias_enriquecidas= fam_ok %>% dplyr::mutate(
      falta_dummy_sm = (.data$tipo == "select_multiple") & !.data$exists_dummy_col,
      falta_text     = (.data$tipo %in% c("select_multiple","select_one")) & !.data$exists_text_col
    ),
    choices_usadas       = choices_usadas,
    # NUEVO:
    adopciones           = adopciones,
    textos_huerfanos     = textos_huerfanos,
    resumen              = resumen,
    diagnostico_clasificacion = diagnostico_clasificacion
  )
}




#' Leer y clasificar Excel de familias (repeat-aware, 1 hoja "familias")
#'
#' - Lee una sola hoja "familias" con columnas estándar + nuevas: `section` y/o `hoja_datos`.
#' - Verifica existencia de columnas en la hoja de datos correcta (según `hoja_datos`/`section`) dentro de `tabs`.
#' - Ignora cualquier QOrder del Excel y recalcula `q_order` con el orden del survey de `inst`.
#' - Mantiene la lógica de adopciones: SO/SM adoptan `text_col`; los TEXT finales son huérfanos no adoptados.
#'
#' @param path Ruta del Excel de familias (una hoja "familias").
#' @param inst Instrumento leído (debe contener `survey` y `choices`, ideal `survey_raw`/`choices_raw`).
#' @param tabs Lista de datos por hoja: salida de `lector_codif_repeat()` (p.ej. `main`, `s1`, `childedupe`, etc.).
#' @param sheet Nombre de la hoja (default "familias").
#' @param verbose Imprimir mini-resumen (default TRUE).
#' @return lista con `familias_filtradas`, `select_multiple`, `select_one`, `text`,
#'   `familias_enriquecidas`, `choices_usadas`, `adopciones`, `textos_huerfanos`, `resumen`.
#' @family codificacion
#' @export
leer_familias_clasificar_repeat <- function(path, inst, tabs, sheet = "familias", verbose = TRUE){
  stopifnot(is.list(inst), is.list(tabs), "survey" %in% names(inst), "choices" %in% names(inst))

  fam <- readxl::read_excel(path, sheet = sheet) |> janitor::clean_names()

  # --- normalizar columnas clave (tolerante a sinónimos) --------------------
  normalize_name <- function(nms) {
    nms2 <- nms
    nms2 <- sub("^otherdummycalls?$", "other_dummy_col", nms2, ignore.case = TRUE)
    nms2 <- sub("^other_dummy_calls?$", "other_dummy_col", nms2, ignore.case = TRUE)
    nms2 <- sub("^text(call|_call|col|_col)?$", "text_col", nms2, ignore.case = TRUE)
    nms2 <- sub("^hoja(_)?datos$", "hoja_datos", nms2, ignore.case = TRUE)
    nms2
  }
  names(fam) <- normalize_name(names(fam))

  need_chr <- c("section","hoja_datos","tipo","modo_so","parent","parent_label","list_norm",
                "parent_col","other_dummy_col","text_col",
                "parent_col_cands","other_dummy_cands","text_col_cands","dummy_cands")
  for (cc in need_chr) if (!cc %in% names(fam)) fam[[cc]] <- NA_character_

  # tipado consistente (evita choques character/double)
  fam <- fam |>
    dplyr::mutate(
      dplyr::across(dplyr::all_of(need_chr), ~ as.character(dplyr::coalesce(.x, ""))),
      use = dplyr::case_when(
        !("use" %in% names(fam)) ~ TRUE,
        is.logical(.data$use) ~ .data$use,
        tolower(as.character(.data$use)) %in% c("1","true","t","si","sí","yes","y") ~ TRUE,
        tolower(as.character(.data$use)) %in% c("0","false","f","no","n") ~ FALSE,
        TRUE ~ TRUE
      ),
      tipo = tolower(trimws(as.character(.data$tipo))),
      modo_so = tolower(trimws(as.character(.data$modo_so)))
    )

  .codif_validate_modo_so(fam, path = path, repeat_aware = TRUE)

  # hoja de datos efectiva: hoja_datos > section > "main"
  fam$hoja_datos <- ifelse(nzchar(fam$hoja_datos), fam$hoja_datos,
                           ifelse(nzchar(fam$section), fam$section, "main"))
  fam$hoja_datos_clean <- janitor::make_clean_names(fam$hoja_datos)

  # --- q_order desde el XLSForm (orden canónico del survey) -----------------
  s <- inst$survey
  if (!"q_order" %in% names(s) || all(is.na(s$q_order))) s$q_order <- seq_len(nrow(s))
  s$name_clean <- janitor::make_clean_names(s$name)

  # clave de match por fila (preferimos parent, si no parent_col)
  key <- dplyr::coalesce(fam$parent, fam$parent_col)
  key_clean <- janitor::make_clean_names(key)
  qo <- s$q_order[ match(key_clean, s$name_clean) ]
  # si no matchea nada, NA_integer_ (no vector de largo 0)
  qo[is.na(qo)] <- NA_integer_
  fam$q_order <- as.integer(qo)

  # --- existencia por hoja de datos correcta --------------------------------
  exists_in_tab <- function(col, hoja){
    if (!nzchar(col)) return(FALSE)
    ent <- tabs[[janitor::make_clean_names(hoja)]]
    if (is.null(ent) || !"raw" %in% names(ent)) return(FALSE)
    col %in% names(ent$raw)
  }
  exists_dummy_in_tab <- function(parent_col, dummy_col, hoja){
    if (!nzchar(dummy_col)) return(FALSE)
    ent <- tabs[[janitor::make_clean_names(hoja)]]
    if (is.null(ent) || !"raw" %in% names(ent)) return(FALSE)
    .codif_dummy_col_available(names(ent$raw), parent_col, dummy_col)
  }
  fam$exists_parent_col <- mapply(exists_in_tab, fam$parent_col, fam$hoja_datos, USE.NAMES = FALSE)
  fam$exists_text_col   <- mapply(exists_in_tab, fam$text_col,   fam$hoja_datos, USE.NAMES = FALSE)
  fam$exists_dummy_col  <- mapply(exists_dummy_in_tab, fam$parent_col, fam$other_dummy_col, fam$hoja_datos, USE.NAMES = FALSE)

  # --- reglas de aceptación --------------------------------------------------
  acc_sm <- fam$use & fam$tipo == "select_multiple" & fam$exists_text_col & fam$exists_dummy_col
  acc_so <- fam$use & fam$tipo == "select_one"      & fam$exists_text_col
  acc_int <- fam$use & fam$tipo == "integer"        & fam$exists_parent_col

  # Columna de texto EFECTIVA: si tipo text sin text_col, usar parent_col
  fam$text_col_eff <- fam$text_col
  fam$text_col_eff[ fam$tipo == "text" & !nzchar(fam$text_col_eff) ] <- fam$parent_col[ fam$tipo == "text" ]

  # text adoptadas por SO/SM con use=TRUE
  text_cols_asignadas <- unique(stats::na.omit(fam$text_col[fam$use & fam$tipo %in% c("select_one","select_multiple")]))
  # TEXT finales: huérfanas
  acc_tx <- fam$use & fam$tipo == "text" & !(fam$text_col_eff %in% text_cols_asignadas)

  fam_ok <- fam[ acc_sm | acc_so | acc_tx | acc_int, , drop = FALSE ]
  fam_ok$text_col[ fam_ok$tipo == "text" ] <- fam_ok$text_col_eff[ fam_ok$tipo == "text" ]

  # adopciones (solo informativo)
  adopt_rows <- fam[fam$use & fam$tipo %in% c("select_one","select_multiple"), , drop = FALSE]
  adopciones <- tibble::tibble(
    text_col              = text_cols_asignadas,
    adoptada_por_parent   = adopt_rows$parent_col[ match(text_cols_asignadas, adopt_rows$text_col) ],
    adoptada_por_label    = adopt_rows$parent_label[ match(text_cols_asignadas, adopt_rows$text_col) ],
    tipo_padre            = adopt_rows$tipo[ match(text_cols_asignadas, adopt_rows$text_col) ],
    hoja_datos_padre      = adopt_rows$hoja_datos[ match(text_cols_asignadas, adopt_rows$text_col) ],
    padre_existe_en_datos = adopt_rows$exists_parent_col[ match(text_cols_asignadas, adopt_rows$text_col) ]
  )

  # enriquecer label ES si falta
  need_lab <- !nzchar(fam_ok$parent_label)
  if (any(need_lab)) {
    fam_ok$parent_label[need_lab] <- s_lab_from_original(dplyr::coalesce(fam_ok$parent[need_lab], fam_ok$parent_col[need_lab]), inst)
  }

  # choices usadas (por list_norm) — igual que antes, pero sin romper tipos
  choices_usadas <- NULL
  if (nrow(fam_ok)) {
    with_ln <- fam_ok |> dplyr::filter(!is.na(.data$list_norm) & nzchar(.data$list_norm))
    if (nrow(with_ln)) {
      choices_usadas <- with_ln |>
        dplyr::select(parent, parent_col, list_norm, tipo) |>
        dplyr::distinct() |>
        dplyr::left_join(
          inst$choices |>
            dplyr::transmute(
              list_norm = tolower(gsub("[^a-z0-9_]", "_", gsub("\\s+","_", as.character(.data$list_name)))),
              code      = as.character(.data$name),
              label_es  = as.character(if ("label_spanish_es" %in% names(inst$choices)) .data$label_spanish_es
                                       else if ("label" %in% names(inst$choices)) .data$label else .data$name)
            ),
          by = "list_norm"
        ) |>
        dplyr::arrange(.data$parent, .data$code)
    }
  }
  if (is.null(choices_usadas)) {
    choices_usadas <- tibble::tibble(parent = character(), parent_col = character(),
                                     list_norm = character(), tipo = character(),
                                     code = character(), label_es = character())
  }

  # dividir por tipo + ordenar por q_order (canónico)
  fam_ok <- fam_ok |> dplyr::arrange(q_order, factor(tipo, levels = c("select_one","select_multiple","integer","text")))
  sm  <- fam_ok[fam_ok$tipo == "select_multiple", , drop = FALSE]
  so  <- fam_ok[fam_ok$tipo == "select_one",      , drop = FALSE]
  int <- fam_ok[fam_ok$tipo == "integer",         , drop = FALSE]
  tx  <- fam_ok[fam_ok$tipo == "text",            , drop = FALSE]

  textos_huerfanos <- fam |>
    dplyr::filter(use, tipo == "text", !(text_col_eff %in% text_cols_asignadas)) |>
    dplyr::transmute(
      text_col = text_col_eff,
      parent_sugerido = parent_col,
      hoja_datos = hoja_datos,
      existe_en_datos = mapply(exists_in_tab, text_col_eff, hoja_datos),
      motivo = "No asignada como text_col de ninguna SO/SM con use = TRUE"
    ) |>
    dplyr::arrange(!existe_en_datos, text_col)

  resumen <- tibble::tibble(
    total_filas_excel = nrow(fam),
    aceptadas_total   = nrow(fam_ok),
    aceptadas_sm      = nrow(sm),
    aceptadas_so      = nrow(so),
    aceptadas_int     = nrow(int),
    aceptadas_text    = nrow(tx),
    excluidas         = nrow(fam) - nrow(fam_ok),
    textos_adoptados  = nrow(adopciones),
    textos_huerfanos  = nrow(textos_huerfanos)
  )
  diagnostico_clasificacion <- .codif_add_classification_diagnostics(
    fam = fam,
    acc_sm = acc_sm,
    acc_so = acc_so,
    acc_tx = acc_tx,
    acc_int = acc_int,
    repeat_aware = TRUE
  )

  if (isTRUE(verbose)) {
    cat("\n[Familias-repeat] SO:", nrow(so),
        "| SM:", nrow(sm),
        "| INTEGER:", nrow(int),
        "| TEXT:", nrow(tx),
        "| Total aceptadas:", nrow(fam_ok), "\n")
    if (nrow(textos_huerfanos)) {
      cat("  Huérfanas:\n"); print(utils::head(textos_huerfanos, 100))
    }
    excl_diag <- diagnostico_clasificacion %>% dplyr::filter(.data$estado_clasificacion == "excluida")
    if (nrow(excl_diag)) {
      cat("  Motivos de exclusión:\n")
      print(excl_diag %>% dplyr::count(.data$motivo_clasificacion, sort = TRUE))
    }
  }

  list(
    familias_filtradas    = fam_ok,
    select_multiple       = sm,
    select_one            = so,
    integer               = int,
    text                  = tx,
    familias_enriquecidas = fam_ok %>% dplyr::mutate(
      falta_dummy_sm = (.data$tipo == "select_multiple") & !.data$exists_dummy_col,
      falta_text     = (.data$tipo %in% c("select_multiple","select_one")) & !.data$exists_text_col
    ),
    choices_usadas        = choices_usadas,
    adopciones            = adopciones,
    textos_huerfanos      = textos_huerfanos,
    resumen               = resumen,
    diagnostico_clasificacion = diagnostico_clasificacion
  )
}



# ---------------------------------------------------------------------------
# 5) CONSTRUCTOR DE PLANTILLA
# ---------------------------------------------------------------------------

#' @title Construir plantilla (datos + metas) desde familias validadas (sin normalizar inst)
#' @description
#' Constructor robusto que NO normaliza `inst`. Lee labels en español desde
#' `inst$survey_raw` (columna `label::Spanish (ES)` o variantes) y, en su defecto,
#' desde `inst$survey` (p.ej. `label_spanish_es` o `label`). Soporta como `split`
#' el objeto devuelto por `leer_familias_clasificar()` (recomendado).
#'
#' Incluye:
#' - Orden por `q_order` en navegación y creación de hojas.
#' - Labels correctos (survey y choices).
#' - No crea hojas TEXT que ya tengan padre (excluye text adoptadas).
#' - DICCIONARIO con `variable`, `etiqueta`, `tipo_base`, `list_name`.
#' - CHOICES con `parent_col`, `list_name`, `tipo`, `choice_code`, `choice_label`.
#' - INTEGER integradas como hojas con `_recod` y color morado pastel.
#' - En SM no se genera `Seleccionadas_recod`; fila 2 etiqueta bajo "Seleccionadas".
#'
#' @param inst Lista con `survey`, `survey_raw`, `choices`, `choices_raw`.
#' @param dat  Lista de `leer_datos()` con al menos `raw`.
#' @param split Lista con `select_one`, `select_multiple`, `text` (y opcional `integer`).
#'              Si proviene de `leer_familias_clasificar()`, puede traer `choices_usadas`
#'              y `adopciones`.
#' @return lista con: `diccionario`, `choices`, `familias`, `navegacion`, `sheets`
#' @family codificacion
#' @export
construir_plantilla_desde_familias <- function(inst, dat, split){
  stopifnot(is.list(inst), is.list(dat), is.list(split))

  survey  <- inst$survey  %||% inst$survey_raw
  choices <- inst$choices %||% inst$choices_raw
  if (is.null(survey) || is.null(choices)) rlang::abort("inst debe traer $survey y $choices.")

  # --- DICCIONARIO (metadatos directos del XLSForm) --------------------------
  survey_dic <- inst$survey %||% inst$survey_raw
  if (!"q_order" %in% names(survey_dic) || all(is.na(survey_dic$q_order))) {
    survey_dic$q_order <- seq_len(nrow(survey_dic))
  }
  survey_dic$type_base <- sub("\\s.*$", "", as.character(survey_dic$type %||% ""))
  if (!"list_name" %in% names(survey_dic) || all(is.na(survey_dic$list_name))) {
    survey_dic$list_name <- trimws(sub("^\\S+\\s+","", as.character(survey_dic$type %||% "")))
  }

  diccionario <- tibble::tibble(
    q_order   = as.integer(survey_dic$q_order),
    variable  = as.character(survey_dic$name),
    etiqueta  = s_lab_from_original(survey_dic$name, inst),
    tipo_base = as.character(survey_dic$type_base),
    list_name = as.character(survey_dic$list_name)
  )

  # --- INTEGER desde diccionario si split$integer viene vacío ----------------
  # A partir del diccionario (survey), se construye una tabla mínima de familias
  # para variables integer. Esto permite que, aunque el Excel de familias solo
  # mapee SO/SM + textos, el constructor sí pueda generar hojas para INTEGER.
  integer_dic <- diccionario %>%
    dplyr::filter(
      tipo_base == "integer",              # solo preguntas integer en el XLSForm
      !is.na(variable), nzchar(variable),  # con nombre de variable no vacío
      variable %in% names(dat$raw)         # y que existan en la base de datos
    ) %>%
    dplyr::transmute(
      q_order      = q_order,              # respeta el orden del cuestionario
      parent       = variable,             # nombre original de la pregunta
      parent_col   = variable,             # columna en la base (igual nombre)
      parent_label = etiqueta,             # etiqueta en español
      modo_so      = NA_character_,
      list_name    = NA_character_,        # sin lista de opciones
      list_norm    = NA_character_,        # se completará luego solo si falta
      other_dummy_col = NA_character_,     # no aplica para integer
      text_col        = NA_character_      # no aplica para integer
    )

  # Si el split original NO trae integer (caso típico), se rellena con integer_dic.
  # Si ya viene algo en split$integer desde leer_familias_clasificar(), se respeta.
  if (is.null(split$integer) || !nrow(split$integer)) {
    split$integer <- integer_dic
  }

  # --- FAMILIAS (apilan split) -----------------------------------------------
  fam_all <- dplyr::bind_rows(
    (split$select_one      %||% tibble::tibble()) %>% dplyr::mutate(tipo = "select_one"),
    (split$select_multiple %||% tibble::tibble()) %>% dplyr::mutate(tipo = "select_multiple"),
    (split$text            %||% tibble::tibble()) %>% dplyr::mutate(tipo = "text"),
    (split$integer         %||% tibble::tibble()) %>% dplyr::mutate(tipo = "integer")
  )

  for (cc in c("parent","parent_label","modo_so","list_name","list_norm",
               "parent_col","other_dummy_col","text_col","tipo")) {
    if (!cc %in% names(fam_all)) fam_all[[cc]] <- ""
    fam_all[[cc]] <- trimws(as.character(fam_all[[cc]]))
    fam_all[[cc]][is.na(fam_all[[cc]])] <- ""
  }

  if (!nrow(fam_all)) {
    return(list(diccionario=diccionario, choices=tibble::tibble(),
                familias=tibble::tibble(), navegacion=tibble::tibble(), sheets=list()))
  }

  # columnas mínimas
  for (k in c("q_order","modo_so","list_name","list_norm","parent_label","parent",
              "parent_col","other_dummy_col","text_col")) {
    if (!k %in% names(fam_all)) fam_all[[k]] <- NA
  }

  # parent limpio (para cruce)
  fam_all$parent_clean <- janitor::make_clean_names(
    ifelse(!is.na(fam_all$parent) & nzchar(fam_all$parent), fam_all$parent, fam_all$parent_col)
  )

  # completar parent_label desde inst si falta
  missing_pl <- is.na(fam_all$parent_label) | !nzchar(fam_all$parent_label)
  if (any(missing_pl)) {
    pref <- ifelse(!is.na(fam_all$parent) & nzchar(fam_all$parent), fam_all$parent, fam_all$parent_col)
    fam_all$parent_label[missing_pl] <- s_lab_from_original(pref[missing_pl], inst)
  }

  # completar list_name / list_norm desde diccionario si faltan
  if (any(is.na(fam_all$list_name) | !nzchar(fam_all$list_name))) {
    j <- match(fam_all$parent_clean, janitor::make_clean_names(diccionario$variable))
    fam_all$list_name <- dplyr::coalesce(as.character(fam_all$list_name), as.character(diccionario$list_name[j]))
  }
  # completar list_name / list_norm desde diccionario si faltan ----------------
  if (any(is.na(fam_all$list_name) | !nzchar(fam_all$list_name))) {
    j <- match(fam_all$parent_clean, janitor::make_clean_names(diccionario$variable))
    fam_all$list_name <- dplyr::coalesce(
      as.character(fam_all$list_name),
      as.character(diccionario$list_name[j])
    )
  }

  # IMPORTANTE: solo generar list_norm para las filas que lo tienen vacío.
  # No se toca list_norm cuando ya viene definido desde leer_familias_clasificar()
  # (p.ej. 'apoyo', 'obstaculo', 'necesidad_empleo'), para no romper el cruce
  # con choices_es_tbl(inst).
  if (any(is.na(fam_all$list_norm) | !nzchar(fam_all$list_norm))) {
    idx_missing <- which(is.na(fam_all$list_norm) | !nzchar(fam_all$list_norm))
    fam_all$list_norm[idx_missing] <- tolower(
      gsub("[^a-z0-9_]", "_",
           gsub("\\s+","_", as.character(fam_all$list_name[idx_missing]))
      )
    )
  }

  # excluir TEXT adoptadas
  .safe_text_col <- function(x){
    if (is.null(x) || !("text_col" %in% names(x))) return(NULL)
    x[["text_col"]]
  }
  assigned_texts <- unique(na.omit(c(
    .safe_text_col(split$adopciones),
    .safe_text_col(split$select_one),
    .safe_text_col(split$select_multiple)
  )))
  fam_all <- fam_all %>%
    dplyr::filter(!(tipo == "text" & !is.na(text_col) & nzchar(text_col) & text_col %in% assigned_texts))

  # familias (para auditoría/export)
  familias_tbl <- fam_all %>%
    dplyr::select(
      tipo, modo_so, parent = parent_clean, parent_label, q_order,
      list_name, list_norm, parent_col, other_dummy_col, text_col
    )

  # --- CHOICES ES canónicas desde inst (fuente de verdad) --------------------
  # choices_es_tbl(inst) -> list_norm, list_name, code, label_es
  choices_es <- choices_es_tbl(inst) %>%
    dplyr::mutate(
      label_es = dplyr::coalesce(.data$label_es, .data$code)
    ) %>%
    dplyr::select(list_norm, list_name, code, label_es)

  # Catálogo de choices por familia SO/SM
  make_choices_tbl <- function(fam_tbl){
    fam_so_sm <- fam_tbl %>%
      dplyr::filter(.data$tipo %in% c("select_one","select_multiple"),
                    !is.na(list_norm) & nzchar(list_norm)) %>%
      dplyr::distinct(parent_col, list_norm, tipo)

    # Si vienen choices_usadas, úsalo sólo como filtro (no para labels)
    if (!is.null(split$choices_usadas) && nrow(split$choices_usadas)) {
      allowed <- split$choices_usadas %>%
        dplyr::select(list_norm, code) %>% dplyr::distinct()
      choices_es_use <- dplyr::inner_join(choices_es, allowed, by = c("list_norm","code"))
    } else {
      choices_es_use <- choices_es
    }

    # mapear list_name por list_norm sin crear .x/.y
    map_ln <- choices_es %>% dplyr::distinct(list_norm, list_name)
    fam_so_sm %>%
      dplyr::mutate(
        variable_base  = janitor::make_clean_names(parent_col),
        variable_label = s_lab_from_original(parent_col, inst)
      ) %>%
      # completar list_name vía vectorizado (sin join con sufijos)
      dplyr::mutate(
        variable_base  = janitor::make_clean_names(parent_col),
        variable_label = s_lab_from_original(parent_col, inst),
        list_name      = map_ln$list_name[match(list_norm, map_ln$list_norm)]
      ) %>%
      # expandir a todas las opciones de esa lista
      dplyr::left_join(
        choices_es_use %>% dplyr::transmute(
          list_norm, choice_code = code, choice_label = label_es
        ),
        by = "list_norm"
      ) %>%
      dplyr::mutate(choice_label = dplyr::coalesce(choice_label, choice_code)) %>%
      dplyr::select(parent_col, variable_base, variable_label,
                    tipo, list_name, list_norm, choice_code, choice_label)
  }

  choices_tbl <- make_choices_tbl(familias_tbl)
  choices_by_parent <- split(choices_tbl, choices_tbl$parent_col)
  label_map <- .codif_label_map(inst)

  # --- IDs base --------------------------------------------------------------
  resolve_ids <- function(dat_raw){
    n <- NROW(dat_raw)             # ← tolerante a NULL (da 0)
    as_chr <- function(x){
      if (is.null(x)) return(rep(NA_character_, n))
      if (is.factor(x)) x <- as.character(x)
      as.character(x)
    }
    as_int <- function(x){
      if (is.null(x)) return(rep(NA_integer_, n))
      suppressWarnings(as.integer(x))
    }
    uuid_out <- Reduce(dplyr::coalesce, lapply(list(
      if (!is.null(dat_raw)) dat_raw[["_uuid"]] else NULL,
      if (!is.null(dat_raw)) dat_raw[["uuid"]] else NULL,
      if (!is.null(dat_raw)) dat_raw[["meta_instance_id"]] else NULL,
      if (!is.null(dat_raw)) dat_raw[["instanceid"]] else NULL,
      if (!is.null(dat_raw)) dat_raw[["_id"]] else NULL
    ), as_chr))
    idx_out  <- as_int(if (!is.null(dat_raw)) dat_raw[["_index"]] else NULL)
    pulso_out<- Reduce(dplyr::coalesce, lapply(list(
      if (!is.null(dat_raw)) dat_raw[["mand_location_details_pulso_code"]] else NULL,
      if (!is.null(dat_raw)) dat_raw[["Pulso_code"]] else NULL,
      if (!is.null(dat_raw)) dat_raw[["pulso_code"]] else NULL
    ), as_chr))
    tibble::tibble(`_uuid` = uuid_out, `_index` = idx_out, `Código pulso` = pulso_out)
  }
  dat_raw <- dat$raw
  id_base <- resolve_ids(dat_raw)

  # --- expandir dummies SM ---------------------------------------------------
  expand_sm_dummies <- function(dat_raw, parent_col, opts){
    n <- nrow(dat_raw)
    out <- matrix(NA_integer_, nrow=n, ncol=nrow(opts))
    colnames(out) <- opts$choice_code
    # slash
    for (j in seq_len(nrow(opts))){
      slash <- paste0(parent_col, "/", opts$choice_code[j])
      if (slash %in% names(dat_raw)) {
        v <- dat_raw[[slash]]
        vv <- suppressWarnings(as.integer(as.character(v)))
        if (all(is.na(vv))){
          vv <- ifelse(tolower(as.character(v)) %in% c("true","t","1"), 1L,
                       ifelse(tolower(as.character(v)) %in% c("false","f","0"), 0L, NA_integer_))
        }
        out[, j] <- vv
      }
    }
    # tokens
    miss <- which(apply(out, 2, function(z) all(is.na(z))))
    if (length(miss) && parent_col %in% names(dat_raw)){
      toks <- strsplit(ifelse(is.na(dat_raw[[parent_col]]), "", as.character(dat_raw[[parent_col]])), "\\s+")
      for (j in miss){
        code <- opts$choice_code[j]
        out[, j] <- vapply(toks, function(tt) as.integer(code %in% tt), integer(1))
      }
    }
    tibble::as_tibble(out)
  }

  # ---------- orden de creación por q_order ----------------------------------
  qord_by_var <- diccionario %>% dplyr::transmute(var = variable, q_order)
  ord_val <- function(x){
    v <- janitor::make_clean_names(x)
    qord_by_var$q_order[match(v, janitor::make_clean_names(qord_by_var$var))]
  }

  sel1 <- (split$select_one %||% tibble::tibble())
  if (nrow(sel1)) sel1 <- sel1 %>% dplyr::mutate(.ord = ord_val(parent_col)) %>%
    dplyr::arrange(.ord, parent_col) %>% dplyr::select(-.ord)
  selm <- (split$select_multiple %||% tibble::tibble())
  if (nrow(selm)) selm <- selm %>% dplyr::mutate(.ord = ord_val(parent_col)) %>%
    dplyr::arrange(.ord, parent_col) %>% dplyr::select(-.ord)
  sint <- (split$integer %||% tibble::tibble())
  if (nrow(sint)) sint <- sint %>% dplyr::mutate(.ord = ord_val(parent_col %||% parent)) %>%
    dplyr::arrange(.ord, dplyr::coalesce(parent_col, parent)) %>% dplyr::select(-.ord)
  stxt <- (split$text %||% tibble::tibble())
  if (nrow(stxt)) {
    stxt <- stxt %>% dplyr::mutate(.ord = ord_val(parent_col)) %>%
      dplyr::arrange(.ord, parent_col) %>% dplyr::select(-.ord)
  }

  sheets_list <- list(); nav_rows <- list()

  # ---------- SELECT ONE ----------
  if (!is.null(sel1) && nrow(sel1)){
    for (i in seq_len(nrow(sel1))){
      row <- sel1[i, ]
      parent_col <- row$parent_col
      tipo <- "select_one"

      opts <- choices_by_parent[[parent_col]] %||% tibble::tibble(choice_code = character(), choice_label = character())
      opts <- opts %>%
        dplyr::distinct(choice_code, choice_label) %>%
        dplyr::transmute(code = .data$choice_code, label = .data$choice_label)

      base <- .codif_build_select_one_sheet(
        dat_raw = dat_raw,
        id_base = id_base,
        row = row,
        opts = opts,
        inst = inst,
        label_pref = row$parent_label,
        label_map = label_map
      )
      if (is.null(base)) next

      stitle <- parent_col
      sheets_list[[stitle]] <- base
      nav_rows[[length(nav_rows)+1]] <- tibble::tibble(hoja = stitle, tipo = tipo, n = nrow(base))
    }
  }

  # ---------- SELECT MULTIPLE ----------
  if (!is.null(selm) && nrow(selm)){
    for (i in seq_len(nrow(selm))){
      row <- selm[i, ]
      parent_col      <- row$parent_col
      other_dummy_col <- row$other_dummy_col
      text_col        <- row$text_col
      tipo            <- "select_multiple"

      opts_fast <- choices_by_parent[[parent_col]] %||% tibble::tibble(choice_code = character(), choice_label = character())
      opts_fast <- opts_fast %>%
        dplyr::distinct(choice_code, choice_label) %>%
        dplyr::transmute(code = .data$choice_code, label = .data$choice_label)

      base_fast <- .codif_build_select_multiple_sheet(
        dat_raw = dat_raw,
        id_base = id_base,
        row = row,
        opts = opts_fast,
        inst = inst,
        label_pref = row$parent_label,
        label_map = label_map
      )
      if (is.null(base_fast)) next

      stitle <- parent_col
      sheets_list[[stitle]] <- base_fast
      nav_rows[[length(nav_rows)+1]] <- tibble::tibble(
        hoja = stitle, tipo = tipo, n = nrow(base_fast)
      )
      next

      # Opciones canónicas: código + label (fuente de verdad)
      opts <- choices_tbl %>%
        dplyr::filter(parent_col == !!parent_col) %>%
        dplyr::distinct(choice_code, choice_label) %>%
        dplyr::mutate(
          choice_code  = as.character(choice_code),
          choice_label = as.character(choice_label)
        )

      # Matriz de dummies SM a partir de la base:
      # - columnas iniciales generadas por código (via expand_sm_dummies)
      # - si no hay opciones, tibble vacío con n filas
      dmm <- if (nrow(opts)) {
        expand_sm_dummies(dat_raw, parent_col, opts)
      } else {
        tibble::tibble(.rows = nrow(dat_raw))
      }

      # Si hay opciones y dmm tiene columnas, renombrar por LABEL:
      #   "1" -> "Falta de información...", etc.
      if (nrow(opts) && ncol(dmm)) {
        lab <- as.character(opts$choice_label)
        lab[is.na(lab) | !nzchar(lab)] <- as.character(opts$choice_code[is.na(lab) | !nzchar(lab)])
        names(dmm) <- lab
      }

      # Mantendremos aquí el label correspondiente a la opción OTHER, si existe
      other_label <- NA_character_

      # --- Dummy de "other": solo si FAMILIAS trae una columna dummy ---------
      # FAMILIAS ya define cuál es la dummy (other_dummy_col) y cuál es el texto (text_col).
      # Aquí:
      #   - NO inventamos dummies a partir del texto.
      #   - Si existe other_dummy_col en la base, se usa ESA columna como fuente.
      if (!is.na(other_dummy_col) && nzchar(other_dummy_col) &&
          other_dummy_col %in% names(dat_raw) &&
          nrow(opts) && ncol(dmm)) {

        other_dummy <- dat_raw[[other_dummy_col]]

        # Normalizar a 0/1 desde 0/1 o TRUE/FALSE
        other01 <- suppressWarnings(as.integer(as.character(other_dummy)))
        if (all(is.na(other01))) {
          other01 <- ifelse(
            tolower(as.character(other_dummy)) %in% c("true","t","1"), 1L,
            ifelse(tolower(as.character(other_dummy)) %in% c("false","f","0"), 0L, NA_integer_)
          )
        }

        # Código y label asociados a esa dummy.
        # Ejemplo: other_dummy_col = "necesidad_empleo/96" → other_code = "96"
        other_code  <- sub("^.+/", "", other_dummy_col)
        other_label <- opts$choice_label[match(other_code, opts$choice_code)]
        if (is.na(other_label) || !nzchar(other_label)) {
          # Fallback: si no hubiera label, usar el propio código
          other_label <- other_code
        }

        # Si dmm ya tiene esa columna (por label), se sobreescribe; si no, se agrega.
        if (other_label %in% names(dmm)) {
          dmm[[other_label]] <- other01
        } else {
          dmm[[other_label]] <- other01
        }

        # Reordenar columnas para que la opción OTHER quede al final de las dummies
        ord_labels <- as.character(opts$choice_label)
        ord_labels[is.na(ord_labels) | !nzchar(ord_labels)] <-
          as.character(opts$choice_code[is.na(ord_labels) | !nzchar(ord_labels)])
        ord_labels <- intersect(ord_labels, names(dmm))

        if (other_label %in% ord_labels) {
          ord_labels <- c(setdiff(ord_labels, other_label), other_label)
          dmm <- dmm[, ord_labels, drop = FALSE]
        }
      }

      # Vector de nombres de columnas dummy
      nm <- names(dmm)
      nm <- nm[!is.na(nm) & nzchar(nm)]

      # Conjunto de columnas a usar para Seleccionadas (incluye OTHER cuando está activa)
      selected_cols <- nm

      # Lookup label -> código (para Seleccionadas_cod)
      lab2code <- opts$choice_code
      names(lab2code) <- opts$choice_label
      names(lab2code)[is.na(names(lab2code)) | !nzchar(names(lab2code))] <-
        opts$choice_code[is.na(opts$choice_label) | !nzchar(opts$choice_label)]

      # Seleccionadas (labels)
      sel_labels <- if (length(selected_cols) && nrow(opts)) {
        apply(dmm[, selected_cols, drop = FALSE], 1, function(r){
          idx <- which(r == 1L)
          if (!length(idx)) return("")
          labs <- names(r)[idx]  # ya son labels
          paste(labs, collapse = "; ")
        })
      } else {
        rep("", nrow(dat_raw))
      }

      # Seleccionadas_cod (códigos crudos)
      sel_codes <- if (length(selected_cols) && nrow(opts)) {
        apply(dmm[, selected_cols, drop = FALSE], 1, function(r){
          idx <- which(r == 1L)
          if (!length(idx)) return("")
          labs  <- names(r)[idx]
          codes <- lab2code[labs]
          codes[is.na(codes) | !nzchar(codes)] <- labs[is.na(codes) | !nzchar(codes)]
          paste(codes, collapse = "; ")
        })
      } else {
        rep("", nrow(dat_raw))
      }

      # Texto abierto (columna de texto definida por FAMILIAS)
      text_vec <- if (!is.na(text_col) && nzchar(text_col) &&
                      text_col %in% names(dat_raw)) {
        as.character(dat_raw[[text_col]])
      } else {
        NA_character_
      }

      # Construir base: IDs + Seleccionadas + dummies + texto
      base <- id_base %>%
        dplyr::mutate(
          Seleccionadas     = sel_labels,
          Seleccionadas_cod = sel_codes
        ) %>%
        dplyr::bind_cols(dmm) %>%
        dplyr::mutate(!!text_col := text_vec)

      # Recods intercalados:
      #   - NO se recodifica: _uuid, _index, Código pulso
      #   - NO se recodifica: Seleccionadas, Seleccionadas_cod
      #   - NO se recodifica: el texto abierto (text_col)
      skip_cols <- c("_uuid","_index","Código pulso",
                     "Seleccionadas","Seleccionadas_cod",
                     text_col)
      skip_cols <- unique(skip_cols[!is.na(skip_cols) & nzchar(skip_cols)])

      for (dc in setdiff(names(base), skip_cols)) {
        base[[paste0(dc,"_recod")]] <- NA_character_
      }
      base[["Control"]] <- NA_character_

      # Reordenar: base + su _recod al costado
      cn        <- colnames(base)
      base_cols <- cn[!grepl("_recod$", cn)]
      rec_cols  <- cn[grepl("_recod$",  cn)]
      order_cols <- c()
      for (b in base_cols){
        order_cols <- c(order_cols, b)
        r <- paste0(b,"_recod")
        if (r %in% rec_cols) order_cols <- c(order_cols, r)
      }
      orphan_rec <- setdiff(rec_cols, paste0(base_cols, "_recod"))
      base <- base[, unique(c(order_cols, orphan_rec)), drop = FALSE]

      # ---------- encabezados (fila 1 crudo / fila 2 labels) -----------------
      hdr_raw <- names(base)
      hdr_lab <- hdr_raw

      # Etiquetas fijas
      hdr_lab[hdr_raw == "_uuid"]        <- "UUID"
      hdr_lab[hdr_raw == "_index"]       <- "Índice"
      hdr_lab[hdr_raw == "Código pulso"] <- "Código pulso"
      hdr_lab[hdr_raw == "Seleccionadas"]     <- s_lab_from_original(parent_col, inst)
      hdr_lab[hdr_raw == "Seleccionadas_cod"] <- "Seleccionadas (código)"
      if (!is.na(text_col) && nzchar(text_col)) {
        hdr_lab[hdr_raw == text_col] <- s_lab_from_original(text_col, inst)
      }
      hdr_lab[grepl("_recod$", hdr_raw)] <- "Recodificación"

      # Etiquetas para las columnas de dummies (labels ya vienen de opts)
      # Aquí no necesitamos tocar nada extra: dmm ya tiene nombres = labels.

      stitle <- parent_col
      sheets_list[[stitle]] <- structure(
        base,
        header_raw = hdr_raw,
        label_row  = hdr_lab,
        tipo       = tipo
      )
      nav_rows[[length(nav_rows)+1]] <- tibble::tibble(
        hoja = stitle, tipo = tipo, n = nrow(base)
      )
    }
  }




  # ---------- INTEGER ----------
  if (!is.null(sint) && nrow(sint)){
    for (i in seq_len(nrow(sint))){
      row <- sint[i, ]
      base <- .codif_build_integer_sheet(
        dat_raw = dat_raw,
        id_base = id_base,
        row = row,
        inst = inst,
        label_map = label_map
      )
      if (is.null(base)) next

      stitle <- if (!is.null(row$parent_col) && nzchar(row$parent_col)) as.character(row$parent_col) else as.character(row$parent)
      sheets_list[[stitle]] <- base
      nav_rows[[length(nav_rows)+1]] <- tibble::tibble(hoja = stitle, tipo = "integer", n = nrow(base))
    }
  }

  # ---------- TEXT (huérfanas) -----------------------------------------------
  if (!is.null(stxt) && nrow(stxt)){
    for (i in seq_len(nrow(stxt))){
      row <- stxt[i, ]
      txt_col <- row$parent_col
      tipo <- "text"
      if (!(txt_col %in% names(dat$raw))) next
      if (txt_col %in% assigned_texts) next

      txt <- as.character(dat$raw[[txt_col]])
      base <- id_base %>%
        dplyr::mutate(!!txt_col := txt)
      base[[paste0(txt_col,"_recod")]] <- NA_character_
      base[["Control"]] <- NA_character_

      cn <- colnames(base)
      base <- base[, c(cn[!grepl("_recod$", cn)], cn[grepl("_recod$", cn)]), drop = FALSE]

      hdr_raw <- names(base); hdr_lab <- hdr_raw
      hdr_lab[hdr_raw=="_uuid"]            <- "UUID"
      hdr_lab[hdr_raw=="_index"]           <- "Índice"
      hdr_lab[hdr_raw=="Código pulso"]     <- "Código pulso"
      hdr_lab[hdr_raw==txt_col]            <- s_lab_from_original(txt_col, inst)
      hdr_lab[grepl("_recod$", hdr_raw)]   <- "Recodificación"

      attr(base, "header_raw") <- hdr_raw
      attr(base, "label_row") <- hdr_lab
      attr(base, "tipo") <- tipo
      attr(base, "layout_version") <- "recod_v2"
      attr(base, "aux_block") <- .codif_make_aux_block(
        tipo = "text",
        target_col = paste0(txt_col, "_recod"),
        sheet_name = txt_col
      )
      stitle <- txt_col
      sheets_list[[stitle]] <- base
      nav_rows[[length(nav_rows)+1]] <- tibble::tibble(hoja = stitle, tipo = tipo, n = nrow(base))
    }
  }

  # ---------- NAVEGACIÓN -----------------------------------------------------
  nav_df <- dplyr::bind_rows(nav_rows)
  dic2 <- diccionario %>% dplyr::mutate(variable_raw = survey_dic$name)
  nav_df <- nav_df %>%
    dplyr::left_join(dic2 %>% dplyr::select(variable, variable_raw, q_order),
                     by = c("hoja" = "variable")) %>%
    dplyr::mutate(q_order = dplyr::coalesce(q_order,
                                            dic2$q_order[match(hoja, dic2$variable_raw)])) %>%
    dplyr::arrange(q_order,
                   factor(tipo, levels=c("select_one","select_multiple","integer","text")),
                   hoja)

  list(
    diccionario = diccionario,
    choices     = choices_tbl,
    familias    = familias_tbl,
    navegacion  = nav_df %>% dplyr::select(hoja, tipo, n),
    sheets      = sheets_list
  )
}


# ------ 6) Exportador a Excel con formato -----------------------------------


`%||%` <- function(x, y) if (is.null(x) || (length(x) == 1 && is.na(x))) y else x

safe_sheet_name <- function(x, used = character(0)) {
  x <- as.character(x %||% "Hoja")
  x <- trimws(x)
  x <- gsub("[\\[\\]\\*\\:\\?/\\\\]", "_", x)
  x <- gsub("^'+|'+$", "", x)
  if (!nzchar(x)) x <- "Hoja"
  if (nchar(x) > 31) x <- substr(x, 1, 31)
  base <- x; k <- 1L
  while (x %in% used) {
    suf <- paste0(" (", k, ")")
    maxlen <- 31 - nchar(suf)
    x <- paste0(substr(base, 1, maxlen), suf)
    k <- k + 1L
  }
  x
}

# Paleta por tipo (incluye integer morado)
tipo_hex <- function(tipo) {
  t <- tolower(as.character(tipo %||% ""))
  if (t == "select_multiple") return("#E2F0D9") # verde suave
  if (t == "select_one")      return("#D9E1F2") # azul suave
  if (t == "text")            return("#FFF2CC") # amarillo suave
  if (t == "integer")         return("#E6D9F2") # morado pastel
  "#EEEEEE"
}

.set_widths_smart <- function(wb, sheet, ncols, nrows) {
  if (isTRUE(nrows > 2000L || ncols > 60L)) {
    openxlsx::setColWidths(wb, sheet, cols = 1:ncols, widths = 12)
  } else {
    openxlsx::setColWidths(wb, sheet, cols = 1:ncols, widths = "auto")
  }
}

width_for <- function(ncols){
  if (is.na(ncols) || ncols <= 0) return(18)
  if (ncols <= 20) return("auto")
  if (ncols <= 60) return(22)
  18
}

#' Exportar plantilla a Excel con formato (dos filas de encabezado)
#'
#' - Colorea por tipo en NAVEGACION, FAMILIAS, DICCIONARIO y CHOICES
#'   (incluye morado para integer).
#' - Las hojas de variables tienen fila 1 (código/crudo) y fila 2 (labels),
#'   sin `Seleccionadas_recod` en SM.
#' - Las hojas `select_multiple` agregan a la derecha un bloque de ejemplo
#'   para mostrar cómo declarar una opción nueva sin mezclarlo con la tabla
#'   editable.
#' - Agrega una hoja `INSTRUCCIONES` y resalta visualmente las columnas
#'   editables (`*_recod`) y `Control`.
#' - Colorea las pestañas de las hojas por tipo para distinguir rápidamente
#'   `select_multiple`, `select_one`, `text` e `integer`.
#'
#' @param plantilla lista de `construir_plantilla_desde_familias()`
#' @param path_xlsx ruta de salida (default "PPRA_Plantilla_Codificacion.xlsx")
#' @param inst (opcional) objeto instrumento (con survey_raw y choices_raw) para
#'             reforzar labels en DICCIONARIO si aplica.
#' @param autofiltro TRUE para habilitar AutoFilter en fila 2
#' @param congelar_encabezado TRUE para freeze pane (fila 3)
#' @family codificacion
#' @export
exportar_plantilla_codificacion_xlsx <- function(plantilla,
                                                 path_xlsx = "PPRA_Plantilla_Codificacion.xlsx",
                                                 inst = NULL,
                                                 autofiltro = TRUE,
                                                 congelar_encabezado = TRUE){
  stopifnot(is.list(plantilla),
            all(c("diccionario","choices","familias","navegacion","sheets") %in% names(plantilla)))

  wb <- openxlsx::createWorkbook()
  used <- character(0)
  add_sheet <- function(title, tab_colour = NULL){
    nm <- safe_sheet_name(title, used); used <<- c(used, nm)
    openxlsx::addWorksheet(wb, nm, tabColour = tab_colour); nm
  }

  # Estilos
  style_hdr1 <- openxlsx::createStyle(textDecoration = "bold", halign = "center", valign = "center",
                                      border = "TopBottomLeftRight")
  style_hdr2 <- openxlsx::createStyle(textDecoration = "italic", wrapText = TRUE, halign = "center", valign = "center",
                                      border = "TopBottomLeftRight")
  style_instr_title <- openxlsx::createStyle(textDecoration = "bold", fontSize = 13,
                                             halign = "left", valign = "center")
  style_instr_text <- openxlsx::createStyle(wrapText = TRUE, valign = "top")
  style_instr_table <- openxlsx::createStyle(border = "TopBottomLeftRight", borderColour = "black",
                                             wrapText = TRUE, valign = "top")
  fill_tipo <- function(hex) openxlsx::createStyle(fgFill = hex)
  wrap_left <- openxlsx::createStyle(wrapText = TRUE, halign = "left", valign = "top")
  border_all_black <- openxlsx::createStyle(border = "TopBottomLeftRight", borderColour = "black")
  style_ref_hdr <- openxlsx::createStyle(fgFill = "#EDEFF2")
  style_ref_body <- openxlsx::createStyle(fgFill = "#F7F7F8")
  style_id_hdr <- openxlsx::createStyle(fgFill = "#DDE3EA")
  style_id_body <- openxlsx::createStyle(fgFill = "#EFF3F7")
  style_edit_hdr <- openxlsx::createStyle(fgFill = "#C6EFCE")
  style_edit_body <- openxlsx::createStyle(fgFill = "#EAF7E6")
  style_control_hdr <- openxlsx::createStyle(fgFill = "#FCE4D6")
  style_control_body <- openxlsx::createStyle(fgFill = "#FFF2E8")
  style_aux_hdr <- openxlsx::createStyle(fgFill = "#F4CCCC")
  style_aux_body <- openxlsx::createStyle(fgFill = "#FCE5CD")
  style_aux_sep <- openxlsx::createStyle(fgFill = "#FFFFFF")
  style_example_hdr <- openxlsx::createStyle(fgFill = "#D9EAD3")
  style_example_body <- openxlsx::createStyle(fgFill = "#F3F9F1")

  # ===== 0) INSTRUCCIONES =====
  st_instr <- add_sheet("INSTRUCCIONES", tab_colour = "#FCE4D6")
  instr_intro <- data.frame(
    texto = c(
      "Como editar esta plantilla de recodificacion",
      "1. No modifique la fila 1 ni la fila 2: la fila 1 es tecnica y la usa el paquete.",
      "2. Edite solo las columnas *_recod y Control / notas.",
      "3. En hojas select_multiple, use 1 para marcar, 0 para desmarcar y deje vacio si no desea cambiar.",
      "4. En hojas select_one, text e integer, escriba la nueva recodificacion en la unica columna *_recod visible o deje vacio si no desea cambiar.",
      "5. Para crear una opcion nueva en select_multiple, agregue una columna con fila 1 = <parent>/<nuevo_codigo>_recod y fila 2 = etiqueta visible.",
      "6. En select_multiple, la columna nueva puede quedar antes o despues de Control / notas; el adaptador la reconoce por el nombre tecnico.",
      "7. Las hojas select_multiple incluyen a la derecha una columna reservada de ejemplo (<parent>/ejemplo_recod); sirve de referencia y el adaptador la ignora.",
      "8. En hojas select_one e integer, las categorias nuevas se declaran en el bloque auxiliar de la derecha, con dos columnas: nuevo_codigo y nueva_etiqueta.",
      "9. En select_one modo padre, la columna editable recodifica la variable original; en modo hijo, la columna editable recodifica el texto abierto.",
      "10. Las columnas _uuid, _index, Codigo pulso, Seleccionadas, Seleccionadas_cod, *_label y valores crudos son solo referencia."
    ),
    stringsAsFactors = FALSE
  )
  instr_table <- data.frame(
    elemento = c("*_recod", "Control / notas", "Fila 1", "Fila 2", "Columnas crudas y *_label"),
    uso = c(
      "Campo editable de recodificacion. Complete solo si desea aplicar un cambio.",
      "Campo opcional para observaciones, validacion o notas de revision.",
      "Nombre tecnico que usa el paquete. No editar.",
      "Etiqueta humana para orientar la edicion. No editar.",
      "Valores originales para consulta. No editar."
    ),
    se_edita = c("Si", "Si", "No", "No", "No"),
    stringsAsFactors = FALSE
  )
  instr_sm <- data.frame(
    paso = c("Insertar columna", "Fila 1", "Fila 2", "Filas de datos"),
    detalle = c(
      "En una hoja select_multiple, agregue la nueva columna donde le resulte mas comodo; no tiene que ir obligatoriamente antes de Control / notas.",
      "Use exactamente el patron <parent>/<nuevo_codigo>_recod. Ejemplo: p8/99_recod.",
      "Escriba la etiqueta visible de la nueva opcion. Ejemplo: Otro servicio comunitario.",
      "Use 1 para marcar la nueva opcion, 0 para desmarcar y deje vacio si no desea cambiar ese caso. La columna <parent>/ejemplo_recod es solo referencia."
    ),
    stringsAsFactors = FALSE
  )
  instr_so <- data.frame(
    paso = c("Modo", "Codigo final", "Bloque auxiliar", "Validacion"),
    detalle = c(
      "Cada hoja select_one usa un unico modo: modo padre o modo hijo. El modo aparece en el bloque auxiliar de la derecha.",
      "Complete la unica columna *_recod visible con el codigo final. Ejemplo: 3.",
      "Declare la etiqueta del codigo nuevo una sola vez en las columnas nuevo_codigo y nueva_etiqueta del bloque auxiliar.",
      "Si un codigo nuevo no tiene etiqueta o aparece con dos etiquetas distintas, el adaptador devolvera un error claro."
    ),
    stringsAsFactors = FALSE
  )
  instr_int <- data.frame(
    paso = c("Codigo final", "Bloque auxiliar", "Lista compartida"),
    detalle = c(
      "En hojas integer, complete <var>_recod con el codigo final.",
      "Declare cada codigo nuevo una sola vez en nuevo_codigo y nueva_etiqueta.",
      "Si dos variables integer usan exactamente el mismo diccionario, el instrumento recodificado compartira la misma lista."
    ),
    stringsAsFactors = FALSE
  )
  openxlsx::writeData(wb, st_instr, x = instr_intro[1, , drop = FALSE], startRow = 1, colNames = FALSE)
  openxlsx::writeData(wb, st_instr, x = instr_intro[-1, , drop = FALSE], startRow = 3, colNames = FALSE)
  openxlsx::writeData(wb, st_instr, x = instr_table, startRow = 10, colNames = TRUE)
  openxlsx::writeData(wb, st_instr, x = data.frame(texto = "Como agregar una opcion nueva en select_multiple", stringsAsFactors = FALSE), startRow = 18, colNames = FALSE)
  openxlsx::writeData(wb, st_instr, x = instr_sm, startRow = 20, colNames = TRUE)
  openxlsx::writeData(wb, st_instr, x = data.frame(texto = "Como declarar una categoria nueva en select_one", stringsAsFactors = FALSE), startRow = 27, colNames = FALSE)
  openxlsx::writeData(wb, st_instr, x = instr_so, startRow = 29, colNames = TRUE)
  openxlsx::writeData(wb, st_instr, x = data.frame(texto = "Como declarar una categoria nueva en integer", stringsAsFactors = FALSE), startRow = 35, colNames = FALSE)
  openxlsx::writeData(wb, st_instr, x = instr_int, startRow = 37, colNames = TRUE)
  openxlsx::addStyle(wb, st_instr, style_instr_title, rows = 1, cols = 1, gridExpand = TRUE)
  openxlsx::addStyle(wb, st_instr, style_instr_text, rows = 3:10, cols = 1, gridExpand = TRUE, stack = TRUE)
  openxlsx::addStyle(wb, st_instr, style_hdr1, rows = 10, cols = 1:ncol(instr_table), gridExpand = TRUE, stack = TRUE)
  openxlsx::addStyle(wb, st_instr, style_instr_table,
                     rows = 10:(nrow(instr_table) + 10), cols = 1:ncol(instr_table),
                     gridExpand = TRUE, stack = TRUE)
  openxlsx::addStyle(wb, st_instr, style_instr_title, rows = 18, cols = 1, gridExpand = TRUE)
  openxlsx::addStyle(wb, st_instr, style_hdr1, rows = 20, cols = 1:ncol(instr_sm), gridExpand = TRUE, stack = TRUE)
  openxlsx::addStyle(wb, st_instr, style_instr_table,
                     rows = 20:(nrow(instr_sm) + 20), cols = 1:ncol(instr_sm),
                     gridExpand = TRUE, stack = TRUE)
  openxlsx::addStyle(wb, st_instr, style_instr_title, rows = 27, cols = 1, gridExpand = TRUE)
  openxlsx::addStyle(wb, st_instr, style_hdr1, rows = 29, cols = 1:ncol(instr_so), gridExpand = TRUE, stack = TRUE)
  openxlsx::addStyle(wb, st_instr, style_instr_table,
                     rows = 29:(nrow(instr_so) + 29), cols = 1:ncol(instr_so),
                     gridExpand = TRUE, stack = TRUE)
  openxlsx::addStyle(wb, st_instr, style_instr_title, rows = 35, cols = 1, gridExpand = TRUE)
  openxlsx::addStyle(wb, st_instr, style_hdr1, rows = 37, cols = 1:ncol(instr_int), gridExpand = TRUE, stack = TRUE)
  openxlsx::addStyle(wb, st_instr, style_instr_table,
                     rows = 37:(nrow(instr_int) + 37), cols = 1:ncol(instr_int),
                     gridExpand = TRUE, stack = TRUE)
  openxlsx::setColWidths(wb, st_instr, cols = 1, widths = 110)
  openxlsx::setColWidths(wb, st_instr, cols = 2:3, widths = 28)
  openxlsx::freezePane(wb, st_instr, firstActiveRow = 10)

  # ===== 1) NAVEGACION =====
  st_nav <- add_sheet("NAVEGACION", tab_colour = "#D9D9D9")
  nav <- plantilla$navegacion %>% dplyr::select(hoja, tipo, n)
  openxlsx::writeData(wb, st_nav, nav, startRow = 1, colNames = TRUE)

  if (nrow(nav)){
    links <- vapply(nav$hoja, function(h){
      tgt <- safe_sheet_name(h, character(0))
      sprintf('HYPERLINK("#\'%s\'!A1","%s")', tgt, h)
    }, FUN.VALUE = character(1))
    openxlsx::writeFormula(wb, st_nav, x = links, startCol = 1, startRow = 2)

    if ("tipo" %in% names(nav)){
      idx_by_tipo <- split(seq_len(nrow(nav)) + 1L, nav$tipo)
      for (tp in names(idx_by_tipo)){
        openxlsx::addStyle(wb, st_nav, fill_tipo(tipo_hex(tp)),
                           rows = idx_by_tipo[[tp]], cols = 1:3, gridExpand = TRUE, stack = TRUE)
      }
    }
  }
  .set_widths_smart(wb, st_nav, 3, nrow(nav) + 1L)
  openxlsx::freezePane(wb, st_nav, firstActiveRow = 2, firstActiveCol = 2)
  openxlsx::addStyle(wb, st_nav, border_all_black,
                     rows = 1:(nrow(nav)+1), cols = 1:3, gridExpand = TRUE, stack = TRUE)


  # ===== 2) FAMILIAS =====
  st_fam <- add_sheet("FAMILIAS", tab_colour = "#D9D9D9")
  fam_tbl <- plantilla$familias
  openxlsx::writeData(wb, st_fam, fam_tbl, startRow = 1, colNames = TRUE)
  if (nrow(fam_tbl) && "tipo" %in% names(fam_tbl)){
    idx_by_tipo <- split(seq_len(nrow(fam_tbl)) + 1L, fam_tbl$tipo)
    for (tp in names(idx_by_tipo)){
      openxlsx::addStyle(wb, st_fam, fill_tipo(tipo_hex(tp)),
                         rows = idx_by_tipo[[tp]], cols = 1:ncol(fam_tbl), gridExpand = TRUE, stack = TRUE)
    }
  }
  .set_widths_smart(wb, st_fam, ncol(fam_tbl), nrow(fam_tbl) + 1L)
  openxlsx::freezePane(wb, st_fam, firstActiveRow = 2)
  openxlsx::addStyle(wb, st_fam, border_all_black,
                     rows = 1:(nrow(fam_tbl)+1), cols = 1:ncol(fam_tbl), gridExpand = TRUE, stack = TRUE)

  # ===== 3) CHOICES =====
  st_ch <- add_sheet("CHOICES", tab_colour = "#D9D9D9")

  # completar list_name SIN crear .x/.y
  choices_out <- {
    ch <- plantilla$choices
    if (!is.null(inst)) {
      ch_map <- choices_es_tbl(inst) %>% dplyr::distinct(list_norm, list_name)
      # vectorizado
      map_vec <- ch_map$list_name[match(ch$list_norm, ch_map$list_norm)]
      ch$list_name <- dplyr::coalesce(ch$list_name, map_vec)
    }
    # asegurar labels y list_name
    ch$choice_label <- dplyr::coalesce(ch$choice_label, ch$choice_code)
    ch$list_name    <- ch$list_name %||% NA_character_
    ch
  }

  ch <- choices_out %>%
    dplyr::transmute(
      parent_col,
      list_name,
      tipo,
      variable_base,
      variable_label,
      code  = choice_code,
      label = choice_label
    )

  openxlsx::writeData(wb, st_ch, ch, startRow = 1, colNames = TRUE)

  if (nrow(ch) && "tipo" %in% names(ch)) {
    idx_by_tipo <- split(seq_len(nrow(ch)) + 1L, ch$tipo)
    for (tp in names(idx_by_tipo)) {
      openxlsx::addStyle(wb, st_ch,
                         openxlsx::createStyle(fgFill = tipo_hex(tp)),
                         rows = idx_by_tipo[[tp]], cols = 1:ncol(ch),
                         gridExpand = TRUE, stack = TRUE)
    }
  }
  .set_widths_smart(wb, st_ch, ncol(ch), nrow(ch) + 1L)
  openxlsx::freezePane(wb, st_ch, firstActiveRow = 2)
  openxlsx::addStyle(wb, st_ch, border_all_black,
                     rows = 1:(nrow(ch)+1), cols = 1:ncol(ch), gridExpand = TRUE, stack = TRUE)

  # ===== 4) DICCIONARIO =====
  st_dic <- add_sheet("DICCIONARIO", tab_colour = "#D9D9D9")
  dic <- plantilla$diccionario

  if (!is.null(inst) && !is.null(inst$survey_raw)) {
    nms <- names(inst$survey_raw)
    idx <- which(grepl("^label::spanish", tolower(nms)))[1]
    if (!is.na(idx)) {
      col_span <- nms[idx]  # <- usa el nombre ORIGINAL, no el tolower
      s_min <- inst$survey_raw %>%
        dplyr::select(name, label_es_dic = !!rlang::sym(col_span))
      dic <- dic %>%
        dplyr::left_join(s_min, by = c("variable" = "name")) %>%
        dplyr::mutate(etiqueta = dplyr::coalesce(label_es_dic, etiqueta)) %>%
        dplyr::select(-label_es_dic)
    }
  }
  openxlsx::writeData(wb, st_dic, dic, startRow = 1, colNames = TRUE)
  if (nrow(dic) && "tipo_base" %in% names(dic)) {
    idx_by_tipo <- split(seq_len(nrow(dic)) + 1L, dic$tipo_base)
    for (tp in names(idx_by_tipo)) {
      openxlsx::addStyle(wb, st_dic,
                         openxlsx::createStyle(fgFill = tipo_hex(tp)),
                         rows = idx_by_tipo[[tp]], cols = 1:ncol(dic),
                         gridExpand = TRUE, stack = TRUE)
    }
  }
  .set_widths_smart(wb, st_dic, ncol(dic), nrow(dic) + 1L)
  openxlsx::freezePane(wb, st_dic, firstActiveRow = 2)
  openxlsx::addStyle(wb, st_dic, border_all_black,
                     rows = 1:(nrow(dic)+1), cols = 1:ncol(dic), gridExpand = TRUE, stack = TRUE)

  # ===== 5) Hojas por VARIABLE ==============================================
  orden_hojas <- plantilla$navegacion$hoja
  for (nm in orden_hojas) {
    df <- plantilla$sheets[[nm]]
    if (is.null(df) || !ncol(df)) next

    # reordenar recods al lado de base
    cn <- colnames(df)
    base_cols <- cn[!grepl("_recod$", cn)]
    rec_cols  <- cn[grepl("_recod$", cn)]
    order_cols <- unlist(lapply(base_cols, function(b){
      c(b, if (paste0(b,"_recod") %in% rec_cols) paste0(b,"_recod"))
    }))
    df <- df[, unique(c(order_cols, rec_cols)), drop = FALSE]

    # encabezados
    tipo_hoja <- attr(plantilla$sheets[[nm]], "tipo") %||% "text"
    layout_version <- attr(df, "layout_version") %||% "legacy"
    aux_block <- attr(df, "aux_block")
    example_block <- attr(df, "example_block")
    modo_so <- attr(df, "modo_so") %||% NA_character_
    hdr_base  <- colnames(df)
    hdr_lab   <- attr(df, "label_row") %||% hdr_base

    # Labels fijos en fila 2
    hdr_lab[hdr_base == "_uuid"]        <- "UUID"
    hdr_lab[hdr_base == "_index"]       <- "Índice"
    hdr_lab[hdr_base == "Código pulso"] <- "Código pulso"
    hdr_lab[hdr_base == "Control"]      <- "Control / notas"
    if (!identical(layout_version, "recod_v2")) {
      hdr_lab <- .codif_refine_label_row(hdr_base, hdr_lab, tipo_hoja, sheet_name = nm)
    }

    # Fila 1 (crudo/código) según tipo
    especiales <- c("_uuid","_index","Código pulso","Codigo pulso",
                    "Seleccionadas","Seleccionadas_cod")

    if (identical(tolower(tipo_hoja), "select_multiple")) {
      parent_col <- nm

      # Tabla código–label para ESTA variable SM
      map_lab_code <- plantilla$choices %>%
        dplyr::filter(.data$parent_col == parent_col) %>%
        dplyr::distinct(choice_code, choice_label) %>%
        dplyr::mutate(
          choice_code  = as.character(choice_code),
          choice_label = as.character(choice_label)
        )

      # mapea el encabezado "bonito" (label) a la forma cruda parent_col/código
      map_no_recod <- function(cc) {
        # IDs y columnas especiales se dejan tal cual
        if (cc %in% especiales) return(cc)

        # Buscar el código asociado a este label
        if (nrow(map_lab_code)) {
          i <- which(map_lab_code$choice_label == cc)[1]
          if (length(i) == 1 && !is.na(i)) {
            return(paste0(parent_col, "/", map_lab_code$choice_code[i]))
          }
        }

        # Si no hay match (no es una opción de choices), se deja como está
        cc
      }

      hdr_raw <- vapply(hdr_base, function(cc) {
        if (grepl("_recod$", cc)) {
          base0 <- sub("_recod$", "", cc)
          paste0(map_no_recod(base0), "_recod")
        } else {
          map_no_recod(cc)
        }
      }, FUN.VALUE = character(1))

    } else if (identical(layout_version, "recod_v2")) {
      hdr_raw <- hdr_base

    } else if (identical(tolower(tipo_hoja), "select_one")) {
      parent_col <- nm

      map_no_recod <- function(cc){
        if (cc %in% c("_uuid","_index","Código pulso","Codigo pulso")) return(cc)
        if (cc == "Selección (código)") return(parent_col)
        if (cc == "Selección (label)")  return(paste0(parent_col, "_label"))
        if (cc == "Recodificación (código)") return(paste0(parent_col, "_recod"))
        if (cc == "Etiqueta nueva categoría") return(paste0(parent_col, "_label_recod"))
        cc
      }

      hdr_raw <- vapply(hdr_base, function(cc){
        if (grepl("_recod$", cc)) {
          base0 <- sub("_recod$", "", cc)
          paste0(map_no_recod(base0), "_recod")
        } else {
          map_no_recod(cc)
        }
      }, FUN.VALUE = character(1))

    } else {  # TEXT / INTEGER
      map_no_recod <- function(cc){
        if (cc %in% c("_uuid","_index","Código pulso","Codigo pulso")) return(cc)
        cc
      }
      hdr_raw <- vapply(hdr_base, function(cc){
        if (grepl("_recod$", cc)) {
          base0 <- sub("_recod$", "", cc)
          paste0(map_no_recod(base0), "_recod")
        } else {
          map_no_recod(cc)
        }
      }, FUN.VALUE = character(1))
    }

    # escribir hoja
    st <- add_sheet(nm, tab_colour = tipo_hex(tipo_hoja))
    openxlsx::writeData(wb, st, t(hdr_raw), startRow = 1, colNames = FALSE)
    openxlsx::writeData(wb, st, t(hdr_lab), startRow = 2, colNames = FALSE)
    if (nrow(df)) openxlsx::writeData(wb, st, df, startRow = 3, colNames = FALSE, borders = "none")

    openxlsx::addStyle(wb, st, style_hdr1, rows = 1, cols = 1:ncol(df), gridExpand = TRUE)
    openxlsx::addStyle(wb, st, style_hdr2, rows = 2, cols = 1:ncol(df), gridExpand = TRUE)
    if (isTRUE(autofiltro)) openxlsx::addFilter(wb, st, rows = 2, cols = 1:ncol(df))

    id_cols <- intersect(c("_uuid","_index","Código pulso","Codigo pulso","pulso_code"), colnames(df))
    firstActiveCol <- if (length(id_cols)) (max(match(id_cols, colnames(df))) + 1L) else 1L
    if (isTRUE(congelar_encabezado)) openxlsx::freezePane(wb, st, firstActiveRow = 3, firstActiveCol = firstActiveCol)

    col_roles <- .codif_sheet_column_roles(hdr_base)
    idx_id <- which(col_roles == "id")
    idx_ref <- which(col_roles == "reference")
    idx_edit <- which(col_roles == "editable")
    idx_control <- which(col_roles == "control")

    if (length(idx_id)) {
      openxlsx::addStyle(wb, st, style_id_hdr, rows = 1:2, cols = idx_id, gridExpand = TRUE, stack = TRUE)
      if (nrow(df)) openxlsx::addStyle(wb, st, style_id_body, rows = 3:(nrow(df) + 2L), cols = idx_id, gridExpand = TRUE, stack = TRUE)
    }
    if (length(idx_ref)) {
      openxlsx::addStyle(wb, st, style_ref_hdr, rows = 1:2, cols = idx_ref, gridExpand = TRUE, stack = TRUE)
      if (nrow(df)) openxlsx::addStyle(wb, st, style_ref_body, rows = 3:(nrow(df) + 2L), cols = idx_ref, gridExpand = TRUE, stack = TRUE)
    }
    if (length(idx_edit)) {
      openxlsx::addStyle(wb, st, style_edit_hdr, rows = 1:2, cols = idx_edit, gridExpand = TRUE, stack = TRUE)
      if (nrow(df)) openxlsx::addStyle(wb, st, style_edit_body, rows = 3:(nrow(df) + 2L), cols = idx_edit, gridExpand = TRUE, stack = TRUE)
    }
    if (length(idx_control)) {
      openxlsx::addStyle(wb, st, style_control_hdr, rows = 1:2, cols = idx_control, gridExpand = TRUE, stack = TRUE)
      if (nrow(df)) openxlsx::addStyle(wb, st, style_control_body, rows = 3:(nrow(df) + 2L), cols = idx_control, gridExpand = TRUE, stack = TRUE)
    }

    nrows <- max(2, nrow(df) + 2L)
    openxlsx::addStyle(wb, st, border_all_black, rows = 1:nrows, cols = 1:ncol(df), gridExpand = TRUE, stack = TRUE)

    openxlsx::setColWidths(wb, st, cols = 1:ncol(df), widths = "auto")
    if (nrow(df)) {
      openxlsx::addStyle(wb, st, wrap_left, rows = 3:(nrow(df)+2L), cols = 1:ncol(df), gridExpand = TRUE, stack = TRUE)
    }

    for (j in c(idx_edit, idx_control)) {
      cmt <- openxlsx::createComment(
        comment = .codif_edit_comment_text(
          tipo_hoja,
          hdr_base[j],
          sheet_name = nm,
          mode_so = modo_so,
          aux_block = aux_block
        ),
        author = "prosecnur",
        visible = FALSE,
        width = 4,
        height = 3
      )
      openxlsx::writeComment(wb, st, col = j, row = 2, comment = cmt)
    }

    block_cursor <- ncol(df)

    if (!is.null(aux_block) && length(aux_block$raw) == 2L) {
      sep_col <- block_cursor + 1L
      aux_cols <- (block_cursor + 2L):(block_cursor + 3L)
      aux_nrows <- max(nrows, 3L)

      openxlsx::writeData(wb, st, t(aux_block$raw), startRow = 1, startCol = aux_cols[1], colNames = FALSE)
      openxlsx::writeData(wb, st, t(aux_block$label), startRow = 2, startCol = aux_cols[1], colNames = FALSE)

      openxlsx::addStyle(wb, st, style_aux_sep, rows = 1:aux_nrows, cols = sep_col, gridExpand = TRUE, stack = TRUE)
      openxlsx::addStyle(wb, st, style_aux_hdr, rows = 1:2, cols = aux_cols, gridExpand = TRUE, stack = TRUE)
      if (aux_nrows >= 3L) {
        openxlsx::addStyle(wb, st, style_aux_body, rows = 3:aux_nrows, cols = aux_cols, gridExpand = TRUE, stack = TRUE)
      }
      openxlsx::addStyle(wb, st, border_all_black, rows = 1:aux_nrows, cols = aux_cols, gridExpand = TRUE, stack = TRUE)

      openxlsx::setColWidths(wb, st, cols = sep_col, widths = 3)
      openxlsx::setColWidths(wb, st, cols = aux_cols, widths = 26)

      if (!is.null(aux_block$comments) && length(aux_block$comments) == 2L) {
        for (k in seq_along(aux_cols)) {
          cmt_aux <- openxlsx::createComment(
            comment = aux_block$comments[[k]],
            author = "prosecnur",
            visible = FALSE,
            width = 4.5,
            height = 3.5
          )
          openxlsx::writeComment(wb, st, col = aux_cols[k], row = 2, comment = cmt_aux)
        }
      }
      block_cursor <- max(aux_cols)
    }

    if (!is.null(example_block) &&
        length(example_block$raw) == 1L &&
        length(example_block$label) == 1L) {
      sep_col <- block_cursor + 1L
      ex_col <- block_cursor + 2L
      ex_values <- as.character(example_block$values %||% character(0))
      ex_nrows <- max(nrows, length(ex_values) + 2L, 3L)

      openxlsx::writeData(wb, st, x = example_block$raw, startRow = 1, startCol = ex_col, colNames = FALSE)
      openxlsx::writeData(wb, st, x = example_block$label, startRow = 2, startCol = ex_col, colNames = FALSE)
      if (length(ex_values)) {
        openxlsx::writeData(wb, st, x = ex_values, startRow = 3, startCol = ex_col, colNames = FALSE)
      }

      openxlsx::addStyle(wb, st, style_aux_sep, rows = 1:ex_nrows, cols = sep_col, gridExpand = TRUE, stack = TRUE)
      openxlsx::addStyle(wb, st, style_example_hdr, rows = 1:2, cols = ex_col, gridExpand = TRUE, stack = TRUE)
      if (ex_nrows >= 3L) {
        openxlsx::addStyle(wb, st, style_example_body, rows = 3:ex_nrows, cols = ex_col, gridExpand = TRUE, stack = TRUE)
      }
      openxlsx::addStyle(wb, st, border_all_black, rows = 1:ex_nrows, cols = ex_col, gridExpand = TRUE, stack = TRUE)
      openxlsx::setColWidths(wb, st, cols = sep_col, widths = 3)
      openxlsx::setColWidths(wb, st, cols = ex_col, widths = 28)

      if (!is.null(example_block$comment) && nzchar(example_block$comment)) {
        cmt_ex <- openxlsx::createComment(
          comment = example_block$comment,
          author = "prosecnur",
          visible = FALSE,
          width = 4.5,
          height = 3.5
        )
        openxlsx::writeComment(wb, st, col = ex_col, row = 2, comment = cmt_ex)
      }
    }
  }

  openxlsx::saveWorkbook(wb, path_xlsx, overwrite = TRUE)
  invisible(path_xlsx)
}



# -----------------------------------------------------------------------------
# 5R) CONSTRUCTOR REPEAT-AWARE (usa orden del XLSForm y enlaza hijas con madre)
# -----------------------------------------------------------------------------
# -----------------------------------------------------------------------------
#' Construir plantilla de codificación (multi-hoja, repeat-aware, con labels en español)
#'
#' @description
#' Versión **repeat-aware** del constructor de plantilla. Usa el *split* devuelto por
#' `leer_familias_clasificar_repeat()` (o equivalente) y un objeto `tabs` con las
#' hojas de datos (main y repeats).
#'
#' Esta función crea automáticamente una plantilla de codificación multi-hoja
#' que respeta el orden original del XLSForm (`q_order`) e integra todas las
#' familias **select_one**, **select_multiple**, **text** e **integer**.
#'
#' ### Características principales
#' - Soporta formularios con *grupos repeat* (identifica correctamente cada hoja).
#' - Crea una hoja por variable (`parent_col`) con identificadores robustos
#'   (`_uuid`, `_index`, `Código pulso`).
#' - Reconoce y vincula variables hijas con sus familias (soportando `other_dummy_col` y `text_col`).
#' - Incluye vínculos `_parent_index` y `_submission__uuid` si existen.
#' - Excluye `text` adoptadas según la lógica de `adopciones` en `fam`.
#' - Integra catálogos de opciones (`choices`) directamente desde el instrumento XLSForm,
#'   priorizando etiquetas en español (`label::Español (es)`, `label_spanish_es`, etc.).
#' - Reetiqueta las columnas de las hojas **select_multiple** con los *labels* en español
#'   (en lugar de códigos).
#' - Recalcula en las hojas **select_one** la columna `"Selección (label)"`
#'   para que refleje siempre el texto en español correspondiente al código.
#'
#' ### Flujo recomendado
#' ```r
#' inst <- leer_instrumento_xlsform("instrumento.xlsx")
#' tabs <- lector_codif_repeat("datos.xlsx", main_sheet="main", repeat_sheets=c("hogar","ninos"))
#' fam  <- leer_familias_clasificar_repeat("familias.xlsx", inst, tabs)
#' pl   <- construir_plantilla_desde_familias_repeat(inst, tabs, fam)
#' exportar_plantilla_codificacion_xlsx(pl, "Plantilla.xlsx", inst)
#' ```
#'
#' @param inst Lista del instrumento XLSForm.
#' Debe incluir al menos `$survey` y `$choices`.
#' Idealmente también `$survey_raw` y `$choices_raw` con etiquetas multilingües
#' (especialmente en español).
#'
#' @param tabs Lista de hojas de datos (por ejemplo, leídas con `openxlsx` o `readxl`).
#' Cada elemento **debe ser un `data.frame`** (main y repeats).
#' Si algún elemento no es `data.frame`, se omitirá con un *warning*.
#'
#' @param fam Lista devuelta por `leer_familias_clasificar_repeat()` que contiene:
#' \itemize{
#'   \item `select_one`, `select_multiple`, `text`, `integer` — familias aceptadas.
#'   \item Opcionalmente `choices_usadas` y `adopciones`.
#' }
#' Cada subtabla debe incluir las columnas:
#' `section`, `hoja_datos`, `tipo`, `parent`, `parent_label`,
#' `list_norm`, `parent_col`, `other_dummy_col`, `text_col`, `q_order`.
#'
#' @return Una lista con los siguientes elementos:
#' \describe{
#'   \item{`diccionario`}{Metadatos del XLSForm (orden, variable, etiqueta, tipo base, list\_name).}
#'   \item{`choices`}{Catálogo de opciones final (labels en español) por familia.}
#'   \item{`familias`}{Tabla consolidada de familias aceptadas.}
#'   \item{`navegacion`}{Tabla resumen con hoja, tipo y número de registros (`n`).}
#'   \item{`sheets`}{Lista de `data.frame`s (una hoja por variable) con atributos:
#'       \code{header_raw}, \code{label_row} (labels ES) y \code{tipo}.}
#' }
#'
#' @details
#' - Los **select_one** generan columnas: `"Selección (código)"`, `"Selección (label)"`,
#'   `"Recodificación"`, `"Control"`, y opcionalmente columnas de texto auxiliar.
#' - Los **select_multiple** expanden las opciones a columnas *dummy* (0/1),
#'   nombradas con los *labels* en español, más sus columnas `*_recod`.
#' - Los **integer** y **text** conservan la estructura original y añaden
#'   una columna `*_recod` y `"Control"`.
#' - Se respeta el orden de las variables según `q_order` del XLSForm original.
#'
#' @seealso
#' - [`leer_familias_clasificar_repeat()`] para clasificar familias de variables.
#' - [`exportar_plantilla_codificacion_xlsx()`] para exportar la plantilla final.
#'
#' @examples
#' \dontrun{
#' inst <- leer_instrumento_xlsform("instrumento.xlsx")
#' tabs <- lector_codif_repeat("datos.xlsx", main_sheet="main", repeat_sheets=c("hogar","ninos"))
#' fam  <- leer_familias_clasificar_repeat("familias.xlsx", inst, tabs)
#' pl   <- construir_plantilla_desde_familias_repeat(inst, tabs, fam)
#' pl$sheets$IDP01  # Hoja expandida con dummy-labels en español
#' }
#'
#' @family codificacion
#' @export
construir_plantilla_desde_familias_repeat <- function(inst, tabs, fam) {
  stopifnot(is.list(inst), is.list(tabs), is.list(fam))
  `%||%` <- function(x, y) if (is.null(x) || (length(x) == 1 && is.na(x))) y else x

  # --------- Helpers ---------------------------------------------------------
  nm_norm <- function(x) janitor::make_clean_names(tolower(trimws(as.character(x %||% ""))))

  .coerce_tab_df <- function(x){
    if (is.data.frame(x)) return(x)
    if (is.list(x) && !is.null(x$raw) && is.data.frame(x$raw)) return(x$raw)
    if (is.list(x) && length(x) > 0 && is.data.frame(x[[1]])) return(x[[1]])
    NULL
  }

  # Label de survey en ES (prioriza survey_raw)
  s_lab_from_original <- function(vars, inst){
    v <- as.character(vars)
    out <- v
    s <- inst$survey
    if (!is.null(inst$survey_raw)) {
      sr <- inst$survey_raw
      col_es <- grep("^label(::)?español|^label(::)?spanish|label[_:]spanish|label[_:]es$",
                     tolower(names(sr)), value = TRUE)[1]
      if (!is.na(col_es)) {
        i <- match(janitor::make_clean_names(v), janitor::make_clean_names(sr$name))
        lab <- ifelse(!is.na(i), as.character(sr[[col_es]][i]), NA_character_)
        out <- ifelse(!is.na(lab) & nzchar(lab), lab, out)
      }
    }
    if (any(out == v)) {
      cand <- c("label_spanish_es","label_es","label")
      col2 <- cand[cand %in% names(s)]
      if (length(col2)) {
        i2 <- match(janitor::make_clean_names(v), janitor::make_clean_names(s$name))
        lab2 <- ifelse(!is.na(i2), as.character(s[[col2[1]]][i2]), NA_character_)
        out  <- ifelse(out == v & !is.na(lab2) & nzchar(lab2), lab2, out)
      }
    }
    out
  }

  # Catálogo ES desde choices (elige la mejor columna en español)
  choices_es_from_inst <- (function(inst){
    ch <- inst$choices %||% inst$choices_raw
    if (is.null(ch) || !nrow(ch)) {
      return(dplyr::tibble(list_norm=character(), list_name=character(),
                           code=character(), label_es=character()))
    }
    nm <- names(ch)
    idx <- which(grepl("^label::español|^label::spanish|label_spanish_es$", tolower(nm)))[1]
    col_es <- if (!is.na(idx)) nm[idx] else if ("label_spanish_es" %in% nm) "label_spanish_es"
    else if ("label" %in% nm) "label" else NA_character_

    ln <- if ("list_norm" %in% nm) ch$list_norm else
      tolower(gsub("[^a-z0-9_]", "_", gsub("\\s+","_", ch$list_name)))

    dplyr::tibble(
      list_norm = as.character(ln),
      list_name = as.character(if ("list_name" %in% nm) ch$list_name else ln),
      code      = as.character(ch$name),
      label_es  = as.character(if (!is.na(col_es)) ch[[col_es]] else ch$name)
    )
  })(inst)

  # IDs robustos por hoja
  resolve_ids <- function(dat_raw){
    stopifnot(is.data.frame(dat_raw))
    n <- nrow(dat_raw)
    as_chr <- function(x){ if (is.null(x)) return(rep(NA_character_, n)); if (is.factor(x)) x <- as.character(x); as.character(x) }
    as_int <- function(x){ if (is.null(x)) return(rep(NA_integer_, n)); suppressWarnings(as.integer(x)) }

    uuid_cands  <- c("_uuid","uuid","_submission__uuid","meta_instance_id","instanceid")
    index_cands <- c("_index","index","_parent_index","parent_index")
    pulso_cands <- c("mand_location_details_pulso_code","Pulso_code","pulso_code","codigo_pulso")

    pick_first <- function(cands){
      for (cn in cands) if (cn %in% names(dat_raw)) return(dat_raw[[cn]])
      NULL
    }

    tibble::tibble(
      `_uuid`        = as_chr(pick_first(uuid_cands)),
      `_index`       = as_int(pick_first(index_cands)),
      `Código pulso` = as_chr(pick_first(pulso_cands))
    )
  }

  # Expansor de dummies SM (lee slash o tokeniza)
  expand_sm_dummies <- function(dat_raw, parent_col, opts){
    n <- nrow(dat_raw); if (is.null(n)) n <- 0L
    if (n == 0L || !nrow(opts)) {
      out <- matrix(NA_integer_, nrow=0, ncol=nrow(opts)); colnames(out) <- opts$choice_code
      return(tibble::as_tibble(out))
    }
    out <- matrix(NA_integer_, nrow=n, ncol=nrow(opts))
    colnames(out) <- opts$choice_code
    # por slash
    for (j in seq_len(nrow(opts))){
      slash <- paste0(parent_col, "/", opts$choice_code[j])
      if (slash %in% names(dat_raw)) {
        v <- dat_raw[[slash]]
        vv <- suppressWarnings(as.integer(as.character(v)))
        if (all(is.na(vv))){
          vv <- ifelse(tolower(as.character(v)) %in% c("true","t","1"), 1L,
                       ifelse(tolower(as.character(v)) %in% c("false","f","0"), 0L, NA_integer_))
        }
        out[, j] <- vv
      }
    }
    # por tokens (fallback)
    miss <- which(apply(out, 2, function(z) all(is.na(z))))
    if (length(miss) && parent_col %in% names(dat_raw)){
      toks <- strsplit(ifelse(is.na(dat_raw[[parent_col]]), "", as.character(dat_raw[[parent_col]])), "\\s+")
      for (j in miss){
        code <- opts$choice_code[j]
        out[, j] <- vapply(toks, function(tt) as.integer(code %in% tt), integer(1))
      }
    }
    tibble::as_tibble(out)
  }

  # -------- Diccionario para orden real -------------------------------------
  survey_dic <- inst$survey %||% inst$survey_raw
  if (is.null(survey_dic) || !nrow(survey_dic)) rlang::abort("inst$survey está vacío.")
  if (!"q_order" %in% names(survey_dic) || all(is.na(survey_dic$q_order))) {
    survey_dic$q_order <- seq_len(nrow(survey_dic))
  }
  survey_dic$type_base <- sub("\\s.*$", "", as.character(survey_dic$type %||% ""))
  if (!"list_name" %in% names(survey_dic) || all(is.na(survey_dic$list_name))) {
    survey_dic$list_name <- trimws(sub("^\\S+\\s+","", as.character(survey_dic$type %||% "")))
  }

  diccionario <- tibble::tibble(
    q_order   = as.integer(survey_dic$q_order),
    variable  = as.character(survey_dic$name),
    etiqueta  = s_lab_from_original(survey_dic$name, inst),
    tipo_base = as.character(survey_dic$type_base),
    list_name = as.character(survey_dic$list_name)
  )

  qord_by_var <- diccionario %>% dplyr::transmute(var = variable, q_order)
  ord_val <- function(x){
    v <- janitor::make_clean_names(x)
    qord_by_var$q_order[match(v, janitor::make_clean_names(qord_by_var$var))]
  }

  # -------- tabs → data.frames ------------------------------------------------
  tabs_norm <- list()
  if (length(tabs)) {
    for (nm in names(tabs)) {
      df <- .coerce_tab_df(tabs[[nm]])
      if (is.null(df)) {
        warning(sprintf("La hoja '%s' en `tabs` no es data.frame; se omitirá.", nm), call. = FALSE)
      } else {
        tabs_norm[[nm_norm(nm)]] <- df
      }
    }
  }
  if (!length(tabs_norm)) rlang::abort("Ninguna hoja de `tabs` es data.frame. Revisa tu lector de datos.")

  # -------- fam: apilar + normalizar ----------------------------------------
  so  <- fam$select_one      %||% tibble::tibble()
  sm  <- fam$select_multiple %||% tibble::tibble()
  tx  <- fam$text            %||% tibble::tibble()
  itg <- fam$integer         %||% tibble::tibble()

  fam_all <- dplyr::bind_rows(
    if (nrow(so)) so %>% dplyr::mutate(tipo = "select_one"),
    if (nrow(sm)) sm %>% dplyr::mutate(tipo = "select_multiple"),
    if (nrow(tx)) tx %>% dplyr::mutate(tipo = "text"),
    if (nrow(itg)) itg %>% dplyr::mutate(tipo = "integer")
  )

  # ===== ENRIQUECER CON INTEGER/DECIMAL DEL SURVEY (no listados en familias) =====
  # candidatos por tipo base
  cand_num <- diccionario %>%
    dplyr::filter(tolower(tipo_base) %in% c("integer","decimal")) %>%
    dplyr::select(variable, q_order)

  if (nrow(cand_num)) {
    ya <- unique(fam_all$parent_col)
    por_agregar <- setdiff(cand_num$variable, ya)

    if (length(por_agregar)) {
      # buscar en qué hoja de tabs está cada variable
      ubicar_hoja <- function(var){
        for (hn in names(tabs_norm)) {
          if (var %in% names(tabs_norm[[hn]])) return(hn)
        }
        NA_character_
      }
      hojas_encontradas <- vapply(por_agregar, ubicar_hoja, FUN.VALUE = character(1))
      ok <- !is.na(hojas_encontradas) & nzchar(hojas_encontradas)
      if (any(ok)) {
        add_df <- tibble::tibble(
          section         = NA_character_,
          hoja_datos      = hojas_encontradas[ok],
          use             = TRUE,
          q_order         = cand_num$q_order[match(por_agregar[ok], cand_num$variable)],
          tipo            = "integer",
          modo_so         = NA_character_,
          parent          = por_agregar[ok],
          parent_label    = s_lab_from_original(por_agregar[ok], inst),
          list_norm       = NA_character_,
          parent_col      = por_agregar[ok],
          other_dummy_col = NA_character_,
          text_col        = NA_character_
        )
        fam_all <- dplyr::bind_rows(fam_all, add_df)
      }
    }
  }

  if (!nrow(fam_all)) {
    warning("No hay familias aceptadas (tras enriquecer). Devolviendo vacíos.", call. = FALSE)
    return(list(diccionario=diccionario, choices=tibble::tibble(),
                familias=tibble::tibble(), navegacion=tibble::tibble(), sheets=list()))
  }

  # columnas requeridas del Excel de familias
  need_cols <- c("section","hoja_datos","use","q_order","tipo","modo_so","parent","parent_label",
                 "list_norm","parent_col","other_dummy_col","text_col")
  for (k in need_cols) if (!k %in% names(fam_all)) fam_all[[k]] <- NA

  # normalización básica
  to_chr <- c("section","hoja_datos","tipo","modo_so","parent","parent_label","list_norm",
              "parent_col","other_dummy_col","text_col")
  for (cc in intersect(to_chr, names(fam_all))) {
    fam_all[[cc]] <- as.character(fam_all[[cc]])
    fam_all[[cc]][is.na(fam_all[[cc]])] <- ""
    fam_all[[cc]] <- trimws(fam_all[[cc]])
  }
  fam_all$q_order <- suppressWarnings(as.integer(fam_all$q_order))
  fam_all$hoja_datos_norm <- nm_norm(fam_all$hoja_datos)

  # completar list_name / list_norm si faltan
  choices_es <- choices_es_from_inst %>%
    dplyr::mutate(label_es = dplyr::coalesce(.data$label_es, .data$code)) %>%
    dplyr::select(list_norm, list_name, code, label_es)

  ch_map_ln <- choices_es %>% dplyr::distinct(list_norm, list_name)
  fam_all$list_norm <- ifelse(!is.na(fam_all$list_norm) & nzchar(fam_all$list_norm),
                              fam_all$list_norm,
                              tolower(gsub("[^a-z0-9_]", "_", gsub("\\s+","_", if ("list_name" %in% names(fam_all)) fam_all$list_name else ""))))
  fam_all$list_name <- ch_map_ln$list_name[match(fam_all$list_norm, ch_map_ln$list_norm)]

  # excluir TEXT adoptadas
  .safe_text_col <- function(x){
    if (is.null(x) || !("text_col" %in% names(x))) return(NULL)
    x[["text_col"]]
  }
  assigned_texts <- unique(na.omit(c(
    .safe_text_col(fam$adopciones),
    .safe_text_col(so),
    .safe_text_col(sm)
  )))
  fam_all <- fam_all %>%
    dplyr::filter(!(tipo == "text" & !is.na(text_col) & nzchar(text_col) & text_col %in% assigned_texts))

  fam_all$parent_clean <- janitor::make_clean_names(
    ifelse(nzchar(fam_all$parent), fam_all$parent, fam_all$parent_col)
  )
  # completar parent_label faltantes desde survey
  miss_pl <- is.na(fam_all$parent_label) | !nzchar(fam_all$parent_label)
  if (any(miss_pl)) {
    pref <- ifelse(nzchar(fam_all$parent), fam_all$parent, fam_all$parent_col)
    fam_all$parent_label[miss_pl] <- s_lab_from_original(pref[miss_pl], inst)
  }

  # tabla familias exportable
  familias_tbl <- fam_all %>%
    dplyr::select(
      tipo, modo_so, section, hoja_datos, parent = parent_clean, parent_label, q_order,
      list_name, list_norm, parent_col, other_dummy_col, text_col
    )

  # -------- CHOICES final (filtrado por choices_usadas si existe) ------------
  make_choices_tbl <- function(fam_tbl){
    fam_so_sm <- fam_tbl %>%
      dplyr::filter(.data$tipo %in% c("select_one","select_multiple"),
                    !is.na(list_norm) & nzchar(list_norm)) %>%
      dplyr::distinct(parent_col, list_norm, tipo)

    if (!is.null(fam$choices_usadas) && nrow(fam$choices_usadas)) {
      allowed <- fam$choices_usadas %>% dplyr::select(list_norm, code = !!rlang::sym("code")) %>% dplyr::distinct()
      choices_es_use <- dplyr::inner_join(choices_es, allowed, by = c("list_norm","code"))
    } else {
      choices_es_use <- choices_es
    }

    map_ln <- choices_es %>% dplyr::distinct(list_norm, list_name)
    fam_so_sm %>%
      dplyr::mutate(
        variable_base  = janitor::make_clean_names(parent_col),
        variable_label = s_lab_from_original(parent_col, inst),
        list_name      = map_ln$list_name[match(list_norm, map_ln$list_norm)]
      ) %>%
      dplyr::left_join(
        choices_es_use %>% dplyr::transmute(
          list_norm, choice_code = code, choice_label = label_es
        ),
        by = "list_norm"
      ) %>%
      dplyr::mutate(choice_label = dplyr::coalesce(choice_label, choice_code)) %>%
      dplyr::select(parent_col, variable_base, variable_label,
                    tipo, list_name, list_norm, choice_code, choice_label)
  }
  choices_tbl <- make_choices_tbl(familias_tbl)
  choices_by_parent <- split(choices_tbl, choices_tbl$parent_col)
  label_map <- .codif_label_map(inst)

  # -------- Construcción de hojas (respetando hoja_datos correcta) ----------
  sheets_list <- list(); nav_rows <- list()
  add_sheet_row <- function(title, tipo, base_df, hdr_raw, hdr_lab){
    attr(base_df, "header_raw") <- hdr_raw
    attr(base_df, "label_row") <- hdr_lab
    attr(base_df, "tipo") <- tipo
    sheets_list[[title]] <<- base_df
    nav_rows[[length(nav_rows)+1]] <<- tibble::tibble(hoja = title, tipo = tipo, n = nrow(base_df))
  }
  id_base_by_sheet <- lapply(tabs_norm, resolve_ids)

  fam_all$.ord <- dplyr::coalesce(fam_all$q_order, ord_val(fam_all$parent_col))
  fam_all <- fam_all %>% dplyr::arrange(.ord, factor(tipo, c("select_one","select_multiple","integer","text")), parent_col)

  for (i in seq_len(nrow(fam_all))) {
    row <- fam_all[i, ]
    tipo      <- tolower(row$tipo)
    hoja_norm <- nm_norm(row$hoja_datos)
    if (!length(hoja_norm) || !nzchar(hoja_norm)) next

    dat_raw <- tabs_norm[[hoja_norm]]
    if (is.null(dat_raw) || !is.data.frame(dat_raw)) next

    id_base <- id_base_by_sheet[[hoja_norm]] %||% resolve_ids(dat_raw)
    # etiqueta preferida (familia → survey fallback)
    label_pref <- if (!is.na(row$parent_label) && nzchar(row$parent_label)) row$parent_label else s_lab_from_original(row$parent_col, inst)

    if (identical(tipo, "select_one")) {
      parent_col <- row$parent_col; text_col <- row$text_col
      if (!nzchar(parent_col) || !(parent_col %in% names(dat_raw))) next

      opts_fast <- choices_by_parent[[parent_col]] %||% tibble::tibble(choice_code = character(), choice_label = character())
      opts_fast <- opts_fast %>%
        dplyr::distinct(choice_code, choice_label) %>%
        dplyr::transmute(code = .data$choice_code, label = .data$choice_label)
      base_fast <- .codif_build_select_one_sheet(
        dat_raw = dat_raw,
        id_base = id_base,
        row = row,
        opts = opts_fast,
        inst = inst,
        label_pref = label_pref,
        label_map = label_map
      )
      if (is.null(base_fast)) next
      add_sheet_row(row$parent_col, "select_one", base_fast,
                    attr(base_fast, "header_raw"), attr(base_fast, "label_row"))
      next

      opts <- choices_tbl %>%
        dplyr::filter(parent_col == !!parent_col) %>%
        dplyr::distinct(choice_code, choice_label) %>%
        dplyr::transmute(code = choice_code, label = choice_label)

      parent_code  <- as.character(dat_raw[[parent_col]] %||% NA_character_)
      parent_label_vec <- if (nrow(opts)) opts$label[match(parent_code, opts$code)] else parent_code
      text_vec <- if (!is.na(text_col) && nzchar(text_col) && text_col %in% names(dat_raw)) as.character(dat_raw[[text_col]]) else NA_character_

      base <- id_base %>%
        dplyr::mutate(`Selección (código)` = parent_code,
                      `Selección (label)`  = parent_label_vec)

      if (!is.na(text_col) && nzchar(text_col)) {
        base[[text_col]] <- text_vec
        base[[paste0(text_col,"_recod")]] <- NA_character_
      }
      base[["Control"]] <- NA_character_

      # intercalar _recod
      cn <- colnames(base)
      base_cols <- cn[!grepl("_recod$", cn)]
      rec_cols  <- cn[grepl("_recod$", cn)]
      order_cols <- c()
      for (b in base_cols){
        order_cols <- c(order_cols, b)
        r <- paste0(b, "_recod")
        if (r %in% rec_cols) order_cols <- c(order_cols, r)
      }
      orphan_rec <- setdiff(rec_cols, paste0(base_cols, "_recod"))
      base <- base[, unique(c(order_cols, orphan_rec)), drop = FALSE]

      hdr_raw <- names(base); hdr_lab <- hdr_raw
      hdr_lab[hdr_raw=="_uuid"] <- "UUID"
      hdr_lab[hdr_raw=="_index"] <- "Índice"
      hdr_lab[hdr_raw=="Código pulso"] <- "Código pulso"
      hdr_lab[hdr_raw=="Selección (código)"] <- row$parent_col
      hdr_lab[hdr_raw=="Selección (label)"]  <- label_pref
      if (!is.na(text_col) && nzchar(text_col)) hdr_lab[hdr_raw==text_col] <- s_lab_from_original(text_col, inst)
      hdr_lab[grepl("_recod$", hdr_raw)] <- "Recodificación"

      add_sheet_row(row$parent_col, "select_one", base, hdr_raw, hdr_lab)

    } else if (identical(tipo, "select_multiple")) {
      parent_col <- row$parent_col
      other_col  <- row$other_dummy_col
      text_col   <- row$text_col
      if (!nzchar(parent_col) || !(parent_col %in% names(dat_raw))) next

      opts_fast <- choices_by_parent[[parent_col]] %||% tibble::tibble(choice_code = character(), choice_label = character())
      opts_fast <- opts_fast %>%
        dplyr::distinct(choice_code, choice_label) %>%
        dplyr::transmute(code = .data$choice_code, label = .data$choice_label)
      base_fast <- .codif_build_select_multiple_sheet(
        dat_raw = dat_raw,
        id_base = id_base,
        row = row,
        opts = opts_fast,
        inst = inst,
        label_pref = label_pref,
        label_map = label_map
      )
      if (is.null(base_fast)) next
      add_sheet_row(row$parent_col, "select_multiple", base_fast,
                    attr(base_fast, "header_raw"), attr(base_fast, "label_row"))
      next

      # catálogo
      opts <- choices_tbl %>%
        dplyr::filter(parent_col == !!parent_col) %>%
        dplyr::distinct(choice_code, choice_label)

      # mapas code↔label con fallback
      code2lab <- setNames(as.character(opts$choice_label), as.character(opts$choice_code))
      lab2code <- setNames(as.character(opts$choice_code), as.character(opts$choice_label))
      safe_code2lab <- function(cd){
        v <- unname(code2lab[as.character(cd)])
        if (length(v) == 0L || is.na(v) || !nzchar(v)) return(as.character(cd))
        v
      }
      safe_lab2code <- function(lb){
        v <- unname(lab2code[as.character(lb)])
        if (length(v) == 0L || is.na(v) || !nzchar(v)) return(as.character(lb))
        v
      }

      dmm <- if (nrow(opts)) expand_sm_dummies(dat_raw, parent_col, opts) else tibble::tibble()

      # renombrar por LABEL (fallback a código)
      if (nrow(opts) && ncol(dmm)) {
        new_names <- vapply(colnames(dmm), safe_code2lab, FUN.VALUE = character(1))
        new_names[is.na(new_names) | !nzchar(new_names)] <- colnames(dmm)[is.na(new_names) | !nzchar(new_names)]
        names(dmm) <- new_names
      }

      # Other
      if (!is.na(other_col) && nzchar(other_col) && other_col %in% names(dat_raw)) {
        other_dummy <- dat_raw[[other_col]]
        other01 <- suppressWarnings(as.integer(as.character(other_dummy)))
        if (all(is.na(other01)))
          other01 <- ifelse(tolower(as.character(other_dummy)) %in% c("true","t","1"), 1L,
                            ifelse(tolower(as.character(other_dummy)) %in% c("false","f","0"), 0L, NA_integer_))
        dmm[["Otro, por favor especificar"]] <- other01
      } else if (nrow(opts)) {
        tmp_txt <- if (!is.na(text_col) && nzchar(text_col) && text_col %in% names(dat_raw)) as.character(dat_raw[[text_col]]) else NA_character_
        dmm[["Otro, por favor especificar"]] <- ifelse(!is.na(tmp_txt) & nzchar(tmp_txt), 1L, 0L)
      }

      # Seleccionadas / Seleccionadas_cod
      nm <- names(dmm); nm <- nm[!is.na(nm) & nzchar(nm)]
      selected_cols <- nm

      sel_labels <- if (length(selected_cols)) apply(dmm[, selected_cols, drop = FALSE], 1, function(r){
        idx <- which(r == 1); if (!length(idx)) "" else paste(names(r)[idx], collapse = "; ")
      }) else rep("", nrow(dat_raw))

      sel_codes <- if (length(selected_cols)) apply(dmm[, selected_cols, drop = FALSE], 1, function(r){
        idx <- which(r == 1)
        if (!length(idx)) "" else {
          lbs <- names(r)[idx]
          paste(vapply(lbs, safe_lab2code, FUN.VALUE = character(1)), collapse = "; ")
        }
      }) else rep("", nrow(dat_raw))

      text_vec <- if (!is.na(text_col) && nzchar(text_col) && text_col %in% names(dat_raw)) as.character(dat_raw[[text_col]]) else NA_character_

      base <- id_base %>%
        dplyr::mutate(Seleccionadas     = sel_labels,
                      Seleccionadas_cod = sel_codes) %>%
        dplyr::bind_cols(dmm)
      if (!is.na(text_col) && nzchar(text_col)) {
        base[[text_col]] <- text_vec
      }

      # recods intercalados
      skip_cols <- c("_uuid","_index","Código pulso","Seleccionadas","Seleccionadas_cod")
      for (dc in setdiff(names(base), skip_cols)) base[[paste0(dc,"_recod")]] <- NA_character_
      base[["Control"]] <- NA_character_

      cn <- colnames(base)
      base_cols <- cn[!grepl("_recod$", cn)]
      rec_cols  <- cn[grepl("_recod$", cn)]
      order_cols <- c()
      for (b in base_cols){
        order_cols <- c(order_cols, b)
        r <- paste0(b, "_recod")
        if (r %in% rec_cols) order_cols <- c(order_cols, r)
      }
      orphan_rec <- setdiff(rec_cols, paste0(base_cols, "_recod"))
      base <- base[, unique(c(order_cols, orphan_rec)), drop = FALSE]

      # encabezados
      hdr_raw <- names(base); hdr_lab <- hdr_raw
      hdr_lab[hdr_raw=="_uuid"]             <- "UUID"
      hdr_lab[hdr_raw=="_index"]            <- "Índice"
      hdr_lab[hdr_raw=="Código pulso"]      <- "Código pulso"
      hdr_lab[hdr_raw=="Seleccionadas"]     <- label_pref
      hdr_lab[hdr_raw=="Seleccionadas_cod"] <- "Seleccionadas (código)"
      if (!is.na(text_col) && nzchar(text_col) && (text_col %in% colnames(base))) {
        hdr_lab[hdr_raw==text_col] <- s_lab_from_original(text_col, inst)
      }
      hdr_lab[grepl("_recod$", hdr_raw)]    <- "Recodificación"

      add_sheet_row(row$parent_col, "select_multiple", base, hdr_raw, hdr_lab)

    } else if (identical(tipo, "integer")) {
      base <- .codif_build_integer_sheet(
        dat_raw = dat_raw,
        id_base = resolve_ids(dat_raw),
        row = row,
        inst = inst,
        label_map = label_map
      )
      if (is.null(base)) next

      var_col <- if (nzchar(row$parent_col)) row$parent_col else row$parent
      add_sheet_row(var_col, "integer", base, attr(base, "header_raw"), attr(base, "label_row"))

    } else if (identical(tipo, "text")) {
      txt_col <- row$parent_col
      if (!nzchar(txt_col) || !(txt_col %in% names(dat_raw))) next
      if (txt_col %in% assigned_texts) next

      base <- resolve_ids(dat_raw) %>%
        dplyr::mutate(!!txt_col := as.character(dat_raw[[txt_col]]))
      base[[paste0(txt_col,"_recod")]] <- NA_character_
      base[["Control"]] <- NA_character_

      cn <- colnames(base)
      base <- base[, c(cn[!grepl("_recod$", cn)], cn[grepl("_recod$", cn)]), drop = FALSE]

      hdr_raw <- names(base); hdr_lab <- hdr_raw
      hdr_lab[hdr_raw=="_uuid"]            <- "UUID"
      hdr_lab[hdr_raw=="_index"]           <- "Índice"
      hdr_lab[hdr_raw=="Código pulso"]     <- "Código pulso"
      # Para TEXT usar el parent_label de familias (o survey fallback)
      lbl_txt <- if (!is.na(row$parent_label) && nzchar(row$parent_label)) row$parent_label else s_lab_from_original(txt_col, inst)
      hdr_lab[hdr_raw==txt_col]            <- lbl_txt
      hdr_lab[grepl("_recod$", hdr_raw)]   <- "Recodificación"

      attr(base, "layout_version") <- "recod_v2"
      attr(base, "aux_block") <- .codif_make_aux_block(
        tipo = "text",
        target_col = paste0(txt_col, "_recod"),
        sheet_name = txt_col
      )
      add_sheet_row(txt_col, "text", base, hdr_raw, hdr_lab)
    }
  }

  # -------- Navegación (orden XLSForm) --------------------------------------
  nav_df <- dplyr::bind_rows(nav_rows)
  dic2 <- diccionario %>% dplyr::mutate(variable_raw = survey_dic$name)
  nav_df <- nav_df %>%
    dplyr::left_join(dic2 %>% dplyr::select(variable, variable_raw, q_order),
                     by = c("hoja" = "variable")) %>%
    dplyr::mutate(q_order = dplyr::coalesce(q_order,
                                            dic2$q_order[match(hoja, dic2$variable_raw)])) %>%
    dplyr::arrange(q_order,
                   factor(tipo, levels=c("select_one","select_multiple","integer","text")),
                   hoja)

  # -------- Parche final: relabel SM por label (por si quedaron códigos) ----
  relabel_sm_sheet <- function(plant_list, parent_col, choices_map) {
    df <- plant_list$sheets[[parent_col]]
    if (is.null(df)) return(plant_list)

    m <- choices_map %>% dplyr::filter(parent_col == !!parent_col) %>%
      dplyr::distinct(choice_code, choice_label)
    if (!nrow(m)) return(plant_list)

    code2lab <- as.character(m$choice_label); names(code2lab) <- as.character(m$choice_code)

    cn <- names(df); base_new <- cn
    for (j in seq_along(cn)) {
      nm <- cn[j]
      if (grepl("_recod$", nm)) next
      if (nm %in% names(code2lab) && nzchar(code2lab[[nm]])) {
        base_new[j] <- code2lab[[nm]]
        rec <- paste0(nm, "_recod")
        if (rec %in% cn) {
          idx <- which(cn == rec)
          base_new[idx] <- paste0(code2lab[[nm]], "_recod")
        }
      }
    }
    names(df) <- base_new

    hdr_lab <- attr(df, "label_row"); hdr_raw <- attr(df, "header_raw")
    if (!is.null(hdr_lab) && length(hdr_lab) == ncol(df)) {
      for (j in seq_along(hdr_lab)) {
        rawj <- hdr_raw[j]; basej <- sub("_recod$", "", rawj)
        if (basej %in% names(code2lab)) {
          if (!grepl("_recod$", rawj)) hdr_lab[j] <- code2lab[[basej]] else hdr_lab[j] <- "Recodificación"
        }
      }
      attr(df, "label_row") <- hdr_lab
    }
    plant_list$sheets[[parent_col]] <- df
    plant_list
  }

  plant_out <- list(
    diccionario = diccionario,
    choices     = choices_tbl,
    familias    = familias_tbl,
    navegacion  = nav_df %>% dplyr::select(hoja, tipo, n),
    sheets      = sheets_list
  )

  sm_parents <- plant_out$choices %>%
    dplyr::filter(tipo == "select_multiple") %>%
    dplyr::distinct(parent_col) %>% dplyr::pull(parent_col)

  for (p in sm_parents) {
    plant_out <- relabel_sm_sheet(plant_out, p, plant_out$choices)
  }

  # -------- Recalcular "Selección (label)" en SO (garantiza labels ES) ------
  so_parents <- plant_out$choices %>% dplyr::filter(tipo == "select_one") %>% dplyr::distinct(parent_col) %>% dplyr::pull(parent_col)
  for (p in so_parents) {
    df <- plant_out$sheets[[p]]
    if (is.null(df)) next
    tipo <- attr(df, "tipo")
    if (!identical(tolower(tipo), "select_one")) next

    cat_map <- plant_out$choices %>% dplyr::filter(parent_col == !!p) %>%
      dplyr::distinct(choice_code, choice_label)
    if (!nrow(cat_map)) next
    code2lab <- as.character(cat_map$choice_label); names(code2lab) <- as.character(cat_map$choice_code)

    if ("Selección (código)" %in% names(df)) {
      codes_chr <- as.character(df[["Selección (código)"]])
      lab_col   <- unname(code2lab[codes_chr])
      lab_col[is.na(lab_col)] <- codes_chr[is.na(lab_col)]
      df[["Selección (label)"]] <- lab_col
      plant_out$sheets[[p]] <- df
    }
  }

  plant_out
}
