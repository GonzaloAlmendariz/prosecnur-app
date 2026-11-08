source("setup-load-all.R")

# ADR 0135, oleada 9 (C5 contra el resumen de Arte, p. 4): la escala del resumen junta preguntas de acuerdo y de
# satisfacción de cuatro puntos con la leyenda de acuerdo y el pie «en satisfacción, de muy insatisfecho a muy
# satisfecho». Se alinean por posición sólo con el mismo número de opciones sustantivas, el mismo sentido y el mismo
# reparto; las demás quedan fuera con aviso.

.ea_listas <- list(
  lk = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información"),
  sat = c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho", "Sin información"),
  cinco = c("Nada importante", "Poco importante", "Algo importante", "Importante", "Muy importante", "Sin información"),
  inv = c("Muy satisfecho", "Satisfecho", "Insatisfecho", "Muy insatisfecho", "Sin información")
)
.ea_codigos <- function(lista) {
  k <- length(.ea_listas[[lista]]); c(as.character(seq_len(k - 1L)), "9")
}

#' Instrumento con baterías de tres o más preguntas por lista (cada lista es «de escala» por batería)
.ea_inst <- function(por_lista) {
  vars <- unlist(lapply(names(por_lista), function(l) paste0(l, "_", seq_len(por_lista[[l]]))))
  listas <- rep(names(por_lista), unlist(por_lista))
  ch <- do.call(rbind, lapply(names(.ea_listas), function(l) data.frame(list_name = l, name = .ea_codigos(l),
                                                                          label = .ea_listas[[l]], stringsAsFactors = FALSE)))
  list(survey = data.frame(name = vars, type = paste("select_one", listas), list_name = listas,
                           label = paste("Pregunta", vars), stringsAsFactors = FALSE),
       choices = ch, orders_list = NULL)
}

#' 20 casos por pregunta: `pos` en los dos niveles positivos, 2 en «Sin información» y el resto en los negativos
.ea_columna <- function(lista, pos) {
  cods <- .ea_codigos(lista); k <- length(cods) - 1L
  positivos <- if (identical(lista, "inv")) cods[1:2] else cods[(k - 1L):k]
  negativos <- if (identical(lista, "inv")) cods[(k - 1L):k] else cods[1:2]
  c(rep(positivos, length.out = pos), rep("9", 2L), rep(negativos, length.out = 18L - pos))
}

.ea_fuentes <- function(por_lista, pos = NULL) {
  inst <- .ea_inst(por_lista)
  vars <- inst$survey$name; listas <- inst$survey$list_name
  pos <- pos %||% (seq_along(vars) + 3L)
  d <- as.data.frame(stats::setNames(lapply(seq_along(vars), function(i) .ea_columna(listas[i], pos[i])), vars),
                     stringsAsFactors = FALSE)
  list(data_sources = list(arte = d), inst_sources = list(arte = inst))
}

.ea_render <- function(src, el) {
  plan <- p_plan(slides = list(p_slide_1_grafico(el, titulo = "Escala")))
  out <- suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                           solo_lista = TRUE, mensajes_progreso = FALSE))
  attr(out$rendered[[1]], "pulso_espec")
}

