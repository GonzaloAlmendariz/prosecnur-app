# =============================================================================
# Compatibilidad data<->XLSForm de los demos empaquetados (/api/system/demo)
# =============================================================================
#
# Regresion del bug: POST /api/system/demo reventaba los 3 demos con
# E_DATA_XLSFORM_INCOMPATIBLE porque la data cruda no calzaba con el instrumento:
#   - acreditacion: los .sav traen CamelCase de SurveyMonkey (`P1`, `Sexo`,
#     `AnosG`) y el survey usa snake_case (`p1`, `sexo`, `anos_g`); faltaban
#     90/91, 77/78 y 36/37 variables por base.
#   - giz: la columna existe como `incidencias_001` (dedup de Kobo) y el survey
#     la nombra `incidencias` -> 1/64 faltante.
#   - ops_salud: `n_cuesitonario` es una pregunta SIN datos (no hay columna) ->
#     1/349 faltante.
#
# El fix conecta DATA REAL: un canon de nombres (slug/acentos/snake) que renombra
# las columnas reales a los nombres del survey, y alias para el dedup de Kobo. El
# unico faltante legitimo que sobrevive al canon es `n_cuesitonario` (pregunta
# vacia), que el path del demo rellena con backfill benigno (NA).
#
# TRAMPA que esta suite blinda: el backfill benigno rellena TODA columna esperada
# ausente como NA. Si el canon fallara, el backfill "aprobaria" acreditacion
# rellenando 90 columnas NA -> demo VACIO con la guardia verde. Por eso el test
# separa dos etapas:
#   (3) CANON sin backfill -> giz y las 3 bases de acreditacion deben quedar con
#       n_missing == 0 (todo resuelto por canon/alias, no enmascarado).
#   (4) END-TO-END con backfill -> compat$ok == TRUE para las 5 bases.
#   (5) ANTI-MASCARA -> variables clave (`sexo`, `p1`) de acreditacion existen con
#       datos NO-NA reales, y las columnas 100%-NA tras el pipeline son pocas
#       (<< esperadas). Esto garantiza que el fix conecto los .sav CamelCase y no
#       los relleno de vacio.
#
# In-process y barato: sin plumber, sin jobs, sin red. Resuelve los paths con el
# MISMO mecanismo del endpoint (`.demo_meta` -> `.samples_dir()` + los *_file de
# `.DEMOS_META`) y skipea si el sample no esta en disco.

# Config por demo: que faltantes tolera la etapa de canon (antes del backfill) y
# que variables usar para el spot-check anti-mascara.
.sysdemo_config <- list(
  giz            = list(canon_allowed_missing = character(0),
                        antimask_vars = character(0)),
  ops_salud      = list(canon_allowed_missing = "n_cuesitonario",
                        antimask_vars = character(0)),
  acreditacion   = list(canon_allowed_missing = character(0),
                        antimask_vars = c("sexo", "p1"))
)

# Aplana `.DEMOS_META` (single-base y multi-base) a una lista de bases con sus
# paths resueltos, igual que hace el handler del endpoint.
.sysdemo_bases <- function() {
  out <- list()
  for (nm in names(.DEMOS_META)) {
    meta <- .demo_meta(nm)
    if (is.null(meta)) next
    if (is.list(meta$bases_resolved) && length(meta$bases_resolved) > 0L) {
      for (bn in names(meta$bases_resolved)) {
        b <- meta$bases_resolved[[bn]]
        out[[length(out) + 1L]] <- list(
          demo = nm, base = bn,
          inst_path = b$instrumento_path, data_path = b$data_path,
          available = isTRUE(b$available)
        )
      }
    } else {
      out[[length(out) + 1L]] <- list(
        demo = nm, base = "default",
        inst_path = meta$instrumento_path, data_path = meta$data_path,
        available = isTRUE(meta$available)
      )
    }
  }
  out
}

# --- Sanity: el catalogo resuelve al menos una base ---------------------------
test_that("el catalogo de demos resuelve rutas de samples", {
  skip_if(is.null(.samples_dir()), "No hay carpeta de samples (`.samples_dir()` es NULL).")
  bases <- .sysdemo_bases()
  expect_gt(length(bases), 0)
})

