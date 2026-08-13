source("setup-load-all.R")

# El reparto de ancho de las láminas multiactor vivía escrito a mano dentro del
# motor y se mezclaba POR ENCIMA de los presets: los cuatro anchos existían en el
# inspector y no hacían nada. Medido antes del arreglo: `canvas_w_grupo = 0.40`
# en el preset no cambiaba un píxel del PPT.

test_that("el reparto de fábrica cierra en 1 y respeta el contrato de barras", {
  for (extra in c(FALSE, TRUE)) {
    r <- .multiactor_canvas_resolver(list(), show_extra = extra)
    expect_equal(sum(unlist(r)), 1, tolerance = 1e-9)
    expect_gte(r$canvas_w_bars, .MULTIACTOR_W_BARS_MIN)
  }
  # Sin barra extra, su canal no ocupa: sería hueco muerto contra el borde.
  sin <- .multiactor_canvas_resolver(list(), show_extra = FALSE)
  expect_equal(sin$canvas_w_extra, 0)
  expect_equal(sin$canvas_w_buf_bars_extra, 0)
})

test_that("lo que el analista declara manda, y las barras absorben la diferencia", {
  r <- .multiactor_canvas_resolver(list(canvas_w_grupo = 0.28, canvas_w_etiquetas = 0.08))
  expect_equal(r$canvas_w_grupo, 0.28)
  expect_equal(r$canvas_w_etiquetas, 0.08)
  # El control: si el resolutor ignorara la declaración, esto daría el de
  # fábrica. Es exactamente lo que hacía el motor antes.
  base <- .multiactor_canvas_resolver(list())
  expect_false(isTRUE(all.equal(r$canvas_w_grupo, base$canvas_w_grupo)))
  # Y la suma sigue cerrando: las barras son el resto, no un valor aparte.
  expect_equal(sum(unlist(r)), 1, tolerance = 1e-9)
})

test_that("un reparto que asfixia las barras se rechaza y avisa", {
  # Sin este piso, un tema muy ancho deja una cinta de barras ilegible y el
  # motor la dibujaría igual.
  expect_message(
    r <- .multiactor_canvas_resolver(list(canvas_w_grupo = 0.60, canvas_w_etiquetas = 0.20)),
    "PULSO-AVISO"
  )
  expect_equal(r$canvas_w_grupo, .MULTIACTOR_CANVAS_BASE$canvas_w_grupo)
})

test_that("el wrap del tema sigue al ancho declarado", {
  # Ensanchar la columna sin mover el wrap no cambia nada: medido, con la
  # columna a 0.22 y el wrap intacto el enunciado no perdió ni una línea.
  angosto <- .multiactor_wrap_tema(0.13, 40)
  ancho   <- .multiactor_wrap_tema(0.30, 40)
  expect_gt(ancho, angosto)
  # Y el control de que no se dispara: escalar proporcionalmente desde el origen
  # daba 0.55 con la columna en 0.20 y el texto se salía por la izquierda.
  expect_lt(.multiactor_wrap_tema(0.20, 40), floor(40 * 0.36 * (0.20 / 0.13)))
})

test_that("el preset viaja: `p_presets()` lo acepta y no lo descarta", {
  # Era la trampa de las whitelists: el arg declarado en el registro llegaba a
  # `p_presets()`, caía en `...` y se descartaba con un warning. El render salía
  # idéntico y nada lo decía.
  expect_true("multi_apiladas_multiactor" %in% names(formals(p_presets)))
  p <- expect_silent(p_presets(multi_apiladas_multiactor = list(canvas_w_grupo = 0.25)))
  expect_equal(p$multi_apiladas_multiactor$args$canvas_w_grupo, 0.25)
})

test_that("el registro lo ofrece con sus cuatro anchos", {
  meta <- .PRESETS_META$multi_apiladas_multiactor
  expect_false(is.null(meta))
  nombres <- vapply(meta$args, function(a) as.character(a$name), character(1))
  expect_true(all(c("canvas_w_grupo", "canvas_w_etiquetas", "canvas_w_extra") %in% nombres))
  # Las barras NO se declaran: son el resto, y ofrecerlas invitaría a un reparto
  # que no cierra.
  expect_false("canvas_w_bars" %in% nombres)
})
