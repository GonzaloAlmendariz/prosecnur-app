source("setup-load-all.R")

# ADR 0128: regla del estudio, BH del informe, umbral, base mínima, complementos, «No sé» fuera de la prueba y frágiles.

# La nota envuelve sus líneas para el caption del Word; para comparar el texto se aplana.
.nota_plana <- function(ev, regla) gsub("\\s+", " ", .sig_nota_de_evaluacion(ev, regla))

.regla_test <- function(...) {
  r <- .sig_regla_normalizar(list(prueba = "rao_scott", correccion = "bonferroni_fila", conglomerado = "aula"))
  modifyList(r, list(...))
}

.ind_de <- function(y_lista) {
  Y <- do.call(cbind, y_lista)
  list(Y = Y, codigos = stats::setNames(as.list(colnames(Y)), colnames(Y)), tipo = "so", w = rep(1, nrow(Y)),
       en_base = rep(TRUE, nrow(Y)))
}

# Dos grupos de 200 casos repartidos en 40 aulas (20 por grupo, sin aulas compartidas).
.fixture_dos_grupos <- function(p_a, p_b, n = 200, aulas = 20, seed = 7) {
  set.seed(seed)
  ya <- as.numeric(seq_len(n) <= round(p_a * n))[sample(n)]
  yb <- as.numeric(seq_len(n) <= round(p_b * n))[sample(n)]
  list(y = c(ya, yb), g = rep(c("A", "B"), each = n),
       aula = c(paste0("a", rep(seq_len(aulas), length.out = n)), paste0("b", rep(seq_len(aulas), length.out = n))))
}

test_that("la regla normaliza a opciones cerradas y no inventa un nivel libre", {
  r <- .sig_regla_normalizar(list(alfa = 0.07, umbral_puntos = 12, base_minima = 25, prueba = "otra"))
  expect_equal(r$alfa, 0.05)
  expect_equal(r$umbral_puntos, 10)
  expect_equal(r$base_minima, 20)
  expect_equal(r$prueba, "z")
})

test_that("con una columna de aula la regla propone Rao-Scott y BH; sin ella, la prueba de siempre", {
  con <- .sig_regla_propuesta(data.frame(aula = c("a", "b"), x = 1:2))
  expect_equal(con$prueba, "rao_scott"); expect_equal(con$correccion, "bh_informe"); expect_equal(con$conglomerado, "aula")
  sin <- .sig_regla_propuesta(data.frame(x = 1:2))
  expect_equal(sin$prueba, "z"); expect_equal(sin$correccion, "bonferroni_fila")
})

test_that("migración: sin regla guardada, el significancia_alpha de una lámina siembra el alfa y nunca se escribe", {
  cfg <- list(plan = list(slides = list(list(id = "s1", payload = list(grafico = list(
    graficador = "p_barras_agrupadas", args = list(var = "p1", cruces = "g", significancia_alpha = 0.01)))))))
  rr <- .sig_regla_del_estudio(cfg, data.frame(aula = "a"))
  expect_equal(rr$origen, "propuesta")
  expect_equal(rr$regla$alfa, 0.01)
  cfg$significancia <- list(alfa = 0.1, prueba = "z")
  expect_equal(.sig_regla_del_estudio(cfg)$regla$alfa, 0.1)
})

test_that("Rao-Scott sin la columna de conglomerado es E_SIG_SIN_CONGLOMERADO", {
  expect_error(.sig_regla_validar_base(.regla_test(conglomerado = "aula"), data.frame(x = 1)),
               class = "api_error")
})

test_that("BH del informe: el q de cada p es el de p.adjust sobre la familia", {
  set.seed(11)
  p <- c(stats::runif(200), 10^-(1:20))
  tabla <- .sig_bh_tabla(p)
  expect_equal(.sig_bh_q(p, tabla), stats::p.adjust(p, "BH"), tolerance = 1e-12)
})

