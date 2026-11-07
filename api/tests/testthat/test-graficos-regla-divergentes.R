source("setup-load-all.R")

# ADR 0135: la regla de la escala del resumen mide con la tabla que pinta su lámina (graficos_regla_divergentes.R).
# Antes medía con `.graficos_no_sustantivos` y sin `excluir_opciones`, y con un código 9 «No tengo información
# suficiente» o una opción excluida la nota de la regla y la lámina daban cifras distintas.

.rd_rep <- function(cnt, cods) rep(cods, cnt)
.rd_cods <- c("1", "2", "3", "4", "5", "9")
.rd_inst <- function(rotulo_9) list(
  survey = data.frame(name = paste0("a", 1:4), type = "select_one lk", list_name = "lk",
                      label = c("Reglamentos", "Biblioteca", "Tutoría", "Salud"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = "lk", name = .rd_cods,
                       label = c("Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo", rotulo_9),
                       stringsAsFactors = FALSE),
  orders_list = NULL)
.rd_fuentes <- function(rotulo_9) {
  d <- data.frame(a1 = .rd_rep(c(2, 3, 5, 15, 15, 0), .rd_cods), a2 = .rd_rep(c(4, 6, 6, 10, 10, 4), .rd_cods),
                  a3 = .rd_rep(c(1, 1, 2, 18, 10, 8), .rd_cods), a4 = .rd_rep(c(6, 8, 8, 5, 5, 8), .rd_cods),
                  stringsAsFactors = FALSE)
  list(data_sources = list(docentes = d), inst_sources = list(docentes = .rd_inst(rotulo_9)))
}

# La lámina real (reporte_ppt_plan) de un elemento: su especificación `divergentes/1`.
.rd_espec_render <- function(el, src) {
  plan <- p_plan(slides = list(p_slide_1_grafico(el, titulo = "Escala")))
  salida <- suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                              solo_lista = TRUE, mensajes_progreso = FALSE))
  attr(salida$rendered[[1]], "pulso_espec")
}
# Cifras de la lámina por rótulo de fila: Top Two Box (lado de acuerdo) y la columna especial.
.rd_cifras_lamina <- function(esp) {
  k <- 10^esp$decimales; lado <- esp$categorias$lado
  data.frame(etiqueta = esp$filas, valor = esp$total_pos / k,
             sin_info = rowSums(esp$unidades[, lado == "sin_inf", drop = FALSE]) / k, stringsAsFactors = FALSE)
}
# Lo que la regla mide fuera del render (el camino del endpoint de conteo), con las mismas filas.
.rd_cifras_regla <- function(el, src, etiquetas) {
  ind <- .regla_preguntas_indicadores(el, src)$indicadores
  ind[match(etiquetas, ind$etiqueta), c("etiqueta", "valor", "sin_info")]
}

test_that("código 9 «No tengo información suficiente»: la regla y la lámina dan las mismas cifras y la misma lista", {
  skip_if_not_installed("ggplot2")
  src <- .rd_fuentes("No tengo información suficiente")
  el <- p_barras_divergentes(vars = "docentes$*", orden = "declarado", regla = list(tipo = "extremos", n = 1))
  r <- .regla_preguntas_de_elemento(el, src)
  esp <- .rd_espec_render(el, src)
  lam <- .rd_cifras_lamina(esp)
  # La misma lista, en el mismo orden: la lámina dibuja exactamente lo que la regla eligió.
  etq <- r$evaluacion$candidatas$etiqueta[match(r$evaluacion$temas, r$evaluacion$candidatas$tema)]
  expect_identical(esp$filas, etq)
  expect_identical(esp$texto_regla, r$evaluacion$texto)
  # Las mismas cifras: el Top Two Box y la columna especial que la lámina rotula.
  reg <- .rd_cifras_regla(el, src, lam$etiqueta)
  expect_equal(reg$valor, lam$valor)
  expect_equal(reg$sin_info, lam$sin_info)
  # Todas las candidatas, contra la lámina con las cuatro preguntas.
  el_todas <- p_barras_divergentes(vars = paste0("docentes$a", 1:4), estilo = "resumen", orden = "declarado")
  lam4 <- .rd_cifras_lamina(.rd_espec_render(el_todas, src))
  reg4 <- .rd_cifras_regla(p_barras_divergentes(vars = "docentes$*", regla = list(tipo = "todas")), src, lam4$etiqueta)
  expect_equal(reg4$valor, lam4$valor); expect_equal(reg4$sin_info, lam4$sin_info)
  expect_identical(r$evaluacion$metrica[["docentes$a3"]], lam4$valor[lam4$etiqueta == "Tutoría"])
})

