# Un `.pulso` de demostración donde cada facultad rinde distinto.
#
# Un corte real sirve para enseñar el módulo, pero no para enseñar sus DECISIONES:
# si todas las facultades van parecido, la pestaña de Efectividad no muestra los
# tres casos que el operativo tiene que saber distinguir. Este guion los reparte
# sobre datos reales, sin inventar respuestas.
#
#   BASE=/ruta/corte.pulso \
#   ESTUDIO=/ruta/con_calc_muestra.pulso \
#   SALIDA=~/Desktop/demo.pulso \
#   FACTORES='list("ESTUDIOS GENERALES LETRAS"=0.72, "DERECHO"=1.12)' \
#   Rscript api/scripts/sim_aulas_campo_por_facultad.R
#
# Sin red y sin escribir en el proyecto de origen.
#
# ## Qué hace, y por qué hacen falta las dos entradas
#
# 1. **Publica las metas del diseño.** Un proyecto cuyo plan entró por libro no
#    las trae, y entonces `tau_previsto` es NA en todas las facultades: la
#    pestaña que existe para comparar diseño contra campo se queda sin contra
#    qué. Salen del estudio de calc-muestra (`ESTUDIO`), que puede ser otro
#    `.pulso`, y se sellan con el `selection_run_id` / `frame_hash` de la
#    selección real. El sello no se inventa: se comprueba que los códigos de esa
#    selección estén en el plan de `BASE`.
#
# 2. **Reescala las respuestas de cada aula** por un factor de su facultad.
#    Quitar baja la tasa; duplicar una respuesta de la MISMA aula la sube
#    conservando su perfil. El recorte es consistente dentro de la facultad, así
#    que baja τ sin inflar la dispersión entre aulas, que es lo que la banda mide.
#
# ## Las dos trampas que costaron dos intentos
#
# - **El parte de campo se reescala con las respuestas, y vive en DOS sitios.**
#   La app lee `monitoreo_config$aulas_universitarias$partes_campo`, no el del
#   nivel superior. Sin tocarlo, «El parte contra la plataforma» pasaba de 92
#   descuadres a 98 con las diez peores TODAS de la facultad simulada peor:
#   parece un problema de datos de esa facultad y es artefacto del guion.
# - **`asistentes` NO se toca.** La historia es que respondieron menos, no que
#   fuera menos gente, y eso es justo lo que hace bajar la tasa.
#
# El mapeo respuesta a aula es por `classroom_id`; `collector_id` viene vacío.

suppressMessages(pkgload::load_all("api", quiet = TRUE))

.arg <- function(nombre, obligatorio = TRUE) {
  v <- Sys.getenv(nombre, "")
  if (!nzchar(v) && obligatorio) stop(sprintf("Falta %s. Ver la cabecera del guion.", nombre))
  v
}

base_pulso <- .arg("BASE")
estudio_pulso <- .arg("ESTUDIO")
salida <- .arg("SALIDA")
factores <- eval(parse(text = Sys.getenv("FACTORES", "list()")))

.abrir <- function(pulso) {
  d <- tempfile("sim-aulas-")
  dir.create(d, recursive = TRUE)
  utils::unzip(pulso, exdir = d)
  list(dir = d, state = readRDS(file.path(d, "state.rds")))
}

cat("Abriendo el corte y el estudio...\n")
b <- .abrir(base_pulso)
st <- b$state
es <- .abrir(estudio_pulso)$state

# --- 1. Las metas del diseño, con su sello -----------------------------------

plan <- st$monitoreo_config$aulas_universitarias$plan
plan_df <- prosecnurapp:::.monitoreo_aulas_df(monitoreo_aulas_normalize_plan(plan), "plan")
metas <- prosecnurapp:::.monitoreo_aulas_metas_diseno(
  es$calc_muestra_estudio, plan_df, es$calc_muestra_aulas_selection
)
if (!length(metas$facultades %||% list())) {
  stop("El estudio no publica metas del diseno: sin ellas tau_previsto queda en NA.")
}

sel <- es$calc_muestra_aulas_selection
run <- as.character(sel$selection_run_id)[1]
hash <- as.character(sel$frame_hash)[1]

# EL SELLO SE COMPRUEBA, NO SE ESTAMPA. Decir «vigente» sin que el plan venga de
# esa seleccion seria falsear justo el campo que existe para detectar el desfase.
cods_sel <- unique(as.character(sel$selection$operational_code))
cods_plan <- unique(vapply(plan, function(u) as.character(u$operational_code %||% "")[1], character(1)))
fuera <- setdiff(cods_sel, cods_plan)
if (length(fuera)) {
  stop(sprintf("%d codigos de la seleccion no estan en el plan: el sello no seria legitimo.",
               length(fuera)))
}
cat(sprintf("  sello verificado: %d de %d codigos de la seleccion estan en el plan\n",
            length(cods_sel), length(cods_sel)))

metas$selection_run_id <- run
metas$frame_hash <- hash
st$monitoreo_config$selection_run_id <- run
st$monitoreo_config$frame_hash <- hash
# EL CONFIG VIVE EN DOS SITIOS, igual que el parte, y el motor lee el de DENTRO:
# `router_monitoreo.R:1107` hace `aulas_cfg <- cfg$aulas_universitarias`. Escribir
# solo el de la raiz deja la pantalla igual y parece que el cambio no llego.
st$monitoreo_config$design_targets <- metas
st$monitoreo_config$aulas_universitarias$design_targets <- metas
st$monitoreo_config$aulas_universitarias$selection_run_id <- run
st$monitoreo_config$aulas_universitarias$frame_hash <- hash
vig <- prosecnurapp:::.monitoreo_aulas_avance_vigencia(st$monitoreo_config)
cat(sprintf("  vigencia: %s (%d facultades)\n", vig$vigencia, length(vig$facultades)))

