# Cómo encajan los dos Sheets y la app — HSVG2026

Escrito el 2026-09-08, al cierre del día 2 de campo, con las tres piezas ya
funcionando. Es el mapa que faltaba: quién es dueño de qué, en qué dirección
viaja cada dato y en qué orden se sincroniza.

## La regla que lo gobierna todo

Gonzalo, 2026-09-08, textual:

> «Todo el contenido que se llena en la app lo lee del Sheets, y todo el
> contenido que coge información de plataforma y ordena toda esa información es
> la app, para nutrir la app y luego para nutrir el Sheets interno.»

De ahí salen las dos direcciones, y ninguna se cruza:

- **Lo que una persona teclea** vive en el Sheets y la app lo LEE. Nunca lo
  escribe. Son la agenda, los partes de campo, las hojas «(Extra)» y la
  distribución de aplicadores.
- **Lo que sale de plataforma y hay que ordenar** lo calcula la app, y va de la
  app al Sheets. Son la Base de control, el Plan del día, el Avance de campo y
  los denominadores.

Cuando una cifra existe en los dos sitios, manda quien la produce.

## Las tres piezas

### 1. Libro operativo — `11HV4-gmCGMfnWSczkkuO1f3yD0xG_wlwSh2jQtVrdPc`

Diez pestañas con tres dueños distintos.

| Pestaña | Dueño | Qué pasa al publicar |
|---|---|---|
| Aulas Agendadas | equipo | **respetada**: ni un request sobre ella |
| Aulas Agendadas (Extra) | equipo | respetada |
| Aulas Aplicadas (Campo) | equipo | respetada |
| Aulas Aplicadas (Extra) | equipo | respetada |
| Base de control | app | se reescribe entera |
| Plan del día | app | se reescribe entera |
| Avance de campo | app | se reescribe entera |
| Asignación de aplicadores | app | se reescribe entera |
| Disponibilidad de aplicadores | app | se reescribe entera |
| Avance de agendación | app | se reescribe entera |
| Tabla dinámica 2 | equipo | ni se mira |

**«Avance de agendación» (2026-09-09) es la hoja que reemplaza a «Tabla dinámica
2».** Aquélla la rehace el coordinador a mano sobre la agenda y sólo puede ver el
bloque titular: los once eslabones de reemplazo viven a su derecha, en la misma
fila, así que una dinámica sobre esa hoja no los alcanza. Con eso, un titular
rechazado cuyo R1 ya está agendado se lee igual que uno al que nadie ha llamado.
La hoja nueva trae cuatro tablas —por facultad, por semana, por día y por
eslabón— y está también en el `.xlsx`.

Dos cosas que hay que saber de las hojas del equipo:

- **Están en ESPEJO y ordenadas por curso-horario.** «Aulas Aplicadas (Campo)»
  jala cada fila de «Aulas Agendadas» **por número de fila**
  (`=TO_TEXT('Aulas Agendadas'!A2)`). Ordenar una de las dos a mano rompe la
  correspondencia en silencio: el parte de un aula acaba junto a la agenda de
  otra, y las dos hojas se ven bien por separado. Para mirarlas en otro orden,
  **Datos → Vistas de filtro**, que sólo cambia tu pantalla.
- Una pestaña del equipo con contenido no se toca ni para formato. Sólo se
  siembra cuando está vacía.

### 2. Distribución de aplicadores — `1-NmlPFRhq2G-JgNNEh_kOSFnZeTLKzpw9DrbZyCOBmE`

Es la hoja que abre cada aplicador por la mañana. **Una pestaña por semana**
(«Semana 1», «Semana 2»…), no una fija.

La app la localiza **por su cabecera, no por su nombre**: busca la pestaña cuya
primera fila trae `CURSO-HORARIO` y `FECHA`. Por eso funciona con cualquier
nombre de semana.

Doce columnas: `APLICADOR · DÍA · FECHA · EN OFICINA · SALE AL AULA · APLICA ·
CURSO-HORARIO · AULA · FACULTAD · CURSO · DOCENTE · ESTADO`.

- `APLICADOR` y `ESTADO` llevan **desplegable**, y su color sigue al VALOR de la
  celda. Cambias la persona y el color se recalcula solo. Las reglas llegan
  hasta la fila 600, así que toda fila nueva nace con ellos.
- Los cinco estados: `POR APLICAR` (amarillo), `APLICADA` (verde),
  `APLICADA POR REAGENDACIÓN` (verde azulado), `REAGENDADA` (naranja),
  `RECHAZADA` (rojo).
- Línea gruesa azul marino separando cada día.
- Las tres horas se derivan de la del aula: oficina 30 min antes, salida 15
  antes, aplicación de 30 minutos.

### 3. Kobo EU

La fuente de las efectivas. El cruce respuesta ↔ aula va por el **código
operativo** que viaja en el QR (`CH 7`), no por el `classroom_id` de la DTI.

## El orden de una jornada

Dos cosas pueden ir **en paralelo** porque no se conocen entre sí:

```
   [A] sincronizar Kobo            [B] leer la distribución
        (respuestas)                    (qué cambió el coordinador)
```

Y a partir de ahí todo es **secuencial**, porque cada paso usa lo anterior:

