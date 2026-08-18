# ADR 0079 — El cumplimiento se mide contra la cuota del diseño

- **Estado**: Aceptado
- **Implementación**: En curso
- **Ámbito**: Monitoreo de aulas universitarias · agregados de avance ·
  cuotas por sexo · contrato calc-muestra → Monitoreo
- **Fecha**: 2026-08-18 · **Ratificado**: 2026-08-18
- **Relación**: cierra el cableado que empezó H3 (las metas del diseño viajan
  al importar, commit `3e2a8373`); aplica al monitoreo la separación
  diseño/operativo que la certificación de
  [calc-muestra](0072-una-tabla-es-una-tabla-y-va-nativa.md) ya trata como
  dos planos distintos.

## Contexto

El diseño del estudio de aulas fija una **cuota de alumnos** por facultad×sexo
(suma 2.500, afijación proporcional) y dimensiona las aulas con
`⌈cuota / (p25 × τ)⌉`: compra deliberadamente **más aforo del que la cuota
pide**, porque las aulas rinden una fracción τ y el estadístico p25 es
conservador. A eso se suman las cadenas de reserva y el banco de extras.

El tablero de Monitoreo, en cambio, medía el avance contra **la suma de las
metas por aula** (`expected_valid`): el denominador de `avance_respuestas_pct`,
la meta del ritmo diario, el KPI de brechas y los targets por sexo derivaban
todos de esa suma. Medido sobre HSVG2026 en su momento: 2.615 filas de plan,
202 slots en juego, y una meta agregada que llegó a publicarse en 84.110 antes
de acotarla a los slots (6.901). Aun acotada y con la τ de H3 aplicada, la suma
de metas por aula queda **estructuralmente por encima de la cuota**: las aulas
seleccionadas tienen elegibles ≥ p25, y el sobredimensionamiento es diseño, no
error. Consecuencia doble:

- el avance porcentual **subestima** el cumplimiento real, y un estrato puede
  no llegar nunca a 100 % aunque su cuota esté cubierta;
- los targets por sexo se repartían por la **composición del frame de aulas**
  (que sobre-representa a quien está en más aulas: el marco solapa 1,55
  aulas/alumno), no por la sub-distribución poblacional que el diseño certificó.

Desde H3 el bloque `design_targets` viaja en la config del import
(cuota y `cuota_sexo` por facultad, τ, certificación, sello
`selection_run_id`/`frame_hash`), pero no tenía ni un consumidor.

## Decisión

**El cumplimiento del estudio se mide contra la cuota del diseño; la meta
operativa por aula sigue existiendo para dirigir el campo. Son dos preguntas,
con dos rótulos, y nunca se publican bajo el mismo.**

1. **Bloque nuevo `avance_cuota`** (schema `monitoreo_aulas_avance_cuota_v1`)
   en el dashboard: avance global y por facultad con denominador
   `design_targets$cuota` / `total_cuota`. El ritmo diario mide contra la misma
   cifra — si el avance cierra en 100 %, el «cuánto falta» cierra en cero el
   mismo día.
2. **El numerador es todo lo recogido válido de la facultad**: titulares
   caídos, reservas activadas y banco incluidos. Las reservas suman al
   numerador cuando se activan, **nunca al denominador** — la cuota no crece
   con la cadena. Tres exclusiones declaradas: respuestas huérfanas (sin fila
   del plan) se publican como cifra aparte; identificadores duplicados no
   cuentan dos veces; y las respuestas de aulas fuera del universo
   (`aula_no_existe`, `virtual_no_presencial`) se publican como «fuera de
   universo», ni al cumplimiento ni a las celdas de sexo.
3. **La `cuota_sexo` del diseño manda** sobre la derivación por frame. Las
   celdas sexo×facultad se miden contra `round(cuota_sexo)` (fuente
   `design_cuota_sexo`); el frame y el plan quedan como fallbacks declarados.
   Un descuadre `|F+M − cuota| > 1` marca el bloque corrupto y esa facultad
   degrada a fallback con aviso. Las respuestas sin sexo cuentan al total de la
   facultad y a ninguna celda; el residual se publica.
