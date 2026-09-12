# Checklist — consistenciar el operativo de aulas (dictado 2026-09-12)

Dictado de Gonzalo, textual en lo que decide cada ítem: «me gustaría que todo
esté bastante consistenciado». Nueve indicaciones. Se marca conforme se cierran
y **sólo él lo da por terminado**. Cada vez que se mencione, se dibuja entero.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| C1 | «Avance de agendación» debería considerar las aulas **extra** agendadas | `carga_aulas_libro_agendacion.R` | ☑ `d061541b` |
| C2 | La jerga de la columna **«Slots»** no es buena | idem | ☑ `82dcd92c` |
| C3 | ¿La agendación considera el estatus nuevo **«REFUERZO POR CONTACTAR»**? ¿Es robusta ante estatus nuevos? | `monitoreo_aulas_estados_desconocidos.R` (nuevo) + recibo del import + `AulasFuentesDelEstudio.tsx` | ☑ `4822a441` |
| C4 | ¿«Aulas Aplicadas (Campo)» y «(Extra)» **pintan** las aulas pedidas como refuerzo? | `monitoreo_aulas_formato_respetadas.R` (nuevo) | ☑ `fddb13d5` + aplicado |
| C5 | El **morado** del refuerzo no se ve en STATUS MUESTRA | idem C4 | ☑ `fddb13d5` + aplicado |
| C6 | **«Plan del día» sigue con el `#REF!`** — que se solucione | `monitoreo_aulas_plan_dia_selector.R` | ☑ `8d915b9b` + aplicado |
| C7 | «Asignación de aplicadores» más clara, y sobre todo la **producción por aplicador** | `aulas_libro_produccion.R` (hoja nueva) + `aulas_libro_asignacion.R` | ☑ `41f1058c` `2c2e94d5` |
| C8 | **Disponibilidad de aplicadores**: añadir los **disponibles por semana** | `aulas_libro_disponibilidad.R` | ☑ `190033e7` |
| C9 | ¿La app hace la distribución **por semana a partir de una lista dada**, nombrándola «Semana N»? | idem + `AulasDisponibilidadDeAplicadores.tsx` | ☑ `1a046f0d` `9a1f4d9b` |

Leyenda: ☐ pendiente · ◐ en curso / medido sin cerrar · ☑ cerrado · ⛔ bloqueado
(espera decisión suya).

---

## Lo medido hasta ahora, por ítem

### C1 · las extra en «Avance de agendación»

**La app ya las contempla, pero sólo aparecen cuando existen.** La tabla total
lleva una fila «De reservas extra» — y está dentro de un
`if (any(extra))` (`.calan_total`), así que hoy no sale: **de las 45 filas de
«Aulas Agendadas (Extra)» del operativo, 0 tienen FECHA AGENDADA** (9 «REFUERZO
POR CONTACTAR», 36 «SIN CONTACTAR»). Es decir, lo que él ve no es un olvido: es
que todavía no hay ninguna.

Lo que sí es un defecto es la condición: **una fila que aparece y desaparece no
distingue «ninguna agendada» de «no se miran»**, que es exactamente la duda que
él tuvo. Este repo ya aplica la regla contraria en otros recibos («un cero se
dice, no se omite»).

Y las extra **no cuentan como «Slots»** a propósito y con razón documentada: no
reemplazan a nadie, y contándolas DERECHO salía con 61 slots donde el diseño le
puso 19. Eso se queda. Lo que falta es que se **vean** en su propia columna en
las tablas por facultad, semana y día, donde hoy sólo hay «De titulares» y «De
reemplazos» — y su respuesta a «¿o las estás metiendo en reemplazos?» es **no,
no están en ninguna de las dos**.

### C5 · por qué no se ve el morado

**La regla existe y es la primera de la lista** (`.mafs_REGLAS_STATUS_MUESTRA`,
`#F0E9F7` sobre `#5B2E86`, puesta el 2026-09-11 por su «que sea como de un
morado especial»). No se ve por otra razón: **«Aulas Agendadas» y «Aulas
Aplicadas (Campo)» son hojas del equipo y vuelven `respetada`**, y una hoja
respetada **no recibe formato nuevo** — sólo se le reenvía cuando cambia de
geometría. Los colores y desplegables nuevos se quedan en la app.

Eso convierte C4 y C5 en el mismo problema, y su solución es una decisión suya:
o el formato viaja aunque la hoja sea respetada (escribe formato, nunca
valores), o se acepta que esas dos hojas no se pinten.

### C6 · el `#REF!`

