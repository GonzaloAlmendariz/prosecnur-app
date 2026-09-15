# Tramos del operativo — dictado de Gonzalo del 2026-09-15

> «Debería tener un mecanismo para poder ir recordando la aplicación de semana
> a semana y actualizándolas a lo que el excel diga también, y cuando se cree
> una nueva semana de aplicación la app ya las sabe.»

Y la corrección que cambia el diseño, cuando le pregunté si mandaba la semana
de calendario:

> «Es que más que semana en el estricto senso, con rango a los que llamamos de
> forma personalizada; en este caso seleccioné dos rangos semanales y les puse
> Semana 1 y Semana 2, pero puede ser otro rango con otros nombres.»

**Qué se guarda y qué se deriva.** El rango y su nombre son una decisión suya y
no se pueden deducir de ningún sitio: se guardan. Todo lo demás —cuántas citas
tiene el tramo, cuántas se aplicaron, cuántas van sin aplicador— sale del plan
y de los partes en cada actualización, que es lo que él eligió («lo derivado
del plan»). Un conteo guardado envejece en silencio; uno derivado no puede.

**Por qué hace falta.** Hoy el filtro que decide qué filas se añaden a
«Distribución de aplicadores» es `reparto_rango`, un valor ÚNICO del proyecto
que sólo se teclea a mano. El 2026-09-15, en plena semana 2, seguía en
«07/09 → 12/09»: 70 citas agendadas quedaban fuera y el recibo decía «0 aulas
por añadir». El nombre de la pestaña, en cambio, se deriva de la semana de
calendario del plan — dos mecanismos distintos para la misma idea, y sólo uno
se actualiza solo.

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| T1 | Los tramos `{nombre, desde, hasta}` se guardan en la config y persisten | whitelist de `monitoreo_aulas_normalize_config()` | ☑ |
| T2 | Motor que deriva el estado de cada tramo desde el plan | `monitoreo_aulas_tramos.R` (nuevo) | ☑ |
| T3 | Sin tramos declarados, las semanas de calendario de siempre | mismo motor, como respaldo | ☑ |
| T4 | El tramo VIGENTE es el que contiene hoy | mismo motor | ☑ |
| T5 | El sincronizador usa el tramo vigente cuando no hay rango explícito | ruta de `sincronizar-distribucion` | ☑ con tramos declarados |
| T6 | UI para crear, nombrar y listar tramos | pendiente, siguiente tanda | ☐ **lo único que falta** |

## Decisiones tomadas

- **El nombre del tramo NO renombra la pestaña.** Renombrar una pestaña viva
  mueve el documento debajo de veintidós personas, y hoy los nombres derivados
  («Semana 1», «Semana 2») coinciden con los suyos. El nombre se usa para
  elegir y para hablar, no para reescribir la hoja.
- **`reparto_rango` no se borra**: pasa a ser la excepción explícita —«quiero
  mirar la semana 3»— y manda mientras esté puesto, con el aviso que ya
  advierte cuando deja citas fuera.

## Medido antes de construir (2026-09-15, plan del operativo)

Las citas agendadas caen en cuatro tramos, y los dos que él nombró son los dos
primeros:

| Tramo | Fechas | Citas |
|---|---|---|
| Semana 1 | 07/09 → 12/09 | 96 |
| **Semana 2** | **14/09 → 18/09** | **54** |
| (sin nombrar) | 21/09 → 24/09 | 12 |
| (sin nombrar) | 29/09 → 01/10 | 4 |

## Cerrado el backend (2026-09-15)

Sobre el operativo real, sin declarar nada —el respaldo por semanas— y
declarando los dos tramos que él nombró, la misma respuesta:

| Tramo | Fechas | Citas | Aplicadas | Por aplicar |
|---|---|---|---|---|
| Semana 1 | 07/09 → 12/09 | 96 | 86 | 10 |
| **Semana 2** | **14/09 → 20/09** | **54** | 1 | 53 | ← vigente |
| Semana 3 | 21/09 → 27/09 | 12 | 0 | 12 |
| Semana 4 | 28/09 → 04/10 | 4 | 0 | 4 |

Y una fecha escrita que no se deja leer, contada aparte en vez de repartida a
ojo entre los tramos.

**T6, lo que falta**: la pantalla para crear un tramo, ponerle nombre y verlos
en lista. El endpoint de config ya los acepta y los persiste —fusiona el body
sobre lo guardado, clave a clave—, así que el mecanismo funciona hoy por API;
lo que no existe todavía es dónde pulsarlo.
