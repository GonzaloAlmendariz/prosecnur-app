# =============================================================================
# Reserva dirigida: a que aula ir cuando falta un sexo en una facultad
# =============================================================================
#
# POR QUE EXISTE
#
# El banco de extras es hoy un RESIDUO: `extra_pool_policy =
# "leftover_after_chains"`, o sea lo que sobro tras armar las cadenas. Derecho
# tiene 241 extras y Educacion 3, y ese reparto no sale de ninguna brecha
# medida.
#
# Pero tienen funcion declarada (Gonzalo, 2026-08-18): no reemplazan a nadie,
# son aulas adicionales para **cerrar la cuota de hombres y mujeres por
# facultad**. Y esa brecha si es dimensionable.
#
# CUANTO RINDE ELEGIR BIEN. Medido sobre HSVG 2026: de las 443 aulas de DERECHO
# que quedan fuera del plan, la mejor aporta **40,6 mujeres efectivas esperadas**
# contra **14,5** de la mediana del banco — **2,8x**. Y las aulas no son
# homogeneas: en DERECHO la composicion va del 38 % al 95 % de mujeres.
#
# POR QUE ES LEGITIMO, Y CON QUE CONDICION
#
# El sexo YA es variable de estratificacion del diseño, asi que elegir un aula
# para cerrar una celda **completa la estratificacion, no la rompe**. Y la
# alternativa real no es no hacer nada: es PONDERAR, que es lo que se hizo en
# 2025 con EE.GG. LETRAS hombres (166 de 180, peso 1,1538). Conseguir las
# encuestas de verdad es mejor que inflar 156 casos hasta 180 con un peso,
# porque el peso asume que los 24 que faltan se parecen a los 156 que estan.
#
# El riesgo que si existe: dentro de una facultad, las aulas con 90 % de mujeres
# pueden ser cursos de una especialidad cuyos estudiantes difieran en lo que se
# mide. Es de segundo orden, pero real. **La condicion innegociable es marcar**
# las encuestas que salgan de un extra dirigido, para poder correr la estimacion
# con y sin ellas. Un peso no permite esa comprobacion; una marca si. Por eso
# cada candidato viaja con `origen_dirigido` y la razon de su eleccion.
#
# LO QUE ESTE MOTOR NO HACE: decidir. Devuelve el orden y las cifras; a que aula
# se va y cuantas se activan es del operativo.

MONITOREO_AULAS_RESERVA_DIRIGIDA_SCHEMA <- "monitoreo_aulas_reserva_dirigida_v1"

