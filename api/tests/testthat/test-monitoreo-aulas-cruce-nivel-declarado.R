# La hoja «Control de nivel»: el nivel del padrón contra el ciclo que la persona
# declaro. Clonada de la hermana de facultad, y lo unico que NO se clona es el
# trato de «Otros» — ver la cabecera del motor y el ADR 0088, Notas.

.mcnd_padron <- function(pares) list(
  schema = "monitoreo_aulas_padron_v1",
  filas = lapply(names(pares), function(cod) list(
    codigo = cod, nivel = pares[[cod]], carrera = "ECONOMIA", sexo = "F"
  ))
)

.mcnd_cfg <- function(..., etiquetas = list(`1` = "6", `2` = "7", `3` = "8", `4` = "9", `5` = "Otros")) {
  list(source_mapping = list(
    student_code_var = "codigo",
    declared_level_var = "a1",
    declared_level_labels = etiquetas,
    ...
  ))
}

.mcnd_resp <- function(codigo, a1) data.frame(
  codigo = codigo, a1 = a1, stringsAsFactors = FALSE
)

test_that("sin variable declarada el bloque se cae con motivo, no con ceros", {
  # Un bloque vacio con su motivo es mas honesto que uno con ceros que se
  # leerian como medidos. Es el contrato de la hermana de facultad.
  cfg <- .mcnd_cfg(); cfg$source_mapping$declared_level_var <- ""
  r <- monitoreo_aulas_cruce_nivel_declarado(.mcnd_resp("20201234", "1"), .mcnd_padron(list()), cfg)
  expect_false(r$ok)
  expect_true(grepl("no declara su variable de ciclo", r$motivo))
  expect_identical(r$comparables, 0L)
})

test_that("una variable que no esta en la base lo dice con su nombre", {
  cfg <- .mcnd_cfg(); cfg$source_mapping$declared_level_var <- "ciclo_que_no_existe"
  r <- monitoreo_aulas_cruce_nivel_declarado(.mcnd_resp("20201234", "1"), .mcnd_padron(list()), cfg)
  expect_false(r$ok)
  expect_true(grepl("ciclo_que_no_existe", r$motivo, fixed = TRUE))
})

test_that("cruza y cuenta acuerdos y desacuerdos", {
  pad <- .mcnd_padron(list("20201234" = 6L, "20205678" = 7L, "20209999" = 8L))
  # 1234 declara 6 y el padron dice 6 -> coincide.
  # 5678 declara 8 y el padron dice 7 -> discrepa.
  # 9999 declara 8 y el padron dice 8 -> coincide.
  r <- monitoreo_aulas_cruce_nivel_declarado(
    .mcnd_resp(c("20201234", "20205678", "20209999"), c("1", "3", "3")), pad, .mcnd_cfg())
  expect_true(r$ok)
  expect_identical(r$comparables, 3L)
  expect_identical(r$coinciden, 2L)
  expect_identical(r$discrepan, 1L)
  # La discrepancia viaja con la FILA de la base, que es con lo que se busca, y
  # NO con el codigo: es PII y este bloque se persiste en el payload.
  expect_identical(length(r$pares), 1L)
  expect_identical(r$pares[[1]]$fila, 2L)
  expect_identical(r$pares[[1]]$nivel_padron, "7")
  expect_identical(r$pares[[1]]$declarado, "8")
  expect_false("codigo" %in% names(r$pares[[1]]))
})

test_that("«Otros» con el padron FUERA del rango COINCIDE, no discrepa", {
  # Es la correccion de Gonzalo del 2026-09-17 y lo unico que separa esta hoja
  # de su hermana. La poblacion es ciclo 6 a 9: quien marca «Otros» declara que
  # no es poblacion, y si el padron tambien lo pone fuera, los dos dicen lo
  # mismo. Contarlo como desacuerdo inflaria el conflicto justo en las aulas
  # mixtas, que son las que el piso de 50 % dejo dentro a proposito.
  pad <- .mcnd_padron(list("20201234" = 6L, "20205678" = 10L))
  r <- monitoreo_aulas_cruce_nivel_declarado(
    .mcnd_resp(c("20201234", "20205678"), c("1", "5")), pad, .mcnd_cfg())
  expect_true(r$ok)
  expect_identical(r$coinciden, 2L)
  expect_identical(r$discrepan, 0L)
  expect_identical(r$fuera_declarado$coinciden, 1L)
  expect_identical(r$fuera_declarado$discrepan, 0L)
})

