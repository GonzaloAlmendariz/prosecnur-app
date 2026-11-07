source("setup-load-all.R")

# ADR 0135: las láminas de resumen eligen sus preguntas con una regla. Una función pura (`.regla_preguntas_evaluar`)
# elige, mide y redacta la nota; la usan el render, la lámina nativa y el endpoint de conteo.

.rp_ind <- function() {
  # Diferencias |doc − est| sobre cifras redondeadas: a 20, b 1, c 20, d 30. Sin información: c la mayor.
  data.frame(tema = rep(c("a", "b", "c", "d"), each = 2), etiqueta = rep(c("A", "B", "C", "D"), each = 2),
             grupo = rep(c("doc", "est"), 4), valor = c(50, 70, 80, 81, 40, 60, 90, 60),
             sin_info = c(5, 3, 0, 0, 12, 1, 2, 2), n = 10, orden = rep(1:4, each = 2), stringsAsFactors = FALSE)
}
.rp_codigo <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)

# ---- Normalización -----------------------------------------------------------

test_that("sin regla (NULL o sin tipo) el contrato viejo queda intacto", {
  expect_null(.regla_preguntas_normalizar(NULL))
  expect_null(.regla_preguntas_normalizar(list()))
  expect_null(.regla_preguntas_normalizar(list(tipo = "")))
  expect_null(p_panorama(vars = "b$*", corte = c("4", "5"))$regla)
  expect_null(p_dumbbell(vars = list(T = c("a$p", "b$p")), corte = "4")$regla)
  expect_null(p_barras_divergentes(vars = "a$p")$regla)
  expect_null(p_barras_divergentes(vars = "a$p")$overrides$estilo)
})

test_that("una regla inválida responde E_REGLA_PREGUNTAS_INVALIDA", {
  expect_identical(.rp_codigo(.regla_preguntas_normalizar(list(tipo = "las_mejores"))), "E_REGLA_PREGUNTAS_INVALIDA")
  expect_identical(.rp_codigo(.regla_preguntas_normalizar(list(tipo = "mayor_diferencia"))), "E_REGLA_PREGUNTAS_INVALIDA")
  expect_identical(.rp_codigo(.regla_preguntas_normalizar(list(tipo = "extremos", n = 2.5))), "E_REGLA_PREGUNTAS_INVALIDA")
  expect_identical(.rp_codigo(.regla_preguntas_normalizar(list(tipo = "bajo_umbral", umbral = 150))), "E_REGLA_PREGUNTAS_INVALIDA")
  expect_identical(.rp_codigo(.regla_preguntas_normalizar(list(tipo = "a_mano"))), "E_REGLA_PREGUNTAS_INVALIDA")
  expect_identical(.rp_codigo(.regla_preguntas_normalizar("todas")), "E_REGLA_PREGUNTAS_INVALIDA")
  # Comparar grupos con uno solo no tiene sentido.
  uno <- .rp_ind()[.rp_ind()$grupo == "doc", ]
  expect_identical(.rp_codigo(.regla_preguntas_evaluar(uno, list(tipo = "mayor_diferencia", n = 2))), "E_REGLA_PREGUNTAS_INVALIDA")
  # El registro la conoce.
  expect_true("E_REGLA_PREGUNTAS_INVALIDA" %in% errores_registrados()$codigo)
})

test_that("la regla llega como la manda el JSON (listas, fila rectangularizada) y se normaliza", {
  r <- .regla_preguntas_normalizar(list(tipo = "mayor_diferencia", n = 13L, agregar = list("x", "y"), quitar = list()))
  expect_identical(r$tipo, "mayor_diferencia"); expect_identical(r$n, 13L)
  expect_identical(r$agregar, c("x", "y")); expect_identical(r$quitar, character(0)); expect_null(r$umbral)
  fila <- data.frame(tipo = "bajo_umbral", umbral = 60, stringsAsFactors = FALSE)
  fila$agregar <- list(c("p1"))
  r2 <- .regla_preguntas_normalizar(fila)
  expect_identical(r2$umbral, 60); expect_identical(r2$agregar, "p1"); expect_null(r2$n)
})

# ---- Evaluación, tipo por tipo -----------------------------------------------

