source("setup-load-all.R")

# «Excluir grupos» en los gráficos con «Dividir por» (graficos_excluir_grupos.R): el grupo excluido sale de las barras
# y de la base, la ruta de cifras con `detalle` lo refleja (el antes y el después del inspector) y la lámina lo dice en
# su pie. La referencia es el mismo gráfico filtrado a mano a los grupos que quedan.

.eg_inst <- function(rotulo_mujer = "Mujer") {
  lk <- c("1", "2", "3", "4", "5", "9")
  survey <- data.frame(type = c("select_one lk", "select_one sx"), name = c("q1", "sexo"), label = c("Reglamentos", "Sexo"),
                       stringsAsFactors = FALSE)
  choices <- data.frame(list_name = c(rep("lk", 6), rep("sx", 3)), name = c(lk, "1", "2", "3"),
                        label = c("Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo",
                                  "No sabe", "Hombre", rotulo_mujer, "Otro"), stringsAsFactors = FALSE)
  x <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(list(survey = survey, choices = choices), x)
  suppressMessages(reporte_instrumento(x))
}

# 84 casos entre Hombre y Mujer, 4 en «Otro» (pocos casos) y 2 sin sexo.
.eg_data <- function(seed = 3) {
  set.seed(seed)
  lk <- c("1", "2", "3", "4", "5", "9")
  data.frame(q1 = sample(lk, 90, TRUE), sexo = c(sample(c("1", "2"), 84, TRUE), rep("3", 4), NA, NA),
             stringsAsFactors = FALSE)
}

.eg_fuentes <- local({
  memo <- NULL
  function() {
    if (is.null(memo)) memo <<- list(data_sources = list(doc = .eg_data()), inst_sources = list(doc = .eg_inst()))
    memo
  }
})

.eg_render <- function(graficador, args, src = .eg_fuentes()) {
  el <- .rebuild_graf(list(graficador = graficador, args = args))
  out <- suppressMessages(suppressWarnings(reporte_ppt_plan(
    data = src$data_sources, instrumento = src$inst_sources,
    plan = p_plan(slides = list(p_slide_1_grafico(el, titulo = "Grupos"))), solo_lista = TRUE,
    build_render_meta = TRUE, mensajes_progreso = FALSE)))
  list(p = out$rendered[[1]], base = (out$render_meta[[1]] %||% list())$base %||% "")
}

.eg_det <- function(graficador, args, src = .eg_fuentes()) {
  suppressMessages(.graficos_cifras_de_grafico(graficador, args, src, detalle = TRUE))$detalle
}

.eg_filas <- function(det) stats::setNames(lapply(det$filas, function(f) vapply(f$valores, `[[`, "", "texto")),
                                           vapply(det$filas, `[[`, "", "rotulo"))

test_that("registro: excluir_grupos con la forma de p_histograma y formal de cada constructor", {
  ref <- Filter(function(a) identical(a$name, "excluir_grupos"), .GRAFICADORES_META$p_histograma$args)[[1]]
  for (g in c("p_barras_apiladas", "p_barras_agrupadas", "p_barras_multiapiladas")) {
    a <- Filter(function(a) identical(a$name, "excluir_grupos"), .GRAFICADORES_META[[g]]$args)
    expect_length(a, 1L)
    expect_identical(a[[1]]$tipo_input, ref$tipo_input, info = g)
    expect_identical(a[[1]]$grupo, ref$grupo, info = g)
    expect_true("excluir_grupos" %in% names(formals(get(g))), info = g)
  }
  multi <- Filter(function(a) identical(a$name, "excluir_grupos"), .GRAFICADORES_META$p_barras_multiapiladas$args)[[1]]
  expect_identical(unlist(multi$depende$valores), c("cruce", "var_cruce"))
  # Sin cruce no hay grupos: las divergentes no lo declaran.
  expect_false(any(vapply(.GRAFICADORES_META$p_barras_divergentes$args, function(a) identical(a$name, "excluir_grupos"), TRUE)))
})

