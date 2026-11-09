# /api/graficos/diferencias y su informe probaban sólo la PRIMERA ranura con cruce de la lámina (`.sig_lamina_del_plan`).
# Desde 9402997b4 la familia de BH incluye toda ranura con cruce, con la base decidida por ranura: en una
# p_slide_4_graficos el PPT marcaba las ranuras 2..n y «Diferencias de esta lámina» no las mostraba. Ahora la respuesta
# trae `lamina$ranuras`, una entrada por ranura con cruce, probada sobre su base y contra la familia de su base; los
# campos de `lamina` siguen siendo los de la primera ranura (compatibilidad con el frontend).

.dr_inst <- function(grupos) {
  list(survey = data.frame(name = c("p3", "q5", "gedad"), type = c("select_one sn", "select_one sn", "select_one ge"),
                           label = c("P3", "Q5", "Edad"), stringsAsFactors = FALSE),
       choices = data.frame(list_name = c("sn", "sn", rep("ge", length(grupos))), name = c("1", "2", grupos),
                            label = c("Sí", "No", paste("Grupo", grupos)), stringsAsFactors = FALSE),
       orders_list = NULL)
}
.dr_ds <- function() {
  est <- data.frame(gedad = rep(c("x", "y", "z"), each = 100), stringsAsFactors = FALSE)
  est$p3 <- c(rep(c("1", "2"), c(75, 25)), rep(c("1", "2"), c(60, 40)), rep(c("1", "2"), c(40, 60)))
  est$q5 <- c(rep(c("1", "2"), c(55, 45)), rep(c("1", "2"), c(50, 50)), rep(c("1", "2"), c(35, 65)))
  set.seed(7)
  doc <- data.frame(gedad = sample(c("a", "b"), 120, TRUE), p3 = sample(c("1", "2"), 120, TRUE), stringsAsFactors = FALSE)
  doc$q5 <- c(rep(c("1", "2"), c(45, 15)), rep(c("1", "2"), c(20, 40)))[order(doc$gedad)]
  list(docentes = doc, estudiantes = est)
}
.dr_is <- function() list(docentes = .dr_inst(c("a", "b")), estudiantes = .dr_inst(c("x", "y", "z")))
.dr_regla <- list(prueba = "z", correccion = "bh_informe", umbral_puntos = 0, base_minima = 20)
.dr_slot <- function(var, cruce) list(graficador = "p_barras_agrupadas", args = list(var = var, cruces = cruce))
# Dos cruces de estudiantes, uno de docentes y una ranura sin cruce.
.dr_lam4 <- function() {
  list(id = "cuatro", tipo = "p_slide_4_graficos", payload = list(
    superior_izquierda = .dr_slot("estudiantes$p3", "estudiantes$gedad"),
    superior_derecha = list(graficador = "p_barras_categoricas", args = list(var = "estudiantes$p3")),
    inferior_izquierda = .dr_slot("estudiantes$q5", "estudiantes$gedad"),
    inferior_derecha = .dr_slot("docentes$q5", "docentes$gedad")))
}
.dr_plan <- function() list(slides = list(.dr_lam4(), list(id = "doc", payload = list(.dr_slot("p3", "gedad")))))
.dr_sesion <- function(ds, is, plan) {
  sid <- session_create()
  session_set(sid, "estudio", list(bases = stats::setNames(lapply(names(ds), function(n) list(nombre = n)), names(ds)),
                                   active_base = "docentes", processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", ds); session_set(sid, "rp_inst_sources", is)
  .graficos_config_set(sid, list(plan = plan, significancia = .dr_regla))
  sid
}
.dr_pr <- function() mount_graficos_diferencias(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
.dr_get <- function(pr, sid, path, query = "") {
  req <- as.environment(list(REQUEST_METHOD = "GET", PATH_INFO = path, QUERY_STRING = query,
                             HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid),
                             rook.input = list(read = function(...) raw(0), rewind = function() invisible(0), read_lines = function(...) character())))
  res <- pr$call(req)
  list(status = as.integer(res$status), body = jsonlite::fromJSON(as.character(res$body), simplifyVector = FALSE))
}
# Lo que marca el render del export para una ranura agrupada `var × gedad` de `base`.
.dr_render <- function(ds, is, base, var) {
  d <- ds[[base]]
  fuente <- structure(list(diseno = "independiente", var = var, survey = is[[base]]$survey, orders_list = NULL,
                           data = d, g = d$gedad, niveles = sort(unique(d$gedad)), base = base), class = "sig_fuente")
  cods <- sort(unique(d$gedad))
  n <- t(sapply(c("1", "2"), function(v) vapply(cods, function(g) sum(d[[var]] == v & d$gedad == g), numeric(1))))
  rownames(n) <- c("1", "2")
  .sig_evaluar_render(fuente, n, cods, paste("Grupo", cods))
}
.dr_p_ajustados <- function(pares) {
  clave <- vapply(pares, function(p) paste(p$fila, min(p$a, p$b), max(p$a, p$b)), "")
  stats::setNames(vapply(pares, function(p) as.numeric(p$p_ajustado %||% NA), 0), clave)
}
.dr_p_render <- function(ev) {
  let <- ev$letras
  a <- unname(let[ev$pares$a]); b <- unname(let[ev$pares$b])
  stats::setNames(signif(ev$pares$p_ajustado, 3), paste(ev$pares$fila, pmin(a, b), pmax(a, b)))
}

test_that("/diferencias: una entrada por ranura con cruce, cada una sobre su base y con el p ajustado del export", {
  skip_if_not_installed("plumber")
  ds <- .dr_ds(); is <- .dr_is(); plan <- .dr_plan()
  previa <- suppressMessages(.sig_informe_preparar(list(graficos_config = list(significancia = .dr_regla, plan = plan),
                                                        analitica_config = list()), ds, is, "docentes"))
  on.exit(options(previa), add = TRUE)
  sid <- .dr_sesion(ds, is, plan); on.exit(session_delete(sid), add = TRUE)
  r <- .dr_get(.dr_pr(), sid, "/api/graficos/diferencias", "slide=cuatro")
  expect_identical(r$status, 200L)
  rr <- r$body$lamina$ranuras
  expect_length(rr, 3L)
  expect_identical(vapply(rr, `[[`, "", "ranura"), c("superior_izquierda", "inferior_izquierda", "inferior_derecha"))
  expect_identical(vapply(rr, function(x) as.integer(x$indice), 0L), c(1L, 3L, 4L))
  expect_identical(vapply(rr, `[[`, "", "base"), c("estudiantes", "estudiantes", "docentes"))
  expect_identical(vapply(rr, `[[`, "", "variable"), c("p3", "q5", "q5"))
  expect_identical(vapply(rr, `[[`, "", "graficador"), rep("p_barras_agrupadas", 3))
  esperados <- list(.dr_render(ds, is, "estudiantes", "p3"), .dr_render(ds, is, "estudiantes", "q5"),
                    .dr_render(ds, is, "docentes", "q5"))
  for (k in seq_along(rr)) {
    insp <- .dr_p_ajustados(rr[[k]]$pares)
    exp_k <- .dr_p_render(esperados[[k]])
    expect_setequal(names(insp), names(exp_k))
    expect_equal(unname(insp[names(exp_k)]), unname(exp_k), tolerance = 1e-2)   # el serializador recorta decimales
    expect_identical(as.integer(esperados[[k]]$fuera_de_familia), 0L)
  }
  # La segunda ranura de estudiantes se ajusta en la familia de estudiantes (m = 2), no sola.
  p_crudo <- vapply(rr[[2]]$pares, function(p) as.numeric(p$p), 0)
  expect_false(isTRUE(all.equal(p_crudo, vapply(rr[[2]]$pares, function(p) as.numeric(p$p_ajustado), 0))))
})

test_that("/diferencias: los campos de `lamina` siguen siendo los de la primera ranura", {
  skip_if_not_installed("plumber")
  ds <- .dr_ds(); is <- .dr_is(); plan <- .dr_plan()
  sid <- .dr_sesion(ds, is, plan); on.exit(session_delete(sid), add = TRUE)
  pr <- .dr_pr()
  lam <- .dr_get(pr, sid, "/api/graficos/diferencias", "slide=cuatro")$body$lamina
  campos <- c("slide_id", "titulo", "estado", "activo", "motivo", "error", "variable", "cruce", "modo_letras",
              "grupos", "pares", "nota", "revisar")
  expect_true(all(campos %in% names(lam)))
  expect_identical(lam$slide_id, "cuatro")
  expect_identical(lam$variable, "p3")
  primera <- lam$ranuras[[1]]
  for (k in setdiff(names(lam), "ranuras")) if (k != "slide_id") expect_identical(lam[[k]], primera[[k]], info = k)
  # Las mismas cifras que daba la lámina antes de las ranuras: la de la base de su primera ranura.
  sc <- .sig_contexto_sesion(sid)
  sl <- .sig_contexto_por_lamina(sid, sc)(.dr_lam4())
  ref <- jsonlite::fromJSON(as.character(jsonlite::toJSON(.sig_lamina_json(.dr_lam4(), sl$fuente, sl$ctx),
                                                          auto_unbox = TRUE, null = "null", na = "null", digits = NA)),
                            simplifyVector = FALSE)
  expect_equal(.dr_p_ajustados(lam$pares), .dr_p_ajustados(ref$pares), tolerance = 1e-2)
  expect_identical(lam$estado, ref$estado)
  # Una lámina de una sola ranura trae una sola entrada.
  doc <- .dr_get(pr, sid, "/api/graficos/diferencias", "slide=doc")$body$lamina
  expect_length(doc$ranuras, 1L)
  expect_identical(doc$ranuras[[1]]$base, "docentes")
})

test_that("/diferencias/informe: cada lámina lista todas sus ranuras con cruce y el resumen las cuenta", {
  skip_if_not_installed("plumber")
  ds <- .dr_ds(); is <- .dr_is(); plan <- .dr_plan()
  sid <- .dr_sesion(ds, is, plan); on.exit(session_delete(sid), add = TRUE)
  pr <- .dr_pr()
  ri <- .dr_get(pr, sid, "/api/graficos/diferencias/informe")
  expect_identical(ri$status, 200L)
  ids <- vapply(ri$body$laminas, `[[`, "", "slide_id")
  expect_identical(ids, c("cuatro", "doc"))
  cuatro <- ri$body$laminas[[1]]
  expect_length(cuatro$ranuras, 3L)
  insp <- .dr_get(pr, sid, "/api/graficos/diferencias", "slide=cuatro")$body$lamina$ranuras
  for (k in 1:3) expect_identical(.dr_p_ajustados(cuatro$ranuras[[k]]$pares), .dr_p_ajustados(insp[[k]]$pares))
  expect_identical(as.integer(ri$body$resumen$cruces), 4L)
})

test_that("una ranura de base ambigua es una entrada con error; las demás se prueban", {
  skip_if_not_installed("plumber")
  ds <- .dr_ds(); is <- .dr_is()
  lam <- list(id = "amb", payload = list(a = .dr_slot("estudiantes$p3", "estudiantes$gedad"),
                                         b = .dr_slot("docentes$q5", "estudiantes$gedad")))
  sid <- .dr_sesion(ds, is, list(slides = list(lam))); on.exit(session_delete(sid), add = TRUE)
  r <- .dr_get(.dr_pr(), sid, "/api/graficos/diferencias", "slide=amb")
  expect_identical(r$status, 200L)
  rr <- r$body$lamina$ranuras
  expect_length(rr, 2L)
  expect_identical(rr[[1]]$base, "estudiantes")
  expect_identical(rr[[2]]$estado, "error")
  expect_identical(rr[[2]]$error$code, "E_SIG_BASE_AMBIGUA")
  expect_null(rr[[2]]$base)
})
