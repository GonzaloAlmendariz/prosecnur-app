source("setup-load-all.R")

# ADR 0128 (D1): con la regla del estudio vigente, la tabla de cruces marca con la misma evaluación que la lámina.
# Fixture sintético: 400 casos en 40 aulas, dos áreas con 30 puntos de diferencia en «Sí» y un tercer grupo chico.

.fixture_tabla <- function() {
  set.seed(3)
  n <- 400
  aula <- sprintf("a%02d", rep(1:40, length.out = n))
  area <- ifelse(as.integer(sub("a", "", aula)) <= 20, "1", "2")
  area[1:12] <- "3"   # grupo chico: 12 casos
  p1 <- ifelse(stats::runif(n) < ifelse(area == "1", 0.65, 0.35), "s", "n")
  list(
    data = data.frame(p1 = p1, area = area, aula = aula, stringsAsFactors = FALSE),
    inst = list(
      survey = data.frame(name = c("p1", "area"), type = c("select_one sn", "select_one ar"),
                          label = c("Pregunta", "Área"), stringsAsFactors = FALSE),
      choices = data.frame(list_name = c("sn", "sn", "ar", "ar", "ar"), name = c("s", "n", "1", "2", "3"),
                           label = c("Sí", "No", "Uno", "Dos", "Tres"), stringsAsFactors = FALSE)
    )
  )
}

.letras_hoja <- function(out) {
  raw <- as.matrix(readxl::read_excel(out, col_names = FALSE))
  raw[is.na(raw)] <- ""
  i <- which(raw[, 1] == "Comparaciones de proporciones de columna")[1]
  list(fila_si = raw[i + 3, ], fila_no = raw[i + 4, ], todo = as.character(raw))
}

test_that("con la regla del estudio la tabla usa la prueba de diseño, no marca grupos chicos y lo dice en la nota", {
  skip_if_not_installed("readxl")
  f <- .fixture_tabla()
  regla <- .sig_regla_normalizar(list(prueba = "rao_scott", correccion = "bonferroni_fila", conglomerado = "aula"))
  vieja <- .sig_informe_activar(list(regla = regla, familia = NULL)); on.exit(options(vieja), add = TRUE)
  out <- tempfile(fileext = ".xlsx"); on.exit(unlink(out), add = TRUE)
  suppressMessages(reporte_cruces(data = f$data, instrumento = f$inst, SECCIONES = list(G = "p1"), cruces = "area",
                                  path_xlsx = out, show_sig = TRUE))
  h <- .letras_hoja(out)
  nota <- h$todo[grepl("Las letras comparan", h$todo, fixed = TRUE)]
  expect_length(nota, 1L)
  expect_match(nota, "Rao-Scott por aula")
  expect_match(nota, "menos de 30 casos o de 8 aulas")
  # «Uno» (A) supera a «Dos» (B) en Sí; «Tres» (12 casos) no lleva ni recibe letras.
  expect_true(any(h$fila_si == "B"))
  expect_false(any(grepl("C", h$fila_si)))

  # Paridad: las letras de la lámina (misma evaluación) son las de la tabla.
  fuente <- .sig_fuente(f$data, f$inst)
  M <- .sig_letras_tabla(fuente, "p1", "area", regla)
  expect_equal(gsub("[▲△]", "", M[1, "1"]), "B")   # sin orders_list los rótulos son los códigos
  expect_equal(M[1, "3"], "")
})

test_that("sin regla vigente la tabla sigue con la prueba z de siempre", {
  skip_if_not_installed("readxl")
  f <- .fixture_tabla()
  vieja <- .sig_informe_activar(NULL); on.exit(options(vieja), add = TRUE)
  out <- tempfile(fileext = ".xlsx"); on.exit(unlink(out), add = TRUE)
  suppressMessages(reporte_cruces(data = f$data, instrumento = f$inst, SECCIONES = list(G = "p1"), cruces = "area",
                                  path_xlsx = out, show_sig = TRUE))
  h <- .letras_hoja(out)
  expect_true(any(grepl("prueba z de diferencia de proporciones", h$todo, fixed = TRUE)))
})

# ADR 0128 unifica el 0127: sus validaciones valen para la regla del estudio.
test_that("con la regla del estudio, la columna chica lleva .b y un estrato no anidado deja la tabla sin letras", {
  f <- .fixture_tabla()
  regla <- .sig_regla_normalizar(list(prueba = "rao_scott", correccion = "bonferroni_fila", conglomerado = "aula"))
  codes <- c("s", "n")
  r <- .cruces_comparar_con_regla(f$data, "p1", c("Sí", "No"), codes, c("1", "2", "3"), "area", "so", "peso", regla)
  expect_true(all(r$letras[, "3"] == ".b"))
  expect_true(any(r$letras[, "1"] == "B"))

  # Estrato que varía dentro del aula: no se reasigna; no hay letras y se dice por qué.
  f$data$estrato <- ifelse(seq_len(nrow(f$data)) %% 3 == 0, "e1", "e2")
  regla$estrato <- "estrato"
  r2 <- .cruces_comparar_con_regla(f$data, "p1", c("Sí", "No"), codes, c("1", "2", "3"), "area", "so", "peso", regla)
  expect_identical(r2$method, "descriptivo")
  expect_match(r2$reason, "no anidados")
  expect_match(.cruces_nota_regla(regla, r2$reason), "Sin letras en parte de la tabla")
  expect_error(.sig_regla_validar_base(regla, f$data), class = "api_error")
})

test_that("lo declarado en Analítica › Cruces (ADR 0127) siembra la regla del estudio cuando aún no hay una", {
  ac <- list(cruces = list(significancia = list(metodo = "diseno", conglomerado = "aula_id", estrato = "nivel_curso",
                                                base_minima = 50L)))
  rr <- .sig_regla_del_estudio(list(), data.frame(x = 1), ac)
  expect_identical(rr$origen, "propuesta")
  expect_identical(rr$regla$prueba, "rao_scott")
  expect_identical(rr$regla$conglomerado, "aula_id")
  expect_identical(rr$regla$estrato, "nivel_curso")
  expect_equal(rr$regla$base_minima, 50)
  # La regla guardada del estudio manda sobre la de Analítica (D1).
  rr2 <- .sig_regla_del_estudio(list(significancia = list(prueba = "z")), data.frame(x = 1), ac)
  expect_identical(rr2$regla$prueba, "z")
})
