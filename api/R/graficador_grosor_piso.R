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
#' Y UNA ESTRUCTURA QUE HAY QUE TENER EN CUENTA ANTES DE LEER CUALQUIER TRAZA
#' (medido marcando el destino en una tercera corrida): de los 232 renders,
#' **110 son de PPT y 122 de Word**, y los de PPT vienen EMPAREJADOS — 54 con
#' `alto_por_cat_eff = 0.5500` y 54 con **0.6510**, el mismo `y_axis_max` en
#' cada pareja. O sea que el mismo grafico se construye dos veces dentro del
#' PPT, una con el alto de fila NOMINAL y otra con el ESTIRADO
#' (`.barras_alto_fila_ajustado()`). Que una configuracion «aparezca dos veces»
#' no dice nada, entonces: pasa siempre.
#'
#' EL REMEDIO ESTA BLOQUEADO POR EL ORDEN, y es el mismo bloqueo que ya tenia
#' el techo. En `graficador_barras_apiladas.R` el grosor se consume en
#' `geom_col(width = grosor_eff)` en la linea **1962**, y el ESTIRADO que cambia
#' `alto_por_cat_eff` de 0.55 a 0.651 ocurre en **~2965**, mil lineas despues:
#' cuando la fila real cambia, el grafico ya esta construido. Llamar aqui a
#' `.grosor_anclado_al_nominal()` despues del estirado no puede funcionar —es
#' literalmente el diagnostico que ya estaba escrito para `.GROSOR_TECHO_IN`,
#' «se habia intentado enganchar en el bloque de estirado, 1000 lineas mas
#' abajo, donde recorta el PANEL en vez de la fraccion»—.
#'
#' Para que el anclaje llegue, el alto de fila ESTIRADO tiene que conocerse
#' antes de la linea 1962. Es un reordenamiento del graficador, no una llamada,
#' y es el mismo trabajo que piden los dos R10 que quedan abiertos.
#'
#' CORRECCION AL PLAN: HAY DOS ESTIRADOS, NO UNO. Al ir a implementarlo apareci
#' un segundo: el de **2967** (`.barras_alto_fila_ajustado()`, reparte el hueco
#' a las filas) y el de **~3001** (W-6/B54, `panel_nuevo / n_filas_virtuales`,
#' acotado por `.BARRAS_PANEL_ESTIRA_MAX`), y los DOS reescriben
#' `alto_por_cat_eff`. Anclar despues del primero seguiria dejando fuera al
#' segundo, asi que el anclaje tiene que ver el alto de fila FINAL, no el del
#' primer estirado.
#'
#' Y el bloque a mover no son los tres altos sueltos: es la unidad **2884-3005**
#' —`alto_por_cat_eff` (2884), `n_filas_virtuales` (2889), `h_panel_in` (2890),
#' `panel_min` (2897), `titulo_canvas` (2902), el cromo (2912-2955),
#' `panel_fijado_in` (2958), los dos estirados— mas el `caption_text` de 2783.
#' Todas sus entradas siguen estando disponibles antes de 1962; lo que cambia es
#' el TAMAÑO del movimiento, que es un refactor con su propia sesion y su propio
#' gate, no un apaño de un tick.
#'
#' Y ESE REORDENAMIENTO ES VIABLE, comprobado leyendo las dependencias. El alto
#' del cromo —`h_header_in`, `h_legend_in`, `h_caption_in`, en 2916-2953— es lo
#' unico que le falta a `.barras_alto_fila_ajustado()` para poder llamarse
#' antes, y todo lo que ese calculo necesita ya existe mucho antes de 1962:
#'
#'    legend_is_side          1415        niveles_leyenda    1698
#'    y_axis_max              <=1862      n_categorias       <=1862
#'    needs_tall_label_slot   <=1897      max_lineas_eje_y_est <=1897
#'    titulo/subtitulo/nota_pie/size_*/canvas_h_*   son parametros
#'
#' Cruzados los simbolos que el bloque del cromo usa contra los que se definen
#' entre 1700 y 2782, los unicos con dependencia real hacia abajo son `p_bars` y
#' `p_bars_panel`, y esos aparecen en el ENSAMBLADO del grafico (2796, 2848),
#' no en el calculo de los tres altos. O sea que los tres altos se pueden
#' extraer a un helper y llamarlos hacia 1900.
#'
#' CAUSA IDENTIFICADA, cruzando contra el PLAN. La lamina 16 es
#' `plan$slides[[16]]`, «MISION Y PROPOSITOS INSTITUCIONALES», un
#' `p_slide_1_grafico` con dos bloques `var_cruce` de cuatro publicos cada uno,
#' y declara en sus overrides **`wrap_y = 90`**. Antes de P45 el estimador de
#' altura envolvia el ENUNCIADO con `max(12, floor(90 * 0.8)) = 72` caracteres
#' —el mas generoso de todo el mazo, porque ese 90 es el envoltorio del EJE—.
#' Medido sobre sus dos enunciados:
#'
#'    wrap 72 -> 2 lineas    canal real 0.22 -> 5 lineas
#'    wrap 72 -> 3 lineas    canal real 0.22 -> 6 lineas
#'
#' De cinco lineas contadas a once: es la lamina donde la correccion de P45
#' pega mas fuerte de todo el mazo, y de ahi salen su `y_axis_max = 9.52` y sus
#' barras de 0.190. P45 cuenta bien —el enunciado ocupa esas once lineas—; lo
#' que falta es que ese alto extra vaya a la BANDA DE TEXTO y no a filas
#' virtuales del eje, que es lo que adelgaza la barra.
#'
#' IDENTIFICADOR ENCONTRADO (tercera clave probada): `plot_cat_lvls` no son las
#' etiquetas visibles sino las REFERENCIAS de variable —`tema_1__1__docentes`,
#' `tema_1__2__estudiantes`…—, y esas si distinguen un render de otro. La 16
#' muestra en pantalla «Docentes / Estudiantes / Egresados / Administrativos»,
#' que no aparecen en la traza: la clave hay que cruzarla contra el PLAN, no
#' contra el XML.
#'
#' Y una asimetria medida que si singulariza la configuracion sospechosa: en
#' PPT los renders se reparten 54 con `alto_por_cat_eff` nominal (0.5500) y 54
#' con el estirado (0.6510), y CADA configuracion de cuatro categorias aparece
#' una vez con cada uno —salvo la de `y_axis_max = 9.52`, cuyas dos lineas van
#' las DOS al estirado 0.651—. Es la unica que no tiene contraparte nominal.
#'
#' La unica configuracion de cuatro categorias cuyas DOS lineas son identicas
#' —`y_axis_max = 9.52`, `alto_cat_eff = 0.651`, `h_panel = 6.1975`— es la
#' compatible con lo medido en el XML de la lamina 16, donde sus dos bloques dan
#' exactamente el mismo grosor 0.190; en todas las demas las dos lineas difieren
#' en el alto de fila. Es consistente, NO es identificacion: para eso hay que
#' trazar `plot_cat_lvls`, que son las etiquetas de fila y si aparecen en el
#' XML. `titulo` y `caption_text` llegan VACIOS en las multiapiladas y no
#' sirven de clave — probados los dos.
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


