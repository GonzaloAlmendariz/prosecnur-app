# =============================================================================
# graficos_estilo_cliente_worker.R — el estilo del cliente dentro del worker del export (Word y PPT, D5 / ID9)
# =============================================================================
#
# Un solo camino para los workers de graficos_jobs.R: el router resuelve el estilo con
# `.graficos_estilo_cliente_resolver(sid, cfg, medio)` (rutas de logos, desplazamientos de letra y avisos) y lo pasa SÓLO
# si hay algo; el worker lo aplica aquí y repone las opciones al salir (`on.exit(options(ec$previas), add = TRUE)`).
#
# - Avisos del resolver: salen tal cual al resultado del job (`.pulso_aviso`).
# - Letra K13: `prosecnur.letra_desplazo` (estandar_tokens.R la suma a los tokens de cada rol; piso de 8 pt en cifras).
# - Logos: en el Word van a `opciones_documento$logos` (lo hace el worker con `ec$logos`); en el PPT, a la opción
#   `prosecnur.logos_cliente`, que leen la portada y el cierre nativos (lamina_logos_cliente.R). Con una plantilla de
#   cliente no se ponen: su portada es suya, y se avisa la causa.

#' Opciones del proceso que toca el estilo del cliente, para reponerlas al salir
#' @keywords internal
.graficos_estilo_cliente_previas <- function() {
  list(prosecnur.letra_desplazo = getOption("prosecnur.letra_desplazo"), prosecnur.logos_cliente = getOption("prosecnur.logos_cliente"))
}

#' Argumento `estilo_cliente` para el job: `list(estilo_cliente = .)` si hay algo que aplicar, `list()` si no
#'
#' Sólo viaja si hay algo: un worker instalado sin este argumento sigue funcionando mientras no se use.
#' @keywords internal
.graficos_estilo_cliente_arg <- function(sid, cfg, medio = "word") {
  est <- .graficos_estilo_cliente_resolver(sid, cfg, medio)
  if (length(est)) list(estilo_cliente = est) else list()
}

.ec_con_base <- function(base, m) if (nzchar(base %||% "")) sprintf("%s: %s", base, m) else m

#' Aplica el estilo del cliente en el worker de un export
#'
#' @param estilo_cliente Lo que entrega `.graficos_estilo_cliente_resolver` (`list()` si no hay nada).
#' @param medio `"word"` o `"ppt"`.
#' @param template_pptx Plantilla del PPT (NULL o vacío = la estándar de PULSO).
#' @param base Base del mazo, para encabezar los avisos del export de todas las bases.
#' @return `list(previas, logos)`: `previas` para `on.exit(options(.))`; `logos` los que el documento debe poner.
#' @keywords internal
.graficos_estilo_cliente_iniciar <- function(estilo_cliente, medio = c("word", "ppt"), template_pptx = NULL, base = "") {
  medio <- match.arg(medio)
  previas <- .graficos_estilo_cliente_previas()
  if (identical(medio, "ppt")) .lam_logos_cliente_reiniciar()
  if (!length(estilo_cliente)) return(list(previas = previas, logos = list()))
  for (aviso in estilo_cliente$avisos %||% character(0)) .pulso_aviso(.ec_con_base(base, aviso))
  .graficos_estilo_cliente_aplicar_letra(estilo_cliente$letra)
  logos <- estilo_cliente$logos %||% list()
  if (identical(medio, "ppt")) {
    tpl <- as.character(template_pptx %||% "")[1]
    if (length(logos) && !is.na(tpl) && nzchar(tpl) && !.lam_plantilla_estandar(tpl)) {
      .pulso_aviso(.ec_con_base(base, sprintf("La plantilla «%s» trae su propia portada: los logos propios no se ponen en ella.",
                                              tools::file_path_sans_ext(basename(tpl)))))
      logos <- list()
    }
    options(prosecnur.logos_cliente = if (length(logos)) logos else NULL)
  }
  list(previas = previas, logos = logos)
}

#' Tras renderizar el PPT: avisa, con su causa, de los logos propios que no llegaron a la portada o al cierre
#'
#' La portada y el cierre del recetario sólo se dibujan en nativo si la lámina lo es y su contenido cabe; si no, el mazo
#' usa la lámina de la plantilla tal cual y su logo. Sin portada (o sin cierre) en el plan no hay nada que avisar.
#' @param ec Lo que devolvió `.graficos_estilo_cliente_iniciar`.
#' @param slides_r Láminas del plan (cada una con su `.slide_type`).
#' @keywords internal
.graficos_estilo_cliente_cerrar_ppt <- function(ec, slides_r, base = "") {
  pendientes <- setdiff(names(ec$logos %||% list()), .lam_logos_cliente_puestos())
  if (!length(pendientes)) return(invisible(character(0)))
  tipos <- vapply(slides_r, function(s) as.character((if (is.list(s)) s$.slide_type else NULL) %||% NA_character_)[1], "")
  avisos <- character(0)
  if (any(startsWith(pendientes, "portada_")) && "title_slide" %in% tipos) {
    avisos <- c(avisos, "La portada no salió con la composición del recetario (lámina no nativa o título que no cabe en tres líneas): lleva los logos de la plantilla, no los propios.")
  }
  if ("contraportada" %in% pendientes && "cierre" %in% tipos) {
    avisos <- c(avisos, "El cierre no salió con la composición del recetario (el contacto no cabe en su variante): lleva el logo de la plantilla, no el propio.")
  }
  for (m in avisos) .pulso_aviso(.ec_con_base(base, m))
  invisible(avisos)
}