test_that("cada tipo elige sus preguntas y redacta su nota", {
  ev <- function(r) .regla_preguntas_evaluar(.rp_ind(), r)
  e <- ev(NULL)
  expect_identical(e$temas, c("a", "b", "c", "d")); expect_identical(e$total, 4L)
  expect_identical(e$texto, "Se muestran las 4 preguntas de escala.")
  e <- ev(list(tipo = "todas"))
  expect_identical(e$texto, "Se muestran las 4 preguntas de escala.")
  e <- ev(list(tipo = "comunes"))
  expect_identical(e$temas, c("a", "b", "c", "d"))
  expect_identical(e$texto, "Se muestran las 4 preguntas comunes a los dos públicos.")
  e <- ev(list(tipo = "mayor_diferencia", n = 2))
  expect_identical(e$temas, c("d", "a"))   # 30, y a y c empatan en 20: gana el orden del instrumento
  expect_identical(e$texto, "Se muestran las 2 de mayor diferencia, de 4 preguntas comunes.")
  expect_equal(unname(e$metrica[c("a", "b", "c", "d")]), c(20, 1, 20, 30))
  e <- ev(list(tipo = "diferencia_minima", umbral = 20))
  expect_identical(e$temas, c("d", "a", "c"))
  expect_identical(e$texto, "Se muestran las 3 con diferencia de al menos 20 puntos, de 4 preguntas comunes.")
  e <- ev(list(tipo = "mayor_sin_info", n = 2))
  expect_identical(e$temas, c("c", "a"))
  expect_identical(e$texto, "Se muestran las 2 con más Sin información, de 4 preguntas de escala.")
  e <- ev(list(tipo = "bajo_umbral", umbral = 60))
  expect_identical(e$temas, c("c", "a"))   # 40 (c) y 50 (a) en doc; de la más baja a la más alta
  expect_identical(e$texto, "Se muestran las 2 bajo 60%, de 4 preguntas de escala.")
  e <- ev(list(tipo = "extremos", n = 1))
  expect_identical(e$temas, c("b", "c"))   # medias: b 80.5 la más alta, c 50 la más baja
  expect_identical(e$texto, "Se muestran la más alta y la más baja, de 4 preguntas de escala.")
  e <- ev(list(tipo = "a_mano", agregar = c("d", "b")))
  expect_identical(e$temas, c("d", "b"))
  expect_identical(e$texto, "Se muestran 2 preguntas elegidas, de 4 preguntas de escala.")
  # Las candidatas van en el orden del instrumento y marcan las elegidas.
  expect_identical(e$candidatas$tema, c("a", "b", "c", "d"))
  expect_identical(e$candidatas$seleccionada, c(FALSE, TRUE, FALSE, TRUE))
})

test_that("extremos con un grupo: las n más altas y las n más bajas, sin repetir", {
  ind <- data.frame(tema = letters[1:7], grupo = "doc", valor = c(10, 90, 50, 70, 30, 80, 20), orden = 1:7)
  e <- .regla_preguntas_evaluar(ind, list(tipo = "extremos", n = 2))
  expect_identical(e$temas, c("b", "f", "g", "a"))
  expect_identical(e$texto, "Se muestran las 2 más altas y las 2 más bajas, de 7 preguntas de escala.")
  e5 <- .regla_preguntas_evaluar(ind, list(tipo = "extremos", n = 5))
  expect_length(e5$temas, 7L); expect_false(anyDuplicated(e5$temas) > 0)
})

test_that("el desempate es determinista: primero la métrica, después el orden del instrumento", {
  ind <- data.frame(tema = c("z", "y", "x"), grupo = "doc", valor = c(40, 40, 40), sin_info = c(5, 5, 9), orden = c(3, 1, 2))
  expect_identical(.regla_preguntas_evaluar(ind, list(tipo = "mayor_sin_info", n = 2))$temas, c("x", "y"))
  expect_identical(.regla_preguntas_evaluar(ind, list(tipo = "bajo_umbral", umbral = 50))$temas, c("y", "x", "z"))
  # Mismo resultado aunque las filas lleguen en otro orden.
  expect_identical(.regla_preguntas_evaluar(ind[3:1, ], list(tipo = "bajo_umbral", umbral = 50))$temas, c("y", "x", "z"))
})

