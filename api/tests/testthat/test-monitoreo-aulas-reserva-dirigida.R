# La reserva dirigida: a que aula ir cuando falta un sexo en una facultad.
#
# El banco de extras es hoy un residuo -lo que sobro tras armar las cadenas- y
# tiene funcion declarada: cerrar la cuota de hombres y mujeres por facultad.
# Medido sobre HSVG 2026, de las 443 aulas de DERECHO fuera del plan la mejor
# aporta 40,6 mujeres efectivas esperadas contra 14,5 de la mediana: 2,8x.

.mard_aula <- function(id, fac, elig, s1, n1, s2, n2, ids = "") list(
  classroom_id = id, faculty = fac, eligible_n = elig,
  sex_top_1 = s1, sex_top_1_n = n1, sex_top_2 = s2, sex_top_2_n = n2,
  unique_student_ids = ids
)

.mard_pool <- function() list(
  .mard_aula("A", "DERECHO", 40, "F", 34, "M", 6),   # muy femenina
  .mard_aula("B", "DERECHO", 40, "F", 20, "M", 20),  # mixta
  .mard_aula("C", "DERECHO", 40, "M", 36, "F", 4),   # muy masculina
  .mard_aula("D", "PSICOLOGIA", 40, "F", 38, "M", 2) # otra facultad
)

test_that("solo entran aulas de ESA facultad", {
  # Es el punto entero del item: un aula que aporta 38 mujeres de PSICOLOGIA no
  # cierra la celda de DERECHO. Es el mismo defecto que deja a GASTRONOMIA con
  # 2 aulas de 119 elegibles que aportan 6 alumnos suyos.
  r <- monitoreo_aulas_reserva_dirigida(.mard_pool(), "DERECHO", "F")
  expect_false("D" %in% vapply(r, function(x) x$classroom_id, character(1)))
})

test_that("ordena por lo que aporta A ESA CELDA, no por tamaño", {
  # Las tres aulas de DERECHO tienen 40 elegibles: sin mirar el sexo darian lo
  # mismo. Con el sexo, la femenina rinde casi nueve veces la masculina.
  r <- monitoreo_aulas_reserva_dirigida(.mard_pool(), "DERECHO", "F")
  expect_identical(vapply(r, function(x) x$classroom_id, character(1)), c("A", "B", "C"))
  expect_gt(r[[1]]$aporte_esperado, r[[3]]$aporte_esperado * 5)
})

test_that("la misma pregunta para el otro sexo da otro orden", {
  r <- monitoreo_aulas_reserva_dirigida(.mard_pool(), "DERECHO", "M")
  expect_identical(r[[1]]$classroom_id, "C")
})

test_that("descuenta a los alumnos ya medidos en otra aula", {
  # En 2025, 446 alumnos de las 194 aulas aplicadas ya se habian medido antes.
  # Sin descontarlos, un aula que solapa entera parece aportar y no aporta.
  # El aula tiene CUATRO alumnas y cuatro ids: la coherencia importa, porque el
  # solape se prorratea sobre el total del aula.
  pool <- list(.mard_aula("A", "DERECHO", 4, "F", 4, "M", 0, "s1|s2|s3|s4"))
  limpio <- monitoreo_aulas_reserva_dirigida(pool, "DERECHO", "F")
  expect_gt(limpio[[1]]$aporte_esperado, 0)

  # Con las cuatro ya medidas, el aula no aporta nada y desaparece de la lista.
  todas <- monitoreo_aulas_reserva_dirigida(pool, "DERECHO", "F",
                                            ya_medidos = c("s1", "s2", "s3", "s4"))
  expect_equal(length(todas), 0L)

  # Y con la mitad medidas, aporta la mitad: el descuento es proporcional, no
  # un todo o nada.
  #
  # «La mitad» con MEDIA persona de tolerancia, no exacta: desde que el aporte
  # se publica en personas enteras —un aula no aporta 6,1 alumnos—, partir por
  # dos y truncar no da lo mismo que truncar y partir por dos. La propiedad que
  # importa —proporcional y no todo-o-nada— se conserva; la igualdad exacta era
  # un artefacto de publicar decimales.
  mitad <- monitoreo_aulas_reserva_dirigida(pool, "DERECHO", "F",
                                            ya_medidos = c("s1", "s2"))
  expect_equal(mitad[[1]]$solape_estimado, 2)
  expect_equal(mitad[[1]]$aporte_esperado, limpio[[1]]$aporte_esperado / 2, tolerance = 0.5)
  expect_true(mitad[[1]]$aporte_esperado < limpio[[1]]$aporte_esperado)
  # Y sigue siendo una persona entera.
  expect_equal(mitad[[1]]$aporte_esperado, floor(mitad[[1]]$aporte_esperado))
})

