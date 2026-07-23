# =============================================================================
# Guards del canon de nombres (data_normalizer_canon.R) — test unitario aislado
# =============================================================================
#
# "Engine nuevo = test nuevo": ejercita DIRECTAMENTE `.dn_canon_slug` y
# `.dn_reconcile_canonical_names` del namespace de prosecnurapp con fixtures
# sinteticas en memoria (data.frame + instrumento minimo con survey/choices).
# Sin plumber, sin jobs, sin samples de disco.
#
# El canon conecta columnas reales al nombre canonico del XLSForm SIN adivinar:
# renombra solo cuando hay UNA candidata inequivoca y registra cada alias en la
# trazabilidad. Estos casos blindan cada guard contra regresiones.
#
# TIMING: el caso 2 (H1) codifica la discriminante de zero-padding que el writer
# esta endureciendo en paralelo en Paso B (`_001`/`_01` = dedup Kobo -> aliasea;
# `_1`/`_12` = sub-pregunta ajena -> NO aliasea). Las expectativas estan escritas
# contra el comportamiento POST-FIX; hasta que el writer aterrice el hardening,
# los asserts negativos de p6_1 / p6_12 quedan ROJOS (hoy Paso B usa el patron
# laxo `_[0-9]+` y crea `p6`). El verificador lo confirma al cierre.

# Instrumento minimo: un survey con `type`/`name`/`label`. Por defecto `text`,
# que `.dn_expected_data_names` conserva como variable analizable de la base ancha.
.canon_mk_inst <- function(names, types = NULL) {
  if (is.null(types)) types <- rep("text", length(names))
  list(
    survey = data.frame(type = types, name = names, label = names,
                        stringsAsFactors = FALSE, check.names = FALSE),
    choices = data.frame(list_name = character(0), name = character(0),
                         label = character(0), stringsAsFactors = FALSE)
  )
}

# --- Caso 1: slug canonico --------------------------------------------------
test_that("`.dn_canon_slug` normaliza CamelCase, acentos y separadores", {
  expect_identical(
    .dn_canon_slug(c("AñosG", "IngresoG", "AñoingreG", "P16_3", "Sexo")),
    c("anos_g", "ingreso_g", "anoingre_g", "p16_3", "sexo")
  )
  # Robustez determinista bajo cualquier locale: el mapa de acentos es manual, no
  # depende de iconv//TRANSLIT (trampa de locale C del arbol).
  expect_identical(.dn_canon_slug("Año Ingreso"), "ano_ingreso")
  expect_identical(.dn_canon_slug(NA_character_), "")
  expect_identical(.dn_canon_slug(character(0)), character(0))
})

# --- Caso 2 (H1): Paso B solo aliasea el dedup Kobo zero-padded --------------
test_that("H1: Paso B distingue dedup Kobo (`_NNN` zero-padded) de sub-preguntas `_N`", {
  inst_p6 <- .canon_mk_inst("p6")

  # NEGATIVO: `p6` ausente, data trae un UNICO `p6_1` (sub-pregunta ajena, no
  # dummy de select_multiple). Post-fix el zero-padding discrimina: `_1` NO es
  # dedup Kobo -> el canon NO debe fabricar `p6`.
  d1 <- data.frame(p6_1 = c("a", "b"), stringsAsFactors = FALSE, check.names = FALSE)
  r1 <- .dn_reconcile_canonical_names(d1, inst_p6)
  expect_length(r1$aliased, 0)
  expect_false("p6" %in% names(r1$data),
               info = "Paso B fabrico `p6` desde `p6_1` (sufijo NO zero-padded): falta el hardening de H1.")

  # NEGATIVO discriminante: `_12` tampoco tiene zero-padding.
  d12 <- data.frame(p6_12 = c("a", "b"), stringsAsFactors = FALSE, check.names = FALSE)
  r12 <- .dn_reconcile_canonical_names(d12, inst_p6)
  expect_length(r12$aliased, 0)
  expect_false("p6" %in% names(r12$data))

  # POSITIVO: `incidencias` ausente, data trae `incidencias_001` (dedup Kobo real).
  inst_inc <- .canon_mk_inst("incidencias")
  d001 <- data.frame(incidencias_001 = c("x", "y"), stringsAsFactors = FALSE, check.names = FALSE)
  r001 <- .dn_reconcile_canonical_names(d001, inst_inc)
  expect_identical(unname(r001$aliased["incidencias"]), "incidencias_001")
  expect_true("incidencias" %in% names(r001$data))

  # POSITIVO discriminante: `_01` (zero-padded) tambien conecta.
  d01 <- data.frame(incidencias_01 = c("x", "y"), stringsAsFactors = FALSE, check.names = FALSE)
  r01 <- .dn_reconcile_canonical_names(d01, inst_inc)
  expect_identical(unname(r01$aliased["incidencias"]), "incidencias_01")
})

