# Vara V4, aplicada a lo que este GOAL agregó.
#
# En `ee4b308d` las degradaciones del motor de PPT pasaron a avisar por
# `.pulso_aviso()`, que el job cosecha del stderr y el router expone como
# `avisos`. Pero sólo dos de los tres exports lo exponían: `graficos.ppt` y
# `graficos.word` sí, y `graficos.ppt_all` —el mazo de TODAS las bases— no.
#
# Era el peor sitio para callarse: en un mazo de sesenta y siete láminas por
# varias bases, una lámina en blanco es justo lo que no se nota.
#
# El test mira el cableado y no el render porque el fallo era de cableado: el
# aviso existía, se emitía y se perdía en el último tramo.

.router_graficos <- function() {
  paste(readLines("../../R/router_graficos.R", warn = FALSE), collapse = "\n")
}

# Trocea el archivo por llamada a `job_submit(`, que es el alcance real de un
# job: buscar "avisos" en todo el archivo daría verde por los vecinos.
.bloques_de_job <- function(src) {
  pos <- gregexpr("job_submit(", src, fixed = TRUE)[[1]]
  pos <- pos[pos > 0]
  if (!length(pos)) return(list())
  fin <- c(pos[-1] - 1L, nchar(src))
  out <- list()
  for (i in seq_along(pos)) {
    blk <- substr(src, pos[i], fin[i])
    m <- regmatches(blk, regexpr('kind = "[a-z_.]+"', blk))
    if (!length(m)) next
    kind <- gsub('kind = "|"', "", m)
    # Hasta el `list(ok = TRUE, job_id`, que ya es el retorno del endpoint.
    corte <- regexpr("list(ok = TRUE, job_id", blk, fixed = TRUE)
    cuerpo <- if (corte > 0) substr(blk, 1, corte) else blk
    out[[kind]] <- cuerpo
  }
  out
}

test_that("los tres exports de gráficos cosechan los avisos del job", {
  bloques <- .bloques_de_job(.router_graficos())
  expect_true(all(c("graficos.ppt", "graficos.ppt_all", "graficos.word") %in% names(bloques)))

  for (kind in c("graficos.ppt", "graficos.ppt_all", "graficos.word")) {
    expect_true(
      grepl(".pulso_avisos_de_job", bloques[[kind]], fixed = TRUE),
      info = sprintf("el job %s no expone `avisos`: sus degradaciones se pierden", kind)
    )
  }
})

test_that("el troceo por job distingue de verdad un bloque de otro", {
  # El control del test de arriba: si el troceo devolviera el archivo entero,
  # cualquier `kind` daría verde por los avisos de sus vecinos.
  bloques <- .bloques_de_job(.router_graficos())
  expect_gt(length(bloques), 1L)
  largos <- vapply(bloques, nchar, integer(1))
  expect_true(all(largos < nchar(.router_graficos())))
  # Y un bloque no contiene el `kind` de otro.
  expect_false(grepl('kind = "graficos.word"', bloques[["graficos.ppt"]], fixed = TRUE))
})
