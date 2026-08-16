# Golden de la suite de criterios de inclusión/exclusión POR CATEGORÍA
# (calc_muestra_aulas_criterios.R + calc_muestra_aulas_catalogo.R): enumeración
# de ambos scopes (alumno/aula), evaluación de la selección canónica sobre un
# fixture sintético determinista, capa marco/instrumento del scope alumno,
# modalidad/tipo/tipo_docente AUTORITATIVOS desde el catálogo (fix del −281) y
# retro-compatibilidad bit a bit del path legacy.
#
# El fixture es sintético a propósito (sin acentos, cifras redondas): ejerce
# CADA regla del contrato con un resultado calculable a mano. El objetivo del
# marco canónico del fixture es 3 aulas (A1, A4, A10); ver el desglose regla por
# regla en el test principal. La reconciliación contra la base canónica REAL
# (2483) vive en el test gated del final.

# --- Fixture sintético -------------------------------------------------------
# Base madre: solo señales de ALUMNO (facultad, formación, condición, edad,
# ciclo) + la llave de aula. La modalidad/tipo/tipo_docente/nivel/matriculados
# son CONSTANTES por aula y viven SOLO en el catálogo (constante por aula, como
# manda la doc canónica). Cada aula trae 12 estudiantes elegibles salvo donde el
# caso pide lo contrario.

.crit_gold_estudiantes <- function(aula, n = 12, facultad, formacion = "PREGRADO",
                                   condicion = "REGULAR", edad = 20, ciclo = "3") {
  data.frame(
    codigo_alumno = paste0(aula, "_s", seq_len(n)),
    curso_horario = aula,
    facultad = facultad,
    formacion = formacion,
    condicion = condicion,
    edad = edad,
    nivel = ciclo,
    sexo = rep(c("F", "M"), length.out = n),
    stringsAsFactors = FALSE
  )
}

.crit_gold_catalogo_row <- function(aula, modalidad, tipo, tipo_docente,
                                    facultad_del_curso, nivel, matriculados) {
  data.frame(
    curso_horario = aula,
    facultad_del_curso = facultad_del_curso,
    modalidad = modalidad,
    tipo = tipo,
    tipo_docente = tipo_docente,
    nivel = nivel,
    matriculados = matriculados,
    stringsAsFactors = FALSE
  )
}

# 12 aulas que ejercen cada regla del scope aula. La facultad del ALUMNO se
# fija igual a la del curso para simplificar (no interviene en la selección de
# aula del golden).
.crit_gold_base <- function() {
  aulas <- list(
    # id,  fac,                modalidad,        tipo,                                             tipo_docente,                       nivel, matric, formacion
    list("A1",  "CIENCIAS E INGENIERIA", "PRESENCIAL",    "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)", "DOCENTE ORDINARIO - PRINCIPAL",   "6", 20, "PREGRADO"),
    list("A2",  "CIENCIAS E INGENIERIA", "VIRTUAL",       "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)", "DOCENTE ORDINARIO - PRINCIPAL",   "6", 20, "PREGRADO"),
    list("A3",  "CIENCIAS E INGENIERIA", "PRESENCIAL",    "SEMINARIO",                                     "DOCENTE ORDINARIO - PRINCIPAL",   "6", 20, "PREGRADO"),
    list("A4",  "ARTE Y DISENO",         "PRESENCIAL",    "TALLER",                                        "DOCENTE ORDINARIO - ASOCIADO",    "5", 20, "PREGRADO"),
    list("A5",  "CIENCIAS E INGENIERIA", "PRESENCIAL",    "TALLER",                                        "DOCENTE ORDINARIO - PRINCIPAL",   "6", 20, "PREGRADO"),
    list("A6",  "CIENCIAS E INGENIERIA", "PRESENCIAL",    "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)", "DOCENTE EXTRAORDINARIO - VISITANTE","6", 20, "PREGRADO"),
    list("A7",  "CIENCIAS E INGENIERIA", "PRESENCIAL",    "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)", "DOCENTE ORDINARIO - PRINCIPAL",   "2", 20, "PREGRADO"),
    list("A8",  "CONSORCIO DE UNIVERSIDADES", "PRESENCIAL","TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)","DOCENTE CONTRATADO - CONTRATADO", "6", 20, "PREGRADO"),
    list("A9",  "CIENCIAS E INGENIERIA", "PRESENCIAL",    "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)", "DOCENTE ORDINARIO - PRINCIPAL",   "6",  5, "PREGRADO"),
    list("A10", "EDUCACION",             "PRESENCIAL",    "LABORATORIO",                                   "DOCENTE CONTRATADO - CONTRATADO", "3", 15, "PREGRADO"),
    list("A11", "CIENCIAS E INGENIERIA", "PRESENCIAL",    "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)", "DOCENTE ORDINARIO - PRINCIPAL",   "6", 20, "MAESTRIA"),
    list("A12", "EDUCACION",             "PRESENCIAL",    "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)", "DOCENTE ORDINARIO - AUXILIAR",    "4", 20, "PREGRADO")
  )
  est <- do.call(rbind, lapply(aulas, function(a) {
    ciclo <- if (identical(a[[1]], "A12")) "1" else "3"
    .crit_gold_estudiantes(a[[1]], facultad = a[[2]], formacion = a[[8]], ciclo = ciclo)
  }))
  cat <- do.call(rbind, lapply(aulas, function(a) {
    .crit_gold_catalogo_row(a[[1]], a[[3]], a[[4]], a[[5]], a[[2]], a[[6]], a[[7]])
  }))
  list(estudiantes = est, catalogo = cat)
}

