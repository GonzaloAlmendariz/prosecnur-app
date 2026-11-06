source("setup-load-all.R")

# Fixture sintético (ADR 0127): cada aula pertenece a un solo grupo y la
# proporción de «1» cambia mucho entre aulas. Con 300 personas por grupo la z
# simple ve una diferencia de 15 puntos; con 15 aulas por grupo, el diseño no.
.fixture_aulas <- function() {
  props_x <- rep(c(0.95, 0.25, 0.85, 0.35, 0.75, 0.45, 0.80, 0.40, 0.90, 0.30,
                   0.70, 0.50, 0.65, 0.55, 0.60), 1)
  props_y <- props_x - 0.15
  filas <- function(grupo, props, offset, estr) {
    do.call(rbind, lapply(seq_along(props), function(j) {
      n1 <- round(20 * props[j])
      data.frame(
        aula = sprintf("a%02d", offset + j),
        nivel_curso = estr[(j %% 2) + 1],
        grupo = grupo,
        q = c(rep("1", n1), rep("2", 20 - n1)),
        stringsAsFactors = FALSE
      )
    }))
  }
  d <- rbind(
    filas("x", props_x, 0, c("N1", "N2")),
    filas("y", props_y, 15, c("N1", "N2"))
  )
  d$peso <- 1
  d
}

.spec_diseno <- function(...) {
  .cruces_significancia_normalizar(utils::modifyList(
    list(metodo = "diseno", conglomerado = "aula", estrato = "nivel_curso"),
    list(...)
  ))
}

.letras <- function(d, spec, estratos = c("x", "y")) {
  .cruces_sig_comparar(
    data = d, var = "q", codes_row = c("1", "2"), estratos = estratos,
    var_estrato = "grupo", tp = "so", spec = spec, alpha = 0.05
  )
}

test_that("la normalización cae a los valores por defecto ante basura", {
  s <- .cruces_significancia_normalizar(NULL)
  expect_identical(s$metodo, "simple")
  expect_null(s$conglomerado)
  expect_identical(s$correccion, "bonferroni")
  expect_identical(s$base_minima, 30L)
  expect_identical(s$min_conglomerados, 8L)
  s2 <- .cruces_significancia_normalizar(list(
    metodo = "otro", conglomerado = "  ", correccion = "bh", base_minima = -3
  ))
  expect_identical(s2$metodo, "simple")
  expect_null(s2$conglomerado)
  expect_identical(s2$correccion, "BH")
  expect_identical(s2$base_minima, 30L)
})

test_that("una letra de la z simple desaparece bajo el diseño", {
  d <- .fixture_aulas()
  simple <- .letras(d, .cruces_significancia_normalizar(list(metodo = "simple")))
  diseno <- .letras(d, .spec_diseno())
  expect_identical(simple$method, "z_simple")
  expect_match(simple$letras["1", "x"], "B")
  expect_identical(diseno$method, "diseno")
  expect_identical(diseno$letras["1", "x"], "")
  expect_false(any(diseno$sig))
})

test_that("el error estándar coincide con survey::svyby + svycontrast", {
  skip_if_not_installed("survey")
  d <- .fixture_aulas()
  set.seed(7)
  d$peso <- stats::runif(nrow(d), 0.4, 2.5)
  d$y <- as.numeric(d$q == "1")
  dis <- .cruces_sig_diseno_base(d, .spec_diseno())
  f <- .cruces_sig_diseno_fila(d$y, d$grupo, c("x", "y"), dis)
  des <- survey::svydesign(ids = ~aula, strata = ~nivel_curso, weights = ~peso, data = d)
  b <- survey::svyby(~y, ~grupo, des, survey::svymean, covmat = TRUE)
  ct <- survey::svycontrast(b, c(1, -1))
  expect_equal(unname(f$p[1] - f$p[2]), as.numeric(stats::coef(ct)), tolerance = 1e-8)
  expect_equal(f$se[1], as.numeric(survey::SE(ct)), tolerance = 1e-8)
  # gl del par: 30 aulas menos 2 estratos.
  expect_identical(as.integer(f$gl[1]), 28L)
})

test_that("una columna con menos de 30 casos no recibe letra en ningún modo", {
  d <- .fixture_aulas()
  chica <- data.frame(
    aula = rep(sprintf("z%02d", 1:10), each = 2), nivel_curso = "N1",
    grupo = "z", q = "2", peso = 1, stringsAsFactors = FALSE
  )
  d <- rbind(d, chica)
  for (spec in list(.cruces_significancia_normalizar(list(metodo = "simple")), .spec_diseno())) {
    r <- .letras(d, spec, estratos = c("x", "y", "z"))
    expect_true(all(r$letras[, "z"] == ".b"), info = spec$metodo)
    expect_false(any(grepl("C", r$letras[, c("x", "y")])), info = spec$metodo)
  }
})

