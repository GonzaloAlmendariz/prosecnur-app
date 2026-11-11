source("setup-load-all.R")

# Pestaña Plantillas (checklist-pestana-plantillas-2026-11-11): la estructura del informe por sección y pregunta, y el
# gráfico elegido por pregunta.

.pp_plan <- function() {
  sep <- function(t) list(tipo = "p_slide_seccion", payload = list(titulo = t))
  q <- function(ref, titulo, sub = "") list(tipo = "p_slide_1_grafico", payload = list(
    titulo = titulo, grafico = list(graficador = "p_barras_agrupadas", args = list(var = ref, overrides = list(nota_pie = "Base", subtitulo = sub))))
  )
  list(
    ok = TRUE, profile_id = "acnur_kobo_cruncher_plus", warnings = list(),
    plan = list(slides = list(
      list(tipo = "p_slide_portada", payload = list(titulo = "Portada")),
      list(tipo = "p_slide_indice", payload = list(titulo = "Contenido")),
      sep("Consentimiento"), q("consent", "¿Acepta?"),
      sep("Parte 1"), q("miembros$sexo", "Sexo del miembro"),
      sep("Salud"), q("motivo", "Motivo", "1 de 2"), q("motivo", "Motivo", "2 de 2"), q("seguridad", "Seguridad")
    )),
    coverage = list(sources = list(
      list(name = "default", variables = list(
        list(name = "consent", tipo = "select_one sn", choices = list(list(name = "1", label = "Sí"), list(name = "0", label = "No"), list(name = "99", label = "Prefiere no responder"))),
        list(name = "motivo", tipo = "select_multiple m", choices = list(list(name = "a", label = "A"), list(name = "b", label = "B"))),
        list(name = "seguridad", tipo = "select_one s", choices = lapply(c("Muy seguro/a", "Bastante seguro/a", "Un poco inseguro/a", "Muy inseguro/a", "No sé"), function(x) list(name = x, label = x)))
      )),
      list(name = "miembros", variables = list(
        list(name = "sexo", tipo = "select_one sx", choices = list(list(name = "m", label = "Mujer"), list(name = "h", label = "Hombre"), list(name = "i", label = "Intersexual")))
      ))
    ))
  )
}

test_that("la estructura agrupa por sección, cuenta láminas y marca lo excluido", {
  visto <- NULL
  local_mocked_bindings(.graficos_suggested_plan = function(sid, config = NULL, alcance = NULL) { visto <<- config; .pp_plan() })
  cfg <- list(scope_rules = list(coverage_exclusions = list("consent"), grafico_por_pregunta = list(motivo = "barras")))
  e <- .graficos_estructura_informe("sid", cfg)
  expect_true(e$ok)
  expect_identical(length(visto$scope_rules$coverage_exclusions), 0L)   # la estructura se arma con todo dentro
  expect_null(visto$scope_rules$grafico_por_pregunta)
  expect_equal(e$laminas_fijas, 2L)
  expect_identical(vapply(e$secciones, `[[`, "", "titulo"), c("Consentimiento", "Parte 1", "Salud"))
  q <- unlist(lapply(e$secciones, `[[`, "preguntas"), recursive = FALSE); names(q) <- vapply(q, `[[`, "", "ref")
  expect_false(q$consent$dentro)
  expect_true(q$seguridad$dentro)
  expect_identical(q$consent$tipo, "Sí / No")            # "Prefiere no responder" no cambia el tipo
  expect_identical(q$seguridad$tipo, "Escala")
  expect_identical(q$motivo$tipo, "Opción múltiple")
  expect_equal(q$motivo$laminas, 2L)                     # una lista paginada suma sus láminas
  expect_identical(q$motivo$grafico, "barras")           # la elección del analista
  expect_identical(q$seguridad$grafico, "barras")
  expect_identical(unlist(q$seguridad$graficos_posibles), c("barras", "barra_100", "barras_verticales"))   # una escala no se ordena por frecuencia
  expect_true("torta" %in% unlist(q$consent$graficos_posibles))                                # la torta, sólo en Sí / No
  expect_true("barra_100" %in% unlist(q$consent$graficos_posibles))
  expect_false("torta" %in% unlist(q$motivo$graficos_posibles))
  expect_false("barra_100" %in% unlist(q$motivo$graficos_posibles))   # en opción múltiple las opciones no suman 100 %
  expect_true(q[["miembros$sexo"]]$por_registro)
  expect_false(q$motivo$por_registro)
})

