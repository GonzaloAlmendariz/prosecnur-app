source("setup-load-all.R")

# K4 (plan F6 §5.2): cada graficador dice en qué familia del selector va («Tipo de gráfico», dirección F6 §4.4:
# Categorías · Escalas · Números · Comparar · Dimensiones · Territorio · Texto) y si su lámina sale con piezas nativas
# del recetario o no, con el motivo. La salida declarada se contrasta con el motor real: se arma el mazo y se lee
# cómo salió cada lámina con el mismo clasificador de la vista previa (`.pptx_lamina_estado`).

.FAMILIAS_F6 <- c("categorias", "escalas", "numeros", "comparar", "dimensiones", "territorio", "texto")

test_that("los 31 graficadores declaran familia del editor y salida, con motivo cuando no es nativa", {
  m <- .GRAFICADORES_META
  expect_length(m, 31L)
  for (nm in names(m)) {
    expect_true(m[[nm]]$familia_editor %in% .FAMILIAS_F6, info = nm)
    expect_true(is.logical(m[[nm]]$salida_nativa) && length(m[[nm]]$salida_nativa) == 1L && !is.na(m[[nm]]$salida_nativa), info = nm)
    expect_true(m[[nm]]$salida %in% c("nativa", "marco", "ruta_anterior"), info = nm)
    expect_identical(m[[nm]]$salida_nativa, identical(m[[nm]]$salida, "nativa"), info = nm)
    if (!m[[nm]]$salida_nativa) expect_true(nzchar(m[[nm]]$salida_motivo), info = nm)
  }
  expect_setequal(unique(vapply(m, `[[`, "", "familia_editor")), .FAMILIAS_F6)   # ninguna familia queda vacía
})

test_that("lo que hoy no tiene pieza del recetario no se anuncia nativo", {
  m <- .GRAFICADORES_META
  no_nativos <- names(m)[!vapply(m, `[[`, logical(1), "salida_nativa")]
  # G11 (2026-10-13): los puntos comparativos salen como el ranking con puntos (lámina 72), y el radar por dimensiones
  # ya salía nativo con tres ejes o más: lo declarado decía lo contrario (test-dim-radar-nativo.R).
  expect_setequal(no_nativos, "p_dim_foda")   # G11: la nube sale con su ranking (lámina 101) y la tabla como la del diseño
  expect_identical(m$p_nube_palabras$salida, "nativa")
  expect_match(m$p_nube_palabras$salida_condicion, "Sin el ranking", fixed = TRUE)
  expect_identical(m$p_dim_heatmap_criterios$salida, "nativa")          # la 93 ya es nativa (test-lamina-criterios.R)
})

test_that("el registry publica familia, salida y motivo de cada graficador y las familias en el orden del selector", {
  reg <- .graficos_registry_payload()
  expect_identical(vapply(reg$familias_editor, `[[`, "", "id"), .FAMILIAS_F6)
  expect_identical(reg$familias_editor[[3]]$label, "Números")
  g <- setNames(reg$graficadores, vapply(reg$graficadores, `[[`, "", "name"))
  expect_identical(g$p_barras_apiladas$familia_editor, "escalas")
  expect_true(g$p_barras_apiladas$salida_nativa)
  expect_identical(g$p_barras_apiladas$salida_motivo, "")
  expect_false(g$p_dim_foda$salida_nativa)
  expect_identical(g$p_dim_foda$salida, "ruta_anterior")
  expect_true(nzchar(g$p_dim_foda$salida_motivo))
  expect_true(nzchar(g$p_barras_agrupadas$salida_condicion))          # nativa, pero con cruce va por la ruta anterior
})

# --- Contra el motor real -----------------------------------------------------------------------------------------

.me_fixture <- function() {
  set.seed(7); n <- 80
  df <- data.frame(g = sample(c("1", "2"), n, TRUE), cat = sample(c("1", "2", "3", "4"), n, TRUE), tri = sample(c("1", "2", "3"), n, TRUE),
                   a = sample(c("1", "2"), n, TRUE), e = sample(c("1", "2", "3", "4"), n, TRUE), e2 = sample(c("1", "2", "3", "4"), n, TRUE),
                   edad = round(stats::runif(n, 18, 60)), h = sample(1:8, n, TRUE),
                   txt = sample(c("buena atención docente", "rápido servicio de biblioteca", "mala atención en secretaría",
                                  "falta biblioteca moderna", "excelentes profesores", "infraestructura deficiente"), n, TRUE),
                   stringsAsFactors = FALSE)
  inst <- list(
    survey = data.frame(name = c("g", "cat", "tri", "a", "e", "e2", "edad", "h", "txt"),
                        type = c("select_one si_no", "select_one cat", "select_one cat", "select_one si_no", "select_one esc", "select_one esc",
                                 "integer", "integer", "text"),
                        list_name = c("si_no", "cat", "cat", "si_no", "esc", "esc", NA, NA, NA),
                        label = c("Grupo", "Categoría", "Tri", "Pregunta A", "Escala E", "Escala E2", "Edad", "Hijos", "Texto"),
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = c("si_no", "si_no", rep("cat", 4), rep("esc", 4)), name = c("1", "2", "1", "2", "3", "4", "1", "2", "3", "4"),
                         label = c("Sí", "No", "Uno", "Dos", "Tres", "Cuatro", "Totalmente en desacuerdo", "En desacuerdo", "De acuerdo",
                                   "Totalmente de acuerdo"), stringsAsFactors = FALSE),
    orders_list = NULL)
  list(df = df, inst = inst)
}

