make_dimensiones_criterios_fixture <- function() {
  dat <- data.frame(
    p1 = c("5", "4", "5", "4", "5", "4"),
    p2 = c("4", "4", "5", "4", "5", "3"),
    p3 = c("5", "3", "4", "4", "5", "4"),
    servicio = c("A", "A", "B", "B", "C", "C"),
    stringsAsFactors = FALSE
  )

  attr(dat$p1, "label") <- "Calidad del trato"
  attr(dat$p2, "label") <- "Claridad de la información"
  attr(dat$p3, "label") <- "Condiciones del ambiente"
  attr(dat$servicio, "label") <- "Servicio"

  survey <- data.frame(
    name = c("p1", "p2", "p3", "servicio"),
    type = c("select_one sat", "select_one sat", "select_one sat", "select_one srv"),
    list_name = c("sat", "sat", "sat", "srv"),
    stringsAsFactors = FALSE
  )

  choices <- rbind(
    data.frame(
      list_name = "sat",
      name = c("1", "2", "3", "4", "5"),
      label = c("1", "2", "3", "4", "5"),
      stringsAsFactors = FALSE
    ),
    data.frame(
      list_name = "srv",
      name = c("A", "B", "C"),
      label = c("A", "B", "C"),
      stringsAsFactors = FALSE
    )
  )

  inst <- list(survey = survey, choices = choices, orders_list = NULL)

  d1 <- reporte_dimensiones(
    data = dat,
    instrumento = inst,
    vars = c("p1", "p2", "p3"),
    prefijo = "r100_",
    reemplazar = FALSE,
    orden_por_lista = list(sat = c("1", "2", "3", "4", "5"))
  )

  d2 <- reporte_dimensiones_indices(
    data = d1,
    subindices = list(
      subindice("s1", "S1", c("r100_p1")),
      subindice("s2", "S2", c("r100_p2")),
      subindice("s3", "S3", c("r100_p3"))
    ),
    indices = list(
      indice("idx", "Indice", c("s1", "s2", "s3"))
    )
  )

  list(data = d2, instrumento = inst)
}

test_that("graficar_heatmap_criterios_dimensiones construye metadata util", {
  fx <- make_dimensiones_criterios_fixture()

  p <- graficar_heatmap_criterios_dimensiones(
    data = fx$data,
    instrumento = fx$instrumento,
    config_criterios = list(
      list(id = "trato", titulo = "Trato", vars = c("r100_p1", "r100_p2")),
      list(id = "ambiente", titulo = "Ambiente", vars = c("r100_p3"))
    ),
    alineacion_criterios = "centrado",
    mostrar_titulo_conductor = TRUE,
    mostrar_icono_conductor = FALSE,
    size_texto_criterio = 3.1,
    size_titulo_conductor = 11,
    exportar = "rplot"
  )

  expect_s3_class(p, "ggplot")
  meta <- attr(p, "dim_heatmap_criterios_meta", exact = TRUE)
  expect_true(is.list(meta))
  expect_identical(meta$alineacion_criterios, "centrado")
  expect_true(isTRUE(meta$mostrar_titulo_conductor))
  expect_equal(meta$size_texto_criterio, 3.1)
  expect_equal(meta$size_titulo_conductor, 11)
  expect_true(all(c("conductor_id", "criterio_var", "criterio_label") %in% names(meta$config_tbl)))
  expect_equal(length(unique(meta$config_tbl$conductor_id)), 2)
})

test_that("p_dim_heatmap_criterios renderiza en slide_1 de PPT", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- make_dimensiones_criterios_fixture()

  plan <- list(
    diapo_001 = p_slide_portada("Titulo prueba"),
    diapo_002 = p_slide_1_grafico(
      titulo = "Criterios por conductor",
      grafico = p_dim_heatmap_criterios(
        config_criterios = list(
          list(id = "trato", titulo = "Trato", vars = c("r100_p1", "r100_p2")),
          list(id = "ambiente", titulo = "Ambiente", vars = c("r100_p3"))
        ),
        overrides = list(
          alineacion_criterios = "centrado",
          mostrar_titulo_conductor = TRUE,
          mostrar_icono_conductor = FALSE,
          color_texto = "#000000"
        )
      )
    )
  )

  out_ppt <- tempfile(fileext = ".pptx")
  expect_no_error(
    reporte_ppt_plan(
      data = fx$data,
      instrumento = fx$instrumento,
      plan = plan,
      presets = p_presets(),
      path_ppt = out_ppt,
      mensajes_progreso = FALSE
    )
  )
  expect_true(file.exists(out_ppt))
})
