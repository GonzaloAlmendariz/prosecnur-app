# Validación EXHAUSTIVA del motor de marco universitario (mesa "aulas"):
# el mapeo de criterios y sus MÚLTIPLES COMBINACIONES deben producir un N de
# elegibles VÁLIDO y consistente. Esta suite no confía en números mágicos: un
# ORÁCULO independiente (predicados en R base sobre los atributos crudos de la
# base sintética) computa el N esperado y se contrasta contra el N que emite el
# motor, que llega por un camino totalmente distinto (text_key, dedup por
# estudiante, evaluación de la suite criterios_seleccion en dos scopes).
#
# La preocupación central: que restringir/relajar criterios (población de
# estudiantes × marco de curso-horario) mueva el N de forma MONOTÓNICA y
# PREDECIBLE, que "sin restricción" devuelva el universo y que cada dimensión
# opere sobre SU columna (teacher_type sobre "Tipo de docente", course_level
# sobre "Nivel del curso", condicion_curso sobre "Condición del curso"), nunca
# sobre una homónima.

# =============================================================================
# Base sintética realista: 24 estudiantes únicos en 10 curso-horario, 3
# facultades. Atributos de estudiante (formación/condición/edad/nivel) y de
# aula (docente/nivel del curso/modalidad/tipo/condición del curso) con
# distribuciones CONOCIDAS. Cada estudiante pertenece a un solo curso-horario
# (dedup limpio); la facultad del aula = la de sus miembros.
# =============================================================================

# Atributos por curso-horario (scope aula). La facultad se hereda a los
# estudiantes miembros para que el nivel del curso por facultad sea evaluable.
.vc_aulas <- function() {
  data.frame(
    aula        = paste0("A", 1:10),
    faculty     = c("FACA", "FACA", "FACA", "FACA", "FACB", "FACB", "FACB", "FACB", "FACC", "FACC"),
    tipo_docente = c("ORDINARIO", "CONTRATADO", "ORDINARIO", "CONTRATADO",
                     "CACHIMBO", "JEFE DE PRACTICA", "ORDINARIO", "CONTRATADO",
                     "ORDINARIO", "CONTRATADO"),
    nivel_curso  = c(1, 3, 5, 7, 9, 2, 4, 6, 10, 8),
    modalidad    = c("Presencial", "Presencial", "Presencial", "Presencial",
                     "Presencial", "Presencial", "Virtual", "Virtual",
                     "Presencial", "Presencial"),
    tipo_curso   = c("TEORICO", "TEORICO", "TEORICO", "SEMINARIO",
                     "TEORICO", "TEORICO", "TEORICO", "TEORICO",
                     "SEMINARIO", "TEORICO"),
    cond_curso   = c("OBLIGATORIO", "OBLIGATORIO", "ELECTIVO", "OBLIGATORIO",
                     "ELECTIVO", "OBLIGATORIO", "OBLIGATORIO", "ELECTIVO",
                     "ELECTIVO", "OBLIGATORIO"),
    stringsAsFactors = FALSE
  )
}

# Atributos por estudiante (scope alumno). Membresía 1:1 a un curso-horario.
# Los "flags malos" (posgrado/no-regular/menor de edad) caen en estudiantes
# DISJUNTOS a propósito para que las intersecciones sean legibles a mano; aun
# así el oráculo las recomputa desde estos vectores, no de números fijos.
.vc_estudiantes <- function() {
  aulas <- .vc_aulas()
  membership <- list(
    A1 = c("s1", "s2", "s3"), A2 = c("s4", "s5"), A3 = c("s6", "s7"),
    A4 = c("s8", "s9"), A5 = c("s10", "s11", "s12"), A6 = c("s13", "s14"),
    A7 = c("s15", "s16"), A8 = c("s17", "s18"), A9 = c("s19", "s20", "s21"),
    A10 = c("s22", "s23", "s24")
  )
  rows <- do.call(rbind, lapply(names(membership), function(a) {
    data.frame(
      student_id = membership[[a]],
      aula = a,
      faculty = aulas$faculty[aulas$aula == a],
      stringsAsFactors = FALSE
    )
  }))
  rows <- rows[order(as.integer(sub("^s", "", rows$student_id))), , drop = FALSE]
  rownames(rows) <- NULL

  posgrado <- c("s3", "s9", "s12", "s18", "s19", "s24")   # 6 (formación != pregrado)
  no_reg   <- c("s1", "s10", "s20")                        # 3 (condición != regular)
  menor    <- c("s2", "s13", "s22")                        # 3 (edad < 18)

  rows$formation <- ifelse(rows$student_id %in% posgrado, "MAESTRIA", "PREGRADO")
  rows$condition <- ifelse(rows$student_id %in% no_reg, "POR REINCORPORACION", "Regular")
  rows$edad      <- ifelse(rows$student_id %in% menor, 17L, 20L)
  rows$level     <- rep(1:10, length.out = nrow(rows))     # ciclo curricular del estudiante
  rows$sexo      <- rep(c("F", "M"), length.out = nrow(rows))
  rows
}

