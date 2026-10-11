# =============================================================================
# reporte_plan_ceros_especiales.R — frecuencias del plan sin resucitar 90-99 ausentes (C40 D2)
# =============================================================================
#
# Invariante dominio-prosecnur §5 / nucleo-metodologico regla 3: los códigos especiales 90-99 nunca se borran de los
# datos y sólo se muestran si están presentes. Una categoría sustantiva sin casos sí puede mostrarse (mostrar_ceros).
# `reporte_plan_ppt.R` (congelado a crecimiento) pedía `freq_table_spss(mostrar_todo = TRUE)` sin
# `codigos_solo_si_presentes`, así que con `incluir_sin_n` reaparecían 98/99 al 0 % en PPT y Word.
#
# `referencia` es la data sobre la que se decide la presencia. En un cruce, el subgrupo se tabula con su propia data
# pero la presencia se decide sobre la base completa: un 98 presente en el Total sigue alineado en todos los grupos
# (al 0 % donde no tiene casos) y uno ausente de toda la base no aparece en ninguno.

#' Códigos especiales 90-99 declarados para `var` en el instrumento
#' @keywords internal
.plan_codigos_especiales <- function(orders_list, var) {
  entry <- .freq_orders_entry(orders_list, var)
  if (is.null(entry)) return(list(codes = character(0), labels = character(0)))
  es <- grepl("^9[0-9]$", trimws(entry$names))
  list(codes = entry$names[es], labels = as.character(entry$labels)[es])
}

#' `freq_table_spss()` (por defecto `mostrar_todo = TRUE, casos = TRUE`) sin filas de especiales 90-99 ausentes de `referencia`
#' @keywords internal
.plan_freq_tabla <- function(data, var, survey = NULL, sm_vars_force = NULL, orders_list = NULL,
                             mostrar_todo = TRUE, casos = TRUE, referencia = NULL) {
  esp <- .plan_codigos_especiales(orders_list, var)
  propia <- is.null(referencia)
  tab <- freq_table_spss(
    data, var, survey = survey, sm_vars_force = sm_vars_force, orders_list = orders_list,
    mostrar_todo = mostrar_todo, casos = casos,
    codigos_solo_si_presentes = if (propia && length(esp$codes)) esp$codes else NULL
  )
  if (!length(esp$labels) || !is.data.frame(tab) || !nrow(tab) || !all(c("Opciones", "n") %in% names(tab))) {
    return(tab)
  }
  ref_tab <- if (propia) tab else .plan_freq_presencia(referencia, var, survey, sm_vars_force, orders_list)
  presentes <- .plan_opciones_con_casos(ref_tab)
  sobra <- as.character(tab$Opciones) %in% esp$labels & !(as.character(tab$Opciones) %in% presentes)
  if (any(sobra)) tab <- tab[!sobra, , drop = FALSE]
  tab
}

#' @keywords internal
.plan_freq_presencia <- function(referencia, var, survey, sm_vars_force, orders_list) {
  if (!is.data.frame(referencia) || !nrow(referencia)) return(NULL)
  freq_table_spss(referencia, var, survey = survey, sm_vars_force = sm_vars_force, orders_list = orders_list,
                  mostrar_todo = FALSE, casos = TRUE)
}

#' Rótulos con al menos un caso (ponderado o sin ponderar) en una tabla de frecuencias
#' @keywords internal
.plan_opciones_con_casos <- function(tab) {
  if (!is.data.frame(tab) || !nrow(tab) || !all(c("Opciones", "n") %in% names(tab))) return(character(0))
  n <- suppressWarnings(as.numeric(tab$n)); n[!is.finite(n)] <- 0
  nc <- if ("n_casos" %in% names(tab)) suppressWarnings(as.numeric(tab$n_casos)) else n
  nc[!is.finite(nc)] <- 0
  as.character(tab$Opciones)[(n > 0 | nc > 0) & as.character(tab$Opciones) != "Total"]
}
