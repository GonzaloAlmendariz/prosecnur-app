# Láminas «Reglas de la identidad» del catálogo del recetario (checklist-recetario-desfase-2026-10-26.md, P5).
#
# Gonzalo (2026-10-27): «el recetario es la fuente de verdad y la constitución», y debe ser fiel a lo que hace el motor
# «incluyendo paleta de colores y todo». El recetario histórico abría con las reglas de la identidad (recetario_m0.R, R3
# «Los colores y lo que significan»); el catálogo generado no las tenía. Estas láminas las dibujan LEYENDO
# `inst/estandar/estandar_pulso.json`: ningún color, tamaño ni regla se escribe aquí, así que la constitución no puede
# desfasarse del motor. Cambiar un token del JSON cambia la lámina en la siguiente regeneración del catálogo.
#
# Cuatro partes: `respuestas` (las paletas de las respuestas), `apoyo` (públicos, semáforo, barras de una serie, calor y mapas),
# `colores` (todos los colores con nombre de la lámina) y `tipografia` (la escala de tamaños).

.ESTANDAR_PARTES <- c("respuestas", "apoyo", "colores", "tipografia")

.ESTANDAR_TITULOS <- c(respuestas = "Los colores de las respuestas", apoyo = "Los colores de apoyo",
                       colores = "Los colores de la lámina", tipografia = "La escala tipográfica")

#' @title Lámina de las reglas de la identidad
#'
#' Dibuja una parte del estándar visual del motor (`estandar_pulso.json`) tal como está declarada: las paletas con sus
#' rótulos y su regla de uso, los colores con nombre o la escala tipográfica. Es la lámina con la que el catálogo del
#' recetario muestra la constitución del motor.
#'
#' @param titulo Título de la lámina; `NULL` usa el de la parte.
#' @param parte `"respuestas"`, `"apoyo"`, `"colores"` o `"tipografia"`.
#' @param meta Metadatos del slide.
#' @return Objeto con clase `"ppt_slide"`.
#' @export
p_slide_estandar <- function(titulo = NULL, parte = "respuestas", meta = list()) {
  parte <- .estandar_parte(parte)
  .ppt_chk_meta(meta)
  tit <- .ppt_norm_text1(titulo %||% .ESTANDAR_TITULOS[[parte]], blank = .ESTANDAR_TITULOS[[parte]])
  .ppt_as_slide(list(.slide_type = "estandar", title = tit, slots = list(title = tit, parte = parte), meta = meta))
}

.estandar_parte <- function(parte) {
  p <- tolower(trimws(as.character(parte %||% "respuestas")[1]))
  if (is.na(p) || !p %in% .ESTANDAR_PARTES) "respuestas" else p
}

# Grupos de muestras de una parte: nombre, colores, rótulo de cada color y regla de uso, todo del JSON.
.estandar_grupos <- function(parte) {
  pal <- function(n) .std_valor("ppt", "paletas", n)
  grupo <- function(nombre, p, cols = unlist(p$colores), rot = unlist(p$rotulos)) {
    list(nombre = nombre, colores = unname(as.character(cols)), rotulos = if (length(rot)) unname(as.character(rot)) else NULL,
         uso = as.character(p$uso %||% ""))
  }
  if (identical(parte, "respuestas")) {
    return(list(grupo("Escala de cuatro pasos", pal("likert")), grupo("Escala de cinco pasos", pal("likert_neutro")),
                grupo("Dos opciones", pal("dicotomica")), grupo("Categorías sin orden", pal("categorica"))))
  }
  cat_ <- pal("categorias"); cal <- pal("calor"); mapa <- pal("mapa"); sem <- pal("semaforo")
  list(grupo("Públicos", pal("actores")),
       grupo("Semáforo", sem, cols = c(sem$rojo, sem$ambar, sem$verde), rot = unlist(sem$rotulos[c("rojo", "ambar", "verde")])),
       grupo("Barras de una serie", cat_, cols = c(cat_$mayor, cat_$resto, cat_$residual),
             rot = unlist(cat_$rotulos[c("mayor", "resto", "residual")])),
       grupo("Tablas de calor", cal, cols = unlist(cal$tramos)),
       grupo("Mapas de cobertura", mapa, cols = c(unlist(mapa$clases), mapa$fuera), rot = NULL))
}

# Una fila de muestras: nombre del grupo, los colores en fila con su rótulo y su código, y la regla a la derecha.
.estandar_fila <- function(lz, g, y, x0, ancho, x_uso, w_uso) {
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); filete <- .std_color("filete")
  .lam_txt(lz, g$nombre, x0, y, ancho, 0.3, .std_pt("pregunta"), azul, bold = TRUE, nombre = "estandar:grupo")
  k <- length(g$colores); sep <- 0.1; w <- min(1.25, (ancho - (k - 1) * sep) / k)
  for (i in seq_len(k)) {
    x <- x0 + (i - 1) * (w + sep)
    .lam_caja(lz, x, y + 0.32, w, 0.34, g$colores[i], nombre = "estandar:muestra", borde = filete)
    # El código va dentro de la muestra, en el texto que más contrasta con ella (como las cifras del motor): debajo queda
    # sólo el rótulo, que puede ocupar dos líneas sin pisar nada.
    .lam_txt(lz, toupper(g$colores[i]), x, y + 0.385, w, 0.22, 8, .lam_texto_sobre(g$colores[i]), align = "center", nombre = "estandar:codigo")
    rot <- g$rotulos[i] %||% NA_character_
    if (!is.na(rot) && nzchar(rot)) .lam_txt(lz, rot, x - 0.04, y + 0.68, w + 0.08, 0.36, 9, azul, align = "center", nombre = "estandar:rotulo")
  }
  if (nzchar(g$uso)) .lam_txt(lz, g$uso, x_uso, y + 0.28, w_uso, 0.8, 11, suave, nombre = "estandar:uso")
}

