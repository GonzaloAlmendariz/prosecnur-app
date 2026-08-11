# =============================================================================
# graficos_top2box_comparativo.R — columna Top 2 Box con medición anterior
# =============================================================================
#
# QUÉ RESUELVE: la columna extra de las apiladas informaba un nivel («93%») y
# el lector no podía saber si eso era bueno ni si había mejorado. El deck de
# acreditación 2021 de la casa resuelve las dos preguntas en el mismo objeto:
# una tabla de dos columnas (medición actual | anterior), la cifra teñida por
# umbral y un triángulo con la dirección del cambio.
#
# POR QUÉ VIVE APARTE: `graficador_barras_apiladas.R` ya pasa de 3.000 líneas.
# Aquí queda todo lo que se puede razonar y testear sin dibujar —normalizar el
# spec, decidir color y dirección— más el constructor de capas; el graficador
# solo suma la lista que devuelve `.t2b_capas_extra()`.
#
# DE DÓNDE SALE EL PERÍODO ANTERIOR: se declara en el plan de láminas, no se
# calcula de otra base. El caso real (ACRD CONTA) tiene el 2018 como cifra de
# un informe previo, no como base procesable del `.pulso`; exigir una base para
# poder comparar habría dejado la función inservible justo en su caso de uso.
# Si algún día el histórico llega como base, el spec ya está normalizado por
# categoría y basta alimentarlo desde ahí.

# Umbrales del semáforo, en puntos porcentuales. Medidos sobre el deck 2021:
# no hubo un solo valor bajo 70, así que `bajo` es una extensión deliberada de
# la regla (no una lectura del deck) para que la escala no tenga un hueco.
.T2B_SEMAFORO_UMBRALES <- c(alto = 80, medio = 70)

# Verde y ámbar son los del deck (`80C535`, `FFC000`). El rojo se toma del
# mismo rosa que el deck usa para la flecha de caída, oscurecido lo justo para
# que una cifra en 13 pt tenga contraste sobre fondo claro.
.T2B_SEMAFORO_COLORES <- c(alto = "#80C535", medio = "#FFC000", bajo = "#C0504D")

# Triángulo de tendencia: verde sube, rosa baja (los del deck).
.T2B_TENDENCIA_COLORES <- c(sube = "#80C535", baja = "#DA8080")

#' Normaliza el spec del comparativo contra las categorías reales de la lámina.
#'
#' Devuelve `NULL` cuando no hay nada que comparar — es la señal de que la
#' columna extra debe dibujarse como siempre (una sola cifra).
#' @noRd
.t2b_normalizar_comparativo <- function(comparativo, categorias, alias = NULL) {
  if (is.null(comparativo)) return(NULL)
  categorias <- as.character(categorias)
  if (!length(categorias)) return(NULL)
  alias <- if (is.null(alias)) NULL else as.character(alias)
  if (!is.null(alias) && length(alias) != length(categorias)) alias <- NULL

  if (!is.list(comparativo)) {
    # Atajo de conveniencia: un vector nombrado es «solo los valores previos».
    comparativo <- list(valores_anterior = comparativo)
  }

  vals_in <- comparativo$valores_anterior %||% comparativo$valores %||% NULL
  if (is.null(vals_in) || !length(vals_in)) return(NULL)

  vals_num <- suppressWarnings(as.numeric(vals_in))
  nms <- names(vals_in)

  # Alineación por nombre cuando el plan los declara; por posición solo si vino
  # sin nombres y la longitud calza exacto. Reciclar un vector corto por
  # posición sería inventar un histórico para filas que no lo declararon.
  #
  # Se prueban DOS claves: la etiqueta de fila («Estudiantes») y el `alias`, que
  # es el identificador con el que el plan nombra la categoría — en una batería
  # multiapilada, el nombre de la variable (`p30_1`). Sin esto, declarar el
  # histórico en una batería obligaba a repetir el enunciado completo y
  # carácter por carácter; cualquier recorte o wrap rompía el match en silencio
  # y la columna volvía a la cifra suelta. Se vio armando el mazo de acrconta.
  valores <- rep(NA_real_, length(categorias))
  if (!is.null(nms) && any(nzchar(nms))) {
    nms_norm <- .t2b_clave_alineacion(nms)
    idx <- match(.t2b_clave_alineacion(categorias), nms_norm)
    if (!is.null(alias)) {
      falta <- is.na(idx)
      if (any(falta)) idx[falta] <- match(.t2b_clave_alineacion(alias[falta]), nms_norm)
    }

    # Ninguna clave resolvió y la longitud calza: el caso real es una batería
    # multiapilada, donde la fila se identifica por el ENUNCIADO y el plan
    # declara por nombre de variable (`p30_1`) — ahí no hay clave común, porque
    # el motor ya reemplazó el id por el título del grupo.
    #
    # Se resuelve por orden, que es el de `vars`, PERO avisando: el modo
    # anterior devolvía NULL y la lámina volvía a la cifra suelta sin decir
    # nada, y un histórico que desaparece en silencio se lee como «no había
    # dato», no como «no supe alinearlo».
    if (all(is.na(idx)) && length(vals_num) == length(categorias)) {
      .t2b_avisar_alineacion_por_orden(nms, categorias)
      idx <- seq_along(categorias)
    }
    valores <- vals_num[idx]
  } else if (length(vals_num) == length(categorias)) {
    valores <- vals_num
  } else {
    return(NULL)
  }

  valores[!is.finite(valores)] <- NA_real_
  if (all(is.na(valores))) return(NULL)

  # El plan puede declarar el histórico en proporción (0,85) o en porcentaje
  # (85). Se normaliza a porcentaje: la columna actual ya viene en esa escala.
  finitos <- valores[is.finite(valores)]
  if (length(finitos) && max(abs(finitos)) <= 1) valores <- valores * 100

  list(
    periodo_actual   = .t2b_periodo_chr(comparativo$periodo_actual, ""),
    periodo_anterior = .t2b_periodo_chr(comparativo$periodo_anterior, ""),
    valores          = valores
  )
}

