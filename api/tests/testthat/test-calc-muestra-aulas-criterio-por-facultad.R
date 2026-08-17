# Un criterio puesto en UNA facultad se cumple SOLO en esa facultad.
#
# Gonzalo: «si establezco un criterio específico para una facultad en particular,
# es un criterio que funciona exclusivamente para esa facultad, y habra otra
# facultad que tendra ligeramente otros criterios, y el embudo tiene que
# funcionar de forma adecuada».
#
# El mecanismo vive en `crit$exceptions[[faculty_key]]`
# (`calc_muestra_aulas_criterios.R` ~1184) con dos modos: `add` añade las
# categorias de esa facultad a las generales, y `replace` hace que esa facultad
# use SOLO las suyas. Nada protegia esa frontera: si la excepcion se filtrara a
# las demas facultades, el marco se llenaria de aulas que el diseño excluyo, y
# ningun test lo notaria.

.cpf_base <- function(por_aula = 20L) {
  do.call(rbind, lapply(1:8, function(i) {
    fac <- if (i <= 4L) "DERECHO" else "ARTES ESCENICAS"
    tipo <- if (i %% 2L == 0L) "TALLER" else "TEORICO"
    do.call(rbind, lapply(seq_len(por_aula), function(j) data.frame(
      student_id = paste0("e", (i - 1L) * por_aula + j), aula_id = sprintf("A%02d", i),
      curso_id = paste0("C", i), curso = paste("Curso", i), horario = "L 8",
      facultad = fac, programa = "P1", sexo = "F", edad = 20,
      condicion = "regular", nivel = "pregrado", modalidad = "presencial",
      tipo_sesion = tipo, stringsAsFactors = FALSE
    )))
  }))
}

.cpf_frame <- function(exceptions = list()) {
  calc_muestra_aulas_construir(
    base_madre = .cpf_base(),
    config = list(
      mapping = list(session_type = "tipo_sesion"),
      filters = list(min_eligible_per_class = 5L),
      criterios_seleccion = list(byVariable = list(session_type = list(
        scope = "aula", kind = "flat", mode = "include", match = "any",
        categories = "teorico", exceptions = exceptions
      )))
    )
  )
}

.cpf_tabla <- function(fr) {
  af <- fr$aula_frame
  inc <- af[af$included %in% TRUE, , drop = FALSE]
  function(facultad, tipo) sum(inc$faculty == facultad & inc$session_type == tipo)
}

test_that("sin excepciones el criterio general rige en las dos facultades", {
  # Control: si esto ya trajera talleres, el test de abajo pasaria sin medir.
  n <- .cpf_tabla(.cpf_frame())
  expect_equal(n("DERECHO", "TEORICO"), 2L)
  expect_equal(n("ARTES ESCENICAS", "TEORICO"), 2L)
  expect_equal(n("DERECHO", "TALLER"), 0L)
  expect_equal(n("ARTES ESCENICAS", "TALLER"), 0L)
})

test_that("una excepcion abre la categoria SOLO en su facultad", {
  n <- .cpf_tabla(.cpf_frame(list(
    artes_escenicas = list(categories = "taller", op = "add")
  )))
  # Entra en la facultad que la declaro...
  expect_equal(n("ARTES ESCENICAS", "TALLER"), 2L)
  # ...y NO se filtra a la otra. Esta es la frontera que el test protege.
  expect_equal(n("DERECHO", "TALLER"), 0L)
  # Y el criterio general sigue rigiendo en ambas.
  expect_equal(n("DERECHO", "TEORICO"), 2L)
  expect_equal(n("ARTES ESCENICAS", "TEORICO"), 2L)
})

test_that("`replace` deja a esa facultad SOLO con sus categorias", {
  # `add` suma a las generales; `replace` las sustituye. Con replace, Artes
  # Escenicas se queda con taller y PIERDE teorico, mientras Derecho no se entera.
  n <- .cpf_tabla(.cpf_frame(list(
    artes_escenicas = list(categories = "taller", op = "replace")
  )))
  expect_equal(n("ARTES ESCENICAS", "TALLER"), 2L)
  expect_equal(n("ARTES ESCENICAS", "TEORICO"), 0L)
  expect_equal(n("DERECHO", "TEORICO"), 2L)
  expect_equal(n("DERECHO", "TALLER"), 0L)
})

test_that("una excepcion de una facultad que no existe no altera el marco", {
  # Un nombre mal escrito no debe abrir la categoria en todas por descuido.
  n <- .cpf_tabla(.cpf_frame(list(
    facultad_inexistente = list(categories = "taller", op = "add")
  )))
  expect_equal(n("DERECHO", "TALLER"), 0L)
  expect_equal(n("ARTES ESCENICAS", "TALLER"), 0L)
})
