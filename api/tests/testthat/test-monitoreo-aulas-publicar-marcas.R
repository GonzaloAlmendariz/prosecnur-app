# El transporte de la excepcion acotada. No toca la red: se le da el encabezado
# y los valores crudos, y se comprueba QUE rangos saldrian.

.mapm_plan <- function(...) list(...)
.mapm_fila <- function(codigo, estado = "refuerzo_por_contactar") {
  list(operational_code = codigo, sample_status = estado)
}

test_that("encuentra el encabezado aunque no este en la fila 1", {
  valores <- list(
    list("AGENDA DEL OPERATIVO", "", ""),
    list("CURSO-HORARIO", "DOCENTE", "STATUS MUESTRA"),
    list("R 1.1", "X", "SIN CONTACTAR")
  )
  enc <- prosecnurapp:::.mapm_encabezado(valores)
  expect_identical(enc$fila, 2L)
  expect_length(enc$pares, 1L)
  expect_identical(enc$pares[[1]]$codigo, 1L)
  expect_identical(enc$pares[[1]]$estado, 3L)
})

test_that("sin las dos columnas la hoja no participa", {
  expect_null(prosecnurapp:::.mapm_encabezado(list(list("A", "B"), list("1", "2"))))
  expect_null(prosecnurapp:::.mapm_encabezado(list()))
})

test_that("la letra de columna sale de donde esta el encabezado, no de una fija", {
  expect_identical(prosecnurapp:::.mapm_letra(1L), "A")
  expect_identical(prosecnurapp:::.mapm_letra(26L), "Z")
  expect_identical(prosecnurapp:::.mapm_letra(27L), "AA")
  expect_identical(prosecnurapp:::.mapm_letra(38L), "AL")
})

test_that("el remoto sale con los dos rotulos que espera el motor", {
  valores <- list(
    list("CURSO-HORARIO", "DOCENTE", "STATUS MUESTRA"),
    list("R 1.1", "X", "SIN CONTACTAR"),
    list("R 1.2", "Y", "AGENDADA")
  )
  enc <- prosecnurapp:::.mapm_encabezado(valores)
  remoto <- prosecnurapp:::.mapm_remoto(valores, enc$fila, enc$pares[[1]])
  expect_identical(names(remoto), c("CURSO-HORARIO", "STATUS MUESTRA"))
  expect_identical(remoto[["STATUS MUESTRA"]], c("SIN CONTACTAR", "AGENDADA"))
})

test_that("una fila corta no revienta: la celda ausente es vacia", {
  valores <- list(
    list("CURSO-HORARIO", "DOCENTE", "STATUS MUESTRA"),
    list("R 1.1")
  )
  enc <- prosecnurapp:::.mapm_encabezado(valores)
  remoto <- prosecnurapp:::.mapm_remoto(valores, enc$fila, enc$pares[[1]])
  expect_identical(remoto[["STATUS MUESTRA"]], "")
  # Y una celda vacia es LIBRE: se puede marcar.
  out <- monitoreo_aulas_marcas_por_publicar(list(.mapm_fila("R 1.1")), remoto)
  expect_length(out$escribibles, 1L)
})

test_that("sin nada marcado no sale un solo request", {
  expect_error(
    monitoreo_aulas_publicar_marcas("abc", list(.mapm_fila("R 1.1", "sin_contactar"))),
    "ningun curso-horario marcado"
  )
})

test_that("sin id no se intenta escribir", {
  expect_error(monitoreo_aulas_publicar_marcas("", list(.mapm_fila("R 1.1"))),
               "identificador")
})

test_that("el texto dice las tres cifras y distingue ensayo de escritura", {
  hecho <- list(escritas = list(1, 2), respetadas = list(1),
                sin_fila = c("R 9.9"), aplicado = TRUE)
  expect_match(monitoreo_aulas_publicar_marcas_texto(hecho), "^Se pintaron 2 celdas")
  expect_match(monitoreo_aulas_publicar_marcas_texto(hecho), "1 se respeto")
  expect_match(monitoreo_aulas_publicar_marcas_texto(hecho), "1 sin fila")
  ensayo <- utils::modifyList(hecho, list(aplicado = FALSE))
  expect_match(monitoreo_aulas_publicar_marcas_texto(ensayo), "^Se pintarian")
})

