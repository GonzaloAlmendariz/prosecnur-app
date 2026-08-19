# El motor descartaba con datos en la mano y no lo decia. Ver
# `docs/qa/checklist-acnur-v3-preguntas-ausentes-2026-08-19.md`.

var_cov <- function(name, tipo, status, n = 0L, reason = "", label = name,
                    choices = list(), list_name = "") {
  list(name = name, tipo = tipo, status = status, n_non_empty = n,
       exclusion_reason = reason, label = label, choices = choices,
       list_name = if (nzchar(list_name)) list_name else name)
}

fuente <- function(...) list(list(name = "default", variables = list(...)))

opciones <- function(...) lapply(list(...), function(p) list(name = p[[1]], label = p[[2]]))

test_that("una pregunta cerrada descartada con datos genera aviso con su causa", {
  sources <- fuente(
    var_cov("Sos_empresa", "select_one", "no_graficable", n = 87L,
            reason = "identificador/contacto/texto sensible",
            label = "¿Alguna empresa le ha solicitado la homologación?"),
    var_cov("reva_Tram_obs", "select_one", "no_graficable", n = 6L,
            reason = "identificador/contacto/texto sensible",
            label = "Si tuvo observaciones, ¿pudo resolverlas?")
  )
  d <- .graficos_descartes_sustantivos(sources)
  expect_length(d, 2L)
  expect_setequal(vapply(d, `[[`, character(1), "clase"), "cerrada_descartada")

  # Sin piso de casos: la de 6 respuestas avisa igual que la de 87. Un umbral
  # arbitrario era justo lo que dejaba pasar a `reva_Tram_obs`.
  avisos <- .graficos_avisos_de_descarte(sources)
  expect_length(avisos, 2L)
  expect_true(any(grepl("87 respuestas", avisos, fixed = TRUE)))
  expect_true(any(grepl("6 respuestas", avisos, fixed = TRUE)))
  expect_true(all(grepl("pregunta cerrada", avisos, fixed = TRUE)))
  # El aviso dice la causa, no solo el hecho.
  expect_true(all(grepl("identificador/contacto/texto sensible", avisos, fixed = TRUE)))
})

test_that("una numerica con datos avisa que hay que tramificarla", {
  sources <- fuente(
    var_cov("NowSalary", "integer", "no_graficable", n = 16L,
            reason = "tipo no graficable (integer)", label = "Ingreso mensual actual"),
    var_cov("PastSalary", "integer", "no_graficable", n = 4L,
            reason = "tipo no graficable (integer)", label = "Ingreso mensual previo")
  )
  avisos <- .graficos_avisos_de_descarte(sources)
  expect_length(avisos, 2L)
  expect_true(any(grepl("NowSalary_recod", avisos, fixed = TRUE)))
  expect_true(all(grepl("Tramificala en Codificacion", avisos, fixed = TRUE)))
})

test_that("el canal calla ante la metadata del formulario", {
  # Los primeros veinte avisos sobre ACNUR V3 traian once de ruido: marcas de
  # tiempo, campos `calculate` del formulario y los identificadores reales. Un
  # aviso que hay que aprender a ignorar deja de ser un aviso.
  sources <- fuente(
    var_cov("start", "start", "no_graficable", n = 103L, reason = "tipo no graficable (start)"),
    var_cov("end", "end", "no_graficable", n = 103L, reason = "tipo no graficable (end)"),
    var_cov("mand_Date", "date", "no_graficable", n = 103L,
            reason = "tipo no graficable (date)", label = "Fecha"),
    var_cov("date_reva_sit", "date", "no_graficable", n = 69L,
            reason = "tipo no graficable (date)", label = "Fecha del resultado final"),
    var_cov("name_ppl", "calculate", "no_graficable", n = 103L,
            reason = "tipo no graficable (calculate)"),
    var_cov("telephone", "text", "no_graficable", n = 103L,
            reason = "identificador/contacto/texto sensible",
            label = "Teléfono asignado para entrevista"),
    var_cov("empresa_ppl", "text", "no_graficable", n = 16L,
            reason = "identificador/contacto/texto sensible")
  )
  expect_length(.graficos_avisos_de_descarte(sources), 0L)
})

