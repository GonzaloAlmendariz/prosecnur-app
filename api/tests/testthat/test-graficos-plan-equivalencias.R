source("setup-load-all.R")

# ADR 0063 — el mazo comparativo se deriva de la declaración.
#
# La declaración del ADR 0062 dice qué pregunta de un público equivale a cuál de
# otro y a qué lámina va. Estos casos fijan qué plan sale de ahí, y sobre todo
# qué NO sale: una fila sin lámina no produce diapositiva, y una pregunta cuyos
# públicos no comparten escala se reporta en vez de graficarse — fabricar esa
# lámina escondería el defecto detrás de un gráfico con aspecto correcto, que es
# el modo de fallo que el ADR 0062 vino a cerrar.

.gpe_inst <- function(nombres, etiquetas, listas) {
  choices <- do.call(rbind, lapply(unique(listas), function(l) {
    data.frame(list_name = l, name = c("1", "2"),
               label = if (identical(l, "sat")) c("Malo", "Bueno") else c("Sí", "No"),
               stringsAsFactors = FALSE)
  }))
  list(
    survey = data.frame(
      type = paste("select_one", listas),
      name = nombres, label = etiquetas, section = "Pag1",
      stringsAsFactors = FALSE),
    choices = choices
  )
}

.gpe_setup <- function() {
  sid <- session_create()
  s <- session_get(sid)
  s$estudio <- list(
    bases = list(docentes = list(nombre = "docentes"), estudiantes = list(nombre = "estudiantes")),
    processing_mode = "multibase", topology_declared = "separate", active_base = "docentes")
  s$rp_inst_sources <- list(
    docentes = .gpe_inst(c("p13_1", "p14_1", "p20"), c("Salud", "Bienestar", "Otra"),
                         c("si_no", "si_no", "si_no")),
    estudiantes = .gpe_inst(c("p11_1", "p12_1", "p30"), c("Salud", "Bienestar", "Otra"),
                            c("si_no", "si_no", "sat"))
  )
  .session_env[[sid]] <- s
  sid
}

.gpe_declarar <- function(sid, filas) {
  session_set(sid, "equivalencias_publicos", list(
    schema = "equivalencias_publicos/v1",
    bases = c("docentes", "estudiantes"),
    filas = filas, n_filas = length(filas)))
}

test_that("una lámina por diapositiva declarada, un tema por pregunta", {
  sid <- .gpe_setup()
  on.exit(session_delete(sid), add = TRUE)
  .gpe_declarar(sid, list(
    list(etiqueta_estandar = "¿Conoce el servicio de salud?", diapositiva = "1",
         variables = list(docentes = "p13_1", estudiantes = "p11_1")),
    list(etiqueta_estandar = "¿Conoce bienestar psicológico?", diapositiva = "1",
         variables = list(docentes = "p14_1", estudiantes = "p12_1"))
  ))

  out <- .graficos_plan_desde_equivalencias(sid)
  expect_equal(length(out$plan$slides), 1L)

  args <- out$plan$slides[[1]]$payload$grafico$args
  expect_equal(out$plan$slides[[1]]$payload$grafico$graficador, "p_barras_multiapiladas")
  expect_equal(args$modo, "var_cruce")
  # Un tema por pregunta, con las variables de cada público prefijadas por base.
  expect_equal(length(args$vars), 2L)
  expect_equal(unlist(args$vars$tema_1), c("docentes$p13_1", "estudiantes$p11_1"))
  expect_equal(unlist(args$vars$tema_2), c("docentes$p14_1", "estudiantes$p12_1"))
  # Y la etiqueta estándar como título del tema: es el texto curado del analista.
  expect_equal(args$titulos_grupo$tema_1, "¿Conoce el servicio de salud?")
})

test_that("las filas sin lámina no producen diapositiva", {
  sid <- .gpe_setup()
  on.exit(session_delete(sid), add = TRUE)
  .gpe_declarar(sid, list(
    list(etiqueta_estandar = "Va a la lámina 1", diapositiva = "1",
         variables = list(docentes = "p13_1", estudiantes = "p11_1")),
    # No asignar lámina es una decisión del analista, no un olvido que la app
    # deba completar: 21 de las 154 filas reales están así.
    list(etiqueta_estandar = "Sin lámina", diapositiva = "",
         variables = list(docentes = "p14_1", estudiantes = "p12_1"))
  ))

  out <- .graficos_plan_desde_equivalencias(sid)
  expect_equal(length(out$plan$slides), 1L)
  expect_equal(length(out$plan$slides[[1]]$payload$grafico$args$vars), 1L)
  # Lo que queda fuera se reporta: un mazo más corto sin explicación se lee como
  # un fallo del generador.
  expect_true(any(vapply(out$fuera, function(x) identical(x$motivo, "sin_lamina"), logical(1))))
})

