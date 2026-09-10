# Memoria de un paso para la conversion de listas a data.frame.
#
# `.monitoreo_aulas_df()` convierte la lista de filas del plan en un data.frame,
# y **se llama TRECE veces en un solo build del dashboard** (medido con Rprof
# sobre HSVG2026 el 2026-09-10). Cada llamada recorre 1 392 filas y compone 109
# columnas: 0,24-0,32 s cada una, unos 3 s por build repitiendo un trabajo
# identico, porque cada funcion del motor convierte por su cuenta.
#
# El plan NO cambia mientras se construye un dashboard, asi que la conversion se
# puede recordar. Las cifras que justifican el mecanismo, sobre el mismo plan:
#
#   convertir .................. 0,316 s
#   identical(mismo objeto) .... 0,0001 s
#
# Tres mil veces mas barato comparar que convertir. Con eso, la memoria no
# necesita ninguna clave calculada: compara el objeto de entrada con los que ya
# convirtio.
#
# **Por que `identical()` y no una huella.** Una huella (numero de filas, nombres
# de columnas) seria mas rapida todavia y AVERIGUARIA MAL: dos planes con las
# mismas filas y columnas y distintos valores tienen la misma huella, y el motor
# devolveria el dashboard de otro corte. `identical()` no puede equivocarse.
#
# **Por que devolver el mismo data.frame es seguro.** R copia al modificar, asi
# que si un consumidor toca su copia no contamina la memoria. Es la misma razon
# por la que el resto del motor pasa data.frames sin defensa.

.mad_cache <- new.env(parent = emptyenv())
.mad_cache$entradas <- list()
# Almacen propio para el plan normalizado: son objetos distintos y mezclarlos
# haria que uno desalojara al otro justo cuando los dos se estan usando.
.mad_cache$planes <- list()

# Cuatro huecos: en un build conviven el plan, los partes, el control y el libro,
# y son justo los cuatro que se convierten mas de una vez. Mas huecos no ayudan y
# retienen memoria de estructuras grandes.
.MAD_HUECOS <- 4L

#' Recuerda la ultima conversion de cada insumo.
#'
#' @param x el insumo, tal como llega.
#' @param convertir la funcion que lo convierte, si no esta recordado.
#' @return el data.frame, del cache o recien convertido.
#' @keywords internal
.mad_recuerda <- function(x, convertir, almacen = "entradas") {
  # Sin lista no hay nada caro que recordar: un data.frame ya convertido cuesta
  # microsegundos y meterlo al cache solo gastaria memoria.
  if (!is.list(x) || is.data.frame(x) || !length(x)) return(convertir(x))
  for (e in .mad_cache[[almacen]]) {
    if (identical(e$clave, x)) return(e$valor)
  }
  valor <- convertir(x)
  .mad_cache[[almacen]] <- c(
    list(list(clave = x, valor = valor)),
    utils::head(.mad_cache[[almacen]], .MAD_HUECOS - 1L)
  )
  valor
}

#' Memoria del PLAN NORMALIZADO.
#'
#' `monitoreo_aulas_normalize_plan()` ya traia un atajo: marcaba su salida con
#' `plan_normalizado` y devolvia tal cual lo que ya viniera marcado. Medido sobre
#' HSVG2026 el 2026-09-10: **siete llamadas por build y CERO por el atajo**. El
#' propio comentario de esa funcion lo habia previsto —«si alguien reconstruye
#' esa lista, un lapply o un viaje por JSON, el atributo se pierde»— y eso es lo
#' que pasa en todos los caminos.
#'
#' La marca sigue donde estaba, porque cuando sobrevive es gratis. Esto la
#' completa por el otro lado: compara la ENTRADA, que no depende de que nadie
#' conserve un atributo.
#' @keywords internal
.mad_plan_normalizado <- function(plan, normalizar) {
  .mad_recuerda(plan, normalizar, almacen = "planes")
}

#' Vacia la memoria.
#'
#' La usan los tests para no arrastrar estado entre casos. En produccion no hace
#' falta llamarla: el cache se limita solo a cuatro huecos y compara por
#' contenido, asi que un plan nuevo nunca devuelve el data.frame del viejo.
#' @keywords internal
.mad_olvida <- function() {
  .mad_cache$entradas <- list()
  .mad_cache$planes <- list()
  invisible(NULL)
}
