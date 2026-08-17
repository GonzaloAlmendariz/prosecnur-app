# Importacion del libro operativo de un estudio de aulas.
#
# Compone los tres lectores —agendamiento, parte de campo y control de calidad—
# sobre UN solo archivo, que es como el equipo lo tiene: las tres hojas viven en
# el mismo libro.
#
# Ninguna hoja es obligatoria. Un libro a mitad de operativo puede traer solo
# «Aulas Agendadas»; uno terminado, las tres. Lo que falta se declara, no se
# inventa: `hojas_ausentes` viaja en el resultado para que la UI pueda decir que
# no encontro en vez de mostrar un cero silencioso.

AULAS_LIBRO_HOJAS <- list(
  list(clave = "agendadas", hoja = "Aulas Agendadas"),
  list(clave = "aplicadas", hoja = "Aulas Aplicadas (Campo)"),
  list(clave = "control",   hoja = "Base de control")
)

#' Lee las tres hojas operativas de un libro de aulas.
#'
#' @param path ruta al `.xlsx`.
#' @return lista con `plan`, `partes`, `control`, `hojas_ausentes`, `sin_nombre`
#'   y un `resumen` de conteos.
#' @export
aulas_libro_importar <- function(path) {
  if (!file.exists(path)) {
    stop_api(400, "E_AULAS_LIBRO_NO_EXISTE", "No se encontro el libro del estudio de aulas.")
  }
  hojas <- tryCatch(readxl::excel_sheets(path), error = function(e) character(0))
  if (!length(hojas)) {
    stop_api(422, "E_AULAS_LIBRO_ILEGIBLE", "El archivo no se pudo abrir como libro de Excel.")
  }
  presentes <- vapply(AULAS_LIBRO_HOJAS, function(x) x$hoja %in% hojas, logical(1))
  if (!any(presentes)) {
    stop_api(
      422, "E_AULAS_LIBRO_SIN_HOJAS",
      "El libro no trae ninguna de las tres hojas del operativo de aulas.",
      details = list(
        esperadas = lapply(AULAS_LIBRO_HOJAS, function(x) x$hoja),
        encontradas = as.list(hojas)
      )
    )
  }

  plan <- if (presentes[[1]]) aulas_agendadas_leer(path) else list()
  partes <- if (presentes[[2]]) aulas_aplicadas_leer(path) else list()
  control <- if (presentes[[3]]) base_control_leer(path) else list(filas = list(), sin_nombre = integer(0))

  ausentes <- lapply(AULAS_LIBRO_HOJAS[!presentes], function(x) x$hoja)

  con_estado <- sum(vapply(plan, function(r) nzchar(r$sample_status %||% ""), logical(1)))
  titulares <- sum(vapply(plan, function(r) identical(r$sample_role, "titular"), logical(1)))

  list(
    plan = plan,
    partes = partes,
    control = control$filas,
    hojas_ausentes = ausentes,
    # Columnas con datos que la cabecera de «Base de control» no bautiza. Se
    # reportan para que quien mire el resultado sepa que no se leyo todo.
    control_sin_nombre = as.list(control$sin_nombre),
    resumen = list(
      unidades = length(plan),
      titulares = as.integer(titulares),
      contactadas = as.integer(con_estado),
      partes_de_campo = length(partes),
      filas_de_control = length(control$filas)
    )
  )
}

#' Deja el libro importado en la sesion.
#'
#' El plan se guarda tal cual lo entiende Monitoreo, y las otras dos hojas
#' quedan a su lado sin fusionarse: el parte de campo y el control son medidas
#' distintas del mismo aula y mezclarlas perderia de cual viene cada numero.
#'
#' @param sid sesion.
#' @param path ruta al libro.
#' @return el resumen de la importacion.
#' @export
aulas_libro_importar_en_sesion <- function(sid, path) {
  out <- aulas_libro_importar(path)
  if (length(out$plan)) {
    # FUSION, no reemplazo. El libro no lleva la composicion muestral —es un
    # artefacto de campo— asi que sobrescribir el plan entero dejaba las cuotas
    # sexo x facultad en cero celdas: 12 antes de releer el libro, 0 despues.
    previo <- session_get(sid)$monitoreo_aulas_plan %||% list()
    fusion <- aulas_libro_fusionar_plan(previo, out$plan)
    session_set(sid, "monitoreo_aulas_plan", fusion$plan)
    out$fusion <- fusion[c("actualizadas", "nuevas", "intactas")]
  }
  session_set(sid, "monitoreo_aulas_partes_campo", out$partes)
  session_set(sid, "monitoreo_aulas_control", out$control)
  # El aviso entra a la config para que el tablero pueda mostrarlo: viajaba en
  # la respuesta del endpoint y ningun consumidor lo miraba.
  cfg <- session_get(sid)$monitoreo_config %||% list()
  if (is.list(cfg$aulas_universitarias)) {
    cfg$aulas_universitarias$control_sin_nombre <- length(out$control_sin_nombre)
    cfg$aulas_universitarias$partes_campo <- out$partes
    session_set(sid, "monitoreo_config", cfg)
  }
  session_set(sid, "monitoreo_aulas_libro", list(
    importado_en = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    hojas_ausentes = out$hojas_ausentes,
    control_sin_nombre = out$control_sin_nombre,
    resumen = out$resumen
  ))
  out
}
