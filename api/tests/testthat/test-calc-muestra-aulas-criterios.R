# Tests de los criterios adicionales del marco de aulas
# (calc_muestra_aulas_criterios.R): docente estable, nivel del curso por
# unidad, sede del operativo y los opcionales c7 (prevalencia) y c8
# (homogeneidad de ciclo), más el impacto medido, el embudo del perfil, la
# retro-compatibilidad y la whitelist del workspace.

# Bloque sintético de un aula: n estudiantes con columnas de señal para los
# criterios nuevos (tipo_docente, nivel_curso, sede) y los filtros históricos
# ya satisfechos por default (edad 20, regular, presencial).
.crit_bloque <- function(aula,
                         sids,
                         edades = 20,
                         facultad = "FAC1",
                         tipo_docente = "",
                         nivel_curso = "",
                         sede = "",
                         nivel = "1",
                         matriculados = NULL) {
  n <- length(sids)
  out <- data.frame(
    student_id = sids,
    aula_id = aula,
    curso_id = paste0("C_", aula),
    curso = paste("Curso", aula),
    horario = "H1",
    facultad = facultad,
    programa = "P1",
    sexo = rep(c("F", "M"), length.out = n),
    edad = rep(edades, length.out = n),
    condicion = "regular",
    nivel = rep(nivel, length.out = n),
    modalidad = "presencial",
    tipo_docente = rep(tipo_docente, length.out = n),
    nivel_curso = rep(nivel_curso, length.out = n),
    sede = rep(sede, length.out = n),
    stringsAsFactors = FALSE
  )
  if (!is.null(matriculados)) out$matriculados <- matriculados
  out
}

.crit_cfg <- function(extra = list()) {
  calc_muestra_aulas_normalize_config(list(
    filters = c(list(min_eligible_per_class = 1L), extra)
  ))
}

test_that("docente: excluye aulas sin docente contratado u ordinario solo con el filtro activo", {
  base <- rbind(
    .crit_bloque("A1", c("s1", "s2"), tipo_docente = c("cachimbo", "jefe de práctica")),
    .crit_bloque("A2", c("s3", "s4"), tipo_docente = c("contratado", "cachimbo")),
    .crit_bloque("A3", c("s5", "s6"), tipo_docente = "")
  )

  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = .crit_cfg(list(require_stable_teacher = TRUE))
  )
  af <- frame$aula_frame
  expect_identical(af$classroom_id, c("A1", "A2", "A3"))
  # A1 solo tiene docentes no estables; A2 pasa por >= 1 contratado; A3 no
  # tiene señal propia y por eso pasa.
  expect_identical(af$included, c(FALSE, TRUE, TRUE))
  expect_identical(af$exclude_reason, c("teacher_type", "", ""))
  # La columna informativa concatena los tipos únicos del aula.
  expect_identical(af$teacher_type[[1]], "cachimbo | jefe de práctica")

  # Con el filtro apagado (default) nada cambia aunque la señal exista.
  frame_off <- calc_muestra_aulas_construir(base_madre = base, config = .crit_cfg())
  expect_true(all(frame_off$aula_frame$included))
  expect_identical(frame_off$aula_frame$exclude_reason, rep("", 3L))
})

test_that("nivel_por_unidad: rango por unidad con fallback y unidades sin entrada", {
  base <- rbind(
    .crit_bloque("A1", c("s1", "s2"), facultad = "FAC1", nivel_curso = "Nivel 3"),
    .crit_bloque("A2", c("s3", "s4"), facultad = "FAC1", nivel_curso = "Ciclo 05"),
    .crit_bloque("A3", c("s5", "s6"), facultad = "FAC2", nivel_curso = "Nivel 1"),
    .crit_bloque("A4", c("s7", "s8"), facultad = "FAC1", nivel_curso = "", nivel = "Superior")
  )
  # Clave en minúsculas a propósito: el match contra "FAC1" es por text_key.
  # min/max como double (gotcha jsonlite) se normalizan a enteros.
  cfg <- .crit_cfg(list(nivel_por_unidad = list(fac1 = list(list(min = 5, max = 10)))))

  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  af <- frame$aula_frame
  # A1: nivel 3 fuera del rango 5-10 de FAC1. A2: nivel 5 dentro. A3: FAC2
  # sin entrada en el mapa, no se restringe. A4: sin nivel parseable
  # (course_level vacío y fallback "Superior" sin dígitos), pasa.
  expect_equal(af$course_level_num, c(3, 5, 1, NA_real_))
  expect_identical(af$included, c(FALSE, TRUE, TRUE, TRUE))
  expect_identical(af$exclude_reason, c("course_level", "", "", ""))
})