# Los alumnos de un aula que cuentan para ESTA celda: los de la facultad de la
# celda Y de su sexo, descontando los que ya se midieron en otra aula.
#
# El descuento no es un refinamiento: en 2025, 446 alumnos de las 194 aulas
# aplicadas ya habian sido medidos en otra (`ya_medidas`). Sin descontarlos, un
# aula que solapa entera con lo ya visitado parece aportar y no aporta nada.
.mard_aporte <- function(aula, sexo, ya_medidos, sin_sexo = FALSE) {
  # **Los dos lados por la CLAVE del sexo, no por su texto.** `sex_top_*` trae
  # el vocabulario del MARCO y `sexo` el de la celda —que es una etiqueta para
  # mostrar, y `.maac_sexo_etiqueta()` la produce como palabra—. Comparar
  # `toupper()` casaba sólo mientras los dos escribieran igual: en HSVG2026 el
  # marco pone "F"/"M" literal, y con una etiqueta "Femenino" `del_sexo` salía
  # 0, ninguna aula pasaba el filtro y la reserva dirigida publicaba CERO
  # candidatos sin que nada fallara. Esa misma mudez ya costó una vez (ver el
  # aviso de `monitoreo_aulas_calibracion.R`).
  s1 <- .maac_sexo_key(.monitoreo_scalar(aula$sex_top_1 %||% "", ""))
  s2 <- .maac_sexo_key(.monitoreo_scalar(aula$sex_top_2 %||% "", ""))
  n1 <- suppressWarnings(as.numeric(.monitoreo_scalar(aula$sex_top_1_n %||% 0, 0))[1])
  n2 <- suppressWarnings(as.numeric(.monitoreo_scalar(aula$sex_top_2_n %||% 0, 0))[1])
  n1 <- if (is.finite(n1)) n1 else 0
  n2 <- if (is.finite(n2)) n2 else 0
  total <- n1 + n2
  # **Tres estados, no dos.** «La cuota no tiene dimensión de sexo» y «el sexo
  # no se reconoce» son cosas distintas y el mismo `""` las decía las dos.
  #
  # Con `sin_sexo` —una cuota por el eje, sin celdas de sexo— cuentan TODOS los
  # elegibles del aula: no hay sexo que cerrar, así que filtrar por uno deja el
  # aporte en cero. Medido sobre el simulacro de CCSS por nivel: las cuatro
  # celdas del eje recibían 0 candidatos con 342 personas de brecha y 86 aulas
  # de reserva en el plan, sin que nada fallara.
  #
  # Sin esa marca, un `""` no casa con otro `""`: el sexo que no se reconoce no
  # toma `n1` de rebote. Sin clave no hay celda que cerrar, y el silencio se
  # declara arriba.
  del_sexo <- if (isTRUE(sin_sexo)) total
              else if (!nzchar(sexo)) 0
              else if (identical(s1, sexo)) n1
              else if (identical(s2, sexo)) n2 else 0
  if (total <= 0 || del_sexo <= 0) return(list(elegibles = 0, netos = 0, solape = 0))
  # Traslape: los ids que ya se midieron. Sin ids no se puede descontar y se
  # DECLARA, en vez de asumir que no hay solape —que es la suposicion optimista—.
  ids <- .monitoreo_scalar(aula$unique_student_ids %||% "", "")
  solape <- 0
  if (nzchar(ids) && length(ya_medidos)) {
    propios <- strsplit(ids, "|", fixed = TRUE)[[1]]
    propios <- propios[nzchar(propios)]
    if (length(propios)) {
      # El solape se reparte en la proporcion del sexo: los ids no vienen
      # etiquetados, asi que atribuir todo el solape a este sexo lo castigaria
      # de mas y atribuirle cero lo premiaria. Se declara el supuesto.
      solape <- sum(propios %in% ya_medidos) * (del_sexo / total)
    }
  }
  list(elegibles = del_sexo, netos = max(0, del_sexo - solape), solape = solape)
}

#' Personas, no decimales.
#'
#' Gonzalo, viendo la pantalla: «a veces veo que te refieres a los alumnos como
#' si fueran numeros decimales, como te falta por aplicar un aula y esta aporta
#' seis punto uno, como si hubiera un decimo de alumno en esa aula. Eso esta
#' mal.» Tiene razon y el defecto era de esta capa: el aporte de un aula es una
#' esperanza, pero lo que un aula entrega son personas enteras y asi es como se
#' lee la frase.
#'
#' **Hacia abajo y no al mas cercano.** Es lo que un aula va a APORTAR, no lo
#' que hay que alcanzar: prometer 17 cuando se esperan 16,6 es prometer de mas,
#' y en una decision de a que aula ir eso se paga. `fmtCuenta()` del frontend
#' redondea hacia arriba por el motivo contrario —una meta que hay que
#' cumplir— y las dos reglas son correctas en su sitio.
#'
#' La DECISION (`alcanza`) sigue calculandose sobre el valor exacto: redondear
#' antes de comparar movería el veredicto por una decima.
#' @keywords internal
.mard_personas <- function(x) {
  v <- suppressWarnings(as.numeric(x))
  ifelse(is.finite(v), floor(v + 1e-9), NA_real_)
}

# Un valor del eje, nombrado dentro de una oración: «CIENCIAS E INGENIERIA» con
# el eje en facultad, «nivel 6» con el eje en nivel. La plantilla la DECLARA el
# catálogo (`frase_valor`) y no se deriva de la etiqueta: derivarla obliga a
# acertar con el artículo de cada eje nuevo, y esta cadena se lee en pantalla.
.mard_frase_de_valor <- function(valor, eje = NULL) {
  v <- .monitoreo_scalar(valor, "")
  if (!nzchar(v)) return("")
  plantilla <- .monitoreo_scalar((eje %||% list())[["frase_valor"]] %||% "%s", "%s")
  sprintf(plantilla, v)
}