test_that("apilada con cruce: sin el grupo, cifras y base son las del gráfico filtrado a los grupos que quedan", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  todos <- .eg_det("p_barras_apiladas", list(var = "doc$q1", cruces = "doc$sexo"))
  sin <- .eg_det("p_barras_apiladas", list(var = "doc$q1", cruces = "doc$sexo", excluir_grupos = list("3")))
  mano <- .eg_det("p_barras_apiladas", list(var = "doc$q1", cruces = "doc$sexo", filtros = list(sexo = c("1", "2"))))
  expect_identical(names(.eg_filas(todos)), c("Hombre", "Mujer", "Otro"))
  expect_identical(names(.eg_filas(sin)), c("Hombre", "Mujer"))
  expect_identical(.eg_filas(sin), .eg_filas(mano))
  # Los grupos que quedan no cambian: cada barra tiene su propio denominador.
  expect_identical(.eg_filas(sin), .eg_filas(todos)[c("Hombre", "Mujer")])
  d <- .eg_data()
  expect_identical(todos$base$texto, sprintf("Base: %d", sum(!is.na(d$sexo))))
  expect_identical(sin$base$texto, sprintf("Base: %d", sum(d$sexo %in% c("1", "2"))))
  expect_identical(sin$base$texto, mano$base$texto)
  # Paridad con el render: el detalle es lo que rotula la lámina.
  r <- .eg_render("p_barras_apiladas", list(var = "doc$q1", cruces = "doc$sexo", excluir_grupos = list("3")))
  esp <- attr(r$p, "pulso_espec", exact = TRUE)
  expect_identical(as.character(esp$filas$rotulo), c("Hombre", "Mujer"))
  expect_identical(unname(.eg_filas(sin)[["Hombre"]]), unname(esp$cifras[1, ]))
  expect_identical(r$base, sin$base$texto)
})

test_that("el grupo se pide por su rótulo, sin importar mayúsculas ni tildes", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  por_codigo <- .eg_det("p_barras_apiladas", list(var = "doc$q1", cruces = "doc$sexo", excluir_grupos = list("3")))
  por_rotulo <- .eg_det("p_barras_apiladas", list(var = "doc$q1", cruces = "doc$sexo", excluir_grupos = list("OTRO")))
  expect_identical(.eg_filas(por_rotulo), .eg_filas(por_codigo))
  expect_identical(por_rotulo$base, por_codigo$base)
})

test_that("multiapilada por cruce: mismo recorte que la apilada", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  sin <- .eg_det("p_barras_multiapiladas", list(modo = "cruce", var = "doc$q1", cruces = "doc$sexo", excluir_grupos = list("3")))
  mano <- .eg_det("p_barras_multiapiladas", list(modo = "cruce", var = "doc$q1", cruces = "doc$sexo", filtros = list(sexo = c("1", "2"))))
  expect_identical(names(.eg_filas(sin)), c("Hombre", "Mujer"))
  expect_identical(.eg_filas(sin), .eg_filas(mano))
  expect_identical(sin$base$texto, mano$base$texto)
})

test_that("agrupada con cruce: las series y sus bases son las del gráfico filtrado a mano", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  sin <- .eg_render("p_barras_agrupadas", list(var = "doc$q1", cruces = "doc$sexo", excluir_grupos = list("Otro")))
  mano <- .eg_render("p_barras_agrupadas", list(var = "doc$q1", cruces = "doc$sexo", filtros = list(sexo = c("1", "2"))))
  todos <- .eg_render("p_barras_agrupadas", list(var = "doc$q1", cruces = "doc$sexo"))
  series <- function(r) unname(unlist(attr(r$p, "pulso_barras_series", exact = TRUE)))
  expect_true("Otro" %in% series(todos))
  expect_false("Otro" %in% series(sin))
  expect_identical(series(sin), series(mano))
  expect_identical(attr(sin$p, "pulso_barras_bases", exact = TRUE), attr(mano$p, "pulso_barras_bases", exact = TRUE))
  expect_identical(sin$base, mano$base)
})

