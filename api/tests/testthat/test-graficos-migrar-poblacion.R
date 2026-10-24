# Población antigua fuera (Gonzalo, 2026-10-10: «sí, bórralos, porque en el recetario tampoco están ya»).
# `p_slide_2/3/4_graficos_poblacion` (el ícono del público en medio de los gráficos) salen del selector y los planes que
# los usan se migran al cargar la config al tipo vigente equivalente: 2 → `p_slide_2_graficos`, 3 →
# `p_slide_3_graficos_fila`, 4 → `p_slide_4_graficos`. Cada gráfico pasa a la ranura nueva de la misma posición; el título,
# la base, el pie, la etiqueta y la meta se conservan. El código del motor viejo sigue (se borra con ADR).

.mp_graf <- function(var) list(graficador = "p_barras_agrupadas", args = list(var = var, overrides = list(titulo = paste("T", var))))
.mp_plan <- function() {
  list(slides = list(
    list(id = "s-port", tipo = "p_slide_portada", payload = list(titulo = "Portada")),
    list(id = "s-p2", tipo = "p_slide_2_graficos_poblacion",
         payload = list(titulo = "Dos", base = "Base: 52 docentes", izquierda = .mp_graf("a"), derecha = .mp_graf("b"), icono = "ico-1")),
    list(id = "s-p3", tipo = "p_slide_3_graficos_poblacion",
         payload = list(titulo = "Tres", base = "", superior_izquierda = .mp_graf("c"), inferior_izquierda = .mp_graf("d"),
                        derecha = .mp_graf("e"), icono = "ico-1", meta = list(motor_nativo = FALSE))),
    list(id = "s-p4", tipo = "p_slide_4_graficos_poblacion",
         payload = list(titulo = "PERFIL DEL DOCENTE", base = "", pie = "", etiqueta = "",
                        superior_izquierda = .mp_graf("f"), superior_derecha = .mp_graf("g"),
                        inferior_izquierda = .mp_graf("h"), inferior_derecha = .mp_graf("i"), icono = "ico-1"))
  ))
}
.mp_avisos <- function(expr) {
  avisos <- character()
  val <- withCallingHandlers(expr, message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  list(valor = val, avisos = grep("[PULSO-AVISO]", avisos, fixed = TRUE, value = TRUE))
}

test_that("los tres tipos de población antigua salen del selector y siguen registrados; los demás siguen en él", {
  viejos <- c("p_slide_2_graficos_poblacion", "p_slide_3_graficos_poblacion", "p_slide_4_graficos_poblacion")
  reg <- .graficos_registry_payload()
  sel <- setNames(vapply(reg$slides, function(s) isTRUE(s$en_selector), TRUE), vapply(reg$slides, `[[`, "", "name"))
  expect_false(any(sel[viejos]))
  expect_true(all(sel[setdiff(names(sel), viejos)]))
  cat <- .graficos_tipos_catalogo()
  sel_cat <- setNames(vapply(cat$slides, function(s) isTRUE(s$en_selector), TRUE), vapply(cat$slides, `[[`, "", "name"))
  expect_identical(sel_cat, sel)
  for (v in viejos) expect_true(v %in% .slide_names())
})

test_that("la migración lleva cada población antigua a su tipo vigente, gráfico por posición, sin perder texto", {
  r <- .mp_avisos(.graficos_migrar_poblacion_antigua(.mp_plan()))
  s <- setNames(r$valor$slides, vapply(r$valor$slides, `[[`, "", "id"))
  expect_identical(vapply(r$valor$slides, `[[`, "", "tipo"),
                   c("p_slide_portada", "p_slide_2_graficos", "p_slide_3_graficos_fila", "p_slide_4_graficos"))
  expect_identical(s$`s-port`, .mp_plan()$slides[[1]])
  expect_identical(s$`s-p2`$payload$izquierda, .mp_graf("a")); expect_identical(s$`s-p2`$payload$derecha, .mp_graf("b"))
  expect_identical(s$`s-p3`$payload$izquierda, .mp_graf("c")); expect_identical(s$`s-p3`$payload$centro, .mp_graf("d"))
  expect_identical(s$`s-p3`$payload$derecha, .mp_graf("e"))
  expect_null(s$`s-p3`$payload$superior_izquierda); expect_null(s$`s-p3`$payload$inferior_izquierda)
  for (k in c("superior_izquierda", "superior_derecha", "inferior_izquierda", "inferior_derecha")) {
    expect_identical(s$`s-p4`$payload[[k]], .mp_plan()$slides[[4]]$payload[[k]])
  }
  expect_identical(s$`s-p2`$payload$titulo, "Dos"); expect_identical(s$`s-p2`$payload$base, "Base: 52 docentes")
  expect_identical(s$`s-p3`$payload$meta, list(motor_nativo = FALSE, base_por_grafico = TRUE))
  expect_identical(s$`s-p4`$payload[c("titulo", "base", "pie", "etiqueta")], list(titulo = "PERFIL DEL DOCENTE", base = "", pie = "", etiqueta = ""))
  expect_identical(s$`s-p2`$id, "s-p2")
  # El ícono del centro es justo lo que sale: el tipo vigente no tiene ranura de ícono.
  expect_null(s$`s-p4`$payload$icono)
  # Los avisos viajan con el plan, no al stderr (test-graficos-migrar-poblacion-avisos.R): con tres láminas migradas,
  # una línea que nombra las tres.
  expect_length(r$avisos, 0L)
  av <- .graficos_avisos_migracion(r$valor)
  expect_length(av, 1L)
  expect_match(av, "«PERFIL DEL DOCENTE»", fixed = TRUE)
  expect_match(av, "^3 láminas")
})

test_that("la migración es idempotente: la segunda pasada no cambia nada ni avisa", {
  una <- .graficos_migrar_poblacion_antigua(.mp_plan(), avisar = FALSE)
  r <- .mp_avisos(.graficos_migrar_poblacion_antigua(una))
  expect_identical(r$valor, una)
  expect_length(r$avisos, 0L)
  expect_length(.graficos_avisos_migracion(r$valor), 0L)
})

test_that("dos gráficos con texto declarado van a la de narrativa para no perder el texto", {
  p <- list(slides = list(list(id = "x", tipo = "p_slide_2_graficos_poblacion",
                               payload = list(titulo = "T", texto = "La mayoría es docente a tiempo completo",
                                              izquierda = .mp_graf("a"), derecha = .mp_graf("b")))))
  s <- suppressMessages(.graficos_migrar_poblacion_antigua(p))$slides[[1]]
  expect_identical(s$tipo, "p_slide_2_graficos_narrativo")
  expect_identical(s$payload$texto, "La mayoría es docente a tiempo completo")
})

test_that("ida y vuelta: el normalizador de la config migra y el JSON guardado vuelve igual", {
  cfg1 <- suppressMessages(.graficos_normalize_config(list(plan = .mp_plan())))
  expect_identical(vapply(cfg1$plan$slides, `[[`, "", "tipo"),
                   c("p_slide_portada", "p_slide_2_graficos", "p_slide_3_graficos_fila", "p_slide_4_graficos"))
  json <- jsonlite::toJSON(cfg1, auto_unbox = TRUE, null = "null", na = "null")
  r <- .mp_avisos(.graficos_normalize_config(jsonlite::fromJSON(json, simplifyVector = FALSE)))
  expect_length(r$avisos, 0L)
  expect_identical(jsonlite::toJSON(r$valor$plan, auto_unbox = TRUE, null = "null"), jsonlite::toJSON(cfg1$plan, auto_unbox = TRUE, null = "null"))
})

test_that("las láminas migradas se reconstruyen con el registro vigente y llevan todos sus gráficos", {
  plan <- suppressMessages(.graficos_migrar_poblacion_antigua(.mp_plan()))
  reg <- setNames(lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))), .slide_names())
  for (s in plan$slides[-1]) {
    sl <- .graficos_rebuild_slide_json(s, slide_registry = reg, graficador_registry = .graf_names())
    els <- Filter(function(x) inherits(x, "ppt_element"), sl$slots)
    expect_length(els, length(.slide_slots(s$tipo)))
    expect_identical(sl$title, s$payload$titulo)
  }
})