# De qué celda se habla, sin nombrarla: «esa facultad y ese sexo», «ese nivel».
# La cláusula de sexo se añade SÓLO cuando la cuota tiene esa dimensión —una
# cuota por nivel no la tiene— y con el eje en facultad y sexo la frase sale
# byte a byte como la tenía HSVG.
.mard_frase_de_celda <- function(eje = NULL, sin_sexo = FALSE) {
  base <- .monitoreo_scalar((eje %||% list())[["frase_celda"]] %||% "esa facultad", "esa facultad")
  if (isTRUE(sin_sexo)) base else paste0(base, " y ese sexo")
}

# El bloque de arriba documenta el helper interno y el de aqui la funcion
# publica. Estaban PEGADOS —`@export` y luego `#' Personas, no decimales`—
# y roxygen los funde en uno solo que termina en el objeto siguiente: el
# `@export` se lo llevaba `.mard_personas` y esta funcion se quedaba fuera
# del NAMESPACE. En dev no se nota; en el binario, si.
#' Candidatos del banco para cerrar una celda facultad x sexo.
#'
#' @param pool lista de aulas disponibles fuera del plan.
#' @param facultad valor del EJE de la celda. Conserva el nombre del parámetro
#'   —la firma es pública— y su significado lo declara `eje`.
#' @param sexo `"F"` o `"M"`. Se ignora con `grano = "eje"`.
#' @param tasa_aula función que da la tasa de efectividad de un aula por su
#'   número de elegibles; por defecto, la del rendimiento por tramo.
#' @param ya_medidos ids de alumnos ya medidos en otras aulas.
#' @param tope cuántos candidatos devolver.
#' @param eje el eje resuelto por [monitoreo_aulas_eje()]. Sin él, `facultad`:
#'   un estudio existente no cambia un byte.
#' @param grano `"eje"` cuando la celda NO tiene dimensión de sexo, tal como lo
#'   declara el motor en `avance_sexo_facultad`. No se infiere de un sexo vacío:
#'   «la cuota no pide sexo» y «el sexo no se reconoce» piden respuestas
#'   opuestas —contar a todos o no proponer nada— y confundirlas es justo el
#'   defecto que este parámetro cierra.
#' @return lista ordenada por aporte esperado a ESA celda.
#' @export
monitoreo_aulas_reserva_dirigida <- function(pool = list(), facultad = "", sexo = "F",
                                             tasa_aula = NULL, ya_medidos = character(0),
                                             tope = 5L, eje = NULL, grano = "") {
  if (!is.list(eje) || !length(eje)) eje <- monitoreo_aulas_eje(list())
  # **La columna del banco la dice el eje.** Buscaba `a$faculty` siempre, así
  # que con la cuota por nivel comparaba «6» contra «CIENCIAS SOCIALES» y no
  # encontraba nunca nada. Medido: 4 celdas, 0 candidatos, 342 de brecha.
  columna <- .monitoreo_scalar(eje[["columna"]] %||% "faculty", "faculty")
  fac <- .maac_eje_key(facultad, eje)
  if (identical(fac, paste0("sin_", .monitoreo_scalar(eje[["clave"]], "facultad")))) fac <- ""
  sin_sexo <- identical(.monitoreo_scalar(grano, ""), "eje")
  # La celda llega con su etiqueta ("Femenino", "Mujer", "F"); aquí se reduce a
  # la clave del diseño. Sin clave no se adivina: se devuelve vacío, porque
  # inventar a qué sexo pertenece un candidato es peor que no proponerlo.
  sexo <- if (sin_sexo) "" else .maac_sexo_key(.monitoreo_scalar(sexo, "F"))
  if (!nzchar(fac) || (!sin_sexo && !nzchar(sexo)) || !length(pool)) return(list())
  if (!is.function(tasa_aula)) tasa_aula <- function(n) .cm_efectividad_rendimiento(n)
  filas <- list()
  for (a in pool) {
    if (!is.list(a)) next
    # **Sólo aulas del MISMO valor del eje.** Es el punto entero del ítem: un
    # aula que aporta 60 alumnos de otra facultad —o de otro nivel— no cierra
    # esta celda. La clave se saca con `.maac_eje_key`, la misma que usó
    # `avance_cuota` para armar las celdas: dos normalizadores distintos sobre
    # los dos lados de la comparación es como se fabrica un cero mudo.
    if (!identical(.maac_eje_key(a[[columna]] %||% "", eje), fac)) next
    ap <- .mard_aporte(a, sexo, ya_medidos, sin_sexo = sin_sexo)
    if (ap$netos <= 0) next
    elig <- suppressWarnings(as.numeric(.monitoreo_scalar(a$eligible_n %||% 0, 0))[1])
    if (!is.finite(elig) || elig <= 0) elig <- ap$elegibles
    tasa <- suppressWarnings(as.numeric(tasa_aula(elig))[1])
    if (!is.finite(tasa) || tasa <= 0) next
    filas[[length(filas) + 1L]] <- list(
      classroom_id = .monitoreo_scalar(a$classroom_id %||% a$operational_code %||% "", ""),
      # El campo conserva su nombre —la firma es pública y el frontend lo lee—
      # y lleva el valor del EJE del aula, que con el eje en facultad es lo que
      # llevaba.
      faculty = .monitoreo_scalar(a[[columna]] %||% "", ""),
      sexo = sexo,
      # Sigue llamándose así porque el nombre es público. Con `sin_sexo` son los
      # elegibles del aula sin más: no hay sexo del que sean.
      elegibles_del_sexo = .mard_personas(ap$elegibles),
      solape_estimado = .mard_personas(ap$solape),
      # El aporte que cierra la celda: alumnos de ESA facultad y ESE sexo, netos
      # de lo ya medido, por la tasa de efectividad del aula.
      aporte_esperado = .mard_personas(ap$netos * tasa),
      tasa_efectividad = round(tasa, 3),
      solape_medible = nzchar(.monitoreo_scalar(a$unique_student_ids %||% "", "")),
      # **La marca, sin la cual esto no se puede usar.** Sirve para correr la
      # estimacion con y sin estas encuestas: un peso no permite comprobarlo.
      origen_dirigido = TRUE,
      # La frase que nombra la celda sale del EJE, declarada y no derivada: con
      # `frase_valor = "%s"` la de facultad queda byte a byte como estaba.
      motivo = if (sin_sexo)
          sprintf("Aporta %s de %s a la cuota de %s",
                  .mard_personas(ap$netos * tasa), .mard_personas(ap$elegibles),
                  .mard_frase_de_valor(a[[columna]] %||% "", eje))
        else
          sprintf("Aporta %s de %s a la cuota de %s de %s",
                  .mard_personas(ap$netos * tasa), .mard_personas(ap$elegibles),
                  if (identical(sexo, "F")) "mujeres" else "hombres",
                  .mard_frase_de_valor(a[[columna]] %||% "", eje))
    )
  }
  if (!length(filas)) return(list())
  orden <- order(-vapply(filas, function(f) f$aporte_esperado, numeric(1)),
                 vapply(filas, function(f) f$classroom_id, character(1)))
  utils::head(filas[orden], max(0L, as.integer(tope)[1]))
}

