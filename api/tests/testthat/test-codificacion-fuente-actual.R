# Codificación lee la fuente vigente de la base, no un respaldo congelado.
#
# `original_*` se fija la primera vez que se adapta y no vuelve a moverse. Tras
# reemplazar las respuestas (o refrescar Kobo) la base ya no es un artefacto
# adaptado, así que su fuente es el archivo actual; sólo una base adaptada se
# re-adapta desde su original. Misma regla que `.analitica_original_member_id`.
# Visto en CCSS 2026-2: Codificación re-adaptaba 467 casos en vez de 397.
# Fixtures en helper-base-variables.R.

# Simula lo que deja `.codif_apply_complete()`: par adaptado registrado y
# `original_*` congelado en el par de partida.
.cfa_adaptar <- function(sid, base) {
  s <- session_get(sid)
  meta <- s$estudio$bases[[base]]
  dat <- .read_data_any(s$files[[meta$data_file_id]])
  data_out <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(dat, data_out, overwrite = TRUE)
  inst_out <- tempfile(fileext = ".xlsx")
  file.copy(s$files[[meta$xlsform_file_id]]$path, inst_out)
  .codif_apply_complete(sid, base, list(data_out = data_out, inst_out = inst_out))
  invisible(session_get(sid)$estudio$bases[[base]])
}

.cfa_n_fuente <- function(sid) nrow(.read_data_any(.codif_source_pair_for_adapt(sid)$data))

test_that("tras adaptar y reemplazar las respuestas, Codificación lee la data nueva", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  estudio_active_base_set(sid, "2026")
  adaptada <- .cfa_adaptar(sid, "2026")
  expect_identical(session_get(sid)$files[[adaptada$data_file_id]]$kind, "data_adaptada")
  expect_identical(.cfa_n_fuente(sid), 40L)

  nueva <- .bv_data_2026()[1:30, ]
  dmeta <- save_upload(sid, "data", "data_2026_v2.xlsx", .bv_xlsx_bytes(list(data = nueva)))
  carga_reemplazar_respuestas(sid, "2026", dmeta$file_id)

  par <- .codif_source_pair_for_adapt(sid)
  expect_identical(par$data$file_id, dmeta$file_id)
  expect_identical(.cfa_n_fuente(sid), 30L)
  # El formulario sigue siendo el adaptado: se re-adapta desde su original.
  base <- session_get(sid)$estudio$bases[["2026"]]
  expect_identical(par$xls$file_id, base$original_xlsform_file_id)
  expect_null(codificacion_fuente_aviso_n(sid, "2026", 30L))
})

test_that("una base adaptada se sigue re-adaptando desde su original", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  estudio_active_base_set(sid, "2026")
  antes <- session_get(sid)$estudio$bases[["2026"]]
  .cfa_adaptar(sid, "2026")
  par <- .codif_source_pair_for_adapt(sid)
  expect_identical(par$data$file_id, antes$data_file_id)
  expect_identical(par$xls$file_id, antes$xlsform_file_id)
})

test_that("un refresco con la forma del de Kobo también lee el par nuevo", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  estudio_active_base_set(sid, "2026")
  .cfa_adaptar(sid, "2026")
  # Mismas dos llamadas que `router_carga.R` al refrescar Kobo.
  xmeta <- save_upload(sid, "xlsform", "2026_refresh_xlsform.xlsx", .bv_xlsx_bytes(.bv_inst_2026()))
  dmeta <- save_upload(sid, "data", "2026_refresh_data.xlsx",
                       .bv_xlsx_bytes(list(data = .bv_data_2026()[1:25, ])))
  estudio_preserve_original_base_files(sid, "2026")
  estudio_replace_base_files(sid, "2026", xlsform_file_id = xmeta$file_id,
                             data_file_id = dmeta$file_id, data_ext = "xlsx", n_filas = 25L)
  par <- .codif_source_pair_for_adapt(sid)
  expect_identical(par$xls$file_id, xmeta$file_id)
  expect_identical(par$data$file_id, dmeta$file_id)
  expect_identical(.cfa_n_fuente(sid), 25L)
})

test_that("multibase: cada base lee su propio par y la hermana no se mueve", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  estudio_active_base_set(sid, "2026")
  .cfa_adaptar(sid, "2026")
  dmeta <- save_upload(sid, "data", "v2.xlsx", .bv_xlsx_bytes(list(data = .bv_data_2026()[1:30, ])))
  carga_reemplazar_respuestas(sid, "2026", dmeta$file_id)
  hermana <- session_get(sid)$estudio$bases[["2024"]]
  estudio_active_base_set(sid, "2024")
  par <- .codif_source_pair_for_adapt(sid)
  expect_identical(par$data$file_id, hermana$data_file_id)
  expect_identical(par$xls$file_id, hermana$xlsform_file_id)
  estudio_active_base_set(sid, "2026")
  expect_identical(.codif_source_pair_for_adapt(sid)$data$file_id, dmeta$file_id)
})

test_that("Codificación avisa si el n leído no es el de la base", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$estudio <- list(bases = list(default = list(n_filas = 397L)))
  .session_env[[sid]] <- s
  expect_null(codificacion_fuente_aviso_n(sid, "default", 397L))
  expect_message(aviso <- codificacion_fuente_aviso_n(sid, "default", 467L), "PULSO-AVISO")
  expect_match(aviso, "467")
  expect_match(aviso, "397")
  # Sin n declarado no hay contra qué comparar.
  expect_null(codificacion_fuente_aviso_n(sid, "nada", 467L))
})
