# Aplica el reparto de 193 aulas al .pulso y guarda una copia nueva.
#
# Serie A del plan de ticks: 193 dirigidas es la unica configuracion medida con
# CERO deficit y CERO facultades sin margen, usando 7 aulas menos que 200
# proporcional. El reparto no es proporcional: quita donde sobra colchon (C&I,
# EE.GG. Ciencias) y da donde estaba en el limite.
#
#   SP=<dir> Rscript scripts/qa/aplicar-193.R
#
# NO pisa el .pulso de entrada: escribe `HSVG2026_193.pulso` al lado.
suppressMessages(pkgload::load_all("api", quiet = TRUE))
`%||%` <- function(a, b) if (is.null(a)) b else a

sp <- Sys.getenv("SP")
origen <- file.path(sp, Sys.getenv("PULSO", "HSVG2026_definitivo.pulso"))
destino <- file.path(sp, Sys.getenv("SALIDA", "HSVG2026_193.pulso"))

AJUSTES <- c(
  ciencias_e_ingenieria = -3L, estudios_generales_ciencias = -3L,
  derecho = 4L, gestion_y_alta_direccion = 2L, ciencias_contables = 1L,
  letras_y_ciencias_humanas = 1L, psicologia = 1L
)

tmp <- file.path(tempdir(), "aplicar193"); unlink(tmp, recursive = TRUE); dir.create(tmp)
utils::unzip(origen, exdir = tmp)
st <- readRDS(file.path(tmp, "state.rds"))

cfg <- st$calc_muestra_aulas_config
ft <- cfg$selector$faculty_targets
antes <- sum(vapply(ft, function(x) as.integer(x)[1], integer(1)))
for (k in names(AJUSTES)) {
  if (!k %in% names(ft)) stop("facultad desconocida en el reparto: ", k)
  ft[[k]] <- as.integer(ft[[k]]) + AJUSTES[[k]]
}
total <- sum(vapply(ft, function(x) as.integer(x)[1], integer(1)))
cat(sprintf("reparto: %d -> %d aulas\n", antes, total))
stopifnot(total == 193L)

cfg$selector$faculty_targets <- ft
cfg$selector$n_aulas <- 193L
st$calc_muestra_aulas_config <- cfg

t0 <- Sys.time()
sel <- calc_muestra_aulas_seleccionar(st$calc_muestra_aulas_frame, cfg)
cat(sprintf("sorteo: %.1f s · run_id %s\n",
            as.numeric(difftime(Sys.time(), t0, units = "secs")),
            as.character(sel$selection_run_id %||% "(sin id)")))

df <- sel$selection
cat(sprintf("titulares %d · reservas %d · extras %d\n",
            sum(df$sample_role == "titular"),
            sum(df$sample_role == "chain_reserve"),
            sum(df$sample_role == "extra_reserve_pool")))
stopifnot(sum(df$sample_role == "titular") == 193L)

st$calc_muestra_aulas_selection <- sel
# El plan de Monitoreo y el de recoleccion quedan del sorteo ANTERIOR a proposito:
# rehacerlos es una accion del usuario, y los avisos de desfase construidos en
# esta serie existen para que se vea que hay que hacerlo.
saveRDS(st, file.path(tmp, "state.rds"))

if (file.exists(destino)) unlink(destino)
wd <- setwd(tmp); on.exit(setwd(wd), add = TRUE)
utils::zip(destino, list.files(tmp, recursive = TRUE, all.files = TRUE), flags = "-q")
setwd(wd)
cat(sprintf("escrito: %s (%.1f MB)\n", destino, file.size(destino) / 1024^2))