test_that("la salida declarada coincide con cómo sale la lámina en el motor real (graficadores con datos simples)", {
  fx <- .me_fixture()
  casos <- list(
    p_barras_categoricas = p_barras_categoricas("cat"),
    p_barras_agrupadas = p_barras_agrupadas("cat"),
    p_barras_apiladas = p_barras_apiladas("e"),
    p_barras_multiapiladas = p_barras_multiapiladas(modo = "var", vars = c("e", "e2")),
    p_pie = p_pie("tri"),
    p_donut = p_donut("a"),
    p_numerico = p_numerico("edad"),
    p_histograma = p_histograma("h"),
    p_boxplot = p_boxplot("edad"),
    p_media_rango = p_media_rango("edad"),
    p_barras_divergentes = p_barras_divergentes("e"),
    p_lollipop = p_lollipop("cat"),
    p_nube_palabras = p_nube_palabras("txt"),
    p_puntos_comparativos = p_puntos_comparativos("e", cruces = "g", corte = c("3", "4")),
    p_tabla = p_tabla(modo = "box", vars = c("e", "e2"), box_labels = c("3", "4"))   # dos filas: antes salía «Sin datos» (exigía 3 ejes)
  )
  slides <- lapply(names(casos), function(nm) p_slide_1_grafico(casos[[nm]], titulo = nm))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = fx$df, instrumento = fx$inst, plan = p_plan(slides = slides), path_ppt = out,
                                                     mensajes_progreso = FALSE)))
  partes <- .preview_partes(out)$partes
  # La ruta anterior escribe el título en mayúsculas («P_TABLA»): se casa sin distinguir caja.
  estado <- setNames(vapply(partes, `[[`, "", "estado"), tolower(vapply(partes, `[[`, "", "titulo")))
  expect_setequal(names(estado), names(casos))                          # una lámina por caso, sin «(cont.)»
  # La salida completa, no sólo «nativa o no»: «marco» (la lámina del recetario con el dibujo ggplot adentro) se distingue
  # de la ruta anterior y de una lámina de estructura (verificador de contratos, P2).
  for (nm in names(casos)) {
    expect_identical(estado[[nm]], .GRAFICADORES_META[[nm]]$salida, info = sprintf("%s salió «%s»", nm, estado[[nm]]))
  }
  expect_identical(estado[["p_nube_palabras"]], "nativa")                 # con su ranking (lámina 101)
})

test_that("con «Dividir por» la agrupada sale por la ruta anterior, como dice su condición", {
  fx <- .me_fixture()
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = fx$df, instrumento = fx$inst, mensajes_progreso = FALSE, path_ppt = out,
    plan = p_plan(slides = list(p_slide_1_grafico(p_barras_agrupadas("cat", cruces = "g"), titulo = "Cruce"))))))
  # Con la plantilla estándar la lámina de respaldo lleva el marco del recetario (7e10765b8, lamina_marco_respaldo.R): título,
  # pie y folio del motor con el dibujo ggplot adentro, que es lo que `.pptx_lamina_estado` llama «marco».
  expect_identical(.preview_partes(out)$partes[[1]]$estado, "marco")
  expect_match(.GRAFICADORES_META$p_barras_agrupadas$salida_condicion, "Dividir por", fixed = TRUE)
})

# Gonzalo, 2026-10-10 («sí, sácalo»): la matriz FODA no aparece en ninguna página del recetario y sale del selector de
# tipos de gráfico. Sale sólo del selector: el graficador y su render siguen, para que los planes que ya lo usan exporten.
# Gonzalo, 2026-10-14 («la dependencia no es un tipo de gráfico»): «Pregunta filtro y subpregunta» es la pieza interna de la
# dependencia entre los dos gráficos de una lámina (graficos_dependencia.R); tampoco se elige en el selector.
test_that("p_dim_foda y la pieza de la dependencia salen del selector pero siguen registrados y renderizables; los demás quedan", {
  m <- .GRAFICADORES_META
  en <- vapply(m, function(x) x$en_selector, logical(1))
  expect_setequal(names(en)[!en], c("p_dim_foda", "p_filtro_subpregunta", "p_citas"))   # p_citas: entra con su tarjeta de aprobación (TXT-4, O3)
  expect_true("p_dim_foda" %in% .graf_names())                            # el validador del plan lo sigue aceptando
  expect_true(exists("p_dim_foda", mode = "function"))
  reg <- .graficos_registry_payload()
  g <- setNames(reg$graficadores, vapply(reg$graficadores, `[[`, "", "name"))
  expect_false(g$p_dim_foda$en_selector)
  expect_true(g$p_barras_apiladas$en_selector)
  cat <- .graficos_tipos_catalogo()
  gc <- setNames(cat$graficadores, vapply(cat$graficadores, `[[`, "", "name"))
  expect_false(gc$p_dim_foda$en_selector)
  expect_true(gc$p_radar$en_selector)
})
