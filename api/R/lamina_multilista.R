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
#' Con actores, igual (Gonzalo, 2026-10-29, opción A «como Conta»): un bloque de un solo público con menos casos que la
#' base de la lámina lleva su «N = …»; el pie dice la base mayor. Antes no se marcaba porque «cada barra nombra sus
#' respuestas», y eso sólo pasa con «Respuestas por público» encendido: al unir dos láminas, el N del bloque menor
#' desaparecía (la base de la lámina salía del primer bloque).
#' @keywords internal
.lam_multilista_nota_n <- function(espec, fuentes, bases_publico) {
  f <- espec$filas
  if (!NROW(f)) return(espec)
  fuente <- unique(fuentes[!is.na(fuentes)])
  if (length(fuente) != 1L || !length(bases_publico) || !fuente %in% names(bases_publico)) return(espec)
  espec$filas$n_nota <- .n_barra_procede(.espec_casos(f), bases_publico[[fuente]])   # casos contra casos (F6)
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
# Los números de abajo viven en el estándar (`ppt.composicion.multilista`); aquí queda de dónde salen.

# Aire entre un bloque y el título del siguiente: recetario p144, la última barra del primer bloque termina en
# 3.69 in y el título del segundo empieza en 4.02 in (0.33). El alto de un bloque se mide hasta el fondo de su
# última fila, que queda 0.06 in bajo la barra (`.lam_bloque_escala`), así que aquí van 0.27.
# Del título del bloque a su primera fila: con columna Top Two Box su rótulo cabe en medio (p144: título 1.60,
# rótulo 1.95, barra 2.53, con una cifra chica encima: 0.93 del título a la barra). Aquí, con cifras chicas,
# 0.317 + 0.35 + 0.24 = 0.907; sin ellas, 0.317 + 0.35 + 0.18 = 0.847. Sin la columna, sólo el aire del texto.
# El rótulo Top Two Box, sobre la franja del bloque: la p144 lo pone en 1.95 con el título en 1.60 (0.35 bajo el
# título). Aquí la franja empieza en 1.65 + 0.317 + 0.35 = 2.317 y el rótulo va 0.37 sobre ella: 1.947. La escala
# simple lo deja 0.45 sobre su franja.
# Grosor de barra (ficha p143: 0.30 in; ejemplo p144: 0.40 in): manda el token por filas de la lámina
# (`.std_grosor`) y la regla de cifras chicas, decididos una vez por lámina en `.lam_multilista_grosor`. El título
# del primer bloque arranca en `zona_datos_y0` (1.65 in; p144: 1.60).
# Alto de la leyenda bajo un bloque (el cuadro baja 0.07 y el texto mide 0.3, más el aire hasta el bloque que sigue).
# La leyenda compartida va 0.15 in bajo la última barra (p144: barras hasta 6.11 in, leyenda en 6.26 in); el fin del
# bloque es el fondo de la fila, 0.06 in bajo la barra: `ppt.composicion.escala.aire_leyenda_multilista` = 0,09.

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
    (if (!is.null(it$espec$box$unidades)) .lam_multilista_aire_ttb() else .std_comp("multilista", "aire_titulo")) +
    (if (isTRUE(compartida)) 0 else .std_comp("multilista", "alto_leyenda"))
}

#' ¿Alguna barra del bloque tiene una cifra que no cabe en su segmento (sube con guía)?
#' @keywords internal
.lam_multilista_peq <- function(it) {
  L <- .std_geom("likert")
  ex <- .std_enunciado_extra_in()   # N10: el enunciado ancho le quita su ancho a la barra
  WB <- L$ancho_barra - ex   # toda barra mide lo mismo, como en `.lam_bloque_escala` (Conta)
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
  aire0 <- if (peq) max(0, .std_aire_chica() - (fila0 - g0)) else 0
  con_aire <- sin_aire + filas * aire0
  if (aire0 > 0 && fijo + sum(con_aire) > disp) aire0 <- 0   # sólo si cabe, como en la escala simple
  list(natural = if (aire0 > 0) con_aire else sin_aire, aire0 = aire0,
       decidir = function(f) {
         aire <- if (aire0 > 0) max(0, .std_aire_chica() - (fila0 * f - g0)) else 0
         fila <- fila0 * f + aire
         list(aire = aire, grosor = if (peq && fila - g0 < .std_aire_chica()) max(0.24, fila - .std_aire_chica(), .std_piso_escala_in()) else g0)   # N1: piso
       })
}