test_that("la diferencia es la de la lámina: sobre cifras redondeadas, y con tres grupos el mayor menos el menor", {
  ind <- data.frame(tema = c("a", "a"), grupo = c("doc", "est"), valor = c(50.4, 49.6), orden = 1)
  expect_equal(unname(.regla_preguntas_evaluar(ind, list(tipo = "diferencia_minima", umbral = 0))$metrica), 0)
  d <- data.frame(eje = "a", grupo = factor(c("doc", "est"), levels = c("doc", "est")), valor = c(50.4, 49.6), n_casos = 10)
  expect_identical(.espec_contraste(d)$textos_diferencia, "0")
  tres <- data.frame(tema = rep(c("p", "q", "r"), each = 3), grupo = rep(c("doc", "est", "adm"), 3),
                     valor = c(50, 70, 60, 10, 20, NA, 30, 30, 90), orden = rep(1:3, each = 3))
  e <- .regla_preguntas_evaluar(tres, list(tipo = "mayor_diferencia", n = 5))
  expect_identical(e$temas, c("r", "p"))   # q no tiene valor en adm: no es común
  expect_identical(e$total, 2L)
  expect_equal(unname(e$metrica[c("p", "r")]), c(20, 60))
  expect_identical(.regla_preguntas_evaluar(tres, list(tipo = "comunes"))$texto,
                   "Se muestran las 2 preguntas comunes a los tres públicos.")
  # La misma definición que contraste/1.
  R <- matrix(c(50, 30, 70, 30, 60, 90), 2)
  expect_equal(.contraste_diferencia(R), c(20, 60))
  expect_equal(.contraste_diferencia(matrix(c(50, 30, 70, 20), 2)), c(-20, 10))
})

test_that("agregar y quitar se aplican después de la regla y la nota lo dice", {
  e <- .regla_preguntas_evaluar(.rp_ind(), list(tipo = "mayor_diferencia", n = 2, agregar = "b", quitar = "a"))
  expect_identical(e$temas, c("d", "b"))
  expect_identical(e$texto, "Se muestran las 2 de mayor diferencia, de 4 preguntas comunes. Lista ajustada a mano.")
  # Un ajuste que no cambia nada no se anuncia; uno desconocido se avisa.
  e2 <- .regla_preguntas_evaluar(.rp_ind(), list(tipo = "mayor_diferencia", n = 2, agregar = "d", quitar = "zz"))
  expect_identical(e2$texto, "Se muestran las 2 de mayor diferencia, de 4 preguntas comunes.")
  expect_match(e2$avisos, "zz")
  e3 <- .regla_preguntas_evaluar(.rp_ind(), list(tipo = "a_mano", agregar = c("a", "c"), quitar = "c"))
  expect_identical(e3$temas, "a")
  expect_identical(e3$texto, "Se muestra 1 pregunta elegida, de 4 preguntas de escala. Lista ajustada a mano.")
})

test_that("los singulares se escriben bien", {
  uno <- data.frame(tema = "a", grupo = c("doc", "est"), valor = c(50, 70), sin_info = c(3, 0), orden = 1)
  expect_identical(.regla_preguntas_evaluar(uno, NULL)$texto, "Se muestra 1 pregunta de escala.")
  expect_identical(.regla_preguntas_evaluar(uno, list(tipo = "comunes"))$texto, "Se muestra 1 pregunta común a los dos públicos.")
  expect_identical(.regla_preguntas_evaluar(uno, list(tipo = "mayor_diferencia", n = 3))$texto,
                   "Se muestra la de mayor diferencia, de 1 pregunta común.")
  expect_identical(.regla_preguntas_evaluar(uno, list(tipo = "diferencia_minima", umbral = 1))$texto,
                   "Se muestra 1 con diferencia de al menos 1 punto, de 1 pregunta común.")
  expect_identical(.regla_preguntas_evaluar(uno, list(tipo = "diferencia_minima", umbral = 30))$texto,
                   "Ninguna con diferencia de al menos 30 puntos, de 1 pregunta común.")
  expect_identical(.regla_preguntas_evaluar(uno, list(tipo = "mayor_sin_info", n = 4))$texto,
                   "Se muestra la de más Sin información, de 1 pregunta de escala.")
  expect_identical(.regla_preguntas_evaluar(uno, list(tipo = "bajo_umbral", umbral = 60))$texto,
                   "Se muestra 1 bajo 60%, de 1 pregunta de escala.")
  # Cifras con el formato del motor.
  muchas <- data.frame(tema = sprintf("p%04d", 1:1200), grupo = "doc", valor = 50, orden = 1:1200)
  expect_identical(.regla_preguntas_evaluar(muchas, NULL)$texto, "Se muestran las 1,200 preguntas de escala.")
})

