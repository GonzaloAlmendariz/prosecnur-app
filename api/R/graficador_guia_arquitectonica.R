# La guia de canvas, dibujada como un plano y no como un subrayador.
#
# La guia servia para ver DONDE cae cada hueco. El problema es que no decia
# CUANTO mide ninguno, asi que para responder «este canal tiene 1.4 in o 1.9?»
# habia que exportar, abrir el XML y medir en EMU. Y encendida tapaba lo que se
# queria ver: 978 bordes magenta de 0.6 de grosor sobre 48 laminas escondieron el
# hallazgo de los tamanos de letra durante una comparacion de color entera.
#
# Un plano arquitectonico resuelve las dos cosas a la vez, y por eso se copia su
# convencion:
#
# - **Linea fina y fria.** 0.25 de grosor en cian apagado. Se ve contra el
#   blanco del canvas y contra el azul institucional, y no compite con el dato:
#   la guia es el papel milimetrado, no el dibujo.
# - **Cada caja lleva su cota.** El ancho y el alto en pulgadas, escritos en la
#   propia caja. Medir deja de exigir herramientas.
# - **Sin relleno.** Un relleno, por transparente que sea, altera el color de lo
#   que hay debajo, y el color es justo una de las cosas que se auditan.
#
# La cota va DENTRO de la caja y no fuera con lineas de extension: fuera se
# solaparia con la caja vecina —los huecos de una lamina son contiguos— y el
# plano se volveria ilegible justo donde mas junto esta.
#
# Todo se acota en CENTIMETROS. El motor calcula en pulgadas porque es la unidad
# de `officer` y del OOXML, pero quien lee el plano mide en cm, y obligarle a
# convertir cada cifra para comparar con una regla es exactamente el trabajo que
# la guia existe para ahorrar. La conversion se hace una vez, aqui.

# Cian apagado: visible sobre blanco y sobre el azul institucional, sin ser el
# magenta que se comia la lamina.
.GUIA_COL <- "#0FA3B1"

# Fino de verdad. El grosor anterior (0.6) pintaba una banda, no una linea.
.GUIA_LWD <- 0.25

# La cota tiene que leerse al hacer zoom, no a tamano completo: es una anotacion
# de trabajo, no un rotulo de la lamina.
.GUIA_SIZE_COTA <- 5.6

# Las cifras de cota se leen sobre barras, texto y fondo. Un halo claro detras
# las despega de lo que haya debajo sin taparlo: con 4.6 pt y sin halo, la cota
# de una caja que cruzaba una barra verde era ilegible.
# 0x8C = 55 % de opacidad. Con 0xCC (80 %) el halo tapaba el dato que estaba
# debajo —barras y etiquetas de leyenda quedaban con un recuadro blanco
# encima—, que es justo lo que la guia no debe hacer: es papel milimetrado, no
# una capa opaca.
.GUIA_HALO_FILL <- "#FFFFFF8C"

# Pulgadas a centimetros. El motor mide en pulgadas; el plano se lee en cm.
.GUIA_CM_POR_IN <- 2.54

# Caja minima que puede llevar cota escrita, en centimetros. Por debajo se
# dibuja solo el marco: la cota de una caja de medio centimetro se monta sobre
# la del hueco de al lado y las dos dejan de leerse.
.GUIA_MIN_W_COTA_CM <- 2.30
.GUIA_MIN_H_COTA_CM <- 0.40


#' Registro de bandas ocupadas por las notas de una lamina
#'
#' El marco de cada caja se dibuja solo, pero su nota no: las cajas de una
#' lamina son contiguas y anidadas, y varias comparten borde superior. Con la
#' nota siempre en la esquina de arriba, dos cajas apiladas escriben en la misma
#' banda y el resultado es ilegible —en el mazo de Contabilidad, la nota del
#' panel y la del area de barras se montaban una sobre otra—.
#'
#' Cada caja pregunta por su nivel antes de escribir: si su banda ya esta
#' tomada, baja una linea. El registro vive en un closure porque es estado de
#' una lamina, no del proceso: dos laminas no comparten bandas.
#'
#' @param tolerancia_npc Distancia por debajo de la cual dos notas se pisan.
#' @return Funcion `nivel(top_npc)` que devuelve cuantas lineas bajar.
#' @keywords internal
.guia_registro_notas <- function(tolerancia_npc = 0.02) {
  bandas <- numeric(0)
  function(top_npc) {
    t <- suppressWarnings(as.numeric(top_npc)[1])
    if (!is.finite(t)) return(0L)
    nivel <- 0L
    while (any(abs(bandas - (t - nivel * tolerancia_npc)) < tolerancia_npc * 0.5)) {
      nivel <- nivel + 1L
      if (nivel > 6L) break
    }
    bandas <<- c(bandas, t - nivel * tolerancia_npc)
    nivel
  }
}


