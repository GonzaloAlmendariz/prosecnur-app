# De donde se lee el otro estudio, para poder RECALCULAR el cruce.
#
# Hasta el 2026-09-18 el veredicto lo inyectaba un runner externo con
# `session_set(sid, "monitoreo_aulas_daa_traslape", ...)` y **la app nunca supo
# de donde salia**: no habia ruta que leyera el proyecto de otro estudio ni su
# Sheets, asi que un cruce de hace una semana no se podia refrescar.

.matf_uni <- function() list(
  list(operational_code = "CH 1", classroom_id = "a1", teacher_email = "d1@pucp.edu.pe"),
  list(operational_code = "CH 2", classroom_id = "a2", teacher_email = "d2@pucp.edu.pe")
)

test_that("sin fuente declarada la config NO guarda un bloque a medias", {
  # Una fuente con solo etiqueta diria que el estudio cruza contra algo cuando
  # no puede leer nada de ningun sitio.
  cfg <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, traslape_fuente = list(etiqueta = "HSVG")))
  expect_identical(cfg$traslape_fuente, list())
  expect_false(monitoreo_aulas_traslape_fuente(cfg)$declarada)
})

test_that("una clave desconocida se RECHAZA, no se traga en silencio", {
  # Es la leccion de `E_AULAS_PADRON_FILTRO_CLAVE`: con la clave mal escrita, la
  # carga trajo 25.403 personas de toda la universidad y lo informo como «sin
  # filtro», en un aviso que nadie iba a leer contra el numero esperado.
  expect_error(
    monitoreo_aulas_normalize_config(list(
      enabled = TRUE,
      traslape_fuente = list(pulso = "/x.pulso", etiquita = "HSVG"))),
    "etiquita"
  )
})

test_that("la fuente declarada sobrevive el normalizador y se lee de las dos alturas", {
  cfg <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE,
    traslape_fuente = list(
      etiqueta = "hsvg", pulso = "/ruta/HSVG26ULT2.pulso",
      spreadsheet_id = "https://docs.google.com/spreadsheets/d/ABC123/edit",
      motivo = "misma poblacion, otro operativo")))
  f <- monitoreo_aulas_traslape_fuente(cfg)
  expect_true(f$declarada)
  # La etiqueta va al rotulo de la columna del libro, y va en mayusculas.
  expect_identical(f$etiqueta, "HSVG")
  # El id se extrae de la URL: pegar el enlace del navegador es lo que hace
  # cualquiera, y guardarlo entero dejaria la lectura pidiendo una hoja que no
  # existe.
  expect_identical(f$spreadsheet_id, "ABC123")
  # Y se lee igual desde la config completa que desde el bloque de aulas, que es
  # el mismo trato que `monitoreo_aulas_eje()`.
  expect_identical(
    monitoreo_aulas_traslape_fuente(list(aulas_universitarias = cfg))$etiqueta, "HSVG")
})

test_that("sin fuente el recalculo se niega con su motivo, no con un error de red", {
  # Sin fuente no hay nada que releer, y fallar con un timeout contaria otra
  # historia: el arreglo seria declarar la fuente, no revisar la conexion.
  expect_error(
    monitoreo_aulas_traslape_recalcular(.matf_uni(), list(enabled = TRUE)),
    "no declara contra qu"
  )
})

test_that("un `.pulso` que no existe lo dice con su ruta", {
  expect_error(
    monitoreo_aulas_traslape_recalcular(.matf_uni(), list(
      traslape_fuente = list(etiqueta = "HSVG", pulso = "/no/existe/x.pulso"))),
    "No se encuentra el proyecto"
  )
})

test_that("recalcula desde un `.pulso` real y SELLA la lectura", {
  # El ida y vuelta entero, sobre un proyecto escrito aqui: sin sello la lectura
  # se leeria como si fuera de hoy para siempre, que es el defecto que
  # `409094d3` cerro.
  ajeno <- list(
    list(operational_code = "X 1", classroom_id = "a1", teacher_email = "otro@pucp.edu.pe"),
    list(operational_code = "X 2", classroom_id = "zz", teacher_email = "d2@pucp.edu.pe")
  )
  dir <- withr::local_tempdir()
  saveRDS(list(monitoreo_aulas_plan = ajeno), file.path(dir, "state.rds"))
  ruta <- file.path(dir, "otro.pulso")
  zip::zip(ruta, "state.rds", root = dir)

  t <- monitoreo_aulas_traslape_recalcular(.matf_uni(), list(
    traslape_fuente = list(etiqueta = "HSVG", pulso = ruta)))
  # CH 1 cruza por AULA (a1 esta en su plan) y CH 2 por DOCENTE (d2).
  expect_true(nzchar(unname(t[["CH 1"]])))
  expect_true(nzchar(unname(t[["CH 2"]])))
  expect_identical(attr(t, "rotulo"), "TRASLAPE HSVG")
  expect_true(nzchar(attr(t, "leido_en")))
  # La fuente se COMPONE de lo declarado, no se teclea aparte: dos redacciones
  # de la misma cosa acaban separandose.
  expect_true(grepl("otro.pulso", attr(t, "fuente"), fixed = TRUE))
  expect_true(grepl("solo lectura", attr(t, "fuente"), fixed = TRUE))
  # Sin Sheets declarado el libro no se leyo, y eso se DECLARA: el cruce vale
  # igual —los planes se cruzan— pero no puede afirmar quien fue contactado.
  expect_false(isTRUE(attr(t, "libro_leido")))
  expect_identical(attr(t, "aulas_del_otro"), 2L)
  # Y la vigencia sale a cero dias, porque acaba de leerse.
  expect_identical(aulas_traslape_vigencia(t)$dias, 0L)
})