test_that("la nota no lleva separadores tipográficos ni rayas", {
  textos <- vapply(list(NULL, list(tipo = "comunes"), list(tipo = "mayor_diferencia", n = 2), list(tipo = "diferencia_minima", umbral = 10),
                        list(tipo = "mayor_sin_info", n = 2), list(tipo = "bajo_umbral", umbral = 60), list(tipo = "extremos", n = 1),
                        list(tipo = "a_mano", agregar = "a")),
                   function(r) .regla_preguntas_evaluar(.rp_ind(), r)$texto, "")
  expect_false(any(grepl("·|—|–", textos)))
})

# ---- Constructores -------------------------------------------------------------

test_that("la regla es formal de los tres constructores y viaja normalizada en el elemento", {
  for (f in list(p_panorama, p_dumbbell, p_barras_divergentes)) expect_true("regla" %in% names(formals(f)))
  el <- p_panorama(vars = "b$*", corte = "4", regla = list(tipo = "bajo_umbral", umbral = 60))
  expect_identical(el$regla$tipo, "bajo_umbral")
  # En el dumbbell y la divergente la regla implica el estilo resumen; con recetario explícito se rechaza.
  d <- p_dumbbell(vars = list(T = c("a$*", "b$*")), corte = "4", regla = list(tipo = "comunes"))
  expect_identical(d$overrides$estilo, "resumen")
  expect_identical(.rp_codigo(p_dumbbell(vars = list(T = c("a$p", "b$p")), corte = "4", estilo = "recetario",
                                         regla = list(tipo = "comunes"))), "E_REGLA_PREGUNTAS_INVALIDA")
  g <- p_dumbbell(vars = "a$p", corte = "4", cruce = "a$sexo", grupos = c("1", "2"), regla = list(tipo = "todas"))
  expect_identical(g$regla$tipo, "todas"); expect_identical(g$overrides$estilo, "resumen")
  v <- p_barras_divergentes(vars = "a$*", regla = list(tipo = "mayor_sin_info", n = 3))
  expect_identical(v$overrides$estilo, "resumen"); expect_identical(v$regla$n, 3L)
})

test_that("el registro ofrece la regla con su tipo de control", {
  for (g in c("p_panorama", "p_dumbbell", "p_barras_divergentes")) {
    a <- Filter(function(x) identical(x$name, "regla"), .GRAFICADORES_META[[g]]$args)
    expect_length(a, 1L)
    expect_identical(a[[1]]$tipo_input, "regla_preguntas"); expect_identical(a[[1]]$grupo, "datos")
  }
})

# ---- Fuentes sintéticas: dos públicos ----------------------------------------

.rp_rep <- function(cnt, cods = c("1", "2", "3", "4", "5", "9")) rep(cods, cnt)
.rp_inst <- function() list(
  survey = data.frame(name = c("q1", "q2", "q3", "q4", "q5", "t1", "sexo"),
                      type = c(rep("select_one lk", 5), "select_one tr", "select_one sx"),
                      list_name = c(rep("lk", 5), "tr", "sx"),
                      label = c("Reglamentos", "Biblioteca", "Docentes", "Salud", "Tutoría", "Tres niveles", "Sexo"),
                      stringsAsFactors = FALSE),
  choices = data.frame(list_name = c(rep("lk", 6), rep("tr", 4), "sx", "sx"),
                       name = c("1", "2", "3", "4", "5", "9", "1", "2", "3", "9", "1", "2"),
                       label = c("Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo", "Sin información",
                                 "Bajo", "Medio", "Alto", "Sin información", "Mujer", "Hombre"), stringsAsFactors = FALSE),
  orders_list = NULL)
