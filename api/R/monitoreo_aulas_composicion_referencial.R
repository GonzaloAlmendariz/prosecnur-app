# **Cómo se compone lo recogido, contra cómo se compone la población.**
#
# La cuota es por el eje y es DURA. Sexo y carrera no: son referenciales
# (decisión 2 del plan del eje declarable, 2026-09-17). Sirven para saber a quién
# estamos alcanzando y como marco de comparación, no para exigir una cifra.
#
# **Y por eso este bloque no lleva umbrales ni avisos de desvío**, y es una
# decisión, no un olvido. Un «desvío del 8 % en ECONOMÍA» pintado en rojo
# convierte en incumplimiento algo que el estudio nunca prometió, y el operativo
# gasta llamadas persiguiendo una cuota que no existe. Se publican las dos
# composiciones, lado a lado, y quien lee saca su conclusión.
#
# **El denominador NO se deriva ni se carga: ya está en la config.**
# `monitoreo_aulas_from_calc()` copia `cfg$quotas$category_profiles` del marco
# —una fila por valor, contada por ESTUDIANTE sobre la población elegible— y el
# normalizador la deja pasar. Medido en CCSS Perfil 2026-II: sexo F 421 / M 379,
# nivel 6→238 · 7→244 · 8→193 · 9→125, y seis carreras de ECONOMÍA 358 a
# SOCIOLOGÍA 17. Ochocientos estudiantes en las tres dimensiones.
#
# **La trampa que hay que respetar.** `.monitoreo_aulas_payload_sin_marco()`
# RECORTA esas listas del payload de `/api/monitoreo/state` y las sustituye por
# conteos `*_n`, porque pesaban ~54 MB. Así que esto se calcula AQUÍ, en el
# motor: un panel que intente leer `quotas.category_profiles` desde React verá
# `undefined` en un estudio real y cero en los tests sintéticos. Es el fallo mudo
# más caro de este perfil.

MONITOREO_AULAS_COMPOSICION_SCHEMA <- "monitoreo_aulas_composicion_referencial_v1"

# Las dimensiones descriptivas, con el rol que las nombra en `category_profiles`
# y el campo que las trae en el cruce del padrón. Lista cerrada a propósito: una
# dimensión nueva se agrega aquí y el bloque la publica sin tocar nada más.
.MAC_REF_DIMENSIONES <- list(
  list(clave = "sexo",    rol = "sex",     campo = "sexo",    etiqueta = "Sexo"),
  list(clave = "carrera", rol = "program", campo = "carrera", etiqueta = "Carrera")
)

# La población por categoría para un rol, leída de `category_profiles`.
.mac_ref_poblacion <- function(cfg, rol) {
  q <- ((cfg %||% list())[["quotas"]] %||% list())[["category_profiles"]]
  if (!is.data.frame(q) || !nrow(q)) return(stats::setNames(integer(0), character(0)))
  if (!all(c("role", "raw", "count") %in% names(q))) {
    return(stats::setNames(integer(0), character(0)))
  }
  sub <- q[as.character(q$role) %in% rol, , drop = FALSE]
  if (!nrow(sub)) return(stats::setNames(integer(0), character(0)))
  n <- suppressWarnings(as.integer(sub$count))
  n[is.na(n)] <- 0L
  crudo <- trimws(as.character(sub$raw))
  ok <- nzchar(crudo)
  # Un valor repetido se suma: el marco puede traerlo partido por hoja.
  tapply(n[ok], crudo[ok], sum)
}

