# El colector que viaja en el QR habla el idioma del operativo — B8(g).
#
# Dictado del dueño (2026-08-31, reabre la decision L2 del 2026-08-27): el
# enlace de cada aula viaja hoy con `d[collectorID]=mat202_0591` —el
# curso-horario— y debe viajar el CODIGO OPERATIVO («CH 1», «R 10.1»), que es
# lo que el equipo reconoce al mirar una respuesta suelta en Kobo. Verificado
# en vivo: la ficha del registro de CH 1 muestra `...collectorID=mat202_0591`.
#
# El punto de cambio es `.ca_unit_value()` (collection_adapters.R): la cadena
# `link_key → prefill_value → logical_collector_id → dims$classroom_id →
# unit_id` entrega el curso-horario porque el codigo operativo vive en
# `dims$legacy_ref` —el `source_key` de `.collection_legacy_unit()`, que
# antepone `operational_code`— y la cadena no lo mira. La atribucion de
# Monitoreo no se rompe: `.monitoreo_aulas_contar_por_fila()` prueba
# `classroom_id` antes que `collection_unit_id`, y en el plan real
# `classroom_id == operational_code` (el lector del libro escribe
# `classroom_id = code`, carga_aulas_agendadas.R). Las dos generaciones de QR
# conviven sin reimprimir.
#
# Tres tests son ROJOS hoy y pasaran con la reparacion (titular, reserva y
# URL); los otros tres son guardas verdes que la reparacion no puede romper
# (salidas de escape, fallback sin codigo, convivencia de generaciones).

.cco_target <- function() list(
  provider = "kobo",
  base_access_url = "https://ee-eu.kobotoolbox.org/single/ccIcHAqm",
  asset_uid = "aNNuP72AedZ886EoAUeV5o", asset_type = "survey",
  deployment_active = TRUE,
  return_url = "https://pulso.pucp.edu.pe/noticias/enlace"
)

# El plan como lo escribe Calculo de muestra para HSVG2026: el codigo
# operativo en `operational_code` y el curso-horario en `classroom_id`.
.cco_plan_rows <- function() list(
  list(
    selection_run_id = "sel-cco", operational_code = "CH 1",
    classroom_id = "mat202_0591", label = "mat202_0591", wave = "M1",
    faculty = "CIENCIAS E INGENIERIA", sample_role = "titular"
  ),
  list(
    selection_run_id = "sel-cco", operational_code = "R 10.1",
    classroom_id = "1mat37_0521", label = "1mat37_0521", wave = "M2",
    faculty = "CIENCIAS E INGENIERIA", sample_role = "chain_reserve",
    titular_operational_code = "CH 1", replacement_for = "mat202_0591"
  )
)

# Siembra el plan real y devuelve preview + units para buscar el binding de
# cada unidad por su `legacy_ref`, que es donde vive el codigo operativo.
.cco_preview <- function(plan_rows = .cco_plan_rows()) {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", plan_rows)
  seeded <- collection_state_seed(sid)
  list(
    units = seeded$state$plan$units,
    preview = .ca_preview_deployment("kobo_existing_v1", seeded$state$plan, .cco_target())
  )
}

.cco_binding <- function(ctx, codigo) {
  unit <- Filter(function(u) identical(u$dimensions$legacy_ref, codigo), ctx$units)
  expect_length(unit, 1L)
  hit <- Filter(function(b) identical(b$unit_id, unit[[1]]$unit_id), ctx$preview$bindings)
  expect_length(hit, 1L)
  hit[[1]]
}

test_that("el collectorID del titular es su codigo operativo, no el curso-horario", {
  # ROJO hoy: `.ca_unit_value()` devuelve `dims$classroom_id` («mat202_0591»)
  # aunque la unidad trae su codigo operativo en `dims$legacy_ref` («CH 1»).
  ctx <- .cco_preview()
  binding <- .cco_binding(ctx, "CH 1")
  expect_identical(names(binding$prefill), "/aNNuP72AedZ886EoAUeV5o/collectorID")
  valor <- as.character(binding$prefill[[1]])
  expect_identical(valor, "CH 1")
  # Ni el curso-horario ni el slug de infraestructura: los dos le son opacos a
  # quien mira una respuesta suelta en Kobo.
  expect_false(identical(valor, "mat202_0591"))
  expect_false(grepl("^unit-aulas", valor))
})

