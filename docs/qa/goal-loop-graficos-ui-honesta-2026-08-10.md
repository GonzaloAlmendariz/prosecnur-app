# GOAL — la interfaz de Gráficos dice la verdad y se deja encontrar

**Abierto**: 2026-08-10 · **Cierra**: solo Gonzalo · **Cadencia**: continua
**Banco de prueba**: `~/Documents/Pulso/ACRD CONTA/Conta 10-08 equivalencias.pulso`
(4 bases, 67 láminas, 50 gráficos, 66 grafs con graficador).

*Corrección 2026-08-11*: este doc listaba también `api/inst/reference_projects/acrconta/`
como banco. **No sirve para Gráficos**: su plan tiene 1 lámina y cero grafs. Un
test que se apoye en él pasa por no mirar. Hoy no hay ningún `.pulso` versionado
que sostenga una invariante de Gráficos — las de este loop se prueban contra el
mecanismo, no contra un proyecto.

Loop indefinido. No tiene lista de tareas que se agote: cuando la cola baja, la
iteración siguiente **mide algo nuevo** y la vuelve a llenar.

## Por qué existe

Un analista con el proyecto real delante no encuentra dónde se configura lo que
quiere cambiar, y cuando lo encuentra no sabe si está tocando la capa correcta.
Reportado en vivo: bajó un tamaño de 16 a 14 y le salió 9,5; cambió tamaños y le
cambiaron los colores; no supo por qué el texto se salía de la lámina. Ninguno de
los tres era culpa suya — pero la interfaz no le dio forma de saberlo.

## La vara: qué significa «mejor» aquí

Tres criterios, en este orden. Una iteración que mejora el 3 empeorando el 1 no
cuenta como avance.

1. **Honesta.** Lo que el control dice que hace es lo que hace. Un interruptor
   activo tiene efecto observable; un número declarado se respeta o la interfaz
   explica por qué no; un contador no compara peras con manzanas. *El caso que
   fundó este criterio: las guías de layout llevaban meses activándose sin
   efecto en ningún entregable.*
2. **Se deja encontrar.** El analista llega a lo que busca sin saber de antemano
   en qué panel vive. Hoy hay al menos dos superficies para configurar un mismo
   gráfico y nada dice cuál manda.
3. **Explica su capa.** Cuándo mando global y cuándo mando de esta lámina, y qué
   pasa cuando los dos hablan. La precedencia existe y está documentada en el
   código (motor → Pulso → base del proyecto → tipo → override del slide); la
   interfaz no la muestra.

## La restricción dura

**No se cambia cómo se hace algo que ya funciona.** Este loop corre sin
supervisión, y un analista tiene que poder abrir la app mañana y trabajar igual
que ayer.

En concreto:

- **Añadir, no mover.** Un buscador, una etiqueta que explica, un aviso que
  faltaba: sí. Reorganizar los paneles existentes, renombrar secciones, cambiar
  dónde vive un control: **no sin decisión de Gonzalo**.
- **Un cambio estructural se PROPONE, no se aplica.** Se escribe en la cola como
  propuesta con su evidencia, y espera.
- **Cada iteración termina con evidencia literal.** Typecheck si tocó TS, vitest
  del feature, y comprobación en la UI real con el proyecto abierto. Sin
  evidencia no se declara hecho.
- **Nada de defaults nuevos que muevan mazos ya entregados.** Si un ajuste cambia
  el render de proyectos existentes, va a propuesta.

## Cómo es una iteración

1. **Elegir UNA cosa** de la cola (o medir algo nuevo si la cola está corta).
2. **Medirla antes**: qué se ve hoy, con número o captura.
3. **Cambiarla** dentro de la restricción dura.
4. **Verificar**: typecheck + vitest del feature + la UI real abierta sobre el
   banco de prueba. Si tocó el motor, además el render del `.pulso`.
5. **Registrar** aquí: qué se midió, qué se cambió, qué demuestra que funciona.
6. Si algo no se puede hacer sin decisión → a §Propuestas, y se sigue con otra.

## Cola — medido, no impresión

Cada ítem trae el dato que lo justifica.

### ~~C-01 · No hay dónde buscar un ajuste~~ ✅ 2026-08-10
La suite de Estilo global tiene 7 secciones y la biblioteca visual declara 22
tipos de gráfico. Para cambiar el ancho del canal de etiquetas hay que saber que
vive en Estilo global → Base PPT → Multi-apiladas, no en el inspector de la
lámina. **No existe un buscador de ajustes.** Un campo que busque por nombre y
por lo que hace, y lleve al panel correcto, es puro añadido.

### C-02 · Dos superficies para el mismo gráfico *(medido y acotado)*
**Corrección del 2026-08-10**: el panel SÍ explica las capas — tiene un «FLUJO DE
COPIA» con Base PPT → Biblioteca → Ajuste de este gráfico, y la cabecera de cada
gráfico dice «Base PPT · sin cambios propios». La herencia también se pinta por
campo: estado gris y valor heredado visible.

