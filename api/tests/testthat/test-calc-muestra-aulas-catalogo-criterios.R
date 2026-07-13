# Tests del fix H8a (señales de criterios desde el catálogo,
# calc_muestra_aulas_catalogo.R), del fix H7 (criterio de pregrado sobre la
# columna de formación real) y de H9 (excepciones de tipo de sesión por
# unidad). Fixture calcado del repro empírico del diagnóstico E2E (caso UAN):
# base madre CON "Tipo de curso" pero SIN "Tipo de docente" (vive solo en el
# catálogo de curso-horario, como en el workbook real).

# Base de 12 filas (6 aulas x 2 estudiantes). formacion: vector opcional por
# fila para los casos H7 (por default todos PREGRADO).
.cat_base <- function(formacion = NULL) {
  out <- data.frame(
    `Código` = sprintf("A%02d", 1:12),
    Facultad = "CIENCIAS SOCIALES",
    Carrera = "SOCIOLOGIA",
    `Formación` = if (is.null(formacion)) "PREGRADO" else formacion,
    `Condición` = "Regular",
    Sexo = rep(c("Femenino", "Masculino"), 6),
    Edad = 20,
    `Nivel curricular` = "5",
    `Curso-Horario` = rep(sprintf("C%d-H1", 1:6), each = 2),
    Curso = rep(sprintf("C%d", 1:6), each = 2),
    `Nombre del curso` = rep(c("Algebra", "Seminario de historia", "Estadistica", "Tesis 1", "Practicas", "Fisica"), each = 2),
    Horario = "H1",
    Modalidad = "Presencial",
    `Tipo de curso` = rep(c(
      "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)",  # C1 pasa tipo
      "SEMINARIO",                                       # C2 cae por tipo
      "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)",  # C3 pasa tipo (caerá por docente)
      "TRABAJO DE TESIS",                                # C4 cae por tipo
      "PRÁCTICA SUPERVISADA PREPROFESIONAL",             # C5 cae por tipo (tilde en el valor)
      "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)"   # C6 pasa tipo (multi-docente)
    ), each = 2),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  out
}

# Catálogo con una fila por curso-horario x docente (C6 con DOS docentes:
# el caso multi-docente del al-menos-uno).
.cat_catalogo <- function() {
  data.frame(
    `Curso-Horario` = c(sprintf("C%d-H1", 1:6), "C6-H1"),
    Curso = c(sprintf("C%d", 1:6), "C6"),
    Horario = "H1",
    Modalidad = "Presencial",
    Tipo = c(
      "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)", "SEMINARIO",
      "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)", "TRABAJO DE TESIS",
      "PRÁCTICA SUPERVISADA PREPROFESIONAL",
      "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)",
      "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)"
    ),
    `Tipo de docente` = c(
      "DOCENTE CONTRATADO - CONTRATADO",    # C1 pasa docente
      "DOCENTE ORDINARIO - PRINCIPAL",      # C2 (igual cae por tipo)
      "PRE-DOCENTE - JEFE DE PRÁCTICA",     # C3 cae SOLO por docente
      "PRE-DOCENTE - INSTRUCTOR",           # C4
      "DOCENTE EXTRAORDINARIO - VISITANTE", # C5
      "PRE-DOCENTE - JEFE DE PRÁCTICA",     # C6 fila 1 (multi-docente)
      "DOCENTE CONTRATADO - CONTRATADO"     # C6 fila 2 -> al menos uno pasa
    ),
    `Nombre de docente` = sprintf("DOC %d", 1:7),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

# Mapping y filtros con la forma EXACTA del payload real del frontend
# (nombres de columna con puntos; el motor resuelve por text_key).
.cat_mapping <- function() {
  list(
    student_id = "Código", faculty = "Facultad", program = "Carrera",
    sex = "Sexo", level = "Nivel.curricular", age = "Edad",
    course_id = "Curso", classroom_id = "Curso-Horario",
    course_name = "Nombre.del.curso", teacher = "Nombre.de.docente",
    teacher_type = "Tipo.de.docente", schedule = "Horario",
    modality = "Modalidad", session_type = "Tipo.de.curso",
    condition = "Condición", formation = "Formación"
  )
}

.cat_filtros <- function(extra = list()) {
  base <- list(
    require_adult = TRUE, min_age = 18L,
    require_undergraduate = TRUE, accepted_conditions = list("regular"),
    require_in_person = TRUE,
    exclude_session_patterns = list("seminario", "tesis", "asesor", "investigacion", "práctica", "practica"),
    require_stable_teacher = TRUE,
    accepted_teacher_type_patterns = list("contratado", "ordinario"),
    min_eligible_per_class = 1L
  )
  # No usar modifyList: recursa dentro de las listas SIN nombre de patrones y
  # deja el valor viejo en lugar de reemplazarlo.
  for (nm in names(extra)) base[[nm]] <- extra[[nm]]
  base
}

test_that("H8a (i-iii): docente desde catálogo entra al embudo, respeta el al-menos-uno y las tildes", {
  frame <- calc_muestra_aulas_construir(
    base_madre = .cat_base(),
    catalogo_curso_horario = .cat_catalogo(),
    config = list(mapping = .cat_mapping(), filters = .cat_filtros())
  )
  af <- frame$aula_frame

  # (i) El paso docente EXISTE en el embudo y excluye de verdad: total 6 ->
  # tipo 3 (caen C2/C4/C5, con tilde patrón<->valor en ambos sentidos:
  # "práctica" matchea "PRÁCTICA SUPERVISADA...") -> docente 2 (cae C3).
  embudo <- frame$perfil$embudo_aula
  expect_true("docente" %in% embudo$id)
  expect_identical(embudo$conteo[embudo$id == "total"], 6L)
  expect_identical(embudo$conteo[embudo$id == "tipo"], 3L)
  expect_identical(embudo$conteo[embudo$id == "docente"], 2L)
  expect_identical(frame$perfil$marco_aulas, 2L)

  # (i) La JP-only (C3) sale con razón teacher_type.
  c3 <- af[af$classroom_id == "C3-H1", , drop = FALSE]
  expect_identical(nrow(c3), 1L)
  expect_false(c3$included)
  expect_identical(c3$exclude_reason, "teacher_type")

  # (ii) El aula multi-docente (C6, JP + CONTRATADO) queda INCLUIDA: la señal
  # sintética concatena únicos (no modal) y el al-menos-uno la ve completa.
  c6 <- af[af$classroom_id == "C6-H1", , drop = FALSE]
  expect_true(c6$included)
  expect_true(grepl("JEFE DE PR", c6$teacher_type) && grepl("CONTRATADO", c6$teacher_type))
  expect_true(grepl(" | ", c6$teacher_type, fixed = TRUE))

  # Auditoría: el contador de la sintética quedó registrado (12 filas con señal).
  expect_identical(frame$catalog_audit$teacher_type_values, 12L)
})

test_that("H8a (iv): sin catálogo no hay señal de docente y el marco es el histórico", {
  cfg <- list(mapping = .cat_mapping(), filters = .cat_filtros())
  sin_catalogo <- calc_muestra_aulas_construir(base_madre = .cat_base(), config = cfg)
  # El filtro docente queda inactivo por falta de señal: incluidas = las que
  # pasan tipo (C1, C3, C6); mismo included que con el filtro apagado.
  expect_identical(sin_catalogo$perfil$marco_aulas, 3L)
  expect_false("docente" %in% sin_catalogo$perfil$embudo_aula$id)

  filtros_off <- .cat_filtros(list(require_stable_teacher = FALSE))
  apagado <- calc_muestra_aulas_construir(
    base_madre = .cat_base(),
    config = list(mapping = .cat_mapping(), filters = filtros_off)
  )
  expect_identical(
    stats::setNames(sin_catalogo$aula_frame$included, sin_catalogo$aula_frame$classroom_id),
    stats::setNames(apagado$aula_frame$included, apagado$aula_frame$classroom_id)
  )
})

test_that("H8a (v): la señal propia de la base gana y la sintética no se crea", {
  base <- .cat_base()
  # La base declara C3 con CONTRATADO (contradice al catálogo, que dice JP):
  # debe ganar la base -> C3 se queda; y C6 en la base es JP-only -> C6 cae
  # aunque el catálogo diga JP+CONTRATADO.
  base[["Tipo de docente"]] <- rep(c(
    "DOCENTE CONTRATADO - CONTRATADO",  # C1
    "DOCENTE ORDINARIO - PRINCIPAL",    # C2 (cae por tipo)
    "DOCENTE CONTRATADO - CONTRATADO",  # C3 <- contradice al catálogo
    "PRE-DOCENTE - INSTRUCTOR",         # C4 (cae por tipo)
    "DOCENTE EXTRAORDINARIO - VISITANTE", # C5 (cae por tipo)
    "PRE-DOCENTE - JEFE DE PRÁCTICA"    # C6 <- JP-only en la base
  ), each = 2)
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    catalogo_curso_horario = .cat_catalogo(),
    config = list(mapping = .cat_mapping(), filters = .cat_filtros())
  )
  af <- frame$aula_frame
  c3 <- af[af$classroom_id == "C3-H1", , drop = FALSE]
  c6 <- af[af$classroom_id == "C6-H1", , drop = FALSE]
  expect_true(c3$included)
  expect_false(c6$included)
  expect_identical(c6$exclude_reason, "teacher_type")
  # La sintética no se creó: el contador auditable queda en 0.
  expect_identical(frame$catalog_audit$teacher_type_values, 0L)
})

test_that("H7 golden: MAESTRIA sale del N por la columna de formación y el paso pregrado reporta excluidos reales", {
  # C1 con un estudiante de MAESTRIA y C5->C3: fixture golden mínimo del
  # encargo: 12 estudiantes, 2 de posgrado (A02 MAESTRIA en C1, A05 SEGUNDA
  # ESPECIALIDAD en C3). El nivel curricular (1-10) NO trae patrón de
  # posgrado: sin el fix H7 el paso pregrado no excluía a nadie.
  formacion <- rep("PREGRADO", 12L)
  formacion[2] <- "MAESTRIA"
  formacion[5] <- "SEGUNDA ESPECIALIDAD"
  frame <- calc_muestra_aulas_construir(
    base_madre = .cat_base(formacion = formacion),
    catalogo_curso_horario = .cat_catalogo(),
    config = list(mapping = .cat_mapping(), filters = .cat_filtros())
  )
  # N: 12 estudiantes - 2 de posgrado = 10.
  expect_identical(frame$perfil$poblacion_n, 10L)
  expect_identical(nrow(frame$population), 10L)
  expect_false(any(c("A02", "A05") %in% frame$population$student_id))

  # Embudo de alumnos: universo 12 -> pregrado 10 (excluidos REALES = 2).
  ea <- frame$perfil$embudo_alumno
  expect_true("pregrado" %in% ea$id)
  expect_identical(ea$conteo[ea$id == "universo"], 12L)
  expect_identical(ea$conteo[ea$id == "pregrado"], 10L)
  expect_identical(ea$excluidos[ea$id == "pregrado"], 2L)

  # Y el docente desde catálogo sigue operando en el mismo build: C3 cae por
  # tipo de docente (JP-only en el catálogo).
  af <- frame$aula_frame
  c3 <- af[af$classroom_id == "C3-H1", , drop = FALSE]
  expect_false(c3$included)
  expect_true(grepl("teacher_type", c3$exclude_reason, fixed = TRUE))
})

test_that("H7 fallback: sin columna de formación el pregrado se sigue infiriendo del nivel", {
  base <- .cat_base()
  base[["Formación"]] <- NULL
  base[["Nivel curricular"]] <- c(rep("5", 10L), rep("Posgrado", 2L))
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = list(mapping = .cat_mapping()[setdiff(names(.cat_mapping()), "formation")],
                  filters = .cat_filtros())
  )
  # Fallback histórico intacto: los 2 con nivel "Posgrado" caen por patrones.
  expect_identical(frame$perfil$poblacion_n, 10L)
  ea <- frame$perfil$embudo_alumno
  expect_identical(ea$excluidos[ea$id == "pregrado"], 2L)

  # Filas sin formación no se restringen (sin señal pasa): formación presente
  # pero vacía en algunas filas mantiene a esos estudiantes.
  base2 <- .cat_base(formacion = c(rep("PREGRADO", 10L), "", ""))
  frame2 <- calc_muestra_aulas_construir(
    base_madre = base2,
    config = list(mapping = .cat_mapping(), filters = .cat_filtros())
  )
  expect_identical(frame2$perfil$poblacion_n, 12L)
})

test_that("H9: la excepción de tipo por unidad revive el taller SOLO en la unidad listada", {
  base <- .cat_base()
  # C1 pasa a ser TALLER de ARTE Y DISEÑO; C3 TALLER de CIENCIAS SOCIALES.
  base[["Tipo de curso"]][1:2] <- "TALLER"
  base[["Facultad"]][1:2] <- "ARTE Y DISEÑO"
  base[["Tipo de curso"]][5:6] <- "TALLER"
  filtros <- .cat_filtros(list(
    require_stable_teacher = FALSE,
    exclude_session_patterns = list("seminario", "tesis", "practica", "taller"),
    # Clave con distinta capitalización a propósito: el match es por text_key.
    session_type_excepciones = list(`arte y diseño` = list("taller", "artistico"))
  ))
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = list(mapping = .cat_mapping(), filters = filtros)
  )
  af <- frame$aula_frame
  incl <- stats::setNames(af$included, af$classroom_id)
  # C1 (taller en AyD) sobrevive por la excepción; C3 (taller fuera de AyD)
  # cae por tipo; C6 teórico sigue adentro.
  expect_true(incl[["C1-H1"]])
  expect_false(incl[["C3-H1"]])
  expect_true(incl[["C6-H1"]])

  # Sin la excepción, C1 también cae (la excepción nunca excluye, solo exime).
  filtros_sin <- filtros
  filtros_sin$session_type_excepciones <- list()
  frame_sin <- calc_muestra_aulas_construir(
    base_madre = base,
    config = list(mapping = .cat_mapping(), filters = filtros_sin)
  )
  af_sin <- frame_sin$aula_frame
  expect_false(stats::setNames(af_sin$included, af_sin$classroom_id)[["C1-H1"]])
})

