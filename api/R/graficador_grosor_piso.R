# Piso de grosor de barra declarado en PULGADAS.
#
# Los graficadores fijan el grosor en unidades ggplot: una fraccion de la fila
# que ocupa la categoria. Ese numero no dice nada sobre lo que se ve. Una barra
# al 0.70 de su fila es gruesa si la fila mide media pulgada y es una cinta si
# la fila mide un quinto, y el recetario pone el piso donde se mide —0.32 in en
# escala, 0.20 in en categorica—, no en la fraccion.
#
# La conversion es directa: el grosor en pulgadas es la fraccion por el alto de
# la fila. Con eso el piso deja de ser un numero magico calibrado a ojo y pasa a
# ser el que el recetario declara.
#
# El piso es un objetivo, no una garantia: cuando el alto de fila es tan corto
# que ni la barra entera lo alcanza, se llega al tope y no mas. Forzar mas seria
# pegar las barras unas con otras, que es peor que una barra fina.

# Fraccion maxima de la fila que puede ocupar una barra. Por encima de esto las
# barras se tocan y el panel se lee como un bloque.
.GROSOR_TOPE_FRACCION <- 0.92

# Techo de grosor de barra en PULGADAS.
#
# Existe por la misma razon que el piso, del otro lado: en una lamina de cuatro
# paneles, el cuadrante con dos barras estira su panel y sale a 1.45 o 1.68 cm
# mientras el de cinco se queda en 0.70. Medido, el motor dispersaba 0.75-0.98
# cm dentro de una misma lamina y el aprobado 0.12-0.29.
#
# CORRECCION DE LA CIFRA. Este comentario decia que 0.394 in —1.0 cm— era «el
# grosor mayor que usa el entregable aprobado en cualquiera de sus laminas». Es
# FALSO, y sostuvo el valor durante todo el recorrido. Medido con `medir_mazo()`
# sobre los dos mazos, escala y categoricas juntas:
#
#                      maximo    p90     barras sobre 1.0 cm
#   entregable aprobado  1.801   1.400   38 de 64  (59 %)
#   motor                2.545   2.054   46 de 65  (71 %)
#
# El aprobado pasa de 1.0 cm en mas de la mitad de sus barras, asi que un techo
# ahi recortaria al modelo. El valor pasa a 1.80 cm —su maximo—, que es el
# criterio conservador: «el motor no pasa de lo que el modelo hace».
#
# APLICARLO, EN CAMBIO, SE MIDIO Y SE DESCARTO. Este techo sigue SIN CONSUMIDOR
# a proposito. Se probo a traducirlo a un tope del panel dentro del bloque de
# estirado de `graficador_barras_apiladas.R` —el unico sitio donde puede actuar,
# porque el estirado ocurre despues de la fraccion y la superaria—:
#
#   maximo   2.545 -> 2.319 cm   (el aprobado esta en 1.801)
#   p90      2.054 -> 1.928
#   valores      22 -> 22
#   VARA         22 -> 23        <- aparece R5 grosor categorico
#
# Recorta poco y rompe una regla: el techo adelgaza barras que R5 ya vigilaba
# por abajo, y ese cruce es el mismo que hizo saltar R5 de 0 a 11 en un intento
# anterior. El grosor no se arregla recortando el estirado; se arregla en lo que
# el estirado viene a compensar, que es el hueco vacio de la lamina (P23).
#
# REPETIDO EN P37 con OTRO estado —reserva de pie ya reparada a 0.5 y la paleta
# azul ya medida con R10/R11—, porque un descarte vale solo para el estado en
# que se midio. El resultado no cambia y ahora se sabe POR QUE:
#
#   maximo azul  2.751 -> 2.551 cm   (el aprobado esta en 1.805)
#   p90 azul     2.20  -> 2.08
#   R10              4 -> 4          <- NO QUITA NI UNO
#   VARA            23 -> 24         <- aparece R5, otra vez
#
# La razon estructural: la barra sale gruesa porque su FRACCION de fila
# (`grosor_eff`) es alta, no porque la fila sea alta. Recortar el panel acorta
# la fila —y devuelve el hueco vacio de P23— sin bajar la fraccion, asi que el
# grosor cede una decima parte y sigue al doble del techo. El unico lever que
# funcionaria es `grosor_eff`, y el `geom_col(width = grosor_eff)` se construye
# ANTES de que se conozca el alto fisico de la fila: el graficador decide la
# fraccion sin saber cuantos centimetros mide lo que dibuja.
#
# Arreglarlo de verdad exige REORDENAR —calcular el alto del canvas antes de
# construir el geom—, no ajustar una constante. No volver a intentarlo con un
# tope.
.GROSOR_TECHO_IN <- 0.7087