El diagnóstico está cerrado con el mensaje literal de Google: es un **resultado
cacheado** de un estorbo que ya no existe (B4 vacía, sin merges ni rangos
protegidos, 18 filas para una reserva de 24). `FILTER` no es volátil y abrir el
documento no recalcula. El arreglo está en código (`32030b5b`): al ver un error,
el publicador vacía la celda y vuelve a ponerla. **Falta ejecutarlo contra el
documento**, y eso es una escritura en el Sheets del operativo.

### C9 · una pestaña por semana desde una lista dada

**Sí lo hace, desde `a8d761ee` + `83d98403`.** El kit es
`monitoreo_aulas_reparto_por_semana()` + `.mads_hoja_para_semana()`, las semanas
se anclan al lunes de la primera aula agendada del plan, y el publicador escribe
**una pestaña por semana** respetando las que ya existen. Así se publicó
«Semana 2» del operativo con los 19 aplicadores sin Brenda.

Lo que queda por comprobar es **desde dónde se pide**: que la pantalla permita
elegir el roster y la semana sin pasar por una llamada a la función.


### C3 · cerrado — medido y blindado

Dos respuestas distintas, y la segunda era la que importaba:

· **«REFUERZO POR CONTACTAR» SÍ se reconoce**, con rama propia desde el
  2026-09-11 (`monitoreo_aulas_estado_muestra` → `refuerzo_por_contactar`), y
  está en el desplegable del libro. Medido sobre el operativo: **2.785 celdas de
  STATUS MUESTRA** en las cuatro hojas (12 bloques de cadena en «Aulas
  Agendadas», 12 en «Aplicadas (Campo)», 1 en cada Extra), **6 ortografías
  distintas, 0 desconocidas** — con sus 30 «REFUERZO POR CONTACTAR».
· **Pero no era robusto, y su instinto acertaba**: el traductor termina en un
  `default` que devuelve `sin_contactar`. Un estatus nuevo, o el mismo mal
  escrito, no falla ni avisa: se convierte en el estado de los titulares que
  nadie tocó, el aula **vuelve a la cola de llamadas** y se cuenta como
  pendiente. Es la avería que B13b ya documentó para «EN CONTACTO» y «RECHAZO».

Ahora el import lo declara —con el texto tal cual está en la hoja, cuántas filas
y la consecuencia— y sale en «Fuentes del estudio», junto al aviso de columnas
renombradas. El detector **no lleva su propia copia del vocabulario**: le
pregunta al traductor y declara lo que cae por el default, así que cuando el
traductor aprenda un estado nuevo el detector deja de declararlo solo.

**Instrumento corregido a mitad de medición**: mi primera lectura buscó
`STATUS MUESTRA` por igualdad exacta y encontró **1 columna** donde hay **12** —
los bloques de reemplazo rotulan con sufijo (`STATUS MUESTRA R1`…). Medía el
titular y nada más. Con el prefijo: 219 → 2.785 celdas.


### C7 · cerrado — dos hojas, no una columna

«Asignación de aplicadores» sale del reparto y existe antes de que nadie pise un
aula; **«Producción de aplicadores»** sale de los partes y sólo existe después.
Mezclarlas sería una palabra para dos cosas. La nueva lleva dos tablas: carga y
rendimiento por persona (aulas aplicadas, encuestas efectivas, **por aula**,
asistentes vistos) y el reparto entre las tres franjas del dictado — mañana
temprano (antes de 09:00), regular, noche (desde 18:00) — con los **nombres** de
quienes sostienen las dos caras.

Y la de asignación dejó de mentir: su columna «ESTADO DE APLICACIÓN» era la
**cadena literal «POR APLICAR»** en las 95 filas, lunes y martes incluidos con
sus partes ya rendidos (`2c2e94d5`).

**Medida contra el operativo, destapó un defecto real**: 87 aulas aplicadas, 21
mañana / 62 regular / 4 noche — y **dos personas contadas dos veces**. Agrupaba
por `aulas_nombre_aplicador()`, que su propia cabecera declara PRESENTACIÓN y no
identidad («sin coma no se reordena lo que no se sabe separar»): «Aquino
Dulanto, Alejandro» (2 aulas) y «Aquino Dulanto Alejandro» (2) eran dos
aplicadores, y «Chavez Espinoza» otros dos. Ahora agrupa por una clave que
ignora coma, tildes y mayúsculas, muestra la grafía de la casa y **declara las
dobles** para que alguien arregle la celda del parte.

### De la revisión de las diez pestañas

Censo completo en el encargo del loop. Una sola pestaña con error (`Plan del
día`, `A4=#REF!`), y una fragilidad medida: la reserva del área era de **24
filas para un día más cargado de 24** — cero margen, y el equipo agenda en vivo,
así que una sola aula más la rompía. Corregido en `cc14ca31`.

