# Contrato de "listas ordinales" en entregables:
#   - Frecuencias: una lista marcada ordinal mantiene el orden fijo del
#     instrumento aunque el orden global sea desc/asc; una nominal se ordena
#     por conteo.
#   - Cruces: con orden=desc, las filas de una variable nominal se ordenan por
#     su frecuencia marginal (Total); las de una variable ordinal no.

# Instrumento con una lista ORDINAL (likert) y una NOMINAL (region). Los
# conteos crecen con el código en `satisf`, así que si se ordenara por conteo
# (desc) quedaría 4,3,2,1 — lo contrario a su orden ordinal fijo.
.li_instrumento <- function() {
  list(
    survey = data.frame(
      name      = c("satisf", "region", "sexo"),
      type      = c("select_one", "select_one", "select_one"),
      list_name = c("likert", "region", "sexo"),
      label     = c("Satisfacción", "Región", "Sexo"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c(rep("likert", 4), rep("region", 3), rep("sexo", 2)),
      name      = c("1", "2", "3", "4", "1", "2", "3", "1", "2"),
      label     = c("Nada", "Poco", "Algo", "Mucho",
                    "Lima", "Cusco", "Arequipa",
                    "Hombre", "Mujer"),
      stringsAsFactors = FALSE
    )
  )
}

.li_data <- function() {
  data.frame(
    # counts: 1->1, 2->2, 3->3, 4->4  (crece con el código)
    satisf = c("1", "2", "2", "3", "3", "3", "4", "4", "4", "4"),
    # counts: Cusco(2)=5, Arequipa(3)=3, Lima(1)=2  => desc: Cusco, Arequipa, Lima
    region = c("2", "2", "2", "2", "2", "3", "3", "3", "1", "1"),
    sexo   = rep(c("1", "2"), 5),
    stringsAsFactors = FALSE
  )
}

# Posición de la primera aparición de un valor en el primer columna del xlsx.
.li_first_col <- function(path) {
  raw <- readxl::read_excel(path, col_names = FALSE)
  col1 <- as.character(raw[[1]])
  col1[!is.na(col1)]
}

test_that("frecuencias: una lista ordinal marcada conserva el orden del instrumento; la nominal se ordena por conteo", {
  skip_if_not_installed("readxl")
  inst <- .li_instrumento()
  data <- .li_data()

  out <- tempfile(fileext = ".xlsx")
  on.exit(unlink(out), add = TRUE)

  reporte_frecuencias(
    data = data, instrumento = inst,
    secciones = list(Ordinal = "satisf", Nominal = "region"),
    path_xlsx = out,
    orden = "desc",
    ordinal_lists = c("likert"),  # satisf es ordinal-efectiva; region no
    ficha_tecnica = FALSE
  )

  col1 <- .li_first_col(out)
  pos <- function(x) which(col1 == x)[1]

  # satisf ORDINAL => orden fijo del instrumento (Nada, Poco, Algo, Mucho),
  # aunque el conteo desc sugeriría Mucho primero.
  expect_true(pos("Nada") < pos("Poco"))
  expect_true(pos("Poco") < pos("Algo"))
  expect_true(pos("Algo") < pos("Mucho"))

  # region NOMINAL => ordenada por conteo desc (Cusco, Arequipa, Lima).
  expect_true(pos("Cusco") < pos("Arequipa"))
  expect_true(pos("Arequipa") < pos("Lima"))
})

test_that("frecuencias: sin marcar ordinal, la misma lista sí se ordena por conteo", {
  skip_if_not_installed("readxl")
  inst <- .li_instrumento()
  data <- .li_data()

  out <- tempfile(fileext = ".xlsx")
  on.exit(unlink(out), add = TRUE)

  reporte_frecuencias(
    data = data, instrumento = inst,
    secciones = list(Ordinal = "satisf"),
    path_xlsx = out,
    orden = "desc",
    ordinal_lists = character(),  # nadie protegido => obedece desc
    ficha_tecnica = FALSE
  )

  col1 <- .li_first_col(out)
  pos <- function(x) which(col1 == x)[1]
  # Ahora satisf se ordena por conteo desc: Mucho(4), Algo(3), Poco(2), Nada(1).
  expect_true(pos("Mucho") < pos("Algo"))
  expect_true(pos("Algo") < pos("Poco"))
  expect_true(pos("Poco") < pos("Nada"))
})

test_that("cruces: con orden=desc la fila nominal se ordena por frecuencia marginal y la ordinal no", {
  skip_if_not_installed("readxl")
  inst <- .li_instrumento()
  data <- .li_data()

  out <- tempfile(fileext = ".xlsx")
  on.exit(unlink(out), add = TRUE)

  expect_no_error(
    reporte_cruces(
      data = data, instrumento = inst,
      SECCIONES = list(General = c("satisf", "region")),
      cruces = "sexo",
      path_xlsx = out,
      show_sig = FALSE,
      orden = "desc",
      ordinal_lists = c("likert")  # satisf protegida; region libre
    )
  )

  col1 <- .li_first_col(out)
  pos <- function(x) which(col1 == x)[1]

  # satisf ORDINAL => filas en orden fijo del instrumento.
  expect_true(pos("Nada") < pos("Poco"))
  expect_true(pos("Poco") < pos("Algo"))
  expect_true(pos("Algo") < pos("Mucho"))

  # region NOMINAL => filas por frecuencia marginal desc (Cusco, Arequipa, Lima).
  expect_true(pos("Cusco") < pos("Arequipa"))
  expect_true(pos("Arequipa") < pos("Lima"))
})

test_that("cruces: orden=original deja todas las filas en orden fijo", {
  skip_if_not_installed("readxl")
  inst <- .li_instrumento()
  data <- .li_data()

  out <- tempfile(fileext = ".xlsx")
  on.exit(unlink(out), add = TRUE)

  reporte_cruces(
    data = data, instrumento = inst,
    SECCIONES = list(General = "region"),
    cruces = "sexo",
    path_xlsx = out,
    show_sig = FALSE,
    orden = "original",
    ordinal_lists = character()
  )

  col1 <- .li_first_col(out)
  pos <- function(x) which(col1 == x)[1]
  # region queda en orden del instrumento (Lima, Cusco, Arequipa), no por conteo.
  expect_true(pos("Lima") < pos("Cusco"))
  expect_true(pos("Cusco") < pos("Arequipa"))
})

# ---------------------------------------------------------------------------
# Panel de Analitica: los entregables construyen el instrumento wide con
# `list_name` sufijados por medicion (likert_medN). El contrato es el mismo
# que en la ruta estandar, PERO exige que `inst_wide` conserve
# `dicc_code_to_label` para que la auto-deteccion de likert funcione sin que
# el analista marque nada.
# ---------------------------------------------------------------------------

# Dos mediciones con la misma estructura: una lista ORDINAL (likert) cuyos
# conteos crecen con el codigo (desc la voltearia) y una NOMINAL (region).
.li_panel_built <- function() {
  inst <- list(
    survey = data.frame(
      name      = c("numero_encuesta", "satisf", "region"),
      type      = c("text", "select_one likert", "select_one region"),
      label     = c("Numero de encuesta", "Satisfaccion", "Region"),
      list_name = c("", "likert", "region"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c(rep("likert", 4), rep("region", 3)),
      name      = c("1", "2", "3", "4", "1", "2", "3"),
      label     = c("Nada", "Poco", "Algo", "Mucho", "Lima", "Cusco", "Arequipa"),
      stringsAsFactors = FALSE
    )
  )
  wave <- function() data.frame(
    numero_encuesta = as.character(1:10),
    # counts: 1->1, 2->2, 3->3, 4->4 (crece con el codigo)
    satisf = c("1", "2", "2", "3", "3", "3", "4", "4", "4", "4"),
    # counts: Cusco(2)=5, Arequipa(3)=3, Lima(1)=2 => desc: Cusco, Arequipa, Lima
    region = c("2", "2", "2", "2", "2", "3", "3", "3", "1", "1"),
    stringsAsFactors = FALSE
  )
  data_sources <- list(ola_1 = wave(), ola_2 = wave())
  inst_sources <- list(ola_1 = inst, ola_2 = inst)
  .panel_wide_build(data_sources, inst_sources, list())
}

test_that("panel (detalle critico): inst_wide conserva dicc_code_to_label y la auto-deteccion devuelve las listas ordinales sufijadas", {
  built <- .li_panel_built()
  ctx <- .panel_report_context(built)

  # El instrumento panel DEBE llevar el diccionario code->label indexado por
  # los list_name sufijados; sin el, la auto-deteccion de ordinales seria
  # inerte (regresion del cableado).
  expect_true(is.list(ctx$inst$dicc_code_to_label))
  expect_true(length(ctx$inst$dicc_code_to_label) > 0L)
  ln_ordinales <- grep("^likert_", names(ctx$inst$dicc_code_to_label), value = TRUE)
  expect_true(length(ln_ordinales) >= 1L)

  # Auto-deteccion (sin override manual): likert_* efectivas, region_* no.
  ordinal_set <- .orden_categorias_ordinal_set(ctx$inst, list())
  expect_true(all(ln_ordinales %in% ordinal_set))
  expect_false(any(grepl("^region_", ordinal_set)))
})

test_that("panel frecuencias: la lista ordinal auto-detectada conserva el orden del instrumento; la nominal se ordena por conteo (orden=desc)", {
  skip_if_not_installed("readxl")
  built <- .li_panel_built()

  out <- tempfile(fileext = ".xlsx")
  on.exit(unlink(out), add = TRUE)

  # Excluye las columnas indicadoras `presente_medN` (logicas TRUE/FALSE) para
  # que el test ejerza solo satisf/region. El reorder por instrumento de esas
  # indicadoras dispara un warning `max()` pre-existente del panel, ajeno al
  # cableado ordinal bajo prueba.
  presente_cols <- paste0("presente_", .panel_measurement_suffixes(built))
  # cfg SIN listas_ordinales: se apoya solo en la auto-deteccion (likert).
  .panel_export_frequencies_xlsx(
    built, out,
    ficha_tecnica = list(cfg = list(
      frecuencias = list(orden = "desc"),
      variables_excluidas = presente_cols
    ))
  )

  col1 <- .li_first_col(out)
  pos <- function(x) which(col1 == x)[1]

  # satisf ORDINAL (via auto-deteccion) => orden fijo del instrumento aunque
  # el conteo desc sugeriria Mucho primero.
  expect_true(pos("Nada") < pos("Poco"))
  expect_true(pos("Poco") < pos("Algo"))
  expect_true(pos("Algo") < pos("Mucho"))

  # region NOMINAL => ordenada por conteo desc (Cusco, Arequipa, Lima).
  expect_true(pos("Cusco") < pos("Arequipa"))
  expect_true(pos("Arequipa") < pos("Lima"))
})

test_that("panel cruces: hereda orden del cfg y protege la lista ordinal auto-detectada", {
  skip_if_not_installed("readxl")
  built <- .li_panel_built()

  # Fuerza una variable de cruce (region_med*) para el reporte de cruces.
  suffixes <- .panel_measurement_suffixes(built)
  cruce_var <- paste0("region_", suffixes[1])
  built$config$cross_vars <- stats::setNames(
    list(list(name = cruce_var, label = cruce_var)),
    "cruce_region"
  )

  out <- tempfile(fileext = ".xlsx")
  on.exit(unlink(out), add = TRUE)

  presente_cols <- paste0("presente_", .panel_measurement_suffixes(built))
  expect_no_error(
    .panel_export_crosses_xlsx(
      built, out,
      ficha_tecnica = list(cfg = list(
        cruces = list(orden = "desc", show_sig = FALSE),
        variables_excluidas = presente_cols
      ))
    )
  )

  col1 <- .li_first_col(out)
  pos <- function(x) which(col1 == x)[1]
  # satisf ORDINAL => filas en orden fijo del instrumento pese a orden=desc.
  expect_true(pos("Nada") < pos("Poco"))
  expect_true(pos("Poco") < pos("Algo"))
  expect_true(pos("Algo") < pos("Mucho"))
})