test_that("H9: normalización defensiva del mapa de excepciones", {
  expect_identical(.cm_criterios_normalize_session_excepciones(NULL), list())
  expect_identical(.cm_criterios_normalize_session_excepciones("x"), list())
  expect_identical(.cm_criterios_normalize_session_excepciones(list(1, 2)), list())
  mapa <- .cm_criterios_normalize_session_excepciones(list(
    `ARTE Y DISEÑO` = list("taller", "", "artistico"),
    ` ` = list("x"),
    VACIA = list()
  ))
  expect_identical(names(mapa), "ARTE Y DISEÑO")
  expect_identical(mapa[["ARTE Y DISEÑO"]], list("taller", "artistico"))
})

test_that("whitelist workspace: formación y excepciones H9 sobreviven el round-trip", {
  ws <- .cm_normalize_workspace_aulas_config(list(
    schema = "calc_muestra_workspace_aulas_v1",
    accepted_formation_patterns = list("pregrado", "profesional"),
    session_type_excepciones = list(`ARTE Y DISEÑO` = list("taller"))
  ))
  expect_identical(ws$accepted_formation_patterns, list("pregrado", "profesional"))
  expect_identical(ws$session_type_excepciones, list(`ARTE Y DISEÑO` = list("taller")))

  # Doble normalización idempotente.
  ws2 <- .cm_normalize_workspace_aulas_config(ws)
  expect_identical(ws2$accepted_formation_patterns, ws$accepted_formation_patterns)
  expect_identical(ws2$session_type_excepciones, ws$session_type_excepciones)

  # Proyecto viejo sin los campos -> defaults del motor.
  viejo <- .cm_normalize_workspace_aulas_config(list(schema = "calc_muestra_workspace_aulas_v1"))
  expect_identical(viejo$accepted_formation_patterns, list("pregrado"))
  expect_identical(viejo$session_type_excepciones, list())

  # list() vacía explícita respetada (el usuario apagó el criterio de
  # formación a propósito: vuelve el fallback por nivel).
  vacia <- .cm_normalize_workspace_aulas_config(list(accepted_formation_patterns = list()))
  expect_identical(vacia$accepted_formation_patterns, list())
})

