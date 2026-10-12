# =============================================================================
# reporte_word_como_leer.R — «Cómo leer este informe» del Word del recetario (N8.13)
# =============================================================================
#
# Porta el capítulo 2 de la propuesta Word (recetario_word.R:183-228): Top Two Box y Bottom Two Box con su barra de
# ejemplo (`g_box_explica`, RG:410-424), las dos tablas del redondeo, la tabla de las redacciones de la escala, las cifras
# pequeñas, las bases chicas y el recuadro (`recuadro()`, RI:148-154). Lo que cambia entre informes viene por argumento:
# el método de redondeo que usa el informe y si muestra el Bottom Two Box. Gonzalo, 2026-10-08: «falta todo lo que tenga
# que ver con cómo leer el informe en la parte de adelante del Word».

#' Lista con viñeta en el estilo «Lista de la guía» (`lista()`)
#' @keywords internal
.word_lista <- function(doc, items) {
  for (r in items) doc <- officer::body_add_fpar(doc, officer::fpar(officer::ftext(paste0("•  ", r), officer::fp_text(
    font.family = .std_word("tipografia", "fuente"), font.size = 10.5, color = .std_word("colores", "texto")))), style = "Lista de la guía")
  doc
}

#' Recuadro (`recuadro()`): fondo gris muy claro, filete navy arriba, título en negrita y las líneas debajo
#' @keywords internal
.word_recuadro <- function(doc, titulo, lineas) {
  f <- .std_word("tipografia", "fuente"); navy <- .std_word("colores", "titulos"); txt <- .std_word("colores", "texto")
  partes <- c(list(flextable::as_chunk(titulo, props = officer::fp_text(font.family = f, font.size = 10, color = navy, bold = TRUE))),
              unlist(lapply(lineas, function(l) list("\n", flextable::as_chunk(l, props = officer::fp_text(font.family = f, font.size = 9.5, color = txt)))), recursive = FALSE))
  ft <- flextable::flextable(data.frame(x = "")) |> flextable::delete_part("header") |> flextable::border_remove() |>
    flextable::width(j = 1, width = .std_word("pagina", "ancho_util")) |> flextable::bg(bg = .std_word("colores", "recuadro")) |>
    flextable::compose(j = 1, value = do.call(flextable::as_paragraph, partes)) |>
    flextable::hline_top(border = officer::fp_border(color = navy, width = 1)) |> flextable::padding(padding = 10) |> flextable::line_spacing(space = 1.3)
  doc <- flextable::body_add_flextable(doc, ft, align = "left")
  officer::body_add_par(doc, "")
}

#' Barra de ejemplo del Top Two Box o del Bottom Two Box con su llave, el nombre, la suma y cómo se forma (`g_box_explica`)
#' @keywords internal
.word_g_box_explica <- function(pct = c(5, 5, 35, 55), arriba = TRUE) {
  navy <- .std_word("colores", "titulos")
  rot <- c("1  Totalmente en desacuerdo", "2  En desacuerdo", "3  De acuerdo", "4  Totalmente de acuerdo")
  x1 <- cumsum(pct); x0 <- x1 - pct; d <- data.frame(x0 = x0, x1 = x1, k = factor(rot, levels = rot), p = pct)
  idx <- if (arriba) 3:4 else 1:2; col <- if (arriba) .WORD_TINTA$verde else "#B4541F"; nom <- if (arriba) "Top Two Box" else "Bottom Two Box"
  a <- x0[idx[1]]; b <- x1[idx[2]]; s <- sum(pct[idx])
  g <- ggplot2::ggplot(d) + ggplot2::geom_rect(ggplot2::aes(xmin = .data$x0, xmax = .data$x1 + 0.05, ymin = 0, ymax = 1, fill = .data$k)) +
    ggplot2::scale_fill_manual(values = stats::setNames(unname(.std_paleta("likert"))[1:4], rot)) +
    ggplot2::geom_text(ggplot2::aes(x = (.data$x0 + .data$x1) / 2, y = 0.5, label = paste0(.data$p, "%")), size = .word_pt(9.5), fontface = "bold",
                       colour = navy, family = "Arial") +
    ggplot2::annotate("segment", x = c(a, a, b, (a + b) / 2), xend = c(b, a, b, (a + b) / 2), y = rep(1.35, 4), yend = c(1.35, 1.2, 1.2, 1.5), colour = col, linewidth = 0.7) +
    ggplot2::annotate("text", x = if (arriba) (a + b) / 2 else a, y = 1.72, label = if (arriba) "Las dos respuestas de acuerdo" else "Las dos respuestas de desacuerdo",
                      hjust = if (arriba) 0.5 else 0, size = .word_pt(9), fontface = "bold", colour = col, family = "Arial") +
    ggplot2::annotate("text", x = 121, y = 1.25, label = nom, size = .word_pt(9), fontface = "bold", colour = col, family = "Arial") +
    ggplot2::annotate("text", x = 121, y = 0.55, label = paste0(s, "%"), size = .word_pt(24), fontface = "bold", colour = col, family = "Arial") +
    ggplot2::annotate("text", x = 121, y = -0.05, label = paste0(pct[idx[1]], "% + ", pct[idx[2]], "%"), size = .word_pt(9), colour = col, family = "Arial") +
    ggplot2::scale_x_continuous(limits = c(-2, 134), expand = c(0, 0)) + ggplot2::scale_y_continuous(limits = c(-0.35, 2.0)) +
    .word_tema() + ggplot2::guides(fill = ggplot2::guide_legend(nrow = 1))
  attr(g, "alto") <- 1.9 - 0.22; g
}

