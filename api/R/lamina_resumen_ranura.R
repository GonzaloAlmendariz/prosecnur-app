# =============================================================================
# lamina_resumen_ranura.R — los gráficos de resumen en cualquier ranura (ADR 0139, ítem 9 del checklist del catálogo)
# =============================================================================
#
# Gonzalo, 2026-11-08: «Todos estos gráficos no deberían ser sólo del resumen ejecutivo… sino gráficos abiertos a todo
# tipo de láminas de gráficos». El panorama, las fortalezas, la cobertura, el contraste de públicos y las aperturas por
# grupo (`p_dumbbell` estilo resumen) y la escala con Sin información aparte (`p_barras_divergentes` estilo resumen)
# tenían lámina nativa sólo a página entera (lamina_contraste.R, lamina_fortalezas.R, lamina_cobertura.R,
# lamina_divergentes_resumen.R). En la lámina de dos y de cuatro gráficos ninguna ranura cabía en piezas nativas y la
# lámina entera caía a la plantilla anterior: rótulos montados, cifras encimadas y, con el panorama, un error que tumbaba
# el informe (`.espec_n_base` no sabe contar un gráfico de varios públicos).
#
# Aquí cada tipo tiene su geometría dentro del rectángulo de una ranura (`.lam_rr_geo`) y su dibujo (`.lam_rr_dibujar`),
# con el estándar de la casa: la columna de rótulos crece con su tinta hasta su tope y, si no basta, la letra baja de a
# medio punto hasta el piso de 10.5 pt y el rótulo se recorta con «…» (con aviso); la barra lleva el grosor de la tabla
# del estándar sin pasar del 60–74 % de su fila. `.lam_panel_geo` y `.lam_panel_mixto` (lamina_mixtas.R) los llaman.
# Nada cambia en los números: cada público conserva su base y su denominador (los de la espec que armó el graficador).
# Lo que la lámina de página entera escribe al pie (base por grupo, sentido de la diferencia, regla) va al pie de la
# lámina compuesta (`.lam_rr_pie`).

#' ¿Es un gráfico de resumen que sabe ir en una ranura? Devuelve su clase o `NA`
#' @keywords internal
.lam_rr_tipo <- function(espec) {
  if (!is.list(espec)) return(NA_character_)
  t <- as.character(espec$tipo %||% "")[1]
  if (t %in% c("panorama", "contraste", "fortalezas", "cobertura")) return(t)
  if (identical(t, "divergentes") && identical(espec$estilo, "resumen")) return("divergentes_resumen")
  NA_character_
}

#' Alto de una línea de `size` pt, en pulgadas
#' @keywords internal
.lam_rr_lh <- function(size) size * 1.2 / 72

#' Un rótulo cortado al medio: el comienzo, «…» y el final, para que el predicado no se pierda
#'
#' Ronda 2, ítem 2: recortar por el final dejaba «Los procesos de selección y contratación de los(as)…» en dos filas que
#' se leían iguales (una terminaba en «justos», la otra en «transparentes»). Aquí se conservan las últimas palabras (al
#' menos `e_min`, de preferencia tres) y se agregan las del comienzo que quepan en `lineas` líneas.
#' @return `list(lineas, texto, recortado)`, como `.lam_rotulo_recortar`.
#' @keywords internal
.lam_rr_recortar_medio <- function(s, w, size, lineas = 3L, e_min = 1L) {
  s <- trimws(as.character(s %||% "")[1]); if (is.na(s)) s <- ""
  util <- max(0.3, (w - 0.2 - 0.02) * 0.95)
  envolver <- function(t) .lam_tyc_envolver(t, util, size, FALSE)
  if (length(envolver(s)) <= lineas) return(list(lineas = envolver(s), texto = s, recortado = FALSE))
  util <- util * 0.9   # con holgura, como `.lam_rotulo_recortar`: el visor parte antes
  pal <- strsplit(s, "\\s+")[[1]]; n <- length(pal)
  cabe <- function(t) length(envolver(t)) <= lineas
  mejor <- NULL
  for (e in seq(min(max(1L, e_min), n - 1L), max(1L, n - 1L))) {
    fin <- paste(pal[(n - e + 1L):n], collapse = " ")
    if (!cabe(paste("…", fin))) break
    a <- 0L
    while (a + 1L < n - e && cabe(paste(paste(pal[seq_len(a + 1L)], collapse = " "), "…", fin))) a <- a + 1L
    t <- if (a > 0L) paste(paste(pal[seq_len(a)], collapse = " "), "…", fin) else paste("…", fin)
    puntaje <- a + 2 * min(e, 3L) + e / 100   # de preferencia tres palabras del final; luego, las más palabras
    if (is.null(mejor) || puntaje > mejor$puntaje) mejor <- list(texto = t, puntaje = puntaje)
  }
  if (is.null(mejor)) return(.lam_rotulo_recortar(s, w, size, lineas))
  list(lineas = envolver(mejor$texto), texto = mejor$texto, recortado = TRUE)
}

#' Rótulos cortados al medio sin que dos queden iguales (si coinciden, se conserva una palabra más del final)
#' @keywords internal
.lam_rr_recortar_lote <- function(textos, w, size, lineas) {
  e_min <- rep(1L, length(textos))
  rr <- lapply(textos, function(t) .lam_rr_recortar_medio(t, w, size, lineas))
  for (vuelta in 1:6) {
    tx <- vapply(rr, `[[`, "", "texto")
    dup <- which(duplicated(tx) | duplicated(tx, fromLast = TRUE))
    dup <- dup[!duplicated(textos[dup])]   # dos preguntas con el mismo enunciado se leen iguales y está bien
    if (!length(dup)) break
    for (i in dup) { e_min[i] <- e_min[i] + 1L; rr[[i]] <- .lam_rr_recortar_medio(textos[i], w, size, lineas, e_min = e_min[i]) }
  }
  rr
}

