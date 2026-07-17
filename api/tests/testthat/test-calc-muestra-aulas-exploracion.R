# Radiografía del marco por facultad (calc_muestra_aulas_exploracion.R,
# pestaña «Explorador de aulas»): schema y claves congeladas del contrato,
# estimación del tamaño de aula sobre ELEGIBLES (no matrícula), distribución
# por tipo/nivel con excluidos en `ch` pero no en `ch_elegibles`, top de
# cursos capado y ordenado, señales coherentes con particularidades y
# tolerancia a columnas ausentes.

# Bloque sintético de un aula con n estudiantes elegibles (filtros históricos
# satisfechos: edad 20, regular, presencial) + matrícula administrativa
# INFLADA (2n) para poder verificar que las estimaciones usan eligible_n y no
# la matrícula.
.exp_bloque <- function(aula,
                        n,
                        facultad = "INGENIERIA",
                        tipo_sesion = "TEORICO",
                        nivel = "1",
                        curso_id = paste0("C-", aula),
                        curso = paste("Curso", aula),
                        matriculados = n * 2L,
                        condicion_curso = "OBLIGATORIO") {
  data.frame(
    student_id = sprintf("%s-s%02d", aula, seq_len(n)),
    aula_id = aula,
    curso_id = curso_id,
    curso = curso,
    horario = "H1",
    facultad = facultad,
    programa = "P1",
    sexo = rep(c("F", "M"), length.out = n),
    edad = 20,
    condicion = "regular",
    nivel = nivel,
    modalidad = "presencial",
    tipo_sesion = tipo_sesion,
    matriculados_total = matriculados,
    condicion_del_curso = condicion_curso,
    stringsAsFactors = FALSE
  )
}

# Dos facultades con universo y marco distintos (min_eligible = 2):
#   INGENIERIA: A01 (30, TEORICO, nivel 1), A02 (20, TEORICO, nivel 3, curso
#     multi-facultad vía catálogo), A03 (10, LABORATORIO, nivel 1, sin
#     condición del curso), A04 (1, LABORATORIO, nivel 5 -> EXCLUIDA).
#   CIENCIAS: B01 (8, TEORICO, nivel 1, sin condición), B02 (4, TALLER,
#     nivel 2, código Z "1701Z" -> local externo).
.exp_base <- function() {
  rbind(
    .exp_bloque("A01", 30, nivel = "1", matriculados = 60L),
    .exp_bloque("A02", 20, nivel = "3", matriculados = 40L),
    .exp_bloque("A03", 10, nivel = "1", tipo_sesion = "LABORATORIO", condicion_curso = ""),
    .exp_bloque("A04", 1, nivel = "5", tipo_sesion = "LABORATORIO"),
    .exp_bloque("B01", 8, facultad = "CIENCIAS", nivel = "1", condicion_curso = ""),
    .exp_bloque("B02", 4, facultad = "CIENCIAS", nivel = "2", tipo_sesion = "TALLER", curso_id = "1701Z")
  )
}

# Catálogo con A02 sirviendo a DOS facultades: la señal multi-facultad del
# explorador debe salir de los sets de particularidades, no de re-detección.
.exp_catalogo <- function() {
  data.frame(
    aula_id = c("A01", "A02", "A02"),
    curso_id = c("C-A01", "C-A02", "C-A02"),
    facultad_del_curso = c("INGENIERIA", "INGENIERIA", "CIENCIAS"),
    nivel_curso = c("1", "3", "3"),
    stringsAsFactors = FALSE
  )
}

.exp_cfg <- function(extra_config = list()) {
  calc_muestra_aulas_normalize_config(
    c(list(filters = list(min_eligible_per_class = 2L)), extra_config)
  )
}

.exp_frame <- function() {
  calc_muestra_aulas_construir(
    base_madre = .exp_base(),
    catalogo_curso_horario = .exp_catalogo(),
    config = .exp_cfg()
  )
}