# Selección canónica (preset HST expresado como categorías, sin HST hardcodeado).
.crit_gold_seleccion <- function(nivel_layer = "instrumento") {
  rng <- function(mn, mx) list(list(min = mn, max = mx))
  list(
    byVariable = list(
      modality = list(mode = "include", categories = list("presencial")),
      session_type = list(
        mode = "include",
        categories = list("teorico_teorico_practico_teorico_laboratorio", "laboratorio"),
        exceptions = list("ARTE Y DISENO" = list(categories = list("taller", "artistico"), op = "add"))
      ),
      teacher_type = list(mode = "include", match = "any",
                          categories = list("docente_contratado", "docente_ordinario")),
      # Criterio administrativo independiente: matrícula declarada >= 10.
      # minEligible (abajo) conserva otra semántica: alumnos elegibles reales.
      enrolled_total = list(mode = "include", threshold = list(op = ">=", min = 10)),
      # Criterio de alumno: formación pregrado en capa "marco" (reduce N).
      formation = list(mode = "include", categories = list("pregrado"), layer = "marco"),
      # Criterio de alumno: ciclo desde 2 en adelante; su CAPA es el parámetro
      # bajo prueba (marco reduce el marco; instrumento no).
      level = list(mode = "include", fromValue = 2, layer = nivel_layer)
    ),
    courseLevelRanges = list(
      "CIENCIAS E INGENIERIA" = rng(5, 10),
      "ARTE Y DISENO" = rng(2, 10),
      "EDUCACION" = rng(2, 10)
    ),
    minEligible = list(threshold = 10)
  )
}

.crit_gold_config <- function(nivel_layer = "instrumento", seleccion = TRUE) {
  cfg <- list(
    mapping = list(faculty = c("facultad_del_curso"), enrolled_total = c("matriculados")),
    filters = list(
      require_undergraduate = FALSE, require_adult = FALSE,
      require_in_person = FALSE, exclude_session_patterns = list(),
      accepted_conditions = list(), min_eligible_per_class = 1L
    )
  )
  if (seleccion) cfg$criterios_seleccion <- .crit_gold_seleccion(nivel_layer)
  cfg
}

.crit_gold_incluidas <- function(frame) {
  af <- frame$aula_frame
  sort(af$classroom_id[af$included %in% TRUE])
}

# --- Enumeración: criterios_catalogo -----------------------------------------

