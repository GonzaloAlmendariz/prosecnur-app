# Tests del perfil institucional del marco de aulas (calc_muestra_perfil.R).
# Los fixtures están diseñados para que cada conteo del contrato
# "calc_muestra_aulas_perfil_v1" sea verificable a mano.

# Base sintética con todos los filtros activos. Composición por fila:
#   r1  s1 A1 FAC1 F 20 regular  pregrado presencial TEORIA      -> elegible
#   r2  s2 A1 FAC1 M 21 regular  pregrado presencial TEORIA      -> elegible
#   r3  s3 A1 FAC1 F 17 regular  pregrado presencial TEORIA      -> falla edad
#   r4  s4 A1 FAC1 M 22 egresado pregrado presencial TEORIA      -> falla condición
#   r5  s5 A2 FAC2 F 20 regular  posgrado presencial TEORIA      -> falla nivel
#   r6  s6 A2 FAC2 M 20 regular  pregrado presencial TEORIA      -> elegible
#   r7  s7 A3 FAC2 F 20 regular  pregrado virtual    TEORIA      -> elegible pero aula virtual
#   r8  s1 A4 FAC1 F 20 regular  pregrado presencial LABORATORIO -> aula con sesión excluida
#   r9  s2 A4 FAC1 M NA regular  pregrado presencial LABORATORIO -> fila sin edad (s2 pasa por r2)
#   r10 ""  A2 FAC2 M 20 regular  pregrado presencial TEORIA      -> id vacío, fuera del universo
.perfil_base_completa <- function() {
  data.frame(
    student_id = c("s1", "s2", "s3", "s4", "s5", "s6", "s7", "s1", "s2", ""),
    aula_id = c("A1", "A1", "A1", "A1", "A2", "A2", "A3", "A4", "A4", "A2"),
    curso_id = c("C1", "C1", "C1", "C1", "C2", "C2", "C3", "C4", "C4", "C2"),
    curso = c(rep("Curso 1", 4), "Curso 2", "Curso 2", "Curso 3", "Curso 4", "Curso 4", "Curso 2"),
    horario = c(rep("H1", 4), "H2", "H2", "H3", "H4", "H4", "H2"),
    facultad = c(rep("FAC1", 4), "FAC2", "FAC2", "FAC2", "FAC1", "FAC1", "FAC2"),
    programa = "P1",
    sexo = c("F", "M", "F", "M", "F", "M", "F", "F", "M", "M"),
    edad = c(20, 21, 17, 22, 20, 20, 20, 20, NA, 20),
    condicion = c("regular", "regular", "regular", "egresado", rep("regular", 6)),
    nivel = c(rep("pregrado", 4), "posgrado", rep("pregrado", 5)),
    modalidad = c(rep("presencial", 6), "virtual", rep("presencial", 3)),
    tipo_sesion = c(rep("TEORIA", 7), "LABORATORIO", "LABORATORIO", "TEORIA"),
    stringsAsFactors = FALSE
  )
}

.perfil_cfg_completa <- function() {
  calc_muestra_aulas_normalize_config(list(
    filters = list(
      min_eligible_per_class = 2L,
      exclude_session_patterns = list("laboratorio")
    )
  ))
}

