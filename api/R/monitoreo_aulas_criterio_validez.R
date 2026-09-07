# Qué cuenta como respuesta válida, y cómo se dice cuál criterio se aplicó.
#
# Los filtros que el estudio declara, la lista de estados que valen por defecto,
# la atribución de cada respuesta a su curso-horario y el texto que anuncia con
# qué se está contando. Es el tema del que salen las dos cifras que más se miran
# del módulo: cuántas llegaron y cuántas cuentan.
#
# Segundo pago de la deuda que el GOAL de Monitoreo profesional declara
# permanente para `monitoreo_aulas_universitarias.R`: «cada fix que lo toque
# saca su tema a `monitoreo_aulas_<tema>.R`».
#
# ## Por qué el archivo se llama así y no `..._validez.R`
#
# Porque `MONITOREO_AULAS_ESTADOS_VALIDOS` es código de NIVEL SUPERIOR: se
# evalúa al cargar, no al llamar. R carga por orden alfabético, y `validez` iría
# DESPUÉS de `universitarias`; `criterio_validez` va antes. Hoy da igual -los
# tres usos de la constante están dentro de funciones y se resuelven en tiempo
# de ejecución- pero el nombre no depende de que eso siga siendo verdad. Este
# repo ya se comió una vez el orden de carga con un alias.
#
# Cuatro de lo que va aquí lleva `@export` y viaja PEGADO a su roxygen:
# `monitoreo_aulas_filtros_de_validez`, `MONITOREO_AULAS_ESTADOS_VALIDOS`,
# `monitoreo_aulas_criterio_validez` y `monitoreo_aulas_criterio_texto`. Un
# `@export` que se separa de su función exporta la siguiente, y eso en dev no
# rompe pero en el binario sí.

#' Normaliza `valid_filters` a una LISTA DE LISTAS, venga como venga.
#'
#' **`jsonlite` convierte un array de objetos en un `data.frame`**, no en una
#' lista: `[{"var":"sexo","values":["F"]}]` llega como un data.frame de una fila.
#' Iterando con `for (f in crudos)` se recorren entonces las COLUMNAS, `is.list(f)`
#' es falso y **se descarta todo en silencio**. El sintoma exacto: el POST
#' devuelve 200, la clave aparece en la config y su valor es `[]`.
#'
#' Es la misma trampa de `simplifyDataFrame` que este repo ya tiene fichada, y
#' solo salio haciendo el ciclo entero desde la pantalla: guardar y ver que el
#' numero no se movia.
.monitoreo_aulas_filas_de_filtro <- function(x) {
  if (is.null(x)) return(list())
  if (is.data.frame(x)) {
    if (!nrow(x)) return(list())
    return(lapply(seq_len(nrow(x)), function(i) as.list(x[i, , drop = FALSE])))
  }
  if (!is.list(x)) return(list())
  x
}

#' Los filtros que definen una encuesta EFECTIVA, tal como los declara el estudio.
#'
#' Gonzalo: «la seccion de fuentes no deja declarar las variables que definen a
#' una encuesta efectiva, que en algunos casos tiene mas de un filtro, puede
#' tener hasta 4».
#'
#' Hasta aqui el criterio era **una sola columna** —`status_var` contra una lista
#' de estados— y eso no alcanza para un estudio real: «efectiva» suele ser
#' completa **y** con consentimiento **y** del publico elegible. Con un unico
#' filtro, las otras condiciones no se podian declarar y el tablero contaba de
#' mas sin decirlo.
#'
#' `valid_filters` es una lista de `list(var = , values = )`; una respuesta vale
#' si **cumple TODOS**. `status_var` + `valid_statuses` siguen funcionando y se
#' leen como el primer filtro: un estudio ya configurado no cambia de numero.
#' @export
monitoreo_aulas_filtros_de_validez <- function(cfg = list()) {
  mapping <- cfg$source_mapping %||% list()
  declarados <- .monitoreo_aulas_filas_de_filtro(mapping$valid_filters)
  filtros <- list()
  for (f in declarados) {
    var <- .monitoreo_scalar(f$var %||% f$variable, "")
    vals <- .monitoreo_chr_vec(f$values %||% f$valores %||% character(0))
    # Un filtro sin variable o sin valores no filtra nada: dejarlo entrar
    # descartaria TODAS las respuestas en silencio.
    if (nzchar(var) && length(vals)) {
      filtros[[length(filtros) + 1L]] <- list(var = var, values = vals)
    }
  }
  if (!length(filtros)) {
    var <- .monitoreo_scalar(mapping$status_var, "")
    if (nzchar(var)) {
      filtros[[1L]] <- list(
        var = var,
        values = .monitoreo_chr_vec(mapping$valid_statuses %||% MONITOREO_AULAS_ESTADOS_VALIDOS)
      )
    }
  }
  filtros
}