#' Composición de lo recogido contra la de la población, descriptiva.
#'
#' @param cfg config de aulas universitarias (de ahí sale el denominador).
#' @param resueltas salida de [monitoreo_aulas_nivel_por_respuesta()]: el cruce
#'   del código contra el padrón, que es de donde salen el sexo y la carrera de
#'   cada PERSONA. Sin cruce no hay composición obtenida y el bloque lo dice.
#' @param cuenta vector lógico: qué respuestas acreditaron (la máscara `cuenta`
#'   de [monitoreo_aulas_eje_atribucion()]). Se describe a quien ENTRÓ a una
#'   celda, no a quien respondió: son dos poblaciones y la segunda incluye
#'   duplicados y gente sin eje.
#' @return lista con `schema`, `fuente` y una entrada por dimensión.
#' @export
monitoreo_aulas_composicion_referencial <- function(cfg = list(), resueltas = NULL,
                                                    cuenta = NULL) {
  hay_cruce <- is.data.frame(resueltas) && nrow(resueltas)
  mask <- if (hay_cruce && is.logical(cuenta) && length(cuenta) == nrow(resueltas)) {
    cuenta %in% TRUE
  } else if (hay_cruce) {
    rep(TRUE, nrow(resueltas))
  } else {
    logical(0)
  }
  # Sólo describe a quien RESOLVIÓ: de los que no cruzaron no sabemos ni su sexo
  # ni su carrera, y contarlos como una categoría vacía inventaría una barra.
  if (hay_cruce) mask <- mask & (resueltas$resuelto %in% TRUE)

  dims <- lapply(.MAC_REF_DIMENSIONES, function(dd) {
    pob <- .mac_ref_poblacion(cfg, dd$rol)
    obt <- if (hay_cruce && any(mask)) {
      v <- trimws(as.character(resueltas[[dd$campo]][mask]))
      v <- v[nzchar(v)]
      if (length(v)) table(v) else integer(0)
    } else integer(0)
    cats <- union(names(pob), names(obt))
    tot_p <- sum(as.integer(pob)); tot_o <- sum(as.integer(obt))
    pct <- function(x, tot) if (is.finite(tot) && tot > 0) round(100 * x / tot, 1) else NA_real_
    # `[[` sobre un vector con nombre AUSENTE lanza «subscript out of bounds», no
    # `NULL` como en una lista: el `%||%` no lo salva. Es la misma piedra que la
    # del conteo de reglas de color, y `pob`/`obt` son `table`s, o sea vectores
    # con nombre.
    toma <- function(v, k) {
      if (!length(v) || !(k %in% names(v))) return(0L)
      x <- suppressWarnings(as.integer(v[[k]])[1])
      if (is.na(x)) 0L else x
    }
    filas <- lapply(cats, function(c1) {
      p <- toma(pob, c1); o <- toma(obt, c1)
      list(categoria = c1,
           poblacion = p, poblacion_pct = pct(p, tot_p),
           obtenidas = o, obtenidas_pct = pct(o, tot_o))
    })
    # Orden por la POBLACIÓN y no por lo obtenido: el orden de las barras no
    # puede bailar con cada sincronización.
    orden <- order(-vapply(filas, function(f) f$poblacion, numeric(1)),
                   vapply(filas, function(f) f$categoria, character(1)))
    list(dimension = dd$clave, etiqueta = dd$etiqueta,
         poblacion_total = tot_p, obtenidas_total = tot_o,
         filas = filas[orden])
  })
  names(dims) <- vapply(.MAC_REF_DIMENSIONES, function(d) d$clave, character(1))

  list(
    schema = MONITOREO_AULAS_COMPOSICION_SCHEMA,
    # **Descriptivo, y dicho aquí para que ninguna capa lo convierta en cuota.**
    caracter = "referencial",
    nota = paste0("Sexo y carrera son referenciales: describen a quién se está ",
                  "alcanzando y sirven de marco de comparación. La cuota del ",
                  "estudio es por su eje declarado y no se mide aquí."),
    # De dónde sale lo obtenido, que es la mitad de la información: sin padrón
    # no hay composición y eso se declara en vez de publicar ceros.
    fuente = if (hay_cruce && any(mask)) "padron" else "sin_cruce",
    personas = as.integer(sum(mask)),
    dimensiones = dims
  )
}