.lam_multilista_filas <- function(items) sum(vapply(items, function(it) sum(vapply(it$premisas, function(p) length(p$filas), 0)), 0))

#' Alto natural de un juego de bloques en una lámina (el grosor es el de las filas de la lámina)
#' @keywords internal
.lam_multilista_alto <- function(items, compartida) {
  nb <- .lam_multilista_filas(items)
  sum(vapply(items, function(it) .lam_multilista_cromo(it, compartida) + .lam_escala_alto(it$premisas, nb), 0)) +
    .std_comp("multilista", "gap_bloques") * (length(items) - 1L)
}

#' Franja vertical de los bloques: desde la zona de datos hasta `leyenda_y - 0.15`
#'
#' La misma que da la partición de la escala simple (`.lam_escala_alto_util`, que deja la leyenda fuera): la leyenda
#' compartida va bajo el último bloque y a lo más en `leyenda_y - 0.15` (p144: 6.26 in); las leyendas propias van
#' dentro del cromo de cada bloque. Con esta franja caben los dos bloques de dos filas del ejemplo p144.
#' @keywords internal
.lam_multilista_disponible <- function() {
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
    pr <- .lam_escala_premisas(b$espec); tit <- texto(b$titulo)
    # Un título de bloque que repite su única premisa no se escribe dos veces (Arte lám. 14): la premisa ya lo dice.
    norm <- function(x) tolower(gsub("[[:space:][:punct:]]+", "", x %||% ""))
    if (!is.null(tit) && length(pr) == 1L && identical(norm(tit), norm(pr[[1]]$texto))) tit <- NULL
    list(espec = b$espec, titulo = tit, subtitulo = texto(b$subtitulo), premisas = pr)
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
  disp <- .lam_multilista_disponible()
  trozos <- list()
  comprime <- .std_evitar_cont()   # M1 con piso (lamina_escala_aire.R): el aire cede hasta su mínimo antes de partir
  comp_de <- function(x) .lam_multilista_compartida_parte(x, compartida)   # M1: la leyenda de una lámina con una sola escala es una
  for (it in items) {
    cm <- comp_de(list(it))
    if (.lam_multilista_alto(list(it), cm) <= disp || length(it$premisas) <= 1L ||
        (comprime && .lam_escala_n_barras(list(it)) <= .MULTIAPILADAS_MAX_BARRAS && .lam_multilista_alto_min(list(it), cm) <= disp)) {
      trozos[[length(trozos) + 1L]] <- it
      next
    }
    resto <- disp - .lam_multilista_cromo(it, cm)
    chica_ <- function(p) .lam_escala_chica_por_premisa(it$espec, p)
    for (k in seq_along(ps_ <- .lam_escala_partir(it$premisas, resto, aire_min_fn = function(p) .lam_escala_aire_minimo(p, chica = chica_(p))$alto))) {
      t <- it; t$premisas <- ps_[[k]]
      t$continua <- k > 1L   # el corte cae DENTRO de este bloque: la lámina que sigue lo continúa
      trozos[[length(trozos) + 1L]] <- t
    }
  }
  partes <- .lam_escala_partir(trozos, disp, alto_fn = function(x) .lam_multilista_alto(x, comp_de(x)),
                               aire_min_fn = function(x) .lam_multilista_alto_min(x, comp_de(x)))
  # Ítem 17: la última lámina no queda con una barra sola (lamina_multilista_sin_sola.R)
  .lam_multilista_sin_barra_sola(partes, function(x) .lam_multilista_alto(x, comp_de(x)) <= disp ||
                                   (comprime && .lam_multilista_alto_min(x, comp_de(x)) <= disp))
}