test_that("el sentido, el tema y el texto del pie salen de los extremos de la escala", {
  expect_identical(.escala_arm_sentido(.ea_listas$sat[1:4]), "negativo_positivo")
  expect_identical(.escala_arm_sentido(.ea_listas$inv[1:4]), "positivo_negativo")
  expect_true(is.na(.escala_arm_sentido(c("Rojo", "Verde", "Azul", "Negro"))))
  expect_identical(.escala_arm_tema(.ea_listas$sat[1:4]), "satisfacción")
  expect_identical(.escala_arm_tema(.ea_listas$cinco[1:5]), "importancia")
  expect_identical(.escala_arm_tema(c("Nunca", "Casi nunca", "Casi siempre", "Siempre")), "frecuencia")
  expect_true(is.na(.escala_arm_tema(c("Muy malo", "Malo", "Bueno", "Muy bueno"))))
  f_sat <- .escala_arm_forma(.ea_listas$sat, c(FALSE, FALSE, FALSE, FALSE, TRUE))
  expect_identical(.escala_arm_texto(f_sat), "en satisfacción, de muy insatisfecho a muy satisfecho")
  f_inv <- .escala_arm_forma(.ea_listas$inv, c(FALSE, FALSE, FALSE, FALSE, TRUE))
  expect_identical(.escala_arm_texto(f_inv), "en satisfacción, de muy insatisfecho a muy satisfecho")
  expect_identical(.escala_arm_texto(.escala_arm_forma(c("Muy malo", "Malo", "Bueno", "Muy bueno"), rep(FALSE, 4))),
                   "de muy malo a muy bueno")
  expect_identical(.escala_arm_nota("Porcentaje sobre el total de respondientes.", "en satisfacción, de muy insatisfecho a muy satisfecho"),
                   "Porcentaje sobre el total de respondientes; en satisfacción, de muy insatisfecho a muy satisfecho.")
  expect_identical(.escala_arm_nota("Porcentaje sobre el total de respondientes.", character(0)),
                   "Porcentaje sobre el total de respondientes.")
})

test_that("las reglas de alineación: mismo número de opciones, mismo sentido y mismo reparto", {
  ns4 <- c(FALSE, FALSE, FALSE, FALSE, TRUE)
  f_lk <- .escala_arm_forma(.ea_listas$lk, ns4)
  expect_null(.escala_arm_motivo(f_lk, .escala_arm_forma(.ea_listas$sat, ns4)))
  expect_match(.escala_arm_motivo(f_lk, .escala_arm_forma(.ea_listas$cinco, c(rep(FALSE, 5), TRUE))), "otro número de opciones")
  expect_match(.escala_arm_motivo(f_lk, .escala_arm_forma(.ea_listas$inv, ns4)), "sentido contrario")
  expect_match(.escala_arm_motivo(f_lk, .escala_arm_forma(c("Rojo", "Verde", "Azul", "Negro"), rep(FALSE, 4))), "sentido no reconocido")
  # Otro reparto (otro número de niveles negativos) sale con su motivo.
  expect_match(.escala_arm_motivo(f_lk, .escala_arm_forma(.ea_listas$sat, ns4, n_negativas = 1L)), "reparten sus niveles")
  expect_match(.escala_arm_motivo(.escala_arm_forma(.ea_listas$lk[1:4], rep(FALSE, 4)), .escala_arm_forma(.ea_listas$sat, ns4)),
               "sin información")
})

test_that("acuerdo y satisfacción de cuatro puntos entran en la misma regla y en una lámina con su pie", {
  skip_if_not_installed("ggplot2")
  src <- .ea_fuentes(list(lk = 4L, sat = 3L))
  el <- p_barras_divergentes(vars = "arte$*", estilo = "resumen", regla = list(tipo = "bajo_umbral", umbral = 60))
  r <- .regla_preguntas_de_elemento(el, src)
  expect_identical(r$evaluacion$total, 7L)
  expect_false(any(grepl("fuera", r$avisos)))
  e <- .ea_render(src, el)
  # La leyenda es la de acuerdo (la escala más frecuente) aunque la primera fila sea de satisfacción.
  expect_identical(e$categorias$rotulo[e$categorias$lado != "sin_inf"], .ea_listas$lk[1:4])
  expect_identical(e$nota_porcentaje,
                   "Porcentaje sobre el total de respondientes; en satisfacción, de muy insatisfecho a muy satisfecho.")
  expect_match(e$texto_regla, "de 7 preguntas de escala")
  # Cada fila conserva su propia cifra: positivos/20 y 2/20 de «Sin información».
  pos <- stats::setNames(c(4:10) * 5, c(paste0("lk_", 1:4), paste0("sat_", 1:3)))
  esperado <- pos[pos < 60]
  t2b <- vapply(seq_along(e$filas), function(i) sum(e$unidades[i, e$categorias$lado == "pos"]), numeric(1)) / 10^e$decimales
  si <- vapply(seq_along(e$filas), function(i) sum(e$unidades[i, e$categorias$lado == "sin_inf"]), numeric(1)) / 10^e$decimales
  expect_setequal(t2b, unname(esperado))
  expect_true(all(si == 10))
  expect_true(any(grepl("sat_", e$filas)))
})

