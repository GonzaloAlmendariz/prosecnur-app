# Regresión del contrato proyecto -> criterios_seleccion -> embudo_aula.
#
# El fixture evita los filtros legacy: todas las decisiones del marco de
# cursos-horario viven en criterios_seleccion. Así, cada paso y su etiqueta
# deben describir la selección confirmada por el proyecto, no un preset fijo.

.emb_dyn_estudiantes <- function(aula, n = 12L) {
  data.frame(
    codigo_alumno = paste0(aula, "_s", seq_len(n)),
    curso_horario = aula,
    facultad = "FACULTAD 1",
    formacion = "PREGRADO",
    condicion = "REGULAR",
    edad = 20,
    nivel = "3",
    sexo = rep(c("F", "M"), length.out = n),
    stringsAsFactors = FALSE
  )
}

.emb_dyn_catalogo <- function(aula, modalidad, sesion, docente, nivel) {
  data.frame(
    curso_horario = aula,
    facultad_del_curso = "FACULTAD 1",
    modalidad = modalidad,
    tipo = sesion,
    tipo_docente = docente,
    nivel = nivel,
    # Deliberadamente 30 para todas las unidades: el mínimo debe usar
    # eligible_n (filas elegibles), no este total administrativo.
    matriculados = 30L,
    stringsAsFactors = FALSE
  )
}

.emb_dyn_fixture <- function() {
  especificacion <- list(
    # Única unidad que satisface todos los criterios.
    list("V_OK",   12L, "VIRTUAL",    "TALLER",    "DOCENTE CONTRATADO - CONTRATADO", "6"),
    # Cada fila siguiente falla exactamente en el criterio indicado.
    list("P_MOD",  12L, "PRESENCIAL", "TALLER",    "DOCENTE CONTRATADO - CONTRATADO", "6"),
    list("V_SES",  12L, "VIRTUAL",    "SEMINARIO", "DOCENTE CONTRATADO - CONTRATADO", "6"),
    list("V_DOC",  12L, "VIRTUAL",    "TALLER",    "DOCENTE EXTRAORDINARIO - VISITANTE", "6"),
    list("V_NIV",  12L, "VIRTUAL",    "TALLER",    "DOCENTE CONTRATADO - CONTRATADO", "2"),
    # Tiene 30 matriculados declarados, pero solo 5 alumnos elegibles.
    list("V_MIN",   5L, "VIRTUAL",    "TALLER",    "DOCENTE CONTRATADO - CONTRATADO", "6")
  )

  list(
    estudiantes = do.call(rbind, lapply(especificacion, function(x) {
      .emb_dyn_estudiantes(x[[1]], x[[2]])
    })),
    catalogo = do.call(rbind, lapply(especificacion, function(x) {
      .emb_dyn_catalogo(x[[1]], x[[3]], x[[4]], x[[5]], x[[6]])
    }))
  )
}

.emb_dyn_config <- function() {
  list(
    mapping = list(
      faculty = c("facultad_del_curso"),
      enrolled_total = c("matriculados")
    ),
    filters = list(
      require_undergraduate = FALSE,
      require_adult = FALSE,
      require_in_person = FALSE,
      exclude_session_patterns = list(),
      accepted_conditions = list(),
      # No debe gobernar el paso: la autoridad es minEligible = 10.
      min_eligible_per_class = 1L
    ),
    criterios_seleccion = list(
      byVariable = list(
        modality = list(mode = "include", categories = list("virtual")),
        session_type = list(mode = "include", categories = list("taller")),
        teacher_type = list(
          mode = "include", match = "any",
          categories = list("docente_contratado")
        )
      ),
      courseLevelRanges = list(
        "FACULTAD 1" = list(list(min = 5, max = 10))
      ),
      minEligible = list(threshold = 10)
    )
  )
}

test_that("embudo_aula deriva pasos, etiquetas y conteos de criterios_seleccion", {
  fx <- .emb_dyn_fixture()
  frame <- calc_muestra_aulas_construir(
    base_madre = fx$estudiantes,
    catalogo_curso_horario = fx$catalogo,
    config = .emb_dyn_config()
  )

  embudo <- frame$perfil$embudo_aula
  labels <- tolower(iconv(embudo$label, to = "ASCII//TRANSLIT"))

  # Un paso acumulativo por cada decisión del proyecto, en el orden del
  # registro de criterios de aula. No se exigen frases heredadas exactas: solo
  # que la etiqueta nombre la variable y/o el valor efectivamente seleccionado.
  expect_length(embudo$id, 6L) # total + modalidad + sesión + docente + nivel + mínimo
  expect_match(labels[[2]], "virtual")
  expect_match(labels[[3]], "taller")
  expect_match(labels[[4]], "docente.*contratado|contratado.*docente")
  expect_match(labels[[5]], "nivel")
  expect_match(labels[[5]], "5")
  expect_match(labels[[5]], "10")
  expect_match(labels[[6]], "10")
  expect_match(labels[[6]], "elegible")

  # Cada criterio elimina exactamente una unidad. V_MIN debe caer por sus 5
  # elegibles aunque el catálogo declare 30 matriculados.
  expect_identical(as.integer(embudo$conteo), 6:1)
  incluidas <- frame$aula_frame$classroom_id[frame$aula_frame$included %in% TRUE]
  expect_identical(incluidas, "V_OK")
  expect_identical(utils::tail(embudo$conteo, 1L), frame$perfil$marco_aulas)
})