test_that("una numerica ya tramificada no avisa, y lo esperado tampoco", {
  # `MesesReva` con su `MesesReva_recod` graficable entra al inventario como
  # `cubierta_por_recodificada`, no como descarte.
  sources <- fuente(
    var_cov("MesesReva", "integer", "cubierta_por_recodificada", n = 87L),
    var_cov("MesesReva_recod", "select_one", "cubierta", n = 85L,
            choices = opciones(c("1", "Hasta 1 mes"), c("2", "De 2 a 3 meses"),
                               c("3", "4 meses o más"))),
    var_cov("Ocupation", "text", "no_graficable", n = 4L, reason = "abierta cruda"),
    var_cov("Equi_barrera_other", "text", "no_graficable", n = 3L,
            reason = "integrada en otra variable"),
    var_cov("Consent", "select_one", "no_graficable", n = 101L,
            reason = "metadato/control operativo del formulario"),
    var_cov("telephone", "text", "no_graficable", n = 0L,
            reason = "identificador/contacto/texto sensible")
  )
  expect_length(.graficos_avisos_de_descarte(sources), 0L)
})

test_that("un catalogo cuya etiqueta es el codigo avisa antes de exportar", {
  # ACNUR V3 al 14/08: la lista `*_recod` heredo los codigos como etiqueta y el
  # PPT salio con "1, 2, 3, 96, 97" en el eje.
  roto <- fuente(var_cov(
    "revaDificults_recod", "select_multiple", "cubierta", n = 87L,
    label = "Principales dificultades del trámite",
    list_name = "revaDificults_recod",
    choices = opciones(c("1", "1"), c("2", "2"), c("3", "3"), c("4", "4"),
                       c("96", "96"), c("97", "97"))
  ))
  avisos <- .graficos_avisos_de_descarte(roto)
  expect_length(avisos, 1L)
  expect_true(grepl("saldria numerado", avisos[[1]], fixed = TRUE))
  expect_true(grepl("6 de 6 opciones", avisos[[1]], fixed = TRUE))

  sano <- fuente(var_cov(
    "revaDificults_recod", "select_multiple", "cubierta", n = 87L,
    list_name = "revaDificults_recod",
    choices = opciones(c("1", "Tiempos largos de espera"),
                       c("2", "Observaciones al expediente"),
                       c("96", "Otra (especificar)"),
                       c("97", "Ninguna dificultad"))
  ))
  expect_length(.graficos_avisos_de_descarte(sano), 0L)
})

test_that("el detector de catalogo numerado no dispara con Yes/No ni con escalas", {
  # `Yes_no` tiene una coincidencia real ("No" se etiqueta "No"): con solo el
  # criterio de la mitad, una lista de dos opciones daba falso positivo.
  sources <- fuente(
    var_cov("Sos_empresa", "select_one", "cubierta", n = 87L, list_name = "Yes_no",
            choices = opciones(c("Yes", "Sí"), c("No", "No"))),
    var_cov("UtilityWhatsAppGroup", "select_one", "cubierta", n = 15L, list_name = "utility",
            choices = opciones(c("1", "Nada útiles"), c("2", "Poco útiles"),
                               c("3", "Algo útiles"), c("4", "Útiles"),
                               c("5", "Muy útiles")))
  )
  expect_length(.graficos_avisos_de_descarte(sources), 0L)
})

test_that("solo se mira el catalogo de lo que puede llegar al mazo", {
  # Una lista numerada de una variable ya integrada en su madre no es problema
  # de nadie: no se grafica.
  sources <- fuente(var_cov(
    "algo_recod", "select_one", "integrada_en_otra_variable", n = 10L,
    list_name = "algo_recod",
    choices = opciones(c("1", "1"), c("2", "2"), c("3", "3"))
  ))
  expect_length(.graficos_avisos_de_descarte(sources), 0L)
})