test_that("criterios_catalogo enumera ambos scopes con kind y mappedColumn", {
  fx <- .crit_gold_base()
  frame <- calc_muestra_aulas_construir(
    base_madre = fx$estudiantes, catalogo_curso_horario = fx$catalogo,
    config = .crit_gold_config(seleccion = FALSE)
  )
  cc <- frame$criterios_catalogo
  expect_identical(cc$schema, "calc_muestra_aulas_criterios_catalogo_v1")
  by_id <- stats::setNames(cc$variables, vapply(cc$variables, function(v) v$id, character(1)))

  # Scope y kind por variable.
  expect_identical(by_id$modality$scope, "aula")
  expect_identical(by_id$modality$kind, "flat")
  expect_identical(by_id$teacher_type$kind, "hierarchical")
  expect_identical(by_id$course_level$kind, "range")
  expect_identical(by_id$enrolled_total$kind, "numeric")
  expect_identical(by_id$formation$scope, "alumno")
  expect_identical(by_id$age$kind, "numeric")
  expect_identical(by_id$level$kind, "ordinal")

  # mappedColumn refleja la columna real del Excel.
  expect_identical(by_id$modality$mappedColumn, "modalidad")
  expect_identical(by_id$session_type$mappedColumn, "tipo")
  expect_identical(by_id$teacher_type$mappedColumn, "tipo_docente")

  # defaultLayer solo en scope alumno; faculty estratifica.
  expect_identical(by_id$formation$defaultLayer, "marco")
  expect_identical(by_id$level$defaultLayer, "instrumento")
  expect_null(by_id$modality$defaultLayer)
  expect_true(isTRUE(by_id$faculty$estratifica))

  # Modalidad autoritativa desde el catálogo: 11 aulas presenciales, 1 virtual.
  mod_cats <- stats::setNames(
    vapply(by_id$modality$categories, function(c) c$aulas, integer(1)),
    vapply(by_id$modality$categories, function(c) c$key, character(1))
  )
  expect_identical(unname(mod_cats["presencial"]), 11L)
  expect_identical(unname(mod_cats["virtual"]), 1L)

  # Jerarquía de tipo de docente: grupos por prefijo "GRUPO - detalle".
  grupos <- stats::setNames(
    vapply(by_id$teacher_type$groups, function(g) g$aulas, integer(1)),
    vapply(by_id$teacher_type$groups, function(g) g$key, character(1))
  )
  expect_true("docente_ordinario" %in% names(grupos))
  expect_true("docente_contratado" %in% names(grupos))
  expect_true("docente_extraordinario" %in% names(grupos))
  # El grupo ordinario agrupa sus detalles (principal/asociado/auxiliar).
  ordinario <- Filter(function(g) g$key == "docente_ordinario", by_id$teacher_type$groups)[[1]]
  hijos <- vapply(ordinario$children, function(c) c$key, character(1))
  expect_true(all(c("docente_ordinario_principal", "docente_ordinario_asociado",
                    "docente_ordinario_auxiliar") %in% hijos))

  # course_level (range) expone los niveles observados.
  niveles <- sort(unlist(lapply(by_id$course_level$values, identity)))
  expect_true(all(c(2, 3, 4, 5, 6) %in% niveles))
})

# --- Selección canónica sobre el fixture -------------------------------------

test_that("selección canónica reproduce el marco esperado del fixture (3 aulas)", {
  # Desglose regla por regla (nivel en capa 'instrumento', no reduce el marco):
  #   A1  PASA (presencial, teorico, ordinario, ING nivel 6, matric 20)
  #   A2  cae por modalidad (virtual)
  #   A3  cae por tipo de sesión (seminario)
  #   A4  PASA (taller en ARTE Y DISENO vía excepción; nivel 5 ∈ [2,10])
  #   A5  cae por tipo (taller SIN excepción en Ingeniería)
  #   A6  cae por docente (solo extraordinario-visitante)
  #   A7  cae por nivel del curso (2 ∉ [5,10] de Ingeniería)
  #   A8  cae por nivel (Consorcio no está en el mapa → fuera)
  #   A9  cae por el criterio independiente Matriculados / población (5 < 10)
  #   A10 PASA (laboratorio ∈ set; EDU nivel 3 ∈ [2,10]; contratado; matric 15)
  #   A11 cae: todos maestría → 0 elegibles (criterio de alumno 'formation' marco)
  #   A12 PASA (teorico, ordinario, EDU nivel 4; sus alumnos son ciclo 1 pero el
  #        criterio de ciclo está en capa 'instrumento' → no reduce el marco)
  fx <- .crit_gold_base()
  frame <- calc_muestra_aulas_construir(
    base_madre = fx$estudiantes, catalogo_curso_horario = fx$catalogo,
    config = .crit_gold_config(nivel_layer = "instrumento")
  )
  expect_identical(.crit_gold_incluidas(frame), c("A1", "A10", "A12", "A4"))
  expect_identical(sum(frame$aula_frame$included %in% TRUE), 4L)

  # Razones de exclusión acumuladas por aula (auditables a mano).
  af <- frame$aula_frame
  razon <- stats::setNames(af$exclude_reason, af$classroom_id)
  expect_true(grepl("modality", razon[["A2"]]))
  expect_true(grepl("session_type", razon[["A3"]]))
  expect_true(grepl("session_type", razon[["A5"]]))
  expect_true(grepl("teacher_type", razon[["A6"]]))
  expect_true(grepl("course_level", razon[["A7"]]))
  expect_true(grepl("course_level", razon[["A8"]]))
  expect_true(grepl("enrolled_total", razon[["A9"]]))
})

test_that("capa del ciclo: 'marco' recorta A12, 'instrumento' no", {
  fx <- .crit_gold_base()
  # Con ciclo en capa 'marco', los alumnos de A12 (ciclo 1) quedan fuera de la
  # población → A12 sin elegibles → fuera del marco (3 aulas).
  frame_marco <- calc_muestra_aulas_construir(
    base_madre = fx$estudiantes, catalogo_curso_horario = fx$catalogo,
    config = .crit_gold_config(nivel_layer = "marco")
  )
  expect_identical(.crit_gold_incluidas(frame_marco), c("A1", "A10", "A4"))
  # El reporte del scope alumno registra la capa efectiva de cada criterio.
  rep_marco <- frame_marco$criterios_alumno_report
  expect_true(rep_marco$activa)
  expect_identical(rep_marco$criterios$level$layer, "marco")
  expect_identical(rep_marco$criterios$formation$layer, "marco")
})

