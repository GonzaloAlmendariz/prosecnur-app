# =============================================================================
# Unidad 1.2 — sello de ponderacion en artefactos.
#
# Contrato: ningun artefacto sale sin declarar su estado de ponderacion y el
# fallback silencioso a base no ponderada deja rastro (warning + estado).
# Textos canonicos en reporte_ponderacion_sello.R.
# =============================================================================

.sello_cfg_valida <- function() {
  list(ponderacion = list(
    enabled = TRUE,
    rake = list(margins = list(list(var = "sexo", targets = list(H = 0.5, M = 0.5))))
  ))
}

test_that("config de ponderacion invalida emite warning y el sello declara el fallback", {
  data <- data.frame(sexo = c("H", "M", "H"), stringsAsFactors = FALSE)
  # Habilitada pero rota: margen sin variable => ni diseno ni margenes utilizables.
  cfg <- list(ponderacion = list(
    enabled = TRUE,
    rake = list(margins = list(list(var = "", targets = list(a = 1))))
  ))
  expect_warning(
    out <- .analitica_ponderacion_apply(data, cfg),
    "Ponderación configurada pero no aplicada.*sale SIN ponderar"
  )
  expect_false("peso" %in% names(out))
  estado <- attr(out, "ponderacion_estado", exact = TRUE)
  expect_identical(estado$status, "no_aplicada")
  expect_true(nzchar(estado$motivo))
  expect_identical(
    reporte_ponderacion_sello(estado),
    "Base sin ponderar (ponderación configurada no aplicada)"
  )
})

test_that("margen sobre variable inexistente en la base tambien deja rastro", {
  data <- data.frame(sexo = c("H", "M", "H"), stringsAsFactors = FALSE)
  cfg <- list(ponderacion = list(
    enabled = TRUE,
    rake = list(margins = list(list(var = "zona", targets = list(urbano = 0.6, rural = 0.4))))
  ))
  expect_warning(
    out <- .analitica_ponderacion_apply(data, cfg),
    "ninguna variable de calibración existe en la base"
  )
  estado <- attr(out, "ponderacion_estado", exact = TRUE)
  expect_identical(estado$status, "no_aplicada")
  expect_identical(
    reporte_ponderacion_sello(estado),
    "Base sin ponderar (ponderación configurada no aplicada)"
  )
})

test_that("ponderacion aplicada produce sello con n_eff y sin warning", {
  set.seed(7)
  data <- data.frame(
    sexo = sample(c("H", "M"), 200, replace = TRUE, prob = c(0.7, 0.3)),
    stringsAsFactors = FALSE
  )
  expect_warning(out <- .analitica_ponderacion_apply(data, .sello_cfg_valida()), regexp = NA)
  expect_true("peso" %in% names(out))
  estado <- attr(out, "ponderacion_estado", exact = TRUE)
  expect_identical(estado$status, "aplicada")
  expect_true(is.finite(estado$n_eff) && estado$n_eff > 0 && estado$n_eff <= 200)
  sello <- reporte_ponderacion_sello(estado)
  expect_match(sello, "^Base ponderada \\(n_eff = [0-9,]+\\)$")
  esperado <- sprintf(
    "Base ponderada (n_eff = %s)",
    format(round(estado$n_eff), big.mark = ",", scientific = FALSE, trim = TRUE)
  )
  expect_identical(sello, esperado)
})

test_that("sin config el sello canonico es 'Base sin ponderar'", {
  expect_identical(reporte_ponderacion_sello(NULL), "Base sin ponderar")
  expect_identical(reporte_ponderacion_sello(list(status = "sin_config")), "Base sin ponderar")
  # Y el hook de corrida devuelve "" (los artefactos historicos no cambian).
  expect_identical(
    reporte_ponderacion_sello_para_corrida(data.frame(x = 1), list()),
    ""
  )
  expect_identical(reporte_ponderacion_sello_para_corrida(NULL, NULL), "")
})