#' Umbrales efectivos del semáforo.
#'
#' El vector (`barra_extra_semaforo`) sigue mandando cuando se declara; los dos
#' escalares existen para la config de Gráficos, que no tiene input de vector.
#' Un escalar declarado pisa solo su propio corte, así que se puede mover el
#' verde sin tener que repetir el ámbar.
#' @noRd
.t2b_umbrales_efectivos <- function(vector_umbrales = NULL,
                                    alto = NULL,
                                    medio = NULL) {
  base <- vector_umbrales %||% .T2B_SEMAFORO_UMBRALES
  alto_eff <- suppressWarnings(as.numeric(alto %||% NA_real_)[1])
  medio_eff <- suppressWarnings(as.numeric(medio %||% NA_real_)[1])

  out <- c(
    alto  = suppressWarnings(as.numeric(.t2b_pick(base, "alto", 1L, .T2B_SEMAFORO_UMBRALES[["alto"]]))),
    medio = suppressWarnings(as.numeric(.t2b_pick(base, "medio", 2L, .T2B_SEMAFORO_UMBRALES[["medio"]])))
  )
  if (is.finite(alto_eff))  out[["alto"]]  <- alto_eff
  if (is.finite(medio_eff)) out[["medio"]] <- medio_eff

  # Un ámbar por encima del verde deja la franja intermedia vacía y todo lo que
  # no es verde cae a rojo sin que nadie lo haya pedido. Se ordena.
  if (out[["medio"]] > out[["alto"]]) out <- c(alto = out[["medio"]], medio = out[["alto"]])
  out
}

#' Aviso de que el histórico se alineó por orden y no por nombre.
#'
#' Va por `message()` y no por `warning()` a propósito: el renderer del plan
#' envuelve cada llamada al graficador en `suppressWarnings()`, así que un
#' warning aquí no llega a nadie — se comprobó armando el mazo de acreditación.
#' `message()` es además el canal con el que el motor ya narra su avance
#' («Diapositiva 003/004 — slide_1»), de modo que el aviso aparece en el mismo
#' sitio donde el usuario está mirando.
#'
#' El texto dice las tres cosas que hacen falta para actuar: qué se declaró,
#' contra qué se intentó, y qué se hizo mientras tanto.
#' @noRd
.t2b_avisar_alineacion_por_orden <- function(declaradas, filas) {
  recorta <- function(x, n = 3L) {
    x <- as.character(x)
    x <- gsub("[\r\n]+", " ", x)
    x <- vapply(x, function(s) {
      if (nchar(s) > 42L) paste0(substr(s, 1L, 40L), "…") else s
    }, character(1), USE.NAMES = FALSE)
    if (length(x) > n) c(x[seq_len(n)], sprintf("(+%d)", length(x) - n)) else x
  }

  # El aviso al analista va en UNA línea y sellado; el detalle se queda en el
  # log, que es donde sirve para depurar.
  .pulso_aviso(
    "Top 2 Box · comparativo: ninguna clave del histórico coincidió con una fila, ",
    "así que se alineó por ORDEN de declaración. Si tus filas no siguen el orden ",
    "de `vars`, declara el histórico con la etiqueta de fila tal como aparece."
  )
  message(
    "Top 2 Box · comparativo: se alineó por ORDEN de declaración.\n",
    "  Declarado : ", paste(recorta(declaradas), collapse = ", "), "\n",
    "  Filas     : ", paste(recorta(filas), collapse = ", "), "\n",
    "  Ninguna clave coincide con una fila, así que el histórico se asignó en\n",
    "  el orden en que viene. Es lo correcto en una batería (el orden es el de\n",
    "  `vars`); si tus filas no siguen ese orden, declara el histórico con la\n",
    "  etiqueta de fila tal como aparece en la lámina."
  )
  invisible(NULL)
}

