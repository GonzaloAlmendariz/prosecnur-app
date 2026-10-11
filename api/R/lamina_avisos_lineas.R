# =============================================================================
# lamina_avisos_lineas.R — avisos con el conteo de líneas que parte una lámina o desborda su título (K12b, F6 §4.3c)
# =============================================================================
#
# El motor nativo no encoge la letra: si las premisas no caben, parte la lámina en «(cont.)», y un título largo
# ocupa las líneas que necesite. El analista se enteraba mirando el PPT. Aquí cada compositor lo dice una vez por
# lámina, con el número que lo causó, por el canal sellado de avisos (`.pulso_aviso`, jobs.R) que la vista previa y
# los jobs ya recogen. Las líneas se cuentan como se componen: corte por palabras sobre la tinta de Arial
# (`.lam_lineas_tinta`) en el ancho de la columna de premisas o de la caja del título. Sólo avisa: la lámina no cambia.
#
# Verificador de K12b (acrconta): una escala ancha la parte primero el plan por barras (`.plan_particionar_escalas`) y
# luego el compositor parte cada pieza por alto. Cada partición avisaba por su lado con su propia cifra («se partió en
# 2», «salió en 2 partes») y ninguna era la de la salida: BIENESTAR UNIVERSITARIO salía en 3 láminas. Dentro de
# `reporte_ppt_plan` los compositores sólo anotan lo que midieron; el motor marca el comienzo de cada lámina del plan
# (`.lam_avisos_paso`) y al terminar (`.lam_avisos_cierre`) emite un aviso por lámina LÓGICA —las piezas que salieron
# de una misma lámina del plan— con las láminas que de verdad salieron. Fuera de un mazo (un compositor llamado solo)
# se avisa al momento, como antes.

#' Título de la lámina para un aviso
#' @keywords internal
.lam_aviso_nombre <- function(titulo) {
  t <- trimws(as.character(titulo %||% "")[1])
  if (is.na(t) || !nzchar(t)) "Lámina sin título" else sprintf("“%s”", t)
}

.lam_aviso_lineas_txt <- function(n) sprintf("%d %s", as.integer(n), if (n == 1L) "línea" else "líneas")

.lam_avisos_estado <- new.env(parent = emptyenv())

#' ¿Hay un mazo en curso que recoja los avisos de líneas?
#' @keywords internal
.lam_avisos_activo <- function() !is.null(.lam_avisos_estado$actual)

#' Suelta el registro abierto por el mazo `token` (lo llama la salida de `reporte_ppt_plan`, normal o por error)
#' @keywords internal
.lam_avisos_soltar <- function(token) {
  e <- .lam_avisos_estado
  if (identical(e$token, token)) { e$actual <- NULL; e$token <- NULL; e$notas <- list(); e$inicio <- integer(); e$rotulo <- NULL }
  invisible(NULL)
}

#' Anota en la lámina del plan en curso lo que midió un compositor (se queda el máximo)
#' @keywords internal
.lam_avisos_anotar <- function(lineas = NULL, titulo_lineas = NULL, titulo = NULL) {
  i <- .lam_avisos_estado$actual
  n <- .lam_avisos_estado$notas[[as.character(i)]] %||% list()
  if (!is.null(lineas)) n$lineas <- max(n$lineas %||% 0L, as.integer(lineas))
  if (!is.null(titulo_lineas) && is.null(n$titulo_lineas)) { n$titulo_lineas <- as.integer(titulo_lineas); n$titulo <- titulo }
  .lam_avisos_estado$notas[[as.character(i)]] <- n
  invisible(TRUE)
}

