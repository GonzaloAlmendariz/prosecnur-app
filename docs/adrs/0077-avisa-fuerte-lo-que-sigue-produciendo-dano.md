# ADR 0077 — Avisa fuerte lo que sigue produciendo daño

- **Estado**: Aceptada
- **Fecha**: 2026-08-15
- **Ámbito**: Monitoreo · severidad de las alertas de calidad de campo · límite
  de lo que la app decide sola
- **Relación**: cierra M7 del GOAL
  `docs/qa/goal-monitoreo-calidad-campo-2026-08-13.md`. Complementa el
  [ADR 0075](0075-una-base-validada-es-una-base-sin-hallazgos-sin-decidir.md),
  que gobierna el gate de Validación **después** del campo; este gobierna los
  avisos **durante** el campo.

## Contexto

Monitoreo tenía siete alertas —`brecha_relevante`, `brecha_menor`,
`sin_objetivo`, `minimo_estadistico`, `benchmark_bajo`, `subcuotas_incompletas`,
`reemplazo_sin_motivo`— y todas responden la misma pregunta: **¿cuánto falta
para la meta?** Ninguna miraba cómo se estaba recolectando.

El caso que abrió el trabajo: en `ACNUR MDV AGOSTO`, una encuestadora trabajó
**casi seis horas con una versión desactualizada del formulario** mientras sus
tres compañeros ya usaban la corregida. Seis encuestas salieron con saltos y
catálogos viejos. Monitoreo no lo vio, y era exactamente el momento en que
todavía se podía parar el campo; cuando se descubrió, en Validación, ya solo
quedaba interpretar el dato.

El GOAL agregó seis señales de calidad de campo:

| Señal | Qué dice |
|---|---|
| `formulario_desactualizado` | un agente sigue enviando con una versión que ya no es la vigente |
| `identidad_agente` | el equipo aparece con más nombres de los que tiene |
| `envio_sin_padron` | alguien envía datos sin figurar en el padrón |
| `padron_sin_envio` | alguien del padrón no ha enviado nada |
| `cruce_identidad` | dos encuestas de la misma persona corrieron a la vez |
| `abierta_sin_contenido` | una respuesta abierta no dice nada |

Seis señales nuevas sobre siete existentes obligan a decidir dos cosas que hasta
ahora no hacía falta responder: **cuál de ellas merece gritar**, y **hasta dónde
puede llegar la app por su cuenta**. Sin una regla, el camino natural es que
todas salgan en rojo —cada una parece grave mirada de cerca— y el resultado
conocido es que nadie las lee.

### Por qué «gravedad» no sirve como criterio

Ordenar por gravedad percibida no discrimina: un encuestador fuera del padrón
suena alarmante, dos encuestas que se pisan suenan alarmantes, una respuesta que
dice `hjk` suena alarmante. Medido sobre la base real, los seis tipos juntos
producen **5 avisos sobre 104 casos**; si los seis avisan fuerte, la severidad
deja de significar algo.

Lo que sí discrimina es una propiedad objetiva y verificable: **si el problema
deja de crecer cuando dejas de mirarlo, o no**.

- Una encuestadora que sigue con el formulario viejo produce **una encuesta
  perdida más por cada hora que pasa**. El conjunto de casos dañados está
  abierto y crece.
- Un nombre mal escrito, dos encuestas superpuestas o una respuesta vacía son
  hechos ya ocurridos sobre un conjunto **cerrado** de casos. Llamar hoy o
  mañana cambia lo fácil que será resolverlo, no cuántos casos hay.

## Decisión

**Avisa fuerte lo que sigue produciendo daño mientras nadie actúa. Lo que ya
terminó de producirlo, informa.**

1. **Solo `formulario_desactualizado` sale con severidad bloqueante**, y sale
   con el nombre del agente y la hora desde la que ocurre. Es la única señal
   cuyo conjunto de casos afectados sigue abierto, y la única cuyos casos no se
   arreglan después: una encuesta hecha con el formulario anterior tiene los
   saltos y los catálogos de esa versión y eso no se edita.

2. **Las otras cinco salen como advertencia.** No porque importen menos, sino
   porque su daño ya está hecho y acotado. Se ordenan por cuántos casos
   arrastran.

