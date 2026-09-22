# Qué columnas de «Avance por facultad» sostiene la DECLARACIÓN del estudio.
#
# Gonzalo, mirando la hoja publicada de CCSS Perfil 2026-II: «todavía hay campos
# vacíos». Eran doce columnas en raya permanente, y una raya permanente es la
# regla del slop aplicada a la geometría: **una raya es mejor que un cero
# mentiroso, pero ninguna columna es mejor que una raya.** Lo que no se puede
# calcular no se reserva sitio.
#
# Y el encargo de fondo no es maquetar CCSS: «el propósito final es poder
# generalizarlo y automatizarlo, por lo que la app debe ser robusta a mostrar
# estudios universitarios por facultad y a este, que es un estudio de facultad
# por carreras y principalmente nivel curricular». Así que no hay un `if` por
# proyecto: hay cuatro DECLARACIONES del estudio, y cada grupo de columnas
# cuelga de la suya.
#
#   · `aulas`          — el eje se atribuye al AULA. Con `atribucion = "persona"`
#                        un aula no pertenece a una celda del eje (ADR 0086/0088).
#   · `meta_sexo`      — alguna celda de `design_targets$facultades` trae
#                        `cuota_sexo`. En CCSS las celdas traen `facultad`,
#                        `faculty_key`, `cuota` y `tau`, y nada más.
#   · `observado_sexo` — el cruce de sexo por celda dio dato.
#   · `sobremuestra`   — el diseño publica sus DOS metas (`meta_diseno` y
#                        `meta_operativa`). Sin las dos no hay ratio y la
#                        sobremuestra no se reparte: el libro nunca la supone.
#
# **La asimetría del sexo no es un descuido.** En CCSS el sexo OBSERVADO sí
# existe —`monitoreo_aulas_columna_sexo()` resuelve la variable del instrumento—
# lo que falta es la META. Por eso el sexo se va de las columnas de meta de esta
# tabla y reaparece, con lo que sí se sabe de él, en el bloque «Cobertura»
# (`carga_aulas_libro_avance_cobertura.R`).
#
# **HSVG2026 declara las cuatro cosas**, así que su hoja sale byte a byte como
# estaba: mismas veintitrés columnas y en el mismo orden. Ésa es la vara de
# aceptación de este archivo y hay un test que la fija.

# Los grupos, por rótulo. Nunca por posición: insertar una columna no puede
# mover un grupo al de al lado — es la misma regla que gobierna el resto del
# vocabulario y que ya costó un techo de 188 aulas pintado como «18800,0 %».
.CALACD_GRUPOS <- list(
  aulas = c("Aulas aplicadas", "Aulas planificadas originalmente",
            "Aulas proyectadas al cierre", "Aulas sobre el plan"),
  # Efectivas por sexo: es OBSERVACIÓN, y se publica en cuanto hay cruce aunque
  # el diseño no haya puesto meta de sexo.
  observado_sexo = c("Efectivas hombres", "Efectivas mujeres"),
  # El avance por sexo necesita las DOS cosas: lo observado y su meta.
  avance_sexo = c("Avance muestra hombres", "Avance muestra mujeres"),
  meta_sexo = c("Muestra hombres", "Faltantes hombres muestra",
                "Muestra mujeres", "Faltantes mujeres muestra"),
  sobremuestra = c("Sobremuestra", "Faltantes sobremuestra"),
  sobremuestra_sexo = c("Sobremuestra hombres", "Faltantes hombres sobremuestra",
                        "Sobremuestra mujeres", "Faltantes mujeres sobremuestra")
)

# Y los de «Rendimiento por facultad», que cuelgan de las MISMAS declaraciones.
# Esta tabla sí agrupa por facultad siempre, pero sus columnas de META las lee
# de `design_targets$facultades` por clave de facultad: con el eje atribuido a
# la PERSONA esas celdas son niveles, no casan con ninguna facultad y «Muestra»
# se queda en raya para siempre. Medido en el libro de CCSS: ocho columnas
# vacías en una tabla de dieciocho.
.CALACD_GRUPOS_RENDIMIENTO <- list(
  meta_fac = "Muestra",
  meta_fac_sexo = c("Muestra hombres", "Efectivas esperadas hombres",
                    "Muestra mujeres", "Efectivas esperadas mujeres"),
  # Lo OBTENIDO por sexo sale del cruce de las respuestas, no del diseño: se
  # publica en cuanto hay cruce aunque el diseño no ponga meta.
  obtenido_sexo = c("Cuestionarios aplicados hombres", "Cuestionarios aplicados mujeres"),
  # **La disposición de los casos sólo existe con el eje por PERSONA.** Con
  # `atribucion = "aula"` todo cuestionario de un aula aplicada es una entrevista
  # efectiva de su celda: las tres columnas serían una copia de la de al lado y
  # dos ceros perpetuos. Es la sexta puerta, con el mismo mecanismo que las cinco.
  casos = c("Entrevistas efectivas", "Casos fuera del universo",
            "Casos no resueltos", "Casos duplicados"),
  # La diferencia necesita las dos: lo obtenido y lo esperado.
  dif_sexo = c("Diferencia de efectivas hombres", "Diferencia de efectivas mujeres")
)

