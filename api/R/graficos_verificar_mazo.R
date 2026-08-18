# Verificador del mazo contra el recetario.
#
# La guia de canvas (`debug_ph`) pinta bordes magenta sobre los placeholders.
# Sirve para mirar una lamina, no para saber si un mazo de sesenta cumple. Peor:
# activa mete 978 bordes que tapan lo que se quiere ver —una comparacion de
# color con la guia encendida oculto el hallazgo de los tamanos de letra—.
#
# Esto la reemplaza por lo que hacia falta: medir el .pptx ya generado contra
# las recetas medidas del entregable aprobado, y devolver los incumplimientos
# con su lamina. Un mazo se aprueba por conformidad, no por ausencia de bordes.
#
# La cadena de medicion es la misma que se valido a mano sobre el mazo del
# 14-08, y el orden importa porque cada paso descarta un falso positivo que ya
# costo una conclusion equivocada:
#
#   segmento -> barra (misma fila) -> grafico (misma columna)
#
# - Un segmento se reconoce por su RELLENO. Solo los colores de la escala: el
#   azul institucional y el celeste pintan cabeceras y la columna Top Two Box, y
#   meterlos ensancha el rango de alturas hasta hacerlo inutil.
# - La leyenda repite esos mismos colores en cuadraditos; sin descartarlos, cada
#   leyenda se lee como un grafico de "una barra de 0.108 in".
# - La caja de etiqueta usa el mismo azul que la barra categorica y lleva texto
#   propio; sin ese filtro el medidor devuelve 0.159 in en decenas de laminas.
# - El grosor de un grafico es la MODA de sus barras, no la media: en una lamina
#   conviven la barra, la cabecera y la leyenda.
# - Y se mide POR GRAFICO, no por lamina: una lamina de dos graficos con 7 y 6
#   barras no es "un grafico de 13 barras finisimas".

# P51, MEDIDO Y ABIERTO: **dos laminas apilan la escala AL REVES**. El orden
# canonico de izquierda a derecha es
#
#   F4B183 (Totalmente en desacuerdo) > FFD965 > ADD493 > 70AD47 > BFBFBF (SIN INF)
#
# y lo cumplen 33 de las 35 laminas medibles de `p52.pptx`. Las laminas **28 y
# 30** dibujan `BFBFBF > 70AD47 > ADD493 > FFD965`, o sea la canonica invertida
# con el gris al frente: sus barras corren de acuerdo a desacuerdo mientras el
# resto del mazo corre de desacuerdo a acuerdo. **El entregable aprobado tiene
# CERO** —31 de 31 en orden canonico—, asi que contra la vara son 2 contra 0.
#
# MEDIDA YA LA LEYENDA, ES PEOR QUE UNA INVERSION. Sus cuadros llevan el mismo
# orden que las barras, asi que son coherentes entre si; el problema es cual se
# perdio. Emparejando cada cuadro con la etiqueta que tiene a su derecha:
#
#   lamina 24 y 27 (sanas)   F4B183 · FFD965 · ADD493 · 70AD47 · BFBFBF
#   lamina 28 y 30           BFBFBF · 70AD47 · ADD493 · FFD965 · BFBFBF
#
# La inversion se comio el NARANJA y puso el gris al frente, asi que quedan
# **cuatro colores para cinco categorias** y **BFBFBF esta asignado dos veces**:
# a «Totalmente en desacuerdo» y a «SIN INF». En esas dos laminas esas dos
# categorias son INDISTINGUIBLES, en la leyenda y en las barras. No es que la
# lamina vaya al reves: es que no se puede leer.
#
# EL NARANJA NO SE DIBUJA POCO: NO SE DIBUJA NUNCA. Contadas las ocurrencias de
# `<a:srgbClr>` de la rampa en cada lamina:
#
#   lamina 24 (sana)   F4B183 8 · FFD965 8 · ADD493 8 · 70AD47 16 · BFBFBF 8
#   lamina 27 (sana)   7 · 7 · 7 · 14 · 7
#   lamina 28          **F4B183 0** · 8 · 8 · 16 · **BFBFBF 16**
#   lamina 30          **0** · 3 · 3 · 6 · **6**
#
# El gris aparece EXACTAMENTE EL DOBLE, que es la firma de estar sirviendo a dos
# series. Asi que no es que el nivel «Totalmente en desacuerdo» no tenga casos
# —si los tuviera, seguiria en la leyenda con su color—: es que su color se
# perdio y el gris ocupo su lugar.
#
# DOS SITIOS PUEDEN PRODUCIRLO, los dos localizados:
#
#   1. `graficador_barras_apiladas.R:1697-1698` — `niveles_stack` y
#      `niveles_leyenda` se invierten segun `invertir_segmentos` /
#      `invertir_leyenda`, y de ahi sale el `levels_cat` de la paleta.
#   2. `graficador_paleta.R:110` — la rama POSICIONAL de
#      `.graficos_mk_palette()`: `pal_user[seq_along(levels_cat)]`, que asigna
#      por posicion. El propio archivo ya avisa del riesgo unas lineas antes
#      («caeria al branch posicional y asignaria el color por posicion en vez de
#      por etiqueta, invirtiendo colores cuando el factor esta en orden distinto
#      al del override»), asi que este defecto es una recaida de algo ya visto.
#
# LOS DOS SITIOS DE ARRIBA PARTIAN DE UNA PREMISA FALSA, y esta medida: **el
# plan NO declara colores en ningun sitio**. Cargado el `.pulso` y recorridas
# sus 66 laminas, la unica clave de color/orden que existe en todo el plan es un
# `border_color`; no hay `colores_grupos`, ni `paleta`, ni `invertir_segmentos`,
# ni `orden_categorias` (los titulos de lamina tambien vienen VACIOS). Asi que
# `pal_user` no llega del plan y la rampa se resuelve en otro lado.
#
# DONDE SE RESUELVE DE VERDAD: `graficos_preset_acreditacion.R`, con
# `.PRESET_ACRD_RAMPA` (cuatro colores) y `.PRESET_ACRD_FUERA_ESCALA` (el gris).
# `.preset_acreditacion_colores()` busca cada etiqueta en `.PRESET_ACRD_ESCALA`
# y arma el color por POSICION:
#
#   out <- ifelse(is.na(pos), .PRESET_ACRD_FUERA_ESCALA, .PRESET_ACRD_RAMPA[pos])
#
# o sea que **una etiqueta que no reconoce se convierte en el gris de «fuera de
# escala», que es el MISMO gris de SIN INF, y sin avisar**. Ese es el patron que
# ya mordio antes en este repo: una lista cerrada se traga en silencio lo que no
# reconoce.
#
# LO DESMIENTE. Corrida en frio `.preset_acreditacion_colores()` con las
# etiquetas EXACTAS de la 28 —«Totalmente en desacuerdo», «En desacuerdo», «De
# acuerdo», «Totalmente de acuerdo», «SIN INF»—, devuelve la rampa CANONICA y
# con cinco colores distintos:
#
#   F4B183 · FFD966 · B0D597 · 8FC36B · BFBFBF
#
# `.preset_acrd_clave()` normaliza las cinco sin problema y las cuatro de escala
# se reconocen. **El preset NO es el culpable.**
#
# Y la misma corrida destapa algo mas util: **esos hexes no son los del mazo**.
# El XML dibuja `FFD965` y `ADD493`, que no estan ni en `.PRESET_ACRD_RAMPA`
# (`FFD966`/`B0D597`) ni en el default de `reporte_plan_ppt.R:1821`
# (`FFD966`/`B7D7A8`). O sea que **los colores del mazo NO coinciden con ninguna
# constante declarada del motor**: algo los transforma antes de escribirlos.
#
# TRAZADO, Y EL GRAFICADOR ES INOCENTE. Instrumentado `colores_efectivos` en
# `graficador_barras_apiladas.R` para volcar por render `niveles_leyenda`, el
# `colores_grupos` de ENTRADA y el vector resuelto. Sobre los **232 renders**
# del mazo:
#
#   entrada == salida en los 232        `.graficos_mk_palette()` es paso directo
#   150 renders  #F4B183 #FFD965 #ADD493 #70AD47 #BFBFBF   (la correcta)
#    15 renders  #BFBFBF #70AD47 #ADD493 #FFD965 #BFBFBF   (la rota)
#    54 renders  #081F5C #9DC3E6                            (dicotomicas)
#
# En los 15 rotos `niveles_leyenda` llega en orden CANONICO —«Totalmente en
# desacuerdo | En desacuerdo | De acuerdo | Totalmente de acuerdo | SIN INF»— y
# aun asi el color sale mal, porque **`colores_grupos` YA LLEGA ROTO**: la
# entrada es identica a la salida. El defecto esta AGUAS ARRIBA de
# `graficar_barras_apiladas()`, en quien construye ese vector.
#
# La rota es la canonica con **los cuatro de escala INVERTIDOS y el gris
# anadido al final**: `rev(F4B183, FFD965, ADD493, 70AD47)` + `BFBFBF`. Por eso
# el naranja se cae —queda fuera de los cuatro primeros— y el gris entra al
# frente. 15 renders = las 2 laminas PPT mas sus gemelas de Word.
#
# Y OJO CON EL CALLEJON DE ANTES: la paleta correcta `#F4B183 #FFD965 #ADD493
# #70AD47 #BFBFBF` coincide EXACTAMENTE con los hexes del XML, asi que si existe
# —se construye en tiempo de ejecucion, no esta escrita como constante—. Que un
# `grep` no la encuentre no significaba que no existiera.
#
# ACOTADO UN PASO MAS. `colores_grupos` se asigna en `reporte_plan_ppt.R` desde
# tres sitios —4428/4954/5133 con `.paleta_auto()`, y 4451/5006/5169 con
# `.reporte_plan_palette_for_levels()`—, y ninguno la INVENTA:
#
# - `.reporte_plan_palette_for_levels()` (`reporte_plan_opciones.R:317`) mapea
#   por NOMBRE contra un `palette` recibido, con respaldo POSICIONAL para los
#   que no casan. No puede producir `BFBFBF` dos veces salvo que el `palette`
#   que recibe ya lo traiga repetido.
# - `.reporte_plan_pulso_palette_for_levels()` (misma, 388) usa OTROS hexes
#   —`CA5651`, `E4A34C`, `85BB85`, `4F8A3E`—, que no son los del mazo.
# - `.paleta_auto()` (`reporte_plan_ppt.R:3384`) **no construye**: busca un
#   objeto llamado `paleta_<list_name>` en `env_diapos` y exige que venga CON
#   NOMBRES (`if (is.null(names(pal))) return(NULL)`).
#
# Y LA PALETA ROTA NO ESTA GUARDADA EN EL `.pulso`: recorrido entero
# `graficos_config`, el UNICO vector hex que existe es
# `F4B183 FFD965 ADD493 70AD47` en `plan$slides$5$payload$estilo$
# first_col_fill_by_row`, sin nombres y en orden CANONICO. (El buscador se
# verifico aflojando el filtro: encuentra ese y sólo ese, asi que el cero no es
# del filtro.)
#
# CONCLUSION: la paleta rota es un objeto `paleta_<algo>` **nombrado**, vivo en
# el entorno de generacion del mazo. Si sus nombres estan emparejados con los
# colores equivocados, el mapeo por etiqueta la propaga tal cual y nadie miente:
# cada pieza hace su trabajo sobre una entrada ya mal formada.
#
# ENCONTRADO, SIN TRAZAR. Las paletas SI estan en el `.pulso`: en
# `graficos_config$paletas`, **34 paletas** nombradas `lst_pNN`, cada una una
# LISTA de pares etiqueta→color. La busqueda anterior no las vio porque sólo
# inspeccionaba vectores `character`, y son listas: **el «cero» de antes era del
# filtro, otra vez** —y esta vez el aflojado del patron no bastó, porque lo que
# fallaba era el TIPO, no el patron—.
#
# LA CULPABLE ES `lst_p14`, guardada AL REVES y con otra capitalizacion:
#
#   SIN INF                   #BFBFBF
#   Totalmente de Acuerdo     #70AD47
#   De Acuerdo                #ADD493
#   En Desacuerdo             #FFD965
#   Totalmente en Desacuerdo  #F4B183
#
# El mecanismo encaja exacto con lo medido. `.reporte_plan_palette_for_levels()`
# casa primero por NOMBRE: «SIN INF» es identico y se lleva su `BFBFBF`. Los
# otros cuatro NO casan —los datos dicen «De acuerdo» y la paleta «De Acuerdo»,
# con A mayuscula— y caen al respaldo POSICIONAL, que toma los primeros de `pal`
# **en su orden guardado**: `BFBFBF 70AD47 ADD493 FFD965`. El naranja queda
# quinto y nunca se usa. Resultado `BFBFBF · 70AD47 · ADD493 · FFD965 · BFBFBF`,
# que es exactamente el vector que la traza vio llegar a los 15 renders.
#
# NO ES LA UNICA GUARDADA RARA, y conviene mirarlas al reparar: `lst_p20` esta
# tambien invertida (Muy satisfecho primero), `lst_p16` tiene «De acuerdo» y
# «Totalmente de acuerdo» cambiados de sitio, y `lst_p10` pinta «Totalmente en
# Desacuerdo» con `#9DC3E6`, el celeste de las dicotomias.
#
# REPARADO Y MEDIDO (`66c3a72d`). El emparejado por nombre de
# `.reporte_plan_palette_for_levels()` ahora prueba el nombre EXACTO y, solo si
# no casa, el normalizado sin acentos ni mayusculas con
# `.reporte_plan_ascii_lower()` —que ya vivia en ese archivo sin usarse ahi—.
# Medido sobre `p54.pptx`, regenerado con el arreglo:
#
#   fuera de canon   2 -> **0**   (motor 35 de 35; aprobado 31 de 31)
#   leyenda de la 28 F4B183 · FFD965 · ADD493 · 70AD47 · BFBFBF, **cinco
#                    colores distintos**, en orden y con el naranja de vuelta
#   vara            25 -> **25**, distribucion IDENTICA
#   cortes           2, los mismos (el par entrelazado de la 59)
#   solapes          1, el mismo (la 59)
#
# O sea que arregla lo suyo y no mueve nada mas. **P51 CERRADO.**
#
# Y LA SALVEDAD QUE SE LEVANTO NO SE SOSTIENE, tambien medida: se dijo que
# `lst_p10` —que pinta «Totalmente en Desacuerdo» con `#9DC3E6`, el celeste de
# las dicotomias— quedaba sin cubrir. Buscadas todas las laminas cuya leyenda es
# de ESCALA y llevan azul de dicotomia en sus cuadros: **CERO**, ni en `p54` ni
# en `p52`. El buscador se verifico aflojando el filtro y encuentra **42**
# laminas de escala, asi que el cero es real. Ese par mal guardado **no llega al
# mazo**: es un riesgo latente del dato, no un defecto del entregable. Quedan
# igual anotadas `lst_p20` (invertida) y `lst_p16` (dos niveles cambiados de
# sitio), que el arreglo si neutraliza porque su fallo era de capitalizacion.
#
# El barrido VISUAL de P41 habia dado la 30 por limpia. Una inversion de rampa
# no salta en una hoja de contacto: se ve bien, solo esta al reves.
#
# P52, DESCARTADO POR MEDICION. Se sospecho que los radares de las laminas 50 y
# 51 dibujaban el poligono ENCOGIDO cerca del centro pese a que su tabla dice
# 92-100 %. Medidos los radios de sus poligonos en el XML de `p54.pptx`,
# normalizados contra el anillo mayor:
#
#   lamina 50   rejilla 1.000 · 0.800 · 0.600 · 0.400 · 0.200 · 0.000
#               series  0.962 · 0.952 · 0.946
#   lamina 51   rejilla 1.000 · 0.800 · 0.600 · 0.400 · 0.200 · 0.000
#               series  0.975 · 0.962 · 0.955
#
# Las tres series estan CASI PEGADAS al anillo exterior, que es justo lo que
# corresponde a un 92-100 % sobre un eje 0-100 con anillos cada 20. **El radar
# esta bien.** Lo que se leyo como «un hexagono pequeno en el centro» era el
# anillo INTERIOR de la rejilla (r/R 0.200) visto a 55 dpi, mientras las series
# casi coinciden con el borde y se confunden con el.
#
# Queda anotado un detalle inofensivo: cada radar trae **un poligono
# DEGENERADO** —todos sus puntos en (0,0) y `ext` 0x0—, que es el anillo de la
# rejilla en el valor 0. No pinta nada y no es un defecto; sirve para no volver
# a asustarse al verlo. Y el APROBADO no puede arbitrar esto: sus laminas de
# radar no traen NINGUNA forma de >=4 puntos, o sea que dibuja sus radares de
# otra manera.
#
# LECCION: una hoja de contacto a 55 dpi basta para SOSPECHAR, no para AFIRMAR.

