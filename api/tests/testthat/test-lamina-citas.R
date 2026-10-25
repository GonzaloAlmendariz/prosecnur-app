# TXT-4 (plan-texto-abierto-ccss-2026-10-24): la lámina nativa de citas representativas. Comillas tipográficas grandes
# en coral, texto de 14 a 16 pt, una línea fina entre citas y «Base: N comentarios con contenido» al pie. Dibuja las
# aprobadas (`citas_aprobadas`); sin aprobadas, propone un borrador que lo dice en la lámina. Fixture sintético.

.lc_fx <- function() {
  data.frame(coment = c(
    "-", "no", "Ninguno",
    "La biblioteca de sociales debería abrir más horas, porque los espacios de estudio no alcanzan en época de exámenes.",
    "Faltan espacios de estudio con enchufes; la biblioteca se llena desde temprano y no hay dónde trabajar en grupo.",
    "Los cursos de métodos deberían tener más práctica con bases de datos reales y menos teoría repetida de otros cursos.",
    "Me gustó el curso porque la profesora Rosales explicó muy bien los métodos cualitativos y el trabajo de campo.",
    "Como dice Bourdieu, el capital cultural pesa: necesitamos tutorías para quienes vienen de colegios públicos.",
    "Los horarios de los cursos electivos se cruzan con los obligatorios y no dejan elegir lo que uno quiere estudiar."),
    coment_recod = c(NA, NA, NA, "A", "A C", "B", "B", "C", "B"), stringsAsFactors = FALSE)
}
.lc_inst <- function() {
  list(survey = data.frame(name = c("coment", "coment_recod"), type = c("text", "text"), list_name = NA,
                           label = c("Comentario final", "Tema"), stringsAsFactors = FALSE),
       choices = data.frame(list_name = character(), name = character(), label = character()), orders_list = NULL)
}
.lc_render <- function(slides) {
  out <- tempfile(fileext = ".pptx")
  msgs <- character(0)
  withCallingHandlers(
    suppressWarnings(reporte_ppt_plan(data = .lc_fx(), instrumento = .lc_inst(), path_ppt = out, mensajes_progreso = FALSE,
                                      plan = p_plan(slides = slides))),
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  list(path = out, avisos = msgs)
}
.lc_xml <- function(path, k) xml2::read_xml(unz(path, sprintf("ppt/slides/slide%d.xml", k)))
.lc_txt <- function(x, nombre) xml2::xml_text(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre)))

test_that("p_citas arma el elemento con sus aprobadas como texto y el tope de cinco", {
  el <- p_citas("coment", citas_aprobadas = list("c0123456789", "c9876543210"), filtros = list(coment_recod = "B"))
  expect_s3_class(el, "ppt_element")
  expect_identical(el$.element_type, "citas")
  expect_identical(el$citas_aprobadas, c("c0123456789", "c9876543210"))
  expect_identical(el$max_citas, 5L)
  expect_identical(p_citas("coment", max_citas = 9)$max_citas, 5L)
  expect_identical(p_citas("coment", max_citas = 1)$max_citas, 3L)
  expect_error(p_citas(""), class = NULL)
})

test_that("p_citas está registrado: catálogo, salida nativa en la familia Texto, sin preset y en el catálogo del recetario", {
  expect_true("p_citas" %in% .graf_names())
  m <- .GRAFICADORES_META$p_citas
  expect_identical(m$familia_editor, "texto")
  expect_true(m$salida_nativa)
  expect_false(m$en_selector)                    # O3: entra al selector con su tarjeta de aprobación
  nm <- vapply(m$args, `[[`, "", "name")
  expect_true(all(c("var", "citas_aprobadas", "max_citas", "filtros") %in% nm))
  expect_true(all(setdiff(nm, "overrides") %in% names(formals(p_citas))))
  expect_identical(unname(.GRAFICADOR_PRESET_KEYS[["p_citas"]]), "")
  graf <- unlist(lapply(.catalogo_recetario_plan(), function(s) vapply(Filter(function(x) is.list(x) && !is.null(x$graficador), s$payload), function(x) x$graficador, "")))
  expect_true("p_citas" %in% graf)
})

test_that("sin aprobadas la lámina dibuja un borrador que dice «Citas sin aprobar» y lo avisa", {
  skip_if_not_installed("officer")
  r <- .lc_render(list(p_slide_1_grafico(p_citas("coment"), titulo = "Lo que dijeron")))
  x <- .lc_xml(r$path, 1)
  expect_length(xml2::xml_find_all(x, "//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:citas']]"), 1L)
  citas <- .lc_txt(x, "citas:texto")
  expect_gte(length(citas), 3L); expect_lte(length(citas), 5L)
  expect_match(.lc_txt(x, "citas:borrador"), "Citas sin aprobar", fixed = TRUE)
  expect_true(any(grepl("sin aprobar", r$avisos)))
  todo <- paste(xml2::xml_text(xml2::xml_find_all(x, "//a:t")), collapse = " | ")
  expect_match(todo, "Base: 6 comentarios con contenido", fixed = TRUE)
  # Comillas grandes en coral, texto entre 14 y 16 pt y una línea fina entre citas.
  com <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='citas:comillas']]")
  expect_length(com, length(citas))
  expect_identical(unique(xml2::xml_text(com)), "“")
  expect_identical(unique(xml2::xml_attr(xml2::xml_find_all(com, ".//a:srgbClr"), "val")), sub("#", "", .std_color("coral")))
  sz <- as.numeric(xml2::xml_attr(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='citas:texto']]//a:rPr"), "sz")) / 100
  expect_true(all(sz >= 14 & sz <= 16))
  expect_length(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='citas:separador']]"), length(citas) - 1L)
  # Lo que se dibuja no lleva atribución ni datos de contacto.
  expect_false(any(grepl("@|https?://", citas)))
})

test_that("con aprobadas dibuja ésas, en su orden, sin la marca de borrador; el tema filtra por su código", {
  skip_if_not_installed("officer")
  s <- .citas_seleccionar(.lc_fx()$coment[.lc_fx()$coment_recod %in% c("B")])
  ids <- s$candidatas$id[c(3, 1, 2)]
  r <- .lc_render(list(p_slide_1_grafico(p_citas("coment", citas_aprobadas = ids, filtros = list(coment_recod = "B")), titulo = "Cursos")))
  x <- .lc_xml(r$path, 1)
  expect_identical(.lc_txt(x, "citas:texto"), s$candidatas$texto[c(3, 1, 2)])
  expect_length(.lc_txt(x, "citas:borrador"), 0L)
  expect_false(any(grepl("sin aprobar", r$avisos)))
  todo <- paste(xml2::xml_text(xml2::xml_find_all(x, "//a:t")), collapse = " | ")
  expect_match(todo, "Base: 3 comentarios con contenido", fixed = TRUE)   # los tres del código B
  # La cita aprobada que nombra a una persona se avisa (no se borra).
  expect_true(any(grepl("Rosales", r$avisos)))
})

test_that("la espec lleva las candidatas con su id para la tarjeta de aprobación (O3)", {
  p <- graficar_citas(.citas_seleccionar(.lc_fx()$coment))
  e <- attr(p, "pulso_espec")
  expect_identical(e$tipo, "citas")
  expect_true(all(c("id", "texto", "revision", "propuesta", "puntaje") %in% names(e$candidatas)))
  expect_true(e$borrador)
  expect_s3_class(p, "ggplot")
})
