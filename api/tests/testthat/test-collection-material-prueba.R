# La ficha que no va a un aula: prueba de enlace y capacitación.
#
# Existe por dos necesidades del operativo de HSVG2026: antes de imprimir 1.512
# hojas hay que escanear UNA y comprobar que el QR abre, que la respuesta llega
# con su `collectorID` y que al terminar redirige; y el equipo necesita practicar
# en la capacitación sin meter respuestas al estudio.

.cmpx_sid <- function(return_url = "https://pulso.pucp.edu.pe/noticias/enlace") {
  sid <- session_create()
  session_set(sid, "monitoreo_aulas_plan", list(
    list(
      selection_run_id = "sel-prueba", operational_code = "CH 1",
      classroom_id = "mat202_0591", label = "mat202_0591", wave = "M1",
      faculty = "CIENCIAS E INGENIERIA", sample_role = "titular"
    ),
    list(
      selection_run_id = "sel-prueba", operational_code = "R 1.1",
      classroom_id = "1mat37_0521", label = "1mat37_0521", wave = "M2",
      faculty = "CIENCIAS E INGENIERIA", sample_role = "chain_reserve"
    )
  ))
  seeded <- collection_state_seed(sid)
  target <- list(
    provider = "kobo",
    base_access_url = "https://ee-eu.kobotoolbox.org/single/ccIcHAqm",
    asset_uid = "aNNuP72AedZ886EoAUeV5o", asset_type = "survey",
    deployment_active = TRUE, return_url = return_url
  )
  preview <- .ca_preview_deployment("kobo_existing_v1", seeded$state$plan, target)
  put <- collection_deployment_put(sid, deployment = preview,
                                   expected_revision = seeded$state$state_revision)
  prep <- collection_deployment_prepare(sid, expected_revision = put$state$state_revision)
  collection_material_template_put(
    sid, template = collection_material_field_sheet_template(),
    expected_revision = prep$state$state_revision
  )
  sid
}

.cmpx_url <- function(snapshot) {
  .collection_access_url(
    snapshot$deployment$bindings[[1]], "operational", "kobo",
    snapshot$deployment$target$return_url
  )
}

test_that("la ficha de prueba lleva el MISMO enlace, con otro identificador", {
  sid <- .cmpx_sid(); on.exit(session_delete(sid), add = TRUE)
  real <- .collection_access_url(
    .collection_current(session_get(sid))$deployment$bindings[[1]],
    "operational", "kobo", "https://pulso.pucp.edu.pe/noticias/enlace"
  )
  prueba <- .cmpx_url(collection_material_prueba_snapshot(sid, "PRUEBA_2026"))

  # Todo igual salvo el valor: mismo servidor, misma ruta `/single/`, mismo
  # nombre de parametro de prefill y mismo returnUrl. Una ficha de ensayo con un
  # enlace parecido pero no identico no demuestra nada del que va a campo.
  expect_identical(
    sub("collectorID%5D=[^&]*", "collectorID%5D=X", real),
    sub("collectorID%5D=[^&]*", "collectorID%5D=X", prueba)
  )
  expect_match(prueba, "collectorID%5D=PRUEBA_2026&", fixed = TRUE)
  expect_false(grepl("mat202_0591", prueba, fixed = TRUE))
})

test_that("los tres nombres del operativo salen con su propio colector", {
  sid <- .cmpx_sid(); on.exit(session_delete(sid), add = TRUE)
  for (codigo in c("PRUEBA_2026", "CAPACITACION", "prueba_interna")) {
    snap <- collection_material_prueba_snapshot(sid, codigo)
    expect_match(.cmpx_url(snap), paste0("collectorID%5D=", codigo, "&"), fixed = TRUE)
    # Y el nombre del archivo dice que es una prueba: una hoja indistinguible de
    # las 1.512 puede colarse en el reparto, y entonces alguien aplica un aula
    # entera contra un colector que no existe en el plan.
    expect_match(snap$output_filename, "ficha_prueba_", fixed = TRUE)
  }
})