test_that("perfil: totales, embudos y cobertura con todos los filtros activos", {
  frame <- calc_muestra_aulas_construir(base_madre = .perfil_base_completa(), config = .perfil_cfg_completa())
  perfil <- frame$perfil

  expect_equal(perfil$schema, "calc_muestra_aulas_perfil_v1")
  # Universo: s1..s7 (el id vacío de r10 no cuenta).
  expect_identical(perfil$universo, 7L)
  # Población elegible: s1, s2, s6, s7 (s3 edad, s4 condición, s5 nivel).
  expect_identical(perfil$poblacion_n, 4L)
  # Aulas: A1..A4; solo A1 llega al marco (2 elegibles >= 2).
  expect_identical(perfil$aulas_totales, 4L)
  expect_identical(perfil$marco_aulas, 1L)
  # Población F=2 (s1, s7) y M=2 (s2, s6); empate resuelto alfabéticamente.
  expect_identical(perfil$sexo_labels, c("F", "M"))

  # Embudo de alumnos: universo 7 -> pregrado 6 (cae s5) -> regular 5 (cae s4)
  # -> mayor-edad 4 (cae s3). s2 se queda gracias a r2 aunque r9 no tiene edad
  # (semántica "alguna fila elegible").
  expect_identical(perfil$embudo_alumno$id, c("universo", "pregrado", "regular", "mayor-edad"))
  expect_identical(perfil$embudo_alumno$conteo, c(7L, 6L, 5L, 4L))
  expect_identical(perfil$embudo_alumno$excluidos, c(0L, 1L, 1L, 1L))
  expect_true(is.integer(perfil$embudo_alumno$conteo))
  expect_true(is.integer(perfil$embudo_alumno$excluidos))
  # El último paso del embudo calza con la población elegible.
  expect_identical(utils::tail(perfil$embudo_alumno$conteo, 1L), perfil$poblacion_n)

  # Embudo de aulas: total 4 -> presencial 3 (cae A3 virtual; A4 sigue viva
  # por la fila r8 de s1) -> tipo 2 (cae A4 laboratorio) -> elegibles 1 (cae
  # A2 con 1 elegible < 2).
  expect_identical(perfil$embudo_aula$id, c("total", "presencial", "tipo", "elegibles"))
  expect_identical(perfil$embudo_aula$conteo, c(4L, 3L, 2L, 1L))
  expect_identical(perfil$embudo_aula$excluidos, c(0L, 1L, 1L, 1L))

  # Cobertura: de 4 elegibles solo s1 y s2 están en A1 (única aula del marco).
  expect_identical(perfil$cobertura$elegibles, 4L)
  expect_identical(perfil$cobertura$alcanzables, 2L)
  expect_equal(perfil$cobertura$pct, 0.5)
})

test_that("perfil: facultades con sexos, tamaños de aula y alcanzables", {
  frame <- calc_muestra_aulas_construir(base_madre = .perfil_base_completa(), config = .perfil_cfg_completa())
  fac <- frame$perfil$facultades

  expect_identical(
    names(fac),
    c("id", "nombre", "n", "sexo_1_n", "sexo_2_n", "est_aula_mediana", "est_aula_media", "alcanzables", "aulas_marco")
  )
  # Empate n=2 y n=2: orden estable por nombre.
  expect_identical(fac$id, c("fac1", "fac2"))
  expect_identical(fac$nombre, c("FAC1", "FAC2"))
  expect_identical(fac$n, c(2L, 2L))
  # sexo_labels = c("F", "M"): FAC1 tiene s1(F)+s2(M); FAC2 tiene s7(F)+s6(M).
  expect_identical(fac$sexo_1_n, c(1L, 1L))
  expect_identical(fac$sexo_2_n, c(1L, 1L))
  # FAC1 tiene la única aula del marco (A1, 2 elegibles); FAC2 no tiene aulas
  # en el marco -> est_aula_* NA y aulas_marco 0.
  expect_equal(fac$est_aula_mediana, c(2, NA_real_))
  expect_equal(fac$est_aula_media, c(2, NA_real_))
  expect_identical(fac$aulas_marco, c(1L, 0L))
  # Alcanzables: s1 y s2 en FAC1; s6 (A2 fuera del marco) y s7 (A3 virtual) no.
  expect_identical(fac$alcanzables, c(2L, 0L))
})

