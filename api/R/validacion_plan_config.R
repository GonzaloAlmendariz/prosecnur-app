# plan_config.R
# -------------------------------------------------------------------
# ¿Qué hace este archivo?
# 1) Define una CONFIGURACIÓN de proyecto (prefijos por sección,
#    patrones para "Other", rangos por defecto, convención de nombres,
#    padding de IDs, etc.).
# 2) Expone helpers para APLICAR esa configuración sobre el
#    section_map DEVUELTO por read_xlsform() (sin rehacerlo).
# 3) Ofrece utilitarios para generar expresiones R de validación
#    (usados luego por la “fábrica” de reglas).
# -------------------------------------------------------------------

#' Crear configuración estilo ACNUR (solo ajustes, no reconstruye secciones)
#'
#' @param section_prefix_map named list opcional para forzar prefijos por sección.
#'        Claves pueden ser group_name o group_label de x$meta$section_map.
#'        Ej: list("mand_Expenditure"="EXP_", "Uso de efectivo en Salud"="SAL_")
#' @param other_alias vector de alias que significan "Other" en opciones.
#'        Se usa para formar el regex de tokenización.
#' @param valid_ranges lista de rangos por defecto (puedes extenderla en tu proyecto).
#' @param id_padding enteros para IDs (DEM_001, REP_012…).
#' @param naming lista con convenciones (prefijos/sufijos de flags, snake-case, etc.)
#' @return lista de configuración
#' @family validacion
#' @export
    acnur_config <- function(
    section_prefix_map = list(),         # ya lo tienes
    other_alias = c("Other","Otro","Otra"),
    control_required_vars = character(), # NUEVO: c("Consent","Unique_identifier_number", ...)
    expected_constants = list(),         # NUEVO: list(Data_collected_through="Phone_interview", mand_Country="PER")
    outlier_ranges = list()              # NUEVO: list(Male_0_5 = list(min=0, max=10), ...)
    ) {
      list(
        section_prefix_map = section_prefix_map,
        other_alias = other_alias,
        control_required_vars = control_required_vars,
        expected_constants = expected_constants,
        outlier_ranges = outlier_ranges
      )
    }

# -------------------------------------------------------------------
#  APLICAR CONFIG A UN SECTION MAP (de read_xlsform())
# -------------------------------------------------------------------

#' Aplicar overrides de prefijos a un section_map existente
#'
#' @param section_map tibble con columnas group_name, group_label, prefix.
#' @param config lista devuelta por acnur_config().
#' @return tibble igual a section_map pero con prefijos sobreescritos (si aplica).
#' @family validacion
#' @export
apply_config_to_section_map <- function(section_map, config) {
  stopifnot(
    all(c("group_name","group_label","prefix") %in% names(section_map)),
    is.list(config), "section_prefix_map" %in% names(config)
  )

  if (!length(config$section_prefix_map)) return(section_map)

  # Para cada fila, si hay override por group_name o por group_label, aplicarlo.
  new_prefix <- mapply(
    FUN = function(gn, gl, pfx) {
      if (!is.null(config$section_prefix_map[[gn]])) {
        return(config$section_prefix_map[[gn]])
      }
      if (!is.null(config$section_prefix_map[[gl]])) {
        return(config$section_prefix_map[[gl]])
      }
      pfx
    },
    section_map$group_name,
    section_map$group_label,
    section_map$prefix,
    SIMPLIFY = TRUE,
    USE.NAMES = FALSE
  )

  section_map$prefix <- as.character(new_prefix)
  section_map
}

# -------------------------------------------------------------------
#  HELPERS de nomenclatura y expresiones para el “Procesamiento - R”
# -------------------------------------------------------------------

#' Armar un nombre de regla/flag "seguro" (snake_case, sin acentos ni símbolos)
#' @param x base name
#' @param config config con convenciones (prefix/suffix opcionales)
#' @return string en snake_case coherente con la config
#' @family validacion
#' @export
to_snake_safe <- function(x, config = acnur_config()) {
  out <- tolower(x)
  out <- iconv(out, from = "", to = "ASCII//TRANSLIT")  # quita acentos
  out <- gsub("[^a-z0-9]+", "_", out)
  out <- gsub("^_+|_+$", "", out)
  if (isTRUE(config$naming$snake_case)) out else x
}

#' Formatear ID con padding: PREFIJO + 3 dígitos (por defecto)
#' @param prefix string tipo "DEM_" o "REP_"
#' @param index entero secuencial
#' @param config config con id_padding
#' @return "DEM_001", "REP_012", etc.
#' @family validacion
#' @export
format_id <- function(prefix, index, config = acnur_config()) {
  sprintf("%s%0*d", prefix, config$id_padding %||% 3L, as.integer(index))
}

