# Checklist — consistenciar el operativo de aulas (dictado 2026-09-12)

Dictado de Gonzalo, textual en lo que decide cada ítem: «me gustaría que todo
esté bastante consistenciado». Nueve indicaciones. Se marca conforme se cierran
y **sólo él lo da por terminado**. Cada vez que se mencione, se dibuja entero.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| C1 | «Avance de agendación» debería considerar las aulas **extra** agendadas | `carga_aulas_libro_agendacion.R` `.calan_total`, `.calan_facultad`, `.calan_semana`, `.calan_dia` | ◐ medido |
| C2 | La jerga de la columna **«Slots»** no es buena | `AULAS_AGENDACION_CABECERAS$facultad` + su nota al pie | ☐ |
| C3 | ¿La agendación considera el estatus nuevo **«REFUERZO POR CONTACTAR»**? ¿Es robusta ante estatus nuevos? | `monitoreo_aulas_estados_desconocidos.R` (nuevo) + recibo del import + `AulasFuentesDelEstudio.tsx` | ☑ `4822a441` |
| C4 | ¿«Aulas Aplicadas (Campo)» y «(Extra)» **pintan** las aulas pedidas como refuerzo? | `monitoreo_aulas_sheets_formato.R` | ☐ |
| C5 | El **morado** del refuerzo no se ve en STATUS MUESTRA | idem C4 + `respetada` por hoja | ◐ causa identificada |
| C6 | **«Plan del día» sigue con el `#REF!`** — que se solucione | `monitoreo_aulas_plan_dia_selector.R` (arreglado en código) | ◐ falta ejecutarlo |
| C7 | «Asignación de aplicadores» más clara, y sobre todo la **producción por aplicador** | `aulas_libro_produccion.R` (hoja nueva) + `aulas_libro_asignacion.R` | ☑ `41f1058c` `2c2e94d5` |
| C8 | **Disponibilidad de aplicadores**: añadir los **disponibles por semana** (la 1 tenía ~21–24; ahora menos) | `carga_disponibilidad_aplicadores` + su hoja | ☐ |
| C9 | ¿La app hace la distribución **por semana a partir de una lista dada**, nombrándola «Semana N»? | `monitoreo_aulas_distribucion_semanas.R`, `monitoreo_aulas_publicar_distribucion.R` | ◐ medido |

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