test_that("umbral de magnitud: significativa pero de menos de 10 puntos queda bajo_umbral", {
  f <- .fixture_dos_grupos(0.58, 0.50, n = 3000, aulas = 300)
  ev <- .sig_evaluar(.ind_de(list(Si = f$y)), f$g, c("A", "B"), c("Grupo A", "Grupo B"), cluster = f$aula,
                     regla = .regla_test(), filas = "Si")
  ev <- .sig_veredictos(ev, .regla_test())
  expect_equal(ev$pares$veredicto, "bajo_umbral")
  expect_null(ev$marcas)
})

test_that("frágil: p ajustado entre 0.01 y alfa con diferencia grande; marcada si es menor que 0.01", {
  f <- .fixture_dos_grupos(0.60, 0.30)
  ev <- .sig_veredictos(.sig_evaluar(.ind_de(list(Si = f$y)), f$g, c("A", "B"), cluster = f$aula,
                                     regla = .regla_test(), filas = "Si"), .regla_test())
  expect_equal(ev$pares$veredicto, "marcada")
  expect_equal(ev$marcas$letras, "B"); expect_equal(ev$marcas$grupo, "A"); expect_false(ev$marcas$fragil)

  # El mismo par con p ajustado forzado al rango frágil.
  ev2 <- .sig_evaluar(.ind_de(list(Si = f$y)), f$g, c("A", "B"), cluster = f$aula, regla = .regla_test(), filas = "Si")
  ev2$pares$p <- 0.03
  ev2 <- .sig_veredictos(ev2, .regla_test())
  expect_equal(ev2$pares$veredicto, "fragil")
  expect_true(ev2$marcas$fragil)
  expect_equal(ev2$marcas$flecha, "△")
  expect_match(.nota_plana(ev2, .regla_test()), "Frágil: igual, con p ajustado entre 0.01 y 0.05")
  oculta <- .sig_veredictos(ev2, .regla_test(fragiles = "ocultar"))
  expect_null(oculta$marcas)
})

test_that("base mínima: un grupo con menos de 30 casos no se compara, ni sirve de referencia, y se dice", {
  f <- .fixture_dos_grupos(0.60, 0.10, n = 200)
  chico <- c(which(f$g == "A"), which(f$g == "B")[1:20])
  ev <- .sig_veredictos(.sig_evaluar(.ind_de(list(Si = f$y[chico])), f$g[chico], c("A", "B"), c("Grande", "Chico"),
                                     cluster = f$aula[chico], regla = .regla_test(), filas = "Si"), .regla_test())
  expect_equal(ev$pares$veredicto, "no_comparable")
  expect_false(ev$grupos$comparable[ev$grupos$codigo == "B"])
  expect_match(ev$grupos$motivo[ev$grupos$codigo == "B"], "n = 20")
  expect_match(.nota_plana(ev, .regla_test()), "Con trama: Chico")
})

test_that("conglomerados mínimos: con menos de 8 aulas el grupo no se compara aunque tenga casos", {
  f <- .fixture_dos_grupos(0.60, 0.10, n = 200, aulas = 5)
  ev <- .sig_evaluar(.ind_de(list(Si = f$y)), f$g, c("A", "B"), cluster = f$aula, regla = .regla_test(), filas = "Si")
  expect_false(any(ev$grupos$comparable))
  expect_match(ev$grupos$motivo[1], "5 aulas")
})

test_that("complementos: en una dicotómica solo se prueba la opción principal; «No sé» queda fuera de la prueba", {
  r <- .regla_test()
  expect_equal(.sig_filas_a_probar(c("Sí", "No"), regla = r, solo_principal = TRUE), "Sí")
  expect_equal(.sig_filas_a_probar(c("Sí", "No"), regla = r, solo_principal = FALSE), c("Sí", "No"))
  expect_equal(.sig_filas_a_probar(c("Sí", "No", "No sé"), regla = r, solo_principal = TRUE), "Sí")
  expect_equal(.sig_filas_a_probar(c("A", "B", "No tengo información suficiente", "Otro"), regla = r), c("A", "B"))
  expect_equal(.sig_filas_a_probar(c("A", "No sé"), regla = .regla_test(incluir_ns = TRUE)), c("A", "No sé"))
})

