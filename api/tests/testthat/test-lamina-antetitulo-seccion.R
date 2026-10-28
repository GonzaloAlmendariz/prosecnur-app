# El nombre de la sección sobre el título: opción global, apagada por defecto (lamina_antetitulo_seccion.R).

test_that("por defecto la lámina no hereda el nombre de la sección; lo que fija la lámina sale igual", {
  withr::local_options(prosecnur.lam_antetitulo_seccion = NULL)
  plan <- list(p_slide_seccion("Principales resultados"),
               p_slide_texto("Misión y visión de la PUCP", texto = "a"),
               p_slide_texto("Propia", texto = "b", meta = list(antetitulo = "Cómo leer este informe")),
               p_slide_seccion("Misión y propósitos", meta = list(nivel = "subcapitulo", variante = "sin_lamina")),
               p_slide_texto("Tras el subcapítulo", texto = "c"))
  ante <- .lam_antetitulos(plan)
  expect_true(is.na(ante[[2]]))
  expect_identical(ante[[3]], "Cómo leer este informe")
  expect_true(is.na(ante[[5]]))   # el anuncio «n.m  Título» también es el nombre de la sección
  # Activada: sale como antes.
  withr::local_options(prosecnur.lam_antetitulo_seccion = TRUE)
  ante <- .lam_antetitulos(plan)
  expect_identical(ante[[2]], "Principales resultados")
  expect_identical(ante[[5]], "1.1  Misión y propósitos")
})

test_that("en la ruta real la lámina sale sin antetítulo por defecto y con el de su sección si se activa", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  niveles <- c("Sí", "No")
  dat <- data.frame(p1 = rep(niveles, c(63, 37)), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = "p1", type = "select_one sn", list_name = "sn", label = "¿Conoce la misión?",
                                   stringsAsFactors = FALSE),
               choices = data.frame(list_name = "sn", name = niveles, label = niveles, stringsAsFactors = FALSE), orders_list = NULL)
  plan <- list(s = p_slide_seccion(titulo = "Principales resultados"),
               g = p_slide_1_grafico(grafico = p_barras_apiladas("p1"), titulo = "Misión y visión de la PUCP"))
  ante_de <- function() {
    out <- tempfile(fileext = ".pptx"); on.exit(unlink(out))
    suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = plan,
      presets = p_presets(barras_apiladas = .PRESETS_DEFAULT_PULSO$barras_apiladas), path_ppt = out, mensajes_progreso = FALSE)))
    n <- length(officer::read_pptx(out))
    xml <- xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", n)))
    paste(xml2::xml_text(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='Antetitulo lamina']]")), collapse = "")
  }
  withr::with_options(list(prosecnur.lam_antetitulo_seccion = NULL), expect_false(grepl("PRINCIPALES", ante_de())))
  withr::with_options(list(prosecnur.lam_antetitulo_seccion = TRUE), expect_match(ante_de(), "PRINCIPALES RESULTADOS"))
})

test_that("estilo_cliente.antetitulo_seccion: true o false; encendida viaja al worker del PPT y apagada no", {
  expect_silent(.graficos_estilo_cliente_validar(list(antetitulo_seccion = TRUE)))
  expect_silent(.graficos_estilo_cliente_validar(list(antetitulo_seccion = FALSE)))
  err <- tryCatch(.graficos_estilo_cliente_validar(list(antetitulo_seccion = "si")), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_BAD_ESTILO_CLIENTE")
  expect_null(.graficos_estilo_cliente_resolver("sin-sesion", list(estilo_cliente = list(antetitulo_seccion = FALSE)))$antetitulo_seccion)
  r <- .graficos_estilo_cliente_resolver("sin-sesion", list(estilo_cliente = list(antetitulo_seccion = TRUE)))
  expect_true(r$antetitulo_seccion)
  withr::local_options(prosecnur.lam_antetitulo_seccion = NULL)
  ec <- .graficos_estilo_cliente_iniciar(r, "ppt")
  expect_true(.lam_antetitulo_seccion_activo())
  options(ec$previas)
  expect_false(.lam_antetitulo_seccion_activo())
  ec <- .graficos_estilo_cliente_iniciar(r, "word")
  expect_false(.lam_antetitulo_seccion_activo())   # el Word no tiene antetítulo
  options(ec$previas)
})
