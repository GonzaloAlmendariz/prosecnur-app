# collection_reseed.R — que conserva y que descarta rehacer el plan.
#
# `collection_state_reseed` (collection_engine.R) arma el estado nuevo con
# `.collection_seed_build()`, que solo sabe de schema, revision, plan,
# deployment y migration. Todo lo demas que vivia en `collection_state` se
# perdia sin nombrarse: la plantilla de material que el usuario habia ajustado,
# las fichas creadas, los recibos de lo renderizado. El docstring prometia que
# la UI pudiera decir el descarte ANTES, y `descartado` no lo contaba.
#
# Aqui cada campo hermano de `plan` tiene una clase explicita:
#
# - conservar: configuracion del usuario que no depende del plan. Sobrevive tal
#   cual; si referencia algo que el plan nuevo invalida, lo marca el flujo
#   normal (freshness de instancias, `vigente` de las pruebas), no el reseed.
# - descartar: derivado del plan/despliegue que se va. Queda obsoleto, se borra
#   y se CUENTA en `descartado`.
#
# Un campo que no este en ninguna de las dos listas se descarta, pero se nombra
# en `descartado$otros_campos`: callar un descarte es exactamente el defecto que
# este archivo repara. `test-collection-reseed-conserva.R` exige que todo campo
# que el modulo escribe en el estado este clasificado.

# Lo que `.collection_seed_build()` produce: no se conserva ni se descarta, se
# reemplaza.
.COLLECTION_RESEED_CAMPOS_SEMILLA <- c("schema", "state_revision", "plan", "deployment", "migration")

.COLLECTION_RESEED_CONSERVA <- c(
  # Plantilla de material (decision del lead, H26): configuracion del usuario.
  "material_template",
  # Plantilla de correo: misma naturaleza que la de material. `mail_template`
  # es la forma de antes de E1h (una sola); se conserva para que la migracion
  # en lectura la encuentre despues de rehacer el plan.
  "mail_template",
  # Campanas de correo (E1h): configuracion del usuario, no derivan del plan.
  # Los destinatarios no viven aqui (tempdir de la sesion) y no se tocan.
  "mail_campaigns",
  # Historico de fichas de prueba: no entra al plan; su `vigente` se recalcula
  # al leer contra el despliegue de hoy.
  "pruebas",
  # Carpeta de Drive recordada: destino del operativo, no del plan.
  "drive_fichas"
)

.COLLECTION_RESEED_DESCARTA <- c(
  "material_instances",
  "artifact_receipts",
  # Publicaciones en Drive: apuntan a `receipt_id` que se descartan. Los
  # archivos siguen en Drive; lo que se pierde es la anotacion en el estado.
  "drive_publicaciones"
)

#' Recuento de lo que rehacer el plan descartaria del estado `current`.
#'
#' Puro: no lee sesion ni muta. Lo usan igual la previsualizacion y la
#' escritura, para que ambas devuelvan el MISMO `descartado`.
#'
#' @param current collection_state vigente.
#' @return lista serializable.
#' @keywords internal
.collection_reseed_descartado <- function(current) {
  instancias <- .cm_instances(current)
  unidades_cubiertas <- unique(unlist(lapply(instancias, function(x) {
    as.character(unlist(x$unit_refs %||% list(), use.names = FALSE))
  }), use.names = FALSE))
  unidades_cubiertas <- unidades_cubiertas[!is.na(unidades_cubiertas) & nzchar(unidades_cubiertas)]
  publicaciones <- current$drive_publicaciones
  publicaciones <- if (is.list(publicaciones)) Filter(is.list, publicaciones) else list()
  presentes <- names(current)[!vapply(current, is.null, logical(1))]
  otros <- setdiff(
    presentes,
    c(.COLLECTION_RESEED_CAMPOS_SEMILLA, .COLLECTION_RESEED_CONSERVA, .COLLECTION_RESEED_DESCARTA)
  )
  list(
    plan_run_id = .cm_aulas_scalar(current$plan$source_ref$run_id %||% "", ""),
    unidades = length(current$plan$units %||% list()),
    tenia_despliegue = is.list(current$deployment) && length(current$deployment) > 0L,
    entregado = identical(.cm_aulas_scalar(current$deployment$status %||% "", ""), "handed_off"),
    fichas = list(
      instancias = length(instancias),
      unidades_cubiertas = length(unidades_cubiertas)
    ),
    recibos = length(.cm_receipts(current)),
    publicaciones_drive = length(publicaciones),
    otros_campos = as.list(sort(otros)),
    conservado = as.list(intersect(.COLLECTION_RESEED_CONSERVA, presentes))
  )
}

#' Copia al estado nuevo los campos que sobreviven al reseed.
#'
#' @param nuevo estado recien sembrado.
#' @param current estado que se reemplaza.
#' @return `nuevo` con los campos conservables de `current`.
#' @keywords internal
.collection_reseed_conservar <- function(nuevo, current) {
  for (campo in .COLLECTION_RESEED_CONSERVA) {
    if (!is.null(current[[campo]])) nuevo[[campo]] <- current[[campo]]
  }
  nuevo
}

#' Como se leeria el plan nuevo, para que la UI muestre el antes y el despues.
#'
#' `huella` y `diferencias` salen de la MISMA proyeccion que GET /origen
#' (collection_origen.R), asi que «entran 2, salen 0, cambian 1» en la
#' confirmacion coincide con lo que la pestaña Origen listaba. Sin `current` (o
#' sin plan previo) las diferencias no se calculan.
#'
#' Una diferencia deliberada: aqui NO se toma el atajo del eco de Monitoreo
#' (`.collection_origen_circular`). Origen compara el plan consigo mismo cuando
#' la fuente es la copia que la entrega escribio desde el; rehacer, en cambio,
#' SI construiria desde esa copia, y la confirmacion tiene que decir lo que va a
#' pasar de verdad. `circular` lo avisa.
#'
#' @keywords internal
.collection_reseed_propuesto <- function(sembrado, current = NULL) {
  p_nuevo <- .collection_origen_proyeccion(sembrado$plan$units %||% list())
  out <- list(
    plan_run_id = .cm_aulas_scalar(sembrado$plan$source_ref$run_id %||% "", ""),
    unidades = length(sembrado$plan$units %||% list()),
    huella = .collection_origen_huella(p_nuevo),
    diferencias = NA
  )
  if (is.list(current) && is.list(current$plan)) {
    cmp <- .collection_origen_comparar(
      .collection_origen_proyeccion(current$plan$units %||% list()), p_nuevo
    )
    out$diferencias <- list(
      altas = length(cmp$altas),
      bajas = length(cmp$bajas),
      campos = length(cmp$campos),
      roles = length(cmp$roles),
      unidades_con_cambios = length(cmp$unidades_con_cambios)
    )
  }
  out
}

#' `dry_run` del body. Ausente o falso: escribe. Cualquier otro valor que no se
#' lea como booleano cuenta como previsualizacion: ante la duda, no se muta.
#'
#' @keywords internal
.collection_reseed_dry_run <- function(value) {
  if (is.null(value) || !length(value)) return(FALSE)
  isTRUE(calc_bool(value, default = TRUE))
}
