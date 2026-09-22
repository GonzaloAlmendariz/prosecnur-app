# monitoreo_aulas_avance_tablas.R — las cinco tablas de «Avance de campo», para
# que las pinte la APP.
#
# Gonzalo, 2026-09-08: «es que se supone que estas tablas se generan desde la
# app, siendo que la app tiene toda esta info y la puede plasmar en una tabla,
# sheets interno».
#
# Tiene razón y la pregunta que yo había planteado estaba mal formulada. Las
# cinco tablas ya SE CALCULAN en la app: `aulas_libro_indicadores()` es el
# motor, y hasta hoy su salida sólo tenía tres destinos, los tres fuera de la
# pantalla (el xlsx del libro, la pestaña de Google Sheets y el PDF de avance).
# La pantalla, que es donde vive el operativo, era la única que no las veía.
#
# **Por qué esto es un endpoint y no un bloque más del estado.** El payload de
# `/monitoreo/state` lo pide cada pantalla del perfil en cada refresco, y estas
# cinco tablas cruzan las respuestas con el plan aula por aula: meterlas ahí
# cobraría ese cruce a vistas que no lo miran. Va aparte y se pide cuando se
# abre la vista.
#
# **Y por qué viaja el CONTRATO DE FORMATO junto a los datos.** El front podría
# decidir por su cuenta qué columna es porcentaje y cuál se pinta de verde, y
# entonces habría dos respuestas a la misma pregunta: la del Sheets y la de la
# pantalla. Ya pasó con «Diferencia», que significa encuestas en una tabla y
# puntos porcentuales en otra. Aquí viaja lo que el vocabulario declara
# (`carga_aulas_libro_avance_columnas.R`), que es exactamente lo mismo que usan
# el writer del xlsx y el formateador de la pestaña.

# El tipo de una celda para quien la pinta: texto, conteo o proporción.
.maat_tipo <- function(rotulo, clave, es_texto) {
  if (isTRUE(es_texto)) return("texto")
  if (.calac_es_proporcion(rotulo, clave)) "porcentaje" else "numero"
}

# Qué regla de color le toca a un rótulo. Los nombres son los del semáforo del
# libro, para que la pantalla y la hoja no inventen dos paletas.
.maat_semaforo <- function(rotulo) {
  r <- trimws(as.character(rotulo %||% ""))
  if (r %in% AULAS_AVANCE_DIFERENCIAS) return("diferencia")
  if (r %in% AULAS_AVANCE_AVANCES) return("deposito")
  if (r %in% AULAS_AVANCE_FALTAN_MUESTRA) return("meta_muestra")
  if (r %in% AULAS_AVANCE_FALTAN_SOBREMUESTRA) return("meta_sobremuestra")
  ""
}

# Un valor de celda listo para JSON: el número como número, el texto como texto,
# y la celda sin dato como `NA`, que cruza como `null` para que la pantalla ponga
# SU vacío declarado en vez de heredar el «—» del Sheets.
#
# **`NA` y no `NULL`, y la diferencia se ve sólo en el JSON.** La primera versión
# devolvía `NULL` porque en R es el vacío natural; `jsonlite` serializa un `NULL`
# dentro de una lista como OBJETO VACÍO, así que la celda cruzaba como `{}` y la
# pantalla la escribía «[object Object]». Salió en las tres filas de aulas de
# «Avance general» y lo vio la sesión que monta la vista. El test lo pinea sobre
# el JSON serializado y no sobre el valor de R: el valor de R estaba bien, y por
# eso el pin que miraba el valor pasaba con el contrato roto.
.maat_celda <- function(v) {
  if (is.character(v)) {
    x <- trimws(as.character(v))
    return(if (length(x) && !is.na(x[[1]])) x[[1]] else "")
  }
  x <- suppressWarnings(as.numeric(v))
  if (!length(x) || !is.finite(x[[1]])) return(NA)
  x[[1]]
}

