# Cuotas de sexo y edad por ficha repartidas desde la cuota del distrito
# (revisión metodológica de U15: invariantes I1–I5).

.cpf_celdas <- function() {
  rangos <- c("18_29", "30_44", "45_59", "60_mas")
  mk <- function(u, h, m) {
    data.frame(ubigeo = u, sexo = rep(c("Hombre", "Mujer"), each = 4), rango_id = rep(rangos, 2),
               cuota = c(h, m), stringsAsFactors = FALSE)
  }
  rbind(
    mk("150103", c(32, 33, 20, 11), c(33, 34, 22, 15)),   # ATE: 96 H / 104 M; 65/67/42/26
    mk("150108", c(28, 31, 22, 15), c(30, 32, 23, 19))    # CHORRILLOS: 96 / 104; 58/63/45/34
  )
}
.cpf_cfg <- function() list(age_ranges = list(list(id = "18_29"), list(id = "30_44"), list(id = "45_59"), list(id = "60_mas")))
.cpf_bloques <- function(k = rep(8L, 25)) {
  data.frame(id_manzana = c(sprintf("A%02d", seq_along(k)), sprintf("C%02d", seq_along(k))),
             ubigeo = rep(c("150103", "150108"), each = length(k)), distrito = rep(c("ATE", "CHORRILLOS"), each = length(k)),
             entrevistas = c(k, k), stringsAsFactors = FALSE)
}
.cpf_mat <- function(x) do.call(rbind, lapply(strsplit(x, ","), as.integer))

test_that("I1–I3: las fichas suman la cuota del distrito por sexo y por edad, y cada ficha suma k", {
  r <- hojas_ruta_cuotas_por_ficha(.cpf_bloques(), data.frame(), .cpf_celdas(), .cpf_cfg())
  b <- r$blocks
  for (u in c("150103", "150108")) {
    s <- .cpf_mat(b$cuota_sexo_totals[b$ubigeo == u]); e <- .cpf_mat(b$cuota_edad_totals[b$ubigeo == u])
    cel <- .cpf_celdas()[.cpf_celdas()$ubigeo == u, ]
    expect_equal(colSums(s), as.integer(c(sum(cel$cuota[cel$sexo == "Hombre"]), sum(cel$cuota[cel$sexo == "Mujer"]))))
    expect_equal(unname(colSums(e)), unname(as.integer(tapply(cel$cuota, factor(cel$rango_id, unique(cel$rango_id)), sum))))
    expect_true(all(rowSums(s) == 8L) && all(rowSums(e) == 8L))
    expect_true(all(abs(s - 8 * matrix(colSums(s) / sum(s), nrow(s), 2, byrow = TRUE)) < 2))
  }
  # Ya no es 4/4 en todas: hay fichas 3H/5M donde las mujeres son mayoría.
  expect_true(any(b$cuota_sexo_totals == "3,5"))
  # Distritos de estructura etaria distinta reciben vectores distintos.
  expect_false(identical(sort(b$cuota_edad_totals[b$ubigeo == "150103"]), sort(b$cuota_edad_totals[b$ubigeo == "150108"])))
  expect_length(r$alertas, 0)
})

test_that("I5 determinista; k variable reescala y avisa; reemplazos heredan; distrito sin celdas avisa", {
  a <- hojas_ruta_cuotas_por_ficha(.cpf_bloques(), data.frame(), .cpf_celdas(), .cpf_cfg())
  expect_identical(a, hojas_ruta_cuotas_por_ficha(.cpf_bloques(), data.frame(), .cpf_celdas(), .cpf_cfg()))
  k <- c(rep(8L, 24), 5L)
  r <- hojas_ruta_cuotas_por_ficha(.cpf_bloques(k), data.frame(), .cpf_celdas(), .cpf_cfg())
  expect_true(all(rowSums(.cpf_mat(r$blocks$cuota_sexo_totals)) == c(k, k)))
  expect_true(any(vapply(r$alertas, function(x) identical(x$code, "W_QUOTA_PER_SHEET_RESCALED"), logical(1))))
  rep_df <- data.frame(id_manzana = c("R1", "R2"), titular_id_manzana = c("A03", "ZZ"), stringsAsFactors = FALSE)
  r2 <- hojas_ruta_cuotas_por_ficha(.cpf_bloques(), rep_df, .cpf_celdas(), .cpf_cfg())
  expect_identical(r2$replacements$cuota_sexo_totals[1], r2$blocks$cuota_sexo_totals[r2$blocks$id_manzana == "A03"])
  expect_identical(r2$replacements$cuota_sexo_totals[2], "")
  b3 <- .cpf_bloques(); b3$ubigeo[1] <- "150199"
  r3 <- hojas_ruta_cuotas_por_ficha(b3, data.frame(), .cpf_celdas(), .cpf_cfg())
  expect_true(any(vapply(r3$alertas, function(x) identical(x$code, "W_QUOTA_PER_SHEET_FALLBACK"), logical(1))))
})

test_that("la ficha lee la cuota de sexo repartida; sin ella queda equilibrada (como antes)", {
  expect_identical(.hojas_ruta_cuota_sexo_de_ficha(list(cuota_sexo_totals = "3,5"), 8L, c(Hombre = 1, Mujer = 1)), c(3L, 5L))
  expect_identical(.hojas_ruta_cuota_sexo_de_ficha(list(cuota_sexo_totals = "3,4"), 8L, c(Hombre = 100, Mujer = 300)), c(4L, 4L))
  expect_identical(.hojas_ruta_cuota_sexo_de_ficha(list(), 7L, c(Hombre = 10, Mujer = 30)), c(3L, 4L))
  expect_identical(.hojas_ruta_cuota_sexo_de_ficha(list(), 7L, c(Hombre = 0, Mujer = 0)), c(4L, 3L))
})
