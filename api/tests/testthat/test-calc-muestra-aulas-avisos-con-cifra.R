# Los avisos de umbral dicen SUS DOS CIFRAS: la medida y el umbral que la juzga.
#
# Tres de los avisos del objetivo de representatividad decian solo el hecho:
#
#   "La perdida por estudiantes repetidos supera la tolerancia configurada."
#   "CV de pesos critico; revisar probabilidades o postestratificacion."
#   "Profundidad de reservas menor al objetivo."
#
# Con eso no se decide nada. Quedarse a un pelo del umbral y quedarse a la mitad
# piden cosas distintas —una se tolera, la otra obliga a resortear— y el aviso
# las escribia igual. Sus vecinos del mismo bloque ya nombraban cifra y
# dimension ("Se redistribuyo peso de 2 dimension(es)...", "Balance fuera de
# tolerancia severa en: Facultad"), asi que la asimetria era del propio bloque.
#
# El de profundidad importa mas desde que el objetivo dejo de ser 1: ahora
# suena a menudo, y sin la cifra no dice si falto por poco o por mucho.
#
# TODO ESTE ARCHIVO LLAMA AL MOTOR. La primera version reimplementaba la rama de
# avisos en un helper local para no montar un objetivo entero, y dos mutantes
# —repetir el objetivo en vez de la medida, escribir la proporcion en vez del
# porcentaje— sobrevivieron: el test media su propia copia, no el codigo.

