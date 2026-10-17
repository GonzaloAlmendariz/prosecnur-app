# `collection_state_validate` con un plan real de aulas (2.373 unidades) tardaba
# ~7,3 s por llamada, y /api/recopiladores/state valida en cada request. Casi
# todo (~6,7 s) era `.cc_security_problems`, el recorrido de binarios, data-URLs
# y claves de credencial, que ahora se evalua vectorizado por nivel.
#
# Lo que este archivo fija es que la version rapida devuelve EXACTAMENTE lo
# mismo que la anterior —problemas, rutas, codigos, detalle y orden—. La
# version anterior se conserva aqui como oraculo, copiada literal.

.cc_security_problems_oraculo <- function(x, path = "value") {
  problems <- list()
  if (is.raw(x)) {
    return(list(.cc_problem(path, "binary_in_state", "El estado no puede contener binarios.")))
  }
  if (is.character(x) && length(x)) {
    bad <- which(grepl("^data:(image|application|audio|video)/", x, ignore.case = TRUE))
    for (i in bad) {
      problems[[length(problems) + 1L]] <- .cc_problem(
        sprintf("%s[%d]", path, i), "binary_in_state",
        "Data-URLs y previews regenerables quedan fuera del .pulso."
      )
    }
  }
  if (!is.list(x)) return(problems)

  nms <- names(x)
  for (i in seq_along(x)) {
    nm <- if (!is.null(nms) && !is.na(nms[[i]]) && nzchar(nms[[i]])) {
      nms[[i]]
    } else {
      sprintf("[%d]", i)
    }
    child_path <- if (startsWith(nm, "[")) paste0(path, nm) else paste(path, nm, sep = ".")
    if (grepl(
      "(^|_)(token|access_token|refresh_token|api_key|password|secret|authorization|credential|private_key|client_secret)($|_)",
      tolower(nm)
    )) {
      problems[[length(problems) + 1L]] <- .cc_problem(
        child_path, "secret_in_state",
        sprintf("`%s` parece una credencial y no puede persistirse en collection_state.", nm)
      )
    }
    problems <- c(problems, .cc_security_problems_oraculo(x[[i]], child_path))
  }
  problems
}

.cvr_arbol_hostil <- function() {
  sin_nombres <- list("a", list(api_key = "x"), NULL)
  nombres_na <- list(1, 2, "data:image/png;base64,AAAA")
  names(nombres_na) <- c("ok", NA, "")
  list(
    schema = "collection_state/v1",
    api_token = NULL,                         # clave secreta con valor NULL
    Password = "p",                           # mayusculas
    my_secret_value = list(),                 # vacio pero con nombre secreto
    tokenizer = "no casa",                    # no es token por frontera
    datos = c("hola", "DATA:IMAGE/png;base64,xx", "data:application/pdf;x"),
    bin = as.raw(c(1, 2)),
    bin_vacio = raw(0),
    vacio = character(0),
    factor = factor(c("data:image/png;x")),   # factor: no es texto
    tabla = data.frame(
      access_token = c("t1", "t2"),
      url = c("https://x", "data:video/mp4;x"),
      stringsAsFactors = FALSE
    ),
    sin_nombres = sin_nombres,
    nombres_na = nombres_na,
    profundo = list(a = list(b = list(c = list(client_secret = "s", d = list(raw = as.raw(1)))))),
    numeros = 1:3,
    logico = NA
  )
}

.cvr_estado_grande <- function(n = 2373L) {
  rows <- lapply(seq_len(n), function(i) list(
    selection_run_id = "run-1", operational_code = sprintf("CH %d", i),
    label = sprintf("Aula %d", i), wave = "M1", faculty = sprintf("Fac %d", i %% 12),
    course_id = sprintf("Curso %d", i), sample_role = "titular", schedule = "08:00",
    venue = sprintf("A-%d", i), teacher = sprintf("Docente %d", i), eligible_n = 30,
    link = sprintf("https://kf.kobotoolbox.org/x/form?d%%5BcollectorID%%5D=CH%d", i)
  ))
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", rows)
  collection_state_seed(sid)
  session_get(sid)$collection_state
}

test_that("el recorrido rapido devuelve lo mismo que el anterior en un arbol hostil", {
  arbol <- .cvr_arbol_hostil()
  esperado <- .cc_security_problems_oraculo(arbol, "state")
  # Precondicion: el arbol si dispara problemas de los tres tipos.
  codigos <- vapply(esperado, function(p) p$code, character(1))
  expect_true(all(c("secret_in_state", "binary_in_state") %in% codigos))
  expect_gte(length(esperado), 10L)
  expect_identical(.cc_security_problems(arbol, "state"), esperado)

  for (hoja in list(NULL, "x", as.raw(1), raw(0), character(0), list(), 1L,
                    c("data:image/png;a", "b", "data:audio/x;c"))) {
    expect_identical(
      .cc_security_problems(hoja, "v"),
      .cc_security_problems_oraculo(hoja, "v")
    )
  }
})

test_that("con 2.373 unidades la validacion da el mismo veredicto que el recorrido anterior", {
  estado <- .cvr_estado_grande()
  expect_length(estado$plan$units, 2373L)
  rapido <- collection_state_validate(estado)

  testthat::local_mocked_bindings(.cc_security_problems = .cc_security_problems_oraculo)
  lento <- collection_state_validate(estado)
  expect_identical(rapido, lento)
  expect_true(isTRUE(rapido$ok))

})

test_that("con un secreto plantado en el estado grande, rapido y oraculo coinciden", {
  estado <- .cvr_estado_grande()
  estado$plan$units[[1200]]$dimensions$api_key <- "k"
  estado$deployment$bindings[[7]]$prefill$foto <- "data:image/png;base64,AAAA"
  rapido <- .cc_security_problems(estado, "state")
  expect_identical(rapido, .cc_security_problems_oraculo(estado, "state"))
  rutas <- vapply(rapido, function(p) p$path, character(1))
  expect_true("state.plan.units[1200].dimensions.api_key" %in% rutas)
  expect_true("state.deployment.bindings[7].prefill.foto[1]" %in% rutas)
})