# P53, MEDIDO Y ABIERTO: **el motor rotula segmentos con «0%» y el aprobado no
# rotula ninguno**. Medido sobre `p54.pptx` contra el entregable aprobado,
# contando el texto literal de las etiquetas de dato en el XML de cada lamina:
#
#   motor      8 etiquetas «0%» sobre 1.098 etiquetas de porcentaje
#              laminas 26, 27, 40, 45, 61, 65 y 68
#   aprobado   0 etiquetas «0%» sobre 1.019
#
# El cero del aprobado NO es un filtro mal puesto —el mismo medidor encuentra
# sus 1.019 etiquetas— y tampoco es «ahi no hay ceros en el dato»: puesta la
# MISMA pregunta lado a lado, el aprobado tiene el mismo cero y lo calla.
#
#   motor    lamina 65   0% · 2% · 37% · 52% · 10%
#   aprobado lamina 57         2% · 36% · 52% · 10%
#
# (La diferencia 37 contra 36 es el redondeo ya conocido, no es esto.)
#
# La GEOMETRIA esta bien: el segmento sale con `cx` exactamente 0 EMU, o sea
# que no se dibuja. Lo que sobra es solo el rotulo, que ademas queda flotando
# sobre el segmento vecino. Y contradice lo que este mismo motor ya declara mas
# arriba en `graficador_barras_apiladas.R`: «un segmento que se rotularia 0 %
# NO se dibuja (decision de Gonzalo, 2026-08-14)».
#
# DE DONDE NO SALE, medido, para no volver a mirarlo:
#
#   - NO es `mostrar_categorias_en_cero`, que es el escape declarado para verlos
#     con su frecuencia al lado: su default es FALSE y NADIE lo enciende (cero
#     consumidores fuera de `graficos_metadata.R`).
#   - NO son las dos ramas de etiquetado del graficador de apiladas: las dos
#     guardan contra el valor cero —`.mostrar = .valor_plot > umbral` en la
#     uniforme y `.valor_plot <= umbral ~ "ninguna"` mas su `filter()` en la
#     otra— y con umbral 0 por defecto ninguna dejaria pasar un cero.
#   - NO es el CIERRE EXACTO A 1 volcando su residuo sobre el nivel aplanado,
#     que era la hipotesis mas prometedora porque `tail(niveles_stack, 1)` es
#     justo «Totalmente en desacuerdo», el segmento izquierdo que aparece
#     rotulado. Reproducida en frio la cadena aplanar -> recomprimir -> cerrar
#     con los conteos REALES de esa fila (0/1/19/27/5 sobre 52, reconstruidos
#     desde los anchos medidos y exactos a cuatro decimales), el `delta` sale
#     **0,000e+00**; y en un barrido de 400 repartos con cero en el nivel
#     objetivo solo **2** lo resucitan (0,5 %). Explica un camino raro, no este.
#
# P53 CERRADO. Instrumentada la fuente con `PULSO_TRAZA_CERO` en los dos
# `geom_text` del graficador de apiladas y en el punto donde nace `lab`, sobre
# los 232 renders del mazo: **22 renders con fuga y 24 etiquetas**, TODAS con
# exactamente `.valor_plot = 1,11022e-16`, `.pct_units = 0` y
# `.valor_pct_real = 0`. La rama uniforme (`SITIO=A`) no corre nunca en este
# mazo; las 232 pasan por la otra.
#
# O sea que **el descarte anterior estaba MAL**: el residuo del CIERRE EXACTO A
# 1 si era la fuente. Se descarto por medir una sola fila —la de la lamina 65,
# donde el `delta` daba 0,000e+00— y generalizar de ahi. El caso que fuga no es
# ese; el residuo aparece en los repartos que no cierran limpio, y basta
# 1,11e-16 para cruzar la guarda `.valor_plot > 0`.
#
# REPARADO en `graficador_umbral_etiquetas.R` con
# `.barras_reaplanar_cifras_cero()`, llamada JUSTO DESPUES del cierre: reafirma
# la invariante donde se rompia, sin tocar ni el cierre ni las guardas. El
# faltante que deja es del orden del residuo que el cierre venia a tapar.
# Test `test-cifra-cero-no-se-rotula.R`, **12 asserts, 8 rojos sin el arreglo**.
#
# MEDIDO tras reparar (`p55.pptx` contra `p54.pptx`): etiquetas «0%» **8 -> 0**
# y el universo de porcentajes **1.098 -> 1.090**, o sea que se fueron las ocho
# y nada mas. Vara **25 -> 25** con distribucion identica y las mismas seis
# laminas B3. Aprobado sigue en 0 de 1.019.
#
# LECCION: una hipotesis no se descarta con UN caso. La del residuo encajaba,
# se probo sobre la fila mas a mano, dio cero y se archivo como falsa; el
# barrido de 400 repartos que la acompano tampoco valia, porque reproducia el
# redondeo con `round()` y no con el metodo real del motor. Descartar exige la
# misma exigencia de muestra que confirmar.
# Aqui la sospecha costo una medicion y salio falsa.
#
# Colores de la rampa de escala (dos paletas: la del entregable y la del motor).
.VERIF_RAMPA <- c("F4B183", "FFD965", "FFD966", "ADD493", "B0D597",
                  "70AD47", "8FC36B", "CA5651")

# Azul institucional: barras categoricas.
.VERIF_AZUL <- c("081F5C")

# Todo se expresa en CENTIMETROS. El OOXML mide en EMU y `officer` en pulgadas,
# pero un informe que dice «0.303 in» obliga a convertir para compararlo con una
# regla o con la guia del canvas, que ya acota en cm. La conversion se hace una
# vez, al construir los umbrales.
.VERIF_CM_POR_IN <- 2.54

# Umbrales DERIVADOS del entregable que el cliente aprobo, no elegidos a ojo.
#
# Salen de `calibrar_umbrales()` sobre `Informe Contabilidad 14-08.pptx`, con el
# percentil 10 para los pisos y el 90 para los techos. Los anteriores —0.32 in,
# 9 barras, 11 pt— se habian fijado contra un ideal, y el resultado es que el
# propio entregable aprobado los incumplia mas del doble que el motor. Un piso
# que la referencia no cumple no mide conformidad: mide distancia a una idea.
#
# Al calibrar, DOS de los cuatro salieron mas exigentes que el ideal, no menos:
# el aprobado no baja de 12 pt en la decima parte peor de su texto, ni de 0.256
# in en sus barras categoricas. El ideal era laxo justo donde el entregable es
# cuidadoso.
#
# Se usa el percentil y no el extremo a proposito: el peor caso de un mazo de
# sesenta laminas es un accidente, y calibrar contra el deja pasar cualquier
# cosa. La vara es parecerse al entregable TIPICO, no a su peor lamina.
.VERIF_UMBRALES <- list(
  grosor_escala_cm     = 0.77,
  grosor_categorica_cm = 0.65,
  barras_por_grafico   = 7L,
  # LA VARA MEDIA UNA PALETA Y EL MAZO TIENE DOS. `barras_por_grafico` sale de
  # `barras_escala`, que solo cuenta la rampa; el techo se aplicaba luego a las
  # dos. Medido sobre el aprobado con el mismo filtro que usa la regla: sus
  # graficos AZULES llegan a 8 barras por grafico y a 1.80 cm de grosor, y nada
  # de eso lo miraba nadie.
  #
  # Los dos son TECHOS y van al MAXIMO del aprobado, no a su p90 —igual que
  # `barras_por_grafico`, que tambien sale de un `max()`—. Medido: con el p90
  # el techo de grosor marcaba 3 de los 25 graficos del PROPIO aprobado, y un
  # techo que la referencia no cumple no mide conformidad. El maximo se redondea
  # hacia ARRIBA para que su propio extremo no caiga fuera por el decimal.
  barras_por_grafico_categorico = 8L,
  # 1.81 y no 1.80: el valor exacto es 1.8049 y a dos decimales hacia abajo el
  # PROPIO aprobado incumplia su techo por cinco milesimas. Un techo que la
  # referencia no cumple no mide conformidad.
  grosor_categorico_max_cm      = 1.81,
  texto_minimo_pt      = 12,
  # El aprobado no tiene NI UNO en la rampa de escala: sus 67 rojos son todos
  # titulos. El umbral es cero porque el modelo esta en cero.
  rojo_en_rampa_max    = 0L,
  # Percentil 10 del borde superior del titulo en el aprobado. La mediana es
  # 0.90 cm; se toma el p10 para no marcar por una lamina que empieza mas arriba.
  titulo_top_min_cm    = 0.78,
  # Proporcion de texto por debajo del minimo que el aprobado se permite.
  texto_prop_max       = 0.062,
  # Tolerancia de dispersion de grosor DENTRO de una lamina. 0.05 cm es medio
  # milimetro: por debajo es redondeo del render, por encima se ve.
  grosor_dispersion_max_cm = 0.05,
  # Cifras blancas sobre un tramo claro de la rampa. El aprobado tiene CERO.
  texto_ilegible_max   = 0L,
  # Percentil 10 del aprobado. Su mediana es 4.24 cm; el motor nunca arranca
  # tan arriba como el peor caso del modelo.
  arranque_min_cm      = 3.53,
  # Hueco ENTRE premisas. El aprobado separa 1.76 cm de mediana y el motor
  # 0.97: es lo que hay detras de «se ve muy apretado».
  hueco_premisas_min_cm = 1.40,
  # Dispersion de grosor ENTRE laminas gemelas —mismo numero de barras—. Es el
  # eje de «dos laminas del mismo tipo no salen iguales», y ninguna regla lo
  # media: B3 mira DENTRO de una lamina y no ve que la de al lado saque otro
  # grosor. Medido: el motor dispersa 0.01 cm entre gemelas y el aprobado 0.17,
  # asi que aqui el motor es el mejor de los dos y el umbral se pone donde
  # protege lo ganado, no donde el modelo llega.
  grosor_gemelas_max_cm = 0.10
)

.VERIF_EMU <- 914400


#' Lee las laminas de un .pptx como texto XML
#' @keywords internal
.verif_laminas_xml <- function(path) {
  if (!file.exists(path)) {
    stop_api(400L, "E_ARCHIVO_NO_EXISTE", detalle = "No se encuentra el .pptx a verificar.")
  }
  nombres <- utils::unzip(path, list = TRUE)$Name
  nombres <- grep("^ppt/slides/slide[0-9]+\\.xml$", nombres, value = TRUE)
  if (!length(nombres)) return(list())
  orden <- order(as.integer(sub("\\D*(\\d+)\\.xml$", "\\1", nombres)))
  nombres <- nombres[orden]

  destino <- tempfile("verif_mazo_")
  dir.create(destino, showWarnings = FALSE, recursive = TRUE)
  on.exit(unlink(destino, recursive = TRUE), add = TRUE)
  utils::unzip(path, files = nombres, exdir = destino)

  lapply(nombres, function(n) {
    con <- file(file.path(destino, n), encoding = "UTF-8")
    on.exit(close(con), add = TRUE)
    paste(readLines(con, warn = FALSE), collapse = "")
  })
}


