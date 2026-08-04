# B11 del GOAL motor PPT (carril L9, hallazgo B-H18): la leyenda de fallback
# del FODA etiquetaba los colores con sus NOMBRES ("Rojo", "Ambar", "Verde")
# en vez de su significado. Ahora usa los umbrales del semaforo.

test_that("la leyenda del FODA dice el umbral, no el nombre del color", {
  labs <- .dim_foda_legend_labels(list(cortes = c(60, 80)))
  expect_identical(labs, c("Menor a 60", "60 - 80", "Mayor a 80"))
  expect_false(any(c("Rojo", "Ambar", "Verde") %in% labs))
})

test_that("sin cortes finitos degrada a Bajo/Medio/Alto (nunca nombres de color)", {
  expect_identical(.dim_foda_legend_labels(list()), c("Bajo", "Medio", "Alto"))
  expect_identical(.dim_foda_legend_labels(list(cortes = NA)), c("Bajo", "Medio", "Alto"))
})

# B12 (B-H20): el catálogo de dimensiones perdía la etiqueta humana del
# índice — indice("global", "Índice global de satisfacción") se presentaba y
# resolvía como "Global" porque label_idx embellecía la clave antes de mirar
# meta_indices y los labels reales de la columna.

.l9_dim_ctx <- function() {
  dat <- data.frame(
    p1 = c("5", "4", "5", "4", "5", "4"),
    p2 = c("4", "4", "5", "3", "5", "4"),
    stringsAsFactors = FALSE
  )
  survey <- data.frame(
    name = c("p1", "p2"), type = rep("select_one sat", 2),
    list_name = rep("sat", 2), label = c("P1", "P2"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = "sat", name = as.character(1:5), label = as.character(1:5),
    stringsAsFactors = FALSE
  )
  inst <- list(survey = survey, choices = choices, orders_list = NULL)
  d1 <- reporte_dimensiones(
    data = dat, instrumento = inst, vars = c("p1", "p2"),
    prefijo = "r100_", reemplazar = FALSE,
    orden_por_lista = list(sat = as.character(1:5))
  )
  d2 <- reporte_dimensiones_indices(
    data = d1,
    subindices = list(
      subindice("s1", "Atención al usuario", "r100_p1"),
      subindice("s2", "Canales digitales", "r100_p2")
    ),
    indices = list(
      indice("global", "Índice global de satisfacción", c("s1", "s2"))
    )
  )
  list(data = d2, inst = inst)
}

test_that("el catálogo de dimensiones conserva la etiqueta humana del índice", {
  fx <- .l9_dim_ctx()
  ctx <- .dim_build_context(data = fx$data, instrumento = fx$inst)
  expect_identical(
    ctx$catalog_general[["idx_global"]]$label,
    "Índice global de satisfacción"
  )
})

test_that("el objetivo se resuelve también por la etiqueta humana", {
  fx <- .l9_dim_ctx()
  ctx <- .dim_build_context(data = fx$data, instrumento = fx$inst)
  payload <- .dim_build_payload(
    ctx = ctx, modo = "general",
    objetivo = "Índice global de satisfacción"
  )
  expect_false(is.null(payload))
})

# B18: titulos_areas_foda acepta el formato textual del textarea de la UI
# ("cuadrante=Titulo" por linea) y tolera plurales — antes las claves en
# plural se ignoraban en silencio.

test_that("titulos_areas_foda parsea el formato textual y tolera plurales", {
  el <- p_dim_foda(
    nivel = "subindices", objetivo = "idx_x",
    titulos_areas_foda = "fortalezas=LO QUE FUNCIONA\noportunidad=DONDE CRECER\ndebilidades=LO QUE FALLA\namenaza=RIESGOS"
  )
  t <- el$overrides$titulos_areas_foda
  expect_identical(unname(t[["fortaleza"]]), "LO QUE FUNCIONA")
  expect_identical(unname(t[["oportunidad"]]), "DONDE CRECER")
  expect_identical(unname(t[["debilidad"]]), "LO QUE FALLA")
  expect_identical(unname(t[["amenaza"]]), "RIESGOS")
})

test_that("titulos_areas_foda con vector nombrado en plural tambien mapea", {
  el <- p_dim_foda(
    nivel = "subindices", objetivo = "idx_x",
    titulos_areas_foda = c(fortalezas = "A", amenazas = "B")
  )
  t <- el$overrides$titulos_areas_foda
  expect_identical(unname(t[["fortaleza"]]), "A")
  expect_identical(unname(t[["amenaza"]]), "B")
})
