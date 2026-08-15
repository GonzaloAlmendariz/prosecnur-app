# M1 y M2 del GOAL de Monitoreo: el rol de agente llega al módulo y con él la
# primera señal de calidad del trabajo — quién sigue enviando con una versión
# vieja del formulario.
#
# Lo que se fija acá:
#   - sin rol declarado no hay alerta (V1: no se adivina la columna)
#   - una base sana no alerta (control negativo)
#   - la alerta nombra al agente y trae qué preguntarle (V3)
#   - un caso suelto no nombra a nadie

source("setup-load-all.R")

.mcc_base <- function(versiones, agentes, fechas = NULL) {
  d <- data.frame(
    `_uuid` = sprintf("u%02d", seq_along(versiones)),
    `__version__` = versiones,
    quien = agentes,
    stringsAsFactors = FALSE, check.names = FALSE
  )
  if (!is.null(fechas)) d$cuando <- fechas
  d
}

test_that("sin rol de agente declarado no hay alerta", {
  # V1 de la vara: la versión vieja se sabría, pero no a quién llamar — y
  # adivinar la columna sería hardcodear un nombre de proyecto.
  d <- .mcc_base(c(rep("vNueva", 8), rep("vVieja", 4)), rep(c("Ana", "Luis"), 6))
  expect_length(monitoreo_alertas_procedencia(d, agent_var = ""), 0L)
  expect_length(monitoreo_alertas_procedencia(d, agent_var = "no_existe"), 0L)
})

test_that("una base con una sola versión no alerta a nadie", {
  # Control negativo: si alertara igual, el aserto de abajo no distinguiría un
  # campo sano de uno con el formulario desactualizado.
  d <- .mcc_base(rep("vUnica", 10), rep(c("Ana", "Luis"), 5))
  expect_length(monitoreo_alertas_procedencia(d, "quien"), 0L)
})

test_that("nombra al agente que sigue enviando con la versión vieja", {
  d <- .mcc_base(
    c(rep("vNueva", 10), rep("vVieja", 4)),
    c(rep("Ana", 10), rep("Luis", 4))
  )
  al <- monitoreo_alertas_procedencia(d, "quien")

  expect_length(al, 1L)
  expect_identical(al[[1]]$actor, "Luis")
  expect_identical(al[[1]]$tipo, "formulario_desactualizado")
  # Decisión del equipo: procedencia es la única señal que avisa fuerte, porque
  # es la única que produce datos irrecuperables.
  expect_identical(al[[1]]$severidad, "bloqueante")
  expect_identical(al[[1]]$detalle$n_casos, 4L)
  expect_identical(al[[1]]$detalle$version_vigente, "vNueva")
})

test_that("la alerta dice qué preguntarle, no solo que revise", {
  # V3 de la vara: «revisar» no le sirve a nadie; un nombre y una pregunta sí.
  d <- .mcc_base(c(rep("vNueva", 10), rep("vVieja", 3)),
                 c(rep("Ana", 10), rep("Luis", 3)))
  al <- monitoreo_alertas_procedencia(d, "quien")[[1]]
  expect_true(grepl("Luis", al$mensaje, fixed = TRUE))
  expect_true(grepl("Luis", al$detalle$pregunta, fixed = TRUE))
  expect_true(grepl("actualiz", al$detalle$pregunta, fixed = TRUE))
  expect_false(grepl("revisar", tolower(al$mensaje), fixed = TRUE))
})

test_that("un caso suelto no nombra a nadie", {
  # Uno puede ser un envío rezagado que ya se corrigió. Dos o más indican que
  # siguió trabajando sin actualizar.
  d <- .mcc_base(c(rep("vNueva", 10), "vVieja"), c(rep("Ana", 10), "Luis"))
  expect_length(monitoreo_alertas_procedencia(d, "quien"), 0L)
  # Bajando el mínimo sí aparece: el umbral es del criterio, no del motor.
  expect_length(monitoreo_alertas_procedencia(d, "quien", minimo = 1L), 1L)
})

test_that("con varios agentes rezagados, primero el que más arrastra", {
  d <- .mcc_base(
    c(rep("vNueva", 10), rep("vVieja", 7)),
    c(rep("Ana", 10), rep("Luis", 2), rep("Rosa", 5))
  )
  al <- monitoreo_alertas_procedencia(d, "quien")
  expect_length(al, 2L)
  expect_identical(vapply(al, function(x) x$actor, character(1)), c("Rosa", "Luis"))
})

