source("setup-load-all.R")

# U4 (prueba con Arte): las miniaturas de las láminas de resumen insertadas decían «Sin datos» mientras la vista previa
# las dibujaba. El diagnóstico previo de la miniatura buscaba la variable «*» de `base$*` en los datos y la daba por
# «variable_fuera_de_base». Además el cierre con hallazgos no ponía sus láminas de origen en la huella de la caché.

.mr_inst <- function() list(
  survey = data.frame(name = paste0("p", 1:4), type = "select_one lk", list_name = "lk",
                      label = c("Reglamentos", "Biblioteca", "Salud", "Tutoría"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = "lk", name = c("1", "2", "3", "4", "9"),
                       label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información"),
                       stringsAsFactors = FALSE), orders_list = NULL)
.mr_base <- function(acuerdo) {
  d <- as.data.frame(lapply(acuerdo, function(k) c(rep(c("3", "4"), length.out = k), rep(c("1", "2", "9"), length.out = 20 - k))),
                     stringsAsFactors = FALSE)
  names(d) <- paste0("p", seq_along(acuerdo)); d
}
.mr_fuentes <- function() list(data_sources = list(docentes = .mr_base(c(18, 10, 16, 8)), estudiantes = .mr_base(c(17, 11, 9, 15))),
                               inst_sources = list(docentes = .mr_inst(), estudiantes = .mr_inst()))
.mr_g <- function(graficador, args) list(graficador = graficador, args = args)
.mr_sl <- function(id, graf) list(id = id, tipo = "p_slide_1_grafico", payload = list(titulo = id, grafico = graf))
.mr_slides <- function() list(
  .mr_sl("pan", .mr_g("p_panorama", list(vars = list("docentes$*", "estudiantes$*"), corte = list("3", "4")))),
  .mr_sl("cob", .mr_g("p_cobertura", list(universos = "Docentes: 23; Estudiantes: 30"))),
  .mr_sl("for", .mr_g("p_fortalezas", list(vars = list("docentes$*"), corte = list("3", "4"), n = 2))),
  .mr_sl("dum", .mr_g("p_dumbbell", list(bases = list("docentes", "estudiantes"), corte = list("3", "4"), estilo = "resumen",
                                         regla = list(tipo = "mayor_diferencia", n = 3)))),
  .mr_sl("div", .mr_g("p_barras_divergentes", list(vars = list("docentes$*", "estudiantes$*"), estilo = "resumen",
                                                   regla = list(tipo = "bajo_umbral", umbral = 60)))),
  list(id = "cie", tipo = "p_slide_cierre_hallazgos",
       payload = list(hallazgos = list(list(lamina = "dum", cifra = "diferencia:Salud", texto = "Brecha en salud")))))
.mr_ctx <- function(s, slides = .mr_slides(), src = .mr_fuentes()) {
  ctx <- .mini_contexto(s, data_sources = src$data_sources, inst_sources = src$inst_sources,
                        template_pptx = .graficos_resolve_template_pptx())
  if (identical(s$tipo, "p_slide_cierre_hallazgos")) { ctx$plan_slides <- slides; ctx$hash <- as.character(.mini_hash_lamina(ctx)) }
  ctx
}

test_that("las seis láminas de resumen no salen «Sin datos» en la miniatura (camino real del lote)", {
  raiz <- withr::local_tempdir()
  for (s in .mr_slides()) {
    it <- suppressWarnings(.mini_lote_item(.mr_ctx(s), raiz, list(preview_quality = "quick", render_slide_preview = FALSE,
                                                                  preview_partes = FALSE)))
    expect_false(identical(it$estado, "sin_datos"), label = s$id)
    expect_false(identical(it$estado, "error"), label = paste(s$id, it$error$message %||% ""))
    expect_identical(.mini_graficos_publico(.mini_entrada_leer(raiz, it$hash))$vacios, 0L, label = s$id)
  }
})

test_that("el diagnóstico de la miniatura: base$* está si su base está", {
  src <- .mr_fuentes()
  expect_true(is.na(.mini_motivo_grafico(list(vars = list("docentes$*")), NULL, src)))
  expect_identical(.mini_motivo_grafico(list(vars = list("egresados$*")), NULL, src), "variable_fuera_de_base")
})

test_that("la huella del cierre cambia si cambia una lámina de origen, no si cambia otra", {
  slides <- .mr_slides()
  cie <- slides[[6]]
  h0 <- .mr_ctx(cie, slides)$hash
  otra <- slides; otra[[1]]$payload$grafico$args$corte <- list("4")
  expect_identical(.mr_ctx(cie, otra)$hash, h0)
  origen <- slides; origen[[4]]$payload$grafico$args$regla$n <- 2
  expect_false(identical(.mr_ctx(cie, origen)$hash, h0))
})

test_that("con renderer, las miniaturas de resumen salen como imagen", {
  raiz <- withr::local_tempdir()
  it0 <- tryCatch(.mini_lote_item(.mr_ctx(.mr_slides()[[2]]), raiz, list(preview_quality = "quick", render_slide_preview = TRUE,
                                                                        preview_partes = FALSE)), error = function(e) NULL)
  skip_if(is.null(it0) || !identical(it0$estado, "ok"), "sin renderer de raster en este entorno")
  for (s in .mr_slides()[c(1, 5)]) {
    it <- suppressWarnings(.mini_lote_item(.mr_ctx(s), raiz, list(preview_quality = "quick", render_slide_preview = TRUE, preview_partes = FALSE)))
    expect_identical(it$estado, "ok", label = s$id)
  }
})