test_that("la reserva viaja con SU codigo operativo, no con el del titular", {
  # ROJO hoy: sale «1mat37_0521». La reserva tiene cadena hacia CH 1, pero su
  # respuesta es SUYA: si viajara el codigo del titular, las respuestas de la
  # reserva activada se acumularian en el aula equivocada.
  ctx <- .cco_preview()
  binding <- .cco_binding(ctx, "R 10.1")
  valor <- as.character(binding$prefill[[1]])
  expect_identical(valor, "R 10.1")
  expect_false(identical(valor, "CH 1"))
  expect_false(identical(valor, "1mat37_0521"))
})

test_that("la URL codifica el espacio del codigo operativo y no se rompe", {
  # ROJO hoy por arrastre: la URL lleva `mat202_0591`. Con el codigo operativo
  # el valor trae espacio («CH 1») y debe viajar como %20 —medido en la oleada
  # anterior: 63 chars, QR 45x45— sin espacio literal ni parametro colgado.
  ctx <- .cco_preview()
  binding <- .cco_binding(ctx, "CH 1")
  url <- .collection_access_url(binding, "operational", "kobo",
                                "https://pulso.pucp.edu.pe/noticias/enlace")
  expect_match(url, "collectorID%5D=CH%201", fixed = TRUE)
  expect_false(grepl(" ", url, fixed = TRUE))
  # La URL sigue entera: base + prefill + retorno.
  expect_match(url, "^https://ee-eu.kobotoolbox.org/single/ccIcHAqm[?]")
  expect_match(url, "returnUrl=https%3A%2F%2Fpulso.pucp.edu.pe%2Fnoticias%2Fenlace", fixed = TRUE)
})

test_that("link_key y prefill_value explicitos siguen ganando la cadena", {
  # GUARDA verde: son la salida de escape declarada en `.ca_unit_value()` para
  # un plan que pida a mano otra cosa. La reparacion no puede pisarlos con el
  # codigo operativo.
  plan <- list(units = list(
    list(unit_id = "unit-a", label = "a", link_key = "opaque-custom",
         dimensions = list(legacy_ref = "CH 1", classroom_id = "mat202_0591")),
    list(unit_id = "unit-b", label = "b", prefill_value = "declarado-a-mano",
         dimensions = list(legacy_ref = "CH 2", classroom_id = "mat204_0122"))
  ))
  preview <- .ca_preview_deployment("kobo_existing_v1", plan, .cco_target())
  expect_identical(as.character(preview$bindings[[1]]$prefill[[1]]), "opaque-custom")
  expect_identical(as.character(preview$bindings[[2]]$prefill[[1]]), "declarado-a-mano")
})

test_that("una unidad sin codigo operativo sigue viajando con el curso-horario", {
  # GUARDA verde: el fallback de hoy. Un plan que no trae `operational_code`
  # sella su `legacy_ref` con el propio curso-horario, asi que el prefill no
  # puede quedar vacio: `d[collectorID]=` a secas llega a Kobo sin identificador
  # y no se descubre hasta el analisis (nota en collection_engine.R).
  ctx <- .cco_preview(list(list(
    selection_run_id = "sel-cco", classroom_id = "mat202_0591",
    label = "mat202_0591", wave = "M1", faculty = "CIENCIAS E INGENIERIA",
    sample_role = "titular"
  )))
  binding <- .cco_binding(ctx, "mat202_0591")
  valor <- as.character(binding$prefill[[1]])
  expect_identical(valor, "mat202_0591")
  expect_true(nzchar(valor))
})

test_that("las dos generaciones de collectorID conviven en la atribucion", {
  # GUARDA verde: `.monitoreo_aulas_contar_por_fila()` prueba `classroom_id`
  # antes que `collection_unit_id`. En el plan real `classroom_id` es el codigo
  # operativo (el lector del libro escribe `classroom_id = code`), asi que una
  # respuesta nueva con «CH 1» cuenta por el primer intento; lo ya recogido con
  # el valor viejo resuelve por el segundo — nadie reimprime lo repartido.
  filas <- data.frame(
    operational_code = c("CH 1", "CH 2"),
    classroom_id = c("CH 1", "CH 2"),
    collection_unit_id = c("mat202_0591", "mat204_0122"),
    stringsAsFactors = FALSE
  )
  # Generacion nueva: el QR trae el codigo operativo.
  nuevas <- table(c("CH 1", "CH 1", "CH 2"))
  expect_identical(.monitoreo_aulas_contar_por_fila(filas, nuevas), c(2L, 1L))
  # Generacion vieja: respuestas que ya llegaron con el curso-horario.
  viejas <- table(c("mat202_0591"))
  expect_identical(.monitoreo_aulas_contar_por_fila(filas, viejas), c(1L, 0L))
})