**Pestañas propuestas y aún sin decisión suya**: disponibles por semana (C8) y
un **semáforo de consistencia** que cruce el libro consigo mismo y con la app
—agendadas contra plan, aplicadas contra partes contra plataforma, citas contra
reparto— con su cifra a cada lado.


## C4 y C5 · cerrados y APLICADOS al documento

Gonzalo (2026-09-12): «Tienes mi go en todo y mi decisión es sí». Lo que
bloqueaba no era el color sino la regla de dueño: una hoja `respetada` no entra
al motor —así se protege el trabajo del equipo— y el efecto colateral era que
**ningún formato nuevo les llegaba nunca** después de la siembra.

El permiso se implementa **con un filtro, no con cuidado**
(`monitoreo_aulas_formato_respetadas.R`): cada request pasa por `.mafr_seguro()`
y sale sólo si declara tocar formato. Mira la **máscara `fields`**, no el tipo,
porque el tipo no distingue — el formateador del libro manda `updateCells` de
formato puro a diario.

**Aplicado al operativo y cotejado celda a celda**: 180 requests de formato a
las dos hojas del equipo, 0 descartados, y en la segunda pasada **0 celdas
distintas** en «Aulas Agendadas» (295.660 caracteres) y «Aulas Aplicadas
(Campo)» (374.053). Las reglas condicionales ya llevan **«REFUERZO POR
CONTACTAR»** en las dos hojas.

*(La primera pasada mostró una fila distinta en «Aplicadas (Campo)». No fue el
envío: dos lecturas seguidas sin escribir nada dieron 0 diferencias y la
segunda pasada completa también. Era el equipo editando en vivo. Se comprobó
en vez de suponerlo, que es la diferencia entre una verificación y una excusa.)*

## C6 · cerrado — y la hipótesis que le di era falsa

Le dije que era un valor cacheado y que bastaba con abrir el documento. **No lo
era.** La causa: la hoja se escribe como RECTÁNGULO y Sheets rellena las filas
de reserva con **cadena vacía** — `COUNTA` de una fila «vacía» da 20 —. Una
cadena vacía no es una celda vacía: `ISBLANK` la da por ocupada y `FILTER` no
se expande. Invisible desde fuera: `values.get` devuelve `""` para las dos.
El publicador ahora vacía el área con `values:batchClear` antes de poner la
fórmula. Aplicado: el bloque muestra las 18 aulas del viernes.


## C1, C2 y C8 · cerrados

**C1 — y era peor que su sospecha.** Preguntó si las extra estaban metidas en
reemplazos. No: **caían en TITULARES**. Las tablas por día y por semana
contaban `sum(!es_reserva)`, y una aula del banco tiene `es_reserva = FALSE`.
No se veía porque las 45 del banco están sin agendar; se habría visto el día
que alguien agendara la primera, y como un titular de más. Ahora «De reservas
extra» es columna propia y **las tres suman el total** —si una población se
cuela en dos, deja de cuadrar—, y la fila del total se dice aunque sea cero
siempre que el plan tenga banco.

**C2.** «Slots» → **«Aulas del diseño»**. El concepto se queda: la unidad es la
CADENA, un titular con todos sus reemplazos cuenta UNA, y por eso las extra no
entran. Antes de renombrar se buscó quién ancla por ese literal —aquí un
renombrado silencioso ya dejó una tabla sin color— y sólo lo leían los tests.

**C8 — y la hoja no podía contestarlo.** La disponibilidad es una matriz
día-de-la-semana × franja: sabe que alguien puede los martes, no que pueda el
martes 15. El bloque nuevo sale del REPARTO, que sí tiene fechas. Medido:
semana 1 → 19 aplicadores / 101 citas; semana 2 → 17 / 50 (salen Damaso,
Dolores y Panta; entra Álvarez Espinosa). Entran y salen van por NOMBRE: lo que
se hace con ese dato es llamar a esa persona.


## C9 · cerrado — y la mitad ya existía

Medido antes de construir, que fue la mitad del trabajo:

· **Elegir la semana YA se podía**: el «rango de despliegue» (B75) vive en la
  pantalla de Asignación, persiste en el config y re-particiona el reparto; la
  pestaña se nombra sola «Semana N».
· **Lo que faltaba era la LISTA**: dejar a alguien fuera obligaba a editar el
  Excel de disponibilidad y volver a cargarlo — literalmente lo que se hizo a
  mano para la semana 2 con los 19 sin Brenda.

Clave `reparto_fuera` en el config + `monitoreo_aulas_disponibilidad_sin()`, y
el control en la malla de oferta, que es donde se ven los nombres. Tres
decisiones del diseño:

