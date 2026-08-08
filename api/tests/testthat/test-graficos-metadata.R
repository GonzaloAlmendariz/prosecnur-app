# Contrato de graficos_metadata.R (unidad 5.7 — grandes sin test dedicado).
#
# graficos_metadata.R (~3,900 líneas) es la capa de traducción entre los
# formals() técnicos y la UI del Plan PPT: todo lo que serializa
# /api/graficos/registry, /presets-metadata, /templates y los perfiles de
# estilo sale de aquí. test-graficos-argumentos-ui.R ya cubre la CURADURÍA de
# args de graficadores puntuales y los presets; esta suite fija el contrato
# ESTRUCTURAL del catálogo:
#
#   - .graficos_registry_payload: shape por entrada, categorías válidas,
#     nombres únicos que existen como función, slots consistentes con formals
#   - gate de capabilities (territorial_coverage deshabilitado por default)
#   - .slide_meta/.graf_meta/.slide_slots/.slide_categoria ante desconocidos
#   - .normalize_args_for_ui: qué args JAMÁS llegan a la UI y el remapeo de
#     grupos legacy a grupos de intención
#   - .graf_arg_ui_group / .graf_arg_numeric_defaults: enrutamiento y rangos
#   - .templates_payload / .ppt_style_profiles_payload: planes de arranque

source("setup-load-all.R")

.gm_categorias_validas <- c(
  "estructural", "1grafico", "2graficos", "4graficos", "poblacion", "dimensiones"
)

.gm_slide_blueprints <- list(
  p_slide_portada = c(kind = "cover", ppt_layout = "Title Slide", structure_label = "Portada editorial"),
  p_slide_indice = c(kind = "index", ppt_layout = "Indice", structure_label = "Índice editorial"),
  p_slide_top_two_box = c(kind = "topTwo", ppt_layout = "Title and Content", structure_label = "Explicación visual"),
  p_slide_seccion = c(kind = "section", ppt_layout = "Section Header", structure_label = "Separador editorial"),
  p_slide_objetivo_icono = c(kind = "objective", ppt_layout = "Objetivos_Secciones", structure_label = "Texto con ícono"),
  p_slide_texto = c(kind = "text", ppt_layout = "Title and Content", structure_label = "Texto editorial"),
  p_slide_tabla_tecnica = c(kind = "technical", ppt_layout = "Title and Content", structure_label = "Tabla editorial"),
  p_slide_1_grafico = c(kind = "single", ppt_layout = "Graficos2", structure_label = "Gráfico principal"),
  p_slide_1_grafico_narrativo = c(kind = "singleNarrative", ppt_layout = "1_Grafico_narrativo", structure_label = "Narrativa + gráfico"),
  p_slide_grafico_texto_derecha = c(kind = "splitRight", ppt_layout = "right_grafico_texto", structure_label = "Gráfico + texto"),
  p_slide_grafico_texto_izquierda = c(kind = "splitLeft", ppt_layout = "left_grafico_texto", structure_label = "Texto + gráfico"),
  p_slide_2_graficos = c(kind = "two", ppt_layout = "Graficos_2columnas", structure_label = "Dos columnas"),
  p_slide_2_graficos_narrativo = c(kind = "twoNarrative", ppt_layout = "1_Graficos_2columnas_narrativo", structure_label = "Narrativa + comparación"),
  p_slide_2_graficos_texto_izquierda = c(kind = "twoTextLeft", ppt_layout = "left_2graficos_texto", structure_label = "Texto + dos gráficos"),
  p_slide_2_graficos_texto_derecha = c(kind = "twoTextRight", ppt_layout = "right_2graficos_texto", structure_label = "Dos gráficos + texto"),
  p_slide_4_graficos = c(kind = "grid4", ppt_layout = "4_paneles", structure_label = "Matriz 2 × 2"),
  p_slide_2_graficos_poblacion = c(kind = "population2", ppt_layout = "poblacion_2", structure_label = "Dos gráficos + ícono"),
  p_slide_4_graficos_poblacion = c(kind = "population4", ppt_layout = "poblacion_4", structure_label = "Matriz 2 × 2 + ícono"),
  p_slide_5_graficos_poblacion = c(kind = "population5", ppt_layout = "poblacion_5", structure_label = "Matriz 3 + 2 + ícono"),
  p_slide_6_graficos_poblacion = c(kind = "population6", ppt_layout = "poblacion_6", structure_label = "Matriz 3 × 2 + ícono")
)

