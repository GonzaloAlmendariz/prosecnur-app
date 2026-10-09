# El parte de campo registrado EN LA APP llega a `monitoreo_aulas_partes_campo`.
#
# Este archivo existe porque el canal del parte 2026 es la app (decision de
# Gonzalo, 2026-08-31), y hasta hoy el registro en-app moria en el plan: el
# endpoint `/api/monitoreo/aulas/agenda` escribia via
# `monitoreo_aulas_update_agenda` sobre `monitoreo_aulas_plan`, pero la hoja
# «Aulas Aplicadas (Campo)» del libro se llena desde
# `monitoreo_aulas_partes_campo`, cuyo UNICO escritor era importar un libro
# (`.calb_aplicar_en_sesion`, carga_aulas_libro.R). Un estudio operado 100 % en
# la app generaba la hoja de campo EN BLANCO aunque cada aula tuviera sus
# efectivas, su aplicador y su fecha en el plan.
#
# Aqui vive el puente: extraer de un update lo que es PARTE (no agenda),
# archivarlo por codigo operativo e intento —la misma clave
# `sprintf("%s#%d", cod, intento)` con la que el generador indexa— y espejarlo
# en sesion y config igual que hace la importacion del libro.

# Los campos de parte que un update en-app puede producir, ya en nombre
# canonico. `application_status` no esta: solo se deriva de
# `operational_status` cuando el update trae ademas >= 1 de estos (agendar no
# es aplicar). `applied_time` tampoco: la tabla de alias lo traduce por espejo,
# pero el contrato del parte en-app archiva estos ocho.
.PARTE_APP_CAMPOS <- c(
  "observed_students", "refusals", "duplicates", "effective_surveys",
  "applied_by", "actual_room", "applied_at", "field_note"
)

# ESPEJO de la tabla de alias de `monitoreo_aulas_update_agenda`
# (monitoreo_aulas_universitarias.R): son la MISMA superficie de entrada, no
# dos vocabularios. Un alias que el update traduce y este extractor no —o al
# reves— partiria el registro en dos: la fecha llegaria al plan y no al parte.
.parte_app_alias <- function(nm) {
  switch(nm,
    applied_date = "applied_at",
    fecha_aplicacion = "applied_at",
    hora_aplicacion = "applied_time",
    observaciones = "field_note",
    aplicador = "applied_by",
    nm
  )
}

#' Extrae de una fila de update SOLO los campos de parte, en nombre canonico.
#'
#' El CERO es dato: `refusals = 0` es un hecho de campo, no una ausencia
#' (mismo precedente que `.alf_vacio` en `carga_aulas_libro_fusion.R`). NA y la
#' cadena vacia no son dato. `application_status` entra solo si el update trae
#' >= 1 campo de parte Y `operational_status`: un update de pura agenda —mover
#' una fecha, cambiar un estado— devuelve lista vacia y no fabrica partes.
#' @noRd
monitoreo_aulas_parte_de_update <- function(fila) {
  if (is.data.frame(fila)) {
    if (!nrow(fila)) return(list())
    fila <- as.list(fila[1, , drop = FALSE])
  }
  if (!is.list(fila) || !length(fila)) return(list())
  out <- list()
  for (nm in names(fila)) {
    destino <- .parte_app_alias(nm)
    if (!destino %in% .PARTE_APP_CAMPOS) next
    valor <- fila[[nm]]
    if (.alf_vacio(valor)) next
    out[[destino]] <- valor
  }
  if (!length(out)) return(list())
  # `[[` y no `$`: el `$` de R parcial-matchea nombres de lista y ya pesco una
  # clave ajena en este repo (`config$plan` -> `plan_rows`).
  status <- fila[["operational_status"]]
  if (!.alf_vacio(status)) out$application_status <- status
  # La HORA REAL de aplicacion (A12, dictado 2026-09-03: «sí me sirve, es una
  # referencia histórica»). Acompaña al parte pero NO lo dispara —igual que
  # `application_status`—: una hora suelta en un update de agenda no convierte
  # una cita pactada en un registro de campo.
  #
  # Y no se teclea dos veces: el formulario captura UN momento, asi que si
  # `applied_at` trae hora dentro, la fecha se queda limpia y la hora viaja a
  # su columna. Una hora explicita del equipo gana sobre la derivada.
  hora <- fila[["applied_time"]] %||% fila[["hora_aplicacion"]]
  momento <- .parte_app_partir_momento(out$applied_at)
  if (!is.null(momento)) {
    out$applied_at <- momento$fecha
    if (.alf_vacio(hora)) hora <- momento$hora
  }
  if (!.alf_vacio(hora)) out$applied_time <- hora
  out
}

# Parte «2026-09-10 11:30» en fecha y hora. Devuelve NULL si no hay hora
# dentro del momento: sin hora no se inventa ninguna, y la fecha se queda
# exactamente como vino.
.parte_app_partir_momento <- function(valor) {
  if (.alf_vacio(valor)) return(NULL)
  texto <- trimws(as.character(valor)[1])
  m <- regmatches(texto, regexpr("[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?", texto))
  if (!length(m) || !nzchar(m)) return(NULL)
  fecha <- trimws(sub(m, "", texto, fixed = TRUE))
  if (!nzchar(fecha)) return(NULL)
  list(fecha = fecha, hora = m)
}

