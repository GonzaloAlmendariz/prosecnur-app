# lamina_nota_significancia.R — la nota que explica las letras de significancia llega a la lámina nativa.
#
# CCSS Perfil 2026 (láminas 23, 24, 29, 38, 55, 58 y 73): `p_barras_apiladas`/`p_barras_agrupadas` con `cruces` y
# `mostrar_significancia = TRUE` dibujaban las letras A, B, C, D sin la nota que las explica («Las letras comparan las
# columnas… prueba z… Bonferroni…»). La nota viajaba como `nota_pie` del graficador (su caption de ggplot), que la
# lámina nativa no lee: lee `attr(p, "note_outside")`, que sólo se marca con la nota de redondeo. Ahora el render la deja
# en `attr(p, "pulso_sig_nota")` y la lámina la escribe sobre «Base:», en su propia caja de una o dos líneas.
#
# El espacio se reserva con la misma geometría de la lámina (`.std_geom`): la zona de datos, la leyenda y el límite de
# contenido suben lo que mide la nota, así que no se monta sobre la leyenda ni sobre «Base:».

#' Deja en el gráfico la nota de significancia que la lámina nativa debe escribir
#'
#' Sólo cuando la nota llegó a ser el pie del graficador (`nota_aplicada`): si el analista escribió su propio
#' `nota_pie`, manda el suyo y no se duplica.
#' @param plot Gráfico que devuelve el graficador.
#' @param nota Nota de significancia calculada (o `NULL`).
#' @param nota_aplicada Pie con el que se llamó al graficador.
#' @keywords internal
.sig_nota_a_lamina <- function(plot, nota, nota_aplicada = NULL) {
  nota <- trimws(as.character(nota %||% "")[1])
  if (is.null(plot) || is.na(nota) || !nzchar(nota)) return(plot)
  aplicada <- trimws(as.character(nota_aplicada %||% "")[1])
  # Con la nota en la lámina el gráfico no la lleva de pie (`.sig_nota_pie_del_grafico`): «sin pie» es la nota de significancia.
  if (!identical(aplicada, nota) && !(isTRUE(getOption("prosecnur.sig_nota_en_lamina")) && (is.na(aplicada) || !nzchar(aplicada)))) return(plot)
  attr(plot, "pulso_sig_nota") <- nota
  plot
}

#' La nota de significancia de un gráfico, o `NULL`
#' @keywords internal
.lam_nota_sig_de <- function(p) {
  x <- attr(p, "pulso_sig_nota", exact = TRUE)
  x <- trimws(as.character(x %||% "")[1])
  if (is.na(x) || !nzchar(x)) return(NULL)
  # El graficador la parte a 72 caracteres para su caption; la lámina tiene todo el ancho y la compone sola.
  gsub("\\s*\n\\s*", " ", x)
}

#' Tamaño en puntos de la nota de significancia (más chica que la base, que va en 10 pt)
#' @keywords internal
.lam_nota_sig_pt <- function() 9

#' Alto de la caja de la nota (pulgadas): sus líneas a ancho de contenido más los márgenes de la caja
#' @keywords internal
.lam_nota_sig_alto <- function(nota) {
  ancho <- .std_valor("ppt", "geometria", "ancho_contenido")
  n <- as.integer(.lam_lineas_tinta(nota, ancho, .lam_nota_sig_pt(), FALSE)[1])
  n * .lam_nota_sig_pt() * 1.2 / 72 + 0.1
}

#' Escribe la nota sobre «Base:» en la lámina actual
#' @keywords internal
.lam_nota_sig_dibujar <- function(doc, nota) {
  g <- .std_geom; lz <- .lam_lienzo()
  alto <- .lam_nota_sig_alto(nota)
  .lam_txt(lz, nota, g("margen_izq"), .std_valor("ppt", "geometria", "base_y") - alto, .std_valor("ppt", "geometria", "ancho_contenido"),
           alto, .lam_nota_sig_pt(), .std_color("texto_suave"), bold = FALSE, nombre = "Nota significancia")
  .lam_agrupar(doc, lz, nombre = "prosecnur:nota_significancia")
}

#' Evalúa `expr` (las láminas de un gráfico) con la nota reservada en el pie y escrita en cada lámina
#'
#' `expr` recibe `por_lamina` ya envuelto: debe pasarlo al compositor. Sin nota, la lámina sale como siempre.
#' @param nota Nota de significancia (o `NULL`).
#' @param por_lamina Gancho que corre sobre cada lámina.
#' @param expr Función `(por_lamina)` que compone y devuelve el documento.
#' @keywords internal
.lam_con_nota_sig <- function(nota, por_lamina, expr) {
  if (is.null(nota)) return(expr(por_lamina))
  viejo <- options(prosecnur.lam_reserva_pie = .lam_nota_sig_alto(nota)); on.exit(options(viejo), add = TRUE)
  expr(function(doc) .lam_nota_sig_dibujar(por_lamina(doc), nota))
}

#' El pie con el que se llama al graficador: la nota de significancia, salvo que la lámina la escriba (entonces ninguno)
#'
#' Una lámina de un solo gráfico escribe la nota ella misma (`.lam_nota_sig_dibujar`) y reserva su alto; si el gráfico la dibujara
#' también, saldría dos veces y su leyenda se montaría sobre ella (CCSS Perfil 2026, láminas 28 y 34). Los paneles de varios
#' gráficos no fijan la opción: la nota viaja con su gráfico.
#' @keywords internal
.sig_nota_pie_del_grafico <- function(nota) if (isTRUE(getOption("prosecnur.sig_nota_en_lamina"))) NULL else nota

#' Evalúa `expr` (el render de un gráfico) con la nota de significancia reservada para la lámina
#' @param activo ¿La lámina estándar escribe la nota? Si no, `expr` corre tal cual.
#' @keywords internal
.lam_con_sig_en_lamina <- function(activo, expr) {
  if (!isTRUE(activo)) return(expr)
  viejo <- options(prosecnur.sig_nota_en_lamina = TRUE); on.exit(options(viejo), add = TRUE)
  force(expr)
}
