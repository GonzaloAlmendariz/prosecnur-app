# Histograma nativo de lámina completa que se lee como una distribución (revisión de Gonzalo del PPT v7 de CCSS Perfil
# 2026, lámina 8, «¿Cuál es tu edad?»: «tenemos que proponer de forma imperante la mejora completa del histograma»).
#
# Lo que cambia frente a la lámina 79 del recetario (lamina_numericos.R):
#  - las barras van contiguas, con un hueco uniforme de 0.03 in, sobre una línea de base fina: se leen como una sola
#    forma y no como columnas sueltas;
#  - el valor de una barra de un solo caso ya no dice «0%» (`.histograma_cifra_con_frecuencia`).
#
# Revisión del PPT v7.11 (lámina 11): «aún puede verse mejor».
#  - Jerarquía de las cifras: el porcentaje arriba, en negrita, y los casos debajo, más chicos y en gris tenue. Antes
#    «103 (26%)» iba en dos líneas del mismo peso y el conteo competía con el porcentaje.
#  - La mediana ya no corta su barra. Con `marca_mediana = "linea"` (defecto) una línea fina coral baja desde su rótulo
#    hasta la cifra de su barra y el valor del eje va en coral; si cae entre dos valores, la línea corre por el hueco
#    hasta la base. Con `"triangulo"` un triángulo coral queda bajo la base y el rótulo va bajo el eje, en la columna de
#    la mediana. Gonzalo no eligió todavía entre las dos (mando `marca_mediana` de `p_histograma`).
#  - Eje legible: el valor de cada barra en gris oscuro bajo una marca fina, separado de las cifras de arriba.
#  - Aire uniforme: la misma distancia entre la barra y su cifra en todas las columnas.
#  - (Retirado en la revisión del PPT v7.23, ítem 3: «no me gusta que hayan dos colores diferentes de barras».) Las
#    barras de pocos casos ya no van en azul tenue: todo el histograma va en un solo azul, barras y cifras.
# La cola de valores con pocos casos se junta con el mando `limite_superior` del plan («30+»); el motor no la impone.
# Cifras, mediana y conteos son los de la espec: sólo cambia el dibujo.

.LAM_HIST_HUECO <- 0.03     # aire entre barras vecinas (in)
.LAM_HIST_ROTULO_MED <- 0.3 # alto de la franja del rótulo de la mediana (in)
.LAM_HIST_AIRE <- 0.05      # entre el tope de la barra y su cifra (in)

#' Marca de la mediana declarada: «linea» (defecto) o «triangulo»
#' @keywords internal
.lam_hist_marca <- function(x) {
  x <- tolower(as.character(x %||% "linea")[1])
  if (is.na(x) || !x %in% c("linea", "triangulo")) "linea" else x
}

#' Parte la cifra de una barra en porcentaje (principal) y casos (secundaria)
#'
#' «103 (26%)» da `pct = "26%"` y `casos = "103"`; una cifra sin paréntesis («26%» o, en modo conteo, «103») queda entera
#' como principal y sin casos.
#' @keywords internal
.lam_hist_cifras <- function(cifras) {
  m <- regmatches(cifras, regexec("^\\s*([^()]+?)\\s*\\(([^()]*)\\)\\s*$", cifras))
  pct <- vapply(seq_along(cifras), function(k) if (length(m[[k]]) == 3L) m[[k]][3] else cifras[k], "")
  casos <- vapply(seq_along(cifras), function(k) if (length(m[[k]]) == 3L) m[[k]][2] else "", "")
  list(pct = pct, casos = casos, con_casos = any(nzchar(casos)))
}