test_that("schema y claves exactas del contrato congelado", {
  exp <- .exp_frame()$exploracion
  expect_named(exp, c("schema", "totales", "por_facultad"))
  expect_equal(exp$schema, "calc_muestra_aulas_exploracion_v1")
  expect_named(exp$totales, c(
    "facultades", "ch_total", "ch_elegibles", "elegibles_total",
    "n_local_externo", "n_multi_facultad"
  ))
  fi <- exp$por_facultad[[1]]
  expect_named(fi, c(
    "facultad", "ch_total", "ch_elegibles", "elegibles_total",
    "est_aula_mediana", "est_aula_media", "por_tipo_sesion", "por_nivel",
    "por_condicion",
    "n_multi_facultad", "n_local_externo", "n_sin_condicion", "top_cursos"
  ))
  expect_named(fi$por_tipo_sesion[[1]], c(
    "tipo", "ch", "ch_elegibles", "elegibles", "media_elegibles",
    "elegibles_min", "elegibles_q1", "mediana_elegibles", "elegibles_q3",
    "elegibles_max"
  ))
  expect_named(fi$por_nivel[[1]], c("nivel", "ch", "elegibles", "mediana_elegibles"))
  expect_named(fi$por_condicion[[1]], c("condicion", "ch", "ch_elegibles", "elegibles"))
  expect_named(fi$top_cursos[[1]], c(
    "id", "curso", "nivel", "tipo", "elegibles", "faculty_match_share",
    "local_externo", "multi_facultad"
  ))
  # Números numéricos, no strings.
  expect_true(is.numeric(exp$totales$elegibles_total))
  expect_true(is.numeric(fi$est_aula_media))
  expect_true(is.numeric(fi$top_cursos[[1]]$elegibles))
  expect_true(is.numeric(fi$por_tipo_sesion[[1]]$mediana_elegibles))
  expect_true(is.numeric(fi$por_nivel[[1]]$mediana_elegibles))
  # Resumen robusto por tipo (superficie de decisión): todos numéricos.
  tst <- fi$por_tipo_sesion[[1]]
  for (k in c("media_elegibles", "elegibles_min", "elegibles_q1",
              "elegibles_q3", "elegibles_max")) {
    expect_true(is.numeric(tst[[k]]))
  }
  # por_nivel NO se amplía: sigue con solo mediana_elegibles.
  expect_named(fi$por_nivel[[1]], c("nivel", "ch", "elegibles", "mediana_elegibles"))
})

test_that("totales y orden por facultad (elegibles desc)", {
  exp <- .exp_frame()$exploracion
  expect_equal(exp$totales$facultades, 2L)
  expect_equal(exp$totales$ch_total, 6L)
  expect_equal(exp$totales$ch_elegibles, 5L)   # A04 fuera por min_eligible
  expect_equal(exp$totales$elegibles_total, 72) # 60 (FI) + 12 (FC)
  expect_equal(
    vapply(exp$por_facultad, function(p) p$facultad, character(1)),
    c("INGENIERIA", "CIENCIAS")
  )
  fi <- exp$por_facultad[[1]]
  fc <- exp$por_facultad[[2]]
  expect_equal(fi$ch_total, 4L)
  expect_equal(fi$ch_elegibles, 3L)
  expect_equal(fi$elegibles_total, 60)
  expect_equal(fc$ch_total, 2L)
  expect_equal(fc$ch_elegibles, 2L)
  expect_equal(fc$elegibles_total, 12)
})

test_that("mediana/media sobre eligible_n de INCLUIDOS, no matrícula", {
  frame <- .exp_frame()
  fi <- frame$exploracion$por_facultad[[1]]
  fc <- frame$exploracion$por_facultad[[2]]
  # La matrícula del marco sí es el doble (guardia de que el sintético separa
  # ambos números): si el explorador usara matrícula, la media de FI sería 40.
  af <- frame$aula_frame
  expect_equal(af$enrolled_total[af$classroom_id == "A01"], 60L)
  # FI incluidas: eligible_n {30, 20, 10} -> mediana 20, media 20.
  expect_equal(fi$est_aula_mediana, 20)
  expect_equal(fi$est_aula_media, 20)
  # FC incluidas: {8, 4} -> mediana 6 (promedio de pares), media 6.
  expect_equal(fc$est_aula_mediana, 6)
  expect_equal(fc$est_aula_media, 6)
})

