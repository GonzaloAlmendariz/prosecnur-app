test_that("decir que no hay nada que decir no es rellenar el campo", {
  # Medido en acnur_pdm: meter «no» entre los rellenos daba un 33 % de relleno
  # en `recomendation` que era gente contestando que no tenia recomendaciones.
  s <- monitoreo_texto_senales(c("no", "ninguno", ".", "-", "xx"))
  expect_equal(s$negativa, c(TRUE, TRUE, FALSE, FALSE, FALSE))
  expect_equal(s$relleno, c(FALSE, FALSE, TRUE, TRUE, TRUE))
})

test_that("las dos cosas conviven en una misma pregunta y se cuentan aparte", {
  # Es el caso de `comentario_encuestador` en acnur_acg: 8.7 % de relleno y
  # 10.4 % de negativas en la misma columna.
  v <- c(rep(".", 2), rep("ninguno", 3), "el aula estaba llena", "sin incidencias")
  p <- monitoreo_texto_perfil(v)
  expect_equal(p$pct_relleno, round(100 * 2 / 7, 1))
  expect_equal(p$pct_negativa, round(100 * 3 / 7, 1))
})

test_that("un campo con solo puntuacion es relleno aunque no este en la lista", {
  s <- monitoreo_texto_senales(c("...", "??", "--", "a"))
  expect_equal(s$relleno, c(TRUE, TRUE, TRUE, FALSE))
})

test_that("las repeticiones ignoran mayusculas y espacios de sobra", {
  s <- monitoreo_texto_senales(c("NO hay", "no  hay", "no hay", "otra cosa"))
  expect_equal(s$repeticiones, c(3L, 3L, 3L, 1L))
})

test_that("una respuesta vacia no ocupa fila, y las filas apuntan al caso original", {
  # El indice tiene que servir para volver al caso y marcarlo; si se
  # renumerara, la señal no se podria seguir hasta la respuesta.
  s <- monitoreo_texto_senales(c("", "algo", NA, "  ", "otra"))
  expect_equal(s$fila, c(2L, 5L))
  expect_equal(s$texto, c("algo", "otra"))
})

test_that("el perfil describe la pregunta, no la juzga", {
  # `Enumerator_name` de acnur_pdm: 430 respuestas, 99.3 % repetidas. Repetir
  # ahi es lo correcto, y el perfil tiene que poder decirlo sin marcar nada.
  v <- c(rep("Ana Torres", 149), "Luis Paz")
  p <- monitoreo_texto_perfil(v, "quien encuesto")
  expect_equal(p$etiqueta, "quien encuesto")
  expect_equal(p$pct_repetida, 99.3)
  expect_equal(p$pct_relleno, 0)
  expect_equal(p$distintas, 2L)
})

test_that("el orden de lectura pone primero lo vacio y despues lo mas corto", {
  o <- monitoreo_texto_orden_de_lectura(c(
    "una respuesta larga y con contenido", "ok", ".", "algo mas"
  ))
  expect_equal(o$texto[1], ".")
  expect_equal(o$texto[2], "ok")
  expect_equal(o$texto[4], "una respuesta larga y con contenido")
})

test_that("el orden de lectura no esconde ninguna respuesta", {
  # Es un visualizador: ordena por donde empezar, no decide que se lee.
  v <- c("larga y con contenido de verdad", ".", "no", "x", "otra normal")
  expect_equal(nrow(monitoreo_texto_orden_de_lectura(v)), 5L)
})

test_that("entre igual de cortas, primero la que mas se repite", {
  o <- monitoreo_texto_orden_de_lectura(c("ab", "cd", "ab", "ef", "ab"))
  expect_equal(o$texto[1], "ab")
  expect_equal(o$repeticiones[1], 3L)
})

test_that("una pregunta sin respuestas no rompe nada", {
  s <- monitoreo_texto_senales(c(NA, "", "   "))
  expect_equal(nrow(s), 0L)
  p <- monitoreo_texto_perfil(c(NA, "", "   "))
  expect_equal(p$contestadas, 0L)
  expect_equal(p$sin_contestar, 3L)
  expect_true(is.na(p$pct_relleno))
})

test_that("las preguntas abiertas salen del instrumento y no de adivinar la base", {
  survey <- data.frame(
    type = c("text", "select_one si_no", "text", "note", "calculate"),
    name = c("RECP04_why", "P1", "obstacle_other", "aviso", "edad_calc"),
    label = c("¿Qué aspecto?", "¿Recibió?", "¿Qué otro obstáculo?", "Lea", ""),
    stringsAsFactors = FALSE
  )
  r <- monitoreo_texto_preguntas(survey, c("RECP04_why", "obstacle_other", "P1", "edad_calc"))
  expect_true(r$disponible)
  expect_equal(vapply(r$preguntas, function(p) p$variable, ""), c("RECP04_why", "obstacle_other"))
})