test_that("nota: el pie de la lámina nombra los grupos excluidos, y sólo cuando hay alguno", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  expect_identical(.excluir_grupos_nota("Otro"), "Excluye el grupo Otro.")
  expect_identical(.excluir_grupos_nota(c("Otro", "No sabe", "Mixto")), "Excluye los grupos Otro, No sabe y Mixto.")
  sin <- .eg_render("p_barras_apiladas", list(var = "doc$q1", cruces = "doc$sexo", excluir_grupos = list("3")))
  expect_identical(attr(sin$p, "note_outside", exact = TRUE), "Excluye el grupo Otro")
  todos <- .eg_render("p_barras_apiladas", list(var = "doc$q1", cruces = "doc$sexo"))
  expect_null(attr(todos$p, "note_outside", exact = TRUE))
  # Se anexa a la nota que ya traiga el gráfico, sin repetirse.
  el <- list(.excluir_grupos_aplicado = list(rotulos = "Otro"), overrides = list(nota_pie = "Fuente: encuesta 2026."))
  p <- .excluir_grupos_nota_al_grafico(el, structure(list(), class = "x"))
  expect_identical(attr(p, "note_outside"), "Fuente: encuesta 2026. Excluye el grupo Otro")
  expect_identical(attr(.excluir_grupos_nota_al_grafico(el, p), "note_outside"), attr(p, "note_outside"))
  # Un grupo pedido sin casos se avisa y no se nombra: la lámina sale con todos.
  nada <- .eg_render("p_barras_apiladas", list(var = "doc$q1", cruces = "doc$sexo", excluir_grupos = list("Mixto")))
  expect_null(attr(nada$p, "note_outside", exact = TRUE))
  src <- .eg_fuentes()
  el <- p_barras_apiladas("doc$q1", cruces = "doc$sexo", excluir_grupos = "Mixto")
  expect_message(out <- .excluir_grupos_elemento(el, src$data_sources, src$inst_sources, "doc"), "no hay casos en los grupos a excluir \"Mixto\"")
  expect_null(out$.excluir_grupos_aplicado)
})

test_that("multibase: el cruce sin calificar se lee en la base de la variable, no en la primera", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  inst <- .eg_inst()
  primera <- data.frame(q1 = rep("4", 20), stringsAsFactors = FALSE)   # sin la columna del cruce
  segunda <- .eg_data(seed = 11)
  src <- list(data_sources = list(b1 = primera, b2 = segunda), inst_sources = list(b1 = inst, b2 = inst))
  el <- p_barras_apiladas("b2$q1", cruces = "sexo", excluir_grupos = "3")
  out <- .excluir_grupos_elemento(el, src$data_sources, src$inst_sources, NA_character_)
  expect_identical(out$.excluir_grupos_aplicado$variable, "sexo")
  expect_identical(out$filtros, list(list(variable = "sexo", op = "notin", value = "3")))
  det <- .eg_det("p_barras_apiladas", list(var = "b2$q1", cruces = "sexo", excluir_grupos = list("3")), src = src)
  expect_identical(names(.eg_filas(det)), c("Hombre", "Mujer"))
  # El pie de una base que no es la única lleva su nombre: «Base: 84 b2».
  expect_identical(det$base$texto, sprintf("Base: %d b2", sum(segunda$sexo %in% c("1", "2"))))
  expect_identical(nrow(src$data_sources$b1), 20L)   # la hermana queda intacta
  # Un cruce calificado con otra base no se filtra: la regla caería sobre una columna ajena.
  el_ajeno <- p_barras_apiladas("b2$q1", cruces = "b1$sexo", excluir_grupos = "3")
  expect_message(o <- .excluir_grupos_elemento(el_ajeno, src$data_sources, src$inst_sources, NA_character_), "misma base")
  expect_null(o$.excluir_grupos_aplicado)
})