#' Rótulos de fila en una columna que crece con su tinta: letra, ancho, paso común, alto de cada fila y cuántas filas van
#'
#' Ronda 2, ítem 2. En este orden: (1) el enunciado entero en hasta `max_lin` líneas, bajando la letra hasta el piso de
#' 10.5 pt y ensanchando la columna; (2) menos filas —las primeras, que son las que eligió la regla en su orden—, hasta
#' `n_min`, y la lámina lo dice al pie; (3) todas las filas con el rótulo cortado al medio, conservando el final.
#' @param pasos Pasos por fila (1 en pares; k + 0.7 con k grupos). @param u_min,u_max Paso común admitido.
#' @param n_min Filas que deben quedar como mínimo antes de cortar rótulos.
#' @return Lista con `size`, `wq` (ancho de la columna), `u`, `alturas`, `textos`, `lineas`, `recortados`, `k` (filas que
#'   van), o `NULL` si las filas no caben.
#' @keywords internal
.lam_rr_filas <- function(textos, w_min, w_max, disponible, pasos, u_min, u_max, desde = 11, max_lin = 3L,
                          n_min = max(2L, ceiling(length(textos) / 2))) {
  if (!length(textos) || w_max < w_min - 1e-9 || disponible <= 0) return(NULL)
  prueba <- function(size, w, lineas, recortar, k = length(textos)) {
    tx <- textos[seq_len(k)]; ps <- pasos[seq_len(k)]
    rr <- if (recortar) .lam_rr_recortar_lote(tx, w, size, lineas) else lapply(tx, function(t) .lam_rotulo_recortar(t, w, size, lineas))
    if (!recortar && any(vapply(rr, `[[`, TRUE, "recortado"))) return(NULL)
    necesita <- vapply(rr, function(r) length(r$lineas), 0L) * .lam_rr_lh(size) + 0.05
    alto <- function(u) sum(pmax(ps * u, necesita))
    if (alto(u_min) > disponible + 1e-9) return(NULL)
    lo <- u_min; hi <- u_max
    if (alto(hi) <= disponible) lo <- hi else for (it in 1:40) { mid <- (lo + hi) / 2; if (alto(mid) <= disponible) lo <- mid else hi <- mid }
    list(size = size, wq = w, u = lo, alturas = pmax(ps * lo, necesita), textos = vapply(rr, `[[`, "", "texto"), lineas = lineas,
         recortados = sum(vapply(rr, `[[`, TRUE, "recortado")), k = k)
  }
  enteros <- function(k) {
    for (size in .lam_rotulo_pasos_pt(desde)) {
      tinta <- max(vapply(textos[seq_len(k)], function(t) .lam_ancho_tinta(t, size, FALSE), 0))
      w0 <- min(w_max, max(w_min, tinta + 0.25))
      for (w in unique(c(seq(w0, w_max, by = 0.1), w_max))) {
        e <- prueba(size, w, max_lin, FALSE, k)
        if (!is.null(e)) return(e)
      }
    }
    NULL
  }
  n <- length(textos)
  for (k in unique(c(n, if (n > n_min) seq(n - 1L, n_min)))) {
    e <- enteros(k)
    if (!is.null(e)) return(e)
  }
  for (lineas in rev(seq_len(max_lin))) {
    e <- prueba(.LAM_ROTULO_PT_PISO, w_max, lineas, TRUE)
    if (!is.null(e)) return(e)
  }
  NULL
}

#' Geometría de un gráfico de resumen dentro de una ranura
#'
#' @param x,y,w,h Rectángulo libre de la ranura (bajo su enunciado, si lo lleva).
#' @return Lista con `tipo = "resumen"`, `clase`, `cabe` y lo que su dibujo necesita.
#' @keywords internal
.lam_rr_geo <- function(espec, x, y, w, h) {
  clase <- .lam_rr_tipo(espec)
  g <- switch(clase,
    contraste = .lam_rr_contraste_geo(espec, x, y, w, h),
    panorama = .lam_rr_panorama_geo(espec, x, y, w, h),
    fortalezas = .lam_rr_fortalezas_geo(espec, x, y, w, h),
    cobertura = .lam_rr_cobertura_geo(espec, x, y, w, h),
    divergentes_resumen = .lam_rr_divergentes_geo(espec, x, y, w, h),
    list(cabe = FALSE))
  c(list(tipo = "resumen", clase = clase, x = x, y = y, w = w, h = h), g)
}

#' Dibuja un gráfico de resumen en su ranura
#' @return El `y` donde terminó lo dibujado.
#' @keywords internal
.lam_rr_dibujar <- function(lz, espec, geo) {
  y <- switch(geo$clase,
    contraste = .lam_rr_contraste(lz, espec, geo),
    panorama = .lam_rr_panorama(lz, espec, geo),
    fortalezas = .lam_rr_fortalezas(lz, espec, geo),
    cobertura = .lam_rr_cobertura(lz, espec, geo),
    divergentes_resumen = .lam_rr_divergentes(lz, espec, geo))
  if (isTRUE(geo$recortados > 0L)) .lam_rotulos_aviso(geo$recortados, geo$lineas %||% 3L)
  if (isTRUE(geo$k < geo$n_total)) .lam_rr_menos_filas(espec, geo)
  invisible(y %||% (geo$y + geo$h))
}

.LAM_RR_PIE <- new.env(parent = emptyenv())

#' Una ranura que muestra menos filas de las que eligió su regla: lo dice al pie de la lámina y avisa
#' @keywords internal
.lam_rr_menos_filas <- function(espec, geo) {
  etq <- .lam_rr_etiqueta(espec, NA_integer_)
  quien <- if (grepl("^Gráfico", etq)) "una ranura" else paste("la ranura de", etq)
  que <- if (identical(geo$clase, "fortalezas")) sprintf("las %d más altas y las %d más bajas", geo$k, geo$k) else sprintf("las %d primeras", geo$k)
  nota <- sprintf("Por espacio, %s muestra %s de %d", quien, que, geo$n_total)
  .LAM_RR_PIE$notas <- unique(c(.LAM_RR_PIE$notas, nota))
  .pulso_aviso(paste0(nota, "; para verlas todas, usa una lámina de un gráfico o nombres cortos."))
}

#' El pie de la lámina compuesta con las notas de filas de menos de sus ranuras (y las vacía para la siguiente lámina)
#' @keywords internal
.lam_rr_pie_menos_filas <- function(base) {
  notas <- .LAM_RR_PIE$notas; .LAM_RR_PIE$notas <- NULL
  if (!length(notas)) return(base)
  b <- as.character(base %||% "")[1]; if (is.na(b)) b <- ""
  .lam_con_punto(do.call(.lam_unir_base, as.list(c(if (nzchar(b)) b, notas))))
}

#' Una guía rotulada de cada cuántas, para que las cifras del eje no se toquen (0.45 in entre rótulos como mínimo)
#' @keywords internal
.lam_rr_eje_cada <- function(px, eje) {
  paso <- px(eje[["lo"]] + eje[["paso"]]) - px(eje[["lo"]])
  if (!is.finite(paso) || paso <= 0) return(1L)
  as.integer(max(1L, ceiling(0.45 / paso)))
}