test_that("generar fichas de prueba NO toca el plan ni deja instancias", {
  # Si entraran al plan moverian el conteo de unidades, el handoff a Monitoreo y
  # las cuotas por facultad. Quedan en `pruebas`, una lista hermana.
  sid <- .cmpx_sid(); on.exit(session_delete(sid), add = TRUE)
  antes <- collection_state_get(sid)
  for (codigo in c("PRUEBA_2026", "CAPACITACION")) {
    .cmp_registrar(sid, collection_material_prueba_snapshot(sid, codigo))
  }
  despues <- collection_state_get(sid)

  expect_identical(length(despues$state$plan$units), length(antes$state$plan$units))
  expect_length(despues$state$material_instances %||% list(), 0L)
  expect_identical(
    length(despues$state$deployment$bindings), length(antes$state$deployment$bindings)
  )
  # La revision SI sube: registrar la ficha es un cambio del proyecto que hay que
  # guardar. Lo que no cambia es lo que se cuenta y lo que viaja al handoff.
  expect_gt(despues$state$state_revision, antes$state$state_revision)
  expect_length(despues$state$pruebas, 2L)
})

test_that("el historico recuerda el enlace de cada ficha", {
  sid <- .cmpx_sid(); on.exit(session_delete(sid), add = TRUE)
  snap <- collection_material_prueba_snapshot(sid, "CAPACITACION", "Taller 12 de agosto")
  .cmp_registrar(sid, snap, creada_en = "2026-08-27T10:00:00Z")

  h <- collection_prueba_historico(sid)
  expect_length(h$pruebas, 1L)
  ficha <- h$pruebas[[1]]
  expect_identical(ficha$codigo, "CAPACITACION")
  expect_identical(ficha$etiqueta, "Taller 12 de agosto")
  expect_identical(ficha$enlace, .cmpx_url(snap))
  expect_identical(ficha$creada_en, "2026-08-27T10:00:00Z")
  expect_true(ficha$vigente)
})

test_that("un mismo codigo se actualiza en su sitio, no se duplica", {
  # `CAPACITACION` generada tres veces es una entrada, no tres: si no, el
  # historico se vuelve un log y deja de servir para «cual era el enlace».
  sid <- .cmpx_sid(); on.exit(session_delete(sid), add = TRUE)
  for (i in 1:3) .cmp_registrar(sid, collection_material_prueba_snapshot(sid, "CAPACITACION"))
  .cmp_registrar(sid, collection_material_prueba_snapshot(sid, "PRUEBA_2026"))

  h <- collection_prueba_historico(sid)
  expect_length(h$pruebas, 2L)
  expect_setequal(vapply(h$pruebas, function(x) x$codigo, character(1)),
                  c("CAPACITACION", "PRUEBA_2026"))
})

test_that("una ficha de un despliegue anterior se marca como no vigente", {
  # El enlace se guarda TAL COMO SE GENERO y no se recalcula: una hoja impresa
  # lleva el QR que llevaba. Pero si los accesos cambiaron, decirlo es la
  # diferencia entre un historico util y un enlace muerto que parece vigente.
  sid <- .cmpx_sid(); on.exit(session_delete(sid), add = TRUE)
  .cmp_registrar(sid, collection_material_prueba_snapshot(sid, "CAPACITACION"))
  expect_true(collection_prueba_historico(sid)$pruebas[[1]]$vigente)

  # Cambiar el returnUrl cambia el despliegue.
  estado <- collection_state_get(sid)
  otro <- estado$state$deployment
  otro$target$return_url <- "https://pulso.pucp.edu.pe/otro"
  puesto <- collection_deployment_put(sid, deployment = otro,
                                      expected_revision = estado$state$state_revision)
  collection_deployment_prepare(sid, expected_revision = puesto$state$state_revision)

  ficha <- collection_prueba_historico(sid)$pruebas[[1]]
  expect_false(ficha$vigente)
  # Y su enlace sigue siendo el de entonces, no el nuevo.
  expect_match(ficha$enlace, "noticias%2Fenlace", fixed = TRUE)
})

