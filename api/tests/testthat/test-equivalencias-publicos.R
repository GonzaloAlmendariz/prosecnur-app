source("setup-load-all.R")

# ADR 0062 — la equivalencia entre públicos se declara, no se adivina.
# ADR 0104 — la matriz se arma en la app: la plantilla Excel, «Subir matriz» y
# «Proponer emparejados» se retiraron; aquí quedan el motor que la declaración
# sigue usando (etiquetas por base, cobertura, sello, firma, revisión) y la clave
# por variable que consume la alineación de SurveyMonkey multibase.

# Forma del estudio medido: la misma pregunta con otro nombre en cada público, y
# `p13_1` significa cosas distintas en docentes y en estudiantes.
.eqp_equiv_real <- function() {
  fila <- function(etiqueta, variables) list(
    seccion = "1.2 Servicios", etiqueta_estandar = etiqueta,
    variables = variables, cantidad = length(variables))
  list(
    schema = "equivalencias_publicos/v1",
    bases = c("docentes", "estudiantes", "egresados"),
    filas = list(
      fila("¿Conoce el Servicio de salud?",
           list(docentes = "p13_1", estudiantes = "p11_1", egresados = "p18_1")),
      fila("¿Ha utilizado el Servicio de salud?",
           list(docentes = "p14_1", estudiantes = "p12_1", egresados = "p19_1")),
      fila("¿Qué tan satisfecho se encuentra con el Servicio de salud?",
           list(docentes = "p15_1", estudiantes = "p13_1"))
    )
  )
}

test_that("las etiquetas aterrizan por base y cada una en SU variable", {
  equiv <- .eqp_equiv_real()
  labels <- .equiv_variable_labels_por_base(equiv)

  # El corazón del ADR 0062 y el guard contra regresar al 0061: la etiqueta
  # estándar se escribe en la variable QUE CORRESPONDE a cada público, nunca la
  # misma clave para todos.
  expect_equal(labels$docentes[["p13_1"]], "¿Conoce el Servicio de salud?")
  expect_equal(labels$estudiantes[["p11_1"]], "¿Conoce el Servicio de salud?")
  expect_equal(labels$egresados[["p18_1"]], "¿Conoce el Servicio de salud?")

  # Y `p13_1` de estudiantes es la satisfacción, no «¿Conoce?»: si el importador
  # aplicara por nombre en vez de por equivalencia, esto sería lo que rompería.
  expect_equal(labels$estudiantes[["p13_1"]],
               "¿Qué tan satisfecho se encuentra con el Servicio de salud?")
})

test_that("una fila sin etiqueta estándar no aporta etiquetas", {
  equiv <- .eqp_equiv_real()
  equiv$filas[[2]]$etiqueta_estandar <- ""
  labels <- .equiv_variable_labels_por_base(equiv)
  expect_null(labels$docentes[["p14_1"]])
  expect_equal(labels$docentes[["p13_1"]], "¿Conoce el Servicio de salud?")
})

test_that("el sello cambia cuando cambia el conjunto de variables del instrumento", {
  inst_a <- list(survey = data.frame(
    type = c("select_one lst", "select_one lst", "note"),
    name = c("p13_1", "p13_2", "nota_p13"), stringsAsFactors = FALSE))
  inst_b <- list(survey = data.frame(
    type = c("select_one lst", "select_one lst", "note"),
    name = c("p13_1", "p13_3", "nota_p13"), stringsAsFactors = FALSE))

  sello_a <- .equiv_sello_instrumento(inst_a)
  expect_true(nzchar(sello_a))
  expect_equal(sello_a, .equiv_sello_instrumento(inst_a))
  expect_false(identical(sello_a, .equiv_sello_instrumento(inst_b)))

  # Las filas estructurales no cuentan: reordenar o añadir una nota no puede
  # invalidar una declaración que sigue siendo cierta.
  inst_c <- list(survey = data.frame(
    type = c("note", "select_one lst", "note", "select_one lst"),
    name = c("nota_x", "p13_2", "nota_p13", "p13_1"), stringsAsFactors = FALSE))
  expect_equal(sello_a, .equiv_sello_instrumento(inst_c))
})


