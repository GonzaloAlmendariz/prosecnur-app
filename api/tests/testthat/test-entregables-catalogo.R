# ADR 0133 §2 — Un catálogo.
#
# `entregables_catalogo()` declara, por `kind`, el rótulo, el módulo (una de las ocho carpetas del
# §4), si el nombre lleva la base (`por_base`) y si se guarda junto al proyecto (`guardar`). Un kind
# LITERAL que se pase al registro sin entrada en el catálogo es un error de contrato: lo vigila este
# test recorriendo todo api/R (por eso está entre los TRANSVERSALES de scripts/gate-area.R: se rompe
# desde cualquier archivo que registre un entregable nuevo).
#
# El detector lee el AST y resuelve el argumento `kind` con `match.call()` contra la firma de cada
# registrador, así ve llamadas partidas en varias líneas, por nombre o por posición, y las ramas
# literales de un `if`. No ve kinds armados con `paste0()` ni leídos de una tabla (`spec$kind`):
# para esos rige la lista del censo de descargas (2026-11-07), fijada abajo.

.MODULOS_ADR_0133 <- c("Cálculo de muestra", "Formularios", "Hojas de ruta", "Material de campo",
                       "Monitoreo", "Procesamiento", "Dashboard", "Proyecto")

# Kinds registrados según el censo (docs/qa/censo-descargas-2026-11-07/backend.json, campo `registro`),
# con los de la fase 5: asignación por UMP y por cuotas, ficha de reemplazo, manifiesto de SurveyMonkey
# y la plantilla y los códigos de encuestadores, que antes se registraban como insumos.
.KINDS_CENSO <- c(
  "asignacion_encuestadores_cuotas", "asignacion_encuestadores_ump", "aulas_asignacion_plantilla", "aulas_disponibilidad_plantilla", "aulas_libro",
  "aulas_libro_plantilla", "base_panel", "base_panel_auditoria", "base_panel_cruces", "base_panel_frecuencias",
  "base_panel_libro_codigos", "base_panel_sav", "base_panel_sav_bundle", "base_panel_wide", "bases_csv",
  "bases_csv_zip", "bases_data", "bases_data_codificada", "bases_data_zip", "bases_instrumento",
  "bases_instrumento_codificado", "bases_instrumento_zip", "bases_sav", "bases_sav_bundle", "bases_script_r",
  "bases_script_r_zip", "bases_unificadas", "bases_xlsx", "bases_xlsx_relacional", "bases_xlsx_zip",
  "calc_muestra_aulas_seleccion", "calc_muestra_general_sorteo", "calc_muestra_solicitud_dti", "codebook",
  "codebook_pdf", "codebook_pdf_zip", "codebook_zip", "codificacion_matriz_client", "codificacion_matriz_internal",
  "codificacion_matriz_work", "collection_mail_manifest", "collection_mail_sm_manifest", "collection_mail_sm_zip", "collection_mail_template_zip",
  "collection_mail_zip", "collection_material_bundle", "collection_material_pdf", "collection_material_prueba", "collection_material_png",
  "comparativo_cruces", "comparativo_cruces_manifest", "comparativo_simple", "comparativo_simple_manifest",
  "cruces", "cruces_zip", "data_adaptada", "data_normalizada", "enumeradores", "enumeradores_zip",
  "familias_template", "ficha_tecnica", "ficha_tecnica_panel", "formulario_pdf", "formulario_word",
  "frecuencias", "frecuencias_zip", "graficos_miniatura", "graficos_ppt_consolidado",
  "graficos_ppt_consolidado_manifest", "graficos_ppt_zip", "graficos_preview", "graficos_share",
  "hojas_ruta_ficha_ump", "hojas_ruta_ficha_ump_reemplazo", "hojas_ruta_hoja_dia", "hojas_ruta_operativo", "hojas_ruta_population_matrix",
  "hojas_ruta_random_pdf", "hojas_ruta_reemplazos_puntuales", "hojas_ruta_zip", "instrumento_adaptado",
  "mail_revision", "mail_textos", "material_consolidados", "material_conteo", "material_ruteo",
  "monitoreo_ocurrencias_xlsform", "monitoreo_processing_handoff_data", "monitoreo_processing_handoff_xlsform",
  "monitoreo_processing_handoff_zip", "monitoreo_publication_decision", "monitoreo_publication_evidence_pack",
  "monitoreo_publication_operational_package_request_csv",
  "monitoreo_publication_operational_package_request_json",
  "monitoreo_publication_operational_package_status", "monitoreo_reporte",
  "monitoreo_territorial_operational_package_review_csv", "monitoreo_territorial_operational_package_review_json",
  "monitoreo_territorial_operational_package_review_md", "monitoreo_territorial_operational_package_template",
  "monitoreo_codigos_encuestadores", "monitoreo_plantilla_encuestadores", "monitoreo_ump_export", "plan_limpieza_export", "plan_trabajo_xlsx", "plantilla_barrido",
  "plantilla_codif_template", "reporte_ppt", "reporte_word", "spss_bundle", "supervision_base",
  "tablas_multibase", "validacion_limpieza_base_limpia", "validacion_limpieza_excel", "validacion_limpieza_html",
  "validacion_report_html", "xlsform_final", "xlsform_final_zip"
)