# Rejilla del grosor de barra, en pulgadas. 0.0394 in = 1 mm.
#
# Dos laminas del mismo tipo salian con grosores que solo diferian en decimas
# de milimetro porque el reparto de alto depende del cromo de cada bloque.
#
# MEDIDO Y DESCARTADO como remedio, dos veces y por razones opuestas:
#
# 1. Primera medicion (mazo de 411 barras, antes del techo de grosor y del paso
#    de fila comun): la rejilla bajaba de 22 grosores distintos a 21. La
#    dispersion no era de redondeo sino GENUINA —0.65, 1.09, 1.65 y 2.02 cm en
#    laminas de tres filas—, asi que cuantizar no colapsaba nada.
#
# 2. Segunda medicion (mazo de 2349 barras, ya con techo y paso comun): la
#    dispersion genuina desaparecio y la rejilla SI colapsaria —de 52 valores a
#    13—. Pero ya no hace falta, porque el problema que venia a resolver esta
#    resuelto por otro lado. Medido contra el entregable aprobado:
#
#                                        motor    aprobado
#      dispersion entre laminas gemelas   0.01 cm   0.17 cm
#      grosores distintos                 52        61
#      barras en la banda 0.35-0.50 cm    62 %      70 %
#      valores cuantizados al milimetro   13        14
#
#    El motor iguala o supera al aprobado en tres de los cuatro ejes, y el
#    aprobado TAMPOCO esta cuantizado: tiene la misma dispersion fina. Aplicar
#    la rejilla seria imponer una regularidad que la referencia no tiene.
#
# El helper se conserva porque la funcion es correcta y porque las dos
# mediciones valen mas escritas que reaprendidas, pero no se aplica.
.GROSOR_REJILLA_IN <- 0.0394


