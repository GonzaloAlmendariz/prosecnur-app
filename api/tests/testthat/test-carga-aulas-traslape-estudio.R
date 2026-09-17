# =============================================================================
# Qué de este plan ya lo tocó otro estudio
# =============================================================================
#
# Gonzalo, 2026-09-17: «que haga el cruce por solape si es docente ya contactado
# para la DAA o para HSVG o si el curso-horario ya fue seleccionado previamente
# por HSVG y/o aplicado».
#
# Lo que estas pruebas defienden, en una línea cada cosa: que la precedencia sea
# por FUERZA DE LA EVIDENCIA y no por nivel; que «está en el otro plan» no se
# publique como «ya lo contactaron»; que sin traslape la celda quede vacía y no
# con un «no» inventado; y que el cruce no vaya por nombre de docente.

.tte_plan <- function() list(
  list(operational_code = "CH 1", classroom_id = "a1", teacher_email = "uno@pucp.pe"),
  list(operational_code = "CH 2", classroom_id = "a2", teacher_email = "dos@pucp.pe"),
  list(operational_code = "CH 3", classroom_id = "a3", teacher_email = "tres@pucp.pe"),
  list(operational_code = "CH 4", classroom_id = "a4", teacher_email = "cuatro@pucp.pe")
)

test_that("la precedencia es por fuerza de la evidencia, no por nivel", {
  # **La trampa, y por qué existe la prueba.** CH 2 tiene su aula en el PLAN del
  # otro estudio —puede ser una reserva que nunca se activó— y además su docente
  # YA contactado. Con la precedencia del cruce DAA (aula antes que docente) la
  # celda decía «AULA EN EL PLAN», la noticia floja tapando la fuerte, y el que
  # llama no se enteraba de que esa persona ya había hablado con nosotros.
  # Medido en CCSS: 2 titulares rotulados como contactados en vez de 6.
  tr <- aulas_traslape_estudio(
    .tte_plan(),
    aulas = c("a2", "a3"),
    docentes = c("dos@pucp.pe", "cuatro@pucp.pe"),
    contactados = "dos@pucp.pe",
    aulas_contactadas = "a3",
    etiqueta = "HSVG")
  expect_identical(tr[["CH 1"]], "")
  expect_identical(tr[["CH 2"]], "DOCENTE YA CONTACTADO EN HSVG")
  expect_identical(tr[["CH 3"]], "AULA YA APLICADA EN HSVG")
  expect_identical(tr[["CH 4"]], "DOCENTE EN EL PLAN DE HSVG")
})

test_that("lo aplicado gana a lo contactado: es el mismo aula, no el mismo docente", {
  tr <- aulas_traslape_estudio(
    .tte_plan()[1], aulas = "a1", docentes = "uno@pucp.pe",
    contactados = "uno@pucp.pe", aulas_contactadas = "a1", etiqueta = "HSVG")
  expect_identical(tr[["CH 1"]], "AULA YA APLICADA EN HSVG")
})

test_that("«está en el plan» NO se publica como «ya lo contactaron»", {
  # Son dos preguntas y las respuestas difieren mucho: en CCSS, 26 de los 50
  # titulares tienen su docente en el plan de HSVG y sólo 7 tienen contacto
  # registrado. Publicar el primero como el segundo mandaría a media muestra a
  # disculparse por una llamada que nadie hizo.
  tr <- aulas_traslape_estudio(
    .tte_plan(), aulas = c("a1", "a2"), docentes = c("uno@pucp.pe", "dos@pucp.pe"),
    contactados = character(0), aulas_contactadas = character(0), etiqueta = "HSVG")
  veredictos <- unique(as.character(tr[nzchar(tr)]))
  expect_false(any(grepl("CONTACTADO|APLICADA", veredictos)))
  expect_true(all(grepl("EN EL PLAN DE HSVG", veredictos)))
})

test_that("sin traslape la celda queda VACIA, no con un «no»", {
  tr <- aulas_traslape_estudio(.tte_plan(), etiqueta = "HSVG")
  expect_true(all(tr == ""))
  # Y aun así cada unidad TIENE su entrada: el consumidor busca por código y un
  # nombre ausente no es lo mismo que un veredicto vacío.
  expect_setequal(names(tr), c("CH 1", "CH 2", "CH 3", "CH 4"))
})

test_that("el cruce no va por NOMBRE de docente", {
  # «ADINS  , SEBASTIEN MARCEL ALBERT» trae dos espacios en la base de la DTI, y
  # un cruce por nombre ya se rompió antes por eso. La clave es el correo; el
  # código de docente sería mejor pero el plan de HSVG2026 lo trae vacío en sus
  # 1.392 filas (medido).
  plan <- list(list(operational_code = "CH 1", classroom_id = "a1",
                    teacher = "ADINS  , SEBASTIEN", teacher_email = "sadins@pucp.pe"))
  tr <- aulas_traslape_estudio(plan, contactados = "ADINS  , SEBASTIEN", etiqueta = "HSVG")
  expect_identical(tr[["CH 1"]], "")
  tr2 <- aulas_traslape_estudio(plan, contactados = "SADINS@PUCP.PE", etiqueta = "HSVG")
  expect_identical(tr2[["CH 1"]], "DOCENTE YA CONTACTADO EN HSVG")
})

test_that("el rotulo de la columna viaja con el veredicto", {
  tr <- aulas_traslape_estudio(.tte_plan(), etiqueta = "HSVG")
  expect_identical(attr(tr, "rotulo"), "TRASLAPE HSVG")
  # Y la hoja lo usa: sin atributo se titula «TRASLAPE DAA», que es lo que
  # HSVG2026 publica hoy y no puede cambiar.
  hoja <- aulas_libro_hoja_agendadas(
    list(list(operational_code = "CH 1", classroom_id = "a1", sample_role = "titular",
              label = "a1", orden = 1)),
    traslape_daa = tr)
  expect_true("TRASLAPE HSVG" %in% as.character(unlist(hoja[1, ])))
  viejo <- stats::setNames("AULA EN DAA (TITULAR)", "CH 1")
  hoja2 <- aulas_libro_hoja_agendadas(
    list(list(operational_code = "CH 1", classroom_id = "a1", sample_role = "titular",
              label = "a1", orden = 1)),
    traslape_daa = viejo)
  expect_true("TRASLAPE DAA" %in% as.character(unlist(hoja2[1, ])))
})

test_that("el resumen dice cuantas cayeron en cada veredicto", {
  # Un cruce sin su conteo es una columna que nadie sabe si funcionó: con 0 de
  # 136 hay que sospechar de la clave antes que del solape.
  tr <- aulas_traslape_estudio(
    .tte_plan(), aulas = "a2", docentes = "cuatro@pucp.pe",
    contactados = "cuatro@pucp.pe", aulas_contactadas = character(0), etiqueta = "HSVG")
  r <- aulas_traslape_resumen(tr)
  expect_identical(r$unidades, 4L)
  expect_identical(r$con_traslape, 2L)
  expect_identical(as.integer(r$por_veredicto[["DOCENTE YA CONTACTADO EN HSVG"]]), 1L)
  expect_identical(aulas_traslape_resumen(character(0))$con_traslape, 0L)
})
