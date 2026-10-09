# n a campo por estrato del estratificado general (L2 del loop de mejoras,
# 2026-09-27).
#
# El n a campo de cada estrato se REPARTÍA: el n a campo total (inflado una
# sola vez) se volvía a repartir con el piso, así que un estrato que quedaba en
# el piso de completas recibía el piso también a campo, sin inflar. Con Neyman
# sobre cuatro regiones (Puno N=50) salía Puno 30 a campo para 30 completas
# (~21 esperadas con respuesta 0.7) y Lima 301 en vez de 278: la inflación de
# los chicos se iba a los grandes. Ahora cada estrato infla SUS completas:
#   n_campo_h = mín(N_h, ⌈n_h / tasa⌉ + ⌈⌈n_h / tasa⌉ · sobremuestra⌉)
# y el n a campo total es la suma.

.campo_comp <- function(asignacion = "neyman", p_h = c(.3, .1, .5, .5),
                        N_h = c(1500L, 450L, 3000L, 50L), piso = 30L,
                        tasa = .7, os = .1) {
  est <- lapply(seq_along(N_h), function(i) {
    e <- list(label = c("Arequipa", "Cusco", "Lima", "Puno")[[i]], N = N_h[[i]])
    if (!is.na(p_h[[i]])) e$p_facultad <- p_h[[i]]
    e
  })
  list(
    actor = "Campo", actor_id = "campo", actor_categoria = "otros",
    tecnica = "prob_estratificado", origen_tamano = "formula",
    marco = list(universo_bruto = sum(N_h), marco_validado = sum(N_h),
                 marco_contactable = sum(N_h), estado = "validado", estratos = est),
    parametros = list(z = 1.96, p = .5, e = .05, deff = 1, oversample_pct = os,
                      tasa_respuesta = tasa, tasa_elegibilidad = 1, tasa_contacto = 1,
                      n_minimo_estrato = piso, asignacion = asignacion)
  )
}

.campo_a_mano <- function(n_h, N_h, tasa, os) {
  base <- ceiling(n_h / tasa)
  as.integer(pmin(N_h, base + ceiling(base * os)))
}

test_that("L2: con Neyman y piso, cada estrato infla sus completas (128, 48, 278, 48)", {
  r <- calc_muestra_calcular_componente(.campo_comp())
  n_h <- vapply(r$distribucion_estratos, `[[`, integer(1), "n")
  campo <- vapply(r$distribucion_estratos, `[[`, integer(1), "n_campo")
  expect_identical(n_h, c(81L, 30L, 176L, 30L))
  expect_identical(campo, c(128L, 48L, 278L, 48L))
  expect_identical(campo, .campo_a_mano(n_h, c(1500L, 450L, 3000L, 50L), .7, .1))
})

test_that("L2: el n a campo total es la suma de los estratos", {
  r <- calc_muestra_calcular_componente(.campo_comp())
  campo <- vapply(r$distribucion_estratos, `[[`, integer(1), "n_campo")
  expect_identical(as.integer(r$n_operativo), sum(campo))
})

test_that("L2: ningún estrato aborda menos casos de los que su tasa exige", {
  for (asig in c("proporcional", "neyman", "potencia")) {
    r <- calc_muestra_calcular_componente(.campo_comp(asignacion = asig))
    for (d in r$distribucion_estratos) {
      esperadas <- d$n_campo * .7
      expect_true(esperadas >= d$n || d$n_campo == d$N,
                  info = sprintf("%s · %s: %d a campo para %d completas", asig, d$estrato, d$n_campo, d$n))
    }
  }
})

test_that("L2: el tope del estrato es su N_h (Puno no pasa de 50)", {
  r <- calc_muestra_calcular_componente(.campo_comp(piso = 45L))
  puno <- r$distribucion_estratos[[4]]
  expect_identical(puno$n, 45L)
  expect_identical(puno$n_campo, 50L)
})

test_that("L2: el sorteo sortea el n a campo por estrato corregido", {
  set.seed(3)
  marco <- data.frame(
    id = sprintf("P%05d", 1:5000),
    region = rep(c("Arequipa", "Cusco", "Lima", "Puno"), c(1500, 450, 3000, 50))
  )
  comp <- calc_muestra_normalize_componente(.campo_comp())
  est <- calc_muestra_normalize_estudio(list(componentes = list(comp)))
  cid <- est$componentes[[1]]$id
  dec <- calc_muestra_general_declarar_marco(est, NULL, cid, marco, "f1",
                                            columnas = list(id = "id", estrato = "region"))
  res <- calc_muestra_calcular_componente(dec$estudio$componentes[[1]])
  dec$estudio$componentes[[1]]$resultado <- res
  sel <- calc_muestra_general_seleccionar(dec$estudio, dec$estado, cid, marco, semilla = 5L)
  expect_identical(sel$corrida$estratos$n_h, c(128L, 48L, 278L, 48L))
  expect_identical(sel$corrida$corrida$n_titulares, 502L)
})

test_that("L2: la memoria sustituye el n a campo con la suma de los estratos", {
  comp <- calc_muestra_normalize_componente(.campo_comp())
  r <- calc_muestra_calcular_componente(comp)
  m <- calc_muestra_general_memoria(comp, r)
  fila <- m[m$paso == "n a campo", ]
  expect_identical(fila$resultado, "502")
  expect_identical(fila$sustitucion, "128 + 48 + 278 + 48")
  abordar <- m[m$paso == "Casos a abordar por no respuesta", ]
  expect_identical(abordar$resultado, as.character(116L + 43L + 252L + 43L))
})

test_that("L2: la coma flotante no infla un caso de más (21 / 0.7 = 30, no 31)", {
  x <- .cm_general_inflar_operativo(21L, list(tasa_respuesta = .7, oversample_pct = 0), 1000L)
  expect_identical(x$n_operativo, 30L)
  expect_identical(.cm_general_campo_por_estrato(21L, 1000L, list(tasa_respuesta = .7))$n_campo, 30L)
})