.rp_datos <- function(lk) {
  d <- as.data.frame(lapply(lk, .rp_rep), stringsAsFactors = FALSE)
  d$t1 <- .rp_rep(c(10, 10, 15, 5), c("1", "2", "3", "9"))
  d$sexo <- rep(c("1", "2"), 20)
  d
}
# Top Two Box (4, 5): docentes 75, 50, 90, 25, 60; estudiantes 50, 45, 40, 35, 60. Diferencias 25, 5, 50, 10, 0.
# Sin información en docentes: q2 10 %, q4 20 %.
.rp_fuentes <- function() {
  doc <- .rp_datos(list(q1 = c(2, 3, 5, 15, 15, 0), q2 = c(4, 6, 6, 10, 10, 4), q3 = c(1, 1, 2, 18, 18, 0),
                        q4 = c(6, 8, 8, 5, 5, 8), q5 = c(4, 6, 6, 12, 12, 0)))
  est <- .rp_datos(list(q1 = c(5, 5, 10, 10, 10, 0), q2 = c(6, 8, 8, 9, 9, 0), q3 = c(6, 8, 10, 8, 8, 0),
                        q4 = c(8, 8, 10, 7, 7, 0), q5 = c(4, 6, 6, 12, 12, 0)))
  list(data_sources = list(docentes = doc, estudiantes = est), inst_sources = list(docentes = .rp_inst(), estudiantes = .rp_inst()))
}

test_that("una pregunta de escala exige cuatro opciones sustantivas: Sin información no cuenta", {
  src <- .rp_fuentes(); inst <- src$inst_sources$docentes
  expect_true(.panorama_es_escala(inst, "q1", c("4", "5")))
  expect_false(.panorama_es_escala(inst, "t1", "3"))   # tres niveles más Sin información
  expect_false(.panorama_es_escala(inst, "sexo", "1"))
  expect_identical(.regla_preguntas_escala(inst, "q1")$no_sustantivo, c(rep(FALSE, 5), TRUE))
})

test_that("panorama: las preguntas de escala de cada base, y entre públicos se emparejan por nombre", {
  src <- .rp_fuentes()
  el <- p_panorama(vars = c("docentes$*", "estudiantes$*"), corte = c("4", "5"), regla = list(tipo = "todas"))
  r <- .regla_preguntas_de_elemento(el, src)
  expect_identical(r$evaluacion$total, 10L)
  expect_identical(r$evaluacion$texto, "Se muestran las 10 preguntas de escala.")
  expect_length(r$vars, 10L)
  el2 <- p_panorama(vars = c("docentes$*", "estudiantes$*"), corte = c("4", "5"), regla = list(tipo = "mayor_diferencia", n = 2))
  r2 <- .regla_preguntas_de_elemento(el2, src)
  expect_identical(r2$evaluacion$temas, c("q3", "q1"))
  expect_identical(r2$vars, c("docentes$q3", "estudiantes$q3", "docentes$q1", "estudiantes$q1"))
  expect_identical(r2$evaluacion$texto, "Se muestran las 2 de mayor diferencia, de 5 preguntas comunes.")
  # Una pregunta declarada que no es de escala sale y se avisa; no detiene la lámina.
  el3 <- p_panorama(vars = c("docentes$q1", "docentes$t1"), corte = c("4", "5"), regla = list(tipo = "todas"))
  r3 <- .regla_preguntas_de_elemento(el3, src)
  expect_identical(r3$vars, "docentes$q1")
  expect_match(r3$avisos, "1 pregunta queda fuera: no son de escala con el indicador", fixed = TRUE)
  # Los filtros entran al indicador: sólo mujeres.
  el4 <- p_panorama(vars = "docentes$q1", corte = c("4", "5"), filtros = list(sexo = "1"), regla = list(tipo = "todas"))
  ind <- .regla_preguntas_indicadores(el4, src)$indicadores
  d <- src$data_sources$docentes; d <- d[d$sexo == "1", ]
  expect_equal(ind$valor, 100 * mean(d$q1 %in% c("4", "5")))
})