test_that("filtros: la lista nombrada pasa a reglas sin el NA fantasma; la coma no se arriesga", {
  expect_identical(.excluir_grupos_filtros_reglas(list(region = c("Lima", "Cusco"), current_code = NA)),
                   list(list(variable = "region", op = "in", value = "Lima,Cusco")))
  expect_null(.excluir_grupos_filtros_reglas(list(region = "Lima, Callao")))
  reglas <- list(list(variable = "x", op = "eq", value = "1"))
  expect_identical(.excluir_grupos_filtros_reglas(reglas), reglas)
  # Con filtros previos la regla se suma y el elemento conserva el filtro del analista.
  src <- .eg_fuentes()
  el <- p_barras_apiladas("doc$q1", cruces = "doc$sexo", excluir_grupos = "3", filtros = list(q1 = c("4", "5")))
  out <- .excluir_grupos_elemento(el, src$data_sources, src$inst_sources, "doc")
  expect_identical(out$filtros, list(list(variable = "q1", op = "in", value = "4,5"),
                                     list(variable = "sexo", op = "notin", value = "3")))
  # Sin cruce no hay grupos: el elemento sale igual y se avisa.
  expect_message(sin_cruce <- .excluir_grupos_elemento(p_barras_apiladas("doc$q1", excluir_grupos = "3"), src$data_sources,
                                                       src$inst_sources, "doc"), "no tiene \"Dividir por\"")
  expect_identical(sin_cruce$filtros, list())
  expect_null(sin_cruce$.excluir_grupos_aplicado)
})

# ---- revisión metodológica de b606cb545 -------------------------------------------------------------------------------

test_that("agrupada y multiapilada: la base pasa de todos los grupos a los que quedan", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  d <- .eg_data()
  todos <- .eg_render("p_barras_agrupadas", list(var = "doc$q1", cruces = "doc$sexo"))
  sin <- .eg_render("p_barras_agrupadas", list(var = "doc$q1", cruces = "doc$sexo", excluir_grupos = list("Otro")))
  expect_identical(todos$base, sprintf("Base: %d", sum(!is.na(d$sexo))))
  expect_identical(sin$base, sprintf("Base: %d", sum(d$sexo %in% c("1", "2"))))
  bt <- attr(todos$p, "pulso_barras_bases", exact = TRUE); bs <- attr(sin$p, "pulso_barras_bases", exact = TRUE)
  expect_identical(unname(unlist(bs)), unname(unlist(bt))[seq_along(unlist(bs))])   # los grupos que quedan, con su n
  mt <- .eg_det("p_barras_multiapiladas", list(modo = "cruce", var = "doc$q1", cruces = "doc$sexo"))
  ms <- .eg_det("p_barras_multiapiladas", list(modo = "cruce", var = "doc$q1", cruces = "doc$sexo", excluir_grupos = list("3")))
  expect_identical(.eg_filas(ms), .eg_filas(mt)[c("Hombre", "Mujer")])
  expect_identical(c(mt$base$texto, ms$base$texto), sprintf("Base: %d", c(sum(!is.na(d$sexo)), sum(d$sexo %in% c("1", "2")))))
})

test_that("con pesos: los grupos que quedan no cambian y la base es la del filtro a mano (los pesos no se recalibran)", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  dw <- .eg_data(); set.seed(5); dw$peso <- round(runif(nrow(dw), 0.3, 2.5), 3)
  srcw <- list(data_sources = list(doc = dw), inst_sources = list(doc = .eg_inst()))
  wt <- .eg_det("p_barras_apiladas", list(var = "doc$q1", cruces = "doc$sexo"), src = srcw)
  ws <- .eg_det("p_barras_apiladas", list(var = "doc$q1", cruces = "doc$sexo", excluir_grupos = list("3")), src = srcw)
  wm <- .eg_det("p_barras_apiladas", list(var = "doc$q1", cruces = "doc$sexo", filtros = list(sexo = c("1", "2"))), src = srcw)
  expect_identical(.eg_filas(ws), .eg_filas(wm))
  expect_identical(.eg_filas(ws), .eg_filas(wt)[c("Hombre", "Mujer")])
  expect_identical(ws$base, wm$base)
  pond <- function(det) vapply(det$filas, function(f) f$base$n_ponderado, 0)
  expect_equal(pond(ws), pond(wt)[1:2])
  expect_equal(pond(ws), c(sum(dw$peso[dw$sexo %in% "1"]), sum(dw$peso[dw$sexo %in% "2"])))
})

