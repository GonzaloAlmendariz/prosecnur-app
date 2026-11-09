source("setup-load-all.R")

# ADR 0138 §5 (prueba con Arte, 2026-11-09): el contraste entre públicos con `bases` o `base$*` empareja por la
# equivalencia declarada, nunca por el nombre de la variable. Fixture con los nombres CRUZADOS, como Arte: la misma
# pregunta es `p6` en docentes y `p3` en estudiantes, y `p4` es una pregunta distinta en cada base.

.deq_rot <- list(docentes = c(p1 = "Conozco los reglamentos", p2 = "La biblioteca atiende", p3 = "Los cursos son actuales",
                              p4 = "Las competencias de salida son claras", p5 = "La tutoría orienta",
                              p6 = "Me atiende bien el personal administrativo"),
                 estudiantes = c(p1 = "Conozco los reglamentos", p2 = "La biblioteca atiende",
                                 p3 = "Me atiende bien el personal administrativo",
                                 p4 = "La Facultad fomenta la participación en el medio profesional", p5 = "La tutoría orienta",
                                 p6 = "Las evaluaciones docentes son útiles"))
.deq_inst <- function(rot) list(
  survey = data.frame(name = names(rot), type = "select_one lk", list_name = "lk", label = unname(rot), stringsAsFactors = FALSE),
  choices = data.frame(list_name = "lk", name = c("1", "2", "3", "4", "9"),
                       label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información"),
                       stringsAsFactors = FALSE),
  orders_list = NULL)
.deq_base <- function(n, ttb) {
  d <- as.data.frame(lapply(ttb, function(t) { k <- round(n * t); c(rep(c("3", "4"), length.out = k), rep(c("1", "2", "9"), length.out = n - k)) }),
                     stringsAsFactors = FALSE)
  names(d) <- paste0("p", seq_along(ttb)); d
}
.deq_fuentes <- function(equiv = NULL) {
  src <- list(data_sources = list(docentes = .deq_base(100, c(.80, .70, .60, .50, .40, .90)),
                                  estudiantes = .deq_base(200, c(.70, .50, .30, .95, .35, .20))),
              inst_sources = list(docentes = .deq_inst(.deq_rot$docentes), estudiantes = .deq_inst(.deq_rot$estudiantes)))
  src["equivalencias_publicos"] <- list(equiv)
  src
}
.deq_fila <- function(id, tema, d, e) list(id = id, etiqueta_estandar = tema, variables = list(docentes = d, estudiantes = e))
.deq_matriz <- function() list(filas = list(
  .deq_fila("f1", "Reglamentos", "p1", "p1"),
  .deq_fila("f2", "Atención administrativa", "p6", "p3"),           # nombres cruzados: la misma pregunta
  list(id = "f3", etiqueta_estandar = "Sugerida", variables = list(docentes = "p2", estudiantes = "p2"), sugerida = TRUE)))

test_that("con nombres cruzados el contraste compara la pregunta declarada, nunca la del mismo nombre", {
  src <- .deq_fuentes(.deq_matriz())
  r <- .regla_preguntas_conteo("p_dumbbell", list(bases = list("docentes", "estudiantes"), corte = list("3", "4"),
                                                  regla = list(tipo = "comunes")), src)
  expect_identical(r$total, 2L)
  expect_identical(unlist(r$seleccionadas), c("Reglamentos", "Atención administrativa"))
  # La fila declarada empareja p6 de docentes con p3 de estudiantes; p4 (distinta en cada base) no entra, ni la sugerida.
  el <- p_dumbbell(bases = c("docentes", "estudiantes"), corte = c("3", "4"))
  ind <- .regla_preguntas_indicadores(el, src, "comunes")
  expect_identical(ind$refs_por_tema$`Atención administrativa`, c("docentes$p6", "estudiantes$p3"))
  expect_false(any(grepl("p4", unlist(ind$refs_por_tema))))
  d <- .radar_mb_datos(list(A = c("docentes$p6", "estudiantes$p3")), "3,4", src)
  expect_equal(ind$indicadores$valor[ind$indicadores$tema == "Atención administrativa"], d$valor)
})