test_that("sin instrumento no se adivina: el motivo lo dice", {
  # Una heuristica sobre la base marcaba como abiertas las coordenadas GPS y la
  # fecha de Kobo, medido en acnur_acg.
  r <- monitoreo_texto_preguntas(NULL, c("gps_inicio", "kobo_fecha_hora"))
  expect_false(r$disponible)
  expect_match(r$motivo, "no trae instrumento")
  expect_length(r$preguntas, 0)
})

test_that("un instrumento sin preguntas abiertas se distingue de no tener instrumento", {
  survey <- data.frame(type = c("select_one x", "integer"), name = c("a", "b"), stringsAsFactors = FALSE)
  r <- monitoreo_texto_preguntas(survey, c("a", "b"))
  expect_false(r$disponible)
  expect_match(r$motivo, "ni una pregunta de texto abierto")
})

test_that("los identificadores se excluyen PERO quedan declarados, no desaparecen", {
  # El filtro por nombre puede equivocarse; si se ve la lista, el error se
  # corrige. Un filtro silencioso ya se comio cinco preguntas cerradas una vez.
  survey <- data.frame(
    type = rep("text", 4),
    name = c("Enumerator_name", "telephone", "Pulso_code", "recomendation"),
    label = c("Nombre", "Teléfono", "Código", "¿Alguna observación?"),
    stringsAsFactors = FALSE
  )
  r <- monitoreo_texto_preguntas(survey, c("Enumerator_name", "telephone", "Pulso_code", "recomendation"))
  expect_equal(vapply(r$preguntas, function(p) p$variable, ""), "recomendation")
  expect_length(r$excluidas, 3)
  expect_true(all(grepl("identificador", vapply(r$excluidas, function(p) p$motivo, ""))))
})

test_that("una pregunta de contenido no se excluye por llevar una palabra parecida", {
  survey <- data.frame(
    type = rep("text", 2),
    name = c("nombre_del_barrio", "codigo_postal_why"),
    label = c("¿Cómo se llama el barrio?", "¿Por qué?"),
    stringsAsFactors = FALSE
  )
  r <- monitoreo_texto_preguntas(survey, c("nombre_del_barrio", "codigo_postal_why"))
  expect_equal(length(r$preguntas), 2)
})

test_that("la columna se encuentra aunque venga con el prefijo de su grupo", {
  survey <- data.frame(type = "text", name = "D1_information_text", label = "¿Dónde?", stringsAsFactors = FALSE)
  r <- monitoreo_texto_preguntas(survey, c("otra", "D/D1_information_text"))
  expect_equal(r$preguntas[[1]]$columna, "D/D1_information_text")
})

test_that("una pregunta declarada que la base no trae se declara con SU motivo", {
  # Caso real: las tres `srv_*_why` de acnur_pdm viven en el repeat y no estan
  # en la base principal. No es lo mismo que ser un identificador.
  survey <- data.frame(type = "text", name = "srv_claridad_why", label = "¿Por qué?", stringsAsFactors = FALSE)
  r <- monitoreo_texto_preguntas(survey, c("otra_cosa"))
  expect_false(r$disponible)
  expect_length(r$excluidas, 1)
  expect_match(r$excluidas[[1]]$motivo, "la base no trae su columna")
})

test_that("el payload declara cuantas respuestas muestra de cuantas hay", {
  # Una lista recortada sin decir cuanto se recorto se lee como si fuera todo.
  survey <- data.frame(type = "text", name = "p", label = "¿Por qué?", stringsAsFactors = FALSE)
  respuestas <- data.frame(p = paste("respuesta", 1:40), stringsAsFactors = FALSE)
  p <- monitoreo_texto_abierto_payload(respuestas, survey, por_pregunta = 10L)
  expect_true(p$disponible)
  expect_equal(p$preguntas[[1]]$mostradas, 10L)
  expect_equal(p$preguntas[[1]]$perfil$contestadas, 40L)
  expect_length(p$preguntas[[1]]$respuestas, 10L)
})

