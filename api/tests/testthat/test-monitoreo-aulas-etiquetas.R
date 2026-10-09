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
  pasado <- monitoreo_aulas_etiqueta_celda("alcanzada")
  futuro <- .mac_etiqueta_estado("asegurada")
  expect_match(pasado, "Ya llegó")
  # **La frase del futuro cambió el 2026-09-10 y esto no fija el literal.**
  # Era «Va a llegar, con margen» y ahora nombra su universo —«Llega con todo el
  # plan, con margen»— porque `estado` mide el plan ENTERO y esa promesa sólo se
  # cumple si todo lo que aún no está agendado acaba agendándose. Lo que el test
  # vigila no es la redacción sino que las dos lecturas no se confundan: una
  # dice dónde estás y la otra si vas a llegar.
  expect_match(futuro, "[Ll]lega")
  expect_false(grepl("Ya llegó", futuro, fixed = TRUE))
  expect_false(grepl("con todo el plan", pasado, fixed = TRUE))
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
  expect_identical(monitoreo_aulas_etiqueta_tramo("pleno"), "Llegó a lo esperado")
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

# Las frases publicables se escriben en español, con sus tildes.
#
# Medido el 2026-08-29 en pantalla: `avance/resumen` mostraba «Se quedo a
# medias», «Llego a la mayor parte» y «Casi llego», y `calidad/controles` frases
# como «Los numeros de cada parte de campo cuadran». No era una convencion del
# archivo —en el MISMO vector conviven «Empezó, todavía no llega» y «habrá que
# ponderar»—, era una inconsistencia: unas se escribieron con tilde y otras no.
# `DESCRIPTION` declara `Encoding: UTF-8` y 387 archivos de `api/R` ya llevan
# tildes, asi que no hay barrera tecnica.
#
# El guard es una lista negra corta y solo de casos INEQUIVOCOS: nada de «mas»,
# «solo» o «esta», que existen con y sin tilde segun la funcion.
test_that("ninguna frase publicable pierde una tilde inequivoca", {
  sin_tilde <- c("llego", "quedo", "aplico", "numeros", "estan", "validas",
                 "identificacion", "aplicacion", "seleccion", "dias", "tambien",
                 "asi", "aqui", "ademas", "minimo", "maximo", "ultimo",
                 "codigo", "metodo", "analisis", "atencion", "sesion",
                 "version", "revision", "deficit", "porcentaje minimo")
  frases <- monitoreo_aulas_etiquetas_publicables()
  # Palabra entera y sin distinguir mayusculas: «Llego» al principio de la frase
  # es el caso que se colo cuatro veces.
  patron <- paste0("\\b(", paste(sin_tilde, collapse = "|"), ")\\b")
  # `unname`: las frases vienen de `vapply`, que las devuelve CON NOMBRES, y un
  # `named character(0)` no es `identical` a `character(0)`. El primer intento
  # de este test fallo por eso teniendo cero culpables.
  culpables <- unname(frases[grepl(patron, frases, ignore.case = TRUE, perl = TRUE)])
  expect_identical(culpables, character(0))
})

test_that("el guard de tildes mira algo: la lista de frases no esta vacia", {
  # Sin este control, vaciar `monitoreo_aulas_etiquetas_publicables()` dejaria el
  # test de arriba en verde sin comprobar una sola frase. Verde por ausencia.
  expect_gt(length(monitoreo_aulas_etiquetas_publicables()), 20L)
})