Lo que falta es **de qué capa concreta** viene el valor de un campo y dónde
cambiarlo para todas las láminas. Se intentó y se retiró — ver §Propuestas P-A.

### ~~C-03 · El distribuidor de canvas está en 1 de 24 graficadores~~ → §Propuestas P-B
Medido sobre `.GRAFICADORES_META`: solo `p_barras_agrupadas` expone un argumento
`canvas_*` en su UI. Los demás reparten su espacio con valores que el analista no
ve ni puede tocar desde el gráfico. No implica que deban exponerlos todos —sí que
la asimetría hoy no responde a ninguna razón declarada.

### ~~C-04 · La superficie expuesta por graficador es dispar sin criterio visible~~ → §Propuestas P-B
`p_barras_apiladas` expone **6** argumentos; `p_histograma`, **23**; el motor de
apiladas acepta ~140. La asimetría no sigue ni la complejidad del gráfico ni su
uso. Hace falta un criterio escrito de qué merece estar en la UI.

### ~~C-05 · `espacio` aparece en 4 de 24 graficadores~~ → §Propuestas P-B
El vocabulario de grupos es `datos · valores · lectura · espacio · diagnostico ·
tabla`. `espacio` solo se usa en 4. O el grupo sobra, o a 20 graficadores les
falta declarar ahí lo que ya tienen.

### ~~C-06 · Los arreglos automáticos no se declaran~~ ✅ 2026-08-10
El motor achica la letra del eje cuando no cabe (piso 9,6 pt), acota el wrap al
canal, apaga el Top 2 Box en escalas de 2 categorías, reparte la leyenda en filas
parejas. Todo eso es bueno y evita trabajo manual — pero **el analista no se
entera**, y cuando su 14 pt sale a 9,5 cree que hizo algo mal. Los avisos ya
existen como `message()` en el motor; no llegan a la interfaz.

### ~~C-07 · Un `.pulso` puede guardarse con referencias colgando~~ ✅ 2026-08-10
El proyecto del 10-08 declara un ícono cuyo PNG no viaja en el zip. **Corrección
del 2026-08-10**: la app SÍ avisa al abrirlo —«El ícono … ya no está disponible
en el catálogo», con la salida sugerida—. Lo que falta es el aviso al **guardar**,
que es cuando la referencia se rompe y cuando todavía se puede arreglar sin
haber entregado nada.

### C-12 · El ZIP multibase se traga los avisos del motor *(medido 2026-08-11)*
De las tres vías de export, sólo dos entregan los arreglos automáticos que el
motor aplicó: PPT desde la iteración 2 y Word desde la 12. El ZIP multibase
(`router_graficos.R:3390`) no los incluye, y su flujo en el frontend es otro —
`exportJob` sólo conoce los kinds `"ppt" | "word"`, así que no tiene dónde
pintarlos. Añadirlo al backend sin superficie sería otra tubería a ninguna
parte. Necesita una superficie propia en el flujo multibase: es adición, pero
no de una línea.

### C-13 · Seis enunciados se salen de la lámina, hasta 1,7 mm *(medido 2026-08-11)*
Render completo del banco (67 láminas, `cierre.pptx`) y medición de la geometría
de cada forma contra el tamaño de lámina (13,33 × 7,5 in): **6 formas en 5
láminas** arrancan fuera del borde — 22, 24, 34, 36 (dos) y 55. La peor sale
1,7 mm. Todas son enunciados largos del eje de una multi-apilada, con los saltos
de línea ya calculados por el motor (son `<a:t>` separados, no reflow del
visor). Es el residuo del bug que reportó el compañero: acotado, ya no
catastrófico, pero vivo. Reproducible con el barrido de geometría del cierre.

### C-14 · Once ajustes sólo se encuentran tecleando su nombre exacto *(medido 2026-08-11)*
El buscador compara contra `name`, `label`, `descripcion`, `efecto` y `unidad`.
De los 667 argumentos de las dos superficies, **11 nombres (2 %)** no tienen ni
descripción, ni efecto, ni una etiqueta que diga algo distinto del nombre
técnico: `cruce`, `decimales`, `incluir_total`, `mostrar_barra_extra`,
`mostrar_eje_y`, `mostrar_leyenda`, `mostrar_puntos`, `mostrar_radios`,
`mostrar_rango`, `mostrar_valores`, `top_n` (23 ocurrencias).