#' Las respuestas que el estudio DESCARTA aunque estén bien llenadas.
#'
#' El QR de capacitación y el de prueba producen envíos reales que pasan todos
#' los filtros de validez —son encuestas correctas— y no son del operativo. El
#' primer día de HSVG2026 eran 36 de 204. `valid_filters` dice qué cuenta;
#' `descartes` dice qué se saca, y basta con que uno case.
#' @keywords internal
.monitoreo_aulas_descartada <- function(data, cfg) {
  if (!is.data.frame(data) || !nrow(data)) return(logical(0))
  reglas <- .monitoreo_aulas_filas_de_filtro((cfg$source_mapping %||% list())$descartes)
  fuera <- rep(FALSE, nrow(data))
  for (f in reglas) {
    var <- .monitoreo_scalar(f$var %||% f$variable, "")
    vals <- .monitoreo_chr_vec(f$values %||% f$valores %||% character(0))
    if (!nzchar(var) || !length(vals) || !var %in% names(data)) next
    fuera <- fuera | (.monitoreo_text_key(data[[var]]) %in% .monitoreo_text_key(vals))
  }
  fuera
}

.monitoreo_aulas_valid_response <- function(data, cfg) {
  if (!is.data.frame(data) || !nrow(data)) return(rep(FALSE, 0L))
  mapping <- cfg$source_mapping %||% list()
  # Lo descartado no es efectivo NUNCA, decida lo que decida el resto del
  # criterio: se resuelve al final para que ninguna rama se lo salte.
  fuera <- .monitoreo_aulas_descartada(data, cfg)
  # **Varios filtros, si el estudio los declara.** Se exige que se cumplan TODOS:
  # cada uno acota, ninguno amplia. Un filtro cuya columna no esta en la base NO
  # se aplica —y el criterio lo declara aparte—, porque descartarlo todo por una
  # columna ausente seria peor que contar de mas.
  # **Basta con UNO declarado.** Ponia `> 1L` y con un solo `valid_filters` la
  # respuesta se iba por el camino viejo de `status_var` —vacio en un estudio que
  # solo declaro filtros— y contaba TODO. Salio haciendo el ciclo entero desde la
  # pantalla: se guardaba «sexo = F» y las validas seguian siendo 3 700. Los tests
  # no lo veian porque el caso de un filtro se probaba con `status_var`.
  filtros <- monitoreo_aulas_filtros_de_validez(cfg)
  declarados <- (cfg$source_mapping %||% list())$valid_filters
  if (length(filtros) && length(declarados)) {
    ok <- rep(TRUE, nrow(data))
    for (f in filtros) {
      if (!f$var %in% names(data)) next
      ok <- ok & (.monitoreo_text_key(data[[f$var]]) %in% .monitoreo_text_key(f$values))
    }
    return(ok & !fuera)
  }
  status_col <- .monitoreo_scalar(mapping$status_var, "")
  if (!nzchar(status_col) || !status_col %in% names(data)) {
    # `_status` NO entra. Kobo lo manda en TODAS las filas de su export con el
    # valor `submitted_via_web`, que dice como llego el formulario, no si la
    # respuesta vale. Como ese valor no esta en ninguna lista de validos, el
    # avance del estudio entero caia a CERO en silencio en cuanto alguien
    # sincronizaba un export completo de Kobo. Medido: 0 de 6.
    #
    # `_validation_status` SI es un estado de validacion y ahora se reconoce
    # —antes no, porque el guion bajo inicial no casaba y por eso «fallaba
    # abierto»: contaba todo—.
    status_col <- .monitoreo_aulas_col(data, c(
      "response_status", "_validation_status", "validation_status", "estado"
    ))
  }
  if (!nzchar(status_col) || !status_col %in% names(data)) return(!fuera)
  valid <- .monitoreo_text_key(.monitoreo_chr_vec(
    mapping$valid_statuses %||% MONITOREO_AULAS_ESTADOS_VALIDOS
  ))
  (.monitoreo_text_key(data[[status_col]]) %in% valid) & !fuera
}