# La población llevaba la base de CADA gráfico (su nota al pie, o «N respuestas» en el panel nativo) y al pie de la
# lámina sólo la base declarada; el tipo vigente las juntaba al pie o, por la ruta anterior con bases distintas, las
# perdía. La migración marca `meta$base_por_grafico` y la lámina migrada conserva las mismas bases.
.mp_fixture <- function() {
  cargo <- c("Decano(a)", "Coordinador(a)", "Jefe(a)")
  df <- data.frame(cargo = rep(cargo, c(20, 50, 50)), anios = c(rep(c("Menos de 2", "Más de 2"), c(40, 60)), rep(NA, 20)),
                   sexo = rep(c("Mujer", "Hombre"), c(70, 50)), grado = c(rep(c("Magíster", "Doctor(a)"), c(30, 50)), rep(NA, 40)),
                   stringsAsFactors = FALSE)
  ch <- rbind(data.frame(list_name = "lc", name = cargo, label = cargo),
              data.frame(list_name = "la", name = c("Menos de 2", "Más de 2"), label = c("Menos de 2", "Más de 2")),
              data.frame(list_name = "ls", name = c("Mujer", "Hombre"), label = c("Mujer", "Hombre")),
              data.frame(list_name = "lg", name = c("Magíster", "Doctor(a)"), label = c("Magíster", "Doctor(a)")))
  inst <- list(survey = data.frame(name = c("cargo", "anios", "sexo", "grado"), type = paste("select_one", c("lc", "la", "ls", "lg")),
                                   list_name = c("lc", "la", "ls", "lg"), label = c("Cargo", "Años en el cargo", "Sexo", "Grado"),
                                   stringsAsFactors = FALSE), choices = ch, orders_list = NULL)
  list(df = df, inst = inst)
}
.mp_textos_base <- function(slide_json) {
  f <- .mp_fixture(); out <- tempfile(fileext = ".pptx")
  reg <- setNames(lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))), .slide_names())
  sl <- .graficos_rebuild_slide_json(slide_json, slide_registry = reg, graficador_registry = .graf_names())
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = p_plan(slides = list(sl)), path_ppt = out,
                                                     mensajes_progreso = FALSE)))
  x <- .pptx_leer_parte(out, .pptx_slide_paths(out)[[1]])
  t <- xml2::xml_text(xml2::xml_find_all(xml2::read_xml(x), "//a:t"))
  list(estado = .pptx_lamina_estado(x), bases = sort(unique(grep("^Base|respuestas$", trimws(t), value = TRUE))))
}