#' Clave de alineación: colapsa el espacio y el salto de línea que introduce el
#' wrap de la etiqueta de fila. Sin esto, una etiqueta envuelta a dos líneas
#' deja de coincidir con la misma etiqueta declarada en el plan.
#' @noRd
.t2b_clave_alineacion <- function(x) {
  x <- gsub("[\r\n]+", " ", as.character(x))
  trimws(gsub("\\s+", " ", x))
}

#' @noRd
.t2b_periodo_chr <- function(x, default = "") {
  x <- as.character(x %||% default)[1]
  if (is.na(x)) return(default)
  trimws(x)
}

#' Toma un elemento por nombre y, si no está, por posición. Existe porque
#' `v[["alto"]]` sobre un vector sin ese nombre aborta en vez de devolver NULL:
#' el plan puede declarar los umbrales sin nombrarlos y eso no es un error.
#' @noRd
.t2b_pick <- function(v, nombre, pos, default) {
  if (is.null(v)) return(default)
  nms <- names(v)
  if (!is.null(nms) && nombre %in% nms) {
    out <- v[[nombre]]
  } else if (length(v) >= pos) {
    out <- v[[pos]]
  } else {
    return(default)
  }
  if (is.null(out) || (length(out) == 1L && is.na(out))) return(default)
  out
}

#' Color de cada cifra según los umbrales del semáforo.
#'
#' `umbrales` es `c(alto=, medio=)`: `>= alto` verde, `>= medio` ámbar, resto
#' rojo. Un `NA` no se tiñe — se devuelve `color_neutro`, porque una celda sin
#' dato no puede afirmar «está mal».
#' @noRd
.t2b_semaforo_color <- function(valores,
                                umbrales = .T2B_SEMAFORO_UMBRALES,
                                colores = .T2B_SEMAFORO_COLORES,
                                color_neutro = "#7A7A7A") {
  valores <- suppressWarnings(as.numeric(valores))
  alto  <- suppressWarnings(as.numeric(.t2b_pick(umbrales, "alto", 1L, .T2B_SEMAFORO_UMBRALES[["alto"]])))
  medio <- suppressWarnings(as.numeric(.t2b_pick(umbrales, "medio", 2L, .T2B_SEMAFORO_UMBRALES[["medio"]])))
  if (!is.finite(alto))  alto  <- .T2B_SEMAFORO_UMBRALES[["alto"]]
  if (!is.finite(medio)) medio <- .T2B_SEMAFORO_UMBRALES[["medio"]]

  c_alto  <- as.character(.t2b_pick(colores, "alto",  1L, .T2B_SEMAFORO_COLORES[["alto"]]))
  c_medio <- as.character(.t2b_pick(colores, "medio", 2L, .T2B_SEMAFORO_COLORES[["medio"]]))
  c_bajo  <- as.character(.t2b_pick(colores, "bajo",  3L, .T2B_SEMAFORO_COLORES[["bajo"]]))

  out <- rep(color_neutro, length(valores))
  ok <- is.finite(valores)
  out[ok & valores >= alto] <- c_alto
  out[ok & valores >= medio & valores < alto] <- c_medio
  out[ok & valores < medio] <- c_bajo
  out
}