test_that("distribución por tipo: excluidos cuentan en ch pero no en ch_elegibles", {
  fi <- .exp_frame()$exploracion$por_facultad[[1]]
  tipos <- vapply(fi$por_tipo_sesion, function(t) t$tipo, character(1))
  expect_equal(tipos, c("TEORICO", "LABORATORIO")) # orden: elegibles desc
  teo <- fi$por_tipo_sesion[[1]]
  lab <- fi$por_tipo_sesion[[2]]
  expect_equal(teo$ch, 2L)
  expect_equal(teo$ch_elegibles, 2L)
  expect_equal(teo$elegibles, 50)
  # A04 (excluida) cuenta en el universo del tipo pero no en el marco.
  expect_equal(lab$ch, 2L)
  expect_equal(lab$ch_elegibles, 1L)
  expect_equal(lab$elegibles, 10)
})

test_that("distribución por nivel: universo en ch, elegibles de incluidos, orden natural", {
  fi <- .exp_frame()$exploracion$por_facultad[[1]]
  niveles <- vapply(fi$por_nivel, function(x) x$nivel, character(1))
  expect_equal(niveles, c("1", "3", "5"))
  expect_equal(vapply(fi$por_nivel, function(x) x$ch, integer(1)), c(2L, 1L, 1L))
  # Nivel 5 = solo A04 (excluida): universo 1, elegibles 0.
  expect_equal(vapply(fi$por_nivel, function(x) x$elegibles, numeric(1)), c(40, 20, 0))
})

test_that("distribución por condición: bucket obligatorio/sin-dato, excluidos en ch no en elegibles", {
  exp <- .exp_frame()$exploracion
  ing <- exp$por_facultad[[1]] # INGENIERIA (mayor elegibles)
  cond <- vapply(ing$por_condicion, function(c) c$condicion, character(1))
  # Orden por elegibles desc: Obligatorio (A01+A02=50) antes de Sin dato (A03=10).
  expect_equal(cond, c("Obligatorio", "Sin dato"))
  oblig <- ing$por_condicion[[1]]
  # A01, A02 (incluidos) + A04 (excluido, min_eligible) → ch 3, ch_elegibles 2.
  expect_equal(oblig$ch, 3L)
  expect_equal(oblig$ch_elegibles, 2L)
  expect_equal(oblig$elegibles, 50) # A04 excluido NO suma
  sindato <- ing$por_condicion[[2]]
  expect_equal(sindato$condicion, "Sin dato")
  expect_equal(sindato$ch, 1L)
  expect_equal(sindato$elegibles, 10)
})

test_that("bucket de condición: obligatorio, electivo, sin dato y otro", {
  b <- .cm_exploracion_bucket_condicion(
    c("OBLIGATORIO", "Electivo de la especialidad", "ELECTIVO-OBLIGATORIO", "", "Formación general", NA)
  )
  expect_equal(b, c("Obligatorio", "Electivo", "Obligatorio", "Sin dato", "Otro", "Sin dato"))
})

test_that("mediana_elegibles por tipo y nivel: elegibles de INCLUIDOS, no matrícula", {
  exp <- .exp_frame()$exploracion
  fi <- exp$por_facultad[[1]]
  fc <- exp$por_facultad[[2]]
  # FI TEORICO incluidas {30, 20} -> 25; con la matrícula inflada del
  # sintético (2n) la mediana saldría 50.
  expect_equal(fi$por_tipo_sesion[[1]]$mediana_elegibles, 25)
  # FI LABORATORIO: solo A03 incluida (10); A04 excluida no participa.
  expect_equal(fi$por_tipo_sesion[[2]]$mediana_elegibles, 10)
  # FC: TEORICO {8}, TALLER {4}.
  expect_equal(fc$por_tipo_sesion[[1]]$mediana_elegibles, 8)
  expect_equal(fc$por_tipo_sesion[[2]]$mediana_elegibles, 4)
  # Por nivel FI: nivel 1 {30, 10} -> 20; nivel 3 {20} -> 20; nivel 5 solo
  # tiene a A04 (excluida) -> NA numérico, no 0 ni la cifra de la excluida.
  expect_equal(
    vapply(fi$por_nivel, function(x) x$mediana_elegibles, numeric(1)),
    c(20, 20, NA_real_)
  )
})

