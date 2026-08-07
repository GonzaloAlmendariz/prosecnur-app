# GOAL · El radar compara públicos, y el indicador lo decide el analista

Tipo: Goal operativo QA
Estado: En curso
Fecha: 2026-08-06
Autoridad: Objetivo de trabajo medible; no certifica por sí solo el estado de la superficie

- **Abierto**: 2026-08-06 · **Cierra**: sólo Gonzalo
- **Alcance**: loop de convergencia, no una lista lineal. No se cierra hasta
  validarlo todo: motor, interfaz, estilos y render en PPT.
- **Banco de prueba**: `ACRD CONTA/Conta 06-08.pulso` con `Matriz.xlsx` — 4
  bases reales (`docentes` 102 vars, `estudiantes` 88, `egresados` 75,
  `administrativos` 35), 153 temas en 44 diapositivas. Es proyecto de cliente:
  se trabaja **sobre copia**, nunca se commitea.

## Qué se pide

> «Si un bloque tiene de cinco temas a más y todos los actores presentes tienen
> todos los temas, que exista la posibilidad de escoger barras multiapiladas o
> un gráfico de radar. El indicador es o una categoría o la suma de un par de
> categorías —la opción "Sí", o el top-two-box, que aquí son la 3 y la 4, no la
> 5 que es sin información—. Esto no es hardcodeado, se define en la interfaz.
> Y el radar tiene que tener varios estilos, como las multiapiladas, y uno de
> ellos multibase que se sincronice con esto.»

## El hallazgo que ordena el goal

**Ningún radar del motor puede tener una serie por FUENTE.** Los dos que
existen cruzan por una variable *dentro de una base*:

| Graficador | Ejes | Series | Sirve aquí |
|---|---|---|---|
| `p_radar` modo `sm` | opciones de una `select_multiple` | `cruce` (una variable) | no |
| `p_radar` modo `box` | varias preguntas de una escala | `cruce` (una variable) | **casi** |
| `p_dim_radar` | dimensiones calculadas | `cruce` (una variable) | no |

El modo `box` acierta la forma —varias preguntas de escala compartida,
resumidas por un corte— pero su serie sale de una variable, no de las cuatro
bases. Y el camino multibase (`base$variable`) está resuelto de forma genérica
en `graficos_consolidado.R`, pero la consolidación sólo acepta
`p_barras_multiapiladas` en modo `var_cruce` y salta el resto.

**Consecuencia**: el radar multibase es capacidad nueva del motor, no un
argumento. Y su render cae en `reporte_plan_ppt.R`, que está en
`policy.frozen_growth_files` — por eso la implementación vive en archivo propio
y el monolito sólo la llama, que es la regla de la casa.

## Estado por carril

| Carril | Estado |
|---|---|
| **R1** · La declaración lleva `grafico` y `corte` por bloque | **hecho** |
| **R2** · El corte se define en la interfaz, sin nada fijo | **hecho** |
| **R3** · Ida y vuelta por Excel sin perder la decisión | **hecho** |
| **R4** · El mazo reporta los bloques que piden radar | **hecho** |
| **R5** · El motor dibuja una serie por público | **hecho** |
| **R6** · El radar tiene estilos, uno de ellos multibase | **hecho** |
| **R7** · El render en PPT: gráfico y tabla, elegantes | **hecho** |

## Reglas que el loop ya fijó

1. **El indicador se declara, no se deduce.** Cuál es el corte —«Sí», o la suma
   de «De acuerdo» y «Totalmente de acuerdo»— es una decisión metodológica del
   estudio. Una regla como «los dos últimos» sería falsa justo en esta escala,
   donde el quinto valor es «SIN INF».
2. **Elegible = 5+ temas y cobertura rectangular.** Todos los públicos presentes
   con todos los temas. Lo que rompe la figura es el hueco —un vértice que le
   falta a una serie y no a otra—, no el número de series: con un solo público
   el radar sale con una línea y se lee perfectamente.
3. **El control se muestra aunque no se pueda activar**, con el motivo al lado.
   Esconderlo hacía que la función pareciera inexistente.
