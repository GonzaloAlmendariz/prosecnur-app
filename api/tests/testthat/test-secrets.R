
# --- La clave de la instalación, y el secreto que no se puede abrir -----------
#
# El 2026-09-08, en pleno campo, TODOS los conectores dejaron de abrirse a la
# vez con «Falta autorizacion local» y los `.dat` intactos en disco. La clave
# derivaba de `usuario:nodename`, y en macOS el nodename es la IP: cambiar de
# red la cambiaba. Un token guardado a las 17:34 era ilegible a las 20:45, y no
# se podía volver a autorizar porque el cliente OAuth estaba cifrado igual.

test_that("la clave de cifrado no depende del hostname", {
  # Es el pin del fallo: si la derivación vuelve a mirar el nombre de la
  # máquina, un cambio de red vuelve a tumbar todos los conectores.
  cuerpo <- paste(deparse(body(prosecnurapp:::.derive_key)), collapse = " ")
  expect_false(grepl("nodename", cuerpo, fixed = TRUE))
  expect_false(grepl("Sys.info", cuerpo, fixed = TRUE))
  # Y es estable entre llamadas, que es lo único que el cifrado necesita.
  expect_identical(prosecnurapp:::.derive_key(), prosecnurapp:::.derive_key())
  expect_length(prosecnurapp:::.derive_key(), 32L)
})

test_that("un secreto escrito con el esquema viejo se abre y se migra solo", {
  skip_if_not_installed("openssl")
  nombre <- "prueba_migracion_clave"
  on.exit(prosecnur_secret_clear(nombre), add = TRUE)
  # Se escribe a mano con la clave LEGADA, como estaban los secretos en disco.
  iv <- openssl::rand_bytes(16L)
  ct <- openssl::aes_cbc_encrypt(charToRaw("token-viejo"),
                                 key = prosecnurapp:::.derive_key_legado(), iv = iv)
  con <- file(prosecnurapp:::.secret_path(nombre), open = "wb")
  writeBin(c(iv, as.raw(ct)), con); close(con)

  # Se lee sin que nadie tenga que volver a autorizar nada.
  expect_identical(prosecnur_secret_load(nombre), "token-viejo")
  # Y queda re-cifrado con la clave de la instalación: se lee igual aunque la
  # legada deje de servir.
  local_mocked_bindings(.derive_key_legado = function() openssl::rand_bytes(32L))
  expect_identical(prosecnur_secret_load(nombre), "token-viejo")
})

test_that("«no hay secreto» y «hay uno que no abre» se distinguen", {
  # Las dos cosas contaban igual y costaban lo mismo de diagnosticar.
  nombre <- "prueba_secreto_ilegible"
  on.exit(prosecnur_secret_clear(nombre), add = TRUE)
  expect_false(prosecnur_secret_locked("un_secreto_que_no_existe"))

  con <- file(prosecnurapp:::.secret_path(nombre), open = "wb")
  writeBin(openssl::rand_bytes(64L), con); close(con)
  expect_true(prosecnur_secret_exists(nombre))
  expect_true(prosecnur_secret_locked(nombre))
  expect_true(is.na(prosecnur_secret_load(nombre)))
})