test_that("perfil: marco_base_aulas y opcionales medidos sin activar c7/c8", {
  frame <- calc_muestra_aulas_construir(base_madre = .perfil_base_completa(), config = .perfil_cfg_completa())
  perfil <- frame$perfil

  # Sin criterios nuevos activos el marco base coincide con el marco vigente.
  expect_identical(perfil$marco_base_aulas, 1L)
  op <- perfil$opcionales
  expect_identical(names(op), c("c7", "c8"))
  # c7 hipotético: A1 tiene 2 elegibles sobre 4 matriculados únicos -> ratio
  # 0.5 < 0.8; la única aula del marco base caería, FAC1 quedaría sin aulas y
  # la cobertura global bajaría a 0.
  expect_identical(op$c7$id, "c7")
  expect_false(op$c7$aplicado)
  expect_equal(op$c7$umbral, 0.8)
  expect_identical(op$c7$aulas, 0L)
  expect_equal(op$c7$cobertura_pct, 0)
  expect_identical(op$c7$unidades_rotas, "FAC1")
  # c8 hipotético: los 2 elegibles de A1 comparten nivel "pregrado" ->
  # homogeneidad 1, el marco no cambia y la cobertura sigue en 0.5.
  expect_identical(op$c8$id, "c8")
  expect_false(op$c8$aplicado)
  expect_identical(op$c8$aulas, 1L)
  expect_equal(op$c8$cobertura_pct, 0.5)
  expect_identical(op$c8$unidades_rotas, character(0))
})

test_that("perfil: pasos del embudo se omiten cuando su filtro no aplicó", {
  # Sin edad/condición/modalidad/tipo de sesión en la base y require_adult
  # apagado: solo sobreviven universo+pregrado y total+elegibles. La columna
  # condicion va vacía a propósito: sin ella, el matcher difuso de columnas
  # resolvería condition -> curso (candidato "condicion_del_curso").
  base <- data.frame(
    student_id = c("s1", "s2", "s3"),
    aula_id = c("A1", "A1", "A2"),
    curso = c("Curso 1", "Curso 1", "Curso 2"),
    horario = c("H1", "H1", "H2"),
    facultad = "FAC1",
    sexo = c("F", "M", "F"),
    condicion = "",
    nivel = c("pregrado", "pregrado", "posgrado"),
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(require_adult = FALSE, min_eligible_per_class = 1L)
  ))
  perfil <- calc_muestra_aulas_construir(base_madre = base, config = cfg)$perfil

  expect_identical(perfil$embudo_alumno$id, c("universo", "pregrado"))
  expect_identical(perfil$embudo_alumno$conteo, c(3L, 2L))
  expect_identical(perfil$embudo_alumno$excluidos, c(0L, 1L))
  # A2 solo tenía a s3 (posgrado): se queda sin elegibles y cae del marco.
  expect_identical(perfil$embudo_aula$id, c("total", "elegibles"))
  expect_identical(perfil$embudo_aula$conteo, c(2L, 1L))
  expect_identical(perfil$embudo_aula$excluidos, c(0L, 1L))
  expect_identical(perfil$poblacion_n, 2L)
  expect_identical(perfil$cobertura$alcanzables, 2L)
  expect_equal(perfil$cobertura$pct, 1)
})

test_that("perfil: facultad sin nombre, marco vacío y cobertura cero", {
  base <- data.frame(
    student_id = c("s1", "s2"),
    aula_id = "A1",
    curso = "Curso 1",
    horario = "H1",
    facultad = "",
    sexo = c("F", "F"),
    edad = c(20, 20),
    condicion = "regular",
    nivel = "pregrado",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 5L)
  ))
  perfil <- calc_muestra_aulas_construir(base_madre = base, config = cfg)$perfil

  # A1 tiene 2 elegibles < 5: ningún aula llega al marco.
  expect_identical(perfil$marco_aulas, 0L)
  expect_identical(perfil$sexo_labels, "F")

  fac <- perfil$facultades
  expect_identical(nrow(fac), 1L)
  expect_identical(fac$id, "sin-facultad")
  expect_identical(fac$nombre, "Sin facultad")
  expect_identical(fac$n, 2L)
  expect_identical(fac$sexo_1_n, 2L)
  expect_identical(fac$sexo_2_n, 0L)
  expect_true(is.na(fac$est_aula_mediana))
  expect_true(is.na(fac$est_aula_media))
  expect_identical(fac$aulas_marco, 0L)
  expect_identical(fac$alcanzables, 0L)

  expect_identical(perfil$cobertura$elegibles, 2L)
  expect_identical(perfil$cobertura$alcanzables, 0L)
  expect_equal(perfil$cobertura$pct, 0)
})

