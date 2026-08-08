source("setup-load-all.R")

# Medido con `debug_ph_bordes` sobre el mazo de equivalencias: el hueco de la
# lamina mide 6 pulgadas de alto y el canvas se armaba con 3.56, asi que el 41 %
# quedaba en blanco bajo el grafico. De ese sobrante, la leyenda se llevaba 0.75
# fijas para dibujar UNA linea de texto.

test_that("la banda de leyenda mide lo que sus filas, no un fijo", {
  escala <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo",
              "Totalmente de acuerdo", "SIN INF")
  # Ancha: la escala entra en una fila y la banda es minima.
  expect_equal(.barras_leyenda_filas(escala, 9, 12.5), 1L)
  ancha <- .barras_leyenda_alto_in(escala, 9, 12.5)
  # Estrecha: la misma escala necesita mas filas y la banda crece con ellas.
  estrecha <- .barras_leyenda_alto_in(escala, 9, 4)
  expect_gt(.barras_leyenda_filas(escala, 9, 4), 1L)
  expect_gt(estrecha, ancha)
  # Y en el caso ancho es bastante menor que el fijo que habia (0.75).
  expect_lt(ancha, 0.5)

  # Sin leyenda no hay banda.
  expect_equal(.barras_leyenda_alto_in(character(0), 9, 12.5), 0)
})

test_that("el sobrante del hueco fisico engorda las filas, con tope", {
  # 5 filas de 0.478 = 2.39 de panel en un hueco de 6: sobran casi dos pulgadas y
  # media. Se reparten a las filas.
  ajustado <- .barras_alto_fila_ajustado(0.478, 5, alto_fisico_in = 6,
                                         alto_fijo_in = 0.32 + 0.85)
  expect_gt(ajustado, 0.478)
  # El tope existe porque una lamina de dos barras estirada a pantalla completa
  # se lee como un error de maquetacion, no como un grafico.
  expect_lte(ajustado, .BARRAS_ALTO_FILA_MAX_IN)
  expect_equal(.barras_alto_fila_ajustado(0.478, 2, 6, 1.17), .BARRAS_ALTO_FILA_MAX_IN)
})

test_that("solo se crece: un hueco chico no aprieta las barras dos veces", {
  # Si el hueco es menor que el contenido, el canvas ya se encoge al colocarse.
  expect_equal(.barras_alto_fila_ajustado(0.60, 10, alto_fisico_in = 2), 0.60)
  # Y una entrada invalida devuelve lo que habia, en vez de tumbar el dibujo.
  expect_equal(.barras_alto_fila_ajustado(0.48, 5, alto_fisico_in = NA), 0.48)
  expect_equal(.barras_alto_fila_ajustado(0.48, 0, alto_fisico_in = 6), 0.48)
})

# ---------------------------------------------------------------------------
# La banda de leyenda tiene que medir lo que el DIBUJO va a usar.
# ---------------------------------------------------------------------------
#
# El reparto real trabaja en coordenadas normalizadas: parte de
# `legend_n_por_fila` items por fila y lo baja de uno en uno hasta que ninguna
# fila pasa del 96 % del ancho. Estimar con otro modelo se equivoca en el unico
# caso que importa —el limite entre una fila y dos— y ahi la banda se dimensiona
# para una mientras el dibujo pinta dos: `row_h` se parte a la mitad, los
# cuadritos colapsan y la segunda fila se monta sobre la primera.

# Replica del reparto del dibujo, para contrastar contra la estimacion.
.leyenda_filas_del_dibujo <- function(etiquetas, size_pt, ancho_in,
                                      key_cm = 0.34, gap_npc = 0.018,
                                      aspect_yx = 0.6, n_por_fila = 6L) {
  n <- length(etiquetas)
  key_side <- max(0.034, key_cm * 0.11)
  key_w <- key_side * aspect_yx
  key_gap <- min(0.012, max(0.007, gap_npc * 0.60))
  slot_gap <- min(0.040, max(0.026, gap_npc * 1.80))
  tw <- pmax(0.016, nchar(etiquetas, type = "width") * size_pt * 0.52 / 72 / ancho_in)
  item <- key_w + key_gap + tw
  por <- min(max(1L, n_por_fila), n)
  repeat {
    filas <- ceiling(n / por)
    ids <- ceiling(seq_len(n) / por)
    anchos <- vapply(seq_len(filas), function(r) {
      i <- which(ids == r)
      sum(item[i]) + slot_gap * max(0L, length(i) - 1L)
    }, numeric(1))
    if (por <= 1L || max(anchos) <= 0.96) break
    por <- por - 1L
  }
  as.integer(filas)
}

