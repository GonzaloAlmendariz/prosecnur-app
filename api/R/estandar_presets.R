# =============================================================================
# estandar_presets.R — los proyectos guardados migran solos al estándar (ADR 0092)
# =============================================================================
#
# La UI de Base PPT guarda TODOS los args del preset, así que un proyecto viejo
# trae su propia copia del estilo de entonces (base a 14 pt, leyenda a 16, cifras
# a 5.6) y esa copia gana sobre el suelo de fábrica. Medido el 2026-10-08 sobre
# el mazo de referencia: con el suelo ya en 10 pt, las 58 láminas seguían
# escribiendo la base a 14 porque la sacaban del proyecto.
#
# Decisión de Gonzalo (2026-10-08): «El recetario es el estándar» y los
# proyectos «migran solos», con aviso de lo que cambia. Las claves de esta tabla
# las fija el estándar y dejan de ser una preferencia del proyecto: se imponen al
# normalizar la config y al renderizar. Cuando el valor guardado era otro, el
# render lo dice con nombre (`[PULSO-AVISO]`); nunca se pisa en silencio.
#
# Sólo entran claves cuyo significado en el motor es inequívoco. Colores y
# paletas quedan fuera: son lo único que un perfil de cliente puede cambiar.

#' Claves de `base` que fija el estándar, con su valor y su token de origen
#' @keywords internal
.std_claves_base <- function() {
  list(
    size_nota_pie     = list(valor = .std_pt("base"),    token = "tipografia.base"),
    size_titulo_slide = list(valor = .std_pt("titulo"),  token = "tipografia.titulo"),
    size_leyenda      = list(valor = .std_pt("leyenda"), token = "tipografia.leyenda"),
    # Las cifras de barra viajan en milímetros de ggplot (1 mm = 72.27 / 25.4 pt).
    size_texto_barras = list(valor = round(.std_pt("cifra") * 25.4 / 72.27, 2), token = "tipografia.cifra"),
    font_family       = list(valor = .std_pt("fuente"),  token = "tipografia.fuente")
  )
}

#' Impone el estándar sobre `presets$base` (y `base$args` si existe)
#'
#' @param presets Presets del proyecto o del body del render.
#' @param avisar Si `TRUE`, emite un `[PULSO-AVISO]` con las claves cuyo valor
#'   guardado difería del estándar.
#' @return Los presets con las claves del estándar impuestas.
#' @keywords internal
.std_imponer_base <- function(presets, avisar = FALSE) {
  if (!is.list(presets)) return(presets)
  claves <- tryCatch(.std_claves_base(), error = function(e) NULL)
  if (is.null(claves)) return(presets)
  base <- presets$base
  if (!is.list(base)) return(presets)
  cambios <- character(0)
  for (nm in names(claves)) {
    nuevo <- claves[[nm]]$valor
    for (donde in c("base", "args")) {
      holder <- if (identical(donde, "base")) base else base$args
      if (!is.list(holder)) next
      viejo <- holder[[nm]]
      # Una clave ausente no se crea: ahí rige el suelo de fábrica, que ya es el
      # estándar, y «no configurado» sigue siendo un estado que el motor distingue.
      if (is.null(viejo)) next
      if (!identical(as.character(viejo)[1], as.character(nuevo))) {
        cambios <- c(cambios, sprintf("%s %s → %s", nm, as.character(viejo)[1], as.character(nuevo)))
      }
      if (identical(donde, "base")) base[[nm]] <- nuevo else base$args[[nm]] <- nuevo
    }
  }
  presets$base <- base
  cambios <- unique(cambios)
  if (isTRUE(avisar) && length(cambios)) {
    .pulso_aviso(
      "El estilo guardado en el proyecto se ajustó al estándar de los recetarios (ADR 0092): ",
      paste(cambios, collapse = ", "), "."
    )
  }
  presets
}
