# La lectura de las tarjetas de diferencias, una sola vez por informe (ADR 0129, propuesta P08 §5, versión 6)
# ======================================================================================================
#
# Las láminas con tarjetas no llevan nota de significancia: solo base y fuente (Gonzalo, 2026-11-03: «innecesario
# cuando ya se definió al inicio»). La lectura se explica una vez:
#
#   - PPT: la lámina «Cómo leer las diferencias entre grupos» del plan pasa al formato de «Cómo leer las escalas»:
#     antetítulo «CÓMO LEER ESTE INFORME», una frase que define, una tarjeta real ampliada con su llave y la diferencia
#     en puntos, la fila de leyenda y el método en una línea;
#   - Word: el apartado «Pautas para la lectura del informe», en prosa justificada, con la tarjeta de ejemplo «como se
#     muestra en la siguiente imagen» (formato de los informes de Pulso: Acreditación Derecho y AMDT 2026).
#
# El ejemplo es una tarjeta REAL del informe: la principal con dos grupos y 99% de confianza. Se calcula en el worker
# del export (`.sig_plan_como_leer`), que tiene la base y la regla, y vive en el proceso mientras dura el export.

.tarjetas_estado <- new.env(parent = emptyenv())

#' Fuente del informe para la lectura (la fija el worker al preparar la regla)
#' @keywords internal
.tarjetas_fuente_fijar <- function(data, inst) {
  .tarjetas_estado$fuente <- if (is.data.frame(data)) .sig_fuente(data, inst) else NULL
  .tarjetas_estado$lectura <- NULL
  .tarjetas_estado$registro <- list()
  invisible(NULL)
}

#' Lectura vigente del export en curso, o NULL
#' @keywords internal
.tarjetas_lectura_vigente <- function() .tarjetas_estado$lectura

#' ¿Es la lámina de lectura de las diferencias? (por su título, como `.sig_slide_como_leer`)
#' @keywords internal
.tarjetas_lectura_es <- function(titulo) {
  t <- as.character(titulo %||% "")[1]
  !is.na(t) && grepl(.SIG_COMO_LEER_RX, t, ignore.case = TRUE, perl = TRUE)
}

#' Variable y cruce de una lámina del plan (JSON del editor)
#' @keywords internal
.tarjetas_var_del_plan <- function(slide) {
  grafs <- Filter(function(z) is.list(z) && !is.null(z$graficador), slide$payload %||% list())
  if (!length(grafs)) return(NULL)
  a <- grafs[[1]]$args %||% list()
  list(vars = as.character(unlist(a$vars %||% a$var)), cruce = a$cruces %||% a$cruce %||% (a$overrides %||% list())$cruces)
}

