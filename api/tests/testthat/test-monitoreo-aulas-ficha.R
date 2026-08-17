# El estado de la ficha sale de los materiales que existen.
#
# `package_status` era un campo que NINGUN proceso escribia: medido sobre el
# operativo de 2025, vacio en las 196. La vista lo rotulaba «Por revisar»,
# que suena a que hay una ficha esperando revision cuando lo que pasa es que no
# hay ninguna. El vocabulario de estos estados ya existia en la capa de
# presentacion; lo que faltaba era que alguien los emitiera.

.ficha_plan <- function(...) {
  base <- list(classroom_id = "CH 1", operational_code = "CH 1", eligible_n = 30)
  utils::modifyList(base, list(...))
}

# `monitoreo_aulas_normalize_plan()` devuelve una LISTA de filas, no el
# data.frame interno. Se lee por su forma publica, que es la que consume el
# resto del motor.
.ficha_estado <- function(...) {
  out <- monitoreo_aulas_normalize_plan(list(...))
  vapply(out, function(r) as.character(r$package_status %||% ""), character(1))
}

test_that("sin enlace la ficha no puede estar lista", {
  expect_identical(.ficha_estado(.ficha_plan()), "pendiente_enlace")
})

test_that("con enlace queda lista para imprimirse, y el QR vale igual", {
  expect_identical(.ficha_estado(.ficha_plan(link = "https://x/y")), "listo_para_pdf")
  # El QR solo tambien alcanza: es el mismo material por otra via.
  expect_identical(.ficha_estado(.ficha_plan(qr = "https://x/qr")), "listo_para_pdf")
})

test_that("con el PDF o el Word generados la ficha esta preparada", {
  expect_identical(.ficha_estado(.ficha_plan(link = "https://x/y", pdf_link = "/a.pdf")), "pdf_preparado")
  expect_identical(.ficha_estado(.ficha_plan(link = "https://x/y", word_link = "/a.docx")), "pdf_preparado")
})

test_that("un estado que el plan YA trae no se pisa con el derivado", {
  # Si Recopiladores empieza a escribirlo, ese valor manda: la derivacion es un
  # relleno para el campo vacio, no una segunda fuente de verdad.
  expect_identical(.ficha_estado(.ficha_plan(package_status = "pdf_preparado")), "pdf_preparado")
  # Y al reves: un plan que declara «pendiente_enlace» con enlace puesto tampoco
  # se corrige solo. Discrepar es un dato del plan, no un error a tapar.
  expect_identical(
    .ficha_estado(.ficha_plan(link = "https://x/y", package_status = "pendiente_enlace")),
    "pendiente_enlace")
})

test_that("la derivacion es por fila y no contagia a las vecinas", {
  # El aserto que atrapa el error de vectorizacion: con un `any()` mal puesto,
  # una sola aula con PDF ascendia a todas las demas.
  expect_identical(
    .ficha_estado(
      .ficha_plan(classroom_id = "A", operational_code = "A"),
      .ficha_plan(classroom_id = "B", operational_code = "B", link = "https://x/b"),
      .ficha_plan(classroom_id = "C", operational_code = "C", link = "https://x/c", pdf_link = "/c.pdf")
    ),
    c("pendiente_enlace", "listo_para_pdf", "pdf_preparado"))
})
