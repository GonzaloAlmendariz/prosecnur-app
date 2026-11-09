source("setup-load-all.R")

# ADR 0135, oleada 9 (C5 contra el resumen de Arte, p. 4): la escala del resumen junta preguntas de acuerdo y de
# satisfacción de cuatro puntos con la leyenda de acuerdo y el pie «en satisfacción, de muy insatisfecho a muy
# satisfecho». Se alinean por posición sólo con el mismo número de opciones sustantivas, el mismo sentido y el mismo
# reparto; las demás quedan fuera con aviso.

.ea_listas <- list(
  lk = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información"),
  sat = c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho", "Sin información"),
  cinco = c("Nada importante", "Poco importante", "Algo importante", "Importante", "Muy importante", "Sin información"),
  inv = c("Muy satisfecho", "Satisfecho", "Insatisfecho", "Muy insatisfecho", "Sin información"),
  # Revisión metodológica de 095e70b66 (H1-H4)
  cinco_lk = c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo",
               "Sin información"),
  cinco_sat = c("Muy insatisfecho", "Insatisfecho", "Ni satisfecho ni insatisfecho", "Satisfecho", "Muy satisfecho", "Sin información"),
  preoc = c("Nada preocupado", "Poco preocupado", "Preocupado", "Muy preocupado", "Sin información"),
  grave = c("Muy grave", "Grave", "Poco grave", "Nada grave", "Sin información"),
  frec = c("Nunca", "Casi nunca", "Casi siempre", "Siempre", "Sin información"),
  lk2 = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "No sabe", "No aplica"),
  sat2 = c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho", "No sabe", "No aplica"),
  sat_ns = c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho", "No sabe"),
  conf = c("Nada de confianza", "Poca confianza", "Bastante confianza", "Mucha confianza", "No sabe")
)
.ea_cod_fijos <- list(lk2 = c("1", "2", "3", "4", "98", "99"), sat2 = c("1", "2", "3", "4", "98", "99"))
.ea_codigos <- function(lista) {
  if (!is.null(.ea_cod_fijos[[lista]])) return(.ea_cod_fijos[[lista]])
  k <- length(.ea_listas[[lista]]); c(as.character(seq_len(k - 1L)), "9")
}
.ea_n_sust <- function(lista) sum(!.ea_codigos(lista) %in% c("9", "98", "99"))

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
  cods <- .ea_codigos(lista); k <- .ea_n_sust(lista)
  positivos <- if (identical(lista, "inv")) cods[1:2] else cods[(k - 1L):k]
  negativos <- if (identical(lista, "inv")) cods[(k - 1L):k] else cods[1:2]
  c(rep(positivos, length.out = pos), rep(cods[k + 1L], 2L), rep(negativos, length.out = 18L - pos))
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
  expect_match(.escala_arm_motivo(f_lk, .escala_arm_forma(c("Rojo", "Verde", "Azul", "Negro"), rep(FALSE, 4))), "de tema no reconocido")
  expect_match(.escala_arm_motivo(f_lk, .escala_arm_forma(c("Poco útil", "Algo útil", "Útil", "Muy útil"), rep(FALSE, 4))),
               "sentido no reconocido")
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

# ---- Revisión metodológica de 095e70b66 -------------------------------------------------------------------------

.ea_universo <- function(por_lista, ...) {
  src <- .ea_fuentes(por_lista)
  .regla_preguntas_de_elemento(p_barras_divergentes(vars = "arte$*", estilo = "resumen", regla = list(tipo = "todas"), ...), src)
}

test_that("H2: sólo se alinea una escala de tema reconocido; frecuencia y temas desconocidos quedan fuera", {
  r <- .ea_universo(list(lk = 4L, preoc = 3L))
  expect_identical(r$evaluacion$total, 4L)
  expect_true("3 preguntas quedan fuera: tienen otra escala que la mayoría, de tema no reconocido." %in% r$avisos)
  # «Muy grave … Nada grave» no es «sentido contrario»: es otra escala.
  r <- .ea_universo(list(lk = 4L, grave = 3L))
  expect_identical(r$evaluacion$total, 4L)
  expect_true("3 preguntas quedan fuera: tienen otra escala que la mayoría, de tema no reconocido." %in% r$avisos)
  expect_false(any(grepl("sentido contrario", r$avisos)))
  r <- .ea_universo(list(lk = 4L, frec = 3L))
  expect_identical(r$evaluacion$total, 4L)
  expect_true("3 preguntas quedan fuera: tienen otra escala que la mayoría, de tema no reconocido." %in% r$avisos)
})

