# Contrato de los fixtures de referencia YA INSTALADOS en api/inst/.
#
# A diferencia de `test-reference-projects.R`, que prueba la maquinaria con
# datos de juguete, esto valida los artefactos versionados: que abran, que no
# tengan PII, y que sigan cubriendo lo que su manifest declara.
#
# Un fixture ausente se saltea en vez de fallar: construirlo necesita el .pulso
# original del analista, que no vive en el repo. Quien no los tenga igual debe
# poder correr la suite.

fixture_o_skip <- function(slug) {
  path <- reference_project_path(slug)
  testthat::skip_if_not(
    file.exists(path),
    sprintf("fixture '%s' no instalado (necesita el .pulso original)", slug)
  )
  path
}

# Fixtures generados ANTES de que los seudónimos pasaran a cerrar bajo el TLD
# reservado (`alguien@pucp.edu.pe.example.test`). Sus correos son sintéticos
# —llevan el sufijo hexadecimal del generador— pero con dominio real, así que el
# gate reparado los marca. No es PII filtrada: es deuda de regeneración, y no se
# puede saldar aquí porque `reference_project_build()` exige
# `PROSECNUR_ANON_SALT` y sin ella el fixture dejaría de ser reproducible.
#
# Cada slug sale de esta lista en cuanto se regenere. Si la lista queda vacía,
# se borra: no es un mecanismo permanente, es una deuda con nombre y fecha.
FIXTURES_PENDIENTES_DE_REGENERAR <- c(
  hsvg2026 = "204.928 correos seudónimos con dominio real (2026-08-14)",
  acrconta = "842 correos seudónimos con dominio real (2026-08-14)"
)

test_that("todo fixture instalado pasa el gate de PII y de cobertura", {
  instalados <- Filter(function(s) file.exists(reference_project_path(s)),
                       reference_project_catalog()$slug)
  testthat::skip_if(length(instalados) == 0, "no hay fixtures instalados")

  for (slug in instalados) {
    if (slug %in% names(FIXTURES_PENDIENTES_DE_REGENERAR)) next
    res <- reference_project_verify(slug)
    expect_true(
      res$ok,
      info = sprintf("%s: %s", slug, paste(res$problemas, collapse = "; "))
    )
  }
})

test_that("los fixtures pendientes de regenerar siguen fallando por el motivo declarado", {
  # El complemento del test anterior: sin esto, la lista de exenciones podría
  # taparlo TODO —incluida PII real— y nadie lo notaría. Aquí se comprueba que
  # cada exento falla exactamente por lo que dice su motivo, y que su PII son
  # correos y no otra cosa.
  for (slug in names(FIXTURES_PENDIENTES_DE_REGENERAR)) {
    if (!file.exists(reference_project_path(slug))) next
    hallazgos <- pulso_detectar_pii(reference_project_path(slug))
    expect_true(nrow(hallazgos) > 0,
                info = sprintf("%s ya no falla: sácalo de la lista de pendientes", slug))
    expect_true(all(hallazgos$tipo == "correo"),
                info = sprintf("%s falla por algo que NO es correo: %s",
                               slug, paste(unique(hallazgos$tipo), collapse = ", ")))
  }
})

test_that("verificar un fixture lo deja sellado como read-only", {
  # El modo 0444 lo pone el build, pero git no versiona permisos: en un clon o
  # en CI el fixture llega 0644. Por eso el invariante no se asume del arbol
  # —ahi solo se cumple en la maquina donde alguien hizo el chmod— sino que lo
  # restablece `reference_project_verify()`, que es el gate declarado del
  # fixture. Si el sellado dejara de funcionar, esto falla.
  instalados <- Filter(function(s) file.exists(reference_project_path(s)),
                       reference_project_catalog()$slug)
  testthat::skip_if(length(instalados) == 0, "no hay fixtures instalados")

  for (slug in instalados) {
    reference_project_verify(slug)
    modo <- as.character(file.info(reference_project_path(slug))$mode)
    expect_true(grepl("4[04]4$", modo), info = sprintf("%s tiene modo %s", slug, modo))
  }
})

test_that("ningun fixture esta vacio y juntos cubren mas que cualquiera solo", {
  matriz <- reference_project_matriz_cobertura()
  testthat::skip_if(nrow(matriz) < 2, "hacen falta al menos dos fixtures instalados")
  modulos <- setdiff(names(matriz), "slug")

  por_fixture <- vapply(seq_len(nrow(matriz)),
                        function(i) sum(unlist(matriz[i, modulos])), integer(1))
  expect_true(all(por_fixture > 0),
              info = paste("fixtures sin ningun modulo:",
                           paste(matriz$slug[por_fixture == 0], collapse = ", ")))

  conjunta <- sum(vapply(modulos, function(m) any(matriz[[m]]), logical(1)))
  expect_gt(conjunta, max(por_fixture))
})

