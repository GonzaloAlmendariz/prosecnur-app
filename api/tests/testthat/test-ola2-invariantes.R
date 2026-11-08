# Ola 2, invariante de los arreglos E1a, E1b, E2a, E2b, E3 y E4: tocan la geometría de las cifras (dónde van, de qué
# color, con qué cuerpo, con qué guía) y el texto del saldo, nunca los números. Lo que el render publica del gráfico
# —su especificación (`pulso_espec`), los grupos que dibujó (`pulso_barras_series`) y sus casos (`pulso_barras_bases`)—
# tiene que salir idéntico antes y después, para los mismos fixtures de los test-ola2-*.R.
#
# Los valores esperados son los del render de 001de8b75 al escribir este test, como literales: cada doble con el
# decimal más corto que el parser de R devuelve idéntico, o en hex cuando ninguno lo hace (`expect_identical` exacto);
# no hay golden aparte. Si un arreglo los mueve, el cambio es de
# números y no de geometría: se discute antes de tocar estos literales.

# Los atributos que el arreglo no puede mover, caso por caso (el mismo fixture de cada test-ola2-*.R).
.ola2_inv_attrs <- function(p) {
  list(pulso_espec = attr(p, "pulso_espec", exact = TRUE),
       pulso_barras_series = attr(p, "pulso_barras_series", exact = TRUE),
       pulso_barras_bases = attr(p, "pulso_barras_bases", exact = TRUE))
}

.ola2_inv_casos <- function() {
  out <- list()
  # E2b: agrupada con cruce 10x4 a 6 in, llamada directa al graficador.
  set.seed(2)
  cats <- paste("Opción", LETTERS[1:10])
  df <- data.frame(categoria = cats, N = 400, pct_1 = runif(10, .3, .6), pct_2 = runif(10, .3, .6),
                   pct_3 = runif(10, .3, .6), pct_4 = runif(10, .3, .6))
  out$e2b <- .ola2_inv_attrs(suppressMessages(suppressWarnings(graficar_barras_agrupadas(
    data = df, var_categoria = "categoria", var_n = "N", cols_porcentaje = paste0("pct_", 1:4),
    etiquetas_series = c(pct_1 = "G1", pct_2 = "G2", pct_3 = "G3", pct_4 = "G4"),
    usar_canvas = TRUE, orientacion = "horizontal", ancho = 12.5, alto = 6, exportar = "rplot"))))
  # E1a: divergente con la escala declarada positivo->negativo, por el render del plan.
  .tab_freq <- function(ref, filtros = list()) {
    data.frame(Opciones = c("Totalmente de acuerdo", "De acuerdo", "En desacuerdo", "Totalmente en desacuerdo", "Total"),
               n = c(30, 40, 20, 10, 100), stringsAsFactors = FALSE)
  }
  out$e1a <- .ola2_inv_attrs(suppressMessages(suppressWarnings(.render_barras_divergentes(
    p_barras_divergentes(vars = "p1", n_negativas = 2, incluir_neutro = FALSE, mostrar_saldo = FALSE,
                         direccion_escala = "positivo_negativo")))))
  # E3: saldo con 0 y 1 decimales.
  et <- c(td = "Totalmente en desacuerdo", ed = "En desacuerdo", da = "De acuerdo", ta = "Totalmente de acuerdo", si = "SIN INF")
  d3 <- data.frame(item = "P", td = 2.64, ed = 7.74, da = 75.36, ta = 9.04, si = 5.22, stringsAsFactors = FALSE)
  for (dec in 0:1) {
    out[[paste0("e3_dec", dec)]] <- .ola2_inv_attrs(graficar_barras_divergentes(
      d3, "item", names(et), etiquetas_grupos = et, n_negativas = 2, incluir_neutro = FALSE, valores_decimales = dec,
      mostrar_saldo = TRUE))
  }
  # E4, E2a y E1b: las láminas de dos gráficos en vertical, por el plan (solo_lista).
  fx <- .ola2_familias()
  t2 <- list(top2box_labels = c("De acuerdo", "Totalmente de acuerdo"))
  r <- .ola2_lista(fx, list(p_slide_2_graficos_vertical(
    titulo = "2 vertical apilada", superior = p_barras_agrupadas(var = "doc$p18"),
    inferior = p_barras_apiladas(var = "doc$q19", cruces = "doc$ded", overrides = t2))))
  out$e4_superior <- .ola2_inv_attrs(r[[1]]); out$e4_inferior <- .ola2_inv_attrs(r[[2]])
  r <- .ola2_lista(fx, list(p_slide_2_graficos_vertical(
    titulo = "Agrupada mixta", superior = p_barras_agrupadas(var = "doc$cat6", cruces = "doc$sx"),
    inferior = p_barras_agrupadas(var = "doc$q19", cruces = "doc$ded"))))
  out$e2a_superior <- .ola2_inv_attrs(r[[1]]); out$e2a_inferior <- .ola2_inv_attrs(r[[2]])
  r <- .ola2_lista(.ola2_e1b(), list(p_slide_2_graficos_vertical(
    titulo = "Divergente chica",
    superior = p_barras_divergentes(vars = c("doc$q1", "doc$q2"), n_negativas = 2, incluir_neutro = FALSE),
    inferior = p_barras_agrupadas(var = "doc$q1"))))
  out$e1b_superior <- .ola2_inv_attrs(r[[1]]); out$e1b_inferior <- .ola2_inv_attrs(r[[2]])
  out
}

