# =============================================================================
# lamina_multilista.R — varios bloques de escala apilados en una lámina, con el
# motor nativo (ADR 0092/0093)
# =============================================================================
#
# La multi-apiladas en `modo = "multilista"` apila N bloques, cada uno con su
# título (`.multilista_block_title`) y subtítulo. Hasta aquí salía por
# ggplot + cowplot (`reporte_plan_ppt.R`, rama multilista de
# `.render_barras_multiapiladas`). Ahora cada bloque conserva SU especificación
# de escala —su base, su denominador, su orden— y la lámina se compone con las
# piezas del recetario: tipo 10 «Dos gráficos apilados»
# (`p_slide_2_graficos_vertical`, ficha p143 y ejemplo p144 de
# `docs/qa/motor-ppt-2026-10-06/4-recetario/recetario-moderna.pptx`),
# generalizado a N bloques.
#
# Aquí no se calcula ningún porcentaje: el sub-render de cada bloque ya trae su
# `pulso_espec` y este archivo sólo ubica lo que esa especificación afirma.

# ---- marca del render ---------------------------------------------------------

#' Marca el gráfico de un bloque con su título y subtítulo de bloque, y los públicos de sus variables
#'
#' `resolver` y `extraer` son `.resolve_ref` y `.extract_ref_values` del motor (closures de `reporte_ppt_plan`): el
#' público de cada variable sale como sale la base por público de la lámina (`bases_publico`), que se calcula con
#' ellas en la rama multilista.
#' @keywords internal
.lam_multilista_marcar <- function(p, block, resolver = NULL, extraer = NULL) {
  fuentes <- character(0)
  if (is.function(resolver) && is.function(extraer)) {
    refs <- tryCatch(extraer(block$vars %||% character(0)), error = function(e) character(0))
    fuentes <- vapply(refs, function(r) {
      s <- tryCatch(resolver(r, arg_name = "var")$source, error = function(e) NULL)
      if (is.null(s) || !length(s)) NA_character_ else as.character(s)[1]
    }, character(1), USE.NAMES = FALSE)
  }
  attr(p, "pulso_multilista_bloque") <- list(
    titulo = block$.multilista_block_title %||% NULL,
    subtitulo = block$.multilista_block_subtitle %||% NULL,
    modo = block$modo %||% "var",
    fuentes = fuentes
  )
  p
}

#' Filas de un bloque sin actores que llevan su N: las que quedan bajo la base de su público
#'
#' Salto de cuestionario. El criterio es `.n_barra_procede` (con su tolerancia) contra la base por público de toda la
#' lámina (`bases_publico`, la misma que recibía el graficador en la ruta anterior). Sólo cuando todas las variables
#' del bloque son de un mismo público: las filas de la espec no dicen de qué variable salen, así que con públicos
#' mezclados no se puede saber la base de cada una y no se anota (una anotación de menos, nunca una equivocada).
#' Con actores no se marca nada: cada barra ya nombra sus respuestas.
#' @keywords internal
.lam_multilista_nota_n <- function(espec, fuentes, bases_publico) {
  f <- espec$filas
  if (!NROW(f) || !all(is.na(f$grupo_id))) return(espec)
  fuente <- unique(fuentes[!is.na(fuentes)])
  if (length(fuente) != 1L || !length(bases_publico) || !fuente %in% names(bases_publico)) return(espec)
  espec$filas$n_nota <- .n_barra_procede(f$n, bases_publico[[fuente]])
  espec
}