test_that("sede: accepted_campuses excluye otras sedes y respeta aulas sin sede", {
  base <- rbind(
    .crit_bloque("A1", c("s1", "s2"), sede = "Arequipa"),
    .crit_bloque("A2", c("s3", "s4"), sede = "Lima"),
    .crit_bloque("A3", c("s5", "s6"), sede = "")
  )

  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = .crit_cfg(list(accepted_campuses = list("arequipa")))
  )
  af <- frame$aula_frame
  expect_identical(af$campus, c("Arequipa", "Lima", ""))
  expect_identical(af$included, c(TRUE, FALSE, TRUE))
  expect_identical(af$exclude_reason, c("", "campus", ""))
})

test_that("c7: prevalencia mínima excluye ratios bajos y deja pasar ratio NA", {
  base <- rbind(
    .crit_bloque("A1", c("s1", "s2"), edades = c(20, 17), matriculados = 2L),
    .crit_bloque("A2", c("s3", "s4"), matriculados = 2L),
    # matriculados 0 -> enrolled_total 0 -> eligible_ratio NA (sin señal).
    .crit_bloque("A3", c("s5", "s6"), matriculados = 0L)
  )

  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = .crit_cfg(list(require_min_prevalence = TRUE))
  )
  af <- frame$aula_frame
  expect_equal(af$prevalence_ratio, af$eligible_ratio)
  expect_equal(af$eligible_ratio, c(0.5, 1, NA_real_))
  # A1: 0.5 < 0.8 se excluye; A2 pasa; A3 con ratio NA pasa.
  expect_identical(af$included, c(FALSE, TRUE, TRUE))
  expect_identical(af$exclude_reason, c("c7_prevalencia", "", ""))
})

test_that("c8: homogeneidad de ciclo excluye aulas 50/50 y deja pasar aulas sin ciclos", {
  base <- rbind(
    .crit_bloque("A1", c("s1", "s2"), nivel = c("1", "2")),
    .crit_bloque("A2", c("s3", "s4"), nivel = "1"),
    .crit_bloque("A3", c("s5", "s6"), nivel = "")
  )

  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = .crit_cfg(list(require_cycle_homogeneity = TRUE))
  )
  af <- frame$aula_frame
  expect_equal(af$cycle_homogeneity, c(0.5, 1, NA_real_))
  # A1: 0.5 < 0.8 se excluye; A2 homogénea pasa; A3 sin ciclos pasa (NA).
  expect_identical(af$included, c(FALSE, TRUE, TRUE))
  expect_identical(af$exclude_reason, c("c8_homogeneidad", "", ""))
})

test_that("impacto: c7/c8 se miden sobre el marco base aunque estén apagados", {
  base <- rbind(
    .crit_bloque("A1", c("s1", "s2"), facultad = "FAC1", edades = c(20, 17), matriculados = 2L),
    .crit_bloque("A2", c("s3", "s4"), facultad = "FAC2", matriculados = 2L)
  )

  frame <- calc_muestra_aulas_construir(base_madre = base, config = .crit_cfg())
  perfil <- frame$perfil
  # Sin opcionales activos el marco vigente es el marco base completo.
  expect_identical(perfil$marco_aulas, 2L)
  expect_identical(perfil$marco_base_aulas, 2L)

  op <- perfil$opcionales
  expect_identical(names(op), c("c7", "c8"))
  # c7 hipotético: A1 (ratio 0.5) caería -> queda 1 aula, FAC1 se rompe y la
  # cobertura baja a s3+s4 sobre la población {s1, s3, s4}.
  expect_identical(op$c7$id, "c7")
  expect_false(op$c7$aplicado)
  expect_equal(op$c7$umbral, 0.8)
  expect_identical(op$c7$aulas, 1L)
  expect_identical(op$c7$unidades_rotas, "FAC1")
  expect_equal(op$c7$cobertura_pct, round(2 / 3, 4))
  expect_true(op$c7$cobertura_pct >= 0 && op$c7$cobertura_pct <= 1)
  # c8 hipotético: todos comparten ciclo "1" -> no recorta nada.
  expect_false(op$c8$aplicado)
  expect_identical(op$c8$aulas, 2L)
  expect_identical(op$c8$unidades_rotas, character(0))
  expect_equal(op$c8$cobertura_pct, 1)
})