.gm_slot <- function(role, label) list(role = role, label = label)

.gm_slide_slot_specs <- list(
  p_slide_portada = list(),
  p_slide_indice = list(),
  p_slide_top_two_box = list(),
  p_slide_seccion = list(),
  p_slide_objetivo_icono = list(icono = .gm_slot("icon", "Ícono")),
  p_slide_texto = list(),
  p_slide_tabla_tecnica = list(),
  p_slide_1_grafico = list(grafico = .gm_slot("chart", "Gráfico principal")),
  p_slide_1_grafico_narrativo = list(grafico = .gm_slot("chart", "Gráfico principal")),
  p_slide_grafico_texto_derecha = list(grafico = .gm_slot("chart", "Gráfico principal")),
  p_slide_grafico_texto_izquierda = list(grafico = .gm_slot("chart", "Gráfico principal")),
  p_slide_2_graficos = list(
    izquierda = .gm_slot("chart", "Izquierda"),
    derecha = .gm_slot("chart", "Derecha")
  ),
  p_slide_2_graficos_narrativo = list(
    izquierda = .gm_slot("chart", "Izquierda"),
    derecha = .gm_slot("chart", "Derecha")
  ),
  p_slide_2_graficos_texto_izquierda = list(
    grafico_1 = .gm_slot("chart", "Gráfico superior"),
    grafico_2 = .gm_slot("chart", "Gráfico inferior")
  ),
  p_slide_2_graficos_texto_derecha = list(
    grafico_1 = .gm_slot("chart", "Gráfico superior"),
    grafico_2 = .gm_slot("chart", "Gráfico inferior")
  ),
  p_slide_4_graficos = list(
    superior_izquierda = .gm_slot("chart", "Superior izquierda"),
    superior_derecha = .gm_slot("chart", "Superior derecha"),
    inferior_izquierda = .gm_slot("chart", "Inferior izquierda"),
    inferior_derecha = .gm_slot("chart", "Inferior derecha")
  ),
  p_slide_2_graficos_poblacion = list(
    izquierda = .gm_slot("chart", "Izquierda"),
    derecha = .gm_slot("chart", "Derecha"),
    icono = .gm_slot("icon", "Ícono central")
  ),
  p_slide_4_graficos_poblacion = list(
    superior_izquierda = .gm_slot("chart", "Superior izquierda"),
    superior_derecha = .gm_slot("chart", "Superior derecha"),
    inferior_izquierda = .gm_slot("chart", "Inferior izquierda"),
    inferior_derecha = .gm_slot("chart", "Inferior derecha"),
    icono = .gm_slot("icon", "Ícono central")
  ),
  p_slide_5_graficos_poblacion = list(
    grafico_superior_1 = .gm_slot("chart", "Superior izquierda"),
    grafico_superior_2 = .gm_slot("chart", "Superior centro"),
    grafico_superior_3 = .gm_slot("chart", "Superior derecha"),
    grafico_inferior_1 = .gm_slot("chart", "Inferior izquierda"),
    grafico_inferior_2 = .gm_slot("chart", "Inferior centro"),
    icono = .gm_slot("icon", "Ícono central")
  ),
  p_slide_6_graficos_poblacion = list(
    grafico_superior_1 = .gm_slot("chart", "Superior izquierda"),
    grafico_superior_2 = .gm_slot("chart", "Superior centro"),
    grafico_superior_3 = .gm_slot("chart", "Superior derecha"),
    grafico_inferior_1 = .gm_slot("chart", "Inferior izquierda"),
    grafico_inferior_2 = .gm_slot("chart", "Inferior centro"),
    grafico_inferior_3 = .gm_slot("chart", "Inferior derecha"),
    icono = .gm_slot("icon", "Ícono central")
  )
)