test_that("«Otros» con el padron DENTRO del rango si discrepa, y aparte", {
  # La otra mitad, que es la que pide accion: la persona se declara fuera de una
  # poblacion en la que el padron la pone.
  pad <- .mcnd_padron(list("20201234" = 7L))
  r <- monitoreo_aulas_cruce_nivel_declarado(.mcnd_resp("20201234", "5"), pad, .mcnd_cfg())
  expect_identical(r$discrepan, 1L)
  expect_identical(r$fuera_declarado$discrepan, 1L)
  expect_true(r$pares[[1]]$es_otros)
  expect_identical(r$pares[[1]]$declarado, "Otros")
})

test_that("«Otros» NO se colapsa con «no declaro» en la matriz", {
  # Son dos cosas distintas: una es una respuesta y la otra su ausencia.
  pad <- .mcnd_padron(list("20201234" = 10L, "20205678" = 10L))
  r <- monitoreo_aulas_cruce_nivel_declarado(
    .mcnd_resp(c("20201234", "20205678"), c("5", "")), pad, .mcnd_cfg())
  # Solo la primera es comparable; la segunda no declaro y cae a «sin ciclo».
  expect_identical(r$comparables, 1L)
  celdas <- unlist(lapply(r$matriz, function(f) vapply(f$celdas, function(c) c$declarado, character(1))))
  expect_true("Otros" %in% celdas)
  expect_false("" %in% celdas)
})

test_that("si NADA coincide, lo que falla es la comparacion y lo dice", {
  # El modo de fallo medido de la hermana de facultad, clonado: sin catalogo se
  # compara el codigo de la opcion contra el nivel del padron y el control
  # publica cero coincidencias, que es la alarma maxima por hablar dos idiomas.
  pad <- .mcnd_padron(list("20201234" = 6L, "20205678" = 7L, "20209999" = 8L))
  sin_catalogo <- .mcnd_cfg(etiquetas = list())
  r <- monitoreo_aulas_cruce_nivel_declarado(
    .mcnd_resp(c("20201234", "20205678", "20209999"), c("1", "2", "3")), pad, sin_catalogo)
  expect_false(r$ok)
  expect_true(grepl("que el estudio no reconoce", r$motivo))
  expect_true(grepl("declared_level_labels", r$motivo, fixed = TRUE))
  # Y NO publica «100 % de otro nivel», que es lo que la hermana publicaba.
  expect_identical(r$discrepan, 0L)
})

test_that("sin rango declarado «Otros» no se juzga, y nunca como desacuerdo", {
  # Sin etiquetas no hay rango del instrumento. El catalogo minimo traduce la
  # opcion pero no declara ningun nivel numerico, asi que «Otros» no se puede
  # juzgar — y no juzgarlo es distinto de juzgarlo mal.
  pad <- .mcnd_padron(list("20201234" = 6L, "20205678" = 7L))
  cfg <- .mcnd_cfg(etiquetas = list(`1` = "6", `5` = "Otros"))
  r <- monitoreo_aulas_cruce_nivel_declarado(
    .mcnd_resp(c("20201234", "20205678"), c("1", "5")), pad, cfg)
  # El rango declarado es {6}: el 7 del padron queda fuera, asi que «Otros»
  # coincide con el. La regla se lee del catalogo, no de una constante 6-9.
  expect_true(r$ok)
  expect_identical(r$coinciden, 2L)
})

test_that("la bolsa «sin nivel» se desglosa por lo que se puede HACER con ella", {
  # De las que no resolvieron, las que SI declararon ciclo son las que vale la
  # pena revisar: hay persona y hay dato, lo que falla es el codigo.
  pad <- .mcnd_padron(list("20201234" = 6L))
  r <- monitoreo_aulas_cruce_nivel_declarado(
    .mcnd_resp(c("20201234", "20990000", "20990001", "20990002"),
               c("1", "2", "", "5")), pad, .mcnd_cfg())
  expect_identical(r$sin_nivel$total, 3L)
  expect_identical(r$sin_nivel$con_ciclo_declarado, 1L)
  expect_identical(r$sin_nivel$sin_ciclo_declarado, 1L)
  expect_identical(r$sin_nivel$se_declaro_fuera, 1L)
  # Y el desglose sobrevive al bloque vacio: es lo unico que se puede decir
  # cuando no hay nada comparable, y perderlo dejaria la bolsa sin explicacion.
  sin_var <- .mcnd_cfg(); sin_var$source_mapping$student_code_var <- ""
  r2 <- monitoreo_aulas_cruce_nivel_declarado(
    .mcnd_resp("20201234", "1"), pad, sin_var)
  expect_false(r2$ok)
  expect_identical(r2$sin_nivel$total, 1L)
})