1. **Se quita ANTES de repartir.** Quitarle las citas después dejaría huecos en
   vez de pasárselas a quien sí sale.
2. **Los nombres se comparan por clave**, ignorando coma, tildes y mayúsculas:
   compararlos literales no dejaría fuera a nadie. Misma lección que partió a
   dos personas en cuatro en la hoja de producción.
3. **Si quitar a alguien descubre un aula, se declara** en `no_cubiertos`; y la
   lista de quién está fuera **se muestra aunque no se pueda editar**. Una
   decisión que cambia el reparto y no se ve es media avería.

**Las nueve indicaciones del dictado están cerradas.** Quedan dos cosas que no
son del dictado: el **semáforo de consistencia** (propuesto, sin respuesta) y la
**inconsistencia abierta** 85 / 73-75 / 87, sin medir.

## La publicación al documento — qué llegó y qué hubo que restaurar

Con el go explícito de Gonzalo, y con **respaldo previo de las diez pestañas**
(126.153 celdas a un `.rds`), que es lo que hizo reversible lo que vino después.

**Llegó al documento:**
· **«Producción de aplicadores»**, hoja nueva (48 filas).
· «Avance de agendación» con la columna de extras y el aviso de CH 143.
· «Plan del día» sin el `#REF!` y con el área ya vaciada de verdad.
· El formato nuevo a las dos hojas del equipo: 180 requests, 0 descartados.

**Hubo que restaurar dos hojas, y el motivo es mío, no del motor.** Publiqué con
el estado reconstruido leyendo el propio Sheets, y ese round-trip no devuelve
todo lo que tiene la sesión:

| hoja | qué se perdió | restaurada |
|---|---|---|
| «Avance de campo» | de 181 filas a 105: el bloque por facultad × aplicador necesita `efectivas` (respuestas de plataforma), que sólo tiene la sesión | ✓ 0 celdas distintas |
| «Base de control» | 3.555 celdas: la ola `M1` de toda la columna A, los contadores de los tres filtros y sus rótulos | ✓ 0 celdas distintas |

Y una trampa que costó dos intentos: **una celda combinada se traga la
escritura**. El `PUT` devolvía `updatedCells: 1` y la celda seguía vacía, porque
la publicación corta había combinado celdas según SU contenido y las filas
restauradas caían dentro. Se descombina primero (`unmergeCells`) y, si la hoja
va a quedar más estrecha, se vacía entera antes de escribir.

**Las cuatro hojas del equipo: 0 celdas tocadas por la publicación.** Las
diferencias que aparecieron entre lecturas eran partes que alguien estaba
tecleando en vivo (un aplicador, fecha 11/09, hora 14:34, aula D206).

**Regla que queda**: el libro se publica **desde la sesión de la app**, no desde
un estado rearmado leyendo el documento.

## La publicación rompió «Avance de agendación», y tardé siete horas en verlo

**Lo que pasó.** Publiqué con el plan reconstruido leyendo el Sheets. En esa
relectura **las 1.173 reservas de cadena vuelven sin su titular** —el libro no
guarda ese vínculo en ninguna columna: la cadena vive en la geometría de la
hoja—, así que cada reserva cuenta como su propia cadena. La columna «Aulas del
diseño» pasó de **19, 20, 37, 22…** (170 cadenas, las del diseño) a sumar
**1.372**. Es la hoja que el coordinador mira para saber cuánto falta por
agendar.

**Por qué no lo vi al cotejar.** Para las hojas del EQUIPO hice el cotejo celda
a celda —0 diferencias—. Para las de la APP miré sólo la forma: filas y
celdas. «Avance de agendación» pasó de 558 a 575 celdas y **yo tenía la
historia**: acababa de añadirle la columna de reservas extra y el aviso de
CH 143. Cuadraba, y dejé de mirar. **Una explicación plausible del cambio no es
una verificación del contenido.**

**Cómo apareció.** Midiendo una consecuencia que yo mismo había AFIRMADO sin
medir —«diría 1.392 donde el diseño puso 219»—. Era cierta, y además ya estaba
publicada.

**Estado ahora.** Restaurada desde el respaldo: 0 celdas distintas. Con ella son
**tres** las hojas de la app que hubo que devolver (Base de control, Avance de
campo y ésta). En el documento quedan sólo los dos cambios buenos: «Producción
de aplicadores» nueva y «Plan del día» sin su `#REF!`.

**Regla que queda, y es la tercera vez que este día la escribe:** el libro se
publica **desde la sesión de la app**. Y el cotejo de una publicación va celda a
celda en TODAS las hojas, también en las que cambiaron a propósito.