**Ojo con la mitad de ellos**: para `mostrar_leyenda` o `mostrar_eje_y`, una
descripción sería parafrasear la etiqueta — AI slop, justo lo que Gonzalo pidió
evitar. Sólo ganan información real los que la etiqueta no explica: `top_n`
(¿primeras N de qué?), `cruce` en los `p_dim_*` (donde la etiqueta es «Cruce» y
no «Dividir por», como sí es en el resto), `incluir_total` (¿total de qué?),
`mostrar_rango`, `mostrar_radios` y `mostrar_puntos`. Unos 8 de 23.
**No cambiar la etiqueta «Cruce» por «Dividir por»**: sería renombrar un
control, que la restricción dura prohíbe sin decisión.

## Propuestas — esperan decisión de Gonzalo

### P-A · Procedencia por campo: cierta, pero a esa densidad es ruido

**Qué se probó.** Un badge junto a cada campo heredado diciendo de dónde viene
—«Base PPT · Barras agrupadas»— con tooltip explicando que cambiarlo ahí afecta
a todas las láminas y aquí solo a esta.

**Funcionó**: typecheck limpio, 313 vitest en verde, y en la UI real el badge
aparecía con el nombre correcto del tipo de gráfico.

**Por qué se retiró.** Medido en la lámina «4 gráficos + ícono» del banco de
prueba: **172 badges** sobre 184 campos. Acotándolo a los campos donde la base
aporta un valor real bajó a **140 de 184** — sigue siendo casi todos. El dato es
cierto en cada uno, pero repetido 140 veces deja de informar y ensucia el panel.
Una iteración que mejora «explica su capa» empeorando la legibilidad no cuenta
como avance.

**Las tres salidas, y ninguna es aplicable sin decidir:**

1. **Solo al posarse en el campo** (hover/focus). Mantiene la respuesta donde se
   hace la pregunta y no repite nada en reposo. Se intentó por CSS y la cascada
   lo pisó; habría que controlarlo desde el componente.
2. **Una sola frase en la cabecera del grupo**, no por campo: «todo lo de este
   grupo viene de Base PPT · Barras agrupadas salvo lo marcado». Menos preciso,
   mucho más limpio.
3. **Solo en los campos que difieren de la base** o que el analista ya tocó.
   Invierte el criterio: señalar lo excepcional en vez de lo normal.

La 1 y la 3 son las mejores; la 3 es la más barata. Cualquiera cambia cómo se
lee el panel, así que no se aplica sin tu visto bueno.

### P-B · Qué merece estar en la UI de cada graficador (C-03, C-04, C-05)

**Medido.** *Tabla corregida el 2026-08-11 — dos veces.* La original medía un
catálogo a la vez cuando hay dos superficies, y contra `graficar_*` cuando el
router llama a `p_*`. Cifras contra el renderer, con la unión de ambas
superficies:

| Graficador | Args en la UI | Args del renderer | Expuesto |
|---|---|---|---|
| `p_media_rango` | 32 | 82 | **39 %** |
| `p_boxplot` | 30 | 62 | 48 % |
| `p_barras_apiladas` | 82 | 130 | 63 % |
| `p_barras_agrupadas` | 70 | 102 | 69 % |
| `p_barras_categoricas` | 37 | 52 | 71 % |

Mediana de los 15 graficadores con renderer: **71 %**. Los otros 9 no tienen
renderer separado; su universo es la firma de `p_*` (7–38 args). Apiladas, el
más usado, está por encima de la mediana — la asimetría existe, pero no es
donde este doc decía.

Y el grupo `espacio` se usa en 4 de 24; el distribuidor de canvas, en 1.

**Por qué no se aplica.** Exponer más args no es aditivo: añadir 120 controles a
apiladas empeoraría todo, y reasignar un arg de grupo MUEVE un control de sitio,
que es justo lo que la restricción dura prohíbe sin decisión.

Lo que hace falta antes de tocar nada es **un criterio escrito** de qué merece
estar en la UI. Una propuesta de criterio, para discutir: está en la UI lo que el
analista cambia por estudio (no por mazo), lo que no se puede derivar del dato, y
lo que si sale mal se ve en la lámina. Lo demás vive en el preset y se toca por
código o por línea visual.

## Bitácora

*(una entrada por iteración: fecha, qué se midió, qué se cambió, evidencia)*

### 2026-08-10 · apertura
Cola inicial medida sobre `.GRAFICADORES_META` y la UI del proyecto real. Sin
cambios aplicados todavía.

### 2026-08-10 · iteración 1 — C-01, buscador de ajustes

**Medido antes.** La base visual «Multi-apiladas» del proyecto real expone
**55 ajustes** repartidos en cuatro grupos. Para cambiar el ancho del canal de
etiquetas había que saber de antemano en qué grupo vive; no existía forma de
buscarlo.

**Cambiado.** Campo de búsqueda en `PresetsEditor`, sobre los grupos de args.
Filtra por nombre técnico **y por lo que el ajuste hace** —etiqueta, descripción,
efecto, unidad— porque quien busca «ancho de las etiquetas» no sabe que el arg se
llama `canvas_w_etiquetas`. Acepta varios términos (todos deben aparecer). Con el
campo vacío no cambia nada: los grupos se dibujan igual que antes.