test_that("embudo: pasos nuevos en orden, monotónicos y calzando con marco_aulas", {
  base <- rbind(
    .crit_bloque("A1", c("s1", "s2"), tipo_docente = "contratado", sede = "Arequipa", matriculados = 2L),
    .crit_bloque("A2", c("s3", "s4"), tipo_docente = "contratado", sede = "Lima", matriculados = 2L),
    .crit_bloque("A3", c("s5", "s6"), tipo_docente = "cachimbo", sede = "Arequipa", matriculados = 2L),
    .crit_bloque("A4", c("s7", "s8"), edades = c(20, 17), tipo_docente = "contratado", sede = "Arequipa", matriculados = 2L)
  )
  cfg <- .crit_cfg(list(
    require_stable_teacher = TRUE,
    accepted_campuses = list("arequipa"),
    require_min_prevalence = TRUE
  ))

  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  perfil <- frame$perfil
  embudo <- perfil$embudo_aula
  # total 4 -> presencial 4 -> sede 3 (cae A2) -> elegibles 3 -> docente 2
  # (cae A3) -> c7 1 (cae A4 con ratio 0.5).
  expect_identical(embudo$id, c("total", "presencial", "sede", "elegibles", "docente", "c7"))
  expect_identical(embudo$conteo, c(4L, 4L, 3L, 3L, 2L, 1L))
  expect_true(all(diff(embudo$conteo) <= 0L))
  expect_identical(utils::tail(embudo$conteo, 1L), perfil$marco_aulas)
  expect_identical(perfil$marco_aulas, 1L)
  expect_identical(embudo$label[embudo$id == "sede"], "Solo sedes del operativo")
  expect_identical(embudo$label[embudo$id == "docente"], "Con docente estable")
  expect_identical(embudo$label[embudo$id == "c7"], "c7 · Prevalencia ≥ 80%")
  # Razones acumulables por criterio (una por aula en este fixture).
  af <- frame$aula_frame
  expect_identical(af$exclude_reason, c("", "campus", "teacher_type", "c7_prevalencia"))
  # El impacto refleja el build activo: marco base sin c7 = A1 + A4.
  expect_identical(perfil$marco_base_aulas, 2L)
  expect_true(perfil$opcionales$c7$aplicado)
  expect_identical(perfil$opcionales$c7$aulas, 1L)
})

test_that("retro-compat: config de solo campos viejos produce el marco histórico", {
  # Señales nuevas presentes en la base, pero config solo con campos viejos:
  # el marco (included/exclude_reason/marco_aulas) es el histórico y el
  # embudo no gana pasos.
  base <- rbind(
    .crit_bloque("A1", c("s1", "s2"), tipo_docente = "cachimbo", sede = "Lima", nivel_curso = "Nivel 3"),
    .crit_bloque("A2", "s3", tipo_docente = "jefe de práctica", sede = "Cusco", nivel_curso = "Nivel 1")
  )
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = list(filters = list(min_eligible_per_class = 2L))
  )
  af <- frame$aula_frame
  expect_identical(af$included, c(TRUE, FALSE))
  expect_identical(af$exclude_reason, c("", "min_eligible_per_class"))
  expect_identical(frame$perfil$marco_aulas, 1L)
  expect_identical(frame$perfil$embudo_aula$id, c("total", "presencial", "elegibles"))
  # Las columnas informativas nuevas sí aparecen (aditivas)...
  expect_true(all(
    c("teacher_type", "course_level_num", "campus", "prevalence_ratio", "cycle_homogeneity") %in% names(af)
  ))
  # ...y la config normalizada trae los filtros nuevos apagados por default.
  expect_false(frame$config$filters$require_stable_teacher)
  expect_false(frame$config$filters$require_min_prevalence)
  expect_false(frame$config$filters$require_cycle_homogeneity)
  expect_identical(frame$config$filters$nivel_por_unidad, list())
  expect_identical(frame$config$filters$accepted_campuses, list())
  expect_identical(frame$config$filters$accepted_teacher_type_patterns, list("contratado", "ordinario"))
  expect_equal(frame$config$filters$min_prevalence_pct, 0.8)
  expect_equal(frame$config$filters$min_cycle_homogeneity_pct, 0.8)
})

test_that("nivel_por_unidad: normalización defensiva de rangos", {
  mapa <- .cm_criterios_normalize_nivel_por_unidad(list(
    FAC1 = list(list(min = 10, max = 2)),  # min > max -> swap
    FAC2 = list(list(min = "x", max = 3)), # rango basura -> unidad descartada
    FAC3 = "hola",                         # valor basura -> descartada
    FAC4 = list(min = 1, max = 3)          # rango suelto sin anidar -> se envuelve
  ))
  expect_identical(mapa$FAC1, list(list(min = 2L, max = 10L)))
  expect_identical(mapa$FAC4, list(list(min = 1L, max = 3L)))
  expect_false(any(c("FAC2", "FAC3") %in% names(mapa)))
  # Entradas que no son lista nombrada degradan a list().
  expect_identical(.cm_criterios_normalize_nivel_por_unidad(list(1, 2)), list())
  expect_identical(.cm_criterios_normalize_nivel_por_unidad("x"), list())
  expect_identical(.cm_criterios_normalize_nivel_por_unidad(NULL), list())
})