.gm_graficadores <- list(
  p_barras_agrupadas = c(categoria = "distribution", blueprint = "bars-grouped"),
  p_barras_categoricas = c(categoria = "distribution", blueprint = "bars-categorical"),
  p_barras_apiladas = c(categoria = "distribution", blueprint = "bars-stacked"),
  p_barras_multiapiladas = c(categoria = "distribution", blueprint = "bars-multi-stacked"),
  p_nube_palabras = c(categoria = "text", blueprint = "word-cloud"),
  p_mapa_cobertura_territorial = c(categoria = "territory", blueprint = "territory-map"),
  p_pie = c(categoria = "distribution", blueprint = "pie"),
  p_donut = c(categoria = "distribution", blueprint = "donut"),
  p_numerico = c(categoria = "numeric", blueprint = "numeric"),
  p_histograma = c(categoria = "numeric", blueprint = "histogram"),
  p_boxplot = c(categoria = "numeric", blueprint = "boxplot"),
  p_media_rango = c(categoria = "numeric", blueprint = "mean-range"),
  p_barras_divergentes = c(categoria = "distribution", blueprint = "bars-diverging"),
  p_dumbbell = c(categoria = "comparison", blueprint = "dumbbell"),
  p_lollipop = c(categoria = "distribution", blueprint = "lollipop"),
  p_serie_temporal = c(categoria = "comparison", blueprint = "line-series"),
  p_radar = c(categoria = "comparison", blueprint = "radar"),
  p_tabla = c(categoria = "comparison", blueprint = "table"),
  p_dim_radar = c(categoria = "dimensions", blueprint = "dimension-radar"),
  p_dim_heatmap = c(categoria = "dimensions", blueprint = "dimension-heatmap"),
  p_dim_comparativo_radarbar = c(categoria = "dimensions", blueprint = "dimension-radar-bars"),
  p_dim_foda = c(categoria = "dimensions", blueprint = "dimension-foda"),
  p_dim_heatmap_criterios = c(categoria = "dimensions", blueprint = "dimension-criteria-heatmap")
)

.gm_slide_kinds <- c(
  "cover", "index", "section", "objective", "text", "technical", "topTwo",
  "single", "singleNarrative", "splitRight", "splitLeft", "two",
  "twoNarrative", "twoTextLeft", "twoTextRight", "grid4", "population2",
  "population4", "population5", "population6"
)

.gm_graf_categorias <- c(
  "distribution", "numeric", "comparison", "text", "dimensions", "territory", "other"
)

.gm_graf_blueprints <- c(
  "bars-grouped", "bars-categorical", "bars-stacked", "bars-multi-stacked",
  "pie", "donut", "numeric", "histogram", "boxplot", "mean-range", "radar",
  "table", "word-cloud", "territory-map", "dimension-radar", "dimension-heatmap",
  "dimension-radar-bars", "dimension-foda", "dimension-criteria-heatmap",
  "line-series", "bars-diverging", "dumbbell", "lollipop"
)

test_that("registry: cada slide y graficador expone el shape completo con nombres únicos y reales", {
  reg <- .graficos_registry_payload()
  expect_setequal(names(reg), c("slides", "graficadores"))
  expect_length(reg$slides, 20L)
  expect_length(reg$graficadores, 23L)

  slide_names <- vapply(reg$slides, function(s) s$name, character(1))
  graf_names <- vapply(reg$graficadores, function(g) g$name, character(1))
  expect_false(any(duplicated(slide_names)))
  expect_false(any(duplicated(graf_names)))

  for (s in reg$slides) {
    expect_true(all(c("name", "titulo_humano", "descripcion", "icono_ui",
                      "categoria", "blueprint", "slot_specs", "slots", "args",
                      "args_extra") %in% names(s)))
    expect_true(nzchar(s$titulo_humano))
    expect_true(s$categoria %in% .gm_categorias_validas)
    expect_type(s$slots, "list")
    # Todo nombre del catálogo respalda una función real del paquete.
    expect_true(exists(s$name, mode = "function"), label = s$name)
    # Los slots declarados deben ser argumentos reales de la función.
    fn <- get(s$name, mode = "function")
    expect_true(all(unlist(s$slots) %in% names(formals(fn))), label = s$name)
  }
  for (g in reg$graficadores) {
    expect_true(all(c("name", "titulo_humano", "descripcion", "icono_ui",
                      "categoria", "blueprint", "requisito", "feature_kind",
                      "available", "disabled_reason", "args", "args_extra") %in% names(g)))
    expect_true(exists(g$name, mode = "function"), label = g$name)
  }
})