# =============================================================================
# P48/P37 — INVENTARIO DEL MOVIMIENTO, hecho antes de mover
# =============================================================================
#
# El grosor se decide ANTES de que se sepa cuanto mide la fila. En
# `graficador_barras_apiladas.R`, `grosor_eff` queda fijado alrededor de la
# 1924 y entra al `geom_col` de la 1970 como FRACCION de fila; el alto de fila
# de verdad se calcula mucho mas abajo, y ahi lo estiran DOS veces. Por eso una
# misma barra sale a 0,5500 in en 54 renders y a 0,6510 in en otros 54, y por
# eso quedan dos R10 (laminas 48 y 54, 2.751).
#
# `.grosor_anclado_al_nominal()` —mas arriba en este archivo— es la regla de
# tres que lo corrige, pero **no se puede llamar donde esta el grosor**: en esa
# linea `alto_por_cat_eff` todavia no existe. De ahi el movimiento. Y de ahi
# tambien que anclar DESPUES del estirado ya se descartara dos veces (`b9982cdb`
# y `4d462d55`): el problema es de ORDEN, no de logica.
#
# EL MOVIMIENTO, medido sobre el estado de `d988a9fb`:
#
#   BLOQUE A   `caption_text`, lineas 2789-2797
#   BLOQUE B   la unidad de altura, 2890-3014 —desde el comentario «alturas en
#              pulgadas» hasta `if (h_total_in <= 0) h_total_in <- 1`, con los
#              DOS estirados dentro (2975 y 3009)
#   DESTINO    justo antes de `p_bars <- ggplot2::ggplot(` en la 1962, primero A
#              y luego B, y detras el anclaje:
#                grosor_eff <- .grosor_anclado_al_nominal(
#                  grosor_eff, alto_por_cat_grosor, alto_por_cat_eff)
#
# POR QUE ES SEGURO, las dos direcciones medidas:
#
#   LO QUE LEE.  Todo lo que el bloque B necesita nace ANTES de la 1962:
#     `niveles_leyenda` 1698 · `legend_is_side` 1415 · `n_categorias` 1775 ·
#     `max_lineas_eje_y_est` 1804 · `needs_tall_label_slot` 1806 ·
#     `y_axis_max` 1818/1858/1870 · `alto_por_cat_grosor` 1904 ·
#     `grosor_eff` 1878-1924. El resto son PARAMETROS de la funcion.
#     La UNICA excepcion es `caption_text` (2791), y por eso viaja con el; sus
#     dos insumos, `nota_pie` y `nota_pie_derecha`, tambien son parametros.
#
#   LO QUE ESCRIBE.  Ninguna de sus DIECISEIS salidas se reasigna entre la 1962
#     y la 2890, que es lo que convertiria el adelanto en un cambio de
#     comportamiento. Las unicas asignaciones fuera del bloque son
#     `h_panel_in` en 3044 y `h_total_in` en 3043/3048, las tres dentro del
#     bloque B46/G-21 (3016-3054), que se queda donde esta y sigue corriendo
#     despues.
#
# LO QUE EL MOVIMIENTO NO ARREGLA, dicho para no confundirlo con un fallo: el
# bloque B46 sube `h_panel_in` a un piso cuando hay 1-2 filas, sin tocar
# `alto_por_cat_eff`. Ahi el grosor NO se reancla, y es deliberado —lo dice su
# propio comentario, apoyado en el ADR 0065: una barra mide lo mismo en toda la
# presentacion—. Queda fuera del alcance de P48.