test_that("ancla ^: excluye el standalone sin matar los combos que lo contienen", {
  combo <- "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)"
  # (a) "^laboratorio" matchea por prefijo del text_key: cae LABORATORIO,
  # sobrevive el combo teórico que lo trae como substring.
  expect_identical(
    unname(.cm_aulas_contains_any(c("LABORATORIO", combo), list("^laboratorio"))),
    c(TRUE, FALSE)
  )
  # (b) Sin ancla se mantiene el contains histórico: matchea ambos.
  expect_identical(
    unname(.cm_aulas_contains_any(c("LABORATORIO", combo), list("laboratorio"))),
    c(TRUE, TRUE)
  )
  # El ancla pasa por la misma normalización (tildes/case) que el resto.
  expect_identical(
    unname(.cm_aulas_contains_any(c("PRÁCTICA SUPERVISADA", "TEORICO-PRACTICO"), list("^Práctica"))),
    c(TRUE, FALSE)
  )
  # Mezcla anclado + contains en la misma lista.
  expect_identical(
    unname(.cm_aulas_contains_any(c("LABORATORIO", combo, "SEMINARIO DE TESIS"), list("^laboratorio", "tesis"))),
    c(TRUE, FALSE, TRUE)
  )
})

test_that("ancla ^ en exclude_session_patterns: LABORATORIO cae y los teóricos con -LABORATORIO sobreviven", {
  base <- .cat_base()
  # C2 pasa a ser LABORATORIO standalone (era SEMINARIO).
  base[["Tipo de curso"]][3:4] <- "LABORATORIO"
  filtros <- .cat_filtros(list(
    require_stable_teacher = FALSE,
    exclude_session_patterns = list("^laboratorio", "tesis", "práctica")
  ))
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = list(mapping = .cat_mapping(), filters = filtros)
  )
  af <- frame$aula_frame
  incl <- stats::setNames(af$included, af$classroom_id)
  # Los tres teóricos con "-LABORATORIO" en el combo sobreviven; el
  # standalone cae. Sin el ancla, "laboratorio" mataba también a C1/C3/C6
  # (la masacre 4,343 -> 210 del golden run).
  expect_true(incl[["C1-H1"]])
  expect_false(incl[["C2-H1"]])
  expect_true(incl[["C3-H1"]])
  expect_false(incl[["C4-H1"]])  # tesis
  expect_false(incl[["C5-H1"]])  # práctica
  expect_true(incl[["C6-H1"]])
  embudo <- frame$perfil$embudo_aula
  expect_identical(embudo$conteo[embudo$id == "tipo"], 3L)
})

