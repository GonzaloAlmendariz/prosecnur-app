#!/usr/bin/env Rscript
# =============================================================================
# Deriva una corrida de hsvg2026 con la selección de cursos-horario ya corrida
# =============================================================================
#
#   Rscript api/scripts/reference_project_seed_aulas_selection.R --project hsvg2026
#
# Por qué existe: `hsvg2026` trae el marco de 5.263 cursos-horario pero
# `calc_muestra_aulas_selection` vacío, así que Recopiladores —que lee la agenda
# desde esa selección— no se puede observar ni QA'ear poblado. Sin esto, los
# gates del plan de Recopiladores (docs/plan-recopiladores-2026-07.md §11.1) se
# verificarían contra una pantalla vacía, que es cómo un gate da verde por
# ausencia en vez de por conformidad.
#
# Por qué RECONSTRUYE el marco en vez de reusar el guardado: `project_pulso.R`
# borra `unique_student_ids` de `aula_frame` en TODO guardado, porque son PII.
# Sin esos ids no hay traslape que descontar, así que el descuento secuencial se
# apaga solo (`applied = FALSE`, `descuento_sin_ids`) y la corrida sale sin
# `discount_step` — es decir, sin el orden real del sorteo. El Relato de la
# selección (ADR 0067) narra ese orden paso a paso, y un `.pulso` derivado sin
# él manda al QA a verificar una escena hueca. La reconstrucción parte del
# workbook que sí viaja en `files/`, que es el mismo insumo del que la app
# construyó el marco la primera vez.
#
# Trampa medida: un fixture anonimizado ANTES de F111 trae las dimensiones
# categóricas destruidas (`Facultad` -> nombres de persona) mientras las
# categorías de la suite de criterios conservan los slugs reales. El marco se
# reconstruye con 0 filas elegibles y la corrida muere con "No hay aulas
# elegibles despues de filtros". No es un bug del motor: es el fixture. Se
# reconstruye el fixture con el anonimizador reparado, o se corre este script
# con `--fixture` apuntando al `.pulso` real.
#
# Por qué NO se hornea dentro del fixture: el fixture es un producto de build
# (`reference_project_build.R`) que parte del `.pulso` real y exige
# PROSECNUR_ANON_SALT. Mutarlo en sitio lo desincroniza de su `project_sha256` y
# el siguiente build lo regeneraría sin la selección, perdiendo el fixture en
# silencio. Derivarla es reproducible, no necesita la sal y no mete 8 MB de
# binario nuevo al repo en cada cambio.
#
# La selección es determinista: el motor siembra con `selector$seed` (20260619
# por defecto en este proyecto), así que dos corridas eligen los mismos
# cursos-horario. Lo único que cambia entre corridas es `selection_run_id`, que
# lleva un sello de reloj por diseño.
#
# Imprime en stdout la ruta del manifiesto, igual que
# `reference_project_prepare_run.R`, para que un Makefile la capture con `jq`.

script_path <- local({
  a <- commandArgs(trailingOnly = FALSE)
  hit <- a[startsWith(a, "--file=")]
  if (length(hit)) sub("--file=", "", hit[[1]]) else "api/scripts/reference_project_seed_aulas_selection.R"
})
repo_root <- normalizePath(file.path(dirname(script_path), "..", ".."), mustWork = FALSE)
api_dir <- file.path(repo_root, "api")
Sys.setenv(PULSO_REPO_ROOT = repo_root, PULSO_API_DIR = api_dir)
suppressMessages(pkgload::load_all(api_dir, quiet = TRUE))

args <- commandArgs(trailingOnly = TRUE)
arg_valor <- function(nombre, default = NULL) {
  eq <- paste0("--", nombre, "=")
  hit <- args[startsWith(args, eq)]
  if (length(hit)) return(sub(eq, "", hit[[1]], fixed = TRUE))
  idx <- match(paste0("--", nombre), args)
  if (!is.na(idx) && idx < length(args)) return(args[[idx + 1L]])
  default
}

