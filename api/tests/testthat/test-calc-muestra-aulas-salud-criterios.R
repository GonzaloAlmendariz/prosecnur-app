# Un criterio declarado que no puede evaluarse tiene que decirlo.
#
# El mismo defecto ha vuelto CUATRO veces y siempre igual: un criterio declarado
# sobre una columna que no lleva lo que dice, y el motor sigue adelante.
# `exclude_level_patterns` buscaba «posgrado» en un numero de ciclo y no excluia
# ni una aula; `session_type` llegaba vacio en las 5.263 aulas del proyecto real;
# `teacher_type` publico nombres propios como categorias; y un `.pulso` guardado
# congelaba los candidatos del motor. En los cuatro casos el marco se publico
# igual y nadie se entero.
#
# `criterios_alumno_report` ya distingue «no evaluable» de «no recorta», pero
# SOLO para los criterios de alumno. Los de AULA —los que fallaron— no tenian
# nada.

.sc_frame <- function(..., n = 4L) {
  cols <- list(...)
  base <- data.frame(
    classroom_id = paste0("A", seq_len(n)),
    faculty = rep(c("DERECHO", "ARQUITECTURA"), length.out = n),
    stringsAsFactors = FALSE
  )
  for (nm in names(cols)) base[[nm]] <- rep(cols[[nm]], length.out = n)
  list(aula_frame = base)
}

.sc_cfg <- function(...) list(criterios_seleccion = list(byVariable = list(...)))

.sc_fila <- function(out, id) {
  for (f in out$filas) if (identical(f$criterion_id, id)) return(f)
  NULL
}

test_that("una columna vacia se declara sin_senal, no «no recorta»", {
  # ES la distincion que este bloque existe para hacer. Un criterio sin señal
  # deja pasar a todos, y sin marcarlo es indistinguible de uno que se midio y
  # no dejo fuera a nadie.
  out <- calc_muestra_aulas_salud_criterios(
    .sc_frame(session_type = ""),
    .sc_cfg(session_type = list(scope = "aula", kind = "flat", categories = "teorico"))
  )
  f <- .sc_fila(out, "session_type")
  expect_equal(f$estado, "sin_senal")
  expect_equal(f$aulas_con_valor, 0L)
  expect_true(grepl("llega vacía en las 4 aulas", f$aviso, fixed = TRUE))
  expect_true(grepl("no es que", f$aviso, fixed = TRUE))
})

test_that("categorias declaradas que no existen en la base se declaran", {
  # El caso `teacher_type` con nombres propios: la columna trae dato, pero
  # ninguna de las categorias declaradas aparece.
  out <- calc_muestra_aulas_salud_criterios(
    .sc_frame(teacher_type = c("FERNANDEZ SANTA MARIA, XAVIER", "CERNA, JUAN")),
    .sc_cfg(teacher_type = list(
      scope = "aula", kind = "flat",
      categories = c("docente contratado contratado", "docente ordinario principal")
    ))
  )
  f <- .sc_fila(out, "teacher_type")
  expect_equal(f$estado, "sin_coincidencia")
  expect_equal(f$categorias_presentes, 0L)
  expect_equal(f$aulas_con_valor, 4L)
  expect_true(grepl("NINGUNA aparece", f$aviso, fixed = TRUE))
  expect_true(grepl("4 de 4 aulas", f$aviso, fixed = TRUE))
})

test_that("CONTROL: un criterio sano no genera aviso", {
  # Sin este control, cualquier bug que marcara todo en rojo pasaria los tests
  # de arriba.
  out <- calc_muestra_aulas_salud_criterios(
    .sc_frame(modality = "PRESENCIAL"),
    .sc_cfg(modality = list(scope = "aula", kind = "flat", categories = "presencial"))
  )
  f <- .sc_fila(out, "modality")
  expect_equal(f$estado, "ok")
  expect_equal(f$aviso, "")
  expect_equal(f$categorias_presentes, 1L)
})

test_that("un criterio a medias se declara parcial y dice cuantas faltan", {
  out <- calc_muestra_aulas_salud_criterios(
    .sc_frame(session_type = "TEORICO"),
    .sc_cfg(session_type = list(
      scope = "aula", kind = "flat", categories = c("teorico", "taller", "seminario")
    ))
  )
  f <- .sc_fila(out, "session_type")
  expect_equal(f$estado, "parcial")
  expect_equal(f$categorias_presentes, 1L)
  expect_setequal(f$categorias_ausentes, c("taller", "seminario"))
  expect_true(grepl("sólo 1 aparecen", f$aviso, fixed = TRUE))
})