test_that("con excluir_opciones la regla mide sin la opción excluida, como la lámina", {
  skip_if_not_installed("ggplot2")
  src <- .rd_fuentes("No tengo información suficiente")
  el <- p_barras_divergentes(vars = "docentes$*", orden = "declarado", excluir_opciones = "9",
                             regla = list(tipo = "extremos", n = 1))
  r <- .regla_preguntas_de_elemento(el, src)
  esp <- .rd_espec_render(el, src)
  expect_false("No tengo información suficiente" %in% esp$categorias$rotulo)
  lam <- .rd_cifras_lamina(esp)
  etq <- r$evaluacion$candidatas$etiqueta[match(r$evaluacion$temas, r$evaluacion$candidatas$tema)]
  expect_identical(esp$filas, etq)
  reg <- .rd_cifras_regla(el, src, lam$etiqueta)
  expect_equal(reg$valor, lam$valor)
  expect_equal(reg$sin_info, c(0, 0))
  # ADR 0135 §3: el reparto se fija sobre las opciones SUSTANTIVAS de la escala original (1 a 5; el 9 es no sustantivo
  # aunque se excluya), así que «Ni uno ni otro» es el punto medio y el lado de acuerdo es 4 y 5. Salud: 5 y 5 sobre
  # 32 (15,625 % cada uno), que la lámina rotula 16 + 16 (unidades que suman 100).
  ind <- .regla_preguntas_indicadores(el, src)$indicadores
  expect_equal(ind$valor[ind$etiqueta == "Salud"], 32)
})

test_that("«Sin información» con su rótulo: la columna especial de la lámina es la métrica de mayor_sin_info", {
  skip_if_not_installed("ggplot2")
  src <- .rd_fuentes("Sin información")
  el <- p_barras_divergentes(vars = "docentes$*", orden = "declarado", regla = list(tipo = "mayor_sin_info", n = 2))
  r <- .regla_preguntas_de_elemento(el, src)
  expect_identical(r$evaluacion$temas, c("docentes$a3", "docentes$a4"))   # 20 % y 20 %: desempata el instrumento
  esp <- .rd_espec_render(el, src)
  lam <- .rd_cifras_lamina(esp)
  expect_identical(esp$filas, c("Tutoría", "Salud"))
  reg <- .rd_cifras_regla(el, src, lam$etiqueta)
  expect_equal(reg$valor, lam$valor); expect_equal(reg$sin_info, lam$sin_info)
  expect_equal(lam$sin_info, c(20, 20))
})

test_that("fuera del render el motor local no tapa al del render, y dentro del render se usa el del motor", {
  src <- .rd_fuentes("Sin información")
  # Sin render: se arma el equivalente local.
  hay <- .regla_div_con_motor(src, function() is.function(dynGet(".tab_freq", ifnotfound = NULL)))
  expect_true(hay)
  # Con un `.tab_freq` en la pila (el del render), se usa ese.
  .tab_freq <- function(...) "motor"; .resolve_ref <- function(...) NULL; .exclusion_for_ctx <- function(...) NULL
  propio <- .regla_div_con_motor(src, function() dynGet(".tab_freq")())
  expect_identical(propio, "motor")
})

test_that("el conteo en vivo, con el instrumento leído de un XLSForm, da las cifras de la lámina", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  src <- .rd_fuentes("No tengo información suficiente")
  i <- src$inst_sources$docentes
  x <- tempfile(fileext = ".xlsx"); on.exit(unlink(x), add = TRUE)
  openxlsx::write.xlsx(list(survey = i$survey[, c("type", "name", "label")], choices = i$choices[, c("list_name", "name", "label")]), x)
  src$inst_sources$docentes <- suppressMessages(reporte_instrumento(x))
  r <- .regla_preguntas_conteo("p_barras_divergentes", list(vars = list("docentes$*"), estilo = "resumen", excluir_opciones = list("9"),
                                                          regla = list(tipo = "extremos", n = 1)), src)
  expect_identical(r$total, 4L)
  lam <- .rd_cifras_lamina(.rd_espec_render(p_barras_divergentes(vars = paste0("docentes$a", 1:4), estilo = "resumen",
                                                                   orden = "declarado", excluir_opciones = "9"), src))
  metrica <- vapply(r$candidatas, function(cd) cd$metrica, 0)
  expect_equal(unname(metrica), lam$valor)
})
