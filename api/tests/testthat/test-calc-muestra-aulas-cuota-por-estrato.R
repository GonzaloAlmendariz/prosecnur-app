# Como reparte HOY el motor las aulas entre estratos, fijado antes de cambiarlo.
#
# El diseno pasa a cuotas por facultad (decision de 2026-08-16). Hoy el selector
# recibe un `n_aulas` GLOBAL y `.cm_aulas_quota_by_stratum` lo reparte hacia
# abajo; con cuotas el numero vendra de arriba y el total sera su suma. Este
# archivo no juzga el reparto actual: lo escribe, para que el cambio se vea en
# el diff y para que las tres consecuencias medidas abajo no se pierdan por el
# camino.
#
# La funcion la llaman CINCO sitios (sorteo por estrato, probabilidades de
# diseno, aviso de cuota no factible y dos serializaciones del plan), asi que
# cambiar su contrato los toca a todos.

.cuo_frame <- function(estratos, eligible) {
  data.frame(
    classroom_id = sprintf("A%03d", seq_along(estratos)),
    stratum = estratos,
    eligible_n = eligible,
    stringsAsFactors = FALSE
  )
}

# Tres estratos de pesos muy distintos: A=20, B=5, C=3.
.cuo_df <- .cuo_frame(c("A", "A", "B", "C", "C", "C"), c(10, 10, 5, 1, 1, 1))

test_that("con plazas para todos reparte proporcional al tamano, con piso 1", {
  q <- .cm_aulas_quota_by_stratum(.cuo_df, 6L)
  # Proporcional daria 4,29 / 1,07 / 0,64. El piso 1 rescata a C de quedarse
  # fuera y el sobrante se descuenta de quien mas se paso.
  expect_identical(q, stats::setNames(c(4L, 1L, 1L), c("A", "B", "C")))
  # La suma es EXACTA: el reparto no pierde ni inventa aulas.
  expect_identical(sum(q), 6L)
  expect_type(q, "integer")

  # Con n justo igual al numero de estratos, el piso manda sobre la proporcion:
  # A pesa 20 de 28 y aun asi recibe una sola.
  expect_identical(.cm_aulas_quota_by_stratum(.cuo_df, 3L), stats::setNames(rep(1L, 3), c("A", "B", "C")))

  # Y a escala: 84 estratos con 30 aulas es el caso real de 2025-2, pero al
  # reves —mas estratos que aulas— y por eso vive en el test de abajo. Aqui la
  # invariante con holgura: la suma cuadra sea cual sea el n.
  grande <- .cuo_frame(rep(sprintf("E%02d", 1:84), each = 3), rep(seq_len(84), each = 3))
  for (n in c(84L, 100L, 162L, 235L, 400L)) {
    expect_identical(sum(.cm_aulas_quota_by_stratum(grande, n)), n)
    expect_true(all(.cm_aulas_quota_by_stratum(grande, n) >= 1L))
  }
})

test_that("con menos aulas que estratos, los que sobran NO quedan en cero: quedan sin entrada", {
  # LA diferencia que importa para el cambio. Un cero es un estrato que el
  # motor conoce y decide no visitar; la ausencia es un estrato que desaparece
  # del reparto. Todo lo que recorre `names(quotas)` —el sorteo, el aviso de
  # cuota no factible— nunca llega a preguntar por el.
  q <- .cm_aulas_quota_by_stratum(.cuo_df, 2L)
  expect_length(q, 2L)
  expect_identical(names(q), c("A", "B"))   # los dos de mayor eligible_n
  expect_false("C" %in% names(q))           # no es q[["C"]] == 0
  expect_identical(unname(q), c(1L, 1L))    # y los elegidos reciben 1, no su parte proporcional

  # Con n = 1 se queda el mas grande y solo el.
  expect_identical(.cm_aulas_quota_by_stratum(.cuo_df, 1L), stats::setNames(1L, "A"))
})

test_that("un estrato sin entrada queda con probabilidad de inclusion CERO", {
  # La consecuencia medible de la ausencia, y la razon de que este reparto
  # tenga que cambiar: no es que esos estratos entren poco, es que no pueden
  # entrar. Cobertura cero, no probabilidad baja.
  pi <- .cm_aulas_design_probabilities(.cuo_df, list(n_aulas = 2L), "estratificado_aleatorio")
  expect_identical(unname(pi[c("A004", "A005", "A006")]), c(0, 0, 0))
  expect_true(all(pi[c("A001", "A002", "A003")] > 0))

  # Y con plaza para todos, ninguna en cero.
  pi_ok <- .cm_aulas_design_probabilities(.cuo_df, list(n_aulas = 6L), "estratificado_aleatorio")
  expect_true(all(pi_ok > 0))
})

test_that("el reparto degenerado devuelve vacio en vez de inventar", {
  vacio <- .cm_aulas_quota_by_stratum(.cuo_df, 0L)
  expect_length(vacio, 0L)
  expect_length(.cm_aulas_quota_by_stratum(.cuo_df, -3L), 0L)
  expect_length(.cm_aulas_quota_by_stratum(.cuo_frame(character(0), numeric(0)), 5L), 0L)
})

test_that("un estrato sin tamano no se lleva el reparto entero", {
  # `eligible_n` puede llegar en NA o en cero desde un marco recortado. El peso
  # cae a 1 —no a cero, que dividiria mal, ni a NA, que propagaria— asi que el
  # estrato participa como el mas pequeno posible.
  raro <- .cuo_frame(c("A", "B", "C"), c(100, NA_real_, 0))
  q <- .cm_aulas_quota_by_stratum(raro, 6L)
  expect_identical(sum(q), 6L)
  expect_true(all(is.finite(q)))
  expect_identical(unname(q[c("B", "C")]), c(1L, 1L))
  expect_identical(unname(q[["A"]]), 4L)

  # Y el caso que de verdad depende del piso: un marco entero sin tamanos. Si
  # el peso degenerado cayera a 0 en vez de a 1, la suma de pesos seria 0 y el
  # reparto se iria a NaN. Con el piso, reparte en partes iguales.
  # (`sum(NA, na.rm = TRUE)` ya vale 0, asi que el NA suelto no distingue las
  # dos ramas: hace falta que TODOS los estratos esten degenerados.)
  for (sin_tamano in list(rep(0, 6), rep(NA_real_, 6))) {
    q0 <- .cm_aulas_quota_by_stratum(.cuo_frame(c("A", "A", "B", "C", "C", "C"), sin_tamano), 6L)
    expect_identical(q0, stats::setNames(c(2L, 2L, 2L), c("A", "B", "C")))
  }
})
