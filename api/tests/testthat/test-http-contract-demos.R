# =============================================================================
# Contrato HTTP real — carga de los demos empaquetados (/api/system/demo)
# =============================================================================
#
# Complementa el test in-process test-system-demos-compatibility.R con el path
# REAL por el wire: POST /api/system/demo levanta sesion, lee los samples, corre
# normalize + la guardia .carga_assert_data_xlsform_compatible y arma el estudio.
# Historia del bug: los 3 demos reventaban con 400 E_DATA_XLSFORM_INCOMPATIBLE
# (data cruda desalineada del XLSForm). Esta suite exige 200 por el wire.
#
# El endpoint es SINCRONO (no dispara jobs callr), asi que no requiere el runtime
# de jobs instalado — solo el server Plumber real (helper-http-contract.R).

test_that("POST /api/system/demo carga los 3 demos empaquetados con HTTP 200", {
  srv <- http_contract_server()

  # El catalogo del backend filtra por existencia en disco; solo probamos los
  # que el propio server declara disponibles para no fallar por samples ausentes.
  cat_resp <- http_get(srv, "/api/system/demos")
  expect_identical(cat_resp$status, 200L)
  disponibles <- vapply(cat_resp$json$demos %||% list(),
                        function(d) as.character(d$name %||% ""), character(1))
  if (!length(disponibles)) {
    skip("El backend no ofrece demos (samples ausentes en este entorno).")
  }

  esperados_n_bases <- list(giz = 1, ops_salud = 1, acreditacion = 3)

  for (demo in c("giz", "ops_salud", "acreditacion")) {
    if (!(demo %in% disponibles)) {
      # Sample no disponible: no lo exigimos, pero lo dejamos anotado.
      succeed(sprintf("demo '%s' no disponible en el catalogo del server; omitido.", demo))
      next
    }
    r <- http_post_json(srv, "/api/system/demo", body = list(name = demo))
    expect_identical(
      r$status, 200L,
      info = sprintf("POST /api/system/demo name=%s -> HTTP %d: %s",
                     demo, r$status,
                     paste(deparse(r$json$error %||% r$json), collapse = " "))
    )
    expect_true(isTRUE(r$json$ok), info = sprintf("demo=%s sin ok=TRUE", demo))
    expect_identical(as.character(r$json$demo_name), demo)
    expect_equal(
      as.numeric(r$json$n_bases), as.numeric(esperados_n_bases[[demo]]),
      info = sprintf("demo=%s esperaba %s bases, trajo %s",
                     demo, esperados_n_bases[[demo]], r$json$n_bases)
    )
    # Cada base cargada trae filas reales (no un estudio vacio enmascarado).
    filas <- vapply(r$json$bases %||% list(),
                    function(b) as.numeric(b$n_filas %||% 0), numeric(1))
    expect_true(
      length(filas) > 0 && all(filas > 0),
      info = sprintf("demo=%s trajo bases sin filas: %s",
                     demo, paste(filas, collapse = ", "))
    )
  }
})
