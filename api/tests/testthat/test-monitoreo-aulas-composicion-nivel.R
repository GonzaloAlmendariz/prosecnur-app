# =============================================================================
# Cuántos elegibles de cada nivel tiene cada curso-horario, y qué aporta a Metas
# =============================================================================
#
# Gonzalo, 2026-09-23: «tenemos su código, su sexo, su nivel curricular […]
# tenemos todo». El marco guardaba el conteo por sexo de cada aula y sólo la
# moda del nivel; Metas no podía proyectar por nivel lo que falta aplicar.

test_that("el marco cuenta elegibles ÚNICOS por nivel, y la suma es eligible_n", {
  cid <- c("A", "A", "A", "A", "B", "B", "A")
  sid <- c("1", "2", "3", "1", "4", "5", "9")
  lvl <- c("6", "7", "7", "6", "8", "9", "5")
  ok  <- c(TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, FALSE)
  comp <- .cm_aulas_composicion_nivel(cid, sid, lvl, ok)
  expect_identical(comp[["A"]], "6:1|7:2")
  expect_identical(comp[["B"]], "8:1")
  # Un no elegible no cuenta, y el duplicado (alumno 1 dos veces) tampoco.
  expect_equal(sum(.cm_aulas_composicion_leer(comp[["A"]])), 3)
})

test_that("el orden es numérico (10 después de 9) y la lectura es la inversa", {
  expect_identical(.cm_aulas_composicion_texto(table(c("10", "9", "9", "6"))), "6:1|9:2|10:1")
  expect_equal(.cm_aulas_composicion_leer("6:1|9:2|10:1"), c("6" = 1, "9" = 2, "10" = 1))
  expect_length(.cm_aulas_composicion_leer(""), 0L)
  expect_length(.cm_aulas_composicion_leer(NA), 0L)
})

test_that("la composición viaja por el normalizador del plan", {
  fila <- monitoreo_aulas_normalize_plan(list(list(
    classroom_id = "A", operational_code = "CH 1", label = "x", wave = "M1",
    sample_role = "titular", orden = 1, level_composition = "6:3|7:10")))[[1]]
  expect_identical(fila$level_composition, "6:3|7:10")
})

.mcn_celda <- function(nivel, cuota, logrado = 0) {
  list(faculty = nivel, sex = "", grano = "eje", target = cuota, observed = logrado)
}

test_that("Metas proyecta por nivel con la composición × la tasa del aula", {
  plan <- list(
    # Aplicada: aporta a `previsto`.
    list(faculty = "CIENCIAS SOCIALES", eligible_n = 20, expected_valid = 10,
         tasa_efectividad_aula = 0.5, level_composition = "6:12|7:8",
         operational_status = "aplicada"),
    # Agendada y sin aplicar: aporta a lo pendiente y a lo agendado.
    list(faculty = "CIENCIAS SOCIALES", eligible_n = 10, expected_valid = 5,
         tasa_efectividad_aula = 0.5, level_composition = "7:4|9:6",
         operational_status = "planificada", scheduled_date = "2026-09-24"),
    # Sin fecha: aporta a lo pendiente, NO a lo agendado.
    list(faculty = "CIENCIAS SOCIALES", eligible_n = 10, expected_valid = 5,
         tasa_efectividad_aula = 0.5, level_composition = "9:10",
         operational_status = "planificada")
  )
  celdas <- list(.mcn_celda("6", 20, 6), .mcn_celda("7", 20, 4), .mcn_celda("9", 20, 0))
  out <- monitoreo_aulas_avance_sexo_facultad(plan, celdas)
  por <- stats::setNames(out, vapply(out, function(x) x$faculty, ""))
  expect_equal(por[["6"]]$previsto, 6)
  expect_equal(por[["7"]]$previsto, 4)
  expect_equal(por[["7"]]$aporte_pendiente, 2)
  expect_equal(por[["7"]]$aporte_agendado, 2)
  expect_equal(por[["9"]]$aporte_pendiente, 8)
  expect_equal(por[["9"]]$aporte_agendado, 3)
})

test_that("sin composición en el plan, las celdas del eje quedan como antes", {
  plan <- list(list(faculty = "CIENCIAS SOCIALES", eligible_n = 20, expected_valid = 10,
                    tasa_efectividad_aula = 0.5, operational_status = "planificada",
                    scheduled_date = "2026-09-24"))
  out <- monitoreo_aulas_avance_sexo_facultad(plan, list(.mcn_celda("6", 20)))
  expect_true(is.na(out[[1]]$previsto))
  expect_equal(out[[1]]$aporte_pendiente, 0)
})

test_that("una celda de facultad × sexo no recibe nada de la composición por nivel", {
  plan <- list(list(faculty = "LETRAS", eligible_n = 10, expected_valid = 5,
                    tasa_efectividad_aula = 0.5, level_composition = "6:10",
                    sex_top_1 = "F", sex_top_1_n = 10,
                    operational_status = "planificada"))
  out <- monitoreo_aulas_avance_sexo_facultad(
    plan, list(list(faculty = "LETRAS", sex = "F", target = 5, observed = 0)))
  expect_equal(out[[1]]$aporte_pendiente, 5)
})