test_that("el reporte de alumno publica el total sobre el que cortan", {
  # Sin `filas_total` la pantalla no puede decir cuánto recorta cada criterio:
  # tendría que inferir el universo del criterio que más deja pasar, y eso sólo
  # es exacto cuando alguno no recorta. En el proyecto real de 2025-2 `level`
  # dejaba pasar TODO —declarado y sin morder—, y ese cero es precisamente lo
  # que el desglose existe para hacer visible.
  fx <- .crit_gold_base()
  frame <- calc_muestra_aulas_construir(
    base_madre = fx$estudiantes, catalogo_curso_horario = fx$catalogo,
    config = .crit_gold_config(nivel_layer = "marco")
  )
  rep <- frame$criterios_alumno_report
  total <- rep$filas_total
  expect_true(is.integer(total) && length(total) == 1L && total > 0L)
  # El total es el universo: ningún criterio puede dejar pasar más filas.
  for (id in names(rep$criterios)) {
    expect_lte(rep$criterios[[id]]$filas_pasan, total)
  }
  # Y es el mismo recuento de filas que entra al motor, no una cota inferior
  # tomada del criterio más laxo: `formation` recorta, así que un total inferido
  # del máximo observado se quedaría corto si TODOS recortaran.
  expect_identical(total, nrow(fx$estudiantes))

  # Sin selección activa el total se publica igual: distingue "no se midió"
  # (no hay criterios) de "midió cero".
  legacy <- calc_muestra_aulas_construir(
    base_madre = fx$estudiantes, catalogo_curso_horario = fx$catalogo,
    config = .crit_gold_config(seleccion = FALSE)
  )
  expect_false(legacy$criterios_alumno_report$activa)
  expect_identical(legacy$criterios_alumno_report$filas_total, nrow(fx$estudiantes))
})

# --- Nivel del curso: regla canónica "cualquier par" -------------------------

test_that("nivel usa 'cualquier par' (facultad, nivel): modal falla, par pasa", {
  # Un curso-horario le cuenta a varias carreras/facultades en distinto nivel.
  # AMF1 solo sirve a Ingeniería en nivel 0 (fuera de su rango 5-10) → fuera.
  # AMF2 sirve a Ingeniería nivel 0 (fuera) Y a Estudios Generales Letras
  # nivel 0 (dentro de su rango 0-0): con el par modal (Ingeniería, 0) caería,
  # pero con "cualquier par" pasa por el par (EGL, 0). Esto blinda la semántica
  # §3ter contra una regresión al modal.
  est <- rbind(
    .crit_gold_estudiantes("AMF1", n = 12, facultad = "CIENCIAS E INGENIERIA"),
    .crit_gold_estudiantes("AMF2", n = 12, facultad = "CIENCIAS E INGENIERIA")
  )
  fila <- function(aula, fac) .crit_gold_catalogo_row(
    aula, "PRESENCIAL", "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)",
    "DOCENTE ORDINARIO - PRINCIPAL", fac, "0", 20
  )
  cat <- rbind(
    fila("AMF1", "CIENCIAS E INGENIERIA"),
    fila("AMF2", "CIENCIAS E INGENIERIA"),
    fila("AMF2", "ESTUDIOS GENERALES LETRAS")  # 2do par de la misma aula
  )
  rng <- function(mn, mx) list(list(min = mn, max = mx))
  cfg <- list(
    mapping = list(faculty = c("facultad_del_curso"), enrolled_total = c("matriculados")),
    filters = list(require_undergraduate = FALSE, require_adult = FALSE,
                   require_in_person = FALSE, exclude_session_patterns = list(),
                   accepted_conditions = list(), min_eligible_per_class = 1L),
    criterios_seleccion = list(
      byVariable = list(modality = list(mode = "include", categories = list("presencial"))),
      courseLevelRanges = list(
        "CIENCIAS E INGENIERIA" = rng(5, 10),
        "ESTUDIOS GENERALES LETRAS" = rng(0, 0)
      )
    )
  )
  frame <- calc_muestra_aulas_construir(base_madre = est, catalogo_curso_horario = cat, config = cfg)
  expect_identical(.crit_gold_incluidas(frame), "AMF2")
  af <- frame$aula_frame
  razon <- stats::setNames(af$exclude_reason, af$classroom_id)
  expect_true(grepl("course_level", razon[["AMF1"]]))
})

