# «Tipo de sesión por facultad» (asesoría muestral §4 y §12): el catálogo de
# criterios gana el desglose `por_facultad` en las categorías flat de AULA, y
# el frame gana el bloque estructural `session_type_impacto`
# (cm_session_type_impacto_v1) — el guard de la trampa de la doble selección
# del taller (excluir taller global + exceptuarlo en Arte y Diseño perdía los
# talleres de EEGG en silencio). También fija la precedencia única suite > H9.
#
# Fixture sintético de 4 CH en 3 facultades. ART1 se repite POR CARRERA (dos
# carreras, 4 filas) a propósito: el desglose debe contar CH deduplicados por
# classroom_id, nunca filas de alumnos. El tipo agrupado estilo DTI
# ("TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)") ejerce el caso real 2025.

.stf_fila <- function(aula, fac, carrera, tipo, cond_curso, n, prefijo) {
  data.frame(
    codigo_alumno = paste0(prefijo, seq_len(n)),
    curso_horario = aula,
    facultad = fac,
    carrera = carrera,
    tipo_de_curso = tipo,
    condicion_del_curso = cond_curso,
    nivel = "3",
    sexo = rep(c("F", "M"), length.out = n),
    stringsAsFactors = FALSE
  )
}

.stf_dti <- "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)"

.stf_base <- function() {
  rbind(
    # ART1: el MISMO CH repetido por dos carreras (4 filas, 4 alumnos, 1 CH).
    .stf_fila("ART1-H1", "ARTE Y DISEÑO", "ESCULTURA", "TALLER", "OBLIGATORIO", 2, "a"),
    .stf_fila("ART1-H1", "ARTE Y DISEÑO", "PINTURA", "TALLER", "OBLIGATORIO", 2, "b"),
    .stf_fila("EG1-H1", "ESTUDIOS GENERALES", "GENERALES", "TALLER", "OBLIGATORIO", 3, "c"),
    .stf_fila("EG2-H1", "ESTUDIOS GENERALES", "GENERALES", .stf_dti, "", 2, "d"),
    .stf_fila("CI1-H1", "CIENCIAS", "FISICA", .stf_dti, "", 2, "e")
  )
}

.stf_config <- function(criterios = NULL, filters = list()) {
  base_filters <- list(
    require_adult = FALSE, require_undergraduate = FALSE,
    require_in_person = FALSE, accepted_conditions = list(),
    exclude_session_patterns = list(), min_eligible_per_class = 1L
  )
  for (nm in names(filters)) base_filters[[nm]] <- filters[[nm]]
  cfg <- list(
    mapping = list(
      student_id = "codigo_alumno", classroom_id = "curso_horario",
      faculty = "facultad", program = "carrera",
      session_type = "tipo_de_curso", condicion_curso = "condicion_del_curso",
      level = "nivel", sex = "sexo"
    ),
    filters = base_filters
  )
  if (!is.null(criterios)) cfg$criterios_seleccion <- criterios
  cfg
}

# Suite canónica de la trampa §12: taller excluido GLOBAL + excepción SOLO en
# Arte y Diseño (replace-vacío: en ARTE no se excluye nada ⇒ taller vuelve).
.stf_seleccion_taller <- function() {
  list(byVariable = list(
    session_type = list(
      mode = "exclude",
      categories = list("taller"),
      exceptions = list("ARTE Y DISEÑO" = list(op = "replace", categories = list()))
    )
  ))
}

.stf_frame <- function(criterios = NULL, filters = list()) {
  calc_muestra_aulas_construir(
    base_madre = .stf_base(),
    config = .stf_config(criterios = criterios, filters = filters)
  )
}

.stf_var <- function(frame, id) {
  vars <- frame$criterios_catalogo$variables
  hit <- Filter(function(v) identical(v$id, id), vars)
  if (!length(hit)) return(NULL)
  hit[[1]]
}

.stf_cat <- function(var, key) {
  hit <- Filter(function(c) identical(c$key, key), var$categories)
  if (!length(hit)) return(NULL)
  hit[[1]]
}

.stf_pf_map <- function(cat) {
  stats::setNames(
    vapply(cat$por_facultad, function(r) r$ch, integer(1)),
    vapply(cat$por_facultad, function(r) r$facultad, character(1))
  )
}

# --- Catálogo: por_facultad -----------------------------------------------

