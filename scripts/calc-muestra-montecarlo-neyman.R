# Validación Monte Carlo del estratificado por estrato (E3 del loop): el n de
# Cochran 5.25 (proporcional) y 5.26 (Neyman) con p por estrato ¿deja el
# error dentro del margen declarado? Uso (desde la raíz del repo):
#   E8_R=2000 Rscript scripts/calc-muestra-montecarlo-neyman.R
# Resultado y lectura: docs/qa/montecarlo-muestra-general-2026-09-24.md (sección E3).
suppressMessages(pkgload::load_all("api", quiet = TRUE))
set.seed(7)
N_h <- c(A = 6000L, B = 3000L, C = 1000L)
p_h <- c(A = .08, B = .30, C = .55)
pop <- data.frame(id = sprintf("P%06d", seq_len(sum(N_h))), estrato = rep(names(N_h), N_h), stringsAsFactors = FALSE)
pop$y <- stats::rbinom(nrow(pop), 1, p_h[pop$estrato])
P <- mean(pop$y); N <- nrow(pop); e_decl <- 0.03
R <- as.integer(Sys.getenv("E8_R", "2000"))
yv <- setNames(pop$y, pop$id)
res <- list()
for (asig in c("proporcional", "neyman")) {
  comp <- calc_muestra_normalize_componente(list(tecnica = "prob_estratificado",
    marco = list(marco_validado = N, universo_bruto = N, marco_contactable = N, estado = "validado",
                 estratos = lapply(names(N_h), function(k) list(label = k, N = N_h[[k]], p_facultad = p_h[[k]]))),
    parametros = list(e = e_decl, p = .5, deff = 1, tasa_respuesta = 1, oversample_pct = 0,
                      n_minimo_estrato = 0L, asignacion = asig)))
  r <- calc_muestra_calcular_componente(comp)
  asignacion <- setNames(vapply(r$distribucion_estratos, `[[`, integer(1), "n"),
                         vapply(r$distribucion_estratos, `[[`, "", "estrato"))
  est <- numeric(R)
  for (k in seq_len(R)) {
    s <- calc_muestra_general_sortear(pop, list(id = "id", estrato = "estrato"), "mas",
                                      n = sum(asignacion), semilla = k, asignacion = asignacion)
    u <- s$unidades[s$unidades$estado == "titular", ]
    w <- 1 / u$pi
    est[k] <- sum(w * yv[u$id]) / sum(w)
  }
  res[[asig]] <- c(n = r$n_teorico, e_publicado = r$precision_alcanzada,
                   ee_empirico = stats::sd(est), e95_empirico = 1.96 * stats::sd(est),
                   dentro_de_e = mean(abs(est - P) <= e_decl), sesgo = mean(est) - P)
  cat(asig, "reparto:", paste(names(asignacion), asignacion, collapse = " "), "\n")
}
n_global <- calc_n_muestra(N = N, p = .5, z = 1.96, e = e_decl, deff = 1)
cat(sprintf("N=%d  P=%.4f  e declarado=%.2f  n global (p=.5)=%d\n", N, P, e_decl, n_global))
print(round(do.call(rbind, res), 4))
