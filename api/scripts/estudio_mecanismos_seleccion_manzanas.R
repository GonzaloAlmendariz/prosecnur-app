# Estudio de mecanismos de selección de manzanas titulares (Hojas de ruta).
#
# Fase 1 del encargo del 2026-10-29: diagnostica el sesgo del PPS hacia manzanas
# grandes y compara por Monte Carlo ocho mecanismos sobre el marco real de
# `acnur_acg` (6 distritos, 25 rutas de 8 entrevistas por distrito). No toca el
# motor: reusa sus funciones de π y de recorrido sistemático (pkgload::load_all)
# para que el mecanismo (a) sea exactamente el sorteo de hoy.
#
# Uso (una corrida a la vez; la máquina es compartida):
#   unzip -p api/inst/reference_projects/acnur_acg/acnur_acg.pulso state.rds > state.rds
#   Rscript api/scripts/estudio_mecanismos_seleccion_manzanas.R state.rds <salida_dir> [R=1000]
#
# Escribe en <salida_dir>: resultados.rds (todo) y tablas.md (las tablas del informe).

args <- commandArgs(trailingOnly = TRUE)
stopifnot(length(args) >= 2L)
state_path <- args[[1]]
out_dir <- args[[2]]
R <- if (length(args) >= 3L) as.integer(args[[3]]) else 1000L
dir.create(out_dir, showWarnings = FALSE, recursive = TRUE)

suppressMessages(pkgload::load_all("api", quiet = TRUE))
stopifnot(requireNamespace("BalancedSampling", quietly = TRUE))

SEMILLA_BASE <- 20261029L
RUTA <- 8L
UMBRAL_GRANDE <- 100     # viviendas por manzana
UMBRAL_DENSIDAD <- 200   # viviendas por hectárea («vertical probable»)
NSE_NIVELES <- c("BAJO", "MEDIO BAJO", "MEDIO", "MEDIO ALTO", "ALTO", "SIN DATA")

# ---------- Marco ----------

s <- readRDS(state_path)
cfg <- hojas_ruta_integrada_normalize_config(s$hojas_ruta_config)
frame <- .hojas_ruta_filter_frame(cfg)
num <- function(x) { v <- suppressWarnings(as.numeric(x)); v[!is.finite(v)] <- 0; v }
for (v in c("viviendas", "poblacion", "poblacion_h", "poblacion_m", "area_m2")) frame[[v]] <- num(frame[[v]])
frame$nse_nivel <- ifelse(frame$nse_nivel %in% NSE_NIVELES, frame$nse_nivel, "SIN DATA")
# Las manzanas sin viviendas tienen π = 0 en todos los mecanismos (ADR 0117 §3):
# quedan fuera de la población objetivo del estudio.
marco <- frame[frame$viviendas > 0, , drop = FALSE]
marco$densidad_ha <- ifelse(marco$area_m2 > 0, marco$viviendas / (marco$area_m2 / 1e4), NA_real_)
marco$grande <- marco$viviendas >= UMBRAL_GRANDE
marco$vertical <- marco$grande & !is.na(marco$densidad_ha) & marco$densidad_ha >= UMBRAL_DENSIDAD

n_por_distrito <- vapply(s$hojas_ruta_config$n_por_distrito, as.integer, integer(1))
distritos <- names(n_por_distrito)
rutas_d <- as.integer(n_por_distrito %/% RUTA)
names(rutas_d) <- distritos

# Orden del recorrido: el del motor (zona → manzana → id_manzana).
por_distrito <- lapply(distritos, function(u) {
  df <- marco[as.character(marco$ubigeo) == u, , drop = FALSE]
  df[order(as.character(df$zona), as.character(df$manzana), as.character(df$id_manzana)), , drop = FALSE]
})
names(por_distrito) <- distritos

# ---------- Diagnóstico ----------

