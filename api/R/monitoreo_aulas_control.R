# Publicacion de «Base de control», la tercera hoja del operativo de aulas.
#
# El lector existia desde el principio (`carga_base_control.R`) y dejaba las
# filas en `monitoreo_aulas_control`. Nadie las leia: ni el motor ni la UI.
# Medido el 2026-08-17 sobre las tres hojas — agendamiento 20 de 20 campos en el
# payload, parte de campo 10 de 11, control de calidad 0 de sus 25 campos
# propios. La cola daba L29 por ☑ «lector + endpoint»: se habia cerrado en el
# lector, no en la superficie. Una capacidad existe solo si alguien la consume.
#
# Que hace este modulo y que NO hace:
#
# - Publica los valores TAL COMO los trae la hoja. El Excel es quien calcula
#   —«VS POBLACION», «70P», «VALIDO TOTAL» son formulas del equipo— y recalcular
#   aqui crearia una segunda fuente de verdad para el mismo numero.
# - NO emite veredictos derivados de esos numeros. La escala de los porcentajes
#   y el codigo de «VALIDO TOTAL» no se pueden medir sin un libro real lleno, y
#   el unico que existe lleva datos personales de docentes: no entra al repo.
#   Clasificar a ojo seria inventar un dato, no leerlo.
# - SI dice, por aula y por grupo, si el grupo trae dato. Eso es lo que permite
#   a la vista distinguir «el aula pasa el control» de «esa columna esta vacia»,
#   que es la confusion que produce un cero mudo.

# Los seis grupos que la fila 1 de la hoja declara, con los campos de cada uno.
# El orden es el del libro: identidad, campo, y despues los cuatro controles.
MONITOREO_AULAS_CONTROL_GRUPOS <- list(
  list(
    clave = "curso",
    etiqueta = "Informacion del curso",
    campos = c("wave", "operational_code", "course_name", "room", "schedule",
               "enrolled_total", "eligible_n")
  ),
  list(
    clave = "campo",
    etiqueta = "Informacion del campo",
    campos = c("scheduled_date", "scheduled_time", "applied_by", "applied_date",
               "applied_time", "application_status")
  ),
  list(
    clave = "cuenta",
    etiqueta = "Control - cuenta",
    campos = c("sent_total", "sent_vs_total", "sent_vs_population",
               "validator_1", "validator_2", "validator_3",
               "short_total", "short_vs_total", "long_total", "long_vs_total",
               "threshold_total", "threshold_population",
               "valid_total", "valid_population")
  ),
  list(
    clave = "duracion",
    etiqueta = "Control - duracion",
    campos = c("last_response_day")
  ),
  list(
    clave = "cuotas",
    etiqueta = "Control - cuotas",
    campos = c("observed_students", "non_respondents", "attendance_pct",
               "quota_pct", "quota_missing",
               "women_n", "men_n", "women_pct", "men_pct")
  ),
  list(
    clave = "horario",
    etiqueta = "Control - rango horario",
    campos = c("schedule_norm", "schedule_range")
  )
)

# Un campo «trae dato» si no es NA ni cadena vacia. El lector ya convierte los
# guiones del equipo —«-», «N/A»— en vacio, asi que aqui no hay que repetirlo.
.mac_con_dato <- function(valor) {
  if (is.null(valor) || !length(valor)) return(FALSE)
  v <- valor[[1]]
  if (is.na(v)) return(FALSE)
  if (is.character(v)) return(nzchar(trimws(v)))
  TRUE
}

# --- El veredicto del aula ----------------------------------------------------
#
# Gonzalo (2026-08-17) explico que es lo que la hoja decide con `70T` y `70P`:
# si en el aula aplicada se llego al 70 % de los ASISTENTES elegibles y al 70 %
# de los ALUMNOS elegibles —hayan asistido o no—. **Los dos**, no uno: eso es lo
# que declaraba si el aula habia sido efectiva.
#
# Lo que NO se supo medir es la codificacion de la hoja: si «VALIDO TOTAL» viene
# como 1/0, como SI/NO o como texto, y si los porcentajes van en 0-1 o en 0-100.
# El unico libro real lleno lleva datos personales de docentes y no entra al
# repo. Asi que el veredicto se resuelve en tres pasos, del mas fiable al menos,
# y **cuando ninguno alcanza se declara indeterminado en vez de suponerse**: un
# aula que nadie ha evaluado no puede leerse igual que una que no llego.

