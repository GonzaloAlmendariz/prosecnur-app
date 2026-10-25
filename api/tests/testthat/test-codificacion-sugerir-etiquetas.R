# TXT-20 (CCSS, 2026-10-25): la sugerencia de módulo devuelve, además de la `etiqueta` recortada a 90 caracteres
# (contrato previo, intacto), la `etiqueta_completa` de cada subtema y una `etiqueta_corta` con la misma regla del
# frontend (`rotuloCortoSubtema`, sugerenciasModulo.ts). Con la etiqueta recortada el frontend no podía sacar
# «docentes» de «…sobre la relación entre…». TXT-22: «carrera» no ancla un comentario a un módulo.

source("setup-load-all.R")

.se_xlsform <- function() {
  path <- file.path(tempfile("codif-sugerir-etq-"), "f.xlsx")
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  larga <- paste("¿Qué tan de acuerdo estás con las siguientes afirmaciones sobre la relación entre estudiantes y",
                 "docentes de la Facultad durante el ciclo académico?")
  survey <- data.frame(
    type = c("begin_group", "select_one carrera", "note", "select_one acuerdo", "select_one acuerdo",
             "note", "select_one frec", "select_one frec", "end_group",
             "begin_group", "select_one acuerdo", "text", "end_group",
             "begin_group", "text", "end_group"),
    name = c("modulo_a", "a1", "enunciado_a2", "a2_1", "a2_2",
             "enunciado_a3", "a3_1", "a3_2", NA,
             "modulo_b", "b1", "b2", NA,
             "modulo_coment", "coment", NA),
    label = c("MÓDULO A. EXPERIENCIA UNIVERSITARIA", "¿En qué carrera estás matriculado?", larga,
              "Los profesores responden mis dudas", "Los docentes me tratan con respeto",
              "¿Con qué frecuencia utilizas las siguientes redes sociales y plataformas digitales?", "WhatsApp", "Instagram", NA,
              "MÓDULO B. TRÁMITES", "Los trámites de matrícula y pagos son sencillos", "¿Qué trámite te costó más?", NA,
              "Comentarios", "¿Algún comentario final?", NA),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("carrera", "carrera", "acuerdo", "acuerdo", "frec", "frec"),
    name = c("1", "2", "1", "2", "1", "2"),
    label = c("Economía", "Sociología", "De acuerdo", "En desacuerdo", "Nunca", "Siempre"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey"); openxlsx::writeData(wb, "survey", survey)
  openxlsx::addWorksheet(wb, "choices"); openxlsx::writeData(wb, "choices", choices)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  list(path = path, larga = larga)
}

.se_data <- function() {
  data.frame(
    `_uuid` = paste0("w", 1:6),
    coment = c(
      "Los profesores no responden las dudas y algunos docentes tratan mal",
      "Paso todo el día en WhatsApp e Instagram",
      "Los docentes deberían tratar con más respeto",
      "Los trámites de matrícula son lentos",
      "En mi carrera los trámites de pagos demoran",
      "nada"
    ),
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

.se_mod <- function(out, codigo) Find(function(m) identical(m$codigo, codigo), out$modulos)

test_that("rótulo corto de subtema: misma regla y mismos casos que rotuloCortoSubtema del frontend", {
  casos <- c(
    "Experiencia universitaria: preguntas generales" = "Preguntas generales",
    "¿Con qué frecuencia utilizas las siguientes redes sociales y plataformas digitales?" = "Redes sociales y plataformas",
    "¿Con qué frecuencia utilizas las siguientes herramientas de inteligencia artificial…" = "Herramientas de inteligencia artificial",
    "¿Cómo te definirías como estudiante en los siguientes bloques? Selecciona la opción que…" = "Como estudiante",
    "¿Cómo valoras los recursos que ofrece la Facultad?" = "Recursos de la Facultad",
    "¿Qué tan de acuerdo estás con las siguientes afirmaciones sobre tu comodidad para…" = "Tu comodidad",
    "¿Qué tan de acuerdo estás con las siguientes afirmaciones sobre la relación entre…" = "La relación",
    "¿Qué tan de acuerdo estás con la siguiente afirmación sobre los horarios de atención…" = "Horarios de atención",
    "EXPERIENCIA LABORAL" = "Experiencia laboral",
    "Uno dos tres cuatro cinco seis siete" = "Uno dos tres cuatro",
    "EXPERIENCIA LABORAL / ¿Cómo valoras los recursos que ofrece la Facultad?" = "Experiencia laboral / Recursos de la Facultad",
    "  " = ""
  )
  for (e in names(casos)) expect_identical(.codif_rotulo_corto_subtema(e), unname(casos[[e]]), info = e)
})

test_that("cada subtema trae su etiqueta completa y su rótulo corto; la etiqueta de siempre sigue recortada", {
  f <- .se_xlsform()
  out <- codif_sugerir_seccion(leer_instrumento_xlsform(f$path), .se_data(), "coment")
  expect_equal(out$resumen$partidos, list("10"))
  rel <- Find(function(m) identical(m$seccion, "enunciado_a2"), out$modulos)
  expect_false(is.null(rel))
  # Contrato previo: `etiqueta` recortada a 90 caracteres con «…».
  expect_lte(nchar(rel$etiqueta), 91L)
  expect_true(endsWith(rel$etiqueta, "…"))
  # Nuevo: la completa, sin recorte, y el rótulo corto desde la completa.
  expect_identical(rel$etiqueta_completa, f$larga)
  expect_identical(rel$etiqueta_corta, .codif_rotulo_corto_subtema(f$larga))
  # Con la recortada salía «La relación»; con la completa, el rótulo llega a quién se relaciona.
  expect_identical(.codif_rotulo_corto_subtema(rel$etiqueta), "La relación")
  expect_identical(rel$etiqueta_corta, "Relación entre estudiantes")
  # Las propuestas de un subtema llevan las mismas dos etiquetas.
  r1 <- Find(function(r) identical(r$id_caso, "w1"), out$respuestas)
  pr <- Find(function(p) identical(p$codigo, rel$codigo), r1$propuestas)
  expect_identical(pr$etiqueta_completa, f$larga)
  expect_identical(pr$etiqueta_corta, rel$etiqueta_corta)
  # Un módulo de primer nivel no cambia de forma.
  expect_null(.se_mod(out, "20")$etiqueta_completa)
})

test_that("TXT-22: «carrera» no ancla un comentario al módulo que pregunta por la carrera", {
  f <- .se_xlsform()
  out <- codif_sugerir_seccion(leer_instrumento_xlsform(f$path), .se_data(), "coment")
  r5 <- Find(function(r) identical(r$id_caso, "w5"), out$respuestas)
  cods <- vapply(r5$propuestas, function(p) p$padre %||% p$codigo, character(1))
  expect_identical(unique(cods), "20")
})