test_that("contraste entre bases: base$* en las dos bases da los pares del mismo nombre, con el valor del render", {
  src <- .rp_fuentes()
  el <- p_dumbbell(vars = list(Todas = c("docentes$*", "estudiantes$*")), corte = c("4", "5"), regla = list(tipo = "diferencia_minima", umbral = 10))
  r <- .regla_preguntas_de_elemento(el, src)
  expect_identical(r$evaluacion$total, 5L)
  expect_identical(r$evaluacion$temas, c("Docentes", "Reglamentos", "Salud"))
  expect_identical(r$vars$Docentes, c("docentes$q3", "estudiantes$q3"))
  expect_identical(r$evaluacion$texto, "Se muestran las 3 con diferencia de al menos 10 puntos, de 5 preguntas comunes.")
  ind <- .regla_preguntas_indicadores(el, src)$indicadores
  d <- .radar_mb_datos(list(Salud = c("docentes$q4", "estudiantes$q4")), "4,5", src)
  expect_equal(ind$valor[ind$tema == "Salud"], d$valor)
  expect_equal(ind$sin_info[ind$tema == "Salud"], c(20, 0))
  # Temas declarados (pares de la matriz escritos en el payload): el universo son esos.
  el2 <- p_dumbbell(vars = list(Uno = c("docentes$q1", "estudiantes$q1"), Dos = c("docentes$q2", "estudiantes$q2")), corte = c("4", "5"),
                    regla = list(tipo = "mayor_diferencia", n = 1))
  r2 <- .regla_preguntas_de_elemento(el2, src)
  expect_identical(r2$evaluacion$temas, "Uno"); expect_identical(r2$evaluacion$total, 2L)
})

test_that("contraste entre grupos de una base: las preguntas abiertas por el cruce", {
  src <- .rp_fuentes()
  el <- p_dumbbell(vars = "docentes$*", corte = c("4", "5"), cruce = "docentes$sexo", grupos = c("1", "2"), regla = list(tipo = "comunes"))
  r <- .regla_preguntas_de_elemento(el, src)
  expect_identical(r$evaluacion$total, 5L)
  expect_identical(r$evaluacion$texto, "Se muestran las 5 preguntas comunes a los dos grupos.")
  d <- .dumbbell_grupos_datos(list(Salud = "docentes$q4"), "4,5", "docentes$sexo", c("1", "2"), src)
  ind <- .regla_preguntas_indicadores(el, src)$indicadores
  expect_equal(ind$valor[ind$tema == "Salud"], d$valor)
  expect_identical(levels(ind$grupo), c("Mujer", "Hombre"))
})

test_that("escala del resumen: el lado de acuerdo y Sin información; en multibase una referencia pelada no cae en la primera base", {
  src <- .rp_fuentes()
  el <- p_barras_divergentes(vars = "docentes$*", regla = list(tipo = "mayor_sin_info", n = 1))
  r <- .regla_preguntas_de_elemento(el, src)
  expect_identical(r$vars, "docentes$q4")
  expect_identical(r$evaluacion$texto, "Se muestra la de más Sin información, de 5 preguntas de escala.")
  ind <- .regla_preguntas_indicadores(el, src)$indicadores
  # La cifra es la de la lámina (graficos_regla_divergentes.R): el reparto se fija sobre los seis niveles originales
  # (con «Sin información»), así que con n_negativas 2 «Ni uno ni otro» cae en el lado de acuerdo: (5 + 15 + 15) / 40.
  expect_equal(ind$valor[ind$tema == "docentes$q1"], 89)
  el2 <- p_barras_divergentes(vars = c("q1", "q2"), regla = list(tipo = "todas"))
  r2 <- .regla_preguntas_de_elemento(el2, src)
  expect_length(r2$vars, 0L)
  expect_match(r2$avisos, "les falta la base", fixed = TRUE)
  # Con una sola base la pelada se califica con ella y conserva su forma.
  uno <- list(data_sources = src$data_sources["docentes"], inst_sources = src$inst_sources["docentes"])
  expect_identical(.regla_preguntas_de_elemento(el2, uno)$vars, c("q1", "q2"))
})

# ---- Render real (reporte_ppt_plan) -------------------------------------------

