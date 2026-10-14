# Todo control que el editor ofrece llega al motor (checklist de configuraciones, 2026-10-13).
#
# El editor guarda cada arg del registro en el slot. Los args del preset y los `via_overrides` viajan en `overrides`; el
# resto se pasa como argumento del constructor `p_*`, y `.clean_rebuild_args()` (router_graficos.R) descarta en silencio
# lo que no es formal. Así «Marcar diferencias significativas» en agrupadas y apiladas se veía en el editor y no
# cambiaba el PowerPoint. `test-graficos-args-llegan-al-motor.R` mira el tramo preset → graficador; éste, el tramo
# editor → constructor.

# Medidos el 2026-10-13 y todavía sin arreglar. Cada uno dice por qué; la lista sólo puede achicarse.
PENDIENTES <- list(
  # «Base del gráfico» (`base_config`) no se sirve a la UI (`.normalize_args_for_ui`): el pie de base es automático en todos
  # los tipos, así que aquí no hay control que mienta. Se deja listada para que no se cuele un formal que no hace nada.
  p_numerico = "base",
  p_dim_foda = c("iter_var", "iter_level") # FODA retirada del selector (GRAFICOS_RETIRADOS); sólo planes viejos
)

test_that("todo control del editor es formal del constructor, viaja por overrides o es arg del preset", {
  ns <- asNamespace("prosecnurapp")
  meta <- .GRAFICADORES_META
  revisados <- 0L
  for (p in names(meta)) {
    f <- get0(p, envir = ns)
    if (is.null(f)) next
    fml <- names(formals(f))
    preset <- if (p %in% names(.GRAFICADOR_PRESET_KEYS)) .GRAFICADOR_PRESET_KEYS[[p]] else ""
    pargs <- if (nzchar(preset) && !is.null(.PRESETS_META[[preset]])) {
      vapply(.PRESETS_META[[preset]]$args, function(a) a$name, character(1))
    } else character(0)
    muertos <- character(0)
    for (a in meta[[p]]$args) {
      if (isTRUE(a$via_overrides) || identical(a$tipo_input, "overrides")) next
      if (a$name %in% c(fml, pargs, PENDIENTES[[p]])) next
      muertos <- c(muertos, a$name)
    }
    expect_equal(muertos, character(0), info = sprintf("%s: el editor ofrece %s y el constructor lo descarta", p, paste(muertos, collapse = ", ")))
    revisados <- revisados + 1L
  }
  expect_gt(revisados, 20L)
})

test_that("la significancia y el ancho de etiquetas llegan a overrides desde el editor", {
  for (p in c("p_barras_agrupadas", "p_barras_apiladas")) {
    args <- .clean_rebuild_args(list(var = "p1", mostrar_significancia = TRUE, significancia_alpha = 0.1), get(p, asNamespace("prosecnurapp")))
    el <- do.call(get(p, asNamespace("prosecnurapp")), args)
    expect_true(isTRUE(el$overrides$mostrar_significancia), info = p)
    expect_equal(el$overrides$significancia_alpha, 0.1, info = p)
  }
  args <- .clean_rebuild_args(list(var = "p1", forzar_ancho_max_eje_y = TRUE), p_barras_agrupadas)
  expect_true(isTRUE(do.call(p_barras_agrupadas, args)$overrides$forzar_ancho_max_eje_y))
  # Inventario de configuraciones, ítem 3: «Marcas del eje» del ranking en barras (recetario p74–p75).
  args <- .clean_rebuild_args(list(var = "p1", marcas_eje = TRUE), p_barras_agrupadas)
  expect_true(isTRUE(do.call(p_barras_agrupadas, args)$overrides$marcas_eje))
})

test_that("las pendientes siguen descartándose: si alguien las arregla, que las saque de la lista", {
  ns <- asNamespace("prosecnurapp")
  for (p in names(PENDIENTES)) {
    fml <- names(formals(get(p, envir = ns)))
    expect_false(any(PENDIENTES[[p]] %in% fml), info = p)
  }
})

# M5: los filtros del mapa de calor por criterio llegaban al slot y el constructor los perdía; el render ya los aplica.
test_that("los filtros del mapa de calor por criterio llegan al elemento", {
  cfg <- list(list(id = "a", titulo = "A", vars = c("p1", "p2")))
  args <- .clean_rebuild_args(list(config_criterios = cfg, filtros = list(sexo = "1")), p_dim_heatmap_criterios)
  el <- do.call(p_dim_heatmap_criterios, args)
  expect_identical(names(el$filtros), "sexo")
})

# Inventario de configuraciones, ítem 9 (recetario p70): qué respuesta va al centro de la dona y con qué frase.
test_that("la respuesta y la frase del centro de la dona llegan a la espec de la lámina", {
  args <- .clean_rebuild_args(list(var = "p1", al_centro = "No", frase_centro = "no conoce la misión"), p_donut)
  el <- do.call(p_donut, args)
  expect_identical(el$overrides$al_centro, "No")
  expect_identical(el$overrides$frase_centro, "no conoce la misión")
  espec <- list(rotulos = c("Sí", "No"), valores = c(77, 23), cifras = c("77%", "23%"), unidades = c(77, 23), n = c(133, 39), n_casos = c(133, 39))
  e <- .pie_espec_centro(espec, "No", "no conoce la misión")
  expect_identical(e$rotulos, c("No", "Sí"))
  expect_identical(e$cifras, c("23%", "77%"))
  expect_identical(e$n, c(39, 133))
  expect_identical(e$frase_centro, "no conoce la misión")
  expect_identical(.pie_espec_centro(espec, NULL, NULL), espec)
  expect_identical(.pie_espec_centro(espec, "Otra", "")$rotulos, c("Sí", "No"))
})