test_that("la lámina migrada conserva las bases de cada gráfico, nativa y por la ruta anterior", {
  g <- function(v) list(graficador = "p_barras_categoricas", args = list(var = v))
  for (nativo in c(TRUE, FALSE)) {
    meta <- if (nativo) list() else list(motor_nativo = FALSE)
    vieja <- list(id = "x", tipo = "p_slide_4_graficos_poblacion",
                  payload = list(titulo = "Perfil", base = "", superior_izquierda = g("cargo"), superior_derecha = g("anios"),
                                 inferior_izquierda = g("sexo"), inferior_derecha = g("grado"), meta = meta))
    nueva <- suppressMessages(.graficos_migrar_poblacion_antigua(list(slides = list(vieja))))$slides[[1]]
    expect_true(isTRUE(nueva$payload$meta$base_por_grafico))
    a <- .mp_textos_base(vieja); d <- .mp_textos_base(nueva)
    expect_identical(d$estado, a$estado, label = sprintf("estado (nativo = %s)", nativo))
    expect_identical(d$bases, a$bases, label = sprintf("bases (nativo = %s)", nativo))
    expect_true(length(a$bases) >= 2L)
  }
})

test_that("dos gráficos migrados conservan la base de cada uno y no la repiten al pie", {
  g <- function(v) list(graficador = "p_barras_categoricas", args = list(var = v))
  vieja <- list(id = "y", tipo = "p_slide_2_graficos_poblacion", payload = list(titulo = "Perfil", izquierda = g("anios"), derecha = g("grado")))
  nueva <- suppressMessages(.graficos_migrar_poblacion_antigua(list(slides = list(vieja))))$slides[[1]]
  a <- .mp_textos_base(vieja); d <- .mp_textos_base(nueva)
  # La migrada sale nativa (lamina_grilla_nativa.R): cada panel nombra su base bajo el enunciado («100 respuestas») y el pie
  # no afirma una común. Lo que se conserva es la base de cada gráfico, no el prefijo «Base:».
  sin_prefijo <- function(x) sort(sub("^Base: ", "", x))
  expect_identical(sin_prefijo(d$bases), sin_prefijo(a$bases))
  expect_identical(a$bases, c("Base: 100 respuestas", "Base: 80 respuestas"))
  expect_false(any(grepl("^Base:", d$bases)))
})
