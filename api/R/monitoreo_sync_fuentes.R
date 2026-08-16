# Qué fuentes toca cada modo de sincronización.
#
# Por que vive aparte de router_monitoreo.R: el router esta congelado a
# crecimiento (agentic/manifest.json), asi que la regla va en archivo propio y
# el endpoint solo la llama.
#
# El defecto que repara. El frontend y el backend tenian cada uno su idea de
# que entra en el boton «Avance», y no coincidian:
#
#   frontend  (fuentesSincronizables.ts)  telefonico -> universo + barrido + Kobo
#   backend   (router_monitoreo.R)        cualquier familia -> solo SM y Kobo
#
# El backend filtraba `kind %in% c("surveymonkey", "kobo")` sin mirar la familia
# ni el rol, asi que **toda** hoja de Google se caia del avance. Medido en el
# estudio PDM Medios de Vida 2026 (2026-08-01): la fuente de Kobo tenia
# `last_read_at` del dia y la hoja de barrido seguia con `last_read_at` vacio
# despues de varias actualizaciones. Sin barrido no hay base telefonica, y el
# modelo entero queda en S/M: universo 0, brecha «S/M», «Sin base» en cada
# tarjeta.
#
# Falla en silencio y por eso costo encontrarlo: el sync devuelve `ok` y
# actualiza lo que si sincronizo, asi que la unica huella es un `last_read_at`
# que no avanza. El front ademas tiene un test que fija la regla correcta
# (`fuentesSincronizables.test.ts`), pero prueba su propia funcion y no el
# viaje completo, asi que la discrepancia nunca se veia.
#
# Esta funcion es el espejo en R de `fuentesSincronizables`. Si una cambia, la
# otra tiene que cambiar con ella: es un contrato entre las dos capas.

#' Fuentes que el modo «avance» debe leer, segun la familia del estudio.
#'
#' En telefonico el avance necesita las hojas del modelo —el universo dice a
#' quien hay que llamar y el barrido en que estado quedo cada caso— ademas de
#' la encuesta. En las demas familias el avance lo mueven las respuestas de
#' plataforma y las hojas no aportan.
#'
#' El `!nzchar(role)` de cada rama es deliberado, igual que en el frontend: una
#' fuente conectada antes de que el rol existiera no lo tiene guardado y no
#' puede quedar fuera del avance por una migracion.
# Los tres papeles del libro operativo de aulas. Coinciden con sus tres hojas y
# con quien las llena: quien agenda, quien supervisa campo y quien controla.
MONITOREO_AULAS_LIBRO_ROLES <- c("agendamiento", "parte_campo", "control")

monitoreo_fuentes_avance <- function(sources = list(), family = "") {
  family <- .monitoreo_scalar(family, "")
  Filter(function(src) {
    kind <- .monitoreo_scalar(src$kind, "")
    role <- .monitoreo_scalar(src$role, "")
    if (identical(family, "telefonico")) {
      if (identical(kind, "google_sheets")) {
        return(role %in% c("universo", "barrido") || !nzchar(role))
      }
      return(identical(kind, "kobo") &&
        (identical(role, "respuestas") || !nzchar(role) ||
          nzchar(.monitoreo_scalar(src$asset_uid, ""))))
    }
    if (identical(family, "aulas_universitarias")) {
      # El libro operativo cuenta con cualquiera de sus tres roles; el libro
      # entero puede vivir en Drive como un Sheet de tres pestanas, y entonces
      # llega como `google_sheets` con el mismo rol.
      if (kind %in% c("aulas_libro", "google_sheets")) {
        return(role %in% MONITOREO_AULAS_LIBRO_ROLES || !nzchar(role))
      }
      return(kind %in% c("kobo", "surveymonkey") &&
        (identical(role, "respuestas") || !nzchar(role)))
    }
    kind %in% c("surveymonkey", "kobo") &&
      (identical(role, "respuestas") || !nzchar(role))
  }, sources)
}

#' Familia declarada por la configuracion de monitoreo de la sesion.
#'
#' Se normaliza a proposito: `monitoreo_normalize_profile` reasigna a
#' «acreditacion» cualquier familia que no reconozca, y el filtro tiene que
#' decidir con la misma familia con la que despues se calculan los reportes.
monitoreo_config_family <- function(config = list()) {
  profile <- monitoreo_normalize_profile((config %||% list())$monitoreo_profile %||% list())
  .monitoreo_scalar(profile$family, "")
}