#' Formas con geometria y relleno de una lamina
#' @keywords internal
.verif_formas <- function(xml) {
  sps <- regmatches(xml, gregexpr("<p:sp>.*?</p:sp>", xml))[[1]]
  if (!length(sps)) return(list())

  out <- list()
  for (sp in sps) {
    m <- regmatches(sp, regexpr(
      '<a:off x="(-?\\d+)" y="(-?\\d+)"/>\\s*<a:ext cx="(\\d+)" cy="(\\d+)"', sp))
    if (!length(m)) next
    nums <- as.numeric(regmatches(m, gregexpr("-?\\d+", m))[[1]])
    if (length(nums) < 4L) next

    fill <- regmatches(sp, regexpr('<a:solidFill>\\s*<a:srgbClr val="[0-9A-Fa-f]{6}"', sp))
    if (!length(fill)) next
    col <- toupper(sub('.*val="', "", sub('"$', "", fill)))
    col <- substr(gsub('[^0-9A-Fa-f]', "", col), 1, 6)

    textos <- regmatches(sp, gregexpr("<a:t>[^<]*</a:t>", sp))[[1]]
    texto <- trimws(paste(gsub("</?a:t>", "", textos), collapse = ""))

    out[[length(out) + 1L]] <- list(
      x = nums[[1]] / .VERIF_EMU, y = nums[[2]] / .VERIF_EMU,
      w = nums[[3]] / .VERIF_EMU, h = nums[[4]] / .VERIF_EMU,
      col = col, texto = texto
    )
  }
  out
}


#' Segmentos de barra de una familia
#'
#' `exigir_sin_texto` va activo para TODAS las familias, no solo la categorica:
#' una barra de datos no lleva texto propio —su cifra es una capa aparte—, y las
#' cajas que si lo llevan son la columna Top Two Box, con relleno de la rampa y
#' alto fijo de 0.159 in. Sin este filtro la mediana del grosor del entregable
#' aprobado salia 0.159 exacta: no era el grosor de sus barras, era el de una
#' caja de texto contada sesenta veces.
#'
#' @keywords internal
.verif_segmentos <- function(formas, colores, exigir_sin_texto = TRUE) {
  Filter(function(f) {
    f$col %in% colores &&
      f$h > 0 && f$w > f$h &&                       # horizontal
      !(f$w < 0.25 && f$h < 0.25) &&                # no es cuadradito de leyenda
      (!exigir_sin_texto || !nzchar(f$texto))       # no es caja de etiqueta
  }, formas)
}


#' Agrupa segmentos en barras (misma fila) y barras en graficos (misma columna)
#'
#' @param tol_hueco Separacion en pulgadas a partir de la cual dos segmentos de
#'   la misma fila pertenecen a graficos distintos.
#'
#' @return Lista de graficos; cada uno con `n` barras y su `grosor` (la moda).
#' @keywords internal
.verif_graficos <- function(segs, tol_fila = 0.02, tol_col = 1.0,
                            tol_hueco = 0.30) {
  if (!length(segs)) return(list())

  # Barra = segmentos CONTIGUOS de una misma fila. Compartir fila no basta: dos
  # graficos lado a lado tienen barras a la misma altura, y unirlos por la `y`
  # los funde en una barra imposible que arranca en el grafico izquierdo y
  # termina en el derecho. Se parte donde hay hueco.
  clave <- vapply(segs, function(s) round(s$y / tol_fila), numeric(1))
  barras <- list()
  for (fila in split(segs, clave)) {
    ord <- order(vapply(fila, function(s) s$x, numeric(1)))
    fila <- fila[ord]
    ini <- fila[[1]]
    fin_x <- ini$x + ini$w
    for (k in seq_along(fila)[-1]) {
      s <- fila[[k]]
      if (s$x - fin_x > tol_hueco) {
        barras[[length(barras) + 1L]] <- list(x = ini$x, h = ini$h)
        ini <- s
      }
      fin_x <- max(fin_x, s$x + s$w)
    }
    barras[[length(barras) + 1L]] <- list(x = ini$x, h = ini$h)
  }
  if (!length(barras)) return(list())

  # Grafico = barras que arrancan en la misma columna. Ninguna barra cruza de un
  # grafico al de al lado, asi que el eje las separa sin ambiguedad.
  ejes <- sort(unique(round(vapply(barras, function(b) b$x, numeric(1)), 1)))
  grupos <- list()
  actual <- ejes[[1]]
  for (e in ejes[-1]) {
    if (e - actual[[length(actual)]] < tol_col) {
      actual <- c(actual, e)
    } else {
      grupos[[length(grupos) + 1L]] <- actual
      actual <- e
    }
  }
  grupos[[length(grupos) + 1L]] <- actual

  out <- list()
  for (g in grupos) {
    propias <- Filter(function(b) b$x >= min(g) - 0.05 && b$x <= max(g) + 0.05, barras)
    # Con una sola barra no hay grosor comparable del que hablar.
    if (length(propias) < 2L) next
    alturas <- round(vapply(propias, function(b) b$h, numeric(1)), 3)
    tab <- table(alturas)
    out[[length(out) + 1L]] <- list(
      n = length(propias),
      grosor = as.numeric(names(tab)[which.max(tab)])
    )
  }
  out
}


#' Medidas crudas de un mazo, sin juzgarlas
#'
#' Separado de la verificacion porque son dos preguntas distintas: esta dice
#' cuanto mide el mazo, y `verificar_mazo()` dice si eso esta bien. Mezclarlas
#' fue lo que dejo los umbrales sin origen comprobable — cada uno se eligio a
#' ojo y ninguno salia de haber medido el entregable.
#'
#' @param path Ruta al `.pptx`.
#'
#' @return Lista con `grosor_escala`, `barras_escala`, `grosor_categorico` y
#'   `texto_pt`, cada uno un vector con una entrada por grafico o por texto. Los
#'   grosores van en CENTIMETROS; el texto, en puntos.
#' @export
medir_mazo <- function(path) {
  laminas <- .verif_laminas_xml(path)
  gr_esc <- numeric(0); n_esc <- integer(0)
  gr_cat <- numeric(0); n_cat <- integer(0); txt <- numeric(0)
  rojo <- 0L; tops <- numeric(0); ilegible <- 0L

  for (xml in laminas) {
    formas <- .verif_formas(xml)
    for (g in .verif_graficos(.verif_segmentos(formas, .VERIF_RAMPA))) {
      gr_esc <- c(gr_esc, g$grosor); n_esc <- c(n_esc, g$n)
    }
    for (g in .verif_graficos(.verif_segmentos(formas, .VERIF_AZUL, exigir_sin_texto = TRUE))) {
      gr_cat <- c(gr_cat, g$grosor); n_cat <- c(n_cat, g$n)
    }
    szs <- as.numeric(gsub('\\D', "", regmatches(xml, gregexpr('sz="\\d+"', xml))[[1]])) / 100
    txt <- c(txt, szs[is.finite(szs)])
    rojo <- rojo + .verif_rojo_en_rampa(xml)
    ilegible <- ilegible + .verif_texto_ilegible(.verif_formas(xml))
    tt <- .verif_titulo_top_cm(xml)
    if (!is.na(tt)) tops <- c(tops, tt)
  }

  list(grosor_escala = gr_esc * .VERIF_CM_POR_IN, barras_escala = n_esc,
       grosor_categorico = gr_cat * .VERIF_CM_POR_IN, barras_categorico = n_cat,
       texto_pt = txt,
       rojo_en_rampa = rojo, titulo_top_cm = tops, texto_ilegible = ilegible)
}


#' Deriva los umbrales de un mazo de referencia
#'
#' Los umbrales del recetario se habian fijado contra un ideal, y el entregable
#' que el cliente aprobo los incumple mas del doble que el motor: 46 de sus
#' graficos bajan de 0.32 in y 53 de sus textos de 11 pt. Un piso que la
#' referencia no cumple no mide conformidad, mide distancia a una idea.
#'
#' Se toma un percentil bajo y no el minimo: el minimo de un mazo de sesenta
#' laminas es un caso aislado, y calibrar contra el deja pasar cualquier cosa.
#'
#' CONSECUENCIA QUE HAY QUE TENER PRESENTE AL LEER LA CUENTA: si el piso es el
#' percentil 10 de la referencia, la referencia lo incumple ~10 % de las veces
#' POR CONSTRUCCION. R1, R5 y R8 son pisos —`>=`, barra demasiado FINA o
#' arranque demasiado ALTO—, no techos, y el aprobado los incumple diez veces
#' entre los tres. Que el motor empiece a incumplirlos no significa que haya
#' empeorado: significa que ya tiene cola donde antes no tenia ninguna.
#'
#' Medido tras P45, en tasa y no en cuenta (motor `p52` contra el aprobado):
#'
#'   grosor de escala      8.1 % bajo el piso  contra 10.3 %   (min 0.483 / 0.488)
#'   grosor categorico     4.0 %               contra  4.0 %   (mediana 0.826 / 0.876)
#'   arranque vertical     5.1 %               contra  9.3 %   (mediana 3.938 / 4.240)
#'
#' Antes de P45 el motor iba en 2.7 / 0.0 / 0.0 %: sin cola, con la mediana mas
#' gruesa que el aprobado. La cuenta subio de 21 a 25 —la del aprobado— porque
#' la distribucion se le acerco, no porque el mazo salga peor. Comparar TASAS y
#' no cuentas es lo unico que distingue esos dos casos.
#'
#' @param path Ruta al `.pptx` de referencia.
#' @param p Percentil inferior que se acepta como piso.
#'
#' @return Lista de umbrales con la forma de `.VERIF_UMBRALES`.
#' @export
calibrar_umbrales <- function(path, p = 0.10) {
  m <- medir_mazo(path)
  q <- function(x, prob) if (!length(x)) NA_real_ else unname(stats::quantile(x, prob, na.rm = TRUE))

  list(
    grosor_escala_cm     = round(q(m$grosor_escala, p), 2),
    grosor_categorica_cm = round(q(m$grosor_categorico, p), 2),
    # El techo usa el MAXIMO del aprobado, no su percentil alto, y ahi la
    # asimetria con los pisos es deliberada. Un piso calibrado al minimo lo
    # baja un solo accidente; un techo calibrado al percentil lo pone por
    # DEBAJO de lo que la referencia hace, y entonces el motor parte laminas
    # que el entregable no partia. Medido: con el percentil 90 (seis barras) el
    # mazo pasaba de 63 a 73 laminas.
    barras_por_grafico   = as.integer(max(m$barras_escala)),
    # Techos de la paleta AZUL, que hasta P36 no medía nadie. Al maximo del
    # aprobado y no a su p90: con el p90 el de grosor marcaba 3 de los 25
    # graficos del propio aprobado. El redondeo va hacia ARRIBA por la misma
    # razon —su extremo no puede quedar fuera por un decimal—.
    barras_por_grafico_categorico = as.integer(max(m$barras_categorico)),
    grosor_categorico_max_cm      = ceiling(max(m$grosor_categorico) * 100) / 100,
    texto_minimo_pt      = round(q(m$texto_pt, p), 1),
    texto_prop_max       = round(mean(m$texto_pt < q(m$texto_pt, p)), 3),
    rojo_en_rampa_max    = as.integer(m$rojo_en_rampa),
    texto_ilegible_max   = as.integer(m$texto_ilegible),
    titulo_top_min_cm    = if (length(m$titulo_top_cm)) round(q(m$titulo_top_cm, p), 2)
                           else .VERIF_UMBRALES$titulo_top_min_cm
  )
}


