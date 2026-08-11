# GOAL — la interfaz de Gráficos dice la verdad y se deja encontrar

**Abierto**: 2026-08-10 · **Cierra**: solo Gonzalo · **Cadencia**: continua
**Banco de prueba**: `~/Documents/Pulso/ACRD CONTA/Conta 10-08 equivalencias.pulso`
(4 bases, 67 láminas, 50 gráficos) y `api/inst/reference_projects/acrconta/`.

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

### C-02 · Dos superficies para el mismo gráfico, sin señal de cuál manda
El inspector de la lámina expone `Contenido / Datos / Estilo / Filtros`; el panel
global expone los mismos tipos de gráfico con otros ajustes. `canvas_w_etiquetas`
solo está en el global; `mostrar_valores` está en los dos. Nada dice qué gana.
**La precedencia ya existe** (motor → Pulso → base del proyecto → tipo → slide) y
está comentada en `.enriquecer_presets()`. Falta mostrarla donde se decide.

### C-03 · El distribuidor de canvas está en 1 de 24 graficadores
Medido sobre `.GRAFICADORES_META`: solo `p_barras_agrupadas` expone un argumento
`canvas_*` en su UI. Los demás reparten su espacio con valores que el analista no
ve ni puede tocar desde el gráfico. No implica que deban exponerlos todos —sí que
la asimetría hoy no responde a ninguna razón declarada.

### C-04 · La superficie expuesta por graficador es dispar sin criterio visible
`p_barras_apiladas` expone **6** argumentos; `p_histograma`, **23**; el motor de
apiladas acepta ~140. La asimetría no sigue ni la complejidad del gráfico ni su
uso. Hace falta un criterio escrito de qué merece estar en la UI.

### C-05 · `espacio` aparece en 4 de 24 graficadores
El vocabulario de grupos es `datos · valores · lectura · espacio · diagnostico ·
tabla`. `espacio` solo se usa en 4. O el grupo sobra, o a 20 graficadores les
falta declarar ahí lo que ya tienen.

### ~~C-06 · Los arreglos automáticos no se declaran~~ ✅ 2026-08-10
El motor achica la letra del eje cuando no cabe (piso 9,6 pt), acota el wrap al
canal, apaga el Top 2 Box en escalas de 2 categorías, reparte la leyenda en filas
parejas. Todo eso es bueno y evita trabajo manual — pero **el analista no se
entera**, y cuando su 14 pt sale a 9,5 cree que hizo algo mal. Los avisos ya
existen como `message()` en el motor; no llegan a la interfaz.

### C-07 · Un `.pulso` puede guardarse con referencias colgando *(acotado)*
El proyecto del 10-08 declara un ícono cuyo PNG no viaja en el zip. **Corrección
del 2026-08-10**: la app SÍ avisa al abrirlo —«El ícono … ya no está disponible
en el catálogo», con la salida sugerida—. Lo que falta es el aviso al **guardar**,
que es cuando la referencia se rompe y cuando todavía se puede arreglar sin
haber entregado nada.

## Propuestas — esperan decisión de Gonzalo

*(vacío al abrir; aquí van los cambios estructurales que el loop encuentre)*

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