#' Pie de la lámina compuesta con las notas de sus gráficos de resumen
#'
#' Tras la base, cada parte una vez. Lo que la base ya dice sale sólo si es la misma frase (comparación exacta de frases,
#' no de subcadenas: «Base: Docentes 93 a 115» no se come una nota más larga que la contenga). Si las ranuras son de
#' públicos distintos, la nota de cada una va con su etiqueta («Docentes: base 93 a 115; se muestran…»), para que no se
#' lea como de toda la lámina (revisión metodológica de la ronda 2).
#' @keywords internal
.lam_rr_pie <- function(base, especs) {
  conjuntos <- lapply(seq_along(especs), function(k) list(partes = .lam_rr_nota_partes(especs[[k]]), publico = .lam_rr_publico(especs[[k]]),
                                                         etiqueta = .lam_rr_etiqueta(especs[[k]], k)))
  conjuntos <- Filter(function(cj) length(cj$partes) > 0L, conjuntos)
  if (!length(conjuntos)) return(base)
  b <- as.character(base %||% "")[1]; if (is.na(b)) b <- ""
  norm <- function(x) tolower(gsub("\\s+", " ", sub("[.[:space:]]+$", "", trimws(x))))
  frases_base <- norm(unlist(strsplit(b, "(?<=[.])\\s+", perl = TRUE)))
  quitar_base <- function(p) p[!norm(p) %in% frases_base]
  # Mismo gráfico en dos ranuras (o el mismo juego de notas): una sola vez.
  conjuntos <- conjuntos[!duplicated(lapply(conjuntos, `[[`, "partes"))]
  publicos <- unique(vapply(conjuntos, `[[`, "", "publico"))
  if (length(conjuntos) == 1L || length(publicos) == 1L) {
    partes <- quitar_base(unique(unlist(lapply(conjuntos, `[[`, "partes"))))
    if (!length(partes)) return(base)
    return(.lam_con_punto(do.call(.lam_unir_base, as.list(c(if (nzchar(b)) b, partes)))))
  }
  minuscula <- function(x) paste0(tolower(substr(x, 1, 1)), substring(x, 2))
  # La base de la lámina que es exactamente la unión de las bases por público («Base: Docentes 93 a 115 y Estudiantes
  # 279», `.lam_bases_unir`) ya dice la de cada ranura: no se repite bajo cada etiqueta.
  es_base <- function(p) grepl("^Base:", p)
  bases_pub <- unlist(lapply(conjuntos, function(cj) cj$partes[es_base(cj$partes)]))
  if (length(bases_pub) && norm(.lam_bases_unir(unique(bases_pub))) %in% frases_base) {
    for (k in seq_along(conjuntos)) conjuntos[[k]]$partes <- conjuntos[[k]]$partes[!es_base(conjuntos[[k]]$partes)]
  }
  # Lo que dicen todas las ranuras igual («Barras: Top Two Box de cada pregunta») va una vez, sin etiqueta, al final.
  comunes <- Reduce(intersect, lapply(conjuntos, `[[`, "partes"))
  for (k in seq_along(conjuntos)) conjuntos[[k]]$partes <- setdiff(conjuntos[[k]]$partes, comunes)
  notas <- vapply(conjuntos, function(cj) {
    p <- quitar_base(cj$partes)
    if (!length(p)) return("")
    # «Base: Docentes 93 a 115» bajo la etiqueta «Docentes» se lee «base 93 a 115».
    p <- sub(paste0("^Base:\\s*(", gsub("([.()+*?^$|\\[\\]])", "\\\\\\1", cj$etiqueta), "\\s+)?"), "base ", p)
    paste0(cj$etiqueta, ": ", paste(minuscula(p), collapse = "; "))
  }, "")
  notas <- c(notas[nzchar(notas)], quitar_base(comunes))
  if (!length(notas)) return(base)
  .lam_con_punto(do.call(.lam_unir_base, as.list(c(if (nzchar(b)) b, notas))))
}

#' El público de un gráfico de resumen (para saber si dos ranuras hablan de públicos distintos)
#' @keywords internal
.lam_rr_publico <- function(espec) {
  clase <- .lam_rr_tipo(espec)
  p <- switch(clase %||% "",
    fortalezas = espec$publico,
    contraste = sort(as.character(espec$grupos)),
    panorama = sort(as.character(espec$publicos)),
    divergentes_resumen = sort(unique(regmatches(espec$filas, regexpr("\\([^()]{1,24}\\)$", espec$filas)))),
    character(0))
  paste(as.character(unlist(p)), collapse = "|")
}

#' Etiqueta de una ranura en el pie: su público si lo tiene; si no, «Gráfico k» en orden de lectura
#' @keywords internal
.lam_rr_etiqueta <- function(espec, k) {
  clase <- .lam_rr_tipo(espec)
  e <- switch(clase %||% "",
    fortalezas = espec$publico,
    contraste = { g <- as.character(espec$grupos); if (length(g) == 2L) paste(g[1], "y", tolower(g[2])) else NULL },
    NULL)
  e <- as.character(unlist(e %||% character(0)))[1]
  if (length(e) && !is.na(e) && nzchar(trimws(e))) trimws(e) else sprintf("Gráfico %d", k)
}

#' Lo que la lámina de página entera escribe al pie de cada gráfico de resumen (base por grupo, sentido, regla)
#'
#' En la lámina compuesta va al pie, tras la base: el pie es el único lugar con ancho para decirlo.
#' @return Las partes de la nota, en orden (vacío si no es un gráfico de resumen).
#' @keywords internal
.lam_rr_nota_partes <- function(espec) {
  clase <- .lam_rr_tipo(espec)
  if (is.na(clase)) return(character(0))
  texto <- function(x) if (is.null(x) || !length(x) || is.na(x[1]) || !nzchar(trimws(as.character(x)[1]))) NULL else sub("\\.$", "", trimws(as.character(x)[1]))
  p <- switch(clase,
    contraste = list(texto(espec$nota_base), texto(.contraste_sentido_nota(espec)), texto(espec$nota_grupo_chico), texto(espec$texto_regla)),
    panorama = list(sprintf("Cada marca es una pregunta (%s)", espec$indicador %||% "Top Two Box"), texto(espec$texto_regla)),
    fortalezas = list(texto(espec$nota_base), texto(espec$texto_regla), sprintf("Barras: %s de cada pregunta", espec$indicador %||% "Top Two Box")),
    cobertura = list(),
    divergentes_resumen = list(texto(espec$nota_porcentaje), texto(espec$texto_regla)))
  as.character(unlist(p))
}

# --- Contraste de públicos y aperturas por grupo (`contraste/1`) ------------------------------------------------------