test_that("sin equivalencia declarada no hay comparación: el conteo lo dice y la lámina no compara", {
  for (equiv in list(NULL, list(filas = list()), list(filas = list(.deq_fila("x", "Sólo docentes", "p1", ""))))) {
    src <- .deq_fuentes(equiv)
    r <- .regla_preguntas_conteo("p_dumbbell", list(bases = list("docentes", "estudiantes"), corte = list("3", "4"),
                                                    regla = list(tipo = "mayor_diferencia", n = 3)), src)
    expect_identical(r$total, 0L)
    expect_length(r$seleccionadas, 0L)
    expect_identical(r$texto_regla, .DUMBBELL_MSG_SIN_EQUIV)
    expect_true(.DUMBBELL_MSG_SIN_EQUIV %in% unlist(r$avisos))
  }
  # Render: el lienzo dice por qué y no hay especificación de contraste (no se dibujan pares por nombre).
  src <- .deq_fuentes(NULL)
  withr::local_options(prosecnur.sig_informe = NULL)
  avisos <- character(0)
  plan <- p_plan(slides = list(p_slide_1_grafico(p_dumbbell(bases = c("docentes", "estudiantes"), corte = c("3", "4")), titulo = "Contraste")))
  out <- withCallingHandlers(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                                                solo_lista = TRUE, mensajes_progreso = FALSE)),
                             message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  expect_null(attr(out$rendered[[1]], "pulso_espec"))
  expect_true(any(grepl(.DUMBBELL_MSG_SIN_EQUIV, avisos, fixed = TRUE)))
})

test_that("el render lee la matriz del contexto del informe y empareja como el conteo", {
  src <- .deq_fuentes()
  src$equivalencias_publicos <- NULL
  withr::local_options(prosecnur.sig_informe = list(equivalencias_publicos = .deq_matriz()))
  plan <- p_plan(slides = list(p_slide_1_grafico(p_dumbbell(bases = c("docentes", "estudiantes"), corte = c("3", "4"), estilo = "resumen"),
                                                 titulo = "Contraste")))
  out <- suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                           solo_lista = TRUE, mensajes_progreso = FALSE))
  e <- attr(out$rendered[[1]], "pulso_espec")
  expect_setequal(e$rotulos, c("Reglamentos", "Atención administrativa"))
  # Docentes 90 frente a estudiantes 30 en la pregunta declarada (p6 y p3), no 60 frente a 30 (p3 y p3).
  k <- match("Atención administrativa", e$rotulos)
  expect_equal(unname(e$valores[k, ]), c(90, 30))
})

test_that("una fila declarada con escalas distintas entre públicos no se compara y se cuenta en los avisos", {
  src <- .deq_fuentes(.deq_matriz())
  src$inst_sources$estudiantes$choices$label[3] <- "Satisfecho"
  r <- .regla_preguntas_conteo("p_dumbbell", list(bases = list("docentes", "estudiantes"), corte = list("3", "4"),
                                                  regla = list(tipo = "comunes")), src)
  expect_true(any(grepl("escalas distintas entre públicos", unlist(r$avisos))))
  expect_identical(r$total, 0L)
  expect_identical(r$texto_regla, .DUMBBELL_MSG_SIN_COMPARABLES)
})

# P1 (2026-11-09): el panorama con `mayor_diferencia` emparejaba por nombre (`tema = variable`). Con los nombres de Arte:
# la misma pregunta es `p13_6` en docentes y `p12_3` en estudiantes, y `p24_1` es otra en cada base.
.deq_arte <- function(equiv) {
  src <- .deq_fuentes(equiv)
  ren <- list(docentes = c(p4 = "p24_1", p6 = "p13_6"), estudiantes = c(p3 = "p12_3", p4 = "p24_1"))
  for (b in names(ren)) {
    nm <- names(src$data_sources[[b]]); i <- match(names(ren[[b]]), nm); nm[i] <- ren[[b]]; names(src$data_sources[[b]]) <- nm
    sv <- src$inst_sources[[b]]$survey$name; sv[match(names(ren[[b]]), sv)] <- ren[[b]]; src$inst_sources[[b]]$survey$name <- sv
  }
  src
}
.deq_matriz_arte <- function() list(filas = list(
  .deq_fila("f1", "Reglamentos", "p1", "p1"),
  .deq_fila("f2", "Atención administrativa", "p13_6", "p12_3"),
  list(id = "f3", etiqueta_estandar = "Sugerida", variables = list(docentes = "p2", estudiantes = "p2"), sugerida = TRUE)))

test_that("panorama: mayor_diferencia compara la pregunta declarada, nunca la del mismo nombre", {
  src <- .deq_arte(.deq_matriz_arte())
  el <- p_panorama(vars = c("docentes$*", "estudiantes$*"), corte = c("3", "4"), regla = list(tipo = "mayor_diferencia", n = 3))
  r <- .regla_preguntas_de_elemento(el, src)
  # Universo: las dos filas confirmadas; p24_1 (otra pregunta en cada base) y la sugerida no se comparan.
  expect_identical(r$evaluacion$total, 2L)
  expect_identical(r$evaluacion$temas, c("Atención administrativa", "Reglamentos"))   # 90 − 30 = 60 frente a 80 − 70 = 10
  expect_false(any(grepl("p24_1", r$vars)))
  expect_identical(r$vars[1:2], c("docentes$p13_6", "estudiantes$p12_3"))
  expect_equal(unname(r$evaluacion$metrica["Atención administrativa"]), 60)
  expect_true(any(grepl("no tienen equivalencia declarada en los otros públicos", r$avisos, fixed = TRUE)))
  # El conteo (endpoint) dice lo mismo.
  k <- .regla_preguntas_conteo("p_panorama", list(vars = list("docentes$*", "estudiantes$*"), corte = list("3", "4"),
                                                  regla = list(tipo = "mayor_diferencia", n = 3)), src)
  expect_identical(unlist(k$seleccionadas), c("Atención administrativa", "Reglamentos"))
})

