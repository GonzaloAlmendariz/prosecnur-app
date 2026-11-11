# ADR 0143: en acreditación, por correo o por teléfono se invita a toda la base

- **Estado**: Aceptado
- **Implementación**: Implementada en `.cm_inferir_acreditacion` y
  `.cm_calc_intencion_censal` (`api/R/calc_muestra_engine.R`), con el reparto
  por segmento en `api/R/calc_muestra_acreditacion_barrido.R`
- **Ámbito**: Cálculo de muestra, modo `acreditacion`, canales `online_email`,
  `telefonico` y `mixto`
- **Fecha**: 2026-11-11. Regla de campo dictada por Gonzalo el mismo día:
  "los estudios de acreditación por correo siempre es a todos, por llamada se
  hace un barrido telefónico también"
- **Relación**: reemplaza al [ADR 0091](0091-el-cuadro-de-acreditacion-corta-por-precision.md)
  en esos tres canales. El 0091 sigue rigiendo estudiantes en aulas
  (`aula_qr`) y los canales que no se barren.

## Contexto

El ADR 0091 decidió, con la consigna de hacer "lo estadísticamente más
válido", que el cuadro de acreditación sorteara a docentes y egresados cuando
una muestra a ±5 % pidiera menos que la cobertura mínima. El cuadro no miraba
el canal: docentes y egresados se sorteaban igual por correo que por teléfono.

En el campo eso no se hace. Medido con los públicos de la Acreditación
Institucional PUCP 2026 (bases depuradas con la DAA, 21/10/2026):

| Público | Personas | Lo que hacía el modo | Lo que se hizo en campo |
|---|---|---|---|
| Estudiantes de pregrado | 22,820 | invitar a todos, meta 60 % (13,692) | invitar a todos, meta 4,542 (19.9 %) |
| Docentes | 2,665 | sortear 336 | invitar a todos, meta 843 |
| Administrativos | 2,194 | invitar a todos, meta 80 % (1,756) | invitar a todos, meta 1,115 (50.8 %) |
| Egresados | 12,512 | sortear 373 | invitar a todos, meta 1,308 |

Las metas reales salieron del Excel de dimensionamiento, no del módulo. La
encuesta de medios de la DCI (noviembre de 2026) tiene la misma forma y
tampoco se podía calcular aquí.

Por correo y por teléfono la no respuesta pesa más que cualquier sorteo: con
respuestas de 10 % a 50 %, sortear antes no da probabilidades de inclusión
conocidas y solo achica el volumen. El control del sesgo se hace con cuotas
por segmento y con la comparación entre quienes respondieron y la base.

## Decisión

**Correo, teléfono y mixto.** Estudiantes, docentes, administrativos y
egresados van siempre a intención censal: se invita (o se llama) a toda la
base, sin sorteo. El resultado declara:

- **Meta.** La que declare el usuario, como número de encuestas o como
  cobertura. Si no declara nada, rige la cobertura mínima del documento PULSO
  de marzo 2026 (60 % estudiantes y docentes, 80 % administrativos, 50 %
  egresados), igual que antes.
- **Segmentos.** Si el marco trae estratos, la meta se reparte en proporción a
  su tamaño (mayor resto, suma exacta) y un segmento que queda por debajo del
  mínimo (`n_minimo_estrato`, 30 por defecto) sube a ese mínimo, o a todas sus
  personas si son menos. Lo que agrega el mínimo se suma a la meta del
  público; no se descuenta de los demás segmentos (decisión de Gonzalo del
  2026-11-11, "Sumarlo encima": DCI pregrado 3,000 pasa a 3,018). El resultado
  publica la meta declarada (`n_meta_base`) y lo agregado
  (`n_agregado_minimo`). Cada segmento se invita entero. Un actor puede
  declarar sus segmentos como cuotas de control que no se reportan
  (`uso_segmentos = "control"`, en las propuestas).
- **Viabilidad.** Con la tasa de respuesta esperada, el motor dice cuántas
  completas se esperan en el público y en cada segmento, y avisa en cuáles la
  meta pide más respuesta de la esperada. Ejemplo: 30 autoridades de 37 piden
  81 %; con 50.8 % se esperan 18.8.
- **Margen de error.** No se publica: es un diseño sin probabilidades de
  inclusión. El aviso pide comparar quién respondió con la base.

**Aulas.** Siguen dos variantes:

- PULSO sortea las aulas: rige el ADR 0091 (`aula_qr`) y el modo de aulas.
- El cliente entrega las aulas y hay que llegar a un mínimo de alumnos: es
  intención censal sobre los alumnos de esas aulas con la meta declarada por el
  usuario, que este ADR habilita.

**Otros canales** (`presencial` para docentes o egresados): siguen el ADR 0091.

## Quién diseña la muestra de una acreditación

Hasta este ADR, la Ficha guardaba toda acreditación con `diseno = "cliente"` (ADR 0124: "los públicos y sus
porcentajes se fijan en Monitoreo") y Cálculo de muestra no abría su modo. Decisión de Gonzalo (2026-11-11): "se
habilita sólo en los nuevos estudios que marquen acreditación al iniciar el proyecto".

- Una acreditación que se declara desde ahora queda con `diseno = "calc-muestra"`: Cálculo abre el modo
  Acreditación, con sus metas por público y el panel Propuesta (PPT y Excel de escenarios). Monitoreo sigue con el
  avance y las cuotas.
- Un estudio ya guardado conserva el `diseno` que tenía, y un `.pulso` sin perfiles declarados sigue proyectándose
  con `"cliente"`.

## Consecuencias

- Un `.pulso` guardado con docentes o egresados por correo o teléfono pasa de
  muestra aleatoria a invitar a toda la base al recalcular, porque la
  inferencia del cuadro se reaplica en cada normalización.
- `meta.valor` deja de ignorarse en la intención censal: una meta tecleada por
  el usuario fija el número de encuestas; una meta sellada por el cuadro se
  sigue liberando.
- La intención censal pasa a declarar `n_minimo_estrato` entre sus parámetros.
- Cuando no hay respuesta esperada declarada, el motor usa la tasa por defecto
  (60 %). Fijarla desde la referencia del estudio (por ejemplo, la respuesta de
  la medición anterior) queda en manos del usuario.

## Cumplimiento

`api/tests/testthat/test-calc-muestra-acreditacion-barrido-canal.R`: barrido
por canal para los cuatro públicos, meta del usuario, reparto con mínimo que no
cambia el total, segmentos que no alcanzan su meta, y que `aula_qr` y
`presencial` siguen en el ADR 0091.