test_that("registry L4: los 20 blueprints de slides siguen la tabla PPT acreditada", {
  reg <- .graficos_registry_payload()
  expect_identical(.slide_names(), names(.gm_slide_blueprints))

  wire_by_name <- stats::setNames(reg$slides, vapply(reg$slides, `[[`, character(1), "name"))
  for (name in names(.gm_slide_blueprints)) {
    expected <- .gm_slide_blueprints[[name]]
    meta <- .SLIDES_META[[name]]
    wire <- wire_by_name[[name]]

    expect_identical(unlist(meta$blueprint, use.names = TRUE), expected, label = name)
    expect_identical(names(wire$blueprint), c("kind", "ppt_layout", "structure_label"), label = name)
    expect_identical(unlist(wire$blueprint, use.names = TRUE), expected, label = name)
  }

  kinds <- vapply(reg$slides, function(slide) slide$blueprint$kind, character(1))
  expect_setequal(kinds, .gm_slide_kinds)
  expect_false(any(kinds %in% c("neutral", "future", "unknown")))
})

test_that("registry L4: slot_specs es la única autoría y el wire conserva nombres, roles y orden", {
  reg <- .graficos_registry_payload()
  expect_identical(.slide_names(), names(.gm_slide_slot_specs))
  wire_by_name <- stats::setNames(reg$slides, vapply(reg$slides, `[[`, character(1), "name"))
  roles <- character(0)

  for (name in names(.gm_slide_slot_specs)) {
    expected <- .gm_slide_slot_specs[[name]]
    meta <- .SLIDES_META[[name]]
    wire <- wire_by_name[[name]]
    expected_names <- names(expected)
    if (is.null(expected_names)) expected_names <- character(0)

    expect_identical(meta$slot_specs, expected, label = name)
    expect_identical(meta$slots, expected_names, label = name)
    expect_identical(.slide_slots(name), expected_names, label = name)
    expect_identical(anyDuplicated(meta$slots), 0L, label = name)
    expect_true(all(meta$slots %in% names(formals(get(name, mode = "function")))), label = name)

    expect_type(wire$slot_specs, "list")
    expect_null(names(wire$slot_specs), label = name)
    expect_null(names(wire$slots), label = name)
    expect_true(all(vapply(
      wire$slot_specs,
      function(spec) identical(names(spec), c("name", "role", "label")),
      logical(1)
    )), label = name)
    wire_names <- vapply(wire$slot_specs, `[[`, character(1), "name")
    wire_roles <- vapply(wire$slot_specs, `[[`, character(1), "role")
    wire_labels <- vapply(wire$slot_specs, `[[`, character(1), "label")
    expect_identical(wire_names, expected_names, label = name)
    expect_identical(as.character(unlist(wire$slots, use.names = FALSE)), wire_names, label = name)
    expect_identical(wire_roles, unname(vapply(expected, `[[`, character(1), "role")), label = name)
    expect_identical(wire_labels, unname(vapply(expected, `[[`, character(1), "label")), label = name)

    for (slot_name in expected_names) {
      expected_role <- if (identical(slot_name, "icono")) "icon" else "chart"
      expect_identical(meta$slot_specs[[slot_name]]$role, expected_role, label = paste(name, slot_name))
      expect_true(nzchar(meta$slot_specs[[slot_name]]$label), label = paste(name, slot_name))
    }
    roles <- c(roles, wire_roles)
  }

  expect_setequal(unique(roles), c("chart", "icon"))
})

test_that("registry L4: los 23 graficadores publican categoría y blueprint exactos", {
  reg <- .graficos_registry_payload()
  expect_identical(.graf_names(), names(.gm_graficadores))
  wire_by_name <- stats::setNames(
    reg$graficadores,
    vapply(reg$graficadores, `[[`, character(1), "name")
  )

  for (name in names(.gm_graficadores)) {
    expected <- .gm_graficadores[[name]]
    meta <- .GRAFICADORES_META[[name]]
    wire <- wire_by_name[[name]]
    expect_identical(c(categoria = meta$categoria, blueprint = meta$blueprint), expected, label = name)
    expect_identical(c(categoria = wire$categoria, blueprint = wire$blueprint), expected, label = name)
  }

  categorias <- vapply(reg$graficadores, `[[`, character(1), "categoria")
  blueprints <- vapply(reg$graficadores, `[[`, character(1), "blueprint")
  expect_true(all(categorias %in% .gm_graf_categorias))
  expect_setequal(unique(categorias), setdiff(.gm_graf_categorias, "other"))
  expect_setequal(blueprints, .gm_graf_blueprints)
  expect_false(any(blueprints %in% c("future", "neutral", "unknown")))
})

