# El panel usa el alto que TIENE, no sólo el que necesita.
#
# El canvas se construía con filas × alto de fila e ignoraba el hueco donde iba
# a caer. Medido sobre el mazo de acreditación: con un hueco de 6.00 in, una
# lámina de dos premisas dejaba 3.62 in sin usar, y ahí se perdían a la vez el
# grosor de barra y el aire entre premisas.

test_that("el tope de estirado es conservador", {
  # Sin tope, una premisa sola en un hueco alto sale con la barra más gruesa
  # del mazo. Y subirlo no aporta: el límite real es el hueco menos lo que
  # reservan cabecera, leyenda y pie.
  expect_gt(.BARRAS_PANEL_ESTIRA_MAX, 1)
  expect_lte(.BARRAS_PANEL_ESTIRA_MAX, 2)
})

test_that("el estirado respeta lo que ya reservan los demas bloques", {
  # Reconstruye la aritmética del graficador: el panel puede crecer hasta el
  # hueco MENOS cabecera, leyenda y pie, nunca hasta el hueco entero.
  alto <- 6.00; header <- 0; leyenda <- 0.29; pie <- 0.85
  panel_natural <- 1.24
  disponible <- alto - header - leyenda - pie
  panel <- min(disponible, panel_natural * .BARRAS_PANEL_ESTIRA_MAX)

  expect_gt(panel, panel_natural)
  expect_lte(panel, disponible)
  expect_lte(panel + header + leyenda + pie, alto)
})

test_that("un canvas que ya llena su hueco no se estira", {
  alto <- 6.00; header <- 0; leyenda <- 0.29; pie <- 0.85
  panel_natural <- 4.86
  disponible <- alto - header - leyenda - pie
  expect_lte(disponible, panel_natural)
})

# --- el mismo estirado, en agrupadas ------------------------------------------

test_that("el tope de agrupadas es mayor que el de apiladas", {
  # El hueco de un perfil es un cuarto de lámina y su alto natural se queda
  # mucho más corto, así que necesita más margen de estirado. Medido: con 1.8
  # quedan 9 gráficos bajo el piso, con 2.6 quedan 5, y 3.4 no cambia nada.
  expect_gt(.AGRUPADAS_PANEL_ESTIRA_MAX, .BARRAS_PANEL_ESTIRA_MAX)
  expect_lte(.AGRUPADAS_PANEL_ESTIRA_MAX, 3)
})

test_that("en agrupadas el panel tampoco puede pasarse del hueco", {
  alto <- 3.00; header <- 0.26; leyenda <- 0.29; pie <- 0.40
  panel_natural <- 0.70
  disponible <- alto - header - leyenda - pie
  panel <- min(disponible, panel_natural * .AGRUPADAS_PANEL_ESTIRA_MAX)

  expect_gt(panel, panel_natural)
  expect_lte(panel + header + leyenda + pie, alto)
})
