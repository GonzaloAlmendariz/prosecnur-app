# Validación Monte Carlo del sorteo de Muestra general (E8 del loop, ADR 0090).
# Uso: E8_R=1000 Rscript scripts/calc-muestra-montecarlo-general.R   (desde la raíz del repo)
# Resultado y lectura: docs/qa/montecarlo-muestra-general-2026-09-24.md
suppressMessages(pkgload::load_all("api", quiet = TRUE))
set.seed(1)
N <- 5000L
pop <- data.frame(id = sprintf("P%05d", seq_len(N)),
                  estrato = sample(c("A","B","C","D"), N, TRUE, prob = c(.4,.3,.2,.1)),
                  stringsAsFactors = FALSE)
prev <- c(A = .20, B = .35, C = .50, D = .65)
pop$y <- stats::rbinom(N, 1, prev[pop$estrato])
pop$tam <- pmax(1, round(stats::rlnorm(N, 1, .6)))
P <- mean(pop$y)
e_decl <- 0.05
R <- as.integer(Sys.getenv("E8_R", "1000"))
comp <- calc_muestra_normalize_componente(list(tecnica = "prob_estratificado",
  marco = list(marco_validado = N, universo_bruto = N, marco_contactable = N, estado = "validado"),
  parametros = list(e = e_decl, p = .5, deff = 1, tasa_respuesta = 1, oversample_pct = 0, n_minimo_estrato = 0L)))
n <- calc_muestra_calcular_componente(comp)$n_objetivo
cat(sprintf("N=%d  P real=%.4f  n=%d (e=%.2f, p=.5)\n", N, P, n, e_decl))
cols <- list(id = "id", estrato = "estrato", tamano = "tam")
sin_estrato <- list(id = "id", tamano = "tam")
yv <- setNames(pop$y, pop$id)
res <- list()
for (dis in c("mas", "estratificado", "sistematico", "pps")) {
  est <- numeric(R); cubre <- logical(R)
  for (r in seq_len(R)) {
    s <- switch(dis,
      mas = calc_muestra_general_sortear(pop, sin_estrato, "mas", n, semilla = r),
      estratificado = calc_muestra_general_sortear(pop, cols, "mas", n, semilla = r),
      sistematico = calc_muestra_general_sortear(pop, sin_estrato, "sistematico", n, semilla = r),
      pps = calc_muestra_general_sortear(pop, sin_estrato, "pps", n, semilla = r))
    u <- s$unidades[s$unidades$estado == "titular", ]
    y <- yv[u$id]; w <- 1 / u$pi
    ph <- sum(w * y) / sum(w)                    # Hájek
    if (dis == "estratificado") {
      v <- 0
      for (h in unique(u$estrato)) {
        k <- u$estrato == h; Nh <- u$N_h[k][1]; nh <- sum(k); yh <- y[k]
        v <- v + (Nh / N)^2 * (1 - nh / Nh) * stats::var(yh) / nh
      }
    } else if (dis == "pps") {
      # Aproximación con reemplazo (Hansen–Hurwitz) del estimador de Hájek.
      z <- w * (y - ph) / sum(w)
      v <- length(y) / (length(y) - 1) * sum((z - mean(z))^2)
    } else {
      v <- (1 - n / N) * ph * (1 - ph) / (n - 1)  # MAS / sistemático como MAS
    }
    est[r] <- ph
    cubre[r] <- abs(ph - P) <= 1.96 * sqrt(v)
  }
  res[[dis]] <- c(sesgo = mean(est) - P, ee_empirico = stats::sd(est),
                  dentro_de_e = mean(abs(est - P) <= e_decl), cobertura_ic95 = mean(cubre))
}
print(round(do.call(rbind, res), 4))