test_that("registry L4: los sentinels de graficadores no se fabrican en el backend", {
  payload_body <- paste(deparse(body(.graficos_registry_payload)), collapse = "\n")
  expect_false(grepl('%||% "other"', payload_body, fixed = TRUE))
  expect_false(grepl('%||% "future"', payload_body, fixed = TRUE))
})

test_that("registry L4: el copy V8 es neutral y no reintroduce las frases proscritas", {
  reg <- .graficos_registry_payload()
  radar <- Filter(function(graf) identical(graf$name, "p_radar"), reg$graficadores)[[1]]
  expect_identical(
    radar$descripcion,
    "Gráfico radar (telaraña) sin tabla al costado. Ocupa todo el espacio disponible. Adecuado cuando la tabla va en otro espacio o no se necesita."
  )

  indice <- Filter(function(slide) identical(slide$name, "p_slide_indice"), reg$slides)[[1]]
  indice_args <- stats::setNames(indice$args, vapply(indice$args, `[[`, character(1), "name"))
  expect_identical(
    indice_args$subindices$descripcion,
    "Opcional. Usa una línea por subtema con el formato 'Sección: subtema' para asociarlo a una sección específica."
  )
  expect_identical(
    indice_args$redibujar_focos$descripcion,
    "Úsalo solo si la plantilla no trae focos. Por defecto conserva los focos originales y limpia solo los íconos previos."
  )

  registry_text <- as.character(unlist(reg, recursive = TRUE, use.names = FALSE))
  expect_false(any(grepl("querés|necesitás|Opcional\\. Use una línea|Úselo solo", registry_text)))
})

test_that("registry: el gate territorial_coverage deshabilita con razón y habilita por capability", {
  reg_off <- .graficos_registry_payload()
  terr <- Filter(function(g) identical(g$requisito, "territorial_coverage"),
                 reg_off$graficadores)
  expect_gte(length(terr), 1L)
  for (g in terr) {
    expect_false(g$available)
    expect_true(nzchar(g$disabled_reason))
  }
  # Los graficadores de dimensiones no se gatean por esta capability.
  dims <- Filter(function(g) identical(g$requisito, "dimensiones"), reg_off$graficadores)
  expect_gte(length(dims), 1L)
  expect_true(all(vapply(dims, function(g) isTRUE(g$available), logical(1))))

  reg_on <- .graficos_registry_payload(
    capabilities = list(territorial_coverage = list(available = TRUE))
  )
  terr_on <- Filter(function(g) identical(g$requisito, "territorial_coverage"),
                    reg_on$graficadores)
  for (g in terr_on) {
    expect_true(g$available)
    expect_identical(g$disabled_reason, "")
  }
})

test_that("lookups: slide/graficador desconocido degrada sin romper", {
  expect_null(.slide_meta("p_slide_inexistente"))
  expect_null(.graf_meta("graficar_inexistente"))
  expect_identical(.slide_slots("p_slide_inexistente"), character(0))
  expect_identical(.slide_categoria("p_slide_inexistente"), "otro")
  expect_true("p_slide_portada" %in% .slide_names())
  expect_type(.slide_slots(.slide_names()[1]), "character")
})