# Saneo laxo de «lista de filas»: el endpoint pasa
# `parsed$updates %||% parsed$agenda %||% parsed$plan %||% parsed`, asi que
# aqui puede llegar una lista de filas, UNA fila suelta (lista nombrada de
# escalares) o un data.frame. Una lista que ya es lista de filas se devuelve
# tal cual: el upsert promete identidad cuando nada cambia.
.parte_app_filas <- function(x) {
  if (is.null(x)) return(list())
  if (is.data.frame(x)) {
    if (!nrow(x)) return(list())
    return(lapply(seq_len(nrow(x)), function(i) as.list(x[i, , drop = FALSE])))
  }
  if (!is.list(x)) return(list())
  if (!length(x)) return(x)
  nms <- names(x)
  fila_unica <- !is.null(nms) && all(nzchar(nms)) &&
    !all(vapply(x, function(el) is.list(el) || is.data.frame(el), logical(1)))
  if (fila_unica) return(list(x))
  x
}

# El codigo operativo con el que se archiva un parte: del propio update, o
# resuelto en el plan por `classroom_id`/`collection_unit_id` —la superficie de
# registro puede llegar con el identificador interno o el del QR, no con el
# codigo—. Sin codigo resoluble no hay parte que archivar.
.parte_app_codigo <- function(upd, plan) {
  code <- .alf_txt(upd[["operational_code"]])
  if (nzchar(code)) return(code)
  cid <- .alf_txt(upd[["classroom_id"]])
  unit <- .alf_txt(upd[["collection_unit_id"]])
  if (!nzchar(cid) && !nzchar(unit)) return("")
  for (fila in plan) {
    if (!is.list(fila)) next
    coincide <- (nzchar(cid) && identical(.alf_txt(fila[["classroom_id"]]), cid)) ||
      (nzchar(unit) && identical(.alf_txt(fila[["collection_unit_id"]]), unit))
    if (!coincide) next
    code <- .alf_txt(fila[["operational_code"]])
    if (nzchar(code)) return(code)
  }
  ""
}

# La posicion del parte de PRIMER intento para un codigo, o integer(0). El
# intento ausente cuenta como 1 —los partes que la app crea aqui lo declaran—
# y los de intento > 1 jamas se tocan: son otra vuelta de campo, no este
# registro. El fallback a `classroom_id` copia la indexacion del generador
# (`aulas_libro_hoja_aplicadas`).
.parte_app_pos_intento1 <- function(partes, code) {
  for (i in seq_along(partes)) {
    pt <- partes[[i]]
    if (!is.list(pt)) next
    pcod <- .alf_txt(pt[["operational_code"]])
    if (!nzchar(pcod)) pcod <- .alf_txt(pt[["classroom_id"]])
    if (!identical(pcod, code)) next
    intento <- suppressWarnings(as.integer(pt[["intento"]] %||% 1L))
    if (!length(intento) || is.na(intento)) intento <- 1L
    if (intento == 1L) return(i)
  }
  integer(0)
}

#' Upsert de partes de campo a partir de updates de agenda.
#'
#' Por cada update que traiga parte (`monitoreo_aulas_parte_de_update`),
#' PATCH sobre el parte existente de ese codigo operativo e intento 1, o parte
#' nuevo `list(operational_code, intento = 1L, ...)`. El PATCH solo pisa los
#' campos que el update trae: un parte que entro por Excel viene con claves
#' castellanas (`asistentes`, `hora`) que el update no menciona y pisarlo
#' entero las perderia — el generador lee AMBOS vocabularios por
#' `.MONITOREO_AULAS_PARTE_ALIAS`, asi que conviven en el mismo parte.
#' Cuando ningun update trae parte, devuelve `partes` tal cual.
#' @noRd
monitoreo_aulas_partes_upsert <- function(partes = list(), updates = list(), plan = list()) {
  partes <- .parte_app_filas(partes)
  updates <- .parte_app_filas(updates)
  plan <- .parte_app_filas(plan)
  for (upd in updates) {
    if (!is.list(upd)) next
    parte <- monitoreo_aulas_parte_de_update(upd)
    if (!length(parte)) next
    code <- .parte_app_codigo(upd, plan)
    if (!nzchar(code)) next
    pos <- .parte_app_pos_intento1(partes, code)
    if (length(pos)) {
      base <- partes[[pos]]
      for (nm in names(parte)) base[[nm]] <- parte[[nm]]
      partes[[pos]] <- base
    } else {
      partes[[length(partes) + 1L]] <- c(list(operational_code = code, intento = 1L), parte)
    }
  }
  partes
}

