source("setup-load-all.R")

# F6.0b: la vista previa dice cuántas partes salió la lámina y si cada una es nativa (inventario F6, parte C).

.pl_mini_pptx <- function() {
  doc <- officer::read_pptx()
  # 1: nativa — el motor deja su gráfico como `prosecnur:grafico:<tipo>`
  doc <- officer::add_slide(doc, layout = "Blank", master = "Office Theme")
  doc <- officer::ph_with(doc, "Utilidad de los objetivos educacionales",
                          location = officer::ph_location(left = 0.5, top = 0.4, width = 8, height = 0.8, newlabel = "prosecnur:titulo"))
  doc <- officer::ph_with(doc, "97 %", location = officer::ph_location(left = 0.5, top = 1.5, width = 8, height = 4, newlabel = "prosecnur:grafico:escala"))
  # 2: continuación por la ruta anterior — el gráfico pegado como imagen
  png <- tempfile(fileext = ".png"); grDevices::png(png, 400, 240); graphics::par(mar = c(0, 0, 0, 0)); graphics::plot.new(); grDevices::dev.off()
  doc <- officer::add_slide(doc, layout = "Blank", master = "Office Theme")
  doc <- officer::ph_with(doc, "Utilidad de los objetivos educacionales (cont.)", location = officer::ph_location(left = 0.5, top = 0.4, width = 8, height = 0.8))
  doc <- officer::ph_with(doc, officer::external_img(png, 4, 2.4), location = officer::ph_location(left = 1, top = 1.5, width = 4, height = 2.4))
  # 3: sólo texto
  doc <- officer::add_slide(doc, layout = "Blank", master = "Office Theme")
  doc <- officer::ph_with(doc, "Conclusiones", location = officer::ph_location(left = 0.5, top = 0.4, width = 8, height = 0.8))
  # 4: estructura del motor sin gráfico (objetivo): su título vive en `objetivo:titulo` y el cuerpo es más largo
  doc <- officer::add_slide(doc, layout = "Blank", master = "Office Theme")
  doc <- officer::ph_with(doc, "OBJETIVO", location = officer::ph_location(left = 0.5, top = 0.4, width = 3, height = 0.8, newlabel = "objetivo:titulo"))
  doc <- officer::ph_with(doc, "Conocer la percepción de los estudiantes sobre el servicio educativo de la carrera",
                          location = officer::ph_location(left = 0.5, top = 1.5, width = 8, height = 2, newlabel = "prosecnur:objetivo"))
  f <- tempfile(fileext = ".pptx"); print(doc, target = f); f
}

test_that("las partes salen en orden, con su título, su continuación y si son nativas", {
  f <- .pl_mini_pptx()
  p <- .preview_partes(f)
  expect_equal(p$n, 4L)
  expect_equal(vapply(p$partes, `[[`, "", "estado"), c("nativa", "ruta_anterior", "sin_grafico", "estructura"))
  expect_equal(vapply(p$partes, `[[`, logical(1), "continuacion"), c(FALSE, TRUE, FALSE, FALSE))
  expect_equal(p$partes[[1]]$titulo, "Utilidad de los objetivos educacionales")
  expect_equal(p$partes[[4]]$titulo, "OBJETIVO")                    # no el cuerpo, que es más largo (verificador de 55ff0d1bf)
  expect_equal(vapply(p$partes, `[[`, integer(1), "indice"), 1:4)
})

test_that("un archivo que no se puede leer da cero partes, no un error", {
  expect_equal(.preview_partes(tempfile(fileext = ".pptx"))$n, 0L)
})