test_that("la estimacion de filas coincide con el reparto del dibujo", {
  casos <- list(
    list(lv = c("Sí", "No"), ancho = 12.5),
    list(lv = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo",
                "Totalmente de acuerdo", "SIN INF"), ancho = 12.5),
    # Siete categorias largas: el caso que se rompia. Estimaba 1, dibujaba 2.
    list(lv = c("Totalmente en desacuerdo", "En desacuerdo",
                "Ni de acuerdo ni en desacuerdo", "De acuerdo",
                "Totalmente de acuerdo", "Prefiero no responder",
                "SIN INFORMACIÓN"), ancho = 12.5),
    # Lienzo estrecho: hasta una escala corta necesita mas de una fila.
    list(lv = c("Muy malo", "Malo", "Regular", "Bueno", "Muy bueno"), ancho = 4),
    list(lv = c("A", "B", "C"), ancho = 12.5)
  )
  for (caso in casos) {
    estimadas <- .barras_leyenda_filas(caso$lv, 9, caso$ancho)
    dibujadas <- .leyenda_filas_del_dibujo(caso$lv, 9, caso$ancho)
    expect_equal(estimadas, dibujadas,
                 info = sprintf("%d categorias en %s in", length(caso$lv), caso$ancho))
  }
})

test_that("la banda crece con las filas, y nunca queda por debajo de una", {
  largas <- c("Totalmente en desacuerdo", "En desacuerdo",
              "Ni de acuerdo ni en desacuerdo", "De acuerdo",
              "Totalmente de acuerdo", "Prefiero no responder", "SIN INFORMACIÓN")
  cortas <- c("Sí", "No")
  expect_equal(.barras_leyenda_filas(largas, 9, 12.5), 2L)
  expect_gt(.barras_leyenda_alto_in(largas, 9, 12.5),
            .barras_leyenda_alto_in(cortas, 9, 12.5))
  # Dos filas necesitan mas del doble del minimo de una: si la banda se quedara
  # en el minimo, `row_h` se partiria y los cuadritos colapsarian.
  expect_gt(.barras_leyenda_alto_in(largas, 9, 12.5), 0.5)
})

# ---------------------------------------------------------------------------
# Donde queda el aire, y cuanto ancho se lleva el rotulo.
# ---------------------------------------------------------------------------

test_that("el sobrante vertical va abajo, no repartido en dos bandas", {
  # Con una sola barra, dos margenes iguales dejaban el grafico como una tira
  # flotando en el centro: canvas de 3.37 pulgadas en un hueco de 6, con 1.3 de
  # aire por lado. Se lee como un error de maquetacion.
  #
  # El grosor NO se toca: el ADR 0065 existe para que una barra mida lo mismo en
  # la lamina 3 y en la 30. Lo que cambia es donde queda el aire.
  sobrante <- 0.44
  arriba <- .barras_pad_superior(sobrante)
  expect_lt(arriba, sobrante / 2)
  expect_gt(arriba, 0)
  # Sin sobrante no hay margen que repartir.
  expect_equal(.barras_pad_superior(0), 0)
  expect_equal(.barras_pad_superior(NA), 0)
})

test_that("el canal del rotulo se mide por su texto, no por un fijo", {
  # El defecto era 0.38 —el 38 % del ancho— fuera cual fuera el largo. En una
  # lamina cuyo eje dice una frase corta eso es cuatro veces lo necesario, y ese
  # ancho se lo quita a las barras, que son el dato.
  corta <- .barras_ancho_etiquetas("Docentes", 9, 12.5)
  frase <- .barras_ancho_etiquetas("Indique el sueldo mensual bruto que percibe.", 9, 12.5)
  expect_lt(corta, frase)
  expect_lt(frase, 0.38)

  # Acotado por los dos lados: por abajo para que el rotulo no toque la barra,
  # por arriba para que un parrafo no se coma la lamina —ahi lo que toca es
  # envolver el texto, no seguir cediendo ancho—.
  expect_gte(corta, .BARRAS_ETQ_MIN_NPC)
  expect_lte(.barras_ancho_etiquetas(paste(rep("palabra", 40), collapse = " "), 9, 12.5),
             .BARRAS_ETQ_MAX_NPC)

  # Un texto ya envuelto se mide por su linea mas larga, no por el total.
  expect_lt(.barras_ancho_etiquetas("Indique el sueldo mensual\nbruto que percibe.", 9, 12.5), frase)

  # Sin etiquetas, el minimo.
  expect_equal(.barras_ancho_etiquetas(character(0), 9, 12.5), .BARRAS_ETQ_MIN_NPC)
})

test_that("un ancho declarado por la lamina o el preset manda sobre la medida", {
  # `missing()` responde la pregunta correcta —si lo declararon— sin anadir una
  # bandera que haya que mantener sincronizada. El preset multiactor declara
  # 0.17 y tiene que conservarlo.
  fml <- names(formals(graficar_barras_apiladas))
  expect_true("canvas_w_etiquetas" %in% fml)
  expect_false("canvas_w_etiquetas_auto" %in% fml)
  expect_equal(.reporte_plan_multiactor_canvas_defaults()$canvas_w_etiquetas, 0.17)
})