test_that("mediana_elegibles ignora excluidos: un CH excluido gigante no la mueve", {
  af <- data.frame(
    classroom_id = c("I1", "I2", "I3", "X1", "X2"),
    faculty = "UNICA",
    level = c("1", "1", "1", "1", "2"),
    session_type = c("TEORICO", "TEORICO", "TEORICO", "TEORICO", "PRACTICA"),
    eligible_n = c(10, 20, 30, 999, 999),
    included = c(TRUE, TRUE, TRUE, FALSE, FALSE),
    stringsAsFactors = FALSE
  )
  pf <- calc_muestra_aulas_exploracion(af, NULL)$por_facultad[[1]]
  tipos <- vapply(pf$por_tipo_sesion, function(t) t$tipo, character(1))
  teo <- pf$por_tipo_sesion[[which(tipos == "TEORICO")]]
  # Con X1 (999) dentro la mediana sería 25; sobre incluidos es 20.
  expect_equal(teo$mediana_elegibles, 20)
  expect_equal(teo$ch, 4L)
  expect_equal(teo$ch_elegibles, 3L)
  # PRACTICA existe en el universo pero solo con CH excluidos -> NA numérico.
  pra <- pf$por_tipo_sesion[[which(tipos == "PRACTICA")]]
  expect_equal(pra$ch, 1L)
  expect_equal(pra$ch_elegibles, 0L)
  expect_true(is.numeric(pra$mediana_elegibles))
  expect_true(is.na(pra$mediana_elegibles))
  # Mismo comportamiento en por_nivel: el nivel 2 solo tiene al excluido.
  niveles <- vapply(pf$por_nivel, function(x) x$nivel, character(1))
  niv2 <- pf$por_nivel[[which(niveles == "2")]]
  expect_equal(niv2$ch, 1L)
  expect_true(is.na(niv2$mediana_elegibles))
  expect_equal(pf$por_nivel[[which(niveles == "1")]]$mediana_elegibles, 20)
})

test_that("señales por facultad coherentes con los sets de particularidades", {
  frame <- .exp_frame()
  exp <- frame$exploracion
  part <- frame$particularidades
  fi <- exp$por_facultad[[1]]
  fc <- exp$por_facultad[[2]]
  # Multi-facultad: solo A02 (catálogo), en INGENIERIA.
  expect_equal(part$counts$multi_facultad, 1L)
  expect_equal(exp$totales$n_multi_facultad, part$counts$multi_facultad)
  expect_equal(fi$n_multi_facultad, 1L)
  expect_equal(fc$n_multi_facultad, 0L)
  # Local externo (código Z): solo B02, en CIENCIAS.
  expect_equal(part$counts$codigo_z, 1L)
  expect_equal(exp$totales$n_local_externo, part$counts$codigo_z)
  expect_equal(fi$n_local_externo, 0L)
  expect_equal(fc$n_local_externo, 1L)
  # Sin condición del curso: A03 y B01 (columna presente con vacíos).
  expect_equal(fi$n_sin_condicion, 1L)
  expect_equal(fc$n_sin_condicion, 1L)
})