test_that("empareja los bloques del libro, que es donde viven las reservas", {
  # Medido el 2026-09-11: de quince marcadas se pintaron nueve —los EXTRA, que
  # tienen fila propia— y las seis reservas de cadena salieron «sin fila en el
  # libro» teniendo su fila delante. Su codigo no esta en la primera columna
  # «CURSO-HORARIO» sino en la de su bloque, y su estado en la «STATUS MUESTRA»
  # de ESE bloque.
  valores <- list(
    list("CURSO-HORARIO", "STATUS MUESTRA", "CURSO-HORARIO", "STATUS MUESTRA"),
    list("CH 1", "AGENDADA", "R 1.1", "SIN CONTACTAR")
  )
  enc <- prosecnurapp:::.mapm_encabezado(valores)
  expect_length(enc$pares, 2L)
  expect_identical(enc$pares[[2]]$codigo, 3L)
  expect_identical(enc$pares[[2]]$estado, 4L)
  # La reserva se encuentra en su bloque y su celda esta libre.
  remoto <- prosecnurapp:::.mapm_remoto(valores, enc$fila, enc$pares[[2]])
  out <- monitoreo_aulas_marcas_por_publicar(list(.mapm_fila("R 1.1")), remoto)
  expect_length(out$escribibles, 1L)
  expect_identical(out$escribibles[[1]]$codigo, "R 1.1")
})

test_that("un bloque sin su pareja no participa", {
  # Tres «CURSO-HORARIO» y dos «STATUS MUESTRA»: el tercero se queda fuera en
  # vez de emparejarse con el estado de otro bloque.
  valores <- list(list("CURSO-HORARIO", "STATUS MUESTRA", "CURSO-HORARIO",
                       "STATUS MUESTRA", "CURSO-HORARIO"))
  expect_length(prosecnurapp:::.mapm_encabezado(valores)$pares, 2L)
})

test_that("el desplegable y el morado salen para cada columna tocada", {
  reqs <- prosecnurapp:::.mapm_requests_de_columna(123L, c(12L, 50L), 2L, 40L)
  expect_length(reqs, 4L)
  expect_true(!is.null(reqs[[1]]$setDataValidation))
  expect_true(!is.null(reqs[[2]]$addConditionalFormatRule))
  # La validacion trae el estado nuevo, que es lo que quita el triangulo rojo.
  valores <- vapply(reqs[[1]]$setDataValidation$rule$condition$values,
                    function(v) v$userEnteredValue, character(1))
  expect_true("REFUERZO POR CONTACTAR" %in% valores)
  # Y el color es el de la paleta, no uno tecleado aqui.
  cond <- reqs[[2]]$addConditionalFormatRule$rule$booleanRule$condition
  expect_identical(cond$values[[1]]$userEnteredValue, "REFUERZO POR CONTACTAR")
  expect_identical(reqs[[1]]$setDataValidation$range$startColumnIndex, 11L)
})

test_that("sin columnas tocadas no sale un solo request de formato", {
  expect_length(prosecnurapp:::.mapm_requests_de_columna(123L, integer(0), 2L, 40L), 0L)
  expect_length(prosecnurapp:::.mapm_requests_de_columna(NA_integer_, c(3L), 2L, 40L), 0L)
})

test_that("una marca ya puesta por la app cuenta para reemitir su formato", {
  # Sin esto, republicar no arreglaba nunca el color: la celda ya llevaba el
  # texto, salia «respetada», no habia datos que escribir y el desplegable y el
  # morado no se emitian. Visto en pantalla el 2026-09-11.
  remoto <- data.frame(
    `CURSO-HORARIO` = c("R 1.1"), `STATUS MUESTRA` = c("REFUERZO POR CONTACTAR"),
    check.names = FALSE, stringsAsFactors = FALSE)
  out <- monitoreo_aulas_marcas_por_publicar(list(.mapm_fila("R 1.1")), remoto)
  expect_length(out$escribibles, 0L)
  expect_identical(out$respetadas[[1]]$habia, "REFUERZO POR CONTACTAR")
})