#' Estados que cuentan como respuesta valida cuando el estudio no declara los suyos.
#'
#' La lista traia solo vocabulario en ingles, asi que un estudio con su columna
#' `estado` en espanol —«completa»— daba CERO validas, y el propio vocabulario de
#' Kobo (`validation_status_approved`) tampoco entraba. Medido: 0 de 4 en los dos
#' casos. Un estudio puede seguir declarando `valid_statuses` y esta lista no se
#' usa; es el defecto por defecto, no una imposicion.
#' @export
MONITOREO_AULAS_ESTADOS_VALIDOS <- c(
  "completed", "complete", "valid", "aprobado",
  # Espanol, que es como lo escriben los estudios de la casa.
  "completa", "completo", "valida", "valido", "aprobada", "aplicada",
  # Vocabulario propio de Kobo en `_validation_status`.
  "validation_status_approved", "approved"
)

#' En CUAL condicion se cae cada respuesta que no cuenta.
#'
#' El criterio ya decia cuantas pasan -«2.616 de 2.760»- y eso no dice donde
#' esta el problema. Con tres condiciones a la vez, 144 descartadas pueden ser
#' 144 sin consentimiento o 144 fuera de la poblacion, y se hacen cosas
#' distintas en cada caso.
#'
#' Se cuentan DOS cosas por filtro, y la segunda es la que decide:
#'
#' - `caen`: cuantas incumplen ese filtro, se cumplan o no los demas. Suma mas
#'   que el total de descartadas, porque una respuesta puede fallar varios.
#' - `solo_este`: cuantas fallan ESE y ninguno mas. Es lo accionable: si arreglas
#'   ese filtro, esas entran. Las que fallan dos no las salva tocar uno.
#'
#' Un filtro cuya columna no esta en la base NO se evalua, igual que en
#' `.monitoreo_aulas_valid_response()`: se declara aparte y no se cuenta como
#' que todas lo incumplen.
#'
#' @param data respuestas.
#' @param cfg config de aulas.
#' @return lista de listas con `var`, `caen`, `solo_este`; vacia si no hay filtros.
#' @keywords internal
.monitoreo_aulas_caidas_por_filtro <- function(data, cfg) {
  if (!is.data.frame(data) || !nrow(data)) return(list())
  filtros <- monitoreo_aulas_filtros_de_validez(cfg)
  aplicables <- Filter(function(f) f$var %in% names(data), filtros)
  if (!length(aplicables)) return(list())

  # Una matriz de incumplimiento: una columna por filtro aplicable.
  falla <- vapply(aplicables, function(f) {
    !(.monitoreo_text_key(data[[f$var]]) %in% .monitoreo_text_key(f$values))
  }, logical(nrow(data)))
  if (is.null(dim(falla))) falla <- matrix(falla, nrow = nrow(data))
  cuantos_fallan <- rowSums(falla)

  lapply(seq_along(aplicables), function(i) {
    list(
      var = aplicables[[i]]$var,
      caen = as.integer(sum(falla[, i])),
      # Falla este y ninguno mas.
      solo_este = as.integer(sum(falla[, i] & cuantos_fallan == 1L))
    )
  })
}