```
   1. Sincronizar Kobo                       respuestas del día
   2. Sincronizar la distribución            adopta, añade y refresca el ESTADO
   3. Publicar el libro                      lee agenda+partes y escribe sus hojas
```

**Desde el 2026-09-09 el paso 2 es UNO y se hace desde la app.** Antes eran tres
—leer, adoptar y, con un script, añadir las filas que faltaban y refrescar el
ESTADO—, así que la jornada dependía de que hubiera alguien con una consola
abierta. En Asignación: «Revisar cambios» es el ENSAYO y no escribe nada; el
botón que escribe aparece después y dice qué va a escribir.

Por qué ese orden y no otro:

- **1 antes que 3**: publicar sin sincronizar escribe el avance de ayer.
- **2 antes que 3**: sincronizar convierte las filas del coordinador en
  fijaciones. Sin eso, el motor recalcula el reparto entero en cada publicación y
  mueve asignaciones ya comunicadas.
- **2 después de 1**: el ESTADO se deriva de lo que la plataforma ya demostró.
- **3 lee antes de escribir.** La publicación importa las cuatro hojas del
  equipo ANTES de tocar nada (`lectura_previa` en el recibo). El día que no lo
  hacía, los partes que el encargado tecleaba eran invisibles para la app.

## Qué hace cada paso, en concreto

| Paso | Endpoint | Qué toca |
|---|---|---|
| Sincronizar | `POST /api/monitoreo/sync` | sólo el estado de la app |
| Leer distribución | `POST /api/monitoreo/aulas/leer-distribucion` | nada: sólo lee |
| Adoptar | `POST /api/monitoreo/aulas/adoptar-distribucion` | el reparto de la app |
| **Sincronizar** | `POST /api/monitoreo/aulas/sincronizar-distribucion` | el reparto **y** la hoja |
| Publicar libro | `POST /api/monitoreo/aulas/publicar-libro` | las 6 hojas de la app |
| Tablas para la app | `GET /api/monitoreo/aulas/avance-tablas` | nada: sólo lee |

`leer-distribucion` y `avance-tablas` no escriben en ningún sitio: se pueden
llamar cuando se quiera. `sincronizar-distribucion` sin `aplicar` tampoco.

**Publicar la distribución se NIEGA cuando la hoja ya tiene citas escritas**
(`E_AULAS_DISTRIBUCION_CON_DUENO`). Nació para sembrar el documento, cuando la
app era su única autora; desde que el coordinador edita ahí, publicar encima
borraría su trabajo de un request. Para eso está sincronizar.

**La ventana por defecto de sincronizar es la del REPARTO, nunca «todo».** Fuera
de su rango lo agendado está aplazado a propósito: sin acotar, el 08/09 proponía
añadir 28 filas de las semanas 2 a 4 que nadie había pedido.

## Lo que la app NO hace todavía

- **Nada corre solo.** No hay tarea programada: cada paso lo dispara una persona.
- **La columna `AULA UTILIZADA` no está en el libro VIVO.** Existe en el motor
  desde hace semanas, pegada a `STATUS MUESTRA`, y es la que dice CON CUÁL
  —«reemplazada por», «complementada con», «reforzada con» terminan en
  preposición por eso—. El documento en uso se generó antes de que existiera:
  sus bloques miden una columna menos.

## Lo que la app ya SÍ hace, y antes no (2026-09-09)

- **El cruce agenda ↔ distribución.** ¿Hay aulas agendadas a las que no va nadie?
  El 08/09 había seis y hubo que cruzarlo a mano. Ahora sale en el tablero con
  sus códigos, y un hueco manda sobre «el Sheets está al día»: son dos preguntas
  distintas y ésta es la que deja a alguien sin ir. `no_cubiertos` NO la
  contestaba: sólo lista las citas que ENTRARON al reparto y no hallaron a quién.
- **Añadir las filas que faltan y refrescar el ESTADO**, con el aplicador en
  blanco para que lo decida una persona, y sin pisar lo que el equipo tecleó.
  Una `RECHAZADA` no asciende nunca aunque lleguen respuestas: se declara como
  conflicto para que alguien lo mire.
- **Mirar las filas que YA están.** Una fecha que no parsea, una fila fuera del
  rango de su hoja o una sin curso-horario se dicen en el recibo. No se
  corrigen: son datos del coordinador.

**Por qué el aviso de filas dudosas vive en el recibo y no en el tablero**: el
tablero es una computación CACHEADA y sin red, y esas filas están en el
documento remoto. No es una preferencia de diseño, es de dónde sale el dato.

## Trampas que ya costaron tiempo

- **No ordenar a mano las hojas del libro.** Ver arriba: el espejo se rompe en
  silencio.
- **Nunca publicar la distribución sin leerla antes.** Escribirla la sobrescribe
  entera, y ahí viven las correcciones del coordinador.
- **Las fórmulas no viajan en RAW.** Escribir una fórmula con
  `valueInputOption=RAW` la deja como texto y la hoja se congela sin avisar.
- **Leer en modo FORMULA convierte las fechas en números de serie.** Reescribir
  lo leído así deja `46273` donde había `08/09/2026`.
- **Los secretos ya no dependen de la red**, pero si alguna vez vuelven a
  fallar todos a la vez, mirar si el mensaje dice «guardada pero no se puede
  descifrar» antes de buscar una sesión caducada.