4. **Nada de nombres de base fijos.** Las columnas y las series salen de las
   bases declaradas del estudio: tres bases producen tres series y seis, seis.

## Medido sobre el banco de prueba

```
bloques con diapositiva:        53
  de 5+ temas:                   4   ← todos con cobertura rectangular
    D10  7 temas · administrativos
    D25  6 temas · docentes
    D29  6 temas · docentes, estudiantes, egresados
    D30  5 temas · docentes, estudiantes, egresados
```

## Lo que el loop encontró al implementar

**`%||%` revienta con un data frame de una sola columna.** Para un data frame
`length()` es el número de columnas, así que `length(a) == 1 && is.na(a)` evalúa
`is.na()` sobre el objeto entero y `&&` recibe un vector. Las bases reales
tienen decenas de columnas y nunca lo tocan; el fixture del test sí. Está en
`helpers_calc_comunes.R` y lo usa medio motor — vale la pena mirarlo aparte.

**El panel del radar recortaba las etiquetas a media palabra.** El límite se
calculaba como el anillo de etiquetas más un 5 %, que alcanza para nombres
cortos; «Costos y presupuestos» se centra en su ancla y su mitad izquierda caía
fuera. Se añadió `margen_etiquetas` a `graficar_radar`, con defecto `1` para no
mover el encuadre de los radares que ya existen.

**Ningún estilo etiqueta los vértices por defecto.** Con tres públicos y seis
temas serían 18 números dentro de una banda de ocho puntos —el perfil de egreso
mide entre 90 % y 98 %— y se montarían unos sobre otros. El ancla numérica es la
tabla. Pero es una decisión de lectura, no una ley: ver más abajo los tres
controles que la ponen en manos del analista.

**Diez anillos de grilla no se leen**: las etiquetas de nivel se escriben una
sobre otra sobre el mismo rayo («0%11%22%33%…»). El estilo de auditoría usa
cinco.

## Medido: el radar de la diapositiva 29

Indicador = códigos 3+4 (top-two-box), dejando fuera el 5 «SIN INF».

| Tema | docentes | estudiantes | egresados |
|---|---:|---:|---:|
| Estados Financieros | 98.0 | 96.3 | 98.1 |
| Auditoría | 96.1 | 90.8 | 98.1 |
| Costos y presupuestos | 92.2 | 93.6 | 93.8 |
| Finanzas | 96.1 | 95.4 | 93.2 |
| Tributación | 94.1 | 96.3 | 97.5 |
| Visión empresarial | 92.2 | 93.6 | 95.0 |

Bases: 51 docentes · 109 estudiantes · 161 egresados. Sin huecos.

## Estilos del radar

| Clave | Para qué |
|---|---|
| `comparativo` | Una línea por público. El que sincroniza con la matriz. |
| `silueta` | Polígonos rellenos, sin números: la forma del perfil. |
| `auditoria` | Grilla y radios visibles, leyenda al costado. |
| `limpio` | Sólo líneas y ejes, para una lámina que ya trae su tabla. |

## Cómo se engancha sin tocar el archivo congelado

El despacho del PPT resuelve por convención de nombre:

```r
fn_name <- paste0(".render_", etype)
if (!exists(fn_name, mode = "function", inherits = TRUE)) ...
```

Así que `.render_radar_publicos`, definido a nivel de paquete en
`graficos_radar_multibase.R`, **se encuentra solo**. No hizo falta añadir una
rama a `reporte_plan_ppt.R` ni subir su línea base.

Lo único que el despacho no da son las fuentes: pasa `(el, preset_args)` y nada
más. Se toman con `dynGet("data_sources")` / `dynGet("instrument_sources")`, que
existe justo para leer una variable del entorno de llamada sin acoplarse a la
profundidad del frame. Si no aparecen, el renderer lo dice en vez de dibujar un
radar vacío.

## Comparar públicos es un MODO del radar

Corrección de Gonzalo al revisar la primera versión, que lo había registrado
como graficador aparte:

