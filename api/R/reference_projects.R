# =============================================================================
# Catálogo de proyectos de referencia — estudios reales anonimizados
# =============================================================================
#
# Hermano de `audit_projects.R`, con una diferencia que define todo lo demás:
# aquellos son proyectos SINTÉTICOS generados desde cero por la app; estos son
# estudios REALES que existieron, anonimizados para poder versionarlos.
#
# Los dos hacen falta y no se sustituyen:
#
#   - El sintético es reproducible, chico y determinista. Sirve de gate en CI.
#     Su límite es que solo contiene los casos que alguien pensó en construir.
#   - El real contiene la clase de estado que nadie diseña a propósito: la base
#     que llegó con 450 columnas, el repeat group con 667 filas hijas, el
#     proyecto guardado por una versión de la app de hace tres meses, la
#     columna llamada `col_7`. Ahí es donde la app se rompe de verdad.
#
# Las semillas sintéticas de `audit_projects.R` declaran en su `coverage` un
# `reduced_from` que apunta al estudio real del que se derivaron. Este catálogo
# es el otro extremo de esa referencia.
#
# Los `.pulso` de origen NO viven en el repo: son proyectos del cliente con
# datos personales. Se resuelven contra `PROSECNUR_REFERENCE_SOURCES` (por
# defecto ~/Documents/Pulso) y se convierten en fixture con
# `reference_project_build()`, que pasa por el anonimizador y por su gate.

REFERENCE_PROJECT_SCHEMA <- "prosecnur.reference_project.v1"
REFERENCE_PROJECT_MANIFEST_SCHEMA <- "prosecnur.reference_project_manifest.v1"

# Los módulos cuya cobertura se declara y se verifica. Es el vocabulario de la
# jerarquía de navegación, no una lista de archivos: lo que interesa saber de un
# fixture es a qué parte de la app le sirve de insumo.
REFERENCE_PROJECT_MODULOS <- c(
  "diseno_estudio",
  "calc_muestra",
  "editor_xlsform",
  "hojas_ruta",
  "monitoreo",
  "carga",
  "validacion",
  "codificacion",
  "analitica",
  "graficos",
  "dashboard"
)

.reference_project_catalog_list <- function() {
  list(
    acnur_pdm = list(
      slug = "acnur_pdm",
      title = "ACNUR PDM — Monitoreo post-distribución",
      family = "telefonico",
      origen = "ACNUR PDM/ACNUR_PDM.pulso",
      description = paste(
        "Multibase Kobo con repeat group real: base padre y `rep_servicios`",
        "unidas por `_parent_index`, con filtro de universo activo en ambas."
      ),
      # Lo que este fixture aporta y ningún otro cubre. Es el criterio para
      # decidir si vale la pena mantenerlo cuando envejezca.
      aporta = "repeat groups Kobo end-to-end y filtrado de universo por base",
      canonical_order = 1L
    ),
    acnur_acg = list(
      slug = "acnur_acg",
      title = "ACNUR ACG — Monitoreo territorial de acogida",
      family = "territorial",
      origen = "ACOGIDA ACNUR/ACNURCG.pulso",
      description = paste(
        "Territorial completo: hojas de ruta por distrito con piloto y campo,",
        "codificación aplicada, y analítica con secciones, cruces y dimensiones."
      ),
      aporta = "el único que recorre el pipeline entero hasta analítica con datos reales",
      canonical_order = 2L
    ),
    hsvg2026 = list(
      slug = "hsvg2026",
      title = "HSyVbG 2026 — Muestra de cursos-horario",
      family = "muestral",
      origen = "HSTVG2026/HSTVG26.pulso",
      description = paste(
        "Diseño muestral de aulas a escala real: marco de 29 mil estudiantes y",
        "5 mil cursos-horario, con criterios, particularidades y auditorías."
      ),
      aporta = "calc-muestra de aulas a escala real; ningún sintético llega a ese volumen",
      canonical_order = 3L
    ),
    acrconta = list(
      slug = "acrconta",
      title = "Acreditación Contabilidad — Multiactor",
      family = "acreditacion",
      origen = "pruebas-monitoreo/ACRDCONTA.pulso",
      # Este proyecto vivió partido en dos archivos: el monitoreo multiactor por
      # un lado y el procesamiento de la base .sav por otro. El fixture los
      # reúne en un solo ciclo, que es como el estudio debió verse.
      origen_secundario = "ACRD CONTA/CONTA_REPORTE.pulso",
      description = paste(
        "Acreditación multiactor con 13 fuentes y publicación a Sheets, más la",
        "base .sav del lado de procesamiento con sus mapas de códigos."
      ),
      aporta = "multiactor con Sheets, carga .sav e intake de hermanos independientes",
      canonical_order = 4L
    ),
    # Hermano del anterior y NO su reemplazo: `acrconta` cubre el monitoreo
    # multiactor con Sheets, que este no tiene; este aporta lo que ningún otro
    # fixture trae, que es un PLAN DE MAZO COMPLETO Y APROBADO por el cliente.
    # Hasta ahora las disposiciones, la geometría de barras y la guía de canvas
    # se probaban contra planes inventados; con esto se prueban contra el que
    # produjo el informe que se entregó.
    acrconta_mazo = list(
      slug = "acrconta_mazo",
      title = "Acreditación Contabilidad — Mazo entregado",
      family = "acreditacion",
      origen = "ACRD CONTA/v4_Conta 14-08 equivalencias.pulso",
      description = paste(
        "Estado del estudio en el momento de la entrega del 14-08-2026: las",
        "cuatro bases con su codificación aplicada, las equivalencias entre",
        "públicos y el plan de 67 láminas con el que se generó el informe",
        "aprobado."
      ),
      aporta = "plan de mazo completo y aprobado, 11 presets por tipo y cuatro bases codificadas",
      canonical_order = 5L
    )
  )
}