test_that("declara si el solape se pudo medir, en vez de suponer que no hay", {
  # Un aula sin ids no es un aula sin solape: suponerlo es la version optimista,
  # y la superficie tiene que poder decir cual de las dos cosas es.
  sin_ids <- monitoreo_aulas_reserva_dirigida(
    list(.mard_aula("A", "DERECHO", 20, "F", 20, "M", 0)), "DERECHO", "F")
  con_ids <- monitoreo_aulas_reserva_dirigida(
    list(.mard_aula("A", "DERECHO", 20, "F", 20, "M", 0, "s1|s2")), "DERECHO", "F")
  expect_false(sin_ids[[1]]$solape_medible)
  expect_true(con_ids[[1]]$solape_medible)
})

test_that("cada candidato viaja MARCADO: sin eso no se puede usar", {
  # La condicion innegociable. Sirve para correr la estimacion con y sin estas
  # encuestas y comprobar que la prevalencia no se mueve. Un peso no permite esa
  # comprobacion; una marca si.
  r <- monitoreo_aulas_reserva_dirigida(.mard_pool(), "DERECHO", "F")
  expect_true(all(vapply(r, function(x) isTRUE(x$origen_dirigido), logical(1))))
  expect_match(r[[1]]$motivo, "mujeres de DERECHO")
})

test_that("un aula que no aporta a esa celda no entra aunque sea grande", {
  # 60 elegibles, todos del otro sexo: cero para esta celda.
  r <- monitoreo_aulas_reserva_dirigida(
    list(.mard_aula("G", "DERECHO", 60, "M", 60, "", 0)), "DERECHO", "F")
  expect_equal(length(r), 0L)
})

test_that("el tope recorta pero el orden manda", {
  r <- monitoreo_aulas_reserva_dirigida(.mard_pool(), "DERECHO", "F", tope = 2L)
  expect_identical(vapply(r, function(x) x$classroom_id, character(1)), c("A", "B"))
})

test_that("sin banco o sin facultad no inventa candidatos", {
  expect_equal(length(monitoreo_aulas_reserva_dirigida(list(), "DERECHO", "F")), 0L)
  expect_equal(length(monitoreo_aulas_reserva_dirigida(.mard_pool(), "", "F")), 0L)
})


# --- Candidatos por celda, solo donde hay decision que tomar -----------------

.mard_avance <- function() list(
  list(faculty = "DERECHO", sex = "F", brecha = 5L, estado = "deficit_proyectado"),
  list(faculty = "DERECHO", sex = "M", brecha = 0L, estado = "asegurada"),
  list(faculty = "PSICOLOGIA", sex = "F", brecha = 90L, estado = "deficit_no_subsanable")
)

.mard_plan <- function() list(
  # El banco: lo que sobro tras armar las cadenas.
  c(.mard_aula("E1", "DERECHO", 40, "F", 34, "M", 6), list(sample_role = "extra_reserve_pool")),
  c(.mard_aula("E2", "DERECHO", 40, "F", 20, "M", 20), list(sample_role = "extra_reserve_pool")),
  c(.mard_aula("E3", "PSICOLOGIA", 20, "F", 18, "M", 2), list(sample_role = "extra_reserve_pool")),
  # Un titular NO es banco: usarlo seria mandar al equipo a un aula que ya
  # estaba en el plan.
  c(.mard_aula("T1", "DERECHO", 40, "F", 40, "M", 0), list(sample_role = "titular"))
)

