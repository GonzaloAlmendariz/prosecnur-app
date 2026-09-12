# La cache del dashboard de aulas.
#
# Aulas era la unica familia de Monitoreo que reconstruia su dashboard en cada
# request de state, y encima fuera del `if (should_build_dashboard)` que gobierna
# la cache del tablero: se reconstruia incluso cuando el general venia de cache.
# Medido sobre 2.616 cursos-horario: 3,6 s por request x 6 requests que dispara
# abrir un proyecto = 21,5 s con Plumber bloqueado en un solo hilo.
#
# Lo que estos tests protegen NO es la velocidad —eso lo dice el reloj— sino las
# dos formas en que una cache hace daño: servir cifras viejas, y servir las de
# OTRO proyecto.

# El plan va NORMALIZADO, que es como llega al motor desde el router: el
# dashboard agrega por columnas que el normalizador garantiza.
.mac_plan <- function(n = 3) monitoreo_aulas_normalize_plan(
  lapply(seq_len(n), function(i) list(
    operational_code = paste("CH", i), classroom_id = paste("CH", i),
    sample_role = "titular", faculty = "DERECHO",
    eligible_n = 30, expected_valid = 17
  ))
)

test_that("el segundo request de la misma sesion reusa el dashboard", {
  monitoreo_aulas_cache_invalidate()
  plan <- .mac_plan(); cfg <- list(); tok <- monitoreo_aulas_cache_token("t", plan, cfg)
  a <- monitoreo_aulas_dashboard_cached("s1", plan, data.frame(), cfg, tok)
  b <- monitoreo_aulas_dashboard_cached("s1", plan, data.frame(), cfg, tok)
  expect_false(a$hit)
  expect_true(b$hit)
  expect_identical(a$dashboard, b$dashboard)
})

test_that("dos sesiones NO comparten dashboard", {
  # El fallo mas caro de una cache es servir las cifras de otro proyecto: son
  # plausibles, asi que nadie las cuestiona.
  monitoreo_aulas_cache_invalidate()
  plan <- .mac_plan(); cfg <- list(); tok <- monitoreo_aulas_cache_token("t", plan, cfg)
  monitoreo_aulas_dashboard_cached("s1", plan, data.frame(), cfg, tok)
  b <- monitoreo_aulas_dashboard_cached("s2", plan, data.frame(), cfg, tok)
  expect_false(b$hit)
})

test_that("sin sid no se cachea: no hay a quien atribuirlo", {
  monitoreo_aulas_cache_invalidate()
  plan <- .mac_plan(); cfg <- list(); tok <- monitoreo_aulas_cache_token("t", plan, cfg)
  monitoreo_aulas_dashboard_cached("", plan, data.frame(), cfg, tok)
  b <- monitoreo_aulas_dashboard_cached("", plan, data.frame(), cfg, tok)
  expect_false(b$hit)
})

test_that("importar partes de campo invalida la cache", {
  # El caso del operativo: alguien corrige el registro de campo en el Excel y
  # reimporta. Si el token no lo viera, la pantalla seguiria con lo anterior —y
  # eso es peor que ir lento.
  plan <- .mac_plan()
  t1 <- monitoreo_aulas_cache_token("t", plan, list())
  t2 <- monitoreo_aulas_cache_token("t", plan, list(partes_campo = list(list(operational_code = "CH 1"))))
  expect_false(identical(t1, t2))
})