#' Cuelga del `plot_grid` de la multilista la especificación de cada bloque
#'
#' Va en su propio atributo (`pulso_multilista`) y no en `pulso_espec`: las
#' láminas de paneles y mixtas leen `pulso_espec` de cada ranura y no saben
#' dibujar una multilista, así que ahí sigue la ruta anterior.
#' @keywords internal
.lam_multilista_adjuntar <- function(grid, rendered, bases_publico = NULL) {
  bloques <- lapply(rendered, function(p) {
    m <- attr(p, "pulso_multilista_bloque") %||% list()
    # Las filas van en el orden que fija la espec (`espec$orden$aplicado`), el mismo de la ruta anterior y del Word.
    # La multi-apiladas simple nativa reordena por Top Two Box (`.lam_slide_1_nativa`); aquí no, a la espera de la
    # revisión metodológica: reordenar un bloque cambiaría lo que ya se publicó.
    espec <- if (inherits(p, "ggplot")) attr(p, "pulso_espec") else NULL
    if (!is.null(espec) && identical(espec$tipo, "escala")) espec <- .lam_multilista_nota_n(espec, m$fuentes, bases_publico)
    list(espec = espec, titulo = m$titulo, subtitulo = m$subtitulo)
  })
  attr(grid, "pulso_multilista") <- list(version = "multilista/1", bloques = bloques)
  grid
}

# ---- geometría ---------------------------------------------------------------

# Aire entre un bloque y el título del siguiente: recetario p144, la última barra del primer bloque termina en
# 3.69 in y el título del segundo empieza en 4.02 in (0.33). El alto de un bloque se mide hasta el fondo de su
# última fila, que queda 0.06 in bajo la barra (`.lam_bloque_escala`), así que aquí van 0.27.
.LAM_MULTILISTA_GAP <- 0.27
# Del título del bloque a su primera fila: con columna Top Two Box su rótulo cabe en medio (p144: título 1.60,
# rótulo 1.95, barra 2.53, con una cifra chica encima: 0.93 del título a la barra). Aquí, con cifras chicas,
# 0.317 + 0.35 + 0.24 = 0.907; sin ellas, 0.317 + 0.35 + 0.18 = 0.847. Sin la columna, sólo el aire del texto.
.LAM_MULTILISTA_AIRE_TTB <- 0.35
# El rótulo Top Two Box, sobre la franja del bloque: la p144 lo pone en 1.95 con el título en 1.60 (0.35 bajo el
# título). Aquí la franja empieza en 1.65 + 0.317 + 0.35 = 2.317 y el rótulo va 0.37 sobre ella: 1.947. La escala
# simple lo deja 0.45 sobre su franja.
.LAM_MULTILISTA_ROTULO_TTB <- 0.37
# Grosor de barra (ficha p143: 0.30 in; ejemplo p144: 0.40 in): manda el token por filas de la lámina
# (`.std_grosor`) y la regla de cifras chicas, decididos una vez por lámina en `.lam_multilista_grosor`. El título
# del primer bloque arranca en `zona_datos_y0` (1.65 in; p144: 1.60).
.LAM_MULTILISTA_AIRE <- 0.1
# Alto de la leyenda bajo un bloque (el cuadro baja 0.07 y el texto mide 0.3, más el aire hasta el bloque que sigue).
.LAM_MULTILISTA_LEYENDA <- 0.5
# La leyenda compartida va 0.15 in bajo la última barra (p144: barras hasta 6.11 in, leyenda en 6.26 in); el fin del
# bloque es el fondo de la fila, 0.06 in bajo la barra.
.LAM_MULTILISTA_AIRE_LEYENDA <- 0.15 - 0.06

.lam_multilista_ancho <- function() .std_geom("ancho") - .std_geom("margen_izq") - .std_geom("margen_der")

#' ¿Todos los bloques usan la misma escala (mismos niveles y colores)? Entonces la leyenda es una sola
#' @keywords internal
.lam_multilista_leyenda_compartida <- function(especs) {
  firma <- function(e) paste(e$categorias$rotulo[e$leyenda], e$categorias$color[e$leyenda], sep = "=", collapse = "|")
  length(unique(vapply(especs, firma, ""))) == 1L
}

#' Título y subtítulo del bloque: alto que ocupan
#' @keywords internal
.lam_multilista_alto_titulo <- function(it) {
  w <- .lam_multilista_ancho(); h <- 0
  if (!is.null(it$titulo) && nzchar(it$titulo)) h <- h + .lam_alto_txt(it$titulo, w, .std_pt("pregunta"), TRUE)
  if (!is.null(it$subtitulo) && nzchar(it$subtitulo)) h <- h + .lam_alto_txt(it$subtitulo, w, .std_pt("leyenda"))
  h
}

