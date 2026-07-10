# =============================================================================
# Entregables / Dashboard / PDF conscientes de grupos repeat (ADR 0030, Fase 4)
# =============================================================================
#
# La Fase 1 dejó cada `begin_repeat` como una base HIJA long, vinculada a su base
# MADRE ancha con las llaves canónicas ODK/Kobo (`.KOBO_CHILD_META_COLS`) y
# `extra_meta` (`source_kind="kobo_repeat"`, `parent_base`, `repeat_group`,
# `link_key`, `grain`). La Fase 3 llevó ese enlace a Analítica (enriquecimiento
# hija×madre + meta de grano, dejada en `attr(inst, "repeat_grain")`).
#
# Esta fase asegura que la CAPA DE SALIDA no fugue basura técnica ni fantasmas y
# que anote la cardinalidad/grano. Cubre cuatro cosas:
#
#   A. Export/preview de Bases: suprimir las llaves técnicas de repeat
#      (`_index`/`_parent_index`/`_parent_table_name`/`_submission__id`) del SAV/
#      CSV/XLSX y del preview de metadata SPSS, SIN tocar las columnas heredadas
#      de la madre (`attr(col, "repeat_inherited") == TRUE`), que SÍ son variables
#      de análisis válidas.
#   B. Dashboard: reusa el filtro de fantasmas de la Fase 3
#      (`.analitica_repeat_phantom_names`, `repeat_depth > 0`) al construir las
#      secciones de la MADRE, para que no liste las preguntas del repeat.
#   C. PDF de formulario/codebook: marca "(repetible)" las secciones abiertas por
#      un `begin_repeat` (contenido/estructura; el naranja de UI es la Fase 5).
#   D. Ficha técnica / grano: nota de N a grano de instancia
#      (N=instancias ... de N personas) sobre una base hija.
#
# La lógica de repeats de la capa de entregables vive aquí (no engorda
# `helpers_bases.R`, `dashboard_secciones.R`, `reporte_formulario_pdf.R` ni
# `reporte_ficha_tecnica.R`); esos archivos la llaman con una línea. Reusa
# `.KOBO_CHILD_META_COLS` (`carga_kobo_repeats.R`) como fuente única de las llaves
# técnicas — un solo lugar para la lista.

# --- A. Supresión de llaves técnicas de repeat en export/preview ------------

#' Llaves técnicas de enlace repeat (ODK/Kobo) que NO deben aparecer en un
#' entregable de datos. Fuente única: `.KOBO_CHILD_META_COLS`.
#' @keywords internal
.repeat_technical_cols <- function() {
  if (exists(".KOBO_CHILD_META_COLS", inherits = TRUE)) {
    return(.KOBO_CHILD_META_COLS)
  }
  # Fallback defensivo si el módulo de carga no está cargado (mismo contrato).
  c("_index", "_parent_index", "_parent_table_name", "_submission__id")
}

#' Quita de un data.frame las llaves técnicas de repeat, preservando TODO lo
#' demás: las columnas de análisis, las heredadas de la madre
#' (`attr(col, "repeat_inherited") == TRUE`) y los atributos a nivel de
#' data.frame (p.ej. `instrumento_reporte`, que la ficha técnica lee). Idempotente
#' y seguro sobre bases sin repeats (no encuentra nada que quitar).
#' @keywords internal
.repeat_drop_technical_cols <- function(df) {
  if (!is.data.frame(df)) return(df)
  drop <- intersect(names(df), .repeat_technical_cols())
  if (!length(drop)) return(df)
  keep <- setdiff(names(df), drop)
  out <- df[, keep, drop = FALSE]
  # `[` conserva atributos de columna (labels, repeat_inherited) pero dropea los
  # atributos a nivel de data.frame; los restauramos para no romper la ficha.
  preserved <- setdiff(names(attributes(df)), c("names", "row.names", "class"))
  for (a in preserved) attr(out, a) <- attr(df, a)
  out
}

#' Filtra un vector de nombres de columna dejando fuera las llaves técnicas de
#' repeat (para el preview de metadata, que itera `names(df)`).
#' @keywords internal
.repeat_visible_col_names <- function(nms) {
  setdiff(as.character(nms), .repeat_technical_cols())
}

# --- C. Marca "(repetible)" para secciones repeat en el PDF/codebook ---------

#' Sufijo textual para una sección abierta por un `begin_repeat` en el
#' formulario/codebook (ADR 0030, Fase 4). Si el instrumento trae un
#' `repeat_count` entero se anota la cardinalidad máxima; si es una expresión
#' dinámica (`${var}`) o está ausente, se marca sólo "(repetible)". El color
#' naranja de la UI interactiva es la Fase 5: aquí basta la marca textual.
#' @keywords internal
.repeat_pdf_section_suffix <- function(repeatable = FALSE, repeat_count = NULL) {
  if (!isTRUE(repeatable)) return("")
  rc <- suppressWarnings(as.integer(repeat_count))
  if (length(rc) == 1L && !is.na(rc) && rc > 0L) {
    sprintf(" (repetible, hasta %d)", rc)
  } else {
    " (repetible)"
  }
}

# --- D. Nota de grano de instancia para la ficha técnica --------------------

#' Nota metodológica de grano de INSTANCIA para la ficha técnica de una base hija
#' repeat. Reusa el meta de grano de la Fase 3 (`.analitica_repeat_grain`, que se
#' deja en `attr(inst, "repeat_grain")`). Devuelve "" si no hay grano de repeat,
#' de modo que las bases normales no reciben ninguna nota.
#' @keywords internal
.repeat_grain_ficha_nota <- function(grain) {
  if (!is.list(grain) || !identical(as.character(grain$kind %||% ""), "instancia")) {
    return("")
  }
  n_inst <- suppressWarnings(as.integer(grain$n_instancias))
  n_pers <- suppressWarnings(as.integer(grain$n_personas))
  if (length(n_inst) != 1L || is.na(n_inst)) return("")
  grupo <- as.character(grain$repeat_group %||% "")
  grupo_txt <- if (nzchar(grupo)) sprintf(" del grupo repetible '%s'", grupo) else ""
  pers_txt <- if (length(n_pers) == 1L && !is.na(n_pers)) {
    sprintf(" correspondientes a %s personas", format(n_pers, big.mark = ","))
  } else {
    ""
  }
  sprintf(
    paste0(
      "El grano de esta base es la INSTANCIA del repeat: N=%s instancias%s%s ",
      "(1 fila = 1 registro del roster). La significancia de cruces sobre esta ",
      "base ignora el clustering por persona."
    ),
    format(n_inst, big.mark = ","), grupo_txt, pers_txt
  )
}

#' Grano de repeat asociado a un instrumento, si la Fase 3 lo dejó en
#' `attr(inst, "repeat_grain")`. NULL si no aplica.
#' @keywords internal
.repeat_grain_from_inst <- function(instrumento) {
  if (is.null(instrumento)) return(NULL)
  attr(instrumento, "repeat_grain", exact = TRUE)
}