test_that("el dashboard de aulas publica el bloque y dice que no hay instrumento", {
  d <- monitoreo_aulas_dashboard(
    list(list(classroom_id = "CH 1", operational_code = "CH 1", eligible_n = 30)),
    data.frame(sexo = c("1", "2")), list()
  )
  expect_false(is.null(d$texto_abierto))
  expect_false(d$texto_abierto$disponible)
  expect_match(d$texto_abierto$motivo, "no trae instrumento")
})

test_that("la banda de una tasa aguanta el 0 % y el 100 %", {
  # La mitad de los aplicadores de acnur_pdm tienen 0 % de relleno. Una banda
  # simetrica daria limites negativos; Wilson no.
  cero <- monitoreo_banda_proporcion(0, 32)
  expect_equal(cero$inferior, 0)
  expect_true(cero$superior > 0 && cero$superior < 0.15)

  todo <- monitoreo_banda_proporcion(20, 20)
  expect_equal(todo$superior, 1)
  expect_true(todo$inferior > 0.8)

  # Y se estrecha con mas casos: 5 de 10 no es lo mismo que 50 de 100.
  poco <- monitoreo_banda_proporcion(5, 10)
  mucho <- monitoreo_banda_proporcion(50, 100)
  expect_true((mucho$superior - mucho$inferior) < (poco$superior - poco$inferior) / 2)
})

test_that("el mismo nombre escrito distinto es el mismo aplicador", {
  # Medido: los 19 aplicadores nominales de acnur_pdm son 17 tras unir
  # mayusculas y espacios de sobra.
  g <- monitoreo_texto_normaliza_grupo(c(
    "JORGE DEL SOLAR", "JORGE  DEL SOLAR", "Silbia Cruzado", "silbia cruzado", "Otro"
  ))
  expect_equal(length(unique(g$clave)), 3L)
  expect_equal(g$fusionados, 2L)
})

test_that("parecerse no es ser: un nombre con un typo no se fusiona", {
  # «MARTHA VILANUEVA» no es «MARTHA VILLANUEVA». Fusionar por parecido
  # inventaria datos; el caso se reconoce porque queda con un solo registro.
  g <- monitoreo_texto_normaliza_grupo(c("MARTHA VILLANUEVA", "MARTHA VILANUEVA"))
  expect_equal(length(unique(g$clave)), 2L)
  expect_equal(g$fusionados, 0L)
})

test_that("la forma que se muestra es la mas frecuente, no la primera", {
  g <- monitoreo_texto_normaliza_grupo(c("silbia cruzado", "Silbia Cruzado", "Silbia Cruzado"))
  expect_equal(unique(g$visible), "Silbia Cruzado")
})

test_that("destaca quien no alcanza a lo que hace el resto", {
  # Caso real: dos aplicadores con ~92 % de negativas contra un resto en ~24 %.
  respuestas <- c(rep("no", 18), rep("una respuesta con contenido", 2),
                  rep("otra cosa con contenido", 18), rep("no", 2))
  grupo <- c(rep("el que dice no", 20), rep("el resto", 20))
  r <- monitoreo_texto_por_grupo(respuestas, grupo, "negativa")
  expect_true(r$destaca[r$grupo == "el que dice no"])
  expect_equal(r$tasa[r$grupo == "el que dice no"], 90)

  # El control: con tasas parecidas nadie destaca.
  parejo <- monitoreo_texto_por_grupo(
    c(rep("no", 10), rep("con contenido de verdad", 10), rep("no", 9), rep("otro contenido", 11)),
    c(rep("uno", 20), rep("otro", 20)), "negativa"
  )
  expect_false(any(parejo$destaca))
})

test_that("un grupo de un caso no destaca y no encabeza la lista", {
  # Un 100 % sobre un caso arriba del todo se lee como «el peor» y no dice nada.
  respuestas <- c(".", rep(c("con contenido", "."), 10))
  grupo <- c("solo uno", rep("el grande", 20))
  r <- monitoreo_texto_por_grupo(respuestas, grupo, "relleno")
  expect_equal(r$grupo[1], "el grande")
  expect_true(r$n_bajo[r$grupo == "solo uno"])
  expect_false(r$destaca[r$grupo == "solo uno"])
})

test_that("el grupo se cuenta sobre quien contesto, no sobre quien fue asignado", {
  # En acnur_pdm, Katherine Colan tiene 46 respuestas pero solo 12 en la abierta.
  r <- monitoreo_texto_por_grupo(c("algo", "", NA, "otra", "."), rep("ana", 5), "relleno")
  expect_equal(r$n, 3L)
})

test_that("una señal que no existe no se inventa", {
  expect_error(
    monitoreo_texto_por_grupo(c("a", "b"), c("x", "y"), "inventada"),
    "senal"
  )
})