diagnostico <- do.call(rbind, lapply(distritos, function(u) {
  df <- por_distrito[[u]]
  v <- df$viviendas
  pi <- .hojas_ruta_sorteo_pi(v, rutas_d[[u]])
  q <- stats::quantile(v, c(.5, .9, .95, .99))
  data.frame(
    distrito = df$distrito[[1]], manzanas = nrow(df), viviendas = sum(v),
    p50 = q[[1]], p95 = q[[3]], p99 = q[[4]], max = max(v),
    pi_top5 = sum(pi[v >= q[[3]]]) / sum(pi),
    pi_top1 = sum(pi[v >= q[[4]]]) / sum(pi),
    grandes = sum(df$grande), pi_grandes = sum(pi[df$grande]) / sum(pi),
    vertical = sum(df$vertical), pi_vertical = sum(pi[df$vertical]) / sum(pi),
    certezas = sum(pi >= 1 - 1e-9), pi_max = max(pi),
    stringsAsFactors = FALSE
  )
}))

# ---------- Mecanismos ----------
#
# Cada mecanismo devuelve, por distrito, la π exacta de cada manzana y una función
# que sortea una réplica (filas). Las π salen de la fórmula del diseño; la
# frecuencia empírica las contrasta más abajo.

sistematico <- function(m, n) {
  pik <- .hojas_ruta_sorteo_pi(m, n)
  list(pi = pik, sortear = function() .cm_aulas_recorrido_sistematico(pik)$indices)
}

estratificado <- function(df, n, fraccion_grandes) {
  g <- which(df$grande)
  r <- which(!df$grande)
  share <- sum(df$viviendas[g]) / sum(df$viviendas)
  n_g <- min(length(g), as.integer(round(fraccion_grandes * n * share)))
  n_r <- n - n_g
  pik <- numeric(nrow(df))
  # Estrato de grandes: igual probabilidad (el tamaño ya no pesa); resto: PPS.
  if (n_g > 0L) pik[g] <- .hojas_ruta_sorteo_pi(rep(1, length(g)), n_g)
  pik[r] <- .hojas_ruta_sorteo_pi(df$viviendas[r], n_r)
  list(pi = pik, n_g = n_g, sortear = function() {
    c(if (n_g > 0L) g[.cm_aulas_recorrido_sistematico(pik[g])$indices], r[.cm_aulas_recorrido_sistematico(pik[r])$indices])
  })
}

matriz_balance <- function(df, pik) {
  pob <- df$poblacion
  cbind(
    pik = pik, viviendas = df$viviendas, poblacion_h = df$poblacion_h, poblacion_m = df$poblacion_m,
    nse_bajo = pob * (df$nse_nivel == "BAJO"), nse_medio_bajo = pob * (df$nse_nivel == "MEDIO BAJO"),
    nse_medio = pob * (df$nse_nivel == "MEDIO"), nse_medio_alto_alto = pob * (df$nse_nivel %in% c("MEDIO ALTO", "ALTO"))
  )
}

# El cubo de la simulación es el de BalancedSampling (C++, ~13 ms por sorteo en
# San Juan de Lurigancho frente a ~2 s de sampling::samplecube). Su π es la misma
# por construcción (martingala); la reproducibilidad del de sampling se mide aparte.
cubo <- function(df, pik) {
  x <- matriz_balance(df, pik)
  list(pi = pik, sortear = function() sort(BalancedSampling::cube(pik, x)))
}

tope95 <- function(v) pmin(v, stats::quantile(v, .95))
mecanismos <- list(
  a_pps = function(df, n) sistematico(df$viviendas, n),
  b1_tope_p95 = function(df, n) sistematico(tope95(df$viviendas), n),
  b2_raiz = function(df, n) sistematico(sqrt(df$viviendas), n),
  c1_estrato_prop = function(df, n) estratificado(df, n, 1),
  c2_estrato_mitad = function(df, n) estratificado(df, n, 0.5),
  d1_cubo_pps = function(df, n) cubo(df, .hojas_ruta_sorteo_pi(df$viviendas, n)),
  d2_cubo_tope = function(df, n) cubo(df, .hojas_ruta_sorteo_pi(tope95(df$viviendas), n)),
  e_mas = function(df, n) sistematico(rep(1, nrow(df)), n)
)