test_that("menos de 8 conglomerados deja la columna fuera solo bajo el diseño", {
  d <- .fixture_aulas()
  pocas <- data.frame(
    aula = rep(sprintf("w%02d", 1:4), each = 15), nivel_curso = "N1",
    grupo = "w", q = "2", peso = 1, stringsAsFactors = FALSE
  )
  pocas$q[1:3] <- "1"
  d <- rbind(d, pocas)
  simple <- .letras(d, .cruces_significancia_normalizar(list(metodo = "simple")), c("x", "y", "w"))
  diseno <- .letras(d, .spec_diseno(), c("x", "y", "w"))
  expect_false(any(simple$letras[, "w"] == ".b"))
  expect_true(all(diseno$letras[, "w"] == ".b"))
})

test_that("pesos de expansión y normalizados dan la misma prueba bajo el diseño", {
  d <- .fixture_aulas()
  set.seed(11)
  d$peso <- stats::runif(nrow(d), 0.5, 1.5)
  d$peso <- d$peso / mean(d$peso)
  d_exp <- d
  d_exp$peso <- d$peso * 250
  dis_n <- .cruces_sig_diseno_base(d, .spec_diseno())
  dis_e <- .cruces_sig_diseno_base(d_exp, .spec_diseno())
  y <- as.numeric(d$q == "1")
  fn <- .cruces_sig_diseno_fila(y, d$grupo, c("x", "y"), dis_n)
  fe <- .cruces_sig_diseno_fila(y, d$grupo, c("x", "y"), dis_e)
  expect_equal(fn$p, fe$p, tolerance = 1e-12)
  expect_equal(fn$se, fe$se, tolerance = 1e-12)
  expect_equal(fn$pv, fe$pv, tolerance = 1e-12)
  expect_identical(.letras(d, .spec_diseno())$letras, .letras(d_exp, .spec_diseno())$letras)
})

test_that("un estrato que varía dentro del conglomerado se rechaza con aviso", {
  d <- .fixture_aulas()
  d$nivel_estudiante <- rep(c("N1", "N2"), length.out = nrow(d))
  r <- .letras(d, .spec_diseno(estrato = "nivel_estudiante"))
  expect_identical(r$method, "descriptivo")
  expect_match(r$reason, "Estratos no anidados")
  expect_match(r$reason, "30 conglomerados")
  expect_true(all(r$letras == ""))
})

test_that("la configuración incompleta o una columna ausente no cae a la z simple", {
  d <- .fixture_aulas()
  r1 <- .letras(d, .cruces_significancia_normalizar(list(metodo = "diseno")))
  expect_identical(r1$method, "descriptivo")
  expect_match(r1$reason, "conglomerado")
  r2 <- .letras(d, .spec_diseno(conglomerado = "seccion"))
  expect_match(r2$reason, "«seccion»")
})

test_that("la corrección configurada es la que se aplica", {
  n_mat <- matrix(c(60, 40, 45, 55, 52, 48), nrow = 2,
                  dimnames = list(c("1", "2"), c("x", "y", "z")))
  N_vec <- c(x = 100, y = 100, z = 100)
  pv <- c(
    2 * stats::pnorm(-abs((0.60 - 0.45) / sqrt(0.525 * 0.475 * 0.02))),
    2 * stats::pnorm(-abs((0.60 - 0.52) / sqrt(0.56 * 0.44 * 0.02))),
    2 * stats::pnorm(-abs((0.45 - 0.52) / sqrt(0.485 * 0.515 * 0.02)))
  )
  for (m in c("bonferroni", "holm", "BH")) {
    r <- comparar_columnas_sig(n_mat, N_vec, alpha = 0.10, correccion = m)
    esperado <- stats::p.adjust(pv, method = m)[1] < 0.10
    expect_identical(grepl("B", r$letras["1", "x"]), esperado, info = m)
  }
})

