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
| Tabla dinámica 2 | equipo | ni se mira |

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
   2. Adoptar la distribución  (si cambió)   el reparto pasa a ser el suyo
   3. Publicar el libro                      lee agenda+partes y escribe las 5 hojas
   4. Actualizar la distribución             ESTADO al día y filas nuevas
```

Por qué ese orden y no otro:

- **1 antes que 3**: publicar sin sincronizar escribe el avance de ayer.
- **2 antes que 3**: adoptar convierte las filas del coordinador en fijaciones.
  Sin eso, el motor recalcula el reparto entero en cada publicación y mueve
  asignaciones ya comunicadas.
- **3 lee antes de escribir.** La publicación importa las cuatro hojas del
  equipo ANTES de tocar nada (`lectura_previa` en el recibo). El día que no lo
  hacía, los partes que el encargado tecleaba eran invisibles para la app.
- **4 al final**: el ESTADO se deriva de lo que la plataforma ya demostró, así
  que necesita el paso 1 hecho.

## Qué hace cada paso, en concreto

| Paso | Endpoint | Qué toca |
|---|---|---|
| Sincronizar | `POST /api/monitoreo/sync` | sólo el estado de la app |
| Leer distribución | `POST /api/monitoreo/aulas/leer-distribucion` | nada: sólo lee |
| Adoptar | `POST /api/monitoreo/aulas/adoptar-distribucion` | el reparto de la app |
| Publicar libro | `POST /api/monitoreo/aulas/publicar-libro` | las 5 hojas de la app |
| Tablas para la app | `GET /api/monitoreo/aulas/avance-tablas` | nada: sólo lee |

`leer-distribucion` y `avance-tablas` no escriben en ningún sitio: se pueden
llamar cuando se quiera.

## Lo que la app NO hace todavía

- **El cruce agenda ↔ distribución no es automático.** Hoy se corre a mano y
  contesta la pregunta que importa: ¿hay aulas agendadas a las que no va nadie?
  El 08/09 había seis.
- **Añadir las filas que faltan tampoco.** Se hizo con un script.
- **Nada corre solo.** No hay tarea programada: cada paso lo dispara una persona.

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
