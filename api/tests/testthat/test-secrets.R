
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
  # **La clave legada se PINEA para este test, y por el mismo motivo que existe
  # el test de arriba.** La derivación legada mira `nodename`, que en macOS
  # cambia al cambiar de red — es el fallo del 2026-09-08. En una corrida
  # completa de la suite (~1 h) eso pasa de verdad: si el nombre de la máquina
  # cambia entre la escritura y la lectura, las dos mitades usan claves
  # distintas y el test sale rojo con el texto descifrado en basura. Medido el
  # 2026-09-12: rojo en la corrida completa, verde al correr el fichero solo.
  #
  # Lo que este test comprueba es la MIGRACIÓN —abrir con la clave vieja y
  # re-cifrar con la de la instalación—, no la estabilidad del hostname. Con la
  # clave legada pineada, la migración se prueba igual y el rojo aleatorio
  # desaparece; un rojo que aparece y se va enseña a ignorar el fichero, y éste
  # es justo el que guarda el incidente que tumbó todos los conectores en pleno
  # campo.
  clave_legada <- prosecnurapp:::.derive_key_legado()
  local_mocked_bindings(.derive_key_legado = function() clave_legada)

  # Se escribe a mano con la clave LEGADA, como estaban los secretos en disco.
  iv <- openssl::rand_bytes(16L)
  ct <- openssl::aes_cbc_encrypt(charToRaw("token-viejo"),
                                 key = clave_legada, iv = iv)
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
  # 16 bytes de IV + 20 de cifrado: no es múltiplo del bloque AES, así que
  # ninguna clave lo abre. Con 64 bytes al azar el relleno salía válido ~1 de
  # cada 128 corridas y el test caía en falso (CI de 0.9.4).
  writeBin(openssl::rand_bytes(36L), con); close(con)
  expect_true(prosecnur_secret_exists(nombre))
  expect_true(prosecnur_secret_locked(nombre))
  expect_true(is.na(prosecnur_secret_load(nombre)))
})