test_that("docente: un include NO pasa sin señal de tipo de docente", {
  # A_sin_doc no tiene tipo de docente en el catálogo: no se puede afirmar que
  # tenga un docente contratado/ordinario → fuera. A_con_doc sí → dentro.
  est <- rbind(
    .crit_gold_estudiantes("ADOC1", n = 12, facultad = "CIENCIAS E INGENIERIA"),
    .crit_gold_estudiantes("ADOC2", n = 12, facultad = "CIENCIAS E INGENIERIA")
  )
  cat <- rbind(
    .crit_gold_catalogo_row("ADOC1", "PRESENCIAL", "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)",
                            "DOCENTE ORDINARIO - PRINCIPAL", "CIENCIAS E INGENIERIA", "6", 20),
    .crit_gold_catalogo_row("ADOC2", "PRESENCIAL", "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)",
                            "", "CIENCIAS E INGENIERIA", "6", 20)  # sin tipo de docente
  )
  cfg <- list(
    mapping = list(faculty = c("facultad_del_curso"), enrolled_total = c("matriculados")),
    filters = list(require_undergraduate = FALSE, require_adult = FALSE,
                   require_in_person = FALSE, exclude_session_patterns = list(),
                   accepted_conditions = list(), min_eligible_per_class = 1L),
    criterios_seleccion = list(byVariable = list(
      teacher_type = list(mode = "include", match = "any",
                          categories = list("docente_contratado", "docente_ordinario"))
    ))
  )
  frame <- calc_muestra_aulas_construir(base_madre = est, catalogo_curso_horario = cat, config = cfg)
  expect_identical(.crit_gold_incluidas(frame), "ADOC1")
})

test_that("nivel: un par de facultad mapeada con nivel ilegible NO acredita", {
  # ANIV1 tiene nivel 6 (parseable, ∈ [5,10]) → dentro. ANIV2 tiene el mismo par
  # de facultad mapeada pero nivel vacío → no se puede confirmar → fuera.
  est <- rbind(
    .crit_gold_estudiantes("ANIV1", n = 12, facultad = "CIENCIAS E INGENIERIA"),
    .crit_gold_estudiantes("ANIV2", n = 12, facultad = "CIENCIAS E INGENIERIA")
  )
  cat <- rbind(
    .crit_gold_catalogo_row("ANIV1", "PRESENCIAL", "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)",
                            "DOCENTE ORDINARIO - PRINCIPAL", "CIENCIAS E INGENIERIA", "6", 20),
    .crit_gold_catalogo_row("ANIV2", "PRESENCIAL", "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)",
                            "DOCENTE ORDINARIO - PRINCIPAL", "CIENCIAS E INGENIERIA", "", 20)  # nivel vacío
  )
  cfg <- list(
    mapping = list(faculty = c("facultad_del_curso"), enrolled_total = c("matriculados")),
    filters = list(require_undergraduate = FALSE, require_adult = FALSE,
                   require_in_person = FALSE, exclude_session_patterns = list(),
                   accepted_conditions = list(), min_eligible_per_class = 1L),
    criterios_seleccion = list(
      byVariable = list(modality = list(mode = "include", categories = list("presencial"))),
      courseLevelRanges = list("CIENCIAS E INGENIERIA" = list(list(min = 5, max = 10)))
    )
  )
  frame <- calc_muestra_aulas_construir(base_madre = est, catalogo_curso_horario = cat, config = cfg)
  expect_identical(.crit_gold_incluidas(frame), "ANIV1")
})

# --- Modalidad autoritativa desde el catálogo (fix del −281) ------------------

test_that("modalidad/tipo se resuelven del catálogo, no de la fila del alumno", {
  # Un aula PRESENCIAL en el catálogo, pero con la modalidad RUIDOSA en la base
  # del alumno (mayoría 'virtual'): el gate de categorías debe leer el catálogo
  # (constante por aula) y dejarla pasar. Sin catálogo, cae al valor de la base.
  est <- .crit_gold_estudiantes("A1", n = 12, facultad = "CIENCIAS E INGENIERIA")
  est$modalidad <- c(rep("VIRTUAL", 9), rep("PRESENCIAL", 3))  # ruido de base
  cat <- .crit_gold_catalogo_row(
    "A1", "PRESENCIAL", "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)",
    "DOCENTE ORDINARIO - PRINCIPAL", "CIENCIAS E INGENIERIA", "6", 20
  )
  cfg <- list(
    mapping = list(faculty = c("facultad_del_curso"), enrolled_total = c("matriculados")),
    filters = list(require_undergraduate = FALSE, require_adult = FALSE,
                   require_in_person = FALSE, exclude_session_patterns = list(),
                   accepted_conditions = list(), min_eligible_per_class = 1L),
    criterios_seleccion = list(byVariable = list(
      modality = list(mode = "include", categories = list("presencial"))
    ))
  )
  con_catalogo <- calc_muestra_aulas_construir(base_madre = est, catalogo_curso_horario = cat, config = cfg)
  expect_identical(.crit_gold_incluidas(con_catalogo), "A1")

  # Sin catálogo: la modalidad modal de la base es 'virtual' → el aula cae.
  sin_catalogo <- calc_muestra_aulas_construir(base_madre = est, config = cfg)
  expect_identical(sum(sin_catalogo$aula_frame$included %in% TRUE), 0L)
})