#' Una tabla del modelo como bloque serializable, con su contrato de formato.
#'
#' @param clave la clave de la tabla en el vocabulario.
#' @param tabla el `data.frame` del modelo.
#' @param nota el vacío declarado de la tabla, para que la pantalla diga lo
#'   mismo que la hoja cuando no hay filas.
#' @param total la fila de cierre, o `NULL`.
#' @return lista lista para JSON, o `NULL` sin tabla.
#' @keywords internal
.maat_bloque <- function(clave, tabla, nota = "", total = NULL, eje = NULL) {
  # **La cabecera que se PINTA lleva la palabra del eje; los tipos y el semáforo
  # se deciden con el rótulo original.** Un «Nivel» en la primera columna no
  # debe cambiar cómo se formatea la segunda, así que las dos vistas de la
  # cabecera conviven a propósito y no se confunden.
  cabecera <- AULAS_AVANCE_CABECERAS[[clave]]
  cabecera_vista <- aulas_avance_cabeceras_eje(clave, eje)
  if (!is.data.frame(tabla) || !nrow(tabla)) {
    return(list(clave = clave, titulo = unname(AULAS_AVANCE_TITULOS[[clave]]),
                cabecera = as.list(cabecera_vista), filas = list(), vacio = nota))
  }
  # «Avance general» es la única traspuesta: una fila por concepto, así que su
  # naturaleza se decide por FILA y no por columna. Viaja declarado para que la
  # pantalla no tenga que saberlo.
  traspuesta <- identical(clave, "general")
  es_texto <- vapply(names(tabla), function(k) is.character(tabla[[k]]), logical(1))

  tipos_col <- vapply(seq_along(cabecera), function(j) {
    .maat_tipo(cabecera[[j]], clave, es_texto[[j]])
  }, character(1))
  sem_col <- vapply(cabecera, .maat_semaforo, character(1), USE.NAMES = FALSE)

  filas <- lapply(seq_len(nrow(tabla)), function(i) {
    lapply(seq_along(cabecera), function(j) .maat_celda(tabla[[j]][[i]]))
  })

  out <- list(
    clave = clave,
    titulo = unname(AULAS_AVANCE_TITULOS[[clave]]),
    nota = nota,
    traspuesta = traspuesta,
    cabecera = as.list(cabecera_vista),
    tipos = as.list(tipos_col),
    semaforos = as.list(sem_col),
    filas = filas
  )
  if (traspuesta) {
    # Por fila: el rótulo de cada renglón decide si su celda es porcentaje y
    # qué color le toca.
    rotulos <- as.character(tabla[[1L]])
    out$tipos_fila <- as.list(vapply(rotulos, function(r) {
      if (.calac_es_proporcion(r, clave)) "porcentaje" else "numero"
    }, character(1), USE.NAMES = FALSE))
    out$semaforos_fila <- as.list(vapply(rotulos, .maat_semaforo, character(1),
                                         USE.NAMES = FALSE))
  }
  if (is.data.frame(total) && nrow(total)) {
    out$total <- lapply(seq_along(cabecera), function(j) .maat_celda(total[[j]][[1L]]))
  }
  out
}