test_that("top_cursos: solo incluidos, orden por elegibles desc y flags de señal", {
  fi <- .exp_frame()$exploracion$por_facultad[[1]]
  ids <- vapply(fi$top_cursos, function(t) t$id, character(1))
  expect_equal(ids, c("A01", "A02", "A03")) # A04 excluida no aparece
  expect_equal(vapply(fi$top_cursos, function(t) t$elegibles, numeric(1)), c(30, 20, 10))
  a02 <- fi$top_cursos[[2]]
  expect_true(a02$multi_facultad)
  expect_false(a02$local_externo)
  expect_equal(a02$curso, "Curso A02")
  expect_equal(a02$nivel, "3")
  expect_equal(a02$tipo, "TEORICO")
  expect_false(fi$top_cursos[[1]]$multi_facultad)
})

test_that("top_cursos capado a 15 y determinista (llamada directa)", {
  af <- data.frame(
    classroom_id = sprintf("T%02d", 1:20),
    course_name = sprintf("Curso %02d", 1:20),
    faculty = "UNICA",
    level = "1",
    session_type = "TEORICO",
    eligible_n = 1:20,
    included = TRUE,
    stringsAsFactors = FALSE
  )
  exp <- calc_muestra_aulas_exploracion(af, NULL)
  pf <- exp$por_facultad[[1]]
  expect_length(pf$top_cursos, 15L)
  expect_equal(pf$top_cursos[[1]]$id, "T20")
  expect_equal(
    vapply(pf$top_cursos, function(t) t$elegibles, numeric(1)),
    as.numeric(20:6)
  )
  # Sin particularidades: señales en 0 y flags apagados.
  expect_equal(exp$totales$n_multi_facultad, 0L)
  expect_equal(exp$totales$n_local_externo, 0L)
  expect_equal(pf$n_multi_facultad, 0L)
  expect_equal(pf$n_sin_condicion, 0L)
  expect_false(any(vapply(pf$top_cursos, function(t) t$local_externo, logical(1))))
})

test_that("tolerancia: frame vacío y columnas ausentes degradan sin error", {
  # Frame vacío: bloque con totales en cero y sin facultades.
  vacio <- calc_muestra_aulas_exploracion(data.frame(), NULL)
  expect_equal(vacio$schema, "calc_muestra_aulas_exploracion_v1")
  expect_equal(vacio$totales$facultades, 0L)
  expect_equal(vacio$totales$ch_total, 0L)
  expect_equal(vacio$totales$elegibles_total, 0)
  expect_equal(vacio$por_facultad, list())

  # Sin columna de facultad: totales sí, radiografía por facultad no.
  sin_fac <- calc_muestra_aulas_exploracion(data.frame(
    classroom_id = c("A", "B"),
    included = c(TRUE, FALSE),
    stringsAsFactors = FALSE
  ), NULL)
  expect_equal(sin_fac$totales$ch_total, 2L)
  expect_equal(sin_fac$totales$ch_elegibles, 1L)
  expect_true(is.na(sin_fac$totales$elegibles_total)) # sin eligible_n -> NA
  expect_equal(sin_fac$por_facultad, list())

  # Con facultad pero sin eligible_n/session_type/level: NA y grupos vacíos.
  minimo <- calc_muestra_aulas_exploracion(data.frame(
    classroom_id = c("A", "B"),
    faculty = "F",
    stringsAsFactors = FALSE
  ), NULL)
  pf <- minimo$por_facultad[[1]]
  # Sin columna `included` todo cuenta como incluido (describe lo que hay).
  expect_equal(pf$ch_elegibles, 2L)
  expect_true(is.na(pf$elegibles_total))
  expect_true(is.na(pf$est_aula_mediana))
  expect_true(is.na(pf$est_aula_media))
  expect_equal(pf$por_tipo_sesion[[1]]$tipo, "") # vacío agrupado, no error
  expect_true(is.na(pf$por_tipo_sesion[[1]]$elegibles))
  # Sin eligible_n la mediana tampoco existe: NA numérico, no 0 ni error
  # (incluye al grupo "" — el lookup por nombre no aplica a la clave vacía).
  expect_true(is.numeric(pf$por_tipo_sesion[[1]]$mediana_elegibles))
  expect_true(is.na(pf$por_tipo_sesion[[1]]$mediana_elegibles))
  expect_true(is.na(pf$por_nivel[[1]]$mediana_elegibles))
  expect_equal(pf$n_sin_condicion, 0L)
  expect_length(pf$top_cursos, 2L)
  expect_true(is.na(pf$top_cursos[[1]]$elegibles))
  expect_true(is.na(pf$top_cursos[[1]]$faculty_match_share))
})