#' Alto en pulgadas de la fila de una categoria
#'
#' Vive aqui —y no dentro del graficador— porque lo necesitan dos momentos
#' distintos: cuando se decide el grosor y, mucho despues, cuando se calcula el
#' alto del panel. Dos copias del mismo calculo divergen en cuanto una se toca.
#'
#' DONDE SI ESTA, MEDIDO CON UNA SEGUNDA TRAZA (232 renders): el eje y el panel.
#' La lamina 16 construye su grafico con `y_axis_max = 9.52` y
#' `h_panel_in = 6.1975 in` teniendo CUATRO categorias, mientras una lamina sana
#' de cuatro categorias usa `y_axis_max = 4` y `h_panel_in = 2.2`. El eje es 2.4
#' veces mas largo y el panel 2.8 veces mas alto para el mismo numero de barras,
#' y luego todo eso entra en la misma banda de la lamina. La barra mide 0.78 de
#' su unidad en los dos casos; lo que cambia es cuanto vale esa unidad en
#' pulgadas.
#'
#' CORREGIDO — ese «declarado contra NA» NO separaba laminas sanas de enfermas,
#' separaba WORD de PPT. Los valores declarados salen todos de
#' `.word_escalar_panel_multi()` (`reporte_plan_helpers.R`), que es un helper
#' SOLO de Word: `max(1.1, 0.55 * n_actores)`. Contado en la traza, cuadra
#' exacto — 1.1 con una y dos categorias, 1.65 con tres, 2.2 con cuatro. En PPT
#' `canvas_h_panel_in` llega `NULL` SIEMPRE, asi que el `NA` de la 16 no la
#' distingue de nada. Y como la traza no llevaba identificador de lamina, que la
#' pareja `y_axis_max = 9.52 / h_panel = 6.1975` sea la 16 tampoco esta
#' establecido: aparecia dos veces, que es justo lo que hace cada lamina al
#' renderizarse para PPT y para Word.
#'
#' Lo que si vale de esa traza: 144 de 232 renders tienen `y_axis_max` mayor que
#' su numero de categorias, asi que el eje largo es el caso NORMAL de las
#' mixtas y no una anomalia.
#'
#' Y una pieza que ya existe y conviene mirar antes de escribir otra:
#' `.grosor_anclado_al_nominal()`, mas abajo en este archivo, reancla la
#' fraccion cuando el panel viene impuesto —`fraccion * nominal / real`—. En el
#' camino de PPT el panel NO viene impuesto y el codigo estira
#' `alto_por_cat_eff` para llenar el hueco (`.barras_alto_fila_ajustado()`, en
#' el bloque `if (!panel_fijado_in)`), que es otra forma de imponer una fila
#' distinta de la nominal, y ahi no reancla nadie. Sin medir.
#'
#' Y EL GROSOR NO ES EL CULPABLE, MEDIDO CON TRAZA SOBRE LA CORRIDA ENTERA:
#' `grosor_eff` sale **0.7800** en las 31 laminas de cuatro categorias del mazo,
#' con `min_filas_layout = 1` y `n_categorias_grosor = 4`. Ni las filas
#' virtuales ni `.auto_bar_width_apiladas()` —acotada a [0.40, 0.85], no puede
#' devolver 0.27— explican que la barra de la 16 se dibuje al 27 % de su fila.
#' La fraccion que el graficador decide es la misma antes y despues de P45; lo
#' que cambio esta DESPUES, en como esa fraccion se convierte en pulgadas: el
#' alto del panel contra el tramo del eje. Queda ahi el siguiente paso.
#'
#' MEDIDO EN LA LAMINA 16 DEL MAZO DE CONTA (P48, contra `p51`/`p52`): este
#' alto es el DECLARADO —0.42, o 0.96/1.06 con etiqueta alta—, no el que la fila
#' acaba teniendo. En esa lamina la fila real pasó de 0.554 a 0.693 in y la
#' barra, en vez de engordar, cayó de 0.432 a 0.190 in: la fraccion de fila se
#' desplomó de 0.78 a 0.27. El piso de 0.32 in no lo atrapó porque mide contra
#' este alto declarado y no contra los 0.693 reales, asi que se dió por
#' satisfecho con una barra de 0.190. Un piso que no ve la fila que protege sólo
#' protege de casos que ya estaban bien.
#'
#' @param alto_por_categoria Alto declarado, o `NULL` para el de por defecto.
#' @param needs_tall_label_slot `TRUE` si las etiquetas piden fila alta.
#' @param max_lineas_eje_y Lineas de la etiqueta mas larga.
#'
#' @return Alto de fila en pulgadas.
#' @keywords internal
.grosor_alto_por_categoria <- function(alto_por_categoria = NULL,
                                       needs_tall_label_slot = FALSE,
                                       max_lineas_eje_y = 1L) {
  alto <- suppressWarnings(as.numeric(alto_por_categoria %||% 0.42)[1])
  if (!is.finite(alto) || is.na(alto) || alto <= 0) alto <- 0.42
  if (isTRUE(needs_tall_label_slot)) {
    n <- suppressWarnings(as.numeric(max_lineas_eje_y)[1])
    if (!is.finite(n) || is.na(n)) n <- 1
    alto <- max(alto, if (n >= 8) 1.06 else 0.96)
  }
  alto
}


#' Sube el grosor hasta que la barra alcance su piso en pulgadas
#'
#' @param grosor_eff Grosor en unidades ggplot (fraccion de la fila).
#' @param alto_por_cat Alto de la fila, en pulgadas.
#' @param piso_in Piso declarado por la familia, en pulgadas. `NULL` o `<= 0`
#'   desactiva el piso y devuelve el grosor tal cual.
#' @param tope Fraccion maxima de la fila.
#'
#' @return Grosor en unidades ggplot, nunca menor que el recibido.
#' @keywords internal
.grosor_con_piso_in <- function(grosor_eff, alto_por_cat, piso_in,
                                tope = .GROSOR_TOPE_FRACCION) {
  g <- suppressWarnings(as.numeric(grosor_eff)[1])
  if (!is.finite(g) || is.na(g) || g <= 0) return(grosor_eff)

  piso <- suppressWarnings(as.numeric(piso_in %||% NA_real_)[1])
  if (!is.finite(piso) || is.na(piso) || piso <= 0) return(g)

  alto <- suppressWarnings(as.numeric(alto_por_cat)[1])
  if (!is.finite(alto) || is.na(alto) || alto <= 0) return(g)

  # Fraccion de fila que hace falta para llegar al piso. Si pasa del tope, la
  # fila es demasiado corta y no hay grosor que lo arregle: subir mas solo
  # pegaria las barras entre si.
  necesaria <- piso / alto
  max(g, min(tope, necesaria))
}