#' Dirección del cambio contra la medición anterior.
#'
#' `tolerancia_pp` existe porque el deck no dibuja flecha cuando el valor
#' repite (96% vs 96%): sin cambio no hay nada que señalar, y una flecha por
#' un punto de redondeo es ruido con apariencia de hallazgo.
#' @noRd
.t2b_direccion <- function(actual, anterior, tolerancia_pp = 0) {
  actual <- suppressWarnings(as.numeric(actual))
  anterior <- suppressWarnings(as.numeric(anterior))
  n <- max(length(actual), length(anterior))
  actual <- rep_len(actual, n)
  anterior <- rep_len(anterior, n)

  tol <- suppressWarnings(as.numeric(tolerancia_pp)[1])
  if (!is.finite(tol) || tol < 0) tol <- 0

  out <- rep(NA_character_, n)
  ok <- is.finite(actual) & is.finite(anterior)
  delta <- actual - anterior
  out[ok & delta > tol] <- "sube"
  out[ok & delta < -tol] <- "baja"
  out
}

#' Capas de la tabla comparativa dentro del carril de la columna extra.
#'
#' Trabaja en coordenadas npc del canvas: `x0`/`w` delimitan el carril y `y`
#' trae el centro vertical de cada fila, los mismos que usa el graficador para
#' las barras — así la celda queda alineada con su barra sin recalcular nada.
#'
#' `alto_celda` se deriva del paso entre filas y no del grosor de la barra: la
#' celda del deck es más alta que su barra (1,96 cm contra 1,35), que es lo que
#' permite que la cifra respire dentro de la rejilla.
#' @noRd
.t2b_capas_extra <- function(x0, w, y,
                             valores_actual,
                             comparativo,
                             size_valor = 10,
                             size_encabezado = 9,
                             font_family = "Arial",
                             umbrales = .T2B_SEMAFORO_UMBRALES,
                             colores_semaforo = .T2B_SEMAFORO_COLORES,
                             color_encabezado = "#000000",
                             color_rejilla = "#BFBFBF",
                             color_celda = "#FFFFFF",
                             mostrar_tendencia = TRUE,
                             tolerancia_pp = 0,
                             y_encabezado = NULL,
                             alto_celda = NULL,
                             w_total_in = 13.33,
                             h_total_in = 7.5,
                             decimales = 0) {
  if (is.null(comparativo)) return(list())
  y <- suppressWarnings(as.numeric(y))
  if (!length(y) || !any(is.finite(y))) return(list())

  n <- length(y)
  valores_actual <- rep_len(suppressWarnings(as.numeric(valores_actual)), n)
  valores_prev <- rep_len(comparativo$valores, n)

  # Dos sub-columnas iguales dentro del carril.
  w_col <- w / 2
  x_col <- c(x0 + w_col * 0.5, x0 + w_col * 1.5)

  # Tope del alto de celda, en pulgadas. En el deck la celda mide 1,96 cm con
  # una cifra de 13 pt: unas 4,3 veces el cuerpo. Sin tope, una lámina con
  # pocas filas muy espaciadas (una batería de 3 enunciados largos) estira la
  # celda hasta parecer un recuadro vacío con un número perdido dentro.
  tope_celda <- size_valor * 4.0 / 72 / h_total_in

  if (is.null(alto_celda) || !is.finite(alto_celda)) {
    alto_celda <- if (n > 1L) {
      pasos <- diff(sort(y[is.finite(y)]))
      pasos <- pasos[is.finite(pasos) & pasos > 0]
      if (length(pasos)) min(min(pasos) * 0.86, tope_celda) else 0.5 / h_total_in
    } else {
      # Fila única: no hay paso del que derivar. Se ancla al cuerpo de la
      # cifra para que la celda no quede ni asfixiada ni enorme.
      max(0.28 / h_total_in, size_valor * 2.6 / 72 / h_total_in)
    }
  }

  capas <- list()

  celda <- function(cx, cy, cw, ch, fill) {
    cowplot::draw_grob(
      grid::rectGrob(
        x = 0, y = 0, width = 1, height = 1,
        just = c("left", "bottom"),
        gp = grid::gpar(col = color_rejilla, fill = fill, lwd = 0.8)
      ),
      x = cx, y = cy, width = cw, height = ch, hjust = 0, vjust = 0
    )
  }

  # --- encabezado con los dos períodos -------------------------------------
  etiquetas_periodo <- c(comparativo$periodo_actual, comparativo$periodo_anterior)
  if (!is.null(y_encabezado) && is.finite(y_encabezado) &&
      any(nzchar(etiquetas_periodo))) {
    h_enc <- alto_celda * 0.62
    for (k in seq_len(2)) {
      capas <- c(capas, list(
        celda(x0 + w_col * (k - 1), y_encabezado - h_enc / 2, w_col, h_enc, color_celda),
        cowplot::draw_text(
          text = etiquetas_periodo[k], x = x_col[k], y = y_encabezado,
          hjust = 0.5, vjust = 0.5, size = size_encabezado,
          colour = color_encabezado, family = font_family, fontface = "bold"
        )
      ))
    }
  }

  # --- filas ----------------------------------------------------------------
  cols_actual <- .t2b_semaforo_color(valores_actual, umbrales, colores_semaforo)
  cols_prev   <- .t2b_semaforo_color(valores_prev, umbrales, colores_semaforo)
  dirs <- if (isTRUE(mostrar_tendencia)) {
    .t2b_direccion(valores_actual, valores_prev, tolerancia_pp)
  } else {
    rep(NA_character_, n)
  }

  fmt <- function(v) {
    if (!is.finite(v)) return("")
    paste0(.pulso_fmt_half_up(v, decimales), "%")
  }

  for (i in seq_len(n)) {
    if (!is.finite(y[i])) next
    yb <- y[i] - alto_celda / 2
    valores_fila <- c(valores_actual[i], valores_prev[i])
    cols_fila <- c(cols_actual[i], cols_prev[i])

    for (k in seq_len(2)) {
      capas <- c(capas, list(celda(x0 + w_col * (k - 1), yb, w_col, alto_celda, color_celda)))
      if (is.finite(valores_fila[k])) {
        capas <- c(capas, list(cowplot::draw_text(
          text = fmt(valores_fila[k]), x = x_col[k], y = y[i],
          hjust = 0.5, vjust = 0.5, size = size_valor,
          colour = cols_fila[k], family = font_family, fontface = "bold"
        )))
      }
    }

    # El triángulo va sobre la celda del período actual: es esa cifra la que
    # subió o bajó, no la histórica.
    if (!is.na(dirs[i])) {
      # El triángulo va dentro de su celda: se deja al menos su propio alto de
      # margen contra el borde superior, o con la celda acotada termina montado
      # sobre la línea de la rejilla.
      h_tri <- .T2B_TRIANGULO_ALTO_IN / h_total_in
      dy_tri <- min(alto_celda * 0.30, max(0, alto_celda / 2 - h_tri * 2))
      capas <- c(capas, list(
        .t2b_triangulo(
          x = x_col[1],
          y = y[i] + dy_tri,
          direccion = dirs[i],
          w_total_in = w_total_in,
          h_total_in = h_total_in
        )
      ))
    }
  }

  capas
}