# P48/P37 — EL MOVIMIENTO SE HIZO Y SE REVIRTIO (LECTURA CORREGIDA ABAJO)
#
# Ejecutado el movimiento que el inventario de arriba autorizaba, contra el
# estado `50d6790a`: `caption_text` (11 lineas) y la unidad de altura completa
# (125 lineas, con sus DOS estirados) adelantadas delante del
# `p_bars <- ggplot2::ggplot(`, y detras el anclaje
# `grosor_eff <- .grosor_anclado_al_nominal(grosor_eff, alto_por_cat_grosor,
# alto_por_cat_eff)`. El orden resultante era el buscado y verificado:
# `alto_por_cat_grosor` 1904 -> `caption_text` 1965 -> unidad 1974-2098 ->
# anclaje 2108 -> `p_bars` 2111 -> `geom_col` 2119.
#
# Regenerado el mazo entero y medido `p56.pptx` contra `p55.pptx`:
#
#   grosor fisico   944 rects de barra y 82 altos distintos en LOS DOS, con la
#                   misma distribucion exacta: 0.2122 (135) · 0.5084 (75) ·
#                   0.4483 (61) · 0.4358 (48) · 0.4066 (48) · 0.0792 (39) ·
#                   0.4078 (29) · 0.5823 (25) · 0.4960 (22) · 0.8757 (21)
#   vara            25 -> 25, misma distribucion, mismas seis laminas B3
#   los dos R10     siguen ahi (laminas 48 y 54)
#   etiquetas «0%»  0 -> 0, universo 1.090 -> 1.090
#
# O sea que el anclaje es un NO-OP en este mazo: la barra mide exactamente lo
# mismo antes y despues. Como el remedio no mejora, se revierte —el estado
# bueno vuelve a ser el de `d988a9fb`— y queda el respaldo del intento en el
# scratchpad como `apiladas.CON_P48MOV.R`.
#
# LO QUE NO SE MIDIO, y es la pregunta del proximo intento: POR QUE es no-op.
# La sospecha —SOSPECHA, no medicion— es que `alto_por_cat_eff` sale de
# `.grosor_alto_por_categoria()` con los MISMOS argumentos que
# `alto_por_cat_grosor`, o sea que empieza igual, y que los dos estirados no
# llegan a moverlo: los dos estan guardados tras `!panel_fijado_in`, y si el
# plan declara `canvas_h_panel_in` no corre ninguno y la razon nominal/real es
# exactamente 1. Se comprueba trazando `alto_por_cat_grosor`,
# `alto_por_cat_eff` y `panel_fijado_in` en los 232 renders, que es lo que ya
# cerro P53 cuando leer codigo no bastaba.
#
# Y si esa sospecha se confirma, el defecto de los 0.5500 contra 0.6510 NO esta
# en el estirado: esta en que dos laminas reciben distinto `canvas_h_panel_in`
# desde el plan, que es el mecanismo de B4 y no el de P48.