Respeta «añadir, no mover»: no se reorganizó ni se renombró ningún grupo, ni se
movió ningún control de sitio.

**Evidencia.** En la UI real, sobre «Conta 10-08», con Multi-apiladas activa:

| Búsqueda | Resultado |
|---|---|
| `etiqueta` | 16 de 55 |
| `ancho de las etiquetas` | **2 de 55** |
| `leyenda` | 6 de 55 |
| `color` | 4 de 55 |
| `zzzz` | sin resultados |

La búsqueda por frase natural llega a los dos ajustes correctos sin conocer el
nombre técnico. `pnpm exec tsc --noEmit` sale 0; vitest del feature, 47 archivos
y 313 tests en verde.

### 2026-08-10 · iteración 2 — C-06, los arreglos automáticos se declaran

**Medido antes.** 19 `message()` en el motor de gráficos, de los cuales tres
hablan al analista (columna Top 2 Box omitida, piso del eje del radar,
comparativo alineado por orden). Ninguno llegaba a la interfaz: el `message()`
acaba en el stderr del subproceso `callr`, el job lo escribe en `<job>.err` y
**nadie leía ese archivo**.

**Cambiado.** Los avisos destinados al analista llevan sello (`.pulso_aviso()`),
que es lo que permite separarlos del resto del stderr —progreso, locale, avisos
de paquetes— sin adivinar. Al completar el export se leen, se deduplican y se
acotan a ocho: un mazo de 67 láminas repite el mismo aviso una vez por lámina, y
al analista le sirve saber QUÉ pasó, no cuántas veces. Viajan en `result_data`,
que es el canal que el frontend ya consume, y se pintan con el `Alert` que ya
existe en la página.

Respeta «añadir, no mover»: ningún control cambió de sitio y el `message()`
original del comparativo sigue entero en el log, con su detalle de seis líneas;
lo que se añadió es un resumen de una línea para la interfaz.

**Evidencia.** Export real del `.pulso` del banco de prueba, por el worker de
producción (`graficos_job_worker_ppt` en subproceso `callr`):

    estado: done
    avisos que llegan al cliente: 1
      · La columna «top2box» se omite: la escala tiene 2 categoria(s) y
        sumarlas daria 100 % en todas las filas. Necesita al menos 3.

`tsc --noEmit` sale 0. Siete tests nuevos cubren el sello, la deduplicación, el
tope de ocho, y los casos vacíos (sin `.err`, sin líneas selladas, sesión
inexistente).

**Lo que NO se pudo observar en la UI.** El proyecto del banco arrastra un ícono
cuyo PNG no viaja en el `.pulso`, así que el export desde la app se bloquea antes
de renderizar. El aviso se verificó en el payload que el frontend consume, no en
el pixel. Queda pendiente verlo pintado en cuanto haya un `.pulso` sano.

### 2026-08-10 · iteración 3 — C-02, intentada y retirada

**Medido antes.** El inspector de lámina ya pinta la herencia (estado gris +
valor heredado) pero no dice de qué capa viene. `showOriginBadge` en `ArgField`
se apaga justo cuando el estado es `inherited`, que es cuando la pregunta
aparece.

**Cambiado y revertido.** Se añadió la procedencia por campo y funcionó —el
badge salía con el nombre correcto del tipo—, pero la medición en la UI real dio
**172 badges sobre 184 campos**, y **140** tras acotarlo a los que heredan un
valor real. A esa densidad el dato deja de informar. Se retiró entero y pasó a
§Propuestas P-A con las tres salidas posibles.

**Corrección de la cola.** C-02 estaba mal planteado: el panel SÍ explica las
capas —tiene un «FLUJO DE COPIA» y la cabecera dice «Base PPT · sin cambios
propios»—. Lo que falta es la capa concreta por campo, que es lo que P-A discute.

**Evidencia.** `tsc --noEmit` en 0 antes y después de revertir; 313 vitest en
verde; árbol limpio. Iteración **sin cambios aplicados en producto**: lo que
produjo es una propuesta medida y una corrección de la cola.

### 2026-08-10 · iteración 4 — C-07, guardar deja de ser mudo

**Medido antes.** `build_pulso()` copia solo los archivos referenciados y, cuando
uno ya no está en disco, hace `next` **en silencio** (`project_pulso.R`, bucle de
copia). El `.pulso` sale completo a la vista y roto al reabrirlo en otra máquina:
es exactamente lo que le pasó a «Conta 10-08», que viajó con un ícono cuyo PNG no
estaba y cuyo export moría entero con «Icono no encontrado».

