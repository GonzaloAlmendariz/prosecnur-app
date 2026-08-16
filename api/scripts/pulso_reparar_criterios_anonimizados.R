#!/usr/bin/env Rscript
# =============================================================================
# Reparar los criterios de un .pulso anonimizado
# =============================================================================
#
# El anonimizador reescribe los VALORES de la base (una facultad pasa a ser un
# nombre de persona) pero no toca el marco ya construido que el proyecto lleva
# guardado. El resultado es un `.pulso` inconsistente consigo mismo: sus
# criterios siguen nombrando categorías del vocabulario original, que en su
# propia base ya no existen.
#
# Medido en `hsvg2026` el 2026-08-15: el criterio `faculty` pedía 15 facultades
# PUCP (`ciencias_e_ingenieria`, `derecho`, `psicologia`…) y la base traía
# «Ricardo Ricardo Karina», «Karina E Karina», «Andres». Ninguna casaba, así que
# el criterio dejaba pasar **0 filas** y el marco reconstruido salía con 0
# elegibles y 136.284 exclusiones — el hallazgo A1, que llevaba desde el
# 2026-08-02 tomándose por un defecto del motor.
#
# Lo que este script NO hace: adivinar qué facultad real es cada nombre de
# persona. Esa correspondencia se perdió al anonimizar y reinventarla sería peor
# que el defecto — un fixture que miente sobre a quién representa cada celda.
#
# Lo que SÍ hace: preservar la INTENCIÓN del criterio. Si pedía «todas las
# unidades académicas menos posgrado, estudios especiales y el consorcio», eso
# es lo que se reescribe sobre el vocabulario de la base. Las categorías que el
# anonimizador dejó legibles —las que llevan palabras genéricas como POSGRADO o
# CONSORCIO— son las que permiten sostener la exclusión.
#
# Uso:
#   Rscript api/scripts/pulso_reparar_criterios_anonimizados.R <entrada.pulso> [salida.pulso]
#
# Sin salida, reescribe la entrada. Trabaja sobre copias: no apuntes esto a un
# fixture canónico versionado sin decidir antes que quieres regenerarlo.

suppressMessages(pkgload::load_all("api", quiet = TRUE))

args <- commandArgs(trailingOnly = TRUE)
if (!length(args)) stop("Uso: pulso_reparar_criterios_anonimizados.R <entrada.pulso> [salida.pulso]")
entrada <- normalizePath(args[[1]], mustWork = TRUE)
salida <- if (length(args) >= 2L) args[[2]] else entrada

# Categorías que se excluyen del marco de pregrado. Se reconocen por palabra
# genérica porque el anonimizador sólo sustituye nombres propios: «Nestor DE
# POSGRADO» conserva POSGRADO, y «CONSORCIO DE UNIVERSIDADES» queda intacto.
PATRONES_FUERA <- c("posgrado", "consorcio", "estudios_especiales")

es_excluida <- function(text_key) {
  any(vapply(PATRONES_FUERA, function(p) grepl(p, text_key, fixed = TRUE), logical(1)))
}

cat("== abriendo", basename(entrada), "==\n")
r <- load_pulso(entrada)
sid <- r$session_id
s <- session_get(sid)

frame <- s$calc_muestra_aulas_frame
if (is.null(frame)) stop("El proyecto no trae marco de aulas construido; nada que reparar.")

sel <- frame$criterios_seleccion
by <- sel$byVariable %||% list()
crit <- by$faculty
if (is.null(crit)) stop("El marco no trae criterio `faculty`; nada que reparar.")

pedidas <- unlist(crit$categories %||% list())
cat("criterio actual:", length(pedidas), "categorías\n")

# El contraste NO se hace contra el catálogo del marco: ese catálogo se generó
# junto con el criterio, antes de anonimizar, así que ambos hablan el mismo
# vocabulario viejo y compararlos siempre da «todo en orden». El único juez es
# la BASE, que es lo que el motor leerá al reconstruir.
bind <- NULL
# El workspace vive dentro del estudio; la clave suelta existe en sesiones
# vivas pero no en el estado que persiste el .pulso.
ws <- s$calc_muestra_workspace %||% s$calc_muestra_estudio$workspace %||% list()
for (b in ws$source_bindings %||% list()) {
  if (identical(b$role, "estudiantes") || identical(b$role, "base_madre")) bind <- b
}
if (is.null(bind)) stop("No hay binding de estudiantes/base_madre para leer el vocabulario vigente.")
meta <- s$files[[bind$file_id]]
tabla <- .cm_aulas_read_table(meta$path, sheet = bind$sheet_name)

col_fac <- tabla[["Facultad"]] %||% NULL
if (is.null(col_fac)) {
  mapping <- (ws$aulas_config %||% list())$mapping %||% list()
  col_fac <- .cm_aulas_col(tabla, mapping$faculty)
}
if (is.null(col_fac)) stop("No se encontró la columna de facultad en la base.")

vigentes <- unique(.cm_aulas_text_key(trimws(as.character(col_fac))))
vigentes <- vigentes[nzchar(vigentes)]
cat("vocabulario vigente en la base:", length(vigentes), "categorías\n")

huerfanas <- setdiff(pedidas, vigentes)
cat("categorías del criterio que la base ya no tiene:", length(huerfanas),
    "de", length(pedidas), "\n")
if (!length(huerfanas)) {
  cat("\nEl criterio ya habla el vocabulario de su base; no hay nada que reparar.\n")
  quit(status = 0)
}
if (length(huerfanas) == length(pedidas)) {
  cat("  (TODAS: el criterio no puede dejar pasar una sola fila)\n")
}

nuevas <- sort(vigentes[!vapply(vigentes, es_excluida, logical(1))])
fuera <- sort(setdiff(vigentes, nuevas))

cat("\n== reparación ==\n")
cat("  se incluyen:", length(nuevas), "\n")
cat("  se excluyen:", length(fuera), "->", paste(fuera, collapse = ", "), "\n")

by$faculty$categories <- as.list(nuevas)
sel$byVariable <- by
frame$criterios_seleccion <- sel
s$calc_muestra_aulas_frame <- frame
session_set(sid, "calc_muestra_aulas_frame", frame)

# El workspace es de donde el frontend hidrata su borrador: si sólo se repara el
# frame, la próxima construcción vuelve a mandar el criterio viejo.
ac <- ws$aulas_config %||% list()
acs <- ac$criterios_seleccion %||% list()
acbv <- acs$byVariable %||% list()
if (is.null(acbv$faculty)) acbv$faculty <- by$faculty else acbv$faculty$categories <- as.list(nuevas)
acs$byVariable <- acbv
ac$criterios_seleccion <- acs
ws$aulas_config <- ac
if (!is.null(s$calc_muestra_workspace)) {
  session_set(sid, "calc_muestra_workspace", ws)
} else {
  est <- s$calc_muestra_estudio %||% list()
  est$workspace <- ws
  session_set(sid, "calc_muestra_estudio", est)
}

build_pulso(sid, salida, project_name = tools::file_path_sans_ext(basename(salida)))
cat("\nescrito:", salida, "\n")
