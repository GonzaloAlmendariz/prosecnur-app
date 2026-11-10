source("setup-load-all.R")

# ADR 0135, punto 6: fortalezas y alertas. Las n más altas y las n más bajas de un público, lado a lado; la regla por
# defecto es `extremos` y las cifras salen de la misma tabla de indicadores que la regla.

.fo_rep <- function(cnt) rep(c("1", "2", "3", "4", "5", "9"), cnt)
.fo_inst <- function() list(
  survey = data.frame(name = paste0("q", 1:6), type = "select_one lk", list_name = "lk",
                      label = c("Reglamentos", "Biblioteca", "Docentes", "Salud", "Tutoría", "Laboratorios"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = "lk", name = c("1", "2", "3", "4", "5", "9"),
                       label = c("Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo", "Sin información"),
                       stringsAsFactors = FALSE),
  orders_list = NULL)
# Top Two Box (4, 5) sobre 40: q1 75, q2 50, q3 90, q4 25, q5 60, q6 50 (empata con q2).
.fo_fuentes <- function() {
  d <- data.frame(q1 = .fo_rep(c(2, 3, 5, 15, 15, 0)), q2 = .fo_rep(c(4, 6, 6, 10, 10, 4)), q3 = .fo_rep(c(1, 1, 2, 18, 18, 0)),
                  q4 = .fo_rep(c(6, 8, 8, 5, 5, 8)), q5 = .fo_rep(c(4, 6, 6, 12, 12, 0)), q6 = .fo_rep(c(5, 5, 10, 10, 10, 0)),
                  stringsAsFactors = FALSE)
  otra <- d[1:10, ]
  list(data_sources = list(docentes = d, estudiantes = otra), inst_sources = list(docentes = .fo_inst(), estudiantes = .fo_inst()))
}

test_that("la especificación reparte por la cifra: las n más altas a la izquierda, el resto de menor a mayor", {
  d <- data.frame(rotulo = c("A", "B", "C", "D", "E"), valor = c(50.2, 91, 49.6, 12, 70), orden = 1:5)
  e <- .espec_fortalezas(d, var_orden = "orden", n = 2, publico = "Docentes", nota_base = "Base: Docentes 40")
  expect_identical(e$version, "fortalezas/1")
  expect_identical(e$columnas[[1]]$titulo, "Más altas"); expect_identical(e$columnas[[2]]$titulo, "Más bajas")
  expect_identical(e$columnas[[1]]$rotulos, c("B", "E"))
  # A y C se leen 50: desempata el instrumento (A primero); D es la más baja y va arriba.
  expect_identical(e$columnas[[2]]$rotulos, c("D", "A", "C"))
  expect_identical(e$columnas[[2]]$cifras, c("12%", "50%", "50%"))
  # Los tonos son los del estándar: el verde del Top Two Box y el naranja de la paleta Likert, sin semáforo.
  expect_identical(e$columnas[[1]]$color, .std_color("verde_top_two_box"))
  expect_identical(e$columnas[[2]]$color, unname(.std_paleta("likert"))[1])
  expect_false(any(c(e$columnas[[1]]$color, e$columnas[[2]]$color) %in% unlist(.std_valor("ppt", "paletas", "semaforo")[c("rojo", "ambar", "verde")])))
})

test_that("el constructor es de un público, con la regla extremos por defecto", {
  el <- p_fortalezas(vars = "docentes$*", corte = c("4", "5"), n = 3)
  expect_identical(el$.element_type, "fortalezas")
  expect_identical(el$regla$tipo, "extremos"); expect_identical(el$regla$n, 3L)
  el2 <- p_fortalezas(vars = "docentes$*", corte = c("4", "5"), regla = list(tipo = "bajo_umbral", umbral = 60))
  expect_identical(el2$regla$tipo, "bajo_umbral")
  expect_error(p_fortalezas(vars = c("docentes$q1", "estudiantes$q1"), corte = "4"), "un solo público")
  expect_error(p_fortalezas(vars = "docentes$*", corte = "4", n = 0), "de 1 a 10")
  expect_error(p_fortalezas(vars = "q1", corte = "4"), "base\\$variable")
  # Una regla que compara grupos no tiene con qué en un público.
  r <- tryCatch(.regla_preguntas_de_elemento(p_fortalezas(vars = "docentes$*", corte = c("4", "5"), regla = list(tipo = "comunes")), .fo_fuentes()),
                api_error = function(e) e$code)
  expect_identical(r, "E_REGLA_PREGUNTAS_INVALIDA")
})

test_that("en la ruta real las cifras son las de la regla y la nota lleva la base del público y la regla", {
  skip_if_not_installed("ggplot2")
  src <- .fo_fuentes()
  el <- p_fortalezas(vars = "docentes$*", corte = c("4", "5"), n = 2, universos = "Docentes: 50")
  plan <- p_plan(slides = list(p_slide_1_grafico(el, titulo = "Fortalezas")))
  salida <- suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                              solo_lista = TRUE, mensajes_progreso = FALSE))
  e <- attr(salida$rendered[[1]], "pulso_espec")
  expect_identical(e$tipo, "fortalezas")
  expect_identical(e$columnas[[1]]$rotulos, c("Docentes", "Reglamentos"))
  expect_identical(e$columnas[[1]]$cifras, c("90%", "75%"))
  # Biblioteca y Laboratorios empatan en 50: la regla toma la primera del instrumento entre las bajas.
  expect_identical(e$columnas[[2]]$rotulos, c("Salud", "Biblioteca"))
  expect_identical(e$nota_base, "Base: 40 docentes")                          # sólo n, sin cobertura (Gonzalo, 2026-11-10)
  expect_identical(e$texto_regla, "Se muestran las 2 más altas y las 2 más bajas, de 6 preguntas de escala.")
  # Las mismas cifras que la regla mide para el contador del inspector.
  r <- .regla_preguntas_conteo("p_fortalezas", list(vars = "docentes$*", corte = c("4", "5"), n = 2), src)
  sel <- Filter(function(cd) isTRUE(cd$seleccionada), r$candidatas)
  expect_setequal(vapply(sel, `[[`, "", "etiqueta"), paste0(c("Reglamentos", "Biblioteca", "Docentes", "Salud"), " (Docentes)"))
  expect_identical(r$texto_regla, e$texto_regla)
})