test_that("la cobertura reporta las variables declaradas que el instrumento no tiene", {
  equiv <- .eqp_equiv_real()
  equiv$bases <- "docentes"
  inst <- list(survey = data.frame(
    type = c("select_one lst", "select_one lst"),
    name = c("p13_1", "p14_1"), stringsAsFactors = FALSE))

  cob <- .equiv_cobertura(equiv, list(docentes = inst))
  expect_equal(cob$docentes$n_declaradas, 3L)
  expect_equal(cob$docentes$n_calzan, 2L)
  # Se reporta en vez de fallar: la matriz sigue sirviendo para sus otras filas.
  expect_equal(cob$docentes$huerfanas, "p15_1")
})

test_that("la clave por variable separa baterías que comparten etiqueta y escala", {
  # La consume la alineación de SurveyMonkey multibase (`.sm_mb_alin_preguntas`).
  # El caso real: «Servicio de salud» con escala Sí/No aparece DOS veces por
  # base —¿Conoce? y ¿Ha utilizado?— y sólo el ordinal las distingue.
  inst <- list(
    docentes = list(survey = data.frame(
      type = c("select_one si_no", "select_one si_no", "select_one sat"),
      name = c("p13_1", "p14_1", "p15_1"),
      label = rep("Servicio de salud", 3), section = "Pag1", stringsAsFactors = FALSE),
      choices = data.frame(
        list_name = c("si_no", "si_no", "sat", "sat"),
        name = c("1", "2", "1", "2"),
        label = c("Sí", "No", "Malo", "Bueno"), stringsAsFactors = FALSE)),
    estudiantes = list(survey = data.frame(
      type = c("select_one lst_a", "select_one lst_b", "select_one lst_c"),
      name = c("p11_1", "p12_1", "p13_1"),
      label = rep("Servicio de salud", 3), section = "Pag1", stringsAsFactors = FALSE),
      choices = data.frame(
        list_name = c("lst_a", "lst_a", "lst_b", "lst_b", "lst_c", "lst_c"),
        name = c("1", "2", "1", "2", "1", "2"),
        label = c("Sí", "No", "Sí", "No", "Malo", "Bueno"), stringsAsFactors = FALSE))
  )

  doc <- .equiv_claves_de_base(inst$docentes)
  est <- .equiv_claves_de_base(inst$estudiantes)
  # La 1.ª Sí/No calza con la 1.ª, la 2.ª con la 2.ª, y la escala distinta aparte.
  expect_identical(doc$p13_1$clave, est$p11_1$clave)
  expect_identical(doc$p14_1$clave, est$p12_1$clave)
  expect_identical(doc$p15_1$clave, est$p13_1$clave)
  expect_false(identical(doc$p13_1$clave, doc$p14_1$clave))
  expect_false(identical(doc$p13_1$clave, doc$p15_1$clave))
  expect_equal(doc$p13_1$etiqueta, "Servicio de salud")
})

test_that("normalizar un encabezado retira el sufijo de readxl y las tildes", {
  # La usa el importador por bloques: las matrices reales repiten el nombre del
  # público y readxl entrega `Docentes...2` y `Docentes...12`.
  expect_equal(.equiv_norm_col(c("Docentes...12", "Sección", "Etiqueta estándar", NA)),
               c("docentes", "seccion", "etiqueta_estandar", ""))
})

test_that("sólo las preguntas de opción son graficables, directa o vía recodificada", {
  inst <- list(survey = data.frame(
    type = c("select_one", "select_multiple", "text", "integer", "select_one", "integer"),
    list_name = c("lst_a", "lst_b", "", "", "lst_e", ""),
    name = c("p1", "p2", "p3", "p4", "p4_recod", "p9"),
    label = c("Única", "Múltiple", "Abierta", "Edad", "Rango de edad", "Suelta"),
    stringsAsFactors = FALSE))

  expect_true(.equiv_es_graficable(inst, "p1"))   # opción única
  expect_true(.equiv_es_graficable(inst, "p2"))   # opción múltiple
  expect_false(.equiv_es_graficable(inst, "p3"))  # texto abierto
  # Numérica con recodificada de opción: es lo que el render acaba dibujando.
  expect_true(.equiv_es_graficable(inst, "p4"))
  # Numérica sin recodificada: no hay nada que apilar.
  expect_false(.equiv_es_graficable(inst, "p9"))
  expect_false(.equiv_es_graficable(inst, "inexistente"))
})