#' Cromo de un bloque: lo que no depende del paso de fila (título, rótulo Top Two Box, leyenda propia)
#' @keywords internal
.lam_multilista_cromo <- function(it, compartida) {
  .lam_multilista_alto_titulo(it) +
    (if (!is.null(it$espec$box$unidades)) .LAM_MULTILISTA_AIRE_TTB else .LAM_MULTILISTA_AIRE) +
    (if (isTRUE(compartida)) 0 else .LAM_MULTILISTA_LEYENDA)
}

#' ¿Alguna barra del bloque tiene una cifra que no cabe en su segmento (sube con guía)?
#' @keywords internal
.lam_multilista_peq <- function(it) {
  L <- .std_geom("likert")
  WB <- if (!is.null(it$espec$box$unidades)) L$ancho_barra else .std_geom("ancho") - .std_geom("margen_der") - L$x_barra - 0.3
  any(vapply(it$premisas, function(p) any(vapply(p$filas, function(fl) .lam_tiene_peq(.lam_escala_seg(it$espec, fl$i), WB), TRUE)), TRUE))
}

#' Grosor y aire de las filas: una sola decisión para toda la lámina
#'
#' La regla de cifras chicas del estándar (`.lam_bloque_escala`: la fila gana aire si cabe; si no, la barra cede lo
#' justo para que la cifra suba con su guía) se decidía bloque a bloque, y en una misma lámina salían barras de 0.32 y
#' de 0.44 in (verificador de 3409b0aa8). Aquí se decide una vez con el bloque más exigente —basta uno con cifras
#' chicas— y vale para todos: mismo grosor, mismo paso de fila.
#' @return Lista con `natural` (alto de las filas de cada bloque, sin estirar), `aire0` (aire por fila sin estirar,
#'   0 si no cabe) y la función `decidir(f)` que da `aire` y `grosor` para el factor de estiramiento `f`.
#' @keywords internal
.lam_multilista_grosor <- function(items, nb, disp, fijo) {
  g0 <- .std_grosor(nb, "escala_apilada"); fila0 <- g0 + 0.24
  peq <- any(vapply(items, .lam_multilista_peq, TRUE))
  sin_aire <- vapply(items, function(it) .lam_escala_alto(it$premisas, nb), 0)
  filas <- vapply(items, function(it) sum(vapply(it$premisas, function(p) length(p$filas), 0)), 0)
  aire0 <- if (peq) max(0, 0.34 - (fila0 - g0)) else 0
  con_aire <- sin_aire + filas * aire0
  if (aire0 > 0 && fijo + sum(con_aire) > disp) aire0 <- 0   # sólo si cabe, como en la escala simple
  list(natural = if (aire0 > 0) con_aire else sin_aire, aire0 = aire0,
       decidir = function(f) {
         aire <- if (aire0 > 0) max(0, 0.34 - (fila0 * f - g0)) else 0
         fila <- fila0 * f + aire
         list(aire = aire, grosor = if (peq && fila - g0 < 0.36) max(0.24, fila - 0.36) else g0)
       })
}

.lam_multilista_filas <- function(items) sum(vapply(items, function(it) sum(vapply(it$premisas, function(p) length(p$filas), 0)), 0))

#' Alto natural de un juego de bloques en una lámina (el grosor es el de las filas de la lámina)
#' @keywords internal
.lam_multilista_alto <- function(items, compartida) {
  nb <- .lam_multilista_filas(items)
  sum(vapply(items, function(it) .lam_multilista_cromo(it, compartida) + .lam_escala_alto(it$premisas, nb), 0)) +
    .LAM_MULTILISTA_GAP * (length(items) - 1L)
}

#' Franja vertical de los bloques: desde la zona de datos hasta `leyenda_y - 0.15`
#'
#' La misma que da la partición de la escala simple (`.lam_escala_alto_util`, que deja la leyenda fuera): la leyenda
#' compartida va bajo el último bloque y a lo más en `leyenda_y - 0.15` (p144: 6.26 in); las leyendas propias van
#' dentro del cromo de cada bloque. Con esta franja caben los dos bloques de dos filas del ejemplo p144.
#' @keywords internal
.lam_multilista_disponible <- function(compartida) {
  (.std_geom("leyenda_y") - 0.15) - .std_geom("zona_datos_y0")
}