test_that("una base hija que hereda `peso` deriva estado aplicado sin atributo", {
  # Las hijas repeat heredan el peso de la madre (ponderacion_analitica.R:
  # herencia via llave relacional) y pierden el atributo: la derivacion
  # defensiva reconstruye el estado desde la columna `peso` + config habilitada.
  data <- data.frame(x = 1:4, peso = c(1.2, 0.8, 1, 1))
  cfg <- list(ponderacion = list(enabled = TRUE))
  estado <- reporte_ponderacion_estado_corrida(data, cfg)
  expect_identical(estado$status, "aplicada")
  expect_true(is.finite(estado$n_eff))
  expect_match(reporte_ponderacion_sello(estado), "^Base ponderada \\(n_eff = ")
})

test_that("config habilitada sin pesos adjuntos deriva fallback en la corrida", {
  data <- data.frame(x = 1:4)
  cfg <- list(ponderacion = list(enabled = TRUE))
  estado <- reporte_ponderacion_estado_corrida(data, cfg)
  expect_identical(estado$status, "no_aplicada")
  expect_identical(
    reporte_ponderacion_sello_para_corrida(data, cfg),
    "Base sin ponderar (ponderación configurada no aplicada)"
  )
})

test_that("la ficha tecnica consume el sello cuando la corrida trae ponderacion", {
  data <- data.frame(sexo = c("H", "M"), stringsAsFactors = FALSE)
  attr(data, "ponderacion_estado") <- reporte_ponderacion_estado(
    "aplicada",
    diagnostics = list(n = 2, n_eff = 2, deff = 1)
  )
  rows <- .ficha_tecnica_rows(data = data)
  pond <- rows$Detalle[rows$Campo == "Ponderacion"]
  expect_length(pond, 1L)
  expect_identical(pond[[1]], "Base ponderada (n_eff = 2)")

  # La vista Word toma el sello bajo el label oficial.
  drows <- .ficha_tecnica_docx_rows(data = data)
  det <- drows$Detalle[drows$Campo == "Ponderación"]
  expect_identical(det[[1]], "Base ponderada (n_eff = 2)")

  # El texto explicito del usuario manda sobre el sello automatico.
  cfg_usuario <- list(ficha_tecnica = list(ponderacion = "Ponderacion por raking descrita en el anexo."))
  drows_u <- .ficha_tecnica_docx_rows(data = data, cfg = cfg_usuario)
  det_u <- drows_u$Detalle[drows_u$Campo == "Ponderación"]
  expect_identical(det_u[[1]], "Ponderacion por raking descrita en el anexo.")
})

test_that("sin informacion de ponderacion la ficha queda identica a la historica", {
  rows <- .ficha_tecnica_rows(data = data.frame(sexo = "H", stringsAsFactors = FALSE))
  expect_false("Ponderacion" %in% rows$Campo)
  drows <- .ficha_tecnica_docx_rows(data = data.frame(sexo = "H", stringsAsFactors = FALSE))
  det <- drows$Detalle[drows$Campo == "Ponderación"]
  expect_identical(det[[1]], "No documentado en la ficha metodológica disponible.")
})

test_that("render real: la ficha tecnica Word imprime el sello de ponderacion", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")

  data <- data.frame(sexo = c("H", "M"), stringsAsFactors = FALSE)
  attr(data, "ponderacion_estado") <- reporte_ponderacion_estado(
    "no_aplicada",
    motivo = "configuración incompleta (sin diseño ni márgenes utilizables)"
  )
  rows <- .ficha_tecnica_docx_rows(data = data)
  out_docx <- tempfile(fileext = ".docx")
  on.exit(unlink(out_docx), add = TRUE)
  .ficha_tecnica_write_docx_pulso(rows, out_docx)
  txt <- officer::docx_summary(officer::read_docx(out_docx))$text
  expect_true(any(grepl(
    "Base sin ponderar (ponderación configurada no aplicada)",
    txt,
    fixed = TRUE
  )))
})