# --- ADR 0103/0064: revisión, opciones y firma de escala -------------------

test_that("las columnas del informe no mueven la revisión: ya no son de la matriz (ADR 0103)", {
  base_filas <- list(list(
    seccion = "", etiqueta_estandar = "Salud", diapositiva = "3",
    enunciado = "", variables = list(docentes = "p13_1"), cantidad = 1L))
  con_enunciado <- base_filas
  con_enunciado[[1]]$enunciado <- "¿Conoce los siguientes servicios?"

  expect_true(identical(
    .equiv_declaracion_revision(list(filas = base_filas)),
    .equiv_declaracion_revision(list(filas = con_enunciado))
  ))
})

test_that("las opciones de la escala salen enteras y con la caja original", {
  .esc <- function(labels) list(
    survey = data.frame(type = "select_one lst", name = "p1", label = "X",
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = "lst", name = as.character(seq_along(labels)),
                         label = labels, stringsAsFactors = FALSE))

  op <- .equiv_escala_opciones(.esc(c("Sí", "No")), "p1")
  # Caja ORIGINAL: la firma las pasa a minusculas para comparar, y derivar de ahi
  # el texto pintaba «si / no» en pantalla.
  expect_equal(vapply(op, function(x) x$etiqueta, character(1)), c("Sí", "No"))
  expect_equal(vapply(op, function(x) x$codigo, character(1)), c("1", "2"))

  # Enteras: cuanto cabe lo decide la superficie. Recortar aqui obligaba a elegir
  # un limite a ciegas y mutilaba las escalas de cinco puntos del estudio.
  expect_length(.equiv_escala_opciones(.esc(as.character(1:9)), "p1"), 9L)

  # Sin lista no hay opciones; inventar una ensenaria una escala que no existe.
  libre <- list(survey = data.frame(type = "integer", name = "p1", label = "X",
                                    stringsAsFactors = FALSE))
  expect_length(.equiv_escala_opciones(libre, "p1"), 0L)
})

test_that("la caja de las opciones no cuenta como escala distinta", {
  # Medido: 56 de 58 temas de Acreditacion Contabilidad quedaban fuera del mazo
  # porque un cuestionario escribia «Totalmente en desacuerdo» y otro «Totalmente
  # en Desacuerdo». La caja es un accidente de transcripcion, no una escala.
  ch_min <- data.frame(list_name = "lst", name = c("1", "2"),
                       label = c("Totalmente en desacuerdo", "De acuerdo"),
                       stringsAsFactors = FALSE)
  ch_may <- data.frame(list_name = "lst", name = c("1", "2"),
                       label = c("Totalmente en Desacuerdo", " De  acuerdo "),
                       stringsAsFactors = FALSE)
  inst <- function(ch) list(
    survey = data.frame(type = "select_one lst", name = "p1", label = "X",
                        stringsAsFactors = FALSE),
    choices = ch)

  expect_equal(.equiv_firma_escala(inst(ch_min), "p1"),
               .equiv_firma_escala(inst(ch_may), "p1"))

  # El CODIGO si se compara literal: ahi un 1 contra un 2 cambia lo que la barra
  # significa, y confundirlos seria el defecto que la firma existe para evitar.
  ch_otro <- ch_min
  ch_otro$name <- c("2", "1")
  expect_false(identical(.equiv_firma_escala(inst(ch_min), "p1"),
                         .equiv_firma_escala(inst(ch_otro), "p1")))
})

test_that("una propuesta sin confirmar no escribe etiquetas", {
  equiv <- list(bases = c("docentes"), filas = list(
    list(etiqueta_estandar = "Decidida", variables = list(docentes = "p13_1")),
    list(etiqueta_estandar = "Propuesta", variables = list(docentes = "p14_1"),
         sugerida = TRUE)))

  labels <- .equiv_variable_labels_por_base(equiv)

  # Se conserva en la declaracion —para eso viaja marcada— pero no actua: aplicar
  # su etiqueta seria tratar una sugerencia como una decision.
  expect_equal(labels$docentes[["p13_1"]], "Decidida")
  expect_null(labels$docentes[["p14_1"]])
})
