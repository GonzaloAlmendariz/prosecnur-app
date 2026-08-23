# El paquete de fichas se reparte como se reparte el trabajo.
#
# Una carpeta por facultad y, dentro, tres cajones: lo que SE VISITA, lo que
# entra si algo cae, y lo que espera sin asignar. Con las 2.616 fichas del
# sorteo del 22 en una sola carpeta por facultad, Ciencias e Ingenieria tiene
# 574 PDF y encontrar la de un titular concreto es imposible.
#
# Los nombres salen del diccionario de la propia ficha que va dentro
# —`.crf_role_label`: «Titular», «Reemplazo», «Reserva adicional»— para no tener
# dos vocabularios para lo mismo.

test_that("cada rol tiene su cajon, con el nombre que la ficha imprime", {
  expect_equal(prosecnurapp:::.cmj_carpeta_de_rol("titular"), "Titulares")
  expect_equal(prosecnurapp:::.cmj_carpeta_de_rol("chain_reserve"), "Reemplazos")
  expect_equal(prosecnurapp:::.cmj_carpeta_de_rol("extra_reserve_pool"), "Adicionales")
})

test_that("tolera la clave escrita con espacios o mayusculas", {
  # El rol llega del plan y no siempre normalizado.
  expect_equal(prosecnurapp:::.cmj_carpeta_de_rol("Chain Reserve"), "Reemplazos")
  expect_equal(prosecnurapp:::.cmj_carpeta_de_rol("TITULAR"), "Titulares")
  expect_equal(prosecnurapp:::.cmj_carpeta_de_rol("reserva"), "Reemplazos")
})

test_that("un rol desconocido va a «Otros» y NO se reparte a ojo", {
  # Meterlo en cualquiera de los tres cajones cambiaria en silencio lo que
  # alguien lleva a campo. Que se vea es justo el punto.
  expect_equal(prosecnurapp:::.cmj_carpeta_de_rol("rol_que_nadie_previo"), "Otros")
  expect_equal(prosecnurapp:::.cmj_carpeta_de_rol(""), "Otros")
  expect_equal(prosecnurapp:::.cmj_carpeta_de_rol(NULL), "Otros")
})

test_that("el contexto de la ficha lleva la CLAVE del rol ademas de la frase", {
  # `role` sale ya redactado —«Reemplazo 2»— porque es lo que se imprime. Quien
  # agrupa por rol necesita el termino canonico: leerlo del texto obligaria a
  # parsear una frase que existe para leerse, no para compararse.
  ctx <- prosecnurapp:::.crf_unit_context(list(
    unit_id = "u1", label = "urb209_0601", role = "chain_reserve",
    dimensions = list(replacement_for = "CH 1", replacement_order = 2, faculty = "DERECHO")
  ))
  expect_equal(ctx$role_key, "chain_reserve")
  # La frase lleva ademas de quien es reemplazo, que es lo que se imprime.
  expect_equal(ctx$role, "Reemplazo 2 de CH 1")
  expect_equal(ctx$faculty, "DERECHO")
})

test_that("el titular conserva su clave aunque su frase no lleve numero", {
  ctx <- prosecnurapp:::.crf_unit_context(list(
    unit_id = "u2", label = "urb209_0601", role = "titular", dimensions = list()
  ))
  expect_equal(ctx$role_key, "titular")
  expect_equal(ctx$role, "Titular")
})

# --- El registro de aplicacion es el formulario de captura del libro ---------
#
# La ficha es un objeto de PAPEL: el aplicador la llena a mano en el aula, se la
# entrega al jefe de campo y el jefe de campo TRANSCRIBE a la hoja «Aulas
# Aplicadas (Campo)», que es lo que la app relee para actualizar Monitoreo.
#
# Si los dos formularios no usan los mismos nombres, quien transcribe traduce
# 193 veces; y si el papel no pide una columna, ese dato no existe cuando toca
# llenarla.

test_that("cada casilla del papel tiene su columna en la hoja del libro", {
  casillas <- unlist(strsplit(collection_material_application_log_labels(), "|", fixed = TRUE))
  # **La pista de formato no es parte del nombre.** «Fecha (DD/MM/AA):» le dice
  # al aplicador como escribir; la columna del libro se llama «FECHA DE
  # APLICACIÓN». Comparar la etiqueta entera hacia fallar la correspondencia por
  # el parentesis, que es justo lo que este test NO vigila.
  casillas <- tolower(trimws(gsub(":", "", gsub("\\s*\\([^)]*\\)", "", casillas))))
  columnas <- tolower(prosecnurapp:::.calg_titulos_campo())

  # Cada casilla aparece dentro del nombre de alguna columna de la hoja.
  for (c in casillas) {
    expect_true(
      any(grepl(c, columnas, fixed = TRUE)),
      info = sprintf("la casilla «%s» no corresponde a ninguna columna del libro", c)
    )
  }
})