# ---------- Verdad y estimadores ----------

nse_de <- list(pct_bajo = "BAJO", pct_medio_bajo = "MEDIO BAJO", pct_medio = "MEDIO", pct_medio_alto_alto = c("MEDIO ALTO", "ALTO"), pct_sin_data = "SIN DATA")
objetivos <- c("poblacion", "pct_mujeres", names(nse_de))

verdad_distrito <- function(df) {
  pob <- df$poblacion
  c(poblacion = sum(pob), pct_mujeres = sum(df$poblacion_m) / sum(pob),
    vapply(nse_de, function(k) sum(pob[df$nse_nivel %in% k]) / sum(pob), numeric(1)))
}

# Una réplica en un distrito: totales HT (con la π exacta) y medias sin pesos.
# Segunda etapa: 8 personas por manzana; el sexo se sortea Binomial(8, p_mujer)
# para que el DEFF frente al MAS de personas incluya la variación dentro de la
# manzana. El NSE es de la manzana: su segunda etapa no varía.
estimar <- function(df, idx, pik) {
  w <- 1 / pik[idx]
  pob <- df$poblacion[idx]
  pm <- ifelse(pob > 0, df$poblacion_m[idx] / pob, 0)
  mujeres8 <- stats::rbinom(length(idx), RUTA, pm)
  nse_ht <- vapply(nse_de, function(k) sum(w * pob * (df$nse_nivel[idx] %in% k)), numeric(1))
  # Peso por persona (Kish): w_i·pob_i/8, igual para las 8 de la manzana.
  wp <- w * pob / RUTA
  list(
    ht = c(poblacion = sum(w * pob), t_m = sum(w * pob * mujeres8 / RUTA), nse_ht),
    sin_pesos = c(pct_mujeres = mean(mujeres8 / RUTA), vapply(nse_de, function(k) mean(df$nse_nivel[idx] %in% k), numeric(1))),
    aux = c(viviendas = sum(w * df$viviendas[idx]), poblacion_m = sum(w * df$poblacion_m[idx])),
    kish = sum(wp^2) * length(wp) / sum(wp)^2,
    carga = df$viviendas[idx], grande = df$grande[idx], vertical = df$vertical[idx],
    zonas = length(unique(df$zona[idx]))
  )
}

# ---------- Monte Carlo ----------

t0 <- Sys.time()
resultado <- list()
for (k in seq_along(mecanismos)) {
  nombre <- names(mecanismos)[[k]]
  por_d <- list()
  for (j in seq_along(distritos)) {
    u <- distritos[[j]]
    df <- por_distrito[[u]]
    mec <- mecanismos[[k]](df, rutas_d[[u]])
    set.seed(SEMILLA_BASE + 100000L * k + 1000L * j)
    frec <- integer(nrow(df))
    reps <- vector("list", R)
    for (r in seq_len(R)) {
      idx <- mec$sortear()
      frec[idx] <- frec[idx] + 1L
      reps[[r]] <- estimar(df, idx, mec$pi)
    }
    por_d[[u]] <- list(pi = mec$pi, frec = frec, reps = reps, n_g = mec$n_g)
  }
  resultado[[nombre]] <- por_d
  message(sprintf("%s listo (%.0f s)", nombre, as.numeric(difftime(Sys.time(), t0, units = "secs"))))
}

# ---------- Resumen ----------

verdad <- lapply(por_distrito, verdad_distrito)
pob_d <- vapply(verdad, function(v) v[["poblacion"]], numeric(1))
W <- pob_d / sum(pob_d)
todo <- do.call(rbind, por_distrito)
verdad_total <- verdad_distrito(todo)