#' Formatea una cota en centimetros, a partir de pulgadas
#'
#' Dos decimales: con uno, dos huecos que difieren en un milimetro se leen
#' iguales, y ese milimetro es el que suele explicar por que un texto no cabe.
#'
#' @keywords internal
.guia_cota <- function(w_in, h_in) {
  if (!is.finite(w_in) || !is.finite(h_in)) return("")
  sprintf("%.2f × %.2f cm", w_in * .GUIA_CM_POR_IN, h_in * .GUIA_CM_POR_IN)
}


#' Nota de una caja: cuerpo de texto y grosor de barra
#'
#' El texto va en PUNTOS y el grosor en CENTIMETROS. La mezcla es deliberada: el
#' cuerpo se declara en puntos en todas partes —es como lo escribe el .pptx, en
#' centesimas— y pasarlo a cm no lo haria mas comparable con nada. La geometria,
#' en cambio, se compara contra una regla.
#'
#' @param texto_pt Cuerpo del texto de la caja, en puntos.
#' @param barra_in Grosor de la barra, en PULGADAS; se escribe en cm.
#'
#' @keywords internal
.guia_nota <- function(texto_pt = NULL, barra_in = NULL) {
  partes <- character(0)
  t <- suppressWarnings(as.numeric(texto_pt %||% NA_real_)[1])
  # Un decimal: el cuerpo se declara en enteros o medios puntos, y arrastrar
  # «8.535 pt» —el 3 de ggplot por el factor 2.845— finge una precision que
  # nadie eligio.
  if (is.finite(t) && t > 0) partes <- c(partes, paste0(format(round(t, 1), trim = TRUE), " pt"))
  b <- suppressWarnings(as.numeric(barra_in %||% NA_real_)[1])
  if (is.finite(b) && b > 0) partes <- c(partes, sprintf("barra %.2f cm", b * .GUIA_CM_POR_IN))
  paste(partes, collapse = "  ")
}


#' Grobs de una linea de cota, como en un plano
#'
#' Una cota no es una etiqueta: es una linea que va DE un punto A otro, con
#' topes perpendiculares en los extremos y la medida escrita en medio. Escribir
#' «17.43 × 11.65 cm» dentro de la caja dice cuanto mide, pero no de donde a
#' donde; para comprobar una separacion o un margen hay que poder seguir la
#' linea hasta sus dos extremos.
#'
#' Coordenadas en npc de la caja: 0 y 1 son sus bordes.
#'
#' @param x0,x1,y0,y1 Extremos de la cota, en npc.
#' @param texto Medida ya formateada.
#' @param col,lwd Color y grosor.
#' @param size_cota Cuerpo de la cifra.
#' @param tope Largo del tope perpendicular, en npc.
#' @return Lista de grobs.
#' @keywords internal
.guia_cota_grobs <- function(x0, x1, y0, y1, texto,
                             col = .GUIA_COL, lwd = .GUIA_LWD,
                             size_cota = .GUIA_SIZE_COTA, tope = 0.012) {
  # Se toma cada extremo por separado: `c(x0, x1, y0, y1)` con un `NULL` en
  # medio colapsa a tres elementos y el cuarto indice se sale del vector.
  vals <- suppressWarnings(as.numeric(c(
    x0[1] %||% NA_real_, x1[1] %||% NA_real_,
    y0[1] %||% NA_real_, y1[1] %||% NA_real_
  )))
  if (length(vals) != 4L || any(!is.finite(vals))) return(list())
  horizontal <- abs(vals[[2]] - vals[[1]]) >= abs(vals[[4]] - vals[[3]])

  linea <- grid::linesGrob(
    x = grid::unit(c(vals[[1]], vals[[2]]), "npc"),
    y = grid::unit(c(vals[[3]], vals[[4]]), "npc"),
    gp = grid::gpar(col = col, lwd = lwd)
  )
  # Topes perpendiculares a la cota, uno en cada extremo.
  topes <- if (horizontal) {
    grid::segmentsGrob(
      x0 = grid::unit(c(vals[[1]], vals[[2]]), "npc"),
      x1 = grid::unit(c(vals[[1]], vals[[2]]), "npc"),
      y0 = grid::unit(c(vals[[3]] - tope, vals[[4]] - tope), "npc"),
      y1 = grid::unit(c(vals[[3]] + tope, vals[[4]] + tope), "npc"),
      gp = grid::gpar(col = col, lwd = lwd)
    )
  } else {
    grid::segmentsGrob(
      x0 = grid::unit(c(vals[[1]] - tope, vals[[2]] - tope), "npc"),
      x1 = grid::unit(c(vals[[1]] + tope, vals[[2]] + tope), "npc"),
      y0 = grid::unit(c(vals[[3]], vals[[4]]), "npc"),
      y1 = grid::unit(c(vals[[3]], vals[[4]]), "npc"),
      gp = grid::gpar(col = col, lwd = lwd)
    )
  }
  x_cifra <- grid::unit((vals[[1]] + vals[[2]]) / 2, "npc")
  y_cifra <- grid::unit((vals[[3]] + vals[[4]]) / 2, "npc")
  rot <- if (horizontal) 0 else 90
  just <- c("center", if (horizontal) "bottom" else "top")

  # Halo: un rectangulo claro del tamano del texto, detras. `grid` lo dimensiona
  # solo a partir de la cadena, asi que no hay que estimar anchos.
  halo <- grid::roundrectGrob(
    x = x_cifra, y = y_cifra,
    width = grid::stringWidth(texto) + grid::unit(1.6, "mm"),
    height = grid::stringHeight(texto) + grid::unit(1.0, "mm"),
    just = just, r = grid::unit(0.4, "mm"),
    gp = grid::gpar(fill = .GUIA_HALO_FILL, col = NA)
  )
  cifra <- grid::textGrob(
    label = texto, x = x_cifra, y = y_cifra, rot = rot, just = just,
    gp = grid::gpar(col = col, fontsize = size_cota, fontface = "bold")
  )
  list(linea, topes, halo, cifra)
}