#' Marca el comienzo de la lámina `i` del plan y la devuelve (enganche del bucle de `reporte_ppt_plan`)
#'
#' La primera lámina reinicia el registro. `doc` es el documento officer (o `NULL` sin archivo, el Word): su largo antes
#' de cada lámina dice cuántas láminas salieron de cada una.
#' @keywords internal
.lam_avisos_paso <- function(plan, i, doc) {
  e <- .lam_avisos_estado
  if (i == 1L) {
    e$inicio <- integer(); e$notas <- list()
    # El registro se suelta cuando sale el `reporte_ppt_plan` que lo abrió, también si falla a mitad. No se guarda su
    # marco: retenía sus objetos —datos incluidos— hasta el mazo siguiente (verificador de K12b). La salida se
    # registra en ese marco con `on.exit(add = TRUE)`, como `withr::defer`, sin sumar dependencias.
    e$token <- token <- paste0("mazo-", format(Sys.time(), "%OS6"), "-", sample.int(.Machine$integer.max, 1L))
    do.call(base::on.exit, list(bquote(.lam_avisos_soltar(.(token))), add = TRUE, after = TRUE), envir = parent.frame())
  }
  e$inicio[i] <- if (is.null(doc)) NA_integer_ else length(doc)
  e$actual <- i
  # Rótulo de la lámina que se dibuja, para los avisos que no son de líneas (`.aviso_en_lamina`, graficos_avisos_texto.R).
  # Su número es la posición en el plan del usuario —la que navega la UI—, no la del PPTX: con particiones y «Otros» el
  # PPTX llega a 91 en un plan de 67 (verificador de B-g).
  e$rotulo <- list(numero = .lam_posicion_usuario(plan, i) + as.integer(getOption("prosecnur.lam_folio_desplazo", 0L)),
                   titulo = if (is.list(plan[[i]])) .lam_avisos_titulo_de(plan[[i]]), base = getOption("prosecnur.lam_avisos_base"))
  plan[[i]]
}

#' Posición de la lámina `i` en el plan del usuario: las piezas de una partición cuentan una vez y las «Otros» que inserta
#' el motor (`meta$auto_otros`) no cuentan —la «Otros» lleva el número de la lámina a la que sigue—
#' @keywords internal
.lam_posicion_usuario <- function(plan, i) {
  idx <- seq_len(i)
  ids <- vapply(idx, function(k) as.character((attr(plan[[k]], "pulso_particion") %||% list(id = paste0("l", k)))$id)[1], "")
  primeras <- match(unique(ids), ids)
  insertada <- vapply(primeras, function(k) { s <- plan[[k]]; is.list(s) && isTRUE((s$meta %||% list())$auto_otros) }, logical(1))
  max(1L, sum(!insertada))
}

#' Emite los avisos de líneas del mazo, uno por lámina lógica, y cierra el registro
#'
#' Las piezas de una partición del plan llevan el atributo `pulso_particion` (`id`, `barras`, `techo`, `titulo`); las
#' demás láminas son su propia lámina lógica. Sin archivo (`doc` `NULL`, el Word) cada pieza es una figura.
#' @return `doc`, intacto.
#' @keywords internal
.lam_avisos_cierre <- function(plan, doc) {
  e <- .lam_avisos_estado
  e$rotulo <- NULL
  if (!.lam_avisos_activo() || !length(plan)) { e$actual <- NULL; return(invisible(doc)) }
  on.exit(.lam_avisos_soltar(e$token), add = TRUE)
  n <- length(plan)
  inicio <- e$inicio[seq_len(n)]
  salieron <- if (is.null(doc) || anyNA(inicio)) rep(1L, n) else diff(c(inicio, length(doc)))
  ids <- vapply(seq_len(n), function(i) as.character((attr(plan[[i]], "pulso_particion") %||% list(id = paste0("l", i)))$id)[1], "")
  # Posición de cada lámina lógica en el plan del usuario: las piezas de una partición cuentan una vez y las «Otros»
  # que inserta el motor (`meta$auto_otros`) no cuentan (verificador de K12b: el Word decía 16/18/20 por 16/17/18).
  grupos <- unique(ids)
  insertada <- vapply(grupos, function(g) isTRUE((plan[[match(g, ids)]]$meta %||% list())$auto_otros), logical(1))
  pos_usuario <- stats::setNames(cumsum(!insertada), grupos)
  for (g in grupos) {
    idx <- which(ids == g)
    notas <- lapply(idx, function(i) e$notas[[as.character(i)]] %||% list())
    part <- attr(plan[[idx[1]]], "pulso_particion")
    titulo <- notas[[1]]$titulo %||% part$titulo %||% .lam_avisos_titulo_de(plan[[idx[1]]])
    k <- sum(salieron[idx])
    # Número de la lámina donde empieza: con títulos repetidos («BIENESTAR UNIVERSITARIO» tres veces) es lo único que
    # distingue un aviso de otro, y `.pulso_avisos_de_job` no los colapsa. Siempre su lugar en el plan del usuario.
    numero <- pos_usuario[[g]] + as.integer(getOption("prosecnur.lam_folio_desplazo", 0L))   # posición en el plan, como `.lam_avisos_paso`
    # En /ppt-all cada base sale en su PPTX con su numeración: el aviso dice de cuál (`.lam_avisos_con_base`).
    nombre <- .aviso_lamina(numero, titulo, getOption("prosecnur.lam_avisos_base"))   # graficos_avisos_texto.R
    lineas <- max(0L, unlist(lapply(notas, `[[`, "lineas")))
    if (k > 1L) {
      cuerpo <- if (lineas >= 1L) sprintf("las premisas ocupan hasta %s; salió en %d partes", .lam_aviso_lineas_txt(lineas), k) else
        sprintf("salió en %d partes", k)
      if (!is.null(part)) cuerpo <- sprintf("%s (%d barras; el máximo legible por lámina es %d)", cuerpo, as.integer(part$barras), as.integer(part$techo))
      .pulso_aviso(sprintf("%s: %s", nombre, cuerpo))
    }
    tl <- notas[[1]]$titulo_lineas %||% 0L
    if (tl > 2L) .pulso_aviso(sprintf("%s: el título ocupa %s", nombre, .lam_aviso_lineas_txt(tl)))
  }
  invisible(doc)
}

