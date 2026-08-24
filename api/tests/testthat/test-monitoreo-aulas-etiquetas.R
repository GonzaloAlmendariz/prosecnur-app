# El idioma de las superficies de aulas.
#
# Gonzalo (2026-08-24): «que la informacion de los graficos e indicadores no sea
# muy criptica en la app sino que se entienda claramente sin caer en jerga».
#
# Este archivo es la vara hecha test: recorre TODAS las frases publicables y
# falla si alguna cae en la jerga que la superficie no puede usar.

test_that("ninguna frase publicable usa jerga", {
  frases <- monitoreo_aulas_etiquetas_publicables()
  expect_gt(length(frases), 15L)
  # `unname`: las frases vienen nombradas por su clave y un vector vacio CON
  # nombres no es identico a `character(0)`. Sin esto el test fallaba sin que
  # ninguna etiqueta tuviera jerga, que es la peor clase de rojo: el que enseña
  # a desconfiar del test en vez de del codigo.
  malas <- unname(frases[grepl(MONITOREO_AULAS_JERGA_PROHIBIDA, frases, ignore.case = TRUE)])
  expect_identical(malas, character(0))
})

test_that("el pasado y el futuro no se confunden entre si", {
  # Las dos lecturas conviven en la misma pantalla: una dice donde estas y la
  # otra si vas a llegar. Si las frases se parecieran, la pantalla mentiria.
  expect_match(monitoreo_aulas_etiqueta_celda("alcanzada"), "Ya llego")
  expect_match(.mac_etiqueta_estado("asegurada"), "Va a llegar")
  expect_false(grepl("Va a llegar", monitoreo_aulas_etiqueta_celda("alcanzada")))
  expect_false(grepl("Ya llego", .mac_etiqueta_estado("asegurada")))
})

test_that("el caso peor suena como el caso peor", {
  # `sin_avance` es cero encuestas. El nombre viejo, «pendiente», tranquilizaba
  # justo donde habia que mirar; la frase no puede repetir ese error.
  f <- monitoreo_aulas_etiqueta_celda("sin_avance")
  expect_match(f, "sin ninguna encuesta")
  expect_false(grepl("pendiente|en curso|en progreso", f, ignore.case = TRUE))
})

test_that("cada tramo lleva su denominador, para no tener que recordar el corte", {
  # Es la mitad de lo que hace criptico a un grafico: una barra que dice
  # «insuficiente» obliga a saber donde cae el corte; una que dice «50-75 %», no.
  for (t in c("satisfactorio", "parcial", "insuficiente")) {
    expect_match(monitoreo_aulas_etiqueta_tramo(t), "%")
  }
  # Los extremos no lo necesitan y no deben sobreexplicar.
  expect_identical(monitoreo_aulas_etiqueta_tramo("nulo"), "Sin respuestas")
  expect_identical(monitoreo_aulas_etiqueta_tramo("pleno"), "Llego a lo esperado")
})

test_that("una clave desconocida no inventa una frase tranquilizadora", {
  # Si el motor publica un estado nuevo y nadie le puso frase, la superficie
  # tiene que decir que no sabe — no elegir el que suene mejor.
  expect_identical(monitoreo_aulas_etiqueta_celda("inventado"), "Sin estado")
  expect_identical(monitoreo_aulas_etiqueta_tramo("inventado"), "Sin evaluar")
})

test_that("la lista publicable cubre TODAS las claves que los motores emiten", {
  # El hueco tipico: se anade un estado al motor y no a las etiquetas, y el test
  # anti-jerga sigue verde porque solo mira las que ya conocia.
  frases <- monitoreo_aulas_etiquetas_publicables()
  celda <- unique(.monitoreo_aulas_quota_estado(c(0, 100, 100, 100), c(0, 100, 1, 0)))
  proy <- unique(.mac_estado_proyectado(c(0, 100, 100, 100, 100), c(5, 120, 102, 90, 90),
                                        c(NA, NA, NA, 5, 0)))
  for (e in celda) expect_true(monitoreo_aulas_etiqueta_celda(e) %in% frases)
  for (e in proy) expect_true(.mac_etiqueta_estado(e, 3L) %in% frases)
  # Y los seis tramos que publica el motor de cobertura.
  for (t in c("nulo", "critico", "insuficiente", "parcial", "satisfactorio", "pleno")) {
    expect_true(monitoreo_aulas_etiqueta_tramo(t) %in% frases)
  }
})


# --- La frase viaja en el payload -------------------------------------------
#
# Traducir en R y no en el front tiene un motivo medido: en el recorte de tramos
# la definicion estaba duplicada en los dos lenguajes y el grafico las emparejaba
# POR POSICION, asi que mover una banda cambiaba los numeros de etiqueta sin
# romper nada. Un solo dueño del idioma mata esa familia entera de defectos.

test_that("los tramos de cobertura publican su frase junto a la clave", {
  plan <- lapply(1:3, function(i) list(
    operational_code = sprintf("CH %d", i), classroom_id = sprintf("a%d", i),
    faculty = "DERECHO", sample_role = "titular", expected_valid = 10,
    eligible_n = 30, sample_status = "agendada", operational_status = "aplicada",
    responses_total = c(0, 5, 12)[i]
  ))
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list())
  claves <- vapply(d$course_status_cobertura, function(x) x$clave, character(1))
  frases <- vapply(d$course_status_cobertura, function(x) x$etiqueta %||% "", character(1))
  expect_identical(claves, c("nulo", "critico", "insuficiente", "parcial", "satisfactorio", "pleno"))
  # Cada clave con SU frase, y ninguna vacia: una etiqueta ausente en el payload
  # obliga al front a inventarse una, que es de donde salen las divergencias.
  expect_true(all(nzchar(frases)))
  expect_identical(frases, vapply(claves, monitoreo_aulas_etiqueta_tramo, character(1), USE.NAMES = FALSE))
})

test_that("ninguna frase del payload cae en la jerga prohibida", {
  # El test de arriba comprueba las frases de la funcion; este comprueba las que
  # SALEN de verdad, que es lo que ve una persona.
  plan <- list(list(operational_code = "CH 1", classroom_id = "a1", faculty = "DERECHO",
                    sample_role = "titular", expected_valid = 10, eligible_n = 30,
                    sample_status = "agendada", operational_status = "aplicada",
                    responses_total = 4))
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list())
  frases <- vapply(d$course_status_cobertura, function(x) as.character(x$etiqueta %||% ""), character(1))
  expect_false(any(grepl(MONITOREO_AULAS_JERGA_PROHIBIDA, frases, ignore.case = TRUE)))
})