# Lee el veredicto de la hoja admitiendo las formas en que un equipo lo escribe.
.mac_verdict <- function(valor) {
  if (!.mac_con_dato(valor)) return(NA)
  v <- valor[[1]]
  if (is.logical(v)) return(as.logical(v))
  if (is.numeric(v)) return(v >= 1)
  txt <- toupper(trimws(as.character(v)))
  if (txt %in% c("1", "SI", "SÍ", "TRUE", "V", "VALIDO", "VÁLIDO", "CUMPLE", "OK")) return(TRUE)
  if (txt %in% c("0", "NO", "FALSE", "F", "INVALIDO", "INVÁLIDO", "NO CUMPLE")) return(FALSE)
  NA
}

.mac_num <- function(valor) {
  if (!.mac_con_dato(valor)) return(NA_real_)
  v <- suppressWarnings(as.numeric(valor[[1]]))
  if (length(v) != 1L || !is.finite(v)) NA_real_ else v
}

#' Si el aula alcanzo uno de los dos umbrales del 70 %.
#'
#' @param fila fila de «Base de control».
#' @param campo_verdict nombre del campo de veredicto de la hoja.
#' @param campo_umbral nombre del campo con el umbral ya calculado.
#' @return `TRUE`, `FALSE` o `NA` si no hay con que decidirlo.
#' @export
monitoreo_aulas_control_umbral <- function(fila, campo_verdict, campo_umbral) {
  # 1. El veredicto que la hoja ya escribio. Es el que manda: lo decide el
  #    equipo con su formula y la app no esta para corregirlo.
  v <- .mac_verdict(fila[[campo_verdict]])
  if (!is.na(v)) return(v)
  # 2. Sin veredicto legible, se compara lo enviado contra el umbral que la
  #    propia hoja calculo. Asi da igual de que denominador salio ese umbral
  #    —asistentes o matriculados—: la cuenta ya viene hecha y no hay que
  #    adivinar cual de los dos uso el equipo en cada columna.
  enviadas <- .mac_num(fila[["sent_total"]])
  umbral <- .mac_num(fila[[campo_umbral]])
  # Un umbral menor o igual a 1 es un porcentaje escrito como proporcion, no un
  # numero de encuestas; compararlo con las enviadas daria «cumple» siempre.
  if (is.finite(enviadas) && is.finite(umbral) && umbral > 1) return(enviadas >= umbral)
  # 3. Indeterminado. No se inventa.
  NA
}