test_that("H1: con neutro, acuerdo y satisfacción de 5 se juntan; acuerdo e importancia de 5 no", {
  r <- .ea_universo(list(cinco_lk = 4L, cinco = 3L))
  expect_identical(r$evaluacion$total, 4L)
  expect_true("3 preguntas quedan fuera: su punto medio no es neutral como el de la escala de la mayoría." %in% r$avisos)
  skip_if_not_installed("ggplot2")
  src <- .ea_fuentes(list(cinco_lk = 4L, cinco_sat = 3L))
  el <- p_barras_divergentes(vars = "arte$*", estilo = "resumen", regla = list(tipo = "todas"))
  r <- .regla_preguntas_de_elemento(el, src)
  expect_identical(r$evaluacion$total, 7L)
  e <- .ea_render(src, el)
  expect_identical(length(e$filas), 7L)
  expect_identical(e$nota_porcentaje,
                   "Porcentaje sobre el total de respondientes; en satisfacción, de muy insatisfecho a muy satisfecho.")
})

test_that("H3: con dos especiales en la leyenda, la alineada entra sólo si trae las mismas", {
  r <- .ea_universo(list(lk2 = 4L, sat2 = 3L))
  expect_identical(r$evaluacion$total, 7L)
  r <- .ea_universo(list(lk2 = 4L, sat = 3L))
  expect_identical(r$evaluacion$total, 4L)
  expect_true("3 preguntas quedan fuera: traen opciones sin información distintas de las de la escala de la mayoría." %in% r$avisos)
  # Cada especial va a su columna.
  src <- .ea_fuentes(list(lk2 = 4L, sat2 = 3L))
  tab <- .regla_div_con_motor(src, function() .ola4_tabla_escala(c("arte$lk2_1", "arte$lk2_2", "arte$sat2_1"), list()))
  cols <- stats::setNames(names(tab$etiquetas_grupos), tab$etiquetas_grupos)
  fila <- tab$data[tab$data$categoria == "arte$sat2_1", ]
  expect_equal(fila[[cols[["No sabe"]]]], 2 / 20)    # .ea_columna pone 2 en la primera especial
  expect_false(anyNA(unlist(tab$data[, -1])))
  expect_equal(sum(unlist(fila[, -1])), 1)
})

test_that("H4: excluir «Sin información» excluye la «No sabe» de la escala alineada; todas comparten denominador", {
  skip_if_not_installed("ggplot2")
  src <- .ea_fuentes(list(lk = 4L, sat_ns = 3L))
  el <- p_barras_divergentes(vars = "arte$*", estilo = "resumen", excluir_opciones = "Sin información", orden = "declarado",
                             regla = list(tipo = "todas"))
  e <- .ea_render(src, el)
  expect_identical(length(e$filas), 7L)
  expect_false(any(e$categorias$lado == "sin_inf"))
  t2b <- vapply(seq_along(e$filas), function(i) sum(e$unidades[i, e$categorias$lado == "pos"]), numeric(1)) / 10^e$decimales
  p <- 4:10   # cada lado es la suma de sus segmentos redondeados (ADR 0135, supuestos de la escala)
  expect_equal(t2b, round(100 * ceiling(p / 2) / 18) + round(100 * floor(p / 2) / 18))   # sobre 18: sin «Sin información» ni «No sabe»
  expect_match(e$nota_porcentaje, "sin contar las respuestas excluidas; en satisfacción")
  # La traducción, aislada.
  f_lk <- .escala_arm_forma(.ea_listas$lk, c(FALSE, FALSE, FALSE, FALSE, TRUE))
  f_ns <- .escala_arm_forma(.ea_listas$sat_ns, c(FALSE, FALSE, FALSE, FALSE, TRUE))
  expect_identical(.escala_arm_traducir_exclusion(c("En desacuerdo", "Sin información"), f_ns, f_lk), c("Insatisfecho", "No sabe"))
})

test_that("invariante 5: una fila que no se puede dibujar sale con su causa y no tumba la escala", {
  .tab_freq <- function(ref, filtros = list()) {
    if (identical(ref, "p2")) return(NULL)
    data.frame(Opciones = c("Negativa", "Neutral", "Positiva", "Total"), n = c(20, 30, 50, 100), stringsAsFactors = FALSE)
  }
  expect_error(.ola4_tabla_escala(c("p1", "p2", "p3"), list(), n_negativas = 1), "p2.*no devolvio frecuencias utilizables")
  tab <- .ola4_tabla_escala_tolerante(c("p1", "p2", "p3"), list(), n_negativas = 1)
  expect_identical(tab$data$categoria, c("p1", "p3"))
  expect_identical(tab$omitidas, list(p2 = "no tienen respuestas"))
  expect_identical(unname(.ola4_avisos_omitidas(tab$omitidas)), "1 pregunta queda fuera: no tienen respuestas.")
  # Con fuentes reales: una pregunta sin respuestas sale del conteo con su causa y la lámina se dibuja.
  skip_if_not_installed("ggplot2")
  src <- .ea_fuentes(list(lk = 4L, sat = 3L)); src$data_sources$arte$sat_2 <- NA_character_
  el <- p_barras_divergentes(vars = "arte$*", estilo = "resumen", regla = list(tipo = "todas"))
  r <- .regla_preguntas_de_elemento(el, src)
  expect_identical(r$evaluacion$total, 6L)
  expect_false("arte$sat_2" %in% r$vars)
  expect_true(any(grepl("^1 pregunta queda fuera", r$avisos)))
  expect_identical(length(.ea_render(src, el)$filas), 6L)
})