test_that("el gráfico elegido se aplica a la lámina y una clave no comprobada se ignora", {
  slides <- .pp_plan()$plan$slides
  mapa <- .graficos_grafico_por_pregunta(list(scope_rules = list(grafico_por_pregunta = list(motivo = "barras_ordenadas", seguridad = "dona"))))
  expect_identical(names(mapa), "motivo")
  out <- .graficos_aplicar_grafico_por_pregunta(slides, mapa)
  m <- Filter(function(s) identical(s$payload$grafico$args$var, "motivo"), out)
  expect_length(m, 2L)
  for (s in m) {
    expect_identical(s$payload$grafico$args$overrides$orden_barras, "mayor_menor")
    expect_identical(s$payload$grafico$args$overrides$nota_pie, "Base")   # conserva la base
  }
  s <- Filter(function(s) identical(s$payload$grafico$args$var, "seguridad"), out)[[1]]
  expect_null(s$payload$grafico$args$overrides$orden_barras)
  expect_identical(.graficos_aplicar_grafico_por_pregunta(slides, list()), slides)
})

test_that("torta y columnas usan su graficador y conservan la base", {
  slides <- .pp_plan()$plan$slides
  mapa <- .graficos_grafico_por_pregunta(list(scope_rules = list(grafico_por_pregunta = list(consent = "torta", seguridad = "barras_verticales"))))
  out <- .graficos_aplicar_grafico_por_pregunta(slides, mapa)
  g <- function(ref) Filter(function(s) identical(s$payload$grafico$args$var, ref), out)[[1]]$payload$grafico
  expect_identical(g("consent")$graficador, "p_pie")
  expect_identical(g("consent")$args$overrides$tipo_pie, "pie")
  expect_identical(g("seguridad")$graficador, "p_barras_categoricas")
  expect_identical(g("seguridad")$args$overrides$nota_pie, "Base")
  # El perfil ACNUR da sus azules a la torta y a las columnas, no la paleta Pulso.
  pr <- .PPT_STYLE_PROFILES$acnur_kobo_cruncher_plus$presets
  expect_identical(pr$pie$colores_categorias[[1]], "#0072BC")
  expect_true(all(unlist(pr$barras_categoricas$colores_categorias) == "#0072BC"))
})

# El endpoint recibe el cuerpo como lo pasa plumber: los campos del JSON llegan también como argumentos con nombre. Sin
# `...` en el handler respondía E_INTERNAL "unused argument (config = ...)" (QA en vivo, 2026-11-11).
test_that("POST /api/graficos/plan/estructura acepta el cuerpo con config", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  local_mocked_bindings(session_header = function(req) sid, .graficos_suggested_plan = function(sid, config = NULL, alcance = NULL) .pp_plan())
  pr <- mount_graficos(plumber::pr())
  eps <- unlist(pr$endpoints, recursive = FALSE)
  ep <- eps[[which(vapply(eps, function(e) identical(e$path, "/api/graficos/plan/estructura") && "POST" %in% e$verbs, logical(1)))]]
  body <- list(config = list(scope_rules = list(coverage_exclusions = list("consent"))))
  req <- new.env(parent = emptyenv())
  req$bodyRaw <- charToRaw(enc2utf8(as.character(jsonlite::toJSON(body, auto_unbox = TRUE))))
  res <- new.env(parent = emptyenv()); res$status <- 200L; res$setHeader <- function(...) invisible(NULL)
  out <- ep$getFunc()(req, res, config = body$config)
  expect_identical(as.integer(res$status), 200L)
  expect_true(isTRUE(out$ok))
  expect_length(out$secciones, 3L)
})