# Colores con nombre de la lámina (`ppt.colores`) en una grilla de cuatro columnas: muestra, nombre y código.
.estandar_colores <- function(lz, x0, y0, ancho) {
  cols <- .std_valor("ppt", "colores"); nm <- names(cols)
  azul <- .std_color("azul"); tenue <- .std_color("texto_tenue"); filete <- .std_color("filete")
  nc <- 4L; sep <- 0.25; w <- (ancho - (nc - 1) * sep) / nc; alto <- 0.78
  for (i in seq_along(nm)) {
    fila <- (i - 1L) %/% nc; col <- (i - 1L) %% nc
    x <- x0 + col * (w + sep); y <- y0 + fila * alto
    .lam_caja(lz, x, y + 0.04, 0.5, 0.4, cols[[nm[i]]], nombre = "estandar:muestra", borde = filete)
    .lam_txt(lz, gsub("_", " ", nm[i]), x + 0.58, y, w - 0.6, 0.28, 11, azul, bold = TRUE, nombre = "estandar:nombre")
    .lam_txt(lz, toupper(cols[[nm[i]]]), x + 0.58, y + 0.24, w - 0.6, 0.24, 9, tenue, nombre = "estandar:codigo")
  }
}

# La escala tipográfica (`ppt.tipografia`): cada tamaño escrito a su propio tamaño, en dos columnas. Sin la portada,
# que tiene su propia lámina, ni el piso de las cifras, que no es un rol.
.estandar_tipografia <- function(lz, x0, y0, ancho) {
  tip <- .std_valor("ppt", "tipografia")
  nm <- setdiff(names(tip), c("unidad", "fuente", "cifra_minimo", grep("^portada", names(tip), value = TRUE)))
  nm <- nm[order(-vapply(nm, function(n) as.numeric(tip[[n]]), 0))]
  azul <- .std_color("azul"); tenue <- .std_color("texto_tenue")
  mitad <- ceiling(length(nm) / 2); w <- (ancho - 0.5) / 2
  y <- c(y0, y0)
  for (i in seq_along(nm)) {
    col <- if (i <= mitad) 1L else 2L
    pt <- as.numeric(tip[[nm[i]]]); h <- max(0.3, pt * 1.25 / 72)
    x <- x0 + (col - 1L) * (w + 0.5)
    .lam_txt(lz, gsub("_", " ", nm[i]), x, y[col] + h - 0.3, 2.1, 0.3, 10, tenue, nombre = "estandar:rol")
    .lam_txt(lz, sprintf("%s pt", format(pt)), x + 2.1, y[col] + h - 0.3 - (pt - 10) / 144, w - 2.1, h + 0.05, pt, azul,
             bold = pt >= 24, nombre = "estandar:muestra_tipo")
    y[col] <- y[col] + h + 0.06
  }
}

#' Lámina «Reglas de la identidad» de una parte del estándar
#' @keywords internal
.lam_laminas_estandar <- function(doc, slots, folio = NULL, ante = "Reglas de la identidad", layout = "Graficos",
                                  master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  parte <- .estandar_parte(slots$parte)
  titulo <- as.character(slots$title %||% .ESTANDAR_TITULOS[[parte]])[1]
  ml <- .std_geom("margen_izq"); W <- .std_geom("ancho"); ac <- W - ml - .std_geom("margen_der"); yt <- .std_geom("zona_datos_y0")
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante)
  lz <- .lam_lienzo()
  if (parte %in% c("respuestas", "apoyo")) {
    grupos <- .estandar_grupos(parte); x_uso <- ml + 7.9; paso <- (.std_geom("zona_datos_y1") - yt) / length(grupos)
    for (i in seq_along(grupos)) .estandar_fila(lz, grupos[[i]], yt + (i - 1) * paso - 0.1, ml, 7.6, x_uso, W - .std_geom("margen_der") - x_uso)
  } else if (identical(parte, "colores")) {
    .estandar_colores(lz, ml, yt - 0.05, ac)
  } else {
    .estandar_tipografia(lz, ml, yt - 0.1, ac)
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:estandar")
  pie <- sprintf("Fuente: estandar_pulso.json, versión %s. Tipografía %s", .std_valor("version"), .std_pt("fuente"))
  list(doc = por_lamina(.lam_pie(doc, pie, folio)))
}
