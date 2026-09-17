# =============================================================================
# El eje de cuotas declarable — contrato del resolutor
# =============================================================================
#
# El eje era la FACULTAD escrita cinco veces en cinco capas. CCSS Perfil 2026-II
# necesita el NIVEL CURRICULAR, y otro estudio puede pedir otro. Esta suite fija
# lo único que no puede fallar al generalizarlo: que **un estudio que no declara
# eje se comporte exactamente como antes**.
#
# Por eso el test central es de IDENTIDAD, no de plausibilidad: HSVG está en
# campo y su config no trae `eje_cuota`. Si el default se desviara un milímetro,
# el operativo vivo mediría distinto sin que nadie lo pidiera.

test_that("sin declaracion, el eje es la facultad de siempre", {
  eje <- monitoreo_aulas_eje(list())
  expect_identical(eje$clave, "facultad")
  expect_identical(eje$columna, "faculty")
  # Estos dos son los que separan un eje de otro: con `aula`/`plan` la respuesta
  # hereda el valor del aula del plan, que es lo que el motor hace hoy.
  expect_identical(eje$atribucion, "aula")
  expect_identical(eje$fuente_valor, "plan")
})

test_that("una config vacia, ausente o basura cae al mismo default", {
  esperado <- monitoreo_aulas_eje(list())
  # Cada una de estas es una forma real de llegar: proyecto viejo, bloque sin
  # el campo, y el campo con un valor que nadie declaró.
  for (cfg in list(list(),
                   list(aulas_universitarias = list()),
                   list(aulas_universitarias = list(eje_cuota = "")),
                   list(aulas_universitarias = list(eje_cuota = "carrera")),
                   list(eje_cuota = NULL))) {
    obtenido <- monitoreo_aulas_eje(cfg)
    obtenido$motivo <- esperado$motivo
    expect_identical(obtenido, esperado)
  }
})

test_that("el eje se lee igual desde la config completa y desde el bloque pelado", {
  # Ninguna capa deberia tener que saber a que altura recibio la config: unas
  # traen `cfg$aulas_universitarias` y otras ya lo desempacaron.
  completa <- monitoreo_aulas_eje(list(aulas_universitarias = list(eje_cuota = "nivel")))
  pelada <- monitoreo_aulas_eje(list(eje_cuota = "nivel"))
  expect_identical(completa, pelada)
  expect_identical(completa$clave, "nivel")
})

test_that("el eje nivel declara que su valor viene de la persona, no del aula", {
  eje <- monitoreo_aulas_eje(list(eje_cuota = "nivel"))
  expect_identical(eje$columna, "level")
  # Es la diferencia que el ADR de atribucion necesita leer sin un `if`: con
  # `persona`/`padron` la celda la determina quien responde, no donde respondio.
  expect_identical(eje$atribucion, "persona")
  expect_identical(eje$fuente_valor, "padron")
  expect_identical(eje$etiqueta_sin, "Sin nivel")
})

test_that("el motivo declarado viaja con el eje", {
  eje <- monitoreo_aulas_eje(list(
    eje_cuota = "nivel",
    eje_cuota_motivo = "metas por nivel curricular; carrera y sexo referenciales"
  ))
  expect_match(eje$motivo, "nivel curricular")
  # Sin motivo no falla: el motivo es para que un humano entienda la decision,
  # no un requisito del resolutor.
  expect_identical(monitoreo_aulas_eje(list(eje_cuota = "nivel"))$motivo, "")
})

test_that("la columna del eje se resuelve por alias en el plan y en el marco", {
  eje_fac <- monitoreo_aulas_eje(list())
  eje_niv <- monitoreo_aulas_eje(list(eje_cuota = "nivel"))
  plan <- data.frame(classroom_id = "ch1", faculty = "DERECHO", level = "7",
                     stringsAsFactors = FALSE)
  expect_identical(monitoreo_aulas_columna_eje(plan, eje_fac), "faculty")
  expect_identical(monitoreo_aulas_columna_eje(plan, eje_niv), "level")

  # El alias existe porque las tres tablas no nombran igual sus columnas.
  castellano <- data.frame(facultad = "DERECHO", nivel = "7", stringsAsFactors = FALSE)
  expect_identical(monitoreo_aulas_columna_eje(castellano, eje_fac), "facultad")
  expect_identical(monitoreo_aulas_columna_eje(castellano, eje_niv), "nivel")
})

test_that("una tabla sin la columna del eje devuelve vacio, no adivina otra", {
  eje_niv <- monitoreo_aulas_eje(list(eje_cuota = "nivel"))
  sin_nivel <- data.frame(classroom_id = "ch1", faculty = "DERECHO",
                          stringsAsFactors = FALSE)
  # Devolver "faculty" aqui seria medir el eje equivocado sin avisar: el peor
  # fallo posible de esta pieza.
  expect_identical(monitoreo_aulas_columna_eje(sin_nivel, eje_niv), "")
  expect_identical(monitoreo_aulas_columna_eje(data.frame(), eje_niv), "")
})

test_that("la clave del eje es la de siempre, con el arreglo de la enie", {
  # Es un alias de `.cm_criterios_fac_key()`, no una funcion nueva: si algun dia
  # divergieran, el cruce de metas contra el plan dejaria de calzar en silencio.
  valores <- c("ARTE Y DISEÑO", "Arte y Diseño", "  EE.GG. Letras  ", "7")
  expect_identical(monitoreo_aulas_eje_key(valores),
                   .cm_criterios_fac_key(valores))
  # Y lo que el arreglo compra: las dos grafias de la enie dan la misma clave.
  expect_identical(monitoreo_aulas_eje_key("ARTE Y DISEÑO"),
                   monitoreo_aulas_eje_key("ARTE Y DISENO"))
})

test_that("la declaracion que viaja en los contratos es serializable y completa", {
  d <- monitoreo_aulas_eje_declaracion(monitoreo_aulas_eje(list(eje_cuota = "nivel")))
  expect_identical(d$clave, "nivel")
  expect_identical(d$columna, "level")
  expect_identical(d$atribucion, "persona")
  # Todos escalares de texto: el bloque se cuelga en design_targets y viaja a
  # JSON sin sorpresas.
  expect_true(all(vapply(d, function(x) is.character(x) && length(x) == 1L, logical(1))))
})

test_that("sin eje, la declaracion dice facultad — un contrato viejo se lee bien", {
  # Un `design_targets` guardado antes de esto no trae bloque `eje`. Leerlo como
  # facultad no es un default de cortesia: es lo que ese contrato ES.
  d <- monitoreo_aulas_eje_declaracion(NULL)
  expect_identical(d$clave, "facultad")
  expect_identical(d$columna, "faculty")
  expect_identical(d$atribucion, "aula")
})