test_that("un `.pulso` sin plan de aulas lo dice, en vez de cruzar contra nada", {
  dir <- withr::local_tempdir()
  saveRDS(list(otra_cosa = 1), file.path(dir, "state.rds"))
  ruta <- file.path(dir, "vacio.pulso")
  zip::zip(ruta, "state.rds", root = dir)
  expect_error(
    monitoreo_aulas_traslape_recalcular(.matf_uni(), list(
      traslape_fuente = list(etiqueta = "HSVG", pulso = ruta))),
    "no trae plan de aulas"
  )
})

# --- el puente entre el codigo operativo y el aula --------------------------
#
# **El defecto mio del 2026-09-18, cazado por comparar contra la lectura de la
# vispera.** La hoja del otro estudio habla en CODIGO OPERATIVO («CH 110»)
# porque es lo que el equipo teclea; el cruce compara `classroom_id`. Sin
# traducir, el recalculo devolvia 0 aulas ya aplicadas donde la lectura a mano
# encontraba 12, y doce unidades cambiaban de veredicto en un sentido imposible
# —una aplicacion no se deshace—.
#
# Es la misma averia que ese mismo dia se cerro en la reserva dirigida y en el
# seguimiento de tau: dos claves distintas a los dos lados de un join. No falla;
# miente.

.matf_ajeno <- function() list(
  list(operational_code = "CH 110", classroom_id = "aula_x", teacher_email = "a@pucp.edu.pe"),
  list(operational_code = "CH 111", classroom_id = "aula_y", teacher_email = "b@pucp.edu.pe")
)

test_that("traduce el codigo operativo de la hoja al `classroom_id` del marco", {
  # El fixture lo dice todo: si el puente no existiera, «CH 110» se compararia
  # contra `classroom_id` y no casaria nunca.
  expect_identical(
    prosecnurapp:::.matf_traducir_aulas(c("CH 110"), .matf_ajeno()), "aula_x")
  # Sin distinguir mayusculas ni espacios, que es como llega de una hoja.
  expect_identical(
    prosecnurapp:::.matf_traducir_aulas(c(" ch 111 "), .matf_ajeno()), "aula_y")
})

test_that("un codigo que el plan ajeno no conoce se descarta, no se pasa crudo", {
  # Pasarlo crudo lo compararia contra `classroom_id` y no casaria nunca, que es
  # justo el silencio que el puente existe para romper.
  expect_identical(
    prosecnurapp:::.matf_traducir_aulas(c("CH 999"), .matf_ajeno()), character(0))
  expect_identical(
    prosecnurapp:::.matf_traducir_aulas(character(0), .matf_ajeno()), character(0))
  expect_identical(prosecnurapp:::.matf_traducir_aulas(c("CH 110"), list()), character(0))
})

test_that("con el puente, un aula tocada en la hoja ajena SI sale como aplicada", {
  # El ida y vuelta completo del defecto: la unidad de CCSS comparte `aula_x`
  # con el otro estudio, y su hoja dice que ese curso-horario ya se toco.
  mias <- list(list(operational_code = "CH 1", classroom_id = "aula_x",
                    teacher_email = "z@pucp.edu.pe"))
  sin_puente <- aulas_traslape_estudio(
    mias, aulas = "aula_x", aulas_contactadas = "CH 110", etiqueta = "HSVG")
  con_puente <- aulas_traslape_estudio(
    mias, aulas = "aula_x",
    aulas_contactadas = prosecnurapp:::.matf_traducir_aulas("CH 110", .matf_ajeno()),
    etiqueta = "HSVG")
  # Sin traducir cae al veredicto flojo —esta en su plan— y con el puente al
  # que decide: ya la aplicaron.
  expect_true(grepl("PLAN", unname(sin_puente[["CH 1"]])))
  expect_true(grepl("APLICADA", unname(con_puente[["CH 1"]])))
})