test_that("el bloque solo AGREGA exploracion: el resto del frame no cambia", {
  frame <- .exp_frame()
  expect_true("exploracion" %in% names(frame))
  # Cross-check contra la auditoría preexistente (mismos números, otra vía).
  audit <- frame$audit
  expect_equal(
    frame$exploracion$totales$ch_total,
    as.integer(audit$value[audit$metric == "classroom_n"])
  )
  expect_equal(
    frame$exploracion$totales$ch_elegibles,
    as.integer(audit$value[audit$metric == "classroom_included_n"])
  )
  # El hash del marco se calcula ANTES del bloque descriptivo: dos builds del
  # mismo insumo comparten hash y el bloque no participa de él.
  frame2 <- .exp_frame()
  expect_equal(frame$frame_hash, frame2$frame_hash)
  # Construir una base mínima de proyectos viejos sigue sin fallar y trae el
  # bloque degradado (sin señales, sin niveles ni tipos con dato).
  base_min <- data.frame(
    student_id = c("s1", "s2", "s3", "s4"),
    aula_id = c("A1", "A1", "A2", "A2"),
    stringsAsFactors = FALSE
  )
  frame_min <- calc_muestra_aulas_construir(
    base_madre = base_min,
    config = calc_muestra_aulas_normalize_config(list(filters = list(min_eligible_per_class = 1L)))
  )
  exp_min <- frame_min$exploracion
  expect_equal(exp_min$schema, "calc_muestra_aulas_exploracion_v1")
  expect_equal(exp_min$totales$ch_total, 2L)
  expect_equal(exp_min$totales$n_multi_facultad, 0L)
  expect_equal(exp_min$totales$n_local_externo, 0L)
})

test_that("señales con >200 CH: los conteos por facultad usan el set completo, no los records capados", {
  # Regresión medida con la base HST real: 1,609 CH multi-facultad, pero los
  # records de particularidades viajan capados a 200 → los n_multi_facultad
  # por facultad sumaban 200. El set completo viaja en part$ids.
  n <- 250L
  ids <- sprintf("CH-%03d", seq_len(n))
  aula_frame <- data.frame(
    classroom_id = ids,
    course_name = paste("Curso", ids),
    faculty = rep(c("INGENIERIA", "DERECHO"), length.out = n),
    session_type = "TEORICO",
    eligible_n = 20,
    included = TRUE,
    stringsAsFactors = FALSE
  )
  records_capados <- lapply(ids[seq_len(200L)], function(id) {
    list(id = id, curso = paste("Curso", id), facultades = list("A", "B"), n_facultades = 2L)
  })
  part <- list(
    schema = "calc_muestra_aulas_particularidades_v1",
    multi_facultad = records_capados,
    codigo_z = list(),
    nombre_tesis = list(),
    counts = list(multi_facultad = n, codigo_z = 0L, nombre_tesis = 0L, sin_ids = 0L),
    ids = list(multi_facultad = as.list(ids), codigo_z = list(), nombre_tesis = list())
  )
  exp <- calc_muestra_aulas_exploracion(aula_frame, part)
  suma_por_fac <- sum(vapply(exp$por_facultad, function(p) p$n_multi_facultad, integer(1)))
  expect_equal(suma_por_fac, n)
  expect_equal(exp$totales$n_multi_facultad, n)

  # Fallback (bloque viejo sin part$ids): degrada a los records capados — el
  # total global sigue saliendo de counts, el por-facultad queda subcontado.
  part_viejo <- part[setdiff(names(part), "ids")]
  exp_viejo <- calc_muestra_aulas_exploracion(aula_frame, part_viejo)
  suma_vieja <- sum(vapply(exp_viejo$por_facultad, function(p) p$n_multi_facultad, integer(1)))
  expect_equal(suma_vieja, 200L)
  expect_equal(exp_viejo$totales$n_multi_facultad, n)
})