test_that("las columnas que el aplicador puede llenar tienen casilla en el papel", {
  casillas <- tolower(paste(collection_material_application_log_labels(), collapse = " "))
  # Lo que solo se sabe estando en el aula. Quedan fuera a proposito los
  # derivados —«% asistencia»— y los que trae el marco —«matriculados»—.
  for (col in c("asistentes", "efectivas", "rechazos", "duplicados", "aplicador",
                "aula", "fecha", "hora", "observaciones")) {
    expect_true(grepl(col, casillas, fixed = TRUE),
                info = sprintf("«%s» se pide en el libro y no en el papel", col))
  }
})

test_that("dos casillas por renglon caben en los seis que admite el bloque", {
  etiquetas <- collection_material_application_log_labels()
  expect_lte(length(etiquetas), 6L)
  # Y el emparejado es lo que las hace caber: nueve casillas en cinco renglones.
  expect_gt(length(unlist(strsplit(etiquetas, "|", fixed = TRUE))), length(etiquetas))
})

# --- El aula no se inventa con el codigo del curso -------------------------
#
# La lista de candidatos de `venue` terminaba en `label`, el ultimo «por si
# acaso», y acabo siendo el unico: medido sobre las 2.616 unidades del estudio
# de aulas, las 2.616 traian en «Aula» el codigo del curso-horario
# —`1edu92_0801`—. El marco NO trae el aula porque el aula no se sabe hasta el
# dia de la aplicacion: es uno de los datos que el aplicador anota a mano.
#
# Rellenar un campo con el valor de otro no es un fallback: quien lee la ficha
# no puede distinguir un aula que se conoce de una que no.

test_that("sin columna de aula, el aula queda vacia y no copia el codigo", {
  fila <- list(label = "1edu92_0801", faculty = "EDUCACION", schedule = "0801")
  expect_identical(prosecnurapp:::.collection_first_string(
    fila, c("pabellon_aula", "pabellon", "venue", "aula", "salon", "room", "building_room")
  ), "")
  # Y el control que lo hace fallar si alguien devuelve `label` a la lista.
  expect_identical(prosecnurapp:::.collection_first_string(
    fila, c("pabellon_aula", "aula", "label")
  ), "1edu92_0801")
})

test_that("con columna de aula de verdad, la usa", {
  expect_identical(prosecnurapp:::.collection_first_string(
    list(label = "1edu92_0801", aula = "H-201"),
    c("pabellon_aula", "pabellon", "venue", "aula", "salon", "room", "building_room")
  ), "H-201")
})

# --- El registro no pide lo que la ficha ya responde -----------------------
#
# El aula es el UNICO dato del registro que la ficha puede traer impreso: los
# demas —asistentes, rechazos, quien aplico, cuando— solo existen despues de la
# aplicacion. Gonzalo, 2026-08-23: «si el aula ya esta arriba y viene impresa,
# el aplicador ya no tendria que llenarlo».
#
# La comparacion va contra el valor CRUDO y no contra lo que la ficha imprime.
# La primera version miro `context$venue`, que pasa por `.crf_txt` y devuelve
# «Por confirmar» cuando no hay aula: preguntarle a esa cadena si hay aula
# responde que si siempre, y el registro dejaba de pedirla en una ficha que
# arriba decia «Por confirmar». Se vio en el render, no en el codigo.

test_that("con el aula impresa, el registro no la vuelve a pedir", {
  etiquetas <- as.list(collection_material_application_log_labels())
  con <- prosecnurapp:::.crf_log_labels(etiquetas, "H-201")
  expect_false(any(grepl("Aula", con)))
  # Se quita la casilla, no el renglon: su compañera se queda la hoja entera.
  expect_length(con, length(etiquetas))
  expect_true(any(grepl("Aplicador", con)))
})

test_that("sin aula, la casilla se mantiene: es el unico sitio donde puede quedar", {
  etiquetas <- as.list(collection_material_application_log_labels())
  expect_true(any(grepl("Aula", prosecnurapp:::.crf_log_labels(etiquetas, ""))))
  expect_true(any(grepl("Aula", prosecnurapp:::.crf_log_labels(etiquetas, NULL))))
})

test_that("el contexto lleva el aula cruda ademas de la que imprime", {
  # El control que mata la version que miraba el texto impreso.
  sin <- prosecnurapp:::.crf_unit_context(list(unit_id = "u", label = "x", dimensions = list()))
  expect_identical(sin$venue, "Por confirmar")
  expect_identical(sin$venue_raw, "")
  expect_true(any(grepl("Aula", prosecnurapp:::.crf_log_labels(
    as.list(collection_material_application_log_labels()), sin$venue_raw))))
})

test_that("la escuela viaja del marco a la ficha", {
  # `program` venia con dato en las 2.616 unidades del estudio y moria en la
  # seleccion: la ficha no podia decir de que escuela es el curso.
  ctx <- prosecnurapp:::.crf_unit_context(list(
    unit_id = "u", label = "x", dimensions = list(program = "DISEÑO GRAFICO")))
  expect_identical(ctx$program, "DISEÑO GRAFICO")
  expect_identical(prosecnurapp:::.collection_first_string(
    list(program = "ARQUITECTURA"),
    c("program", "escuela", "school", "especialidad", "carrera", "programa")), "ARQUITECTURA")
})
