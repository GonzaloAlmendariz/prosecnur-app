# Ficha de trabajo de campo de una UMP (hojas_ruta_ficha_pdf.R): modelo, esquema
# de recorrido y texto del PDF. Sin red: marco INEI empaquetado.

hfp_muestra <- local({
  cache <- NULL
  function() {
    if (is.null(cache)) {
      cfg <- list(
        n_objetivo = 24, territorios = "070106", sampling_method = "pps", seed = 99,
        entrevistas_por_manzana = 6, replacements_per_titular = 1, route_jump_mode = "auto",
        sample_size = list(response_rate = 0.6)
      )
      sm <- hojas_ruta_sample_preview_integrado(cfg)
      cache <<- hojas_ruta_tamano_extras_salto_muestra(sm, cfg)
    }
    cache
  }
})

hfp_bloque <- function(sm, tipo = "titular", i = 1L) {
  lista <- if (identical(tipo, "titular")) sm$blocks else sm$replacement_blocks
  hojas_ruta_vp_buscar_bloque(sm, lista[[i]]$id_manzana)$block
}

test_that("el modelo lleva la cuota de la hoja: marginales que suman lo mismo que las entrevistas", {
  sm <- hfp_muestra()
  b <- hfp_bloque(sm)
  m <- hojas_ruta_ficha_modelo(b, NULL, sm$config)
  ref <- .hojas_ruta_reference_quota_marginals(b, sm$config)
  expect_identical(unname(m$cuota$sexo), c(ref$hombre_total, ref$mujer_total))
  expect_identical(unname(m$cuota$edad), ref$age_totals)
  expect_identical(sum(m$cuota$sexo), m$cuota$total)
  expect_identical(sum(m$cuota$edad), m$cuota$total)
  expect_identical(m$cuota$total, as.integer(b$entrevistas))
  expect_identical(names(m$cuota$edad)[[1]], "18 a 24")
  expect_match(utils::tail(names(m$cuota$edad), 1), "a más$")

  # La cuota de sexo guardada por distrito manda (hojas_ruta_cuotas_por_ficha.R).
  b2 <- b; b2$cuota_sexo_totals <- "5,1"
  m2 <- hojas_ruta_ficha_modelo(b2, NULL, sm$config)
  expect_identical(unname(m2$cuota$sexo), c(5L, 1L))
})

test_that("el modelo de la selección sale de los valores operativos con el salto sobre visitas", {
  sm <- hfp_muestra()
  for (i in seq_along(sm$blocks)) {
    b <- hfp_bloque(sm, "titular", i)
    m <- hojas_ruta_ficha_modelo(b, NULL, sm$config)
    ops <- .hojas_ruta_vp_ops_sobre_visitas(.hojas_ruta_route_operational_values(b, sm$config), b)
    expect_identical(m$seleccion$esquina, as.character(ops$esquina_inicio))
    expect_identical(m$seleccion$esquina_nombre,
                     c("noreste", "sureste", "suroeste", "noroeste")[as.integer(ops$esquina_inicio)])
    expect_identical(m$seleccion$sentido_nombre,
                     c("horario", "antihorario")[as.integer(ops$sentido_recorrido)])
    expect_identical(m$seleccion$inicio, as.integer(ops$domicilio_inicio))
    if (!m$seleccion$barrido) expect_identical(m$seleccion$salto, as.integer(ops$constante_salto))
  }
  expect_false(hojas_ruta_ficha_modelo(hfp_bloque(sm), NULL, sm$config)$encabezado$es_reemplazo)
  r <- hojas_ruta_ficha_modelo(hfp_bloque(sm, "reemplazo"), NULL, sm$config)
  expect_true(r$encabezado$es_reemplazo)
  expect_identical(r$encabezado$titulo, "Ficha de reemplazo")
  expect_true(nzchar(r$encabezado$reemplaza))
})

