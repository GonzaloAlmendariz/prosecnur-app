# Sortea el marco de un .pulso con un n de aulas dado y mide, por facultad, las
# CAIDAS QUE LA CUOTA TOLERA. Serie A del plan de ticks (2026-08-22).
#
# El nombre importa: Monitoreo ya tiene un `colchonPorFacultad` que cuenta
# RESERVAS LIBRES durante el operativo. Esto es otra cosa —cuantas titulares
# pueden caer antes de bajar de la cuota, medido sobre entrevistas esperadas— y
# llamarlo «colchon» daria dos sentidos a la misma palabra en el mismo dominio.
#
#   SP=<dir> N=195 Rscript scripts/qa/sortear-n.R
#
# La vara: cuantas titulares pueden caer antes de necesitar un reemplazo,
# contado en el peor caso (que caigan las que mas rinden).
suppressMessages(pkgload::load_all("api", quiet = TRUE))
`%||%` <- function(a, b) if (is.null(a)) b else a
norm <- function(x) toupper(trimws(gsub("[[:space:]]+", " ", x)))

n_obj <- as.integer(Sys.getenv("N", "190"))
pulso <- file.path(Sys.getenv("SP"), Sys.getenv("PULSO", "HSVG2026_definitivo.pulso"))
tmp <- file.path(tempdir(), paste0("sortear_", n_obj)); unlink(tmp, recursive = TRUE); dir.create(tmp)
utils::unzip(pulso, exdir = tmp)
st <- readRDS(file.path(tmp, "state.rds"))

frame <- st$calc_muestra_aulas_frame
cfg <- st$calc_muestra_aulas_config
# `n_aulas` se acepta y NO manda: el reparto real vive en
# `selector$faculty_targets`, una lista facultad -> aulas que suma el total.
# Cambiar sólo n_aulas devuelve exactamente la misma selección, sin avisar.
cfg$selector$n_aulas <- n_obj
ft <- cfg$selector$faculty_targets
base <- vapply(ft, function(x) as.numeric(x)[1], numeric(1))
extra <- n_obj - sum(base)
modo <- Sys.getenv("REPARTO", "proporcional")
# `extra != 0` NO basta como guarda: un reparto dirigido puede mantener el total
# —quitar de donde sobra y dar donde falta— y entonces extra es 0. La primera
# corrida de A4 salio identica a la linea base por esto.
if (extra != 0 || modo == "lista") {
  if (modo == "proporcional") {
    # Reparto de Hamilton: entero por proporción y los restos a los mayores.
    cuota <- base + extra * base / sum(base)
    nuevo <- floor(cuota)
    faltan <- as.integer(round(sum(cuota) - sum(nuevo)))
    if (faltan > 0) {
      resto <- cuota - nuevo
      for (k in order(resto, decreasing = TRUE)[seq_len(faltan)]) nuevo[k] <- nuevo[k] + 1L
    }
  } else {
    # `REPARTO=lista` con `EXTRA="facultad:n,facultad:n"`: donde el colchón es 0.
    nuevo <- base
    for (par in strsplit(Sys.getenv("EXTRA", ""), ",")[[1]]) {
      kv <- strsplit(trimws(par), ":")[[1]]
      if (length(kv) == 2 && kv[1] %in% names(nuevo)) nuevo[[kv[1]]] <- nuevo[[kv[1]]] + as.integer(kv[2])
    }
  }
  for (k in names(ft)) ft[[k]] <- as.integer(nuevo[[k]])
  cfg$selector$faculty_targets <- ft
  cat(sprintf("reparto %s: %.0f -> %d aulas\n", modo, sum(base), sum(unlist(ft))))
}

t0 <- Sys.time()
sel <- calc_muestra_aulas_seleccionar(frame, cfg)
secs <- round(as.numeric(difftime(Sys.time(), t0, units = "secs")), 1)

df <- sel$selection
tit <- df[df$sample_role == "titular", ]
res <- df[df$sample_role == "chain_reserve", ]
tit$rinde <- as.numeric(tit$eligible_n_neto) * as.numeric(tit$rendimiento_ref)
tit$fac <- norm(tit$faculty)

est <- st$calc_muestra_estudio$componentes[[1]]$marco$estratos
cu <- data.frame(
  lab = norm(vapply(est, function(e) as.character(e$label %||% e$id %||% ""), character(1))),
  cuota = vapply(est, function(e) as.numeric(e$cuota_fija %||% NA_real_), numeric(1)),
  stringsAsFactors = FALSE)
cu <- cu[!is.na(cu$cuota) & cu$cuota > 0, ]

cat(sprintf("=== N=%d · %s s · titulares %d · reservas %d ===\n", n_obj, secs, nrow(tit), nrow(res)))
cat(sprintf("esperadas %.0f | objetivo 2500 | margen %.0f | score %s\n",
            sum(tit$rinde), sum(tit$rinde) - 2500,
            as.character(round(as.numeric(sel$representativity_score %||% NA), 1))))
glob <- sum(cumsum(sort(tit$rinde, decreasing = TRUE)) <= (sum(tit$rinde) - 2500))
cat(sprintf("caidas que la cuota tolera, global: %d aulas (%.1f%%)\n\n", glob, 100 * glob / nrow(tit)))
sin <- 0; def <- 0
for (i in seq_len(nrow(cu))) {
  sub <- tit[tit$fac == cu$lab[i], ]; if (!nrow(sub)) next
  esp <- sum(sub$rinde); q <- cu$cuota[i]
  col <- if (esp < q) -1L else sum(cumsum(sort(sub$rinde, decreasing = TRUE)) <= (esp - q))
  if (esp < q) def <- def + 1 else if (col <= 0) sin <- sin + 1
  cat(sprintf("%-34s %3d %7.0f %6.0f %8s\n", substr(cu$lab[i], 1, 34), nrow(sub), esp, q,
              if (esp < q) sprintf("DEF %.0f", q - esp) else as.character(col)))
}
cat(sprintf("\nDEFICIT: %d | SIN MARGEN: %d\n", def, sin))