**Cambiado.** El guardado devuelve `refs_perdidas` con las referencias que no
pudieron viajar, y el chip de proyecto —que es donde el analista mira si guardó—
lo dice, con el detalle y la salida en el tooltip. **Guardar no se bloquea**:
impedirlo sería peor que avisar.

El nombre prioriza el RECURSO sobre el archivo: «el ícono «Perfil»» le dice al
analista dónde volver a ponerlo; `file93102b62.png` —que es lo que sale cuando el
archivo se subió con nombre temporal— no le dice nada. Se descubrió al escribir
el test, que fallaba con el nombre del fichero.

Respeta «añadir, no mover»: el chip gana un estado, nada cambia de sitio.

**Evidencia.** Sobre el proyecto real:

    build_pulso(...) -> ok: TRUE · refs_perdidas: «el ícono «Perfil»»

Y por el endpoint real, con la petición del navegador:

    200 · {"ok":true, …, "refs_perdidas":["el ícono «Perfil»"]}

`tsc --noEmit` en 0; 316 vitest (tres nuevos del chip, con y sin referencias
perdidas, singular y plural); 214 en `test-project-pulso.R`, dos nuevos —uno
comprueba que un proyecto sano no reporta nada—.

**Lo que NO se pudo observar.** El chip pintado tras un guardado real: el único
camino que pasa por el hook es «Guardar como…», que usa el diálogo nativo de
Electron y no existe en el navegador de dev. Se cerró con un test de componente
en vez de darlo por hecho.

### 2026-08-10 · iteración 5 — descripciones que faltaban, y dos falsos positivos míos

**Lo que NO era.** Dos mediciones antes de acertar, las dos registradas porque
descartan hipótesis:

1. *Args expuestos que el motor no acepta*: 13 graficadores salían señalados,
   pero comparé contra `graficar_*` cuando la selección de datos (`var`, `cruce`,
   `excluir_opciones`) la consume el PLAN. Falso positivo.
2. Rehecho contra `p_*`, quedaban 3. También falso: los tres tienen `overrides`,
   por donde esos args viajan. **No hay controles huérfanos demostrables.**

**Lo que sí.** 61 de 227 args expuestos (27 %) no tenían descripción, en 16
graficadores. Importa más de lo que parece: el buscador de la iteración 1 busca
por lo que el ajuste HACE, así que un arg sin descripción es inencontrable salvo
que ya sepas su nombre técnico.

**Cambiado.** Nueve descripciones, cada una verificada contra lo que el motor
hace con ese argumento. `p_barras_categoricas` pasa de 8 sin describir a 1.

**Evidencia.** Con la semántica real del buscador:

    «cifra sobre barra» -> 2 · «partir etiqueta» -> 1 · «grilla» -> 1

460 tests de `test-graficos-argumentos-ui.R` en verde.

**Un descuido propio, y su hallazgo.** Una sustitución cayó en
`p_barras_agrupadas` en vez de `p_barras_categoricas` porque reemplacé por texto
sin anclar el bloque. Ahí la descripción **también era cierta**, así que quedó
como acierto colateral, pero rehice las restantes ancladas por posición. Y al
verificar apareció `C-08`: el buscador no normaliza tildes.

**Cola refrescada**: C-03, C-04 y C-05 pasan a §Propuestas P-B con su medición
—exponer más args no es aditivo—; entran C-08 y C-09.

### 2026-08-10 · iteración 6 — C-08 aplicado, y un catálogo que no sabía que existía

**Medido antes.** Buscar «mayusculas» devolvía 0 aunque el ajuste dijera
«MAYÚSCULAS»: el filtro comparaba literal. Quien escribe rápido no pone tildes.

**Cambiado.** El buscador normaliza tildes en los dos lados —consulta y texto—
con `NFD` + retirada de diacríticos. Es puro añadido: lo que se encontraba antes
se sigue encontrando.

**Evidencia.** En la UI real, con «Barras categóricas» activa:

    «normalizacion» -> 1 de 27      (antes 0)
    «grilla»        -> 1 de 27
    «zzzz»          -> sin resultados

Cinco tests nuevos cubren con y sin tilde, que exija todos los términos, el campo
vacío y el caso sin resultados. `tsc --noEmit` en 0; 321 vitest en verde.

**El hallazgo que no buscaba.** «mayusculas» seguía dando 0 después del fix. La
razón no era la tilde: **hay dos catálogos de metadata de args**, y la
descripción que escribí en la iteración 5 está en el que alimenta el inspector
de la lámina, no en el que alimenta el panel donde puse el buscador.

Medido: `.PRESETS_META` tiene **186 de 440 args sin describir (42 %)** contra los
53 de 227 del otro. Corrige lo que escribí en la iteración 5 —dije que las
descripciones y el buscador se reforzaban, y no es cierto en la misma
superficie— y abre `C-10`: el inspector de la lámina, donde el analista pasa la
mayor parte del tiempo, **no tiene buscador** y expone hasta 27 args por gráfico.