# --- Caso 3: guard de >1 candidata ------------------------------------------
test_that("guard: dos columnas que colapsan al mismo slug -> no-op (no fusiona)", {
  inst <- .canon_mk_inst("sexo")
  d <- data.frame(Sexo = c(1, 2), SEXO = c(3, 4), check.names = FALSE)
  r <- .dn_reconcile_canonical_names(d, inst)
  expect_length(r$aliased, 0)
  expect_false("sexo" %in% names(r$data))
  # Ninguna candidata fue consumida.
  expect_true(all(c("Sexo", "SEXO") %in% names(r$data)))
})

# --- Caso 4: guard de nombre literal protegido ------------------------------
test_that("guard: una columna cuyo nombre literal ya es del survey no se roba ni renombra", {
  # Survey declara `sexo` y `Sexo` como variables distintas; la data trae el
  # literal `Sexo`. Para el `sexo` ausente, `Sexo` NO es candidata (es un nombre
  # del survey), asi que queda intacto para su propio match literal.
  inst <- .canon_mk_inst(c("sexo", "Sexo"))
  d <- data.frame(Sexo = c(1, 2), check.names = FALSE)
  r <- .dn_reconcile_canonical_names(d, inst)
  expect_length(r$aliased, 0)
  expect_true("Sexo" %in% names(r$data))
  expect_false("sexo" %in% names(r$data))
})

# --- Caso 5 (H3): colision de slug DENTRO del survey ------------------------
test_that("H3: dos variables del survey con el mismo slug -> comportamiento definido, sin crash", {
  # `AñosG` y `AnosG` colapsan al mismo slug `anos_g`; la data trae un unico
  # `anos_g`. La primera en el orden esperado recibe la data; la otra queda
  # ausente (no hay segunda columna que conectar). Sin error.
  inst <- .canon_mk_inst(c("AñosG", "AnosG"))
  d <- data.frame(anos_g = c(10, 20), check.names = FALSE)
  r <- expect_error(.dn_reconcile_canonical_names(d, inst), NA)
  r <- .dn_reconcile_canonical_names(d, inst)
  # Exactamente una de las dos recibe la data.
  presentes <- c("AñosG", "AnosG") %in% names(r$data)
  expect_true(sum(presentes) == 1L,
              info = sprintf("presentes AñosG/AnosG = %s", paste(presentes, collapse = "/")))
  # El par origen->destino queda registrado para la que si conecto.
  destino <- c("AñosG", "AnosG")[presentes]
  expect_identical(unname(r$aliased[destino]), "anos_g")
  expect_length(r$aliased, 1)
})

# --- Caso 6 (H4): base degenerada -------------------------------------------
test_that("H4: base de una sola columna (y vacia) no revienta el canon ni el backfill", {
  inst <- .canon_mk_inst("p1")
  one <- data.frame(otra = c("z"), stringsAsFactors = FALSE, check.names = FALSE)
  empty <- data.frame()

  expect_error(.dn_reconcile_canonical_names(one, inst), NA)
  expect_error(.dn_reconcile_canonical_names(empty, inst), NA)
  expect_error(.dn_backfill_missing_columns(one, .dn_expected_data_names(inst)), NA)
  expect_error(.dn_backfill_missing_columns(empty, c("p1")), NA)
  # Pipeline completo sobre una sola columna: tampoco revienta.
  expect_error(normalize_data_for_xlsform(one, inst), NA)
})

# --- Caso 7: trazabilidad + supervivencia de atributos ----------------------
test_that("trazabilidad: el alias registra destino<-origen y preserva label/clase haven", {
  skip_if_not_installed("haven")
  inst <- .canon_mk_inst("incidencias")
  col <- haven::labelled(c(1, 2), labels = c(Si = 1, No = 2))
  attr(col, "label") <- "Numero de incidencias"
  di <- data.frame(incidencias_001 = col, check.names = FALSE)

  # Helper directo: la columna renombrada conserva clase haven y label.
  r <- .dn_reconcile_canonical_names(di, inst)
  expect_identical(unname(r$aliased["incidencias"]), "incidencias_001")
  expect_true(inherits(r$data[["incidencias"]], "haven_labelled"))
  expect_identical(attr(r$data[["incidencias"]], "label"), "Numero de incidencias")

  # Pipeline: el atributo de trazabilidad expone el par destino<-origen.
  norm <- normalize_data_for_xlsform(di, inst)
  tr <- attr(norm, "xlsform_normalized")
  expect_true(is.list(tr))
  expect_true("incidencias" %in% names(tr$aliases))
  expect_identical(unname(tr$aliases["incidencias"]), "incidencias_001")
})
