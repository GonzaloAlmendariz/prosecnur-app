# Que es una encuesta EFECTIVA, cuando hace falta mas de un filtro.
#
# Gonzalo: «la seccion de fuentes no deja declarar las variables que definen a
# una encuesta efectiva, que en algunos casos tiene mas de un filtro, puede tener
# hasta 4». Hasta aqui el criterio era UNA columna contra una lista de estados, y
# eso no alcanza para un estudio real: «efectiva» suele ser completa **y** con
# consentimiento **y** del publico elegible.

.mafv_base <- function() {
  data.frame(
    estado        = c("completa", "completa", "completa", "parcial", "completa"),
    consentimiento = c("si", "si", "no", "si", "si"),
    publico       = c("alumno", "docente", "alumno", "alumno", "alumno"),
    duracion_ok   = c("si", "si", "si", "si", "no"),
    stringsAsFactors = FALSE
  )
}

test_that("un solo filtro sigue contando como antes", {
  cfg <- list(source_mapping = list(status_var = "estado", valid_statuses = "completa"))
  # Cuatro de cinco tienen estado «completa».
  expect_identical(sum(prosecnurapp:::.monitoreo_aulas_valid_response(.mafv_base(), cfg)), 4L)
})

test_that("CUATRO filtros se exigen todos, y ninguno amplia", {
  cfg <- list(source_mapping = list(valid_filters = list(
    list(var = "estado", values = "completa"),
    list(var = "consentimiento", values = "si"),
    list(var = "publico", values = "alumno"),
    list(var = "duracion_ok", values = "si")
  )))
  ok <- prosecnurapp:::.monitoreo_aulas_valid_response(.mafv_base(), cfg)
  # Solo la fila 1 cumple las cuatro: la 2 es docente, la 3 no consintio, la 4
  # esta parcial y la 5 no cumple duracion.
  expect_identical(ok, c(TRUE, FALSE, FALSE, FALSE, FALSE))
  expect_identical(sum(ok), 1L)
})

test_that("cada filtro ACOTA: quitar uno no puede dar menos validas", {
  # La invariante que hace util tener varios: son una conjuncion. Si añadir un
  # filtro subiera el conteo, estarian actuando como alternativas.
  base <- .mafv_base()
  con <- function(fs) sum(prosecnurapp:::.monitoreo_aulas_valid_response(
    base, list(source_mapping = list(valid_filters = fs))))
  uno <- list(list(var = "estado", values = "completa"))
  dos <- c(uno, list(list(var = "consentimiento", values = "si")))
  tres <- c(dos, list(list(var = "publico", values = "alumno")))
  expect_true(con(uno) >= con(dos))
  expect_true(con(dos) >= con(tres))
  expect_identical(c(con(uno), con(dos), con(tres)), c(4L, 3L, 2L))
})

test_that("una columna declarada que la base NO trae no descarta todo", {
  # Descartar las cinco por una columna ausente seria peor que contar de mas: el
  # estudio se quedaria sin avance por un error de tipeo en la config.
  cfg <- list(source_mapping = list(valid_filters = list(
    list(var = "estado", values = "completa"),
    list(var = "columna_que_no_existe", values = "si")
  )))
  expect_identical(sum(prosecnurapp:::.monitoreo_aulas_valid_response(.mafv_base(), cfg)), 4L)
})

test_that("un filtro sin variable o sin valores no entra", {
  # Dejarlo entrar descartaria TODAS las respuestas en silencio.
  fs <- monitoreo_aulas_filtros_de_validez(list(source_mapping = list(valid_filters = list(
    list(var = "estado", values = "completa"),
    list(var = "", values = "si"),
    list(var = "consentimiento", values = character(0))
  ))))
  expect_length(fs, 1L)
  expect_identical(fs[[1]]$var, "estado")
})

test_that("sin `valid_filters` se lee el `status_var` de siempre", {
  # Un estudio ya configurado no cambia de numero por este cambio.
  fs <- monitoreo_aulas_filtros_de_validez(list(source_mapping = list(
    status_var = "estado", valid_statuses = c("completa", "parcial")
  )))
  expect_length(fs, 1L)
  expect_identical(fs[[1]]$var, "estado")
  expect_identical(fs[[1]]$values, c("completa", "parcial"))
})

test_that("el criterio NOMBRA los filtros, y avisa del que no se pudo aplicar", {
  # Un motor que filtra en silencio es lo que este perfil lleva corrigiendo: sin
  # nombrarlos habria que abrir la config para saber que se esta contando.
  cfg <- list(source_mapping = list(valid_filters = list(
    list(var = "estado", values = "completa"),
    list(var = "consentimiento", values = "si"),
    list(var = "columna_que_no_existe", values = "si")
  )))
  crit <- monitoreo_aulas_criterio_validez(.mafv_base(), cfg)
  expect_identical(crit$modo, "por_filtros")
  expect_identical(crit$validas, 3L)

  txt <- monitoreo_aulas_criterio_texto(crit)
  expect_true(grepl("3 condiciones", txt, fixed = TRUE))
  expect_true(grepl("estado, consentimiento", txt, fixed = TRUE))
  # Y la que no se pudo aplicar se dice, o un error de tipeo pasaria por criterio.
  expect_true(grepl("columna_que_no_existe", txt, fixed = TRUE))
  expect_true(grepl("no se aplico", txt, fixed = TRUE))
})

test_that("los filtros SOBREVIVEN al normalizador de config", {
  # Este normalizador es la whitelist: lo que no nombra, no persiste. Sin esto
  # la UI dejaria elegir los filtros y al guardar se perderian en silencio, que
  # es el defecto clasico de este repo —un campo cruza varias whitelists—.
  cfg <- monitoreo_aulas_normalize_config(list(source_mapping = list(
    valid_filters = list(
      list(var = "estado", values = c("completa")),
      list(var = "consentimiento", values = c("si"))
    )
  )))
  fs <- cfg$source_mapping$valid_filters
  expect_length(fs, 2L)
  expect_identical(fs[[1]]$var, "estado")
  expect_identical(unlist(fs[[2]]$values), "si")
})

test_that("el normalizador tira los filtros incompletos y corta en CUATRO", {
  # Un filtro sin variable o sin valores descartaria TODAS las respuestas, y el
  # tope es el que declaro Gonzalo: «puede tener hasta 4».
  cfg <- monitoreo_aulas_normalize_config(list(source_mapping = list(
    valid_filters = c(
      list(list(var = "", values = "x")),
      list(list(var = "a", values = character(0))),
      lapply(1:6, function(i) list(var = paste0("v", i), values = "si"))
    )
  )))
  fs <- cfg$source_mapping$valid_filters
  expect_length(fs, 4L)
  expect_identical(vapply(fs, function(f) f$var, character(1)), c("v1", "v2", "v3", "v4"))
})
