# Gate del esquema de claves de sesión del .pulso (contrato en
# api/R/session_schema.R). Regla de la casa: clave de sesión nueva ⇒ fila
# nueva en session_schema(), en el MISMO commit; clave persistible nueva
# implica pensar migración/back-compat en load_pulso. Este archivo es el que
# pone rojo el incumplimiento. Patrón hermano: test-errors-registry.R.

# Ruta a las fuentes api/R. Cuando la suite corre contra el paquete instalado
# (sin fuentes al costado), el gate no aplica y se salta con aviso.
.schema_dir_fuente <- function() {
  dir_r <- test_path("..", "..", "R")
  if (!dir.exists(dir_r)) skip("Fuentes api/R no disponibles (paquete instalado); el gate corre sobre el árbol fuente.")
  dir_r
}

test_that("toda clave literal escrita via setters de sesion esta censada en session_schema()", {
  detectadas <- .session_schema_escanear_claves(.schema_dir_fuente())
  schema <- session_schema()

  # Canario del escáner: hoy censa ~104 claves distintas. Si un refactor lo
  # rompe y devuelve poco, este número delata el problema antes que un falso verde.
  expect_gt(length(unique(detectadas$clave)), 80L)

  sin_censar <- detectadas[
    vapply(detectadas$clave, function(k) length(.session_schema_categorias(k, schema)) == 0L, logical(1)),
    , drop = FALSE
  ]
  sin_censar <- sin_censar[!duplicated(sin_censar[, c("clave", "archivo")]), , drop = FALSE]
  if (nrow(sin_censar)) {
    fail(paste0(
      "Claves de sesión sin censar en session_schema() (api/R/session_schema.R):\n",
      paste(sprintf("  - %s (se escribe en api/R/%s)", sin_censar$clave, sin_censar$archivo), collapse = "\n"),
      "\nContrato: clave nueva ⇒ fila nueva en el censo, mismo commit.",
      "\nSi la clave es persistible, revisar back-compat del load_pulso."
    ))
  } else {
    succeed()
  }
})

test_that("todo lo que save_pulso strippea esta censado y los resets son cache_stripped", {
  strip <- .session_schema_claves_strip()
  schema <- session_schema()

  # Canario: .pulso_strip_caches toca hoy ~25 claves top-level de sesión.
  expect_gt(nrow(strip), 15L)

  # (a) Toda clave que el strip asigna (reset o saneo parcial) debe estar
  # censada — si el save empieza a tocar una clave nueva, se censa en el
  # mismo commit.
  sin_censar <- strip$clave[
    vapply(strip$clave, function(k) length(.session_schema_categorias(k, schema)) == 0L, logical(1))
  ]
  expect_true(
    length(sin_censar) == 0L,
    info = paste(
      "Claves tocadas por .pulso_strip_caches sin fila en session_schema():",
      paste(sin_censar, collapse = ", ")
    )
  )

  # (b) Las claves reseteadas de verdad (top-level a NULL/list()/FALSE) no
  # sobreviven el round-trip: deben censarse como cache_stripped.
  reseteadas <- strip$clave[strip$reset]
  mal_categorizadas <- reseteadas[
    vapply(reseteadas, function(k) {
      !identical(.session_schema_categorias(k, schema), "cache_stripped")
    }, logical(1))
  ]
  expect_true(
    length(mal_categorizadas) == 0L,
    info = paste(
      "Claves que el save resetea pero el censo no marca cache_stripped:",
      paste(mal_categorizadas, collapse = ", ")
    )
  )

  # (c) Inversa: toda fila literal cache_stripped debe corresponder a un reset
  # real del strip. Si el strip dejó de resetear una clave, su fila quedó
  # huérfana (o la clave pasó a persistir y hay que re-censarla).
  censadas_stripped <- schema$clave[schema$tipo == "literal" & schema$categoria == "cache_stripped"]
  huerfanas <- setdiff(censadas_stripped, reseteadas)
  expect_true(
    length(huerfanas) == 0L,
    info = paste(
      "Filas cache_stripped que .pulso_strip_caches ya no resetea:",
      paste(huerfanas, collapse = ", ")
    )
  )
})

test_that("el censo es internamente consistente (unicidad, patrones y modulos reales)", {
  schema <- session_schema()
  dir_r <- .schema_dir_fuente()

  # (a) Vocabularios cerrados de columnas.
  expect_true(all(schema$tipo %in% c("literal", "patron")))
  expect_true(all(schema$categoria %in% c("persistible", "cache_stripped", "interna")))
  expect_true(all(schema$origen %in% c("session_set", "directa", "bootstrap")))

  # (b) Sin claves literales duplicadas: el censo es un contrato, no un log.
  literales <- schema[schema$tipo == "literal", , drop = FALSE]
  duplicadas <- unique(literales$clave[duplicated(literales$clave)])
  expect_true(
    length(duplicadas) == 0L,
    info = paste("Claves duplicadas en el censo:", paste(duplicadas, collapse = ", "))
  )

  # (c) Toda regex de familia dinámica compila (grepl no falla).
  patrones <- schema$clave[schema$tipo == "patron"]
  invalidas <- patrones[
    vapply(patrones, function(rx) {
      inherits(tryCatch(grepl(rx, "x"), error = function(e) e), "error")
    }, logical(1))
  ]
  expect_true(
    length(invalidas) == 0L,
    info = paste("Patrones con regex inválida:", paste(invalidas, collapse = ", "))
  )

  # (d) Sin solapamiento contradictorio: una clave (detectada o censada
  # literal) nunca debe resolver a dos categorías distintas. Regla de
  # precedencia: la fila literal gana sobre los patrones; entre patrones,
  # todos los que matcheen deben coincidir en categoría.
  detectadas <- unique(.session_schema_escanear_claves(dir_r)$clave)
  universo <- unique(c(detectadas, literales$clave))
  ambiguas <- universo[
    vapply(universo, function(k) length(.session_schema_categorias(k, schema)) > 1L, logical(1))
  ]
  expect_true(
    length(ambiguas) == 0L,
    info = paste("Claves con categorías contradictorias:", paste(ambiguas, collapse = ", "))
  )

  # (e) El módulo dueño apunta a un archivo real: detecta renombres que
  # dejarían la columna modulo apuntando a la nada.
  modulos_fantasma <- setdiff(unique(schema$modulo), basename(list.files(dir_r, pattern = "\\.R$")))
  expect_true(
    length(modulos_fantasma) == 0L,
    info = paste("Módulos del censo que no existen en api/R:", paste(modulos_fantasma, collapse = ", "))
  )

  # (f) Huérfanas del escáner: toda fila literal con origen session_set debe
  # seguir siendo observable por el escáner (si la escritura se retiró o pasó
  # a ser dinámica, re-censar la fila en el mismo commit). Las de origen
  # directa/bootstrap son documentales y quedan exentas.
  censables <- literales$clave[literales$origen == "session_set"]
  huerfanas <- setdiff(censables, detectadas)
  # `hojas_ruta_ok` y `project_dirty` se escriben con session_set pero también
  # son claves del strip/ciclo de vida — deben aparecer igual en el escaneo.
  expect_true(
    length(huerfanas) == 0L,
    info = paste(
      "Filas con origen session_set que el escáner ya no observa:",
      paste(huerfanas, collapse = ", ")
    )
  )
})