#' Calcula la tarjeta de ejemplo del informe y la deja vigente para la lámina y el Word
#'
#' Recorre las láminas que piden tarjetas (de una sola pregunta, sin cruce) y toma la tarjeta principal con dos grupos
#' al 99%; si no hay, la principal. Sin láminas con tarjetas, o sin fuente, no hay lectura y la lámina sigue con su
#' texto de siempre.
#' @keywords internal
.tarjetas_plan_lectura <- function(plan) {
  .tarjetas_estado$lectura <- NULL
  fuente <- .tarjetas_estado$fuente
  sig <- .sig_informe_vigente()
  slides <- if (is.list(plan)) plan$slides %||% list() else list()
  # Cada gráfico con tarjetas: el de una lámina de un gráfico y, en una de dos (ADR 0129 §6), el de cada ranura que las pide.
  pedidos <- list()
  for (s in slides) {
    meta <- (s$payload %||% list())$meta
    opt <- .tarjetas_opcion(meta)
    if (!is.null(opt)) { pedidos[[length(pedidos) + 1L]] <- list(v = .tarjetas_var_del_plan(s), opt = opt); next }
    mapa <- .tarjetas_mapa(meta)
    for (r in names(mapa)) if (!is.null(mapa[[r]]) && is.list(s$payload[[r]])) {
      pedidos[[length(pedidos) + 1L]] <- list(v = .tarjetas_var_del_plan(list(payload = list(g = s$payload[[r]]))), opt = mapa[[r]])
    }
  }
  if (!length(pedidos) || is.null(fuente) || is.null(sig)) return(invisible(NULL))
  candidatas <- list()
  for (pd in pedidos) {
    v <- pd$v
    if (is.null(v) || length(v$vars) != 1L || length(unlist(v$cruce))) next
    opt <- pd$opt
    r <- tryCatch(.tarjetas_calcular(fuente, v$vars, opt, list(tipo = "categorica"), sig), error = function(e) NULL)
    if (is.null(r) || !length(r$tarjetas)) next
    for (t in r$tarjetas) candidatas[[length(candidatas) + 1L]] <- list(t = t, r = r)
  }
  if (!length(candidatas)) return(invisible(NULL))
  # La más clara del informe: dos grupos al 99% y la mayor diferencia (la maqueta usó «empresa privada», 39 puntos).
  ok <- vapply(candidatas, function(x) !isTRUE(x$t$fragil) && !isTRUE(x$t$sin_diferencias) && nrow(x$t$grupos) == 2L &&
                 !anyNA(x$t$grupos$dir), logical(1))   # con `todas`, solo una tarjeta con sus dos flechas
  brecha <- vapply(candidatas, function(x) x$t$brecha, numeric(1))
  orden <- order(!ok, -brecha)
  elegida <- candidatas[[orden[1]]]
  r <- elegida$r
  bases <- lapply(r$cruces, function(cr) {
    g <- r$grupos[r$grupos$cruce == cr, , drop = FALSE]
    list(cruce = unname(r$rotulos_cruce[cr]), grupos = g$etiqueta, n = g$n)
  })
  .tarjetas_estado$lectura <- list(tarjeta = elegida$t, tipo = r$tipo, rotulo_cruce = unname(r$rotulos_cruce[elegida$t$cruce]),
                                   opcion = r$opcion, regla = sig$regla, cruces = unname(r$rotulos_cruce), bases = bases)
  invisible(NULL)
}

#' Número en letras hasta diez (la prosa del informe: «seis diferencias», «diez puntos»)
#' @keywords internal
.tarjetas_en_letras <- function(n) {
  l <- c("una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez")
  n <- suppressWarnings(as.integer(n)[1])
  if (!is.na(n) && n >= 1L && n <= 10L) l[n] else format(n)
}

#' Nivel de confianza del segundo nivel («95%» con alfa 0.05)
#' @keywords internal
.tarjetas_confianza <- function(regla) paste0(format(round(100 * (1 - (regla$alfa %||% 0.05)))), "%")

