# Avance por celda facultad x sexo: logrado / previsto / proyectado / calibracion.

test_that("los cinco estados proyectados dicen si VAS a llegar, no si ya llegaste", {
  e <- .mac_estado_proyectado
  expect_identical(e(0, 5), "sin_cuota")
  # Con 5 % de margen o mas, asegurada; por encima de la cuota pero por debajo
  # del margen, ajustada: la celda llega pero no sobra nada y hay que vigilarla.
  expect_identical(e(100, 120), "asegurada")
  expect_identical(e(100, 105), "asegurada")
  expect_identical(e(100, 104), "ajustada")
  expect_identical(e(100, 100), "ajustada")
  expect_identical(e(100, 99), "deficit_proyectado")
})

test_that("«no subsanable» exige saber que no queda pool; sin saberlo no se declara", {
  e <- .mac_estado_proyectado
  # Con pool agotado la accion de campo ya no existe: queda ponderar. Es el
  # estado que tuvo EE.GG. LETRAS hombres en 2025 (166 de 180, peso 1,1538).
  expect_identical(e(100, 90, 0), "deficit_no_subsanable")
  # Con pool disponible, o sin saber si lo hay, se pide una accion posible en
  # vez de declarar una derrota que quiza no lo sea.
  expect_identical(e(100, 90, 5), "deficit_proyectado")
  expect_identical(e(100, 90, NA), "deficit_proyectado")
})

test_that("la proyeccion mira adelante y por eso NO comparte estado con la celda retrospectiva", {
  # `alcanzada` (ya llegaste) y `asegurada` (vas a llegar) son lecturas
  # distintas y tienen que seguir siendo palabras distintas.
  proy <- unique(.mac_estado_proyectado(c(100, 100, 100), c(120, 100, 50)))
  retro <- unique(.monitoreo_aulas_quota_estado(c(100, 100, 100), c(120, 100, 50)))
  expect_length(intersect(proy, retro), 0L)
})

test_that("la brecha se pide entera y hacia arriba: 0,1 personas es una persona", {
  expect_identical(.mac_brecha(100, 97.4), 3L)
  expect_identical(.mac_brecha(34, 33.9), 1L)
  # Cubierta o de sobra, cero. Nunca negativa: «sobran 3» no es una brecha.
  expect_identical(.mac_brecha(100, 100), 0L)
  expect_identical(.mac_brecha(100, 130), 0L)
})

test_that("la calibracion compara lo logrado con lo que se preveia", {
  # El sesgo de 2025: la composicion lograda se fue +3,4 pp hacia mujeres, con
  # 10 de 14 facultades en la misma direccion. Una celda de hombres que rinde
  # 85 donde se preveian 100 lo canta con un 0,85.
  expect_equal(.mac_calibracion(85, 100), 0.85)
  expect_equal(.mac_calibracion(120, 100), 1.2)
})

test_that("sin previsto la calibracion es NA, no cero", {
  # Una celda cuyas aulas aun no se aplican no esta descalibrada: es que todavia
  # no hay con que comparar. Un 0 la pintaria de rojo el primer dia de campo.
  expect_true(is.na(.mac_calibracion(0, 0)))
  expect_true(is.na(.mac_calibracion(10, NA)))
  expect_true(is.na(.mac_calibracion(NA, 100)))
})

test_that("el umbral de `ajustada` es el 5 % que se decidio, y esta declarado", {
  expect_equal(.MAC_MARGEN_AJUSTADA, 0.05)
  # Justo por debajo y justo por encima del umbral, para que mover el numero
  # rompa el test en vez de cambiar el color en silencio.
  expect_identical(.mac_estado_proyectado(100, 105), "asegurada")
  expect_identical(.mac_estado_proyectado(100, 104.9), "ajustada")
})

# --- El acumulador por celda -------------------------------------------------

.mac_plan <- function() list(
  # Aplicadas: son las UNICAS que pueden formar el previsto.
  list(faculty = "DERECHO", operational_status = "aplicada", mujeres_esperadas = 80, hombres_esperados = 40),
  # Pendientes: alimentan la proyeccion, nunca el previsto.
  list(faculty = "DERECHO", operational_status = "agendada", mujeres_esperadas = 60, hombres_esperados = 30),
  # Otra facultad: no puede contaminar la celda de DERECHO.
  list(faculty = "PSICOLOGIA", operational_status = "aplicada", mujeres_esperadas = 50, hombres_esperados = 10)
)

.mac_cuotas <- function() list(
  list(faculty = "DERECHO", sex = "F", target = 200, observed = 68),
  list(faculty = "DERECHO", sex = "M", target = 100, observed = 38)
)

.mac_avance <- function(...) {
  r <- monitoreo_aulas_avance_sexo_facultad(.mac_plan(), .mac_cuotas(), ...)
  stats::setNames(r, vapply(r, function(c) paste0(c$faculty, "|", c$sex), character(1)))
}

test_that("el previsto cuenta SOLO las aulas ya aplicadas", {
  # Es el denominador de la calibracion: meter las pendientes ahi pintaria de
  # rojo el primer dia de campo, cuando no ha fallado nada.
  a <- .mac_avance()[["DERECHO|F"]]
  expect_equal(a$previsto, 80)
  expect_equal(a$aporte_pendiente, 60)
})