test_that("por_facultad suma la categoría, dedup por CH y agrupadas DTI intactas", {
  frame <- .stf_frame()
  st <- .stf_var(frame, "session_type")
  expect_false(is.null(st))

  # Dedup: ART1 tiene 4 filas (2 carreras) pero es UN CH -> taller = 2 aulas.
  taller <- .stf_cat(st, "taller")
  expect_identical(taller$aulas, 2L)
  pf <- .stf_pf_map(taller)
  expect_setequal(names(pf), c("ARTE Y DISEÑO", "ESTUDIOS GENERALES"))
  expect_identical(unname(pf[["ARTE Y DISEÑO"]]), 1L)
  expect_identical(unname(pf[["ESTUDIOS GENERALES"]]), 1L)
  expect_identical(sum(pf), taller$aulas)

  # Categoría AGRUPADA estilo DTI: funciona tal cual (una sola clave plegada).
  dti <- .stf_cat(st, "teorico_teorico_practico_teorico_laboratorio")
  expect_false(is.null(dti))
  expect_identical(dti$aulas, 2L)
  pf_dti <- .stf_pf_map(dti)
  expect_setequal(names(pf_dti), c("ESTUDIOS GENERALES", "CIENCIAS"))
  expect_identical(sum(pf_dti), dti$aulas)

  # Invariante global: en TODA categoría flat de aula, sum(por_facultad$ch) ==
  # aulas (el fixture trae facultad para todos los CH).
  for (v in frame$criterios_catalogo$variables) {
    if (!identical(v$scope, "aula") || !identical(v$kind, "flat")) next
    if (identical(v$id, "teacher_type")) next # colapso plano, sin desglose
    for (categoria in v$categories) {
      expect_false(is.null(categoria$por_facultad))
      suma <- sum(vapply(categoria$por_facultad, function(r) r$ch, integer(1)))
      expect_identical(suma, as.integer(categoria$aulas))
    }
  }
})

test_that("el bucket sintético sin_condicion también gana por_facultad", {
  frame <- .stf_frame()
  cc <- .stf_var(frame, "condicion_curso")
  expect_false(is.null(cc))
  bucket <- .stf_cat(cc, "sin_condicion")
  expect_true(isTRUE(bucket$synthetic))
  expect_identical(bucket$aulas, 2L)
  pf <- .stf_pf_map(bucket)
  expect_setequal(names(pf), c("ESTUDIOS GENERALES", "CIENCIAS"))
  expect_identical(sum(pf), bucket$aulas)
  # Y la categoría real conserva su invariante.
  obligatorio <- .stf_cat(cc, "obligatorio")
  expect_identical(sum(.stf_pf_map(obligatorio)), obligatorio$aulas)
})

test_that("el scope alumno mantiene su shape: sin por_facultad", {
  frame <- .stf_frame()
  fac <- .stf_var(frame, "faculty")
  expect_false(is.null(fac))
  for (categoria in fac$categories) expect_null(categoria$por_facultad)
})

# --- Impacto: cm_session_type_impacto_v1 ------------------------------------

test_that("impacto §12: taller excluido global + excepción en ARTE ⇒ perdido_en trae EEGG y no ARTE", {
  frame <- .stf_frame(criterios = .stf_seleccion_taller())
  imp <- frame$session_type_impacto
  expect_identical(imp$schema, "cm_session_type_impacto_v1")
  expect_length(imp$tipos_excluidos, 1L)
  t1 <- imp$tipos_excluidos[[1]]
  expect_identical(t1$tipo, "taller")
  expect_identical(t1$label, "TALLER")

  # Presencia: dónde EXISTE el tipo (CH dedup + suma de eligible_n del frame).
  facs <- vapply(t1$facultades, function(f) f$facultad, character(1))
  expect_setequal(facs, c("ARTE Y DISEÑO", "ESTUDIOS GENERALES"))
  arte <- t1$facultades[[match("ARTE Y DISEÑO", facs)]]
  expect_identical(arte$ch, 1L)
  expect_identical(arte$elegibles, 4L)

  # La excepción re-incluye en ARTE; la pérdida REAL queda solo en EEGG.
  expect_identical(unlist(t1$exceptuado_en), "ARTE Y DISEÑO")
  expect_length(t1$perdido_en, 1L)
  expect_identical(t1$perdido_en[[1]]$facultad, "ESTUDIOS GENERALES")
  expect_identical(t1$perdido_en[[1]]$ch, 1L)
  expect_identical(t1$perdido_en[[1]]$elegibles, 3L)

  # El marco refleja el mismo guard: ART1 entra, EG1 cae por session_type.
  af <- frame$aula_frame
  expect_true(af$included[af$classroom_id == "ART1-H1"])
  expect_false(af$included[af$classroom_id == "EG1-H1"])
  expect_match(af$exclude_reason[af$classroom_id == "EG1-H1"], "session_type")

  # Sin mapa legacy no hay nota de precedencia.
  expect_null(imp$legacy_h9_ignorado)
})

