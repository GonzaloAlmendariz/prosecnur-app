# ADR 0128 «Familia por base»: con `bh_informe`, cada ranura pertenece a la familia de SU base. El worker del export
# armaba una sola familia, la de la base activa: la lámina de otra base salía «fuera_de_familia», sin marcas y con aviso,
# mientras /api/graficos/diferencias (R12-2) sí la probaba sobre su base. Ahora el export arma una familia por base del
# plan con la misma regla, y el inspector y el export coinciden.

.fpb_inst <- function(grupos) {
  list(survey = data.frame(name = c("p3", "q5", "gedad"), type = c("select_one sn", "select_one sn", "select_one ge"),
                           label = c("P3", "Q5", "Edad"), stringsAsFactors = FALSE),
       choices = data.frame(list_name = c("sn", "sn", rep("ge", length(grupos))), name = c("1", "2", grupos),
                            label = c("Sí", "No", paste("Grupo", grupos)), stringsAsFactors = FALSE),
       orders_list = NULL)
}
# Estudiantes con una diferencia real por edad (x 75 % «Sí», z 40 %); docentes sin patrón.
.fpb_ds <- function() {
  est <- data.frame(gedad = rep(c("x", "y", "z"), each = 100), stringsAsFactors = FALSE)
  est$p3 <- c(rep(c("1", "2"), c(75, 25)), rep(c("1", "2"), c(60, 40)), rep(c("1", "2"), c(40, 60)))
  set.seed(7)
  doc <- data.frame(gedad = sample(c("a", "b"), 120, TRUE), p3 = sample(c("1", "2"), 120, TRUE), stringsAsFactors = FALSE)
  # q5 existe en las dos bases: es la pregunta que delata una familia armada con ranuras o Analítica de otra base.
  est$q5 <- c(rep(c("1", "2"), c(55, 45)), rep(c("1", "2"), c(50, 50)), rep(c("1", "2"), c(35, 65)))
  doc$q5 <- sample(c("1", "2"), 120, TRUE)
  list(docentes = doc, estudiantes = est)
}
.fpb_lam <- function(id, var, cruce) list(id = id, payload = list(list(graficador = "p_barras_agrupadas",
                                                                       args = list(var = var, cruces = cruce))))
.fpb_regla <- list(prueba = "z", correccion = "bh_informe", umbral_puntos = 0, base_minima = 20)
.fpb_sig_arg <- function(plan) {
  list(equivalencias_publicos = NULL,
       graficos_config = list(significancia = .fpb_regla, plan = plan),
       analitica_config = list(cruces_vars = list(), secciones = list(), cruces = list(cruces_vars = list())))
}
# La fuente que arma el render (`.sig_fuente_render`) para una lámina agrupada de la base `base`.
.fpb_render <- function(ds, is, base) {
  d <- ds[[base]]
  fuente <- structure(list(diseno = "independiente", var = "p3", survey = is[[base]]$survey, orders_list = NULL,
                           data = d, g = d$gedad, niveles = sort(unique(d$gedad)), base = base), class = "sig_fuente")
  cods <- sort(unique(d$gedad))
  n <- t(sapply(c("1", "2"), function(v) vapply(cods, function(g) sum(d$p3 == v & d$gedad == g), numeric(1))))
  rownames(n) <- c("1", "2")   # el render rotula con lo que tabula `.sig_indicadores` (aquí, el código)
  .sig_evaluar_render(fuente, n, cods, paste("Grupo", cods))
}
.fpb_get <- function(pr, sid, path, query = "") {
  req <- as.environment(list(REQUEST_METHOD = "GET", PATH_INFO = path, QUERY_STRING = query,
                             HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid),
                             rook.input = list(read = function(...) raw(0), rewind = function() invisible(0), read_lines = function(...) character())))
  res <- pr$call(req)
  list(status = as.integer(res$status), body = jsonlite::fromJSON(as.character(res$body), simplifyVector = FALSE))
}