# --- Una prueba por base del catalogo ----------------------------------------
for (.b in .sysdemo_bases()) {
  local({
    b <- .b
    cfg <- .sysdemo_config[[b$demo]] %||% list(canon_allowed_missing = character(0),
                                               antimask_vars = character(0))
    label <- sprintf("%s / %s", b$demo, b$base)

    test_that(sprintf("demo %s: la data conecta con el XLSForm por canon (no por mascara)", label), {
      skip_if_not_installed("readxl")
      if (identical(tolower(tools::file_ext(b$data_path)), "sav")) {
        skip_if_not_installed("haven")
      }
      skip_if(!isTRUE(b$available),
              sprintf("Sample no disponible en disco para %s:\n  %s\n  %s",
                      label, b$inst_path, b$data_path))

      # (1) Leer instrumento y data crudos con el mismo mecanismo del endpoint.
      inst <- reporte_instrumento(path = b$inst_path)
      data <- .read_data_from_path(b$data_path)
      expect_gt(nrow(data), 0)

      # (2) Normalizar al contrato canonico del XLSForm.
      norm <- normalize_data_for_xlsform(data, inst)

      # (3) CANON, sin backfill: los faltantes que sobreviven deben estar dentro
      # de lo tolerado (vacio para giz/acreditacion; solo `n_cuesitonario` para
      # ops_salud). Si el canon fallara, aca aparecerian las 90/77/36 columnas
      # CamelCase sin resolver -> este assert las atrapa ANTES de que el backfill
      # las enmascare.
      compat_canon <- validate_data_xlsform_compatibility(norm, inst)
      unexpected_missing <- setdiff(compat_canon$missing_columns, cfg$canon_allowed_missing)
      expect_length(unexpected_missing, 0)
      if (length(unexpected_missing)) {
        # Info diagnostica sin depender del resultado del expect anterior.
        expect_true(FALSE, info = sprintf(
          "[%s] canon dejo %d faltante(s) fuera de lo tolerado: %s",
          label, length(unexpected_missing),
          paste(utils::head(unexpected_missing, 25), collapse = ", ")
        ))
      }
      expect_true(
        compat_canon$n_missing <= length(cfg$canon_allowed_missing),
        info = sprintf("[%s] n_missing=%d tras canon; tolerado=%d (%s)",
                       label, compat_canon$n_missing, length(cfg$canon_allowed_missing),
                       paste(cfg$canon_allowed_missing, collapse = ", "))
      )

      # (4) END-TO-END, con el backfill benigno del path del demo: compat OK.
      backfilled <- .carga_backfill_missing_expected(norm, inst)
      compat_e2e <- validate_data_xlsform_compatibility(backfilled, inst)
      expect_true(
        isTRUE(compat_e2e$ok),
        info = sprintf("[%s] tras backfill faltan %d/%d: %s",
                       label, compat_e2e$n_missing, compat_e2e$expected_columns,
                       paste(utils::head(compat_e2e$missing_columns, 25), collapse = ", "))
      )

      # (5) ANTI-MASCARA: variables clave con datos reales + pocas columnas 100%-NA.
      if (length(cfg$antimask_vars)) {
        for (v in cfg$antimask_vars) {
          expect_true(
            v %in% names(backfilled),
            info = sprintf("[%s] variable clave '%s' ausente tras el pipeline (canon no conecto la columna real)", label, v)
          )
          n_real <- if (v %in% names(backfilled)) sum(!is.na(backfilled[[v]])) else 0L
          expect_gt(n_real, 0)
          if (!(n_real > 0)) {
            expect_true(FALSE, info = sprintf(
              "[%s] variable clave '%s' quedo 100%%-NA: canon la 'resolvio' vacia en vez de conectar la data real",
              label, v
            ))
          }
        }
        # Las columnas esperadas 100%-NA deben ser pocas: la mascara las volveria
        # ~99% (90/91, 77/78, 36/37); el canon real deja solo preguntas vacias.
        expected_names <- .dn_expected_data_names(inst)
        present_expected <- intersect(expected_names, names(backfilled))
        all_na <- vapply(present_expected, function(nm) all(is.na(backfilled[[nm]])),
                         logical(1))
        n_all_na <- sum(all_na)
        cap <- ceiling(length(expected_names) * 0.5)
        expect_true(
          n_all_na < cap,
          info = sprintf("[%s] %d/%d columnas esperadas quedaron 100%%-NA (cap<%d) -> huele a backfill enmascarando el canon: %s",
                         label, n_all_na, length(expected_names), cap,
                         paste(utils::head(present_expected[all_na], 25), collapse = ", "))
        )
      }
    })
  })
}