test_that("la unicidad de un fixture se mide por profundidad, no por modulos", {
  # La tentacion es exigir que ningun fixture sea subconjunto de otro por
  # modulos cubiertos. Esa metrica es demasiado gruesa y da un falso negativo
  # concreto: hsvg2026 cubre {calc_muestra, editor_xlsform}, subconjunto de
  # acnur_acg — y sin embargo es el UNICO con marco de aulas a escala real.
  # acnur_acg tiene calc_muestra por su `calc_muestra_estudio`, pero nunca
  # construyo un `aulas_frame`. Lo que distingue a un fixture es cuan lejos
  # llega dentro de un modulo, no cuantos modulos toca.
  paths <- vapply(c("hsvg2026", "acnur_acg"), reference_project_path, character(1))
  testthat::skip_if_not(all(file.exists(paths)),
                        "hacen falta hsvg2026 y acnur_acg instalados")

  hsvg <- .reference_project_leer_state(paths[["hsvg2026"]])
  acg <- .reference_project_leer_state(paths[["acnur_acg"]])

  expect_true(is.data.frame(hsvg$calc_muestra_aulas_frame$aula_frame))
  expect_null(acg$calc_muestra_aulas_frame$aula_frame)
})

test_that("acnur_pdm conserva el repeat group que es su razon de ser", {
  path <- fixture_o_skip("acnur_pdm")
  s <- .reference_project_leer_state(path)
  bases <- s$estudio$bases

  # La base hija de un repeat se reconoce por declarar su padre y su llave.
  hijas <- Filter(function(b) !is.null(b$parent_base), bases)
  expect_gt(length(hijas), 0L)

  hija <- hijas[[1]]
  expect_true(nzchar(hija$repeat_group %||% ""))
  expect_true(nzchar(hija$link_key %||% ""))
  expect_true(hija$parent_base %in% names(bases))
  # El vínculo padre-hija es lo que la anonimización no debía romper.
  expect_gt(as.integer(hija$n_filas %||% 0), 0L)
})

test_that("acnur_acg conserva la profundidad de analitica y codificacion", {
  path <- fixture_o_skip("acnur_acg")
  s <- .reference_project_leer_state(path)

  # Es el único fixture que llega hasta analítica con datos reales; si se
  # queda sin secciones o sin cruces deja de cubrir ese tramo.
  expect_gt(length(s$analitica_config$secciones %||% list()), 0L)
  expect_gt(length(s$analitica_config$cruces %||% list()), 0L)

  codif <- Filter(function(x) length(x) > 0, s$codif_por_base %||% list())
  expect_gt(length(codif), 0L)

  # Hojas de ruta territorial con sus fases.
  expect_gt(length(s$hojas_ruta_runs %||% list()), 0L)
})

test_that("acrconta conserva las dos mitades que se fusionaron", {
  path <- fixture_o_skip("acrconta")
  s <- .reference_project_leer_state(path)

  # Mitad de monitoreo: las fuentes multiactor.
  expect_gt(length(s$monitoreo_sources %||% list()), 1L)
  # Mitad de procesamiento: la base cargada y su intake.
  expect_gt(length(s$estudio$bases %||% list()), 0L)
  expect_true(nzchar(s$processing_intake$processing_mode %||% ""))
  # Y el plan de trabajo, que es lo único que aporta diseño de estudio.
  expect_true(isTRUE(s$plan_trabajo$ok))
})

test_that("hsvg2026 conserva el marco muestral a escala", {
  path <- fixture_o_skip("hsvg2026")
  s <- .reference_project_leer_state(path)

  frame <- s$calc_muestra_aulas_frame
  expect_true(is.data.frame(frame$aula_frame))
  # Su aporte es el volumen: un marco recortado no ejercita lo mismo.
  expect_gt(nrow(frame$aula_frame), 1000L)
})

test_that("acnur_pdm sirve los payloads del Dashboard sin reventar", {
  # Regresión: `/api/dashboard/resumen/kpis` devolvía 500 ("invalid argument
  # type") con este fixture. Es multibase (base padre + `rep_servicios`) y no
  # trae la fuente propia del Dashboard, así que el ctx del módulo se quedaba
  # con el mapa `rp_data_sources` de Procesamiento por partial matching de `$`.
  path <- fixture_o_skip("acnur_pdm")
  l <- load_pulso(path)
  on.exit(session_delete(l$session_id), add = TRUE)
  s <- session_get(l$session_id)

  # La premisa del test: estudio multibase y Dashboard sin fuente importada.
  expect_gt(length(s$rp_data_sources %||% list()), 1L)
  expect_false(.dashboard_has_source(s))

  # Sin fuente propia, cada payload responde vacío en vez de fallar.
  expect_identical(.dashboard_resumen_kpis(s, list()), list())
  expect_length(.dashboard_secciones_payload(s)$secciones, 0L)
  expect_equal(.dashboard_resumen_payload(s, "cualquiera", list())$n_total, 0L)
  estado <- .dashboard_manifest(s)$estado
  expect_false(isTRUE(estado$tiene_data))
  expect_equal(estado$n_secciones, 0L)
})