### 2026-08-10 · iteración 7 — el buscador llega al inspector de la lámina

**Medido antes.** El campo de búsqueda solo existía en el panel de Estilo
global. El inspector de la lámina —donde el analista pasa la mayor parte del
tiempo— expone hasta **50 ajustes** por gráfico y no tenía ninguno.

**Cambiado.** Buscador en `GraficadorForm`, con el mismo comportamiento. La
regla salió a `buscarAjustes.ts` y ahora la comparten las dos superficies: dos
copias se separarían —una aprendería a ignorar tildes y la otra no— y el
analista vería resultados distintos según por qué panel entró. El test de la
iteración 6 apuntaba a una copia local; ahora prueba el módulo real.

Aparece solo cuando el gráfico expone más de 6 ajustes: en uno de tres opciones
un buscador sobra.

**Evidencia.** En la UI real, en «4 gráficos + ícono»:

    «leyenda»   -> 5 de 50
    «etiqueta»  -> 15 de 50
    «numerico»  -> sin resultados, con su mensaje
    el campo sigue accesible tras una búsqueda sin resultados

`tsc --noEmit` en 0; 321 vitest en 49 archivos.

**Una trampa que me puse yo solo.** Al filtrar por búsqueda, `grupos` quedaba
vacío y el early return de «Sin opciones para configurar en este modo» se
llevaba por delante el propio buscador: el analista escribía algo que no existía
y perdía la forma de borrarlo. Los dos vacíos son distintos —no hay opciones vs.
no coincide la búsqueda— y ahora tienen caminos distintos. Se detectó revisando
el flujo, no con un test; queda como aviso para quien filtre otra lista.

**Sobre la densidad.** En una lámina de cuatro gráficos salen cuatro campos. A
diferencia del badge de la iteración 3, cada uno vive DENTRO de la tarjeta de su
gráfico y busca en sus propios ajustes, así que se lee como parte de esa tarjeta
y no como repetición. Verificado en pantalla antes de darlo por bueno.

### 2026-08-10 · iteración 8 — segunda tanda de descripciones, y un descarte más

**Medido antes.** `.PRESETS_META` —el catálogo del panel donde vive el
buscador— tenía **186 de 440 args sin describir**. Se atacaron los dos que usa
el mazo real: `multi_apiladas` (11 sin describir) y `barras_apiladas` (2).

**Cambiado.** Doce descripciones, contrastadas con la roxygen del motor y con lo
que el argumento hace de verdad. Total: **186 → 174**. `barras_apiladas` queda a
cero; `multi_apiladas`, en uno.

**Evidencia.** El payload que consume la UI, medido antes y después. 460 tests de
`test-graficos-argumentos-ui.R` y 9 del registro de defaults, en verde.

**El error que cometí.** La primera pasada insertó las descripciones DESPUÉS de
la línea de cada arg, y las entradas de una sola línea cierran con `),` ahí
mismo: quedaron doce entradas sueltas fuera de su `list()`, y el payload reventó
con «`$ operator is invalid for atomic vectors`». Se revirtió entero y se rehizo
insertando dentro del paréntesis. El fichero **parseaba** perfectamente — por eso
no bastaba con que R cargara: hizo falta llamar al payload.

**Medición nueva, sin hallazgo.** Se comparó el `default` que la UI declara
contra el del motor, buscando controles que muestren un valor que el motor no va
a usar. **20 comparables, 0 discrepan.** La cobertura es baja —la mayoría de
defaults del motor son expresiones o el arg no está en la firma de `p_*`— así que
descarta la hipótesis solo donde se pudo mirar. Quinto descarte del loop.

**Cola**: entra `C-11`, a medir, no a afirmar: el chip parece marcar «sin
guardar» tras solo abrir y navegar.

### 2026-08-10 · iteración 9 — C-11 descartado, y tercera tanda de descripciones

**C-11, medido y descartado.** La sospecha era que el chip dijera «sin guardar»
sin que el analista hubiera cambiado nada — un control que miente, del tipo de
las guías. No pasa:

    recién abierto · project_dirty = FALSE
    navegar / seleccionar lámina / abrir Estilo / buscar -> «hace 10 h»

Ninguna acción de solo lectura lo dispara. El «sin guardar» de las capturas de
las iteraciones 6 y 7 lo provoqué yo con acciones que sí cambiaban estado. Sexto
descarte del loop.

**C-09, tercera tanda.** El preset `base` —del que heredan todos los demás—
tenía 8 args sin describir, todos en entradas multilínea que la pasada anterior
saltaba. Tres descritas; **174 → 171**. Las cinco restantes tienen formas que el
inserto automático no cubre y quedan para la siguiente tanda.

**Evidencia.** El payload que consume la UI, medido antes y después. 486 tests R
en las tres suites del área, en verde.