test_that("los builders de particularidades exponen el set completo de ids sin cap", {
  n <- 230L
  aula_frame <- data.frame(
    classroom_id = sprintf("CH-%03d", seq_len(n)),
    course_name = "Taller de tesis",
    course_id = sprintf("MUS%03dZ", seq_len(n)),
    section = "",
    level = "9",
    stringsAsFactors = FALSE
  )
  zeta <- .cm_particularidades_codigo_z(aula_frame)
  expect_equal(zeta$total, n)
  expect_length(zeta$records, 200L)
  expect_length(zeta$ids, n)
  tesis <- .cm_particularidades_nombre_tesis(aula_frame)
  expect_equal(tesis$total, n)
  expect_length(tesis$ids, n)
})

# --- Resumen robusto de la distribución por tipo de sesión (superficie de
# decisión, acuerdo Ramiro §9/§13) ---------------------------------------------

test_that("resumen por tipo se calcula sobre eligible_n de INCLUIDOS, no matrícula ni excluidos", {
  # TEORICO tiene tres CH incluidos {10,20,30} + un CH excluido gigante (999):
  # el excluido NO debe mover ninguna cifra del resumen. La matrícula (2n en el
  # sintético) tampoco: aquí llamamos directo al frame ya construido.
  af <- data.frame(
    classroom_id = c("I1", "I2", "I3", "X1"),
    faculty = "UNICA",
    level = "1",
    session_type = "TEORICO",
    eligible_n = c(10, 20, 30, 999),
    enrolled_total = c(20, 40, 60, 1998), # matrícula inflada (guardia)
    included = c(TRUE, TRUE, TRUE, FALSE),
    stringsAsFactors = FALSE
  )
  teo <- calc_muestra_aulas_exploracion(af, NULL)$por_facultad[[1]]$por_tipo_sesion[[1]]
  # Cálculo directo de R sobre {10,20,30} — el 999 excluido queda fuera.
  incl <- c(10, 20, 30)
  expect_equal(teo$elegibles_min, min(incl))                 # 10
  expect_equal(teo$elegibles_q1, stats::quantile(incl, 0.25, type = 7, names = FALSE)) # 15
  expect_equal(teo$mediana_elegibles, stats::median(incl))   # 20 (Q2)
  expect_equal(teo$elegibles_q3, stats::quantile(incl, 0.75, type = 7, names = FALSE)) # 25
  expect_equal(teo$elegibles_max, max(incl))                 # 30
  expect_equal(teo$media_elegibles, round(mean(incl), 2))    # 20
  # El excluido no infló el máximo ni la media.
  expect_true(teo$elegibles_max < 999)
})

test_that("resumen por tipo respeta el orden min <= q1 <= mediana <= q3 <= max", {
  af <- data.frame(
    classroom_id = sprintf("C%02d", 1:7),
    faculty = "UNICA",
    level = "1",
    session_type = "TEORICO",
    eligible_n = c(12, 18, 9, 25, 30, 14, 21),
    included = TRUE,
    stringsAsFactors = FALSE
  )
  teo <- calc_muestra_aulas_exploracion(af, NULL)$por_facultad[[1]]$por_tipo_sesion[[1]]
  expect_lte(teo$elegibles_min, teo$elegibles_q1)
  expect_lte(teo$elegibles_q1, teo$mediana_elegibles)
  expect_lte(teo$mediana_elegibles, teo$elegibles_q3)
  expect_lte(teo$elegibles_q3, teo$elegibles_max)
})