test_that("recodificada: los grupos se buscan en la columna que agrupa el render (`_recod`)", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  d <- .eg_data(); d$sexo_recod <- ifelse(d$sexo %in% c("2", "3"), "2", d$sexo)   # Mujer + Otro -> 2
  src <- list(data_sources = list(doc = d), inst_sources = list(doc = .eg_inst()))
  # "3" ya no es un grupo de la lámina: se avisa y nada cambia (antes dejaba el grupo 2 con 42 en vez de 46).
  el <- p_barras_apiladas("doc$q1", cruces = "doc$sexo", excluir_grupos = "3")
  expect_message(o <- .excluir_grupos_elemento(el, src$data_sources, src$inst_sources, "doc"), "no hay casos")
  expect_null(o$.excluir_grupos_aplicado)
  todos <- .eg_det("p_barras_apiladas", list(var = "doc$q1", cruces = "doc$sexo"), src = src)
  sin3 <- .eg_det("p_barras_apiladas", list(var = "doc$q1", cruces = "doc$sexo", excluir_grupos = list("3")), src = src)
  expect_identical(.eg_filas(sin3), .eg_filas(todos))
  # Un grupo de la recodificada sí se excluye, con la regla sobre ella, y el grupo que queda conserva su n.
  o1 <- .excluir_grupos_elemento(p_barras_apiladas("doc$q1", cruces = "doc$sexo", excluir_grupos = "1"),
                                 src$data_sources, src$inst_sources, "doc")
  expect_identical(o1$filtros, list(list(variable = "sexo_recod", op = "notin", value = "1")))
  sin1 <- .eg_det("p_barras_apiladas", list(var = "doc$q1", cruces = "doc$sexo", excluir_grupos = list("1")), src = src)
  expect_length(sin1$filas, 1L)
  expect_identical(.eg_filas(sin1), .eg_filas(todos)[2])
  expect_identical(sin1$base$texto, sprintf("Base: %d", sum(d$sexo_recod %in% "2")))
})

test_that("rótulos con tilde y ambigüedad: la tilde no impide casar; lo ambiguo no se excluye", {
  expect_identical(.excluir_grupos_clave(c("Educación", "EDUCACION ", "Otró")), c("educacion", "educacion", "otro"))
  cats <- data.frame(codigo = c("1", "2"), etiqueta = c("Educación", "Ingeniería"), stringsAsFactors = FALSE)
  r <- .excluir_grupos_resolver(c("educacion", "INGENIERIA"), cats, c("1", "2"))
  expect_identical(r$codigos, c("1", "2"))
  expect_identical(r$rotulos, c("Educación", "Ingeniería"))
  # Dos códigos con el mismo rótulo normalizado.
  r <- .excluir_grupos_resolver("otro", data.frame(codigo = c("1", "2", "3"), etiqueta = c("Hombre", "Otró", "Otro")), c("1", "2", "3"))
  expect_identical(r$ambiguos, "otro"); expect_length(r$codigos, 0L)
  # Código de uno y rótulo de otro: se pide el código.
  r <- .excluir_grupos_resolver("1", data.frame(codigo = c("1", "2", "3"), etiqueta = c("3", "1", "2")), c("1", "2", "3"))
  expect_identical(r$ambiguos, "1"); expect_length(r$codigos, 0L)
  # Código que coincide con su propio rótulo: no es ambiguo.
  r <- .excluir_grupos_resolver("1", data.frame(codigo = c("1", "2"), etiqueta = c("1", "2")), c("1", "2"))
  expect_identical(r$codigos, "1")
  skip_if_not_installed("openxlsx")
  inst <- .eg_inst(rotulo_mujer = "Otró")   # dos grupos que se escriben igual sin tilde
  src <- list(data_sources = list(doc = .eg_data()), inst_sources = list(doc = inst))
  expect_message(o <- .excluir_grupos_elemento(p_barras_apiladas("doc$q1", cruces = "doc$sexo", excluir_grupos = "Otro"),
                                               src$data_sources, src$inst_sources, "doc"), "más de un grupo")
  expect_null(o$.excluir_grupos_aplicado)
})

