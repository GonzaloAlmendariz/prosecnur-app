source("setup-load-all.R")

# Un Top 2 Box sobre una escala de dos categorías no informa: sumarlas da 100 %
# en todas las filas. El motor ya lo omitía, pero lo avisaba — 13 veces por
# mazo, todas pidiendo lo mismo y ninguna accionable, porque el analista
# enciende la columna una vez para sus escalas de acuerdo y no puede hacer nada
# con el aviso de cada pregunta Sí/No. Ese ruido tapaba los avisos que sí lo son.

fx_apiladas <- function(cols) {
  n <- length(cols)
  df <- data.frame(categoria = c("Item A", "Item B"), N = c(100L, 100L),
                   stringsAsFactors = FALSE)
  for (i in seq_along(cols)) df[[cols[i]]] <- rep(1 / n, 2)
  df
}

graficar <- function(cols, ...) {
  graficar_barras_apiladas(
    data = fx_apiladas(cols),
    var_categoria = "categoria", var_n = "N",
    cols_porcentaje = cols,
    etiquetas_grupos = stats::setNames(paste("Opción", seq_along(cols)), cols),
    mostrar_barra_extra = TRUE,
    ...
  )
}

test_that("una escala dicotómica no genera aviso por su Top 2 Box", {
  expect_silent(graficar(c("p1", "p2"), barra_extra_preset = "top2box"))
})

test_that("el silencio es por aritmética, no por haber callado los avisos", {
  # El control. Con tres categorías y sin declarar cuáles suman, el Top 2 Box
  # SÍ avisa: ahí hay algo que hacer. Si este bloque no distinguiera, el de
  # arriba pasaría igual con los avisos apagados de raíz.
  expect_message(
    graficar(c("p1", "p2", "p3"), barra_extra_preset = "top2box"),
    "no hay categorias declaradas"
  )
})

test_that("la columna se omite igual: callar no es dibujarla", {
  # Lo que cambió es el aviso, no la decisión. Si la columna volviera, en una
  # escala de dos saldría «100 %» en todas las filas.
  p <- graficar(c("p1", "p2"), barra_extra_preset = "top2box")
  etiquetas <- attr(p, "pulso_labels_rendered", exact = TRUE)
  expect_false(any(grepl("100", etiquetas %||% character(0))))
})

test_that("declarar las categorías sigue mandando sobre la regla", {
  # `c("Opción 1")` sobre una escala de dos es un subconjunto legítimo, no la
  # escala entera: el analista eligió qué suma y esa decisión no se toca.
  expect_silent(
    graficar(c("p1", "p2"), barra_extra_preset = "top2box",
             top2box_labels = c("Opción 1"))
  )
})
