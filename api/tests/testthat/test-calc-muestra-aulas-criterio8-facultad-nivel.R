# Criterio 8 del marco de aulas (acuerdo metodológico con el asesor muestral,
# reunión 2026-07-15): el criterio tiene DOS partes EN ORDEN — (1) ≥80% de los
# estudiantes elegibles del aula deben ser de la MISMA FACULTAD del curso;
# (2) ≥80% deben ser del MISMO NIVEL/ciclo DEL CURSO.
#
# El c8 histórico medía homogeneidad contra el ciclo MODAL de los alumnos (no
# contra el nivel del curso): un curso de 7° cuyo 85% de alumnos es de 5°
# PASABA — bug conceptual que recortaba el marco de ~2056 a ~799 aulas
# (docs/calc-muestra-recorrido-spec.md:67). Estos tests fijan la semántica
# corregida: gate de facultad (require_faculty_prevalence) reportado ANTES que
# el de nivel, y require_cycle_homogeneity redefinido contra el nivel del
# curso con fallback modal MARCADO (level_reference = "modal").

# Bloque sintético de un aula: filtros históricos satisfechos por default
# (edad 20, regular, presencial). facultad/nivel aceptan vectores por fila.
.c8_bloque <- function(aula, sids, facultad = "FAC1", nivel = "1",
                       nivel_curso = "", edades = 20, matriculados = NULL) {
  n <- length(sids)
  out <- data.frame(
    student_id = sids,
    aula_id = aula,
    curso_id = paste0("C_", aula),
    curso = paste("Curso", aula),
    horario = "H1",
    facultad = rep(facultad, length.out = n),
    programa = "P1",
    sexo = rep(c("F", "M"), length.out = n),
    edad = rep(edades, length.out = n),
    condicion = "regular",
    nivel = rep(nivel, length.out = n),
    modalidad = "presencial",
    nivel_curso = rep(nivel_curso, length.out = n),
    stringsAsFactors = FALSE
  )
  if (!is.null(matriculados)) out$matriculados <- matriculados
  out
}

.c8_cfg <- function(extra = list()) {
  calc_muestra_aulas_normalize_config(list(
    filters = c(list(min_eligible_per_class = 1L), extra)
  ))
}

test_that("gate de facultad: excluye aulas con <80% de elegibles de la facultad del curso (catálogo autoritativo)", {
  base <- rbind(
    # A1: solo 30% de los elegibles pertenece a la facultad que dicta el curso.
    .c8_bloque("A1", sprintf("s%02d", 1:10),
               facultad = c(rep("FAC OTRA", 7), rep("FAC CURSO", 3))),
    .c8_bloque("A2", sprintf("t%02d", 1:10), facultad = "FAC CURSO")
  )
  catalogo <- data.frame(
    aula_id = c("A1", "A2"),
    facultad_del_curso = "FAC CURSO",
    stringsAsFactors = FALSE
  )
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    catalogo_curso_horario = catalogo,
    config = .c8_cfg(list(require_faculty_prevalence = TRUE))
  )
  af <- frame$aula_frame
  expect_equal(af$faculty_match_share, c(0.3, 1))
  expect_identical(af$included, c(FALSE, TRUE))
  expect_identical(af$exclude_reason, c("c8_facultad", ""))

  # Con el gate apagado (default) el marco no cambia: solo columnas informativas.
  frame_off <- calc_muestra_aulas_construir(
    base_madre = base, catalogo_curso_horario = catalogo, config = .c8_cfg()
  )
  expect_true(all(frame_off$aula_frame$included))
})

test_that("gate de facultad: sin catálogo la referencia degrada a la facultad modal del aula", {
  base <- rbind(
    .c8_bloque("A1", sprintf("s%02d", 1:10),
               facultad = c(rep("FAC OTRA", 7), rep("FAC CURSO", 3))),
    .c8_bloque("A2", sprintf("t%02d", 1:10), facultad = "FAC CURSO")
  )
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = .c8_cfg(list(require_faculty_prevalence = TRUE))
  )
  af <- frame$aula_frame
  # A1: la referencia modal es FAC OTRA (7/10 = 0.7 < 0.8) -> cae igual.
  expect_equal(af$faculty_match_share, c(0.7, 1))
  expect_identical(af$included, c(FALSE, TRUE))
})

test_that("gate de nivel: un curso de 7° con 85% de alumnos de 5° FALLA aunque el share modal pase", {
  base <- rbind(
    .c8_bloque("A1", sprintf("s%02d", 1:20),
               nivel = c(rep("5", 17), rep("7", 3)), nivel_curso = "Nivel 7"),
    .c8_bloque("A2", sprintf("t%02d", 1:10), nivel = "7", nivel_curso = "Nivel 7")
  )
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = .c8_cfg(list(require_cycle_homogeneity = TRUE))
  )
  af <- frame$aula_frame
  # El share modal HISTÓRICO pasaba el umbral (0.85 >= 0.8): ese era el bug.
  expect_equal(af$cycle_homogeneity, c(0.85, 1))
  # La referencia correcta es el nivel DEL CURSO (7°): solo 15% calza.
  expect_equal(af$level_match_share, c(0.15, 1))
  expect_identical(af$level_reference, c("curso", "curso"))
  expect_identical(af$included, c(FALSE, TRUE))
  expect_identical(af$exclude_reason, c("c8_homogeneidad", ""))
})

