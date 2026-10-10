# Avance, superficie por superficie, contra su norte

Tipo: Auditoría QA de superficie
Estado: En curso
Fecha: 2026-08-29
Autoridad: Norte dictado por Gonzalo. Evidencia de QA; no reemplaza un ADR

**Abierta** 2026-08-29 · **Sobre** `HSVG2026_sem15_campo_malo.pulso` (1.424 aulas
de plan, 1.595 respuestas, 152 aulas aplicadas).

## El norte

Gonzalo, textual: **«lo que me interesa es que TODAS LAS FACULTADES CUMPLAN CON
SU CUOTA DE SEXO. Ese es lo fundamental de todo esto, y veo que no se entiende
bien.»**

Y el diagnóstico que abre esta auditoría: «avance tiene muchos gráficos y muchas
cosas, pero siento que todos no entienden bien qué es lo que estamos haciendo…
no siento que te hayas puesto a pensar seriamente sobre qué hace avance, qué
pestañas muestran qué cosa, si es coherente el orden».

## La cuenta

**26 superficies en cinco pestañas.** Medido por grep sobre los componentes:

| pestaña | superficies | ¿conocen el sexo del alumno? |
|---|---:|---|
| Resumen | 7 | **0 de 7** |
| Estratos | 2 | 1 de 2 (la que se acaba de cambiar) |
| Cuotas | 7 | **7 de 7** |
| Rendimiento | 9 | 2 de 9 (`SerieDeRendimiento`, `AlertaDeAnticipacion`) |
| Efectividad | 1 | 0 de 1 |

**De 26 superficies, 10 hablan de facultad × sexo. Las otras 16 hablan del
operativo**: aulas aplicadas, ritmo, banco, estados, cobertura.

Eso no es un defecto por sí solo —el operativo hay que verlo— pero sí explica la
sensación: **el norte ocupa una pestaña de cinco**, y las otras cuatro compiten
por la atención con preguntas que no son la que decide.

## Lo que ya se reparó al hacer esta auditoría

| # | Hallazgo | Estado |
|---|---|---|
| A | La fecha salía del parte de campo, vacío en los 152. Las 1.595 respuestas la traían completa. Nueve módulos leen esa fecha: serie, ritmo, pronóstico, corte | **cerrado** `8b754bec` |
| B | El gráfico de estratos usaba el sexo DOMINANTE DEL AULA, no el del alumno | **cerrado** `5c49ecba` |
| C | Decimales en personas: «236.1 respuestas», «faltan 1,683.9» | **cerrado** `5c49ecba` |
| D | La barra ámbar se llamaba «faltan» siendo el déficit proyectado | **cerrado** `5c49ecba` |
| E | Del parte publicado sólo `operational_code` llega con valor; **los otros 13 campos vacíos en los 152** | **abierto** |

## Lo que queda por decidir, y es suyo

1. **El orden.** Hoy: Fuentes · Agenda · Validación · Consultas · Avance. Y
   dentro de Avance: resumen · estratos · cuotas · rendimiento · efectividad ·
   salidas. La pestaña que contesta el norte —cuotas— es la tercera de seis.
2. **Qué sobra.** 16 superficies no tocan el sexo. Algunas son necesarias
   (cobertura, estados); otras contestan la misma pregunta dos veces.
3. **El hallazgo E**, que hace que «Partes de campo» enseñe 152 filas con sólo
   un código.

**Nada de esto se toca sin su palabra.** El error de esta sesión fue construir
antes de entender.

---

# Propuesta de estructura

**Encargo suyo, 2026-08-29**: «la pestaña más importante debería estar al
inicio… pero también quiero que te plantees no solo estas seis pestañas, cómo
mejorar cada una, sino pueden haber más, pueden haber hasta dos más, pero todas
tienen que tener un propósito real».

## El orden ya cambió

`a756bafd`: **Cuotas · Resumen · Estratos · Rendimiento · Efectividad · Salidas**.

## Qué propósito tiene hoy cada una, medido

