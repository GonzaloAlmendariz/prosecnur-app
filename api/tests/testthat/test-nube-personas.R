# TXT-1/TXT-2 (plan-texto-abierto-ccss-2026-10-24): la nube del comentario final filtra no respuestas, agrupa
# flexiones, une frases y cuenta personas. Todo es opcional y está apagado por defecto: las nubes que ya existen
# (lámina 101 del recetario, Arte) no cambian sus cifras.

.nube_txt_fx <- function() {
  data.frame(txt = c(
    "-", ".", "no", "Ninguno", "nada", "Todo bien",
    "Más cursos prácticos, deberían abrir cursos", "Considero que el curso de métodos es bueno",
    "cursos con horarios", "La biblioteca de sociales cierra temprano", "Biblioteca de sociales sin enchufes",
    "más horas en la biblioteca de sociales", "No hay enchufes en las aulas", "aulas sin enchufes",
    "Mejorar el vínculo laboral", "Prácticas laborales", "bolsa laboral para estudiantes", "estudiantes cansados",
    "los estudiantes necesitan apoyo"), stringsAsFactors = FALSE)
}

test_that("por defecto la nube cuenta como siempre: menciones, sin filtro ni raíz", {
  d <- .nube_txt_fx()
  e <- attr(graficar_nube_palabras(d, var_texto = "txt"), "pulso_espec")
  expect_identical(e$ranking$respuestas, 17L)                       # «-» y «.» se van por no tener letras, como antes
  expect_null(e$ranking$unidad)
  expect_identical(e$lectura, "El tamaño crece con las menciones")
  expect_true("cursos" %in% e$ranking$palabras)
})

test_that("con filtro, raíz y personas el ranking cuenta personas sobre los comentarios con contenido", {
  d <- .nube_txt_fx()
  p <- graficar_nube_palabras(d, var_texto = "txt", filtrar_no_respuestas = TRUE, lematizar = TRUE, contar = "personas",
                              min_personas = 2)
  rk <- attr(p, "pulso_espec")$ranking
  expect_identical(rk$unidad, "personas")
  expect_identical(rk$escribieron, 19L)
  expect_identical(rk$con_contenido, 13L)
  expect_identical(rk$respuestas, 13L)
  n <- stats::setNames(rk$n, rk$palabras)
  expect_identical(unname(n["cursos"]), 3)                          # tres personas; cuatro apariciones
  expect_identical(unname(n["laboral"]), 3)                         # laboral + laborales
  expect_identical(unname(n["estudiantes"]), 3)
  expect_true("biblioteca de sociales" %in% rk$palabras)            # la frase entra al ranking como un término
  expect_false(any(c("no", "deberían", "considero", "ninguno", "nada") %in% rk$palabras))
  expect_true(all(rk$n >= 2))
  lec <- attr(p, "pulso_espec")$lectura
  expect_true(any(grepl("personas", lec)))
  expect_true(any(grepl("Sin ponderar", lec)))
})

test_that("contar personas no pondera aunque haya peso por fila", {
  d <- .nube_txt_fx(); d$w <- 5
  rk <- attr(graficar_nube_palabras(d, var_texto = "txt", var_n = "w", filtrar_no_respuestas = TRUE, lematizar = TRUE,
                                    contar = "personas", min_personas = 2), "pulso_espec")$ranking
  expect_identical(unname(stats::setNames(rk$n, rk$palabras)["cursos"]), 3)
})

test_that("la lámina rotula comentarios con contenido de cuántos escribieron algo, y la columna de personas", {
  skip_if_not_installed("officer")
  d <- .nube_txt_fx()
  inst <- list(survey = data.frame(name = "txt", type = "text", list_name = NA, label = "Comentario final", stringsAsFactors = FALSE),
               choices = data.frame(list_name = character(), name = character(), label = character()), orders_list = NULL)
  out <- tempfile(fileext = ".pptx")
  ov <- list(filtrar_no_respuestas = TRUE, lematizar = TRUE, contar = "personas", min_personas = 2)
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = d, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE,
    plan = p_plan(slides = list(p_slide_1_grafico(p_nube_palabras("txt", overrides = ov), titulo = "Limpia"),
                                p_slide_1_grafico(p_nube_palabras("txt"), titulo = "Como antes"))))))
  xml <- function(k) xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k)))
  txt <- function(k, n) xml2::xml_text(xml2::xml_find_all(xml(k), sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
  expect_identical(txt(1, "ranking:respuestas"), "13 comentarios con contenido (de 19 que escribieron algo)")
  expect_identical(txt(1, "ranking:menciones"), "personas")
  expect_true("biblioteca de sociales" %in% txt(1, "ranking:palabra"))
  todo1 <- paste(xml2::xml_text(xml2::xml_find_all(xml(1), "//a:t")), collapse = " | ")
  expect_match(todo1, "Base: 13", fixed = TRUE)                      # la base son los comentarios con contenido
  expect_match(todo1, "Sin ponderar", fixed = TRUE)
  # La nube de siempre conserva su rótulo y su base.
  expect_identical(txt(2, "ranking:respuestas"), "17 respuestas abiertas")
  expect_identical(txt(2, "ranking:menciones"), "menciones")
  expect_match(paste(xml2::xml_text(xml2::xml_find_all(xml(2), "//a:t")), collapse = " | "), "Base: 17", fixed = TRUE)
})

test_that("los argumentos nuevos se ofrecen en la UI y viajan por overrides", {
  args <- .GRAFICADORES_META$p_nube_palabras$args
  nm <- vapply(args, function(a) as.character(a$name), character(1))
  nuevos <- c("filtrar_no_respuestas", "lematizar", "contar", "min_personas")
  expect_true(all(nuevos %in% nm))
  for (a in args[nm %in% nuevos]) expect_true(isTRUE(a$via_overrides), info = a$name)
  def <- stats::setNames(lapply(args, `[[`, "default"), nm)
  expect_false(isTRUE(def$filtrar_no_respuestas)); expect_false(isTRUE(def$lematizar)); expect_identical(def$contar, "menciones")
  expect_true(all(c(nuevos, "equivalencias") %in% names(formals(graficar_nube_palabras))))
})