.ola2_inv_esperado <- list(
  "e2b" = list(pulso_espec = NULL, pulso_barras_series = NULL, pulso_barras_bases = NULL),
  "e1a" = list(pulso_espec = list(version = "divergentes/1", tipo = "divergentes", filas = "p1", categorias = structure(list(
        col = c("niv_1", "niv_2", "niv_3", "niv_4"), rotulo = c("Totalmente de acuerdo", "De acuerdo", "En desacuerdo", 
        "Totalmente en desacuerdo"), color = c("#70AD47", "#ADD493", "#FFD965", "#F4B183"), lado = c("pos", 
        "pos", "neg", "neg")), class = "data.frame", row.names = c(NA, -4L)), orden_neg = 3:4, orden_pos = 2:1, 
        unidades = structure(c(30L, 40L, 20L, 10L), dim = c(1L, 4L)), cifras = structure(c("30%", "40%", 
        "20%", "10%"), dim = c(1L, 4L)), total_neg = 3e+01, total_pos = 7e+01, cifras_neg = "30%", 
        cifras_pos = "70%", decimales = 0L, proporciones = structure(c(0.3, 0.4, 
        0.2, 0.1), dim = c(1L, 4L)), n = 1e+02, n_casos = NA_real_, 
        estilo = "recetario"), pulso_barras_series = NULL, pulso_barras_bases = NULL),
  "e3_dec0" = list(pulso_espec = list(version = "divergentes/1", tipo = "divergentes", filas = "P", categorias = structure(list(
        col = c("td", "ed", "da", "ta", "si"), rotulo = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", 
        "Totalmente de acuerdo", "SIN INF"), color = c("#F4B183", "#FFD965", "#ADD493", "#70AD47", "#BFBFBF"
        ), lado = c("neg", "neg", "pos", "pos", "sin_inf")), class = "data.frame", row.names = c(NA, -5L)), 
        orden_neg = 2:1, orden_pos = 3:4, unidades = structure(c(3L, 8L, 75L, 9L, 5L), dim = c(1L, 5L)), 
        cifras = structure(c("3%", "8%", "75%", "9%", "5%"), dim = c(1L, 5L)), total_neg = 11, total_pos = 84, 
        cifras_neg = "11%", cifras_pos = "84%", decimales = 0L, proporciones = structure(c(0.0264, 
        0.0774, 0.7536, 0.0904, 0x1.ab9f559b3d07cp-5), dim = c(1L, 
        5L)), estilo = "recetario"), pulso_barras_series = NULL, pulso_barras_bases = NULL),
  "e3_dec1" = list(pulso_espec = list(version = "divergentes/1", tipo = "divergentes", filas = "P", categorias = structure(list(
        col = c("td", "ed", "da", "ta", "si"), rotulo = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", 
        "Totalmente de acuerdo", "SIN INF"), color = c("#F4B183", "#FFD965", "#ADD493", "#70AD47", "#BFBFBF"
        ), lado = c("neg", "neg", "pos", "pos", "sin_inf")), class = "data.frame", row.names = c(NA, -5L)), 
        orden_neg = 2:1, orden_pos = 3:4, unidades = structure(c(26L, 77L, 754L, 90L, 52L), dim = c(1L, 5L
        )), cifras = structure(c("2.6%", "7.7%", "75.4%", "9.0%", "5.2%"), dim = c(1L, 5L)), total_neg = 103, 
        total_pos = 844, cifras_neg = "10.3%", cifras_pos = "84.4%", decimales = 1L, proporciones = structure(c(0.0264, 
        0.0774, 0.7536, 0.0904, 0x1.ab9f559b3d07cp-5), dim = c(1L, 
        5L)), estilo = "recetario"), pulso_barras_series = NULL, pulso_barras_bases = NULL),
  "e4_superior" = list(pulso_espec = list(version = "categorica/1", tipo = "categorica", rotulos = c("Sí", "No"), valores = c(0.8181818181818182, 
    0x1.745d1745d1746p-3), largos = c(0.82, 0.18), cifras = c("82%", "18%"
    ), n = c(63, 14), n_casos = c(63, 14), n_base_casos = 77, casos_mostrar = FALSE, 
        realce = FALSE, resaltar = character(0), residuales_gris = FALSE, escala_completa = TRUE, marcas_eje = FALSE, 
        colorear_por_opcion = FALSE, pista = "auto", redondeo = list(metodo = "estandar", decimales = 0L), 
        n_base_pond = 77), pulso_barras_series = "Porcentaje", pulso_barras_bases = structure(numeric(0), names = character(0))),
  "e4_inferior" = list(pulso_espec = list(version = "escala/1", tipo = "escala", categorias = structure(list(col = c("pct_1", 
    "pct_2", "pct_3", "pct_4", "pct_5"), rotulo = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", 
    "Totalmente de acuerdo", "SIN INF"), color = c("#F4B183", "#FFD965", "#ADD493", "#70AD47", "#8A93A8"), 
        especial = c(FALSE, FALSE, FALSE, FALSE, TRUE)), class = "data.frame", row.names = c(NA, -5L)), leyenda = 1:5, 
        filas = structure(list(id = c("Tiempo completo (TC)", "Tiempo parcial por asignaturas (TPA)"), rotulo = c("Tiempo completo (TC)", 
        "Tiempo parcial por asignaturas (TPA)"), grupo_id = c(NA_character_, NA_character_), grupo_titulo = c(NA_character_, 
        NA_character_), n = c(23, 54), n_casos = c(23, 54), es_total = c(FALSE, FALSE
        )), class = "data.frame", row.names = c(NA, -2L)), unidades = structure(c(0L, 4L, 9L, 7L, 87L, 70L, 
        4L, 11L, 0L, 7L), dim = c(2L, 5L), dimnames = list(c("Tiempo completo (TC)", "Tiempo parcial por asignaturas (TPA)"
        ), c("pct_1", "pct_2", "pct_3", "pct_4", "pct_5"))), cifras = structure(c("0%", "4%", "9%", "7%", 
        "87%", "70%", "4%", "11%", "0%", "7%"), dim = c(2L, 5L), dimnames = list(c("Tiempo completo (TC)", 
        "Tiempo parcial por asignaturas (TPA)"), c("pct_1", "pct_2", "pct_3", "pct_4", "pct_5"))), anchos = structure(c(0, 
        0.04040404040404041, 0.09, 0.0707070707070707, 0.87, 0.7070707070707071, 
        0.04, 0.1111111111111111, 0, 0.0707070707070707), dim = c(2L, 5L), dimnames = list(
            c("Tiempo completo (TC)", "Tiempo parcial por asignaturas (TPA)"), c("pct_1", "pct_2", "pct_3", 
            "pct_4", "pct_5"))), dibujar = structure(c(FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, 
        TRUE), dim = c(2L, 5L), dimnames = list(c("Tiempo completo (TC)", "Tiempo parcial por asignaturas (TPA)"
        ), c("pct_1", "pct_2", "pct_3", "pct_4", "pct_5"))), box = list(preset = "top2box", rotulo = "Top Two Box", 
            cols = c("pct_3", "pct_4"), unidades = c("Tiempo completo (TC)" = 91, "Tiempo parcial por asignaturas (TPA)" = 81
            ), cifras = c("91%", "81%"), casos = c(21, 44), motivo = NULL), box2 = NULL, orden = list(
            criterio = "declarado", origen = 1:2, aplicado = 1:2, invertir = FALSE), redondeo = list(metodo = "estandar", 
            decimales = 0L), proporciones = structure(c(0, 0.037037037037037035, 0.08695652173913043, 
        0.07407407407407407, 0.8695652173913043, 0.7037037037037037, 0.043478260869565216, 0.1111111111111111, 
        0, 0.07407407407407407), dim = c(2L, 5L), dimnames = list(c("Tiempo completo (TC)", "Tiempo parcial por asignaturas (TPA)"
        ), c("pct_1", "pct_2", "pct_3", "pct_4", "pct_5"))), mostrar_respuestas = FALSE, filete_temas = FALSE, 
        premisa_posicion = "auto"), pulso_barras_series = NULL, pulso_barras_bases = NULL),
  "e2a_superior" = list(pulso_espec = NULL, pulso_barras_series = c("Mujer", "Hombre"), pulso_barras_bases = c(Mujer = 4e+01, 
    Hombre = 37)),
  "e2a_inferior" = list(pulso_espec = NULL, pulso_barras_series = c("Tiempo completo (TC)", "Tiempo parcial por asignaturas (TPA)"
    ), pulso_barras_bases = c("Tiempo completo (TC)" = 23, "Tiempo parcial por asignaturas (TPA)" = 54
    )),
  "e1b_superior" = list(pulso_espec = list(version = "divergentes/1", tipo = "divergentes", filas = c("Pregunta dos", "Pregunta uno"
    ), categorias = structure(list(col = c("niv_1", "niv_2", "niv_3", "niv_4", "niv_5"), rotulo = c("Totalmente en desacuerdo", 
    "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF"), color = c("#F4B183", "#FFD965", "#ADD493", 
    "#70AD47", "#BFBFBF"), lado = c("neg", "neg", "pos", "pos", "sin_inf")), class = "data.frame", row.names = c(NA, 
    -5L)), orden_neg = 2:1, orden_pos = 3:4, unidades = structure(c(2L, 4L, 6L, 5L, 71L, 78L, 15L, 4L, 6L, 
    9L), dim = c(2L, 5L)), cifras = structure(c("2%", "4%", "6%", "5%", "71%", "78%", "15%", "4%", "6%", 
    "9%"), dim = c(2L, 5L)), total_neg = c(8, 9), total_pos = c(86, 82), cifras_neg = c("8%", 
    "9%"), cifras_pos = c("86%", "82%"), decimales = 0L, proporciones = structure(c(0.02, 
    0.04, 0.06, 0.05, 0.71, 0.78, 
    0.15, 0.04, 0.06, 0.09), dim = c(2L, 
    5L)), n = c(2e+02, 2e+02), n_casos = c(2e+02, 2e+02), estilo = "recetario"), pulso_barras_series = NULL, 
        pulso_barras_bases = NULL),
  "e1b_inferior" = list(pulso_espec = list(version = "categorica/1", tipo = "categorica", rotulos = c("Totalmente en desacuerdo", 
    "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF"), valores = c(0.04, 
    0.05, 0.78, 0.04, 0.09), largos = c(0.04, 
    0.05, 0.78, 0.04, 0.09), cifras = c("4%", 
    "5%", "78%", "4%", "9%"), n = c(8, 1e+01, 156, 8, 18), n_casos = c(8, 1e+01, 
    156, 8, 18), n_base_casos = 2e+02, casos_mostrar = FALSE, realce = FALSE, resaltar = character(0), 
        residuales_gris = FALSE, escala_completa = TRUE, marcas_eje = FALSE, colorear_por_opcion = FALSE, 
        pista = "auto", redondeo = list(metodo = "estandar", decimales = 0L), n_base_pond = 2e+02), pulso_barras_series = "Porcentaje", 
        pulso_barras_bases = structure(numeric(0), names = character(0)))
)


test_that("invariante ola 2: espec, series y bases del render no se mueven", {
  skip_if_not_installed("ggplot2"); skip_if_not_installed("cowplot")
  vals <- .ola2_inv_casos()
  expect_identical(names(vals), names(.ola2_inv_esperado))
  for (k in names(.ola2_inv_esperado)) {
    for (a in c("pulso_espec", "pulso_barras_series", "pulso_barras_bases")) {
      expect_identical(vals[[k]][[a]], .ola2_inv_esperado[[k]][[a]], label = sprintf("%s$%s", k, a))
    }
  }
})