| pestaña | superficies | la pregunta que contesta | veredicto |
|---|---:|---|---|
| **Cuotas** | 7 | ¿Cada celda facultad×sexo va a cerrar? | **Es el norte.** Se queda como está |
| **Resumen** | 7 | ¿Cómo va el operativo hoy? | Propósito claro, pero 7 paneles y ninguno conoce el sexo |
| **Estratos** | 2 | — | **Perdió su identidad.** Ver abajo |
| **Rendimiento** | 9 | ¿Cuánto rinde cada aula y cada facultad? | Nueve paneles para una pregunta |
| **Efectividad** | 1 | ¿El campo se comporta como el supuesto? | Un panel solo en una pestaña |
| Salidas | — | Llevárselo | Se queda |

## Los tres problemas de propósito

**1. Estratos ya no es una pestaña.** Su gráfico pasó a ser facultad×sexo
—o sea, es Cuotas— y lo que queda propio es la tabla del estrato del SORTEO, que
es documentación del diseño y no monitoreo. **Propuesta: retirarla**, moviendo su
tabla a un desplegable dentro de Cuotas.

**2. Rendimiento (9 paneles) y Efectividad (1) son la misma pregunta.** El ADR
0082 las separó a propósito, pero 9 contra 1 no es una separación, es un
desbalance. **Propuesta: fundirlas** en una sola, «Rendimiento», con la
efectividad como su primer panel.

**3. `avance_por_facultad` no tiene sexo.** El panel «cada facultad contra su
meta» de Resumen puede decir que una facultad va bien mientras su celda de
mujeres va corta. Medido sobre los tres simulacros: en `como_2025` **tres**
facultades cubren su total y ninguna tenía celda corta, así que el mecanismo
pudo dispararse tres veces y no lo hizo — es **posible, no observado**. En
`campo_malo` ninguna cubre su total y la prueba no puede dispararse.
**Propuesta: darle el corte por sexo**, que es barato y elimina la duda.

## Las dos pestañas nuevas, cada una con su porqué

**A · Decisiones** — *¿qué decidimos, y qué falta decidir?*
Hoy las decisiones están repartidas: la reserva dirigida vive dentro de Cuotas,
los reemplazos activados en Consultas, y el banco en Rendimiento. Son la misma
pregunta operativa —**a qué aula mando gente mañana**— y quien la tiene que
contestar hoy visita tres sitios.

**B · Calendario** — *¿llegamos a la fecha?*
Existe desde `8b754bec`, que resucitó la fecha: once días de campo, ritmo
diario, pronóstico de cierre y corte del estudio. Ahora mismo esos cuatro
paneles están dispersos entre Resumen y Rendimiento, contestando una pregunta
—**el tiempo**— que no es la de ninguna de las dos.

## Resultado

**Seis pestañas, no ocho**: Cuotas · Decisiones · Calendario · Resumen ·
Rendimiento · Salidas. Se retira Estratos, se funde Efectividad, y las dos
nuevas recogen paneles que ya existen y hoy están fuera de sitio.

**Nada de esto se implementa sin su palabra.**


---

# Corrección de esta propuesta, tras ver Efectividad

**Propuse fundir Efectividad dentro de Rendimiento sin haberla capturado.** Al
verla, la propuesta era mala.

Es una sola superficie pero es la más densa del perfil, y contesta una pregunta
que ninguna otra contesta: **¿el campo responde como la tasa suponía?**

> En las 152 aulas ya aplicadas, la tasa de la facultad suponía que respondería
> el **52,0 %** de los alumnos. Está respondiendo el **28,7 %**. **798 alumnos
> en riesgo en 12 facultades.**

Por facultad da lo esperado, lo que va respondiendo **con su intervalo**
(± 6 pts, ± 8 pts, ± 27 pts según cuántas aulas la respaldan), la comparación
visual, los alumnos en riesgo y la acción: «hacen falta 14 de 311».

**Y ya trataba la incertidumbre con intervalos.** Cuando construí la
probabilidad de cierre inventé un convenio propio —un porcentaje con su
salvedad en el `title`— habiendo aquí, en el mismo perfil, un convenio
establecido y mejor: el punto con su ± pts. Debí mirarlo antes de construir.

**Estructura revisada**: Cuotas · Decisiones · Calendario · Resumen ·
Rendimiento · **Efectividad** · Salidas. Se retira sólo Estratos.

Y queda un pendiente que sale de aquí: **unificar el convenio de incertidumbre**.
Hoy el perfil dice «± 8 pts» en un sitio y «85 % de cerrar» en otro para la
misma clase de afirmación.