#' Si el aula alcanzo la meta que el diseno le puso.
#'
#' **El criterio del 70 % quedo desfasado.** Gonzalo, 2026-08-24: «en la base de
#' control el 70P y 70T ya estan desfasados porque nosotros usamos un sistema de
#' elegibles esperados para ver si el aula es valida: si llega a esa cuenta o
#' no». Y no es solo que el criterio haya cambiado de idea: las columnas `70T` y
#' `70P` estan marcadas `solo_lectura` en `BASE_CONTROL_CAMPOS` desde que la app
#' genera el libro, asi que **no las escribe nadie**. Medido el 2026-08-24: un
#' aula con 48 efectivas contra 42 esperadas salia `efectiva = NA`, y en un
#' estudio de 2026 eso pasa en el 100 % de las filas — el panel de control
#' declaraba «sin evaluar» el operativo entero.
#'
#' **La meta NO es `elegibles_esperados`, por mucho que se llame asi.** Esa
#' columna del libro se rotula «ELEGIBLES ESPERADOS» y lo que lleva dentro es
#' `eligible_n`: el padron entero del aula. Medido el 2026-08-24 sobre un aula
#' con 36 elegibles y meta 17,3, la columna escribe **36**. El frontend ya la
#' nombra por lo que es —«Elegibles del padron»—. Usarla como vara pediria el
#' 100 % de asistencia efectiva y suspenderia a casi todas las aulas.
#'
#' La meta de verdad viaja en `expected_valid`, que
#' `monitoreo_aulas_universitarias` compone por fila desde `efectivas_esperadas`
#' —lo que el calculo de muestra publica por curso-horario:
#' `eligible_n` x rendimiento(tramo de tamaño) x P(aplicada | tipo de docente) x
#' **factor por facultad**, calibrado con el 2025 ejecutado y aplicado solo en
#' las facultades donde el historico tuvo suficiencia (6 de 15; las otras van con
#' factor 1 y `facultad_k = NA`)—. En el marco 2026 va de 7,4 a 51,7 encuestas
#' por aula.
#'
#' Lo conseguido se lee de las efectivas y, si faltan, de las enviadas: son dos
#' denominadores distintos y el fallback esta declarado, no es un empate.
#'
#' @param fila fila de «Base de control».
#' @return `TRUE`, `FALSE` o `NA` si no hay meta o no hay conteo.
#' @export
monitoreo_aulas_control_meta <- function(fila) {
  meta <- .mac_num(fila[["expected_valid"]])
  if (!is.finite(meta)) meta <- .mac_num(fila[["efectivas_esperadas"]])
  if (!is.finite(meta) || meta <= 0) return(NA)
  logrado <- .mac_num(fila[["efectivas_obtenidas"]])
  if (!is.finite(logrado)) logrado <- .mac_num(fila[["effective_surveys"]])
  if (!is.finite(logrado)) logrado <- .mac_num(fila[["sent_total"]])
  if (!is.finite(logrado)) return(NA)
  logrado >= meta
}

#' Filas de «Base de control» listas para publicar.
#'
#' @param control lista de filas del lector de la hoja.
#' @return lista de filas con sus campos, `grupos_con_dato` y el veredicto.
#' @export
monitoreo_aulas_control_publicado <- function(control = list()) {
  if (!length(control)) return(list())
  out <- list()
  for (fila in control) {
    if (!is.list(fila)) next
    llenos <- character(0)
    for (grupo in MONITOREO_AULAS_CONTROL_GRUPOS) {
      # Identidad y campo NO cuentan como control: siempre vienen llenos porque
      # los escribe el generador, y contarlos daria una cobertura falsa del
      # control de calidad, que es lo unico que esta hoja aporta de nuevo.
      if (grupo$clave %in% c("curso", "campo")) next
      hay <- any(vapply(grupo$campos, function(c) .mac_con_dato(fila[[c]]), logical(1)))
      if (hay) llenos <- c(llenos, grupo$clave)
    }
    fila$grupos_con_dato <- as.list(llenos)
    # El veredicto por aula. `efectiva` exige los DOS umbrales, que es como lo
    # declara el operativo; si alguno queda indeterminado, la efectividad
    # tambien lo queda —no se resuelve a FALSE, que seria acusar a un aula de no
    # llegar cuando lo que pasa es que nadie la evaluo.
    cumple_t <- monitoreo_aulas_control_umbral(fila, "valid_total", "threshold_total")
    cumple_p <- monitoreo_aulas_control_umbral(fila, "valid_population", "threshold_population")
    cumple_m <- monitoreo_aulas_control_meta(fila)
    fila$cumple_total <- cumple_t
    fila$cumple_poblacion <- cumple_p
    fila$cumple_meta <- cumple_m
    # **Con que criterio se juzgo esta aula.** No se cambia un veredicto en
    # silencio: la UI tiene que poder decir si el aula se midio contra el 70 %
    # del libro viejo o contra la meta que el diseno le puso.
    fila$criterio <- if (!is.na(cumple_t) && !is.na(cumple_p)) "umbral70"
      else if (!is.na(cumple_m)) "meta"
      else ""
    fila$efectiva <- if (!is.na(cumple_t) && !is.na(cumple_p)) (cumple_t && cumple_p) else cumple_m
    out[[length(out) + 1L]] <- fila
  }
  .mac_ordenar(out)
}