#' Que criterio de validez se aplico, para poder decirlo.
#'
#' El criterio se resolvia en silencio: nadie sabia si el tablero contaba TODO
#' —porque no habia columna de estado— o si estaba filtrando por una columna que
#' quiza no era la correcta. Las dos cosas producen numeros muy distintos y
#' ninguna se anunciaba.
#' @export
monitoreo_aulas_criterio_validez <- function(data, cfg = list()) {
  if (!is.data.frame(data) || !nrow(data)) {
    return(list(columna = "", modo = "sin_datos", validas = 0L, total = 0L))
  }
  mapping <- cfg$source_mapping %||% list()
  # Con varios filtros el criterio ya no es «una columna»: se declara cuantos se
  # aplicaron y cuales, y si alguno pedia una columna que la base no trae.
  filtros <- monitoreo_aulas_filtros_de_validez(cfg)
  declarados <- (cfg$source_mapping %||% list())$valid_filters
  if (length(filtros) && length(declarados)) {
    ausentes <- vapply(filtros, function(f) !f$var %in% names(data), logical(1))
    return(list(
      columna = "", modo = "por_filtros",
      filtros = vapply(filtros, function(f) f$var, character(1)),
      filtros_ausentes = vapply(filtros[ausentes], function(f) f$var, character(1)),
      por_filtro = .monitoreo_aulas_caidas_por_filtro(data, cfg),
      validas = as.integer(sum(.monitoreo_aulas_valid_response(data, cfg))),
      total = as.integer(nrow(data))
    ))
  }
  declarada <- .monitoreo_scalar(mapping$status_var, "")
  col <- if (nzchar(declarada) && declarada %in% names(data)) declarada else
    .monitoreo_aulas_col(data, c("response_status", "_validation_status", "validation_status", "estado"))
  validas <- sum(.monitoreo_aulas_valid_response(data, cfg))
  modo <- if (nzchar(declarada) && !declarada %in% names(data)) {
    # El estudio declaro una columna que no existe. Antes se caia al detector
    # automatico sin decir nada, asi que un error de tipeo en la config pasaba
    # por criterio deliberado.
    "declarada_ausente"
  } else if (!nzchar(col)) "sin_columna" else "por_columna"
  list(columna = col, modo = modo, declarada = declarada,
       validas = as.integer(validas), total = as.integer(nrow(data)))
}

#' Frase que explica el criterio sin jerga.
#' @export
monitoreo_aulas_criterio_texto <- function(crit) {
  total <- as.integer(crit$total %||% 0L)
  validas <- as.integer(crit$validas %||% 0L)
  switch(crit$modo %||% "sin_datos",
    sin_datos = "Todavía no hay respuestas que contar.",
    declarada_ausente = sprintf(
      "El estudio declara la columna de estado '%s' y la base no la trae, así que se contó por '%s': %d de %d respuestas.",
      crit$declarada %||% "", crit$columna %||% "(ninguna)", validas, total),
    sin_columna = sprintf(
      "La base no trae columna de estado, así que cuentan las %d respuestas. Si el formulario marca incompletas, declara cuál es esa columna.",
      total),
    por_columna = sprintf(
      "Cuentan las respuestas cuyo '%s' está en la lista de estados válidos: %d de %d.",
      crit$columna %||% "", validas, total),
    # **Los filtros se NOMBRAN.** Decir «se aplicaron 4 filtros» sin cuales
    # obligaria a abrir la config para saber que se esta contando, y una columna
    # declarada que la base no trae tiene que salir: es la diferencia entre un
    # criterio deliberado y un error de tipeo que pasa por criterio.
    por_filtros = {
      nombres <- crit$filtros %||% character(0)
      ausentes <- crit$filtros_ausentes %||% character(0)
      paste0(
        if (length(nombres) == 1L)
        sprintf("Una respuesta cuenta si su '%s' está entre los valores declarados: %d de %d.",
                nombres[[1]], validas, total)
      else
        sprintf("Una respuesta cuenta si cumple %d condiciones a la vez (%s): %d de %d.",
                length(nombres), paste(nombres, collapse = ", "), validas, total),
        if (length(ausentes)) sprintf(
          " La base no trae %s, así que %s no se aplicó.",
          paste(sprintf("'%s'", ausentes), collapse = " ni "),
          if (length(ausentes) == 1L) "esa condicion" else "esas condiciones"
        ) else "",
        # **Y en CUAL se cae lo que no cuenta.** «2.616 de 2.760» dice cuantas
        # se pierden y no donde: 144 descartadas pueden ser 144 sin
        # consentimiento o 144 fuera de la poblacion, y se hace algo distinto en
        # cada caso. Se ordena por la que mas descarta, que es por donde se
        # empieza a mirar.
        .monitoreo_aulas_texto_por_filtro(crit$por_filtro %||% list(), total - validas)
      )
    }
  )
}

