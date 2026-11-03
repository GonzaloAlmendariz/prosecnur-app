source("setup-load-all.R")

# ADR 0126: regla del estudio, BH del informe, umbral, base mínima, complementos, «No sé» fuera de la prueba y frágiles.

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

test_that("ninguna diferencia: la nota dice las cifras extremas en vez de callar", {
  f <- .fixture_dos_grupos(0.40, 0.38)
  ev <- .sig_veredictos(.sig_evaluar(.ind_de(list(Si = f$y)), f$g, c("A", "B"), c("Mujer", "Hombre"), cluster = f$aula,
                                     regla = .regla_test(), filas = "Si"), .regla_test())
  expect_equal(.sig_estado(ev), "ninguna")
  expect_match(.nota_plana(ev, .regla_test()), "el 40% de Mujer y el 38% de Hombre no se distinguen")
})