test_that("un criterio NUMERICO no se marca por no traer categorias", {
  # `enrolled_total` declara un umbral, no categorias. Un aviso falso en cada
  # criterio numerico desacreditaria a los demas.
  out <- calc_muestra_aulas_salud_criterios(
    .sc_frame(enrolled_total = "40"),
    .sc_cfg(enrolled_total = list(
      scope = "aula", kind = "numeric", threshold = list(op = ">=", min = 15)
    ))
  )
  f <- .sc_fila(out, "enrolled_total")
  expect_equal(f$estado, "ok")
  expect_equal(f$aviso, "")
})

test_that("las categorias de una excepcion por facultad tambien se comprueban", {
  # Si la excepcion de una facultad declara una categoria que no existe, esa
  # facultad no esta filtrando por lo que cree.
  out <- calc_muestra_aulas_salud_criterios(
    .sc_frame(session_type = "TEORICO"),
    .sc_cfg(session_type = list(
      scope = "aula", kind = "flat", categories = "teorico",
      exceptions = list(arquitectura = list(categories = "taller", op = "add"))
    ))
  )
  f <- .sc_fila(out, "session_type")
  expect_equal(f$categorias_declaradas, 2L)
  expect_equal(f$estado, "parcial")
  expect_equal(f$categorias_ausentes, "taller")
})

test_that("el desglose POR FACULTAD sale, y lo peor primero", {
  # La vara: por facultad. Una columna con señal global puede venir vacía en una
  # facultad concreta, y eso hay que verlo.
  fr <- .sc_frame(session_type = "TEORICO", n = 4L)
  fr$aula_frame$session_type[fr$aula_frame$faculty == "ARQUITECTURA"] <- ""
  out <- calc_muestra_aulas_salud_criterios(
    fr, .sc_cfg(session_type = list(scope = "aula", kind = "flat", categories = "teorico"))
  )
  pf <- .sc_fila(out, "session_type")$por_facultad
  expect_equal(length(pf), 2L)
  expect_equal(pf[[1]]$facultad, "ARQUITECTURA")
  expect_equal(pf[[1]]$con_valor, 0L)
  expect_equal(pf[[2]]$con_valor, 2L)
})

test_that("los criterios de ALUMNO no entran aqui", {
  # Los cubre `criterios_alumno_report`; duplicarlos daria dos veredictos.
  out <- calc_muestra_aulas_salud_criterios(
    .sc_frame(formation = ""),
    .sc_cfg(formation = list(scope = "alumno", kind = "flat", categories = "pregrado"))
  )
  expect_null(out)
})

test_that("las filas salen ordenadas de lo mas grave a lo sano", {
  out <- calc_muestra_aulas_salud_criterios(
    .sc_frame(modality = "PRESENCIAL", session_type = ""),
    .sc_cfg(
      modality = list(scope = "aula", kind = "flat", categories = "presencial"),
      session_type = list(scope = "aula", kind = "flat", categories = "teorico")
    )
  )
  expect_equal(out$filas[[1]]$criterion_id, "session_type")
  expect_equal(out$filas[[1]]$estado, "sin_senal")
})

test_that("sin marco o sin criterios no se inventa nada", {
  expect_null(calc_muestra_aulas_salud_criterios(NULL))
  expect_null(calc_muestra_aulas_salud_criterios(list(aula_frame = data.frame())))
  expect_null(calc_muestra_aulas_salud_criterios(.sc_frame(modality = "PRESENCIAL"), list()))
})

test_that("el payload de estado lo publica: el helper solo no basta", {
  # Un test del helper no protege la APLICACION. Si nadie lo llamara al servir,
  # los tests de arriba seguirian verdes y el analista no veria el aviso.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "calc_muestra_aulas_frame", .sc_frame(session_type = ""))
  session_set(sid, "calc_muestra_aulas_config",
              .sc_cfg(session_type = list(scope = "aula", kind = "flat", categories = "teorico")))
  bloque <- .cm_state_payload(sid)$aulas$salud_criterios
  expect_equal(bloque$schema, "calc_muestra_aulas_salud_criterios_v1")
  expect_equal(.sc_fila(bloque, "session_type")$estado, "sin_senal")
})
