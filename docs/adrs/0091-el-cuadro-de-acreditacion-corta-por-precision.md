# ADR 0091 — El cuadro de acreditación corta por precisión, no por N fijo

- **Estado**: Aceptado
- **Implementación**: Implementada — `api/R/calc_muestra_acreditacion_cuadro.R`
  y `.cm_inferir_acreditacion` en `api/R/calc_muestra_engine.R`
- **Ámbito**: Cálculo de muestra, modo `acreditacion` · estudiantes con canal
  `aula_qr` y docentes
- **Fecha**: 2026-09-24 · **Ratificado**: 2026-09-24 (Gonzalo: «Para el tres
  mejor haz lo que estadísticamente sea más válido, no me hagas mucho caso
  sobre lo que te dije»)
- **Relación**: se aparta del documento PULSO «Selección de muestras de
  actores» (marzo 2026) en los cortes de estudiantes y docentes; conserva sus
  coberturas mínimas. Research H16–H18 en
  [research-calc-muestra-robustez-2026-09-23.md](../qa/research-calc-muestra-robustez-2026-09-23.md).

## Contexto

El documento de marzo 2026 corta por tamaño fijo y fija el n del otro lado:

| Actor | Hasta | Desde |
|---|---|---|
| Estudiantes (aulas) | 3 000: intención censal, mínimo 60 % | 3 001: conglomerados, 1 800 fijos |
| Docentes | 250: intención censal, mínimo 60 % | 251: cuotas no probabilísticas de 150 |

El motor tomaba el corte de estudiantes pero recalculaba el n a ±2,5 % con
deff 2. Medido el 2026-09-24:

- con N = 3 000 pedía 1 800 completas y con N = 3 001, 1 519: **al crecer la
  población, la muestra bajaba**;
- aplicar los 1 800 del documento quitaba el salto, pero con un n fijo la
  precisión se degradaba con N (±2,1 % con 3 001, ±3,1 % con 20 000);
- docentes con N ≥ 251 iban a 150 cuotas sin margen de error aun con la
  nómina completa, que permite un sorteo.

## Decisión

Se intenta el censo **mientras** una muestra probabilística a la precisión
canónica pediría al menos la cobertura mínima del documento (60 %). Desde ese
punto se sortea con el n de esa precisión:

| Actor | Precisión canónica | Punto de cambio | Del lado probabilístico |
|---|---|---|---|
| Estudiantes (aulas) | ±2,5 %, 95 %, p = 0,5, deff 2 | N = 2 050 | conglomerados, sobremuestra 50 % |
| Docentes | ±5 %, 95 %, p = 0,5, deff 1 | N = 258 | MAS (estratificado por dedicación si el marco la trae), respuesta inflada al 60 % |

La comparación usa la fracción sin redondear, n/N = n0/(N − 1 + n0), que
decrece estrictamente con N: hay un único punto de cambio, y en él censo y
muestra piden lo mismo. La muestra crece con N sin saltos (a lo más una
unidad entre N y N + 1) y, del lado probabilístico, el margen publicado es
siempre el declarado.

Se conservan del documento: las coberturas mínimas (60 %), la dedicación
docente como variable de control, administrativos y egresados sin cambios.
Una meta que el usuario declare sigue mandando sobre la del cuadro.

## Consecuencias

| | Documento | Motor desde este ADR |
|---|---|---|
| Estudiantes N = 3 000 | 1 800 (censo 60 %) | 1 519 (±2,5 %) |
| Estudiantes N = 5 000 | 1 800 (±2,6 % con deff 2) | 1 904 (±2,5 %) |
| Estudiantes N = 20 000 | 1 800 (±3,1 %) | 2 665 (±2,5 %) |
| Docentes N = 400 | 150 cuotas, sin margen | 197 (±5 %), 329 a campo |
| Docentes N = 1 000 | 150 cuotas, sin margen | 278 (±5 %), 464 a campo |

- Entre 2 052 y 3 000 estudiantes el censo al 60 % pedía más completas que la
  muestra que sí da margen; ahora se sortea.
- Poblaciones grandes piden más que 1 800: es lo que cuesta sostener ±2,5 %.
- Docentes de nóminas grandes piden más encuestas que 150, pero el resultado
  admite inferencia.
- Queda sin cambios que la inferencia fije la técnica (H16): la mesa de
  Acreditación no ofrece selector de técnica y rotula su origen («Cuadro
  maestro» y su justificación).
- Egresados sigue con la regla del documento (clamp(50 % N, 30, 150),
  conveniencia): la misma lógica le aplicaría, pero no entró en esta decisión.

## La meta del cuadro no es la del usuario

El cuadro rellena `meta.valor` y ese valor se guarda; al recalcular, un valor
mayor que cero cuenta como meta declarada y manda. Un `.pulso` guardado con la
regla anterior seguía pidiendo 150 docentes aunque hoy toque una muestra a
±5 % (un MAS rotulado ±5 % con ±6,3 % real). Por eso `meta.origen`:
`cuadro` se recalcula siempre, `usuario` manda. Un componente sin origen cuya
meta coincide con lo que escribía la regla anterior (150 docentes con
N ≥ 251; 1 800 estudiantes en aulas con N ≥ 3 001) se trata como del cuadro.

## Cumplimiento

`api/tests/testthat/test-calc-muestra-acreditacion-cuadro-continuo.R`:
monotonía, salto ≤ 1, un único cambio de técnica, margen declarado del lado
probabilístico, meta del usuario, tope en el marco, variable de control y
metas heredadas del cuadro anterior.