3. **La app nunca frena el campo sola.** Avisar fuerte es su techo; parar es
   decisión del coordinador. Un bloqueo automático sobre señales con falsos
   positivos conocidos —el detector de respuestas vacías marca de más un
   acrónimo sin vocales— costaría más que el problema que evita.

4. **Toda alerta de calidad nombra a quién llamar y qué preguntarle, o no se
   emite.** «Revisar duración» no le sirve a nadie; «¿Mary ya actualizó el
   formulario en su equipo?» sí. Una alerta sin destinatario no es una alerta:
   es una métrica con tipografía de urgencia.

5. **Las alertas de calidad viajan fuera de `dashboard$alertas`**, en un bloque
   propio (`calidad_campo`). Mezclar «cuánto falta» con «cómo se está
   trabajando» hace que una brecha de cuota y un formulario desactualizado se
   lean igual, y la única que corre contra el reloj se pierde entre las que no.

6. **El bloque explica su propio vacío.** «Falta declarar quién recolecta» y «el
   campo está limpio» se ven idénticos y significan lo contrario, así que el
   payload dice cuál de los dos es y la pantalla lo muestra.

7. **Ninguna señal nombra variables de un proyecto.** El agente, las llaves de
   identidad y las preguntas abiertas adicionales llegan de roles declarados en
   `operational_config`; sin declaración, la señal no existe en vez de adivinar
   una columna.

## Consecuencias

**Para el coordinador de campo.** Una sola cosa en rojo al día, y es la que se
puede resolver ese día con una llamada. El resto queda visible sin competir por
la misma atención.

**Para el equipo de análisis.** Lo que hoy se descubre en Validación o en
Codificación —variantes del nombre del encuestador, casos que se pisan,
respuestas que no dicen nada— aparece mientras todavía hay a quién preguntarle.
No cambia el diagnóstico; cambia el momento.

**Para una señal futura.** El criterio es una prueba, no una lista: antes de
darle severidad alta a una señal nueva hay que poder responder «¿el conjunto de
casos afectados sigue creciendo?». Si la respuesta es no, es advertencia.

**Para el `.pulso`.** Nada de esto se persiste: las alertas se derivan de la
data y de los roles declarados en cada lectura. Lo que sí viaja es la
declaración de roles, que es trabajo del usuario.

**Lo que este ADR no decide.** Los umbrales concretos —cuántos casos con versión
vieja hacen falta para nombrar a un agente, hoy dos— son criterio del estudio y
viven como parámetro, no como constante. Y si un proyecto quiere que su
coordinador bloquee el cierre ante una alerta, eso es una política de ese
proyecto, no del producto.

## Alternativas descartadas

- **Que todas las señales de calidad avisen fuerte.** Es el estado natural si no
  se decide: cada una parece grave mirada de cerca. Con cinco de seis en rojo, la
  severidad deja de informar y la única que exige acción ese día se lee igual que
  las demás.
- **Severidad por volumen de casos.** Habría puesto arriba las tres variantes del
  nombre del encuestador (3 casos) y abajo el formulario desactualizado del
  segundo agente afectado. El volumen mide cuánto trabajo cuesta, no cuánto
  cuesta esperar.
- **Que la app bloquee el avance del campo ante una alerta bloqueante.** Frenar
  a un equipo por un falso positivo cuesta un día de campo; el aviso fuerte
  cuesta una llamada. Y la decisión de parar necesita contexto que la app no
  tiene: si el equipo está en zona, si hay reemplazo disponible, si el cliente
  ya sabe.
- **Meter las de calidad en la lista de alertas existente.** Es lo más barato de
  implementar y anula el propósito: la lista actual se lee como un semáforo de
  avance, y ahí adentro «Mary sigue con el formulario viejo» pasa a ser un
  renglón más entre brechas de cuota.
- **Inferir los roles en vez de pedir que se declaren.** Medido: un detector de
  «esto no dice nada» aplicado a todo campo de texto marcó **103 de 104
  teléfonos**, porque no tienen letras. Adivinar convierte una señal útil en
  ruido que se apaga solo.
