# Avance, superficie por superficie, contra su norte

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
