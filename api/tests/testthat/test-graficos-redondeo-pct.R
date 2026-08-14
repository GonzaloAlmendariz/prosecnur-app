source("setup-load-all.R")

# El motor no tenía UN método de redondeo de porcentajes: tenía tres, escritos a
# mano dentro de cada familia. Apiladas repartía por resto mayor; agrupadas,
# categóricas y numéricas usaban la regla de la casa; y divergentes, lollipop,
# dumbbell, puntos comparativos y serie temporal llamaban a `round()` de R, que
# redondea AL PAR. La consecuencia la trajo la revisión de ACRD CONTA
# (2026-08-14): 64 celdas del PPT que no cuadraban con el SPSS sin que ningún
# dato estuviera mal.
#
# Ver `docs/qa/checklist-redondeo-decimales-2026-08-14.md`.

# ---------------------------------------------------------------------------
# El método y sus alias
# ---------------------------------------------------------------------------

test_that("el default es estandar y los alias de planes guardados se entienden", {
  expect_equal(.pulso_pct_metodo(NULL), "estandar")
  expect_equal(.pulso_pct_metodo(""), "estandar")
  expect_equal(.pulso_pct_metodo(NA), "estandar")
  expect_equal(.pulso_pct_metodo("estandar"), "estandar")
  expect_equal(.pulso_pct_metodo("reparto"), "reparto")
  # Alias que puede traer un `.pulso` escrito a mano o por una versión previa.
  expect_equal(.pulso_pct_metodo("resto_mayor"), "reparto")
  expect_equal(.pulso_pct_metodo("RESTO-MAYOR"), "reparto")
  expect_equal(.pulso_pct_metodo("hare"), "reparto")
  expect_equal(.pulso_pct_metodo("half_up"), "estandar")
  expect_equal(.pulso_pct_metodo("clasico"), "estandar")
  expect_equal(.pulso_pct_metodo("comercial"), "estandar")
})

test_that("un metodo desconocido cae en estandar y no aborta el render", {
  # Un método inválido no puede volverse un error a mitad de un mazo de 60
  # láminas: se degrada al default declarado.
  expect_equal(.pulso_pct_metodo("lo-que-sea"), "estandar")
  expect_silent(.pulso_pct_unidades(c(1, 1), 0, "lo-que-sea"))
})

# ---------------------------------------------------------------------------
# El caso que disparó todo esto
# ---------------------------------------------------------------------------

test_that("estandar reproduce el SPSS en el caso real de ACRD CONTA", {
  # Egresados, N = 178, q0034_0003. Dos categorías con UN caso cada una
  # (0,56 %): el reparto le daba 1 % a una y 0 % a la otra porque se le
  # acababan los puntos, y el desempate lo decidía el orden de la lista.
  p <- c(1, 10, 72, 94, 1) / 178
  expect_equal(.pulso_pct_unidades(p, 0, "estandar"), c(1L, 6L, 40L, 53L, 1L))
})

test_that("el mismo dato recibe la misma cifra", {
  # La propiedad que el reparto no puede dar: dos categorías con el mismo valor
  # salen rotuladas igual, independientemente de su posición en la lista.
  p <- c(1, 10, 72, 94, 1) / 178
  u <- .pulso_pct_unidades(p, 0, "estandar")
  expect_equal(u[1], u[5])

  # El control: con reparto, ese mismo dato sale distinto. Se afirma aquí para
  # que quede registrado que es una propiedad del método y no una regresión.
  r <- .pulso_pct_unidades(p, 0, "reparto")
  expect_false(r[1] == r[5])
})

# ---------------------------------------------------------------------------
# Lo que garantiza cada método
# ---------------------------------------------------------------------------

test_that("reparto cierra en 100 y estandar no tiene por que", {
  p <- c(1, 10, 72, 94, 1) / 178
  expect_equal(sum(.pulso_pct_unidades(p, 0, "reparto")), 100L)
  expect_equal(sum(.pulso_pct_unidades(p, 0, "estandar")), 101L)
})

test_that("reparto cierra en 100 a cualquier resolucion", {
  p <- c(3, 17, 41, 39) / 100
  for (dec in 0:2) {
    expect_equal(sum(.pulso_pct_unidades(p, dec, "reparto")),
                 as.integer(100 * 10^dec))
  }
})