#' ¿La multilista se compone en nativo? Cada bloque trae una escala sin fila Total ni Bottom Two Box, y cada
#' trozo cabe en una lámina
#' @keywords internal
.lam_multilista_cabe <- function(ml) {
  items <- .lam_multilista_items(ml)
  if (is.null(items)) return(FALSE)
  .op_piso <- c(.grosor_piso_slot(items[[1]]$espec$grosor_piso_cm), .lam_escala_ensanche_previa()); on.exit(options(.op_piso), add = TRUE)   # N1
  compartida <- .lam_multilista_leyenda_compartida(lapply(items, `[[`, "espec")); .lam_multilista_ensanche_fijar(items, compartida)   # lamina_escala_ensanche_justo.R
  partes <- .lam_multilista_planear(items, compartida)
  disp <- .lam_multilista_disponible()
  # M1: con piso, una parte que cabe con el aire en su mínimo también se compone en nativo (la tolerancia de 0,3 in sigue)
  all(vapply(partes, function(pp) .lam_multilista_alto(pp, .lam_multilista_compartida_parte(pp, compartida)) <= disp + 0.3 ||
               (.std_evitar_cont() && .lam_multilista_alto_min(pp, .lam_multilista_compartida_parte(pp, compartida)) <= disp), TRUE))
}

# ---- la lámina ----------------------------------------------------------------

