# Rendimiento de Analítica multibase (HSyVbG, 2026-10-15): dos defectos.
#
# 1. El reparador de `<parent>_recod` daba la MISMA lista `agresor_recod` a P23 y
#    P52 (comparten `agresor`), con catálogos de grupos que chocan en el 7. No
#    convergía: cada lectura renumeraba «Externo» (166, 167, 168…), reescribía
#    XLSForm y data y vaciaba todas las caches → ~25 s por `GET /variables`.
# 2. Cambiar de base activa re-leía y re-parseaba las tres bases aunque ningún
#    archivo hubiera cambiado. La lectura de un par ahora se memoiza por firma
#    (archivos + metadata + override de etiquetas) y se invalida sola.

.lc_write_xlsform <- function(path, survey, choices) {
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", survey)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", choices)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
}

test_that("dos padres que comparten lista reciben cada uno su lista _recod", {
  f <- prosecnurapp:::.pulso_recod_list_names
  out <- f(c("P23", "P52", "P3"), c("agresor", "agresor", "gender"))
  expect_equal(unname(out), c("lst_P23_recod", "lst_P52_recod", "gender_recod"))
  expect_equal(names(out), c("P23", "P52", "P3"))
  # El mismo padre repetido no cuenta como lista compartida.
  expect_equal(unname(f(c("P3", "P3"), c("gender", "gender"))), "gender_recod")
  expect_true(is.na(f("x", "")[["x"]]))
})

test_that("la reparación de padres con lista compartida converge y no renumera", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  td <- withr::local_tempdir("lc_recod_")
  path <- file.path(td, "inst.xlsx")
  # Estado tal como lo dejaba el reparador viejo: ambas `_recod` sobre la
  # lista compartida, con el «Externo» de P52 ya empujado al 166.
  .lc_write_xlsform(path,
    data.frame(
      type = c("select_one agresor", "text", "select_one agresor_recod",
               "select_one agresor", "text", "select_one agresor_recod"),
      name = c("P23", "P23_otro", "P23_recod", "P52", "P52_otro", "P52_recod"),
      label = c("Agresor 1", "Otro 1", "Agresor 1", "Agresor 2", "Otro 2", "Agresor 2"),
      stringsAsFactors = FALSE
    ),
    data.frame(
      list_name = c(rep("agresor", 3), rep("agresor_recod", 5)),
      name = c("1", "2", "88", "1", "2", "88", "7", "166"),
      label = c("Estudiante", "Docente", "Otro",
                "Estudiante", "Docente", "Otro", "Externo a la universidad", "Externo"),
      stringsAsFactors = FALSE
    )
  )
  ex <- function(code, lab) list(codigo = code, etiqueta = lab, origen = "existente")
  repairs <- list(
    list(parent = "P23", text_col = "P23_otro", groups = list(
      ex("1", "Estudiante"), ex("2", "Docente"), ex("88", "Otro"),
      list(codigo = "7", etiqueta = "Externo a la universidad", origen = "nuevo",
           respuestas = list("fuera de la pucp"))
    )),
    list(parent = "P52", text_col = "P52_otro", groups = list(
      ex("1", "Estudiante"), ex("2", "Docente"), ex("88", "Otro"),
      list(codigo = "7", etiqueta = "Externo", origen = "nuevo",
           respuestas = list("externo"))
    ))
  )
  rep_fn <- prosecnurapp:::.pulso_repair_parent_recod_xlsform
  r1 <- rep_fn(path, repairs)
  expect_true(r1$changed)
  r2 <- rep_fn(path, repairs)
  expect_false(r2$changed)
  r3 <- rep_fn(path, repairs)
  expect_false(r3$changed)

  sv <- readxl::read_excel(path, "survey")
  ch <- readxl::read_excel(path, "choices")
  expect_equal(sv$type[sv$name == "P23_recod"], "select_one lst_P23_recod")
  expect_equal(sv$type[sv$name == "P52_recod"], "select_one lst_P52_recod")
  p52 <- ch[ch$list_name == "lst_P52_recod", , drop = FALSE]
  expect_equal(p52$label[p52$name == "7"], "Externo")
  p23 <- ch[ch$list_name == "lst_P23_recod", , drop = FALSE]
  expect_equal(p23$label[p23$name == "7"], "Externo a la universidad")
  # La lista compartida quedó huérfana y se retira.
  expect_false("agresor_recod" %in% ch$list_name)
  # Ningún código desplazado al siguiente libre.
  expect_false(any(as.integer(ch$name) > 100L))
  # El mapa de la data es estable: 7 → 7 en P52 en la ronda convergida.
  cm <- r3$repairs[[2]]$code_map
  expect_equal(unname(cm[["7"]]), "7")
})