# Tamaño físico del triángulo, en pulgadas. Es el del deck (0,6 x 0,17 cm) y va
# FIJO, no proporcional a la celda: es una marca de dirección, y una marca que
# crece con su contenedor deja de leerse como marca.
.T2B_TRIANGULO_ANCHO_IN <- 0.24
.T2B_TRIANGULO_ALTO_IN  <- 0.07

#' Triángulo de tendencia.
#'
#' Trabaja en npc pero convierte desde pulgadas por eje: npc en X y en Y NO son
#' la misma escala física, y derivar el ancho del alto en npc pinta un
#' triángulo tan ancho como la mitad de la lámina (visto en la primera corrida).
#' @noRd
.t2b_triangulo <- function(x, y, direccion, w_total_in = 13.33, h_total_in = 7.5) {
  w_total_in <- suppressWarnings(as.numeric(w_total_in)[1])
  h_total_in <- suppressWarnings(as.numeric(h_total_in)[1])
  if (!is.finite(w_total_in) || w_total_in <= 0) w_total_in <- 13.33
  if (!is.finite(h_total_in) || h_total_in <= 0) h_total_in <- 7.5

  w <- .T2B_TRIANGULO_ANCHO_IN / w_total_in
  h <- .T2B_TRIANGULO_ALTO_IN / h_total_in
  col <- as.character(.t2b_pick(.T2B_TENDENCIA_COLORES, direccion, 1L, "#7A7A7A"))
  yy <- if (identical(direccion, "sube")) c(y + h, y, y) else c(y - h, y, y)
  cowplot::draw_grob(
    grid::polygonGrob(
      x = grid::unit(c(x, x - w / 2, x + w / 2), "npc"),
      y = grid::unit(yy, "npc"),
      gp = grid::gpar(fill = col, col = NA)
    )
  )
}