#' Construir el regex de token para "Other" desde la config
#' @details Devuelve un patrón OR con límites de token por espacios:
#'          "(^|\\s)(Other|Otro|Otra)(\\s|$)"
#' @family validacion
#' @export
pattern_other_token <- function(config = acnur_config()) {
  alias <- unique(config$other_alias)
  alias <- gsub("([\\W])", "\\\\\\1", alias, perl = TRUE)   # escapar símbolos
  sprintf("(^|\\s)(%s)(\\s|$)", paste(alias, collapse = "|"))
}

#' Expresión R: variable de texto/categoría NO vacía
#' @param var nombre de variable
#' @return string con la condición booleana
#' @family validacion
#' @export
expr_not_empty <- function(var) {
  sprintf("(!is.na(%s)) & (trimws(%s) != \"\")", var, var)
}

#' Expresión R: rango numérico robusto
#' @param var nombre de variable
#' @param a min
#' @param b max
#' @return string with between(suppressWarnings(as.numeric(var)), a, b)
#' @family validacion
#' @export
expr_between_num <- function(var, a, b) {
  sprintf("between(suppressWarnings(as.numeric(%s)), %s, %s)",
          var, as.character(a), as.character(b))
}

#' Expresión R: “si incluye Other en select_multiple ⇒ requiere texto especificar”
#' @param mult nombre de la variable select_multiple (string)
#' @param other_txt nombre de la variable texto “otro, especificar” (string)
#' @param config config con other_alias
#' @return string booleana de “OK” (TRUE = consistente)
#' @family validacion
#' @export
expr_other_implies_text <- function(mult, other_txt, config = acnur_config()) {
  pat <- pattern_other_token(config)
  sprintf("!(grepl(\"%s\", %s) & (is.na(%s) | trimws(%s) == \"\"))",
          pat, mult, other_txt, other_txt)
}

#' Expresión R: “si NO incluye Other ⇒ NO debe haber texto especificar”
#' @param mult nombre de la variable select_multiple
#' @param other_txt nombre de texto “otro”
#' @param config config con other_alias
#' @return string booleana de “OK” (TRUE = consistente)
#' @family validacion
#' @export
expr_no_other_no_text <- function(mult, other_txt, config = acnur_config()) {
  pat <- pattern_other_token(config)
  sprintf("!((!grepl(\"%s\", %s)) & (!is.na(%s) & trimws(%s) != \"\"))",
          pat, mult, other_txt, other_txt)
}

# Operador %||% auxiliar
`%||%` <- function(a, b) if (is.null(a)) b else a