# El orden de la tabla es el que promete la cabecera del panel: el veredicto.
#
# Sin esto la hoja se lee en el orden en que el equipo la escribio —por codigo—,
# que es el mismo defecto que tenia la lista de brechas: abria por la menor. El
# panel encabeza con «58 de 170 efectivas» y dice cual es la decision, asi que la
# tabla abre por donde queda decision:
#
# 1. Cumple uno de los dos. Al aula que fallo un solo umbral el equipo todavia
#    puede volver, y saber CUAL fallo dice si volver sirve de algo.
# 2. Sin evaluar. Nadie la miro; el trabajo pendiente es de gabinete, no de campo.
# 3. No alcanza ninguno. Diagnostico cerrado.
# 4. Efectivas. Estan hechas; van al final porque no se consultan.
#
# Desempate por codigo para que dos aulas del mismo grupo no bailen entre
# corridas.
.mac_ordenar <- function(filas) {
  if (length(filas) < 2L) return(filas)
  rango <- vapply(filas, function(f) {
    t <- f$cumple_total; p <- f$cumple_poblacion
    # Juzgada por meta: un solo veredicto, asi que no existe el «cumple uno de
    # los dos». Alcanzada al final —no se consulta—; no alcanzada, diagnostico
    # cerrado; sin meta ni umbrales, sin evaluar.
    if (is.na(t) || is.na(p)) {
      m <- f$cumple_meta
      if (is.null(m) || is.na(m)) return(2L)
      return(if (isTRUE(m)) 4L else 3L)
    }
    if (xor(t, p)) return(1L)
    if (t && p) return(4L)
    3L
  }, integer(1))
  codigo <- vapply(filas, function(f) as.character(f$operational_code %||% ""), character(1))
  # Natural y no alfabetico: «CH 10» iba antes que «CH 2» en las 170 filas.
  filas[order(rango, monitoreo_aulas_rango_codigo(codigo))]
}

#' El recibo del libro importado.
#'
#' De que libro salen estos numeros, cuando se leyo, cuales de las tres hojas
#' trajo y cuales no. La informacion existia desde el principio —el lector la
#' compone y la deja en `monitoreo_aulas_libro`— pero solo se veia en el aviso
#' de la importacion: un mensaje de un momento que desaparecia al recargar. Un
#' estudio se opera durante semanas y quien lo abre el martes tiene derecho a
#' saber de donde vienen las cifras que esta mirando.
#'
#' @param libro lo que la importacion dejo en la sesion.
#' @return lista con `importado_en`, `hojas` (nombre y si vino) y `resumen`, o
#'   `NULL` si en este estudio nunca se importo un libro.
#' @export
monitoreo_aulas_libro_recibo <- function(libro = NULL, plan = list()) {
  if (!is.list(libro) || !length(libro)) return(NULL)
  # Cuantas FACULTADES cubre el libro. El recibo decia cursos-horario, titulares,
  # partes y filas de control, y ninguna de esas cifras contesta la pregunta con
  # la que se dirige el operativo: «¿cubre las que tengo que cubrir?». Un estudio
  # de este tipo maneja de 11 a 20, asi que 15 y 6 son libros muy distintos.
  # Sale del PLAN y no del libro: el libro trae filas, la facultad la pone la
  # muestra.
  facultades <- unique(Filter(nzchar, vapply(
    plan %||% list(),
    function(u) trimws(as.character(u$faculty %||% "")),
    character(1)
  )))
  ausentes <- unlist(libro$hojas_ausentes %||% list(), use.names = FALSE)
  hojas <- lapply(AULAS_LIBRO_HOJAS, function(h) list(
    hoja = h$hoja,
    # `vino` y no `ausente`: la vista pregunta que hay, no que falta.
    vino = !(h$hoja %in% ausentes)
  ))
  list(
    importado_en = as.character(libro$importado_en %||% ""),
    hojas = hojas,
    hojas_ausentes = length(ausentes),
    control_sin_nombre = length(unlist(libro$control_sin_nombre %||% list(), use.names = FALSE)),
    resumen = c(
      libro$resumen %||% list(),
      if (length(facultades)) list(facultades = length(facultades)) else list()
    )
  )
}

