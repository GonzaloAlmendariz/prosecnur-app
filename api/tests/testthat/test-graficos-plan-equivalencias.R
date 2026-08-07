source("setup-load-all.R")

# ADR 0063 — el mazo comparativo se deriva de la declaración.
#
# La declaración del ADR 0062 dice qué pregunta de un público equivale a cuál de
# otro y a qué diapositiva va. Estos casos fijan qué plan sale de ahí, y sobre todo
# qué NO sale: una fila sin diapositiva asignada no entra al mazo, y una pregunta cuyos
# públicos no comparten escala se reporta en vez de graficarse — fabricar esa
# fabricarla escondería el defecto detrás de un gráfico con aspecto correcto, que es
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

test_that("una diapositiva por cada clave declarada, un tema por pregunta", {
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

test_that("las filas sin diapositiva asignada no entran al mazo", {
  sid <- .gpe_setup()
  on.exit(session_delete(sid), add = TRUE)
  .gpe_declarar(sid, list(
    list(etiqueta_estandar = "Va a la diapositiva 1", diapositiva = "1",
         variables = list(docentes = "p13_1", estudiantes = "p11_1")),
    # No asignar diapositiva es una decisión del analista, no un olvido que la app
    # deba completar: 21 de las 154 filas reales están así.
    list(etiqueta_estandar = "Sin diapositiva", diapositiva = "",
         variables = list(docentes = "p14_1", estudiantes = "p12_1"))
  ))

  out <- .graficos_plan_desde_equivalencias(sid)
  expect_equal(length(out$plan$slides), 1L)
  expect_equal(length(out$plan$slides[[1]]$payload$grafico$args$vars), 1L)
  # Lo que queda fuera se reporta: un mazo más corto sin explicación se lee como
  # un fallo del generador.
  expect_true(any(vapply(out$fuera, function(x) identical(x$motivo, "sin_diapositiva"), logical(1))))
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
  expect_equal(out$n_diapositivas, 1L)
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

test_that("una diapositiva con escalas distintas se apila en bloques, no aborta", {
  # B1, medido en el PPT real: la diapositiva que juntaba «¿Cuál es su género?»
  # (3 categorías) con una pregunta Sí/No salía entera como «Sin datos» y se
  # perdía también el tema que sí era graficable. La causa: en `var_cruce` el
  # motor comprueba la escala sobre TODAS las refs de la diapositiva, aplanando los
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
  # La FORMA de cada bloque la decide cuantos publicos toca: el primero compara
  # docentes con estudiantes y necesita las dos dimensiones —tema en el canal,
  # actor en la barra—; el segundo es de un solo publico, y ahi el eje Y es la
  # pregunta y el actor se dice una vez en el pie.
  expect_equal(vapply(args$bloques, function(b) as.character(b$modo), character(1)),
               c("var_cruce", "var"))
  # Y el spec lo acepta el graficador real, que es lo único que prueba que no
  # volverá a degradarse a «Sin datos».
  expect_silent(do.call(p_barras_multiapiladas, args))
})

test_that("una diapositiva de escala única sigue usando var_cruce", {
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

test_that("una pregunta sin lista de opciones no entra al mazo", {
  # Medido en el PPT real: la fila de «indique un correo electrónico» —texto
  # abierto— tumbaba la diapositiva entera con «no comparten una escala compatible»,
  # un mensaje que además apunta al sitio equivocado. Pasaba el filtro de
  # divergencia porque su firma (`libre:text`) es homogénea entre públicos:
  # homogénea, pero no graficable como barras apiladas.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$estudio <- list(bases = list(a = list(nombre = "a"), b = list(nombre = "b")),
                    processing_mode = "multibase", topology_declared = "separate",
                    active_base = "a")
  inst <- function() list(
    survey = data.frame(type = c("text", "select_one"), list_name = c("", "lst"),
                        name = c("p2", "p1"), label = c("Correo", "Consiente"),
                        section = "Pag1", stringsAsFactors = FALSE),
    choices = data.frame(list_name = c("lst", "lst"), name = c("1", "2"),
                         label = c("Sí", "No"), stringsAsFactors = FALSE))
  s$rp_inst_sources <- list(a = inst(), b = inst())
  .session_env[[sid]] <- s

  session_set(sid, "equivalencias_publicos", list(
    schema = "equivalencias_publicos/v1", bases = c("a", "b"), n_filas = 2L,
    filas = list(
      list(etiqueta_estandar = "Correo", diapositiva = "1",
           variables = list(a = "p2", b = "p2")),
      list(etiqueta_estandar = "Consiente", diapositiva = "1",
           variables = list(a = "p1", b = "p1")))))

  out <- .graficos_plan_desde_equivalencias(sid)
  # La diapositiva sobrevive con la pregunta que SÍ se puede graficar.
  expect_equal(length(out$plan$slides), 1L)
  args <- out$plan$slides[[1]]$payload$grafico$args
  expect_equal(length(args$vars), 1L)
  expect_equal(args$titulos_grupo$tema_1, "Consiente")
  # Y la de texto se reporta con su motivo, no desaparece en silencio.
  fuera <- Filter(function(x) identical(x$motivo, "no_graficable"), out$fuera)
  expect_equal(length(fuera), 1L)
  expect_equal(fuera[[1]]$etiqueta, "Correo")
})

test_that("la revisión cambia con lo que cambia el mazo, y sólo con eso", {
  # El ADR 0063 acepta que la propuesta envejezca a cambio de que la diferencia
  # sea VISIBLE. Esta huella es lo que la vuelve comprobable, así que tiene que
  # moverse exactamente cuando el mazo cambiaría — ni más ni menos.
  fila <- function(lam, et, vars) list(diapositiva = lam, etiqueta_estandar = et, variables = vars)
  base <- list(filas = list(
    fila("1", "A", list(x = "p1", y = "q1")),
    fila("2", "B", list(x = "p2", y = "q2"))))

  r0 <- .equiv_declaracion_revision(base)
  expect_true(nzchar(r0))
  expect_equal(r0, .equiv_declaracion_revision(base))

  # Reordenar las filas sin cambiar su contenido NO cambia el mazo.
  reordenada <- list(filas = rev(base$filas))
  expect_equal(r0, .equiv_declaracion_revision(reordenada))

  # Cambiar de diapositiva, de etiqueta o de variable SÍ lo cambia.
  otra_diapositiva <- base; otra_diapositiva$filas[[1]]$diapositiva <- "3"
  expect_false(identical(r0, .equiv_declaracion_revision(otra_diapositiva)))
  otra_etiqueta <- base; otra_etiqueta$filas[[1]]$etiqueta_estandar <- "A cambiada"
  expect_false(identical(r0, .equiv_declaracion_revision(otra_etiqueta)))
  otra_var <- base; otra_var$filas[[1]]$variables$x <- "p99"
  expect_false(identical(r0, .equiv_declaracion_revision(otra_var)))

  # Sin filas no hay revisión que comparar.
  expect_equal(.equiv_declaracion_revision(list(filas = list())), "")
})

test_that("la propuesta viaja con su revisión", {
  sid <- .gpe_setup()
  on.exit(session_delete(sid), add = TRUE)
  .gpe_declarar(sid, list(
    list(etiqueta_estandar = "X", diapositiva = "1",
         variables = list(docentes = "p13_1", estudiantes = "p11_1"))))
  out <- .graficos_plan_desde_equivalencias(sid)
  expect_true(nzchar(out$revision))
  # Y la misma revisión sale por el endpoint que la UI consume.
  expect_equal(out$revision,
               .graficos_plan_sugerido_por_fuente(sid, list(fuente = "equivalencias"))$revision)
})

test_that("con un solo publico el eje Y es la pregunta, no el actor", {
  # Repetir «Administrativos» en las siete barras no informa nada —el pie ya dice
  # «Base: 15 administrativos»— y obliga a meter el tema en un canal lateral, que
  # es donde los titulos se apilaban unos sobre otros. El canal del tema existe
  # para separar DOS dimensiones; con un solo publico solo hay una.
  sid <- .gpe_setup()
  on.exit(session_delete(sid), add = TRUE)
  .gpe_declarar(sid, list(
    list(etiqueta_estandar = "A", diapositiva = "1", variables = list(docentes = "p13_1")),
    list(etiqueta_estandar = "B", diapositiva = "1", variables = list(docentes = "p14_1"))
  ))
  args <- .graficos_plan_desde_equivalencias(sid)$plan$slides[[1]]$payload$grafico$args
  expect_equal(args$modo, "var")
  expect_equal(length(args$vars), 2L)
  expect_null(args$titulos_grupo)
  # Sin canal de tema, ensancharlo solo empujaria las barras a la derecha: el
  # texto largo esta en el eje Y.
  expect_null(args$overrides$canvas_w_grupo)
  expect_true(is.numeric(args$overrides$canvas_w_etiquetas))
  expect_silent(do.call(p_barras_multiapiladas, args))
})

# ---------------------------------------------------------------------------
# Trazabilidad: lo declarado es lo que sale.
# ---------------------------------------------------------------------------
#
# Es la garantia que sostiene toda la pestana: si manana se sube un Excel
# estandarizado y una equivalencia no llega al mazo, el analista no tiene como
# enterarse — la lamina simplemente no esta, o esta con una variable de menos.
# Medido sobre el estudio real: 263 pares declarados, 263 emitidos.

.gpe_refs_del_plan <- function(args) {
  if (identical(args$modo, "multilista")) {
    return(unlist(lapply(args$bloques, .gpe_refs_del_plan), use.names = FALSE))
  }
  unlist(args$vars, use.names = FALSE)
}

.gpe_pares_emitidos <- function(plan) {
  out <- character(0)
  for (sl in plan$slides) {
    d <- sub("^s-equiv-", "", sl$id)
    for (r in .gpe_refs_del_plan(sl$payload$grafico$args)) {
      out <- c(out, paste0(d, "|", r))
    }
  }
  sort(unique(out))
}

.gpe_pares_declarados <- function(filas) {
  out <- character(0)
  for (f in filas) {
    d <- trimws(as.character(f$diapositiva %||% ""))
    if (!nzchar(d)) next
    for (b in names(f$variables)) out <- c(out, paste0(d, "|", b, "$", f$variables[[b]]))
  }
  sort(unique(out))
}

test_that("cada par declarado sale en el mazo, y no sale ninguno que no se declaro", {
  sid <- .gpe_setup()
  on.exit(session_delete(sid), add = TRUE)
  filas <- list(
    # Diapositiva de dos publicos, escala compartida.
    list(etiqueta_estandar = "Salud", diapositiva = "1",
         variables = list(docentes = "p13_1", estudiantes = "p11_1")),
    list(etiqueta_estandar = "Bienestar", diapositiva = "1",
         variables = list(docentes = "p14_1", estudiantes = "p12_1")),
    # Diapositiva de un solo publico.
    list(etiqueta_estandar = "Solo docentes", diapositiva = "2",
         variables = list(docentes = "p20")),
    # Diapositiva de escalas mixtas: se parte en bloques y NINGUNO puede perderse.
    list(etiqueta_estandar = "Mixta A", diapositiva = "3",
         variables = list(docentes = "p13_1")),
    list(etiqueta_estandar = "Mixta B", diapositiva = "3",
         variables = list(estudiantes = "p30"))
  )
  .gpe_declarar(sid, filas)

  plan <- .graficos_plan_desde_equivalencias(sid)$plan
  expect_setequal(.gpe_pares_emitidos(plan), .gpe_pares_declarados(filas))
})

test_that("una fila sin diapositiva no se pierde en silencio: se reporta con motivo", {
  # Un mazo mas corto de lo esperado sin explicacion es indistinguible de un bug.
  sid <- .gpe_setup()
  on.exit(session_delete(sid), add = TRUE)
  .gpe_declarar(sid, list(
    list(etiqueta_estandar = "Con lamina", diapositiva = "1",
         variables = list(docentes = "p13_1", estudiantes = "p11_1")),
    list(etiqueta_estandar = "Sin lamina", diapositiva = "",
         variables = list(docentes = "p14_1"))
  ))
  res <- .graficos_plan_desde_equivalencias(sid)

  expect_length(res$plan$slides, 1L)
  fuera <- res$fuera %||% list()
  expect_length(fuera, 1L)
  expect_equal(as.character(fuera[[1]]$motivo), "sin_diapositiva")
  # Y la fila descartada se identifica, no se cuenta a secas: sin la etiqueta y
  # sus variables, «1 fila fuera» no dice cual hay que revisar.
  expect_equal(as.character(fuera[[1]]$etiqueta), "Sin lamina")
  expect_equal(names(fuera[[1]]$variables), "docentes")
})

test_that("el radar derivado arranca el eje en la mitad alta", {
  # Un indicador de acuerdo o satisfaccion vive arriba: el perfil de egreso
  # medido va de 90 % a 98 %, y de 0 a 100 las tres series se dibujan una encima
  # de otra. El piso no miente — si un tema cae por debajo, el motor lo baja.
  sid <- .gpe_setup()
  on.exit(session_delete(sid), add = TRUE)
  filas <- lapply(1:5, function(i) list(
    etiqueta_estandar = paste("Tema", i), diapositiva = "1",
    grafico = "radar", corte = "1,2",
    variables = list(estudiantes = "p30")))
  .gpe_declarar(sid, filas)

  args <- .graficos_plan_desde_equivalencias(sid)$plan$slides[[1]]$payload$grafico$args
  expect_equal(args$modo, "publicos")
  expect_equal(args$eje_min, 50)
})

test_that("el estilo del radar se declara por bloque", {
  # El estilo dice COMO se lee ese bloque: una bateria de perfil se presenta con
  # lineas y una de diagnostico con la grilla a la vista, y las dos conviven en
  # el mismo mazo. Por eso se declara donde se declara el corte, no una vez para
  # todo el informe.
  sid <- .gpe_setup()
  on.exit(session_delete(sid), add = TRUE)
  declarar <- function(estilo) {
    .gpe_declarar(sid, lapply(1:5, function(i) list(
      etiqueta_estandar = paste("T", i), diapositiva = "1",
      grafico = "radar", corte = "1,2", estilo = estilo,
      variables = list(estudiantes = "p30"))))
    .graficos_plan_desde_equivalencias(sid)$plan$slides[[1]]$payload$grafico$args$estilo
  }
  expect_equal(declarar("auditoria"), "auditoria")
  expect_equal(declarar("silueta"), "silueta")
  # Sin declarar, el que sincroniza con la matriz.
  expect_equal(declarar(""), "comparativo")
  # Una clave que el motor no conoce cae al defecto en vez de abortar el mazo:
  # un Excel con «Auditoría» acentuado no puede dejar la lamina sin dibujar.
  expect_equal(declarar("auditoría"), "comparativo")
})