# EL CERO DE TRUNCADOS ES EL DE LOS CORTES MARCADOS, NO EL DE LOS CORTES.
# Medido en el render de `p52`, lamina 25 («ESTRUCTURA ORGANIZACIONAL DE
# GOBIERNO»): su segundo enunciado termina en «de D» y el `<a:t>` siguiente ya
# es del bloque de al lado —«Los docentes que ocupan puestos»—, o sea que la
# frase se corta a media palabra. Y en toda esa lamina no hay un solo `<a:t>`
# acabado en elipsis.
#
# El detector de truncados busca justamente eso, la elipsis, asi que da CERO
# mientras hay un corte en seco.
#
# Y CONTARLOS BIEN NO ES INMEDIATO, medido: comparar el render contra el texto
# del PLAN da 16 cortes concatenando toda la lamina y 2 agrupando por caja
# `<p:sp>`, y las dos cifras contradicen el render. La causa esta medida: la
# lamina 16 tiene **101 cajas** y la primera linea de su enunciado vive sola en
# la suya (`['¿Conoce los propositos']`), o sea que rvg emite UNA CAJA POR LINEA
# DIBUJADA. Para reconstruir un enunciado hay que agrupar por columna y
# adyacencia vertical, con la geometria que `.verif_formas()` ya devuelve.
#
# HECHO Y VALIDADO (`p49c.R`), con dos detalles que costaron un intento cada
# uno: se agrupa por el CENTRO de la linea (`x + w/2`) y no por su `x` —el
# enunciado va centrado, asi que cada linea arranca distinto—, y el grupo se
# corta cuando el salto vertical pasa de ~2.2 alturas de linea. Con `x` a secas
# daba «completos 0», que contradecia el render; con el centro, la lamina 16
# sale con sus dos enunciados completos, que es lo que se ve.
#
# LO QUE FALTA ES EL MAPEO: `plan$slides[[i]]` NO corresponde a `slide<i>.xml`
# en cuanto el motor PARTE una lamina. Medido: los enunciados que el plan pone
# en `plan$slides[[26]]` estan dibujados en la lamina 30 del mazo, +4, y los
# demas desfases caen en 29, 34, 37, 53 y 62 —todas posteriores a una
# particion—. Sin resolver eso, cualquier conteo mide en la lamina equivocada.
#
# EL INDICE SE ESQUIVA buscando cada enunciado en TODO el mazo (`p49d.R`), y
# asi el metodo cierra: 16 declarados, 16 completos, 0 cortados. PERO ESA CIFRA
# CUBRE MUY POCO: el plan entero tiene **18 bloques y solo 13 con
# `titulos_grupo`**, y el enunciado que la lamina 25 corta en «de D» no esta en
# ninguno. `titulos_grupo` solo existe cuando alguien lo escribio a mano; en el
# resto el graficador cae en `.title_of_var(v)` —la ETIQUETA DE LA VARIABLE en
# el instrumento—, que es la fuente contra la que hay que comparar para contar
# el mazo entero.
#
# CONTADO YA, con el universo sacado por TRAZA —`.title_of_var()` y
# `.named_lookup()` viven dentro del renderer y no se pueden llamar desde
# fuera—: **universo 99, completos 95, CORTADOS 4, ausentes 0**, contra los 16
# que salian del plan. Los cuatro, sin elipsis:
#
#   lamina 31   55 de  66    «Estoy satisfecho(a) con la calidad de enseñanza…»
#   lamina 43   40 de  52    «La infraestructura se adecua a las necesidades…»
#   lamina 59  155 de 175    «El Departamento de Ciencias Contables fomenta…»
#   lamina 59   20 de 133    «Los estudiantes reciben información sobre be…»
#
# El ultimo dibuja 20 caracteres de 133. ALCANCE: la traza cubrio UN sitio de
# resolucion de los cuatro (`ttl <-` en 4746, 4764, 5394 y 5552 de
# `reporte_plan_ppt.R`), asi que **4 es un piso, no el total** — el corte de la
# lamina 25 sale por otra rama y no esta en esa lista.
#
# CORREGIDO: trazados los CUATRO sitios, el universo es IDENTICO al de uno solo
# —99 enunciados, `diff` vacio—, asi que 4 no era un piso sino el total DE ESE
# METODO.
#
# Y LA LAMINA 25 NO ERA UN FALLO DEL CONTADOR. Se acuso al agrupamiento de unir
# lineas de textos distintos; medida la geometria cruda de esa lamina, los separa
# bien: sus tres enunciados viven en el mismo centro (cx 1.6965) con huecos de
# 0.589 y 0.481 entre ellos y de 0.252 como mucho dentro de uno, con `h` 0.14, de
# modo que el corte a 2.2 alturas cae justo en medio. El contador decia
# «completo» porque LO ESTA: el XML reproduce exactamente el texto que recibio.
#
# EL CORTE ES ANTERIOR AL MOTOR, y esta medido en el `.pulso` de Contabilidad:
#
#   xlsform_forms$…$survey$rows$44          287 chars / 291 bytes  «…Jefe de Departamento).»
#   codif_por_base$…$parent_label           287 chars              integro
#   equivalencias_publicos$filas$41$
#     etiqueta_estandar                     252 chars / 256 BYTES  «…Consejo de D»
#   graficos_config$plan$…$titulos_grupo    252 chars              heredado del anterior
#
# 256 bytes exactos es el tope de etiqueta de variable de SPSS: la etiqueta entro
# por el `.sav` y no por el instrumento, que la tiene entera y la contiene como
# prefijo. De 153 filas de equivalencias SOLO la 41 llega a 256 bytes y NINGUNA
# los pasa. No hay `substr` culpable en el motor: no lo busques otra vez.
#
# QUE HACE EL APROBADO CON ESE MISMO ENUNCIADO (su lamina 23, medido): no arrastra
# el truncado de SPSS. Corta en un limite SEMANTICO —«…de la gestion de las
# autoridades de la Unidad», soltando el parentesis entero—, pone un marcador «1»
# y declara al pie «Se redujo el texto debido a que era muy largo». Contra la
# vara, entonces, el defecto del motor es doble: hereda una etiqueta cortada por
# bytes en vez de la del instrumento, y cuando un texto no cabe lo recorta a
# mitad de palabra, sin elipsis y sin nota.
#
# LOS «CUATRO CORTES DE RENDER» TAMPOCO ERAN CORTES. Volcada la geometria cruda
# de sus laminas, el XML tiene los cuatro textos ENTEROS. Eran dos artefactos
# distintos del contador:
#
# - Laminas 31 y 43: su ULTIMA linea («carrera.», «carrera.») quedaba fuera del
#   grupo por 0.0034 in. El umbral salia de la `h` de la linea ANTERIOR, y una
#   linea corta sin ascendentes ni descendentes mide 0.0828 donde sus hermanas
#   miden 0.1112: el corte se desplomaba con ella (0.1112 x 2.2 = 0.2446 contra
#   un hueco de 0.248). Con la MEDIANA de la lamina como escala, ambas cierran.
# - Lamina 59: los dos enunciados salian ENTRELAZADOS en el bloque, y ninguno
#   cabia entero en ningun grupo.
#
# Recontado con la mediana: 99 enunciados, **97 completos, 0 cortes de render**.
# Los dos que quedan marcados son el par de la 59, y no son un corte:
#
# ES UN SOLAPE, Y SE VE. La lamina 59 dibuja «Los estudiantes reciben» en
# y 4.9134 y «redes colaborativas.» en y 4.9175 —**0.0041 in**, la misma columna
# y la misma altura—, o sea la primera linea del tercer enunciado impresa ENCIMA
# de la ultima del segundo. Comprobado en el PDF: las dos palabras se pisan y no
# se lee ninguna. Contra la vara: motor **1 solape**, aprobado **4**, y los
# cuatro del aprobado tienen `dy` EXACTAMENTE 0.0000 porque son titulos de
# paneles contiguos a la misma altura en laminas de cuatro cuadros —texto al
# lado de texto, no encima—. El unico solape de verdad en los dos mazos es el del
# motor.
#
# AL MEDIR SOLAPE, exige el MISMO bucket de columna, no «cx parecido»: comparar
# cajas a los dos lados del borde del redondeo daba `dy` negativos y **208
# solapes falsos** en el aprobado.
#
# Lo que P46 cerro sigue cerrado —los 22 cortes
# CON elipsis se fueron y no han vuelto—, pero un «cero truncados» sin cubrir
# los cortes silenciosos vale solo para la mitad marcada.

#' Verifica un mazo contra el recetario
#'
#' Las reglas que se comprueban son las medibles sobre el archivo. Las que no
#' —interlineado, arranque vertical del bloque— se declaran como no cubiertas en
#' vez de omitirse: un informe que calla lo que no mira se lee como si lo
#' hubiera aprobado.
#'
#' @param path Ruta al `.pptx`.
#' @param umbrales Lista de umbrales; por defecto los del recetario.
#'
#' @return Lista con `hallazgos` (data.frame), `resumen` y `no_cubierto`.
#' @export
verificar_mazo <- function(path, umbrales = .VERIF_UMBRALES) {
  u <- utils::modifyList(.VERIF_UMBRALES, umbrales %||% list())
  laminas <- .verif_laminas_xml(path)

  reglas <- character(0); lams <- integer(0)
  valores <- numeric(0); esperados <- character(0); detalles <- character(0)
  add <- function(regla, lam, valor, esperado, detalle) {
    reglas <<- c(reglas, regla); lams <<- c(lams, lam)
    valores <<- c(valores, valor); esperados <<- c(esperados, esperado)
    detalles <<- c(detalles, detalle)
  }

  n_graf_escala <- 0L; n_graf_cat <- 0L
  texto_todo <- numeric(0)
  gem <- list()

  for (i in seq_along(laminas)) {
    xml <- laminas[[i]]
    formas <- .verif_formas(xml)

    # R1 y R2: grosor y numero de barras en escala.
    gr_esc <- .verif_graficos(.verif_segmentos(formas, .VERIF_RAMPA))
    n_graf_escala <- n_graf_escala + length(gr_esc)
    for (g in gr_esc) {
      if (g$grosor * .VERIF_CM_POR_IN < u$grosor_escala_cm) {
        add("R1 grosor de escala", i, round(g$grosor * .VERIF_CM_POR_IN, 3),
            sprintf(">= %.2f cm", u$grosor_escala_cm),
            sprintf("%d barras", g$n))
      }
      if (g$n > u$barras_por_grafico) {
        add("R2 barras por grafico", i, g$n,
            sprintf("<= %d", u$barras_por_grafico),
            "la lamina deberia partirse")
      }
    }

    # R5: grosor en categoricas.
    gr_cat <- .verif_graficos(.verif_segmentos(formas, .VERIF_AZUL, exigir_sin_texto = TRUE))
    n_graf_cat <- n_graf_cat + length(gr_cat)
    for (g in gr_cat) {
      if (g$grosor * .VERIF_CM_POR_IN < u$grosor_categorica_cm) {
        add("R5 grosor categorico", i, round(g$grosor * .VERIF_CM_POR_IN, 3),
            sprintf(">= %.2f cm", u$grosor_categorica_cm),
            sprintf("%d barras", g$n))
      }
      # R10 y R11: los techos de la azul. R5 mira que la barra no sea DEMASIADO
      # FINA; nadie miraba que no fuera demasiado gruesa ni que cupieran
      # demasiadas, aunque el aprobado tiene su limite en las dos cosas.
      if (!is.null(u$grosor_categorico_max_cm) &&
          g$grosor * .VERIF_CM_POR_IN > u$grosor_categorico_max_cm) {
        add("R10 grosor categorico excesivo", i,
            round(g$grosor * .VERIF_CM_POR_IN, 3),
            sprintf("<= %.2f cm", u$grosor_categorico_max_cm),
            sprintf("%d barras estirandose en un hueco alto", g$n))
      }
      if (!is.null(u$barras_por_grafico_categorico) &&
          g$n > u$barras_por_grafico_categorico) {
        add("R11 barras por grafico categorico", i, g$n,
            sprintf("<= %d", u$barras_por_grafico_categorico),
            "la lamina deberia partirse")
      }
    }

      # R7: el titulo no puede pegarse al borde superior.
    tt <- .verif_titulo_top_cm(xml)
    if (!is.na(tt) && tt < u$titulo_top_min_cm) {
      add("R7 posicion del titulo", i, round(tt, 3),
          sprintf(">= %.2f cm", u$titulo_top_min_cm), "pegado al borde")
    }

    # R8: el bloque no puede empezar pegado al logo.
    ar <- .verif_arranque_cm(formas)
    if (!is.na(ar) && ar < u$arranque_min_cm) {
      add("R8 arranque vertical", i, round(ar, 3),
          sprintf(">= %.2f cm", u$arranque_min_cm), "primera barra muy arriba")
    }

    # B2: dos premisas seguidas necesitan mas aire que dos publicos.
    hp <- .verif_hueco_entre_premisas_cm(formas)
    if (!is.na(hp) && hp < u$hueco_premisas_min_cm) {
      add("B2 hueco entre premisas", i, round(hp, 3),
          sprintf(">= %.2f cm", u$hueco_premisas_min_cm), "se ve apretado")
    }

    # R9: una cifra blanca sobre un tramo claro no se lee.
    il <- .verif_texto_ilegible(formas)
    if (il > u$texto_ilegible_max) {
      add("R9 texto ilegible", i, il,
          sprintf("<= %d", u$texto_ilegible_max),
          "cifra blanca sobre tramo claro")
    }

    # B3: en una misma lamina, las barras miden todas lo mismo.
    dif <- .verif_grosores_desiguales(formas)
    if (dif > u$grosor_dispersion_max_cm) {
      add("B3 grosores desiguales", i, round(dif, 3),
          sprintf("<= %.2f cm", u$grosor_dispersion_max_cm),
          "dos bloques de la misma lamina con distinto grosor")
    }

    # B4 se acumula y se juzga al final: comparar una lamina con su gemela exige
    # tenerlas todas. Ver abajo.
    gem[[length(gem) + 1L]] <- .verif_grosores_de_lamina(formas, i)

    # B5 y B6: las laminas de VARIOS cuadrantes. Nadie miraba que dos
    # cuadrantes dibujaran lo mismo ni que uno declarara otro publico, y el
    # mazo de Conta entrego las dos cosas: la 9 repite su grafico de Sexo y la
    # 14 —«PERFIL DEL PERSONAL ADMINISTRATIVO»— tiene un cuadrante con «Base:
    # 52 docentes» donde sus tres vecinos dicen «Base: 15 administrativos».
    cuads <- .verif_cuadrantes(xml)
    for (r in .verif_cuadrantes_repetidos(cuads)) {
      add("B5 grafico repetido", i, r$textos, "cuadrantes distintos",
          sprintf("los cuadrantes %d y %d dibujan lo mismo: %s",
                  r$i, r$j, r$muestra))
    }
    for (r in .verif_cuadrantes_publico_cruzado(cuads)) {
      add("B6 publico cruzado", i, r$n, sprintf("todos de %s", r$mayoria),
          sprintf("%d cuadrante(s) con base de «%s» donde %d dicen «%s»",
                  r$n, r$publico, r$n_mayoria, r$mayoria))
    }
    # R4: el rojo institucional es color de TITULO, no extremo de escala.
    rr <- .verif_rojo_en_rampa(xml)
    if (rr > u$rojo_en_rampa_max) {
      add("R4 rojo en la rampa", i, rr,
          sprintf("<= %d", u$rojo_en_rampa_max),
          "el extremo negativo va naranja")
    }

    # R3 se acumula y se juzga al final: ver abajo.
    szs <- as.numeric(gsub('\\D', "", regmatches(xml, gregexpr('sz="\\d+"', xml))[[1]])) / 100
    texto_todo <- c(texto_todo, szs[is.finite(szs)])
  }

  # R3 es una regla de MAZO, no de lamina. Medida por lamina no discrimina: basta
  # un rotulo pequeno para marcarla, y con el umbral del aprobado quedaban
  # marcadas 53 de 63 laminas del PROPIO entregable aprobado. Lo que distingue un
  # mazo legible de otro no es que ninguna lamina tenga letra chica, sino cuanta
  # hay.
  if (length(texto_todo)) {
    prop <- mean(texto_todo < u$texto_minimo_pt)
    if (prop > u$texto_prop_max) {
      add("R3 proporcion de texto pequeno", NA_integer_, round(prop, 4),
          sprintf("<= %.1f %%", 100 * u$texto_prop_max),
          sprintf("%.1f %% por debajo de %g pt", 100 * prop, u$texto_minimo_pt))
    }
  }

  # B4 tambien es de MAZO: una lamina no puede saber si su gemela salio igual.
  gemelas <- .verif_gemelas_desiguales(gem)
  for (r in seq_len(nrow(gemelas))) {
    if (gemelas$dif[r] <= u$grosor_gemelas_max_cm) next
    add("B4 gemelas desiguales", NA_integer_, round(gemelas$dif[r], 3),
        sprintf("<= %.2f cm", u$grosor_gemelas_max_cm),
        sprintf("laminas de firma %s salen a distinto grosor: %s",
                gemelas$firma[r], gemelas$laminas[r]))
  }

  hallazgos <- data.frame(
    regla = reglas, lamina = lams, valor = valores,
    esperado = esperados, detalle = detalles,
    stringsAsFactors = FALSE
  )

  list(
    hallazgos = hallazgos,
    resumen = list(
      laminas = length(laminas),
      graficos_escala = n_graf_escala,
      graficos_categoricos = n_graf_cat,
      incumplimientos = nrow(hallazgos),
      por_regla = if (nrow(hallazgos)) as.list(table(hallazgos$regla)) else list()
    ),
    # Lo que este verificador NO mira. Se declara para que un informe limpio no
    # se confunda con un mazo conforme.
    no_cubierto = c(
      "R6 circulares",
      "R10 interlineado (medido: los tres mazos usan 100 %; no es la causa)",
      "R8 arranque vertical del bloque",
      "R9 color del texto: el resto del criterio, mas alla de la legibilidad"
    )
  )
}