# --- el banco, con la composición -------------------------------------------

.mcn_banco <- function(id, level, comp, el, fuente = "tau_global", tasa = 0.5) {
  list(classroom_id = id, operational_code = id, sample_role = "extra_reserve_pool",
       faculty = "CIENCIAS SOCIALES", level = level, eligible_n = el,
       level_composition = comp, efectividad_fuente = fuente, tasa_efectividad_aula = tasa,
       sex_top_1 = "F", sex_top_1_n = el)
}

test_that("con el eje en la persona, un aula del banco de otra moda SÍ sirve si trae alumnos del nivel", {
  # CCSS, 2026-09-23: «Nivel 9 — el banco no tiene cursos-horario de ese
  # nivel», buscando por la moda del aula.
  eje <- monitoreo_aulas_eje(list(eje_cuota = "nivel"))
  banco <- list(.mcn_banco("B1", "8", "8:20|9:6", 26), .mcn_banco("B2", "9", "9:2", 2),
                .mcn_banco("B3", "7", "7:10", 10))
  c9 <- monitoreo_aulas_reserva_dirigida(banco, facultad = "9", eje = eje, grano = "eje")
  expect_identical(vapply(c9, function(x) x$classroom_id, ""), c("B1", "B2"))
  # El aporte es la composición del nivel por la tasa del DISEÑO del aula.
  expect_identical(c9[[1]]$elegibles_del_sexo, 6)
  expect_identical(c9[[1]]$aporte_esperado, 3)
  expect_equal(c9[[1]]$tasa_efectividad, 0.5)
})

test_that("sin composición, el banco se filtra por la moda como siempre", {
  eje <- monitoreo_aulas_eje(list(eje_cuota = "nivel"))
  banco <- list(.mcn_banco("B1", "8", "", 26), .mcn_banco("B2", "9", "", 12))
  c9 <- monitoreo_aulas_reserva_dirigida(banco, facultad = "9", eje = eje, grano = "eje")
  expect_identical(vapply(c9, function(x) x$classroom_id, ""), "B2")
})

# --- lo que pidió la revisión metodológica ------------------------------------

test_that("lo que un aula aporta a todos sus niveles suma su meta", {
  plan <- list(list(faculty = "CIENCIAS SOCIALES", eligible_n = 23, expected_valid = 11.5,
                    tasa_efectividad_aula = 0.5, level_composition = "6:5|7:9|8:6|9:3",
                    operational_status = "planificada"))
  celdas <- lapply(c("6", "7", "8", "9"), function(n) .mcn_celda(n, 10))
  out <- monitoreo_aulas_avance_sexo_facultad(plan, celdas)
  expect_equal(sum(vapply(out, function(x) x$aporte_pendiente, 0)), 11.5, tolerance = 0.2)
})

test_that("una celda del eje con aulas sin composición lo dice y no afirma probabilidad", {
  plan <- list(
    list(faculty = "CIENCIAS SOCIALES", eligible_n = 10, expected_valid = 5,
         tasa_efectividad_aula = 0.5, level_composition = "6:10", operational_status = "planificada"),
    list(faculty = "CIENCIAS SOCIALES", eligible_n = 10, expected_valid = 5,
         tasa_efectividad_aula = 0.5, level_composition = "", operational_status = "planificada")
  )
  out <- monitoreo_aulas_avance_sexo_facultad(plan, list(.mcn_celda("6", 20)))
  expect_identical(out[[1]]$aulas_sin_composicion, 1L)
  expect_true(is.na(out[[1]]$prob_cierre))
  # Con la composición completa, cero.
  out2 <- monitoreo_aulas_avance_sexo_facultad(plan[1], list(.mcn_celda("6", 20)))
  expect_identical(out2[[1]]$aulas_sin_composicion, 0L)
})

test_that("una fila sin facultad sigue aportando a las celdas del eje", {
  plan <- list(list(faculty = "", eligible_n = 10, expected_valid = 5, tasa_efectividad_aula = 0.5,
                    level_composition = "6:10", operational_status = "planificada"))
  out <- monitoreo_aulas_avance_sexo_facultad(plan, list(.mcn_celda("6", 20)))
  expect_equal(out[[1]]$aporte_pendiente, 5)
})

test_that("en el banco la tasa corregida por el campo no pasa de 1", {
  eje <- monitoreo_aulas_eje(list(eje_cuota = "nivel"))
  banco <- list(.mcn_banco("B1", "9", "9:10", 10, tasa = 0.8))
  c9 <- monitoreo_aulas_reserva_dirigida(banco, facultad = "9", eje = eje, grano = "eje", factor = 1.6)
  expect_equal(c9[[1]]$tasa_efectividad, 1)
})

test_that("el handoff de Recopiladores no se traga la composición", {
  unidad <- .collection_legacy_unit(list(
    operational_code = "CH 1", classroom_id = "A1", label = "a1", faculty = "CIENCIAS SOCIALES",
    eligible_n = 10, sex_top_1 = "F", sex_top_1_n = 6, level_composition = "6:4|7:6"), 1L)
  expect_identical(unidad$dimensions$level_composition, "6:4|7:6")
})