slug <- arg_valor("project", "hsvg2026")
root <- arg_valor("root", file.path(repo_root, "outputs", "reference-runs"))
semilla <- arg_valor("seed", NULL)
# `--engine` existe para poder OBSERVAR las dos ramas del descuento, no para
# retocar el diseño del estudio. El modo no se elige: lo dicta el engine
# (.cm_descuento_mode_for_engine). cube/local_pivotal calibran sobre el set
# completo, así que su descuento solo puede auditarse post_hoc y `discount_step`
# sale constante; los secuenciales (sistematico_pps, estratificado_aleatorio,
# pool_controlado) sí registran el orden aula por aula. El Relato dibuja una
# escena distinta en cada caso, y con el engine real del estudio solo se puede
# QA'ear una de las dos.
engine <- arg_valor("engine", NULL)
# `--n-aulas` importa para el Relato más de lo que parece: el descuento cuenta
# los pasos DENTRO de cada estrato. Con 30 titulares sobre 30 estratos toca uno
# por estrato, así que `discount_step` vale 1 en todas las filas y la historia
# paso a paso queda degenerada aunque el motor sea secuencial y el descuento se
# haya aplicado. Recién con varios cursos-horario por estrato hay traslape que
# descontar y orden que contar.
n_aulas <- arg_valor("n-aulas", NULL)

fixture <- arg_valor("fixture", reference_project_path(slug))
if (!file.exists(fixture)) {
  stop(sprintf(
    "El fixture de '%s' no esta instalado: %s\nCorre: make reference-project-build REFERENCE_PROJECT=%s",
    slug, fixture, slug
  ), call. = FALSE)
}

sello <- format(Sys.time(), "%Y%m%d-%H%M%S")
run_dir <- file.path(root, sprintf("%s-aulas-sel-%s", slug, sello))
dir.create(run_dir, recursive = TRUE, showWarnings = FALSE)

# El fixture se instala 0444 a propósito. Se abre desde su ruta original —abrir
# no escribe— y lo que se graba es el `.pulso` derivado, dentro del run dir.
handle <- load_pulso(fixture)
sid <- handle$session_id
s <- session_get(sid)

frame <- s$calc_muestra_aulas_frame
if (is.null(frame)) {
  stop(sprintf(
    "'%s' no tiene marco de aulas (`calc_muestra_aulas_frame`); no hay nada que seleccionar.",
    slug
  ), call. = FALSE)
}

config <- calc_muestra_aulas_normalize_config(
  frame$config %||% s$calc_muestra_aulas_config %||% list()
)
if (!is.null(semilla)) {
  config$selector$seed <- as.integer(semilla)
}
if (!is.null(engine)) {
  config$selector$selector_engine <- engine
}
if (!is.null(n_aulas)) {
  config$selector$n_aulas <- as.integer(n_aulas)
}
if (!is.null(engine) || !is.null(n_aulas)) {
  config <- calc_muestra_aulas_normalize_config(config)
}

# ---------------------------------------------------------------------------
# Reconstrucción del marco: devolverle los ids de alumno que el guardado poda
# ---------------------------------------------------------------------------
tiene_ids <- function(f) {
  af <- f$aula_frame
  is.data.frame(af) && "unique_student_ids" %in% names(af) &&
    any(nzchar(as.character(af$unique_student_ids)))
}

# La hoja se elige por CONTENIDO, no por nombre: se busca la que trae las dos
# columnas que el mapeo declara imprescindibles (alumno y curso-horario). Los
# nombres de hoja cambian entre exports del mismo estudio; el mapeo no.
hoja_con <- function(path, columnas) {
  columnas <- Filter(function(c) length(c) && any(nzchar(as.character(c))), columnas)
  if (!length(columnas)) return(NA_character_)
  for (hoja in readxl::excel_sheets(path)) {
    # `n_max = 0` trae la cabecera como data.frame de cero filas, que es lo que
    # `.cm_aulas_col` sabe resolver (tolera acentos, mayúsculas y variantes).
    cabecera <- as.data.frame(
      readxl::read_excel(path, sheet = hoja, n_max = 0L),
      check.names = FALSE
    )
    if (!ncol(cabecera)) next
    if (all(vapply(columnas, function(c) nzchar(.cm_aulas_col(cabecera, c)), logical(1)))) {
      return(hoja)
    }
  }
  NA_character_
}