test_that("dice desde cuándo si la base trae la marca temporal", {
  d <- .mcc_base(
    c(rep("vNueva", 6), rep("vVieja", 3)),
    c(rep("Ana", 6), rep("Luis", 3)),
    fechas = c(rep("2026-08-03T09:00:00", 6),
               "2026-08-03T11:00:00", "2026-08-03T12:00:00", "2026-08-03T13:00:00")
  )
  al <- monitoreo_alertas_procedencia(d, "quien", fecha_var = "cuando")[[1]]
  expect_identical(al$detalle$desde, "2026-08-03T11:00:00")
  expect_true(grepl("2026-08-03T11:00", al$mensaje, fixed = TRUE))
})

test_that("el rol de agente se lee de la declaración de Validación", {
  # M1: Monitoreo no inventa su propia declaración, lee la que ya existe.
  sid <- session_create()
  s <- session_get(sid)
  s$estudio <- list(bases = list(base_1 = list(
    nombre = "base_1",
    validacion = list(operational_config = list(
      version = 2L,
      identity = list(enabled = TRUE, variables = list("codigo"),
                      agent_variable = "quien_encuesto")
    ))
  )))
  .session_env[[sid]] <- s

  expect_identical(monitoreo_agente_declarado(sid, "base_1"), "quien_encuesto")
  # Sin declaración, cadena vacía — nunca un nombre inventado.
  expect_identical(monitoreo_agente_declarado(sid, "base_que_no_existe"), "")
  expect_identical(monitoreo_agente_declarado(session_create()), "")
})

# --- M3 · identidad del agente ------------------------------------------------