# --- Retro-compatibilidad bit a bit ------------------------------------------

test_that("sin criterios_seleccion el marco sale idéntico al path legacy", {
  fx <- .crit_gold_base()
  cfg_base <- list(
    mapping = list(faculty = c("facultad_del_curso"), enrolled_total = c("matriculados")),
    filters = list(require_undergraduate = FALSE, require_adult = FALSE,
                   require_in_person = FALSE, exclude_session_patterns = list(),
                   accepted_conditions = list(), min_eligible_per_class = 1L)
  )
  legacy <- calc_muestra_aulas_construir(
    base_madre = fx$estudiantes, catalogo_curso_horario = fx$catalogo, config = cfg_base
  )
  # Sin selección, TODAS las aulas con >= 1 elegible pasan (12 aulas).
  expect_identical(sum(legacy$aula_frame$included %in% TRUE), 12L)
  expect_true(all(nchar(legacy$aula_frame$exclude_reason) == 0L))
  # criterios_seleccion normalizado queda vacío (sentinela de ausencia).
  expect_identical(legacy$config$criterios_seleccion, list())
  # El reporte del scope alumno queda inactivo.
  expect_false(legacy$criterios_alumno_report$activa)

  # Añadir señales de selección NO debe cambiar el marco si la config no las
  # pide: el resultado es idéntico al legacy (mismo included, misma razón).
  legacy2 <- calc_muestra_aulas_construir(
    base_madre = fx$estudiantes, catalogo_curso_horario = fx$catalogo, config = cfg_base
  )
  expect_identical(legacy$aula_frame$included, legacy2$aula_frame$included)
  expect_identical(legacy$aula_frame$exclude_reason, legacy2$aula_frame$exclude_reason)
})

test_that("normalización de la selección: defensiva y sentinela de ausencia", {
  # Ausencia total -> list().
  expect_identical(.cm_criterios_normalize_seleccion(NULL), list())
  expect_identical(.cm_criterios_normalize_seleccion(list()), list())
  expect_identical(.cm_criterios_normalize_seleccion(list(byVariable = list())), list())

  # Variable desconocida se descarta; scope/kind vienen del registro.
  sel <- .cm_criterios_normalize_seleccion(list(byVariable = list(
    inexistente = list(mode = "include", categories = list("x")),
    modality = list(mode = "EXCLUDE", categories = list("Virtual", "A Distancia")),
    age = list(threshold = list(op = ">=", min = 18))
  )))
  expect_false("inexistente" %in% names(sel$byVariable))
  expect_identical(sel$byVariable$modality$scope, "aula")
  expect_identical(sel$byVariable$modality$mode, "exclude")
  # categories normalizadas a text_key.
  expect_identical(sel$byVariable$modality$categories, c("virtual", "a_distancia"))
  # age: scope alumno, kind numeric, threshold parseado, capa por defecto.
  expect_identical(sel$byVariable$age$scope, "alumno")
  expect_identical(sel$byVariable$age$threshold$op, ">=")
  expect_equal(sel$byVariable$age$threshold$min, 18)
  expect_identical(sel$byVariable$age$layer, "marco")
})

# --- Precedencia: suite activa ⇒ autoridad única (neutraliza flags legacy) ----
# Cuando la suite por categoría está activa, ELLA gobierna las dimensiones que
# cubre y los flags legacy encendidos por default NO deben restar elegibilidad.
# Caso canónico: MAESTRIA marcada en la suite de formación entra pese a
# require_undergraduate=TRUE. Retro-compat: sin suite, el flag legacy sigue
# filtrando maestría fuera.

# Base con dos aulas: una de puro PREGRADO y otra de pura MAESTRIA (12 alumnos
# cada una). El resto de señales de alumno es constante para aislar la formación.
.crit_prec_base <- function() {
  rbind(
    .crit_gold_estudiantes("APRE", n = 12, facultad = "CIENCIAS E INGENIERIA", formacion = "PREGRADO"),
    .crit_gold_estudiantes("AMAE", n = 12, facultad = "CIENCIAS E INGENIERIA", formacion = "MAESTRIA")
  )
}