# P48/P37 — CORRECCION: «no cambia nada» NO estaba probado
#
# La nota de arriba concluyo que adelantar la unidad de altura y anclar el
# grosor era un NO-OP, y se apoyaba en que `p56.pptx` traia los mismos 944
# rects con la misma distribucion de altos que `p55.pptx`. Comparados despues
# los dos mazos entrada por entrada: **IDENTICOS BYTE A BYTE en las 249
# entradas del zip**, laminas incluidas. Los 203 bytes de diferencia de tamano
# eran metadatos de compresion, no contenido.
#
# Un artefacto identico al anterior no dice que el cambio no sirva: dice que el
# cambio NO ESTA en ese artefacto. Y lo segundo esta medido: instrumentada la
# fuente con `PULSO_TRAZA_GROSOR` sobre los 232 renders, volcando el alto de
# fila NOMINAL (`alto_por_cat_grosor`) contra el REAL (`alto_por_cat_eff`) al
# terminar los dos estirados:
#
#   panel_fijado_in      TRUE en 122 renders · FALSE en 110
#   canvas_h_panel_in    declarado en 122 · NULO en 110
#   nominal == real      140 renders
#   nominal != real      **92 renders**, con razones nominal/real de hasta
#                        **0.493**; las mas frecuentes x0.493 (22), x0.556 (16),
#                        x0.924 (6), x0.703 (6)
#   grosor_eff           0.78 en 168 renders y 0.95 en 64
#
# Con `.GROSOR_TOPE_FRACCION = 0.92`, el anclaje `min(tope, g * nom/real)`
# habria bajado un `grosor_eff` de 0.78 a ~0.385 en los renders de razon 0.493.
# O sea que el anclaje **no es estructuralmente un no-op**: tiene 92 renders
# sobre los que actuar.
#
# Queda descartada tambien la sospecha que dejo la nota anterior: NO es que
# `panel_fijado_in` apague los dos estirados y la razon sea 1. Lo es en 140
# renders, pero en 92 no.
#
# LO QUE HAY QUE HACER en el proximo intento, y por que fallo la medicion: el
# mazo se copia de `entregables_v5/mazo.pptx`, y ese archivo SOBREVIVE a una
# corrida que no llegue a escribirlo. **Borrar el .pptx antes de lanzar** y
# comprobar que reaparece, en vez de fiarse del timestamp; `generar_mazo.R`
# carga con `pkgload::load_all` desde fuente, asi que el codigo editado SI se
# usa —la traza lo demuestra: 232 lineas salidas de una edicion en la fuente—.
#
# LECCION: comparar dos artefactos y encontrarlos iguales tiene DOS lecturas —
# «el cambio no hace nada» y «el cambio no esta aqui»— y la segunda se descarta
# antes que la primera, porque es la barata: un `diff` de las entradas del zip
# cuesta segundos y separa las dos.