test_that("ancla ^ en session_type_excepciones (H9): exime el standalone sin revivir combos", {
  base <- .cat_base()
  # C1 y C2 pasan a Arte y Diseño: C1 TALLER standalone, C2 combo con -TALLER.
  base[["Facultad"]][1:4] <- "ARTE Y DISEÑO"
  base[["Tipo de curso"]][1:2] <- "TALLER"
  base[["Tipo de curso"]][3:4] <- "SEMINARIO-TALLER"
  filtros <- .cat_filtros(list(
    require_stable_teacher = FALSE,
    exclude_session_patterns = list("taller", "tesis", "práctica"),
    session_type_excepciones = list(`arte y diseño` = list("^taller"))
  ))
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = list(mapping = .cat_mapping(), filters = filtros)
  )
  af <- frame$aula_frame
  incl <- stats::setNames(af$included, af$classroom_id)
  # La excepción anclada revive SOLO el TALLER standalone de AyD; el combo
  # "SEMINARIO-TALLER" (contiene taller pero no empieza con él) sigue afuera.
  expect_true(incl[["C1-H1"]])
  expect_false(incl[["C2-H1"]])
})

test_that("ancla ^: el round-trip del workspace y del config preserva el prefijo", {
  ws <- .cm_normalize_workspace_aulas_config(list(
    schema = "calc_muestra_workspace_aulas_v1",
    exclude_session_patterns = list("^laboratorio", "seminario"),
    session_type_excepciones = list(`ARTE Y DISEÑO` = list("^taller"))
  ))
  expect_identical(ws$exclude_session_patterns, list("^laboratorio", "seminario"))
  expect_identical(ws$session_type_excepciones, list(`ARTE Y DISEÑO` = list("^taller")))

  # Doble normalización idempotente (el "^" no se degrada en pasadas sucesivas).
  ws2 <- .cm_normalize_workspace_aulas_config(ws)
  expect_identical(ws2$exclude_session_patterns, ws$exclude_session_patterns)
  expect_identical(ws2$session_type_excepciones, ws$session_type_excepciones)

  # Y el normalizador del config del motor tampoco lo toca.
  cfg <- calc_muestra_aulas_normalize_config(list(filters = ws))
  expect_identical(cfg$filters$exclude_session_patterns, list("^laboratorio", "seminario"))
  expect_identical(cfg$filters$session_type_excepciones, list(`ARTE Y DISEÑO` = list("^taller")))
})
