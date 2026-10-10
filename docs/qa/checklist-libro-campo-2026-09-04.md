# Checklist · El libro de campo dice de dónde viene cada dato (dictado 2026-09-04)

Tipo: Checklist de dictado
Estado: En curso
Fecha: 2026-09-04
Autoridad: Dictado de Gonzalo. Evidencia de QA; no reemplaza un ADR

Superficie: la hoja **«Aulas Aplicadas (Campo)»** del libro operativo y del
Google Sheets, más el vocabulario de estados de la cadena.

| # | Indicación (sus palabras) | Dónde vive | Estado |
|---|---|---|---|
| 1 | «En Aulas Aplicadas Campo tiene que haber paleta de colores para los encabezados en función de la función que tenga: distinguir lo que viene de la agenda de lo que es genuinamente de campo, lo que se llena manual de lo automático» | `carga_aulas_libro_formato.R`, segunda fila de cabecera | **hecho, verificado sobre el .xlsx** |
| 2 | «Y ese es un criterio que aplica a todas las hojas» | parámetro `funciones` por hoja en `aulas_libro_aplicar_formato`; hoy sólo lo declara Campo | **hecho el mecanismo** |
| 3 | «Aulas Agendadas ya lo tiene y no hace falta tocarlo» | la banda de eslabón ya colorea su cabecera | **nada que hacer** |
| 4 | Estado «Reemplazada por» para el caso A (aula rechazada o no aplicada, reemplazo en sentido estricto) | `AULAS_LIBRO_STATUS_APLICACION` | **hecho** |
| 5 | Estado «Complementado con» para el caso B (el aula no rinde y se toma su cadena u otro reemplazo) | ídem | **hecho** |
| 6 | Columna nueva «AULA UTILIZADA» al lado de STATUS MUESTRA, que diga cuál reemplazo se usó | spec `AULAS_AGENDADAS_BLOQUE` + `aulas_libro_anotar_aula_utilizada()` | **hecho** |
| 7 | El caso C (se va a un reemplazo por falta de alumnos o de un sexo para la meta) | estado propio «Reforzada con», elegido por el usuario | **hecho** |
| 8 | «El Sheets debería tener una forma muy elegante de mostrar la disponibilidad de cada encuestador, para que el equipo de campo sepa cuándo o a quién reclutar y no dependa enteramente de mí» | hoja «Disponibilidad de aplicadores» (`aulas_libro_disponibilidad.R`) | **hecho, en el .xlsx y en el publicador** |
| 9 | «Le estás dando 4 seguidas a una cuando tranquilamente le puedes dar 2 seguidas a dos personas; hay que balancear equidad, horarios y concentración» | greedy de `monitoreo_aulas_reparto()` | **hecho** |
| 10 | «El cuadro no muestra la facultad» | tabla de Asignación y hoja del libro | **hecho, verificado en la app** |

## Lo que ya está resuelto y no hay que reinvestigar

- **Los tres casos ya están modelados.** `frontend/src/features/monitoreo/
  profiles/aulas/relacionDeReserva.ts` (del dictado 2026-09-03, «yo sé que se
  llaman reemplazos pero no siempre reemplazan en ese sentido de la palabra»)
  devuelve `reemplaza` para A, `complementa` para B y `refuerzo` para C, leyendo
  el `sample_status` del titular de la cadena. **Hoy no lo consume nadie**: está
  sin `git add` desde esa sesión. El vocabulario nuevo del libro debe salir de
  ahí, no de una segunda lectura.
- **Una columna nueva junto a STATUS MUESTRA llega a las dos hojas.** La hoja de
  campo compone sus bloques con `.calg_titulos_agenda()`, que toma el primer
  título de cada entrada de `AULAS_AGENDADAS_BLOQUE` (`carga_aulas_agendadas.R`).
  Añadir la entrada después de `sample_status` la pone en Agendadas y en Campo
  de una vez, con su arrastre y su formato heredados por la spec.
- **En el Sheets vivo esa columna NO aparecerá sola.** «Aulas Agendadas» y
  «Aulas Aplicadas (Campo)» son del equipo: la app las siembra sólo si están
  vacías y con cualquier contenido las declara `respetada`. La columna llegará
  en el `.xlsx` regenerado y en una siembra nueva, no sobre la hoja que están
  llenando. Es la protección que pidió, y también su límite.
- **Qué grupos de función tiene hoy la hoja de campo**, por bloque de eslabón:
  el código, el eco de la agenda (`.calg_titulos_agenda`), los dos denominadores
  que pone la app (`MATRICULADOS TOTAL DTI`, `MATRICULADOS ELEGIBLES`), lo que
  se teclea en campo (aplicador, fecha, hora, aula, asistentes, rechazos,
  duplicados, efectivas, estado, enlace, observaciones) y una calculada
  (`% ASISTENCIA`).
- **El color del encabezado ya está ocupado por el eslabón.** La banda pinta
  TODAS las filas de cabecera del bloque con el tono de su eslabón
  (`AULAS_LIBRO_PALETA_ESLABON`). La paleta por función tiene que vivir en la
  SEGUNDA fila, o las dos pistas se pisan.

## Verificado el 2026-09-04

La paleta cae exacta sobre el `.xlsx` generado: `ID MATCH` y los dos
denominadores en el gris de la app, las 23 del eco de la agenda en azul pálido,
las once que se teclean en campo en ámbar y `% ASISTENCIA` en verde. La fila 1
conserva el navy del eslabón.

**Un tropiezo de método que conviene no repetir.** La primera lectura del `.xlsx`
la hice con un parser de XML propio y salió todo desplazado un puesto: parecía un
defecto del generador cuando el defecto era del lector. `openpyxl` es fiable,
pero revienta con estos libros porque openxlsx deja una relación a
`xl/drawings/drawing1.xml` que no existe; se lee bien tras copiar el zip quitando
esas `<Relationship>`. Y la paleta original tenía los cuatro tonos a 15-21 de
distancia RGB, o sea cuatro casi-blancos indistinguibles: lo cazó el test de
distancia, no el ojo.

## Cableado al publicador (2026-09-04)

La hoja entra por los cinco puntos que su hermana de asignación ya usaba:
nombre de pestaña, cuenta de filas de cabecera (una, por su título), juego de
`hojas_app` cuando hay oferta, `producidas`, y sus requests de formato. Más el
sexto que no es opcional: la **whitelist** de `monitoreo_sheets_pestanas_
controladas()`, sin la cual `.monitoreo_sheets_validate_controlled_tabs()` frena
la escritura con `E_GOOGLE_SHEETS`. Hay un test que la sujeta.

Se produce **sólo con oferta cargada**, y a diferencia de la asignación no
depende del plan: la disponibilidad existe aunque el reparto todavía no tenga
nada que repartir. La reaserción por hash la cubre sola, porque ese bucle
recorre `hojas_app`.

**Un descuadre que dejé yo y quedó fijado.** Al entrar `FACULTAD`, la hoja de
asignación pasó de ocho columnas a nueve y el centrado del formato de Sheets
seguía apuntando a los índices de ocho: centraba LUGAR y APLICADOR, que son
justo los textos que no se centran. Es el tipo de descuadre que sólo se ve
abriendo el Sheets, así que ahora hay un test que comprueba a qué columnas
apunta.