**Iteración de saldo mixto**: un descarte y un avance parcial. Se registra así
en vez de inflar el descarte como si fuera un hallazgo.

### 2026-08-11 · iteración 10 — el mapa de lo que no está en la UI, y una corrección a mis propias cifras

Gonzalo pidió el mapeo de qué no está hoy en la UI y por qué. Al medirlo bien
descubrí que **las cifras que reporté en las iteraciones 5 y 8 estaban mal**.
Medí cada catálogo por separado, cuando un argumento expuesto en *cualquiera*
de las dos superficies sí está en la UI. Con la unión correcta:

| | mal (iter. 5 y 8) | real |
|---|---|---|
| `p_barras_apiladas` | 6/130 · 4,6 % | 82/130 · 63 % |
| `p_barras_agrupadas` | 19/102 · 18,6 % | 70/102 · 69 % |
| `p_barras_categoricas` | 20/52 · 38,5 % | 37/52 · 71 % |
| mediana de los 15 graficadores | — | **71 %** |

Los tres peores son `p_mapa_cobertura_territorial` (1/3), `p_media_rango`
(32/82, 39 %) y `p_boxplot` (30/62, 48 %). No `p_barras_apiladas`, que es el
que más se usa y está por encima de la mediana.

**Por qué falta lo que falta: un solo mecanismo, no varios.** Los dos catálogos
se escriben a mano y no se derivan de `formals()`. El router filtra por
`formals()` (`router_graficos.R:203`), así que el motor aceptaría cualquier
argumento que le llegara — pero no llega ninguno que no esté en el catálogo,
porque **ninguna superficie tiene un campo libre clave/valor**: «Estilos
guardados» reusa el mismo catálogo de presets (`OverridesEditor.tsx:30-31`).
El catálogo es el techo duro.

Y no había nada que vigilara la deriva en la dirección peligrosa. El contrato
existente corre en la dirección segura —nada del catálogo está muerto,
`test-graficos-metadata.R:210`—; la inversa estaba pinneada a 2 argumentos de
2 láminas (`test-graficos-slides-args-contrato.R:26`), un pin de una auditoría
vieja. Por eso 195 argumentos quedaron sin puerta sin que nadie lo decidiera.

De los 155 nombres distintos sin superficie, descontando los 21 que son
contrato interno o mecánica del export (`data`, `contexto`, `overrides`,
`ppt_*`, `path_salida`…), quedan los que sí son decisión de producto: la
familia semáforo/box a medias (`top3box_labels`, `semaforo_gradiente_*`),
los iconos del radar (`icono_modo`, `icono_size_radar`…), y controles de
orden y sentido (`invertir_series`, `orden_series`, `paleta_colores`).

**Aplicado**: `api/tests/testthat/test-graficos-deriva-catalogo-ui.R`. No exige
exponerlo todo — fija la línea base para que la brecha no crezca en silencio.
Un parámetro nuevo del motor sin superficie hace caer el test con el nombre y
las tres salidas posibles; exponer algo solo lo saca de la lista. Cumple
«añadir, no mover»: no toca ningún control, default ni nombre.

Verificado: 29 pass, y **probado que cae cuando debe** — saqué
`invertir_series` de la línea base y el test falló (FAIL 1); restaurado, verde.
Un segundo test evita nombres fósiles en la línea base, que taparían una
deriva real si el motor renombra un argumento.

Esto convierte P-B de pregunta abierta en cola priorizada: la decisión de qué
merece puerta sigue siendo de Gonzalo, pero ahora está acotada y no puede
crecer sola.

### 2026-08-11 · iteración 11 — el test de ayer estaba mal, y la app estaba bien

La cola tenía un solo ítem vivo (C-02, bloqueado en P-A), así que tocaba medir
algo nuevo. Medí el espejo del test de ayer: **un control del catálogo que el
motor descarte en silencio** sería un interruptor sin efecto — el caso exacto
que fundó el criterio 1.

**Resultado: cero controles muertos.** Y por el camino, tres correcciones a lo
que yo mismo había escrito.

**1. El router no llama a `graficar_*`.** Hay dos capas y el router llama a la
primera (`getExportedValue`, `router_graficos.R:402`):

- `p_<x>()` — constructor de spec del plan, 7–38 formals (`var`, `titulo`,
  `cruces`, `overrides`, `base`, `filtros`…). Es contra sus formals que filtra
  `.clean_rebuild_args()` en la línea 203.
- `graficar_<x>()` — el renderer, 17–130 formals. Recibe lo suyo por
  `overrides`, que es el canal libre entre ambas capas.

Mi test de ayer resolvía `graficar_*` y daba por hecho que era lo que se
llamaba. No lo era.