test_that("en la ruta real el render aplica la regla y la espec lleva el texto de la nota", {
  skip_if_not_installed("ggplot2")
  src <- .rp_fuentes()
  plan <- p_plan(slides = list(
    p_slide_1_grafico(p_panorama(vars = c("docentes$*", "estudiantes$*"), corte = c("4", "5"),
                                 regla = list(tipo = "mayor_diferencia", n = 2)), titulo = "Panorama"),
    p_slide_1_grafico(p_dumbbell(vars = list(Todas = c("docentes$*", "estudiantes$*")), corte = c("4", "5"),
                                 regla = list(tipo = "mayor_diferencia", n = 2)), titulo = "Contraste"),
    p_slide_1_grafico(p_barras_divergentes(vars = "docentes$*", regla = list(tipo = "mayor_sin_info", n = 2)), titulo = "Escala"),
    p_slide_1_grafico(p_panorama(vars = c("docentes$*", "estudiantes$*"), corte = c("4", "5")), titulo = "Sin regla")
  ))
  salida <- suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                              solo_lista = TRUE, mensajes_progreso = FALSE))
  esp <- lapply(salida$rendered, attr, "pulso_espec")
  expect_identical(esp[[1]]$total, c(2L, 2L))
  expect_identical(esp[[1]]$texto_regla, "Se muestran las 2 de mayor diferencia, de 5 preguntas comunes.")
  expect_identical(esp[[2]]$rotulos, c("Docentes", "Reglamentos"))
  expect_identical(esp[[2]]$textos_diferencia, c("+50", "+25"))
  expect_identical(esp[[2]]$texto_regla, "Se muestran las 2 de mayor diferencia, de 5 preguntas comunes.")
  expect_length(esp[[3]]$filas, 2L)
  expect_identical(esp[[3]]$estilo, "resumen")
  expect_identical(esp[[3]]$texto_regla, "Se muestran las 2 con más Sin información, de 5 preguntas de escala.")
  # Sin regla, el contrato de siempre: todas las declaradas y ningún texto de regla.
  expect_identical(esp[[4]]$total, c(5L, 5L))
  expect_null(esp[[4]]$texto_regla)
})

test_that("la lámina nativa escribe la regla en la nota, junto a la base", {
  skip_if_not_installed("officer")
  src <- .rp_fuentes()
  plan <- p_plan(slides = list(
    p_slide_1_grafico(p_dumbbell(vars = list(Todas = c("docentes$*", "estudiantes$*")), corte = c("4", "5"),
                                 regla = list(tipo = "mayor_diferencia", n = 2)), titulo = "Contraste"),
    p_slide_1_grafico(p_panorama(vars = c("docentes$*", "estudiantes$*"), corte = c("4", "5"),
                                 regla = list(tipo = "bajo_umbral", umbral = 50)), titulo = "Panorama"),
    p_slide_1_grafico(p_barras_divergentes(vars = "docentes$*", regla = list(tipo = "mayor_sin_info", n = 2)), titulo = "Escala")
  ))
  out <- tempfile(fileext = ".pptx"); on.exit(unlink(out), add = TRUE)
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                                     path_ppt = out, mensajes_progreso = FALSE)))
  texto <- function(k) paste(xml2::xml_text(xml2::xml_find_all(xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))), "//a:t")), collapse = " ")
  grupos <- function(k) xml2::xml_attr(xml2::xml_find_all(xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))), "//p:grpSp/p:nvGrpSpPr/p:cNvPr"), "name")
  expect_true("prosecnur:grafico:contraste" %in% grupos(1))
  expect_match(texto(1), "Base: Docentes 40; Estudiantes 40", fixed = TRUE)
  expect_match(texto(1), "Se muestran las 2 de mayor diferencia, de 5 preguntas comunes", fixed = TRUE)
  expect_true("prosecnur:grafico:panorama" %in% grupos(2))
  expect_match(texto(2), "Se muestran las 4 bajo 50%, de 10 preguntas de escala", fixed = TRUE)
  expect_true("prosecnur:grafico:divergentes" %in% grupos(3))
  expect_match(texto(3), "Se muestran las 2 con más Sin información, de 5 preguntas de escala", fixed = TRUE)
})

# ---- Endpoint de conteo --------------------------------------------------------

.rp_xlsform_inst <- function() {
  testthat::skip_if_not_installed("openxlsx")
  i <- .rp_inst()
  x <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(list(survey = i$survey[, c("type", "name", "label")], choices = i$choices[, c("list_name", "name", "label")]), x)
  suppressMessages(reporte_instrumento(x))
}

