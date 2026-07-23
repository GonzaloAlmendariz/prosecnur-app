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

test_that("registry: cada slide y graficador expone el shape completo con nombres únicos y reales", {
  reg <- .graficos_registry_payload()
  expect_setequal(names(reg), c("slides", "graficadores"))
  expect_gte(length(reg$slides), 15L)
  expect_gte(length(reg$graficadores), 15L)

  slide_names <- vapply(reg$slides, function(s) s$name, character(1))
  graf_names <- vapply(reg$graficadores, function(g) g$name, character(1))
  expect_false(any(duplicated(slide_names)))
  expect_false(any(duplicated(graf_names)))

  for (s in reg$slides) {
    expect_true(all(c("name", "titulo_humano", "descripcion", "icono_ui",
                      "categoria", "slots", "args", "args_extra") %in% names(s)))
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
    expect_true(all(c("name", "titulo_humano", "requisito", "feature_kind",
                      "available", "disabled_reason", "args", "args_extra") %in% names(g)))
    expect_true(exists(g$name, mode = "function"), label = g$name)
  }
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
