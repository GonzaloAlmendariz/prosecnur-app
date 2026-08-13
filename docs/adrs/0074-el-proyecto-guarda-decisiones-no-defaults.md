# ADR 0074 — El proyecto guarda decisiones, no defaults

- **Estado**: Propuesta
- **Fecha**: 2026-08-13
- **Ámbito**: Persistencia `.pulso` · presets de Gráficos
- **Relación**: raíz común de ocho «mandos muertos» documentados en
  `docs/qa/checklist-mandos-vivos-2026-08-13.md`.

## Contexto

Cuando el motor recibe un valor de preset no puede distinguir **«esto lo eligió
el analista»** de **«esto vino de fábrica»**. Las dos cosas llegan como la misma
entrada en la misma lista.

Medido sobre `V3_Conta 11-08` — 253 valores guardados en sus presets:

| | |
|---|---|
| Idénticos al default de fábrica | **218** (86 %) |
| Distintos del default | 22 |
| Sin default declarado | 13 |

Ocho de cada nueve valores que el proyecto guarda son una **foto del default del
día en que se guardó**. Y como el motor no puede distinguirlos, esa foto se
comporta como una decisión: pisa cualquier default nuevo, para siempre.

### Lo que ha costado

- **`textos_negrita`.** Al cablear interruptores que estaban escritos a fuego
  hubo que inventar una regla de «legado» —conservar el aspecto anterior
  *mientras el analista no declare nada*— porque no había forma de saber si la
  declaración existente era suya. La regla funciona pero es una muleta.
- **`numerar_oe`.** Mismo patrón: un alias de compatibilidad para no borrar lo
  que nadie había declarado.
- **Una discusión entera sobre la lámina 66** para decidir si respetar una
  preferencia de negrita que, medida, resultó ser el default de la víspera
  congelado en el `.pulso`. Nadie la había tomado.
- **El reparto multiactor.** El motor pisaba el preset porque no podía saber si
  el preset traía una decisión o un relleno.

El frontend **sí** sabe distinguirlo, y lo hace sin guardar nada: para los
overrides de un gráfico deriva el estado —`inherited` o `custom`— de si la clave
está presente en la bolsa de overrides. Presencia = decisión. Esa invariante ya
funciona en producción; lo que falta es que valga también para los presets.

## Decisión

**El `.pulso` guarda sólo lo que difiere del default de fábrica.** Presencia de
una clave en el bag de presets significa, y significará siempre, «alguien la
eligió».

- Al **guardar**, se descarta todo valor idéntico al default vigente.
- Al **cargar**, el bag se mezcla sobre el default como hoy, sin cambios.
- La procedencia deja de necesitar un campo: se **deriva** de la presencia, igual
  que ya hace el frontend con los overrides.

## Alternativa descartada

Etiquetar cada valor con su origen (`fabrica` / `proyecto` / `grafico`). Es más
explícito y más caro: obliga a que todo el camino —registro, `p_presets()`,
`.merge_args()`, los resolutores— transporte pares en vez de valores, y a migrar
los `.pulso` existentes. La derivación por presencia consigue lo mismo sin tocar
el formato ni el camino de mezcla.

## Consecuencias

**A favor**

- Las reglas de «legado» de `textos_negrita` y el alias de `numerar_oe` pueden
  morir: si no está declarado, no se eligió.
- Un default mejorado **llega a los proyectos existentes** en vez de quedar
  sepultado bajo su propia copia de ayer.
- El `.pulso` encoge y se vuelve legible: 22 valores en lugar de 253.
- El resolutor multiactor puede dejar de pisar el preset, porque lo que quede en
  el preset será una decisión de verdad.

**En contra, y hay que decirlo**

- **Un mazo puede cambiar de aspecto al actualizar la app.** Hoy el `.pulso`
  congela el default y el mazo sale igual para siempre; con esto, un default
  nuevo lo alcanza. Es lo correcto —los 218 valores no son decisiones— pero es
  un cambio de contrato y debe anunciarse en las notas de versión.
- **No es retroactivo.** Un `.pulso` ya guardado sigue trayendo sus 253 valores.
  Hace falta una limpieza al cargar, o aceptar que la invariante sólo vale para
  lo guardado a partir de ahora. La limpieza al cargar es preferible y va en la
  misma pasada.
- **Empatar con el default no siempre es no elegir.** Alguien puede haber puesto
  a mano el mismo valor que el default. Se pierde esa distinción, y no importa:
  el resultado renderizado es idéntico y el analista puede volver a ponerlo.

## Cómo se verifica

1. Guardar un proyecto y comprobar que su bag de presets sólo contiene valores
   distintos del default vigente.
2. Cambiar un default de fábrica y comprobar que un `.pulso` guardado **antes**
   lo adopta, mientras conserva sus decisiones propias.
3. El control: un valor que el analista sí cambió sobrevive al guardado y a la
   recarga.