#' Segmentos rojos que pertenecen a la rampa de escala
#'
#' El rojo institucional NO esta prohibido: es el color de los titulos, y el
#' entregable aprobado lo usa en 67. Lo que no puede es pintar el extremo
#' negativo de una escala. El criterio que los distingue sin ambiguedad —y que
#' ya se uso para corregir 26 colores en 23 listas sin tocar un solo titulo— es
#' la vecindad: es rampa cuando el color inmediatamente siguiente es el amarillo.
#'
#' @keywords internal
.verif_rojo_en_rampa <- function(xml) {
  cols <- toupper(gsub('.*val="', "", gsub('"$', "",
    regmatches(xml, gregexpr('srgbClr val="[0-9A-Fa-f]{6}"', xml))[[1]]))) 
  cols <- substr(gsub("[^0-9A-F]", "", cols), 1, 6)
  if (length(cols) < 2L) return(0L)
  rojos <- which(cols == "CA5651")
  rojos <- rojos[rojos < length(cols)]
  if (!length(rojos)) return(0L)
  sum(cols[rojos + 1L] %in% c("FFD965", "FFD966"))
}


#' Borde superior del titulo de lamina, en centimetros
#'
#' El titulo es el unico texto a 24 pt de la lamina, asi que se reconoce por su
#' cuerpo y no por su placeholder —que cambia de nombre entre plantillas—.
#'
#' @keywords internal
.verif_titulo_top_cm <- function(xml) {
  sps <- regmatches(xml, gregexpr("<p:sp>.*?</p:sp>", xml))[[1]]
  for (sp in sps) {
    if (!grepl('sz="2400"', sp, fixed = TRUE)) next
    m <- regmatches(sp, regexpr('<a:off x="(-?\\d+)" y="(-?\\d+)"/>', sp))
    if (!length(m)) next
    nums <- as.numeric(regmatches(m, gregexpr("-?\\d+", m))[[1]])
    if (length(nums) >= 2L) return(nums[[2]] / .VERIF_EMU * .VERIF_CM_POR_IN)
  }
  NA_real_
}


#' Grosores de barra distintos dentro de una misma lamina
#'
#' Una lamina que mezcla una escala con una dicotomica dibuja los dos bloques en
#' canvas separados y `plot_grid()` los escala con alturas relativas que incluyen
#' su cromo —titulo, leyenda, columna extra—, asi que el grosor final no coincide:
#' en «MECANISMOS DE ADMISION» las barras de escala salen a 1.19 cm y las de
#' Si/No a 0.90, sobre la misma lamina y sin que nadie lo pidiera.
#'
#' Se comparan solo barras de verdad —anchas y altas— para no contar los
#' marcadores de leyenda, que legitimamente son mas pequenos.
#'
#' @param formas Formas de la lamina, ya extraidas.
#' @return Diferencia en cm entre el grosor mayor y el menor; 0 si no hay dos.
#' @keywords internal
#' Grosor tipico de una lamina y cuantas barras tiene
#'
#' Reusa el mismo detector que B3 —el validado— porque un filtro por
#' dimensiones metia bandas de fondo y hasta la portada. Devuelve la MEDIANA y
#' no la media: una barra suelta de otro tamano no debe mover la firma de la
#' lamina, que es justo lo que B3 ya mide por su cuenta.
#'
#' @param formas Formas de la lamina, ya extraidas.
#' @param lamina Numero de lamina, para poder senalarla.
#' @return Lista con la `firma` de la lamina, su `grosor` mediano en cm y el
#'   numero de `lamina`; `NULL` si no hay barras que comparar.
#' @keywords internal
.verif_grosores_de_lamina <- function(formas, lamina) {
  rampa <- .verif_graficos(.verif_segmentos(formas, .VERIF_RAMPA, exigir_sin_texto = TRUE))
  azul  <- .verif_graficos(.verif_segmentos(formas, .VERIF_AZUL, exigir_sin_texto = TRUE))
  gr <- c(rampa, azul)
  if (!length(gr)) return(NULL)
  alt <- vapply(gr, function(g) g$grosor, numeric(1)) * .VERIF_CM_POR_IN
  ok <- is.finite(alt) & alt > 0
  if (!any(ok)) return(NULL)

  # La firma son los graficos de la lamina Y las barras de cada uno, no el
  # numero de graficos a secas: `.verif_graficos()` devuelve GRAFICOS, y contar
  # solo esos metia en el mismo grupo cualquier lamina de un grafico —la
  # mayoria del mazo, que no son gemelas de nada— y producia una dispersion de
  # 1.75 cm que no era de nadie.
  #
  # Y lleva la PALETA, porque cada familia declara su propio alto de fila —el
  # preset da 0.54 in a apiladas, 0.58 a multi-apiladas y 0.64 a agrupadas— y la
  # barra es una fraccion de ese alto: dos familias distintas tienen distinto
  # grosor POR DISENO. Sin la paleta, el grupo de «6 barras» juntaba cinco
  # multi-apiladas con un RADAR y marcaba como defecto esa diferencia. La paleta
  # no es la familia, pero es lo que el XML deja distinguir.
  paleta <- c(rep("rampa", length(rampa)), rep("azul", length(azul)))[ok]
  barras <- vapply(gr, function(g) g$n, integer(1))[ok]
  orden <- order(paleta, barras)
  list(
    lamina = lamina,
    firma = paste(paleta[orden], barras[orden], sep = ":", collapse = "-"),
    grosor = stats::median(alt[ok])
  )
}


#' Laminas gemelas que no salen iguales
#'
#' Dos laminas con la MISMA firma son gemelas: mismos graficos y mismas barras
#' en cada uno. Nada justifica entonces que una saque la barra a 0.36 cm y la
#' otra a 0.46. Es el eje de «dos laminas del mismo tipo no salen iguales», y B3
#' no lo ve porque mira dentro de una sola.
#'
#' La firma tiene que ser fina o el grupo deja de significar nada: agrupar por
#' «numero de filas» mezclaba una lamina de tres filas en un bloque con otra de
#' tres repartidas en cuatro, y contar solo GRAFICOS metia junta media baraja.
#' Las dos versiones producian una dispersion que no era de ninguna lamina.
#'
#' @param gem Lista de salidas de `.verif_grosores_de_lamina()`.
#' @return `data.frame` con una fila por grupo de gemelas que dispersa.
#' @keywords internal
# P16, MEDIDO POR LAMINA: LAS LAMINAS DE B4 SI SE PUEDEN NOMBRAR, Y HAY UN PAR
# MINIMO QUE NINGUNA ARITMETICA EXCUSA.
#
# El campo `lamina` de B4 va `NA_integer_` A PROPOSITO —B4 juzga un GRUPO, no
# una lamina— pero los numeros SI estan: viajan en el texto de `detalle`. Con
# eso el peor grupo del motor queda nombrado. Medido el grosor fisico lamina a
# lamina de `rampa:4` sobre `p55.pptx` (modo del alto de los rects de barra):
#
#   lamina 21   0.8503 in   8 segmentos al modo
#   lamina 23   0.8503      8
#   lamina 34   0.8659     12
#   lamina 40   0.7024     13
#   lamina 44   0.7024      8
#   lamina 60   0.5201     10
#   lamina 65   0.5976     11
#
# El rango 0.5201-0.8659 in son los 0.879 cm que reporta B4: el medidor de
# laminas y el de mazo coinciden, asi que se pueden usar juntos.
#
# LO QUE MATA UNA HIPOTESIS COMODA: se penso que la dispersion era aritmetica
# —mas filas en el mismo panel dan barras mas finas— y NO lo es. La 34 tiene
# DOCE segmentos y es la MAS GRUESA; la 44 tiene los mismos OCHO que la 21 y la
# 23 y sale mas fina. El numero de filas no ordena nada.
#
# EL PAR MINIMO, que es lo que faltaba para poder mirar algo: **21 y 23 a 0.8503
# contra 44 a 0.7024**, misma firma y mismo numero de segmentos, **0.1479 in de
# diferencia (0.376 cm)**. Ahi no hay excusa de composicion ni de conteo: es el
# caso mas pequeno de «dos laminas del mismo tipo no salen iguales» y es por
# donde hay que entrar.
#
# SALVEDAD, y va marcada como tal: la nota de abajo explica esta dispersion por
# el ALTO DE LA ETIQUETA DE EJE y describe el grupo como «un grafico de cuatro
# barras». La cuenta de segmentos de arriba no encaja con esa descripcion —8, 8,
# 12, 13, 8, 10, 11—, asi que la explicacion NO esta comprobada sobre el par
# minimo.
#
# MEDIDO: EL ALTO DE LA ETIQUETA NO EXPLICA EL PAR, NI EL GRUPO.
#
# Sacada la anatomia de las laminas de `rampa:4` en `p55.pptx` —banda de barras,
# cajas de texto a la izquierda del arranque y sus lineas—:
#
#   lamina   cajas de eje   max lineas por etiqueta   grosor
#      23          7                  1               0.8503
#      21         11                  1               0.8503
#      40         11                  1               0.7024
#      44         17                  2               0.7024
#      65         17                  1               0.5976
#      60         19                  2               0.5201
#
# Las tres candidatas caen:
#   - MAX LINEAS POR ETIQUETA no ordena: la 40 y la 65 tienen TODAS sus
#     etiquetas a UNA linea y salen finas; la 44 tiene una de dos y sale igual
#     que la 40.
#   - NUMERO DE CAJAS tampoco: la 21 y la 40 tienen las mismas ONCE y difieren
#     en 0.1479 in; la 44 y la 65 tienen las mismas DIECISIETE y difieren en
#     0.1048.
#   - NUMERO DE FILAS ya estaba descartado mas arriba.
#
# Y las tres del par minimo comparten banda: 1.600-7.370 in la 21 y la 23,
# 1.578-7.370 la 44. Mismo hueco, mismos ocho segmentos, distinto grosor.
#
# O sea que la explicacion por «alto de la etiqueta de eje» de la nota de abajo
# NO queda confirmada sobre el grupo. Tampoco refutada del todo —la 44 y la 60,
# las dos con etiqueta de dos lineas, si son de las finas—, pero no basta para
# ordenar siete laminas, y una explicacion que no ordena no es la causa.
#
# LO BARATO ESTA AGOTADO. Lo que queda es instrumentar: `PULSO_TRAZA_GROSOR` ya
# vuelca `alto_por_cat_grosor`, `alto_por_cat_eff`, `panel_fijado_in`,
# `canvas_h_panel_in` y `grosor_eff`; hay que anadirle el numero de lamina y
# leer las siete.
#
# LIMITE DEL MEDIDOR, anotado para no confundirlo con un dato: en la lamina 34
# no encuentra etiquetas de eje —su banda de barras arranca en x=3.959 y el
# filtro «texto a la izquierda del arranque» se queda vacio—, asi que esa
# lamina no entra en la tabla.
#
# LO QUE CUENTA B4 SON GRUPOS DE FIRMA, NO LAMINAS, y eso hace que dos mazos no
# se puedan comparar por su numero de hallazgos. Medido sobre Conta:
#
#              grupos   max     media   mediana
#   aprobado      5     1.013   0.597   0.485
#   motor         8     0.879   0.391   0.305
#
# El motor sale PEOR en la cuenta y MEJOR en las tres medidas de dispersion, que
# son las comparables.
#
# Y LA DISPERSION QUE QUEDA TIENE CAUSA LEGITIMA. Medido el peor grupo del motor
# —`rampa:4`, siete laminas de 1.32 a 2.20 cm—: las siete tienen EXACTAMENTE la
# misma geometria de lamina (placeholder en 1.21 con 5.51 de alto, pie en 6.93,
# titulo en 0.37) y exactamente un grafico de cuatro barras sin azul. Lo que
# cambia es el ALTO DE LA ETIQUETA DE EJE: las de 1.32 y 1.52 llevan cuatro
# premisas con enunciados de cuatro lineas, y el graficador les baja la fraccion
# para dejar aire entre barras. El aprobado hace lo mismo y con mas amplitud
# —su peor grupo dispersa 1.013—. La diferencia es de composicion: 70 laminas con mas
# variedad de firmas contra 63. Un mazo con mas tipos distintos de lamina recibe
# mas hallazgos a igualdad de calidad, asi que perseguir el 8 hasta el 5 seria
# perseguir un artefacto. Lo que si es real es la dispersion DENTRO de un grupo.
#
.verif_gemelas_desiguales <- function(gem) {
  gem <- Filter(Negate(is.null), gem)
  vacio <- data.frame(firma = character(0), dif = numeric(0),
                      laminas = character(0), stringsAsFactors = FALSE)
  if (length(gem) < 2L) return(vacio)

  fir <- vapply(gem, function(g) g$firma, character(1))
  gro <- vapply(gem, function(g) g$grosor, numeric(1))
  lam <- vapply(gem, function(g) g$lamina, integer(1))

  out <- vacio
  for (k in unique(fir)) {
    idx <- which(fir == k)
    if (length(idx) < 2L) next   # sin gemela no hay con que comparar
    out <- rbind(out, data.frame(
      firma = k, dif = max(gro[idx]) - min(gro[idx]),
      laminas = paste(lam[idx], collapse = ", "),
      stringsAsFactors = FALSE
    ))
  }
  out
}


