# Propiedades transversales del motor general sobre entradas aleatorias. Cada
# una es una promesa que la herramienta hace al usuario; un contraejemplo es
# un defecto aunque ningún caso escrito a mano lo haya previsto.

test_that("sorteo: π en (0,1], Σ1/π = N_h por estrato (MAS/sistemático), ids únicos, reservas disjuntas y del estrato", {
  set.seed(47)
  for (k in 1:300) {
    N <- sample(c(20:80, 200:3000), 1)
    H <- sample(1:5, 1)
    marco <- data.frame(id = sprintf("U%06d", sample.int(999999L, N)),
                        est = sample(LETTERS[1:H], N, replace = TRUE),
                        tam = round(stats::rlnorm(N, 2, 1)) + 1)
    metodo <- sample(c("mas", "sistematico", "pps"), 1)
    n <- sample(1:max(1, N - 1), 1)
    cols <- list(id = "id", estrato = if (H > 1) "est" else "", tamano = "tam")
    s <- calc_muestra_general_sortear(marco, cols, metodo, n = n, semilla = k,
                                      reservas_por_estrato = sample(0:3, 1), piso = sample(c(0L, 2L), 1))
    u <- s$unidades; tit <- u[u$estado == "titular", ]; res <- u[u$estado == "reserva", ]
    info <- sprintf("k=%d N=%d H=%d %s n=%d", k, N, H, metodo, n)
    expect_true(all(tit$pi > 0 & tit$pi <= 1 + 1e-12), info = info)
    expect_identical(anyDuplicated(u$id), 0L, info = info)
    expect_length(intersect(tit$id, res$id), 0L)
    if (nrow(res)) expect_true(all(res$estrato == marco$est[match(res$id, marco$id)] | H == 1), info = info)
    if (metodo != "pps") {
      for (h in unique(tit$estrato)) {
        th <- tit[tit$estrato == h, ]
        expect_equal(sum(1 / th$pi), th$N_h[1], tolerance = 1e-8, info = paste(info, h))
      }
    }
  }
})

test_that("cálculo: sin meta ni piso, el error alcanzado no supera el declarado (proporción y media)", {
  set.seed(48)
  tecs <- c("prob_aleatorio_simple", "sistematico", "prob_estratificado")
  for (k in 1:600) {
    t <- sample(tecs, 1); N <- sample(c(50:500, 1000:20000), 1)
    media <- runif(1) < .4
    est <- if (t == "prob_estratificado") {
      H <- sample(2:4, 1); Nh <- as.integer(pmax(5, round(N * prop.table(runif(H) + .2))))
      lapply(seq_len(H), function(i) {
        e <- list(label = paste0("E", i), N = Nh[i])
        if (!media && runif(1) < .5) e$p_facultad <- runif(1, .05, .95)
        e
      })
    } else list()
    Nt <- if (length(est)) sum(vapply(est, `[[`, 0, "N")) else N
    e_decl <- sample(c(.03, .05, .08), 1)
    comp <- calc_muestra_normalize_componente(list(tecnica = t,
      marco = list(marco_validado = Nt, universo_bruto = Nt, marco_contactable = Nt, estado = "validado", estratos = est),
      parametros = list(e = e_decl, p = runif(1, .1, .9), deff = 1, n_minimo_estrato = 0L,
                        asignacion = sample(c("proporcional", "neyman", "potencia"), 1),
                        tipo_indicador = if (media) "media" else "proporcion", cv = runif(1, .3, 2),
                        tasa_respuesta = 1, oversample_pct = 0)))
    r <- calc_muestra_calcular_componente(comp)
    if (is.na(r$precision_alcanzada %||% NA)) next
    # Tolerancia: el mínimo de 2 por estrato y el redondeo del reparto pueden
    # rozar el margen; la regla es que no lo supere en más de 5 %.
    expect_lte(r$precision_alcanzada, e_decl * 1.05,
               label = sprintf("k=%d %s N=%d media=%s asig=%s e_alc", k, t, Nt, media, comp$parametros$asignacion))
  }
})