test_that("la matriz dice cuantas de cada par y cuantas de esas coinciden", {
  pad <- .mcnd_padron(list("20201234" = 6L, "20201235" = 6L, "20201236" = 6L))
  r <- monitoreo_aulas_cruce_nivel_declarado(
    .mcnd_resp(c("20201234", "20201235", "20201236"), c("1", "1", "2")),
    pad, .mcnd_cfg())
  fila <- r$matriz[[which(vapply(r$matriz, function(f) f$nivel_padron, character(1)) == "6")]]
  seis <- fila$celdas[[which(vapply(fila$celdas, function(c) c$declarado, character(1)) == "6")]]
  expect_identical(seis$n, 2L)
  expect_identical(seis$coinciden, 2L)
  siete <- fila$celdas[[which(vapply(fila$celdas, function(c) c$declarado, character(1)) == "7")]]
  expect_identical(siete$n, 1L)
  expect_identical(siete$coinciden, 0L)
})

test_that("una sola discrepancia legitima NO se come el guard del idioma", {
  # El defecto que el guard clonado tenia: con UNA comparable que de verdad
  # discrepa, cero coincidencias es el resultado correcto, y el guard devolvia
  # el bloque vacio —sin discrepancia y sin par que ir a buscar—. La hermana de
  # facultad no lo nota porque mide cientos; una hoja con diez respuestas si.
  #
  # La prueba del idioma es que los VOCABULARIOS sean disjuntos, no el conteo:
  # aqui el 7 declarado esta en el mismo vocabulario que el 6 del padron.
  pad <- .mcnd_padron(list("20201234" = 6L))
  r <- monitoreo_aulas_cruce_nivel_declarado(.mcnd_resp("20201234", "2"), pad, .mcnd_cfg())
  expect_true(r$ok)
  expect_identical(r$comparables, 1L)
  expect_identical(r$coinciden, 0L)
  expect_identical(r$discrepan, 1L)
  expect_identical(length(r$pares), 1L)
})

test_that("y el guard del idioma SI salta cuando los vocabularios no se tocan", {
  # Sin catalogo: se compara el codigo de la opcion contra el nivel del padron.
  # Un solo caso basta, porque la prueba no es el conteo.
  pad <- .mcnd_padron(list("20201234" = 6L))
  r <- monitoreo_aulas_cruce_nivel_declarado(
    .mcnd_resp("20201234", "1"), pad, .mcnd_cfg(etiquetas = list()))
  expect_false(r$ok)
  expect_true(grepl("que el estudio no reconoce", r$motivo))
  # Y el motivo DICE el valor intruso y el vocabulario, que es lo que permite
  # arreglarlo sin abrir el codigo.
  expect_true(grepl("(1)", r$motivo, fixed = TRUE))
})

test_that("un formulario que guarda el ciclo como ENTERO no necesita catalogo", {
  # Es el caso que la prueba exacta tiene que dejar pasar: sin catalogo, si los
  # valores declarados son los mismos niveles del padron, no hay nada que
  # traducir. Tratarlo como «falta el catalogo» apagaria el control de un
  # estudio que lo tiene todo bien.
  pad <- .mcnd_padron(list("20201234" = 6L, "20201235" = 7L))
  r <- monitoreo_aulas_cruce_nivel_declarado(
    .mcnd_resp(c("20201234", "20201235"), c("6", "7")), pad, .mcnd_cfg(etiquetas = list()))
  expect_true(r$ok)
  expect_identical(r$coinciden, 2L)
})

# --- la hoja, y que alguien la MONTE ----------------------------------------
#
# El motor de E24 costó tres hallazgos del mismo tipo: campos que el motor
# publica y ninguna superficie consume. Por eso la mitad de este bloque no
# prueba la hoja sino su ENGANCHE.

test_that("sin cruce posible la hoja NO se escribe: una hoja vacia diria que todo coincide", {
  cfg <- .mcnd_cfg(); cfg$source_mapping$declared_level_var <- ""
  expect_null(aulas_libro_filas_control_nivel(
    .mcnd_resp("20201234", "1"), .mcnd_padron(list()), cfg))
  expect_null(aulas_libro_valores_control_nivel(
    .mcnd_resp("20201234", "1"), .mcnd_padron(list()), cfg))
})