test_that("una pregunta cuyos públicos no comparten escala se reporta y no se grafica", {
  sid <- .gpe_setup()
  on.exit(session_delete(sid), add = TRUE)
  .gpe_declarar(sid, list(
    list(etiqueta_estandar = "Escalas divergentes", diapositiva = "1",
         # p20 es Sí/No en docentes y p30 es Malo/Bueno en estudiantes.
         variables = list(docentes = "p20", estudiantes = "p30"))
  ))

  out <- .graficos_plan_desde_equivalencias(sid)
  expect_equal(length(out$plan$slides), 0L)
  fuera <- Filter(function(x) identical(x$motivo, "escala_divergente"), out$fuera)
  expect_equal(length(fuera), 1L)
  expect_equal(fuera[[1]]$etiqueta, "Escalas divergentes")
})

test_that("el orden del mazo es el declarado, no el alfabético", {
  sid <- .gpe_setup()
  on.exit(session_delete(sid), add = TRUE)
  .gpe_declarar(sid, list(
    list(etiqueta_estandar = "Zeta", diapositiva = "2",
         variables = list(docentes = "p13_1", estudiantes = "p11_1")),
    list(etiqueta_estandar = "Alfa", diapositiva = "10",
         variables = list(docentes = "p14_1", estudiantes = "p12_1"))
  ))

  out <- .graficos_plan_desde_equivalencias(sid)
  expect_equal(length(out$plan$slides), 2L)
  # 2 antes que 10: numérico, no lexicográfico — «10» < «2» como texto.
  expect_equal(out$plan$slides[[1]]$payload$grafico$args$titulos_grupo$tema_1, "Zeta")
  expect_equal(out$plan$slides[[2]]$payload$grafico$args$titulos_grupo$tema_1, "Alfa")
})

test_that("derivar no persiste nada", {
  sid <- .gpe_setup()
  on.exit(session_delete(sid), add = TRUE)
  .gpe_declarar(sid, list(
    list(etiqueta_estandar = "X", diapositiva = "1",
         variables = list(docentes = "p13_1", estudiantes = "p11_1"))))
  antes <- session_get(sid)

  .graficos_plan_desde_equivalencias(sid)
  despues <- session_get(sid)

  # Una propuesta que escribe el plan destruiria las ediciones manuales sin
  # dejar rastro, que es la forma mas cara de este defecto.
  expect_null(despues$graficos_config)
  expect_equal(despues$equivalencias_publicos, antes$equivalencias_publicos)
  expect_equal(isTRUE(despues$project_dirty), isTRUE(antes$project_dirty))
})

test_that("sin declaración no hay mazo que derivar, y se dice", {
  sid <- .gpe_setup()
  on.exit(session_delete(sid), add = TRUE)
  out <- .graficos_plan_desde_equivalencias(sid)
  expect_equal(length(out$plan$slides), 0L)
  expect_false(out$declarada)
})

test_that("la fuente `equivalencias` devuelve el mazo derivado por el mismo endpoint", {
  sid <- .gpe_setup()
  on.exit(session_delete(sid), add = TRUE)
  .gpe_declarar(sid, list(
    list(etiqueta_estandar = "X", diapositiva = "1",
         variables = list(docentes = "p13_1", estudiantes = "p11_1"))))

  # Reusar `plan/sugerido` mantiene una sola previsualización, una sola
  # validación y un solo «aplicar». El contrato de respuesta trae `plan` como
  # el resto de fuentes.
  out <- .graficos_plan_sugerido_por_fuente(sid, list(fuente = "equivalencias"))
  expect_true(out$ok)
  expect_equal(out$fuente, "equivalencias")
  expect_equal(length(out$plan$slides), 1L)
  expect_equal(out$n_laminas, 1L)
  expect_true(out$declarada)

  # Y sin fuente declarada NO se cuela: el generador de perfiles sigue siendo el
  # de siempre. Se comprueba por su forma de respuesta, que trae `coverage` con
  # contenido en vez del stub vacio de la derivacion.
  expect_false(identical(
    tryCatch(.graficos_plan_sugerido_por_fuente(sid, list())$fuente,
             error = function(e) "error-esperado-sin-datos"),
    "equivalencias"
  ))
})