reconstruido <- FALSE
if (!tiene_ids(frame)) {
  data_files <- Filter(function(f) identical(f$kind, "data"), s$files)
  if (!length(data_files)) {
    stop(sprintf(
      paste0("'%s' no trae los ids de alumno en el marco y tampoco un archivo de datos ",
             "en `files/` para reconstruirlo. Sin ids no hay descuento secuencial."),
      slug
    ), call. = FALSE)
  }
  origen <- data_files[[1]]
  mapping <- config$mapping
  hoja_base <- hoja_con(origen$path, c(mapping$student_id, mapping$classroom_id))
  if (is.na(hoja_base)) {
    stop(sprintf(
      "Ninguna hoja de '%s' trae a la vez las columnas de alumno y curso-horario del mapeo.",
      origen$original_name
    ), call. = FALSE)
  }
  hoja_catalogo <- hoja_con(origen$path, c(mapping$classroom_id, mapping$teacher_type))
  if (identical(hoja_catalogo, hoja_base)) hoja_catalogo <- NA_character_

  message(sprintf("[seed] reconstruyendo el marco desde '%s' (hoja '%s'%s)",
                  origen$original_name, hoja_base,
                  if (is.na(hoja_catalogo)) "" else sprintf(" + catalogo '%s'", hoja_catalogo)))
  frame <- calc_muestra_aulas_construir(
    base_madre = .cm_aulas_read_table(origen$path, sheet = hoja_base),
    catalogo_curso_horario = if (is.na(hoja_catalogo)) NULL else
      .cm_aulas_read_table(origen$path, sheet = hoja_catalogo),
    config = config
  )
  # Mismo paso que corre el router tras construir: sin esto el marco no lleva la
  # capa de criterios y no es el que ve la app.
  frame <- .cm_criterios_frame_guardar(sid, frame, s$calc_muestra_referencia_asistencia)
  config <- calc_muestra_aulas_normalize_config(frame$config %||% config)
  reconstruido <- TRUE

  if (!tiene_ids(frame)) {
    # El mapeo puede estar PERFECTO y llegar aqui igual. En un proyecto de
    # referencia anonimizado los ids de alumno se subrogan: `unique_student_hash`
    # queda con contenido y `unique_student_ids` con cadenas vacias. Medido en
    # hsvg2026: la hoja trae 136.284 filas y 29.083 codigos distintos, el mapeo
    # los encuentra, y aun asi el marco sale sin ids — porque son PII y por eso
    # no viajan. Culpar al mapeo mandaba a revisar lo unico que estaba bien.
    hay_hash <- "unique_student_hash" %in% names(frame$aula_frame) &&
      any(nzchar(as.character(frame$aula_frame$unique_student_hash)))
    if (hay_hash) {
      stop(sprintf(paste0(
        "'%s' esta anonimizado: conserva el hash subrogado de alumno pero no sus ",
        "ids, que son PII y no viajan en un proyecto de referencia. El descuento ",
        "secuencial los necesita, asi que esta seleccion no se puede sembrar aqui. ",
        "El mapeo (`%s`) es correcto."), slug, mapping$student_id %||% "?"),
        call. = FALSE)
    }
    stop(sprintf(paste0(
      "El marco reconstruido de '%s' sigue sin ids de alumno y tampoco trae el ",
      "hash subrogado. Revisa `mapping$student_id` (ahora: `%s`) contra las ",
      "columnas de la hoja de matricula."), slug, mapping$student_id %||% "?"),
      call. = FALSE)
  }
}

t0 <- Sys.time()
selection <- calc_muestra_aulas_seleccionar(frame, config)
segundos <- round(as.numeric(difftime(Sys.time(), t0, units = "secs")), 2)

filas <- if (is.data.frame(selection$selection)) nrow(selection$selection) else length(selection$selection)
if (!isTRUE(filas > 0L)) {
  stop("La selección salió vacía; el fixture derivado no serviría de nada.", call. = FALSE)
}