test_that("el texto DECLARA por que el formato no entro, en vez de callarlo", {
  # La version anterior tenia dos caminos mudos —sin sheetId y sin requests— que
  # dejaban la celda en rojo sin una sola linea que lo dijera. Un paso que puede
  # no ocurrir tiene que contar por que no ocurrio.
  mudo <- list(escritas = list(), respetadas = list(1), sin_fila = character(0),
               aplicado = TRUE,
               formato = list(list(hoja = "Aulas Agendadas (Extra)", estado = "sin-sheet-id",
                                   error = "")))
  txt <- monitoreo_aulas_publicar_marcas_texto(mudo)
  expect_match(txt, "NO entraron")
  expect_match(txt, "sin-sheet-id")

  roto <- list(escritas = list(1), respetadas = list(), sin_fila = character(0),
               aplicado = TRUE,
               formato = list(list(hoja = "X", estado = "error", error = "403 sin permiso")))
  expect_match(monitoreo_aulas_publicar_marcas_texto(roto), "403 sin permiso")

  bien <- list(escritas = list(1), respetadas = list(), sin_fila = character(0),
               aplicado = TRUE,
               formato = list(list(hoja = "X", estado = "aplicado", error = "")))
  expect_match(monitoreo_aulas_publicar_marcas_texto(bien), "Desplegable y color reemitidos")
})

test_that("empareja los bloques con sufijo R1, R2, que es como rotula el libro", {
  # `paste0(titulos_bloque, " R", b - 1L)` en carga_aulas_libro_generar.R. Con
  # igualdad exacta solo aparecia el titular y las reservas de cadena salian
  # «sin fila en el libro» teniendo su fila delante.
  valores <- list(
    list("CURSO-HORARIO", "STATUS MUESTRA", "STATUS DE LLAMADA",
         "CURSO-HORARIO R1", "STATUS MUESTRA R1",
         "CURSO-HORARIO R2", "STATUS MUESTRA R2"),
    list("CH 1", "AGENDADA", "", "R 1.1", "SIN CONTACTAR", "R 1.2", "")
  )
  enc <- prosecnurapp:::.mapm_encabezado(valores)
  expect_length(enc$pares, 3L)
  expect_identical(enc$pares[[2]]$codigo, 4L)
  expect_identical(enc$pares[[2]]$estado, 5L)
  expect_identical(enc$pares[[3]]$estado, 7L)
  # «STATUS DE LLAMADA» no se cuela como columna de estado.
  expect_false(3L %in% vapply(enc$pares, function(p) p$estado, integer(1)))
  # Y la reserva del bloque R1 se encuentra.
  remoto <- prosecnurapp:::.mapm_remoto(valores, enc$fila, enc$pares[[2]])
  out <- monitoreo_aulas_marcas_por_publicar(list(.mapm_fila("R 1.1")), remoto)
  expect_identical(out$escribibles[[1]]$codigo, "R 1.1")
})

# ── La clase 4: ningun camino del paso de formato puede quedarse mudo ────────
#
# Publicar decia «se pintaron N celdas» y del desplegable y el color no decia
# nada, ni bien ni mal: si no habia sheetId, o no salia ninguna request, el paso
# se saltaba en silencio y la celda quedaba en rojo. A Gonzalo le costo tres
# vueltas mirando la hoja equivocada.
#
# El guard ata las tres piezas: los estados que el CODIGO produce, la lista
# DECLARADA, y el TEXTO que los enseña. Una rama nueva sin nombre rompe la
# primera; un nombre sin frase rompe la tercera.

test_that("todo estado que el codigo produce esta en el vocabulario declarado", {
  fuente <- readLines(testthat::test_path("..", "..", "R", "monitoreo_aulas_publicar_marcas.R"),
                      warn = FALSE)
  # Las asignaciones literales `fmt$estado <- "x"` y el `estado = "x"` del molde.
  hits <- regmatches(fuente, gregexpr('(fmt\\$estado <- |estado = )"[a-z-]+"', fuente))
  producidos <- unique(vapply(strsplit(unlist(hits), '"', fixed = TRUE),
                              function(p) p[[2]], character(1)))
  expect_gt(length(producidos), 3L)  # si el barrido enmudece, el guard no guarda
  expect_setequal(intersect(producidos, MONITOREO_AULAS_FORMATO_ESTADOS), producidos)
})