4. **Vigencia por sello, comparando `selection_run_id` y `frame_hash` por
   separado**: iguales y no vacíos → cuotas del diseño; cualquier par distinto
   → el bloque degrada a las sumas de `expected_valid` (conducta anterior)
   declarando fuente y motivo; sellos vacíos → cuotas del diseño con vigencia
   «no verificable». Medir un plan re-importado contra cuotas de otro sorteo
   es peor que degradar.
5. **Atribución unificada respuesta→plan**: la facultad de una respuesta —para
   el cumplimiento y para las celdas de sexo, la misma regla— sale del
   emparejamiento con el plan (`classroom_id` ∨ `collection_unit_id`); la
   columna de facultad de la respuesta solo rellena cuando no hay match. Sin
   esto, F+M no cuadra con el total de su facultad.
6. **Sin denominadores inventados**: facultad del plan sin cuota en el diseño
   → fila con cuota nula y avance nulo, declarada `sin_cuota`, fuera del %
   global. Facultad del diseño sin aulas sorteadas → 0 de su cuota, declarada
   `sin_aulas_en_plan` (hueco estructural del sorteo, no retraso de campo).
   Un avance > 100 % se publica sin recorte.

## Consecuencias

**Para quien dirige el operativo.** «¿Cumplimos?» y «¿a qué aula voy mañana?»
dejan de compartir denominador. La brecha por aula contra su `expected_valid`
τ-ajustada sigue siendo la unidad operativa; la cuota es la de cumplimiento.

**Para proyectos existentes — las cifras de las celdas de sexo cambian.**
Cuatro vías, todas deliberadas:

1. el plan manda sobre la columna de facultad de la respuesta (antes era al
   revés): las celdas cuadran con el total, y una respuesta cuya columna
   discrepe del plan cambia de facultad;
2. el cruce de sexo pasa por un mapa normalizado F/M: un valor fuera del mapa
   («Otro», iniciales no reconocidas) ya no casa por texto crudo — queda en el
   residual sin sexo, visible, en vez de formar celda propia;
3. las respuestas fuera de universo salen de las celdas;
4. el observado se cuenta sobre el plan entero con la atribución unificada.

Un `.pulso` sin `design_targets` (todo proyecto anterior al re-import) conserva
la conducta previa vía degradación declarada: el bloque existe, dice de dónde
sale su denominador, y el chip de la UI dice «contra la meta del plan».

**Costo: dos números de avance conviven en la misma pestaña.** El diseño exige
rotularlos siempre (C5): la suma de metas por aula mayor que la cuota es
diseño, y un lector que las vea juntas sin unidades declaradas concluirá que el
tablero se contradice.

**Riesgo: el sello degrada de más.** Un re-import legítimo que no re-publique
metas dejará el tablero en «contra la meta del plan» hasta el siguiente import
completo. Es el lado correcto del error: preferimos perder la cuota un ciclo a
medir contra la de otro sorteo.

## Cumplimiento

- **Invariante 1 — el denominador no crece con la cadena**: activar una
  reserva no cambia la cuota de su facultad; sus respuestas sí suman.
- **Invariante 2 — huérfanas contadas aparte**: numerador global =
  respuestas válidas totales − huérfanas, exacto.
- **Invariante 3 — celdas + residual = total** por facultad, con la misma
  regla de atribución en ambos lados.
- **Invariante 4 — la tabla de vigencia completa tiene test**: vigente,
  obsoleta por run_id, obsoleta por frame_hash, no verificable, sin diseño.
- **Invariante 5 — sin diseño, nada cambia**: un proyecto sin
  `design_targets` produce las cifras de siempre, con la fuente declarada.
- **Invariante 6 — cuota cero o ausente jamás produce Inf ni un 0 «medido»**:
  produce nulo declarado.

Los seis viven en `api/tests/testthat/test-monitoreo-aulas-avance-cuota.R`;
el contrato del import (H3) sigue congelado en
`test-monitoreo-aulas-metas-diseno.R` y no se modifica.

## Notas

La revisión metodológica que motivó esta decisión dejó tres supuestos
escritos, que el bloque documenta y no resuelve: la atribución es por aula del
plan y no por auto-reporte (la post-estratificación vive en Procesamiento); el
doble conteo de personas por el traslape del marco (1,55 aulas/alumno, con
respuestas anónimas no deduplicables) se asume despreciable; y «válida de
campo» no es «efectiva final» — la merma entre campo y base depurada (2025:
3.303 efectivas) no se descuenta del cumplimiento.
