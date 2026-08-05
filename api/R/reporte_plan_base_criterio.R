# =============================================================================
# reporte_plan_base_criterio.R — marca editorial de base reducida (B56 / W-8)
# =============================================================================
#
# DEFECTO que repara: «Base: 47 docentes» (válidos tras excluir SIN INF) y
# «Base: 52 docentes» (total) convivían tipográficamente idénticas en páginas
# contiguas del mismo reporte; el lector externo lee caída de campo o errata y
# compara porcentajes de denominadores distintos.
#
# DECISIÓN EDITORIAL (dueño de entregables, veredicto metodológico CAMBIAR):
# cuando la exclusión de opciones redujo el denominador, la nota de Base
# declara el criterio con la marca fija «(respuestas válidas)»:
#
#     Base: 47 docentes (respuestas válidas)
#     Base: 47 docentes y 150 estudiantes (respuestas válidas)   [prorrateado]
#
# Se eligió la marca genérica y NO las alternativas evaluadas porque:
#   - «(excluye SIN INF)» depende de la etiqueta de la opción excluida, que
#     varía por proyecto, puede ser múltiple y desborda el caption; además en
#     bases remapeadas la etiqueta mostrada difiere del choices sheet.
#   - «(47 de 52 válidas)» duplica el N y no compone en la base prorrateada
#     multiactor («47 de 52 y 150 de 150…» es ruido).
# «Respuestas válidas» es el término estándar (SPSS: porcentaje válido), es
# neutro al género del sufijo («docentes», «encuestas») y una sola marca al
# final cubre el prorrateo: los N mostrados son siempre los válidos por parte.
#
# INVARIANTES:
#   - En select_multiple la base sigue siendo el Total de respondentes aunque
#     se oculten opciones (guard en reporte_plan_ppt.R); la marca NO aparece.
#   - Sin exclusión efectiva NI pérdida por no-respuesta la nota queda
#     BYTE-IDÉNTICA a la histórica.
#   - Los filtros declarados del plan NO activan la marca por sí solos: son
#     una decisión de diseño visible del estudio; la marca señala denominadores
#     reducidos por exclusión de opciones o por no-respuesta del ítem (SIN INF
#     remapeada a NA por Limpieza — el mecanismo real del deck Conta). Con
#     filtro además, la marca aplica sobre el universo ya filtrado.

#' Marca editorial canónica de base reducida por exclusión de opciones.
#' @noRd
.reporte_plan_base_marca_criterio_txt <- function() {
  "(respuestas válidas)"
}

#' Universo (ponderado) de una fuente ya filtrada: la vara contra la que se
#' compara el Total válido de la frecuencia. Sin columna `peso` equivale a
#' nrow(); con pesos replica el denominador que usa `freq_table_spss()`.
#' @noRd
.reporte_plan_base_universo <- function(dsub) {
  if (is.null(dsub) || !is.data.frame(dsub) || !nrow(dsub)) return(NA_real_)
  w <- tryCatch(.peso_vec(dsub), error = function(e) NULL)
  if (is.null(w) || length(w) != nrow(dsub)) return(as.numeric(nrow(dsub)))
  s <- suppressWarnings(sum(as.numeric(w), na.rm = TRUE))
  if (!is.finite(s) || s <= 0) as.numeric(nrow(dsub)) else s
}

#' Tercera puerta de base reducida (además de exclusión y filtros): la
#' NO-RESPUESTA del ítem. En bases pasadas por Limpieza, «SIN INF» y pares se
#' remapean a NA, así que el Total de la frecuencia (válidos SPSS) ya llega
#' menor que el universo de la fuente — el caso real Conta: 47 de 52 docentes
#' sin `excluir_opciones` en el plan. Deterministo: Total válido < universo
#' filtrado (tolerancia numérica para sumas ponderadas).
#' @noRd
.reporte_plan_base_na_reducida <- function(N_total, dsub) {
  n <- suppressWarnings(as.numeric(N_total)[1])
  if (!is.finite(n)) return(FALSE)
  universo <- .reporte_plan_base_universo(dsub)
  is.finite(universo) && (universo - n) > 1e-6
}

#' Anexa la marca de criterio a un núcleo de nota de Base cuando el
#' denominador quedó reducido por exclusión. Con `reducida = FALSE` devuelve
#' el núcleo intacto (paridad byte a byte con el histórico).
#' @noRd
.reporte_plan_base_marca_criterio <- function(base_core, reducida = FALSE) {
  if (!isTRUE(reducida)) return(base_core)
  base1 <- as.character(base_core)[1]
  marca <- .reporte_plan_base_marca_criterio_txt()
  # Idempotente: cadenas re-selladas o re-compuestas no duplican la marca.
  if (grepl(marca, base1, fixed = TRUE)) return(base_core)
  paste(base1, marca)
}

#' Composición canónica de la nota de Base auto: N formateado + sufijo_auto
#' opcional + marca de criterio. Reemplaza 1:1 el bloque histórico de
#' `.base_auto_from_var` (reporte_plan_ppt.R, congelado a crecimiento):
#' con `reducida = FALSE` la salida es byte-idéntica a la de ese bloque.
#' @noRd
.reporte_plan_base_componer_nota <- function(N_total,
                                             sufijo_auto = NULL,
                                             formato = "Base: %s",
                                             reducida = FALSE) {
  N_pretty <- format(N_total, big.mark = ",", scientific = FALSE)

  suf <- NULL
  if (!is.null(sufijo_auto) && is.character(sufijo_auto) && length(sufijo_auto) == 1L) {
    sufijo_auto <- trimws(sufijo_auto)
    if (nzchar(sufijo_auto)) suf <- sufijo_auto
  }

  base_core <- if (is.null(suf)) N_pretty else paste(N_pretty, suf)
  sprintf(formato, .reporte_plan_base_marca_criterio(base_core, reducida))
}