#' Cuanto del control de calidad trae realmente el libro.
#'
#' Sirve para que la vista pueda decir «esta hoja no trae cuotas» en vez de
#' pintar una tabla de ceros que parecerian medidos.
#'
#' @param control lista de filas del lector.
#' @return lista con `aulas` y `grupos` (clave, etiqueta, aulas con dato).
#' @export
monitoreo_aulas_control_resumen <- function(control = list()) {
  filas <- monitoreo_aulas_control_publicado(control)
  grupos <- lapply(MONITOREO_AULAS_CONTROL_GRUPOS, function(grupo) {
    if (grupo$clave %in% c("curso", "campo")) return(NULL)
    con <- sum(vapply(
      filas,
      function(f) grupo$clave %in% unlist(f$grupos_con_dato %||% list()),
      logical(1)
    ))
    list(
      clave = grupo$clave,
      etiqueta = grupo$etiqueta,
      campos = length(grupo$campos),
      aulas_con_dato = as.integer(con)
    )
  })
  # El veredicto agregado: es LA pregunta que esta hoja contesta. Las cuatro
  # cuentas son excluyentes y suman `aulas`, para que la lectura no pueda decir
  # mas ni menos aulas de las que hay.
  ef <- vapply(filas, function(f) {
    v <- f$efectiva
    if (is.null(v) || !length(v) || is.na(v[[1]])) NA else as.logical(v[[1]])
  }, logical(1))
  # Cual de los dos umbrales fallo. No es un matiz: son dos diagnosticos
  # opuestos y la accion que sigue a cada uno es distinta.
  #
  # - Llego al de ASISTENTES y no al de matriculados: de los que estaban en el
  #   aula respondio la mayoria, pero a clase fue poca gente. El aplicador hizo
  #   su trabajo; lo que falta son alumnos, y volver a la misma sesion no los
  #   trae. Se reagenda otra sesion del mismo curso o se acepta el tope.
  # - Llego al de MATRICULADOS y no al de asistentes: habia mas presentes que
  #   elegibles —oyentes, alumnos de otra seccion— y una parte no respondio. La
  #   cobertura del padron esta cubierta; el margen esta en la aplicacion.
  #
  # La pantalla decia «39 cumplen solo uno de los dos» y ese numero valia igual
  # para los dos casos. La hoja ya sabia cual era y no lo decia.
  solo_t <- vapply(filas, function(f) {
    t <- f$cumple_total; p <- f$cumple_poblacion
    if (is.null(t) || is.null(p) || is.na(t[[1]]) || is.na(p[[1]])) return(FALSE)
    isTRUE(as.logical(t[[1]])) && !isTRUE(as.logical(p[[1]]))
  }, logical(1))
  solo_p <- vapply(filas, function(f) {
    t <- f$cumple_total; p <- f$cumple_poblacion
    if (is.null(t) || is.null(p) || is.na(t[[1]]) || is.na(p[[1]])) return(FALSE)
    isTRUE(as.logical(p[[1]])) && !isTRUE(as.logical(t[[1]]))
  }, logical(1))
  solo_una <- solo_t | solo_p

  list(
    aulas = length(filas),
    grupos = unname(Filter(Negate(is.null), grupos)),
    veredicto = list(
      efectivas = as.integer(sum(ef %in% TRUE)),
      # «Cumple uno de los dos» se cuenta aparte porque es donde esta la
      # decision: al aula que fallo los dos ya no hay nada que hacerle, y a la
      # que fallo uno el equipo puede volver.
      cumple_una = as.integer(sum(solo_una)),
      # Y el desglose de ese mismo numero, que es lo que dice si volver sirve.
      # Suman `cumple_una`: la vista no puede decir mas ni menos aulas.
      solo_asistentes = as.integer(sum(solo_t)),
      solo_poblacion = as.integer(sum(solo_p)),
      no_efectivas = as.integer(sum(ef %in% FALSE) - sum(solo_una)),
      indeterminadas = as.integer(sum(is.na(ef)))
    )
  )
}