> «El radar y el radar entre públicos son lo mismo; el radar entre públicos
> debería ser un tipo de radar.»

Tiene razón, y el registro lo estaba partiendo en dos. Para el analista sigue
siendo **un radar**: lo único que cambia es de dónde salen las series —de un
cruce dentro de una base (`sm`, `box`) o de las fuentes del estudio
(`publicos`)—. Dos tarjetas en el picker obligaban a saber de antemano cuál de
las dos abrir.

`p_radar(modo = "publicos", …)` delega en `p_radar_publicos()`, que sigue siendo
donde vive el cálculo. El elemento de plan y el renderer no cambian. Y como
`p_radar` ya está en `.GRAFICADOR_REGISTRY`, el mazo derivado se materializa por
el mismo camino que cualquier otra lámina, sin registrar nada nuevo.

Efecto colateral: se cayó la maquinaria de `feature_kind = "multibase"` que
apagaba la tarjeta cuando el estudio no tenía bases separadas. El requisito lo
dice ahora el hint del modo. Menos piezas.

## El panel muestra sólo lo que el modo usa

Un graficador con modos declara los campos de TODOS sus modos, porque el
registro describe la función R entera. El panel no sabía filtrar, así que la
etiqueta hacía de aviso: «Variable (modo Select múltiple)», «Variables (modo
Cajas/cortes)». El analista que elegía «Entre públicos» veía nueve campos de los
que cuatro no se leen nunca.

Ahora cada arg puede declarar `depende = list(arg = "modo", valores = …)` y el
frontend lo evalúa contra el payload (`argDependencias.ts`, filtrado en
`ArgGroup` para que valga igual en el editor, el panel de estilo y el de
filtros). Con eso las etiquetas pierden el sufijo técnico y quedan en
«Pregunta», «Preguntas», «Indicador».

Regla que fija el test: **mientras no se haya elegido modo no se esconde nada**.
Un panel vacío al abrir un graficador nuevo se lee como roto.

De paso, los modos se nombran con lo que el analista decide y no con la
mecánica: «Las opciones de una pregunta», «Varias preguntas de la misma
escala», «Los públicos del estudio». Multi-apiladas adopta las palabras de su
propio constructor (`MultiApiladasBuilder.tsx`) en vez de las del registro:
tener dos vocabularios para la misma decisión obligaba a traducir «Variables ×
cruce» a «Abrir preguntas por grupos» al cambiar de superficie.

## Un crash encontrado de paso

`parseVarRef` recibía un objeto donde el tipo promete un string y tumbaba la
aplicación entera con `ref.indexOf is not a function`. El payload de un slide
sobrevive al cambio de graficador: `vars` de multi-apiladas en modo `var_cruce`
es un objeto de bloques, y al pasar ese slide a Radar el picker lo recibe tal
cual. Es anterior a este goal —pasa entre cualquier par de graficadores que
compartan el nombre `vars`— y ahora devuelve campo vacío en vez de morir.

## Tres controles de lectura, pedidos al ver la primera versión

> «Uno es que no aparezcan los porcentajes, otro que los porcentajes puedan no
> tener decimal sino números enteros, y tercero poder definir un eje mínimo, que
> no vaya de cero a cien sino de cincuenta a cien para que se perciban mejor las
> diferencias.»

| Control | Qué hace |
|---|---|
| **Números en los vértices** | Escribe el porcentaje sobre cada punto. Vale para los tres modos del radar. |
| **Decimales** | 0 = enteros. Manda a la vez sobre el vértice y sobre la tabla. |
| **El eje arranca en (%)** | Piso del eje radial. Con 50, la mitad alta ocupa todo el radio. |

Tres cosas que el loop tuvo que resolver para que funcionaran de verdad:

**Las etiquetas decían «1.0%» donde el dato era 98 %.** Bug preexistente de
`graficar_radar`: el bloque de ingesta normaliza `.valor` a 0–1 para *ambas*
escalas, pero la etiqueta multiplicaba por 100 sólo cuando la entrada venía como
`proporcion_1`. De paso el umbral —que compara contra 3— borraba casi todas las
etiquetas, porque 0.98 < 3. No se veía porque ningún estilo enciende
`mostrar_valores`, y el radar de dimensiones usa la otra escala.

