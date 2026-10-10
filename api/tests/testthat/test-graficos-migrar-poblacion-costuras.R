# Costuras por las que un plan con población antigua llegaba al motor sin migrar (verificador de 593d588ff, R3).
#
# `/api/graficos/ppt` y `/api/graficos/word` toman el plan del body y sólo lo pasaban por `.normalize_plan`; el preflight
# del consolidado también. Un plan antiguo (un front viejo, un borrador, una config importada a mano) llegaba al worker
# como `p_slide_4_graficos_poblacion`. La migración vive en un único helper (graficos_migrar_poblacion.R) y
# `.normalize_plan` la aplica: todo camino que normaliza un plan sale con los tipos vigentes.

.mpc_graf <- function(var) list(graficador = "p_barras_categoricas", args = list(var = var))
.mpc_plan <- function() {
  list(slides = list(
    list(id = "s-p2", tipo = "p_slide_2_graficos_poblacion",
         payload = list(titulo = "Dos", izquierda = .mpc_graf("a"), derecha = .mpc_graf("b"), icono = "ico-1")),
    list(id = "s-p4", tipo = "p_slide_4_graficos_poblacion",
         payload = list(titulo = "Cuatro", superior_izquierda = .mpc_graf("c"), superior_derecha = .mpc_graf("d"),
                        inferior_izquierda = .mpc_graf("e"), inferior_derecha = .mpc_graf("f")))
  ))
}
.mpc_vigentes <- c("p_slide_2_graficos", "p_slide_4_graficos")
.mpc_tipos <- function(plan) vapply(plan$slides, function(s) s$tipo, "")

test_that(".normalize_plan migra la población antigua, también desde la forma data.frame del body", {
  expect_identical(.mpc_tipos(.normalize_plan(.mpc_plan())), .mpc_vigentes)
  json <- jsonlite::toJSON(.mpc_plan(), auto_unbox = TRUE)
  expect_identical(.mpc_tipos(.normalize_plan(jsonlite::fromJSON(json, simplifyVector = TRUE))), .mpc_vigentes)
  # Sin avisos pegados al plan por defecto: el plan normalizado se hashea (preflight del consolidado).
  expect_null(attr(.normalize_plan(.mpc_plan()), "avisos_migracion"))
})

# Llama a un endpoint de `mount_graficos` en proceso, con el job capturado en vez de lanzado.
.mpc_endpoint <- function(path, body, captura) {
  testthat::local_mocked_bindings(
    session_header = function(req) "sid-mpc",
    .require_rp_data = function(sid) list(),
    .graficos_effective_config = function(...) list(presets = list(), paletas = list()),
    .graficos_delivery_options = function(...) list(profile_id = NULL, template_id = NULL, auto_otros_slides = FALSE),
    .graficos_resolve_template_pptx = function(...) NA_character_,
    .graficos_processing_sources = function(sid) list(data_sources = list(), inst_sources = list()),
    job_save_rds = function(...) tempfile(),
    .graficos_icon_registry = function(...) list(),
    .graficos_active_base_name = function(sid) "",
    .graficos_export_filename = function(...) "x",
    .graficos_opciones_documento = function(...) list(),
    job_submit = function(sid, kind, func, args, ..., on_complete = NULL) {
      captura$args <- args; captura$on_complete <- on_complete; "job-mpc"
    },
    .package = "prosecnurapp"
  )
  pr <- mount_graficos(plumber::pr())
  endpoints <- unlist(pr$endpoints, recursive = FALSE)
  ep <- endpoints[[which(vapply(endpoints, function(e) e$path, "") == path)]]
  req <- new.env(parent = emptyenv())
  req$bodyRaw <- charToRaw(enc2utf8(as.character(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"))))
  res <- new.env(parent = emptyenv()); res$status <- 200L; res$setHeader <- function(...) invisible(NULL)
  ep$getFunc()(req, res)
}

test_that("/api/graficos/ppt y /word mandan al worker el plan con los tipos vigentes", {
  skip_if_not_installed("plumber")
  for (path in c("/api/graficos/ppt", "/api/graficos/word")) {
    captura <- new.env()
    r <- .mpc_endpoint(path, list(plan = .mpc_plan(), presets = list()), captura)
    expect_true(isTRUE(r$ok), label = path)
    expect_identical(.mpc_tipos(captura$args$plan), .mpc_vigentes, label = path)
  }
})

test_that("el preflight del consolidado devuelve el plan con los tipos vigentes", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  pf <- graficos_consolidado_preflight(sid, config = list(plan = .mpc_plan()))
  expect_identical(.mpc_tipos(pf$plan), .mpc_vigentes)
})
