#!/usr/bin/env Rscript
# ---------------------------------------------------------------------------
# Instrumento de QA del loop de superficie de Cálculo de muestra.
#
# Deriva un `.pulso` sembrado a partir de una corrida del proyecto de referencia
# `hsvg2026`, con el payload analítico que la radiografía por facultad necesita
# (`criterios_radiografia`, `criterios_cascada`, `alumnos_por_ch`, anclas).
#
# POR QUÉ EXISTE
# Ningún `.pulso` del repo traía `criterios_radiografia`, así que las superficies
# de criterios sólo se podían auditar vacías —y auditar sobre pantallas vacías no
# es auditar—. Este script reconstruye el estado necesario de forma reproducible;
# antes vivía suelto en un scratchpad y se perdía al cerrar la sesión.
#
# QUÉ NO CERTIFICA
# Ni las cifras canónicas del estudio ni las etiquetas de facultad: la base viene
# anonimizada y sus facultades son seudónimos. Sirve para juzgar SUPERFICIE
# (orden, hueco, grano, vocabulario), no para leer resultados del estudio real.
#
# LÍMITE CONOCIDO, HEREDADO DEL ANONIMIZADOR
# `pulso_anonimizar.R` reescribe la facultad del alumno en la base pero deja los
# slugs reales en `criterios_seleccion`, así que ninguna fila casa y el marco da
# 0 elegibles. Aquí se libera ese criterio —los otros cuatro quedan intactos— y
# queda anotado en el manifiesto. La reparación de fondo es del anonimizador:
# base, config, catálogo y componentes tienen que reescribirse juntos.
#
# USO
#   Rscript api/scripts/qa_seed_calc_muestra_radiografia.R <origen.pulso> <destino.pulso>
# ---------------------------------------------------------------------------

suppressMessages(pkgload::load_all("api", quiet = TRUE))

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2L) {
  stop("uso: qa_seed_calc_muestra_radiografia.R <origen.pulso> <destino.pulso>", call. = FALSE)
}
src <- normalizePath(args[[1]], mustWork = TRUE)
out <- args[[2]]

work <- file.path(tempdir(), "qa-seed-calc-muestra")
unlink(work, recursive = TRUE)
dir.create(work, recursive = TRUE)
utils::unzip(src, exdir = work)

st <- readRDS(file.path(work, "state.rds"))
cfg <- calc_muestra_aulas_normalize_config(st$calc_muestra_aulas_config)

# 1 · Liberar el criterio de facultad (ver «límite conocido» arriba).
liberadas <- length(cfg$criterios_seleccion$byVariable$faculty$categories)
cfg$criterios_seleccion$byVariable$faculty$categories <- character(0)
cat("== facultad: se liberan", liberadas, "categorías que la base anonimizada no puede casar\n")

# 2 · Reconstruir el marco desde la base madre.
xlsx <- list.files(file.path(work, "files"), pattern = "BD estudiantes", full.names = TRUE)[1]
if (is.na(xlsx)) stop("no se encontró la base de estudiantes en files/", call. = FALSE)
raw <- as.data.frame(readxl::read_excel(xlsx, sheet = 1, col_types = "text"), stringsAsFactors = FALSE)
cat("== base leída:", nrow(raw), "filas\n")

frame <- calc_muestra_aulas_construir(base_madre = raw, config = cfg)
frame <- .cm_criterios_frame_publico(frame, st$calc_muestra_referencia_asistencia)$frame

for (campo in c("criterios_radiografia", "criterios_cascada", "alumnos_por_ch", "criterios_totales")) {
  cat(sprintf("  %-24s %s\n", campo, !is.null(frame[[campo]])))
}

st$calc_muestra_aulas_frame <- frame
st$calc_muestra_aulas_config <- frame$config

# 3 · Reconstruir los estratos del diseño desde el marco.
#
# El N del diseño son alumnos ÚNICOS elegibles por facultad, que es el grano del
# cruce facultad × sexo del marco. `elegibles_total` de la exploración son
# MATRÍCULAS: usarlo infla el N y descuadra la cabecera. Esa confusión de grano
# es justo la que el módulo existe para evitar, así que el instrumento no la
# reproduce.
cruce <- frame$population_cross_profiles
sexo_por_fac <- list()
if (is.data.frame(cruce) && nrow(cruce)) {
  sub <- cruce[cruce$primary_role == "faculty" & cruce$secondary_role == "sex", , drop = FALSE]
  for (i in seq_len(nrow(sub))) {
    k <- as.character(sub$primary_raw[i])
    s <- toupper(substr(as.character(sub$secondary_raw[i]), 1, 1))
    n <- suppressWarnings(as.numeric(sub$count[i]))
    if (!is.finite(n)) n <- 0
    prev <- sexo_por_fac[[k]] %||% c(M = 0, F = 0)
    if (s %in% c("M", "H")) prev[["M"]] <- prev[["M"]] + n else if (s == "F") prev[["F"]] <- prev[["F"]] + n
    sexo_por_fac[[k]] <- prev
  }
}

plantilla <- st$calc_muestra_estudio$componentes[[1]]$marco$estratos[[1]]
ex <- frame$exploracion$por_facultad
estratos <- lapply(seq_along(ex), function(i) {
  f <- ex[[i]]
  sx <- sexo_por_fac[[f$facultad]]
  if (!is.null(sx) && sum(sx) > 0) {
    na <- round(sx[["M"]]); nb <- round(sx[["F"]]); n <- na + nb
  } else {
    n <- suppressWarnings(as.numeric(f$elegibles_total))
    if (!is.finite(n)) n <- 0
    na <- floor(n / 2); nb <- n - na
  }
  e <- plantilla
  e$id <- paste0("fac_", i)
  e$label <- f$facultad
  e$N <- as.integer(round(n)); e$N_a <- as.integer(na); e$N_b <- as.integer(nb)
  e
})
# Una facultad sin CH elegibles no aporta unidades y sí bloquea la confirmación
# de Alumnos por CH: se excluye del diseño, no se arrastra con N = 0.
estratos <- Filter(function(e) e$N > 0, estratos)

for (i in seq_along(st$calc_muestra_estudio$componentes)) {
  st$calc_muestra_estudio$componentes[[i]]$marco$estratos <- estratos
  st$calc_muestra_estudio$componentes[[i]]$resultado <- NULL
}
cat("== estratos:", length(estratos), "· suma N:", sum(vapply(estratos, function(e) e$N, 0L)), "\n")

saveRDS(st, file.path(work, "state.rds"))

# 4 · Manifiesto que declara qué es y qué no certifica.
mf <- file.path(work, "manifest.json")
man <- jsonlite::fromJSON(mf, simplifyVector = FALSE)
man$project_name <- tools::file_path_sans_ext(basename(out))
man$saved_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
man$seed_instrumento <- list(
  proposito = "instrumento de QA de superficie: radiografía por facultad con datos reales",
  derivado_de = basename(src),
  reparacion = "criterio de facultad liberado; la base anonimizada no puede casar los slugs reales",
  no_certifica = "cifras canónicas del estudio ni etiquetas de facultad (son seudónimos)"
)
writeLines(jsonlite::toJSON(man, auto_unbox = TRUE, pretty = TRUE), mf)

unlink(out)
old <- setwd(work)
utils::zip(normalizePath(out, mustWork = FALSE), files = c("manifest.json", "state.rds", "files"), flags = "-rq")
setwd(old)
cat("== instrumento escrito:", out, "|", round(file.size(out) / 1024^2, 1), "MB\n")