test_that("las columnas sólo se ofrecen hasta seis opciones", {
  expect_true("barras_verticales" %in% .graficos_opciones_de_grafico("Opción única", 6L))
  expect_false("barras_verticales" %in% .graficos_opciones_de_grafico("Opción única", 8L))
  expect_true("barras_verticales" %in% .graficos_opciones_de_grafico("Escala", NA_integer_))
  expect_identical(.graficos_opciones_de_grafico("Opción múltiple", 3L), c("barras_ordenadas", "barras"))
})

test_that("la barra al 100 % va por las apiladas y conserva la base", {
  slides <- .pp_plan()$plan$slides
  out <- .graficos_aplicar_grafico_por_pregunta(slides, .graficos_grafico_por_pregunta(list(scope_rules = list(grafico_por_pregunta = list(seguridad = "barra_100")))))
  g <- Filter(function(s) identical(s$payload$grafico$args$var, "seguridad"), out)[[1]]$payload$grafico
  expect_identical(g$graficador, "p_barras_apiladas")
  expect_identical(g$args$overrides$nota_pie, "Base")
})

# P1: una lista sin paleta propia salía en el azul Pulso dentro de un informe ACNUR.
test_that("con plantilla de cliente la lista sin paleta toma los azules de la plantilla y el gris para la no respuesta", {
  withr::local_options(prosecnur.paleta_defecto = NULL)
  niveles <- c("Sí", "No", "No sabe", "Prefiere no responder")
  pulso <- .reporte_plan_pulso_palette_for_levels(niveles)
  expect_false(identical(unname(pulso[["Sí"]]), .ACNUR_PPT_COLORS$blue))   # sin plantilla de cliente, la del estándar

  .lam_motor_de_plantilla(list(meta = list()), "x/plantilla_acnur_16_9.pptx", "acnur_16_9")
  pal <- .reporte_plan_pulso_palette_for_levels(niveles)
  expect_identical(unname(pal[1:3]), c(.ACNUR_PPT_COLORS$blue, .ACNUR_PPT_COLORS$light_blue, .ACNUR_PPT_COLORS$control))
  expect_false(pal[[4]] %in% c(pal[[3]], .ACNUR_PPT_COLORS$gray))       # dos no respuestas, dos grises; ninguno el oscuro
  escala <- .reporte_plan_pulso_palette_for_levels(c("Muy seguro/a", "Bastante seguro/a", "Un poco inseguro/a", "Muy inseguro/a", "No sé"))
  expect_identical(unname(escala[[1]]), .ACNUR_PPT_COLORS$blue)
  expect_length(unique(unname(escala[1:4])), 4L)                         # cuatro azules distintos
  expect_identical(unname(escala[[5]]), .ACNUR_PPT_COLORS$control)

  # Una plantilla que no es de cliente apaga la paleta para la lámina que viene.
  .lam_motor_de_plantilla(list(meta = list()), "x/plantilla_pulso.pptx", "generic_16_9")
  expect_null(getOption("prosecnur.paleta_defecto"))
  expect_identical(.reporte_plan_pulso_palette_for_levels(niveles), pulso)
})

# Un RMS guardado como "rms.pulso" no dice ACNUR en el nombre; su Ficha del estudio sí (cliente).
test_that("el cliente de la Ficha del estudio marca el estudio como ACNUR", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  expect_false(.graficos_is_acnur_study(sid))
  local_mocked_bindings(.planner_leer = function(s) list(secciones = list(estudio = list(valor = list(nombre = "RMS 2026", codigo = "", cliente = "ACNUR Perú")))))
  expect_true(.graficos_is_acnur_study(sid))
})
