source("setup-load-all.R")

# ADR 0135, punto 5: una pregunta es de escala si su lista (firma de opciones) la comparten al menos tres preguntas de su
# base o si el estudio la declara ordinal. Medido en Arte: sin el criterio entraban «Rangos de edad», «Mayor grado
# académico» y «Categoría académica».

.re_ch <- function(lista, cods, etqs) data.frame(list_name = lista, name = cods, label = etqs, stringsAsFactors = FALSE)
.re_inst <- function() {
  acuerdo <- c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo",
               "Totalmente de acuerdo", "No tengo información suficiente")
  sat <- c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho")
  survey <- data.frame(
    name = c("gedad", "p4", "p6", paste0("b", 1:4), "s1", "s2", "t1", "t2", "c1", "c2", "c3"),
    type = c("select_one l_edad", "select_one l_grado", "select_one l_cat", rep("select_one l_acuerdo", 4),
             rep("select_one l_sat_a", 2), rep("select_one l_sat_b", 2), rep("select_one l_con", 3)),
    label = c("Rangos de edad", "Mayor grado académico", "Categoría académica", paste("Batería", 1:4),
              "Satisfacción con la biblioteca", "Satisfacción con la cafetería", "Satisfacción con el transporte",
              "Satisfacción con la limpieza", "Conocimiento del reglamento", "Conocimiento del plan", "Conocimiento del sílabo"),
    stringsAsFactors = FALSE)
  choices <- rbind(
    .re_ch("l_edad", as.character(1:5), c("Menos de 30", "30 a 39", "40 a 49", "50 a 59", "60 a más")),
    .re_ch("l_grado", as.character(1:5), c("Bachiller", "Licenciado", "Maestro", "Doctor", "Posdoctorado")),
    .re_ch("l_cat", as.character(1:4), c("Auxiliar", "Asociado", "Principal", "Contratado")),
    .re_ch("l_acuerdo", c(as.character(1:5), "9"), acuerdo),
    .re_ch("l_sat_a", as.character(1:4), sat),
    .re_ch("l_sat_b", as.character(1:4), sat),
    # «Ningún…» abre la escala: es su extremo, no una no respuesta.
    .re_ch("l_con", c(as.character(1:4), "9"), c("Ningún conocimiento", "Poco", "Algo", "Mucho", "No sabe")))
  list(survey = survey, choices = choices, orders_list = NULL)
}
.re_fuentes <- function(inst = .re_inst()) {
  set.seed(3)
  d <- as.data.frame(lapply(inst$survey$name, function(v) sample(as.character(1:4), 40, TRUE)), stringsAsFactors = FALSE)
  names(d) <- inst$survey$name
  list(data_sources = list(docentes = d), inst_sources = list(docentes = inst))
}

test_that("las demográficas de 4+ opciones únicas quedan fuera; la batería y las escalas que comparten firma entran", {
  src <- .re_fuentes()
  vs <- .regla_preguntas_de_base("docentes", c("3", "4"), src)
  expect_false(any(c("gedad", "p4", "p6") %in% vs))
  expect_true(all(paste0("b", 1:4) %in% vs))
  # s1-s2 (lista l_sat_a) y t1-t2 (l_sat_b) tienen la misma firma: cuatro preguntas, una batería.
  expect_true(all(c("s1", "s2", "t1", "t2") %in% vs))
  # «Ningún conocimiento» es sustantivo con el detector de la escala: 4 niveles, batería de 3.
  expect_true(all(c("c1", "c2", "c3") %in% vs))
})

test_that("la batería cuenta por firma, una variable y su _recod una sola vez", {
  inst <- .re_inst()
  bat <- .regla_escala_baterias(inst)
  expect_identical(bat[[.equiv_firma_escala(inst, "s1")]], 4L)
  expect_identical(bat[[.equiv_firma_escala(inst, "gedad")]], 1L)
  inst$survey <- rbind(inst$survey, data.frame(name = "gedad_recod", type = "select_one l_edad", label = "Edad", stringsAsFactors = FALSE))
  expect_identical(.regla_escala_baterias(inst)[[.equiv_firma_escala(inst, "gedad")]], 1L)
})

test_that("una lista declarada ordinal entra sin batería; una declarada nominal sale aunque forme batería", {
  inst <- .re_inst()
  inst$listas_ordinales_declaradas <- "l_grado"
  inst$listas_nominales <- "l_acuerdo"
  vs <- .regla_preguntas_de_base("docentes", character(0), .re_fuentes(inst))
  expect_true("p4" %in% vs)
  expect_false(any(paste0("b", 1:4) %in% vs))
  expect_false("gedad" %in% vs)
})

test_that("el mismo criterio rige en el panorama, las fortalezas, la regla y el emparejado", {
  src <- .re_fuentes()
  fuera <- c("gedad", "p4", "p6")
  pan <- .regla_preguntas_de_elemento(p_panorama(vars = "docentes$*", corte = c("3", "4"), regla = list(tipo = "todas")), src)
  expect_false(any(paste0("docentes$", fuera) %in% pan$vars))
  expect_identical(pan$evaluacion$total, 11L)
  fo <- .regla_preguntas_de_elemento(p_fortalezas(vars = "docentes$*", corte = c("3", "4"), n = 2), src)
  expect_false(any(fuera %in% sub("^docentes\\$", "", fo$evaluacion$candidatas$tema)))
  expect_false(any(paste0("docentes$", fuera) %in% .panorama_expandir("docentes$*", c("3", "4"), src)))
  src2 <- src
  src2$data_sources$estudiantes <- src$data_sources$docentes
  src2$inst_sources$estudiantes <- src$inst_sources$docentes
  em <- .graficos_emparejado(NULL, src2, c("docentes", "estudiantes"))
  expect_false(any(fuera %in% vapply(em$preguntas, `[[`, "", "var")))
})

test_that("el panorama explícito con una demográfica dice que no es de escala", {
  src <- .re_fuentes()
  el <- p_panorama(vars = c("docentes$b1", "docentes$gedad"), corte = c("3", "4"), regla = list(tipo = "todas"))
  r <- .regla_preguntas_de_elemento(el, src)
  expect_identical(r$vars, "docentes$b1")
  expect_match(paste(r$avisos, collapse = " "), "no son de escala|no es de escala|queda fuera")
})

test_that("Analítica estampa las listas declaradas ordinales en el instrumento de Gráficos", {
  src <- .re_fuentes()
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  local_mocked_bindings(.analitica_cfg_para_base = function(...) list(listas_ordinales = list(l_grado = TRUE, l_acuerdo = FALSE)))
  out <- .graficos_apply_orden_categorias_sources(sid, src)
  expect_identical(out$inst_sources$docentes$listas_ordinales_declaradas, "l_grado")
  expect_identical(out$inst_sources$docentes$listas_nominales, "l_acuerdo")
})
