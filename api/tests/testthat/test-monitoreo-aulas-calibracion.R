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
  expect_identical(.mac_etiqueta_calibracion(0.85), "El campo está rindiendo un 15 % menos de lo previsto")
  expect_identical(.mac_etiqueta_calibracion(1.2), "El campo está rindiendo un 20 % más de lo previsto")
  expect_identical(.mac_etiqueta_calibracion(1), "El campo está rindiendo lo previsto")
  # Sin dato NO es cero ni es «sin calibrar»: es que aun no hay con que comparar.
  expect_identical(.mac_etiqueta_calibracion(NA), "Todavía sin cursos-horario aplicados con qué comparar")
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


# --- De donde sale el previsto por sexo --------------------------------------

test_that("la hoja de control manda cuando trae los esperados por sexo", {
  r <- monitoreo_aulas_avance_sexo_facultad(
    list(list(faculty = "DERECHO", operational_status = "aplicada",
              mujeres_esperadas = 80, hombres_esperados = 40,
              # Aunque tambien venga la composicion, el dato directo gana.
              expected_valid = 999, sex_top_1 = "F", sex_top_1_n = 1,
              sex_top_2 = "M", sex_top_2_n = 1)),
    list(list(faculty = "DERECHO", sex = "F", target = 200, observed = 68))
  )
  expect_equal(r[[1]]$previsto, 80)
  expect_identical(r[[1]]$previsto_origen, "hoja_de_control")
})

test_that("sin esperados por sexo se derivan de la composicion del aula", {
  # 120 esperadas repartidas 30/10 dan 90 mujeres y 30 hombres. Es la misma
  # aritmetica que ya usaba `.monitoreo_aulas_plan_sex_faculty_targets` para las
  # metas; lo nuevo es separarla por estado de aplicacion.
  r <- monitoreo_aulas_avance_sexo_facultad(
    list(list(faculty = "DERECHO", operational_status = "aplicada", expected_valid = 120,
              sex_top_1 = "F", sex_top_1_n = 30, sex_top_2 = "M", sex_top_2_n = 10)),
    list(list(faculty = "DERECHO", sex = "F", target = 200, observed = 76),
         list(faculty = "DERECHO", sex = "M", target = 100, observed = 28))
  )
  celdas <- stats::setNames(r, vapply(r, function(c) c$sex, character(1)))
  expect_equal(celdas[["F"]]$previsto, 90)
  expect_equal(celdas[["M"]]$previsto, 30)
  expect_identical(celdas[["F"]]$previsto_origen, "composicion_del_aula")
})

test_that("el origen del previsto VIAJA, porque los dos no valen lo mismo", {
  # La derivacion asume que la efectividad no depende del sexo — que es
  # exactamente el supuesto que la calibracion existe para poner a prueba. Una
  # calibracion sobre un previsto derivado mide el supuesto y el campo a la vez,
  # y quien lea tiene que poder saberlo.
  mixto <- monitoreo_aulas_avance_sexo_facultad(
    list(list(faculty = "DERECHO", operational_status = "aplicada", mujeres_esperadas = 80),
         list(faculty = "DERECHO", operational_status = "aplicada", expected_valid = 40,
              sex_top_1 = "F", sex_top_1_n = 10)),
    list(list(faculty = "DERECHO", sex = "F", target = 200, observed = 100))
  )
  expect_identical(mixto[[1]]$previsto_origen, "mixto")
  sin <- monitoreo_aulas_avance_sexo_facultad(
    list(list(faculty = "DERECHO", operational_status = "aplicada")),
    list(list(faculty = "DERECHO", sex = "F", target = 200, observed = 0))
  )
  expect_identical(sin[[1]]$previsto_origen, "sin_dato")
  expect_true(is.na(sin[[1]]$previsto))
})