#' @keywords internal
.lam_rr_contraste_geo <- function(espec, x, y, w, h) {
  n <- length(espec$rotulos); k <- length(espec$grupos); par <- identical(espec$modo, "par")
  if (n < 1L || k < 2L || k > 4L) return(list(cabe = FALSE))
  ley <- espec$leyenda %||% espec$grupos
  wd <- max(0.8, .lam_ancho_tinta(espec$encabezado_diferencia %||% "Diferencia", 10, TRUE) + 0.25)
  cab <- 0.36; eje <- 0.28
  disponible <- h - cab - eje - 0.02
  pasos <- if (par) rep(1, n) else rep(k + 0.7, n)
  wp_min <- 2.2
  w_max <- min(2.6, w - wd - 0.35 - wp_min - 0.15)
  f <- .lam_rr_filas(espec$rotulos, 1.2, w_max, disponible, pasos, if (par) 0.22 else 0.13, if (par) 0.45 else 0.24, desde = 11)
  if (is.null(f)) return(list(cabe = FALSE))
  xl <- x + f$wq + 0.15; xr <- x + w - wd - 0.35
  f$n_total <- n
  ancho_ley <- function(l) sum(vapply(l, function(t) 0.14 + .lam_ancho_tinta(t, 10.5, FALSE) + 0.25 + 0.25, 0))
  # Con tres o cuatro grupos la leyenda lleva el n de cada uno ("2do ciclo (139)"); si así no cabe en la ranura, va sólo con
  # el nombre: el n sigue en la nota de la base (graficos_dumbbell_tres_grupos.R).
  if (ancho_ley(ley) > w - wd + 1e-6) ley <- espec$grupos
  wley <- ancho_ley(ley)
  # La leyenda arranca sobre el área de puntos; si no cabe hasta la columna de la diferencia, desde el margen de la ranura.
  x_ley <- if (wley <= (x + w - wd) - (xl - 0.05) + 1e-6) xl - 0.05 else x
  c(f, list(cabe = (xr - xl) >= wp_min - 1e-6 && wley <= (x + w - wd) - x_ley + 1e-6,
            xl = xl, xr = xr, wd = wd, cab = cab, eje = eje, disponible = disponible, ley = ley, x_ley = x_ley, pasos = pasos))
}

#' @keywords internal
.lam_rr_contraste <- function(lz, espec, ge) {
  azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  n <- ge$k %||% length(espec$rotulos); k <- length(espec$grupos); par <- identical(espec$modo, "par")
  espec$separadores <- (espec$separadores %||% integer(0))[(espec$separadores %||% integer(0)) < n]
  eje <- espec$eje; px <- function(v) ge$xl + (ge$xr - ge$xl) * (v - eje[["lo"]]) / (eje[["hi"]] - eje[["lo"]])
  alturas <- ge$alturas
  y_ley <- ge$y + max(0, ge$disponible - sum(alturas)) / 2; y0 <- y_ley + ge$cab; y1 <- y0 + sum(alturas)
  xp0 <- ge$xl; xp1 <- ge$xr + 0.3
  .lam_caja(lz, xp0, y0, xp1 - xp0, y1 - y0, "#FFFFFF", nombre = "puntos:panel")
  banda <- .lam_aclarar(.std_color("cebra"), 0.55)
  centros <- y0 + cumsum(alturas) - alturas / 2
  for (i in seq_len(n)) if (i %% 2L == 1L) .lam_caja(lz, xp0, centros[i] - alturas[i] / 2, xp1 - xp0, alturas[i], banda, nombre = "puntos:banda")
  .lam_puntos_eje(lz, px, eje, y0, y1, cada = .lam_rr_eje_cada(px, eje))
  for (s in espec$separadores %||% integer(0)) {
    ys <- y0 + sum(alturas[seq_len(s)])
    .lam_linea(lz, ge$x, ys, ge$x + ge$w, ys, .std_color("texto_tenue"), pt = 0.9, nombre = "puntos:separador", dash = "dash")
  }
  seg <- .lam_aclarar(.std_color("tenue"), 0.4)
  xs <- ge$x + ge$w - ge$wd / 2
  for (i in seq_len(n)) {
    yc <- centros[i]
    .lam_txt(lz, ge$textos[i], ge$x - 0.1, yc - alturas[i] / 2, ge$wq + 0.1, alturas[i], ge$size, azul,
             align = "right", nombre = "puntos:rotulo", anclaje = "ctr")
    v <- espec$valores[i, ]
    if (par) {
      lo <- min(v); hi <- max(v)
      .lam_caja(lz, px(lo), yc - 0.02, max(0.01, px(hi) - px(lo)), 0.04, seg, nombre = "puntos:segmento")
      orden <- order(v)
      for (j in rev(seq_len(k))) .lam_marca(lz, espec$formas[j], px(v[j]), yc, 0.14, espec$colores[j], nombre = "puntos:marca")
      jl <- orden[1]; jh <- orden[2]
      .lam_txt(lz, espec$cifras[i, jl], px(v[jl]) - 0.03 - 0.6, .lam_y_centrada(yc, 10), 0.6, 0.25, 10, suave, align = "right", nombre = "puntos:cifra")
      .lam_txt(lz, espec$cifras[i, jh], px(v[jh]) + 0.03, .lam_y_centrada(yc, 10), 0.6, 0.25, 10, suave, nombre = "puntos:cifra")
    } else {
      for (j in seq_len(k)) {
        ys <- yc + (j - (k + 1) / 2) * ge$u
        .lam_caja(lz, px(eje[["lo"]]), ys - 0.012, max(0.01, px(v[j]) - px(eje[["lo"]])), 0.024, .lam_aclarar(espec$colores[j], 0.7), nombre = "puntos:tallo")
        .lam_marca(lz, espec$formas[j], px(v[j]), ys, 0.11, espec$colores[j], nombre = "puntos:marca")
        .lam_txt(lz, espec$cifras[i, j], px(v[j]) - 0.02, .lam_y_centrada(ys, 9.5), 0.6, 0.24, 9.5, azul, nombre = "puntos:cifra")
      }
    }
    .lam_txt(lz, espec$textos_diferencia[i], xs - ge$wd / 2, .lam_y_centrada(yc, 11), ge$wd, 0.3, 11, azul, bold = TRUE, align = "center",
             nombre = "puntos:diferencia")
  }
  .lam_txt(lz, espec$encabezado_diferencia %||% "Diferencia", xs - ge$wd / 2, y0 - 0.32, ge$wd, 0.28, 10, suave, bold = TRUE, align = "center",
           nombre = "tabla:encabezado")
  .lam_puntos_leyenda(lz, ge$x_ley, y0 - ge$cab, ge$ley, espec$colores, espec$formas)
  invisible(y1 + ge$eje)
}

# --- Panorama (`panorama/1`) ------------------------------------------------------------------------------------------

#' @keywords internal
.lam_rr_panorama_geo <- function(espec, x, y, w, h) {
  k <- length(espec$publicos)
  if (k < 1L || k > 5L) return(list(cabe = FALSE))
  size_rot <- 12
  tinta <- max(vapply(espec$publicos, function(t) .lam_ancho_tinta(t, size_rot, TRUE), 0))
  if (tinta + 0.25 > 1.9) { size_rot <- 11; tinta <- max(vapply(espec$publicos, function(t) .lam_ancho_tinta(t, size_rot, TRUE), 0)) }
  wrot <- max(0.9, tinta + 0.25)
  enc_bajo <- espec$encabezado_bajo %||% ""
  w_med <- max(0.8, .lam_ancho_tinta("Mediana", 10, TRUE) + 0.25)
  w_bajo <- max(0.85, .lam_ancho_tinta(enc_bajo, 10, TRUE) + 0.25, max(vapply(espec$textos_bajo, function(t) .lam_ancho_tinta(t, 10.5, FALSE), 0)) + 0.25)
  ley <- 0.32; cab <- 0.3; eje <- 0.32
  # Ronda 2, ítem 5 (C3): las filas crecen con el alto de la ranura hasta 1.4 in (la de página entera llega a 1.5).
  hrow <- min(1.4, (h - ley - cab - eje - 0.05) / k)
  xl <- x + wrot + 0.1; xr <- x + w - w_med - w_bajo - 0.3
  ref <- espec$referencia
  wley <- 0.45 + .lam_ancho_tinta("Mediana del público", 10.5, FALSE) + 0.5 +
    (if (is.finite(ref %||% NA_real_)) 0.45 + .lam_ancho_tinta(sprintf("Referencia %s%%", format(ref, trim = TRUE)), 10.5, FALSE) + 0.2 else 0)
  list(cabe = wrot + 0.1 <= 1.95 + 1e-6 && hrow >= 0.32 && (xr - xl) >= 1.9 - 1e-6 && wley <= w + 1e-6,
       size_rot = size_rot, wrot = wrot, w_med = w_med, w_bajo = w_bajo, ley = ley, cab = cab, eje = eje, hrow = hrow, xl = xl, xr = xr,
       wley = wley)
}