# Estimación conjunta de los 6 distritos por réplica: suma de totales HT; los
# porcentajes son razones de totales HT. La versión «sin pesos» pondera cada
# distrito por su población y promedia sin pesos dentro: aísla el efecto del
# mecanismo, no el de la asignación igual por distrito (común a todos).
estimaciones_conjuntas <- function(por_d) {
  t(vapply(seq_len(R), function(r) {
    ht <- Reduce(`+`, lapply(distritos, function(u) por_d[[u]]$reps[[r]]$ht))
    sp <- Reduce(`+`, lapply(seq_along(distritos), function(j) W[[j]] * por_d[[distritos[[j]]]]$reps[[r]]$sin_pesos))
    c(poblacion = ht[["poblacion"]], pct_mujeres = ht[["t_m"]] / ht[["poblacion"]],
      ht[names(nse_de)] / ht[["poblacion"]], stats::setNames(sp, paste0("sp_", names(sp))))
  }, numeric(2L + 2L * length(nse_de) + 1L)))
}

# Referencia MAS de personas: 200 por distrito, estratificado por distrito.
var_mas_personas <- function(o) {
  if (o == "poblacion") return(NA_real_)
  p_d <- vapply(verdad, function(v) v[[o]], numeric(1))
  sum(W^2 * p_d * (1 - p_d) / (rutas_d * RUTA))
}

resumen <- do.call(rbind, lapply(names(resultado), function(nombre) {
  est <- estimaciones_conjuntas(resultado[[nombre]])
  do.call(rbind, lapply(objetivos, function(o) {
    th <- verdad_total[[o]]
    x <- est[, o]
    data.frame(
      mecanismo = nombre, objetivo = o, verdad = th,
      sesgo_rel = (mean(x) - th) / th, se_mc_sesgo_rel = stats::sd(x) / sqrt(R) / th,
      cv = stats::sd(x) / th, ecm = mean((x - th)^2),
      deff_mas_personas = stats::var(x) / var_mas_personas(o),
      sesgo_sin_pesos_pp = if (o == "poblacion") NA_real_ else 100 * (mean(est[, paste0("sp_", o)]) - th),
      stringsAsFactors = FALSE
    )
  }))
}))
ref_e <- resumen[resumen$mecanismo == "e_mas", c("objetivo", "ecm")]
resumen$ecm_rel_mas <- resumen$ecm / ref_e$ecm[match(resumen$objetivo, ref_e$objetivo)]

campo <- do.call(rbind, lapply(names(resultado), function(nombre) {
  reps <- unlist(lapply(distritos, function(u) resultado[[nombre]][[u]]$reps), recursive = FALSE)
  carga <- unlist(lapply(reps, `[[`, "carga"))
  aux_rel <- do.call(rbind, lapply(distritos, function(u) {
    df <- por_distrito[[u]]
    a <- do.call(rbind, lapply(resultado[[nombre]][[u]]$reps, `[[`, "aux"))
    c(viviendas = sqrt(mean((a[, "viviendas"] - sum(df$viviendas))^2)) / sum(df$viviendas),
      poblacion_m = sqrt(mean((a[, "poblacion_m"] - sum(df$poblacion_m))^2)) / sum(df$poblacion_m))
  }))
  data.frame(
    mecanismo = nombre,
    viv_media = mean(carga), viv_p50 = stats::median(carga), viv_p90 = stats::quantile(carga, .9)[[1]],
    viv_p99 = stats::quantile(carga, .99)[[1]], viv_sd = stats::sd(carga),
    pct_rutas_grandes = 100 * mean(unlist(lapply(reps, `[[`, "grande"))),
    pct_rutas_vertical = 100 * mean(unlist(lapply(reps, `[[`, "vertical"))),
    zonas_por_distrito = mean(vapply(reps, `[[`, numeric(1), "zonas")),
    kish_deff_w = mean(vapply(reps, `[[`, numeric(1), "kish")),
    balance_viv_rrmse = mean(aux_rel[, "viviendas"]), balance_mujeres_rrmse = mean(aux_rel[, "poblacion_m"]),
    stringsAsFactors = FALSE
  )
}))