test_that("la nota dice la prueba, el conglomerado, el estrato y la corrección", {
  etq <- function(x) c(aula = "Aula", nivel_curso = "Nivel del curso")[[x]]
  nota <- .cruces_sig_nota(.spec_diseno(correccion = "holm"), alpha = 0.05,
                           metodos = "diseno", etiquetas = etq, ponderado = TRUE)
  expect_match(nota, "bajo el diseño muestral")
  expect_match(nota, "conglomerado Aula")
  expect_match(nota, "estrato Nivel del curso")
  expect_match(nota, "corrección de Holm")
  expect_match(nota, "sin corrección por población finita")
  expect_match(nota, "menos de 30 casos o de 8 conglomerados")
  simple <- .cruces_sig_nota(.cruces_significancia_normalizar(), metodos = "z_simple")
  expect_match(simple, "muestreo aleatorio simple")
  expect_match(simple, "corrección de Bonferroni")
  expect_match(simple, "\"\\.b\" indica una columna con menos de 30 casos")
  abst <- .cruces_sig_nota(.spec_diseno(), metodos = "descriptivo",
                           razones = "Estratos no anidados en los conglomerados")
  expect_match(abst, "^No se asignan letras: Estratos no anidados")
})

test_that("reporte_cruces escribe letras y nota según el método configurado", {
  skip_if_not_installed("readxl")
  d <- .fixture_aulas()
  instrumento <- list(
    survey = data.frame(
      name = c("q", "grupo"), type = c("select_one sn", "select_one gr"),
      label = c("Pregunta", "Grupo"), stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("sn", "sn", "gr", "gr"), name = c("1", "2", "x", "y"),
      label = c("Sí", "No", "Grupo X", "Grupo Y"), stringsAsFactors = FALSE
    )
  )
  leer <- function(significancia) {
    out <- tempfile(fileext = ".xlsx")
    on.exit(unlink(out), add = TRUE)
    reporte_cruces(
      data = d, instrumento = instrumento, SECCIONES = list(General = "q"),
      cruces = "grupo", path_xlsx = out, show_sig = TRUE,
      significancia = significancia
    )
    vals <- as.character(unlist(readxl::read_excel(out, col_names = FALSE), use.names = FALSE))
    vals[!is.na(vals)]
  }
  simple <- leer(NULL)
  diseno <- leer(list(metodo = "diseno", conglomerado = "aula", estrato = "nivel_curso"))
  expect_true(any(trimws(simple) == "B"))
  expect_false(any(trimws(diseno) == "B"))
  nota <- diseno[grepl("Las letras comparan", diseno, fixed = TRUE)]
  expect_length(nota, 1L)
  expect_match(nota, "bajo el diseño muestral, con conglomerado aula, estrato nivel_curso")
  expect_false(grepl(";", nota, fixed = TRUE))
})

test_that("las medias bajo el diseño usan el mismo contraste", {
  d <- .fixture_aulas()
  x <- as.numeric(d$q == "1") * 10
  masks <- list(d$grupo == "x", d$grupo == "y")
  w <- rep(1, nrow(d))
  stats_k <- lapply(masks, function(m) .dim_weighted_stats(x, w, m))
  medias <- vapply(stats_k, `[[`, numeric(1), "mean")
  ns <- vapply(stats_k, `[[`, numeric(1), "n")
  sds <- vapply(stats_k, `[[`, numeric(1), "sd")
  simple <- .cruces_sig_medias(x, w, masks, medias, ns, sds, .cruces_significancia_normalizar())
  spec <- .spec_diseno()
  dis <- .cruces_sig_diseno_base(d, spec)
  diseno <- .cruces_sig_medias(x, w, masks, medias, ns, sds, spec, dis)
  expect_match(simple$letras[1], "B")
  expect_identical(diseno$method, "diseno")
  expect_identical(diseno$letras, c("", ""))
  chicas <- lapply(masks, function(m) m & seq_along(m) <= 320)
  r <- .cruces_sig_medias(x, w, chicas, medias, ns, sds, .cruces_significancia_normalizar())
  expect_identical(r$letras[2], ".b")
})

test_that("el gráfico no pone letras de z simple cuando el estudio prueba bajo el diseño", {
  inst <- list(survey = data.frame(name = "q", type = "select_one sn", stringsAsFactors = FALSE),
               cruces_significancia = list(metodo = "diseno", conglomerado = "aula"))
  diseno <- .graficos_sig_diseno_de_letras(inst, "q")
  expect_identical(as.character(diseno), "muestral")
  n_mat <- matrix(c(150, 50, 60, 140), nrow = 2, dimnames = list(c("Sí", "No"), c("x", "y")))
  res <- .graficos_sig_calcular(n_mat, c(x = 200, y = 200), diseno = diseno)
  expect_null(res$letras)
  expect_match(res$motivo, "bajo el diseño muestral")
})