.verif_grosores_desiguales <- function(formas) {
  # Se reusa el detector de barras ya validado en vez de filtrar por tamano:
  # con un filtro por dimensiones entraban bandas de fondo y hasta la portada,
  # y la regla disparaba en 61 laminas —y en 56 del entregable aprobado, que es
  # la senal de que media otra cosa—.
  #
  # ESTA CUENTA MEZCLA DOS COSAS DISTINTAS, y separarlas cambia el diagnostico.
  # Medido sobre `p45.pptx` contra el entregable aprobado, partiendo las laminas
  # con dos o mas graficos en dos grupos:
  #
  #   laminas con RAMPA y AZUL a la vez
  #     motor    7 laminas, 5 sobre umbral, max 0.424 cm, suma 0.841
  #     aprobado 10 laminas, 2 sobre umbral, max 0.150 cm, suma 0.201
  #
  #   laminas de una sola paleta
  #     motor    5 laminas, 3 sobre umbral, max 0.279 cm, suma 0.676
  #     aprobado 5 laminas, 4 sobre umbral, max 0.221 cm, suma 0.706
  #
  # O sea que en las laminas de una paleta el motor ya iguala o gana —tres
  # hallazgos contra cuatro, y menos suma—, y todo el desnivel esta en las
  # MIXTAS: un bloque de escala y un bloque de barras simples en la misma
  # lamina no se ponen de acuerdo en el grosor. El aprobado los mantiene a 1.5
  # mm de diferencia como mucho; el motor llega a 4.2 mm (lamina 41: rampa
  # 1.041 cm con dos barras contra azul 1.466 cm con tres).
  #
  # Por eso NO se persigue la lamina 9 —0.073 cm, 0.23 mm por encima de un
  # umbral de 0.05—: es del grupo donde el motor ya va mejor que la vara. Lo que
  # falta es que los dos graficos de una lamina mixta decidan su grosor juntos,
  # y eso no se arregla dentro de un graficador porque ninguno ve al otro.
  gr <- c(
    .verif_graficos(.verif_segmentos(formas, .VERIF_RAMPA, exigir_sin_texto = TRUE)),
    .verif_graficos(.verif_segmentos(formas, .VERIF_AZUL, exigir_sin_texto = TRUE))
  )
  if (length(gr) < 2L) return(0)
  alt <- round(vapply(gr, function(g) g$grosor, numeric(1)) * .VERIF_CM_POR_IN, 2)
  alt <- alt[is.finite(alt) & alt > 0]
  if (length(alt) < 2L) return(0)
  max(alt) - min(alt)
}


# Tramos claros de la rampa: sobre ellos una cifra blanca no se lee.
.VERIF_CLAROS <- c("F4B183", "FFD965", "FFD966", "EFD25E")


#' Cifras blancas que caen sobre un tramo claro
#'
#' El recetario dejo esto abierto por no poder medirlo: «el metodo por forma
#' devuelve el color de relleno de la propia caja, no el del segmento que hay
#' debajo». Se resuelve cruzando por POSICION —que segmento contiene el centro
#' de la caja de texto—, que es la unica forma de saber sobre que fondo cae.
#'
#' Importa porque es una regresion posible de la receta 4: al cambiar el extremo
#' negativo de rojo oscuro a naranja claro, las cifras blancas que se leian
#' sobre el rojo dejan de leerse sobre el naranja. El entregable aprobado tiene
#' cero.
#'
#' @param formas Salida de `.verif_formas()`.
#' @return Numero de cifras blancas sobre fondo claro.
#' @keywords internal
.verif_texto_ilegible <- function(formas) {
  if (!length(formas)) return(0L)
  segs <- Filter(function(f) f$col %in% .VERIF_CLAROS && !nzchar(f$texto), formas)
  if (!length(segs)) return(0L)
  blancos <- Filter(function(f) f$col == "FFFFFF" && nzchar(f$texto), formas)
  if (!length(blancos)) return(0L)

  sum(vapply(blancos, function(b) {
    cx <- b$x + b$w / 2
    cy <- b$y + b$h / 2
    any(vapply(segs, function(s) {
      cx >= s$x && cx <= s$x + s$w && cy >= s$y && cy <= s$y + s$h
    }, logical(1)))
  }, logical(1)))
}


#' Arranque vertical del bloque de datos, en centimetros
#'
#' Donde empieza la primera barra. El comentario que lo motiva —«los graficos
#' pueden estar un poquito mas abajo, la primera barra no tan cerca del logo»—
#' apuntaba al mazo criticado; el aprobado arranca a 4.24 cm de mediana.
#'
#' @keywords internal
.verif_arranque_cm <- function(formas) {
  segs <- .verif_segmentos(formas, .VERIF_RAMPA)
  if (!length(segs)) return(NA_real_)
  min(vapply(segs, function(s) s$y, numeric(1))) * .VERIF_CM_POR_IN
}


#' Hueco entre premisas de una lamina, en centimetros
#'
#' Hay DOS poblaciones de hueco y confundirlas no mide nada: el que separa dos
#' publicos de la misma premisa y el que separa dos premisas. Se distinguen por
#' el mayor salto de la serie ordenada, no por un estadistico que las promedie
#' —un coeficiente de variacion sobre la mezcla da falsos positivos, y ya costo
#' una iteracion entera perseguir un alto variable que no existia—.
#'
#' @return Mediana del hueco ENTRE premisas, o `NA_real_` si la lamina no tiene
#'   dos poblaciones distinguibles.
#' @keywords internal
.verif_hueco_entre_premisas_cm <- function(formas) {
  segs <- .verif_segmentos(formas, .VERIF_RAMPA)
  if (length(segs) < 4L) return(NA_real_)

  filas <- list()
  for (s in segs) filas[[as.character(round(s$y, 3))]] <- s$h
  ys <- sort(as.numeric(names(filas)))
  if (length(ys) < 4L) return(NA_real_)

  gaps <- numeric(0)
  for (i in seq_len(length(ys) - 1L)) {
    g <- ys[i + 1L] - (ys[i] + filas[[as.character(ys[i])]])
    if (is.finite(g) && g >= 0) gaps <- c(gaps, g)
  }
  if (length(gaps) < 3L) return(NA_real_)

  sg <- sort(gaps)
  saltos <- diff(sg)
  if (!length(saltos)) return(NA_real_)
  idx <- which.max(saltos)
  # Sin un salto claro, la lamina tiene una sola poblacion: no hay «entre
  # premisas» que medir y devolver la mediana de todo seria inventarlo.
  if (saltos[idx] <= stats::median(sg) * 0.5) return(NA_real_)

  stats::median(sg[(idx + 1L):length(sg)]) * .VERIF_CM_POR_IN
}


# P16 — LA ESCALA DE COLOCACION: HIPOTESIS RETRACTADA MAS ABAJO
#
# Instrumentada la fuente con `PULSO_TRAZA_GROSOR` sobre los 232 renders,
# volcando ademas el producto `grosor_eff * alto_por_cat_eff`, que es lo que el
# graficador cree que va a medir la barra. La idea era casar cada render con su
# lamina por ese numero, sin necesidad de un identificador.
#
# NO CASA NINGUNO. De los cinco grosores medidos en el XML de `rampa:4`
# —0.8503, 0.8659, 0.7024, 0.5976, 0.5201 in— **cero** aparecen en la traza con
# tolerancia 0.0006. Lo que la traza da:
#
#   rango    0.4290 - 1.1132
#   modas    0.4290 (x64) · 0.5225 (x56) · 0.8705 (x17) · 0.5078 (x16) ·
#            0.9140 (x12) · 0.5494, 0.6100 (x6)
#   lo mas cercano a 0.8503:  0.8427 · 0.8696 · 0.8705 · 0.8764
#
# Cerca pero nunca igual, y las razones rondan 0.98-1.06. O sea que **entre lo
# que el graficador calcula y lo que sale en EMU hay un factor de colocacion**:
# el canvas se coloca en su placeholder conservando la proporcion, asi que la
# barra fisica es `grosor_eff * alto_por_cat_eff * escala_de_colocacion`. La
# traza mide el lado del plot; el XML mide DESPUES de colocar.
#
# DOS CONSECUENCIAS:
#
#   1. El atajo de casar por grosor NO sirve. Para seguir P16 hace falta un
#      identificador de lamina de verdad en la traza —o medir la escala—.
#   2. **La escala de colocacion es una CUARTA candidata** para B4, y ninguna de
#      las tres caidas la cubria: dos laminas con el MISMO `grosor_eff` y el
#      MISMO alto de fila pueden salir a distinto grosor fisico si sus canvas se
#      colocan con distinta escala. Encaja con que el numero de filas, el numero
#      de cajas y el maximo de lineas no ordenen nada.
#
# LO SIGUIENTE, y es barato: medir la escala por lamina comparando el `ext` del
# `<p:graphicFrame>` (o del grupo que envuelve al canvas) contra el `ancho`/
# `alto` declarados al graficador. Si las siete de `rampa:4` traen escalas
# distintas, P16 deja de ser del graficador y pasa a ser de la COLOCACION.
#
# Confirmado de paso, y sin cambio respecto de la traza de P48:
# `panel_fijado_in` TRUE en 122 renders y FALSE en 110.
#
# LECCION: un correlador tambien es una hipotesis. «El grosor fisico identifica
# el render» parecia no necesitar comprobacion y fallo en los 232.


# P16 — LA ESCALA DE COLOCACION NO EXISTE. EL CULPABLE ES B46/G-21.
#
# Retractada la nota de arriba, y medida sobre las SIETE laminas de `rampa:4`
# —no sobre una—: en `p55.pptx` cada una trae **un solo grupo con `chExt`**, y
# en las siete `ext` es identico a `chExt`:
#
#   laminas 21, 23, 34, 40, 44, 60, 65   ->   12.5115 x 5.5118 in, escala
#                                             1.00000 en ancho y en alto
#
# O sea que el canvas se coloca **1:1** y no hay ningun factor de colocacion. La
# cuarta candidata cae con las otras tres.
#
# LO QUE SI EXPLICA EL DESFASE, y es de estructura, no de sospecha: **el punto
# de traza esta en la linea 3014 de `graficador_barras_apiladas.R` y el bloque
# **B46/G-21 empieza en la 3016**. B46 sube `h_panel_in` hasta un piso
# (`panel_floor_in`) y NO toca `grosor_eff` —lo dice su propio comentario,
# apoyado en el ADR 0065—. Como el grosor fisico es
# `grosor_eff * h_panel_in / n_filas_virtuales`, subir el panel DESPUES de la
# traza cambia la barra sin que la traza se entere. Por eso los valores salian
# **cerca pero nunca iguales**: 0.8503 contra 0.8427/0.8696 · 0.7024 contra
# 0.6987 · 0.5976 contra 0.5967 · 0.5201 contra 0.5225. Comprobado ademas que
# `alto_por_cat_eff` YA ES `h_panel_in / n_filas_virtuales` en ese punto:
# recalcular con el cociente da exactamente los mismos 232 valores.
#
# Y B46 **solo dispara con `n_categorias <= 2`**, que es justo donde vive el par
# minimo: la 21, la 23 y la 44 traen OCHO segmentos al modo, o sea dos filas de
# cuatro niveles. Las otras cuatro del grupo tienen 10-13 segmentos y no entran
# en B46.
#
# ESA ES LA QUINTA CANDIDATA Y LA PRIMERA QUE SEPARA EL PAR: `panel_floor_in`
# sale de `max(2.2 o 2.8, area_deseada + 2 * pad_est_in)`, y `pad_est_in` crece
# con `max_lineas_eje_y_est * size_ejes` cuando `needs_tall_label_slot`. O sea
# que el alto de la etiqueta SI entra —como decia la nota vieja— pero **por B46
# y solo en laminas de una o dos filas**, no por los estirados ni en general.
# Eso explica que no ordenara las siete: no aplica a cuatro de ellas.
#
# LO SIGUIENTE: mover el punto de traza DESPUES de B46 —tras la linea ~3054, ya
# calculados `pad_flex_h` y el `h_panel_in` definitivo— y volcar ademas
# `panel_floor_in`, `pad_est_in` y `needs_tall_label_slot`. Con eso el grosor
# trazado deberia casar con el del XML, y ahi se ve si la 44 recibe otro piso
# que la 21 y la 23.
#
# LECCION: cuando una medicion sale «cerca pero nunca igual», sospecha de un
# paso que corre DESPUES de donde mides. No es ruido: es un tramo del calculo
# que no estas viendo.