# --- 2. El campo, reescalado por facultad ------------------------------------

sn <- st$monitoreo_snapshot$data
fac_de_aula <- new.env(parent = emptyenv())
for (u in plan) {
  cid <- as.character(u$classroom_id %||% "")[1]
  fac <- as.character(u$faculty %||% "")[1]
  if (!nzchar(fac)) fac <- as.character(u$facultad %||% "")[1]
  if (nzchar(cid)) assign(cid, fac, envir = fac_de_aula)
}
fac_fila <- unlist(mget(as.character(sn$collectorID), envir = fac_de_aula,
                        ifnotfound = list(NA_character_)), use.names = FALSE)

set.seed(2026)
fuera_idx <- integer(0)
extra <- list()
for (fac in names(factores)) {
  f <- factores[[fac]]
  idx <- which(!is.na(fac_fila) & toupper(fac_fila) == toupper(fac))
  if (!length(idx)) { cat(sprintf("  (sin filas) %s\n", fac)); next }
  for (cid in unique(sn$collectorID[idx])) {
    filas <- idx[sn$collectorID[idx] == cid]
    n <- length(filas); objetivo <- round(n * f)
    if (objetivo < n) {
      fuera_idx <- c(fuera_idx, sample(filas, n - objetivo))
    } else if (objetivo > n) {
      rep_idx <- sample(filas, objetivo - n, replace = TRUE)
      nuevas <- sn[rep_idx, , drop = FALSE]
      nuevas$`_id` <- paste0(nuevas$`_id`, "-sim", seq_len(nrow(nuevas)))
      extra[[length(extra) + 1L]] <- nuevas
    }
  }
  cat(sprintf("  %-34s x%.2f\n", fac, f))
}
out <- sn[setdiff(seq_len(nrow(sn)), fuera_idx), , drop = FALSE]
if (length(extra)) out <- rbind(out, do.call(rbind, extra))
cat(sprintf("  respuestas: %d -> %d\n", nrow(sn), nrow(out)))
st$monitoreo_snapshot$data <- out

# El parte, en sus DOS copias. Ver la cabecera.
conteo <- table(as.character(out$collectorID))
reescala <- function(p) {
  k <- as.character(p$classroom_id)[1]
  if (!nzchar(k) || !(k %in% names(conteo))) return(p)
  nuevas <- as.integer(conteo[[k]])
  antes <- suppressWarnings(as.integer(p$validas %||% NA))
  if (!is.na(antes) && antes > 0L) {
    env <- suppressWarnings(as.integer(p$enviadas %||% NA))
    if (!is.na(env)) p$enviadas <- max(nuevas, as.integer(round(env * nuevas / antes)))
  }
  p$validas <- nuevas
  p
}
st$monitoreo_aulas_partes_campo <- lapply(st$monitoreo_aulas_partes_campo, reescala)
st$monitoreo_config$aulas_universitarias$partes_campo <-
  lapply(st$monitoreo_config$aulas_universitarias$partes_campo, reescala)

descuadre <- sum(vapply(st$monitoreo_config$aulas_universitarias$partes_campo, function(p) {
  k <- as.character(p$classroom_id)[1]
  v <- suppressWarnings(as.numeric(p$validas %||% NA))
  pl <- if (k %in% names(conteo)) as.numeric(conteo[[k]]) else 0
  if (is.finite(v) && abs(v - pl) > 0) 1 else 0
}, numeric(1)))
cat(sprintf("  partes que descuadran tras reescalar: %d (tiene que ser 0)\n", descuadre))
if (descuadre > 0) stop("El parte quedo desincronizado: revisa el mapeo por classroom_id.")

# --- 3. El reparto que sale, y el paquete ------------------------------------

d <- monitoreo_aulas_dashboard(st$monitoreo_config$aulas_universitarias$plan,
                               out, st$monitoreo_config)
senales <- table(vapply(d$efectividad_seguimiento$facultades,
                        function(f) as.character(f$senal %||% "")[1], character(1)))
cat("\nReparto de senales por facultad:\n")
print(senales)
if (!all(c("bajo", "sobre") %in% names(senales))) {
  cat("\nAVISO: no salen los tres casos. Ajusta FACTORES y vuelve a correr.\n")
}

# Los caches derivables no viajan con datos que ya no valen.
for (k in c("monitoreo_dashboard_cache", "monitoreo_dashboard_cache_token",
            "monitoreo_dashboard_light_cache", "monitoreo_dashboard_light_cache_token")) {
  st[[k]] <- NULL
}
saveRDS(st, file.path(b$dir, "state.rds"))
mf <- jsonlite::fromJSON(file.path(b$dir, "manifest.json"), simplifyVector = FALSE)
mf$project_name <- Sys.getenv("NOMBRE", "Simulacion de campo por facultad")
writeLines(jsonlite::toJSON(mf, auto_unbox = TRUE, pretty = TRUE),
           file.path(b$dir, "manifest.json"))

# El `.pulso` es un zip con los dos archivos EN LA RAIZ, asi que se comprime
# desde el directorio. La alternativa con `-j` no vale: el `zip` de macOS no
# acepta el `-C` que haria falta para acompanarla, y deja un error en la salida
# de un guion que otro va a correr.
salida <- path.expand(salida)
if (file.exists(salida)) unlink(salida)
local({
  wd <- setwd(b$dir); on.exit(setwd(wd), add = TRUE)
  utils::zip(salida, files = c("manifest.json", "state.rds"), flags = "-q")
})
if (!file.exists(salida)) stop("No se pudo escribir el .pulso en ", salida)
cat(sprintf("\nListo: %s (%.1f MB)\n", salida, file.info(salida)$size / 1e6))