**El número se escribía encima del nombre del tema.** Un indicador entre
públicos vive en la banda alta, donde el anillo exterior ya lo ocupa la etiqueta
del eje. Se añadió `valores_hacia_dentro` —el número va hacia el centro— y el
paso de separación tangencial crece con el número de series: con tres, el
reparto simétrico dejaba las de los extremos casi encima de la del medio.

**Un piso por encima del valor más bajo miente.** El graficador recorta al
centro lo que cae debajo del piso, y un 42 % dibujado en el centro se lee como
cero. `.radar_mb_piso()` baja el piso hasta el mínimo observado y **dice cuál lo
forzó**, en vez de dibujar un dato falso o de ignorar en silencio lo declarado.

El defecto de decimales pasó a **0**: en un informe de encuesta el porcentaje
entero es la norma, y el decimal sugiere una precisión que la muestra no tiene
—con n = 51, un punto vale dos casos—.

Y una regla de registro que hizo falta: **un `grupo = "datos"` declarado gana
sobre la heurística de nombre.** Sin ella `mostrar_valores` volvía a «valores»
por su nombre y desaparecía de la UI, porque el inspector renderiza el slot de
graficador con `mode="data"`. Medido: cambia exactamente un arg en todo el
registro.

## Lo que se ve por defecto, revisado

Segunda pasada de Gonzalo sobre las láminas:

> «Cada punto no debería tener el porcentaje, sino las diagonales que van del
> centro a las puntas. Los cortes de 50, 60, 70… tampoco deberían estar por
> defecto. Y si activamos la tabla al costado, deberíamos poder editar sus
> encabezados y cuánto ancho necesita.»

| | Antes | Ahora |
|---|---|---|
| Radios del centro a cada punta | no | **sí** |
| Etiquetas de nivel (0 %, 25 %…) | sí | no — se encienden desde la UI |
| Números en los vértices | no | no |
| Aire entre el nombre del tema y la figura | 6 % del radio | **20 %** |

La telaraña se lee por su forma. Los radios son la estructura que deja seguir un
tema desde el centro; los niveles y los números son dos capas de cifras encima de
esa forma, y la tabla al costado ya da el dato exacto.

**El indicador se mudó del encabezado de la tabla al subtítulo del gráfico.**
Metido en la celda, «De acuerdo + Totalmente de Acuerdo» se comía media tabla —
que fue justo la queja. Y en el subtítulo se lee **aunque la tabla esté
apagada**: sin él, la telaraña no dice de qué porcentaje habla.

**El tope de 1.10 del anillo de etiquetas impedía pedir más aire.** Existía para
que un `radar_scale` grande no empujara los nombres fuera del panel, pero también
bloqueaba subirlos a propósito. Ahora sólo topa lo que no se pidió. De paso el
margen del panel bajó de 1.42 a 1.18: con el aire ya puesto en el anillo, lo
único que hacía era dejar media lámina en blanco entre el radar y la tabla.

### La tabla se edita

| Control | Para qué |
|---|---|
| **Encabezado de la primera columna** | Vacío = «Tema». |
| **Nombres de las columnas** | `base=Título` por línea, mismo formato que `titulos_grupo` de las multiapiladas. Lo que no se nombra se queda igual. |
| **Ancho de la primera columna (%)** | `tableGrob` dimensiona por contenido, así que un encabezado largo se comía la tabla. Con un ancho declarado, el resto se reparte en partes iguales — que es lo que hace comparables las cifras. |
| **Ancho de la tabla frente al radar** | Para decidir cuál de los dos manda en la lámina. |

Detalle que costó un test: la UI pide un porcentaje y el motor una fracción.
`.radar_mb_fraccion()` acepta las dos formas (`45` y `0.45`); sin eso, un 45
dejaba la columna en el 4500 % del ancho.