test_that("panorama sin equivalencia declarada: aviso, sin comparación, y la lámina lo dice", {
  for (equiv in list(NULL, list(filas = list(.deq_fila("x", "Sólo docentes", "p1", ""))))) {
    src <- .deq_arte(equiv)
    k <- .regla_preguntas_conteo("p_panorama", list(vars = list("docentes$*", "estudiantes$*"), corte = list("3", "4"),
                                                    regla = list(tipo = "mayor_diferencia", n = 3)), src)
    expect_identical(k$total, 0L)
    expect_length(k$seleccionadas, 0L)
    expect_identical(k$texto_regla, .DUMBBELL_MSG_SIN_EQUIV)
    expect_true(.DUMBBELL_MSG_SIN_EQUIV %in% unlist(k$avisos))
  }
  # Una regla de un público (bajo_umbral) no necesita matriz: sigue midiendo cada pregunta.
  k1 <- .regla_preguntas_conteo("p_panorama", list(vars = list("docentes$*", "estudiantes$*"), corte = list("3", "4"),
                                                   regla = list(tipo = "bajo_umbral", umbral = 50)), .deq_arte(NULL))
  expect_gt(k1$total, 0L)
  # Render: el lienzo dice por qué, sin especificación del panorama.
  src <- .deq_arte(NULL)
  withr::local_options(prosecnur.sig_informe = NULL)
  avisos <- character(0)
  plan <- p_plan(slides = list(p_slide_1_grafico(p_panorama(vars = c("docentes$*", "estudiantes$*"), corte = c("3", "4"),
                                                            regla = list(tipo = "mayor_diferencia", n = 3)), titulo = "Panorama")))
  out <- withCallingHandlers(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                                                solo_lista = TRUE, mensajes_progreso = FALSE)),
                             message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  expect_null(attr(out$rendered[[1]], "pulso_espec"))
  expect_true(any(grepl(.DUMBBELL_MSG_SIN_EQUIV, avisos, fixed = TRUE)))
})

# P1, decisión del lead (2026-11-09): un ajuste a mano guardado con nombres de variable en un panorama entre públicos se
# traduce a la fila de la matriz cuando es inequívoco; lo ambiguo o lo que no está, sale en el aviso.
test_that("panorama: agregar/quitar guardados con nombres de variable se traducen a su fila si son inequívocos", {
  m <- .deq_matriz_arte()
  m$filas[[4]] <- .deq_fila("f4", "Otra con p5", "p5", "p2")   # p5 sólo en f4; p2 de estudiantes en f4
  m$filas[[5]] <- .deq_fila("f5", "Otra con p2", "p2", "p5")   # p2 y p5 aparecen en dos filas: ambiguos pelados
  src <- .deq_arte(m)
  r0 <- .regla_preguntas_de_elemento(p_panorama(vars = c("docentes$*", "estudiantes$*"), corte = c("3", "4"),
                                                regla = list(tipo = "comunes")), src)
  expect_true(all(c("Atención administrativa", "Otra con p2") %in% r0$evaluacion$temas))
  el <- p_panorama(vars = c("docentes$*", "estudiantes$*"), corte = c("3", "4"),
                   regla = list(tipo = "comunes", quitar = c("p13_6", "docentes$p2", "p2", "p99")))
  r <- .regla_preguntas_de_elemento(el, src)
  # p13_6 (sólo en f2) se traduce a «Atención administrativa»; docentes$p2 (sólo en f5 para docentes) a «Otra con p2».
  expect_false("Atención administrativa" %in% r$evaluacion$temas)
  expect_false("Otra con p2" %in% r$evaluacion$temas)
  # p2 pelado está en dos filas (f4 y f5) y p99 en ninguna: quedan sin traducir y el aviso los nombra.
  aviso <- grep("del ajuste a mano no", r$avisos, value = TRUE)
  expect_length(aviso, 1L)
  expect_match(aviso, "p2, p99", fixed = TRUE)
  expect_false(grepl("p13_6", aviso, fixed = TRUE))
})
