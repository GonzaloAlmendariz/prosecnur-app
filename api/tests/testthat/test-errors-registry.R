# Gate del vocabulario de errores E_* (contrato en api/R/errors_registry.R).
# Regla de la casa: código E_* nuevo ⇒ fila nueva en errores_registrados(),
# en el MISMO commit. Este archivo es el que pone rojo el incumplimiento.

# Ruta a las fuentes api/R. Cuando la suite corre contra el paquete instalado
# (sin fuentes al costado), el gate no aplica y se salta con aviso.
.errores_dir_fuente <- function() {
  dir_r <- test_path("..", "..", "R")
  if (!dir.exists(dir_r)) skip("Fuentes api/R no disponibles (paquete instalado); el gate corre sobre el árbol fuente.")
  dir_r
}

test_that("todo codigo E_* literal del backend esta registrado (gate de vocabulario)", {
  detectados <- .errores_escanear_codigos(.errores_dir_fuente())
  registro <- errores_registrados()

  # El escáner encontrando ~600 códigos es también un canario: si un refactor lo
  # rompe y devuelve poco, este test y el de huérfanos se ponen rojos juntos.
  expect_gt(nrow(detectados), 0L)

  faltantes <- detectados[!(detectados$codigo %in% registro$codigo), , drop = FALSE]
  faltantes <- faltantes[!duplicated(faltantes[, c("codigo", "archivo")]), , drop = FALSE]
  if (nrow(faltantes)) {
    fail(paste0(
      "Códigos E_* sin registrar en errores_registrados() (api/R/errors_registry.R):\n",
      paste(sprintf("  - %s (aparece en api/R/%s)", faltantes$codigo, faltantes$archivo), collapse = "\n"),
      "\nContrato: código nuevo ⇒ fila nueva en el registro, mismo commit."
    ))
  } else {
    succeed()
  }
})

test_that("el registro no tiene codigos huerfanos (registrados pero ya inexistentes)", {
  detectados <- .errores_escanear_codigos(.errores_dir_fuente())
  registro <- errores_registrados()

  huerfanos <- setdiff(registro$codigo, detectados$codigo)
  if (length(huerfanos)) {
    fail(paste0(
      "Códigos registrados en errores_registrados() que ya no aparecen en api/R:\n",
      paste(sprintf("  - %s", sort(huerfanos)), collapse = "\n"),
      "\nSi el código se retiró a propósito, retira también su fila del registro (mismo commit)."
    ))
  } else {
    succeed()
  }
})

test_that("el registro es internamente consistente (unicidad, patron y modulos reales)", {
  registro <- errores_registrados()
  dir_r <- .errores_dir_fuente()

  # (a) Sin códigos duplicados: el registro es un vocabulario, no un log.
  duplicados <- unique(registro$codigo[duplicated(registro$codigo)])
  expect_true(
    length(duplicados) == 0L,
    info = paste("Códigos duplicados en el registro:", paste(duplicados, collapse = ", "))
  )

  # (b) Todo código registrado respeta el patrón censable; si no lo respetara,
  # el escáner jamás lo encontraría y quedaría huérfano permanente.
  malformados <- registro$codigo[!grepl(.errores_codigo_regex, registro$codigo)]
  expect_true(
    length(malformados) == 0L,
    info = paste("Códigos fuera del patrón E_*:", paste(malformados, collapse = ", "))
  )

  # (c) El módulo de origen apunta a un archivo que existe: detecta renombres
  # de archivo que dejarían la columna modulo apuntando a la nada.
  modulos_fantasma <- setdiff(unique(registro$modulo), basename(list.files(dir_r, pattern = "\\.R$")))
  expect_true(
    length(modulos_fantasma) == 0L,
    info = paste("Módulos del registro que no existen en api/R:", paste(modulos_fantasma, collapse = ", "))
  )
})