test_that("más de 20 filas: el conteo y el render avisan que la lámina admite 20 y muestra las primeras en el orden de la regla", {
  # E3: más filas que el tope ya no manda la escala a la imagen (salía ilegible).
  expect_null(.divergentes_aviso_tope(22, "Se muestran las 22 bajo 60%, de 157 preguntas de escala. Ordenado por Top Two Box, de menor a mayor."))
  expect_null(.divergentes_aviso_tope(20, "Se muestran las 20 bajo 60%, de 157 preguntas de escala."))
  aviso <- "La regla elige 22 preguntas y la lámina admite 20: por espacio se muestran las 20 más bajas de 22; el resto en otra lámina."
  expect_identical(.divergentes_aviso_espacio(22, list(tipo = "bajo_umbral", umbral = 60)), aviso)
  src <- .ea_fuentes(list(lk = 22L), pos = rep(5L, 22L))
  el <- p_barras_divergentes(vars = "arte$*", estilo = "resumen", regla = list(tipo = "bajo_umbral", umbral = 60))
  r <- .regla_preguntas_de_elemento(el, src)
  expect_true(aviso %in% r$avisos)
  skip_if_not_installed("ggplot2")
  plan <- p_plan(slides = list(p_slide_1_grafico(el, titulo = "Escala")))
  expect_message(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                                   solo_lista = TRUE, mensajes_progreso = FALSE)),
                 "22 filas no caben en la lámina: se muestran 20", fixed = TRUE)
})

# ---- Re-revisión de bd32813f0 --------------------------------------------------------------------------------------

test_that("C1: si la leyenda es de frecuencia o de un tema no reconocido, sólo se junta su misma firma", {
  skip_if_not_installed("ggplot2")
  for (ley in c("frec", "preoc")) {
    por <- stats::setNames(list(4L, 3L), c(ley, "sat"))
    src <- .ea_fuentes(por)
    el <- p_barras_divergentes(vars = "arte$*", estilo = "resumen", regla = list(tipo = "todas"))
    r <- .regla_preguntas_de_elemento(el, src)
    expect_identical(r$evaluacion$total, 4L, label = ley)
    expect_true("3 preguntas quedan fuera: tienen otra escala que la mayoría, de tema no reconocido." %in% r$avisos, label = ley)
    expect_false(any(grepl("^arte\\$sat_", r$vars)), label = ley)
    e <- .ea_render(src, el)
    expect_identical(e$categorias$rotulo[e$categorias$lado != "sin_inf"], .ea_listas[[ley]][1:4], label = ley)
    expect_identical(e$nota_porcentaje, "Porcentaje sobre el total de respondientes.", label = ley)
  }
})

test_that("C2: una exclusión que no está en la escala de la leyenda no se aplica y se avisa", {
  aviso <- "La exclusión \"No sabe\" no está en la escala de la leyenda y no se aplica."
  src <- .ea_fuentes(list(lk = 4L, conf = 3L))
  el <- p_barras_divergentes(vars = "arte$*", estilo = "resumen", excluir_opciones = "No sabe", orden = "declarado",
                             regla = list(tipo = "todas"))
  r <- .regla_preguntas_de_elemento(el, src)
  expect_identical(r$evaluacion$total, 7L)
  expect_true(aviso %in% r$avisos)
  skip_if_not_installed("ggplot2")
  plan <- p_plan(slides = list(p_slide_1_grafico(el, titulo = "Escala")))
  expect_message(out <- suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                                          solo_lista = TRUE, mensajes_progreso = FALSE)), aviso, fixed = TRUE)
  e <- attr(out$rendered[[1]], "pulso_espec")
  # No se aplica a ninguna fila: «No sabe» de confianza sigue en «Sin información», sobre 20.
  si <- vapply(seq_along(e$filas), function(i) sum(e$unidades[i, e$categorias$lado == "sin_inf"]), numeric(1)) / 10^e$decimales
  expect_true(all(si == 10))
  expect_identical(e$nota_porcentaje, "Porcentaje sobre el total de respondientes; en confianza, de nada de confianza a mucha confianza.")
  # Una exclusión que sí está en la leyenda no avisa.
  expect_length(.escala_arm_avisos_exclusion("Sin información", lapply(seq_along(.ea_listas$lk), function(i)
    list(codigo = .ea_codigos("lk")[i], etiqueta = .ea_listas$lk[i]))), 0L)
})