# La frase de una corrida ponderada (contrato base-sin-ponderar F6, §3; supuesto S-b).
.WORD_COMO_LEER_PONDERADA <- paste(
  "Los porcentajes están ponderados. La base de cada gráfico es el número de personas que respondieron, sin ponderar;",
  "por eso, en grupos chicos, “12 de 15” puede no coincidir con el porcentaje.")

#' Capítulo «Cómo leer este informe»
#'
#' @param redondeo `"estandar"`, `"resto_mayor"` o `"ambos"`: el método que usa el informe (el recuadro final lo dice).
#' @param con_bottom Si el informe muestra el Bottom Two Box.
#' @param figura,tabla Contadores de numeración: el capítulo devuelve los siguientes en `attr(doc, "siguientes")`.
#' @param ponderada Si la corrida está ponderada: el recuadro lo dice (contrato base-sin-ponderar F6, §3; D-b: el
#'   capítulo no se enciende solo por estar ponderada, pero si está, lo declara).
#' @keywords internal
.word_como_leer <- function(doc, numero = 2, redondeo = c("estandar", "resto_mayor", "ambos"), con_bottom = TRUE, figura = 1L, tabla = 1L, variante_apertura = "B",
                            ponderada = FALSE) {
  redondeo <- match.arg(redondeo); coral <- .std_word("colores", "acento")
  doc <- .word_apertura(doc, numero, "Cómo leer este informe", paste(
    "Las páginas que explican al lector cómo leer las cifras del informe: el Top Two Box", if (con_bottom) "y el Bottom Two Box," else ",",
    "el redondeo, las escalas, las cifras pequeñas, las bases chicas y la información faltante."), variante = variante_apertura)
  fig <- function(doc, titulo, g, base = "Ejemplo ilustrativo. Fuente: PULSO PUCP 2026.") {
    png <- .word_png(g, attr(g, "alto")); doc <- .word_figura(doc, figura, titulo, png, alto = attr(g, "alto"), base = base); figura <<- figura + 1L; doc }
  tab <- function(doc, titulo, ft, base) { doc <- .word_tabla(doc, tabla, titulo, ft, base = base); tabla <<- tabla + 1L; doc }
  s <- 0L; sec <- function(doc, t) { s <<- s + 1L; .word_seccion(doc, t, paste0(numero, ".", s)) }

  doc <- sec(doc, "Top Two Box")
  doc <- .word_cuerpo(doc, "Es la suma de los dos valores superiores de la escala. Resume en una cifra el acuerdo de cada grupo y permite compararlo entre públicos y con mediciones de otros años.", mantener = TRUE)
  doc <- fig(doc, "Cómo se calcula el Top Two Box", .word_g_box_explica(c(5, 5, 35, 55), TRUE))
  if (isTRUE(con_bottom)) {
    doc <- sec(doc, "Bottom Two Box")
    doc <- .word_cuerpo(doc, "Es la suma de los dos valores inferiores de la escala. Se usa cuando interesa el desacuerdo, por ejemplo para ubicar los aspectos que más críticas reciben. Va en naranja oscuro, al lado del Top Two Box.", mantener = TRUE)
    doc <- fig(doc, "Cómo se calcula el Bottom Two Box", .word_g_box_explica(c(12, 20, 41, 27), FALSE))
  }

  doc <- sec(doc, "Redondeo de las cifras")
  doc <- .word_cuerpo(doc, "Las cifras se muestran en enteros. Hay dos maneras de redondear y el informe dice cuál usa. Las dos tablas usan el mismo ejemplo: 1, 7, 60, 110 y 0 casos de 178.", mantener = TRUE)
  n_r <- c(1, 7, 60, 110, 0); ex <- 100 * n_r / sum(n_r); std <- floor(ex + 0.5); ent <- floor(ex); rest <- ex - ent
  faltan <- 100 - sum(ent); suben <- order(-rest)[seq_len(faltan)]; res <- ent; res[suben] <- res[suben] + 1
  cab <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información")
  t_std <- as.data.frame(rbind(c("Valor exacto", sprintf("%.2f%%", ex), "100%"), c("Redondeo estándar", paste0(std, "%"), paste0(sum(std), "%"))))
  names(t_std) <- c(" ", cab, "Suma")
  doc <- .word_cuerpo(doc, "Redondeo estándar. Cada porcentaje se redondea por separado: desde 0.5 sube y por debajo baja. Cada cifra queda lo más cerca posible de su valor exacto, pero la suma puede dar 99% o 101%.", mantener = TRUE)
  ft <- .word_ft_base(t_std, c(1.5, rep(0.85, 5), 0.6), size = 9) |> flextable::align(j = 2:7, align = "center", part = "all") |> flextable::bold(i = 2) |>
    flextable::color(i = 2, j = 7, color = coral) |> flextable::fontsize(size = 8.5, part = "header")
  doc <- tab(doc, "Redondeo estándar", ft, sprintf("Base: ejemplo de 178 casos. La suma queda en %d%% porque cada cifra se redondeó por su cuenta.", sum(std)))
  t_rm <- as.data.frame(rbind(c("Valor exacto", sprintf("%.2f%%", ex), "100%"), c("Parte entera", paste0(ent, "%"), paste0(sum(ent), "%")),
                              c("Resto decimal", sprintf("%.2f", rest), ""), c("Resultado", paste0(res, "%"), paste0(sum(res), "%"))))
  names(t_rm) <- c(" ", cab, "Suma")
  ft <- .word_ft_base(t_rm, c(1.5, rep(0.85, 5), 0.6), size = 9) |> flextable::align(j = 2:7, align = "center", part = "all") |> flextable::bold(i = 4) |>
    flextable::fontsize(size = 8.5, part = "header") |> flextable::color(i = 2, j = 7, color = coral)
  for (j in suben) ft <- ft |> flextable::bg(i = 3:4, j = j + 1, bg = "#FBE3E2") |> flextable::color(i = 3:4, j = j + 1, color = coral)
  doc <- .word_cuerpo(doc, "Redondeo del resto mayor. Primero se toma la parte entera de cada porcentaje. Los puntos que faltan para llegar a 100 se dan, uno por uno, a las categorías con el resto decimal más grande. La suma siempre da 100%.", mantener = TRUE)
  doc <- tab(doc, "Redondeo del resto mayor", ft, sprintf("Base: ejemplo de 178 casos. Faltan %d puntos y van a los %d restos más grandes, marcados. El %.2f%% queda en %d%%.", faltan, faltan, ex[1], res[1]))

  doc <- sec(doc, "Una misma escala, muchas redacciones")
  doc <- .word_cuerpo(doc, "La redacción de la escala cambia según el estudio y el público, pero el color y el orden se mantienen: de lo negativo a lo positivo y, al final, en gris, la falta de información. El Top Two Box es siempre la suma de las dos respuestas más altas.", mantener = TRUE)
  esc <- data.frame(Escala = c("Acuerdo", "Satisfacción", "Importancia", "Utilidad", "Competencia"),
                    `1` = c("Totalmente en desacuerdo", "Muy insatisfecho", "Nada importante", "Nada útil", "Nada competente"),
                    `2` = c("En desacuerdo", "Insatisfecho", "Poco importante", "Poco útil", "Poco competente"),
                    `3` = c("De acuerdo", "Satisfecho", "Importante", "Útil", "Competente"),
                    `4` = c("Totalmente de acuerdo", "Muy satisfecho", "Muy importante", "Totalmente útil", "Totalmente competente"),
                    `Al final, en gris` = c("Sin información", "No he usado el servicio", "Sin información", "Sin información", "Sin información"), check.names = FALSE)
  ft <- .word_ft_base(esc, c(1.1, 1.15, 1.0, 0.95, 1.15, 1.0), size = 8.5) |> flextable::align(j = 2:6, align = "center", part = "all")
  for (j in 1:5) ft <- flextable::bg(ft, j = j + 1, bg = c("#FBE3D3", "#FFF4CC", "#E6F1D8", "#D5E8C7", "#ECECEC")[j], part = "header")
  doc <- tab(doc, "Redacciones de la escala y su color", ft, "Base: escalas usadas en los estudios de PULSO PUCP. El color de cada columna es el de su respuesta en los gráficos.")

  doc <- sec(doc, "Cifras muy pequeñas")
  doc <- .word_cuerpo(doc, "Si una cifra no cabe dentro de su color, sube sobre la barra con una línea guía. Si hay varias seguidas, se separan para no taparse, y la fila gana el aire que necesitan. Ninguna cifra se omite.", mantener = TRUE)
  ej <- data.frame(actor = c("Todas chicas salvo una", "Chicas en los dos extremos", "Tres chicas al inicio", "Tres chicas al final"), N = 120,
                   p1 = c(2, 1, 1, 30), p2 = c(1, 3, 2, 62), p3 = c(93, 47, 3, 2), p4 = c(3, 47, 40, 1), p5 = c(1, 2, 54, 5)) |>
    transform(p1 = p1 / 100, p2 = p2 / 100, p3 = p3 / 100, p4 = p4 / 100, p5 = p5 / 100)
  esp <- preparar_escala(ej, "actor", "N", paste0("p", 1:5), stats::setNames(cab, paste0("p", 1:5)),
                         colores_grupos = stats::setNames(unname(.std_paleta("likert")), cab), orden = "declarado",
                         barra_extra_preset = "top2box", top2box_labels = cab[3:4])
  doc <- fig(doc, "Cifras pequeñas en distintas posiciones de la barra", .word_g_escala(esp, envolver = 16), base = "Base: 120 casos de ejemplo. Cifras ficticias. Fuente: PULSO PUCP 2026.")

  doc <- sec(doc, "Bases chicas e información faltante")
  doc <- .word_lista(doc, c(.casos_junto_frase_larga(),   # sigue «Casos junto al porcentaje» (graficos_casos_junto.R)
                            "«Sin información» reúne a quienes no respondieron o respondieron «No sabe». Va al final de la barra, en gris, y cuenta en la base: así se ve cuántos no pudieron opinar.",
                            "Cada gráfico dice su base debajo. Si una pregunta sólo se hizo a una parte, la base lo indica, por ejemplo «Base: 20 estudiantes que respondieron Sí en la pregunta anterior»."))
  doc <- .word_recuadro(doc, "Cómo leer este informe", c(
    "Los porcentajes se calculan sobre quienes respondieron cada pregunta. La base va debajo de cada gráfico.",
    if (isTRUE(ponderada)) .WORD_COMO_LEER_PONDERADA,
    "Top Two Box es la suma de las dos respuestas de acuerdo de la escala.",
    .casos_junto_frase_corta(),
    if (identical(redondeo, "resto_mayor")) "Las cifras se redondean al entero con el método del resto mayor, de modo que cada barra suma 100%."
    else if (identical(redondeo, "ambos")) "Unos gráficos redondean cada cifra por separado (una barra puede sumar 99% o 101%) y otros con el método del resto mayor (cada barra suma 100%)."
    else "Las cifras se redondean al entero por separado (desde 0.5 sube), así que una barra puede sumar 99% o 101%."))
  attr(doc, "siguientes") <- c(figura = figura, tabla = tabla)
  doc
}