# Firmas de los registradores. Si la función existe en el paquete se usa su firma real (así un cambio
# de orden de argumentos no deja al detector leyendo otra cosa); si no, la congelada por el contrato.
.REGISTRADORES <- list(
  .register_output_file = function(sid, kind, path, original_name = NULL) NULL,
  entregable_registrar = function(sid, path, kind, base = NULL, detalle = NULL, original_name = NULL) NULL,
  .limpieza_register_download = function(sid, kind, original_name, path, ext = NULL) NULL,
  .hojas_ruta_vp_registrar = function(sid, kind, path, original_name = NULL) NULL,
  .cmail_register_artifact = function(sid, path, kind, name, role, media_type, sensitivity) NULL,
  .mini_registrar = function(sid, clave, path, kind, original_name = NULL) NULL,
  run_report_per_base = function(sid, base_filename, ext, kind_single, fn) NULL,
  run_report_multibase = function(sid, base_filename, ext, kind_single, kind_multi, fn) NULL,
  .zip_outputs = function(sid, outputs, zip_basename, kind_multi) NULL
)
.ARGS_KIND <- c("kind", "kind_single", "kind_multi")

.cat_firma <- function(nombre) {
  ns <- tryCatch(asNamespace("prosecnurapp"), error = function(e) NULL)
  real <- if (!is.null(ns)) get0(nombre, envir = ns, mode = "function", inherits = FALSE) else NULL
  if (is.function(real)) real else .REGISTRADORES[[nombre]]
}

# Los literales de una expresión de kind: el string, o las ramas literales de un if/else.
.cat_literales <- function(expr) {
  if (is.character(expr) && length(expr) == 1L) return(expr)
  if (is.call(expr) && identical(expr[[1]], as.name("if"))) {
    ramas <- as.list(expr)[-(1:2)]
    return(unlist(lapply(ramas, .cat_literales), use.names = FALSE))
  }
  character()
}

# Kinds literales pasados a un registrador en un bloque de código ya parseado.
.cat_kinds_literales <- function(exprs, origen = "<texto>") {
  hallazgos <- list()
  visitar <- function(nodo) {
    if (missing(nodo) || is.null(nodo)) return(invisible(NULL))
    if (is.call(nodo)) {
      fn <- nodo[[1]]
      nombre <- if (is.name(fn)) as.character(fn) else ""
      if (nombre %in% names(.REGISTRADORES)) {
        llamada <- tryCatch(match.call(.cat_firma(nombre), nodo, expand.dots = FALSE),
                            error = function(e) nodo)
        args <- as.list(llamada)[-1]
        for (a in intersect(names(args), .ARGS_KIND)) {
          for (k in .cat_literales(args[[a]])) {
            hallazgos[[length(hallazgos) + 1L]] <<- data.frame(kind = k, registrador = nombre,
                                                               origen = origen, stringsAsFactors = FALSE)
          }
        }
      }
    }
    if (is.call(nodo) || is.expression(nodo) || is.pairlist(nodo)) {
      for (i in seq_along(nodo)) visitar(tryCatch(nodo[[i]], error = function(e) NULL))
    }
    invisible(NULL)
  }
  for (e in exprs) visitar(e)
  if (!length(hallazgos)) return(data.frame(kind = character(), registrador = character(), origen = character()))
  do.call(rbind, hallazgos)
}

.cat_kinds_en_api <- function() {
  dir_r <- testthat::test_path("..", "..", "R")
  archivos <- sort(list.files(dir_r, pattern = "\\.R$", full.names = TRUE))
  do.call(rbind, lapply(archivos, function(f) {
    .cat_kinds_literales(parse(f, keep.source = FALSE, encoding = "UTF-8"), basename(f))
  }))
}