# La calibración es `logrado / previsto` sin suelo ni techo, así que una celda
# diminuta produce una afirmación tan rotunda como una grande.
#
# Medido el 2026-08-30 en HSVG2026: EDUCACION/M tiene `previsto` 2,5 y `logrado`
# 1 —calibración 0,404— y la frase salía «El campo está rindiendo un 60 % menos
# de lo previsto». Una sentencia sobre el campo de esa celda sacada de UNA
# encuesta: con dos habría dicho 20 % menos, y con tres, 20 % más.
#
# El motor ya aplicaba este criterio a la dispersión —no se publica con menos de
# `.MAC_MINIMO_PARA_DISPERSION` aulas, y su vista lo declara en vez de callarlo—
# y no se le había aplicado a la calibración.
test_that("la etiqueta de calibración declara su base cuando es corta", {
  frase <- prosecnurapp:::.mac_etiqueta_calibracion(0.404, previsto = 2.5)
  expect_match(frase, "60 % menos de lo previsto", fixed = TRUE)
  expect_match(frase, "sobre muy poco", fixed = TRUE)
  expect_match(frase, "2,5 encuestas previstas", fixed = TRUE)
})

test_that("con base suficiente no añade salvedad: sería ruido en 29 de 30 celdas", {
  frase <- prosecnurapp:::.mac_etiqueta_calibracion(0.807, previsto = 45)
  expect_match(frase, "19 % menos de lo previsto", fixed = TRUE)
  expect_false(grepl("sobre muy poco", frase, fixed = TRUE))
})

test_that("el singular no se rompe con una sola encuesta prevista", {
  expect_match(prosecnurapp:::.mac_etiqueta_calibracion(0.5, previsto = 1),
               "1 encuesta prevista", fixed = TRUE)
})

test_that("sin previsto se comporta como antes: la salvedad no se inventa", {
  expect_equal(prosecnurapp:::.mac_etiqueta_calibracion(1.268),
               "El campo está rindiendo un 27 % más de lo previsto")
})

test_that("las dos ramas que no afirman nada siguen intactas", {
  expect_equal(prosecnurapp:::.mac_etiqueta_calibracion(NA_real_, previsto = 2),
               "Todavía sin cursos-horario aplicados con qué comparar")
  expect_equal(prosecnurapp:::.mac_etiqueta_calibracion(1.001, previsto = 2),
               "El campo está rindiendo lo previsto")
})

# **Un curso-horario reemplazado no aporta ni va a aportar.**
#
# Salió del plan por su reserva, y esa reserva viaja en el MISMO plan con su
# propio `expected_valid`. Contando las dos, lo que se espera recibir se cuenta
# dos veces.
#
# Medido en HSVG2026 el 2026-08-30: 18 reemplazadas con 329,3 efectivas
# esperadas y sus 18 reservas YA aplicadas con 317,2 que están en `logrado`. El
# aporte pendiente total era 534,8, así que el 62 % de lo que se esperaba recibir
# correspondía a aulas muertas. De ahí salían 25 de 30 celdas «asegurada» con 9
# por debajo de su cuota.
.mac_fila_prueba <- function(estado, esperadas, rol = "titular") {
  list(faculty = "EDUCACION", operational_status = estado, sample_role = rol,
       expected_valid = esperadas, sex_top_1 = "F", sex_top_1_n = 1,
       sex_top_2 = "M", sex_top_2_n = 1)
}

test_that("una reemplazada no suma a lo que queda por recibir", {
  cuotas <- list(list(faculty = "EDUCACION", sex = "F", target = 10))
  con <- prosecnurapp::monitoreo_aulas_avance_sexo_facultad(
    list(.mac_fila_prueba("aplicada", 20), .mac_fila_prueba("reemplazada", 40)), cuotas)
  sin <- prosecnurapp::monitoreo_aulas_avance_sexo_facultad(
    list(.mac_fila_prueba("aplicada", 20)), cuotas)
  celda <- function(x) Filter(function(c1) identical(c1$sex, "F"), x)[[1]]
  # La reemplazada aportaba 20 a la mitad F: con ella, `aporte_pendiente` subía.
  expect_equal(celda(con)$aporte_pendiente, celda(sin)$aporte_pendiente)
  expect_equal(celda(con)$previsto, celda(sin)$previsto)
})