test_that("la proyeccion suma lo logrado y lo que aportaran las pendientes", {
  a <- .mac_avance()[["DERECHO|F"]]
  expect_equal(a$proyeccion, 68 + 60)
  # 200 - 128 = 72, entero y hacia arriba.
  expect_identical(a$brecha, 72L)
  expect_identical(a$estado, "deficit_proyectado")
})

test_that("la calibracion compara logrado contra previsto, no contra la cuota", {
  # 68 sobre 80 previstos = 0,85. Contra la cuota (200) daria 0,34 y seria otra
  # pregunta: «voy atrasado» y «el campo rinde menos de lo que dije» no son lo
  # mismo, y solo la segunda avisa de un sesgo.
  expect_equal(.mac_avance()[["DERECHO|F"]]$calibracion, 0.85)
  expect_equal(.mac_avance()[["DERECHO|M"]]$calibracion, 0.95)
})

test_that("una facultad no contamina la celda de otra", {
  # PSICOLOGIA aplica 50 mujeres esperadas y DERECHO sigue con 80.
  expect_equal(.mac_avance()[["DERECHO|F"]]$previsto, 80)
})

test_that("el pool agotado convierte el deficit en no subsanable", {
  a <- .mac_avance(pool_restante = list("derecho|F" = 0))
  expect_identical(a[["DERECHO|F"]]$estado, "deficit_no_subsanable")
  # Y la otra celda, sin pool declarado, se queda en la accion posible.
  expect_identical(a[["DERECHO|M"]]$estado, "deficit_proyectado")
})

test_that("sin aulas aplicadas el previsto es NA y la calibracion tambien", {
  r <- monitoreo_aulas_avance_sexo_facultad(
    list(list(faculty = "DERECHO", operational_status = "agendada", mujeres_esperadas = 60)),
    list(list(faculty = "DERECHO", sex = "F", target = 200, observed = 0))
  )
  expect_true(is.na(r[[1]]$previsto))
  expect_true(is.na(r[[1]]$calibracion))
  # Pero la proyeccion SI existe: las pendientes ya se pueden contar.
  expect_equal(r[[1]]$proyeccion, 60)
})

# --- Las etiquetas: sin jerga ------------------------------------------------
#
# Gonzalo (2026-08-24): «que la informacion de los graficos e indicadores no sea
# muy criptica en la app sino que se entienda claramente sin caer en jerga».

test_that("cada estado tiene una frase que se entiende sola", {
  expect_identical(.mac_etiqueta_estado("asegurada"), "Va a llegar, con margen")
  expect_identical(.mac_etiqueta_estado("ajustada"), "Va a llegar, sin margen: hay que vigilarla")
  expect_identical(.mac_etiqueta_estado("sin_cuota"), "Sin cuota trazada")
})

test_that("la etiqueta del deficit dice CUANTO falta, que es lo que manda a alguien a un aula", {
  # «deficit proyectado» no mueve a nadie; «faltan 3 encuestas» si.
  expect_match(.mac_etiqueta_estado("deficit_proyectado", 3L), "faltan 3 encuestas")
  # Singular sin «1 encuestas».
  expect_match(.mac_etiqueta_estado("deficit_proyectado", 1L), "falta 1 encuesta")
  expect_no_match(.mac_etiqueta_estado("deficit_proyectado", 1L), "1 encuestas")
  # Y el no subsanable dice ademas que la accion ya no es de campo.
  expect_match(.mac_etiqueta_estado("deficit_no_subsanable", 5L), "ponderar")
})

test_that("la calibracion se lee en direccion y magnitud, sin decir «calibracion»", {
  expect_identical(.mac_etiqueta_calibracion(0.85), "El campo esta rindiendo un 15 % menos de lo previsto")
  expect_identical(.mac_etiqueta_calibracion(1.2), "El campo esta rindiendo un 20 % mas de lo previsto")
  expect_identical(.mac_etiqueta_calibracion(1), "El campo esta rindiendo lo previsto")
  # Sin dato NO es cero ni es «sin calibrar»: es que aun no hay con que comparar.
  expect_identical(.mac_etiqueta_calibracion(NA), "Todavia sin aulas aplicadas con que comparar")
})

test_that("ninguna etiqueta usa jerga prohibida", {
  # La lista de la vara: tau, deff, residual, P25, bootstrap, Madow, cubo,
  # estrato, frame_hash, tramo, vara.
  jerga <- "tau|\\bdeff\\b|residual|P25|bootstrap|Madow|cubo|estrato|frame_hash|tramo|\\bvara\\b|calibraci"
  frases <- c(
    vapply(c("sin_cuota", "asegurada", "ajustada", "deficit_proyectado", "deficit_no_subsanable"),
           function(e) .mac_etiqueta_estado(e, 3L), character(1)),
    vapply(list(0.85, 1.2, 1, NA), .mac_etiqueta_calibracion, character(1))
  )
  expect_false(any(grepl(jerga, frases, ignore.case = TRUE)))
})
