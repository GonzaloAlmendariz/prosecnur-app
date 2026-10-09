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
  # «carrera» era el ejemplo de valor no declarado hasta el 2026-09-22, cuando
  # se añadió al catálogo como dimensión del resumen operativo. Se cambia por
  # uno que de verdad no existe, y la conducta nueva se afirma abajo en vez de
  # perderse: un caso que deja de probar lo que probó tiene que decirlo.
  for (cfg in list(list(),
                   list(aulas_universitarias = list()),
                   list(aulas_universitarias = list(eje_cuota = "")),
                   list(aulas_universitarias = list(eje_cuota = "sede")),
                   list(eje_cuota = NULL))) {
    obtenido <- monitoreo_aulas_eje(cfg)
    obtenido$motivo <- esperado$motivo
    expect_identical(obtenido, esperado)
  }
})

test_that("carrera SI es un eje declarado, y se atribuye por el aula", {
  # Nació para el resumen operativo (`monitoreo_aulas_agrupacion.R`) y entra al
  # mismo catálogo, así que un estudio que quiera medir por carrera lo declara
  # sin tocar ninguna capa. Su valor sale de la fila del PLAN —la carrera del
  # curso-horario—, que no es la de la persona: aquélla vive en el padrón.
  eje <- monitoreo_aulas_eje(list(aulas_universitarias = list(eje_cuota = "carrera")))
  expect_identical(eje$clave, "carrera")
  expect_identical(eje$columna, "program")
  expect_identical(eje$atribucion, "aula")
  expect_identical(eje$fuente_valor, "plan")
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

test_that("el normalizador conserva el eje declarado, y lo aguanta en el segundo pase", {
  # La lista blanca del normalizador es CERRADA y el engine re-normaliza la
  # config en cada pase. Sin nombrar `eje_cuota` ahi, declararlo en la UI no
  # sobreviviria al primer «actualizar» y el estudio volveria a medir por
  # facultad SIN AVISAR. Es el mismo defecto que ya se comio `valid_filters`,
  # `sex_var` y los tramos, y por eso se prueba el segundo pase, no el primero.
  cfg <- monitoreo_aulas_normalize_config(list(
    eje_cuota = "nivel",
    eje_cuota_motivo = "metas por nivel curricular"
  ))
  expect_identical(cfg$eje_cuota, "nivel")
  expect_match(cfg$eje_cuota_motivo, "nivel curricular")

  otra_vez <- monitoreo_aulas_normalize_config(cfg)
  expect_identical(otra_vez$eje_cuota, "nivel")
  expect_identical(monitoreo_aulas_eje(otra_vez)$columna, "level")
})

test_that("un estudio que no declara eje sale normalizado en facultad", {
  cfg <- monitoreo_aulas_normalize_config(list())
  expect_identical(cfg$eje_cuota, "facultad")
  # Y el resolutor lo lee igual desde la config ya normalizada.
  expect_identical(monitoreo_aulas_eje(cfg)$atribucion, "aula")
})

test_that("un eje retirado del catalogo cae al default en vez de envenenar la config", {
  # La config guarda el valor CRUDO y el catalogo vive en el resolutor. Si algun
  # dia se retira un eje, los proyectos que lo declararon tienen que seguir
  # abriendose y midiendo por facultad, no romperse ni medir por una columna
  # que ya no se resuelve.
  cfg <- monitoreo_aulas_normalize_config(list(eje_cuota = "eje_que_ya_no_existe"))
  expect_identical(cfg$eje_cuota, "eje_que_ya_no_existe")
  expect_identical(monitoreo_aulas_eje(cfg)$clave, "facultad")
  expect_identical(monitoreo_aulas_eje(cfg)$columna, "faculty")
})

test_that("sin eje, la declaracion dice facultad — un contrato viejo se lee bien", {
  # Un `design_targets` guardado antes de esto no trae bloque `eje`. Leerlo como
  # facultad no es un default de cortesia: es lo que ese contrato ES.
  d <- monitoreo_aulas_eje_declaracion(NULL)
  expect_identical(d$clave, "facultad")
  expect_identical(d$columna, "faculty")
  expect_identical(d$atribucion, "aula")
})

# =============================================================================
# El catálogo viaja al payload para que la pantalla no lo copie
# =============================================================================
#
# Las tres declaraciones que gobiernan cómo mide un estudio —el eje de cuotas,
# la agrupación del resumen y el arranque del campo— sólo se podían poner por
# API. Para ofrecerlas en Fuentes hace falta el catálogo: escribirlo a mano en
# TypeScript significaría que añadir una cuarta dimensión exige acordarse de dos
# sitios, y el segundo se olvida.

test_that("el catalogo trae las dimensiones con lo que hace falta para ofrecerlas", {
  ejes <- monitoreo_aulas_ejes_declarables()
  claves <- vapply(ejes, function(e) e$clave, character(1))
  expect_true(all(c("facultad", "carrera", "nivel") %in% claves))
  # Las etiquetas viajan: la pantalla no inventa la palabra de cada dimensión.
  etiquetas <- stats::setNames(vapply(ejes, function(e) e$etiqueta, character(1)), claves)
  expect_identical(unname(etiquetas[["nivel"]]), "Nivel")
  expect_identical(unname(etiquetas[["carrera"]]), "Carrera")
})

test_that("`requiere_padron` separa la opcion ofrecible de la que deja sin avance", {
  # Un eje por PERSONA sin padrón cargado manda todas las respuestas a «sin
  # nivel». La pantalla tiene que poder decirlo antes de que lo elijan, no
  # después.
  ejes <- monitoreo_aulas_ejes_declarables()
  de <- function(k) Filter(function(e) identical(e$clave, k), ejes)[[1]]
  expect_true(de("nivel")$requiere_padron)
  expect_false(de("facultad")$requiere_padron)
  expect_false(de("carrera")$requiere_padron)
  # Y coincide con la atribución declarada, que es de donde sale.
  expect_identical(de("nivel")$atribucion, "persona")
  expect_identical(de("carrera")$atribucion, "aula")
})

test_that("el catalogo es el MISMO que resuelve el motor, no una copia", {
  # Si divergieran, la pantalla ofrecería una opción que el motor ignora.
  for (e in monitoreo_aulas_ejes_declarables()) {
    resuelto <- monitoreo_aulas_eje(list(aulas_universitarias = list(eje_cuota = e$clave)))
    expect_identical(resuelto$clave, e$clave)
    expect_identical(resuelto$columna, e$columna)
    expect_identical(resuelto$atribucion, e$atribucion)
  }
})