#' Textos de la lectura, desde la regla del estudio (una sola fuente para el PPT y el Word)
#' @keywords internal
.tarjetas_textos_lectura <- function(lectura) {
  regla <- lectura$regla; opt <- lectura$opcion; pub <- opt$publico %||% "personas encuestadas"
  umbral <- regla$umbral_puntos %||% 10
  aula <- .sig_nombre_conglomerado(regla$conglomerado)
  rao <- identical(regla$prueba, "rao_scott")
  bh <- identical(regla$correccion, "bh_informe")
  t <- lectura$tarjeta; g <- t$grupos
  cruces_txt <- paste(tolower(lectura$cruces), collapse = ", ")
  cruces_txt <- sub(", ([^,]+)$", " y \\1", cruces_txt)
  bases <- paste(vapply(lectura$bases, function(b) sprintf("%s: %s", b$cruce, paste(sprintf("%s %s", b$grupos, format(b$n, big.mark = ",")), collapse = ", ")), ""),
                 collapse = "; ")
  list(
    frase_ppt = sprintf(paste0("Las tarjetas muestran los grupos de %s que se diferencian del resto en una respuesta. ",
                               "Aparecen solo si la diferencia es de al menos %s puntos y la prueba estadística la confirma."),
                        pub, format(umbral)),
    metodo_ppt = sprintf("%s con corrección de %s. Se muestran hasta %s diferencias por gráfico; las demás están en las tablas de cruces.",
                         if (rao) sprintf("Prueba de Rao-Scott por %s", aula) else "Prueba z de diferencia de proporciones",
                         if (bh) "Benjamini-Hochberg" else "Bonferroni", .tarjetas_en_letras(opt$max %||% .TARJETAS_MAX)),
    mayor = "Mayor que el resto", menor = "Menor que el resto",
    nivel_1 = "99% de confianza", nivel_2 = paste(.tarjetas_confianza(regla), "de confianza"),
    rotulo_total = paste("Total de", pub), rotulo_grupos = "Grupos que se diferencian del resto",
    parrafos_word = c(
      sprintf(paste0("Junto a algunos gráficos se presentan tarjetas con las diferencias entre grupos de %s según %s. ",
                     "Cada tarjeta muestra, en primer lugar, el resultado del total de %s y, debajo, los grupos cuyo ",
                     "resultado se diferencia del resto, como se muestra en la siguiente imagen."), pub, cruces_txt, pub),
      NA_character_,   # la imagen va aquí
      sprintf(paste0("El triángulo hacia arriba indica que el porcentaje del grupo es mayor que el del resto de %s, y el ",
                     "triángulo hacia abajo, que es menor. En el ejemplo, en «%s», el %s de %s frente al %s del total de %s; ",
                     "en %s, la proporción es de %s."),
              pub, t$fila, .tarjetas_pct(g$p[1]), g$etiqueta[1], t$cifra_total %||% .tarjetas_pct(t$total), pub,
              g$etiqueta[nrow(g)], .tarjetas_pct(g$p[nrow(g)])),
      sprintf(paste0("Una diferencia se presenta solo si cumple dos condiciones: alcanza al menos %s puntos porcentuales y ",
                     "es estadísticamente significativa. Para evaluarla se empleó %s, con %s. El borde continuo indica que ",
                     "la diferencia se confirma con un 99%% de confianza; el borde punteado, con un %s, por lo que estas ",
                     "últimas se comentan con una formulación prudente."),
              .tarjetas_en_letras(umbral),
              if (rao) sprintf("la prueba de Rao-Scott, que considera que las personas fueron encuestadas por %s", aula) else
                "una prueba z de diferencia de proporciones",
              if (bh) "la corrección de Benjamini-Hochberg sobre el conjunto de comparaciones del informe" else
                "la corrección de Bonferroni dentro de cada fila",
              .tarjetas_confianza(regla)),
      sprintf(paste0("No se muestran los grupos que no se diferencian del resto ni las diferencias menores de %s puntos; ",
                     "cuando una pregunta no presenta diferencias, el gráfico no incluye tarjetas. Si una pregunta presenta ",
                     "más de %s diferencias, se muestran las %s principales y las demás pueden consultarse en las tablas de ",
                     "cruces. Solo se comparan grupos de al menos %s %s%s. Las bases de cada grupo son: %s."),
              .tarjetas_en_letras(umbral), .tarjetas_en_letras(opt$max %||% .TARJETAS_MAX),
              .tarjetas_en_letras(opt$max %||% .TARJETAS_MAX), format(regla$base_minima %||% 30), pub,
              if (rao) sprintf(" y %s %ss", format(regla$conglomerados_minimos %||% 8L), aula) else "", bases)
    )
  )
}

# ---- PPT ------------------------------------------------------------------------------------------------------------

#' Backend nativo con zoom y desplazamiento (la tarjeta ampliada de la lámina de lectura)
#' @keywords internal
.lam_tarjeta_backend_zoom <- function(lz, z = 1, ox = 0, oy = 0) {
  list(
    rect = function(l, t, w, h, fill = NULL, borde = NULL, pt = 0.75, punteado = FALSE, radio = 0, nombre = "tarjeta:caja") {
      .lam_forma_borde(lz, ox + l * z, oy + t * z, w * z, h * z, fill = fill, borde = borde, borde_pt = pt * z, punteado = punteado,
                       geom = if (radio > 0) "roundRect" else "rect", radio = radio * z, nombre = nombre)
    },
    txt = function(s, l, t, w, h, size, color, bold = FALSE, align = "left", nombre = "tarjeta:texto") {
      .lam_txt(lz, s, ox + l * z - 0.1, oy + t * z - 0.05, w * z + 0.2, h * z + 0.1, size * z, color, bold = bold, align = align,
               nombre = nombre)
    },
    tri = function(x, yc, dir, fragil) .lam_tarjeta_triangulo(lz, ox + x * z, oy + yc * z, dir, fragil, alto = 0.075 * z)
  )
}