test_that("minEligible por facultad puede ser menor que el umbral global sin prefiltro", {
  fx <- .emb_dyn_fixture()
  cfg <- .emb_dyn_config()
  cfg$criterios_seleccion$minEligible$byFaculty <- list("FACULTAD 1" = 5)

  frame <- calc_muestra_aulas_construir(
    base_madre = fx$estudiantes,
    catalogo_curso_horario = fx$catalogo,
    config = cfg
  )

  # V_MIN tiene eligible_n = 5: debe pasar el override de su facultad aunque el
  # umbral global sea 10. Un prefiltro global previo a la suite no puede dejarla
  # fuera de forma irreversible.
  incluidas <- sort(frame$aula_frame$classroom_id[frame$aula_frame$included %in% TRUE])
  expect_identical(incluidas, c("V_MIN", "V_OK"))

  embudo <- frame$perfil$embudo_aula
  paso_min <- embudo[embudo$id == "minEligible", , drop = FALSE]
  expect_identical(nrow(paso_min), 1L)
  expect_identical(paso_min$conteo, 2L)
  expect_match(tolower(paso_min$label), "general.*10")
  expect_match(tolower(paso_min$label), "facultad 1.*5")
  expect_identical(utils::tail(embudo$conteo, 1L), frame$perfil$marco_aulas)
})

test_that("c7 activo aparece después de minEligible sin contaminar su conteo previo", {
  fx <- .emb_dyn_fixture()
  fx$estudiantes$matriculados <- 30L
  cfg <- .emb_dyn_config()
  cfg$filters$require_min_prevalence <- TRUE
  cfg$filters$min_prevalence_pct <- 0.50

  frame <- calc_muestra_aulas_construir(
    base_madre = fx$estudiantes,
    catalogo_curso_horario = fx$catalogo,
    config = cfg
  )

  embudo <- frame$perfil$embudo_aula
  ids <- as.character(embudo$id)
  idx_min <- match("minEligible", ids)
  idx_c7 <- match("c7", ids)

  expect_false(is.na(idx_min))
  expect_false(is.na(idx_c7))
  expect_identical(idx_c7, idx_min + 1L)
  # Antes de c7 queda V_OK. Su prevalencia es 12/30 = 40%, por lo que c7 al
  # 50% la excluye recién en su propio paso.
  expect_identical(embudo$conteo[[idx_min]], 1L)
  expect_identical(embudo$conteo[[idx_c7]], 0L)
  expect_identical(utils::tail(embudo$conteo, 1L), frame$perfil$marco_aulas)
})

test_that("suite activa neutraliza el filtro legacy de docente", {
  fx <- .emb_dyn_fixture()
  cfg <- .emb_dyn_config()
  # Contradicción deliberada: el legacy solo acepta ordinarios, mientras la
  # selección confirmada del proyecto acepta docentes contratados.
  cfg$filters$require_stable_teacher <- TRUE
  cfg$filters$accepted_teacher_type_patterns <- list("docente_ordinario")

  frame <- calc_muestra_aulas_construir(
    base_madre = fx$estudiantes,
    catalogo_curso_horario = fx$catalogo,
    config = cfg
  )

  # La suite es la autoridad: V_OK satisface docente_contratado y debe conservar
  # el mismo marco que el caso sin flags legacy contradictorios.
  incluidas <- frame$aula_frame$classroom_id[frame$aula_frame$included %in% TRUE]
  expect_identical(incluidas, "V_OK")
  expect_identical(frame$perfil$marco_aulas, 1L)

  embudo <- frame$perfil$embudo_aula
  expect_false("docente" %in% embudo$id)
  paso_docente <- embudo[embudo$id == "teacher_type", , drop = FALSE]
  expect_identical(nrow(paso_docente), 1L)
  expect_match(tolower(paso_docente$label), "contratado")
  expect_false(grepl("ordinario", tolower(paso_docente$label)))
  expect_identical(utils::tail(embudo$conteo, 1L), frame$perfil$marco_aulas)
})

test_that("minEligible incompleto conserva el fallback legacy sin romper el marco", {
  fx <- .emb_dyn_fixture()
  cfg <- .emb_dyn_config()
  cfg$criterios_seleccion$minEligible <- list()
  cfg$filters$min_eligible_per_class <- 10L

  frame <- calc_muestra_aulas_construir(
    base_madre = fx$estudiantes,
    catalogo_curso_horario = fx$catalogo,
    config = cfg
  )

  incluidas <- frame$aula_frame$classroom_id[frame$aula_frame$included %in% TRUE]
  expect_identical(incluidas, "V_OK")
  paso_min <- frame$perfil$embudo_aula[frame$perfil$embudo_aula$id == "minEligible", , drop = FALSE]
  expect_identical(paso_min$conteo, 1L)
  expect_match(tolower(paso_min$label), "10")
  expect_identical(utils::tail(frame$perfil$embudo_aula$conteo, 1L), frame$perfil$marco_aulas)
})

test_that("reglas no accionables no crean pasos que aparentan filtros", {
  fx <- .emb_dyn_fixture()
  cfg <- .emb_dyn_config()
  cfg$criterios_seleccion$byVariable <- list(
    modality = list(mode = "include", categories = list()),
    enrolled_total = list(mode = "include")
  )
  cfg$criterios_seleccion$courseLevelRanges <- list()

  frame <- calc_muestra_aulas_construir(
    base_madre = fx$estudiantes,
    catalogo_curso_horario = fx$catalogo,
    config = cfg
  )

  expect_identical(as.character(frame$perfil$embudo_aula$id), c("total", "minEligible"))
  expect_false(any(grepl("Sin filtro|Modalidad", frame$perfil$embudo_aula$label)))
  expect_identical(utils::tail(frame$perfil$embudo_aula$conteo, 1L), frame$perfil$marco_aulas)
})