# =============================================================================
# Unidad 1.2b — cableado del sello en las notas de base de las láminas.
# Producción: .reporte_plan_nota_base_sellada (reporte_plan_opciones.R) via
# hooks .plot_note_from/.ppt_note_from y .base_auto_from_element (plan PPT).
# =============================================================================

test_that("los estados por fuente se leen del attr y las hijas repeat heredan", {
  madre <- data.frame(x = 1:4)
  attr(madre, "ponderacion_estado") <- reporte_ponderacion_estado(
    "aplicada", diagnostics = list(n = 4, n_eff = 150, deff = 1.1)
  )
  # Hija repeat: peso heredado SIN atributo -> n_eff propio (36/12 = 3).
  hija_con_peso <- data.frame(y = 1:4, peso = c(1, 1, 1, 3))
  # Hija sin peso (la herencia relacional no adjuntó pesos) -> fallback.
  hija_sin_peso <- data.frame(z = 1:2)

  estados <- .reporte_plan_pond_estados(list(
    default = madre, rep_ok = hija_con_peso, rep_sin = hija_sin_peso
  ))
  expect_identical(estados$default$status, "aplicada")
  expect_false(isTRUE(estados$default$heredado))
  expect_identical(estados$rep_ok$status, "aplicada")
  expect_true(isTRUE(estados$rep_ok$heredado))
  expect_equal(estados$rep_ok$n_eff, 3, tolerance = 1e-9)
  expect_identical(estados$rep_sin$status, "no_aplicada")

  # Corrida sin attr en NINGUNA fuente: una columna `peso` sustantiva del
  # instrumento no dispara el sello por sí sola.
  sin_info <- .reporte_plan_pond_estados(list(
    default = data.frame(x = 1), otra = data.frame(peso = c(1, 2))
  ))
  expect_true(all(vapply(sin_info, is.null, logical(1))))
})

test_that("la nota de base se sella por fuente y es idempotente y conservadora", {
  madre <- data.frame(x = 1:4)
  attr(madre, "ponderacion_estado") <- reporte_ponderacion_estado(
    "aplicada", diagnostics = list(n = 4, n_eff = 150, deff = 1.1)
  )
  hija <- data.frame(y = 1:4, peso = c(1, 1, 1, 3))
  ds <- list(default = madre, rep = hija)

  # Sin fuente atribuible (nota de pie): manda la fuente principal.
  expect_identical(
    .reporte_plan_nota_base_sellada("Base: 4 de 4 (100.0%).", ds),
    "Base: 4 de 4 (100.0%). · Base ponderada (n_eff = 150)"
  )
  # Con fuente (slot de base): manda el estado de ESA base (n_eff propio).
  expect_identical(
    .reporte_plan_nota_base_sellada("Base: 2 de 4 (50.0%)", ds, source = "rep"),
    "Base: 2 de 4 (50.0%) · Base ponderada (n_eff = 3)"
  )
  # Idempotencia: una nota ya sellada no duplica el sello.
  sellada <- .reporte_plan_nota_base_sellada("Base: 4 de 4 (100.0%).", ds)
  expect_identical(.reporte_plan_nota_base_sellada(sellada, ds), sellada)
  # Notas que no declaran base quedan intactas.
  expect_identical(
    .reporte_plan_nota_base_sellada("Fuente: encuesta KOICA 2026", ds),
    "Fuente: encuesta KOICA 2026"
  )
  expect_null(.reporte_plan_nota_base_sellada(NULL, ds))
  # Corrida sin información de ponderación: la nota vuelve idéntica.
  expect_identical(
    .reporte_plan_nota_base_sellada("Base: 4 de 4 (100.0%).", list(default = data.frame(x = 1))),
    "Base: 4 de 4 (100.0%)."
  )
})