#' @keywords internal
.lam_rr_panorama <- function(lz, espec, ge) {
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); tenue <- .std_color("texto_tenue")
  k <- length(espec$publicos); h <- ge$hrow
  eje <- espec$eje; px <- function(v) ge$xl + (ge$xr - ge$xl) * (v - eje[["lo"]]) / (eje[["hi"]] - eje[["lo"]])
  libre <- ge$h - ge$ley - ge$cab - ge$eje - 0.05 - h * k
  y_ley <- ge$y + max(0, libre) / 2; y0 <- y_ley + ge$ley + ge$cab; y1 <- y0 + h * k
  xp0 <- ge$xl; xp1 <- ge$xr + 0.15
  .lam_caja(lz, xp0, y0, xp1 - xp0, y1 - y0, "#FFFFFF", nombre = "puntos:panel")
  banda <- .lam_aclarar(.std_color("cebra"), 0.55)
  for (i in seq_len(k)) if (i %% 2L == 1L) .lam_caja(lz, xp0, y0 + (i - 1) * h, xp1 - xp0, h, banda, nombre = "puntos:banda")
  .lam_puntos_eje(lz, px, eje, y0, y1, cada = .lam_rr_eje_cada(px, eje))
  ref <- espec$referencia
  if (is.finite(ref %||% NA_real_)) .lam_linea(lz, px(ref), y0, px(ref), y1, tenue, pt = 1, nombre = "panorama:referencia", dash = "dash")
  xm <- ge$xr + 0.3 + ge$w_med / 2; xb <- ge$xr + 0.3 + ge$w_med + ge$w_bajo / 2
  for (i in seq_len(k)) {
    yc <- y0 + (i - 0.5) * h
    .lam_txt(lz, espec$publicos[i], ge$x - 0.1, .lam_y_centrada(yc, ge$size_rot), ge$wrot + 0.1, 0.32, ge$size_rot, azul, bold = TRUE, align = "right",
             nombre = "puntos:rotulo")
    v <- espec$valores[[i]]; dy <- espec$desplazamientos[[i]]
    for (z in seq_along(v)) .lam_marca(lz, espec$formas[i], px(v[z]), yc + dy[z] * h * 0.62, 0.09, espec$colores[i], nombre = "panorama:punto")
    if (is.finite(espec$medianas[i])) .lam_caja(lz, px(espec$medianas[i]) - 0.015, yc - h * 0.36, 0.03, h * 0.72, azul, nombre = "panorama:mediana")
    .lam_txt(lz, espec$textos_mediana[i], xm - ge$w_med / 2, .lam_y_centrada(yc, 12), ge$w_med, 0.3, 12, azul, bold = TRUE, align = "center",
             nombre = "puntos:diferencia")
    .lam_txt(lz, espec$textos_bajo[i], xb - ge$w_bajo / 2, .lam_y_centrada(yc, 10.5), ge$w_bajo, 0.28, 10.5, suave, align = "center", nombre = "puntos:base")
  }
  yh <- y0 - 0.32
  .lam_txt(lz, "Mediana", xm - ge$w_med / 2, yh, ge$w_med, 0.28, 10, suave, bold = TRUE, align = "center", nombre = "tabla:encabezado")
  .lam_txt(lz, espec$encabezado_bajo %||% "", xb - ge$w_bajo / 2, yh, ge$w_bajo, 0.28, 10, suave, bold = TRUE, align = "center", nombre = "tabla:encabezado")
  # Leyenda: la mediana como línea y la referencia punteada, desde el área de puntos si cabe; si no, desde el margen.
  x <- if (ge$xl - 0.05 + ge$wley <= ge$x + ge$w) ge$xl - 0.05 else ge$x
  yl <- y_ley + 0.15
  .lam_caja(lz, x, yl - 0.02, 0.4, 0.04, azul, nombre = "leyenda:mediana")
  .lam_txt(lz, "Mediana del público", x + 0.45, y_ley, 2.2, 0.3, 10.5, azul, nombre = "leyenda:texto")
  x <- x + 0.45 + .lam_ancho_tinta("Mediana del público", 10.5, FALSE) + 0.5
  if (is.finite(ref %||% NA_real_)) {
    .lam_linea(lz, x, yl, x + 0.4, yl, tenue, pt = 1, nombre = "leyenda:referencia", dash = "dash")
    .lam_txt(lz, sprintf("Referencia %s%%", format(ref, trim = TRUE)), x + 0.45, y_ley, 2.0, 0.3, 10.5, azul, nombre = "leyenda:texto")
  }
  invisible(y1 + ge$eje)
}

# --- Fortalezas y alertas (`fortalezas/1`) ----------------------------------------------------------------------------