test_that("orden del criterio 8: facultad se reporta antes que nivel (razones, embudo e impacto)", {
  base <- rbind(
    # A1 falla ambos gates: 70% de otra facultad y ningún alumno del nivel 7.
    .c8_bloque("A1", sprintf("s%02d", 1:10),
               facultad = c(rep("FAC OTRA", 7), rep("FAC CURSO", 3)),
               nivel = "5", nivel_curso = "Nivel 7"),
    .c8_bloque("A2", sprintf("t%02d", 1:10),
               facultad = "FAC CURSO", nivel = "7", nivel_curso = "Nivel 7")
  )
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = .c8_cfg(list(
      require_faculty_prevalence = TRUE,
      require_cycle_homogeneity = TRUE
    ))
  )
  af <- frame$aula_frame
  # Razones acumuladas en orden facultad -> nivel.
  expect_identical(af$exclude_reason, c("c8_facultad|c8_homogeneidad", ""))
  # Embudo del perfil: el paso de facultad va antes que el de nivel.
  embudo <- frame$perfil$embudo_aula
  idx_fac <- match("c8_facultad", embudo$id)
  idx_niv <- match("c8", embudo$id)
  expect_false(is.na(idx_fac))
  expect_false(is.na(idx_niv))
  expect_true(idx_fac < idx_niv)
  # Impacto medido de los opcionales: la entrada de facultad precede a la de nivel.
  expect_identical(names(frame$perfil$opcionales), c("c7", "c8_facultad", "c8"))
})

test_that("NA pasa y se cuenta: aulas sin señal de facultad o nivel no se restringen", {
  base <- rbind(
    .c8_bloque("A1", c("s1", "s2"), facultad = "", nivel = ""),
    .c8_bloque("A2", c("s3", "s4"), facultad = "FAC1", nivel = "3", nivel_curso = "Nivel 3")
  )
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = .c8_cfg(list(
      require_faculty_prevalence = TRUE,
      require_cycle_homogeneity = TRUE
    ))
  )
  af <- frame$aula_frame
  expect_true(is.na(af$faculty_match_share[[1]]))
  expect_true(is.na(af$level_match_share[[1]]))
  # Sin señal no se restringe (semántica NA-pasa, igual que el c7 histórico).
  expect_identical(af$included, c(TRUE, TRUE))
  # Los NA se cuentan en el diagnóstico para auditar el alcance real del gate.
  crit8 <- frame$perfil$criterio8
  expect_identical(crit8$facultad_sin_dato_aulas, 1L)
  expect_identical(crit8$nivel_sin_dato_aulas, 1L)
  expect_equal(crit8$umbral_facultad, 0.8)
  expect_equal(crit8$umbral_nivel, 0.8)
})

test_that("fallback modal: sin nivel del curso la referencia degrada al modal y queda marcada", {
  base <- rbind(
    .c8_bloque("A1", c("s1", "s2"), nivel = c("1", "2")),  # 50/50, sin nivel_curso
    .c8_bloque("A2", c("s3", "s4"), nivel = "1")
  )
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = .c8_cfg(list(require_cycle_homogeneity = TRUE))
  )
  af <- frame$aula_frame
  expect_identical(af$level_reference, c("modal", "modal"))
  # El fallback reproduce el share modal histórico (retro-compat del gate).
  expect_equal(af$level_match_share, c(0.5, 1))
  expect_identical(af$included, c(FALSE, TRUE))
  expect_identical(af$exclude_reason, c("c8_homogeneidad", ""))
  expect_identical(frame$perfil$criterio8$nivel_referencia_modal_aulas, 2L)
})

test_that("whitelist: require_faculty_prevalence sobrevive el round-trip del workspace", {
  ws <- .cm_normalize_workspace_aulas_config(list(
    require_faculty_prevalence = TRUE,
    min_faculty_prevalence_pct = 0.9
  ))
  expect_true(ws$require_faculty_prevalence)
  expect_equal(ws$min_faculty_prevalence_pct, 0.9)
  # Idempotente: normalizar lo normalizado no altera los campos.
  ws2 <- .cm_normalize_workspace_aulas_config(ws)
  expect_true(ws2$require_faculty_prevalence)
  expect_equal(ws2$min_faculty_prevalence_pct, 0.9)
  # Proyecto viejo sin los campos -> gate apagado con umbral default.
  viejo <- .cm_normalize_workspace_aulas_config(list())
  expect_false(viejo$require_faculty_prevalence)
  expect_equal(viejo$min_faculty_prevalence_pct, 0.8)
})

test_that("minEligible$attendance_rate: se persiste como informativo sin alterar el umbral", {
  sel <- .cm_criterios_normalize_seleccion(
    list(minEligible = list(threshold = 8, attendance_rate = 0.85))
  )
  expect_equal(sel$minEligible$attendance_rate, 0.85)
  # Round-trip idempotente (el workspace re-normaliza en cada guardado).
  sel2 <- .cm_criterios_normalize_seleccion(sel)
  expect_equal(sel2$minEligible$attendance_rate, 0.85)
  # El umbral efectivo sigue siendo el threshold explícito del usuario.
  cfg <- list(criterios_seleccion = sel, filters = list(min_eligible_per_class = 1L))
  expect_identical(.cm_criterios_min_eligible_efectivo(cfg), 8L)
  # Valores fuera de (0, 1] se descartan (campo opcional, nunca inventado).
  malo <- .cm_criterios_normalize_seleccion(
    list(minEligible = list(threshold = 8, attendance_rate = 1.5))
  )
  expect_null(malo$minEligible$attendance_rate)
  cero <- .cm_criterios_normalize_seleccion(
    list(minEligible = list(threshold = 8, attendance_rate = 0))
  )
  expect_null(cero$minEligible$attendance_rate)
})
