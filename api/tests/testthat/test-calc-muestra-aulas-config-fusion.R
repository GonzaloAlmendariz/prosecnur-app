# La config de marco se fusiona con la vigente: un body parcial no pisa nada.
#
# Medido el 2026-08-19 (HSVG2026): sellar el techo con un POST parcial devolvio
# n_aulas=30 y faculty_targets=0 donde habia 190 y 15; la cadena que mando el
# diseno sin techo lo borro a su vez. El ultimo en escribir destruia al
# anterior y el .pulso guardaba la destruccion.

test_that("una clave suelta se sella sin devolver el resto a defaults", {
  vigente <- calc_muestra_aulas_normalize_config(list(selector = list(
    n_aulas = 190L,
    faculty_targets = list(DERECHO = 20L, PSICOLOGIA = 7L),
    docente_unico = TRUE
  )))
  entrante <- list(selector = list(techo_aulas_visitadas = 200))
  out <- calc_muestra_aulas_normalize_config(
    calc_muestra_aulas_config_fusionar(vigente, entrante)
  )
  expect_identical(out$selector$techo_aulas_visitadas, 200L)
  expect_identical(out$selector$n_aulas, 190L)
  expect_identical(length(out$selector$faculty_targets), 2L)
  expect_true(out$selector$docente_unico)
})

test_that("el caso medido: el diseno completo sin techo YA NO lo borra", {
  con_techo <- calc_muestra_aulas_normalize_config(list(selector = list(
    techo_aulas_visitadas = 200L, n_aulas = 190L
  )))
  diseno_sin_techo <- list(selector = list(
    n_aulas = 190L,
    faculty_targets = list(DERECHO = 20L)
  ))
  out <- calc_muestra_aulas_normalize_config(
    calc_muestra_aulas_config_fusionar(con_techo, diseno_sin_techo)
  )
  expect_identical(out$selector$techo_aulas_visitadas, 200L)
  expect_identical(length(out$selector$faculty_targets), 1L)
})

test_that("faculty_targets se fusiona por facultad y un null explicito borra", {
  vigente <- list(selector = list(
    faculty_targets = list(DERECHO = 20L, PSICOLOGIA = 7L, EDUCACION = 2L)
  ))
  entrante <- list(selector = list(
    faculty_targets = list(DERECHO = 22L, EDUCACION = NULL)
  ))
  out <- calc_muestra_aulas_config_fusionar(vigente, entrante)
  ft <- out$selector$faculty_targets
  expect_identical(ft$DERECHO, 22L)
  expect_identical(ft$PSICOLOGIA, 7L)
  expect_false("EDUCACION" %in% names(ft))
})

test_that("las listas posicionales se reemplazan enteras, jamas por posicion", {
  vigente <- list(selector = list(strata_cols = list("facultad", "sexo", "grado")))
  entrante <- list(selector = list(strata_cols = list("facultad")))
  out <- calc_muestra_aulas_config_fusionar(vigente, entrante)
  expect_identical(out$selector$strata_cols, list("facultad"))
})

test_that("sin config vigente el entrante pasa tal cual (primera escritura)", {
  out <- calc_muestra_aulas_config_fusionar(NULL, list(selector = list(n_aulas = 10L)))
  expect_identical(out$selector$n_aulas, 10L)
  out2 <- calc_muestra_aulas_config_fusionar(list(), list(selector = list(n_aulas = 10L)))
  expect_identical(out2$selector$n_aulas, 10L)
})