test_that("con más de seis grupos la marca es ▲▼ frente al resto (D7)", {
  set.seed(5)
  g <- rep(LETTERS[1:7], each = 120)
  y <- as.numeric(stats::runif(length(g)) < ifelse(g == "A", 0.8, ifelse(g == "G", 0.1, 0.4)))
  ev <- .sig_veredictos(.sig_evaluar(.ind_de(list(Si = y)), g, LETTERS[1:7], regla = .regla_test(conglomerado = NULL,
                                     prueba = "z"), filas = "Si"), .regla_test(prueba = "z"))
  expect_equal(ev$modo, "frente_al_resto")
  expect_equal(ev$marcas$flecha[ev$marcas$grupo == "A"], "▲")
  expect_true(ev$marcas$flecha[ev$marcas$grupo == "G"] %in% c("▼", "▽"))
  expect_match(.nota_plana(ev, .regla_test(prueba = "z")), "frente|resto")
})

test_that("ninguna diferencia: la lámina no lleva nota (Gonzalo, RV v7 lámina 32); el texto queda para la UI", {
  f <- .fixture_dos_grupos(0.40, 0.38)
  ev <- .sig_veredictos(.sig_evaluar(.ind_de(list(Si = f$y)), f$g, c("A", "B"), c("Mujer", "Hombre"), cluster = f$aula,
                                     regla = .regla_test(), filas = "Si"), .regla_test())
  expect_equal(.sig_estado(ev), "ninguna")
  expect_false(grepl("no se distinguen|Ninguna diferencia", .nota_plana(ev, .regla_test()) %||% ""))
  expect_match(.sig_texto_ninguna(.regla_test(), 0.40, "Mujer", 0.38, "Hombre"), "el 40% de Mujer y el 38% de Hombre no se distinguen")
})

test_that("la cápsula ▲A es una capa aparte de la cifra, con contorno en la frágil, y no deja cajas vacías", {
  df_lab <- data.frame(categoria = c("a", "a", "b", "b"), .serie = c("A", "B", "A", "B"),
                       .valor_plot = c(0.5, 0.2, 0.3, 0.1), valor_label = c(0.25, 0.22, 0.15, 0.12),
                       inside = c(TRUE, FALSE, TRUE, FALSE), lab = c("50%", "20%", "30%", "10%"),
                       .sig_txt = c("▲B", "", "△B", ""), .sig_fragil = c(FALSE, FALSE, TRUE, FALSE),
                       stringsAsFactors = FALSE)
  p <- ggplot2::ggplot(df_lab, ggplot2::aes(categoria, .valor_plot, fill = .serie)) + ggplot2::geom_col(position = "dodge")
  p2 <- .sig_capa_capsula(p, df_lab, "categoria", 0.8, FALSE, 1, ancho_cifra = rep(0.06, 4), size_texto = 4)
  capas <- Filter(function(l) inherits(l$geom, "GeomLabel"), p2$layers)
  expect_length(capas, 2L)                                  # firmes y frágiles
  expect_equal(sum(!is.na(capas[[1]]$data$.sig_txt)), 1L)   # solo la celda marcada, sin cajas vacías
  expect_identical(capas[[2]]$aes_params$linetype %||% capas[[2]]$geom_params$linetype, "dashed")
  # Sin marcas, el gráfico queda igual.
  expect_identical(.sig_capa_capsula(p, transform(df_lab, .sig_txt = ""), "categoria", 0.8, FALSE, 1, rep(0.06, 4), 4), p)
})

