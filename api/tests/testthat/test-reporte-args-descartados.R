source("setup-load-all.R")

# `.keep_formals()` descartaba argumentos SIN NINGUNA SEÑAL: ni warning, ni log,
# ni error. Un control de la UI que el motor no implementa se movia y no pasaba
# nada. Ahora el descarte queda anotado y consultable.

test_that("un argumento inexistente queda anotado en vez de perderse", {
  reporte_args_descartados_reset()

  f <- function(a, b) NULL
  out <- .keep_formals(f, list(a = 1, b = 2, inventado = 3), contexto = "graficar_x")

  expect_named(out, c("a", "b"))

  rep <- reporte_args_descartados_reporte()
  expect_equal(nrow(rep), 1L)
  expect_identical(rep$contexto, "graficar_x")
  expect_identical(rep$argumento, "inventado")
})

test_that("sin descartes el reporte viene vacio, no con basura", {
  reporte_args_descartados_reset()

  f <- function(a, b) NULL
  .keep_formals(f, list(a = 1, b = 2), contexto = "graficar_x")

  rep <- reporte_args_descartados_reporte()
  expect_equal(nrow(rep), 0L)
  expect_named(rep, c("contexto", "argumento"))
})

test_that("una funcion con ... no descarta nada", {
  reporte_args_descartados_reset()

  f <- function(a, ...) NULL
  out <- .keep_formals(f, list(a = 1, cualquier_cosa = 2), contexto = "graficar_dots")

  expect_named(out, c("a", "cualquier_cosa"))
  expect_equal(nrow(reporte_args_descartados_reporte()), 0L)
})

test_that("el mismo descarte en cuarenta laminas es una sola linea", {
  # Es la razon de acumular en vez de avisar en cada llamada: un mazo grande
  # emitiria cientos de lineas identicas y nadie las leeria.
  reporte_args_descartados_reset()

  f <- function(a) NULL
  for (i in seq_len(40)) {
    .keep_formals(f, list(a = 1, textos_negrita = "titulo"), contexto = "graficar_boxplot")
  }

  rep <- reporte_args_descartados_reporte()
  expect_equal(nrow(rep), 1L)
  expect_identical(rep$argumento, "textos_negrita")
})

test_that("el contexto separa lo legitimo en un graficador de lo inerte en otro", {
  # `textos_negrita` existe en apiladas y no en boxplot: sin contexto, el
  # reporte no distinguiria un caso del otro.
  reporte_args_descartados_reset()

  f <- function(a) NULL
  .keep_formals(f, list(a = 1, textos_negrita = "x"), contexto = "graficar_boxplot")
  .keep_formals(f, list(a = 1, decimales_promedio = 2), contexto = "graficar_media_rango")

  rep <- reporte_args_descartados_reporte()
  expect_equal(nrow(rep), 2L)
  expect_identical(rep$contexto, c("graficar_boxplot", "graficar_media_rango"))
  expect_identical(rep$argumento, c("textos_negrita", "decimales_promedio"))
})

test_that("el reset limpia de verdad entre corridas", {
  reporte_args_descartados_reset()
  f <- function(a) NULL
  .keep_formals(f, list(a = 1, z = 2), contexto = "c1")
  expect_equal(nrow(reporte_args_descartados_reporte()), 1L)

  reporte_args_descartados_reset()
  expect_equal(nrow(reporte_args_descartados_reporte()), 0L)
})

test_that("el aviso emite una linea por contexto y no revienta si esta vacio", {
  reporte_args_descartados_reset()
  expect_silent(reporte_args_descartados_avisar())

  f <- function(a) NULL
  .keep_formals(f, list(a = 1, z = 2), contexto = "graficar_pie")
  expect_message(reporte_args_descartados_avisar(), "graficar_pie")
  expect_message(reporte_args_descartados_avisar(), "z")
})

test_that("identifica al graficador real, no a como se llame la variable", {
  # Los call sites del motor hacen `fun <- graficar_X`, asi que el deparse solo
  # ve "fun". Si el registro dependiera de ese nombre, un mazo entero se
  # anotaria bajo un unico contexto inutil.
  reporte_args_descartados_reset()

  fun <- graficar_boxplot
  invisible(.keep_formals(fun, list(data = 1, textos_negrita = "titulo")))
  fun2 <- graficar_pie
  invisible(.keep_formals(fun2, list(data = 1, debug_lw = 0.5)))

  rep <- reporte_args_descartados_reporte()
  expect_true("graficar_boxplot" %in% rep$contexto)
  expect_true("graficar_pie" %in% rep$contexto)
  expect_false(any(rep$contexto %in% c("fun", "fun2")))
})

test_that("el registro delata los args muertos que la auditoria encontro a mano", {
  # `textos_negrita` se ofrece en la UI de boxplot, media_rango y los tres
  # `dim_*` y no llega al motor en ninguno. Antes habia que descubrirlo
  # comparando formals contra el registry; ahora lo dice el propio render.
  reporte_args_descartados_reset()

  for (f in list(graficar_boxplot, graficar_media_rango, graficar_heatmap_dimensiones)) {
    fun <- f
    invisible(.keep_formals(fun, list(textos_negrita = "titulo")))
  }

  rep <- reporte_args_descartados_reporte()
  muertos <- rep$contexto[rep$argumento == "textos_negrita"]
  expect_true(all(c("graficar_boxplot", "graficar_media_rango",
                    "graficar_heatmap_dimensiones") %in% muertos))
})

test_that("sin contexto explicito el registro no se queda mudo", {
  # Los ~17 sitios que ya llamaban `.keep_formals` no pasan contexto. El
  # registro tiene que servir igual para ellos.
  reporte_args_descartados_reset()

  f <- function(a) NULL
  .keep_formals(f, list(a = 1, sobra = 2))

  rep <- reporte_args_descartados_reporte()
  expect_equal(nrow(rep), 1L)
  expect_true(nzchar(rep$contexto[[1]]))
  expect_identical(rep$argumento, "sobra")
})