# P16 — B46 TAMPOCO. QUINTA CANDIDATA CAIDA, Y EL BLOQUEO ES OTRO.
#
# Movido el punto de traza DESPUES del bloque B46/G-21 —justo antes de
# `header_h <- h_header_in / h_total_in`— y volcados ademas `panel_floor_in`,
# `pad_est_in`, `needs_tall_label_slot`, `n_categorias`, `pad_flex_h` y
# `h_total_in`. Corrido sobre los 232 renders:
#
#   B46 DISPARA en **24 de 232** renders, y si mueve valores: el 0.8705 baja de
#   x17 a x13 y aparece un 1.0920 x6 que antes no estaba.
#
#   Y AUN ASI, **cero coincidencias** con los cinco grosores del XML, con los
#   MISMOS vecinos mas cercanos que antes de mover la traza:
#     0.8503 -> 0.8427 · 0.8696      0.8659 -> 0.8696
#     0.7024 -> 0.6987               0.5976 -> 0.5967
#     0.5201 -> 0.5225
#
# La quinta candidata cae con las otras cuatro. Y que los vecinos NO cambien al
# mover el punto de traza dice que el desfase **no lo produce B46**: es algo que
# pasa entre el ultimo calculo del graficador y el EMU, y que ni la escala de
# colocacion (medida 1:1 en las siete) ni el piso de B46 explican.
#
# EL BLOQUEO REAL, y hay que decirlo con su nombre: **no se puede casar una
# linea de traza con su lamina**. Sin eso, cada medicion sobre los 232 renders
# es una distribucion contra otra distribucion, y de ahi no sale una causa. Se
# han intentado dos atajos —el grosor fisico como clave, y mover el punto de
# medicion— y los dos han fallado. El siguiente intento tiene que empezar por
# **un contador global que el renderer incremente y que viaje a la traza**, no
# por otra hipotesis sobre el grosor.
#
# P16 QUEDA BLOQUEADO tras cinco candidatas medidas y caidas: numero de filas,
# maximo de lineas por etiqueta, numero de cajas de eje, escala de colocacion y
# piso de B46. Lo que SI queda establecido y sirve:
#   - las laminas de B4 se pueden nombrar (viven en `detalle`);
#   - el par minimo es 21 y 23 a 0.8503 contra 44 a 0.7024, misma firma y mismo
#     numero de segmentos, 0.376 cm;
#   - el motor tiene MAS grupos que el aprobado (8 contra 5) y MENOS dispersion
#     (max 0.879 contra 1.013), que es la comparacion que vale.
#
# LECCION: cuando dos intentos seguidos de medir fallan por la MISMA razon
# —aqui, no poder identificar el objeto—, el trabajo siguiente no es otra
# hipotesis: es arreglar el instrumento.


# P23 — LA RESERVA DE PIE: MEDIDA, Y EL PUNTO ESTABA MAL PLANTEADO.
#
# El tablero traia P23 como «la reserva ya reparada, queda LLENARLA». Medido el
# artefacto, esa forma de plantearlo no se sostiene: la banda esta pensada para
# quedar VACIA. Lo dice el propio motor en `.reservar_pie_para_base_slide()`
# (`reporte_plan_helpers.R:3073`): reserva **0.34 in** —**0.5** en multiapiladas
# multibase, `.PLAN_RESERVA_PIE_MULTI_IN`— «para que la leyenda no choque con el
# texto de Base», y solo cuando la lamina NO trae `nota_pie` propia, y nunca en
# Word. Llenarla seria deshacer el arreglo.
#
# LO QUE SI SE MIDE, sobre `p55.pptx` (55 laminas con canvas; 15 sin canvas):
#
#   banda de reserva (ultimos 0.34 in del canvas)
#     VACIA     en **41** laminas
#     OCUPADA   en **14** — 3, 9, 10, 11, 12, 13, 14, 16, 30, 38, 41, 50 y dos
#               mas; las de poblacion (9-14) meten entre 8 y 15 formas
#
#   distancia del texto de «Base:» al fondo del canvas
#     motor      min -0.1853 · mediana **0.2157** · max 0.2157   (54 laminas)
#     aprobado   min -0.3214 · mediana **0.1646** · max 3.7580   (51 laminas)
#     El motor cae DENTRO del canvas en 6 laminas —las de poblacion— y el
#     aprobado en 5 (7, 10, 40, 45, 50).
#
# DOS LECTURAS, y hay que separarlas antes de tocar nada:
#   1. Que la banda este OCUPADA en 14 laminas puede ser correcto: si esas
#      traen `nota_pie` propia, el helper no pide reserva y no hay nada que
#      respetar. **Sin medir cuales tienen `nota_pie`, esas 14 no son un
#      hallazgo.**
#   2. Lo que si es comparable contra la vara: el motor pone su Base **0.05 in
#      mas abajo** que el aprobado (0.2157 contra 0.1646 de mediana). Sumado a
#      los 0.34 de banda, el pie del motor se come ~0.56 in de los 5.512
#      utiles, un **10 %**, donde el aprobado se come ~0.50.
#
# LO SIGUIENTE, si se retoma: sacar del plan que laminas declaran `nota_pie` y
# cruzarlo con las 14 ocupadas. Si coinciden, P23 se cierra como «la reserva
# funciona» y lo unico vivo es esos 0.05 in de mas.
#
# LECCION: un punto del tablero puede estar mal ENUNCIADO, y medirlo es lo que
# lo destapa. «Queda llenarla» describia una intencion contraria a la del codigo
# que la creo.

# P23 — CERRADO: EL CRUCE QUE FALTABA, Y DOS DE LAS TRES OCUPACIONES ERAN
# ARTEFACTO DEL MEDIDOR.
#
# El cruce pendiente era «que laminas declaran `nota_pie`». Respuesta medida
# sobre el `.pulso` real (`unzip` + `readRDS(state.rds)`, sin `load_pulso()`):
# **NINGUNA**. En el plan de 66 laminas el unico campo `pie` con texto esta en
# la lamina 5, que es `p_slide_tabla_tecnica` —es el pie de la TABLA, no el
# caption de un grafico—. Y ni `presets`, ni `w_presets`, ni
# `overrides_reusables`, ni `scope_rules` traen texto de `nota_pie`: solo
# `size_nota_pie`, `color_nota_pie` y `canvas_h_caption_in`. El motor ademas
# pone `nota_pie = NULL` a proposito en los dos sitios de render principales
# (`reporte_plan_ppt.R:4502` y `:5959`, «reactivable via overrides$nota_pie»).
# TRAMPA: `presets$pie` es el preset del grafico de TARTA, no un pie de pagina.
#
# Con eso, las 14 «ocupadas» del tick anterior se reparten en tres cosas
# distintas —y solo la tercera es contenido en la banda:
#
#   1. FALSO POSITIVO (lamina 3). No es una lamina de canvas: es OBJETIVO, su
#      grupo va de 2.0714 a 3.9634 in y lo que contaba el medidor eran formas
#      ALTAS que cruzan la banda (una de h=2.29 que empieza en 1.8774), no
#      contenido posado en ella.
#   2. CAPTION LEGITIMO (laminas 9-14, las de poblacion). Tienen CUATRO grupos
#      y el medidor miraba el ultimo; lo que hay dentro son los «Base: 172
#      estudiantes» de cada panel, que salen de `.format_n_caption()` en
#      `.render_barras_categoricas()` y `.render_pie()`. Esos renderers NO
#      llaman a la reserva, y hacen bien: ya tienen caption.
#   3. LA LEYENDA DENTRO DE LA BANDA — el unico hallazgo real, y son SIETE.
#
# LA MEDICION LIMPIA (`p23g.py`, solo laminas de UN canvas, n = 48): distancia
# del ultimo texto del canvas a su fondo.
#     min **0.1819** · mediana **0.5866** · max 1.1589 in
#     dentro de los 0.34 de reserva: **7 de 48** — 16, 30, 38, 41, 50, 51, 57
# En las siete el invasor es la LEYENDA, no un dato: «Totalmente en desacuerdo»
# y «SIN INF» en la 16, «Si»/«No» en la 30, 38 y 41, «Egresados / Docentes /
# Estudiantes» en la 50. Es exactamente contra lo que la reserva se escribio.
#
# PERO NO ROMPE NADA, y esto tambien se mide: el peor caso acaba en 6.5364 in,
# el canvas acaba en 6.7183 y la Base del template vive en 6.93 — **0.39 in de
# aire**. La reserva aguanta en 41 de 48 con 0.59 in de mediana, y en las siete
# que la invaden la leyenda sigue sin tocar la Base. **P23 se cierra como «la
# reserva funciona»**, con la salvedad nombrada: garantiza el aire hasta la
# Base, no garantiza que la banda quede libre.
#
# LO QUE LA VARA NO PUEDE ARBITRAR AQUI: el aprobado solo tiene **3** laminas
# de un unico canvas con este patron (sus graficos no son grupos rvg), asi que
# sus 0.1285 in de mediana son una muestra de tres y NO sostienen «el motor
# desaprovecha 0.46 in mas que el aprobado». Lo que si queda vivo es lo ya
# anotado arriba: los 0.05 in de la Base y el ~10 % del alto util que se come
# el pie. Medido contra `p55.pptx` y contra el plan del `.pulso` de Conta.
#
# ENTRADA DEL MEDIDOR COMPROBADA: `chOff == off` y `chExt == ext` en TODOS los
# grupos de las 70 laminas, asi que las `y` de los hijos SI son comparables con
# el fondo del canvas. Sin eso, toda esta medicion seria de otra cosa.
#
# LECCION: una ocupacion contada no es una ocupacion causada. Tres laminas del
# mismo recuento resultaron ser un falso positivo geometrico, un caption
# legitimo y el defecto de verdad — y solo mirar el TEXTO de lo que cae dentro
# las separo.


# P8 — PERSIGUIENDO EL GROSOR APARECIO ALGO PEOR: TRES CUADRANTES DE POBLACION
# ESTAN MAL, Y UNO ENSEÑA EL PUBLICO EQUIVOCADO.
#
# El tick anterior midio que los cuadrantes de las laminas 9-14 dispersan
# **0.8141 cm** contra los 0.2931 del aprobado, con un maximo de **1.4853**
# donde el aprobado corta en 1.0000. Al buscar de donde salia ese 1.4853, el par
# minimo lo resolvio de golpe: en la **lamina 9**, el cuadrante superior
# izquierdo y el inferior derecho dibujan **la MISMA variable**
# (`estudiantes$p5`) con distinto grosor —1.0942 contra 1.4853—, y lo unico que
# los distingue es que **el inferior derecho no tiene NINGUN override**:
#
#     canvas_w_bars           0.7  ->  <ausente>   (default 0.52)
#     canvas_w_etiquetas      0.45 ->  <ausente>
#     canvas_w_extra          0    ->  <ausente>
#     canvas_w_buf_bars_extra 0    ->  <ausente>
#     textos_negrita          ...  ->  <ausente>
#     titulo                  Sexo ->  <ausente>
#
# Los TRES cuadrantes de todo el mazo que llegan a 1.4853 son exactamente los
# tres sin overrides: lamina 9 inferior derecha, 13 inferior derecha y 14
# inferior derecha. **El grosor no es el defecto: es el sintoma.**
#
# LO QUE SALE EN EL ENTREGABLE, leido del XML de `p55.pptx`:
#   lamina  9 «PERFIL DEL ESTUDIANTE»       cuad. 0  Sexo · 52 % / 48 % · Base 172 estudiantes
#                                           cuad. 3  **el mismo Sexo, los mismos 52 / 48, la misma
#                                                    base — y SIN TITULO**
#   lamina 13 «PERFIL DEL EGRESADO»         cuad. 3  Sexo de egresados, 44 / 56, Base 178 egresados,
#                                                    **sin titulo** — y el sexo del egresado ya sale
#                                                    en la lamina 11
#   lamina 14 «PERFIL DEL PERSONAL ADMINISTRATIVO»
#                                           cuad. 0-2  Base **15 administrativos**
#                                           cuad. 3    **Base 52 DOCENTES** — publico equivocado
#                                                      dentro de la lamina de administrativos
#
# El de la 14 no es un desajuste de formato: es un dato de otro publico en una
# lamina que promete administrativos, y ademas contradice a sus tres vecinos en
# la misma lamina. Con la vara puesta en el entregable aprobado, esto no se ve:
# **la vara mide geometria y este defecto es de CONTENIDO**.
#
# DE QUIEN ES EL ARREGLO: del `.pulso`, no del motor. Los cuadrantes salen del
# plan (`payload$inferior_derecha$args$var` + `overrides`), asi que **la
# reparacion es una decision de Gonzalo** —que grafico va en ese cuarto
# cuadrante de las tres laminas— y no se toca su proyecto por iniciativa propia.
#
# DE QUIEN SI ES EL ARREGLO: **del detector**. El motor entrego una lamina con
# un publico ajeno y nada se quejo. La regla que lo habria cazado es barata y
# se mide sobre el XML que ya leemos:
#   (a) dos cuadrantes de la misma lamina con la MISMA serie de etiquetas y los
#       MISMOS porcentajes -> grafico repetido;
#   (b) un cuadrante cuya «Base: N <publico>» nombra un publico distinto al de
#       sus vecinos -> publico cruzado.
# Sobre `p55` la (a) dispara en la lamina 9 y la (b) en la 14. Anadir una regla
# SUBE la cuenta de la vara, y eso no es empeorar: es la excepcion (a) del
# encargo —la cuenta sube porque se añadio una regla—.
#
# EL TECHO DE 1.0 cm SIGUE SIENDO OTRA COSA, y conviene no mezclarlo: aun
# poniendo overrides a los tres cuadrantes huerfanos, las laminas 10 y 11
# —donde los cuatro SI los tienen— dispersan **0.4231** contra los 0.2931 del
# aprobado. O sea que la configuracion explica el maximo de 1.4853 pero **no**
# toda la dispersion. La prediccion del techo anotada en
# `graficador_grosor_piso.R` se juzga aparte, y ahora se sabe que su universo
# util son las laminas ya bien configuradas.
#
# LECCION: perseguir un defecto de formato destapo uno de contenido, y el
# camino fue el par minimo — la MISMA variable dibujada dos veces en la misma
# lamina con dos grosores. Cuando dos objetos que deberian ser identicos no lo
# son, lo que los separa esta en la CONFIGURACION, no en el motor.