#' Candidatos del banco para CADA celda que no va a llegar.
#'
#' Sólo se calcula donde hay decisión que tomar: una celda asegurada no necesita
#' candidatos y calcularlos para las quince sería trabajo que nadie mira. El
#' banco son las filas del plan con `sample_role == "extra_reserve_pool"` —hoy un
#' residuo de armar las cadenas; esto es lo que le da función.
#'
#' @param avance salida de `monitoreo_aulas_avance_sexo_facultad`.
#' @param plan filas del plan (incluye el banco).
#' @param ya_medidos ids de alumnos ya medidos.
#' @param tope candidatos por celda.
#' @param eje el eje resuelto por [monitoreo_aulas_eje()]. Sin él, `facultad`.
#' @return lista por celda en déficit con sus candidatos.
#' @export
monitoreo_aulas_reserva_por_celda <- function(avance = list(), plan = list(),
                                              ya_medidos = character(0), tope = 5L,
                                              eje = NULL) {
  if (!is.list(eje) || !length(eje)) eje <- monitoreo_aulas_eje(list())
  if (!length(avance) || !length(plan)) return(list())
  banco <- Filter(function(f) {
    is.list(f) && identical(
      tolower(trimws(as.character(.monitoreo_scalar(f$sample_role %||% "", "")))),
      "extra_reserve_pool"
    )
  }, plan)
  if (!length(banco)) return(list())
  en_deficit <- Filter(function(c1) {
    is.list(c1) && .monitoreo_scalar(c1$estado %||% "", "") %in%
      c("deficit_proyectado", "deficit_no_subsanable")
  }, avance)
  if (!length(en_deficit)) return(list())
  out <- lapply(en_deficit, function(c1) {
    # **El aporte se estima con lo que el campo ESTÁ rindiendo en ESA celda**,
    # no sólo con la tasa que el diseño le puso.
    #
    # `tasa_aula` caía siempre al rendimiento por tramo —la tasa del diseño—
    # mientras el motor publicaba `factor_de_campo` por celda y nadie lo leía: la
    # costura existía y estaba sin usar. Si en DERECHO Mujeres el campo va al
    # 80 % de lo previsto, un aula de 60 elegibles no va a rendir lo que el
    # diseño dice, y ordenar candidatos por una cifra optimista es elegir mal el
    # mejor postor.
    #
    # El factor ya viene ENCOGIDO hacia 1 por el propio motor —con poco
    # observado manda el diseño—, así que aquí se usa tal cual y no se vuelve a
    # amortiguar. Sin factor medible se cae a la tasa del diseño, que es el
    # comportamiento de antes.
    factor <- suppressWarnings(as.numeric(.monitoreo_scalar(c1$factor_de_campo %||% NA_real_, NA_real_))[1])
    tasa_de_la_celda <- if (is.finite(factor) && factor > 0) {
      function(n) .cm_efectividad_rendimiento(n) * factor
    } else NULL
    # **El grano viaja, no se adivina.** Lo declara el motor en la celda; con
    # `"eje"` esa celda no tiene dimensión de sexo y pedirle una la dejaba sin
    # candidatos en silencio.
    grano <- .monitoreo_scalar(c1$grano %||% "", "")
    cand <- monitoreo_aulas_reserva_dirigida(
      pool = banco, facultad = .monitoreo_scalar(c1$faculty %||% "", ""),
      sexo = .monitoreo_scalar(c1$sex %||% "F", "F"),
      tasa_aula = tasa_de_la_celda,
      ya_medidos = ya_medidos, tope = tope, eje = eje, grano = grano
    )
    aporte <- if (length(cand)) sum(vapply(cand, function(x) x$aporte_esperado, numeric(1))) else 0
    brecha <- suppressWarnings(as.integer(.monitoreo_scalar(c1$brecha %||% 0, 0))[1])
    if (!is.finite(brecha)) brecha <- 0L
    list(
      faculty = .monitoreo_scalar(c1$faculty %||% "", ""),
      sex = .monitoreo_scalar(c1$sex %||% "", ""),
      brecha = brecha,
      candidatos = cand,
      aporte_de_los_candidatos = .mard_personas(aporte),
      # **Si el banco alcanza o no.** Es la frase que decide, y por eso dice las
      # dos cifras: un «hay 5 candidatos» no responde si con esos 5 se cierra.
      alcanza = length(cand) > 0 && aporte >= brecha,
      etiqueta = if (!length(cand))
          # La celda se nombra con la frase DECLARADA del eje: con el eje en
          # facultad y sexo sale «esa facultad y ese sexo», byte a byte como
          # estaba; con la cuota por nivel, «ese nivel» — y no «esa facultad y
          # ese sexo» sobre un estudio de una sola facultad y sin cuota de sexo.
          sprintf("El banco no tiene cursos-horario de %s",
                  .mard_frase_de_celda(eje, identical(grano, "eje")))
        else if (aporte >= brecha)
          sprintf("Con %d curso%s-horario del banco se cierra: aportan %s y faltan %d",
                  length(cand), if (length(cand) == 1L) "" else "s",
                  .mard_personas(aporte), brecha)
        else
          sprintf("El banco no alcanza: sus %d curso%s-horario aportan %s y faltan %d",
                  length(cand), if (length(cand) == 1L) "" else "s",
                  .mard_personas(aporte), brecha)
    )
  })
  out
}