test_that("las unidades respetan la resolucion pedida", {
  p <- c(1, 10, 72, 94, 1) / 178
  # dec = 1 → unidades de 0,1 %: 0,56 % es 6 unidades y se rotula «0.6%».
  expect_equal(.pulso_pct_unidades(p, 1, "estandar")[1], 6L)
  expect_equal(.pulso_pct_etiquetas(p, 1, "estandar")$labels[1], "0.6%")
  expect_equal(.pulso_pct_etiquetas(p, 0, "estandar")$labels[1], "1%")
})

test_that("entradas degeneradas no revientan", {
  expect_equal(.pulso_pct_unidades(c(0, 0), 0, "estandar"), c(0L, 0L))
  expect_equal(.pulso_pct_unidades(numeric(0), 0, "estandar"), integer(0))
  expect_equal(.pulso_pct_unidades(c(NA, 1), 0, "estandar"), c(0L, 100L))
  # Frecuencias crudas o proporciones dan lo mismo: se normaliza por la suma.
  expect_equal(.pulso_pct_unidades(c(1, 3), 0, "estandar"),
               .pulso_pct_unidades(c(0.25, 0.75), 0, "estandar"))
})

# ---------------------------------------------------------------------------
# El bug del redondeo al par
# ---------------------------------------------------------------------------

test_that("el 0,5 sube siempre, en los dos extremos de la escala", {
  # `round()` de R redondea al par: dejaba 12,5 % en 12 % mientras 87,5 % subía
  # a 88 % en el mismo gráfico. Ese era el tercer método, el que nadie eligió.
  expect_equal(.pulso_round_half_up(12.5), 13)
  expect_equal(.pulso_round_half_up(87.5), 88)
  expect_equal(.pulso_round_half_up(0.5), 1)
  expect_equal(.pulso_round_half_up(2.5), 3)
  # El control explícito contra el comportamiento que se está corrigiendo.
  expect_false(.pulso_round_half_up(12.5) == round(12.5))
})

test_that("ninguna familia de porcentajes rotula con round() crudo", {
  # Gate de no-regresión del ítem 5: si alguien vuelve a escribir
  # `formatC(round(...))` para una etiqueta de %, esto lo caza sin renderizar.
  familias <- c(
    "graficador_barras_divergentes.R", "graficador_lollipop.R",
    "graficador_dumbbell.R", "graficador_puntos_comparativos.R",
    "graficador_serie_temporal.R"
  )
  for (f in familias) {
    ruta <- testthat::test_path("..", "..", "R", f)
    skip_if_not(file.exists(ruta), paste("no existe", f))
    src <- readLines(ruta, warn = FALSE)
    src <- src[!grepl("^\\s*#", src)]
    ofensivas <- grep('formatC\\(round\\(|paste0\\(round\\(|paste0\\(abs\\(round\\(',
                      src, value = TRUE)
    expect_equal(length(ofensivas), 0,
                 info = paste0(f, " rotula con round() crudo: ",
                               paste(trimws(ofensivas), collapse = " | ")))
  }
})

# ---------------------------------------------------------------------------
# Cifra y segmento cuentan lo mismo (ítem 16)
# ---------------------------------------------------------------------------

test_that("lo que se rotula 0 % es exactamente lo que no se dibuja", {
  # La regla: en apiladas un segmento que se rotularía 0 % no se dibuja. Quien
  # decide ambas cosas es la MISMA llamada, así que la pregunta que hace la
  # geometría y la que hace la etiqueta no pueden divergir.
  p <- c(1, 699) / 700   # 0,143 % y 99,857 %
  u <- .pulso_pct_unidades(p, 0, "estandar")
  expect_equal(u[1], 0L)
  expect_equal(.pulso_fmt_pct_unidades(u, 0)[1], "0%")

  # Con un decimal más, ese mismo caso deja de ser cero y sí se dibujaría.
  expect_true(.pulso_pct_unidades(p, 1, "estandar")[1] > 0L)
})

test_that("estandar no elimina el cero falso, solo lo corre", {
  # Queda asentado por escrito para que no se lea el cambio de método como una
  # garantía que no da: con base 178 un caso se salva, con base 700 no.
  expect_equal(.pulso_pct_unidades(c(1, 177) / 178, 0, "estandar")[1], 1L)
  expect_equal(.pulso_pct_unidades(c(1, 699) / 700, 0, "estandar")[1], 0L)
})