#' Las dos columnas lado a lado si caben; si no, una sobre otra. Gana la que recorta menos rótulos (a igualdad, lado a lado)
#' @keywords internal
.lam_rr_fortalezas_geo <- function(espec, x, y, w, h) {
  cols <- espec$columnas %||% list()
  if (length(cols) != 2L) return(list(cabe = FALSE))
  ns <- vapply(cols, function(cl) length(cl$rotulos), 0L)
  if (sum(ns) < 1L || any(ns > .FORTALEZAS_FILAS_MAX)) return(list(cabe = FALSE))
  size <- .LAM_ROTULO_PT_PISO; cab <- 0.42; n <- max(ns)
  prueba <- function(disp, k) {
    nk <- pmin(ns, k)
    if (identical(disp, "lado")) {
      wc <- (w - 0.35) / 2; hrow <- min(0.75, (h - cab) / max(nk)); xs <- c(x, x + wc + 0.35); ys <- c(y, y)
    } else {
      wc <- w; hrow <- min(0.6, (h - 2 * cab - 0.1) / sum(nk)); xs <- c(x, x); ys <- c(y, y + cab + hrow * nk[1] + 0.1)
    }
    wb <- max(0.7, wc * (if (identical(disp, "lado")) 0.25 else 0.4))
    wr <- min(3.2, wc - wb - 0.15 - 0.4)
    max_lin <- as.integer(max(1L, min(3L, floor((hrow - 0.06) / .lam_rr_lh(size)))))
    if (hrow < 0.24 || wr < 1.0) return(NULL)
    rot <- unlist(lapply(seq_along(cols), function(j) cols[[j]]$rotulos[seq_len(nk[j])]))
    rec <- sum(vapply(rot, function(t) .lam_rotulo_recortar(t, wr + 0.1, size, max_lin)$recortado, TRUE))
    list(disp = disp, wc = wc, hrow = hrow, xs = xs, ys = ys, wr = wr, wb = wb, lineas = max_lin, recortados = rec, k = k,
         n_total = n, g = min(.std_grosor(max(nk), "categorias"), hrow * 0.6), cab = cab, size = size)
  }
  # Ronda 2, ítem 2: primero los enunciados enteros con todas las filas; luego con menos filas (las más altas y las más bajas
  # primeras, que son las que eligió la regla); si no, todas las filas con el enunciado cortado al medio.
  k_min <- as.integer(max(2L, ceiling(n / 2)))
  for (k in unique(c(n, if (n > k_min) seq(n - 1L, k_min)))) {
    for (disp in c("lado", "apilado")) {
      o <- prueba(disp, k)
      if (!is.null(o) && o$recortados == 0L) return(c(o, list(cabe = TRUE)))
    }
  }
  # Con corte: gana la disposición que conserva más de cada enunciado (la peor fila manda), entre todas las filas y la
  # mitad; a igualdad, más filas. Dos o tres palabras de un enunciado de veinte no informan (revisión del lead, ronda 2).
  ops <- Filter(Negate(is.null), list(prueba("lado", n), prueba("apilado", n), prueba("lado", k_min), prueba("apilado", k_min)))
  if (!length(ops)) return(list(cabe = FALSE))
  conserva <- vapply(ops, function(o) {
    nk <- pmin(ns, o$k)
    rot <- unlist(lapply(seq_along(cols), function(j) cols[[j]]$rotulos[seq_len(nk[j])]))
    tx <- vapply(.lam_rr_recortar_lote(rot, o$wr + 0.1, size, o$lineas), `[[`, "", "texto")
    min(nchar(gsub("…", "", tx, fixed = TRUE)) / pmax(1, nchar(rot)))
  }, 0)
  orden <- order(-round(conserva, 2), -vapply(ops, function(o) as.numeric(o$k), 0))
  c(ops[[orden[1]]], list(cabe = TRUE))
}

#' @keywords internal
.lam_rr_fortalezas <- function(lz, espec, ge) {
  azul <- .std_color("azul"); pista <- .std_color("banda_clara")
  fin <- ge$y
  for (j in seq_along(espec$columnas)) {
    cl <- espec$columnas[[j]]; x <- ge$xs[j]; y0 <- ge$ys[j]
    .lam_caja(lz, x, y0 + 0.08, 0.16, 0.16, cl$color, nombre = "fortalezas:tono")
    .lam_txt(lz, cl$titulo, x + 0.2, y0 - 0.02, ge$wc - 0.3, 0.34, 12, azul, bold = TRUE, nombre = "fortalezas:columna")
    .lam_caja(lz, x, y0 + ge$cab - 0.1, ge$wc, 0.025, cl$color, nombre = "fortalezas:filete")
    xb <- x + ge$wr + 0.15
    textos <- vapply(.lam_rr_recortar_lote(cl$rotulos, ge$wr + 0.1, ge$size, ge$lineas), `[[`, "", "texto")
    for (i in seq_len(min(ge$k %||% length(cl$rotulos), length(cl$rotulos)))) {
      yc <- y0 + ge$cab + (i - 0.5) * ge$hrow
      .lam_txt(lz, textos[i], x - 0.1, yc - ge$hrow / 2, ge$wr + 0.1, ge$hrow, ge$size, azul, nombre = "fortalezas:rotulo", anclaje = "ctr")
      .lam_caja(lz, xb, yc - ge$g / 2, ge$wb, ge$g, pista, nombre = "fortalezas:pista", borde = NA)
      lb <- max(0.01, ge$wb * max(0, min(100, cl$valores[i])) / 100)
      .lam_caja(lz, xb, yc - ge$g / 2, lb, ge$g, cl$color, nombre = "fortalezas:barra", borde = NA)
      tinta <- .lam_ancho_tinta(cl$cifras[i], 10.5, TRUE) + 0.22
      if (lb >= tinta && ge$g >= 0.2) {
        .lam_txt(lz, cl$cifras[i], xb + lb - tinta - 0.02, .lam_y_centrada(yc, 10.5), tinta, 0.28, 10.5, .lam_texto_sobre(cl$color), bold = TRUE,
                 align = "right", nombre = "fortalezas:cifra")
      } else {
        .lam_txt(lz, cl$cifras[i], xb + lb + 0.02, .lam_y_centrada(yc, 10.5), 0.6, 0.28, 10.5, azul, bold = TRUE, nombre = "fortalezas:cifra")
      }
      fin <- max(fin, yc + ge$hrow / 2)
    }
  }
  invisible(fin)
}

# --- Cobertura y participación (`cobertura/1`) ------------------------------------------------------------------------

#' @keywords internal
.lam_rr_cobertura_geo <- function(espec, x, y, w, h) {
  if (!identical(espec$tipo, "cobertura")) return(list(cabe = FALSE))
  pb <- espec$publicos; ex <- espec$extras
  filas <- NROW(pb) + NROW(ex)
  if (filas < 1L || filas > .COBERTURA_FILAS_MAX) return(list(cabe = FALSE))
  barras <- isTRUE(espec$con_barras) && NROW(pb) > 0L
  ley <- if (barras) 0.34 else 0
  hrow <- min(1.15, (h - ley - 0.05) / filas)
  size_c <- if (hrow >= 0.75) 28 else if (hrow >= 0.55) 22 else 18
  cifras <- c(as.character(pb$texto_casos), as.character(ex$cifra))
  wc <- max(vapply(cifras, function(t) .lam_ancho_tinta(t, size_c, TRUE), 0)) + 0.2
  rotulos <- c(as.character(pb$rotulo), as.character(ex$rotulo)); detalles <- c(as.character(pb$texto_padron), as.character(ex$detalle))
  tinta_txt <- max(c(vapply(rotulos, function(t) .lam_ancho_tinta(t, 12, TRUE), 0), vapply(detalles, function(t) .lam_ancho_tinta(t %||% "", 10.5, FALSE), 0)))
  wtxt <- if (barras) min(2.2, tinta_txt + 0.25) else w - wc - 0.1
  xt <- x + wc + 0.05; xb <- xt + wtxt + 0.15; wb <- x + w - 0.55 - xb
  list(cabe = hrow >= 0.45 && (!barras || (wb >= 1.4 && tinta_txt + 0.25 <= 2.2 + 1e-6)) && wc < w * 0.4,
       barras = barras, ley = ley, hrow = hrow, size_c = size_c, wc = wc, xt = xt, wtxt = wtxt, xb = xb, wb = wb,
       g = min(.std_grosor(2L * max(1L, NROW(pb)), "categorias"), hrow * 0.3))
}