#' Recorta el grosor cuando pasa del techo declarado
#'
#' El piso y el techo no son simetricos: el piso es un objetivo que puede no
#' alcanzarse —si la fila es corta, no hay grosor que la agrande sin pegar las
#' barras—, mientras el techo si se cumple siempre, porque recortar nunca crea
#' un problema de espacio.
#'
#' @param grosor_eff Grosor en unidades ggplot (fraccion de la fila).
#' @param alto_por_cat Alto de la fila, en pulgadas.
#' @param techo_in Techo declarado, en pulgadas. `NULL` o `<= 0` lo desactiva.
#' @return Grosor en unidades ggplot, nunca mayor que el recibido.
#' @keywords internal
.grosor_con_techo_in <- function(grosor_eff, alto_por_cat,
                                 techo_in = .GROSOR_TECHO_IN) {
  g <- suppressWarnings(as.numeric(grosor_eff)[1])
  if (!is.finite(g) || is.na(g) || g <= 0) return(grosor_eff)

  techo <- suppressWarnings(as.numeric(techo_in %||% NA_real_)[1])
  if (!is.finite(techo) || is.na(techo) || techo <= 0) return(g)

  alto <- suppressWarnings(as.numeric(alto_por_cat)[1])
  if (!is.finite(alto) || is.na(alto) || alto <= 0) return(g)

  min(g, techo / alto)
}


#' Ajusta el grosor a la rejilla del milimetro
#'
#' Sobre el grosor en PULGADAS FISICAS, no sobre la fraccion: dos barras con la
#' misma fraccion y distinto alto de fila no miden lo mismo, y es la medida
#' fisica la que se compara entre laminas.
#'
#' @param grosor_in Grosor en pulgadas.
#' @param rejilla Paso de la rejilla, en pulgadas.
#' @return El grosor ajustado, o el original si no se puede leer.
#' @keywords internal
.grosor_a_rejilla <- function(grosor_in, rejilla = .GROSOR_REJILLA_IN) {
  g <- suppressWarnings(as.numeric(grosor_in)[1])
  if (!is.finite(g) || is.na(g) || g <= 0) return(grosor_in)
  r <- suppressWarnings(as.numeric(rejilla)[1])
  if (!is.finite(r) || is.na(r) || r <= 0) return(g)
  round(g / r) * r
}