# La DIRECCION INVERSA (A10): que campo del plan se llena con que numero del
# parte. Los nombres de la derecha son las claves de
# `.MONITOREO_AULAS_PARTE_ALIAS`: el parte puede venir del lector del libro
# (nombres canonicos) o de un libro real en castellano, y el alias lee ambos.
.PARTE_APP_AL_PLAN <- c(
  observed_students = "asistentes", refusals = "rechazos",
  duplicates = "duplicados", effective_surveys = "efectivas",
  applied_by = "aplicador", actual_room = "aula",
  applied_at = "fecha", applied_time = "hora", field_note = "nota",
  # **Y el veredicto del parte, que es lo que cuenta el tablero.**
  #
  # El KPI `aulas_aplicadas` suma `application_status == "aplicada"` de la FILA
  # DEL PLAN, y ese campo no puede llegar por ninguna otra vía: la hoja
  # «Listas» del libro solo ofrece AGENDADA / REAGENDADA / REEMPLAZADA / EN
  # RESERVA para el estado del circuito, y ninguno mapea a «aplicada».
  #
  # Sin esta línea el parte llegaba entero —asistentes, efectivas, aplicador—
  # y el veredicto se quedaba fuera. Medido en vivo el 2026-09-07, primer día
  # de campo de HSVG 2026: el primer parte marcaba CH 72 APLICADA con 34
  # encuestas efectivas y la tarjeta del tablero seguía diciendo «0 aulas
  # aplicadas». Es la misma familia de fallo que el resto de este mapa vino a
  # cerrar, con otro consumidor.
  #
  # `operational_status` sigue sin tocarse: el estado del circuito y el del
  # parte son taxonomías distintas, y el normalizador del plan se encarga de
  # bajar «APLICADA» a la forma canónica.
  application_status = "estado"
)

#' Copia al plan lo que los partes de primer intento saben.
#'
#' Es la inversa de `monitoreo_aulas_partes_upsert`: los partes que ENTRAN del
#' libro llegan al plan, que es lo que lee la pestaña «Registro de campo»
#' (`row.observed_students`, `row.applied_by`...). Sin este puente, importar un
#' libro llenado en Excel dejaba los formularios de la app vacios.
#'
#' PATCH, no reemplazo: solo pisa con valores que el parte trae (el cero es
#' dato; el vacio no blanquea), y los reintentos (`intento > 1`) no tocan el
#' plan — son otra vuelta de campo. `operational_status` NO se toca: el estado
#' del circuito y el `application_status` del parte son taxonomias distintas.
#' @noRd
monitoreo_aulas_plan_desde_partes <- function(plan = list(), partes = list()) {
  plan <- .parte_app_filas(plan)
  partes <- .parte_app_filas(partes)
  if (!length(plan) || !length(partes)) return(plan)
  for (pt in partes) {
    if (!is.list(pt)) next
    intento <- suppressWarnings(as.integer(pt[["intento"]] %||% 1L))
    if (!length(intento) || is.na(intento)) intento <- 1L
    if (intento != 1L) next
    code <- .alf_txt(pt[["operational_code"]])
    if (!nzchar(code)) code <- .alf_txt(pt[["classroom_id"]])
    if (!nzchar(code)) next
    for (i in seq_along(plan)) {
      fila <- plan[[i]]
      if (!is.list(fila)) next
      fcod <- .alf_txt(fila[["operational_code"]])
      if (!nzchar(fcod)) fcod <- .alf_txt(fila[["classroom_id"]])
      if (!identical(fcod, code)) next
      for (campo in names(.PARTE_APP_AL_PLAN)) {
        valor <- .monitoreo_aulas_parte_primero(
          pt, .MONITOREO_AULAS_PARTE_ALIAS[[.PARTE_APP_AL_PLAN[[campo]]]]
        )
        if (is.null(valor)) next
        fila[[campo]] <- valor
      }
      plan[[i]] <- fila
    }
  }
  plan
}

#' Registra en sesion el plan actualizado Y los partes que el update trae.
#'
#' Reemplaza al `session_set(sid, "monitoreo_aulas_plan", plan)` del endpoint
#' `/api/monitoreo/aulas/agenda`. Los partes previos se toman con el mismo
#' orden de fallback que el rescate del state (router_monitoreo.R): config,
#' luego sesion, luego lista vacia —un `.pulso` viejo puede traerlos en una y
#' no en la otra—. Si el upsert cambia algo, se espeja en sesion y config
#' igual que `.calb_aplicar_en_sesion` (carga_aulas_libro.R): las dos copias
#' existen porque el rescate lee ambas.
#' @noRd
monitoreo_aulas_registrar_en_sesion <- function(sid, cfg, updates, plan) {
  session_set(sid, "monitoreo_aulas_plan", plan)
  previos <- .monitoreo_con_contenido(
    cfg$aulas_universitarias$partes_campo,
    session_get(sid)$monitoreo_aulas_partes_campo,
    .default = list()
  )
  partes <- monitoreo_aulas_partes_upsert(previos, updates, plan)
  if (!identical(partes, previos)) {
    session_set(sid, "monitoreo_aulas_partes_campo", partes)
    cfg$aulas_universitarias$partes_campo <- partes
  }
  cfg
}