#' @keywords internal
.lam_rr_cobertura <- function(lz, espec, ge) {
  azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  pb <- espec$publicos; ex <- espec$extras; filas <- NROW(pb) + NROW(ex)
  y0 <- ge$y + ge$ley + max(0, ge$h - ge$ley - 0.05 - ge$hrow * filas) / 2
  fila <- function(cifra, color, rotulo, detalle, i) {
    yc <- y0 + (i - 0.5) * ge$hrow
    hc <- .lam_rr_lh(ge$size_c) + 0.1
    .lam_txt(lz, cifra, ge$x - 0.1, yc - hc / 2, ge$wc + 0.1, hc, ge$size_c, color, bold = TRUE, align = "right", nombre = "cobertura:cifra", anclaje = "ctr")
    con_detalle <- nzchar(detalle %||% "")
    .lam_txt(lz, rotulo, ge$xt, yc - (if (con_detalle) 0.29 else 0.16), ge$wtxt, 0.3, 12, azul, bold = TRUE, nombre = "cobertura:rotulo")
    if (con_detalle) .lam_txt(lz, detalle, ge$xt, yc - 0.03, ge$wtxt, 0.28, 10.5, suave, nombre = "cobertura:detalle")
    yc
  }
  centros <- numeric(NROW(pb))
  for (i in seq_len(NROW(pb))) centros[i] <- fila(pb$texto_casos[i], pb$color[i], pb$rotulo[i], pb$texto_padron[i], i)
  for (j in seq_len(NROW(ex))) fila(ex$cifra[j], azul, ex$rotulo[j], ex$detalle[j], NROW(pb) + j)
  if (isTRUE(ge$barras)) {
    x <- ge$xb; yl <- y0 - ge$ley
    for (k in names(espec$leyenda)) {
      .lam_caja(lz, x, yl + 0.09, 0.14, 0.14, espec$colores[[k]], nombre = "leyenda:cuadro")
      wt <- .lam_ancho_tinta(espec$leyenda[[k]], 10.5, FALSE)
      .lam_txt(lz, espec$leyenda[[k]], x + 0.12, yl, wt + 0.3, 0.3, 10.5, azul, nombre = "leyenda:texto")
      x <- x + 0.12 + wt + 0.45
    }
    .lam_caja(lz, ge$xb - 0.01, y0 + 0.05, 0.015, ge$hrow * NROW(pb) - 0.1, .std_color("texto_tenue"), nombre = "cobertura:base_barras")
    for (i in seq_len(NROW(pb))) {
      yc <- centros[i]
      series <- list(tasa = list(v = pb$tasa[i], t = pb$texto_tasa[i], y = yc - ge$g - 0.015),
                     meta = list(v = pb$meta[i], t = pb$texto_meta[i], y = yc + 0.015))
      for (k in names(series)) {
        s <- series[[k]]
        if (!is.finite(s$v)) next
        lb <- max(0.01, ge$wb * min(100, max(0, s$v)) / 100)
        .lam_caja(lz, ge$xb, s$y, lb, ge$g, espec$colores[[k]], nombre = paste0("cobertura:barra_", k), borde = NA)
        .lam_txt(lz, s$t, ge$xb + lb + 0.02, s$y + ge$g / 2 - 0.14, 0.6, 0.28, 10, suave, nombre = "cobertura:valor")
      }
    }
  }
  invisible(y0 + ge$hrow * filas)
}

# --- Escala con Sin información aparte (`divergentes/1`, estilo resumen) ----------------------------------------------

#' Filas de la leyenda de la escala en el ancho de la ranura (en orden lógico: desacuerdo del extremo al centro, neutro,
#' acuerdo y Sin información)
#' @keywords internal
.lam_rr_div_leyenda <- function(espec, w, size = 10) {
  C <- espec$categorias
  neg <- espec$orden_neg %||% rev(which(C$lado == "neg")); pos <- espec$orden_pos %||% which(C$lado == "pos")
  orden <- c(rev(neg), which(C$lado == "neu"), pos, which(C$lado == "sin_inf"))
  anchos <- vapply(orden, function(k) 0.12 + .lam_ancho_tinta(C$rotulo[k], size, FALSE) + 0.3, 0)
  filas <- list(); actual <- integer(0); usado <- 0
  for (i in seq_along(orden)) {
    if (length(actual) && usado + anchos[i] > w) { filas[[length(filas) + 1L]] <- actual; actual <- integer(0); usado <- 0 }
    actual <- c(actual, i); usado <- usado + anchos[i]
  }
  if (length(actual)) filas[[length(filas) + 1L]] <- actual
  list(orden = orden, anchos = anchos, filas = filas, cabe = all(anchos <= w))
}

#' «n = 115» por fila cuando las filas mezclan públicos (su sufijo o su n difieren); vacío si son de un solo público
#' @keywords internal
.lam_rr_div_n <- function(espec) {
  n <- suppressWarnings(as.numeric(espec$n_casos %||% espec$n))
  if (length(n) != length(espec$filas) || !all(is.finite(n))) return(character(0))
  suf <- regmatches(espec$filas, regexpr("\\([^()]{1,24}\\)$", espec$filas))
  mixto <- length(unique(round(n))) > 1L || length(unique(suf)) > 1L
  if (!mixto) return(character(0))
  paste("n =", format(round(n), big.mark = ",", trim = TRUE))
}

#' @keywords internal
.lam_rr_divergentes_geo <- function(espec, x, y, w, h) {
  n <- length(espec$filas); C <- espec$categorias
  if (n < 1L || n > 12L || sum(C$lado == "sin_inf") > 1L) return(list(cabe = FALSE))
  hay_si <- any(C$lado == "sin_inf")
  # Ronda 2, ítem 6: con filas de públicos distintos cada fila dice su n (casos válidos sin ponderar), en una columna a la
  # derecha; para dejarle sitio, la columna de Sin información y la escala ceden un poco.
  ns <- .lam_rr_div_n(espec)
  wn <- if (length(ns)) max(.lam_ancho_tinta(ns, 9.5, FALSE)) + 0.15 else 0
  wsi <- if (hay_si) (if (length(ns)) 0.85 else 1.0) else 0
  esc_min <- if (length(ns)) 2.0 else 2.2
  xb <- x + w - wn - wsi - (if (hay_si) (if (length(ns)) 0.2 else 0.3) else 0)
  ley <- .lam_rr_div_leyenda(espec, w)
  hley <- 0.27 * length(ley$filas) + 0.08
  disponible <- h - hley - 0.05
  w_max <- min(2.4, xb - esc_min - 0.15 - x)
  f <- .lam_rr_filas(espec$filas, 1.2, w_max, disponible, rep(1, n), 0.2, 0.45, desde = 11, max_lin = if (n > 8L) 2L else 3L)
  if (is.null(f)) return(list(cabe = FALSE))
  xa <- x + f$wq + 0.15; f$n_total <- n
  c(f, list(cabe = isTRUE(ley$cabe) && (xb - xa) >= esc_min - 1e-6, hay_si = hay_si, wsi = wsi, wn = wn, ns = ns, xa = xa, xb = xb, ley = ley, hley = hley,
            disponible = disponible, g = f$u * 0.74))
}