test_that("excluir todos los grupos no se aplica; un grupo vaciado por el filtro del analista no se nombra", {
  skip_if_not_installed("openxlsx")
  src <- .eg_fuentes()
  expect_message(o <- .excluir_grupos_elemento(p_barras_apiladas("doc$q1", cruces = "doc$sexo", excluir_grupos = c("1", "2", "3")),
                                               src$data_sources, src$inst_sources, "doc"), "sin grupos")
  expect_null(o$.excluir_grupos_aplicado); expect_identical(o$filtros, list())
  el <- p_barras_apiladas("doc$q1", cruces = "doc$sexo", excluir_grupos = c("2", "3"), filtros = list(sexo = c("1", "2")))
  expect_message(o <- .excluir_grupos_elemento(el, src$data_sources, src$inst_sources, "doc"), "no hay casos en los grupos a excluir \"3\"")
  expect_identical(o$.excluir_grupos_aplicado$rotulos, "Mujer")
})

test_that("el cruce heredado del preset de la agrupada se resuelve; sin cruce se avisa", {
  skip_if_not_installed("openxlsx")
  presets <- list(barras_agrupadas = list(args = list(cruces = "doc$sexo")))
  el <- p_barras_agrupadas("doc$q1", excluir_grupos = "3")
  expect_identical(.excluir_grupos_cruce_ref(el, presets), "doc$sexo")
  expect_null(.excluir_grupos_cruce_ref(el, NULL))
  src <- .eg_fuentes()
  o <- .excluir_grupos_elemento(el, src$data_sources, src$inst_sources, "doc", presets)
  expect_identical(o$.excluir_grupos_aplicado$rotulos, "Otro")
  expect_message(.excluir_grupos_elemento(el, src$data_sources, src$inst_sources, "doc", NULL), "no tiene \"Dividir por\"")
})

test_that("significancia: con un grupo excluido la nota dice que compara sólo los grupos mostrados (decisión 4, respaldo)", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  # Top Two Box: Hombre 84/140, Mujer 67/140, Otro 22/40. Con los tres grupos, Bonferroni sobre 3 pares no marca
  # Hombre-Mujer (p = 0,042); sin Otro, sobre 1 par, sí. La tabla de cruces compara los tres.
  mk <- function(n, k) c(rep("4", k - 10), rep("5", 10), rep("2", n - k - 10), rep("1", 10))
  d <- data.frame(q1 = c(mk(140, 84), mk(140, 67), mk(40, 22)), sexo = c(rep("1", 140), rep("2", 140), rep("3", 40)),
                  stringsAsFactors = FALSE)
  src <- list(data_sources = list(doc = d), inst_sources = list(doc = .eg_inst()))
  a <- list(modo = "cruce", var = "doc$q1", cruces = "doc$sexo", mostrar_significancia = TRUE, top2box = TRUE,
            overrides = list(top2box_labels = list("De acuerdo", "Muy de acuerdo")))
  todos <- .eg_render("p_barras_multiapiladas", a, src = src)
  sin <- .eg_render("p_barras_multiapiladas", c(a, list(excluir_grupos = list("3"))), src = src)
  nota <- function(r) as.character(attr(r$p, "pulso_sig_nota", exact = TRUE) %||% "")
  expect_false(grepl(.EXCLUIR_GRUPOS_NOTA_SIG, nota(todos), fixed = TRUE))
  expect_true(grepl("Bonferroni", nota(sin), fixed = TRUE))
  expect_true(endsWith(nota(sin), .EXCLUIR_GRUPOS_NOTA_SIG))
  # El aviso al analista, una vez por render.
  p <- structure(list(), pulso_sig_nota = "Prueba z, p < 0.05 con corrección de Bonferroni")
  expect_message(p2 <- .excluir_grupos_nota_sig(p, "sexo"), "entre los grupos mostrados")
  expect_identical(attr(p2, "pulso_sig_nota"), "Prueba z, p < 0.05 con corrección de Bonferroni. Diferencias entre los grupos mostrados.")
  expect_silent(p3 <- .excluir_grupos_nota_sig(p2, "sexo"))
  expect_identical(attr(p3, "pulso_sig_nota"), attr(p2, "pulso_sig_nota"))
  # Sin significancia, nada que decir.
  expect_silent(.excluir_grupos_nota_sig(structure(list(), class = "x"), "sexo"))
})
