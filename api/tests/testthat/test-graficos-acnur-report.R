source("setup-load-all.R")

.acnur_report_fixture <- function() {
  sid <- session_create()

  parent <- data.frame(
    `_index` = 1:4,
    mand_Date = as.Date(c("2026-06-26", "2026-06-30", "2026-07-03", "2026-07-06")),
    satisfaccion = c("si", "si", "no", ""),
    necesidades = c("alimentos salud", "alimentos", "", "alimentos salud"),
    segmento = c("a", "a", "b", "b"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  parent_inst <- list(
    survey = data.frame(
      type = c(
        "begin_group", "select_one satisfaccion_list",
        "select_multiple necesidades_list", "select_one segmento_list", "end_group"
      ),
      name = c("perfil_necesidades", "satisfaccion", "necesidades", "segmento", ""),
      label = c(
        "Perfil y necesidades", "Satisfaccion con la atencion recibida",
        "Necesidades identificadas", "Segmento de referencia", ""
      ),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c(
        "satisfaccion_list", "satisfaccion_list",
        "necesidades_list", "necesidades_list",
        "segmento_list", "segmento_list"
      ),
      name = c("si", "no", "alimentos", "salud", "a", "b"),
      label = c("Si", "No", "Alimentos", "Salud", "Segmento A", "Segmento B"),
      stringsAsFactors = FALSE
    )
  )

  repeat_data <- data.frame(
    `_index` = 101:105,
    `_parent_index` = c(1L, 1L, 2L, 4L, 4L),
    calidad_servicio = c("satis", "satis", "regular", "ns", "satis"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  repeat_inst <- list(
    survey = data.frame(
      type = c("begin_group", "select_one calidad_list", "end_group"),
      name = c("evaluacion_servicio", "calidad_servicio", ""),
      label = c(
        "rep_servicios",
        "Calidad del servicio recibido",
        ""
      ),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("calidad_list", "calidad_list", "calidad_list"),
      name = c("satis", "regular", "ns"),
      label = c("Satisfactoria", "Regular", "Prefiere no responder"),
      stringsAsFactors = FALSE
    )
  )
  attr(repeat_inst, "repeat_grain") <- list(
    kind = "instancia",
    n_instancias = 5L,
    n_personas = 3L,
    parent_base = "principal"
  )

  estudio_add_base(
    sid, "principal", "xls-main", "data-main", "xlsx",
    parent, parent_inst, nrow(parent), ncol(parent),
    extra_meta = list(
      source_kind = "kobo",
      source_title = "Post-Distribution Monitoring - Espacios de Protección 2026 Q2"
    )
  )
  estudio_add_base(
    sid, "rep_servicios", "xls-repeat", "data-repeat", "xlsx",
    repeat_data, repeat_inst, nrow(repeat_data), ncol(repeat_data),
    extra_meta = list(
      source_kind = "kobo_repeat",
      source_title = "Servicios recibidos",
      parent_base = "principal",
      repeat_group = "rep_servicios",
      link_key = "_parent_index",
      parent_index_key = "_index"
    )
  )

  state <- session_get(sid)
  state$estudio$nombre <- "PDM de ACNUR"
  session_set(sid, "estudio", state$estudio)
  session_set(sid, "project_path", "/tmp/ACNUR_PDM_formal.pulso")
  validacion_scope_set(
    sid,
    "principal",
    "operational_config",
    normalize_validation_operational_config(list(
      version = 2L,
      field_period = list(
        enabled = TRUE,
        variable = "mand_Date",
        start_date = "2026-06-26",
        end_date = "2026-07-06",
        timezone = "America/Lima"
      )
    ))
  )
  sid
}

.acnur_report_slides_by_type <- function(plan, type) {
  Filter(
    function(slide) identical(.graficos_scalar_chr((slide %||% list())$tipo, ""), type),
    (.normalize_plan(plan)$slides %||% list())
  )
}

.acnur_report_payload_text <- function(payload) {
  payload <- .as_json_list(payload) %||% list()
  paste(as.character(unlist(payload, recursive = TRUE, use.names = FALSE)), collapse = " ")
}

.acnur_report_slide_rows <- function(slide) {
  payload <- .as_json_list((slide %||% list())$payload) %||% list()
  rows <- payload$filas %||% payload$rows %||% list()
  paste(as.character(unlist(rows, recursive = TRUE, use.names = FALSE)), collapse = " ")
}

.acnur_report_ascii <- function(x) {
  gsub("['`^~]", "", iconv(as.character(x %||% ""), to = "ASCII//TRANSLIT"))
}

.acnur_report_graphs <- function(plan) {
  out <- list()
  for (slide in (.normalize_plan(plan)$slides %||% list())) {
    payload <- .as_json_list((slide %||% list())$payload) %||% list()
    for (value in payload) {
      graph <- .as_json_list(value)
      if (is.null(graph$graficador)) next
      out[[length(out) + 1L]] <- graph
    }
  }
  out
}

.acnur_report_graph_for_ref <- function(plan, ref) {
  graphs <- .acnur_report_graphs(plan)
  hits <- Filter(function(graph) {
    args <- .as_json_list(graph$args) %||% list()
    ref %in% .graficos_collect_strings(args$var %||% args$vars)
  }, graphs)
  if (!length(hits)) return(NULL)
  hits[[1L]]
}

.acnur_report_graph_note <- function(graph) {
  args <- .as_json_list((graph %||% list())$args) %||% list()
  overrides <- .as_json_list(args$overrides) %||% list()
  .graficos_scalar_chr(overrides$nota_pie %||% args$nota_pie, "")
}

.acnur_report_legend_flag <- function(graph) {
  args <- .as_json_list((graph %||% list())$args) %||% list()
  overrides <- .as_json_list(args$overrides) %||% list()
  value <- overrides$mostrar_leyenda %||% args$mostrar_leyenda
  if (is.null(value)) return(NA)
  isTRUE(value)
}

test_that("ACNUR puede mostrar una barra minima para un cero sin cambiar su etiqueta", {
  data <- data.frame(
    categoria = c("Sin casos", "Con casos"),
    N = c(10, 10),
    pct = c(0, 0.20),
    stringsAsFactors = FALSE
  )
  plot <- graficar_barras_agrupadas(
    data = data,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = "pct",
    etiquetas_series = c(pct = "Porcentaje"),
    mostrar_ceros = TRUE,
    minimo_cero_visual = 0.005,
    umbral_barra = 0,
    mostrar_barra_extra = FALSE
  )
  built <- ggplot2::ggplot_build(plot)

  expect_equal(built$data[[1]]$y, c(0.005, 0.20))
  expect_equal(built$data[[2]]$label, c("0%", "20%"))
  expect_equal(built$data[[2]]$y[[1]], 0.015)
})

test_that("ACNUR construye contenido y separadores desde las secciones reales", {
  sid <- .acnur_report_fixture()
  on.exit(session_delete(sid), add = TRUE)

  suggested <- .graficos_suggested_plan(sid, config = list())
  plan <- suggested$plan
  content_indexes <- .acnur_report_slides_by_type(plan, "p_slide_indice")
  content_tables <- Filter(function(slide) {
    title <- .graficos_scalar_chr(((slide %||% list())$payload %||% list())$titulo, "")
    grepl("^contenido$", title, ignore.case = TRUE)
  }, .acnur_report_slides_by_type(plan, "p_slide_tabla_tecnica"))
  separators <- vapply(
    .acnur_report_slides_by_type(plan, "p_slide_seccion"),
    function(slide) .graficos_scalar_chr(((slide %||% list())$payload %||% list())$titulo, ""),
    character(1)
  )

  expect_length(content_indexes, 1L)
  expect_length(content_tables, 0L)
  if (!length(content_indexes)) return(invisible(NULL))
  content_payload <- .as_json_list(content_indexes[[1L]]$payload) %||% list()
  content <- paste(as.character(content_payload$secciones %||% character(0)), collapse = " ")
  expect_true(isTRUE((.as_json_list(content_payload$estilo) %||% list())$acnur_two_column_index))
  expect_match(.acnur_report_ascii(content), "Perfil y necesidades", ignore.case = TRUE)
  expect_match(.acnur_report_ascii(content), "Evaluacion del servicio recibido", ignore.case = TRUE)
  expect_true("Perfil y necesidades" %in% separators)
  expect_true("Evaluacion del servicio recibido" %in% .acnur_report_ascii(separators))
  expect_false(any(grepl("acreditacion|inteligencia artificial", content, ignore.case = TRUE)))
})

test_that("ACNUR reconoce Kobo de Monitoreo y humaniza un repeat tecnico", {
  expect_equal(.graficos_simplify_source_kind("monitoreo_kobo"), "kobo")

  sid <- .acnur_report_fixture()
  on.exit(session_delete(sid), add = TRUE)
  plan <- .graficos_suggested_plan(sid, config = list())$plan
  visible <- paste(vapply(.normalize_plan(plan)$slides %||% list(), function(slide) {
    .acnur_report_payload_text((slide %||% list())$payload)
  }, character(1)), collapse = " ")

  expect_match(.acnur_report_ascii(visible), "Evaluacion del servicio recibido", ignore.case = TRUE)
  expect_false(grepl("(^|[^$[:alnum:]_])rep_servicios([^$[:alnum:]_]|$)", visible, perl = TRUE))
})

test_that("ficha ACNUR usa el periodo manual y solo informacion afirmativa", {
  sid <- .acnur_report_fixture()
  on.exit(session_delete(sid), add = TRUE)

  plan <- .graficos_suggested_plan(sid, config = list())$plan
  technical <- Filter(function(slide) {
    title <- .graficos_scalar_chr(((slide %||% list())$payload %||% list())$titulo, "")
    grepl("^ficha tecnica$", .acnur_report_ascii(title), ignore.case = TRUE)
  }, .acnur_report_slides_by_type(plan, "p_slide_tabla_tecnica"))

  expect_length(technical, 1L)
  if (!length(technical)) return(invisible(NULL))
  text <- .acnur_report_slide_rows(technical[[1L]])
  expect_match(text, "Periodo de campo", ignore.case = TRUE)
  expect_match(text, "26 jun. 2026", fixed = TRUE)
  expect_match(text, "6 jul. 2026", fixed = TRUE)
  expect_false(grepl("Fuente|KoboToolbox", text, ignore.case = TRUE))
  expect_match(text, "4 personas", ignore.case = TRUE)
  expect_match(text, "Servicios registrados 5 aportados por 3 personas", ignore.case = TRUE)
  expect_false(grepl("Respuestas repetibles", text, ignore.case = TRUE))
  expect_false(grepl("mand_Date|America/Lima|principal|rep_servicios|trazabilidad|metadata", text, ignore.case = TRUE))
})

test_that("ficha territorial documenta seleccion y muestra por ambito", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  state <- session_get(sid)
  state$hojas_ruta_config <- list(
    sampling_method = "pps",
    entrevistas_por_manzana = 8L,
    n_por_distrito = stats::setNames(as.list(rep(200L, 6L)),
                                    c("150103", "150108", "150117", "150132", "150133", "150135")),
    row_var = "distrito",
    subquota_var = "sexo",
    col_var = "rango_edad",
    age_ranges = list(list(min = 18L, max = 29L), list(min = 60L, max = NA_integer_))
  )
  .session_env[[sid]] <- state
  data <- data.frame(
    M5_district = c("smp", "smp", "olivos", "sjl", "ate", "chorrillos", "sjm", "sjm"),
    stringsAsFactors = FALSE
  )
  context <- list(
    sid = sid,
    study_name = "ACNURCG",
    period = .graficos_acnur_period_from_dates("2026-06-13", "2026-07-03"),
    main = list(data = data, n_rows = nrow(data)),
    repeats = list()
  )

  rows <- .graficos_acnur_technical_rows(context, territorial = TRUE)
  text <- .acnur_report_ascii(paste(unlist(rows, recursive = TRUE, use.names = FALSE), collapse = " "))

  # Filas nuevas de la seccion A del spec (constantes de contenido del estudio).
  expect_match(text, "Tipo de estudio.*Cuantitativo, cuasi-experimental", ignore.case = TRUE)
  expect_match(text, "Diseno muestral.*Territorial por conglomerados", ignore.case = TRUE)
  expect_match(text, "seleccion probabilistica de manzanas \\(PPS\\)", ignore.case = TRUE)
  expect_match(text, "Marco muestral.*Manzanas censales INEI 2017", ignore.case = TRUE)
  expect_match(text, "Grupos de analisis.*Intervencion \\(SMP, SJL, Chorrillos\\)", ignore.case = TRUE)
  expect_match(text, "Seleccion en el hogar.*ruta sistematica", ignore.case = TRUE)
  expect_match(text, "Precision \\(diseno\\).*4.1 pp grupo", ignore.case = TRUE)
  expect_match(text, "Fuentes de seleccion de distritos.*proGres \\(ACNUR\\).*INEI 2026", ignore.case = TRUE)
  # Filas auto que se conservan.
  expect_match(text, "Personas de 18 anos a mas", ignore.case = TRUE)
  expect_match(text, "25 manzanas titulares por distrito", ignore.case = TRUE)
  expect_match(text, "probabilidad proporcional al numero de viviendas", ignore.case = TRUE)
  expect_match(text, "hasta 8 entrevistas por manzana", ignore.case = TRUE)
  expect_match(text, "capacidad operativa 200/distrito \\(no analitica\\)", ignore.case = TRUE)
  expect_match(text, "Cuotas por distrito, sexo y grupo de edad", ignore.case = TRUE)
  expect_match(text, "Muestra analizada 8 personas \\(meta de diseno 1,134\\)", ignore.case = TRUE)
  expect_match(text, "Lima Norte 3 personas.*San Martin de Porres 2.*Los Olivos 1", ignore.case = TRUE)
  expect_match(text, "Lima Este 2 personas.*San Juan de Lurigancho 1.*Ate 1", ignore.case = TRUE)
  expect_match(text, "Lima Sur 3 personas.*Chorrillos 1.*San Juan de Miraflores 2", ignore.case = TRUE)
  # Ya no debe leerse como contraste pareado ni exponer metadata interna.
  expect_false(grepl("semilla|metadata|trazabilidad", text, ignore.case = TRUE))
})

test_that("ficha territorial se parte en dos laminas sin desbordar la tabla", {
  style <- .graficos_acnur_table_style()
  rows <- lapply(seq_len(16L), function(i) {
    list(criterio = paste0("Criterio ", i), detalle = paste0("Detalle ", i))
  })

  slides <- .graficos_acnur_technical_slides(rows, style)
  titles <- .acnur_report_ascii(vapply(
    slides, function(slide) .graficos_scalar_chr(slide$payload$titulo, ""), character(1)
  ))
  counts <- vapply(slides, function(slide) length(slide$payload$filas), integer(1))

  expect_length(slides, 2L)
  expect_true(all(vapply(slides, function(slide) {
    identical(.graficos_scalar_chr(slide$tipo, ""), "p_slide_tabla_tecnica")
  }, logical(1))))
  expect_equal(titles, c("Ficha tecnica", "Ficha tecnica (cont.)"))
  expect_equal(sum(counts), 16L)
  # Ninguna lamina desborda: filas x alto minimo <= altura fija de la tabla.
  expect_true(all(counts * style$min_row_height <= style$table_height))
  # Bajo el umbral queda una sola lamina.
  expect_length(.graficos_acnur_technical_slides(rows[seq_len(9L)], style), 1L)
})

test_that("portada ACNUR usa el titulo de la fuente cuando el proyecto no tiene nombre", {
  sid <- .acnur_report_fixture()
  on.exit(session_delete(sid), add = TRUE)
  state <- session_get(sid)
  state$estudio$nombre <- ""
  session_set(sid, "estudio", state$estudio)

  cover <- .acnur_report_slides_by_type(
    .graficos_suggested_plan(sid, config = list())$plan,
    "p_slide_portada"
  )[[1L]]
  expect_equal(
    .graficos_scalar_chr((cover$payload %||% list())$titulo, ""),
    "Post-Distribution Monitoring - Espacios de Protección 2026 Q2"
  )
})

test_that("pregunta principal declara su base especifica y no el universo fijo", {
  sid <- .acnur_report_fixture()
  on.exit(session_delete(sid), add = TRUE)

  plan <- .graficos_suggested_plan(sid, config = list())$plan
  graph <- .acnur_report_graph_for_ref(plan, "principal$satisfaccion")
  note <- .acnur_report_ascii(.acnur_report_graph_note(graph))

  expect_false(is.null(graph))
  expect_equal(note, "N = 3 (75.0% del total).")
  expect_false(grepl("4 encuestas", note, ignore.case = TRUE))
})

test_that("opcion multiple separa personas que respondieron y menciones", {
  sid <- .acnur_report_fixture()
  on.exit(session_delete(sid), add = TRUE)

  plan <- .graficos_suggested_plan(sid, config = list())$plan
  graph <- .acnur_report_graph_for_ref(plan, "principal$necesidades")
  note <- .acnur_report_ascii(.acnur_report_graph_note(graph))

  expect_false(is.null(graph))
  expect_match(note, "N = 3 \\(75.0% del total\\)", ignore.case = TRUE)
  expect_match(note, "5 menciones", ignore.case = TRUE)
  expect_match(note, "no suman 100%", fixed = TRUE)
  expect_false(grepl("N = 5 personas", note, ignore.case = TRUE))
})

test_that("pregunta repetible distingue servicios y personas unicas", {
  sid <- .acnur_report_fixture()
  on.exit(session_delete(sid), add = TRUE)

  plan <- .graficos_suggested_plan(sid, config = list())$plan
  graph <- .acnur_report_graph_for_ref(plan, "rep_servicios$calidad_servicio")
  note <- .acnur_report_ascii(.acnur_report_graph_note(graph))

  expect_false(is.null(graph))
  expect_match(note, "N = 4 \\(80.0% del total\\)", ignore.case = TRUE)
  expect_false(grepl("correspondientes a", note, ignore.case = TRUE))
  expect_false(grepl("respuestas de servicio", note, ignore.case = TRUE))
  expect_match(note, "1 respuesta: .*Prefiere no responder", ignore.case = TRUE)
  expect_false(grepl("encuestas", note, ignore.case = TRUE))
})

test_that("una serie ACNUR no muestra leyenda y un cruce si la conserva", {
  sid <- .acnur_report_fixture()
  on.exit(session_delete(sid), add = TRUE)

  suggested <- .graficos_suggested_plan(sid, config = list())
  single <- .acnur_report_graph_for_ref(suggested$plan, "principal$satisfaccion")
  source <- suggested$coverage$sources[[which(vapply(
    suggested$coverage$sources,
    function(item) identical(.graficos_scalar_chr(item$name, ""), "principal"),
    logical(1)
  ))]]
  variable <- Filter(
    function(item) identical(.graficos_scalar_chr(item$name, ""), "satisfaccion"),
    source$variables
  )[[1L]]
  crossed <- .graficos_chart_for_var(
    variable,
    "principal$satisfaccion",
    profile_id = "acnur_kobo_cruncher_plus",
    comparison_ref = "principal$segmento",
    base_label = source$base_label
  )

  expect_false(.acnur_report_legend_flag(single))
  expect_true(.acnur_report_legend_flag(crossed))
  expect_equal(.graficos_scalar_chr(crossed$args$cruces, ""), "principal$segmento")
})

test_that("ACNUR entrega un solo informe para la estructura relacional", {
  sid <- .acnur_report_fixture()
  on.exit(session_delete(sid), add = TRUE)

  suggested <- .graficos_suggested_plan(sid, config = list())
  slides <- .normalize_plan(suggested$plan)$slides %||% list()
  covers <- .acnur_report_slides_by_type(suggested$plan, "p_slide_portada")
  refs <- .graficos_collect_plan_refs(suggested$plan)
  visible <- paste(vapply(slides, function(slide) {
    .acnur_report_payload_text((slide %||% list())$payload)
  }, character(1)), collapse = " ")

  expect_equal(suggested$report_scope, "single_study")
  expect_equal(suggested$template_id, "acnur_16_9")
  expect_length(covers, 1L)
  expect_true("principal$satisfaccion" %in% refs)
  expect_true("rep_servicios$calidad_servicio" %in% refs)
  expect_false(grepl("dos estudios|segundo informe|667 encuestas", visible, ignore.case = TRUE))
})

test_that("contenido ACNUR dispone siete secciones en una sola lamina de dos columnas", {
  sections <- paste("Sección", seq_len(7L))
  slides <- .graficos_acnur_content_slides(
    sections,
    single_limit = 8L,
    per_slide = 8L
  )

  expect_length(slides, 1L)
  expect_equal(.graficos_scalar_chr(slides[[1L]]$tipo, ""), "p_slide_indice")
  expect_equal(slides[[1L]]$payload$secciones, sections)
  expect_true(isTRUE(slides[[1L]]$payload$estilo$acnur_two_column_index))
  expect_equal(slides[[1L]]$payload$estilo$column_break, 4L)
})

test_that("paginacion del contenido ACNUR admite limites configurados", {
  sections <- paste("Sección", seq_len(9L))
  one_slide <- .graficos_acnur_content_slides(sections, single_limit = 8L, per_slide = 3L)
  paged <- .graficos_acnur_content_slides(sections, single_limit = 5L, per_slide = 8L)

  expect_length(one_slide, 3L)
  expect_equal(vapply(one_slide, function(slide) length(slide$payload$secciones), integer(1)), c(3L, 3L, 3L))
  expect_length(paged, 2L)
  expect_equal(vapply(paged, function(slide) length(slide$payload$secciones), integer(1)), c(8L, 1L))
  expect_equal(vapply(paged, function(slide) .graficos_scalar_chr(slide$payload$titulo, ""), character(1)),
               c("Contenido", "Contenido · 2"))
})

test_that("perfil ACNUR fija la escala tipografica acordada sin reductores", {
  profile <- .PPT_STYLE_PROFILES$acnur_kobo_cruncher_plus$presets

  expect_equal(profile$base$size_titulo_slide, 24)
  expect_equal(profile$base$size_ejes, 16)
  expect_equal(profile$base$size_texto_barras * (72.27 / 25.4), 16, tolerance = 0.05)
  expect_true(isTRUE(profile$barras_agrupadas$usar_canvas))
  expect_true(isTRUE(profile$barras_agrupadas$preservar_tamanos_texto))
  expect_true(isTRUE(profile$barras_agrupadas$canvas_w_adaptativo))
  expect_equal(profile$base$height_subtitulo_portada, 0.95)
})

test_that("perfil ACNUR resume categorias con etiquetas del instrumento", {
  context <- list(
    main = list(
      data = data.frame(sexo = c("2", "1", "2", "3"), stringsAsFactors = FALSE),
      inst = list(
        survey = data.frame(
          type = "select_one sexo_lista",
          name = "sexo",
          label = "Sexo",
          stringsAsFactors = FALSE
        ),
        choices = data.frame(
          list_name = rep("sexo_lista", 3L),
          name = c("1", "2", "3"),
          label = c("Hombre", "Mujer", "Otro"),
          stringsAsFactors = FALSE
        )
      )
    )
  )

  expect_equal(
    .graficos_acnur_profile_breakdown(context, "sexo"),
    "Hombre 1 · Mujer 2 · Otro 1"
  )
})

test_that("portada ACNUR compacta el año cuando el periodo pertenece al mismo año", {
  sid <- .acnur_report_fixture()
  on.exit(session_delete(sid), add = TRUE)

  plan <- .graficos_suggested_plan(sid, config = list())$plan
  cover <- .acnur_report_slides_by_type(plan, "p_slide_portada")[[1L]]
  payload <- .as_json_list(cover$payload) %||% list()

  expect_equal(.graficos_scalar_chr(payload$fecha, ""), "")
  expect_equal(
    .graficos_scalar_chr(payload$subtitulo, ""),
    "Informe de resultados\n26 jun. – 6 jul. 2026"
  )
})

test_that("plan sugerido ACNUR expone los insumos del informe sin metadata interna", {
  sid <- .acnur_report_fixture()
  on.exit(session_delete(sid), add = TRUE)

  suggested <- .graficos_suggested_plan(sid, config = list())
  inputs <- suggested$report_inputs %||% list()

  expect_equal(inputs$period, "26 jun. 2026 – 6 jul. 2026")
  expect_equal(inputs$period_source, "manual")
  expect_true(is.list(inputs$technical_rows))
  expect_true(all(vapply(inputs$technical_rows, function(row) {
    identical(sort(names(row)), c("criterio", "detalle"))
  }, logical(1))))
  expect_length(inputs$derived_variables, 0L)
  expect_identical(inputs$profile, list(available = FALSE))
  expect_false(inputs$map_included)
  expect_equal(inputs$comparison_mode, "none")
})

test_that("insumos ACNUR territoriales identifican el perfil y sus derivadas", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  data <- data.frame(
    M5_district = c("smp", "olivos"),
    E1_age = c(24, 61),
    E1_age_calc = c("18 a 29 años", "60 años o más"),
    E2_sex = c("1", "2"),
    stringsAsFactors = FALSE
  )
  inst <- list(
    survey = data.frame(
      type = c("select_one district", "integer", "calculate", "select_one sex"),
      name = c("M5_district", "E1_age", "E1_age_calc", "E2_sex"),
      label = c("Distrito", "Edad", "Grupo de edad", "Sexo"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("district", "district", "sex", "sex"),
      name = c("smp", "olivos", "1", "2"),
      label = c("San Martín de Porres", "Los Olivos", "Hombre", "Mujer"),
      stringsAsFactors = FALSE
    )
  )
  estudio_add_base(
    sid, "principal", "xls", "data", "xlsx", data, inst, nrow(data), ncol(data),
    extra_meta = list(source_kind = "monitoreo_territorial", source_title = "ACNUR territorial")
  )
  state <- session_get(sid)
  state$estudio$nombre <- "ACNUR territorial"
  state$monitoreo_config <- list(territorial = list(
    district_var = "M5_district",
    age_var = "E1_age",
    sex_var = "E2_sex"
  ))
  .session_env[[sid]] <- state

  suggested <- .graficos_suggested_plan(sid, config = list(
    profile_id = "acnur_kobo_cruncher_plus",
    acnur_mode = "territorial",
    include_coverage_maps = FALSE,
    comparison_mode = "paired_district"
  ))
  inputs <- suggested$report_inputs

  expect_true(inputs$profile$available)
  expect_equal(inputs$profile$sex_variable, "E2_sex")
  expect_equal(inputs$profile$age_variable, "E1_age_calc")
  expect_setequal(
    vapply(inputs$derived_variables, `[[`, character(1), "name"),
    c("__district", "__territory_pair", "__age_group")
  )
  expect_false(inputs$map_included)
  expect_equal(inputs$comparison_mode, "paired_district")
})

test_that("periodo observado queda identificado cuando no hay fechas manuales", {
  sid <- .acnur_report_fixture()
  on.exit(session_delete(sid), add = TRUE)
  validacion_scope_set(
    sid,
    "principal",
    "operational_config",
    normalize_validation_operational_config(list(
      version = 2L,
      field_period = list(enabled = FALSE)
    ))
  )
  state <- session_get(sid)
  state$monitoreo_config <- list(date_var = "mand_Date")
  .session_env[[sid]] <- state

  period <- .graficos_acnur_field_period(sid, "principal")

  expect_equal(period$label, "26 jun. 2026 – 6 jul. 2026")
  expect_equal(period$source, "observed")
})

test_that("ficha técnica declara filas estructuradas en el registry", {
  args <- .SLIDES_META$p_slide_tabla_tecnica$args
  field <- Filter(function(item) identical(item$name, "filas"), args)

  expect_length(field, 1L)
  expect_equal(field[[1L]]$tipo_input, "technical_rows")
})

test_that("insumos territoriales declaran solo variables derivadas disponibles", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  state <- session_get(sid)
  state$monitoreo_config <- list(territorial = list(
    district_var = "Core/M5_district",
    age_var = "Core/E1_age"
  ))
  .session_env[[sid]] <- state
  context <- list(
    sid = sid,
    main = list(
      name = "principal",
      data = data.frame(
        `Core/M5_district` = c("smp", "olivos"),
        `Core/E1_age` = c(24, 61),
        check.names = FALSE
      )
    )
  )

  variables <- .graficos_acnur_derived_variables(context, territorial = TRUE)

  expect_setequal(
    vapply(variables, `[[`, character(1), "name"),
    c("__district", "__territory_pair", "__age_group")
  )
  expect_true(all(vapply(variables, function(item) {
    identical(item$source, "principal") && nzchar(item$label) && nzchar(item$origin)
  }, logical(1))))
  expect_length(.graficos_acnur_derived_variables(context, territorial = FALSE), 0L)
})

test_that("respuestas especiales se reconocen aunque la etiqueta traiga traduccion", {
  variable <- list(
    choices = list(
      list(name = "1", label = "Sí Yes"),
      list(name = "98", label = "Prefiere no decir He prefers not to say")
    )
  )

  specials <- .graficos_acnur_special_choices(variable)

  expect_equal(specials$codes, "98")
  expect_equal(specials$labels, "Prefiere no decir")
})