test_that("media > mediana en distribución sesgada por aula gigante (caso Ramiro §9)", {
  # Muchas aulas chicas + una "aula fantasma" de ~100: la media se distorsiona
  # hacia arriba, la mediana se mantiene. El resumen debe VER ambas cifras.
  elig <- c(15, 16, 18, 20, 22, 100)
  af <- data.frame(
    classroom_id = sprintf("C%02d", seq_along(elig)),
    faculty = "INGENIERIA",
    level = "1",
    session_type = "TEORICO",
    eligible_n = elig,
    included = TRUE,
    stringsAsFactors = FALSE
  )
  teo <- calc_muestra_aulas_exploracion(af, NULL)$por_facultad[[1]]$por_tipo_sesion[[1]]
  expect_equal(teo$mediana_elegibles, stats::median(elig))   # 19
  expect_equal(teo$media_elegibles, round(mean(elig), 2))    # 31.83
  # La distorsión es clara y visible: la media casi dobla a la mediana.
  expect_gt(teo$media_elegibles, teo$mediana_elegibles)
  expect_gt(teo$media_elegibles - teo$mediana_elegibles, 10)
  # El máximo delata al aula gigante; Q3 (aula típica alta) no.
  expect_equal(teo$elegibles_max, 100)
  expect_lt(teo$elegibles_q3, 30)
})

test_that("NA honesto: tipo sin incluidos con dato / frame sin eligible_n -> todos NA_real_", {
  campos <- c("media_elegibles", "elegibles_min", "elegibles_q1",
              "mediana_elegibles", "elegibles_q3", "elegibles_max")
  # (a) PRACTICA existe en el universo pero solo con un CH EXCLUIDO -> NA.
  af <- data.frame(
    classroom_id = c("I1", "I2", "X1"),
    faculty = "UNICA",
    level = "1",
    session_type = c("TEORICO", "TEORICO", "PRACTICA"),
    eligible_n = c(10, 20, 999),
    included = c(TRUE, TRUE, FALSE),
    stringsAsFactors = FALSE
  )
  pf <- calc_muestra_aulas_exploracion(af, NULL)$por_facultad[[1]]
  tipos <- vapply(pf$por_tipo_sesion, function(t) t$tipo, character(1))
  pra <- pf$por_tipo_sesion[[which(tipos == "PRACTICA")]]
  for (k in campos) {
    expect_true(is.numeric(pra[[k]]))
    expect_true(is.na(pra[[k]]))
  }
  # TEORICO sí tiene dato: ninguno de sus campos es NA.
  teo <- pf$por_tipo_sesion[[which(tipos == "TEORICO")]]
  for (k in campos) expect_false(is.na(teo[[k]]))

  # (b) Frame sin columna eligible_n: todo el resumen es NA, no 0.
  af2 <- data.frame(
    classroom_id = c("A", "B"),
    faculty = "F",
    level = "1",
    session_type = "TEORICO",
    included = TRUE,
    stringsAsFactors = FALSE
  )
  tst <- calc_muestra_aulas_exploracion(af2, NULL)$por_facultad[[1]]$por_tipo_sesion[[1]]
  for (k in campos) {
    expect_true(is.numeric(tst[[k]]))
    expect_true(is.na(tst[[k]]))
  }
})

test_that("retrocompatibilidad: mediana/ch/ch_elegibles/elegibles no cambian con los campos nuevos", {
  fi <- .exp_frame()$exploracion$por_facultad[[1]]
  teo <- fi$por_tipo_sesion[[1]]
  lab <- fi$por_tipo_sesion[[2]]
  # Mismos valores que antes de ampliar el contrato.
  expect_equal(teo$tipo, "TEORICO")
  expect_equal(teo$ch, 2L)
  expect_equal(teo$ch_elegibles, 2L)
  expect_equal(teo$elegibles, 50)
  expect_equal(teo$mediana_elegibles, 25)     # {30,20} -> 25
  expect_equal(lab$mediana_elegibles, 10)     # solo A03 incluida
  # Y los campos nuevos son coherentes con ese subset {30,20}.
  expect_equal(teo$elegibles_min, 20)
  expect_equal(teo$elegibles_max, 30)
  expect_equal(teo$media_elegibles, 25)
})