## El mazo completo en PPT: 44 láminas auditadas

Se generó el mazo entero desde la matriz del estudio y se miró lámina por
lámina. Cinco defectos, todos reparados:

**1 · El mazo entero moría al llegar al radar.** `el_plot$var` cae al **match
parcial** de R cuando no encuentra el nombre exacto, así que devolvía `vars` —una
lista nombrada de vectores— que el resolvedor deparseaba a
`c("docentes$p30_1", …)`. El elemento declara ahora `var = NULL` explícito. No se
veía antes porque las pruebas rendían la lámina con título puesto, y el título es
justo lo que dispara ese camino.

**2 · Un radar con enunciados por eje no es un radar.** Las diapositivas 10 y 25
declaran temas de 91 a 200 caracteres. Envueltos a 12 columnas dan hasta
diecisiete líneas por vértice: se tapaban entre sí y sepultaban el polígono — la
lámina salía como una lista de frases **sin gráfico**. Ahora el mazo no las
convierte en radar y lo reporta como `etiquetas_largas`; el dibujo además recorta
en el último espacio, con «…», por si alguien lo declara igual. El nombre entero
sigue en la tabla.

**3 · La tabla se salía de la lámina y tapaba el radar.** `tableGrob` dimensiona
por contenido y no recorta. La primera columna se envuelve.

**4 · Los títulos de bloque se escribían unos encima de otros — en las 40 láminas
de barras.** `cowplot::draw_text` dibuja centrado y no recorta. Cada título se
acota ahora a lo que su bloque sostiene, contado en **filas de barras**: medir la
distancia entre la primera y la última categoría daba cero en un bloque de una
sola barra, que era justo el caso peor (siete temas de un solo público).

**5 · Nueve láminas salían sin nota de base.** El camino de escalas mixtas exigía
refs de *varias* fuentes para emitirla y devolvía `NULL` si no. En un informe de
encuesta la base no es opcional.

## Segunda pasada sobre el mazo: la forma, el color y la cifra

**La forma del gráfico la decide cuántos actores toca, no el gusto.** Corrección
de Gonzalo:

> «Si es un multiapilado donde todas las barras son de un mismo actor, el eje Y
> ya no es el actor: es el tema, la pregunta en sí misma. El tema como canal
> aparte es cuando hay varios actores; ahí sí tienes que diferenciar tema y
> actor.»

El canal lateral existe para separar **dos** dimensiones. Con un solo público
sólo hay una, y repetir «Administrativos» en las siete barras no informa nada que
el pie no diga ya —«Base: 15 administrativos»— mientras empuja el tema a un canal
estrecho, que es justo donde los títulos se apilaban. Ahora un bloque de un solo
público sale como `modo = "var"`: una barra por pregunta, la pregunta en el eje.

**El canal se ensancha en su caso y no en el otro.** Con varios actores, el canal
del tema pasa de 13 % a 22 % y su envoltura de ~18 a ~32 caracteres; con uno
solo, lo que se ensancha es el eje Y. Darle 22 % al canal del tema en una lámina
que no lo usa sólo empuja las barras a la derecha.

### El top-two-box era una opción a medias

La barra extra ya salía de fábrica, pero con preset «ninguno» y **3 pt** de
tamaño: una columna estrecha con una cifra diminuta, sin título y sin color. Eso
no es una opción apagada — ocupa el sitio y no dice nada. Dos rutas del motor ya
la subían a 11 a mano, señal de que el defecto nunca sirvió.

- El tamaño de fábrica se alinea con `size_ejes`, para que la cifra pese lo que
  pesa un rótulo de barra.
- El mazo de equivalencias lo enciende cuando la escala tiene **de 4 a 6**
  categorías. Con 2 (Sí/No) la suma de las dos últimas es la barra entera; con 7
  o más, «las dos mejores» deja de resumir la mitad alta.

### La paleta decía otra cosa que los datos

| | Antes | Ahora |
|---|---|---|
| Escala de acuerdo | rojo · amarillo · verde claro · **azul marino** · gris | rojo · **durazno** · verde claro · **verde oscuro** · gris |
| Dicotomía (Sí/No) | **azul marino · rojo** | azul marino · **azul claro** |

