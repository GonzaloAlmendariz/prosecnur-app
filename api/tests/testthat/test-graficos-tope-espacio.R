source("setup-load-all.R")

# E3 (prueba con Arte, 2026-11-09): nunca una imagen ilegible. Si las filas no caben en la lámina nativa, se muestran las
# que caben en el orden de la regla y el pie lo dice; la escala del resumen ya no sale como imagen por tener más filas.

test_that("el contraste de 40 pares muestra los 14 de mayor diferencia y lo dice", {
  temas <- sprintf("Tema %02d", 1:40)
  dif <- c(seq(40, 2, length.out = 39), -50)   # el último tiene la mayor diferencia absoluta, con signo negativo
  d <- data.frame(eje = factor(rep(temas, 2), levels = temas), grupo = factor(rep(c("A", "B"), each = 40), levels = c("A", "B")),
                  valor = c(50 + dif / 2, 50 - dif / 2), stringsAsFactors = FALSE)
  r <- suppressMessages(.contraste_tope_espacio(d))
  quedan <- unique(as.character(r$datos$eje))
  expect_length(quedan, 14L)
  expect_true("Tema 40" %in% quedan)              # |−50| entra: la diferencia va en valor absoluto
  expect_identical(quedan[1:3], c("Tema 01", "Tema 02", "Tema 03"))   # en el orden declarado
  expect_identical(r$texto, "Por espacio, se muestran las 14 de mayor diferencia de 40; el resto en otra lámina.")
  # Con tres grupos caben 7 (27 sub-filas) y con cuatro, 5; con lo que cabe no se toca nada.
  expect_identical(.contraste_tope_filas(3L), 7L); expect_identical(.contraste_tope_filas(4L), 5L)
  pocos <- d[as.character(d$eje) %in% temas[1:10], ]
  expect_null(.contraste_tope_espacio(pocos)$texto)
})

test_that("la escala del resumen recorta en el orden de la regla y nombra el criterio", {
  v <- paste0("b$p", 1:22)
  r <- suppressMessages(.divergentes_tope_espacio(v, list(tipo = "bajo_umbral", umbral = 60)))
  expect_identical(r$vars, v[1:20])
  expect_identical(r$texto, "Se muestran las 20 más bajas de las 22 bajo 60%; el resto en otra lámina.")   # P7: una frase
  expect_match(suppressMessages(.divergentes_tope_espacio(v, list(tipo = "mayor_sin_info", n = 22)))$texto, "20 con más Sin información de las 22 elegidas")
  expect_match(suppressMessages(.divergentes_tope_espacio(v, NULL))$texto, "las primeras 20 de 22")
  expect_null(.divergentes_tope_espacio(v[1:20], NULL)$texto)
  # Más filas que el tope ya no es causa de imagen; dos columnas «Sin información» sí.
  expect_null(.divergentes_aviso_tope(22, "Se muestran las 22 bajo 60%, de 157 preguntas de escala."))
  expect_match(.divergentes_aviso_tope(5, NULL, 2L), "sale como imagen")
  expect_match(.divergentes_aviso_espacio(22, list(tipo = "bajo_umbral", umbral = 60)), "admite 20: se muestran las 20 más bajas de las 22 bajo 60%")
})

test_that("en el render el contraste de muchos pares sale nativo con el recorte al pie, sin imagen", {
  skip_if_not_installed("officer")
  rot <- sprintf("Pregunta número %02d del estudio", 1:30)
  inst <- list(survey = data.frame(name = paste0("p", 1:30), type = "select_one lk", list_name = "lk", label = rot, stringsAsFactors = FALSE),
               choices = data.frame(list_name = "lk", name = c("1", "2", "3", "4"), label = c("Nada", "Poco", "Algo", "Mucho"), stringsAsFactors = FALSE))
  base <- function(n, p) { d <- as.data.frame(lapply(p, function(t) { k <- round(n * t); c(rep("4", k), rep("1", n - k)) })); names(d) <- paste0("p", 1:30); d }
  src <- list(data_sources = list(a = base(100, seq(0.3, 0.9, length.out = 30)), b = base(100, rev(seq(0.3, 0.9, length.out = 30)))),
              inst_sources = list(a = inst, b = inst))
  vars <- stats::setNames(lapply(1:30, function(i) c(paste0("a$p", i), paste0("b$p", i))), rot)
  plan <- p_plan(slides = list(p_slide_1_grafico(p_dumbbell(vars = vars, corte = c("3", "4"), estilo = "resumen"), titulo = "Contraste")))
  f <- tempfile(fileext = ".pptx"); on.exit(unlink(f), add = TRUE)
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan, path_ppt = f,
                                                     mensajes_progreso = FALSE)))
  xml <- .pptx_leer_parte(f, .pptx_slide_paths(f)[1])
  txt <- paste(xml2::xml_text(xml2::xml_find_all(xml2::read_xml(xml), "//a:t")), collapse = " ")
  expect_match(txt, "Por espacio, se muestran las 14 de mayor diferencia de 30; el resto en otra lámina.", fixed = TRUE)
  expect_true(grepl("prosecnur:grafico:contraste", xml, fixed = TRUE))   # nativa: el contraste con piezas, no una imagen
})