test_that("«Cómo leer las diferencias» se escribe desde la regla del estudio y cambia con ella", {
  rs <- .regla_test(correccion = "bh_informe")
  slide <- list(id = "s5", tipo = "p_slide_texto",
                payload = list(titulo = "Cómo leer las diferencias entre grupos", texto = "prueba z con Bonferroni, 95%"))
  vieja <- .sig_informe_activar(list(regla = rs, familia = NULL)); on.exit(options(vieja), add = TRUE)
  nuevo <- .sig_plan_como_leer(list(slides = list(slide, list(id = "s6", payload = list(titulo = "Otra", texto = "x")))))
  t5 <- nuevo$slides[[1]]$payload$texto
  expect_match(t5, "Rao-Scott")
  expect_match(t5, "Benjamini-Hochberg")
  expect_match(t5, "al menos 10 puntos")
  expect_false(grepl("prueba z", t5))
  expect_identical(nuevo$slides[[2]]$payload$texto, "x")      # las demás láminas no se tocan
  tz <- .sig_texto_como_leer(.regla_test(prueba = "z", fragiles = "ocultar"))
  expect_match(tz, "prueba z")
  expect_false(grepl("Frágil|frágil", tz))
  options(prosecnur.sig_informe = NULL)
  expect_identical(.sig_plan_como_leer(list(slides = list(slide)))$slides[[1]], slide)   # sin regla vigente, intacta
})

test_that("D6: la prueba de tendencia por nivel es opcional y, encendida, dice la dirección en la nota", {
  set.seed(9)
  g <- rep(c("6", "7", "8", "9"), each = 100)
  y <- as.numeric(stats::runif(400) < c(`6` = 0.2, `7` = 0.35, `8` = 0.5, `9` = 0.65)[g])
  apagada <- .sig_veredictos(.sig_evaluar(.ind_de(list(Si = y)), g, c("6", "7", "8", "9"),
                                          regla = .regla_test(prueba = "z", conglomerado = NULL), filas = "Si"),
                             .regla_test(prueba = "z"))
  expect_null(apagada$tendencia)
  expect_false(grepl("Tendencia", .nota_plana(apagada, .regla_test(prueba = "z"))))
  r <- .regla_test(prueba = "z", conglomerado = NULL, tendencia = TRUE)
  ev <- .sig_veredictos(.sig_evaluar(.ind_de(list(Si = y)), g, c("6", "7", "8", "9"), regla = r, filas = "Si"), r)
  expect_equal(ev$tendencia$direccion, "aumenta")
  expect_lt(ev$tendencia$p, 0.001)
  expect_match(.nota_plana(ev, r), "«Si» aumenta con el nivel")
  # Un cruce no ordenado (códigos no numéricos) no lleva prueba de tendencia.
  g2 <- c(A = "x", B = "y", C = "z", D = "w")[match(g, c("6", "7", "8", "9"))]
  ev2 <- .sig_evaluar(.ind_de(list(Si = y)), unname(g2), c("x", "y", "z", "w"), regla = r, filas = "Si")
  expect_null(ev2$tendencia)
})

test_that("geometría de la cápsula (propuesta §4.2): hueco de 0.05 in, márgenes 0.06/0.07 in, alto 1.45 × cuerpo", {
  # Panel de barras de 5 in sobre una escala 0-1: 0.2 unidades de datos por pulgada.
  g <- .sig_capsula_geometria("34%", "△A", size_texto = 14 / ggplot2::.pt, base_max = 1, panel_in = 5)
  expect_equal(g$hueco, 0.05 / 5)
  expect_equal(as.numeric(g$margen[2]), 0.07 * 72)   # derecha, en pt
  expect_equal(as.numeric(g$margen[4]), 0.06 * 72)   # izquierda
  cuerpo <- 14 * 0.8
  expect_equal(as.numeric(g$margen[1]) * 2 + cuerpo, 1.45 * cuerpo, tolerance = 1e-9)
  expect_equal(as.numeric(g$radio), 1.45 * cuerpo / 2)
  expect_gt(g$capsula, (0.06 + 0.07) / 5)            # el texto más los dos márgenes
  # Entre el triángulo y las letras va un espacio fino, no una separación de palabra.
  expect_identical(.sig_capsula_texto("△A"), "△ A")
  expect_identical(.sig_capsula_texto("▲ AB"), "▲ AB")
})