test_that("impacto con categoría agrupada DTI excluida: el tipo viaja con su clave plegada", {
  frame <- .stf_frame(criterios = list(byVariable = list(
    session_type = list(
      mode = "exclude",
      categories = list("teorico_teorico_practico_teorico_laboratorio")
    )
  )))
  imp <- frame$session_type_impacto
  expect_length(imp$tipos_excluidos, 1L)
  t1 <- imp$tipos_excluidos[[1]]
  expect_identical(t1$tipo, "teorico_teorico_practico_teorico_laboratorio")
  expect_identical(t1$label, .stf_dti)
  facs <- vapply(t1$perdido_en, function(f) f$facultad, character(1))
  expect_setequal(facs, c("ESTUDIOS GENERALES", "CIENCIAS"))
  expect_length(t1$exceptuado_en, 0L)
})

test_that("sin exclusiones o sin criterio session_type activo ⇒ tipos_excluidos vacío", {
  # Sin suite y sin patrones legacy: nada que medir.
  imp <- .stf_frame()$session_type_impacto
  expect_identical(imp$schema, "cm_session_type_impacto_v1")
  expect_identical(imp$tipos_excluidos, list())

  # Suite activa SIN criterio session_type: la dimensión no filtra (suite
  # manda), aunque lleguen patrones legacy — quedan neutralizados.
  imp2 <- .stf_frame(
    criterios = list(byVariable = list(
      modality = list(mode = "include", categories = list("presencial"))
    )),
    filters = list(exclude_session_patterns = list("taller"))
  )$session_type_impacto
  expect_identical(imp2$tipos_excluidos, list())
  expect_null(imp2$legacy_h9_ignorado)
})

test_that("precedencia única suite > H9: el mapa legacy se ignora con nota, no error", {
  frame <- .stf_frame(
    criterios = .stf_seleccion_taller(),
    filters = list(
      exclude_session_patterns = list("taller"),
      # El legacy eximiría EEGG; la suite manda y EEGG pierde igual.
      session_type_excepciones = list("ESTUDIOS GENERALES" = list("taller"))
    )
  )
  af <- frame$aula_frame
  expect_true(af$included[af$classroom_id == "ART1-H1"])
  expect_false(af$included[af$classroom_id == "EG1-H1"])
  expect_match(af$exclude_reason[af$classroom_id == "EG1-H1"], "session_type")

  imp <- frame$session_type_impacto
  expect_true(isTRUE(imp$legacy_h9_ignorado))
  expect_true(nzchar(imp$nota))
  expect_length(imp$tipos_excluidos, 1L)
  perd <- imp$tipos_excluidos[[1]]$perdido_en
  expect_identical(vapply(perd, function(f) f$facultad, character(1)), "ESTUDIOS GENERALES")
})

test_that("path legacy H9 (sin suite): exención por unidad y pérdida real medida", {
  frame <- .stf_frame(filters = list(
    exclude_session_patterns = list("taller"),
    session_type_excepciones = list("ARTE Y DISEÑO" = list("taller"))
  ))
  af <- frame$aula_frame
  expect_true(af$included[af$classroom_id == "ART1-H1"])   # H9 exime en ARTE
  expect_false(af$included[af$classroom_id == "EG1-H1"])   # cae (0 elegibles)

  imp <- frame$session_type_impacto
  expect_length(imp$tipos_excluidos, 1L)
  t1 <- imp$tipos_excluidos[[1]]
  expect_identical(t1$tipo, "taller")
  expect_identical(unlist(t1$exceptuado_en), "ARTE Y DISEÑO")
  expect_length(t1$perdido_en, 1L)
  expect_identical(t1$perdido_en[[1]]$facultad, "ESTUDIOS GENERALES")
  expect_identical(t1$perdido_en[[1]]$ch, 1L)
  # En el path legacy el recorte fue POR FILA: los CH del tipo ya cayeron a
  # eligible_n = 0; la señal del guard es `ch` (elegibles refleja el frame).
  expect_identical(t1$perdido_en[[1]]$elegibles, 0L)
  expect_null(imp$legacy_h9_ignorado)
})