test_that("con una sola escala el pie no cambia", {
  skip_if_not_installed("ggplot2")
  src <- .ea_fuentes(list(lk = 4L))
  e <- .ea_render(src, p_barras_divergentes(vars = "arte$*", estilo = "resumen", regla = list(tipo = "todas")))
  expect_identical(e$nota_porcentaje, "Porcentaje sobre el total de respondientes.")
})

test_that("una escala de cinco puntos queda fuera con aviso y la de cuatro sigue", {
  src <- .ea_fuentes(list(lk = 4L, sat = 3L, cinco = 3L))
  el <- p_barras_divergentes(vars = "arte$*", estilo = "resumen", regla = list(tipo = "todas"))
  r <- .regla_preguntas_de_elemento(el, src)
  expect_identical(r$evaluacion$total, 7L)
  expect_true("3 preguntas quedan fuera: tienen otro número de opciones que la escala de la mayoría." %in% r$avisos)
  expect_false(any(grepl("^arte\\$cinco_", r$vars)))
})

test_that("una escala en sentido contrario queda fuera con aviso", {
  src <- .ea_fuentes(list(lk = 4L, inv = 3L))
  el <- p_barras_divergentes(vars = "arte$*", estilo = "resumen", regla = list(tipo = "todas"))
  r <- .regla_preguntas_de_elemento(el, src)
  expect_identical(r$evaluacion$total, 4L)
  expect_true("3 preguntas quedan fuera: van en sentido contrario a la escala de la mayoría." %in% r$avisos)
})

test_that("declaradas a mano, cuatro puntos y cinco puntos no se juntan en la tabla", {
  src <- .ea_fuentes(list(lk = 4L, cinco = 3L))
  el <- p_barras_divergentes(vars = c("arte$lk_1", "arte$cinco_1"), estilo = "resumen", orden = "declarado")
  err <- tryCatch(.regla_div_con_motor(src, function() .regla_div_espec(c("arte$lk_1", "arte$lk_2", "arte$cinco_1"), el, .regla_div_args(el))),
                  error = function(e) conditionMessage(e))
  expect_match(err, "cinco_1.*no se alinea.*otro número de opciones")
})

test_that("la leyenda es la escala más frecuente del universo aunque la regla elija más de satisfacción", {
  skip_if_not_installed("ggplot2")
  src <- .ea_fuentes(list(lk = 4L, sat = 3L), pos = c(10, 11, 12, 13, 4, 5, 6))
  e <- .ea_render(src, p_barras_divergentes(vars = "arte$*", estilo = "resumen", regla = list(tipo = "bajo_umbral", umbral = 60)))
  expect_match(e$filas[1], "sat_1")
  expect_identical(e$categorias$rotulo[e$categorias$lado != "sin_inf"], .ea_listas$lk[1:4])
  expect_match(e$nota_porcentaje, "; en satisfacción, de muy insatisfecho a muy satisfecho\\.$")
  t2b <- vapply(seq_along(e$filas), function(i) sum(e$unidades[i, e$categorias$lado == "pos"]), numeric(1)) / 10^e$decimales
  expect_equal(t2b[1:3], c(20, 25, 30))   # 4/20, 5/20 y 6/20 de su propia escala
})