#' Bloques de la multilista listos para componer (cada uno con sus premisas), o `NULL` si alguno no es nativo
#' @keywords internal
.lam_multilista_items <- function(ml) {
  bloques <- ml$bloques %||% list()
  if (!length(bloques)) return(NULL)
  ok <- vapply(bloques, function(b) {
    e <- b$espec
    !is.null(e) && identical(e$tipo, "escala") && NROW(e$filas) >= 1L && !isTRUE(.lam_escala_en_filas(e))
  }, TRUE)
  if (!all(ok)) return(NULL)
  lapply(bloques, function(b) {
    texto <- function(x) if (is.null(x) || !length(x) || is.na(x[1]) || !nzchar(trimws(as.character(x)[1]))) NULL else trimws(as.character(x)[1])
    list(espec = b$espec, titulo = texto(b$titulo), subtitulo = texto(b$subtitulo), premisas = .lam_escala_premisas(b$espec))
  })
}

#' Reparto de los bloques en láminas
#'
#' Un bloque no se corta entre láminas: se reparte por bloques enteros con `.lam_escala_partir` (el alto de cada
#' juego de bloques). Sólo si un bloque solo no cabe se parten sus premisas, y cada trozo repite el título del
#' bloque.
#' @return Lista de láminas; cada una, lista de bloques.
#' @keywords internal
.lam_multilista_planear <- function(items, compartida) {
  disp <- .lam_multilista_disponible(compartida)
  trozos <- list()
  for (it in items) {
    if (.lam_multilista_alto(list(it), compartida) <= disp || length(it$premisas) <= 1L) {
      trozos[[length(trozos) + 1L]] <- it
      next
    }
    resto <- disp - .lam_multilista_cromo(it, compartida)
    for (ps in .lam_escala_partir(it$premisas, resto)) {
      t <- it; t$premisas <- ps
      trozos[[length(trozos) + 1L]] <- t
    }
  }
  .lam_escala_partir(trozos, disp, alto_fn = function(x) .lam_multilista_alto(x, compartida))
}

#' ¿La multilista se compone en nativo? Cada bloque trae una escala sin fila Total ni Bottom Two Box, y cada
#' trozo cabe en una lámina
#' @keywords internal
.lam_multilista_cabe <- function(ml) {
  items <- .lam_multilista_items(ml)
  if (is.null(items)) return(FALSE)
  compartida <- .lam_multilista_leyenda_compartida(lapply(items, `[[`, "espec"))
  partes <- .lam_multilista_planear(items, compartida)
  disp <- .lam_multilista_disponible(compartida)
  all(vapply(partes, function(pp) .lam_multilista_alto(pp, compartida) <= disp + 0.3, TRUE))
}

# ---- la lámina ----------------------------------------------------------------