test_that("el historico no guarda binarios ni nada que parezca credencial", {
  # `.cc_security_problems()` rechaza data-URLs y claves con pinta de secreto. Un
  # estado que no valida no se puede persistir, asi que esto se comprueba aqui y
  # no el dia que alguien guarde el proyecto.
  sid <- .cmpx_sid(); on.exit(session_delete(sid), add = TRUE)
  .cmp_registrar(sid, collection_material_prueba_snapshot(sid, "CAPACITACION"))
  estado <- .collection_current(session_get(sid))
  expect_true(collection_state_validate(estado)$ok)
  expect_setequal(
    names(estado$pruebas[[1]]),
    c("codigo", "etiqueta", "enlace", "creada_en", "deployment_fingerprint")
  )
})

test_that("el titulo de la ficha de prueba es el codigo, y la etiqueta lo puede cambiar", {
  sid <- .cmpx_sid(); on.exit(session_delete(sid), add = TRUE)
  snap <- collection_material_prueba_snapshot(sid, "CAPACITACION")
  expect_identical(snap$plan$units[[1]]$label, "CAPACITACION")
  con_etiqueta <- collection_material_prueba_snapshot(sid, "CAPACITACION", "Taller 12 de agosto")
  expect_identical(con_etiqueta$plan$units[[1]]$label, "Taller 12 de agosto")
  # El codigo que viaja NO cambia por ponerle un rotulo distinto.
  expect_match(.cmpx_url(con_etiqueta), "collectorID%5D=CAPACITACION&", fixed = TRUE)
})

test_that("un codigo que rompe la URL o se lee mal en papel se rechaza", {
  sid <- .cmpx_sid(); on.exit(session_delete(sid), add = TRUE)
  # El espacio y el punto quedan fuera a proposito: «prueba 1» y «prueba_1»
  # serian dos colectores distintos en Kobo y nadie lo notaria.
  for (malo in c("", "   ", "prueba 1", "prueba.1", "ñandú", "a/b", "?x=1", strrep("x", 60))) {
    expect_error(
      collection_material_prueba_snapshot(sid, malo),
      class = "api_error", info = malo
    )
  }
  for (bueno in c("PRUEBA_2026", "CAPACITACION", "prueba_interna", "piloto-2", "X")) {
    expect_no_error(collection_material_prueba_snapshot(sid, bueno))
  }
})

test_that("sin accesos preparados avisa en vez de emitir una ficha sin enlace", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", list(list(
    selection_run_id = "sel-x", operational_code = "CH 1", classroom_id = "c1", label = "c1"
  )))
  collection_state_seed(sid)
  # El plan existe pero nadie configuro la URL base: no hay enlace del que
  # copiar, y una ficha de prueba con el QR vacio es peor que ninguna.
  expect_error(
    collection_material_prueba_snapshot(sid, "PRUEBA_2026"),
    class = "api_error"
  )
})

test_that("la ficha de prueba se renderiza de verdad y su PDF lleva el enlace", {
  sid <- .cmpx_sid(); on.exit(session_delete(sid), add = TRUE)
  snap <- collection_material_prueba_snapshot(sid, "PRUEBA_2026")
  dir <- tempfile("cmpx-"); dir.create(dir)
  sp <- file.path(dir, "snap.rds"); saveRDS(snap, sp)
  out <- file.path(dir, "prueba.pdf")
  collection_material_render_job(sp, "pdf", out, page = 1L)

  expect_true(file.exists(out))
  raw <- readBin(out, "raw", n = file.info(out)$size)
  expect_true(length(grepRaw(.cmpx_url(snap), raw, fixed = TRUE)) > 0L)
})