# ---------------------------------------------------------------------------
# El descuento pedido tiene que haberse APLICADO
# ---------------------------------------------------------------------------
# Verde por conformidad, no por ausencia: el motor apaga el descuento con un
# warning y sigue, así que una corrida sin `discount_step` se ve exitosa y sale
# con filas > 0. Si el proyecto lo pidió y no se aplicó, este script tiene que
# gritar acá y no doce pasos después, en un QA que mira una escena vacía sin
# saber por qué. Cuando el proyecto NO lo pide, la ausencia es correcta y no
# hay nada que reclamar.
descuento <- selection$sequential_discount %||% list()
sel_df <- selection$selection
tiene_pasos <- is.data.frame(sel_df) && "discount_step" %in% names(sel_df) &&
  any(is.finite(suppressWarnings(as.numeric(sel_df$discount_step))))

if (isTRUE(descuento$requested) && !isTRUE(descuento$applied)) {
  stop(sprintf(
    paste0("El descuento secuencial se pidió pero NO se aplicó (mode=%s, code=%s).\n",
           "  %s\n",
           "  Sin descuento no hay `discount_step`, y el Relato de la selección se ",
           "queda sin el orden real del sorteo."),
    descuento$mode %||% "?", descuento$warning_code %||% "?",
    paste(unlist(descuento$warnings %||% list()), collapse = "\n  ")
  ), call. = FALSE)
}
if (isTRUE(descuento$applied) && !tiene_pasos) {
  stop("El descuento figura aplicado pero la selección no trae `discount_step`.",
       call. = FALSE)
}

# Las mismas claves que limpia `POST /api/calc-muestra/aulas/seleccionar`: una
# selección nueva invalida simulación de reemplazos y export previos.
session_set(sid, "calc_muestra_aulas_config", config)
session_set(sid, "calc_muestra_aulas_selection", selection)
session_set(sid, "calc_muestra_aulas_replacement_simulation", NULL)
session_set(sid, "calc_muestra_aulas_export", NULL)

destino <- file.path(run_dir, sprintf("%s-aulas-sel.pulso", slug))
# `invisible()` no es cosmético: stdout es el canal por el que este script
# devuelve la ruta del manifiesto, y `build_pulso` en top-level autoprintea su
# lista de retorno. Sin esto el consumidor recibe la lista antes de la ruta y
# `jq` revienta con "trailing garbage" — la misma trampa que documenta
# `reference_project_prepare_run.R` para `file.copy()`.
invisible(build_pulso(sid, destino, project_name = sprintf("%s (selección de aulas)", slug)))
Sys.chmod(destino, mode = "0644")

manifest <- list(
  schema = "prosecnur.reference_project_run.v1",
  slug = slug,
  derivacion = "aulas_selection",
  fixture = fixture,
  project_path = normalizePath(destino, mustWork = FALSE),
  fixture_sha256 = digest::digest(file = fixture, algo = "sha256"),
  aulas_selection = list(
    selection_run_id = selection$selection_run_id %||% NA_character_,
    selector_engine = config$selector$selector_engine %||% NA_character_,
    seed = config$selector$seed %||% NA_integer_,
    n_aulas = config$selector$n_aulas %||% NA_integer_,
    filas = filas,
    segundos = segundos
  ),
  # Lo que el QA necesita saber ANTES de mirar la pantalla: si el marco se
  # reconstruyó y si la corrida trae el orden real del sorteo.
  marco = list(
    reconstruido = reconstruido,
    aulas = if (is.data.frame(frame$aula_frame)) nrow(frame$aula_frame) else NA_integer_,
    con_ids_de_alumno = tiene_ids(frame)
  ),
  descuento_secuencial = list(
    requested = isTRUE(descuento$requested),
    applied = isTRUE(descuento$applied),
    mode = descuento$mode %||% NA_character_,
    pasos = if (tiene_pasos) {
      length(unique(stats::na.omit(suppressWarnings(as.numeric(sel_df$discount_step)))))
    } else 0L
  ),
  prepared_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")
)
manifest_path <- file.path(run_dir, "reference-run.json")
writeLines(jsonlite::toJSON(manifest, auto_unbox = TRUE, pretty = TRUE), manifest_path)

cat(manifest_path)