#' Dibuja el histograma entre `y0` (arriba) y `y1` (abajo, bajo los valores del eje)
#'
#' @param espec Especificación `histograma/1` (`.histograma_recetario`). `espec$x_mediana` es la posición de la mediana
#'   en columnas desde 0 (la primera barra); entre dos valores queda en medio de sus barras. `espec$marca_mediana`,
#'   «linea» o «triangulo».
#' @return El `y` donde termina lo dibujado.
#' @keywords internal
.lam_histograma_distribucion <- function(lz, espec, x, y0, w, y1) {
  azul <- .std_color("azul"); coral <- .std_color("coral"); tenue <- .std_color("texto_tenue"); suave <- .std_color("texto_suave")
  n <- length(espec$valores); wcol <- w / n; vmax <- max(espec$valores)
  cf <- .lam_hist_cifras(as.character(espec$cifras))
  pt_pct <- 12; pt_casos <- 9
  h_pct <- 0.22; h_casos <- if (cf$con_casos) 0.17 else 0
  h_cif <- h_pct + h_casos
  texto_med <- as.character(espec$texto_mediana %||% "")[1]
  med <- is.finite(suppressWarnings(as.numeric(espec$x_mediana)[1])) && nzchar(texto_med %||% "")
  marca <- .lam_hist_marca(espec$marca_mediana)
  tri <- med && identical(marca, "triangulo")
  # De abajo hacia arriba: el rótulo de la mediana (con el triángulo), los valores del eje, su marca y la base.
  h_rot_bajo <- if (tri) 0.3 else 0
  y_eje <- y1 - 0.34 - h_rot_bajo                                       # el borde de arriba de los valores del eje
  yb <- y_eje - (if (tri) 0.2 else 0.1)                                 # la base; con triángulo, el triángulo va debajo
  y_top <- y0 + (if (med && !tri) .LAM_HIST_ROTULO_MED + 0.14 else 0) + h_cif + .LAM_HIST_AIRE
  hb <- max(0.5, yb - y_top)
  xm <- if (med) x + (as.numeric(espec$x_mediana)[1] + 0.5) * wcol else NA_real_
  centro <- if (med) abs(x + (seq_len(n) - 0.5) * wcol - xm) < wcol * 0.25 else rep(FALSE, n)
  tope_cifra <- rep(yb, n)
  for (k in seq_len(n)) {
    hk <- if (vmax > 0) hb * espec$valores[k] / vmax else 0; xk <- x + (k - 1) * wcol
    if (hk > 0) {
      .lam_caja(lz, xk + .LAM_HIST_HUECO / 2, yb - hk, wcol - .LAM_HIST_HUECO, hk, azul, nombre = "histograma:barra")
      y_c <- yb - hk - .LAM_HIST_AIRE - h_cif
      if (nzchar(cf$pct[k])) {
        .lam_txt(lz, cf$pct[k], xk, y_c - 0.04, wcol, 0.3, pt_pct, azul, bold = TRUE, align = "center",
                 nombre = "histograma:cifra")
        if (nzchar(cf$casos[k])) .lam_txt(lz, cf$casos[k], xk, y_c + h_pct - 0.05, wcol, 0.24, pt_casos, tenue, align = "center",
                                          nombre = "histograma:casos")
        tope_cifra[k] <- y_c - 0.04   # el borde de la caja del porcentaje
      } else {
        tope_cifra[k] <- yb - hk
      }
    }
    es_med <- med && centro[k]
    .lam_caja(lz, xk + wcol / 2 - 0.004, yb, 0.008, 0.06, .std_color("filete"), nombre = "histograma:marca")
    .lam_txt(lz, espec$rotulos[k], xk, y_eje - 0.02, wcol, 0.28, 11, if (es_med) coral else suave, bold = es_med, align = "center",
             nombre = "histograma:valor")
  }
  .lam_linea(lz, x, yb, x + w, yb, tenue, pt = 0.75, nombre = "histograma:base")
  if (med && !tri) {
    # La línea baja desde el rótulo hasta la cifra de la barra de la mediana y no entra en la barra; entre dos valores,
    # corre por el hueco hasta la base.
    y_ini <- y0 + .LAM_HIST_ROTULO_MED + 0.02
    y_fin <- if (any(centro)) tope_cifra[which(centro)[1]] - 0.03 else yb
    if (y_fin > y_ini) .lam_linea(lz, xm, y_ini, xm, y_fin, coral, pt = 0.75, nombre = "histograma:mediana")
    wt <- .lam_ancho_tinta(texto_med, 12, TRUE) + 0.3
    xt <- min(max(x, xm - wt / 2), x + w - wt)
    .lam_txt(lz, texto_med, xt, y0, wt, .LAM_HIST_ROTULO_MED, 12, coral, bold = TRUE, align = "center", nombre = "histograma:texto_mediana")
  } else if (tri) {
    a <- 0.12
    .lam_forma_borde(lz, xm - a * 0.6, yb + 0.05, a * 1.2, a, fill = coral, geom = "triangle", nombre = "histograma:mediana:triangulo")
    wt <- .lam_ancho_tinta(texto_med, 11, TRUE) + 0.3
    xt <- min(max(x, xm - wt / 2), x + w - wt)
    .lam_txt(lz, texto_med, xt, y1 - 0.34, wt, 0.28, 11, coral, bold = TRUE, align = "center", nombre = "histograma:texto_mediana")
  }
  invisible(y1)
}