#' Dibuja los bloques de una lámina, de arriba abajo, con una leyenda compartida o una por bloque
#' @keywords internal
.lam_multilista_bloques <- function(lz, items, compartida) {
  g_ <- .std_geom; L <- g_("likert")
  disp <- .lam_multilista_disponible(compartida)
  nb <- .lam_multilista_filas(items)
  cromo <- vapply(items, .lam_multilista_cromo, 0, compartida = compartida)
  fijo <- sum(cromo) + .LAM_MULTILISTA_GAP * (length(items) - 1L)
  dec <- .lam_multilista_grosor(items, nb, disp, fijo)
  natural <- dec$natural
  # Pocas filas: se reparte el alto con el mismo factor en todos los bloques, con el tope de la escala simple
  # (`.lam_bloque_escala`: hasta el doble, al 93 % de lo disponible). El grosor no cambia.
  total <- fijo + sum(natural)
  f <- if (total < 0.88 * disp && sum(natural) > 0) max(1, min(2.0, 0.93 * (disp - fijo) / sum(natural))) else 1
  gr <- dec$decidir(f)
  w <- .lam_multilista_ancho(); y <- g_("zona_datos_y0")
  for (k in seq_along(items)) {
    it <- items[[k]]
    if (!is.null(it$titulo)) {
      ht <- .lam_alto_txt(it$titulo, w, .std_pt("pregunta"), TRUE)
      .lam_txt(lz, it$titulo, g_("margen_izq"), y, w, ht, .std_pt("pregunta"), .std_color("azul"), bold = TRUE, nombre = "bloque:titulo")
      y <- y + ht
    }
    if (!is.null(it$subtitulo)) {
      hs <- .lam_alto_txt(it$subtitulo, w, .std_pt("leyenda"))
      .lam_txt(lz, it$subtitulo, g_("margen_izq"), y, w, hs, .std_pt("leyenda"), .std_color("texto_suave"), nombre = "bloque:subtitulo")
      y <- y + hs
    }
    y <- y + (if (!is.null(it$espec$box$unidades)) .LAM_MULTILISTA_AIRE_TTB else .LAM_MULTILISTA_AIRE)
    fin <- .lam_bloque_escala(lz, it$espec, it$premisas, solo = FALSE, y0 = y, y1 = y + natural[k] * f + 1e-6,
                              leyenda = !compartida, estirar = f, nb = nb, aire = gr$aire, grosor = gr$grosor,
                              rotulo_sobre = .LAM_MULTILISTA_ROTULO_TTB)
    y <- fin + (if (compartida) 0 else .LAM_MULTILISTA_LEYENDA) + .LAM_MULTILISTA_GAP
  }
  if (compartida) {
    e <- items[[1]]$espec; ley <- e$leyenda
    con_ttb <- any(vapply(items, function(it) !is.null(it$espec$box$unidades), TRUE))
    fin_bloque <- if (con_ttb) L$x_top_two_box + 0.75 else g_("ancho") - g_("margen_der") - 0.3
    .lam_leyenda(lz, min(g_("leyenda_y") - 0.15, y - .LAM_MULTILISTA_GAP + .LAM_MULTILISTA_AIRE_LEYENDA), e$categorias$rotulo[ley], e$categorias$color[ley],
                 centrar_en = (L$x_premisa + fin_bloque) / 2)
  }
  invisible(lz)
}

#' Láminas de una multilista: título, bloques, base y folio; «(cont.)» en las que siguen
#' @return Lista con `doc` y `partes`.
#' @keywords internal
.lam_laminas_multilista <- function(doc, ml, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                    layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  items <- .lam_multilista_items(ml)
  compartida <- .lam_multilista_leyenda_compartida(lapply(items, `[[`, "espec"))
  partes <- .lam_multilista_planear(items, compartida)
  for (k in seq_along(partes)) {
    doc <- officer::add_slide(doc, layout = layout, master = master)
    doc <- .lam_titulo(doc, paste0(titulo, if (k > 1) " (cont.)" else ""), ante = ante, sub = if (k == 1L) sub else NULL)
    lz <- .lam_lienzo()
    .lam_multilista_bloques(lz, partes[[k]], compartida)
    doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:multilista")
    doc <- .lam_pie(doc, base, if (is.null(folio)) NULL else folio + k - 1L)
    doc <- por_lamina(doc)
  }
  list(doc = doc, partes = length(partes))
}

#' La rama `slide_1` de una multilista, en nativo: la base y la nota como la escala simple
#' (`.lam_compositor_slide_1`)
#' @keywords internal
.lam_multilista_slide_1 <- function(doc, p, titulo, subtitulo = NULL, base = NULL, pie = NULL, antetitulo = NULL,
                                    layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  texto <- function(x) if (is.null(x) || !length(x) || is.na(x[1]) || !nzchar(trimws(as.character(x)[1]))) NULL else trimws(as.character(x)[1])
  folio <- length(doc) + 1L
  .lam_laminas_multilista(doc, attr(p, "pulso_multilista"), titulo = texto(titulo) %||% "", ante = texto(antetitulo),
                          base = paste(c(texto(base), texto(pie)), collapse = ". "), folio = folio, sub = texto(subtitulo),
                          layout = layout, master = master, por_lamina = por_lamina)
}