.mard_por_celda <- function() {
  r <- monitoreo_aulas_reserva_por_celda(.mard_avance(), .mard_plan())
  stats::setNames(r, vapply(r, function(x) paste0(x$faculty, "|", x$sex), character(1)))
}

test_that("solo se calculan candidatos para las celdas que NO van a llegar", {
  # Una celda asegurada no necesita candidatos, y calcularlos para las quince
  # seria trabajo que nadie mira.
  r <- .mard_por_celda()
  expect_setequal(names(r), c("DERECHO|F", "PSICOLOGIA|F"))
})

test_that("los titulares NO son banco", {
  # Mandar al equipo a un aula que ya estaba en el plan no cierra nada.
  ids <- vapply(.mard_por_celda()[["DERECHO|F"]]$candidatos,
                function(x) x$classroom_id, character(1))
  expect_false("T1" %in% ids)
  expect_true(all(ids %in% c("E1", "E2")))
})

test_that("la frase dice si el banco ALCANZA, no cuantas aulas tiene", {
  # «Hay 2 candidatos» no responde si con esos 2 se cierra la brecha.
  d <- .mard_por_celda()[["DERECHO|F"]]
  expect_true(d$alcanza)
  expect_match(d$etiqueta, "se cierra")
  expect_match(d$etiqueta, "faltan 5")

  # Y cuando no alcanza, lo dice con las dos cifras.
  p <- .mard_por_celda()[["PSICOLOGIA|F"]]
  expect_false(p$alcanza)
  expect_match(p$etiqueta, "no alcanza")
  expect_match(p$etiqueta, "faltan 90")
})

test_that("una celda sin banco de su facultad lo dice, no devuelve una lista vacia muda", {
  r <- monitoreo_aulas_reserva_por_celda(
    list(list(faculty = "EDUCACION", sex = "F", brecha = 3L, estado = "deficit_proyectado")),
    .mard_plan()
  )
  expect_equal(length(r), 1L)
  expect_equal(length(r[[1]]$candidatos), 0L)
  expect_false(r[[1]]$alcanza)
  expect_match(r[[1]]$etiqueta, "no tiene cursos-horario de esa facultad")
})

test_that("sin banco o sin celdas en deficit no devuelve nada", {
  solo_titulares <- Filter(function(f) identical(f$sample_role, "titular"), .mard_plan())
  expect_equal(length(monitoreo_aulas_reserva_por_celda(.mard_avance(), solo_titulares)), 0L)
  sanas <- list(list(faculty = "DERECHO", sex = "F", brecha = 0L, estado = "asegurada"))
  expect_equal(length(monitoreo_aulas_reserva_por_celda(sanas, .mard_plan())), 0L)
})

test_that("ninguna frase de la reserva usa jerga", {
  frases <- vapply(.mard_por_celda(), function(x) x$etiqueta, character(1))
  expect_false(any(grepl(MONITOREO_AULAS_JERGA_PROHIBIDA, frases, ignore.case = TRUE)))
})


test_that("la reserva dirigida viaja en el payload del dashboard", {
  # El contrato del cableado. Sin el, quitar la linea del ensamblador no rompe
  # nada y la vista se queda sin candidatos en silencio -que es peor que no
  # tenerlos: parece que el banco no sirve-.
  plan <- list(
    list(operational_code = "CH 1", classroom_id = "a1", faculty = "DERECHO",
         sample_role = "titular", expected_valid = 10, eligible_n = 30,
         sample_status = "agendada", operational_status = "aplicada", responses_total = 4),
    list(operational_code = "E 1", classroom_id = "e1", faculty = "DERECHO",
         sample_role = "extra_reserve_pool", eligible_n = 30,
         sex_top_1 = "F", sex_top_1_n = 25, sex_top_2 = "M", sex_top_2_n = 5)
  )
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list())
  # Presente y con forma de lista, aunque este vacia: `NULL` significaria que el
  # motor no la publica, y vacia que no hay celda en deficit. No es lo mismo.
  expect_false(is.null(d$reserva_dirigida))
  expect_true(is.list(d$reserva_dirigida))
  # Y el avance que la alimenta se publica al lado, no en su lugar.
  expect_false(is.null(d$avance_sexo_facultad))
  expect_false(is.null(d$quotas_sex_faculty))
})

