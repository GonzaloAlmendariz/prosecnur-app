# La cadena de reemplazos lista las reservas Y las aulas que cayeron.
#
# El filtro miraba solo `operational_status` —el eje de la APLICACION, que llena
# el registro de campo— cuando el reemplazo vive en `sample_status`. Medido sobre
# el operativo: 24 titulares con STATUS MUESTRA `reemplazada` y CERO de ellos en
# la tabla, que mostraba 26 filas y las 26 eran reservas. La consulta se llama
# «cadena» y no dejaba ver junto a que reserva cayo cada aula.

.cad_plan <- function() list(
  # Cae por el eje de MUESTRA, con el operativo intacto: es el caso que el
  # filtro viejo no veia.
  list(classroom_id = "CH 1", operational_code = "CH 1", eligible_n = 30,
       sample_role = "titular", sample_status = "reemplazada",
       replacement_reason = "docente_no_autoriza"),
  list(classroom_id = "R 1.1", operational_code = "R 1.1", eligible_n = 28,
       sample_role = "chain_reserve", sample_status = "agendada",
       replacement_for = "CH 1", replacement_order = 1,
       activation_reason = "docente_no_autoriza"),
  # Ni cae ni es reserva: no pertenece a la cadena.
  list(classroom_id = "CH 2", operational_code = "CH 2", eligible_n = 30,
       sample_role = "titular", sample_status = "agendada")
)

test_that("el aula caida entra en la cadena aunque su estado operativo no diga nada", {
  d <- monitoreo_aulas_dashboard(.cad_plan(), data.frame(), list())
  codigos <- vapply(d$reemplazos, function(r) as.character(r$operational_code), character(1))

  expect_setequal(codigos, c("CH 1", "R 1.1"))
  # El aserto que atrapa el filtro viejo: con solo `operational_status`, «CH 1»
  # no aparece y la lista queda con una sola fila.
  expect_length(d$reemplazos, 2L)
})

test_that("un titular sano no se cuela en la cadena", {
  # El control del aserto anterior: si el filtro se abriera de mas, «CH 2»
  # entraria y la consulta dejaria de ser una cadena.
  d <- monitoreo_aulas_dashboard(.cad_plan(), data.frame(), list())
  codigos <- vapply(d$reemplazos, function(r) as.character(r$operational_code), character(1))
  expect_false("CH 2" %in% codigos)
})

test_that("el motivo sale del campo que corresponde al papel de la fila", {
  d <- monitoreo_aulas_dashboard(.cad_plan(), data.frame(), list())
  de <- function(cod) Filter(function(r) identical(as.character(r$operational_code), cod), d$reemplazos)[[1]]

  # La que CAE lo lleva en `replacement_reason`.
  expect_identical(de("CH 1")$motivo, "docente_no_autoriza")
  # La que ENTRA lo lleva en `activation_reason`. Con la columna vieja
  # —`replacement_reason`— esta fila salia vacia SIEMPRE, por construccion.
  expect_identical(de("R 1.1")$motivo, "docente_no_autoriza")
})

test_that("sin motivo declarado la columna es cadena vacia, no NA", {
  plan <- list(
    list(classroom_id = "CH 9", operational_code = "CH 9", eligible_n = 30,
         sample_role = "titular", sample_status = "reemplazada"),
    list(classroom_id = "R 9.1", operational_code = "R 9.1", eligible_n = 28,
         sample_role = "chain_reserve", sample_status = "en_reserva",
         replacement_for = "CH 9", replacement_order = 1)
  )
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list())

  for (fila in d$reemplazos) expect_identical(fila$motivo, "")
})