test_that("el gráfico en modo simple deja fuera al grupo con menos de 30 casos y lo dice", {
  n_mat <- matrix(c(150, 50, 60, 140, 20, 0), nrow = 2,
                  dimnames = list(c("Sí", "No"), c("x", "y", "z")))
  res <- .graficos_sig_calcular(n_mat, c(x = 200, y = 200, z = 20))
  expect_match(res$letras["Sí", "x"], "B")
  expect_false(any(grepl("C", res$letras)))
  expect_identical(res$excluidas, 1L)
  nota <- .graficos_sig_nota(c("X", "Y", "Z"), correccion = res$correccion,
                             excluidas = res$excluidas, base_minima = res$base_minima)
  expect_match(nota, "menos de 30 casos\\s+no se comparan")
  sin_excluir <- .graficos_sig_nota(c("X", "Y"))
  expect_false(grepl("menos de 30", sin_excluir))
})

test_that("la configuración de Analítica viaja con el instrumento de Gráficos", {
  local_mocked_bindings(
    .analitica_get_config = function(sid) list(cruces = list(significancia = list(
      metodo = "diseno", conglomerado = "aula", correccion = "holm"
    )))
  )
  src <- .graficos_sig_adjuntar_config("sid", list(inst_sources = list(b1 = list(survey = data.frame()))))
  # ADR 0128: lo que viaja es la regla del estudio, sembrada desde Analítica (migración). Holm no es opción de la regla
  # (D3: BH del informe o Bonferroni por fila), así que la corrección declarada cae a Bonferroni por fila.
  expect_identical(src$inst_sources$b1$cruces_significancia$metodo, "diseno")
  expect_identical(src$inst_sources$b1$cruces_significancia$conglomerado, "aula")
  expect_identical(src$inst_sources$b1$cruces_significancia$correccion, "bonferroni")
})

test_that("las guardas de independencia no cambian con la configuración de las letras", {
  base <- list(survey = data.frame(name = "q", type = "select_one sn", stringsAsFactors = FALSE))
  for (cfg in list(list(metodo = "simple", correccion = "holm"),
                   list(metodo = "diseno", conglomerado = "aula"))) {
    inst <- c(base, list(cruces_significancia = cfg))
    # Lo que consultan ola4, puntos comparativos y radar multibase.
    expect_identical(.graficos_sig_diseno_de_fuente(inst, "q"), "independiente")
  }
  inst_holm <- c(base, list(cruces_significancia = list(metodo = "simple", correccion = "holm")))
  d <- .graficos_sig_diseno_de_letras(inst_holm, "q")
  expect_identical(as.character(d), "independiente")
  expect_identical(attr(d, "significancia")$correccion, "holm")
})

test_that("una configuración ilegible hace abstenerse al gráfico, no caer a la z simple", {
  local_mocked_bindings(.analitica_get_config = function(sid) stop("sesión rota"))
  src <- .graficos_sig_adjuntar_config("sid", list(inst_sources = list(
    b1 = list(survey = data.frame(name = "q", type = "select_one sn", stringsAsFactors = FALSE))
  )))
  d <- .graficos_sig_diseno_de_letras(src$inst_sources$b1, "q")
  expect_identical(as.character(d), "sin_config")
  n_mat <- matrix(c(150, 50, 60, 140), nrow = 2, dimnames = list(c("Sí", "No"), c("x", "y")))
  res <- .graficos_sig_calcular(n_mat, c(x = 200, y = 200), diseno = d)
  expect_null(res$letras)
  expect_match(res$motivo, "no se pudo leer la configuración")
})

test_that("la base mínima del gráfico usa casos sin ponderar cuando los recibe", {
  n_mat <- matrix(c(150, 50, 60, 140), nrow = 2, dimnames = list(c("Sí", "No"), c("x", "y")))
  # Pesos de expansión: la base ponderada es grande pero hay 20 casos en y.
  res <- .graficos_sig_calcular(n_mat * 50, c(x = 10000, y = 10000), n_casos = c(200, 20))
  expect_identical(res$excluidas, 1L)
  expect_false(any(grepl("B", res$letras)))
})

test_that("el consolidado de Gráficos también adjunta la configuración", {
  cuerpo <- paste(deparse(body(.graficos_consolidado_sources)), collapse = "\n")
  expect_match(cuerpo, ".graficos_sig_adjuntar_config", fixed = TRUE)
})