test_that("el token distingue plan, control y libro, pero NO el scope", {
  plan <- .mac_plan()
  base <- monitoreo_aulas_cache_token("t", plan, list())
  expect_false(identical(base, monitoreo_aulas_cache_token("t", .mac_plan(4), list())))
  expect_false(identical(base, monitoreo_aulas_cache_token("t", plan, list(control = list(list(operational_code = "CH 1"))))))
  # Una relectura del libro con las MISMAS filas tiene que invalidar igual: el
  # equipo pudo corregir un valor sin cambiar el numero de filas. El nombre es
  # `importado_en` — el que sella el importador; el pin usaba `leido_en`, un
  # alias que nadie escribia (A15).
  expect_false(identical(base, monitoreo_aulas_cache_token("t", plan, list(libro = list(importado_en = "2026-08-24T10:00:00Z")))))
  # **El `scope` NO distingue, y el contrato cambia a proposito el 2026-09-12.**
  #
  # Esta linea exigia lo contrario y era la unica de las cinco sin una razon
  # escrita al lado: entro por simetria —«el token distingue todo lo que
  # recibe»— no por una necesidad medida.
  #
  # Lo medido: `monitoreo_aulas_dashboard()` NO recibe `scope` (su firma es
  # `(plan, responses, config)`), asi que el payload no puede depender de el. Y
  # contra el operativo real, los cuatro `report_scope` que pide
  # `scopeForView()` devuelven el mismo payload BYTE A BYTE —6.207.442
  # caracteres, iguales tras normalizar los sellos de tiempo—. Distinguir por
  # algo de lo que el valor no depende multiplicaba la cache por cuatro: cambiar
  # de seccion en el perfil costaba ~8 s y 5,92 MB para reconstruir el tablero
  # que ya se tenia.
  #
  # **Si esto vuelve a fallar, mira ANTES si el constructor ya usa el scope.**
  # Si lo usa, el token debe volver a incluirlo y esta linea se cambia otra vez,
  # a proposito. Lo que no vale es llevarlo «por si acaso».
  expect_identical(base, monitoreo_aulas_cache_token("t", plan, list(), scope = "validation_summary"))
  # Y el token del tablero manda: si cambia la data, cambia este.
  expect_false(identical(base, monitoreo_aulas_cache_token("otro", plan, list())))
})

test_that("invalidar una sesion no se lleva la de al lado", {
  monitoreo_aulas_cache_invalidate()
  plan <- .mac_plan(); cfg <- list(); tok <- monitoreo_aulas_cache_token("t", plan, cfg)
  monitoreo_aulas_dashboard_cached("s1", plan, data.frame(), cfg, tok)
  monitoreo_aulas_dashboard_cached("s2", plan, data.frame(), cfg, tok)
  monitoreo_aulas_cache_invalidate("s1")
  expect_false(monitoreo_aulas_dashboard_cached("s1", plan, data.frame(), cfg, tok)$hit)
  expect_true(monitoreo_aulas_dashboard_cached("s2", plan, data.frame(), cfg, tok)$hit)
})

test_that("una sesion guarda UNA entrada, no una por token", {
  # Un operativo largo sincroniza decenas de veces; guardar por token dejaria el
  # environment creciendo toda la sesion.
  monitoreo_aulas_cache_invalidate()
  plan <- .mac_plan(); cfg <- list()
  for (i in 1:5) {
    monitoreo_aulas_dashboard_cached("s1", plan, data.frame(), cfg,
                                     monitoreo_aulas_cache_token(paste0("t", i), plan, cfg))
  }
  expect_length(ls(envir = prosecnurapp:::.mac_dashboard_env, all.names = TRUE), 1L)
  # Y la que queda es la ultima: el token viejo ya no sirve.
  expect_false(monitoreo_aulas_dashboard_cached("s1", plan, data.frame(), cfg,
                                                monitoreo_aulas_cache_token("t1", plan, cfg))$hit)
  monitoreo_aulas_cache_invalidate()
})

test_that("reimportar el libro con los mismos conteos invalida el token (A15)", {
  # El caso que el propio docstring del token declara: una correccion a mano en
  # el Excel no cambia cuantas filas hay, solo su contenido y la marca de
  # importacion. El token leia `leido_en`/`imported_at`, nombres que NADIE
  # escribe (el importador sella `importado_en`, carga_aulas_libro.R), asi que
  # la marca entraba siempre vacia y el tablero servia el estado anterior.
  plan <- .mac_plan()
  antes <- monitoreo_aulas_cache_token(
    "t", plan, list(libro = list(importado_en = "2026-08-31T20:00:00Z")))
  despues <- monitoreo_aulas_cache_token(
    "t", plan, list(libro = list(importado_en = "2026-09-01T01:00:00Z")))
  expect_false(identical(antes, despues))
  # Y sin libro importado el token no revienta ni cambia entre llamadas.
  expect_identical(monitoreo_aulas_cache_token("t", plan, list()),
                   monitoreo_aulas_cache_token("t", plan, list()))
})