test_that("perfil: ante insumos vacíos degrada a ceros sin error", {
  perfil <- calc_muestra_aulas_perfil(list())

  expect_equal(perfil$schema, "calc_muestra_aulas_perfil_v1")
  expect_identical(perfil$universo, 0L)
  expect_identical(perfil$poblacion_n, 0L)
  expect_identical(perfil$aulas_totales, 0L)
  expect_identical(perfil$marco_aulas, 0L)
  expect_identical(perfil$sexo_labels, character(0))
  expect_identical(perfil$embudo_alumno$id, "universo")
  expect_identical(perfil$embudo_alumno$conteo, 0L)
  expect_identical(perfil$embudo_aula$id, c("total", "elegibles"))
  expect_identical(perfil$embudo_aula$conteo, c(0L, 0L))
  expect_identical(nrow(perfil$facultades), 0L)
  expect_identical(
    names(perfil$facultades),
    c("id", "nombre", "n", "sexo_1_n", "sexo_2_n", "est_aula_mediana", "est_aula_media", "alcanzables", "aulas_marco")
  )
  expect_identical(perfil$cobertura$elegibles, 0L)
  expect_identical(perfil$cobertura$alcanzables, 0L)
  expect_true(is.na(perfil$cobertura$pct))
  # Campos aditivos de criterios: sin ctx$criterios degradan al marco vigente
  # sin recortes (llamada directa que no pasó por construir()).
  expect_identical(perfil$marco_base_aulas, 0L)
  expect_false(perfil$opcionales$c7$aplicado)
  expect_identical(perfil$opcionales$c7$aulas, 0L)
  expect_true(is.na(perfil$opcionales$c7$cobertura_pct))
  expect_identical(perfil$opcionales$c7$unidades_rotas, character(0))
  expect_identical(perfil$opcionales$c8$aulas, 0L)
})

test_that("perfil: construir() adjunta out$perfil sin alterar el resto del frame", {
  # Mismo fixture que el test histórico de construir(): sirve de regresión
  # ligera de que el call-site nuevo no cambió nada más.
  estudiantes <- data.frame(
    student_id = paste0("s", 1:6),
    facultad = c("FAC1", "FAC1", "FAC1", "FAC2", "FAC2", "FAC2"),
    programa = c("P1", "P1", "P2", "P3", "P3", "P3"),
    sexo = c("F", "M", "F", "M", "F", "M"),
    edad = c(18, 19, 20, 18, 21, 22),
    condicion = "regular",
    nivel = "pregrado",
    stringsAsFactors = FALSE
  )
  inscripciones <- data.frame(
    student_id = c("s1", "s2", "s3", "s3", "s4", "s5", "s6"),
    aula_id = c("A1", "A1", "A1", "A2", "A2", "A2", "A2"),
    curso_id = c("C1", "C1", "C1", "C2", "C2", "C2", "C2"),
    curso = c(rep("Curso 1", 3), rep("Curso 2", 4)),
    horario = c(rep("L 8", 3), rep("M 10", 4)),
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
  base_madre <- merge(inscripciones, estudiantes, by = "student_id", all.x = TRUE, sort = FALSE)
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    selector = list(n_aulas = 2L, strata_cols = list("facultad"))
  ))

  frame <- calc_muestra_aulas_construir(base_madre = base_madre, config = cfg)

  # El frame conserva su contrato histórico...
  expect_equal(frame$schema, "calc_muestra_aulas_frame_v1")
  expect_equal(frame$audit$value[frame$audit$metric == "population_n"], "6")
  expect_equal(nrow(frame$population), 6)
  expect_equal(sort(frame$aula_frame$classroom_id), c("A1", "A2"))
  expect_true(all(frame$aula_frame$included))
  # ...y ahora además trae el perfil coherente con population/aula_frame.
  expect_equal(frame$perfil$schema, "calc_muestra_aulas_perfil_v1")
  expect_identical(frame$perfil$universo, 6L)
  expect_identical(frame$perfil$poblacion_n, 6L)
  expect_identical(frame$perfil$aulas_totales, 2L)
  expect_identical(frame$perfil$marco_aulas, 2L)
  expect_identical(
    utils::tail(frame$perfil$embudo_alumno$conteo, 1L),
    as.integer(nrow(frame$population))
  )
})