test_that("la hoja trae la matriz, las discrepancias y la bolsa desglosada", {
  pad <- .mcnd_padron(list("20201234" = 6L, "20201235" = 6L, "20201236" = 7L))
  filas <- aulas_libro_filas_control_nivel(
    .mcnd_resp(c("20201234", "20201235", "20201236", "20990000"),
               c("1", "2", "2", "1")), pad, .mcnd_cfg())
  primeras <- vapply(filas, function(f) as.character(unlist(f$celdas)[[1]]), character(1))
  expect_identical(primeras[[1]], "CONTROL DE NIVEL")
  expect_true("MATRIZ DE CONSISTENCIA" %in% primeras)
  expect_true("DISCREPANCIAS, UNA POR UNA" %in% primeras)
  expect_true("RESPUESTAS SIN NIVEL" %in% primeras)
  # «Otros» al FINAL de las columnas de la matriz, no entre los ciclos: es la
  # opcion de escape y leerla entre ellos la haria parecer uno mas.
  cab <- filas[[which(primeras == "NIVEL DEL PADRÓN")[[1]]]]$celdas
  expect_identical(as.character(cab)[[1]], "NIVEL DEL PADRÓN")
  # Y la hoja declara que NO reatribuye nada, que es lo que la separa del avance.
  notas <- paste(unlist(lapply(filas, function(f) as.character(unlist(f$celdas)))), collapse = " ")
  expect_true(grepl("NO cambia ningún conteo", notas, fixed = TRUE))
})

test_that("el codigo del alumno NO viaja a la hoja: es PII y la hoja se comparte", {
  pad <- .mcnd_padron(list("20201234" = 6L))
  filas <- aulas_libro_filas_control_nivel(
    .mcnd_resp(c("20201234", "20201235"), c("2", "1")), pad, .mcnd_cfg())
  todo <- paste(unlist(lapply(filas, function(f) as.character(unlist(f$celdas)))), collapse = " ")
  expect_false(grepl("20201234", todo, fixed = TRUE))
  expect_false(grepl("20201235", todo, fixed = TRUE))
})

test_that("el formato de Sheets reconoce sus cuatro cabeceras y sus bloques", {
  pad <- .mcnd_padron(list("20201234" = 6L, "20201235" = 7L))
  valores <- aulas_libro_valores_control_nivel(
    .mcnd_resp(c("20201234", "20201235", "20990000"), c("1", "1", "2")),
    pad, .mcnd_cfg())
  reqs <- aulas_libro_control_nivel_formato_requests("hoja", valores)
  # Sin requests, la hoja sale en Sheets sin una sola banda: es el defecto que
  # ya mordio con el formato que no llegaba a una hoja sembrada.
  expect_gt(length(reqs), 4L)
})

test_that("«Control de nivel» esta en el orden de pestanas del Sheets", {
  # El enganche que faltaba y que costo tres hallazgos en E24: un motor sin
  # consumidor no es una capacidad. Si la pestana no esta en el orden, la
  # publicacion no la crea nunca.
  orden <- monitoreo_sheets_pestanas_controladas()
  expect_true("Control de nivel" %in% orden)
  # Pegada a su hermana: las dos son controles del mismo tipo y se leen juntas.
  expect_identical(which(orden == "Control de nivel"),
                   which(orden == "Control de facultad") + 1L)
})

test_that("cada mitad de «Otros» se dice SOLO si existe", {
  # Con 0 coincidencias la version anterior escribia «son 0 que coinciden», que
  # no es una frase. Se vio generando el .xlsx con datos, no leyendo el motor.
  pad <- .mcnd_padron(list("20201234" = 6L, "20201235" = 7L))
  filas <- aulas_libro_filas_control_nivel(
    .mcnd_resp(c("20201234", "20201235"), c("1", "5")), pad, .mcnd_cfg())
  notas <- paste(unlist(lapply(filas, function(f) as.character(unlist(f$celdas)))), collapse = " ")
  expect_true(grepl("el padrón las pone DENTRO", notas, fixed = TRUE))
  expect_false(grepl("0 marcaron", notas, fixed = TRUE))
  # Y al contrario: con el padron fuera del rango, solo se dice la mitad buena.
  pad2 <- .mcnd_padron(list("20201234" = 6L, "20201235" = 12L))
  filas2 <- aulas_libro_filas_control_nivel(
    .mcnd_resp(c("20201234", "20201235"), c("1", "5")), pad2, .mcnd_cfg())
  notas2 <- paste(unlist(lapply(filas2, function(f) as.character(unlist(f$celdas)))), collapse = " ")
  expect_true(grepl("coinciden, y no son un desacuerdo", notas2, fixed = TRUE))
  expect_false(grepl("pone DENTRO", notas2, fixed = TRUE))
})