reference_project_catalog <- function() {
  items <- .reference_project_catalog_list()
  rows <- lapply(items, function(item) {
    data.frame(
      slug = item$slug,
      title = item$title,
      family = item$family,
      aporta = item$aporta,
      canonical_order = as.integer(item$canonical_order),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  })
  out <- do.call(rbind, rows)
  out[order(out$canonical_order), , drop = FALSE]
}

.reference_project_meta <- function(slug) {
  slug <- as.character(slug %||% "")
  item <- .reference_project_catalog_list()[[slug]]
  if (is.null(item)) {
    stop(sprintf("Proyecto de referencia desconocido: %s", slug), call. = FALSE)
  }
  item
}

# -----------------------------------------------------------------------------
# Rutas
# -----------------------------------------------------------------------------

reference_project_sources_root <- function() {
  root <- Sys.getenv("PROSECNUR_REFERENCE_SOURCES", "")
  if (nzchar(root)) return(normalizePath(root, mustWork = FALSE))
  normalizePath(file.path("~", "Documents", "Pulso"), mustWork = FALSE)
}

# Mismo patrón que `audit_reference_dir()`: cuando el paquete está instalado
# (app empaquetada) los fixtures viven en el directorio de instalación; en
# desarrollo hay que caer al inst/ del repo. Resolver solo por `.app_api_dir()`
# funciona en los scripts —que exportan PULSO_API_DIR— pero deja los fixtures
# invisibles bajo `pkgload::load_all`, que es como corre la suite de tests.
reference_project_install_dir <- function() {
  instalado <- system.file("reference_projects", package = "prosecnurapp")
  if (nzchar(instalado) && dir.exists(instalado)) return(instalado)
  file.path(normalizePath(file.path(.app_api_dir()), mustWork = FALSE),
            "inst", "reference_projects")
}

reference_project_path <- function(slug) {
  file.path(reference_project_install_dir(), slug, paste0(slug, ".pulso"))
}

reference_project_source_path <- function(slug, secundario = FALSE) {
  meta <- .reference_project_meta(slug)
  rel <- if (secundario) meta$origen_secundario else meta$origen
  if (is.null(rel)) return(NA_character_)
  file.path(reference_project_sources_root(), rel)
}

# -----------------------------------------------------------------------------
# Cobertura observada
# -----------------------------------------------------------------------------

# Calcula qué módulos están realmente poblados en un state.
#
# Se mira el state y no el `modules_summary` del manifest a propósito: ese campo
# es una declaración de la UI sobre en qué anda el analista, y miente por
# optimista — marca módulos como `ready` que están vacíos. Para decidir a qué
# sirve un fixture hace falta lo que hay, no lo que se anunció.
reference_project_cobertura <- function(s) {
  g <- function(k) {
    if (is.environment(s)) {
      if (exists(k, envir = s, inherits = FALSE)) get(k, envir = s) else NULL
    } else s[[k]]
  }
  lleno <- function(x) !is.null(x) && length(x) > 0

  bases <- (g("estudio") %||% list())$bases %||% list()
  alguna_base <- function(pred) {
    if (!length(bases)) return(FALSE)
    any(vapply(bases, function(b) isTRUE(tryCatch(pred(b), error = function(e) FALSE)),
               logical(1)))
  }
  codif <- g("codif_por_base") %||% list()

  c(
    diseno_estudio = lleno(g("plan_trabajo")) || lleno(g("diseno_estudio")),
    calc_muestra   = lleno(g("calc_muestra_estudio")) || lleno(g("calc_muestra_aulas_frame")),
    editor_xlsform = lleno(g("xlsform_forms")) || lleno(g("xlsform_state")),
    hojas_ruta     = lleno(g("hojas_ruta_config")),
    monitoreo      = lleno(g("monitoreo_snapshot")),
    carga          = length(bases) > 0,
    validacion     = alguna_base(function(b) lleno(b$validacion$plan_result)),
    codificacion   = length(codif) > 0 && any(vapply(codif, function(x) length(x) > 0, logical(1))),
    analitica      = lleno(g("analitica_config")),
    graficos       = lleno(g("graficos_config")),
    dashboard      = lleno(g("dashboard_source")) || lleno(g("dashboard_config"))
  )
}

.reference_project_leer_state <- function(path) {
  stage <- tempfile("ref-state-"); dir.create(stage, recursive = TRUE)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
  zip::unzip(path, files = "state.rds", exdir = stage)
  readRDS(file.path(stage, "state.rds"))
}

#' Cobertura de un fixture ya instalado, como data.frame legible.
reference_project_cobertura_tabla <- function(slug) {
  path <- reference_project_path(slug)
  if (!file.exists(path)) {
    stop(sprintf("El fixture no esta instalado: %s", path), call. = FALSE)
  }
  cob <- reference_project_cobertura(.reference_project_leer_state(path))
  data.frame(
    modulo = names(cob),
    cubierto = unname(cob),
    stringsAsFactors = FALSE
  )
}

#' Matriz de cobertura de todos los fixtures instalados.
reference_project_matriz_cobertura <- function() {
  slugs <- reference_project_catalog()$slug
  filas <- lapply(slugs, function(slug) {
    path <- reference_project_path(slug)
    if (!file.exists(path)) return(NULL)
    cob <- reference_project_cobertura(.reference_project_leer_state(path))
    data.frame(slug = slug, t(cob), stringsAsFactors = FALSE, check.names = FALSE)
  })
  filas <- Filter(Negate(is.null), filas)
  if (!length(filas)) {
    return(data.frame(slug = character(), stringsAsFactors = FALSE))
  }
  do.call(rbind, filas)
}

# -----------------------------------------------------------------------------
# Construcción del fixture
# -----------------------------------------------------------------------------

#' Convierte el .pulso real de un proyecto en el fixture versionable.
#'
#' Anonimiza, corre el gate de PII y escribe el manifest de procedencia. El
#' `.pulso` resultante queda read-only: un fixture que alguien reescribe por
#' accidente deja de ser un punto de comparación.
#' @param origen_declarado nombre del `.pulso` real, cuando `origen` es un
#'   temporal intermedio (el regrabado a la versión actual, o la fusión de dos
#'   mitades). Sin esto el manifest registraría la procedencia como
#'   `regrab-acnur_acg-a0aa4449.pulso`, que no dice de dónde salió el fixture.
reference_project_build <- function(slug, origen = NULL, sal = NULL, out_dir = NULL,
                                    origen_declarado = NULL) {
  meta <- .reference_project_meta(slug)
  origen <- origen %||% reference_project_source_path(slug)
  if (!file.exists(origen)) {
    stop(sprintf(
      "No encuentro el .pulso de origen de '%s': %s\nDefine PROSECNUR_REFERENCE_SOURCES o pasa --origen.",
      slug, origen
    ), call. = FALSE)
  }
  sal <- sal %||% Sys.getenv("PROSECNUR_ANON_SALT", "")
  if (!nzchar(sal)) {
    stop("Falta PROSECNUR_ANON_SALT: sin sal estable el fixture no es reproducible.",
         call. = FALSE)
  }

  out_dir <- out_dir %||% file.path(reference_project_install_dir(), slug)
  dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
  destino <- file.path(out_dir, paste0(slug, ".pulso"))
  if (file.exists(destino)) Sys.chmod(destino, mode = "0644")

  reporte <- pulso_anonimizar_archivo(origen, destino, sal = sal, slug = slug)

  hallazgos <- pulso_detectar_pii(destino)
  if (nrow(hallazgos)) {
    unlink(destino, force = TRUE)
    stop(sprintf(
      "El fixture '%s' quedo con %d hallazgos de PII; no se publica.\n%s",
      slug, nrow(hallazgos),
      paste(utils::capture.output(print(hallazgos)), collapse = "\n")
    ), call. = FALSE)
  }

  cobertura <- reference_project_cobertura(.reference_project_leer_state(destino))
  sha <- digest::digest(file = destino, algo = "sha256")

  manifest <- list(
    schema = REFERENCE_PROJECT_MANIFEST_SCHEMA,
    reference_project_schema = REFERENCE_PROJECT_SCHEMA,
    slug = slug,
    title = meta$title,
    family = meta$family,
    aporta = meta$aporta,
    description = meta$description,
    anonimizado = TRUE,
    origen_basename = basename(origen_declarado %||% origen),
    project_sha256 = sha,
    cobertura = as.list(cobertura),
    modulos_cubiertos = names(cobertura)[cobertura],
    canonical_flow = as.list(AUDIT_PROJECT_CANONICAL_FLOW),
    n_tablas_anonimizadas = reporte$n_tablas_tocadas,
    n_nombres_seudonimizados = reporte$n_nombres_seudonimizados
  )
  manifest_path <- file.path(out_dir, "reference-project.json")
  writeLines(jsonlite::toJSON(manifest, auto_unbox = TRUE, pretty = TRUE), manifest_path)

  Sys.chmod(destino, mode = "0444")

  list(
    ok = TRUE,
    slug = slug,
    project_path = destino,
    manifest_path = manifest_path,
    project_sha256 = sha,
    cobertura = cobertura,
    reporte_anonimizacion = reporte
  )
}

#' Verifica un fixture instalado: PII, cobertura declarada y hash.
#' Restablece el sello read-only del fixture.
#'
#' El build sella a 0444 al generar, pero git no versiona permisos: en un clon
#' —o en CI— el fixture reaparece como 0644 y deja de estar protegido contra
#' una escritura en sitio, que es justo lo que se pierde en silencio porque
#' regenerarlo exige la sal. Sellar aqui vuelve el invariante independiente de
#' la maquina en vez de depender de un chmod que alguien hizo una vez.
.reference_project_sellar <- function(path) {
  if (!file.exists(path)) return(invisible(FALSE))
  modo <- as.character(file.info(path)$mode)
  if (grepl("4[04]4$", modo)) return(invisible(TRUE))
  Sys.chmod(path, mode = "0444")
  invisible(grepl("4[04]4$", as.character(file.info(path)$mode)))
}

reference_project_verify <- function(slug) {
  path <- reference_project_path(slug)
  manifest_path <- file.path(dirname(path), "reference-project.json")
  problemas <- character()

  if (!file.exists(path)) {
    return(list(ok = FALSE, slug = slug,
                problemas = sprintf("Fixture ausente: %s", path)))
  }

  .reference_project_sellar(path)
  if (!file.exists(manifest_path)) {
    problemas <- c(problemas, "Falta reference-project.json")
  }

  hallazgos <- pulso_detectar_pii(path)
  if (nrow(hallazgos)) {
    problemas <- c(problemas, sprintf("PII detectable: %d hallazgos", nrow(hallazgos)))
  }

  if (file.exists(manifest_path)) {
    manifest <- jsonlite::fromJSON(manifest_path, simplifyVector = FALSE)
    sha <- digest::digest(file = path, algo = "sha256")
    if (!identical(sha, manifest$project_sha256 %||% "")) {
      problemas <- c(problemas, "El sha256 no coincide con el manifest (fixture modificado)")
    }
    cob <- reference_project_cobertura(.reference_project_leer_state(path))
    declarados <- unlist(manifest$modulos_cubiertos %||% list())
    faltantes <- setdiff(declarados, names(cob)[cob])
    if (length(faltantes)) {
      problemas <- c(problemas, sprintf(
        "Modulos declarados pero vacios: %s", paste(faltantes, collapse = ", ")
      ))
    }
  }

  list(ok = !length(problemas), slug = slug, problemas = problemas,
       hallazgos_pii = hallazgos)
}