#' Grobs de una caja del plano: su marco y su cota
#'
#' @param x,y,w,h Geometria de la caja en npc.
#' @param ancho_in,alto_in Tamano del canvas en pulgadas, para convertir.
#' @param etiqueta Nombre del hueco; se antepone a la cota cuando se da.
#' @param nota Medida que la cota no dice: cuerpo del texto en puntos, grosor de
#'   barra en pulgadas. Se construye con `.guia_nota()`.
#' @param col,lwd Color y grosor de la linea.
#' @param size_cota Cuerpo de la cota.
#'
#' @return Lista de grobs lista para `cowplot::draw_grob()`.
#' @keywords internal
.guia_ph_grobs <- function(x, y, w, h, ancho_in = NA_real_, alto_in = NA_real_,
                           etiqueta = NULL, nota = NULL,
                           col = .GUIA_COL, lwd = .GUIA_LWD,
                           size_cota = .GUIA_SIZE_COTA,
                           nivel = 0L) {
  marco <- grid::rectGrob(
    x = 0, y = 0, width = 1, height = 1,
    just = c("left", "bottom"),
    gp = grid::gpar(col = col, fill = NA, lwd = lwd)
  )

  w_in <- w * ancho_in
  h_in <- h * alto_in
  cota <- .guia_cota(w_in, h_in)
  if (!nzchar(cota)) return(list(marco))

  # Una caja que no puede contener su cota se queda sin ella. Los huecos de una
  # lamina son contiguos y varios miden decimas de pulgada: escribirles la cota
  # igual la superpone con la del vecino y el resultado —«02006×0028»— no se
  # lee ni dice nada. El marco solo ya ubica la caja; la medida se saca de la
  # caja grande que la contiene.
  if (!is.finite(w_in) || !is.finite(h_in) ||
      w_in * .GUIA_CM_POR_IN < .GUIA_MIN_W_COTA_CM ||
      h_in * .GUIA_CM_POR_IN < .GUIA_MIN_H_COTA_CM) {
    return(list(marco))
  }

  # La nota lleva lo que la cota no puede decir: el cuerpo del texto que va en
  # esa caja y el grosor de la barra que dibuja. Son las dos medidas que el
  # recetario pide y que hasta ahora habia que sacar del XML —`sz=` en centesimas
  # de punto, alturas en EMU— con el archivo ya exportado.
  texto <- paste(c(
    if (!is.null(etiqueta) && nzchar(etiqueta)) etiqueta,
    cota,
    if (!is.null(nota) && nzchar(nota)) nota
  ), collapse = "  ·  ")

  # Arriba a la izquierda y pegada al marco: es la esquina que menos ocupan los
  # datos —las barras arrancan mas abajo y las etiquetas de eje van al otro
  # lado— y deja la caja libre para lo que se esta auditando.
  #
  # `nivel` baja la nota una linea por cada vecina que ya ocupa su banda (ver
  # `.guia_registro_notas()`), y el consumidor puede sumar un salto fijo a las
  # cajas cuya primera linea esta ocupada por contenido: la columna del Top Two
  # Box lleva ahi su rotulo y la nota se lo comia.
  n <- suppressWarnings(as.integer(nivel)[1])
  if (!is.finite(n) || is.na(n) || n < 0L) n <- 0L
  salto <- n * (size_cota * 1.5 / 72) / max(h_in, 1e-6)
  rotulo <- grid::textGrob(
    label = texto,
    x = grid::unit(0.012, "npc"), y = grid::unit(0.985 - salto, "npc"),
    just = c("left", "top"),
    gp = grid::gpar(col = col, fontsize = size_cota, fontface = "plain")
  )

  # Cotas de plano: una horizontal pegada al borde inferior y una vertical
  # pegada al izquierdo, cada una de un extremo al otro de la caja. La cifra de
  # dentro dice CUANTO; las cotas dicen DE DONDE A DONDE.
  #
  # SOLO en las cajas con nombre. Una lamina tiene ocho o mas cajas anidadas
  # —panel, area de barras, buffers— y acotarlas todas amontonaba dieciseis
  # cotas sobre el mismo espacio: los halos acababan tapando el texto que la
  # guia venia a dejar medir. Las auxiliares se quedan con su marco, que ya dice
  # donde estan.
  if (is.null(etiqueta) || !nzchar(etiqueta)) return(list(marco, rotulo))

  cotas <- c(
    .guia_cota_grobs(
      0.02, 0.98, 0.022, 0.022,
      sprintf("%.2f cm", w_in * .GUIA_CM_POR_IN),
      col = col, lwd = lwd, size_cota = size_cota
    ),
    .guia_cota_grobs(
      0.03, 0.03, 0.02, 0.98,
      sprintf("%.2f cm", h_in * .GUIA_CM_POR_IN),
      col = col, lwd = lwd, size_cota = size_cota
    )
  )

  c(list(marco, rotulo), cotas)
}