# Flags legacy ENCENDIDOS y canónicos (require_undergraduate=TRUE, pregrado como
# formación aceptada). Las demás dimensiones apagadas para aislar la formación.
.crit_prec_config <- function(seleccion = NULL) {
  cfg <- list(
    mapping = list(faculty = c("facultad_del_curso"), enrolled_total = c("matriculados")),
    filters = list(
      require_undergraduate = TRUE, accepted_formation_patterns = list("pregrado"),
      require_adult = FALSE, require_in_person = FALSE,
      exclude_session_patterns = list(), accepted_conditions = list(),
      min_eligible_per_class = 1L
    )
  )
  if (!is.null(seleccion)) cfg$criterios_seleccion <- seleccion
  cfg
}

test_that("precedencia: suite de formación con MAESTRIA override a require_undergraduate", {
  base <- .crit_prec_base()
  # Suite ACTIVA: scope formación INCLUYE pregrado Y maestría en capa marco.
  sel <- list(byVariable = list(
    formation = list(mode = "include", categories = list("pregrado", "maestria"), layer = "marco")
  ))
  frame <- calc_muestra_aulas_construir(base_madre = base, config = .crit_prec_config(sel))
  # La población objetivo CONTIENE las filas de maestría: la suite gobierna y
  # neutraliza el require_undergraduate=TRUE legacy (que solía ANDear la suite
  # fuera de sus propios defaults).
  expect_true(all(paste0("AMAE_s", 1:12) %in% frame$population$student_id))
  expect_true(all(paste0("APRE_s", 1:12) %in% frame$population$student_id))
  expect_identical(frame$perfil$poblacion_n, 24L)
  # Ambas aulas quedan en el marco (cada una con 12 elegibles).
  af <- frame$aula_frame
  expect_identical(sort(af$classroom_id[af$included %in% TRUE]), c("AMAE", "APRE"))
})

test_that("retro-compat: sin suite, require_undergraduate=TRUE sigue filtrando MAESTRIA", {
  base <- .crit_prec_base()
  frame <- calc_muestra_aulas_construir(base_madre = base, config = .crit_prec_config())
  # Sin criterios_seleccion los flags legacy mandan: maestría fuera de N.
  expect_false(any(paste0("AMAE_s", 1:12) %in% frame$population$student_id))
  expect_true(all(paste0("APRE_s", 1:12) %in% frame$population$student_id))
  expect_identical(frame$perfil$poblacion_n, 12L)
  # AMAE sin elegibles → fuera del marco; solo APRE queda.
  af <- frame$aula_frame
  expect_identical(af$classroom_id[af$included %in% TRUE], "APRE")
})

# --- Gated: reconciliación contra la base canónica REAL (objetivo 2483) -------
# Solo corre donde existe el workbook canónico (scratchpad del dev / macOS);
# en CI se salta. Objetivo del marco = 2483 aulas; población = 21365.
#
# CLAVA el objetivo: población 21365 EXACTA (scope alumno) y marco = 2481
# (dif −2 de 2483). La selección canónica del preset HST:
#   - modality {presencial}
#   - session_type {TEORICO(...)} SOLO (no LABORATORIO) + excepción Arte y
#     Diseño {taller, artistico}
#   - teacher_type grupos {docente_contratado, docente_ordinario} match any
#     (aula SIN docente conocido NO pasa el include — no se puede afirmar la
#     pertenencia sin datos)
#   - courseLevelRanges mapa 2025, regla "cualquier par": pasa si algún par
#     (facultad del curso, nivel PARSEABLE) cae en rango; nivel ilegible NO
#     acredita (na_pasa = FALSE).
# El −2 residual es la única diferencia estructural: este motor construye el
# marco sobre aulas con ≥1 alumno ELEGIBLE (una aula sin elegibles no es
# muestreable), mientras que el 2483 publicado se computa sobre TODAS las aulas
# del catálogo puro. Sobre el catálogo puro, la misma regla da 2483 EXACTO.
# Trampa cerrada: la comparación de facultad limpia la ñ Y los apóstrofes que
# iconv mete en macOS (ÉNICAS→'ENICAS); sin esa limpieza 5 facultades
# acentuadas caían como "no mapeadas" y un embudo con acentos rotos + nivel-NA
# permisivo cuadraba 2479 por cancelación de dos errores.
.crit_canonico_path <- function() {
  p <- Sys.getenv("PULSO_CALC_MUESTRA_CANONICO", "")
  if (nzchar(p)) return(p)
  file.path(
    "/private/tmp/claude-501",
    "-Users-gonzaloalmendariz-Documents-Pulso-prosecnur-app",
    "d3fb0ab9-eaa6-4dbe-a202-fd6df5f384bb", "scratchpad", "canonico.xlsx"
  )
}