#' Grupos de canvas de una lamina
#'
#' El grupo del canvas se reconoce por el `<a:xfrm>` que trae `chExt`. Una
#' lamina puede tener varios —las de poblacion tienen cuatro—, y el ICONO es
#' tambien un grupo, pero CUADRADO y pequeno: no es un grafico y no entra.
#'
#' @keywords internal
.verif_grupos_canvas <- function(xml) {
  bloques <- regmatches(xml, gregexpr("<a:xfrm[^>]*>.*?</a:xfrm>", xml))[[1]]
  out <- list()
  for (t in bloques) {
    if (!grepl("chExt", t, fixed = TRUE)) next
    o <- regmatches(t, regexpr('<a:off x="(-?\\d+)" y="(-?\\d+)"/>', t))
    e <- regmatches(t, regexpr('<a:ext cx="(\\d+)" cy="(\\d+)"/>', t))
    if (!length(o) || !length(e)) next
    no <- as.numeric(regmatches(o, gregexpr("-?\\d+", o))[[1]])
    ne <- as.numeric(regmatches(e, gregexpr("-?\\d+", e))[[1]])
    if (length(no) < 2L || length(ne) < 2L || ne[[2]] <= 0) next
    w <- ne[[1]] / .VERIF_EMU
    h <- ne[[2]] / .VERIF_EMU
    if (abs(w - h) < 0.05 && w < 2.5) next          # el icono
    out[[length(out) + 1L]] <- list(x = no[[1]] / .VERIF_EMU,
                                    y = no[[2]] / .VERIF_EMU, w = w, h = h)
  }
  out
}


#' Contenido de cada cuadrante de una lamina de varios graficos
#'
#' Devuelve, por cuadrante, el conjunto ORDENADO de sus textos —que es su firma
#' de contenido— y el publico que declara su «Base: N <publico>». La Base se
#' separa de la serie a proposito: dos cuadrantes que dibujan lo mismo lo hacen
#' con la misma Base, asi que meterla dentro no distingue nada, y sacarla deja
#' la comparacion de publicos limpia.
#'
#' @keywords internal
.verif_cuadrantes <- function(xml) {
  grupos <- .verif_grupos_canvas(xml)
  if (length(grupos) < 2L) return(list())
  tx <- Filter(function(f) nzchar(trimws(f$texto %||% "")), .verif_formas(xml))
  out <- lapply(grupos, function(g) list(series = character(0),
                                         publico = NA_character_))
  for (f in tx) {
    for (k in seq_along(grupos)) {
      g <- grupos[[k]]
      dentro <- f$x >= g$x - 0.02 && f$y >= g$y - 0.02 &&
        f$x + f$w <= g$x + g$w + 0.02 && f$y + f$h <= g$y + g$h + 0.02
      if (!dentro) next
      base <- regmatches(f$texto, regexpr(
        "[Bb]ase\\s*:\\s*[0-9.,[:space:]]+[[:alpha:]]+", f$texto))
      if (length(base)) {
        out[[k]]$publico <- tolower(sub(".*[^[:alpha:]]", "", base[[1]]))
      } else {
        out[[k]]$series <- c(out[[k]]$series, trimws(f$texto))
      }
      break
    }
  }
  lapply(out, function(q) { q$series <- sort(unique(q$series)); q })
}


#' B5 — dos cuadrantes de la misma lamina dibujan lo mismo
#'
#' No se piden conjuntos IDENTICOS, se pide CONTENCION. Medido sobre la lamina 9
#' del mazo de Conta: el cuadrante bueno dice
#' `Sexo / Masculino / 52% / 48% / Femenino` y el huerfano dice lo mismo SIN el
#' titulo, porque justamente lo que le falta es la configuracion. Exigir
#' igualdad dejaba escapar el unico caso real que hay en el mazo.
#'
#' `min_textos` evita el emparejado trivial —dos cuadrantes con una etiqueta
#' suelta coincidirian por casualidad— y la exigencia de una CIFRA evita que dos
#' dicotomicas distintas se emparejen por sus «Si» y «No».
#'
#' @keywords internal
.verif_cuadrantes_repetidos <- function(cuads, min_textos = 3L) {
  n <- length(cuads)
  if (n < 2L) return(list())
  tiene_cifra <- function(x) any(grepl("[0-9]", x))
  out <- list()
  for (i in seq_len(n - 1L)) {
    for (j in (i + 1L):n) {
      a <- cuads[[i]]$series; b <- cuads[[j]]$series
      chico <- if (length(a) <= length(b)) a else b
      grande <- if (length(a) <= length(b)) b else a
      if (length(chico) < min_textos) next
      if (!all(chico %in% grande)) next
      if (!tiene_cifra(chico)) next
      out[[length(out) + 1L]] <- list(
        i = i, j = j, textos = length(chico),
        muestra = paste(utils::head(chico, 4), collapse = " / "))
    }
  }
  out
}


#' B6 — un cuadrante declara un publico distinto al de sus vecinos
#'
#' Se marca la MINORIA, no la mayoria: en una lamina de perfil, el publico de la
#' lamina es el que repiten sus cuadrantes, y el que se sale es el intruso. Con
#' menos de dos Bases legibles no hay comparacion y no se marca nada.
#'
#' @keywords internal
.verif_cuadrantes_publico_cruzado <- function(cuads) {
  ps <- vapply(cuads, function(q) as.character(q$publico %||% NA_character_)[1],
               character(1))
  ps <- ps[!is.na(ps) & nzchar(ps)]
  if (length(ps) < 2L) return(list())
  tb <- table(ps)
  if (length(tb) < 2L) return(list())
  mayoria <- names(tb)[which.max(tb)]
  out <- list()
  for (p in names(tb)) {
    if (identical(p, mayoria)) next
    out[[length(out) + 1L]] <- list(publico = p, n = as.integer(tb[[p]]),
                                    mayoria = mayoria,
                                    n_mayoria = as.integer(max(tb)))
  }
  out
}


# C0 — POR QUE POWERPOINT REPARA EL ARCHIVO: OCHO COMPROBACIONES, TODAS LIMPIAS
# Y TODAS IGUALES A LAS DEL APROBADO. EL PUNTO QUEDA BLOQUEADO, Y SE DICE EN QUE.
#
# Medido sobre `p55.pptx` (70 laminas, 249 partes) contra el entregable aprobado
# (63 laminas, 252 partes), con `c0a.py`, `c0b.py`, `c0c.py`, `c0d.py` y
# `c0e.py`. Las causas clasicas de que PowerPoint ofrezca reparar:
#
#   1. partes del zip SIN `Content_Type`            motor 0   ·  aprobado 0
#   2. `r:id`/`r:embed` usados SIN `Relationship`   motor 0   ·  aprobado 0
#   3. `Relationship` a un `Target` inexistente     motor 0   ·  aprobado 0
#   4. `id` de `<p:cNvPr>` repetido en una lamina   motor 0/70·  aprobado 0/63
#      (y `id="0"`, que tampoco es valido)          motor 0   ·  aprobado 0
#   5. XML mal formado en cualquier parte           motor 0   ·  aprobado 0
#      `.rels` con `Id` duplicado                   motor 0   ·  aprobado 0
#      entradas duplicadas o con `\` en el zip      motor 0   ·  aprobado 0
#   6. `<p:sldId>` duplicado o por debajo de 256    motor 0   ·  aprobado 0
#      (rango 256-325 en el motor, 256-418 en el aprobado)
#   7. valores fuera de rango: `<a:ext>` negativo   motor 0   ·  aprobado 0
#      `sz` fuera de [100, 400000]                  motor 0   ·  aprobado 0
#      caracteres de control C0 en el XML           motor 0   ·  aprobado 0
#   8. **SVG como blip PRIMARIO** —la causa clasica de reparacion cuando un
#      motor mete un `.svg` donde va un raster—: los TRES SVG del motor
#      (laminas 2, 6 y 7) entran por `<asvg:svgBlip>`, que es lo correcto,
#      igual que el unico del aprobado.
#
# LAS DOS UNICAS DIFERENCIAS que aparecieron, y ninguna es ilegal:
#   - El motor nombra 11 de sus 19 medias por HASH
#     (`ppt/media/1bd51735…png`) en vez de `imageN.png`. Comprobado: las 19
#     estan referenciadas exactamente una vez —salvo `image6.png`, 31 veces, que
#     es el logo—, sus extensiones estan declaradas por `Default` y los nombres
#     son legales. OOXML no exige `imageN`.
#   - El motor tiene 4 `<a:t>` vacios y el aprobado 0; el aprobado tiene 5
#     `<a:off>` negativos y el motor 0. Ninguno de los dos repara por eso.
#
# LO QUE FALTA, Y ES EL BLOQUEO: **no puedo ver el dialogo de reparacion**.
# PowerPoint no corre aqui y el sintoma solo lo observa Gonzalo. La ultima vez
# que se vio fue sobre un mazo ANTERIOR a C0.1-C0.3, asi que **cabe que el punto
# ya este arreglado y el tablero este desactualizado** —no seria la primera vez
# que un punto sobrevive a su propia reparacion—. Sin esa confirmacion no se
# puede ni cerrar ni seguir: cualquier hipotesis nueva seria a ciegas.
#
# LO SIGUIENTE, cuando Gonzalo diga si sigue pasando:
#   - si SIGUE: validar contra los XSD de OOXML (no basta `xmllint --noout`, que
#     solo mira que este bien formado; hacen falta los esquemas), y mirar el
#     `docProps/app0.xml` —una parte no estandar que, ojo, **tambien tiene el
#     aprobado**, asi que por si sola no explica nada—;
#   - si NO: C0 se cierra y el tablero pierde su ultimo punto de arranque.
#
# LIMITE DEL MEDIDOR, anotado junto al dato: el chequeo de «partes huerfanas» de
# `c0b.py` resuelve mal el `_rels/.rels` de la raiz del paquete y da 5 falsos
# huerfanos (`presentation.xml` y los cuatro `docProps/`). Da los MISMOS 5 en
# los dos mazos, asi que la comparacion vale; la cifra absoluta no.
#
# LECCION: agotar las hipotesis medibles tambien es un resultado, siempre que se
# deje escrito QUE se midio y CON QUE cifras, para que el turno siguiente no las
# vuelva a correr. Y cuando el sintoma solo lo observa una persona, el trabajo
# no es adivinar: es preguntarle.


# P49 — LA ETIQUETA ENTERA SI EXISTE, PERO EL ARREGLO QUE SE HABIA PLANEADO
# HABRIA PUESTO LA DE OTRO PUBLICO. HALLAZGO NUEVO: EL `.pulso` GUARDA UN SOLO
# INSTRUMENTO Y EL ESTUDIO TIENE CUATRO.
#
# El plan era: cuando la etiqueta del `.sav` sea PREFIJO de la del instrumento,
# preferir la del instrumento. Medido antes de tocar nada, y menos mal.
#
# LO QUE SE MIDIO, sobre el `.pulso` real de Conta:
#   - En el universo real de 99 enunciados hay **UNO** de 256 bytes exactos —el
#     limite de SPSS—: «Existen mecanismos claros y permanentes de evaluacion de
#     la gestion de las autoridades de la Unidad (…Consejo de D».
#   - Contra `state$instrumento$survey` (167 filas, 138 etiquetas distintas):
#     **cero** etiquetas mas largas que lo tengan por prefijo. Aflojado el
#     filtro —prefijo comun mas largo con CUALQUIERA de las 138—: **19 de 252
#     caracteres**. No esta.
#   - Pero SI esta en los ARCHIVOS del `.pulso`: **291 bytes**, en `survey$label`
#     fila 47 de `…d4d1fea2…instrumento_adaptado_09_08_26.xlsx`, con
#     `name = p13_3`, y tambien en la plantilla de codificacion y en el export de
#     Administrativos.
#   - **Y aqui esta el problema**: ese mismo `p13_3`, en el instrumento CARGADO,
#     es **«Actividades culturales»** (22 bytes). No es la misma pregunta.
#
# LA CAUSA, medida sobre los cuatro XLSForm del `.pulso`:
#     164d9b98  131 filas   (egresados)
#     176f76a8  137 filas   (estudiantes)
#     5f20dcb9  167 filas   (docentes, y de la version 03-08, no la 09-08)
#     d4d1fea2   67 filas   (administrativos)
#     CARGADO   167 filas   == 5f20dcb9
#   Los nombres de variable **COLISIONAN entre publicos con significados
#   distintos**: de los 52 `name` comunes entre egresados y estudiantes, **50**
#   tienen etiqueta distinta; entre egresados y docentes, **54 de 63**. `p6` es
#   «¿Cual es su año de egreso?» en egresados y «Indique su maximo grado
#   alcanzado:» en docentes; `p4` es la edad en egresados y el genero en
#   administrativos.
#
# POR ESO EL ARREGLO PLANEADO ERA PEOR QUE EL DEFECTO: resolver la etiqueta «del
# instrumento» por `name` habria pegado la pregunta de DOCENTES en un grafico de
# egresados. La regla del prefijo no lo habria frenado —lo que frena hoy es que
# el prefijo no casa, y no casa porque el instrumento cargado es el equivocado—.
#
# LO QUE **NO** SE HA MEDIDO, y hay que decirlo: **si el motor usa
# `state$instrumento` para resolver los enunciados del mazo**. Si no lo usa —si
# cada base tira de su propio `.sav`—, el riesgo de arriba es teorico y lo unico
# vivo es que P49 no tiene arreglo por esta via. Comprobarlo es el paso
# siguiente, y es barato: `grep` de `instrumento` en la cadena que resuelve el
# titulo.
#
# ESTADO DE P49: **la reparacion queda descartada tal como estaba planteada**.
# Si se retoma, la etiqueta entera tiene que venir del instrumento **DE SU
# PROPIA BASE**, y hoy el `.pulso` solo conserva uno de los cuatro cargado.
#
# LECCION: la premisa de un hallazgo tambien se mide. «La entera esta en el
# instrumento» era cierta a medias —esta en un ARCHIVO del `.pulso`, no en el
# instrumento cargado— y esa media verdad escondia un defecto mayor que el que
# se iba a arreglar.