#' Muestra de un nivel para la leyenda: cajita con su barra y su triángulo
#' @keywords internal
.lam_tarjeta_muestra <- function(lz, x, y, fragil) {
  .lam_forma_borde(lz, x, y, 0.55, 0.28, fill = .std_color(if (fragil) "tarjeta_fondo_95" else "tarjeta_fondo"),
                   borde = .std_color(if (fragil) "tarjeta_borde_95" else "tarjeta_borde"), borde_pt = if (fragil) 1.05 else 0.75,
                   punteado = fragil, geom = "roundRect", radio = 0.05, nombre = "lectura:muestra")
  .lam_caja(lz, x + 0.08, y + 0.095, 0.25, 0.09, .std_color(if (fragil) "tarjeta_barra_95" else "azul"), nombre = "lectura:muestra:barra")
  .lam_tarjeta_triangulo(lz, x + 0.38, y + 0.14, "up", fragil, alto = 0.08)
}

#' Lámina «Cómo leer las diferencias entre grupos» con la tarjeta de ejemplo (calco de `lectura()` de la maqueta)
#' @keywords internal
.lam_laminas_tarjetas_lectura <- function(doc, titulo, lectura, layout, master, por_lamina = function(doc) doc) {
  tx <- .tarjetas_textos_lectura(lectura)
  azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = "Cómo leer este informe")
  lz <- .lam_lienzo()
  .lam_txt(lz, tx$frase_ppt, .std_geom("margen_izq") - 0.02, 1.45, 11.4, 0.9, 15, azul, nombre = "lectura:definicion")
  t <- lectura$tarjeta
  Z <- 1.3; cw <- 4.9; cx <- 1.55; cy <- 2.55
  ch <- .lam_tarjeta_alto(t, cw, character(0), lectura$tipo)   # ampliada: con los nombres completos, como se dibuja
  .lam_tarjeta_dibujar(.lam_tarjeta_backend_zoom(lz, Z, cx, cy), t, list(l = 0, t = 0, w = cw, h = ch), lectura$rotulo_cruce,
                       cortos = character(0), tipo = lectura$tipo)
  # Llave sobre los grupos y la diferencia en puntos (como el «TOP TWO BOX 70%» de «Cómo leer las escalas»).
  y_g <- .lam_tarjeta_y_grupos(t, cw, lectura$tipo)
  yG1 <- cy + y_g[1] * Z; yG2 <- cy + y_g[2] * Z; xFin <- cx + cw * Z
  .lam_linea(lz, xFin + 0.15, yG1, xFin + 0.35, yG1, azul, pt = 1.5, nombre = "lectura:llave")
  .lam_linea(lz, xFin + 0.35, yG1, xFin + 0.35, yG2, azul, pt = 1.5, nombre = "lectura:llave")
  .lam_linea(lz, xFin + 0.15, yG2, xFin + 0.35, yG2, azul, pt = 1.5, nombre = "lectura:llave")
  .lam_linea(lz, xFin + 0.35, (yG1 + yG2) / 2, xFin + 0.8, (yG1 + yG2) / 2, azul, pt = 1.5, nombre = "lectura:llave")
  g <- t$grupos
  dif <- floor(round(g$p[1], 6) + 0.5) - floor(round(g$p[nrow(g)], 6) + 0.5)
  xC <- xFin + 0.95; wC <- .std_geom("ancho") - 0.5 - xC; yC <- (yG1 + yG2) / 2
  .lam_txt(lz, "DIFERENCIA ENTRE GRUPOS", xC, yC - 0.8, wC, 0.3, 12, azul, bold = TRUE, align = "center", nombre = "lectura:rotulo")
  .lam_txt_tramos(lz, list(list(format(dif), TRUE)), xC + wC / 2 - 0.9, yC - 0.52, 1.1, 0.85, size = 50, color = azul, nombre = "lectura:puntos")
  .lam_txt(lz, "puntos", xC + wC / 2 + 0.15, yC - 0.12, 1.4, 0.45, 22, azul, bold = TRUE, nombre = "lectura:puntos:unidad")
  .lam_txt(lz, sprintf("%s − %s", .tarjetas_pct(g$p[1]), .tarjetas_pct(g$p[nrow(g)])), xC, yC + 0.33, wC, 0.32, 13, suave,
           align = "center", nombre = "lectura:resta")
  # Leyenda en una fila, centrada bajo el ejemplo.
  yl <- cy + ch * Z + 0.45
  items <- list(list("tri", "up", tx$mayor), list("tri", "down", tx$menor), list("muestra", FALSE, tx$nivel_1), list("muestra", TRUE, tx$nivel_2))
  anchos <- vapply(items, function(it) (if (identical(it[[1]], "tri")) 0.13 else 0.55) + 0.09 + .lam_ancho_tinta(it[[3]], 11.5) + 0.05, numeric(1))
  total <- sum(anchos) + 0.42 * (length(items) - 1L)
  x <- (.std_geom("ancho") - total) / 2
  for (k in seq_along(items)) {
    it <- items[[k]]
    if (identical(it[[1]], "tri")) {
      .lam_tarjeta_triangulo(lz, x, yl + 0.14, it[[2]], FALSE, alto = 0.11)
      xt <- x + 0.13 + 0.09
    } else {
      .lam_tarjeta_muestra(lz, x, yl, it[[2]])
      xt <- x + 0.55 + 0.09
    }
    .lam_txt(lz, it[[3]], xt - 0.1, yl - 0.02, .lam_ancho_tinta(it[[3]], 11.5) + 0.3, 0.32, 11.5, azul, nombre = "lectura:leyenda")
    x <- x + anchos[k] + 0.42
  }
  .lam_txt(lz, tx$metodo_ppt, 0.48, 6.4, .std_geom("ancho") - 0.98, 0.3, 9.5, suave, align = "center", nombre = "lectura:metodo")
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:lectura_diferencias")
  list(doc = por_lamina(doc), partes = 1L)
}