El azul marino en el extremo positivo es el color de la marca, no el de «lo
mejor»: rompía la lectura de un vistazo, porque el ojo busca el verde. Y el rojo
contra azul en una dicotomía marca una de las dos como mala — en «¿Conoce el
reglamento?» el «No» es un dato, no una falta.

## El espacio vertical, medido con los bordes de debug

> «En casi todas las diapositivas hay mucho espacio abajo que no se está
> aprovechando. Mejor renderizar con el filtro de líneas debug, que nos permite
> ver cómo se está formando la distribución.»

Renderizado con `debug_ph_bordes = TRUE`, el reparto se lee de una vez:

```
hueco físico:  6.00 in de alto × 12.5 de ancho
canvas armado: 3.56 in  →  el 41 % de la lámina quedaba en blanco
   cabecera 0.00 · panel 2.39 · leyenda 0.75 · reserva de pie 0.85
```

Dos causas, las dos reparadas:

**La leyenda cobraba un fijo de 0.75 in** — un cuarto del panel para dibujar UNA
línea de texto. Ahora la banda se calcula a partir de las filas que la leyenda va
a ocupar (0.32 in cuando entra en una, más cuando no). Es una estimación: el
reparto real en filas se resuelve al dibujar, con las anchuras de texto ya
medidas, así que se redondea hacia arriba — quedarse corto recorta la leyenda,
que es peor que sobrar un poco.

**El canvas se armaba con su alto intrínseco** (filas × alto por fila) y luego se
colocaba conservando su proporción, así que el resto del hueco quedaba en blanco.
Ahora el sobrante se reparte a las filas hasta un grosor máximo. El tope existe
porque una lámina de dos barras estirada a pantalla completa se lee como un error
de maquetación, no como un gráfico: pasado cierto punto, aire vale más que barra.

Resultado sobre las mismas láminas: de 3.56 a 4.70 in de canvas con cinco filas,
y de 2.43 a 3.03 con tres.

## Qué falta para cerrar

- **El estilo se fija en `comparativo`** al derivar el mazo. Debería poder
  elegirse por bloque, como el corte.
- **Verificar el radar de un solo público** en PPT (diapositivas 10 y 25).
- **Los args de graficador fuera del grupo `datos` no tienen dónde salir**: el
  inspector v2 renderiza el slot con `mode="data"`. Se sirven en el registro
  pero la UI no los muestra (`titulo_tabla` y `umbral_rojo_pct` de `p_tabla`
  están así hoy). Por eso los controles del modo `publicos` se declararon en
  `datos`.
- **Con tres series dentro de dos puntos, los números del vértice se rozan.**
  Mejoró mucho al llevarlos hacia dentro y separarlos más, pero a ese tamaño
  algo de solape queda; la tabla sigue siendo el ancla exacta.
- **El mazo sale sin títulos porque la matriz del estudio no declara enunciados**
  (0 de 44). Las 35 láminas de un solo juego de escalas reciben el título
  automático del motor —el rótulo de la primera variable, que nombra un tema y no
  la diapositiva— y las 9 de escalas mixtas no reciben ninguno. La inconsistencia
  es del relleno automático; la reparación de fondo es declarar el enunciado, que
  la interfaz ya pide por diapositiva.
- **El top-two-box por defecto está resuelto en el mazo de equivalencias, no en
  el motor.** Que la barra extra nazca encendida en *cualquier* apilada de 4–6
  categorías es una decisión que toca todos los reportes existentes; conviene
  tomarla aparte, con su bandera en la interfaz.
- **En `modo = "var"` el rótulo de la barra sale del instrumento, no de la
  etiqueta estándar declarada.** En este estudio coinciden —la etiqueta ES el
  enunciado—, pero un estudio que renombre sus temas perdería el nombre corto.
- **`%||%` con data frames de una columna** sigue siendo una mina: está fuera
  del alcance de este goal, pero conviene abrirlo.