#' Las cinco tablas de «Avance de campo» de una sesión, para la pantalla.
#'
#' Mismo modelo, mismos números y mismos rótulos que la pestaña de Google
#' Sheets: `aulas_libro_indicadores()` se llama UNA vez y las dos superficies
#' salen de ahí. Si esta función y el publicador dejaran de coincidir, el equipo
#' vería una cifra en la app y otra en el Sheets sin nada que dijera cuál creer.
#'
#' NO lee el Sheets: la pantalla se abre muchas veces al día y leer cinco
#' pestañas remotas en cada apertura gastaría el presupuesto de requests del
#' operativo. Trabaja con lo que la sesión ya tiene, que es lo que la última
#' publicación o la última importación dejaron.
#'
#' @param sid sesión.
#' @param cfg config de monitoreo; se toma de la sesión si falta.
#' @return lista `{ok, actualizado, corte, tablas}`.
#' @export
monitoreo_aulas_avance_tablas <- function(sid, cfg = NULL) {
  s <- session_get(sid)
  if (!is.list(cfg)) cfg <- s$monitoreo_config %||% list()
  aulas_cfg <- if (is.list(cfg[["aulas_universitarias"]])) cfg[["aulas_universitarias"]] else list()

  plan <- s$monitoreo_aulas_plan %||% aulas_cfg[["plan"]] %||% list()
  if (!length(plan)) {
    stop_api(409, "E_AULAS_LIBRO_SIN_PLAN",
             "No hay plan de aulas del que sacar el avance. Importa la selección de cálculo de muestra primero.")
  }
  partes <- s$monitoreo_aulas_partes_campo %||% aulas_cfg[["partes_campo"]] %||% list()
  control <- s$monitoreo_aulas_control %||% aulas_cfg[["control"]] %||% list()
  respuestas <- (s$monitoreo_snapshot %||% list())$data

  # El MISMO reparto del plan entre hojas principales y banco de extras que hace
  # el publicador: las aulas adicionales solicitadas se cuentan sobre los dos.
  extras <- aulas_libro_extras_banco(plan, partes = partes, control = control)
  unidades <- .calg_unidades_del_libro(plan, partes = partes, control = control)

  # Los tres silencios deliberados del publicador, iguales: sin snapshot
  # sincronizado estas tres devuelven NULL y las columnas callan en vez de
  # inventar un cero.
  efectivas <- tryCatch(
    monitoreo_aulas_efectivas_por_aula(unidades, respuestas, aulas_cfg),
    error = function(e) NULL)
  validas <- tryCatch(
    .monitoreo_aulas_valid_response(respuestas, aulas_cfg), error = function(e) NULL)

  ind <- aulas_libro_indicadores(
    unidades, efectivas = efectivas, responses = respuestas, partes = partes,
    validas = validas, cuotas = aulas_cfg[["design_targets"]], cfg = aulas_cfg,
    asignados = aulas_libro_asignados_por_codigo(
      plan, s[["monitoreo_aulas_disponibilidad"]], cfg = aulas_cfg),
    extras = extras,
    # **El bloque de cuota, sobre el plan ENTERO y con el padrón de la sesión.**
    # `unidades` es el recorte que entra al libro; la cuota se mide sobre todo
    # lo recogido. Y el padrón se lee con `[[` y no con `$`: vive sólo en la
    # sesión (ADR 0087) y el `$` parcial-matchearía `monitoreo_aulas_padron_corte`.
    avance_cuota = monitoreo_aulas_avance_cuota_del_plan(
      plan, respuestas, aulas_cfg, padron = s[["monitoreo_aulas_padron"]])
  )

  # La misma portada que la hoja, de la misma función: día del corte y hora de
  # la última sincronización, las dos derivadas del estado y no del reloj.
  portada <- aulas_libro_hoja_avance(ind, eje = monitoreo_aulas_eje(aulas_cfg))
  corte <- if (length(portada) >= 2L) as.character(portada[[2]][[1]]) else ""

  notas <- .maat_notas(ind)
  # El eje del estudio, resuelto UNA vez para las cinco tablas. Sin declaración
  # es `facultad` y las cabeceras salen idénticas.
  eje <- monitoreo_aulas_eje(aulas_cfg)
  tablas <- lapply(names(AULAS_AVANCE_CABECERAS), function(clave) {
    tabla <- ind[[AULAS_AVANCE_CAMPOS[[clave]]]]
    .maat_bloque(
      clave, tabla, eje = eje,
      nota = notas[[clave]] %||% "",
      total = if (identical(clave, "facultad")) .calaf_fila_total(tabla) else NULL
    )
  })

  list(
    ok = TRUE,
    corte = corte,
    actualizado = .monitoreo_scalar((s$monitoreo_snapshot %||% list())$synced_at, ""),
    titular = .calam_titular(ind$facultades) %||% "",
    tablas = tablas
  )
}

# La línea suelta que cada bloque escribe bajo su título: hoy sólo el vacío
# declarado de una tabla sin filas (C3) y el titular de «Avance general». Se lee
# del renderer del Sheets en vez de copiarse: dos literales gemelos en dos
# archivos es exactamente como se separan.
.maat_notas <- function(ind) {
  filas <- aulas_libro_hoja_avance(ind)
  titulos <- unname(AULAS_AVANCE_TITULOS)
  primera <- vapply(filas, function(f) as.character(f[[1]] %||% ""), character(1))
  out <- list()
  for (clave in names(AULAS_AVANCE_TITULOS)) {
    i <- which(primera == AULAS_AVANCE_TITULOS[[clave]])
    if (!length(i)) next
    siguiente <- primera[[i[[1]] + 1L]]
    # La línea de debajo del título es la nota sólo si NO es la cabecera de la
    # tabla ni una fila de datos: se reconoce porque es la única con contenido.
    celdas <- vapply(filas[[i[[1]] + 1L]], function(x) as.character(x %||% ""), character(1))
    if (sum(nzchar(celdas)) == 1L && nchar(siguiente) > 20L) out[[clave]] <- siguiente
  }
  out
}

#' Monta el endpoint de las cinco tablas de avance.
#' @keywords internal
mount_monitoreo_aulas_avance <- function(pr) {
  pr |>
    plumber::pr_get("/api/monitoreo/aulas/avance-tablas", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      monitoreo_aulas_avance_tablas(sid)
    }))
}
