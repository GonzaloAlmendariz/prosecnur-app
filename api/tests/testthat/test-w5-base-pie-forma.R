# CCSS-15 (mazo CCSS Perfil 2026, todo el mazo): el pie alternaba «Base: 397» (barras, cruces: `.base_auto_from_var`) y
# «Base: 397 respuestas» (columnas, dona, dicotomía: la nota del gráfico que arma `.format_n_caption`). DECIDIDO (lead,
# 2026-10-24, y ccss-mazo de acuerdo): sin sufijo declarado en el preset de base, todas las rutas dicen «Base: N»; con
# sufijo, «Base: N <sufijo>» en todas. El sufijo NO se rellena con el default de Pulso (`.enriquecer_presets`).

test_that("CCSS-15: sin sufijo declarado el núcleo del pie es sólo el número", {
  expect_identical(.base_pie_nucleo(397), "397")
  expect_identical(.base_pie_nucleo(c(397, 397)), "397")
  expect_identical(.base_pie_nucleo(1234), "1,234")
  expect_identical(.base_pie_nucleo(c(380, 397)), "380-397")
  expect_null(.base_pie_nucleo(numeric(0)))
  expect_null(.base_pie_nucleo(c(NA, 0)))
})

test_that("CCSS-15: con sufijo declarado el núcleo lo lleva, como `.base_auto_from_var`", {
  expect_identical(.base_pie_nucleo(397, "estudiantes"), "397 estudiantes")
  expect_identical(.base_pie_nucleo(397, "  "), "397")
  expect_identical(.base_pie_nucleo(c(380, 397), "casos"), "380-397 casos")
  # Mismo núcleo que la ruta de las barras con el mismo sufijo: una sola forma del pie.
  expect_identical(sprintf("Base: %s", .base_pie_nucleo(397, "estudiantes")),
                   .reporte_plan_base_componer_nota(397, "estudiantes", "Base: %s"))
  expect_identical(sprintf("Base: %s", .base_pie_nucleo(397)), .reporte_plan_base_componer_nota(397, NULL, "Base: %s"))
})

test_that("CCSS-15: la nota de las rutas nativas ya no agrega «respuestas» por su cuenta", {
  src <- readLines(test_path("..", "..", "R", "reporte_plan_ppt.R"), warn = FALSE, encoding = "UTF-8")
  i <- grep(".format_n_caption <- function(", src, fixed = TRUE)
  expect_length(i, 1L)
  fin <- i + which(src[(i + 1):length(src)] == "  }")[1]
  def <- paste(src[i:fin], collapse = "\n")
  expect_false(grepl("\"respuestas\"", def, fixed = TRUE))
  expect_true(grepl(".base_pie_nucleo(", def, fixed = TRUE))
})

test_that("CCSS-15: el público de una base con nombre sigue reemplazando al pie sin sufijo", {
  # lamina_compositor.R: «estudiantes$p19» → «Base: 242 estudiantes». Con el pie ya sin «respuestas» la regla sigue viva.
  expect_identical(.lam_base_con_publico("Base: 242", "estudiantes"), "Base: 242 estudiantes")
  expect_identical(.lam_base_con_publico("Base: 242 respuestas", "estudiantes"), "Base: 242 estudiantes")
  expect_identical(.lam_base_con_publico("Base: 242 docentes", "estudiantes"), "Base: 242 docentes")
  expect_identical(.lam_base_con_publico("Base: 1,242", "estudiantes"), "Base: 1,242 estudiantes")
})

test_that("CCSS-15: el «respuestas» de fábrica que repone `.build_presets` no cuenta como sufijo declarado", {
  # En el worker el preset de base trae el default de Pulso aunque el proyecto no lo haya tocado (ADR 0074): por eso el
  # mazo de CCSS decía «Base: 397 respuestas» en las rutas que leían el preset y «Base: 397» en las de varias bases.
  expect_identical(.PRESETS_DEFAULT_PULSO$base$sufijo_auto, "respuestas")
  expect_null(.base_pie_sufijo_declarado("respuestas"))
  expect_null(.base_pie_sufijo_declarado(NULL))
  expect_null(.base_pie_sufijo_declarado(" "))
  expect_identical(.base_pie_sufijo_declarado("estudiantes"), "estudiantes")
  p <- .build_presets(list(base = list(size_titulo = 16)))
  expect_null(.base_pie_sufijo_declarado(p$base$args$sufijo_auto %||% p$base$sufijo_auto))
})

test_that("CCSS-15: en un informe de varias bases, la base sin nombre lleva el sufijo declarado como las demás rutas", {
  expect_identical(.base_pie_parte_default("397", NULL), "397")
  expect_identical(.base_pie_parte_default("397", "respuestas"), "397")
  expect_identical(.base_pie_parte_default("397", "estudiantes"), "397 estudiantes")
})