#' Evalúa `expr` (el mazo de una base en /ppt-all) con su base marcada para los avisos de líneas
#' @keywords internal
.lam_avisos_con_base <- function(base, expr) {
  viejo <- options(prosecnur.lam_avisos_base = as.character(base)[1])
  on.exit(options(viejo), add = TRUE)
  expr
}

#' Título declarado de una lámina del plan (para el aviso cuando ningún compositor lo anotó)
#' @keywords internal
.lam_avisos_titulo_de <- function(slide) {
  t <- slide$title %||% (slide$slots %||% list())$title %||% (slide$payload %||% list())$titulo %||% ""
  if (inherits(t, "ppt_element_text")) t <- t$text
  as.character(t)[1]
}

#' Líneas de la premisa más alta de una lámina; avisa la partición si no hay un mazo en curso
#'
#' @param grupos Lista de juegos de premisas (`.lam_escala_premisas`): uno en la escala, uno por bloque en la
#'   multilista; cada juego se mide en el ancho de su propia columna de premisas.
#' @param partes Número de láminas en que la partió el compositor.
#' @keywords internal
.lam_aviso_partes <- function(titulo, grupos, partes) {
  activo <- .lam_avisos_activo()
  if (!activo && (is.null(partes) || partes <= 1L)) return(invisible(FALSE))
  n <- max(0L, unlist(lapply(grupos, function(premisas) {
    if (!length(premisas)) return(integer())
    textos <- vapply(premisas, function(p) { x <- as.character(p$texto %||% "")[1]; if (is.na(x)) "" else x }, "")
    .lam_lineas_tinta(textos, .lam_escala_ancho_prem(premisas), .std_pt("pregunta"), TRUE)
  })))
  if (activo) return(.lam_avisos_anotar(lineas = n))
  if (n < 1L) return(invisible(FALSE))
  .pulso_aviso(sprintf("%s: las premisas ocupan hasta %s; salió en %d partes", .lam_aviso_nombre(titulo), .lam_aviso_lineas_txt(n), as.integer(partes)))
}

#' Avisa que el título pasa de dos líneas en su caja (`w` in, a `.std_pt("titulo")` pt en negrita)
#'
#' En un mazo en curso se anota y lo emite `.lam_avisos_cierre`, una vez por lámina lógica.
#' @keywords internal
.lam_aviso_titulo <- function(titulo, w) {
  t <- trimws(as.character(titulo %||% "")[1])
  if (is.na(t) || !nzchar(t)) return(invisible(FALSE))
  n <- .lam_lineas_tinta(t, w, .std_pt("titulo"), TRUE)
  if (.lam_avisos_activo()) return(.lam_avisos_anotar(titulo_lineas = n, titulo = t))
  if (n <= 2L) return(invisible(FALSE))
  .pulso_aviso(sprintf("%s: el título ocupa %s", .lam_aviso_nombre(t), .lam_aviso_lineas_txt(n)))
}