#' Lo que el estudio declara, leído de sus insumos y no supuesto.
#'
#' @param cuotas el bloque `design_targets`.
#' @param por_aula si el eje de cuotas se atribuye al AULA.
#' @param con_sexo_observado si el cruce de sexo por celda dio dato.
#' @return lista de banderas.
#' @keywords internal
.calacd_declaracion <- function(cuotas = NULL, por_aula = TRUE,
                                con_sexo_observado = FALSE) {
  facs <- if (is.list(cuotas)) (cuotas$facultades %||% list()) else list()
  meta_sexo <- any(vapply(facs, function(f) {
    cs <- (f %||% list())$cuota_sexo %||% list()
    any(is.finite(suppressWarnings(as.numeric(c(cs$F %||% NA, cs$M %||% NA)))))
  }, logical(1)))
  # La MISMA condición que hace que `.calaf_sobremuestra_reparto()` devuelva un
  # reparto y no `NULL`: las dos cifras del diseño, positivas. Si se separaran,
  # la tabla publicaría una columna que su propio motor deja siempre en NA.
  meta_dis <- suppressWarnings(as.numeric((cuotas %||% list())$meta_diseno %||% NA))
  oper_dis <- suppressWarnings(as.numeric((cuotas %||% list())$meta_operativa %||% NA))
  ratio <- if (length(meta_dis) == 1L && is.finite(meta_dis) && meta_dis > 0 &&
               length(oper_dis) == 1L && is.finite(oper_dis)) oper_dis / meta_dis else NA_real_
  list(
    aulas = isTRUE(por_aula),
    # La disposición de los casos sólo tiene sentido cuando un cuestionario puede
    # NO ser una entrevista efectiva de su celda, y eso pasa sólo con el eje por
    # persona.
    casos = !isTRUE(por_aula),
    # ¿Hay siquiera una cuota del diseño? «Rendimiento por facultad» se dibuja
    # con o sin ella —mide τ sobre las aulas aplicadas— pero su columna
    # «Muestra» sale de aquí, y sin celdas no habrá nunca.
    cuotas = any(vapply(facs, function(f) {
      is.finite(suppressWarnings(as.numeric((f %||% list())$cuota %||% NA))[1])
    }, logical(1))),
    meta_sexo = isTRUE(meta_sexo),
    observado_sexo = isTRUE(con_sexo_observado),
    sobremuestra = is.finite(ratio) && ratio > 0
  )
}

#' Las columnas que esa declaración implica, en el orden del vocabulario.
#'
#' @param clave la clave de la tabla. Sólo `facultad` se recorta: las otras
#'   cuatro no cuelgan de estas declaraciones.
#' @param decl lo que devuelve [.calacd_declaracion()]. `NULL` devuelve la
#'   constante ENTERA, que es el comportamiento de siempre y el que hereda
#'   cualquier llamador que no declare nada.
#' @return el vector de rótulos.
#' @keywords internal
aulas_avance_columnas_declaradas <- function(clave, decl = NULL) {
  clave <- as.character(clave)[1]
  base <- AULAS_AVANCE_CABECERAS[[clave]]
  if (is.null(base) || !length(base)) return(character(0))
  if (is.null(decl)) return(base)
  if (identical(clave, "rendimiento")) {
    vivos <- c(
      meta_fac = isTRUE(decl$aulas) && isTRUE(decl$cuotas),
      meta_fac_sexo = isTRUE(decl$aulas) && isTRUE(decl$meta_sexo),
      obtenido_sexo = isTRUE(decl$observado_sexo),
      casos = isTRUE(decl$casos),
      dif_sexo = isTRUE(decl$aulas) && isTRUE(decl$meta_sexo) &&
        isTRUE(decl$observado_sexo)
    )
    fuera <- unlist(.CALACD_GRUPOS_RENDIMIENTO[names(vivos)[!vivos]], use.names = FALSE)
    return(base[!(base %in% fuera)])
  }
  if (!identical(clave, "facultad")) return(base)
  vivos <- c(
    aulas = isTRUE(decl$aulas),
    observado_sexo = isTRUE(decl$observado_sexo),
    avance_sexo = isTRUE(decl$observado_sexo) && isTRUE(decl$meta_sexo),
    meta_sexo = isTRUE(decl$meta_sexo),
    sobremuestra = isTRUE(decl$sobremuestra),
    sobremuestra_sexo = isTRUE(decl$sobremuestra) && isTRUE(decl$meta_sexo)
  )
  fuera <- unlist(.CALACD_GRUPOS[names(vivos)[!vivos]], use.names = FALSE)
  base[!(base %in% fuera)]
}