# =============================================================================
# El vocabulario del sexo, que estaba comparado a pelo por sus dos lados
# =============================================================================
#
# `.mard_aporte()` casaba `toupper(aula$sex_top_1)` contra el `sexo` de la celda,
# y esos dos valores vienen de sitios distintos: `sex_top_*` trae el vocabulario
# del MARCO, y `sexo` llega desde `monitoreo_aulas_reserva_por_celda()` como
# `c1$sex`, que es la ETIQUETA con la que la celda se muestra —y
# `.maac_sexo_etiqueta()` la produce como palabra—. Con "Femenino" enfrente de
# "F", `del_sexo` sale 0, ninguna aula pasa el filtro y la superficie publica
# CERO candidatos sin que nada falle. Esa misma mudez ya costó una vez y está
# avisada en `monitoreo_aulas_calibracion.R`.
#
# **El fixture de arriba no lo podía ver**: escribe "F"/"M" en los dos lados, así
# que no distingue de cuál de los dos vocabularios lee el código. Estas pruebas
# los separan a propósito.

test_that("la etiqueta de la celda encuentra las mismas aulas que la letra", {
  # Lo que llega de `reserva_por_celda` es la etiqueta, no la clave.
  por_letra <- monitoreo_aulas_reserva_dirigida(.mard_pool(), "DERECHO", "F")
  for (etq in c("Femenino", "FEMENINO", "Mujer", "mujeres")) {
    r <- monitoreo_aulas_reserva_dirigida(.mard_pool(), "DERECHO", etq)
    expect_identical(vapply(r, function(x) x$classroom_id, character(1)),
                     c("A", "B", "C"), info = etq)
    expect_equal(r[[1]]$aporte_esperado, por_letra[[1]]$aporte_esperado)
  }
  # Y el motivo se lee bien: con la etiqueta sin normalizar decía «hombres».
  expect_true(grepl("mujeres", monitoreo_aulas_reserva_dirigida(
    .mard_pool(), "DERECHO", "Femenino")[[1]]$motivo, fixed = TRUE))
})

test_that("un marco que escribe el sexo en palabras rinde lo mismo", {
  # El otro lado de la comparación. HSVG2026 pone "F"/"M" literal en su marco
  # —medido: 2.427 aulas "F" y 1.916 "M"—, y por eso esto casaba; otro estudio
  # escribe «Mujer», y ahí la cifra no puede cambiar.
  en_palabras <- lapply(.mard_pool(), function(a) {
    a$sex_top_1 <- c(F = "Mujer", M = "Hombre")[[.maac_sexo_key(a$sex_top_1)]]
    a$sex_top_2 <- c(F = "Mujer", M = "Hombre")[[.maac_sexo_key(a$sex_top_2)]]
    a
  })
  letra <- monitoreo_aulas_reserva_dirigida(.mard_pool(), "DERECHO", "F")
  palabra <- monitoreo_aulas_reserva_dirigida(en_palabras, "DERECHO", "F")
  expect_identical(vapply(palabra, function(x) x$classroom_id, character(1)),
                   vapply(letra, function(x) x$classroom_id, character(1)))
  expect_equal(vapply(palabra, function(x) x$aporte_esperado, numeric(1)),
               vapply(letra, function(x) x$aporte_esperado, numeric(1)))
})

test_that("un sexo que no se reconoce no propone nada, en vez de tomar el primero", {
  # Sin clave no hay celda que cerrar. Lo que NO puede pasar es que un `""` case
  # con el `""` del aula y se lleve `sex_top_1_n` de rebote: eso propondría
  # candidatos para un sexo inventado, que es peor que no proponer.
  expect_identical(monitoreo_aulas_reserva_dirigida(.mard_pool(), "DERECHO", "Otro"), list())
  expect_identical(monitoreo_aulas_reserva_dirigida(.mard_pool(), "DERECHO", ""), list())
  sin_sexo <- lapply(.mard_pool(), function(a) { a$sex_top_1 <- ""; a$sex_top_2 <- ""; a })
  expect_identical(monitoreo_aulas_reserva_dirigida(sin_sexo, "DERECHO", "F"), list())
})
