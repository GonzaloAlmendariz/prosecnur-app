source("setup-load-all.R")

# Un umbral sin unidad declarada no tiene escala: el editor (`escalaVisualDeArg`, frontend/src/features/graficos/
# argEscalaVisual.ts) decide por la unidad si pinta el valor tal cual o ×100. `barra_extra_umbral_alto/medio` (80/70, en
# puntos) llegaban sin unidad y se pintaban «8000 %»; peor, escribir 80 guardaba 0.8. Y el parche genérico de `umbral_*`
# declaraba «%» con un rango 0–1, la contradicción inversa: tras el arreglo del front, 0.01 se pintaba «0,01 %».
# Contrato: todo umbral del catálogo servido a la UI declara unidad, y es coherente con su rango.

.cu_args_servidos <- function() {
  presets <- .presets_metadata_payload()$presets
  reg <- .graficos_registry_payload()
  fuentes <- c(
    lapply(presets, function(p) list(origen = paste0("preset:", p$name), args = p$args)),
    lapply(reg$graficadores, function(g) list(origen = paste0("graficador:", g$name), args = g$args)),
    lapply(reg$slides, function(s) list(origen = paste0("slide:", s$name), args = s$args))
  )
  out <- list()
  for (f in fuentes) for (a in f$args) {
    nm <- as.character(a$name %||% "")
    if (!identical(as.character(a$tipo_input %||% ""), "number")) next
    if (!grepl("umbral|tolerancia", nm)) next
    out[[length(out) + 1L]] <- c(a, list(origen = f$origen))
  }
  out
}

.cu_rango <- function(a) {
  v <- suppressWarnings(as.numeric(unlist(list(a$default, a$min, a$max))))
  v[is.finite(v)]
}

test_that("los umbrales del catálogo declaran una unidad coherente con su rango", {
  args <- .cu_args_servidos()
  expect_gt(length(args), 10L)
  problemas <- character(0)
  for (a in args) {
    id <- paste0(a$origen, "$", a$name)
    u <- trimws(as.character(a$unidad %||% ""))
    v <- .cu_rango(a)
    if (!nzchar(u)) { problemas <- c(problemas, paste(id, "sin unidad")); next }
    if (!u %in% c("proporción", "%", "pp")) { problemas <- c(problemas, paste(id, "unidad desconocida:", u)); next }
    if (identical(u, "proporción") && length(v) && (min(v) < 0 || max(v) > 1)) {
      problemas <- c(problemas, paste(id, "proporción fuera de 0–1:", paste(v, collapse = "/")))
    }
    if (u %in% c("%", "pp") && length(v) && (max(v) <= 1 || max(v) > 100 || min(v) < 0)) {
      problemas <- c(problemas, paste(id, u, "con rango de proporción o fuera de 0–100:", paste(v, collapse = "/")))
    }
  }
  expect_identical(problemas, character(0))
})

test_that("el umbral del Top 2 Box viaja en puntos y se declara en %", {
  args <- .cu_args_servidos()
  for (nm in c("barra_extra_umbral_alto", "barra_extra_umbral_medio")) {
    de_este <- Filter(function(a) identical(a$name, nm), args)
    expect_gt(length(de_este), 1L)   # barras_apiladas y multi_apiladas, al menos
    for (a in de_este) {
      expect_identical(a$unidad, "%", info = paste(a$origen, nm))
      expect_gt(a$default, 1, label = paste(a$origen, nm))
    }
  }
})

test_that("un umbral_* en proporción conserva su unidad tras el parche de la UI", {
  a <- .graf_arg_ui_patch(list(name = "umbral_ocultar_etiqueta", tipo_input = "number", default = 0.1, unidad = "proporción"))
  expect_identical(a$unidad, "proporción")
  b <- .graf_arg_ui_patch(list(name = "umbral_etiqueta", tipo_input = "number", default = 0.04))
  expect_identical(b$unidad, "proporción")
  expect_lte(b$max, 1)
})