test_that("el recorrido del esquema arranca en la esquina de inicio y gira en el sentido pedido", {
  # Cuadrado unidad con esquina superior izquierda (0, 1).
  primer_paso <- function(esquina, horario) {
    p <- .hfp_perimetro(c(0, 0.05), esquina, horario, 0, 1, 1, 1)
    list(inicio = p[1, ], paso = p[2, ] - p[1, ])
  }
  # 4 = noroeste: horario va al este; antihorario, al sur.
  expect_equal(primer_paso("4", TRUE)$inicio, c(0, 1))
  expect_gt(primer_paso("4", TRUE)$paso[[1]], 0)
  expect_lt(primer_paso("4", FALSE)$paso[[2]], 0)
  # 2 = sureste: horario va al oeste; antihorario, al norte.
  expect_equal(primer_paso("2", TRUE)$inicio, c(1, 0))
  expect_lt(primer_paso("2", TRUE)$paso[[1]], 0)
  expect_gt(primer_paso("2", FALSE)$paso[[2]], 0)
})

test_that("la ficha no dibuja «Reemplazo N» alrededor de la manzana ni usa el asset viejo", {
  skip_if_not_installed("pdftools")
  sm <- hfp_muestra()
  for (tipo in c("titular", "reemplazo")) {
    pdf <- tempfile(fileext = ".pdf")
    .hojas_ruta_draw_integrated_pdf_page1(hfp_bloque(sm, tipo), data.frame(), list(), sm$config, pdf)
    txt <- paste(pdftools::pdf_text(pdf), collapse = "\n")
    expect_false(grepl("Manzana\\s+inicial", txt, ignore.case = TRUE), info = tipo)
    expect_match(txt, "Cuota de esta hoja: total por sexo y por edad", fixed = TRUE)
    expect_match(txt, "ESQUINA DE INICIO", fixed = TRUE)
    expect_match(txt, "SENTIDO DEL RECORRIDO", fixed = TRUE)
    expect_match(txt, "CONSTANTE DE SALTO", fixed = TRUE)
    expect_match(txt, "Hombres", fixed = TRUE)
    expect_match(txt, "Mujeres", fixed = TRUE)
    if (identical(tipo, "reemplazo")) expect_match(txt, "Reemplaza a la manzana", fixed = TRUE)
  }
  # El esquema solo, en todas las esquinas y sentidos: nunca nombra un reemplazo
  # (el reemplazo real es otra manzana sorteada) ni a las manzanas vecinas.
  for (esq in as.character(1:4)) for (sen in c("1", "2")) {
    pdf <- tempfile(fileext = ".pdf")
    grDevices::pdf(pdf, width = 8.27, height = 11.69)
    grid::grid.newpage()
    .hojas_ruta_ficha_esquema_recorrido(
      list(esquina = esq, sentido = sen, inicio = 2L, salto = 3L, barrido = FALSE),
      0.1, 0.9, 0.5, 0.4
    )
    grDevices::dev.off()
    txt <- paste(pdftools::pdf_text(pdf), collapse = "\n")
    expect_false(grepl("reemplazo", txt, ignore.case = TRUE), info = paste(esq, sen))
    expect_match(txt, "INICIO", fixed = TRUE)
  }
  expect_false(file.exists(file.path(test_path("..", "..", "inst", "hojas_ruta", "assets"),
                                     "graficoMsistematico.png")))
  fuentes <- list.files(test_path("..", "..", "R"), pattern = "[.]R$", full.names = TRUE)
  expect_false(any(vapply(fuentes, function(f) any(grepl("graficoMsistematico", readLines(f, warn = FALSE),
                                                          fixed = TRUE)), logical(1))))
})

test_that("una ficha sin visitas esperadas sale sin ese bloque y sin fallar", {
  skip_if_not_installed("pdftools")
  sm <- hfp_muestra()
  b <- hfp_bloque(sm); b$visitas_esperadas <- NULL; b$regla_no_respuesta <- NULL
  pdf <- tempfile(fileext = ".pdf")
  .hojas_ruta_draw_integrated_pdf_page1(b, data.frame(), list(), sm$config, pdf)
  txt <- paste(pdftools::pdf_text(pdf), collapse = "\n")
  expect_false(grepl("Visitas esperadas", txt, fixed = TRUE))
  expect_false(grepl("Ante la no respuesta", txt, fixed = TRUE))
  expect_match(txt, "Ficha de trabajo de campo", fixed = TRUE)
})