# Dispersion minima entre barras para que la regla aparezca, en centimetros.
# Mismo valor que `grosor_dispersion_max_cm` de la regla B3 del verificador:
# medio milimetro. Por debajo es redondeo del render y por encima se ve.
.GUIA_REGLA_DISPERSION_MIN_CM <- 0.05


#' Regla que acota BARRA POR BARRA
#'
#' Las cotas de `.guia_ph_grobs()` miden la CAJA: dicen que el area de barras
#' mide tanto de alto, y una sola nota arriba dice el grosor teorico. Eso no
#' sirve para lo que hace falta comprobar —«todas estas barras no tienen el
#' mismo grosor»—, porque una cifra unica no puede desmentirse a si misma: si
#' dos barras de la lamina difieren, la nota de arriba sigue cantando un solo
#' numero.
#'
#' Esta regla pone una cota A CADA BARRA, con su medida propia leida de su
#' posicion real en el canvas. Dos barras distintas cantan cifras distintas, que
#' es justo lo que se quiere poder ver de un vistazo.
#'
#' Va pegada al borde izquierdo del area de barras y hacia dentro, donde no hay
#' dato: a la izquierda estan las etiquetas de eje, que son texto y no se
#' comparan entre laminas.
#'
#' @param y_centros Centro de cada barra, en npc del canvas.
#' @param grosor_npc Grosor de cada barra, en npc del canvas. Escalar o vector.
#' @param alto_in Alto del canvas en pulgadas, para pasar npc a centimetros.
#' @param x Posicion horizontal de la regla, en npc.
#' @param ancho Largo de cada cota, en npc.
#' @param col,lwd,size_cota Estilo, como el resto de la guia.
#' @return Lista de grobs; vacia si no hay nada acotable.
#' @keywords internal
.guia_regla_por_barra <- function(y_centros, grosor_npc, alto_in,
                                  x = 0.012, ancho = 0.055,
                                  col = .GUIA_COL, lwd = .GUIA_LWD,
                                  size_cota = .GUIA_SIZE_COTA) {
  y <- suppressWarnings(as.numeric(y_centros))
  g <- suppressWarnings(as.numeric(grosor_npc))
  a <- suppressWarnings(as.numeric(alto_in)[1])
  if (!length(y) || !length(g) || !is.finite(a) || a <= 0) return(list())
  if (length(g) == 1L) g <- rep(g, length(y))
  if (length(g) != length(y)) return(list())

  ok <- is.finite(y) & is.finite(g) & g > 0
  if (!any(ok)) return(list())
  y <- y[ok]; g <- g[ok]

  # La regla aparece SOLO si hay algo que ver. Con todas las barras al mismo
  # grosor, la nota de la caja ya lo dice con una cifra y repetirla cinco veces
  # sobre los porcentajes es ruido: la guia estorba en vez de medir. Cuando
  # difieren —que es lo que hay que poder detectar de un vistazo— cada barra
  # canta la suya y la diferencia salta sola.
  #
  # El umbral es el mismo que usa la regla B3 del verificador: medio milimetro.
  # Por debajo es redondeo del render y por encima se ve.
  if (length(g) > 1L) {
    disp_cm <- (max(g) - min(g)) * a * .GUIA_CM_POR_IN
    if (!is.finite(disp_cm) || disp_cm <= .GUIA_REGLA_DISPERSION_MIN_CM) {
      return(list())
    }
  }

  # Con muchas barras las cifras se montarian unas sobre otras y la regla
  # dejaria de leerse, que es lo contrario de lo que viene a hacer. El limite
  # sale del cuerpo de la cifra: dos cotas necesitan al menos su alto de
  # separacion.
  alto_cifra_npc <- size_cota / 72 / a
  if (length(y) > 1L) {
    paso <- min(diff(sort(y)))
    if (is.finite(paso) && paso < alto_cifra_npc * 1.15) return(list())
  }

  out <- list()
  for (i in seq_along(y)) {
    y0 <- y[i] - g[i] / 2
    y1 <- y[i] + g[i] / 2
    # La cota: linea vertical con topes, como en un plano.
    out <- c(out, list(
      grid::linesGrob(
        x = grid::unit(c(x, x), "npc"),
        y = grid::unit(c(y0, y1), "npc"),
        gp = grid::gpar(col = col, lwd = lwd)
      ),
      grid::segmentsGrob(
        x0 = grid::unit(c(x - ancho / 2, x - ancho / 2), "npc"),
        x1 = grid::unit(c(x + ancho / 2, x + ancho / 2), "npc"),
        y0 = grid::unit(c(y0, y1), "npc"),
        y1 = grid::unit(c(y0, y1), "npc"),
        gp = grid::gpar(col = col, lwd = lwd)
      )
    ))

    # La cifra va HORIZONTAL y a la derecha de la cota, no rotada dentro de
    # ella. Rotada y a cuerpo de cota era ilegible: es una medida que se compara
    # de un vistazo con la de la barra de al lado, y para eso hay que poder
    # leerla sin girar la cabeza. Con halo, porque cae sobre la barra.
    # La cifra va a la DERECHA de la cota y horizontal. Se probo a la izquierda,
    # en el canal entre las etiquetas de eje y las barras, para no pisar el
    # porcentaje: ahi la tapan las propias etiquetas y no se lee ninguna, que es
    # peor. A la derecha pisa un poco el primer segmento, y ese es el precio.
    etq <- sprintf("%.2f", g[i] * a * .GUIA_CM_POR_IN)
    out <- c(out, list(
      grid::roundrectGrob(
        x = grid::unit(x + ancho * 0.75, "npc"), y = grid::unit(y[i], "npc"),
        width = grid::unit(nchar(etq) * size_cota * 1.35, "points"),
        height = grid::unit(size_cota * 1.45, "points"),
        just = c("left", "centre"), r = grid::unit(1, "pt"),
        gp = grid::gpar(fill = .GUIA_HALO_FILL, col = NA)
      ),
      grid::textGrob(
        etq,
        x = grid::unit(x + ancho * 0.75 + 0.004, "npc"),
        y = grid::unit(y[i], "npc"),
        just = c("left", "centre"), rot = 0,
        gp = grid::gpar(col = col, fontsize = size_cota * 1.25,
                        fontface = "bold")
      )
    ))
  }
  out
}