#' La frase que dice en cual condicion se cae lo descartado.
#'
#' Se dice `solo_este` y no `caen`, porque es la cifra accionable: son las que
#' entrarian si esa condicion se resolviera. Cuando una respuesta falla dos, no
#' la salva arreglar una, y eso se declara aparte en vez de repartirla.
#'
#' @param por_filtro lo que devuelve `.monitoreo_aulas_caidas_por_filtro()`.
#' @param descartadas cuantas no cuentan en total.
#' @return frase, o `""` si no hay nada que decir.
#' @keywords internal
.monitoreo_aulas_texto_por_filtro <- function(por_filtro, descartadas) {
  if (!length(por_filtro) || !is.finite(descartadas) || descartadas <= 0) return("")
  solos <- vapply(por_filtro, function(f) as.integer(f$solo_este %||% 0L), integer(1))
  nombres <- vapply(por_filtro, function(f) as.character(f$var %||% ""), character(1))
  con_algo <- solos > 0L
  if (!any(con_algo)) return("")
  ord <- order(-solos[con_algo])
  partes <- sprintf("%d por '%s'", solos[con_algo][ord], nombres[con_algo][ord])
  varias <- descartadas - sum(solos)
  paste0(
    sprintf(" De las %d que no cuentan, %s.", descartadas,
            paste(partes, collapse = " · ")),
    if (varias == 1L) " La otra falla más de una condición, así que no la recupera arreglar una sola."
    else if (varias > 0) sprintf(" Las otras %d fallan más de una condición, así que no las recupera arreglar una sola.", varias)
    else ""
  )
}

.monitoreo_aulas_response_classroom <- function(data, cfg) {
  if (!is.data.frame(data) || !nrow(data)) return(character(0))
  mapping <- cfg$source_mapping %||% list()
  candidates <- c(
    mapping$classroom_id_var, "classroom_id", "aula_id", "codigo_aula", "aula",
    # `collectorID` es la columna que devuelve Kobo cuando el QR lo genera este
    # mismo sistema: Recopiladores cuelga `d[collectorID]=` y ese es el nombre
    # del parametro por defecto. Faltaba en la lista, y `.monitoreo_text_key()`
    # conserva el guion bajo —"collectorid" no es "collector_id"—, asi que
    # nuestro propio enlace producia una columna que este cruce no encontraba.
    "collectorID", "collector_id", mapping$collector_var, mapping$link_var
  )
  col <- .monitoreo_aulas_col(data, candidates)
  .monitoreo_aulas_values(data, col, "")
}

.monitoreo_aulas_filter_passed <- function(data, valid_response) {
  if (!is.data.frame(data) || !nrow(data)) return(logical(0))
  col <- .monitoreo_aulas_col(data, c(
    "filter_passed", "pasa_filtro", "apto", "elegible", "eligible",
    "screening_status", "estado_filtro", "consent", "consentimiento"
  ))
  if (!nzchar(col) || !col %in% names(data)) return(valid_response %in% TRUE)
  key <- .monitoreo_text_key(as.character(data[[col]] %||% ""))
  passed <- key %in% c(
    "1", "true", "t", "si", "sí", "yes", "y", "apto", "aprobado",
    "eligible", "elegible", "pasa", "passed", "valid", "valido", "válido",
    "acepta", "consiente", "consent"
  )
  rejected <- key %in% c(
    "0", "false", "f", "no", "n", "no_apto", "no elegible", "no_elegible",
    "rechazado", "rejected", "fail", "failed", "no pasa", "no_pasa"
  )
  passed[!passed & !rejected & valid_response %in% TRUE] <- TRUE
  passed
}