test_that("whitelist: los criterios nuevos sobreviven el round-trip del workspace", {
  campos <- c(
    "require_stable_teacher", "accepted_teacher_type_patterns", "nivel_por_unidad",
    "accepted_campuses", "require_min_prevalence", "min_prevalence_pct",
    "require_cycle_homogeneity", "min_cycle_homogeneity_pct"
  )
  ws <- .cm_normalize_workspace_aulas_config(list(
    schema = "calc_muestra_workspace_aulas_v1",
    require_stable_teacher = TRUE,
    accepted_teacher_type_patterns = list("nombrado"),
    nivel_por_unidad = list(FAC1 = list(list(min = 5, max = 10))),
    accepted_campuses = list("arequipa"),
    require_min_prevalence = TRUE,
    min_prevalence_pct = 0.9,
    require_cycle_homogeneity = TRUE,
    min_cycle_homogeneity_pct = 0.7
  ))
  expect_true(ws$require_stable_teacher)
  expect_identical(ws$accepted_teacher_type_patterns, list("nombrado"))
  expect_identical(ws$nivel_por_unidad, list(FAC1 = list(list(min = 5L, max = 10L))))
  expect_identical(ws$accepted_campuses, list("arequipa"))
  expect_true(ws$require_min_prevalence)
  expect_equal(ws$min_prevalence_pct, 0.9)
  expect_true(ws$require_cycle_homogeneity)
  expect_equal(ws$min_cycle_homogeneity_pct, 0.7)

  # Round-trip: normalizar lo ya normalizado no altera los campos nuevos.
  ws2 <- .cm_normalize_workspace_aulas_config(ws)
  expect_identical(ws2[campos], ws[campos])

  # Proyecto viejo sin los campos -> defaults apagados.
  viejo <- .cm_normalize_workspace_aulas_config(list(schema = "calc_muestra_workspace_aulas_v1"))
  expect_false(viejo$require_stable_teacher)
  expect_identical(viejo$accepted_teacher_type_patterns, list("contratado", "ordinario"))
  expect_identical(viejo$nivel_por_unidad, list())
  expect_identical(viejo$accepted_campuses, list())
  expect_false(viejo$require_min_prevalence)
  expect_equal(viejo$min_prevalence_pct, 0.8)
  expect_false(viejo$require_cycle_homogeneity)
  expect_equal(viejo$min_cycle_homogeneity_pct, 0.8)

  # Una list() vacía explícita del usuario se respeta (no se re-impone el default).
  vacia <- .cm_normalize_workspace_aulas_config(list(accepted_teacher_type_patterns = list()))
  expect_identical(vacia$accepted_teacher_type_patterns, list())

  # H8b: los patrones de exclusión históricos (nivel/modalidad/sesión) también
  # sobreviven el round-trip — omitirlos de la whitelist los borraba en cada
  # guardado del estudio y el build recibía defaults.
  campos_hist <- c(
    "exclude_session_patterns", "exclude_modality_patterns", "exclude_level_patterns"
  )
  hist <- .cm_normalize_workspace_aulas_config(list(
    exclude_session_patterns = list("seminario", "tesis", "asesor"),
    exclude_modality_patterns = list("virtual", "semi"),
    exclude_level_patterns = list("posgrado")
  ))
  expect_identical(hist$exclude_session_patterns, list("seminario", "tesis", "asesor"))
  expect_identical(hist$exclude_modality_patterns, list("virtual", "semi"))
  expect_identical(hist$exclude_level_patterns, list("posgrado"))

  # Doble normalización idempotente.
  hist2 <- .cm_normalize_workspace_aulas_config(hist)
  expect_identical(hist2[campos_hist], hist[campos_hist])

  # Proyecto viejo sin los campos -> defaults canónicos del motor
  # (calc_muestra_aulas_default_config()$filters).
  expect_identical(viejo$exclude_session_patterns, list())
  expect_identical(
    viejo$exclude_modality_patterns,
    as.list(c("virtual", "remoto", "online", "distancia", "asincron"))
  )
  expect_identical(
    viejo$exclude_level_patterns,
    as.list(c("posgrado", "postgrado", "maestria", "master", "doctorado"))
  )

  # list() vacía explícita se respeta también en los tres históricos
  # (el usuario apagó el filtro a propósito; no se re-impone el default).
  vacia_hist <- .cm_normalize_workspace_aulas_config(list(
    exclude_session_patterns = list(),
    exclude_modality_patterns = list(),
    exclude_level_patterns = list()
  ))
  expect_identical(vacia_hist$exclude_session_patterns, list())
  expect_identical(vacia_hist$exclude_modality_patterns, list())
  expect_identical(vacia_hist$exclude_level_patterns, list())
})
