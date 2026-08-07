source("setup-load-all.R")

# ADR 0062 — la equivalencia entre públicos se declara, no se adivina.
#
# Los casos reproducen la FORMA de las matrices reales, que es donde están las
# trampas: la sección vive en celdas combinadas (sólo la primera fila del bloque
# la trae), los códigos son los crudos de la plataforma (`q0013_0001`) y el
# archivo arrastra columnas de ayuda que no son datos.

# Forma del estudio medido: la misma pregunta con otro nombre en cada público.
.eqp_df_real <- function() {
  data.frame(
    `Sección` = c("1.2 Servicios", NA, NA, NA),
    Docentes = c("q0013_0001", "q0014_0001", "q0015_0001", NA),
    `Docentes_etiqueta` = c("Servicio de salud", "Servicio de salud", "Servicio de salud", NA),
    Estudiantes = c("q0011_0001", "q0012_0001", "q0013_0001", NA),
    Egresados = c("q0018_0001", "q0019_0001", NA, NA),
    `Etiqueta estandar` = c(
      "¿Conoce el Servicio de salud?",
      "¿Ha utilizado el Servicio de salud?",
      "¿Qué tan satisfecho se encuentra con el Servicio de salud?",
      NA
    ),
    Diapo = c(3, 4, 5, NA),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

test_that("normaliza códigos crudos de plataforma y rellena la sección hacia abajo", {
  equiv <- .equiv_desde_df(.eqp_df_real(), c("docentes", "estudiantes", "egresados"))

  # La cuarta fila del fixture no trae ninguna variable: es una separadora del
  # Excel, no un dato.
  expect_equal(equiv$n_filas, 3L)
  expect_equal(equiv$schema, "equivalencias_publicos/v1")

  primera <- equiv$filas[[1]]
  expect_equal(primera$variables$docentes, "p13_1")
  expect_equal(primera$variables$estudiantes, "p11_1")
  expect_equal(primera$variables$egresados, "p18_1")
  expect_equal(primera$etiqueta_estandar, "¿Conoce el Servicio de salud?")
  expect_equal(primera$cantidad, 3L)

  # La sección vive en celdas combinadas: sin el relleno hacia abajo, las filas
  # 2 y 3 quedarían sin ella (141 de 154 en la matriz real).
  expect_equal(vapply(equiv$filas, function(f) f$seccion, character(1)),
               rep("1.2 Servicios", 3))

  # `cantidad` se deriva, no se pide: la tercera fila sólo existe en dos bases.
  expect_equal(equiv$filas[[3]]$cantidad, 2L)
})

test_that("el mismo mapeo sale de códigos crudos o canónicos", {
  df <- .eqp_df_real()
  crudo <- .equiv_desde_df(df, c("docentes", "estudiantes", "egresados"))

  df$Docentes <- c("p13_1", "p14_1", "p15_1", NA)
  df$Estudiantes <- c("p11_1", "p12_1", "p13_1", NA)
  df$Egresados <- c("p18_1", "p19_1", NA, NA)
  canonico <- .equiv_desde_df(df, c("docentes", "estudiantes", "egresados"))

  expect_equal(
    lapply(crudo$filas, function(f) f$variables),
    lapply(canonico$filas, function(f) f$variables)
  )
})

test_that("las columnas de ayuda del Excel se ignoran sin limpiarlo a mano", {
  equiv <- .equiv_desde_df(.eqp_df_real(), c("docentes", "estudiantes", "egresados"))
  # `Diapo` y `Docentes_etiqueta` no son bases ni entran a la declaración.
  for (fila in equiv$filas) {
    expect_setequal(names(fila$variables),
                    intersect(c("docentes", "estudiantes", "egresados"), names(fila$variables)))
  }
})

test_that("las etiquetas aterrizan por base y cada una en SU variable", {
  equiv <- .equiv_desde_df(.eqp_df_real(), c("docentes", "estudiantes", "egresados"))
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
  df <- .eqp_df_real()
  df[["Etiqueta estandar"]][2] <- NA
  labels <- .equiv_variable_labels_por_base(
    .equiv_desde_df(df, c("docentes", "estudiantes")))
  expect_null(labels$docentes[["p14_1"]])
  expect_equal(labels$docentes[["p13_1"]], "¿Conoce el Servicio de salud?")
})

test_that("la matriz sin columnas del estudio corta con un error explícito", {
  df <- .eqp_df_real()
  expect_error(
    .equiv_desde_df(df, c("hogares", "empresas")),
    class = "api_error"
  )
  sin_etiqueta <- df[, setdiff(names(df), "Etiqueta estandar"), drop = FALSE]
  expect_error(
    .equiv_desde_df(sin_etiqueta, c("docentes")),
    class = "api_error"
  )
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
  equiv <- .equiv_desde_df(.eqp_df_real(), c("docentes"))
  inst <- list(survey = data.frame(
    type = c("select_one lst", "select_one lst"),
    name = c("p13_1", "p14_1"), stringsAsFactors = FALSE))

  cob <- .equiv_cobertura(equiv, list(docentes = inst))
  expect_equal(cob$docentes$n_declaradas, 3L)
  expect_equal(cob$docentes$n_calzan, 2L)
  # Se reporta en vez de fallar: la matriz sigue sirviendo para sus otras filas.
  expect_equal(cob$docentes$huerfanas, "p15_1")
})

# --- Plantilla ---------------------------------------------------------------

.eqp_inst <- function(nombres, etiquetas, seccion = "Pag1") {
  list(survey = data.frame(
    type = rep("select_one lst", length(nombres)),
    name = nombres, label = etiquetas, section = seccion,
    stringsAsFactors = FALSE))
}

test_that("la plantilla sale poblada con las variables y etiquetas de cada base", {
  inst <- list(
    docentes = .eqp_inst(c("p13_1", "p14_1"), c("Servicio de salud", "Servicio de salud")),
    estudiantes = .eqp_inst(c("p11_1"), c("Servicio de salud"))
  )
  df <- .equiv_plantilla_df(inst)

  # El nucleo primero: seccion, etiqueta estandar y una columna por publico.
  # Detras las dos del plan del informe, opcionales al leer. Las columnas de
  # ayuda por base ya no estan: salieron a la hoja de consulta, donde dan la
  # misma ayuda sin doblar el ancho de la hoja donde se escribe.
  expect_equal(names(df), c("seccion", "etiqueta_estandar", "docentes", "estudiantes",
                            "diapositiva", "enunciado", "grafico", "corte", "estilo"))
  # Sin nada declarado, la plantilla sale SIN filas. Antes volcaba una por cada
  # variable de cada base —300 en el estudio medido—, cada una con su codigo en
  # una sola columna: una escalera diagonal que habia que cortar y pegar para
  # emparejar, y que enterraba lo que si hay que decidir.
  expect_equal(nrow(df), 0L)
})

test_that("reabrir la plantilla conserva lo ya declarado y sólo añade lo pendiente", {
  inst <- list(
    docentes = .eqp_inst(c("p13_1", "p14_1"), c("Servicio de salud", "Otra")),
    estudiantes = .eqp_inst(c("p11_1", "p12_1"), c("Servicio de salud", "Otra"))
  )
  equiv <- list(bases = c("docentes", "estudiantes"), filas = list(list(
    seccion = "Servicios", etiqueta_estandar = "¿Conoce el Servicio de salud?",
    variables = list(docentes = "p13_1", estudiantes = "p11_1"), cantidad = 2L)))

  df <- .equiv_plantilla_df(inst, equiv)

  # La fila ya emparejada sale primero y entera: reabrir no puede desordenar ni
  # obligar a rehacer el trabajo.
  expect_equal(df$etiqueta_estandar[1], "¿Conoce el Servicio de salud?")
  expect_equal(df$docentes[1], "p13_1")
  expect_equal(df$estudiantes[1], "p11_1")

  # Y nada mas: lo que el estudio no declara no ocupa una fila.
  expect_equal(nrow(df), 1L)
})

test_that("la plantilla vuelve a entrar por el importador sin perder nada", {
  inst <- list(
    docentes = .eqp_inst(c("p13_1"), c("Servicio de salud")),
    estudiantes = .eqp_inst(c("p11_1"), c("Servicio de salud"))
  )
  equiv <- list(bases = c("docentes", "estudiantes"), filas = list(list(
    seccion = "Servicios", etiqueta_estandar = "¿Conoce el Servicio de salud?",
    variables = list(docentes = "p13_1", estudiantes = "p11_1"), cantidad = 2L)))

  # Ida y vuelta: generar -> importar -> misma declaración. Es lo que impide que
  # el formato que la app emite y el que acepta se separen.
  df <- .equiv_plantilla_df(inst, equiv)
  vuelta <- .equiv_desde_df(df, c("docentes", "estudiantes"))

  expect_equal(vuelta$filas[[1]]$variables$docentes, "p13_1")
  expect_equal(vuelta$filas[[1]]$variables$estudiantes, "p11_1")
  expect_equal(vuelta$filas[[1]]$etiqueta_estandar, "¿Conoce el Servicio de salud?")
  expect_equal(vuelta$filas[[1]]$seccion, "Servicios")
})

test_that("una plantilla sin filas se rechaza con un error explicito", {
  # La plantilla de un estudio que no declara nada sale con encabezados y sin
  # filas. Subirla tal cual no declara nada, y decirlo es mejor que aceptar una
  # declaracion vacia que borraria la anterior en silencio.
  inst <- list(docentes = .eqp_inst(c("p13_1"), c("Servicio de salud")))
  expect_error(.equiv_desde_df(.equiv_plantilla_df(inst), "docentes"),
               class = "api_error")
})

# --- Diapositiva y sugerencias (enmienda del editor, ADR 0062) ---------------

test_that("lee la columna de diapositiva y acepta el nombre corto de las matrices reales", {
  df <- .eqp_df_real()
  df$Diapo <- c(3, 3, 5, NA)  # el nombre que usan las matrices ya escritas
  equiv <- .equiv_desde_df(df, c("docentes", "estudiantes"))
  expect_equal(equiv$filas[[1]]$diapositiva, "3")
  expect_equal(equiv$filas[[2]]$diapositiva, "3")
  expect_equal(equiv$filas[[3]]$diapositiva, "5")
})

test_that("la sugerencia separa baterías que comparten etiqueta y escala", {
  # El caso real: «Servicio de salud» con escala Sí/No aparece DOS veces por
  # base —¿Conoce? y ¿Ha utilizado?— y sólo el orden las distingue. Sin el
  # ordinal, la sugerencia mezclaría las dos.
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

  sug <- .equiv_sugerir(inst)
  empareja <- function(varDoc) {
    hit <- Filter(function(f) identical(f$variables$docentes, varDoc), sug)
    if (!length(hit)) NULL else hit[[1]]$variables$estudiantes
  }
  # La 1.ª Sí/No con la 1.ª, la 2.ª con la 2.ª, y la escala distinta aparte.
  expect_equal(empareja("p13_1"), "p11_1")
  expect_equal(empareja("p14_1"), "p12_1")
  expect_equal(empareja("p15_1"), "p13_1")

  # Y viajan marcadas: sin la marca, una propuesta se ve igual que una decisión.
  expect_true(all(vapply(sug, function(f) isTRUE(f$sugerida), logical(1))))
})

test_that("no propone lo que existe en una sola base", {
  inst <- list(
    docentes = list(survey = data.frame(
      type = "select_one lst", name = "p1", label = "Solo docentes",
      section = "Pag1", stringsAsFactors = FALSE),
      choices = data.frame(list_name = "lst", name = "1", label = "Sí", stringsAsFactors = FALSE)),
    estudiantes = list(survey = data.frame(
      type = "select_one lst", name = "p9", label = "Solo estudiantes",
      section = "Pag1", stringsAsFactors = FALSE),
      choices = data.frame(list_name = "lst", name = "1", label = "Sí", stringsAsFactors = FALSE))
  )
  # Ofrecer una fila de una sola base como «propuesta» invitaría a confirmarla
  # sin mirar; no es una equivalencia, es una decisión pendiente.
  expect_equal(length(.equiv_sugerir(inst)), 0L)
})

test_that("una etiqueta ambigua no se prellena", {
  # Las tres baterías de servicios producen tres filas correctas, pero las tres
  # se llaman «Servicio de salud» en el XLSForm. Prellenar ese texto reproduce
  # la ambigüedad que el ADR existe para eliminar, y encima invita a
  # confirmarla de un clic.
  inst <- list(
    docentes = list(survey = data.frame(
      type = c("select_one si_no", "select_one si_no", "select_one otra"),
      name = c("p13_1", "p14_1", "p15_1"),
      label = c("Servicio de salud", "Servicio de salud", "Otra pregunta"),
      section = "Pag1", stringsAsFactors = FALSE),
      choices = data.frame(
        list_name = c("si_no", "si_no", "otra", "otra"),
        name = c("1", "2", "1", "2"),
        label = c("Sí", "No", "A", "B"), stringsAsFactors = FALSE)),
    estudiantes = list(survey = data.frame(
      type = c("select_one si_no", "select_one si_no", "select_one otra"),
      name = c("p11_1", "p12_1", "p13_1"),
      label = c("Servicio de salud", "Servicio de salud", "Otra pregunta"),
      section = "Pag1", stringsAsFactors = FALSE),
      choices = data.frame(
        list_name = c("si_no", "si_no", "otra", "otra"),
        name = c("1", "2", "1", "2"),
        label = c("Sí", "No", "A", "B"), stringsAsFactors = FALSE))
  )

  sug <- .equiv_sugerir(inst)
  ambiguas <- Filter(function(f) identical(f$variables$docentes, "p13_1")
                       || identical(f$variables$docentes, "p14_1"), sug)
  expect_equal(length(ambiguas), 2L)
  # Las dos que comparten etiqueta llegan con el campo vacío...
  expect_true(all(vapply(ambiguas, function(f) !nzchar(f$etiqueta_estandar), logical(1))))
  # ...y el emparejado sigue siendo correcto: lo que se omite es el texto, no la
  # equivalencia.
  expect_setequal(
    vapply(ambiguas, function(f) f$variables$estudiantes, character(1)),
    c("p11_1", "p12_1")
  )
  # La que no es ambigua sí conserva su etiqueta.
  unica <- Filter(function(f) identical(f$variables$docentes, "p15_1"), sug)[[1]]
  expect_equal(unica$etiqueta_estandar, "Otra pregunta")
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

# --- ADR 0064: el enunciado y la lectura de la matriz real --------------------

test_that("la matriz real entra aunque readxl desambigue los encabezados repetidos", {
  # Las matrices del equipo titulan DOS bloques con el nombre del publico —el de
  # variables y el de ayuda «Variable labels»—, asi que readxl entrega
  # `Docentes...2` y `Docentes...12`. Sin retirar ese sufijo, NINGUNA columna
  # normalizaba a «docentes» y la matriz de 152 filas rebotaba entera con
  # E_EQUIV_SIN_COLUMNAS_BASE.
  df <- data.frame(
    "Sección" = c("1.2 Servicios", NA),
    "Docentes...2" = c("q0013_0001", "q0013_0002"),
    "...3" = c("¿Conoce salud?", "¿Conoce psicología?"),
    "Etiqueta estandar" = c("Servicio de salud", "Bienestar psicológico"),
    "Diapo" = c(3, 3),
    "Docentes...12" = c("q0013_0001 '¿Conoce salud?'", "q0013_0002 '¿Conoce psicología?'"),
    check.names = FALSE, stringsAsFactors = FALSE
  )

  equiv <- .equiv_desde_df(df, c("docentes"))

  expect_equal(equiv$n_filas, 2L)
  # De las dos columnas «Docentes» se elige la de VARIABLES por su contenido: un
  # nombre de variable no lleva espacios y la de ayuda si. Elegir por posicion
  # seria un supuesto sobre como alguien ordeno su Excel.
  expect_equal(equiv$filas[[1]]$variables$docentes, "p13_1")
  expect_equal(equiv$filas[[2]]$variables$docentes, "p13_2")
  expect_equal(equiv$filas[[1]]$diapositiva, "3")
  # La seccion vive en celdas combinadas y se rellena hacia abajo.
  expect_equal(equiv$filas[[2]]$seccion, "1.2 Servicios")
})

test_that("el enunciado se lee de la matriz y se rellena hacia abajo", {
  df <- data.frame(
    seccion = c("1.2 Servicios", NA),
    enunciado = c("¿Conoce los siguientes servicios?", NA),
    etiqueta_estandar = c("Servicio de salud", "Bienestar psicológico"),
    diapositiva = c("3", "3"),
    docentes = c("p13_1", "p13_2"),
    stringsAsFactors = FALSE
  )

  equiv <- .equiv_desde_df(df, c("docentes"))

  # El enunciado es un atributo de la DIAPOSITIVA escrito una vez sobre su bloque; sin
  # el relleno hacia abajo, la segunda fila lo perderia y la diapositiva diria dos
  # cosas segun que fila se leyera primero.
  expect_equal(equiv$filas[[1]]$enunciado, "¿Conoce los siguientes servicios?")
  expect_equal(equiv$filas[[2]]$enunciado, "¿Conoce los siguientes servicios?")
})

test_that("cambiar el enunciado mueve la revision de la declaracion", {
  base_filas <- list(list(
    seccion = "", etiqueta_estandar = "Salud", diapositiva = "3",
    enunciado = "", variables = list(docentes = "p13_1"), cantidad = 1L))
  con_enunciado <- base_filas
  con_enunciado[[1]]$enunciado <- "¿Conoce los siguientes servicios?"

  # El enunciado titula la diapositiva (ADR 0064), asi que cambiarlo cambia el mazo:
  # si no moviera la revision, Graficos no podria avisar del desfase.
  expect_false(identical(
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

# --- ADR 0064: la plantilla sembrada y el efecto de una propuesta -------------

test_that("la plantilla no se siembra: en seis columnas una propuesta no se distingue", {
  inst <- list(
    docentes = .eqp_inst(c("p13_1", "p14_1"), c("Servicio de salud", "Servicio de salud")),
    estudiantes = .eqp_inst(c("p11_1", "p12_1"), c("Servicio de salud", "Servicio de salud"))
  )
  df <- .equiv_plantilla_df(inst)

  # El motor SABE emparejarlas —lo hace en el editor— pero en estas columnas no hay
  # donde marcar que eso es una propuesta, y volveria como decision al importarla.
  expect_equal(nrow(df), 0L)
  expect_false("origen" %in% names(df))
})

test_that("las columnas del plan van al final y son opcionales al leer", {
  inst <- list(docentes = .eqp_inst(c("p13_1"), c("Salud")))

  # Se emiten SIEMPRE y detras del nucleo: emitirlas solo cuando ya tienen datos
  # dejaba al analista sin la columna justo cuando quiere empezar a repartir
  # diapositivas desde el Excel.
  df <- .equiv_plantilla_df(inst)
  expect_equal(names(df), c("seccion", "etiqueta_estandar", "docentes",
                            "diapositiva", "enunciado", "grafico", "corte", "estilo"))

  # Y un archivo que no las trae importa igual: son opcionales.
  minima <- data.frame(seccion = "1.2 Servicios", etiqueta_estandar = "Salud",
                       docentes = "p13_1", stringsAsFactors = FALSE)
  equiv <- .equiv_desde_df(minima, c("docentes"))
  expect_equal(equiv$n_filas, 1L)
  expect_equal(equiv$filas[[1]]$diapositiva, "")
  expect_equal(equiv$filas[[1]]$enunciado, "")

  # Lo declarado en ellas sobrevive a reexportar.
  con_plan <- list(filas = list(list(
    seccion = "", etiqueta_estandar = "Salud", diapositiva = "3",
    enunciado = "¿Conoce los siguientes servicios?",
    variables = list(docentes = "p13_1"), cantidad = 1L)))
  df2 <- .equiv_plantilla_df(inst, equiv = con_plan)
  expect_equal(df2$diapositiva[1], "3")
  expect_equal(df2$enunciado[1], "¿Conoce los siguientes servicios?")
})

test_that("el catalogo de variables sale aparte, no en la hoja de trabajo", {
  inst <- list(
    docentes = .eqp_inst(c("p13_1", "p14_1"), c("Salud", "Bienestar")),
    estudiantes = .eqp_inst(c("p11_1"), c("Salud"))
  )
  cat <- .equiv_catalogo_df(inst)

  expect_equal(names(cat), c("base", "variable", "etiqueta"))
  expect_equal(nrow(cat), 3L)
  expect_equal(cat$etiqueta[cat$variable == "p14_1"], "Bienestar")
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

test_that("el grafico y el corte no se arrastran a la diapositiva siguiente", {
  # Medido: declarar radar en un bloque de 6 filas y reimportar devolvia 47 filas
  # con radar, porque el relleno hacia abajo seguia cayendo hasta el final de la
  # hoja. `enunciado`, `grafico` y `corte` son atributos de SU diapositiva.
  df <- data.frame(
    seccion = c("3.2 Perfil", NA, NA, NA),
    diapositiva = c("29", "29", "30", "30"),
    enunciado = c("¿Qué tan de acuerdo?", NA, NA, NA),
    grafico = c("radar", NA, NA, NA),
    corte = c("3,4", NA, NA, NA),
    etiqueta_estandar = c("A", "B", "C", "D"),
    docentes = c("p30_1", "p30_2", "p31_1", "p31_2"),
    stringsAsFactors = FALSE
  )

  equiv <- .equiv_desde_df(df, c("docentes"))
  g <- vapply(equiv$filas, function(f) as.character(f$grafico %||% ""), character(1))
  e <- vapply(equiv$filas, function(f) as.character(f$enunciado %||% ""), character(1))

  expect_equal(g, c("radar", "radar", "", ""))
  expect_equal(e, c("¿Qué tan de acuerdo?", "¿Qué tan de acuerdo?", "", ""))

  # La seccion SI cruza la frontera: una seccion abarca varias diapositivas.
  expect_equal(vapply(equiv$filas, function(f) f$seccion, character(1)),
               rep("3.2 Perfil", 4))
})
