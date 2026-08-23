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
  casillas <- tolower(trimws(gsub(":", "", casillas)))
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