.rp_sesion <- function() {
  inst <- .rp_xlsform_inst()
  src <- .rp_fuentes()
  sid <- session_create()
  # La base activa es la SEGUNDA: si el conteo cayera en una sola base no habría preguntas comunes.
  session_set(sid, "estudio", list(bases = list(docentes = list(nombre = "docentes"), estudiantes = list(nombre = "estudiantes")),
                                   active_base = "estudiantes", processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", src$data_sources)
  session_set(sid, "rp_inst_sources", list(docentes = inst, estudiantes = inst))
  sid
}

.rp_http <- function(sid, body) {
  testthat::skip_if_not_installed("plumber")
  pr <- mount_graficos_regla(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  crudo <- charToRaw(enc2utf8(body))
  entrada <- list(read = function(...) crudo, rewind = function() invisible(0), read_lines = function(...) character())
  req <- as.environment(list(REQUEST_METHOD = "POST", PATH_INFO = "/api/graficos/resumenes/regla", QUERY_STRING = "",
                             HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = entrada,
                             bodyRaw = crudo, postBody = body, CONTENT_TYPE = "application/json"))
  r <- pr$call(req)
  list(status = as.integer(r$status), body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

test_that("HTTP: el conteo en vivo lee todas las bases y devuelve total, elegidas, candidatas y la nota", {
  sid <- .rp_sesion(); on.exit(session_delete(sid), add = TRUE)
  body <- '{"graficador": "p_dumbbell", "args": {"vars": {"Todas": ["docentes$*", "estudiantes$*"]}, "corte": ["4", "5"],
            "estilo": "resumen", "regla": {"tipo": "mayor_diferencia", "n": 2, "agregar": [], "quitar": []}}}'
  r <- .rp_http(sid, body)
  expect_identical(r$status, 200L)
  expect_true(isTRUE(r$body$ok))
  expect_identical(r$body$total, 5L)
  expect_identical(unlist(r$body$seleccionadas), c("Docentes", "Reglamentos"))
  expect_identical(r$body$texto_regla, "Se muestran las 2 de mayor diferencia, de 5 preguntas comunes.")
  expect_length(r$body$candidatas, 5L)
  expect_identical(names(r$body$candidatas[[1]]), c("tema", "etiqueta", "metrica", "seleccionada"))
  expect_identical(vapply(r$body$candidatas, function(x) isTRUE(x$seleccionada), TRUE), c(TRUE, FALSE, TRUE, FALSE, FALSE))
  # Una sola elegida sigue siendo un arreglo (serializador unboxed).
  r1 <- .rp_http(sid, sub('"n": 2', '"n": 1', body))
  expect_true(is.list(r1$body$seleccionadas)); expect_length(r1$body$seleccionadas, 1L)
  expect_true(is.list(r1$body$avisos))
  # Sin regla cuenta todas las candidatas.
  r0 <- .rp_http(sid, '{"graficador": "p_panorama", "args": {"vars": ["docentes$*", "estudiantes$*"], "corte": ["4", "5"]}}')
  expect_identical(r0$status, 200L); expect_identical(r0$body$total, 10L)
  expect_identical(r0$body$texto_regla, "Se muestran las 10 preguntas de escala.")
})

test_that("HTTP: una regla o un pedido inválido responde 400 con su código registrado", {
  sid <- .rp_sesion(); on.exit(session_delete(sid), add = TRUE)
  r <- .rp_http(sid, '{"graficador": "p_panorama", "args": {"vars": ["docentes$*"], "corte": ["4"], "regla": {"tipo": "las_mejores"}}}')
  expect_identical(r$status, 400L); expect_identical(r$body$error$code %||% r$body$code, "E_REGLA_PREGUNTAS_INVALIDA")
  r2 <- .rp_http(sid, '{"args": {}}')
  expect_identical(r2$status, 400L); expect_identical(r2$body$error$code %||% r2$body$code, "E_REGLA_PREGUNTAS_INVALIDA")
  r3 <- .rp_http(sid, '{"graficador": "p_barras_agrupadas", "args": {"var": "docentes$q1"}}')
  expect_identical(r3$status, 400L); expect_identical(r3$body$error$code %||% r3$body$code, "E_REGLA_PREGUNTAS_INVALIDA")
  r4 <- .rp_http(sid, '{"graficador": "p_dumbbell", "args": {"vars": {"T": ["docentes$q1", "estudiantes$q1"]}, "corte": ["4"],
                 "regla": {"tipo": "mayor_diferencia"}}}')
  expect_identical(r4$status, 400L); expect_identical(r4$body$error$code %||% r4$body$code, "E_REGLA_PREGUNTAS_INVALIDA")
})

test_that("el endpoint queda montado en la app", {
  src <- paste(readLines(test_path("..", "..", "R", "plumber_app.R"), warn = FALSE), collapse = "\n")
  expect_match(src, "mount_graficos_regla(pr)", fixed = TRUE)
})
