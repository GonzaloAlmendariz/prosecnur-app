source("setup-load-all.R")

# Contrato catálogo ↔ motor para los args de tipo `choice`.
#
# Nace de A8: «Escala de valores» del radar ofrecía `porcentaje_100` y el motor
# solo aceptaba `proporcion_1`/`proporcion_100` vía `match.arg`; elegirlo en la
# UI reventaba. Al barrer el resto del catálogo aparecieron dos más del mismo
# tipo: «Arriba» en la leyenda del radar y «Ocultar» en la del pie.
#
# Regla: si un arg con `choices` llega a una función (constructor `p_*` o
# renderer `graficar_*`) que lo valida con `match.arg(<arg>)`, cada `value`
# ofrecido debe estar en el vector de su formal. Las funciones que normalizan
# con helper propio (p. ej. `.dim_normalize_semaforo_modo`) no usan `match.arg`
# y quedan fuera A PROPÓSITO: no hay un vector cerrado contra el cual medir.
#
# Cubre graficadores del registro y presets (los presets se resuelven por
# `.GRAFICADOR_PRESET_KEYS`: preset `radar_tabla` -> p_radar -> graficar_radar).

.ccm_valida_con_match_arg <- function(fn, nm) {
  any(grepl(sprintf("match.arg(%s)", nm), deparse(body(fn)), fixed = TRUE))
}

.ccm_valores <- function(a) {
  vapply(a$choices, function(ch) as.character(if (is.list(ch)) ch$value else ch)[1], character(1))
}

.ccm_funciones <- function(nombres_p) {
  nombres <- unique(c(nombres_p, sub("^p_", "graficar_", nombres_p)))
  fns <- lapply(nombres, function(n) get0(n, mode = "function"))
  names(fns) <- nombres
  Filter(Negate(is.null), fns)
}

.ccm_revisar <- function(etiqueta, args, fns) {
  medidos <- 0L
  fallas <- character(0)
  for (a in args %||% list()) {
    if (is.null(a$choices) || !length(a$choices)) next
    vals <- .ccm_valores(a)
    for (fn_nm in names(fns)) {
      fn <- fns[[fn_nm]]
      if (!.ccm_valida_con_match_arg(fn, a$name)) next
      aceptados <- eval(formals(fn)[[a$name]], baseenv())
      medidos <- medidos + 1L
      malos <- setdiff(vals, aceptados)
      if (length(malos)) {
        fallas <- c(fallas, sprintf("%s · %s ofrece %s y %s solo acepta %s",
                                    etiqueta, a$name, paste(malos, collapse = ", "),
                                    fn_nm, paste(aceptados, collapse = ", ")))
      }
    }
  }
  list(medidos = medidos, fallas = fallas)
}

test_that("todo value de un choice del registro está en el match.arg de su motor", {
  medidos <- 0L
  fallas <- character(0)
  for (g in .graficos_registry_payload()$graficadores) {
    r <- .ccm_revisar(g$name, g$args, .ccm_funciones(g$name))
    medidos <- medidos + r$medidos
    fallas <- c(fallas, r$fallas)
  }
  expect_identical(fallas, character(0))
  # Si el detector dejara de encontrar match.arg, el test pasaría sin medir.
  expect_gt(medidos, 10L)
})

test_that("todo value de un choice de los presets está en el match.arg de su motor", {
  claves <- .GRAFICADOR_PRESET_KEYS
  medidos <- 0L
  fallas <- character(0)
  for (p in .presets_metadata_payload()$presets) {
    gs <- names(claves)[claves == p$name]
    if (!length(gs)) next
    r <- .ccm_revisar(paste0("preset ", p$name), p$args, .ccm_funciones(gs))
    medidos <- medidos + r$medidos
    fallas <- c(fallas, r$fallas)
  }
  expect_identical(fallas, character(0))
  expect_gt(medidos, 10L)
})

test_that("el radar está dentro del barrido: su escala se mide contra graficar_radar", {
  p <- Filter(function(x) identical(x$name, "radar_tabla"), .presets_metadata_payload()$presets)[[1]]
  a <- Filter(function(x) identical(x$name, "escala_valor"), p$args)
  r <- .ccm_revisar("preset radar_tabla", a, .ccm_funciones(c("p_radar", "p_tabla")))
  expect_gte(r$medidos, 1L)
  expect_identical(r$fallas, character(0))
})

test_that("un pie viejo guardado con leyenda «ninguna» se dibuja sin leyenda en vez de fallar", {
  df <- data.frame(cat = c("Sí", "No"), pct = c(0.6, 0.4), n = c(3, 2))
  expect_error(graficar_pie(df, var_categoria = "cat", var_pct = "pct", var_n = "n", leyenda_posicion = "inventada"))
  g <- expect_no_error(graficar_pie(df, var_categoria = "cat", var_pct = "pct", var_n = "n", leyenda_posicion = "ninguna"))
  expect_false(is.null(g))
})

test_that("el catálogo del radar no ofrece la leyenda «arriba»: sólo lo que graficar_radar dibuja (decisión «12»)", {
  p <- Filter(function(x) identical(x$name, "radar_tabla"), .presets_metadata_payload()$presets)[[1]]
  a <- Filter(function(x) identical(x$name, "leyenda_posicion"), p$args)
  expect_length(a, 1L)
  vals <- .ccm_valores(a[[1]])
  expect_false("arriba" %in% vals)
  expect_setequal(vals, eval(formals(graficar_radar)$leyenda_posicion))
  # Ningún graficador del radar en el registro la vuelve a ofrecer.
  for (g in Filter(function(x) grepl("radar", x$name), .graficos_registry_payload()$graficadores)) {
    for (arg in Filter(function(x) identical(x$name, "leyenda_posicion") && length(x$choices), g$args)) {
      expect_false("arriba" %in% .ccm_valores(arg), info = g$name)
    }
  }
})