.avc_base <- function(n_aulas = 3L, por_aula = 4L) {
  n <- n_aulas * por_aula
  data.frame(
    student_id = sprintf("s%03d", seq_len(n)),
    aula_id = rep(sprintf("A%d", seq_len(n_aulas)), each = por_aula),
    curso = rep(sprintf("C%d", seq_len(n_aulas)), each = por_aula),
    horario = "H1",
    facultad = "FAC1",
    programa = "P1",
    sexo = rep(c("F", "M"), length.out = n),
    edad = 20,
    condicion = "regular",
    nivel = "1",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
}

.avc_frame <- function(...) calc_muestra_aulas_construir(
  base_madre = .avc_base(...),
  config = list(filters = list(min_eligible_per_class = 1L))
)

# Una seleccion con `titulares` titulares y el resto como reservas de cadena.
# `reserve_ratio` sale de ahi: reservas / titulares.
#
# Dos cosas que hay que darle o el motor no mide profundidad, y las dos se
# encontraron depurando en vez de suponiendo:
#
#  - `stratum`: `.cm_aulas_reserve_depth` mide POR ESTRATO y sin esa columna
#    devuelve vacio a proposito, asi que `has_reserve` queda FALSE.
#  - `wave`: la reserva se reconoce por `wave != "M1"`, no por `sample_role`.
#    Con todo en M1 no hay ninguna reserva que contar.
.avc_seleccion <- function(frame, titulares = 1L) {
  sel <- frame$aula_frame
  sel$stratum <- "FAC1 / F / G1"
  sel$wave <- c(rep("M1", titulares), rep("M2", nrow(sel) - titulares))
  sel$sample_role <- c(
    rep("titular", titulares),
    rep("chain_reserve", nrow(sel) - titulares)
  )
  sel$replacement_for <- c(
    rep(NA_character_, titulares),
    rep(sel$classroom_id[[1]], nrow(sel) - titulares)
  )
  sel
}

.avc_avisos <- function(objetivo = list(), titulares = 1L, n_aulas = 3L) {
  frame <- .avc_frame(n_aulas = n_aulas)
  rep <- calc_muestra_aulas_representativity_objective(
    frame,
    .avc_seleccion(frame, titulares),
    objective = objetivo
  )
  unlist(rep$warnings, use.names = FALSE)
}

.avc_de_reservas <- function(avisos) {
  hit <- avisos[grepl("Profundidad de reservas", avisos, fixed = TRUE)]
  if (!length(hit)) NA_character_ else hit[[1]]
}

test_that("el aviso de reservas dice cuantas hay y cuantas se pedian", {
  # 1 titular y 2 reservas => profundidad 2, contra un objetivo de 6.
  av <- .avc_de_reservas(.avc_avisos(objetivo = list(reserve_depth_target = 6)))
  expect_false(is.na(av))
  expect_true(grepl("2.00", av, fixed = TRUE))
  expect_true(grepl("6.00", av, fixed = TRUE))
  # Y no vuelve al texto ciego.
  expect_false(identical(av, "Profundidad de reservas menor al objetivo."))
})

test_that("la medida y el objetivo son cifras DISTINTAS en el texto", {
  # El mutante que sobrevivio a la primera version: escribir el objetivo dos
  # veces. Con 2 y 6 el texto tiene que traer las dos, no una repetida.
  av <- .avc_de_reservas(.avc_avisos(objetivo = list(reserve_depth_target = 6)))
  cifras <- regmatches(av, gregexpr("[0-9]+\\.[0-9]{2}", av))[[1]]
  expect_identical(cifras, c("2.00", "6.00"))
})

test_that("quedarse a un pelo y quedarse a la mitad se leen distinto", {
  # EL punto del cambio. Sin las cifras los dos casos producen el MISMO texto, y
  # uno se tolera mientras el otro obliga a resortear.
  #
  # 6 aulas con 1 titular dan profundidad 5; 3 aulas dan 2. Contra un objetivo
  # de 6, los dos avisan, pero no dicen lo mismo.
  apenas <- .avc_de_reservas(.avc_avisos(objetivo = list(reserve_depth_target = 6), n_aulas = 6L))
  lejos <- .avc_de_reservas(.avc_avisos(objetivo = list(reserve_depth_target = 6), n_aulas = 3L))
  expect_false(is.na(apenas))
  expect_false(is.na(lejos))
  expect_false(identical(apenas, lejos))
  expect_true(grepl("5.00", apenas, fixed = TRUE))
  expect_true(grepl("2.00", lejos, fixed = TRUE))
})

test_that("con la profundidad en el objetivo no se avisa", {
  # 3 aulas, 1 titular, 2 reservas: cumple un objetivo de 2.
  av <- .avc_avisos(objetivo = list(reserve_depth_target = 2))
  expect_true(is.na(.avc_de_reservas(av)))
})

test_that("el objetivo declarado manda sobre el de fabrica", {
  # Un estudio con objetivo 3 no puede leer su aviso contra otro numero.
  av <- .avc_de_reservas(.avc_avisos(objetivo = list(reserve_depth_target = 3)))
  expect_true(grepl("3.00", av, fixed = TRUE))
  expect_false(grepl("6.00", av, fixed = TRUE))
})

# --- Repetidos y CV, también por la ruta del motor ---------------------------
#
# M2. Estos dos quedaron primero fijados sólo contra la fuente —un grep de los
# literales— porque disparar sus umbrales pedía un fixture propio. Un grep no
# distingue una cifra bien pasada de una mal pasada: es exactamente el hueco por
# el que se colaron dos mutantes en la primera versión de este archivo.

# A1 y A2 comparten LOS MISMOS cuatro estudiantes, asi que seleccionar las dos
# expone 8 matriculas para 4 personas: eficiencia 0.5 y perdida por repetidos
# del 50%, muy por encima de la tolerancia de 15%. Los pesos dispares (1 y 120)
# llevan el CV por encima del critico.
.avc_base_repetidos <- function() data.frame(
  student_id = c(sprintf("s%02d", 1:4), sprintf("s%02d", 1:4), sprintf("s%02d", 5:8)),
  aula_id = rep(c("A1", "A2", "A3"), each = 4),
  curso = rep(c("C1", "C2", "C3"), each = 4),
  horario = "H1", facultad = "FAC1", programa = "P1",
  sexo = rep(c("F", "M"), 6), edad = 20, condicion = "regular",
  nivel = "1", modalidad = "presencial", stringsAsFactors = FALSE
)

.avc_avisos_umbral <- function(pesos = c(1, 120), objetivo = list(reserve_depth_target = 1)) {
  frame <- calc_muestra_aulas_construir(
    base_madre = .avc_base_repetidos(),
    config = list(filters = list(min_eligible_per_class = 1L))
  )
  sel <- frame$aula_frame[1:2, , drop = FALSE]
  sel$stratum <- "FAC1 / F / G1"
  sel$wave <- "M1"
  sel$sample_role <- "titular"
  sel$weight_classroom <- pesos
  rep <- calc_muestra_aulas_representativity_objective(frame, sel, objective = objetivo)
  unlist(rep$warnings, use.names = FALSE)
}

.avc_que_diga <- function(avisos, patron) {
  hit <- avisos[grepl(patron, avisos, fixed = TRUE)]
  if (!length(hit)) NA_character_ else hit[[1]]
}

test_that("el aviso de repetidos trae la perdida y la tolerancia, en porcentaje", {
  av <- .avc_que_diga(.avc_avisos_umbral(), "perdida por estudiantes repetidos")
  expect_false(is.na(av))
  # 4 personas en 8 matriculas: la mitad se pierde.
  expect_true(grepl("50.0%", av, fixed = TRUE))
  expect_true(grepl("15.0%", av, fixed = TRUE))
  # En PORCENTAJE, no en proporcion: `0.5` escrito como "0.5%" diria lo contrario
  # de lo que pasa. Es el mutante que sobrevivio a la primera version.
  expect_false(grepl("0.5%", av, fixed = TRUE))
  expect_false(grepl("0.1%", av, fixed = TRUE))
})

test_that("el aviso de CV trae el valor medido y el critico", {
  av <- .avc_que_diga(.avc_avisos_umbral(), "CV de pesos")
  expect_false(is.na(av))
  expect_true(grepl("1.39", av, fixed = TRUE))
  expect_true(grepl("1.00", av, fixed = TRUE))
  # Y las dos cifras son distintas: comparar el CV consigo mismo no avisa nada.
  cifras <- regmatches(av, gregexpr("[0-9]+\\.[0-9]{2}", av))[[1]]
  expect_identical(cifras, c("1.39", "1.00"))
  # Conserva la salida accionable que ya tenia.
  expect_true(grepl("postestratificacion", av, fixed = TRUE))
})

test_that("con pesos parejos no se avisa del CV", {
  # Las cifras no convierten en aviso lo que esta conforme.
  av <- .avc_avisos_umbral(pesos = c(10, 10))
  expect_true(is.na(.avc_que_diga(av, "CV de pesos")))
  # La perdida por repetidos sigue avisando: depende del solape, no de los pesos.
  expect_false(is.na(.avc_que_diga(av, "perdida por estudiantes repetidos")))
})

test_that("los tres textos ciegos ya no existen en el motor", {
  fuente <- readLines("../../R/calc_muestra_aulas.R", warn = FALSE)
  expect_false(any(grepl('"Profundidad de reservas menor al objetivo."', fuente, fixed = TRUE)))
  expect_false(any(grepl('"La perdida por estudiantes repetidos supera la tolerancia configurada."', fuente, fixed = TRUE)))
  expect_false(any(grepl('"CV de pesos critico; revisar probabilidades o postestratificacion."', fuente, fixed = TRUE)))
})