# Base madre estudiante×curso-horario (join estudiante + atributos del aula).
.vc_base_madre <- function() {
  est <- .vc_estudiantes()
  aulas <- .vc_aulas()
  # Join por curso-horario (la membresía ya es 1:1 estudiante→aula).
  m <- merge(est, aulas[, c("aula", "tipo_docente", "nivel_curso", "modalidad", "tipo_curso", "cond_curso")],
             by = "aula", all.x = TRUE, sort = FALSE)
  data.frame(
    `Codigo` = m$student_id,
    `Facultad` = m$faculty,
    `Carrera` = paste0(m$faculty, "-P"),
    `Formacion` = m$formation,
    `Condicion` = m$condition,
    `Nivel curricular` = as.character(m$level),
    `Sexo` = m$sexo,
    `Edad` = m$edad,
    `Curso-Horario` = m$aula,
    `Curso` = sub("^A", "C", m$aula),
    `Nombre del curso` = paste("Curso", m$aula),
    `Horario` = "H1",
    `Modalidad` = m$modalidad,
    `Tipo de curso` = m$tipo_curso,
    `Tipo de docente` = m$tipo_docente,
    `Nivel del curso` = as.character(m$nivel_curso),
    `Condicion del curso` = m$cond_curso,
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

# Catálogo curso-horario (modo dos-bases): una fila por curso-horario con las
# señales de aula. La base madre en este modo NO trae Tipo de docente / Nivel
# del curso (viven aquí), replicando el layout real PUCP/UAN.
.vc_catalogo <- function() {
  aulas <- .vc_aulas()
  data.frame(
    `Curso-Horario` = aulas$aula,
    `Curso` = sub("^A", "C", aulas$aula),
    `Nombre del curso` = paste("Curso", aulas$aula),
    `Horario` = "H1",
    `Facultad` = aulas$faculty,
    `Modalidad` = aulas$modalidad,
    `Tipo de curso` = aulas$tipo_curso,
    `Tipo de docente` = aulas$tipo_docente,
    `Nivel del curso` = as.character(aulas$nivel_curso),
    `Condicion` = aulas$cond_curso,
    `Nombre de docente` = paste("Doc", aulas$aula),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

# Base madre para el modo dos-bases: sin las columnas que aporta el catálogo.
.vc_base_madre_dual <- function() {
  full <- .vc_base_madre()
  full[, setdiff(names(full), c("Tipo de docente", "Nivel del curso", "Condicion del curso", "Tipo de curso", "Modalidad")), drop = FALSE]
}

.vc_mapping <- function() {
  list(
    student_id = "Codigo", faculty = "Facultad", program = "Carrera",
    sex = "Sexo", age = "Edad", level = "Nivel curricular",
    course_id = "Curso", classroom_id = "Curso-Horario",
    course_name = "Nombre del curso", schedule = "Horario",
    modality = "Modalidad", condition = "Condicion", formation = "Formacion",
    teacher_type = "Tipo de docente", course_level = "Nivel del curso",
    session_type = "Tipo de curso", condicion_curso = "Condicion del curso"
  )
}

# --- Invocación: construye el frame con la suite dada y devuelve conteos ------

.vc_run <- function(suite = NULL, base = NULL, catalogo = NULL,
                    legacy_off = FALSE, min_eligible = 1L) {
  if (is.null(base)) base <- .vc_base_madre()
  filtros <- list(min_eligible_per_class = as.integer(min_eligible))
  if (legacy_off) {
    filtros <- c(filtros, list(
      require_adult = FALSE, require_undergraduate = FALSE,
      require_in_person = FALSE, accepted_conditions = list()
    ))
  }
  cfg_input <- list(mapping = .vc_mapping(), filters = filtros)
  if (!is.null(suite)) cfg_input$criterios_seleccion <- suite
  cfg <- calc_muestra_aulas_normalize_config(cfg_input)
  frame <- calc_muestra_aulas_construir(base_madre = base, catalogo_curso_horario = catalogo, config = cfg)
  af <- frame$aula_frame
  list(
    frame = frame,
    population_n = as.integer(frame$audit$value[frame$audit$metric == "population_n"]),
    classroom_included_n = as.integer(frame$audit$value[frame$audit$metric == "classroom_included_n"]),
    included = stats::setNames(af$included %in% TRUE, af$classroom_id)
  )
}

# --- Oráculo independiente -----------------------------------------------------
# Predicados sobre los atributos crudos. Reproducen la semántica del motor:
#   - población = estudiantes ÚNICOS que pasan TODOS los criterios de alumno con
#     capa "marco" (formation/condition/age/faculty; level solo si layer=marco).
#   - marco de aulas = curso-horario cuyo criterio de aula pasa Y que conservan
#     >= min_eligible estudiantes ELEGIBLES (tras el recorte de alumno).

.vc_oraculo_poblacion <- function(alumno_pred = function(e) rep(TRUE, nrow(e))) {
  est <- .vc_estudiantes()
  sum(alumno_pred(est))
}

.vc_oraculo_aulas <- function(alumno_pred = function(e) rep(TRUE, nrow(e)),
                              aula_pred = function(a) rep(TRUE, nrow(a)),
                              min_eligible = 1L) {
  est <- .vc_estudiantes()
  aulas <- .vc_aulas()
  elig <- alumno_pred(est)
  est_elig <- est[elig, , drop = FALSE]
  elig_n <- vapply(aulas$aula, function(a) sum(est_elig$aula == a), integer(1))
  aula_ok <- aula_pred(aulas)
  incluida <- aula_ok & (elig_n >= min_eligible)
  stats::setNames(incluida, aulas$aula)
}

# Predicados de alumno reutilizables (sobre el data.frame de .vc_estudiantes).
.p_pregrado <- function(e) e$formation == "PREGRADO"
.p_regular  <- function(e) e$condition == "Regular"
.p_adult    <- function(e) e$edad >= 18
.p_todos    <- function(e) rep(TRUE, nrow(e))
.p_fac      <- function(set) function(e) e$faculty %in% set
.p_level_in <- function(vals) function(e) e$level %in% vals

# Predicados de aula (sobre el data.frame de .vc_aulas).
.a_teacher_stable <- function(a) a$tipo_docente %in% c("ORDINARIO", "CONTRATADO")
.a_presencial     <- function(a) a$modalidad == "Presencial"
.a_teorico        <- function(a) a$tipo_curso == "TEORICO"
.a_oblig          <- function(a) a$cond_curso == "OBLIGATORIO"
.a_level_range    <- function(fac_ranges) function(a) {
  vapply(seq_len(nrow(a)), function(i) {
    rr <- fac_ranges[[a$faculty[[i]]]]
    if (is.null(rr)) return(FALSE)  # facultad ausente del mapa no acredita
    any(vapply(rr, function(r) a$nivel_curso[[i]] >= r[[1]] && a$nivel_curso[[i]] <= r[[2]], logical(1)))
  }, logical(1))
}

# --- Constructores de criterios de la suite ----------------------------------
.crit_flat <- function(cats, mode = "include") list(mode = mode, categories = as.list(cats))
.crit_num  <- function(op, min = NA, max = NA) list(threshold = list(op = op, min = min, max = max))
.crit_ord  <- function(vals, layer = NULL) {
  out <- list(mode = "include", includeValues = as.list(vals))
  if (!is.null(layer)) out$layer <- layer
  out
}

# =============================================================================
# 2. SIN RESTRICCIÓN == UNIVERSO  (set vacío == set completo)
# =============================================================================

test_that("sin restricción devuelve el universo: suite vacía (legacy off) == 24 estudiantes únicos", {
  universo <- .vc_oraculo_poblacion()
  expect_identical(universo, 24L)

  r_vacia <- .vc_run(suite = NULL, legacy_off = TRUE)
  expect_identical(r_vacia$population_n, universo)
  # Sin criterio de aula ninguna se excluye (todas con eligible_n >= 1).
  expect_identical(r_vacia$classroom_included_n, 10L)
})

test_that("suite con TODO incluido == suite vacía (misma N de universo)", {
  suite_all <- list(byVariable = list(
    formation = .crit_flat(c("pregrado", "maestria")),
    condition = .crit_flat(c("regular", "por_reincorporacion")),
    age = .crit_num(">=", min = 0)
  ))
  r_all <- .vc_run(suite = suite_all)
  r_vacia <- .vc_run(suite = NULL, legacy_off = TRUE)
  expect_identical(r_all$population_n, 24L)
  expect_identical(r_all$population_n, r_vacia$population_n)
  # Población total intacta: ningún estudiante recortado por el marco.
  expect_identical(r_all$population_n, .vc_oraculo_poblacion(.p_todos))
})

# =============================================================================
# 3. CANÓNICO EXACTO: pregrado ∧ regular ∧ edad>=18
# =============================================================================

test_that("canónico pregrado ∧ regular ∧ edad>=18 iguala la intersección conocida", {
  suite_canon <- list(byVariable = list(
    formation = .crit_flat("pregrado"),
    condition = .crit_flat("regular"),
    age = .crit_num(">=", min = 18)
  ))
  esperado <- .vc_oraculo_poblacion(function(e) .p_pregrado(e) & .p_regular(e) & .p_adult(e))
  expect_identical(esperado, 12L)  # 24 - (6 posgrado ∪ 3 no-reg ∪ 3 menores, disjuntos)

  r <- .vc_run(suite = suite_canon)
  expect_identical(r$population_n, esperado)
  expect_identical(as.integer(r$frame$perfil$poblacion_n), esperado)
  expect_identical(nrow(r$frame$population), esperado)
})

test_that("cambiar UNA categoría del canónico cambia N de forma predecible", {
  base_suite <- function(edad_min) list(byVariable = list(
    formation = .crit_flat("pregrado"),
    condition = .crit_flat("regular"),
    age = .crit_num(">=", min = edad_min)
  ))
  # Relajar la edad a >=0 revive exactamente a los menores que eran pregrado∧regular.
  r18 <- .vc_run(suite = base_suite(18))
  r0  <- .vc_run(suite = base_suite(0))
  esp18 <- .vc_oraculo_poblacion(function(e) .p_pregrado(e) & .p_regular(e) & .p_adult(e))
  esp0  <- .vc_oraculo_poblacion(function(e) .p_pregrado(e) & .p_regular(e))
  expect_identical(r18$population_n, esp18)
  expect_identical(r0$population_n, esp0)
  expect_gte(r0$population_n, r18$population_n)  # relajar nunca baja N
  # Quitar la restricción de formación (incluir también maestría) sube N.
  suite_con_maestria <- list(byVariable = list(
    formation = .crit_flat(c("pregrado", "maestria")),
    condition = .crit_flat("regular"),
    age = .crit_num(">=", min = 18)
  ))
  r_form <- .vc_run(suite = suite_con_maestria)
  esp_form <- .vc_oraculo_poblacion(function(e) .p_regular(e) & .p_adult(e))
  expect_identical(r_form$population_n, esp_form)
  expect_gte(r_form$population_n, r18$population_n)
})

# =============================================================================
# 4. MAPEO CORRECTO: cada criterio opera sobre SU columna
# =============================================================================

test_that("teacher_type opera sobre 'Tipo de docente', no sobre 'Condición' del estudiante", {
  # Adversarial: la condición del estudiante NO contiene 'ordinario'/'contratado';
  # si el criterio leyera esa columna, incluir {ordinario,contratado} vaciaría
  # el marco. Como lee 'Tipo de docente', incluye las 8 aulas con docente estable.
  suite <- list(byVariable = list(
    teacher_type = .crit_flat(c("ordinario", "contratado"))
  ))
  r <- .vc_run(suite = suite)
  esperado <- .vc_oraculo_aulas(aula_pred = .a_teacher_stable)
  expect_identical(r$included, esperado)
  expect_identical(r$classroom_included_n, sum(esperado))
  expect_identical(r$classroom_included_n, 8L)  # caen A5 (cachimbo) y A6 (jp)
  expect_false(r$included[["A5"]]); expect_false(r$included[["A6"]])
  # La población NO se toca: teacher_type es scope aula.
  expect_identical(r$population_n, 24L)
})

test_that("course_level opera sobre 'Nivel del curso', no sobre el código de 'Curso'", {
  # Rangos por facultad: FACA/FACB niveles 1-5, FACC nunca (ausente del mapa).
  fac_ranges <- list(FACA = list(list(min = 1, max = 5)), FACB = list(list(min = 1, max = 5)))
  suite <- list(courseLevelRanges = fac_ranges)
  r <- .vc_run(suite = suite)
  esperado <- .vc_oraculo_aulas(aula_pred = .a_level_range(list(
    FACA = list(c(1, 5)), FACB = list(c(1, 5))
  )))
  expect_identical(r$included, esperado)
  # Niveles del curso: A1=1,A2=3,A3=5 (FACA in range); A6=2,A7=4 (FACB in range).
  # A4=7,A5=9 fuera; A8=6 fuera; A9/A10 FACC no mapeada.
  expect_identical(sort(names(which(r$included))), c("A1", "A2", "A3", "A6", "A7"))
  expect_identical(r$classroom_included_n, 5L)
})

test_that("condicion_curso es su propio criterio (no la condición del estudiante)", {
  suite <- list(byVariable = list(condicion_curso = .crit_flat("obligatorio")))
  r <- .vc_run(suite = suite)
  esperado <- .vc_oraculo_aulas(aula_pred = .a_oblig)
  expect_identical(r$included, esperado)
  # Obligatorio: A1,A2,A4,A6,A7,A10 (6). Electivo: A3,A5,A8,A9.
  expect_identical(sort(names(which(r$included))), c("A1", "A10", "A2", "A4", "A6", "A7"))
  expect_identical(r$classroom_included_n, 6L)
  # La población intacta: es scope aula, no reduce N de estudiantes.
  expect_identical(r$population_n, 24L)
})

test_that("level (ciclo del estudiante) por defecto es capa instrumento y NO reduce el marco; con capa marco sí", {
  vals <- list(1, 2, 3)
  # Capa por defecto (instrumento): reporta pero no recorta la población.
  r_inst <- .vc_run(suite = list(byVariable = list(level = .crit_ord(vals))))
  expect_identical(r_inst$population_n, 24L)
  # Capa marco: recorta a los estudiantes con nivel en {1,2,3}.
  r_marco <- .vc_run(suite = list(byVariable = list(level = .crit_ord(vals, layer = "marco"))))
  esperado <- .vc_oraculo_poblacion(.p_level_in(c(1, 2, 3)))
  expect_identical(r_marco$population_n, esperado)
  expect_lt(r_marco$population_n, r_inst$population_n)
})

# =============================================================================
# 1 + 5. MONOTONICIDAD y COMBINACIONES CRUZADAS (estudiante × curso-horario)
# =============================================================================

test_that("monotonicidad de la población: agregar restricciones nunca sube N, quitarlas nunca lo baja", {
  n_todos     <- .vc_run(suite = NULL, legacy_off = TRUE)$population_n
  n_pre       <- .vc_run(suite = list(byVariable = list(formation = .crit_flat("pregrado"))))$population_n
  n_pre_reg   <- .vc_run(suite = list(byVariable = list(
    formation = .crit_flat("pregrado"), condition = .crit_flat("regular")
  )))$population_n
  n_pre_reg_ad <- .vc_run(suite = list(byVariable = list(
    formation = .crit_flat("pregrado"), condition = .crit_flat("regular"), age = .crit_num(">=", 18)
  )))$population_n

  # Cadena de restricciones crecientes: N no crece nunca.
  expect_true(n_todos >= n_pre)
  expect_true(n_pre >= n_pre_reg)
  expect_true(n_pre_reg >= n_pre_reg_ad)

  # Cada eslabón contra su oráculo.
  expect_identical(n_todos, .vc_oraculo_poblacion(.p_todos))
  expect_identical(n_pre, .vc_oraculo_poblacion(.p_pregrado))
  expect_identical(n_pre_reg, .vc_oraculo_poblacion(function(e) .p_pregrado(e) & .p_regular(e)))
  expect_identical(n_pre_reg_ad, .vc_oraculo_poblacion(function(e) .p_pregrado(e) & .p_regular(e) & .p_adult(e)))
})

test_that("monotonicidad del marco de aulas: estrechar un set/rango nunca sube el N de CH incluidos", {
  # teacher_type: universo de grupos -> quitar categorías reduce (o iguala).
  n_todos_doc <- .vc_run(suite = list(byVariable = list(
    teacher_type = .crit_flat(c("ordinario", "contratado", "cachimbo", "jefe_de_practica"))
  )))$classroom_included_n
  n_estable   <- .vc_run(suite = list(byVariable = list(
    teacher_type = .crit_flat(c("ordinario", "contratado"))
  )))$classroom_included_n
  n_ordinario <- .vc_run(suite = list(byVariable = list(
    teacher_type = .crit_flat("ordinario")
  )))$classroom_included_n
  expect_true(n_todos_doc >= n_estable)
  expect_true(n_estable >= n_ordinario)
  expect_identical(n_todos_doc, 10L)
  expect_identical(n_estable, 8L)
  expect_identical(n_ordinario, sum(.vc_oraculo_aulas(aula_pred = function(a) a$tipo_docente == "ORDINARIO")))

  # course_level: ensanchar el rango nunca baja el N incluido.
  n_1_5  <- .vc_run(suite = list(courseLevelRanges = list(FACA = list(list(min = 1, max = 5)), FACB = list(list(min = 1, max = 5)), FACC = list(list(min = 1, max = 5)))))$classroom_included_n
  n_1_10 <- .vc_run(suite = list(courseLevelRanges = list(FACA = list(list(min = 1, max = 10)), FACB = list(list(min = 1, max = 10)), FACC = list(list(min = 1, max = 10)))))$classroom_included_n
  expect_true(n_1_10 >= n_1_5)
  expect_identical(n_1_10, 10L)  # todos los niveles 1..10 dentro
})

test_that("combinaciones cruzadas estudiante × curso-horario: N de población y de CH calzan con el oráculo", {
  # Cada caso: (predicado alumno, predicado aula, suite). El oráculo combinado
  # respeta que un aula sin elegibles cae por min_eligible aunque pase el
  # criterio de aula.
  casos <- list(
    list(
      nombre = "pregrado + docente estable",
      suite = list(byVariable = list(formation = .crit_flat("pregrado"),
                                     teacher_type = .crit_flat(c("ordinario", "contratado")))),
      alumno = .p_pregrado, aula = .a_teacher_stable
    ),
    list(
      nombre = "regular + presencial",
      suite = list(byVariable = list(condition = .crit_flat("regular"),
                                     modality = .crit_flat("presencial"))),
      alumno = .p_regular, aula = .a_presencial
    ),
    list(
      nombre = "adulto + teorico",
      suite = list(byVariable = list(age = .crit_num(">=", 18),
                                     session_type = .crit_flat("teorico"))),
      alumno = .p_adult, aula = .a_teorico
    ),
    list(
      nombre = "pregrado∧regular + obligatorio",
      suite = list(byVariable = list(formation = .crit_flat("pregrado"),
                                     condition = .crit_flat("regular"),
                                     condicion_curso = .crit_flat("obligatorio"))),
      alumno = function(e) .p_pregrado(e) & .p_regular(e), aula = .a_oblig
    ),
    list(
      nombre = "canónico + presencial + docente estable",
      suite = list(byVariable = list(formation = .crit_flat("pregrado"),
                                     condition = .crit_flat("regular"),
                                     age = .crit_num(">=", 18),
                                     modality = .crit_flat("presencial"),
                                     teacher_type = .crit_flat(c("ordinario", "contratado")))),
      alumno = function(e) .p_pregrado(e) & .p_regular(e) & .p_adult(e),
      aula = function(a) .a_presencial(a) & .a_teacher_stable(a)
    ),
    list(
      nombre = "facultad FACA/FACB + teorico",
      suite = list(byVariable = list(faculty = .crit_flat(c("faca", "facb")),
                                     session_type = .crit_flat("teorico"))),
      alumno = .p_fac(c("FACA", "FACB")), aula = .a_teorico
    ),
    list(
      nombre = "facultad FACA + presencial + obligatorio",
      suite = list(byVariable = list(faculty = .crit_flat("faca"),
                                     modality = .crit_flat("presencial"),
                                     condicion_curso = .crit_flat("obligatorio"))),
      alumno = .p_fac("FACA"), aula = function(a) .a_presencial(a) & .a_oblig(a)
    ),
    list(
      nombre = "canónico + course_level 1-5 (FACA/FACB)",
      suite = list(byVariable = list(formation = .crit_flat("pregrado"),
                                     condition = .crit_flat("regular"),
                                     age = .crit_num(">=", 18)),
                   courseLevelRanges = list(FACA = list(list(min = 1, max = 5)), FACB = list(list(min = 1, max = 5)))),
      alumno = function(e) .p_pregrado(e) & .p_regular(e) & .p_adult(e),
      aula = .a_level_range(list(FACA = list(c(1, 5)), FACB = list(c(1, 5))))
    )
  )

  for (caso in casos) {
    r <- .vc_run(suite = caso$suite)
    esp_pob <- .vc_oraculo_poblacion(caso$alumno)
    esp_aulas <- .vc_oraculo_aulas(alumno_pred = caso$alumno, aula_pred = caso$aula)
    expect_identical(r$population_n, esp_pob,
                     info = paste("población:", caso$nombre))
    expect_identical(r$included, esp_aulas,
                     info = paste("aulas incluidas:", caso$nombre))
    expect_identical(r$classroom_included_n, sum(esp_aulas),
                     info = paste("conteo CH:", caso$nombre))
    # Validez estructural: N de población nunca excede el universo ni baja de 0.
    expect_true(r$population_n >= 0 && r$population_n <= 24,
                info = paste("rango N:", caso$nombre))
  }
})

# =============================================================================
# 6. IDEMPOTENCIA / DETERMINISMO
# =============================================================================

test_that("construir dos veces con la misma config produce el mismo N (determinista)", {
  suite <- list(byVariable = list(
    formation = .crit_flat("pregrado"),
    condition = .crit_flat("regular"),
    age = .crit_num(">=", 18),
    teacher_type = .crit_flat(c("ordinario", "contratado")),
    modality = .crit_flat("presencial")
  ), courseLevelRanges = list(FACA = list(list(min = 1, max = 6))))

  r1 <- .vc_run(suite = suite)
  r2 <- .vc_run(suite = suite)
  expect_identical(r1$population_n, r2$population_n)
  expect_identical(r1$classroom_included_n, r2$classroom_included_n)
  expect_identical(r1$included, r2$included)
})

# =============================================================================
# Modo DOS BASES (base madre + catálogo): el mapeo desde el catálogo produce el
# mismo marco que el modo base madre única.
# =============================================================================

test_that("dos bases: la suite de aula desde el catálogo iguala el marco de base madre única", {
  suite <- list(byVariable = list(
    teacher_type = .crit_flat(c("ordinario", "contratado")),
    modality = .crit_flat("presencial")
  ))
  r_madre <- .vc_run(suite = suite)
  r_dual <- .vc_run(suite = suite, base = .vc_base_madre_dual(), catalogo = .vc_catalogo())

  expect_identical(r_dual$population_n, r_madre$population_n)
  expect_identical(r_dual$included, r_madre$included)
  esperado <- .vc_oraculo_aulas(aula_pred = function(a) .a_teacher_stable(a) & .a_presencial(a))
  expect_identical(r_dual$included, esperado)
})
