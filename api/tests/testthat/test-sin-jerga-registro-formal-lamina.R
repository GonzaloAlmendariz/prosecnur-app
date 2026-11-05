source("setup-load-all.R")

# Registro formal de la casa en lo que el motor escribe en la lámina (ADR 0128/0129): sin punto y coma, sin raya
# (U+2014) y sin punto medio (U+00B7). Lo que viene del instrumento o del plan (respuestas, premisas, títulos, bases
# escritas a mano) no se toca y pasa tal cual. Hallazgo del PPT CCSS v7.28: la nota de la opción `todas` de las
# tarjetas y el método de la lámina de lectura llevaban punto y coma.

.rf_prohibido <- "[;—·]"
.rf_limpio <- function(x) !grepl(.rf_prohibido, x, perl = TRUE)

.rf_inst <- function() {
  ch <- data.frame(list_name = "acuerdo", name = c("1", "2", "3", "4"),
                   label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo; con reservas", "Totalmente de acuerdo"),
                   stringsAsFactors = FALSE)
  ch2 <- data.frame(list_name = "sexo", name = c("1", "2"), label = c("Masculino", "Femenino"), stringsAsFactors = FALSE)
  list(survey = data.frame(name = c("p1", "p2", "sexo"), type = c("select_one acuerdo", "select_one acuerdo", "select_one sexo"),
                           label = c("Me involucro en los cursos; en los demás, hago lo necesario", "Participo en clase", "Sexo"),
                           list_name = c("acuerdo", "acuerdo", "sexo"), stringsAsFactors = FALSE),
       choices = rbind(ch, ch2), orders_list = NULL)
}
.rf_data <- function() {
  set.seed(7)
  data.frame(p1 = sample(c("1", "2", "3", "4"), 40, TRUE), p2 = sample(c("1", "2", "3", "4"), 40, TRUE),
             sexo = sample(c("1", "2"), 40, TRUE), stringsAsFactors = FALSE)
}
.rf_plan <- function() {
  p_plan(slides = list(
    p_slide_1_grafico(titulo = "Escala", grafico = p_barras_multiapiladas(
      modo = "var", vars = c("p1", "p2"), mostrar_respuestas = TRUE,
      overrides = list(barra_extra_preset = "top2box", top2box_labels = c("De acuerdo; con reservas", "Totalmente de acuerdo")))),
    p_slide_1_grafico(titulo = "Sexo", grafico = p_barras_agrupadas("sexo")),
    p_slide_1_grafico(titulo = "Torta", grafico = p_pie("sexo"))
  ))
}

test_that("PPT renderizado: ningún texto del motor lleva punto y coma, raya ni punto medio", {
  skip_if_not_installed("officer")
  out <- withr::local_tempfile(fileext = ".pptx")
  inst <- .rf_inst()
  suppressWarnings(suppressMessages(
    reporte_ppt_plan(data = .rf_data(), instrumento = inst, plan = .rf_plan(), path_ppt = out, mensajes_progreso = FALSE)))
  partes <- grep("^ppt/slides/slide[0-9]+\\.xml$", utils::unzip(out, list = TRUE)$Name, value = TRUE)
  expect_gte(length(partes), 3L)
  textos <- unlist(lapply(partes, function(p) {
    xml <- .leer_parte_zip(out, p)
    t <- regmatches(xml, gregexpr("(?<=<a:t>)[^<]*(?=</a:t>)", xml, perl = TRUE))[[1]]
    stats::setNames(t, rep(p, length(t)))
  }))
  # Lo que viene del instrumento pasa tal cual (y es lo único que puede traer esos signos).
  del_instrumento <- c(inst$choices$label, inst$survey$label)
  ajenos <- vapply(textos, function(t) any(vapply(del_instrumento, function(l) grepl(l, t, fixed = TRUE), logical(1))), logical(1))
  expect_true(any(ajenos & grepl(";", textos, fixed = TRUE)))   # la respuesta «De acuerdo; con reservas» sigue escrita
  del_motor <- textos[!ajenos]
  expect_gt(length(del_motor), 0L)
  expect_identical(unname(del_motor[!.rf_limpio(del_motor)]), character(0))
})