#' Ancla el grosor al alto NOMINAL de fila cuando el panel viene impuesto
#'
#' El grosor se decide como fraccion de una fila que se supone de
#' `alto_por_categoria` pulgadas —0.42 por defecto—, y esa calibracion es la que
#' fija cuanto mide la barra. Pero el panel no siempre reparte ese alto: cuando
#' llega un `canvas_h_panel_in` declarado, la fila real pasa a medir
#' `panel / filas`, y la misma fraccion produce otro grosor fisico.
#'
#' Ese es el mecanismo detras de B4. Dos laminas de la misma firma —mismos
#' graficos, mismas barras— reciben distinto alto de panel segun lo que les deje
#' el cromo: un titulo de dos lineas, una leyenda, una nota al pie. La fraccion
#' es la misma en las dos y el grosor fisico no. Medido sobre el mazo: en las
#' siete laminas de firma 6, cuatro salen a 1.057 cm y las otras a 0.978, 1.148
#' y 1.354.
#'
#' La correccion es una regla de tres: para conservar el grosor fisico que se
#' decidio contra la fila nominal, la fraccion se multiplica por
#' `nominal / real`. Con el panel mas alto la fraccion baja, con el panel mas
#' bajo sube, y la barra mide lo mismo en las dos laminas.
#'
#' Se acota al tope de fraccion por el mismo motivo que el piso: pasado ahi las
#' barras se tocan, y una lamina apretada es peor que una barra que no cuadra al
#' milimetro con su gemela.
#'
#' @param grosor_eff Grosor en unidades ggplot (fraccion de la fila).
#' @param alto_nominal_in Alto de fila con el que se calibro, en pulgadas.
#' @param alto_real_in Alto de fila que el panel va a repartir de verdad.
#' @param tope Fraccion maxima de la fila.
#' @return Grosor en unidades ggplot; el recibido si falta algun dato.
#' @keywords internal
.grosor_anclado_al_nominal <- function(grosor_eff, alto_nominal_in, alto_real_in,
                                       tope = .GROSOR_TOPE_FRACCION) {
  g <- suppressWarnings(as.numeric(grosor_eff)[1])
  if (!is.finite(g) || is.na(g) || g <= 0) return(grosor_eff)

  nom  <- suppressWarnings(as.numeric(alto_nominal_in %||% NA_real_)[1])
  real <- suppressWarnings(as.numeric(alto_real_in %||% NA_real_)[1])
  if (!is.finite(nom) || !is.finite(real) || nom <= 0 || real <= 0) return(g)

  min(tope, g * nom / real)
}


#' Grosor resultante en pulgadas, para verificar
#' @keywords internal
.grosor_en_pulgadas <- function(grosor_eff, alto_por_cat) {
  g <- suppressWarnings(as.numeric(grosor_eff)[1])
  a <- suppressWarnings(as.numeric(alto_por_cat)[1])
  if (!is.finite(g) || !is.finite(a)) return(NA_real_)
  g * a
}


# Alto fisico del cajon de cada panel en una lamina `poblacion_4`, en pulgadas.
#
# Medido en el XML del mazo de Conta, lamina 13 («PERFIL DEL EGRESADO»): los
# cuatro grupos de nivel superior son 5.169 x 2.565 in. El graficador recibia
# `ancho_slot = 5.2` —que cuadra con ese 5.169— y ningun alto, asi que se
# quedaba con el default de su firma —seis pulgadas—: creia tener mas del doble
# del alto real, y por eso sus cuentas verticales daban por bueno lo que se
# solapaba (P42, etiqueta de eje de dos lineas sobre la fila vecina).
#
# EL NOMBRE IMPORTA. El primer intento lo llamo `.PANELES_4_…` y lo engancho en
# el bloque `paneles_4` del renderer, que es OTRO layout: en este mazo hay seis
# laminas de cuatro paneles y las seis son `p_slide_4_graficos_poblacion`, o sea
# `poblacion_4`; de `paneles_4` no hay ninguna —su layout ni siquiera existe en
# la plantilla—. El mecanismo estaba puesto donde nunca se ejecuta, y el
# resultado era indistinguible de no haber hecho nada.
#
# LA VARA SUBE DE 20 A 21 Y SE CONSERVA IGUAL. Medido sobre el mazo de Conta,
# antes `p43.pptx` y despues `p44.pptx`: el que entra es un B3 «grosores
# desiguales» en la lamina 9 con valor 0.07 —el minimo del conjunto, empatado
# con los de las laminas 30 y 38, que ya se aceptaban—, y las laminas 10 y 14
# pasan de 0.26 a 0.28. No entra ningun R10 ni ningun R1 nuevo.
#
# Se conserva porque lo que subio no es el dano: es la medicion. B3 compara el
# grosor de dos bloques de la misma lamina, y hasta ahora los comparaba sobre un
# lienzo ficticio de seis pulgadas. Cuatro paneles igualmente equivocados daban
# grosores iguales; con el alto real aparece la diferencia que siempre estuvo
# ahi. Restaurar el 6 no arreglaria la lamina 9, solo volveria a taparla —y a
# cambio devolveria las cuatro etiquetas ilegibles de la 13—.
#
# Vive aqui y no en `reporte_plan_ppt.R` porque ese archivo esta congelado a
# crecimiento: alli queda solo el paso del valor.
.POBLACION_4_ALTO_SLOT_IN <- 2.565