# `/aulas/certeza` resuelve su config como `s$calc_muestra_aulas_config %||%
# frame$config` y `/aulas/seleccionar` lo hace al reves. No es simetria
# inofensiva: medido sobre HSVG2026, los dos configs difieren en 24 de 715
# claves y la divergencia cae justo en `selector$faculty_targets`, que la sesion
# trae con 15 facultades y el marco no trae. Cada ruta recibe el que NO le
# sirve: certeza hereda unos targets que debe ignorar —era la causa de que su
# curva saliera plana— y seleccionar no ve unos que si debe respetar, por lo que
# el frontend acaba inyectandolos en el body de cada peticion.
#
# La reparacion no inventa contrato: las dos leen lo mismo, fusionado con la
# regla que este archivo ya declara y prueba.
test_that("la fusion resuelve la precedencia entre el config del marco y el de sesion", {
  marco <- list(selector = list(n_aulas = 30L, seed = 111L))
  sesion <- list(selector = list(faculty_targets = list(DERECHO = 19L), seed = 202L))

  fusion <- calc_muestra_aulas_config_fusionar(marco, sesion)

  # Lo que la sesion declara MANDA sobre lo que el marco traia.
  expect_identical(fusion$selector$seed, 202L)
  expect_identical(fusion$selector$faculty_targets$DERECHO, 19L)
  # Y lo que la sesion NO menciona se hereda del marco, en vez de caer al default.
  expect_identical(fusion$selector$n_aulas, 30L)
})

test_that("con el marco vacio de targets la fusion NO los pierde", {
  # El caso real: el marco de HSVG2026 no trae `faculty_targets` y la sesion
  # los trae con las 15 facultades. Leer el del marco primero los borra.
  marco <- list(selector = list(n_aulas = 174L))
  sesion <- list(selector = list(faculty_targets = list(
    DERECHO = 19L, PSICOLOGIA = 6L, CIENCIAS_CONTABLES = 3L
  )))
  fusion <- calc_muestra_aulas_config_fusionar(marco, sesion)
  expect_length(fusion$selector$faculty_targets, 3L)
  expect_identical(fusion$selector$n_aulas, 174L)
})

# La resolucion vivia INLINE y al reves en cada ruta: `/aulas/certeza` como
# `s$calc_muestra_aulas_config %||% frame$config` (~1052 de router_calc_muestra.R)
# y `/aulas/seleccionar` como `frame$config %||% s$...` (~1106). Con `%||%` la
# primera lista no vacia gana ENTERA, asi que la otra se descarta completa: no es
# que se prefiera una clave, es que se pierde el resto. Con esto las dos rutas
# resuelven igual y por fusion.
test_that("el config vigente de una ruta fusiona marco, sesion y body en ese orden", {
  marco  <- list(selector = list(n_aulas = 30L, seed = 111L))
  sesion <- list(selector = list(faculty_targets = list(DERECHO = 19L), seed = 202L))
  body   <- list(selector = list(seed = 777L))

  # Sin body: la sesion manda sobre el marco y lo ausente se hereda.
  a <- .cm_aulas_config_vigente(sesion, marco, NULL)
  expect_identical(a$selector$seed, 202L)
  expect_identical(a$selector$n_aulas, 30L)
  expect_identical(a$selector$faculty_targets$DERECHO, 19L)

  # Con body: el body manda sobre las dos, sin borrar lo que no menciona.
  b <- .cm_aulas_config_vigente(sesion, marco, body)
  expect_identical(b$selector$seed, 777L)
  expect_identical(b$selector$n_aulas, 30L)
  expect_identical(b$selector$faculty_targets$DERECHO, 19L)
})

test_that("el config vigente NO descarta una fuente entera por estar la otra presente", {
  # Es lo que hacia `%||%`: con la sesion no vacia, el marco se perdia completo.
  marco  <- list(filters = list(min_eligible_per_class = 12L), selector = list(n_aulas = 174L))
  sesion <- list(selector = list(faculty_targets = list(DERECHO = 19L)))
  r <- .cm_aulas_config_vigente(sesion, marco, NULL)
  expect_identical(r$filters$min_eligible_per_class, 12L)
  expect_identical(r$selector$n_aulas, 174L)
  expect_length(r$selector$faculty_targets, 1L)
})