**2. Ese test se saltaba 9 de 24 graficadores en silencio.** Nueve no tienen
`graficar_*` (`p_donut`, `p_tabla`, `p_dim_*`…) y el `if (!is.function(fn)) next`
los pasaba de largo mientras el archivo decía cubrirlos todos. Un test que se
salta lo que no entiende es el falso verde que este loop existe para evitar.

**3. `acrconta` no sirve como banco de Gráficos.** Escribí un test apoyado en el
proyecto de referencia versionado; el blindaje anti-vacío (`expect_gt(visitados, 0)`)
lo tumbó al instante: su plan tiene **1 lámina y cero grafs**. Corregida la
cabecera de este doc, que lo listaba como banco.

**Lo que sí está sano.** Medido sobre el banco vivo (66 grafs): el plan real no
guarda **ni un** argumento fuera de la firma de su `p_*`, y 42 de los 66 llevan
`overrides` con contenido. La UI anida bien. Los 4 args catalogados que no son
formals de ninguna capa los consume el plan al renderizar, verificado uno por
uno: `mostrar_significancia`/`significancia_alpha` se leen de `overrides$…` en
`reporte_plan_ppt.R:5114`, e `iter_var`/`iter_level` en `dashboard_dimensiones.R:148`.

**Aplicado.** Reescrito `test-graficos-deriva-catalogo-ui.R` sobre terreno
verificado. Tres asertos: los 24 resuelven y la lista de los 9 sin renderer es
exacta; ningún arg del catálogo cae en el vacío; y el mecanismo del que todo
depende —anidado en `overrides` sobrevive, al ras se descarta—.

**Evidencia.** 54 pass, **0 skip**, y los tres falsificados de verdad: quitar
`p_donut` de la lista → FAIL; quitar `mostrar_significancia` de los consumidos
por el plan → FAIL; romper el anidado → FAIL. Restaurado, verde. Vecinos que
tocan los mismos catálogos, intactos: `test-graficos-metadata.R` 776 pass,
`slides-args-contrato` 49, `export-debug-ph` 17. Sin TS tocado, sin typecheck.

Iteración sin cambio de producto: solo test y doc. La app no tenía el problema
que fui a buscar; el problema lo tenía mi medición.

### 2026-08-11 · iteración 12 — el Word no contaba lo que el motor le hizo

La cola seguía con un ítem vivo, así que tocaba medir. Elegí auditar **mi propio
trabajo**: en la iteración 2 declaré C-06 cerrado añadiendo avisos del motor, y
quería comprobar que no hubiera construido otra tubería a ninguna parte —
exactamente el fallo de las guías de layout que fundó este loop.

**Medido.** De las tres vías de export, **sólo una devolvía los avisos**:

| Vía | `on_complete` | Devuelve avisos |
|---|---|---|
| PPT | `router_graficos.R:3290` | sí |
| ZIP multibase | `router_graficos.R:3390` | no |
| Word | `router_graficos.R:3455` | **no** |

Y el hueco era de verdad, no teórico: exportando Word el banco de prueba
(Conta 10-08), el motor generó **1 aviso** —«La columna top2box se omite: la
escala tiene 2 categoría(s) y sumarlas daría 100 % en todas las filas»— que se
quedaba en el stderr del job. El analista veía el Word con una columna menos y
ninguna explicación.

Lo que hacía el hueco barato de cerrar: `onExportDone` en el frontend **ya era
genérico** —lee `data.avisos` y lo pinta igual para `"ppt"` y `"word"`—. Era el
backend el que sólo lo mandaba en uno. Una línea.

**Falsa alarma que casi reporto.** Mi primer grep de `avisos` en el frontend se
truncó en `head -12` con coincidencias de Bitácora y del plan, y concluí que
nadie leía el campo. El tipo sí lo declara (`GraficosPage.tsx:43`). Verifiqué
antes de acusar; conviene seguir haciéndolo.

**Aplicado.** `avisos = I(.pulso_avisos_de_job(j$sid, j$id))` en el `on_complete`
de Word, más un contrato estático que exige el campo en **ambos** registros de
salida — si alguien lo quita de cualquiera de los dos, cae sin levantar un job
`callr` real.

**Evidencia.** End-to-end sobre el banco con la forma real del `on_complete`:
el aviso **llega** (1), lo que además confirma que `j$id` es el campo correcto
en el contexto del job — de no serlo habría devuelto vacío en silencio.
`test-graficos-export-debug-ph.R` 20 pass, y falsificado: quitar el campo del
Word da FAIL 1, restaurado verde. `test-router-graficos-lamina-borrador.R`
36 pass. `router_graficos.R` no está congelado. Sin TS tocado — el frontend ya
estaba listo—, así que no corresponde typecheck.

**A la cola: C-12.** El ZIP multibase sigue sin avisos, pero su flujo en el
frontend no tiene dónde pintarlos (`exportJob` sólo conoce `"ppt" | "word"`).
Añadirlo al backend a secas sería repetir el error que vine a buscar.