test_that("la lámina nativa: dos columnas, la cifra de cada barra y la base con la regla en el pie", {
  skip_if_not_installed("officer")
  src <- .fo_fuentes()
  plan <- p_plan(slides = list(p_slide_1_grafico(p_fortalezas(vars = "docentes$*", corte = c("4", "5"), n = 3), titulo = "Fortalezas")))
  out <- tempfile(fileext = ".pptx"); on.exit(unlink(out), add = TRUE)
  avisos <- character(0)
  withCallingHandlers(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                                        path_ppt = out, mensajes_progreso = FALSE)),
                      message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  grupos <- xml2::xml_attr(xml2::xml_find_all(x, "//p:grpSp/p:nvGrpSpPr/p:cNvPr"), "name")
  expect_true("prosecnur:grafico:fortalezas" %in% grupos)
  texto <- paste(xml2::xml_text(xml2::xml_find_all(x, "//a:t")), collapse = " | ")
  expect_match(texto, "Más altas", fixed = TRUE); expect_match(texto, "Más bajas", fixed = TRUE)
  expect_match(texto, "90%", fixed = TRUE); expect_match(texto, "25%", fixed = TRUE)
  # Al pie, sólo la base; cómo se eligieron, al analista (Gonzalo, 2026-11-09; lamina_pie_resumen.R).
  expect_match(texto, "Base: 40 docentes |", fixed = TRUE)
  expect_true(any(grepl("Se muestran las 3 más altas y las 3 más bajas, de 6 preguntas de escala", avisos, fixed = TRUE)))
  expect_false(grepl("tramo", texto, ignore.case = TRUE))
  nombres <- xml2::xml_attr(xml2::xml_find_all(x, "//p:sp/p:nvSpPr/p:cNvPr"), "name")
  expect_identical(sum(nombres == "fortalezas:barra"), 6L)
})

test_that("con más de ocho filas por columna va el dibujo de respaldo, con la misma especificación", {
  skip_if_not_installed("ggplot2")
  d <- data.frame(rotulo = paste("Pregunta", 1:20), valor = seq(20, 96, length.out = 20))
  p <- graficar_fortalezas(d, n = 9)
  e <- attr(p, "pulso_espec")
  expect_s3_class(p, "ggplot")
  expect_length(e$columnas[[1]]$rotulos, 9L)
  expect_false(.lam_fortalezas_cabe(e))
  expect_true(.lam_fortalezas_cabe(attr(graficar_fortalezas(d[1:10, ], n = 5), "pulso_espec")))
})

test_that("el registro ofrece fortalezas y alertas con sus args", {
  meta <- .GRAFICADORES_META$p_fortalezas
  expect_identical(meta$titulo_humano, "Fortalezas y alertas")
  expect_identical(meta$familia_editor, "comparar"); expect_true(meta$salida_nativa)
  args <- vapply(meta$args, `[[`, "", "name")
  expect_true(all(c("vars", "corte", "corte_etiqueta", "n", "regla", "universos") %in% args))
  expect_true(all(args[args != "overrides"] %in% c(names(formals(p_fortalezas)))))
  expect_true(is.function(getExportedValue("prosecnurapp", "p_fortalezas")))
  expect_true(is.function(getExportedValue("prosecnurapp", "graficar_fortalezas")))
})