#' Construir mapa de secciones (group -> prefix) de forma automática
#'
#' Genera un `section_map` mínimo a partir del `survey` ya leído, con
#' columnas: `group_name`, `group_label` y `prefix`.
#'
#' Reglas:
#' - Si se provee `section_prefix_map` (vector/lista nombrada donde los
#'   *nombres* son `group_name` **o** `group_label` y los *valores* son
#'   prefijos como `"USO_"`), se respeta para esos grupos.
#' - Para los grupos no mapeados, se genera un prefijo **a partir del
#'   `group_label` (si existe; si no, del `group_name`)**:
#'     - Se normaliza a ASCII (sin tildes), mayúsculas y alfanumérico.
#'     - Se toman las **tres primeras consonantes**; si no alcanzan,
#'       se completa con las primeras letras disponibles.
#'     - Se asegura sufijo `"_"` (quedan como `ABC_`).
#' - Se garantiza unicidad de prefijos. Si hay colisión, se agrega un
#'   sufijo `_A_`, `_B_`, ... respetando la forma `XXX_`, `XXX_A_`, etc.
#'
#' @param survey_df Data frame del survey (como lo entrega `read_xlsform()`),
#'   debe contener al menos la columna `group_name`. Si existe `group_label`
#'   se usará para la segunda columna del mapa; si no, se rellena con `group_name`.
#' @param section_prefix_map (opcional) vector o lista *nombrada* que mapea
#'   `group_name` **o** `group_label` -> `prefix`.
#'
#' @return Un `tibble` con columnas `group_name`, `group_label`, `prefix`.
#' @keywords internal
auto_section_map <- function(survey_df, section_prefix_map = NULL) {
  stopifnot(is.data.frame(survey_df))
  if (!"group_name" %in% names(survey_df)) {
    stop("`survey_df` debe incluir una columna `group_name`.")
  }

  # Tomar grupos únicos (ignorando vacíos)
  keep_cols <- intersect(c("group_name", "group_label"), names(survey_df))
  grp <- unique(survey_df[, keep_cols, drop = FALSE])
  grp$group_name <- as.character(grp$group_name)
  if (!"group_label" %in% names(grp)) grp$group_label <- grp$group_name
  grp <- grp[!is.na(grp$group_name) & nzchar(grp$group_name), , drop = FALSE]

  # helper: transliterar a ASCII
  .to_ascii <- function(x) {
    y <- iconv(x, from = "", to = "ASCII//TRANSLIT")
    ifelse(is.na(y), x, y)
  }

  # helper: prefijo desde LABEL (3 consonantes o completar con letras)
  .prefix_from_label <- function(lbl) {
    if (is.null(lbl) || !nzchar(lbl)) return("GEN_")
    s <- .to_ascii(lbl)
    s <- toupper(s)
    s <- gsub("[^A-Z0-9 ]+", " ", s)      # dejar letras, números y espacios
    s <- gsub("\\s+", " ", trimws(s))

    letters_only <- gsub("[^A-Z]", "", s)
    consonants   <- gsub("[AEIOU]", "", letters_only)

    core <- if (nchar(consonants) >= 3) {
      substr(consonants, 1, 3)
    } else if (nchar(letters_only) >= 3) {
      substr(letters_only, 1, 3)
    } else if (nchar(letters_only) > 0) {
      # pad hasta 3 y reemplazar espacios por X
      co <- sprintf("%-3s", letters_only)
      gsub(" ", "X", co)
    } else {
      "GEN"
    }

    paste0(core, "_")
  }

  # base: prefijo automático desde el LABEL (fallback a name)
  base_prefix <- mapply(
    function(glab, gname) {
      lbl <- ifelse(is.na(glab) | !nzchar(glab), gname, glab)
      .prefix_from_label(lbl)
    },
    grp$group_label, grp$group_name,
    USE.NAMES = FALSE
  )

  # aplicar overrides (pueden venir por group_name o group_label)
  if (!is.null(section_prefix_map) && length(section_prefix_map)) {
    spm <- section_prefix_map
    if (is.list(spm)) spm <- unlist(spm, recursive = FALSE, use.names = TRUE)
    spm <- as.character(spm)
    nm  <- names(spm)

    # normalizar valores (asegurar underscore final y mayúsculas)
    norm_val <- function(p) {
      p <- as.character(p)
      if (!nzchar(p)) return(p)
      p <- toupper(p)
      if (!grepl("_$", p)) p <- paste0(p, "_")
      p
    }
    spm_vals <- vapply(spm, norm_val, character(1))
    names(spm_vals) <- toupper(nm)

    idx_name  <- match(toupper(grp$group_name),  names(spm_vals))
    idx_label <- match(toupper(grp$group_label), names(spm_vals))

    override <- rep(NA_character_, nrow(grp))
    if (any(!is.na(idx_name)))  override[!is.na(idx_name)]  <- spm_vals[idx_name[!is.na(idx_name)]]
    need <- is.na(override) & !is.na(idx_label)
    if (any(need)) override[need] <- spm_vals[idx_label[need]]

    repl <- !is.na(override) & nzchar(override)
    base_prefix[repl] <- override[repl]
  }

  # asegurar underscore final y mayúsculas
  base_prefix <- toupper(base_prefix)
  need_us <- !grepl("_$", base_prefix)
  if (any(need_us)) base_prefix[need_us] <- paste0(base_prefix[need_us], "_")

  # resolver colisiones: XXX_, XXX_ ya usado -> XXX_A_, XXX_B_, ...
  make_unique <- function(pref_vec) {
    out  <- character(length(pref_vec))
    used <- character(0)

    next_suffix <- function(k) {
      # _A_, _B_, ... _Z_, _AA_, _AB_, ...
      letters2 <- c(LETTERS, as.vector(outer(LETTERS, LETTERS, paste0)))
      paste0("_", letters2[k], "_")
    }

    for (i in seq_along(pref_vec)) {
      p <- pref_vec[i]
      if (!p %in% used) {
        out[i] <- p
        used <- c(used, p)
      } else {
        core <- sub("_$", "", p)
        k <- 1L
        cand <- paste0(core, next_suffix(k))
        while (cand %in% used) {
          k <- k + 1L
          cand <- paste0(core, next_suffix(k))
        }
        out[i] <- cand
        used <- c(used, cand)
      }
    }
    out
  }

  final_prefix <- make_unique(base_prefix)

  tibble::tibble(
    group_name  = grp$group_name,
    group_label = ifelse(is.na(grp$group_label) | !nzchar(grp$group_label),
                         grp$group_name, grp$group_label),
    prefix      = final_prefix
  )
}