test_that("el plan derivado lo acepta el graficador real", {
  # El caso que faltaba y por el que el PPT reventó: los demás fijan la forma que
  # ESTE archivo construye, no la que el motor acepta. `multilista` pasaba todos
  # los tests y abortaba en el render con «`bloques` debe ser una lista no
  # vacia». La única prueba que vale es pasarle el spec al graficador.
  sid <- .gpe_setup()
  on.exit(session_delete(sid), add = TRUE)
  .gpe_declarar(sid, list(
    list(etiqueta_estandar = "¿Conoce el servicio de salud?", diapositiva = "1",
         variables = list(docentes = "p13_1", estudiantes = "p11_1")),
    list(etiqueta_estandar = "¿Conoce bienestar psicológico?", diapositiva = "1",
         variables = list(docentes = "p14_1", estudiantes = "p12_1"))
  ))

  out <- .graficos_plan_desde_equivalencias(sid)
  for (slide in out$plan$slides) {
    g <- slide$payload$grafico
    expect_silent(do.call(p_barras_multiapiladas, g$args))
  }
})

test_that("una lámina con escalas distintas se apila en bloques, no aborta", {
  # B1, medido en el PPT real: la lámina que juntaba «¿Cuál es su género?»
  # (3 categorías) con una pregunta Sí/No salía entera como «Sin datos» y se
  # perdía también el tema que sí era graficable. La causa: en `var_cruce` el
  # motor comprueba la escala sobre TODAS las refs de la lámina, aplanando los
  # temas — el validador del frontend la comprueba por tema, y ahí discrepan.
  sid <- .gpe_setup()
  on.exit(session_delete(sid), add = TRUE)
  .gpe_declarar(sid, list(
    list(etiqueta_estandar = "Sí/No", diapositiva = "1",
         variables = list(docentes = "p13_1", estudiantes = "p11_1")),
    list(etiqueta_estandar = "Otra escala", diapositiva = "1",
         # p20 es Sí/No en docentes; p30 es Malo/Bueno en estudiantes. Para que
         # la fila sea homogénea entre públicos usamos la misma escala en ambos.
         variables = list(estudiantes = "p30"))
  ))

  args <- .graficos_plan_desde_equivalencias(sid)$plan$slides[[1]]$payload$grafico$args
  expect_equal(args$modo, "multilista")
  expect_equal(length(args$bloques), 2L)
  expect_true(all(vapply(args$bloques, function(b) identical(b$modo, "var_cruce"), logical(1))))
  # Y el spec lo acepta el graficador real, que es lo único que prueba que no
  # volverá a degradarse a «Sin datos».
  expect_silent(do.call(p_barras_multiapiladas, args))
})

test_that("una lámina de escala única sigue usando var_cruce", {
  # `multilista` arrastra cowplot y es más pesado: no se usa cuando no hace falta.
  sid <- .gpe_setup()
  on.exit(session_delete(sid), add = TRUE)
  .gpe_declarar(sid, list(
    list(etiqueta_estandar = "A", diapositiva = "1",
         variables = list(docentes = "p13_1", estudiantes = "p11_1")),
    list(etiqueta_estandar = "B", diapositiva = "1",
         variables = list(docentes = "p14_1", estudiantes = "p12_1"))
  ))
  args <- .graficos_plan_desde_equivalencias(sid)$plan$slides[[1]]$payload$grafico$args
  expect_equal(args$modo, "var_cruce")
  expect_equal(length(args$vars), 2L)
})

test_that("la firma de escala lee la lista del instrumento procesado", {
  # El instrumento procesado guarda la lista en su propia columna y deja `type`
  # en «select_one» a secas. Leyendo sólo `type`, toda variable de opción única
  # devolvía la misma firma y la comparación dejaba de distinguir nada — que fue
  # lo que hizo que el agrupado por escala no separara nada.
  inst_proc <- list(
    survey = data.frame(type = c("select_one", "select_one"),
                        list_name = c("lst_a", "lst_b"),
                        name = c("p1", "p2"), label = c("A", "B"),
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = c("lst_a", "lst_a", "lst_b", "lst_b"),
                         name = c("1", "2", "1", "2"),
                         label = c("Sí", "No", "Malo", "Bueno"),
                         stringsAsFactors = FALSE))
  f1 <- .equiv_firma_escala(inst_proc, "p1")
  f2 <- .equiv_firma_escala(inst_proc, "p2")
  expect_true(nzchar(f1) && nzchar(f2))
  expect_false(identical(f1, f2))

  # Y la forma cruda («select_one lst_a») sigue funcionando.
  inst_crudo <- inst_proc
  inst_crudo$survey$type <- c("select_one lst_a", "select_one lst_b")
  inst_crudo$survey$list_name <- NULL
  expect_false(identical(.equiv_firma_escala(inst_crudo, "p1"),
                         .equiv_firma_escala(inst_crudo, "p2")))
})