#' @keywords internal
.lam_rr_divergentes <- function(lz, espec, ge) {
  azul <- .std_color("azul")
  C <- espec$categorias; U <- espec$unidades; X <- espec$cifras; n <- ge$k %||% length(espec$filas)
  alturas <- ge$alturas; g <- ge$g
  y_ley <- ge$y + max(0, ge$disponible - sum(alturas)) / 2; y0 <- y_ley + ge$hley
  centros <- y0 + cumsum(alturas) - alturas / 2
  pt_cifra <- if (ge$u < 0.3) 9.5 else 10
  neu <- which(C$lado == "neu"); mitades <- if (length(neu)) rowSums(U[, neu, drop = FALSE]) / 2 else rep(0, n)
  neg <- espec$orden_neg %||% rev(which(C$lado == "neg")); pos <- espec$orden_pos %||% which(C$lado == "pos"); si <- which(C$lado == "sin_inf")
  izq <- max(rowSums(U[, neg, drop = FALSE]) + mitades, 1); der <- max(rowSums(U[, pos, drop = FALSE]) + mitades, 1)
  px <- (ge$xb - ge$xa - 1.1) / (izq + der); xc <- ge$xa + 0.55 + izq * px
  # Leyenda en filas a lo ancho de la ranura, en orden lógico.
  for (r in seq_along(ge$ley$filas)) {
    x <- ge$x; yl <- y_ley + (r - 1) * 0.27
    for (i in ge$ley$filas[[r]]) {
      k <- ge$ley$orden[i]
      .lam_caja(lz, x, yl + 0.07, 0.13, 0.13, C$color[k], nombre = "leyenda:cuadro")
      .lam_txt(lz, C$rotulo[k], x + 0.1, yl, ge$ley$anchos[i], 0.27, 10, azul, nombre = "leyenda:texto")
      x <- x + ge$ley$anchos[i]
    }
  }
  xsi <- ge$x + ge$w - (ge$wn %||% 0) - ge$wsi
  max_si <- if (ge$hay_si) max(1, max(U[, si[1]])) else 1
  for (i in seq_len(n)) {
    yc <- centros[i]; yb <- yc - g / 2
    .lam_txt(lz, ge$textos[i], ge$x - 0.1, yc - alturas[i] / 2, ge$wq + 0.1, alturas[i], ge$size, azul, align = "right", nombre = "divergentes:afirmacion",
             anclaje = "ctr")
    mitad <- mitades[i]; segs <- list()
    for (k in neu) segs[[length(segs) + 1L]] <- list(k = k, x = xc - mitad * px, w = 2 * mitad * px, lado = "neu")
    off <- mitad; for (k in neg) { segs[[length(segs) + 1L]] <- list(k = k, x = xc - (off + U[i, k]) * px, w = U[i, k] * px, lado = "neg"); off <- off + U[i, k] }
    off <- mitad; for (k in pos) { segs[[length(segs) + 1L]] <- list(k = k, x = xc + off * px, w = U[i, k] * px, lado = "pos"); off <- off + U[i, k] }
    ext_neg <- utils::tail(neg[U[i, neg] > 0], 1L); ext_pos <- utils::tail(pos[U[i, pos] > 0], 1L)
    for (sg in segs) {
      if (U[i, sg$k] <= 0) next
      .lam_caja(lz, sg$x - 0.002, yb, sg$w + 0.004, g, C$color[sg$k], nombre = "divergentes:segmento")
      cifra <- X[i, sg$k]
      # Ronda 2, ítem 3: la cifra va dentro si cabe con la regla de la casa para los segmentos de una apilada
      # (`.lam_tiene_peq`, lamina_escala.R: su tinta más 0.12 in); si no, la del extremo sale fuera y la de un segmento
      # interior no se escribe (antes iba a 8 pt y se montaba con la vecina: «0%» y «14%»).
      if (sg$w >= .lam_ancho_txt(cifra, pt_cifra, TRUE) + 0.12) {
        .lam_txt(lz, cifra, sg$x - 0.2, .lam_y_centrada(yc, pt_cifra), sg$w + 0.4, 0.26, pt_cifra, azul, align = "center", nombre = "divergentes:cifra")
      } else if (identical(sg$k, ext_neg) && identical(sg$lado, "neg")) {
        .lam_txt(lz, cifra, sg$x - 0.6, .lam_y_centrada(yc, pt_cifra), 0.56, 0.26, pt_cifra, .lam_oscurecer(C$color[sg$k]), bold = TRUE, align = "right",
                 nombre = "divergentes:cifra_fuera")
      } else if (identical(sg$k, ext_pos) && identical(sg$lado, "pos")) {
        .lam_txt(lz, cifra, sg$x + sg$w + 0.03, .lam_y_centrada(yc, pt_cifra), 0.56, 0.26, pt_cifra, .lam_oscurecer(C$color[sg$k]), bold = TRUE,
                 nombre = "divergentes:cifra_fuera")
      }
    }
    if (ge$hay_si && U[i, si[1]] > 0) {
      wbar <- (ge$wsi - 0.1) * U[i, si[1]] / max_si
      .lam_caja(lz, xsi, yb, wbar, g, C$color[si[1]], nombre = "divergentes:sin_inf")
      cabe <- wbar >= .lam_ancho_txt(X[i, si[1]], pt_cifra, TRUE) + 0.12
      .lam_txt(lz, X[i, si[1]], if (cabe) xsi - 0.2 else xsi + wbar + 0.03, .lam_y_centrada(yc, pt_cifra), if (cabe) wbar + 0.4 else 0.6, 0.26, pt_cifra, azul,
               align = if (cabe) "center" else "left", nombre = "divergentes:cifra_sin_inf")
    }
  }
  if (length(ge$ns)) for (i in seq_len(n)) {
    .lam_txt(lz, ge$ns[i], ge$x + ge$w - ge$wn, .lam_y_centrada(centros[i], 9.5), ge$wn + 0.05, 0.26, 9.5, .std_color("texto_suave"),
             align = "right", nombre = "divergentes:n")
  }
  .lam_caja(lz, xc - 0.008, y0 - 0.04, 0.016, sum(alturas) + 0.08, azul, nombre = "divergentes:centro")
  invisible(y0 + sum(alturas))
}
