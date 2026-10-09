
# **Las efectivas por SEXO, y sólo con la variable declarada.**
#
# Dictado 2026-09-04: «poder mapear fácilmente cuántas se esperaban en total y
# en hombres y en mujeres y cuánto obtuvimos». Lo esperado ya lo reparte la
# calibración; esto es la otra mitad.
.tes_plan <- function() list(list(
  operational_code = "CH 7", classroom_id = "a7", titular_operational_code = "CH 7",
  sample_role = "titular", operational_status = "agendada"
))
.tes_resp <- function() data.frame(
  aula = rep("a7", 5L),
  sexo = c("M", "M", "F", "F", ""),
  estado = rep("completa", 5L),
  stringsAsFactors = FALSE
)
.tes_cfg <- function(sex_var = "sexo") list(source_mapping = list(
  classroom_id_var = "aula", status_var = "estado",
  valid_statuses = list("completa"), sex_var = sex_var
))

test_that("el reparto por sexo SUMA el total: es la misma maquinaria, no otra cuenta", {
  plan <- .tes_plan(); resp <- .tes_resp(); cfg <- .tes_cfg()
  total <- monitoreo_aulas_efectivas_por_aula(plan, resp, cfg)[["CH 7"]]
  por_sexo <- monitoreo_aulas_efectivas_por_sexo(plan, resp, cfg)[["CH 7"]]
  expect_equal(sum(por_sexo), as.numeric(total))
  expect_equal(as.numeric(por_sexo[["M"]]), 2)
  expect_equal(as.numeric(por_sexo[["F"]]), 2)
})

test_that("la respuesta sin sexo NO se esconde: entra como «Sin declarar»", {
  # Es un dato del campo, no un hueco. Descartarla haría que el reparto por
  # sexo dejara de sumar el total y nadie sabría por qué.
  por_sexo <- monitoreo_aulas_efectivas_por_sexo(.tes_plan(), .tes_resp(), .tes_cfg())[["CH 7"]]
  expect_equal(as.numeric(por_sexo[["Sin declarar"]]), 1)
})

test_that("sin variable declarada devuelve NULL: no se adivina qué columna es", {
  # `sub_a` es el sexo MÁS FRECUENTE del aula, no las mujeres: esa lectura ya
  # costó una vez y una cifra inventada por sexo es peor que ninguna.
  expect_null(monitoreo_aulas_efectivas_por_sexo(.tes_plan(), .tes_resp(), .tes_cfg("")))
  # Y una variable declarada que la base no trae tampoco inventa nada.
  expect_null(monitoreo_aulas_efectivas_por_sexo(.tes_plan(), .tes_resp(), .tes_cfg("genero")))
})

test_that("los filtros de efectiva mandan igual que en el total", {
  resp <- .tes_resp()
  resp$estado[[1]] <- "parcial"
  por_sexo <- monitoreo_aulas_efectivas_por_sexo(.tes_plan(), resp, .tes_cfg())[["CH 7"]]
  # La M descartada por el filtro no cuenta ni en su sexo ni en el total.
  expect_equal(as.numeric(por_sexo[["M"]]), 1)
  expect_equal(sum(por_sexo), 4)
})

test_that("la config sin `sex_var` sobrevive el viaje por la whitelist", {
  cfg <- monitoreo_aulas_normalize_config(list(source_mapping = list(sex_var = "sexo")))
  expect_equal(cfg$source_mapping$sex_var, "sexo")
  # Y sin declararla queda vacía, no ausente: la clave existe siempre.
  expect_equal(monitoreo_aulas_normalize_config(list())$source_mapping$sex_var, "")
})
