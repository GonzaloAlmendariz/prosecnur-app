# Un estatus que la app no conoce se declara, no se traga.
#
# Pedido de Gonzalo (2026-09-12, textual): «no sé ni siquiera si está siendo muy
# robusto ante este nuevo estatus, que es refuerzo por contactar. Creo que sería
# bueno tener ahí un mecanismo de robustez más importante».
#
# El traductor termina en un `default` que devuelve `sin_contactar`. Eso no
# falla ni avisa: un estatus nuevo —o el mismo con otra ortografía— pasa a ser
# el estado de los titulares que nadie tocó, el aula vuelve a la cola de
# llamadas y se cuenta como trabajo pendiente. Es la avería que B13b documentó
# para «EN CONTACTO» y «RECHAZO».

test_that("el estatus que preocupaba SÍ se reconoce, y no se declara raro", {
  # Primero la premisa, porque de nada sirve el detector si el estado por el que
  # preguntó estuviera cayendo al default.
  expect_identical(monitoreo_aulas_estado_muestra("REFUERZO POR CONTACTAR"),
                   "refuerzo_por_contactar")
  d <- monitoreo_aulas_estados_muestra_desconocidos(
    c("REFUERZO POR CONTACTAR", "SIN CONTACTAR", "AGENDADA", "EN RESERVA 2"))
  expect_equal(nrow(d), 0L)
  expect_identical(monitoreo_aulas_estados_desconocidos_texto(d), "")
})

test_that("un estatus que nadie enseñó a la app se nombra, con cuántas filas", {
  d <- monitoreo_aulas_estados_muestra_desconocidos(c(
    "AGENDADA", "POR REPROGRAMAR", "POR REPROGRAMAR", "NO CONTESTA", "SIN CONTACTAR"))
  expect_equal(nrow(d), 2L)
  # De más frecuente a menos: por dónde empezar a corregir.
  expect_identical(d$valor, c("POR REPROGRAMAR", "NO CONTESTA"))
  expect_identical(d$filas, c(2L, 1L))
  texto <- monitoreo_aulas_estados_desconocidos_texto(d)
  # El texto TAL CUAL está en la hoja: es la celda que hay que ir a corregir.
  expect_match(texto, "«POR REPROGRAMAR» (2 filas)", fixed = TRUE)
  expect_match(texto, "«NO CONTESTA» (1 fila)", fixed = TRUE)
  # Y la consecuencia, que es lo que hace accionable el aviso.
  expect_match(texto, "vuelven a la cola de llamadas", fixed = TRUE)
})

test_that("lo vacío no es un estatus raro, y una ortografía distinta no engaña", {
  # Celdas en blanco son el estado inicial del plan, no un error de tecleo.
  expect_equal(nrow(monitoreo_aulas_estados_muestra_desconocidos(c("", "  ", NA))), 0L)
  # Acentos, minúsculas y guiones bajos son la MISMA palabra para el traductor,
  # así que tampoco pueden ser un desconocido aquí — si lo fueran, el aviso
  # gritaría en cada importación sobre datos correctos.
  expect_equal(nrow(monitoreo_aulas_estados_muestra_desconocidos(
    c("sin contactar", "Sin_Contactar", "SIN  CONTACTAR", "refuerzo_por_contactar"))), 0L)
})

test_that("el detector no lleva su propia copia del vocabulario", {
  # La clave: lo que el detector considera «conocido» sale de preguntarle al
  # traductor, no de una lista aquí. Si mañana el traductor aprende un estado
  # nuevo, el detector deja de declararlo sin que nadie lo toque — y eso es
  # justo lo que se comprueba, porque una segunda copia del vocabulario es el
  # defecto que este operativo ya pagó cuatro veces.
  testthat::local_mocked_bindings(
    monitoreo_aulas_estado_muestra = function(x) {
      if (identical(trimws(x), "POR REPROGRAMAR")) "por_reprogramar"
      else "sin_contactar"
    }
  )
  d <- monitoreo_aulas_estados_muestra_desconocidos(c("POR REPROGRAMAR", "VETE A SABER"))
  expect_identical(d$valor, "VETE A SABER")
})

test_that("el estado por defecto del detector es el que el traductor usa", {
  # `.maed_POR_DEFECTO` es lo único hard-codeado del archivo. Si el traductor
  # cambiara su default, el detector declararía raras a TODAS las celdas sin
  # contactar del libro. Esto lo ancla.
  expect_identical(prosecnurapp:::.maed_POR_DEFECTO,
                   monitoreo_aulas_estado_muestra("una cosa que nadie escribió jamás"))
})

# --- códigos que el plan no conoce -------------------------------------------
#
# La hermana del detector de estados. Medido en el operativo el 2026-09-12: 0
# partes y 0 filas de control con el código fuera del plan, y tiene explicación
# —esas dos hojas las siembra la app con los códigos ya puestos—. Donde sí se
# teclean es en el Sheets de la distribución, y ahí había CINCO mal escritos.
# Este guard existe para el día en que esa protección falle: un parte cuyo
# código no case NO cuenta como aplicado, y la cifra de avance baja sin que
# nada falle.

test_that("con todo casando no declara nada", {
  plan <- list(list(operational_code = "CH 1"), list(operational_code = "CH 2"))
  partes <- list(list(operational_code = "CH 1", intento = 1L),
                 list(operational_code = "CH 2", intento = 1L))
  expect_equal(nrow(monitoreo_aulas_codigos_sin_plan(partes, plan)), 0L)
})

test_that("un código que el plan no tiene se nombra, con cuántas filas", {
  plan <- list(list(operational_code = "CH 1"))
  partes <- list(list(operational_code = "CH 900", intento = 1L),
                 list(operational_code = "CH 900", intento = 2L),
                 list(operational_code = "CH 1", intento = 1L))
  d <- monitoreo_aulas_codigos_sin_plan(partes, plan)
  expect_equal(nrow(d), 1L)
  expect_identical(d$codigo, "CH 900")
  expect_identical(d$filas, 2L)
})

test_that("mal escrito NO es desconocido: son dos noticias distintas", {
  # «CH164» con el plan en «CH 164» es una celda que se arregla, no un dato de
  # otro estudio. Confundirlas mandaría a buscar un aula que está ahí — la
  # misma separación que hace el detector de la hoja de distribución.
  plan <- list(list(operational_code = "CH 164"))
  expect_equal(nrow(monitoreo_aulas_codigos_sin_plan(
    list(list(operational_code = "CH164", intento = 1L)), plan)), 0L)
  expect_equal(nrow(monitoreo_aulas_codigos_sin_plan(
    list(list(operational_code = "ch 164", intento = 1L)), plan)), 0L)
})

test_that("sin plan no declara a todo el mundo desconocido", {
  # Sin plan no hay con qué comparar, y decir que TODO es desconocido sería un
  # aviso que grita en cada importación sobre datos correctos.
  partes <- list(list(operational_code = "CH 1", intento = 1L))
  expect_equal(nrow(monitoreo_aulas_codigos_sin_plan(partes, list())), 0L)
  expect_equal(nrow(monitoreo_aulas_codigos_sin_plan(list(), list())), 0L)
})