test_that("[gated] base canónica real: población exacta y marco cerca de 2483", {
  path <- .crit_canonico_path()
  skip_if_not(file.exists(path), "base canónica no disponible (scratchpad)")
  skip_if_not_installed("readxl")

  est <- as.data.frame(readxl::read_excel(path, sheet = "Estudiantes", .name_repair = "minimal"))
  ch  <- as.data.frame(readxl::read_excel(path, sheet = "Cursos-Horario", .name_repair = "minimal"))
  names(est) <- c("Codigo", "Nombre", "Correo", "Facultad", "Carrera", "Ciclo",
                  "Formacion", "Condicion", "Sexo", "Edad", "Nivel curricular",
                  "Poblacion", "Curso-Horario", "Curso", "Nombre del curso", "Horario",
                  "Facultad del curso", "Modalidad", "Tipo de curso", "Condicion del curso")
  names(ch) <- c("Curso-Horario", "Curso", "Nombre", "Nivel", "Horario", "Sesiones y aula",
                 "Facultad del curso", "Carrera", "Modalidad", "Tipo", "Condicion",
                 "Matriculados", "Poblacion", "Docente", "Nombre de docente",
                 "Tipo de docente", "Correo", "Celular")

  rng <- function(mn, mx) list(list(min = mn, max = mx))
  mapa <- list(
    "ARQUITECTURA Y URBANISMO" = rng(2, 10), "ARTE Y DISENO" = rng(2, 10),
    "ARTES ESCENICAS" = rng(2, 10), "EDUCACION" = rng(2, 10),
    "GASTRONOMIA, HOTELERIA Y TURISMO" = rng(2, 10), "CIENCIAS CONTABLES" = rng(5, 10),
    "CIENCIAS E INGENIERIA" = rng(5, 10), "CIENCIAS SOCIALES" = rng(5, 10),
    # El catálogo abrevia esta facultad; se usa la etiqueta observada.
    "CIENCIAS Y ARTES DE LA COMUN." = rng(5, 10), "DERECHO" = rng(5, 10),
    "GESTION Y ALTA DIRECCION" = rng(5, 10), "LETRAS Y CIENCIAS HUMANAS" = rng(5, 10),
    "PSICOLOGIA" = rng(5, 10), "ESTUDIOS GENERALES CIENCIAS" = rng(2, 4),
    "ESTUDIOS GENERALES LETRAS" = rng(0, 0)
  )
  # Selección canónica del preset HST: TEORICO-solo, ≥10 sobre ELEGIBLES.
  cfg <- list(
    mapping = list(faculty = c("facultad_del_curso"), course_level = c("nivel"),
                   session_type = c("tipo_de_curso", "tipo_curso")),
    # Precedencia suite ⇒ flags legacy: con la suite activa, ELLA es la
    # autoridad única del scope alumno, así que formación/condición/edad se
    # expresan DENTRO de la suite (capa marco) y NO por flags legacy (que la
    # suite ahora neutraliza). El resultado es idéntico al histórico (población
    # 21365 exacta), ahora bajo el modelo autoritativo.
    filters = list(
      require_undergraduate = FALSE, require_adult = FALSE, accepted_conditions = list(),
      require_in_person = FALSE, exclude_session_patterns = list(),
      require_stable_teacher = FALSE, nivel_por_unidad = list(), min_eligible_per_class = 10L
    ),
    criterios_seleccion = list(
      byVariable = list(
        formation = list(mode = "include", categories = list("pregrado"), layer = "marco"),
        condition = list(mode = "include", categories = list("regular"), layer = "marco"),
        age = list(mode = "include", threshold = list(op = ">=", min = 18), layer = "marco"),
        modality = list(mode = "include", categories = list("presencial")),
        session_type = list(
          mode = "include",
          categories = list("teorico_teorico_practico_teorico_laboratorio"),
          exceptions = list("ARTE Y DISENO" = list(categories = list("taller", "artistico"), op = "add"))
        ),
        teacher_type = list(mode = "include", match = "any",
                            categories = list("docente_contratado", "docente_ordinario"))
      ),
      courseLevelRanges = mapa
    )
  )
  res <- calc_muestra_aulas_construir(base_madre = est, catalogo_curso_horario = ch, config = cfg)
  marco <- res$perfil$marco_aulas
  message(sprintf("[gated] marco=%d (objetivo 2483, dif %+d)  poblacion_n=%d (objetivo 21365)",
                  marco, marco - 2483L, res$perfil$poblacion_n))

  # La población objetivo (scope alumno) clava el número canónico EXACTO.
  expect_identical(res$perfil$poblacion_n, 21365L)
  # El marco clava 2483 salvo el −2 estructural (marco sobre aulas con elegibles
  # vs catálogo puro). Banda estrecha documentada; valor exacto en el mensaje.
  expect_lte(abs(marco - 2483L), 5L)
})