#' Dibuja los bloques de una lámina, de arriba abajo, con una leyenda compartida o una por bloque
#' @keywords internal
.lam_multilista_bloques <- function(lz, items, compartida, negrita = TRUE) {
  g_ <- .std_geom
  disp <- .lam_multilista_disponible()
  nb <- .lam_multilista_filas(items)
  centro_barras <- NULL
  # M1 apretado (lamina_escala_aire.R): solo si la alternativa era partir; la franja llega 0,30 in más abajo y la leyenda se pega a la barra
  apretar <- .lam_multilista_apretar(items, compartida)
  if (apretar) { op_ap <- options(prosecnur.lam_apretado = TRUE); on.exit(options(op_ap), add = TRUE); disp <- disp + .std_comp("apretada", "extra_franja") }
  cromo <- vapply(items, .lam_multilista_cromo, 0, compartida = compartida)
  fijo <- sum(cromo) + .std_comp("multilista", "gap_bloques") * (length(items) - 1L)
  dec <- .lam_multilista_grosor(items, nb, disp, fijo)
  natural <- dec$natural
  # Pocas filas: se reparte el alto con el mismo factor en todos los bloques, con el tope de la escala simple
  # (`.lam_bloque_escala`: hasta el doble, al 93 % de lo disponible). El grosor no cambia.
  total <- fijo + sum(natural)
  f <- if (total < 0.88 * disp && sum(natural) > 0) max(1, min(2.0, 0.93 * (disp - fijo) / sum(natural))) else 1
  # M1 con piso: si no caben, el aire cede hasta su mínimo (la barra no baja del piso); `.lam_bloque_escala` aplica los pisos
  if (total > disp && .std_evitar_cont()) f <- .lam_multilista_factor_compresion(items, compartida, disp)
  gr <- dec$decidir(f)
  w <- .lam_multilista_ancho()
  # Compone los bloques; `dg` engrosa la barra (y su fila), `entre` separa bloques y `extra` reparte aire entre los temas
  # de cada bloque (lamina_escala_llenar.R). Devuelve la `y` del final del último bloque.
  componer <- function(lz, dg = 0, entre = 0, extra = rep(0, length(items)), sin_tope = FALSE, bajar = 0) {
  y <- g_("zona_datos_y0") + bajar
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
    # G19 (Gabriela, 2026-10-28: «a la altura del logo»): el primer bloque sin título arranca como la escala simple, con su
    # rótulo Top Two Box 0,45 in sobre la franja (1,30 in, bajo el logo); el aire de la p144 es para caber bajo un título.
    arriba <- k == 1L && is.null(it$titulo) && is.null(it$subtitulo) && !is.null(it$espec$box$unidades)
    y <- y + (if (arriba) .std_comp("multilista", "aire_titulo") else if (!is.null(it$espec$box$unidades)) .lam_multilista_aire_ttb() else .std_comp("multilista", "aire_titulo"))
    fin <- .lam_bloque_escala(lz, it$espec, it$premisas, solo = FALSE, y0 = y, y1 = y + natural[k] * f + 1e-6,
                              leyenda = !compartida, estirar = f, nb = nb, aire = gr$aire + dg, grosor = gr$grosor + dg,
                              rotulo_sobre = if (arriba) .std_comp("escala", "rotulo_box_sobre") else .std_comp("multilista", "rotulo_box_sobre") - (.std_comp("multilista", "aire_ttb") - .lam_multilista_aire_ttb()),
                              extra_alto = (if (arriba) .lam_multilista_aire_ttb() - .std_comp("multilista", "aire_titulo") else 0) + extra[k],   # G11: lo que soltó arriba va entre temas
                              llenando = sin_tope, negrita = negrita,   # al llenar, en todas las pasadas: si no, el sobrante se cuenta dos veces
                              # Un bloque sin título continúa al de arriba: no repite el rótulo «TOP TWO BOX» si otro ya lo puso (Conta,
                              # láms. 22 y 24); un bloque con su propio título es un panel aparte y lleva el suyo (recetario p144).
                              con_rotulo_box = !is.null(it$titulo) || !any(vapply(items[seq_len(k - 1L)], function(i) !is.null(i$espec$box$unidades), TRUE)))
    centro_barras <<- attr(fin, "centro_barras", exact = TRUE) %||% centro_barras
    y <- fin + (if (k < length(items)) entre else 0) + (if (compartida) 0 else .std_comp("multilista", "alto_leyenda")) + .std_comp("multilista", "gap_bloques")
  }
  y
  }
  # La lámina aprovecha su alto como Contabilidad (lamina_escala_llenar.R): con alto de sobra, la barra engrosa hacia su
  # grosor y el resto va entre temas y bloques, no bajo el último. Nada cambia si la lámina viene justa o apretada.
  dg <- 0; entre <- 0; extra <- rep(0, length(items))
  meta <- .lam_piso_leyenda() - .std_comp("llenar", "aire_leyenda") - (if (compartida) 0 else .std_comp("multilista", "alto_leyenda"))
  if (!apretar && f >= 1) {
    fin_de <- function(...) componer(.lam_lienzo(), ..., sin_tope = TRUE) - .std_comp("multilista", "gap_bloques")
    sobra <- meta - fin_de()
    dg <- .lam_escala_engrosar_busca(gr$grosor, nb, function(d) fin_de(dg = d) <= meta)   # lo que de verdad crece (ítems 4–5)
    sobra <- meta - fin_de(dg = dg)
    temas <- vapply(items, function(it) max(0L, length(it$premisas) - 1L), 0L)
    fronteras <- sum(temas) + length(items) - 1L
    if (sobra > 0.05 && fronteras > 0) {
      # Entre bloques, como entre temas: a lo más lo que deja `.std_comp("llenar", "aire_entre_temas_max")` (Conta), no todo el sobrante.
      parte <- sobra / fronteras; entre <- min(parte, .std_comp("llenar", "aire_entre_temas_max") - .std_comp("multilista", "gap_bloques")); extra <- parte * temas
    } else if (sobra > 0.05) {
      extra <- rep(sobra, length(items))   # una sola pregunta: el alto se lo reparten sus públicos (lamina_escala_temas.R)
    }
  } else {
    # Justa o apretada: si el texto de las preguntas manda el alto de sus filas, la barra engrosa sin que la lámina crezca
    # (Renzo, 2026-10-29: «aquí se vuelve a ver pequeño, compararlo con los otros», Gestión y planificación de Arte).
    fin0 <- function(...) componer(.lam_lienzo(), ..., sin_tope = FALSE); base <- fin0()
    # con leyenda propia, la última va a `aire_leyenda` de su barra y no pasa de su piso: ese alto también se puede usar
    tope <- if (compartida) base else max(base, .lam_piso_leyenda() + .std_comp("multilista", "alto_leyenda") + .std_comp("multilista", "gap_bloques") - .std_comp("escala", "aire_leyenda"))
    dg <- .lam_escala_engrosar_busca(gr$grosor, nb, function(d) fin0(dg = d) <= tope + 0.005)
  }
  bajar <- if (!apretar && f >= 1) .lam_escala_centrar(fin_de(dg = dg, entre = entre, extra = extra) - (if (compartida) 0 else .std_comp("multilista", "alto_leyenda"))) else 0
  y <- componer(lz, dg = dg, entre = entre, extra = extra, sin_tope = !apretar && f >= 1, bajar = bajar)   # lo que sigue sobrando: centrado
  if (compartida) {
    e <- items[[1]]$espec; ley <- e$leyenda
    y_ley <- if (apretar) min(g_("leyenda_y") - 0.15 + .std_comp("apretada", "extra_franja"), .lam_piso_leyenda() - 0.01, y - .std_comp("multilista", "gap_bloques") + .std_comp("escala", "aire_leyenda_apretada"))   # apretado: cerca de la última barra, sin pegarse (G14) si queda sitio
             else if (dg > 0 || entre > 0) min(.lam_piso_leyenda(), y - .std_comp("multilista", "gap_bloques") + .std_comp("llenar", "aire_leyenda"))   # llena: 0,45 in, como Conta
             else min(g_("leyenda_y") - 0.15, y - .std_comp("multilista", "gap_bloques") + .std_comp("escala", "aire_leyenda_multilista"))
    .lam_leyenda(lz, y_ley, e$categorias$rotulo[ley], e$categorias$color[ley],
                 centrar_en = .std_geom("ancho") / 2)   # el usuario: la leyenda va centrada a todo el placeholder (la lámina), no a las barras
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
  .op_piso <- c(.grosor_piso_slot(items[[1]]$espec$grosor_piso_cm), .lam_escala_ensanche_previa()); on.exit(options(.op_piso), add = TRUE)   # N1: piso del slot (los bloques lo heredan); ensanche justo
  # Un título de más de tres líneas baja la zona de datos antes de planear las partes (lamina_titulo_alto.R).
  .lam_con_titulo(c(titulo, .particion_titulo_cont(titulo)), {
  compartida <- .lam_multilista_leyenda_compartida(lapply(items, `[[`, "espec")); .lam_multilista_ensanche_fijar(items, compartida)
  partes <- .lam_multilista_planear(items, compartida)
  .lam_aviso_partes(titulo, lapply(items, `[[`, "premisas"), length(partes))  # K12b
  for (k in seq_along(partes)) {
    doc <- officer::add_slide(doc, layout = layout, master = master)
    # M1: con piso, «(cont.)» solo si el corte cayó DENTRO de un bloque; si cayó entre bloques, la lámina que sigue empieza otro.
    cont_ <- k > 1 && (!.std_evitar_cont() || isTRUE(partes[[k]][[1]]$continua))
    doc <- .lam_titulo(doc, if (cont_) .particion_titulo_cont(titulo) else titulo, ante = ante, sub = if (k == 1L) sub else NULL, avisar = k == 1L)   # «(cont.)» una sola vez
    # B4: la composición de la parte, como función, para recomponerla con el tope de su familia al cierre (lamina_grosor_familias.R)
    dibujar <- local({ k_ <- k; function() {
      lz <- .lam_lienzo()
      .lam_multilista_bloques(lz, partes[[k_]], .lam_multilista_compartida_parte(partes[[k_]], compartida),
                              negrita = !nzchar(sub %||% ""))   # lámina por público: preguntas sin negrita, como Conta
      lz
    } })
    lz <- dibujar()
    doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:multilista")
    .lam_gf_registrar(doc, lz, "prosecnur:grafico:multilista", dibujar)
    doc <- .lam_pie(doc, .lam_base_de_parte_multilista(base, partes, k), if (is.null(folio)) NULL else folio + k - 1L)   # N15: el pie de la parte, solo sus públicos
    doc <- por_lamina(doc)
  }
  list(doc = doc, partes = length(partes))
  })
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
