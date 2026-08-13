# ADR 0075 — Una base validada es una base sin hallazgos sin decidir

- **Estado**: Aceptada
- **Fecha**: 2026-08-13
- **Ámbito**: Validación · gate de avance a Codificación · taxonomía de anomalías
- **Relación**: cierra L10 del GOAL `docs/qa/goal-validacion-extrinseca-2026-08-12.md`.
  Se apoya en la taxonomía de cuatro tipos del lote 6 y en el sembrado de
  criterios de los lotes 1 a 5.

## Contexto

Hasta ahora todas las reglas de Validación se derivaban del XLSForm: `relevant`
→ salto, `required` → obligatoria, `constraint`, `calculate`. El instrumento era
a la vez legislador y juez, así que la validación **solo encontraba lo que el
formulario ya sabía prever**.

El caso que forzó la revisión: en `ACNUR MDV AGOSTO`, 6 de 104 encuestas se
recolectaron con una versión anterior del formulario que mostraba preguntas que
la versión corregida oculta. Las 425 reglas del instrumento reportaron 3
inconsistencias —todas del mismo caso— y **ninguna vio la causa**.

Con la capa extrínseca ya no todo lo que Validación encuentra es un error del
encuestado. Ahora hay cuatro clases de anomalía:

| Tipo | Qué es | Se corrige |
|---|---|---|
| `contradiccion` | Dos datos del mismo caso no pueden ser ciertos a la vez | en el dato |
| `valor_invalido` | El valor no existe entre las opciones de su pregunta | en el dato |
| `faltante` | La pregunta debía responderse y quedó vacía | en el dato |
| `procedencia` | El caso no se recolectó como el estudio declaró | **con campo** |

Y eso rompe la pregunta que el gate venía haciendo. «¿La base tiene cero
inconsistencias?» ya no significa nada: un caso recolectado con otro formulario
no se arregla editándolo, y quedarse esperando a que el contador llegue a cero
condenaría al proyecto a no avanzar nunca.

### Lo que estaba mal en la pregunta anterior

- **Cero hallazgos es inalcanzable y no es el objetivo.** Un dato inconsistente
  que el analista revisó y decidió conservar —porque llamó a campo y confirmó
  que era correcto— es un dato en mejor estado que uno que nadie miró.
- **Cero hallazgos es falsificable.** Basta desactivar un criterio para que el
  contador baje. Un gate que se satisface apagando la verificación no es un gate.
- **Procedencia no admite corrección en el dato.** Bloquear por eso obligaría a
  falsear el dato para poder avanzar, que es exactamente lo contrario de lo que
  se busca.

## Decisión

**Una base está validada cuando no le quedan hallazgos sin decidir.** No cuando
no tiene hallazgos.

1. **Ningún tipo de anomalía bloquea por su sola existencia.** Lo que bloquea es
   que un hallazgo esté sin revisar.

2. **`procedencia` nunca bloquea, ni siquiera sin revisar.** Es información para
   interpretar la base, no un defecto del dato: un caso recolectado con una
   versión anterior del formulario sigue siendo analizable, y lo que corresponde
   es saberlo, no corregirlo. Se muestra siempre y no participa del gate.

3. **`contradiccion`, `valor_invalido` y `faltante` exigen decisión.** Cada
   hallazgo debe tener una: corregir, anular el campo, excluir el caso o
   conservarlo como está con constancia de que se revisó. Cualquiera de las
   cuatro cierra el hallazgo; **ninguna de las cuatro es «que desaparezca»**.

4. **Conservar es una decisión válida y se registra.** Un analista que revisó un
   dato raro y confirmó que es correcto debe poder dejarlo, y que quede escrito
   que lo revisó.

5. **Desactivar un criterio no cierra sus hallazgos.** Si un criterio se apaga,
   lo que encontró deja de contar porque deja de evaluarse — pero apagarlo es en
   sí una decisión del analista, que queda registrada como tal. El gate no puede
   satisfacerse por omisión silenciosa.

6. **El gate no es un semáforo binario en la UI.** Se comunica como «te quedan N
   hallazgos por decidir», con el desglose por tipo. Un número accionable, no un
   rojo sin instrucciones.

## Consecuencias

**Para el analista.** Avanzar deja de depender de que la base sea perfecta y pasa
a depender de que la haya mirado. Es una vara más honesta: la que el equipo ya
aplicaba de hecho, ahora escrita.

**Para Limpieza.** Recibe el tipo de anomalía y sabe qué acciones ofrecer.
`validacion_anomalia_corrige_dato()` devuelve `FALSE` para `procedencia`, así que
Limpieza no propone «anular campo» sobre algo que eso no arregla.

**Para el reporte metodológico.** El desglose por tipo entra en la ficha técnica:
no es lo mismo un estudio con 12 contradicciones resueltas que uno con 12 casos
de procedencia dudosa. Hoy los dos se reportaban como «12 inconsistencias».

**Para el `.pulso`.** Las decisiones sobre hallazgos son trabajo del usuario, no
caché derivable: viajan en el proyecto y sobreviven a una reevaluación. Un
hallazgo que reaparece idéntico tras volver a correr las reglas conserva su
decisión; uno que cambia de forma vuelve a pedirla.

**Lo que este ADR no decide.** Si un estudio concreto quiere un gate más duro
—por ejemplo, cero contradicciones sin excepción antes de entregar a un
cliente— eso es una política del proyecto, no del producto. Cabe como umbral
configurable en `operational_config`; no como default.

## Alternativas descartadas

- **Cero hallazgos para avanzar.** Inalcanzable en cualquier base real y
  falsificable apagando criterios. Además obliga a falsear datos de procedencia
  que no admiten corrección.
- **Que procedencia bloquee.** Dejaría trabada cualquier base recolectada con más
  de una versión del formulario —una situación normal en campos largos— sin que
  exista una acción que la destrabe.
- **Sin gate, solo informar.** Es lo que había de hecho, y el resultado fue que
  las 3 inconsistencias de `ACNUR MDV AGOSTO` viajaron hasta el análisis sin que
  nadie las mirara.
