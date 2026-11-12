# Marco de un público por correo o teléfono (fase 5 del rediseño de Cálculo de
# muestra): lectura de CSV en español, hoja de datos, perfil de columnas y
# embudo de quién se invita. Fixtures sintéticos con la forma de las bases que
# llegan en un estudio de acreditación (preámbulo antes del encabezado, una hoja
# "SQL" junto a la de datos, CSV con punto y coma y tildes en Latin-1).

.mp_csv <- function(lineas, codificacion = "UTF-8") {
  path <- tempfile("mp-", fileext = ".csv")
  texto <- paste0(paste(lineas, collapse = "\n"), "\n")
  bytes <- if (identical(codificacion, "latin1")) iconv(texto, "UTF-8", "latin1", toRaw = TRUE)[[1]] else charToRaw(enc2utf8(texto))
  writeBin(bytes, path)
  path
}

.mp_docentes <- function(n = 120L) {
  set.seed(11)
  data.frame(
    DOCENTE = sprintf("%08d", 10000000L + seq_len(n)),
    NOMBRES = paste("Nombre", seq_len(n)),
    SEXO = sample(c("M", "F"), n, replace = TRUE),
    EDAD = as.character(sample(28:75, n, replace = TRUE)),
    DEPARTAMENTO = sample(c("Ingeniería", "Derecho", "Escuela externa"), n, replace = TRUE, prob = c(.5, .4, .1)),
    CORREO = sprintf("d%03d@ejemplo.edu", seq_len(n)),
    TELEFONO = ifelse(seq_len(n) %% 10 == 0, "", sprintf("9%08d", sample.int(99999999L, n))),
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

test_that("un CSV con punto y coma y tildes en Latin-1 se lee con sus columnas y sus tildes", {
  path <- .mp_csv(c("Unidad académica;Mujeres;Hombres", "Educación;186;42", "Psicología;463;150"), "latin1")
  withr::defer(unlink(path))
  lec <- .cm_marco_leer_csv(path, como_texto = TRUE)
  expect_identical(lec$separador, ";")
  expect_identical(lec$codificacion, "latin1")
  expect_identical(names(lec$datos), c("Unidad académica", "Mujeres", "Hombres"))
  expect_identical(lec$datos[["Unidad académica"]], c("Educación", "Psicología"))
  # La lectura que usan los demás modos (aulas, general) pasa por el mismo detector.
  expect_identical(ncol(.cm_aulas_read_table(path)), 3L)
})

test_that("un CSV con coma en UTF-8 sigue leyéndose igual y la coma entre comillas no parte columnas", {
  path <- .mp_csv(c("codigo,distrito,hogares", "\"001\",\"Lima, Cercado\",12", "\"002\",Cayma,30"))
  withr::defer(unlink(path))
  lec <- .cm_marco_leer_csv(path, como_texto = TRUE)
  expect_identical(lec$separador, ",")
  expect_identical(lec$codificacion, "UTF-8")
  expect_identical(lec$datos$codigo, c("001", "002"))
  expect_identical(lec$datos$distrito, c("Lima, Cercado", "Cayma"))
})

test_that("en un libro se sugiere la hoja de datos y la hoja SQL se reconoce como consulta", {
  testthat::skip_if_not_installed("openxlsx")
  df <- .mp_docentes()
  path <- tempfile("mp-libro-", fileext = ".xlsx")
  withr::defer(unlink(path))
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Data")
  openxlsx::writeData(wb, "Data", "Reporte de Administrativos 2026", startRow = 1)
  openxlsx::writeData(wb, "Data", "Solicitud 100200", startRow = 2)
  openxlsx::writeData(wb, "Data", df, startRow = 5)
  openxlsx::addWorksheet(wb, "SQL")
  openxlsx::writeData(wb, "SQL", data.frame(x = c("WITH base AS (", "select distinct a.codigo", "from alumnos a")), colNames = FALSE)
  # Así llega en las bases reales: la consulta entera en una sola celda.
  openxlsx::addWorksheet(wb, "SQL celda")
  openxlsx::writeData(wb, "SQL celda", "select distinct\nax.alumno, ax.correo\nfrom matricula ax", colNames = FALSE)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)

  h <- calc_muestra_marco_hojas(path)
  tipos <- setNames(vapply(h$hojas, `[[`, "", "tipo"), vapply(h$hojas, `[[`, "", "nombre"))
  expect_identical(tipos[["Data"]], "datos")
  expect_identical(tipos[["SQL"]], "consulta")
  expect_identical(tipos[["SQL celda"]], "consulta")
  expect_identical(h$sugerida, "Data")
  data <- Filter(function(x) x$nombre == "Data", h$hojas)[[1]]
  expect_identical(data$encabezado_fila, 5L)
  expect_identical(data$filas, nrow(df))
  expect_identical(data$columnas, ncol(df))
})

test_that("el perfil sugiere el uso de cada columna por su contenido y no publica datos personales", {
  df <- .mp_docentes()
  # Nombres de columna que no dicen nada: el uso sale del contenido.
  names(df) <- c("C1", "C2", "C3", "C4", "C5", "C6", "C7")
  p <- calc_muestra_marco_perfil(df)
  uso <- setNames(vapply(p, `[[`, "", "uso_sugerido"), vapply(p, `[[`, "", "nombre"))
  tipo <- setNames(vapply(p, `[[`, "", "tipo"), vapply(p, `[[`, "", "nombre"))
  expect_identical(unname(uso), c("id", "personal", "cuota", "no", "cuota", "correo", "personal"))
  expect_identical(unname(tipo), c("codigo", "texto", "categoria", "numero", "categoria", "correo", "telefono"))
  por <- setNames(p, names(df))
  expect_identical(por$C7$vacios, 12L)
  expect_null(por$C1$distribucion)
  expect_null(por$C6$distribucion)
  expect_null(por$C2$distribucion)
  sexo <- vapply(por$C3$distribucion, `[[`, 0L, "n")
  expect_identical(sum(sexo), 120L)
  expect_identical(por$C4$resumen$min >= 28, TRUE)
  # Un número con muchos valores repetidos (años de antigüedad) sigue siendo número.
  antig <- calc_muestra_marco_perfil(data.frame(x = as.character(rep(1:55, length.out = 3000)), stringsAsFactors = FALSE))
  expect_identical(antig[[1]]$tipo, "numero")
})

test_that("en un marco chico un código, un teléfono o un nombre no se publican como categoría", {
  df <- data.frame(
    codigo = sprintf("A%03d", 1:20), tel = c(sprintf("9%08d", 1:19), ""), nombre = paste("Persona", 1:20),
    sexo = rep(c("F", "M"), 10), stringsAsFactors = FALSE
  )
  p <- setNames(calc_muestra_marco_perfil(df), names(df))
  expect_identical(vapply(p, `[[`, "", "tipo"), c(codigo = "codigo", tel = "telefono", nombre = "texto", sexo = "categoria"))
  expect_null(p$codigo$distribucion); expect_null(p$tel$distribucion); expect_null(p$nombre$distribucion)
  expect_identical(p$sexo$uso_sugerido, "cuota")
})

test_that("las columnas sin nombre o repetidas se leen cada una con su nombre propio", {
  path <- .mp_csv(c("a;a;;b", "1;x;p;q", "2;y;r;s"))
  withr::defer(unlink(path))
  df <- .cm_marco_leer_hoja_texto(path)
  expect_identical(names(df), c("a", "a (2)", "Columna 3", "b"))
  p <- calc_muestra_marco_perfil(df)
  expect_identical(vapply(p, `[[`, 0L, "valores"), c(2L, 2L, 2L, 2L))
  expect_identical(p[[2]]$distribucion[[1]]$valor %in% c("x", "y"), TRUE)
})

test_that("el embudo resta cada regla en orden y asigna a otro público a quien figura en él", {
  df <- .mp_docentes()
  df$CORREO[1:3] <- c("", "sin-arroba", toupper(df$CORREO[3]))
  externa <- sum(df$DEPARTAMENTO == "Escuela externa")
  otros <- list(
    list(publico = "Administrativos", correos = c(df$CORREO[4:6], "nadie@ejemplo.edu")),
    list(publico = "Egresados", correos = c(df$CORREO[6:8], tolower(df$CORREO[3])))
  )
  out <- calc_muestra_marco_invitados(df, "CORREO", list(
    list(tipo = "excluir_valores", columna = "DEPARTAMENTO", valores = list("Escuela externa")),
    list(tipo = "excluir_sin_correo"),
    list(tipo = "una_por_persona")
  ), otros)
  expect_identical(out$base, 120L)
  expect_identical(out$pasos[[1]]$quitadas, externa)
  sin_correo <- sum(df$DEPARTAMENTO[1:2] != "Escuela externa")
  expect_identical(out$pasos[[2]]$quitadas, sin_correo)
  # 4, 5 y 6 van a Administrativos (prioridad); 7, 8 y el 3 (en mayúsculas) a Egresados.
  dentro_antes <- df$DEPARTAMENTO != "Escuela externa"
  esperado_adm <- sum(dentro_antes[4:6]); esperado_egr <- sum(dentro_antes[c(3, 7, 8)])
  pp <- setNames(vapply(out$pasos[[3]]$por_publico, `[[`, 0L, "n"), vapply(out$pasos[[3]]$por_publico, `[[`, "", "publico"))
  expect_identical(unname(pp[["Administrativos"]]), esperado_adm)
  expect_identical(unname(pp[["Egresados"]]), esperado_egr)
  expect_identical(out$invitados, 120L - externa - sin_correo - esperado_adm - esperado_egr)
  expect_identical(out$invitados, sum(out$incluidos))
  expect_identical(out$pasos[[3]]$quedan, out$invitados)
})

test_that("una regla sobre una columna que no existe o desconocida responde 400", {
  df <- .mp_docentes(40L)
  expect_error(calc_muestra_marco_invitados(df, "", list(list(tipo = "excluir_valores", columna = "NO_EXISTE", valores = list("x")))),
               class = "api_error")
  expect_error(calc_muestra_marco_invitados(df, "", list(list(tipo = "excluir_sin_correo"))), class = "api_error")
  expect_error(calc_muestra_marco_invitados(df, "CORREO", list(list(tipo = "inventada"))), class = "api_error")
})

test_that("las rutas leen el archivo subido y devuelven hojas, perfil y embudo", {
  testthat::skip_if_not_installed("openxlsx")
  df <- .mp_docentes()
  path <- tempfile("mp-ruta-", fileext = ".xlsx")
  withr::defer(unlink(path))
  openxlsx::write.xlsx(df, path, sheetName = "DATOS")
  otro <- .mp_csv(c("codigo;correo", paste0("1;", df$CORREO[10]), paste0("2;", df$CORREO[11])), "latin1")
  withr::defer(unlink(otro))
  sid <- session_create()
  withr::defer(session_delete(sid))
  meta <- save_upload(sid, "data", basename(path), readBin(path, "raw", file.size(path)))
  meta_otro <- save_upload(sid, "data", basename(otro), readBin(otro, "raw", file.size(otro)))

  leido <- .bv_call(mount_calc_muestra_marco_publico, "POST", "/api/calc-muestra/marco-publico/leer", sid,
                    list(file_id = meta$file_id))
  expect_true(leido$ok)
  expect_identical(leido$hoja, "DATOS")
  expect_identical(leido$filas, 120L)
  expect_identical(vapply(leido$columnas, `[[`, "", "uso_sugerido")[[1]], "id")

  emb <- .bv_call(mount_calc_muestra_marco_publico, "POST", "/api/calc-muestra/marco-publico/invitados", sid,
                  list(file_id = meta$file_id, columna_correo = "CORREO",
                       reglas = list(list(tipo = "una_por_persona")),
                       otros = list(list(publico = "Administrativos", file_id = meta_otro$file_id, columna_correo = "correo"))))
  expect_identical(emb$base, 120L)
  expect_identical(emb$invitados, 118L)
  expect_null(emb$incluidos)

  # Una hoja que no existe responde 400 con las hojas disponibles.
  res <- plumber:::PlumberResponse$new()
  ep <- .bv_endpoint(mount_calc_muestra_marco_publico, "POST", "/api/calc-muestra/marco-publico/leer")
  out <- ep$getFunc()(req = .bv_req(sid, list(file_id = meta$file_id, hoja = "NO_EXISTE")), res = res)
  expect_equal(res$status, 400)
  expect_match(paste(unlist(out), collapse = " "), "DATOS")
})