test_that("export: la ranura de la base no activa entra en la familia de su base y marca como /diferencias", {
  skip_if_not_installed("plumber")
  ds <- .fpb_ds(); is <- list(docentes = .fpb_inst(c("a", "b")), estudiantes = .fpb_inst(c("x", "y", "z")))
  plan <- list(slides = list(.fpb_lam("est", "estudiantes$p3", "estudiantes$gedad"), .fpb_lam("doc", "p3", "gedad")))

  previa <- .sig_informe_preparar(.fpb_sig_arg(plan), ds, is, "docentes")
  on.exit(options(previa), add = TRUE)
  ev <- .fpb_render(ds, is, "estudiantes")
  expect_identical(as.integer(ev$fuera_de_familia), 0L)
  expect_true(all(is.finite(ev$pares$p_ajustado[ev$pares$elegible])))
  expect_true(any(ev$pares$veredicto %in% c("marcada", "fragil")))

  # El inspector, con la misma sesión y el mismo plan, da los mismos p ajustados y veredictos.
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "estudio", list(bases = list(docentes = list(nombre = "docentes"), estudiantes = list(nombre = "estudiantes")),
                                   active_base = "docentes", processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", ds); session_set(sid, "rp_inst_sources", is)
  .graficos_config_set(sid, list(plan = plan, significancia = .fpb_regla))
  pr <- mount_graficos_diferencias(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  r <- .fpb_get(pr, sid, "/api/graficos/diferencias", "slide=est")
  expect_identical(r$status, 200L)
  pj <- r$body$lamina$pares
  clave <- function(f, a, b) paste(f, pmin(a, b), pmax(a, b))
  insp <- stats::setNames(vapply(pj, function(p) as.numeric(p$p_ajustado %||% NA), 0),
                          vapply(pj, function(p) clave(p$fila, p$a, p$b), ""))
  ver_insp <- stats::setNames(vapply(pj, function(p) p$veredicto, ""), names(insp))
  let <- ev$letras
  k <- clave(ev$pares$fila, unname(let[ev$pares$a]), unname(let[ev$pares$b]))
  expect_setequal(k, names(insp))
  expect_equal(signif(ev$pares$p_ajustado, 3), unname(insp[k]), tolerance = 1e-2)   # el JSON recorta decimales
  expect_identical(ev$pares$veredicto, unname(ver_insp[k]))

  # El informe usa las mismas familias que /diferencias.
  ri <- .fpb_get(pr, sid, "/api/graficos/diferencias/informe")
  est <- Filter(function(l) identical(l$slide_id, "est"), ri$body$laminas)[[1]]
  expect_identical(vapply(est$pares, function(p) as.numeric(p$p_ajustado %||% NA), 0), unname(insp))
})

test_that("export de una sola base: la opción y las marcas no cambian", {
  ds <- list(principal = .fpb_ds()$estudiantes); is <- list(principal = .fpb_inst(c("x", "y", "z")))
  plan <- list(slides = list(.fpb_lam("est", "p3", "gedad")))
  sig <- .fpb_sig_arg(plan)
  previa <- .sig_informe_preparar(sig, ds, is, "principal")
  on.exit(options(previa), add = TRUE)
  opt <- getOption("prosecnur.sig_informe")
  expect_null(opt$familias)
  ref <- .sig_contexto_estudio(ds$principal, is$principal, sig$graficos_config, sig$analitica_config)
  expect_identical(opt$familia, ref$familia)
  expect_identical(opt$m, ref$m)
  ev <- .fpb_render(ds, is, "principal")
  expect_identical(as.integer(ev$fuera_de_familia), 0L)
  # Con la fuente sin base (como antes de este cambio) la evaluación es idéntica.
  f0 <- ds$principal
  fuente0 <- structure(list(diseno = "independiente", var = "p3", survey = is$principal$survey, orders_list = NULL,
                            data = f0, g = f0$gedad, niveles = c("x", "y", "z")), class = "sig_fuente")
  n <- t(sapply(c("1", "2"), function(v) vapply(c("x", "y", "z"), function(g) sum(f0$p3 == v & f0$gedad == g), numeric(1))))
  rownames(n) <- c("1", "2")   # el render rotula con lo que tabula `.sig_indicadores` (aquí, el código)
  ev0 <- .sig_evaluar_render(fuente0, n, c("x", "y", "z"), paste("Grupo", c("x", "y", "z")))
  expect_identical(ev$pares, ev0$pares)
})

test_that("el plan de una base: las ranuras de otra base no entran en su familia; una sola base no se filtra", {
  b <- c("docentes", "estudiantes")
  plan <- list(slides = list(.fpb_lam("est", "estudiantes$p3", "estudiantes$gedad"), .fpb_lam("doc", "p3", "gedad"),
                             .fpb_lam("rota", "egresados$p3", "egresados$gedad")))
  ids <- function(p) vapply(p$slides, `[[`, "", "id")
  expect_identical(ids(.sig_plan_de_base(plan, "estudiantes", "docentes", b)), "est")
  expect_identical(ids(.sig_plan_de_base(plan, "docentes", "docentes", b)), "doc")
  expect_identical(.sig_plan_de_base(plan, "principal", "principal", "principal"), plan)
  expect_identical(.sig_bases_del_plan(plan, "docentes", b), "estudiantes")
})

# --- Revisión metodológica de 37502207f: una regla por informe, Analítica en su base, bases ambiguas -----------------

.fpb_is <- function() list(docentes = .fpb_inst(c("a", "b")), estudiantes = .fpb_inst(c("x", "y", "z")))
.fpb_sesion <- function(ds, is, plan, regla = .fpb_regla, activa = "docentes", ac = NULL) {
  sid <- session_create()
  session_set(sid, "estudio", list(bases = stats::setNames(lapply(names(ds), function(n) list(nombre = n)), names(ds)),
                                   active_base = activa, processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", ds); session_set(sid, "rp_inst_sources", is)
  .graficos_config_set(sid, list(plan = plan, significancia = regla))
  if (!is.null(ac)) .analitica_config_set(sid, ac)
  sid
}
.fpb_pr <- function() mount_graficos_diferencias(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
.fpb_p_crudos <- function(d, inst, vars, regla) {
  f <- .sig_fuente(d, inst)
  unlist(lapply(vars, function(v) .sig_p_para_familia(.sig_evaluar_pregunta(f, v, "gedad", regla))))
}

test_that("BH exacto: la familia de la base no activa son SUS ranuras, con m exacto (activa no es la primera)", {
  skip_if_not_installed("plumber")
  ds <- .fpb_ds()[c("estudiantes", "docentes")]; is <- .fpb_is()[c("estudiantes", "docentes")]
  # q5 de docentes también existe en estudiantes: si entrara a la familia de estudiantes, m pasaría de 2 a 4 p.
  plan <- list(slides = list(.fpb_lam("est", "estudiantes$p3", "estudiantes$gedad"), .fpb_lam("doc", "p3", "gedad"),
                             .fpb_lam("doc5", "docentes$q5", "docentes$gedad")))
  previa <- .sig_informe_preparar(.fpb_sig_arg(plan), ds, is, "docentes")
  on.exit(options(previa), add = TRUE)
  opt <- getOption("prosecnur.sig_informe")
  regla <- .sig_regla_normalizar(.fpb_regla)
  p_est <- .fpb_p_crudos(ds$estudiantes, is$estudiantes, "p3", regla)
  p_doc <- .fpb_p_crudos(ds$docentes, is$docentes, c("p3", "q5"), regla)
  expect_identical(opt$familias$estudiantes$m, length(p_est))
  expect_identical(opt$m, length(p_doc))
  ev <- .fpb_render(ds, is, "estudiantes")
  esperado <- stats::p.adjust(p_est, "BH")
  expect_equal(ev$pares$p_ajustado[ev$pares$elegible], esperado[match(ev$pares$p[ev$pares$elegible], p_est)])
  ev_doc <- .fpb_render(ds, is, "docentes")
  expect_equal(ev_doc$pares$p_ajustado[ev_doc$pares$elegible],
               stats::p.adjust(p_doc, "BH")[match(ev_doc$pares$p[ev_doc$pares$elegible], p_doc)])

  # Inspector = export, con la activa en segundo lugar.
  sid <- .fpb_sesion(ds, is, plan); on.exit(session_delete(sid), add = TRUE)
  pr <- .fpb_pr()
  for (caso in list(list(id = "est", ev = ev), list(id = "doc", ev = ev_doc))) {
    r <- .fpb_get(pr, sid, "/api/graficos/diferencias", paste0("slide=", caso$id))
    expect_identical(r$status, 200L)
    insp <- vapply(r$body$lamina$pares, function(p) as.numeric(p$p_ajustado %||% NA), 0)
    expect_equal(sort(insp), sort(signif(caso$ev$pares$p_ajustado, 3)), tolerance = 1e-2)
  }
})

test_that("una regla por informe: sin regla guardada se propone sobre todas las bases, sin depender del orden", {
  skip_if_not_installed("plumber")
  ds <- .fpb_ds(); is <- .fpb_is()
  ds$estudiantes$aula <- rep(sprintf("A%02d", 1:30), each = 10)   # sólo estudiantes trae conglomerado
  plan <- list(slides = list(.fpb_lam("est", "estudiantes$p3", "estudiantes$gedad"), .fpb_lam("doc", "p3", "gedad")))
  sig <- .fpb_sig_arg(plan); sig$graficos_config$significancia <- NULL
  reglas <- lapply(list(c("docentes", "estudiantes"), c("estudiantes", "docentes")), function(orden) {
    previa <- .sig_informe_preparar(sig, ds[orden], is[orden], "docentes")
    on.exit(options(previa))
    getOption("prosecnur.sig_informe")$regla
  })
  expect_identical(reglas[[1]], reglas[[2]])
  expect_identical(reglas[[1]]$prueba, "rao_scott")
  expect_identical(reglas[[1]]$correccion, "bh_informe")
  expect_identical(reglas[[1]]$conglomerado, "aula")
  # El inspector propone la misma, con la activa (docentes, sin aula) y con la base de la ranura.
  sid <- .fpb_sesion(ds, is, plan, regla = NULL); on.exit(session_delete(sid), add = TRUE)
  r <- .fpb_get(.fpb_pr(), sid, "/api/graficos/diferencias/regla")
  expect_identical(r$body$regla$prueba, "rao_scott")
  expect_identical(r$body$propuesta$conglomerado, "aula")
  expect_identical(.sig_contexto_sesion(sid, base = "estudiantes")$ctx$regla, reglas[[1]])
  expect_identical(.sig_contexto_sesion(sid)$ctx$regla, reglas[[1]])
})

test_that("una base sin ranuras: la activa sin ranuras tiene familia vacía; sin otras bases no viajan familias", {
  ds <- .fpb_ds(); is <- .fpb_is()
  solo_est <- list(slides = list(.fpb_lam("est", "estudiantes$p3", "estudiantes$gedad")))
  previa <- .sig_informe_preparar(.fpb_sig_arg(solo_est), ds, is, "docentes")
  on.exit(options(previa), add = TRUE)
  opt <- getOption("prosecnur.sig_informe")
  expect_identical(as.integer(opt$m), 0L)
  expect_identical(opt$familias$estudiantes$m, 3L)
  expect_identical(as.integer(.fpb_render(ds, is, "estudiantes")$fuera_de_familia), 0L)

  solo_doc <- list(slides = list(.fpb_lam("doc", "p3", "gedad")))
  .sig_informe_preparar(.fpb_sig_arg(solo_doc), ds, is, "docentes")
  opt <- getOption("prosecnur.sig_informe")
  expect_null(opt$familias)
  expect_identical(opt$base_familia, "docentes")
  expect_identical(as.integer(.fpb_render(ds, is, "docentes")$fuera_de_familia), 0L)
  # La lámina de estudiantes no tiene familia en este informe: no se marca y lo dice.
  expect_message(ev <- .fpb_render(ds, is, "estudiantes"), "no tiene familia")
  expect_true(all(ev$pares$veredicto[ev$pares$elegible] == "fuera_de_familia"))
})

test_that("base ambigua o desconocida: no entra en ninguna familia y avisa (export, /diferencias e informe)", {
  skip_if_not_installed("plumber")
  ds <- .fpb_ds(); is <- .fpb_is()
  b <- names(ds)
  mixta <- .fpb_lam("mixta", "docentes$q5", "estudiantes$gedad")
  dos <- list(id = "dos", payload = list(.fpb_lam("", "docentes$p3", "docentes$gedad")$payload[[1]],
                                         .fpb_lam("", "estudiantes$p3", "estudiantes$gedad")$payload[[1]]))
  pelada <- .fpb_lam("pel", "q5", "estudiantes$gedad")
  for (s in list(mixta, dos)) {
    expect_identical(tryCatch(.sig_base_de_lamina(s, b, "docentes"), error = function(e) e$code), "E_SIG_BASE_AMBIGUA")
  }
  expect_identical(tryCatch(.sig_base_de_lamina(pelada, b, "docentes"), error = function(e) e$code), "E_SIG_BASE_AMBIGUA")
  expect_identical(.sig_base_de_lamina(pelada, b, "estudiantes"), "estudiantes")
  rota <- .fpb_lam("rota", "egresados$p3", "egresados$gedad")
  plan <- list(slides = list(.fpb_lam("est", "estudiantes$p3", "estudiantes$gedad"), mixta, dos, rota))
  for (base in c("docentes", "estudiantes")) {
    expect_identical(vapply(.sig_plan_de_base(plan, base, "docentes", b)$slides, `[[`, "", "id"),
                     if (base == "estudiantes") "est" else character(0))
  }
  msgs <- testthat::capture_messages(previa <- .sig_informe_preparar(.fpb_sig_arg(plan), ds, is, "docentes"))
  on.exit(options(previa), add = TRUE)
  expect_true(any(grepl("«mixta».*E_SIG_BASE_AMBIGUA", msgs)))
  expect_true(any(grepl("«dos».*E_SIG_BASE_AMBIGUA", msgs)))
  expect_true(any(grepl("«rota».*E_SIG_BASE_DESCONOCIDA", msgs)))
  # q5 × gedad de la lámina mixta no entra a la familia de estudiantes (m = 3, sólo «est»).
  expect_identical(getOption("prosecnur.sig_informe")$familias$estudiantes$m, 3L)

  sid <- .fpb_sesion(ds, is, plan); on.exit(session_delete(sid), add = TRUE)
  pr <- .fpb_pr()
  r <- .fpb_get(pr, sid, "/api/graficos/diferencias", "slide=mixta")
  expect_identical(r$status, 409L)
  expect_identical(r$body$error$code %||% r$body$code, "E_SIG_BASE_AMBIGUA")
  ri <- .fpb_get(pr, sid, "/api/graficos/diferencias/informe")
  expect_identical(ri$status, 200L)
  codigos <- stats::setNames(vapply(ri$body$laminas, function(l) as.character(l$error$code %||% NA), ""),
                             vapply(ri$body$laminas, `[[`, "", "slide_id"))
  expect_identical(unname(codigos[c("mixta", "dos", "rota")]),
                   c("E_SIG_BASE_AMBIGUA", "E_SIG_BASE_AMBIGUA", "E_SIG_BASE_DESCONOCIDA"))
  expect_true(is.na(codigos[["est"]]))
})

test_that("Analítica con cruces entra sólo en la familia de la base de su config (la activa)", {
  skip_if_not_installed("plumber")
  ds <- .fpb_ds(); is <- .fpb_is()
  ol <- list(q5 = list(names = c("1", "2"), labels = c("1", "2")))
  is$docentes$orders_list <- ol; is$estudiantes$orders_list <- ol
  ac <- list(cruces_vars = list("gedad"), secciones = list(list(variables = list("q5"))),
             cruces = list(cruces_vars = list()))
  plan <- list(slides = list(.fpb_lam("est", "estudiantes$p3", "estudiantes$gedad"), .fpb_lam("doc", "p3", "gedad")))
  sig <- .fpb_sig_arg(plan); sig$analitica_config <- ac
  previa <- .sig_informe_preparar(sig, ds, is, "docentes")
  on.exit(options(previa), add = TRUE)
  opt <- getOption("prosecnur.sig_informe")
  regla <- .sig_regla_normalizar(.fpb_regla)
  # Activa: p3 (lámina) + q5 (Analítica), 1 p cada una con dos grupos. Estudiantes: sólo p3, aunque tenga q5 y gedad.
  expect_identical(opt$m, length(.fpb_p_crudos(ds$docentes, is$docentes, c("p3", "q5"), regla)))
  expect_identical(opt$familias$estudiantes$m, length(.fpb_p_crudos(ds$estudiantes, is$estudiantes, "p3", regla)))
  # El inspector arma las mismas dos familias.
  sid <- .fpb_sesion(ds, is, plan, ac = ac); on.exit(session_delete(sid), add = TRUE)
  expect_identical(.sig_contexto_sesion(sid)$ctx$m, opt$m)
  expect_identical(.sig_contexto_sesion(sid, base = "estudiantes")$ctx$m, opt$familias$estudiantes$m)
  expect_identical(.sig_contexto_sesion(sid, base = "estudiantes")$ctx$familia, opt$familias$estudiantes$familia)
})
