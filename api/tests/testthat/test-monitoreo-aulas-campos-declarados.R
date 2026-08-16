# El patron que mas veces ha aparecido en este GOAL, convertido en control.
#
# `monitoreo_aulas_normalize_plan()` reconstruye cada fila campo a campo con una
# lista CERRADA: lo que no se declara ahi se cae en silencio. Once veces a lo
# largo del GOAL un dato se perdio exactamente asi —el ultimo, el telefono del
# docente, que es EL dato con el que se agenda—.
#
# El control no es «estos campos concretos existen»: es que **todo lo que un
# lector produce sobreviva**. Un campo nuevo en una spec de lectura sin su
# declaracion aqui pone rojo este test, en vez de descubrirse cuando un estudio
# real pierde datos.

.mcd_campos_declarados <- function() {
  base <- list(list(classroom_id = "A", operational_code = "CH 1", label = "x",
                    wave = "M1", sample_role = "titular", orden = 1))
  names(monitoreo_aulas_normalize_plan(base)[[1]])
}

test_that("todo campo del lector de agendamiento sobrevive al plan", {
  declarados <- .mcd_campos_declarados()
  produce <- unique(vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1)))
  # `notes` entra por el alias de `replacement_note`: el lector lo deja ahi y el
  # generador lo escribe con el otro nombre.
  produce <- setdiff(produce, "notes")
  perdidos <- setdiff(produce, declarados)
  expect_identical(perdidos, character(0),
                   info = paste("campos que el lector produce y el plan descarta:",
                                paste(perdidos, collapse = ", ")))
})

test_that("el telefono del docente no se cae entre el lector y el generador", {
  # El caso concreto que destapo el control. El estudio de 2025 no llenaba esa
  # columna, asi que un fixture real NO lo habria encontrado: hace falta el
  # sintetico para probar el mecanismo.
  fila <- monitoreo_aulas_normalize_plan(list(list(
    classroom_id = "A-01", operational_code = "CH 1", label = "Aula 1", wave = "M1",
    sample_role = "titular", orden = 1,
    teacher = "Docente 1", teacher_phone = "999888777", teacher_email = "d1@pucp.pe"
  )))[[1]]
  expect_identical(as.character(fila$teacher_phone), "999888777")
  # El control del otro lado: el correo SI sobrevivia, y por eso la ausencia del
  # telefono no saltaba a la vista.
  expect_identical(as.character(fila$teacher_email), "d1@pucp.pe")
})

test_that("la observacion entra por cualquiera de sus dos nombres", {
  por_notes <- monitoreo_aulas_normalize_plan(list(list(
    classroom_id = "A", operational_code = "CH 1", label = "x", wave = "M1",
    sample_role = "titular", orden = 1, notes = "No contesta desde el lunes"
  )))[[1]]
  por_nota <- monitoreo_aulas_normalize_plan(list(list(
    classroom_id = "A", operational_code = "CH 1", label = "x", wave = "M1",
    sample_role = "titular", orden = 1, replacement_note = "No contesta desde el lunes"
  )))[[1]]
  expect_identical(as.character(por_notes$replacement_note), "No contesta desde el lunes")
  expect_identical(as.character(por_nota$replacement_note), "No contesta desde el lunes")
})

test_that("el round-trip por el libro conserva el contacto del docente", {
  plan <- list(list(
    classroom_id = "A-01", operational_code = "CH 1", label = "Aula 101",
    course_name = "Curso 1", faculty = "Ciencias", sample_role = "titular",
    wave = "M1", orden = 1, eligible_n = 30, enrolled_total = 34, expected_valid = 20,
    teacher = "Docente 1", teacher_phone = "999888777", teacher_email = "d1@pucp.pe"
  ))
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(monitoreo_aulas_normalize_plan(plan), libro)
  vuelta <- aulas_libro_importar(libro)$plan[[1]]
  expect_identical(as.character(vuelta$teacher_phone), "999888777")
  expect_identical(as.character(vuelta$teacher_email), "d1@pucp.pe")
})

# --- El aviso de columnas sin nombre --------------------------------------
# `control_sin_nombre` lo calculaba el lector desde el principio y viajaba en la
# respuesta del endpoint de importacion, donde ningun consumidor lo miraba. En
# el estudio de 2025 son 7 columnas con datos —tres conteos y tres proporciones
# que suman 1— cuya cabecera esta vacia en la hoja.

.mcd_aviso <- function(n) {
  plan <- list(list(classroom_id = "A", operational_code = "CH 1", label = "x",
                    wave = "M1", sample_role = "titular", orden = 1, eligible_n = 30))
  d <- monitoreo_aulas_dashboard(plan, data.frame(),
                                 list(enabled = TRUE, plan = plan, control_sin_nombre = n))
  Filter(function(r) identical(as.character(r$check), "unnamed_control_columns"), d$validation)[[1]]
}

test_that("el tablero avisa de las columnas que no pudo leer", {
  aviso <- .mcd_aviso(7L)
  expect_identical(as.character(aviso$status), "review")
  expect_match(as.character(aviso$detail), "7 columnas")
  # Dice QUE HACER, no solo que pasa: la jerga del motor no viaja a la UI.
  expect_match(as.character(aviso$detail), "Ponles nombre")
})

test_that("sin columnas huerfanas el aviso queda en ok", {
  # El control: si el aviso dijera siempre lo mismo, este caso no lo distinguiria.
  aviso <- .mcd_aviso(0L)
  expect_identical(as.character(aviso$status), "ok")
  expect_no_match(as.character(aviso$detail), "Ponles nombre")
})

test_that("el conteo sobrevive al normalizador de config", {
  # Septima aparicion del patron de la lista cerrada fue `partes_campo`; este
  # campo entra por la misma puerta y necesita la misma declaracion.
  cfg <- monitoreo_aulas_normalize_config(list(enabled = TRUE, control_sin_nombre = 7L))
  expect_identical(as.integer(cfg$control_sin_nombre), 7L)
})