test_that("normalize_args_for_ui: filtra args internos y remapea grupos legacy a intención", {
  args <- list(
    list(name = "titulo", tipo_input = "string", grupo = "textos"),
    list(name = "exportar", tipo_input = "choice", grupo = "avanzado"),
    list(name = "overrides", tipo_input = "overrides", grupo = "avanzado"),
    list(name = "filtros", tipo_input = "filtros", grupo = "avanzado"),
    list(name = "base_n", tipo_input = "base_config", grupo = "avanzado"),
    list(name = "meta", tipo_input = "meta", grupo = "avanzado"),
    list(name = "wrap_y", tipo_input = "number", grupo = "canvas"),
    list(name = "ancho_max_eje_y", tipo_input = "number", grupo = "canvas"),
    list(name = "misterioso", tipo_input = "number", grupo = "avanzado")
  )
  out <- .normalize_args_for_ui(args)
  nombres <- vapply(out, function(a) a$name, character(1))

  # exportar + superficies dedicadas + wrap_y (duplicado del canónico) fuera.
  expect_false(any(c("exportar", "overrides", "filtros", "base_n", "meta",
                     "wrap_y") %in% nombres))
  expect_setequal(nombres, c("titulo", "ancho_max_eje_y", "misterioso"))

  grupos <- stats::setNames(vapply(out, function(a) a$grupo, character(1)), nombres)
  expect_identical(unname(grupos["titulo"]), "lectura")
  expect_identical(unname(grupos["ancho_max_eje_y"]), "espacio")
  expect_identical(unname(grupos["misterioso"]), "diagnostico")

  expect_identical(.normalize_args_for_ui(NULL), list())
  expect_identical(.normalize_args_for_ui(list()), list())
})

test_that("graf_arg_ui_group: enrutamiento por nombre gana al grupo declarado", {
  expect_identical(.graf_arg_ui_group("debug_ph_bordes", "estilo"), "diagnostico")
  expect_identical(.graf_arg_ui_group("canvas_h_title", "textos"), "espacio")
  expect_identical(.graf_arg_ui_group("tabla_digits", "estilo"), "tabla")
  expect_identical(.graf_arg_ui_group("leyenda_pos", "estilo"), "leyenda")
  expect_identical(.graf_arg_ui_group("mostrar_valores", "estilo"), "valores")
  expect_identical(.graf_arg_ui_group("titulo", NULL), "lectura")
  # Sin match por nombre: remapeo del grupo legacy.
  expect_identical(.graf_arg_ui_group("algo_raro", "semaforo"), "valores")
  expect_identical(.graf_arg_ui_group("algo_raro", "canvas"), "espacio")
  expect_identical(.graf_arg_ui_group("algo_raro", ""), "diagnostico")
})

test_that("graf_arg_numeric_defaults: rangos defensivos coherentes por familia de arg", {
  dec <- .graf_arg_numeric_defaults("decimales")
  expect_identical(dec, list(min = 0, max = 4, step = 1, control = "stepper"))

  donut <- .graf_arg_numeric_defaults("donut_hole")
  expect_identical(donut$control, "slider")
  expect_lte(donut$max, 1)

  angle <- .graf_arg_numeric_defaults("angle_x")
  expect_identical(c(angle$min, angle$max), c(-90, 90))

  # Fallback: siempre hay step y control.
  fb <- .graf_arg_numeric_defaults("arg_desconocido")
  expect_true(all(c("step", "control") %in% names(fb)))
})

test_that("templates: cada plan de arranque es consistente (n_slides == slides reales)", {
  tp <- .templates_payload()
  expect_gte(length(tp$templates), 3L)
  nombres <- vapply(tp$templates, function(t) t$name, character(1))
  expect_true("plan_vacio" %in% nombres)

  for (t in tp$templates) {
    expect_true(nzchar(t$titulo_humano))
    slides <- t$plan$slides
    expect_gte(length(slides), 1L)
    expect_identical(t$n_slides, length(slides), label = t$name)
    tipos <- vapply(slides, function(sl) sl$tipo, character(1))
    # Todo slide referenciado por un template existe en el catálogo.
    expect_true(all(tipos %in% .slide_names()), label = t$name)
  }
})

test_that("style profiles: cada perfil PPT trae template_id y estructura serializable", {
  sp <- .ppt_style_profiles_payload()
  expect_identical(names(sp), "style_profiles")
  expect_gte(length(sp$style_profiles), 1L)
  for (p in sp$style_profiles) {
    expect_true(all(c("name", "titulo_humano", "presets", "paletas",
                      "template_id", "auto_otros_slides") %in% names(p)))
    expect_true(nzchar(p$template_id))
    expect_type(p$auto_otros_slides, "logical")
  }
})