test_that("la firma del reparador cambia con el archivo y con el pedido", {
  td <- withr::local_tempdir("lc_firma_")
  dp <- file.path(td, "data.xlsx"); xp <- file.path(td, "inst.xlsx")
  writeLines("a", dp); writeLines("b", xp)
  sig <- prosecnurapp:::.pulso_recod_repair_signature
  reps <- list(list(parent = "P1", text_col = "P1_otro", groups = list()))
  s1 <- sig(dp, xp, reps)
  expect_identical(s1, sig(dp, xp, reps))
  expect_false(identical(s1, sig(dp, xp, list(list(parent = "P2")))))
  writeLines("aa", dp)
  expect_false(identical(s1, sig(dp, xp, reps)))

  sid <- "lc-sid-test"
  withr::defer(prosecnurapp:::.pulso_recod_memo_clear(sid))
  expect_false(prosecnurapp:::.pulso_recod_memo_hit(sid, "b1", s1))
  prosecnurapp:::.pulso_recod_memo_set(sid, "b1", s1)
  expect_true(prosecnurapp:::.pulso_recod_memo_hit(sid, "b1", s1))
  expect_false(prosecnurapp:::.pulso_recod_memo_hit(sid, "b2", s1))
  expect_false(prosecnurapp:::.pulso_recod_memo_hit(sid, "b1", sig(dp, xp, reps)))
})

test_that("la lectura de un par se memoiza y se invalida al cambiar data o metadata", {
  prosecnurapp:::.analitica_lectura_cache_clear()
  withr::defer(prosecnurapp:::.analitica_lectura_cache_clear())
  td <- withr::local_tempdir("lc_pair_")
  dp <- file.path(td, "data.csv"); xp <- file.path(td, "inst.xlsx")
  writeLines(c("x", "1"), dp); writeLines("inst", xp)
  pair <- list(xls = list(path = xp), data = list(path = dp, ext = "csv"))
  calls <- 0L
  reader <- function(pair, base_meta) {
    calls <<- calls + 1L
    list(inst = "inst", data = readLines(pair$data$path))
  }
  memo <- prosecnurapp:::.analitica_read_pair_memo

  a <- memo(pair, list(nombre = "b"), reader)
  b <- memo(pair, list(nombre = "b"), reader)
  expect_equal(calls, 1L)
  expect_identical(a, b)

  # Cambian los datos de la base: se relee y se ve el valor nuevo.
  Sys.sleep(0.05)
  writeLines(c("x", "1", "2"), dp)
  c2 <- memo(pair, list(nombre = "b"), reader)
  expect_equal(calls, 2L)
  expect_equal(c2$data, c("x", "1", "2"))

  # Cambia la metadata de la base (p. ej. caso_valido): también se relee.
  memo(pair, list(nombre = "b", caso_valido = list(columna = "x")), reader)
  expect_equal(calls, 3L)

  # Sin archivo no hay firma: lee sin cachear, cada vez.
  roto <- list(xls = list(path = file.path(td, "no.xlsx")), data = list(path = dp))
  memo(roto, NULL, reader); memo(roto, NULL, reader)
  expect_equal(calls, 5L)
})

test_that("el cache de lectura respeta su tope de entradas", {
  prosecnurapp:::.analitica_lectura_cache_clear()
  withr::defer(prosecnurapp:::.analitica_lectura_cache_clear())
  put <- prosecnurapp:::.analitica_lectura_cache_put
  tope <- prosecnurapp:::.ANALITICA_LECTURA_CACHE_MAX
  for (i in seq_len(tope + 3L)) put(paste0("k", i), i)
  env <- prosecnurapp:::.analitica_lectura_cache
  keys <- ls(env, all.names = TRUE)
  expect_length(keys, tope)
  expect_false("k1" %in% keys)
  expect_true(paste0("k", tope + 3L) %in% keys)
})