#' Gancho del motor sobre la lámina de texto «Cómo leer las diferencias» (desde `.nresp_colocar`)
#'
#' Con una lectura vigente, la lámina de texto que el motor acaba de agregar se cambia por la nativa. Lee la lámina en
#' curso del entorno del motor (`reporte_ppt_plan` está congelado).
#' @keywords internal
.tarjetas_lectura_colocar <- function(doc, solo_lista, env) {
  if (isTRUE(solo_lista) || is.null(doc) || !is.environment(env)) return(doc)
  lectura <- .tarjetas_lectura_vigente()
  if (is.null(lectura)) return(doc)
  if (!identical(get0("stype", envir = env, inherits = FALSE), "text_slide")) return(doc)
  titulo <- get0("title_slide", envir = env, inherits = FALSE)
  if (!.tarjetas_lectura_es(titulo)) return(doc)
  contrato <- get0("PPT_CONTRACT", envir = env, inherits = FALSE)
  layout <- (contrato$slide_1 %||% list())$layout %||% "Graficos2"
  master <- get0("master", envir = env, inherits = FALSE) %||% "Office Theme"
  por <- get0(".add_partner_footer_logo", envir = env, inherits = FALSE)
  doc <- officer::remove_slide(doc, index = length(doc))
  .lam_laminas_tarjetas_lectura(doc, as.character(titulo)[1], lectura, layout, master,
                                por_lamina = if (is.function(por)) por else function(d) d)$doc
}