# ---------- Verificación de la π (ADR 0066) ----------
#
# Por mecanismo, sobre las manzanas de los 6 distritos:
#   1. Criterio del motor: |frec − π| ≤ 4·SE, SE = sqrt(max(π(1−π), 1e-4)/R), en
#      las manzanas con π ≥ 0,05 (donde la aproximación normal vale).
#   2. Global por deciles de π: Σ frec frente a R·Σπ, z de Poisson-binomial.
#   3. Controles positivos: la propia frecuencia contra 1,3·π (mutante de escala) y
#      la frecuencia de (a) contra la π de (b1). Ambos deben fallar.
verificar <- function(frec, pik) {
  f <- frec / R
  se <- sqrt(pmax(pik * (1 - pik), 1e-4) / R)
  libres <- pik > 0 & pik < 1 - 1e-9
  grandes <- libres & pik >= 0.05
  dec <- cut(rank(pik[libres], ties.method = "first"), 10, labels = FALSE)
  z_dec <- vapply(1:10, function(b) {
    p <- pik[libres][dec == b]
    (sum(frec[libres][dec == b]) - R * sum(p)) / sqrt(R * sum(p * (1 - p)))
  }, numeric(1))
  list(unidades = sum(grandes), fuera_4se = sum(abs(f[grandes] - pik[grandes]) > 4 * se[grandes]),
       z_max = max(abs(z_dec)), certezas_siempre = all(frec[pik >= 1 - 1e-9] == R))
}
verificacion <- do.call(rbind, lapply(names(resultado), function(nombre) {
  v <- lapply(distritos, function(u) verificar(resultado[[nombre]][[u]]$frec, resultado[[nombre]][[u]]$pi))
  mut <- lapply(distritos, function(u) { x <- resultado[[nombre]][[u]]; verificar(x$frec, pmin(1, 1.3 * x$pi)) })
  data.frame(
    mecanismo = nombre,
    unidades_pi_ge_005 = sum(vapply(v, `[[`, numeric(1), "unidades")),
    fuera_4se = sum(vapply(v, `[[`, numeric(1), "fuera_4se")),
    z_deciles_max = max(vapply(v, `[[`, numeric(1), "z_max")),
    certezas_siempre = all(vapply(v, `[[`, logical(1), "certezas_siempre")),
    mutante_13_fuera_4se = sum(vapply(mut, `[[`, numeric(1), "fuera_4se")),
    mutante_13_z_max = max(vapply(mut, `[[`, numeric(1), "z_max")),
    stringsAsFactors = FALSE
  )
}))
control_cruzado <- do.call(rbind, lapply(distritos, function(u) {
  v <- verificar(resultado$a_pps[[u]]$frec, resultado$b1_tope_p95[[u]]$pi)
  data.frame(distrito = por_distrito[[u]]$distrito[[1]], unidades = v$unidades, fuera_4se = v$fuera_4se, z_deciles_max = v$z_max)
}))

duracion <- as.numeric(difftime(Sys.time(), t0, units = "secs"))
saveRDS(list(R = R, semilla_base = SEMILLA_BASE, diagnostico = diagnostico, resumen = resumen, campo = campo,
             verificacion = verificacion, control_cruzado = control_cruzado, verdad_total = verdad_total,
             n_g = lapply(resultado, function(m) vapply(m, function(x) as.integer(x$n_g %||% NA_integer_), integer(1))),
             duracion_s = duracion),
        file.path(out_dir, "resultados.rds"))

md <- function(df, digits = 3) {
  df[] <- lapply(df, function(x) if (is.numeric(x)) format(round(x, digits), scientific = FALSE, trim = TRUE) else x)
  c(paste0("| ", paste(names(df), collapse = " | "), " |"), paste0("|", paste(rep("---", ncol(df)), collapse = "|"), "|"),
    apply(df, 1, function(r) paste0("| ", paste(r, collapse = " | "), " |")))
}
writeLines(c(
  sprintf("R = %d réplicas por mecanismo y distrito; semilla base %d; %.0f s.", R, SEMILLA_BASE, duracion),
  "", "## Diagnóstico", md(diagnostico),
  "", "## Estimadores", md(resumen, 4),
  "", "## Campo y balance", md(campo),
  "", "## Verificación de π", md(verificacion), "", md(control_cruzado)
), file.path(out_dir, "tablas.md"))
message("listo: ", out_dir)