.cat_tabla <- function() {
  cat <- entregables_catalogo()
  if (is.data.frame(cat)) return(cat)
  testthat::expect_true(is.list(cat) && !is.null(names(cat)) && all(nzchar(names(cat))))
  campo <- function(e, k) { v <- e[[k]]; if (is.null(v)) NA else v[[1]] }
  data.frame(
    kind = names(cat),
    rotulo = vapply(cat, function(e) as.character(campo(e, "rotulo")), character(1)),
    modulo = vapply(cat, function(e) as.character(campo(e, "modulo")), character(1)),
    por_base = vapply(cat, function(e) as.logical(campo(e, "por_base")), logical(1)),
    guardar = vapply(cat, function(e) as.logical(campo(e, "guardar")), logical(1)),
    stringsAsFactors = FALSE
  )
}

test_that("autoprueba: el detector ve kinds literales por posición, por nombre, en varias líneas y en un if", {
  codigo <- '
    f <- function(sid, path) {
      .register_output_file(sid, "por_posicion", path)
      .register_output_file(
        sid,
        kind = "por_nombre_partido",
        path
      )
      entregable_registrar(sid, path, "registro_tercero")
      entregable_registrar(sid, kind = "registro_nombrado", path = path)
      .cmail_register_artifact(sid, path, if (x) "rama_si" else "rama_no", "n", "r", "m", "s")
      .mini_registrar(sid, "clave_no_es_kind", path, "miniatura_cuarto")
      run_report_multibase(sid, "base", "xlsx", "multi_single", "multi_zip", function(...) NULL)
      .register_output_file(sid, paste0("armado_", x), path)
      .register_output_file(sid, kind_variable, path)
      otra_funcion(sid, "no_es_registro", path)
    }
  '
  hallados <- .cat_kinds_literales(parse(text = codigo, keep.source = FALSE))$kind
  expect_setequal(hallados, c("por_posicion", "por_nombre_partido", "registro_tercero", "registro_nombrado",
                              "rama_si", "rama_no", "miniatura_cuarto", "multi_single", "multi_zip"))
  expect_false("clave_no_es_kind" %in% hallados)
  expect_false("no_es_registro" %in% hallados)
})

test_that("autoprueba: el detector no está ciego sobre api/R", {
  en_api <- .cat_kinds_en_api()
  # Censado el 2026-11-07: ~70 kinds literales distintos. Un recorrido que encuentre pocos
  # dejó de ver las llamadas, no es que el backend registre menos.
  expect_gt(length(unique(en_api$kind)), 50L)
  expect_true(all(c("data_normalizada", "reporte_ppt", "mail_textos", "graficos_miniatura",
                    "validacion_limpieza_html", "frecuencias") %in% en_api$kind))
})

test_that("el catálogo declara rótulo, módulo, por_base y guardar por kind, sin repetir kinds", {
  tabla <- .cat_tabla()
  expect_true(all(c("kind", "rotulo", "modulo", "por_base", "guardar") %in% names(tabla)))
  expect_false(anyDuplicated(tabla$kind) > 0L)
  expect_true(all(!is.na(tabla$rotulo) & nzchar(tabla$rotulo)))
  expect_true(all(!is.na(tabla$por_base)))
  expect_true(all(!is.na(tabla$guardar)))
})

test_that("los módulos del catálogo son las ocho carpetas del §4", {
  tabla <- .cat_tabla()
  fuera <- setdiff(unique(tabla$modulo), .MODULOS_ADR_0133)
  expect_identical(fuera, character(), info = paste(fuera, collapse = ", "))
})

test_that("las vistas previas y miniaturas se registran con guardar = FALSE", {
  tabla <- .cat_tabla()
  for (kind in c("graficos_miniatura", "graficos_preview")) {
    expect_true(kind %in% tabla$kind, info = kind)
    expect_false(isTRUE(tabla$guardar[tabla$kind == kind]), info = kind)
  }
})

test_that("todo kind literal pasado a un registrador en api/R tiene entrada en el catálogo", {
  en_api <- .cat_kinds_en_api()
  tabla <- .cat_tabla()
  faltan <- en_api[!en_api$kind %in% tabla$kind, , drop = FALSE]
  faltan <- faltan[!duplicated(faltan$kind), , drop = FALSE]
  expect_identical(
    nrow(faltan), 0L,
    info = paste(sprintf("%s (%s, %s)", faltan$kind, faltan$registrador, faltan$origen), collapse = "\n")
  )
})

test_that("todo kind del censo de descargas tiene entrada en el catálogo (incluye los armados y de tabla)", {
  tabla <- .cat_tabla()
  faltan <- setdiff(.KINDS_CENSO, tabla$kind)
  expect_identical(faltan, character(), info = paste(faltan, collapse = ", "))
})