.mcc_equipo <- function(agentes) {
  data.frame(
    `_uuid` = sprintf("u%02d", seq_along(agentes)),
    quien = agentes,
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

test_that("un equipo escrito siempre igual no genera aviso de identidad", {
  # Control negativo: sin esto, el aserto de abajo no distinguiría un equipo
  # limpio de uno con variantes.
  d <- .mcc_equipo(c(rep("Ana Lopez", 12), rep("Luis Diaz", 9)))
  expect_length(monitoreo_alertas_identidad(d, "quien"), 0L)
  # Y sin rol declarado tampoco se adivina la columna (V1).
  expect_length(monitoreo_alertas_identidad(d, ""), 0L)
})

test_that("avisa cuando el mismo nombre está escrito de dos formas", {
  d <- .mcc_equipo(c(rep("Ana Lopez", 12), rep("Luis Diaz", 9), "Ana Lopes"))
  al <- monitoreo_alertas_identidad(d, "quien")

  expect_length(al, 1L)
  expect_identical(al[[1]]$tipo, "identidad_agente")
  expect_identical(al[[1]]$actor, "Ana Lopes")
  expect_identical(al[[1]]$detalle$parecido_a, "Ana Lopez")
  # M7: solo procedencia avisa fuerte. Esto se corrige después sin perder dato.
  expect_identical(al[[1]]$severidad, "advertencia")
  # V3: la pregunta nombra a los dos, porque la respuesta es sí o no.
  expect_true(grepl("Ana Lopes", al[[1]]$detalle$pregunta, fixed = TRUE))
  expect_true(grepl("Ana Lopez", al[[1]]$detalle$pregunta, fixed = TRUE))
})

test_that("un valor que no parece un nombre hace otra pregunta", {
  # No es lo mismo «se escribió mal» que «acá hay un dato de otra cosa»: la
  # segunda no se resuelve unificando.
  d <- .mcc_equipo(c(rep("Ana Lopez", 12), rep("Luis Diaz", 9), "987654321"))
  al <- monitoreo_alertas_identidad(d, "quien")
  expect_length(al, 1L)
  expect_identical(al[[1]]$detalle$parecido_a, "")
  expect_true(grepl("Qui", al[[1]]$detalle$pregunta, fixed = TRUE))
})

test_that("el aviso de identidad no reimplementa el detector de Validación", {
  # Trampa del GOAL: dos motores para la misma pregunta terminan discrepando de
  # la misma base. Este debe coincidir con el sembrador, valor por valor.
  d <- .mcc_equipo(c(rep("Ana Lopez", 12), rep("Luis Diaz", 9), "Ana Lopes", "Luis"))
  sem <- reglas_semilla_agente(
    d, list(identity = list(enabled = TRUE, agent_variable = "quien"))
  )[[1]]$semilla
  al <- monitoreo_alertas_identidad(d, "quien")
  expect_setequal(
    vapply(al, function(x) x$actor, character(1)),
    as.character(unlist(sem$variantes))
  )
})

# --- M9 · padrón planificado vs envíos observados -----------------------------

.mcc_padron <- function(nombres) {
  list(code_format = "PXXX", assignments = lapply(seq_along(nombres), function(i) {
    list(codigo_pulso = sprintf("P%03d", i), nombre = nombres[i])
  }))
}

test_that("sin padrón cargado no hay cruce", {
  # La mitad de la pregunta no existe: no se inventa un padrón desde la data.
  d <- .mcc_equipo(c(rep("Ana Lopez", 5), rep("Luis Diaz", 4)))
  expect_length(monitoreo_alertas_padron(d, "quien", NULL), 0L)
  expect_length(monitoreo_alertas_padron(d, "quien", list(assignments = list())), 0L)
})

test_that("padrón y envíos que coinciden no alertan", {
  d <- .mcc_equipo(c(rep("Ana Lopez", 5), rep("Luis Diaz", 4)))
  expect_length(
    monitoreo_alertas_padron(d, "quien", .mcc_padron(c("Ana Lopez", "Luis Diaz"))),
    0L
  )
})

test_that("nombra a quien envía sin estar en el padrón y a quien no arrancó", {
  d <- .mcc_equipo(c(rep("Ana Lopez", 5), rep("Rosa Vega", 3)))
  al <- monitoreo_alertas_padron(d, "quien", .mcc_padron(c("Ana Lopez", "Luis Diaz")))
  tipos <- vapply(al, function(x) x$tipo, character(1))

  expect_setequal(tipos, c("envio_sin_padron", "padron_sin_envio"))
  fuera <- al[[which(tipos == "envio_sin_padron")]]
  expect_identical(fuera$actor, "Rosa Vega")
  expect_false(fuera$detalle$probable_variante)
  sin_enviar <- al[[which(tipos == "padron_sin_envio")]]
  expect_identical(sin_enviar$actor, "Luis Diaz")
  expect_identical(sin_enviar$detalle$n_casos, 0L)
  expect_true(grepl("arrancó", sin_enviar$detalle$pregunta, fixed = TRUE))
})

test_that("un nombre mal escrito no se reporta como encuestador no autorizado", {
  # La dependencia M3 -> M9 hecha aserto: sin distinguirlos, cada variante mal
  # tipeada se leería como alguien recolectando fuera del padrón.
  d <- .mcc_equipo(c(rep("Ana Lopez", 5), rep("Luis Diaz", 4), "Ana Lopes"))
  al <- monitoreo_alertas_padron(d, "quien", .mcc_padron(c("Ana Lopez", "Luis Diaz")))

  expect_length(al, 1L)
  expect_identical(al[[1]]$tipo, "envio_sin_padron")
  expect_true(al[[1]]$detalle$probable_variante)
  expect_identical(al[[1]]$detalle$parecido_a, "Ana Lopez")
  # Y Ana no aparece como «no arrancó»: sí envió, con el nombre sucio.
  expect_false("padron_sin_envio" %in% vapply(al, function(x) x$tipo, character(1)))
})

test_that("el padrón acepta que la columna traiga el código en vez del nombre", {
  # En territorial el mismo campo se usa de las dos formas según el estudio.
  d <- .mcc_equipo(c(rep("P001", 5), rep("P002", 4)))
  expect_length(
    monitoreo_alertas_padron(d, "quien", .mcc_padron(c("Ana Lopez", "Luis Diaz"))),
    0L
  )
})

test_that("con padrón cargado el mismo valor no se avisa dos veces", {
  # El padrón manda: es la lista autoritativa del equipo.
  d <- .mcc_equipo(c(rep("Ana Lopez", 12), rep("Luis Diaz", 9), "Ana Lopes"))
  todo <- monitoreo_alertas_equipo(d, "quien", .mcc_padron(c("Ana Lopez", "Luis Diaz")))
  expect_length(todo, 1L)
  expect_identical(todo[[1]]$tipo, "envio_sin_padron")

  # Sin padrón —el caso de casi todos los estudios— el aviso de identidad
  # trabaja solo y el valor sigue apareciendo.
  solo <- monitoreo_alertas_equipo(d, "quien", NULL)
  expect_length(solo, 1L)
  expect_identical(solo[[1]]$tipo, "identidad_agente")
})

# --- M4 · casos que se pisan --------------------------------------------------

.mcc_cruce <- function(llave, ini, fin, agente = NULL, caso = NULL) {
  d <- data.frame(
    caso = caso %||% sprintf("C%02d", seq_along(llave)),
    llave = llave, inicio = ini, fin = fin,
    stringsAsFactors = FALSE, check.names = FALSE
  )
  d$quien <- agente %||% rep("Ana Lopez", length(llave))
  d
}

test_that("solaparse en el tiempo no basta para alertar", {
  # V2 de la vara, que es lo que hace utilizable esta señal: en MDV hay 370
  # pares solapados y solo 1 comparte identidad. Sin este control, el aviso
  # sería ruido con el volumen de la base.
  d <- .mcc_cruce(
    llave = c("999111", "999222"),
    ini = c("2026-08-03T09:00:00", "2026-08-03T09:30:00"),
    fin = c("2026-08-03T11:00:00", "2026-08-03T10:30:00")
  )
  expect_length(monitoreo_alertas_cruce(d, "llave", "inicio", "fin"), 0L)
})

test_that("compartir identidad sin solaparse tampoco basta", {
  # Una llave repetida puede ser legítima: dos personas del mismo hogar, o la
  # misma persona reencuestada otro día.
  d <- .mcc_cruce(
    llave = c("999111", "999111"),
    ini = c("2026-08-03T09:00:00", "2026-08-03T12:00:00"),
    fin = c("2026-08-03T10:00:00", "2026-08-03T13:00:00")
  )
  expect_length(monitoreo_alertas_cruce(d, "llave", "inicio", "fin"), 0L)
})

test_that("identidad compartida y solape a la vez sí alertan, por par", {
  d <- .mcc_cruce(
    llave = c("999111", "999111"),
    ini = c("2026-08-03T09:00:00", "2026-08-03T09:30:00"),
    fin = c("2026-08-03T11:00:00", "2026-08-03T10:30:00")
  )
  al <- monitoreo_alertas_cruce(d, "llave", "inicio", "fin",
                                agent_var = "quien", caso_var = "caso")
  expect_length(al, 1L)
  expect_identical(al[[1]]$tipo, "cruce_identidad")
  # El grano es el par: la pregunta a campo es sobre las dos encuestas juntas.
  expect_setequal(al[[1]]$detalle$casos, c("C01", "C02"))
  expect_identical(al[[1]]$detalle$minutos_solape, 60)
  expect_true(al[[1]]$detalle$mismo_agente)
  expect_identical(al[[1]]$actor, "Ana Lopez")
})

test_that("el mismo agente en las dos encuestas cambia la pregunta", {
  # Dos encuestadores distintos a la misma hora puede ser la misma entrevista
  # cargada dos veces; el mismo encuestador es físicamente imposible.
  ini <- c("2026-08-03T09:00:00", "2026-08-03T09:30:00")
  fin <- c("2026-08-03T11:00:00", "2026-08-03T10:30:00")
  distintos <- monitoreo_alertas_cruce(
    .mcc_cruce(c("999111", "999111"), ini, fin, agente = c("Ana Lopez", "Luis Diaz")),
    "llave", "inicio", "fin", agent_var = "quien", caso_var = "caso"
  )
  expect_length(distintos, 1L)
  expect_false(distintos[[1]]$detalle$mismo_agente)
  expect_identical(distintos[[1]]$actor, "")
  expect_true(grepl("dos encuestadores distintos", distintos[[1]]$detalle$pregunta,
                    fixed = TRUE))
})

test_that("una llave vacía no empareja a todos los casos sin dato", {
  d <- .mcc_cruce(
    llave = c("", "", NA_character_),
    ini = rep("2026-08-03T09:00:00", 3),
    fin = rep("2026-08-03T11:00:00", 3)
  )
  expect_length(monitoreo_alertas_cruce(d, "llave", "inicio", "fin"), 0L)
})

test_that("sin llaves declaradas no hay cruce", {
  d <- .mcc_cruce(c("999111", "999111"),
                  c("2026-08-03T09:00:00", "2026-08-03T09:30:00"),
                  c("2026-08-03T11:00:00", "2026-08-03T10:30:00"))
  expect_length(monitoreo_alertas_cruce(d, character(0), "inicio", "fin"), 0L)
  expect_length(monitoreo_alertas_cruce(d, "no_existe", "inicio", "fin"), 0L)
  expect_length(monitoreo_alertas_cruce(d, "llave", "no_existe", "fin"), 0L)
})

test_that("el cruce marca exactamente los mismos casos que la regla de Validación", {
  # Trampa del GOAL: dos motores para la misma pregunta terminan discrepando.
  # Monitoreo cambia el grano (par en vez de caso), no el criterio.
  d <- .mcc_cruce(
    llave = c("999111", "999111", "999222", "999222", "999333"),
    ini = c("2026-08-03T09:00:00", "2026-08-03T09:30:00",
            "2026-08-03T09:00:00", "2026-08-03T12:00:00", "2026-08-03T09:00:00"),
    fin = c("2026-08-03T11:00:00", "2026-08-03T10:30:00",
            "2026-08-03T10:00:00", "2026-08-03T13:00:00", "2026-08-03T10:00:00")
  )
  regla <- eval(
    parse(text = .regla_expr_cruce_identidad(c("inicio", "fin", "llave"))),
    envir = list2env(as.list(d), parent = parent.frame())
  )
  al <- monitoreo_alertas_cruce(d, "llave", "inicio", "fin", caso_var = "caso")
  expect_setequal(
    unique(unlist(lapply(al, function(x) x$detalle$casos))),
    d$caso[which(regla)]
  )
})

test_that("el mensaje acorta el uuid pero el detalle lo conserva entero", {
  # Nadie dicta un UUID de 36 caracteres por teléfono, y la UI necesita el
  # completo para llevar al caso.
  uuids <- c("bd1a271a-dac8-4a2e-9c5c-d803cfc4da8b",
             "000e0284-4044-49cb-84f0-f73c0207c6d0")
  d <- .mcc_cruce(c("999111", "999111"),
                  c("2026-08-03T09:00:00", "2026-08-03T09:30:00"),
                  c("2026-08-03T11:00:00", "2026-08-03T10:30:00"),
                  caso = uuids)
  al <- monitoreo_alertas_cruce(d, "llave", "inicio", "fin", caso_var = "caso")[[1]]
  expect_setequal(al$detalle$casos, uuids)
  expect_true(grepl("bd1a271a", al$mensaje, fixed = TRUE))
  expect_false(grepl(uuids[1], al$mensaje, fixed = TRUE))
})

test_that("la alerta declara de qué columnas sale el tiempo", {
  # V4 de la vara: `end` se corre si el formulario queda abierto, así que toda
  # métrica de tiempo dice su fuente o no se muestra.
  d <- .mcc_cruce(c("999111", "999111"),
                  c("2026-08-03T09:00:00", "2026-08-03T09:30:00"),
                  c("2026-08-03T11:00:00", "2026-08-03T10:30:00"))
  al <- monitoreo_alertas_cruce(d, "llave", "inicio", "fin", caso_var = "caso")[[1]]
  expect_identical(unname(al$detalle$fuente_tiempo), c("inicio", "fin"))
})

# --- M6 · el bloque que llega al payload --------------------------------------

.mcc_bloque_base <- function() {
  data.frame(
    `_uuid` = sprintf("u%02d", 1:14),
    `__version__` = c(rep("vNueva", 10), rep("vVieja", 4)),
    telefono = c(sprintf("9%08d", 1:12), "955555555", "955555555"),
    start = c(rep("2026-08-03T09:00:00", 12),
              "2026-08-03T09:00:00", "2026-08-03T09:30:00"),
    end = c(rep("2026-08-03T09:40:00", 12),
            "2026-08-03T11:00:00", "2026-08-03T10:30:00"),
    quien = c(rep("Ana Lopez", 10), rep("Luis Diaz", 4)),
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

.mcc_cfg <- function(agente = "quien", llaves = list("telefono")) {
  # `enabled` gobierna la detección de repetidos, no el rol de agente: la
  # pantalla de Validación los declara por separado y el normalizador rechaza
  # una identidad activa sin llaves. Declarar quién recolectó sin declarar la
  # llave del sujeto es un estado legítimo, y el bloque tiene que sobrevivirlo.
  list(version = 2L,
       identity = list(enabled = length(llaves) > 0L, variables = llaves,
                       agent_variable = agente))
}

test_that("el bloque explica su vacío en vez de callarse", {
  # C3 del Contrato de Superficie: la pantalla contiene su propio vacío. «No
  # declaraste quién recolecta» y «el campo está limpio» no son lo mismo, y sin
  # el motivo la UI no puede distinguirlos.
  d <- .mcc_bloque_base()

  vacio <- monitoreo_calidad_campo_bloque(data.frame())
  expect_false(vacio$enabled)
  expect_identical(vacio$motivo, "sin_datos")

  sin_rol <- monitoreo_calidad_campo_bloque(d, .mcc_cfg(agente = ""))
  expect_false(sin_rol$enabled)
  expect_identical(sin_rol$motivo, "sin_rol_de_agente")
  expect_length(sin_rol$alertas, 0L)

  # Con agente pero sin llaves, el cruce no puede correr y el bloque lo dice.
  limpia <- d[1:10, ]
  sin_llaves <- monitoreo_calidad_campo_bloque(limpia, .mcc_cfg(llaves = list()))
  expect_true(sin_llaves$enabled)
  expect_identical(sin_llaves$motivo, "sin_llaves_de_identidad")

  sano <- monitoreo_calidad_campo_bloque(limpia, .mcc_cfg())
  expect_identical(sano$motivo, "sin_hallazgos")
  expect_length(sano$alertas, 0L)
})

test_that("el bloque reúne las cuatro señales y pone lo bloqueante primero", {
  b <- monitoreo_calidad_campo_bloque(.mcc_bloque_base(), .mcc_cfg())
  tipos <- vapply(b$alertas, function(a) a$tipo, character(1))

  expect_true(b$enabled)
  expect_true(all(c("formulario_desactualizado", "cruce_identidad") %in% tipos))
  # Lo irrecuperable arriba: es lo único que hay que resolver hoy.
  expect_identical(b$alertas[[1]]$severidad, "bloqueante")
  expect_identical(b$resumen$total, length(b$alertas))
  expect_identical(b$resumen$bloqueantes, 1L)
  expect_identical(b$roles$agente, "quien")
})

test_that("las de calidad no se mezclan con las de avance", {
  # M6: una brecha de cuota y un formulario desactualizado no se leen igual.
  # El bloque es propio y ningún tipo de avance se cuela en él.
  b <- monitoreo_calidad_campo_bloque(.mcc_bloque_base(), .mcc_cfg())
  avance <- c("brecha_relevante", "brecha_menor", "sin_objetivo",
              "minimo_estadistico", "benchmark_bajo", "subcuotas_incompletas",
              "reemplazo_sin_motivo")
  expect_false(any(vapply(b$alertas, function(a) a$tipo, character(1)) %in% avance))
  # Y todas dicen a quién llamar o qué preguntar (V3).
  for (a in b$alertas) expect_true(nzchar(a$detalle$pregunta %||% ""))
})

test_that("una señal que falla no tumba el payload de Monitoreo", {
  # El bloque es nuevo y viaja en cada state: si reventara, se llevaría puesto
  # el módulo entero por una alerta.
  b <- monitoreo_calidad_campo_para_sesion("sesion-que-no-existe", .mcc_bloque_base())
  expect_false(b$enabled)
  expect_length(b$alertas, 0L)
  expect_identical(b$resumen$total, 0L)
})

test_that("el bloque llega resuelto desde los roles declarados en Validación", {
  sid <- session_create()
  s <- session_get(sid)
  s$estudio <- list(bases = list(base_1 = list(
    nombre = "base_1",
    validacion = list(operational_config = .mcc_cfg())
  )))
  .session_env[[sid]] <- s

  b <- monitoreo_calidad_campo_para_sesion(sid, .mcc_bloque_base(),
                                           base_nombre = "base_1")
  expect_true(b$enabled)
  expect_identical(b$roles$agente, "quien")
  expect_true(b$resumen$total > 0L)
})

test_that("el motor no confunde el roster planificado con el agente observado", {
  # Son preguntas distintas y ambas se conservan (decisión del 2026-08-13):
  # el roster PXXX dice quién debería trabajar, el rol quién trabajó. Este
  # archivo solo consume el segundo.
  fuente <- readLines(
    testthat::test_path("..", "..", "R", "monitoreo_calidad_campo.R"), warn = FALSE
  )
  # Solo el código: el docstring SÍ menciona el roster, y a propósito — explicar
  # que son cosas distintas es justamente lo que evita que alguien las mezcle.
  codigo <- fuente[!grepl("^\\s*#", fuente)]
  expect_false(any(grepl("roster_from_excel(", codigo, fixed = TRUE)))

  # V1: no nombra variables de ningún proyecto. Acá sí cuenta el archivo entero
  # —un ejemplo en un comentario deja el nombre de un cliente escrito en el repo—
  # y ya costó un rojo en el GOAL anterior.
  for (v in c("Enumerator_name", "Pulso_code", "proyecto_ppl", "Consent")) {
    expect_false(any(grepl(v, fuente, fixed = TRUE)), info = v)
  }
})