.sello_deck_fixture <- function(estado = NULL) {
  data <- data.frame(
    testreal = c("si", "no", "si", "si"),
    stringsAsFactors = FALSE
  )
  attr(data$testreal, "label") <- "Test real"
  if (!is.null(estado)) attr(data, "ponderacion_estado") <- estado
  inst <- list(
    survey = data.frame(
      name = "testreal",
      type = "select_one lst_sino",
      list_name = "lst_sino",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_sino", "lst_sino"),
      name = c("si", "no"),
      label = c("Sí", "No"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )
  plan <- p_plan(slides = list(
    p_slide_1_grafico(
      titulo = "Lámina con nota de base",
      grafico = p_barras_agrupadas(
        "testreal",
        overrides = list(nota_pie = "Base: 4 de 4 (100.0%).")
      )
    )
  ))
  list(
    data = data, inst = inst, plan = plan,
    presets = p_presets(
      barras_agrupadas = list(usar_canvas = TRUE, mostrar_leyenda = FALSE)
    )
  )
}

.sello_deck_xml <- function(fx) {
  out_ppt <- tempfile(fileext = ".pptx")
  reporte_ppt_plan(
    data = fx$data,
    instrumento = fx$inst,
    plan = fx$plan,
    presets = fx$presets,
    path_ppt = out_ppt,
    mensajes_progreso = FALSE
  )
  on.exit(unlink(out_ppt), add = TRUE)
  paste(
    readLines(unz(out_ppt, "ppt/slides/slide1.xml"), warn = FALSE, encoding = "UTF-8"),
    collapse = "\n"
  )
}

test_that("render real: la lámina con ponderación aplicada sella la nota de base", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- .sello_deck_fixture(reporte_ponderacion_estado(
    "aplicada", diagnostics = list(n = 4, n_eff = 187.4, deff = 1.05)
  ))
  xml <- .sello_deck_xml(fx)
  expect_match(
    xml,
    "Base: 4 de 4 (100.0%). · Base ponderada (n_eff = 187)",
    fixed = TRUE
  )
})

test_that("render real: la corrida con fallback declara la base sin ponderar", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- .sello_deck_fixture(reporte_ponderacion_estado(
    "no_aplicada", motivo = "el cálculo de pesos falló (targets incompatibles)"
  ))
  xml <- .sello_deck_xml(fx)
  expect_match(
    xml,
    "Base: 4 de 4 (100.0%). · Base sin ponderar (ponderación configurada no aplicada)",
    fixed = TRUE
  )
})

test_that("render real: la corrida sin config deja la nota histórica intacta", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  xml <- .sello_deck_xml(.sello_deck_fixture(NULL))
  expect_match(xml, "Base: 4 de 4 (100.0%).", fixed = TRUE)
  expect_false(grepl("Base ponderada", xml, fixed = TRUE))
  expect_false(grepl("Base sin ponderar", xml, fixed = TRUE))
  expect_false(grepl(" · ", xml, fixed = TRUE))
})

test_that("p_base_nota_con_sello anexa el sello sin tocar notas sin estado", {
  nota <- "Base: 100 de 200 (50.0%)"
  # Sin estado: la nota queda intacta (los decks historicos no cambian).
  expect_identical(p_base_nota_con_sello(nota), nota)
  expect_null(p_base_nota_con_sello(NULL))

  estado_fb <- reporte_ponderacion_estado("no_aplicada", motivo = "x")
  expect_identical(
    p_base_nota_con_sello(nota, estado_fb),
    paste0(nota, " · Base sin ponderar (ponderación configurada no aplicada)")
  )
  expect_identical(
    p_base_nota_con_sello(NULL, estado_fb),
    "Base sin ponderar (ponderación configurada no aplicada)"
  )

  estado_ok <- reporte_ponderacion_estado("aplicada", diagnostics = list(n_eff = 187.4))
  expect_identical(
    p_base_nota_con_sello(nota, estado_ok),
    paste0(nota, " · Base ponderada (n_eff = 187)")
  )
})