test_that("una cerrada cuenta como aplicada, no como pendiente", {
  cuotas <- list(list(faculty = "EDUCACION", sex = "F", target = 10))
  cerrada <- prosecnurapp::monitoreo_aulas_avance_sexo_facultad(
    list(.mac_fila_prueba("cerrada", 20)), cuotas)
  aplicada <- prosecnurapp::monitoreo_aulas_avance_sexo_facultad(
    list(.mac_fila_prueba("aplicada", 20)), cuotas)
  celda <- function(x) Filter(function(c1) identical(c1$sex, "F"), x)[[1]]
  # Lo suyo va al `previsto` —lo que las aplicadas debían aportar—, no a lo que
  # falta por recibir. Es el mismo criterio que `aulas_aplicadas`, que cuenta
  # `operational_status %in% c("aplicada", "cerrada")`.
  expect_equal(celda(cerrada)$previsto, celda(aplicada)$previsto)
  expect_equal(celda(cerrada)$aporte_pendiente, celda(aplicada)$aporte_pendiente)
})

test_that("una agendada SÍ sigue siendo aporte pendiente: es la que aún puede llegar", {
  cuotas <- list(list(faculty = "EDUCACION", sex = "F", target = 10))
  celdas <- prosecnurapp::monitoreo_aulas_avance_sexo_facultad(
    list(.mac_fila_prueba("aplicada", 20), .mac_fila_prueba("agendada", 40)), cuotas)
  celda <- Filter(function(c1) identical(c1$sex, "F"), celdas)[[1]]
  expect_gt(celda$aporte_pendiente, 0)
})

# --- El aula aplicada que el PLAN sigue llamando «planificada» -----------------

test_that("una aula con respuestas cuenta como APLICADA aunque el plan diga «planificada»", {
  # **`operational_status` no lo actualiza nadie.** Medido sobre HSVG26ULT2 el
  # 2026-09-10: vale «planificada» en los 174 titulares mientras 60 ya tenían
  # respuestas. Como esta función decidía con ese campo, esas 60 caían del lado
  # de las PENDIENTES y su aporte esperado se sumaba a la proyección ADEMÁS de
  # su logrado real: 1 059 esperadas encima de 1 184 logradas.
  #
  # El efecto en pantalla: las 30 celdas del estudio salían «asegurada» —la
  # proyección daba 4 350 sobre una cuota de 2 500— y por eso
  # `reserva_dirigida` publicaba CERO candidatos y el panel «A qué aula del
  # banco ir» no se encendía nunca.
  #
  # Es el mismo defecto que ya obligó a reparar `dos_tasas` (`531369a2`) en otro
  # consumidor, y el arreglo es el mismo: derivar de la EVIDENCIA.
  plan <- list(
    list(faculty = "DERECHO", operational_code = "CH 1",
         operational_status = "planificada", respuestas_validas = 40,
         mujeres_esperadas = 80, hombres_esperados = 0),
    list(faculty = "DERECHO", operational_code = "CH 2",
         operational_status = "planificada", respuestas_validas = 0,
         mujeres_esperadas = 60, hombres_esperados = 0)
  )
  cuotas <- list(list(faculty = "DERECHO", sex = "F", target = 200, observed = 40))
  a <- monitoreo_aulas_avance_sexo_facultad(plan, cuotas)[[1]]

  # CH 1 ya aportó: sus 80 esperadas van al previsto, NO al pendiente.
  expect_equal(a$previsto, 80)
  expect_equal(a$aporte_pendiente, 60)
  # Y la proyección deja de contar dos veces: 40 logradas + 60 por venir.
  expect_equal(a$proyeccion, 100)
})

test_that("el parte de campo también vale como evidencia, sin respuestas de plataforma", {
  # La misma regla que `monitoreo_aulas_aula_aplicada()`: plataforma primero,
  # parte como respaldo. Un aula aplicada cuyo dato aún no llegó a Kobo no
  # puede volver a contarse como pendiente.
  plan <- list(
    list(faculty = "DERECHO", operational_code = "CH 1",
         operational_status = "planificada", application_status = "APLICADA",
         mujeres_esperadas = 80, hombres_esperados = 0)
  )
  cuotas <- list(list(faculty = "DERECHO", sex = "F", target = 200, observed = 35))
  a <- monitoreo_aulas_avance_sexo_facultad(plan, cuotas)[[1]]
  expect_equal(a$previsto, 80)
  expect_equal(a$aporte_pendiente, 0)
})