test_that("el orden es el de la presentación aunque los archivos de lámina estén numerados distinto", {
  f <- .pl_mini_pptx()
  d <- tempfile(); utils::unzip(f, exdir = d)
  pres <- file.path(d, "ppt/presentation.xml")
  x <- paste(readLines(pres, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  ids <- regmatches(x, gregexpr("<p:sldId [^>]*/>", x))[[1]]
  expect_length(ids, 4L)
  for (i in seq_along(ids)) x <- sub(ids[[i]], sprintf("@@%d@@", i), x, fixed = TRUE)   # la presentación invierte el orden
  for (i in seq_along(ids)) x <- sub(sprintf("@@%d@@", i), rev(ids)[[i]], x, fixed = TRUE)
  writeLines(x, pres, useBytes = TRUE)
  g <- tempfile(fileext = ".pptx")
  old <- setwd(d); on.exit(setwd(old), add = TRUE)
  utils::zip(g, list.files(".", recursive = TRUE, all.files = TRUE), flags = "-q -X")
  setwd(old)
  expect_equal(vapply(.preview_partes(g)$partes, `[[`, "", "estado"), c("estructura", "sin_grafico", "ruta_anterior", "nativa"))
})

test_that("se rasterizan todas las partes, no sólo la primera", {
  skip_if_not(isTRUE(.preview_renderer_status()$available), "sin renderer de vista previa")
  skip_if_not(nzchar(Sys.which("pdftoppm")) || requireNamespace("pdftools", quietly = TRUE) || .artifact_renderer_configured(),
              "sin rasterizador de PDF")
  f <- .pl_mini_pptx()
  r <- .render_pptx_preview_partes(f, 4L)
  expect_length(r, 4L)
  expect_true(all(vapply(r, function(x) grepl("^data:image/png;base64,", x$png_base64), logical(1))))
  expect_equal(vapply(r, `[[`, integer(1), "indice"), 1:4)
  expect_false(attr(r, "truncado"))
  r2 <- .render_pptx_preview_partes(f, 4L, max_partes = 2L)
  expect_length(r2, 2L)
  expect_true(attr(r2, "truncado"))
})

test_that("una parte que falla deja su hueco: la k-ésima imagen sigue siendo la parte k", {
  local_mocked_bindings(
    .artifact_renderer_configured = function() FALSE,
    .pptx_to_pdf_soffice = function(...) "x.pdf",
    .pdf_page_to_png = function(pdf_path, out_dir, renderer, page = 1L, ...) if (page == 2L) NULL else list(png_base64 = "data:image/png;base64,AA", width = 1L, height = 1L, renderer = "soffice")
  )
  r <- .render_pptx_preview_partes("x.pptx", 3L, max_partes = 3L)
  expect_length(r, 3L)
  expect_null(r[[2]])
  expect_equal(r[[3]]$indice, 3L)
})

test_that("la URI del perfil codifica espacios y tildes y conserva las barras", {
  expect_equal(.preview_profile_uri("/tmp/Juan Pérez/lo-profile"), "file:///tmp/Juan%20P%C3%A9rez/lo-profile")
  expect_match(.preview_profile_uri("C:/Users/Ana María/x"), "^file:///C:/Users/Ana%20Mar%C3%ADa/x$")
  expect_equal(.preview_arg("a b"), if (.Platform$OS.type == "windows") "\"a b\"" else "'a b'")
})

test_that("la vista previa sale aunque la ruta tenga espacios y tildes (P1)", {
  skip_if_not(nzchar(.soffice_cmd()), "sin LibreOffice")
  skip_if_not(nzchar(Sys.which("pdftoppm")), "sin pdftoppm")
  local_mocked_bindings(.artifact_renderer_configured = function() FALSE)
  dir <- file.path(tempdir(), "Juan Pérez con espacio"); dir.create(dir, showWarnings = FALSE)
  f <- file.path(dir, "lámina de prueba.pptx"); file.copy(.pl_mini_pptx(), f, overwrite = TRUE)
  r <- .render_pptx_preview_partes(f, 1L)
  expect_length(r, 1L)
  expect_match(r[[1]]$png_base64, "^data:image/png;base64,")
})

test_that("pdftools rasteriza sin pdftoppm (P2): lo que viaja en el instalador", {
  skip_if_not(nzchar(.soffice_cmd()), "sin LibreOffice")
  skip_if_not_installed("pdftools")
  local_mocked_bindings(.artifact_renderer_configured = function() FALSE, .first_available_cmd = function(...) "")
  r <- .render_pptx_preview_partes(.pl_mini_pptx(), 4L, max_partes = 4L)
  expect_length(r, 4L)
  expect_true(all(vapply(r, function(x) identical(x$renderer, "soffice+pdftools"), logical(1))))
  expect_gt(r[[1]]$width, 500)
})

test_that("con LibreOffice y sin rasterizador, la vista previa no se declara disponible (P3)", {
  local_mocked_bindings(
    .artifact_renderer_configured = function() FALSE,
    .soffice_cmd = function() "/opt/lo/soffice",
    .preview_rasterizer_status = function() list(available = FALSE, id = NA_character_)
  )
  st <- .preview_renderer_status()
  expect_false(st$available)
  expect_match(st$message, "rasterizador", fixed = TRUE)
  local_mocked_bindings(.preview_rasterizer_status = function() list(available = TRUE, id = "pdftools"))
  st <- .preview_renderer_status()
  expect_true(st$available)
  expect_identical(st$rasterizer, "pdftools")
})

test_that("la vista previa hereda el antetítulo del separador vigente, como el export (F6.0b.2)", {
  plan <- list(
    list(id = "s1", tipo = "p_slide_portada", payload = list(titulo = "Estudio")),
    list(id = "s2", tipo = "p_slide_seccion", payload = list(titulo = "PERFIL DEL ENCUESTADO")),
    list(id = "s3", tipo = "p_slide_1_grafico", payload = list(titulo = "Sexo")),
    list(id = "s4", tipo = "p_slide_seccion", payload = list(titulo = "CARACTERISTICA INSTITUCIONALES")),
    list(id = "s5", tipo = "p_slide_1_grafico", payload = list(titulo = "Misión"))
  )
  expect_equal(.preview_con_antetitulo(plan[[5]], plan)$payload$meta$antetitulo, "CARACTERISTICA INSTITUCIONALES")
  expect_equal(.preview_con_antetitulo(plan[[3]], plan)$payload$meta$antetitulo, "PERFIL DEL ENCUESTADO")
  expect_null(.preview_con_antetitulo(plan[[1]], plan)$payload$meta)                       # antes de cualquier separador
  expect_null(.preview_con_antetitulo(plan[[4]], plan)$payload$meta)                       # el separador no se hereda a sí mismo
  propio <- list(id = "s5", tipo = "p_slide_1_grafico", payload = list(titulo = "Misión", meta = list(antetitulo = "MÍO")))
  expect_equal(.preview_con_antetitulo(propio, plan)$payload$meta$antetitulo, "MÍO")        # lo fijado gana
  expect_null(.preview_con_antetitulo(list(id = "x", tipo = "p_slide_1_grafico", payload = list()), plan)$payload$meta)
})

test_that("los avisos sellados del motor vuelven con la vista previa, sin repetir, y los demás mensajes siguen (F6.0b.1)", {
  r <- NULL
  expect_message(r <- .preview_con_avisos({
    .pulso_aviso("La columna «top2box» se omite: faltan las categorías.")
    .pulso_aviso("La columna «top2box» se omite: faltan las categorías.")
    message("progreso normal")
    42
  }), "progreso normal")
  expect_equal(r$valor, 42)
  expect_equal(r$avisos, "La columna «top2box» se omite: faltan las categorías.")
  expect_equal(.preview_con_avisos(1)$avisos, character(0))
})

test_that("el perfil de LibreOffice se reutiliza entre conversiones y, si está tomado, la conversión usa uno propio", {
  raiz <- tempfile("raiz"); dir.create(raiz)
  a <- .preview_perfil_tomar(tempfile("o1"), raiz = raiz)
  expect_true(a$compartido)
  b <- .preview_perfil_tomar(o2 <- tempfile("o2"), raiz = raiz)
  expect_false(b$compartido); expect_identical(b$dir, file.path(o2, "lo-profile")); expect_true(dir.exists(b$dir))
  a$liberar()
  c <- .preview_perfil_tomar(tempfile("o3"), raiz = raiz)
  expect_true(c$compartido); expect_identical(c$dir, a$dir)
  c$liberar()
})

test_that("un perfil compartido de LibreOffice dañado se rehace y la conversión sale igual", {
  skip_if_not(nzchar(.soffice_cmd()), "sin LibreOffice")
  doc <- officer::read_pptx(); doc <- officer::add_slide(doc, layout = "Title and Content"); f <- tempfile(fileext = ".pptx"); print(doc, target = f)
  raiz <- tempfile("raiz"); dir.create(file.path(raiz, "prosecnur-lo-perfil", "user"), recursive = TRUE)
  for (x in c("registrymodifications.xcu", "basura.dat")) writeBin(as.raw(sample(0:255, 4096, TRUE)), file.path(raiz, "prosecnur-lo-perfil", "user", x))
  local_mocked_bindings(.preview_perfil_tomar = function(out_dir, raiz_ = raiz) {
    compartido <- file.path(raiz, "prosecnur-lo-perfil"); list(dir = compartido, compartido = TRUE, liberar = function() invisible(NULL)) })
  orig <- base::system2
  local_mocked_bindings(system2 = local({ n <- 0L; function(...) { n <<- n + 1L; if (n == 1L) stop("perfil dañado"); orig(...) } }), .package = "base")
  expect_true(file.exists(.pptx_to_pdf_soffice(f, tempfile("pv"), timeout = 60L)))
})

test_that("una imagen pegada en una ranura del motor es ruta anterior, no nativa", {
  pic <- '<p:pic><p:nvPicPr><p:cNvPr id="4" name="prosecnur:slide_1:right"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill/></p:pic>'
  titulo <- '<p:sp><p:nvSpPr><p:cNvPr id="2" name="prosecnur:titulo"/></p:nvSpPr></p:sp>'
  expect_identical(.pptx_lamina_estado(paste0(titulo, pic)), "ruta_anterior")
  expect_identical(.pptx_lamina_estado(pic), "ruta_anterior")
  nativo <- '<p:grpSp><p:nvGrpSpPr><p:cNvPr id="5" name="prosecnur:grafico:escala"/></p:nvGrpSpPr></p:grpSp>'
  expect_identical(.pptx_lamina_estado(paste0(titulo, nativo, pic)), "nativa")
  expect_identical(.pptx_lamina_estado(titulo), "estructura")
})

test_that("un perfil compartido que cuelga a LibreOffice (timeout) se descarta para la siguiente vista previa", {
  raiz <- tempfile("raiz"); compartido <- file.path(raiz, "prosecnur-lo-perfil"); dir.create(file.path(compartido, "user"), recursive = TRUE)
  local_mocked_bindings(.soffice_cmd = function() "soffice-falso",
                        .preview_perfil_tomar = function(out_dir, raiz_ = raiz) list(dir = compartido, compartido = TRUE, liberar = function() invisible(NULL)))
  llamadas <- 0L
  local_mocked_bindings(system2 = function(...) { llamadas <<- llamadas + 1L; Sys.sleep(1.1); stop("timeout") }, .package = "base")
  f <- tempfile(fileext = ".pptx"); file.create(f)
  expect_null(.pptx_to_pdf_soffice(f, tempfile("pv"), timeout = 1))
  expect_identical(llamadas, 1L)                      # tras un timeout no se reintenta (no duplicar la espera)
  expect_false(dir.exists(compartido))                # pero el perfil se descarta
})
