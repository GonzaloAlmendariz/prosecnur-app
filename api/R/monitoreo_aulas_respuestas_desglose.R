# monitoreo_aulas_respuestas_desglose.R — de cuántas respuestas cuentan, y por
# qué no cuentan las demás.
#
# El primer bloque del boceto de «Resumen» (2026-09-09). La pantalla enseñaba
# las efectivas y el total, pero la resta se quedaba en un número mudo: el
# 2026-09-09 eran **944 efectivas de 1 049**, y las 105 que faltaban no son una
# bolsa — son **37 que no son del operativo** y **68 que sí lo son y no pasan el
# criterio**. Las dos piden cosas distintas: la primera no pide nada (una
# respuesta de otra ola, de una prueba o de un aula que no es del plan) y la
# segunda es trabajo que se hizo y no cuenta.
#
# **Se calcula aquí y no en la pantalla.** El desglose salió primero en un
# script del scratchpad para armar el artefacto, y ahí habría muerto: la app
# volvería a restar totales y a llamarlo «descartadas», que es justo el rótulo
# que ya costó una corrección («metía en la misma bolsa las respuestas que no
# son del estudio y las que no pasan el criterio»).

#' Cuántas respuestas cuentan, y de las que no, por qué.
#'
#' Tres cifras que suman el total observado, sin residuo:
#'   - `efectivas`: pasan el criterio de validez del estudio.
#'   - `fuera_del_operativo`: no son de este operativo —otra ola, una prueba, un
#'     aula que no está en el plan—. No son un fallo de campo.
#'   - `no_pasan_criterio`: SÍ son del operativo y no cuentan. Esto sí es
#'     trabajo hecho que no suma, y es lo que se mira.
#'
#' El grano es la FACULTAD del aula a la que se atribuye cada respuesta, con la
#' misma atribución que usa todo el perfil (`.monitoreo_aulas_response_classroom`,
#' que ya aplica la reatribución de códigos cruzados). Una respuesta cuya aula no
#' se puede identificar entra en el total y no en ninguna facultad: contarla en
#' una inventaría un dato, y esconderla del total dejaría las tres cifras sin
#' sumar.
#'
#' @param plan filas del plan, para saber la facultad de cada aula.
#' @param responses respuestas de la plataforma.
#' @param cfg config de aulas.
#' @return lista `{total, facultades}`; `total` con las tres cifras más
#'   `observadas`, `sin_aula` —sobre las observadas— y `sin_aula_efectivas`
#'   —la misma cuenta sobre las que cuentan—, y `facultades` una lista de
#'   `{facultad, …}`.
#'   Sin respuestas devuelve la forma entera en ceros: el vacío se declara, no
#'   se omite — una pantalla que no recibe el bloque no sabe si es que no hay
#'   respuestas o si el motor no lo calculó.
#' @export
monitoreo_aulas_respuestas_desglose <- function(plan = list(), responses = NULL,
                                                cfg = list()) {
  vacio <- list(
    total = list(observadas = 0L, efectivas = 0L, fuera_del_operativo = 0L,
                 no_pasan_criterio = 0L, sin_aula = 0L, sin_aula_efectivas = 0L),
    facultades = list()
  )
  if (is.null(responses) || !is.data.frame(responses) || !nrow(responses)) return(vacio)

  valida <- tryCatch(.monitoreo_aulas_valid_response(responses, cfg),
                     error = function(e) rep(FALSE, nrow(responses)))
  fuera <- tryCatch(.monitoreo_aulas_descartada(responses, cfg),
                    error = function(e) rep(FALSE, nrow(responses)))
  codigo <- tryCatch(trimws(as.character(.monitoreo_aulas_response_classroom(responses, cfg))),
                     error = function(e) rep("", nrow(responses)))
  # `nzchar(NA)` es TRUE: un NA colado aquí contaría como aula identificada y
  # la facultad saldría vacía en vez de «sin aula». Se normaliza antes.
  codigo[is.na(codigo)] <- ""
  valida <- !is.na(valida) & valida
  fuera <- !is.na(fuera) & fuera

  # **El aula se busca por LAS DOS claves, porque la respuesta trae una sola y
  # no siempre es la misma.**
  #
  # `.monitoreo_aulas_response_classroom()` devuelve el identificador que el
  # estudio use: en CCSS Perfil 2026-II resuelve `ant310_0811` —el
  # `classroom_id`— y el mapa se construía indexado por `operational_code`,
  # que en ese plan es `CH 1`. `%||%` en R sólo cae por NULL, no por cadena
  # vacía, así que el `classroom_id` no llegaba a usarse nunca como clave si el
  # `operational_code` existía.
  #
  # Medido el 2026-09-18 sobre las 64 respuestas del simulacro: **0 de 64 casan
  # contra `operational_code` y 63 de 64 contra `classroom_id`**. El panel
  # «Respuestas» —cuyo subtítulo promete «por qué no cuentan las demás»—
  # publicaba «64 sin curso-horario identificable» debajo de un «64 efectivas de
  # 64 · 100,0 %», mientras `avance_cuota`, que cruza contra la clave correcta,
  # contaba UNA huérfana. Dos lecturas del mismo hecho en la misma pantalla.
  #
  # Indexar por las dos no mueve a quien ya casaba: el `operational_code` se
  # escribe primero y una clave ya tomada no se pisa.
  unidades <- if (is.data.frame(plan)) split(plan, seq_len(nrow(plan))) else (plan %||% list())
  facultad_de <- list()
  anota <- function(cod, facultad) {
    cod <- trimws(as.character(cod %||% "")[1])
    if (is.na(cod) || !nzchar(cod) || !is.null(facultad_de[[cod]])) return(invisible(NULL))
    facultad_de[[cod]] <<- facultad
  }
  # La columna que agrupa la declara el estudio; sin declaración, `faculty`.
  # Es la MISMA resolución que usa `aulas_por_facultad`, porque los dos bloques
  # se cruzan en la pantalla: con dos columnas distintas la tabla saldría con el
  # doble de filas y la mitad a medias.
  columna_grupo <- .monitoreo_scalar(monitoreo_aulas_agrupacion(cfg)$columna, "faculty")
  for (u in unidades) {
    facultad <- trimws(as.character(u[[columna_grupo]] %||% "")[1])
    anota(u[["operational_code"]], facultad)
    anota(u[["classroom_id"]], facultad)
  }
  fac <- vapply(codigo, function(k) {
    v <- if (nzchar(k)) facultad_de[[k]] else NULL
    if (is.null(v) || is.na(v)) "" else v
  }, character(1), USE.NAMES = FALSE)

  cuenta <- function(sel) list(
    observadas = sum(sel),
    efectivas = sum(sel & valida),
    fuera_del_operativo = sum(sel & fuera),
    # La resta va explícita y no por diferencia del total: una respuesta que
    # fuera las dos cosas —descartada y no válida— se contaría dos veces y la
    # suma dejaría de cuadrar. Aquí `fuera` manda y el criterio recoge el resto.
    no_pasan_criterio = sum(sel & !valida & !fuera)
  )

  total <- cuenta(rep(TRUE, nrow(responses)))
  total$sin_aula <- sum(!nzchar(fac))
  # **La misma cifra en el marco en que se lee.** `sin_aula` cuenta sobre las
  # OBSERVADAS; la nota de la pantalla explica por qué sumar las facultades no
  # llega al total, y el total que ese panel enseña son las EFECTIVAS. Mientras
  # nada se descarta las dos coinciden y la diferencia no se ve.
  #
  # Se vio el 2026-09-22 al declarar `descartes` para los QR de capacitación y
  # prueba de CCSS Perfil 2026-II: la cabecera pasó a «21 efectivas de 29
  # respuestas», la única facultad a 10, y la nota seguía diciendo «19 … cuentan
  # en el total», cuando 8 de esas 19 acababan de dejar de contar. La resta
  # honesta es 11, que es además lo que el panel de control llama huérfanas.
  #
  # Las dos se publican: cada una es cierta en su marco, y quitar la de las
  # observadas escondería cuántas respuestas llegaron sin aula.
  total$sin_aula_efectivas <- sum(!nzchar(fac) & valida)
  total <- lapply(total, as.integer)

  nombres <- sort(unique(fac[nzchar(fac)]))
  facultades <- lapply(nombres, function(f) {
    c(list(facultad = f), lapply(cuenta(fac == f), as.integer))
  })
  # De qué son estas filas. El campo `facultad` conserva su nombre y su valor
  # puede ser una carrera: sin esta declaración el rótulo de la pantalla
  # tendría que adivinarlo.
  list(total = total, facultades = facultades,
       agrupacion = monitoreo_aulas_agrupacion_declaracion(monitoreo_aulas_agrupacion(cfg)))
}