test_that("tarjetas: la nota de la opción `todas` y la lámina de lectura van en registro formal", {
  expect_true(.rf_limpio(.TARJETAS_FRASE_TODAS))
  expect_identical(.TARJETAS_FRASE_TODAS,
                   "Se muestran todos los grupos con base suficiente. La flecha marca solo las diferencias significativas.")
  lectura <- list(
    regla = list(prueba = "rao_scott", correccion = "bh_informe", conglomerado = "aula", alfa = 0.05, umbral_puntos = 10,
                 base_minima = 30, conglomerados_minimos = 8L),
    opcion = list(publico = "estudiantes", max = 4L),
    tarjeta = list(fila = "Me involucro", cifra_total = "45%", total = 0.45,
                   grupos = data.frame(etiqueta = c("Mujeres", "Hombres"), p = c(0.6, 0.3), stringsAsFactors = FALSE)),
    cruces = c("Sexo", "Nivel"),
    bases = list(list(cruce = "Sexo", grupos = c("Hombre", "Mujer"), n = c(200, 200)),
                 list(cruce = "Nivel", grupos = c("Sexto", "Noveno"), n = c(150, 250))))
  tx <- .tarjetas_textos_lectura(lectura)
  expect_identical(tx$metodo_ppt, paste0("Prueba de Rao-Scott por aula con corrección de Benjamini-Hochberg. ",
                                         "Se muestran hasta cuatro diferencias por gráfico y las demás están en las tablas de cruces."))
  visibles <- c(tx$frase_ppt, tx$metodo_ppt, tx$mayor, tx$menor, tx$nivel_1, tx$nivel_2, tx$rotulo_total, tx$rotulo_grupos,
                stats::na.omit(tx$parrafos_word))
  expect_true(all(.rf_limpio(visibles)))
  # Las bases siguen todas, ahora en oraciones separadas.
  expect_match(tx$parrafos_word[5], "Las bases de cada grupo son las siguientes. Sexo: Hombre 200, Mujer 200. Nivel: Sexto 150, Noveno 250.",
               fixed = TRUE)
})

test_that("significancia: notas de Top Two Box, tendencia y «cómo leer» sin punto y coma", {
  expect_true(.rf_limpio(.sig_texto_top_two_box("Top Two Box", c("De acuerdo", "Muy de acuerdo"))))
  regla <- list(prueba = "rao_scott", correccion = "bh_informe", conglomerado = "aula", alfa = 0.05, umbral_puntos = 10,
                base_minima = 30, conglomerados_minimos = 8L, tendencia = TRUE)
  expect_true(.rf_limpio(.sig_texto_como_leer(regla)))
  ev <- list(tendencia = data.frame(fila = c("Leo", "Escribo", "Calculo"), direccion = c("sube", "baja", "sube"),
                                    p_ajustado = c(0.001, 0.002, 0.003), stringsAsFactors = FALSE))
  td <- .sig_texto_tendencia(ev, regla)
  expect_true(.rf_limpio(td))
  expect_match(td, "«Leo» sube con el nivel, «Escribo» baja con el nivel y «Calculo» sube con el nivel", fixed = TRUE)
  expect_identical(.sig_lista_y(character(0)), "")
  expect_identical(.sig_lista_y("a"), "a")
  expect_identical(.sig_lista_y(c("a", "b")), "a y b")
})

test_that("mapa de calor pregunta × cruce: la nota de grupos chicos va en oración aparte", {
  inst <- .rf_inst()
  d <- .rf_data(); d$sexo[] <- c(rep("1", 30), rep("2", 10))
  e <- suppressWarnings(.heatmap_pc_espec(d, inst, "p2", "sexo"))
  expect_true(.rf_limpio(e$nota))
  expect_match(e$nota, "Entre paréntesis, los casos de cada fila. * Menos de 15 casos.", fixed = TRUE)
})

test_that("ficha técnica multibase: la ponderación por base se enumera sin punto y coma", {
  local_mocked_bindings(.lam_pond_estados_con_info = function(data_sources) list(
    docentes = list(status = "aplicada", n_eff = 120), estudiantes = list(status = "sin_config")))
  txt <- .lam_ficha_texto_ponderacion(list())
  expect_identical(txt, "docentes: Resultados ponderados (n efectivo = 120) y estudiantes: Base sin ponderar")
})
