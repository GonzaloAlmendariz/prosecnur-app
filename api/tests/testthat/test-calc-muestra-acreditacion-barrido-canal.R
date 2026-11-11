# ADR 0143: en acreditación, por correo, teléfono o mixto se invita a toda la
# base. Antes el cuadro sorteaba docentes (336 de 2,665) y egresados (373 de
# 12,512) por correo, mientras en campo se invitó a los 45,120 de la
# Acreditación Institucional 2026.

.barrido_comp <- function(actor, canal, N, meta = NULL, estratos = NULL, parametros = NULL) {
  calc_muestra_normalize_componente(list(
    actor_categoria = actor, canal_recojo = canal, meta = meta, parametros = parametros,
    marco = list(universo_bruto = N, marco_validado = N, marco_contactable = N, estado = "validado",
                 estratos = estratos)
  ))
}

.barrido_estratos <- function(...) {
  x <- list(...)
  lapply(names(x), function(k) list(label = k, N = x[[k]]))
}

test_that("por correo, teléfono o mixto los cuatro públicos se invitan enteros, sin sorteo", {
  casos <- list(c("estudiantes", 22820), c("docentes", 2665), c("administrativos", 2194), c("egresados", 12512))
  for (canal in c("online_email", "telefonico", "mixto")) {
    for (k in casos) {
      N <- as.integer(k[[2]])
      comp <- .barrido_comp(k[[1]], canal, N)
      info <- paste(k[[1]], canal)
      expect_identical(comp$tecnica, "intencion_censal", info = info)
      r <- calc_muestra_calcular_componente(comp)
      expect_identical(as.integer(r$n_operativo), N, info = info)
      expect_true(is.na(r$precision_alcanzada), info = info)
    }
  }
})

test_that("aulas y presencial siguen el ADR 0091", {
  expect_identical(.barrido_comp("estudiantes", "aula_qr", 5000)$tecnica, "prob_conglomerado_multietapico")
  expect_identical(.barrido_comp("docentes", "presencial", 2665)$tecnica, "prob_aleatorio_simple")
  expect_identical(.barrido_comp("egresados", "presencial", 12512)$tecnica, "prob_aleatorio_simple")
})

test_that("la meta del usuario fija las encuestas de la intención censal", {
  r <- calc_muestra_calcular_componente(
    .barrido_comp("docentes", "online_email", 2665, meta = list(valor = 900, origen = "usuario")))
  expect_identical(as.integer(r$n_objetivo), 900L)
  expect_identical(as.integer(r$n_operativo), 2665L)
  expect_equal(r$cobertura_objetivo, 900 / 2665)
  # Sin meta, la cobertura mínima del documento: docentes 60 %.
  r0 <- calc_muestra_calcular_componente(.barrido_comp("docentes", "online_email", 2665))
  expect_identical(as.integer(r0$n_objetivo), as.integer(ceiling(2665 * 0.6)))
  # La meta no pasa del marco.
  r1 <- calc_muestra_calcular_componente(
    .barrido_comp("docentes", "online_email", 100, meta = list(valor = 150, origen = "usuario")))
  expect_identical(as.integer(r1$n_objetivo), 100L)
})

test_that("con segmentos, el mínimo se descuenta de los grandes y el total no cambia", {
  est <- .barrido_estratos(`Contratado a tiempo completo` = 114L, `Contratado a tiempo parcial` = 1751L,
                           `Ordinario auxiliar` = 269L, `Ordinario asociado` = 255L, `Ordinario principal` = 276L)
  r <- calc_muestra_calcular_componente(.barrido_comp(
    "docentes", "online_email", 2665, meta = list(valor = 600, origen = "usuario"), estratos = est,
    parametros = list(n_minimo_estrato = 30, tasa_respuesta = 0.316)))
  d <- r$distribucion_estratos
  n <- vapply(d, function(x) as.integer(x$n), 1L)
  names(n) <- vapply(d, `[[`, "", "estrato")
  expect_identical(sum(n), 600L)
  # Proporcional daría 26 a tiempo completo: sube a 30.
  expect_identical(n[["Contratado a tiempo completo"]], 30L)
  expect_true(all(n >= 30L))
  # Cada segmento se invita entero.
  expect_identical(vapply(d, function(x) as.integer(x$n_campo), 1L), vapply(d, function(x) as.integer(x$N), 1L))
})

test_that("se avisa el segmento cuya meta pide más respuesta de la esperada", {
  est <- .barrido_estratos(Nombrado = 1528L, Contratado = 629L, `Autoridades (direcciones)` = 37L)
  r <- calc_muestra_calcular_componente(.barrido_comp(
    "administrativos", "online_email", 2194, meta = list(valor = 900, origen = "usuario"), estratos = est,
    parametros = list(n_minimo_estrato = 30, tasa_respuesta = 0.508)))
  d <- r$distribucion_estratos
  aut <- d[[which(vapply(d, `[[`, "", "estrato") == "Autoridades (direcciones)")]]
  expect_identical(as.integer(aut$n), 30L)
  expect_false(aut$alcanza)
  expect_equal(aut$completas_esperadas, 37 * 0.508)
  nom <- d[[which(vapply(d, `[[`, "", "estrato") == "Nombrado")]]
  expect_true(nom$alcanza)
  expect_match(r$advertencia, "Autoridades (direcciones)", fixed = TRUE)
  expect_false(grepl("Nombrado", r$advertencia, fixed = TRUE))
})

test_that("si los mínimos no caben en la meta, no se aplican y se avisa", {
  est <- .barrido_estratos(A = 200L, B = 200L, C = 200L)
  r <- calc_muestra_calcular_componente(.barrido_comp(
    "docentes", "online_email", 600, meta = list(valor = 60, origen = "usuario"), estratos = est,
    parametros = list(n_minimo_estrato = 30)))
  expect_identical(sum(vapply(r$distribucion_estratos, function(x) as.integer(x$n), 1L)), 60L)
  expect_match(r$advertencia, "mínimo", fixed = TRUE)
})

test_that("si el público entero no alcanza, el aviso no repite cada segmento proporcional", {
  est <- .barrido_estratos(`Contratado a tiempo completo` = 114L, `Contratado a tiempo parcial` = 1751L,
                           `Ordinario auxiliar` = 269L, `Ordinario asociado` = 255L, `Ordinario principal` = 276L)
  r <- calc_muestra_calcular_componente(.barrido_comp(
    "docentes", "online_email", 2665, meta = list(valor = 900, origen = "usuario"), estratos = est,
    parametros = list(n_minimo_estrato = 30, tasa_respuesta = 0.316)))
  # Todos los segmentos piden 34 %: el aviso general basta.
  expect_match(r$advertencia, "se esperan", fixed = TRUE)
  expect_false(grepl("no alcanzan su meta", r$advertencia, fixed = TRUE))
  # Un segmento que pide más que el público (el mínimo lo sube) sí se nombra.
  est2 <- .barrido_estratos(Grande = 2600L, Chico = 40L)
  r2 <- calc_muestra_calcular_componente(.barrido_comp(
    "docentes", "online_email", 2640, meta = list(valor = 900, origen = "usuario"), estratos = est2,
    parametros = list(n_minimo_estrato = 30, tasa_respuesta = 0.316)))
  expect_match(r2$advertencia, "Chico (30 de 40", fixed = TRUE)
  expect_false(grepl("Grande (", r2$advertencia, fixed = TRUE))
})