test_that("el texto DICE cada estado que no sea un final limpio", {
  # Los tres finales limpios callan; los otros tres tienen que salir nombrados.
  base <- list(escritas = list(1), respetadas = list(), sin_fila = character(0),
               aplicado = TRUE)
  for (estado in setdiff(MONITOREO_AULAS_FORMATO_ESTADOS,
                         c("aplicado", "ensayo", "sin-columnas"))) {
    out <- utils::modifyList(base, list(
      formato = list(list(hoja = "Aulas Agendadas", estado = estado, error = ""))))
    txt <- monitoreo_aulas_publicar_marcas_texto(out)
    expect_match(txt, "NO entraron", info = sprintf("el estado «%s» no se declara", estado))
    expect_match(txt, estado, fixed = TRUE,
                 info = sprintf("el texto no nombra «%s»", estado))
  }
})

test_that("un final limpio no inventa una alarma", {
  # La contracara: declarar SIEMPRE no puede volverse ruido en el caso bueno.
  limpio <- list(escritas = list(1), respetadas = list(), sin_fila = character(0),
                 aplicado = TRUE,
                 formato = list(list(hoja = "X", estado = "aplicado", error = "")))
  expect_no_match(monitoreo_aulas_publicar_marcas_texto(limpio), "NO entraron")
})

test_that("el rotulo se lee con la MISMA regla que el lector del libro", {
  # La primera reparacion de la clase 5 puso aqui un `startsWith` propio: una
  # segunda regla de rotulo al lado de `.caa_key()`, que ya quitaba el sufijo
  # ` R<n>` desde `carga_aulas_agendadas.R`. Usar la canonica trae gratis lo que
  # la copia no sabia: acentos, espacios de mas y minusculas.
  variantes <- list(
    c("CURSO-HORARIO", "STATUS MUESTRA"),          # la forma canonica
    c("CURSO-HORARIO R1", "STATUS MUESTRA R1"),    # el bloque de reemplazo
    c("curso-horario", "status muestra"),          # minusculas
    c("CURSO-HORARIO ", " STATUS  MUESTRA"),       # espacios de mas y dobles
    c("CURSO HORARIO", "STATUS MUESTRA")           # el alias sin guion
  )
  for (v in variantes) {
    enc <- prosecnurapp:::.mapm_encabezado(list(as.list(v), list("R 1.1", "SIN CONTACTAR")))
    expect_false(is.null(enc), info = paste("no encontro el encabezado:", paste(v, collapse = " / ")))
    expect_length(enc$pares, 1L)
    remoto <- prosecnurapp:::.mapm_remoto(
      list(as.list(v), list("R 1.1", "SIN CONTACTAR")), enc$fila, enc$pares[[1]])
    out <- monitoreo_aulas_marcas_por_publicar(list(.mapm_fila("R 1.1")), remoto)
    expect_length(out$escribibles, 1L)
  }
})

test_that("el ensayo ensaya: `aplicar: false` del JSON no escribe (CCSS, 2026-09-24)", {
  # jsonlite entrega el lógico FALSE; antes se pasaba a texto y nunca era idéntico.
  expect_false(.mapm_aplicar_del_cuerpo(jsonlite::fromJSON('{"aplicar": false}')))
  expect_false(.mapm_aplicar_del_cuerpo(list(aplicar = "false")))
  expect_false(.mapm_aplicar_del_cuerpo(list(aplicar = "0")))
  expect_true(.mapm_aplicar_del_cuerpo(list(aplicar = TRUE)))
  # Sin el campo se escribe: es lo que manda el botón de la app.
  expect_true(.mapm_aplicar_del_cuerpo(list()))
  expect_true(.mapm_aplicar_del_cuerpo(NULL))
})
