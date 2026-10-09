# ADR 0080 — El workspace se resella entero, no campo a campo

- **Estado**: Aceptado · **Ratificado** por Gonzalo el 2026-08-27, textual:
  «Si ratifica». Propuesto el 2026-08-18 como borrador del loop de Cálculo de
  muestra.
- **Implementación**: No iniciada. Lo commiteado hasta ahora **no** es esta
  decisión sino contención de sus consecuencias en la capa que lee, y así se
  declara en cada commit.
- **Ámbito**: Cálculo de muestra · `workspace.aulas_config` ↔ config de la
  corrida de Aulas · gates de acreditación
- **Fecha**: 2026-08-18
- **Relación**: hermano operativo de
  [ADR 0077](0077-avisa-fuerte-lo-que-sigue-produciendo-dano.md) (avisar
  fuerte) — aquí se decide **no producir la divergencia**, no solo avisarla.

## Ratificación y qué se hizo antes de implementarla

Ratificado el 2026-08-27. Entre la propuesta y la ratificación aparecieron dos
mordidas más de la misma familia, medidas sobre `HSVG26ULT.pulso`, que llevan la
cuenta a **siete**:

**Mordida 6** — el `n_aulas` con el que se compara la frescura de una corrida
**no era un valor guardado sino un default**:
`safeNumber(config.n_aulas, 30)` en `classroomComparisonSelectorSnapshot`. El
aviso decía «n_aulas (corrida 30 · vigente 165)» y mandaba a buscar una cifra
que nadie eligió. Contenido en `e0880c49`: el snapshot declara `null` y el diff
dice «sin declarar».

**Mordida 7** — con el workspace en 165 y el sorteo en 174, la corrida **no se
publicaba en absoluto**, en silencio, y el proyecto nunca llegó a Monitoreo: sin
`monitoreo_config`, sin snapshot, sin plan y sin partes. Contenido en `bcb33dff`:
la identidad decide —`frame_hash` y `selection_run_id`— y la cantidad se declara
en `parametros`.

Ninguno de los dos repara el origen. Las corridas ya guardadas conservan sus
valores desfasados, incluido el 30 que HSVG26ULT tiene persistido en
`frame$config$selector$n_aulas`.

### Una forma de la familia que conviene nombrar

El guardián comparaba `workspace.aulas_config.n_aulas` contra un
`expectedTarget` recomputado del propio workspace (`corridas.ts:113` y
`classroomHandoff.ts:282`). **Dos copias del mismo número coinciden siempre**,
así que el check pasaba en verde sin mirar nunca los 174 del selector ni del
sorteo. No es un campo desfasado: es un check que estructuralmente no puede
fallar. Cualquier implementación del resello debe evitar reproducirlo.

## Contexto

`workspace.aulas_config` guarda la configuración que el analista editó;
la corrida de Aulas (comparación, selección, simulación) viaja con **su
propia copia** de esa config en el snapshot del selector. Los gates de
acreditación comparan ambas firmas y fallan cerrado cuando difieren
(`classroomComparisonMatchesConfig`).

El problema no es el gate: es que las dos copias **se actualizan por caminos
distintos**, campo a campo, y cada camino que olvida un campo produce una
divergencia que el gate castiga después, a veces sin remedio desde la UI.

### Las cinco mordidas medidas de la familia

1. **`n_aulas` 202 en el workspace, 203 en la corrida** — el relato de la
   selección (I3) quedó mudo con el aviso «vuelve a comparar», y re-comparar
   no reparaba nada porque el campo desactualizado vivía en el workspace, no
   en la corrida. Se reparó el dato a mano vía `POST /api/calc-muestra/estudio`.
2. **`simulation_runs`/`monte_carlo_n` 500 en el workspace, 0 en la corrida** —
   misma sesión, mismo gate, mismo callejón.
3. **Un preset mixto perdía las claves sueltas** al aplicarse sobre la config
   existente (memoria del proyecto, 2026-08-16): la mezcla parcial dejó campos
   del preset anterior conviviendo con los nuevos.
4. **La invalidación borra las decisiones y deja la promoción** (memoria,
   2026-08-15): otro camino parcial que dejó un estado mixto irreproducible.
5. **La decisión de alumnos/CH cambiada** dejaba artefactos cuyo `aulas_config`
   citaba la decisión anterior; hoy lo mitiga el sentinela de
   `.cm_alumnos_por_ch_preparar_estudio_guardado`, que es exactamente un
   resello parcial más (borra `n_aulas`, deja el resto).

Cinco reparaciones distintas para el mismo defecto estructural: **dos copias
con dueños distintos y sincronización artesanal**.

## Decisión propuesta

Al **aceptar una corrida como vigente** (la selección se acredita, la
comparación se publica, la simulación se ancla), el backend **resella
`workspace.aulas_config` entero desde la config de la corrida aceptada** —
una asignación completa del snapshot, nunca una mezcla campo a campo.

Reglas concretas:

1. **Un solo sentido**: la corrida aceptada es la verdad; el workspace la
   refleja. Mientras el analista edita sin correr, el workspace diverge
   legítimamente (es su borrador); el gate sigue fallando cerrado y el aviso
   nombra el campo (ya implementado: `classroomComparisonConfigDiff`,
   commit `8961ede3`).
2. **Resello = reemplazo**: se copia el snapshot completo del selector de la
   corrida, incluidas las claves que el workspace no tenía y **eliminando**
   las que la corrida no tiene. Un campo huérfano de mezcla es la mordida 3.
3. **El resello es un evento registrado**: queda en el motor de recorrido
   (quién/cuándo/desde qué corrida), porque sobrescribe ediciones del
   analista y eso debe ser visible, no silencioso.
4. Los sentinelas parciales existentes (borrar `n_aulas` al cambiar la
   decisión de alumnos/CH) se **reemplazan** por invalidación de la corrida +
   resello en la siguiente aceptación; no se acumulan dos mecanismos.

## Alternativas consideradas

- **Seguir sincronizando campo a campo** — es el statu quo; cinco mordidas en
  seis semanas, cada una costó un diagnóstico completo. Descartada.
- **Eliminar la copia del workspace y leer siempre de la corrida** — rompe el
  caso legítimo del borrador (editar config sin correr todavía) y el arranque
  de proyectos sin corrida. Descartada.
- **Solo avisar mejor (ADR 0077)** — ya está hecho (`8961ede3`) y baja el
  costo del diagnóstico, pero no evita la divergencia; el analista sigue
  encontrando su relato mudo. Insuficiente sola.

## Consecuencias

- Positiva: la familia de mordidas muere de raíz — no hay campo que olvidar
  porque no hay mezcla.
- Positiva: el aviso con diff (`8961ede3`) queda solo para la divergencia
  legítima (borrador en curso), donde es información y no síntoma.
- Negativa/costo: el resello sobrescribe ediciones hechas DESPUÉS de correr y
  ANTES de aceptar; por eso la regla 3 lo registra y la UI debe mostrarlo.
- Riesgo a vigilar: los consumidores que hoy leen `workspace.aulas_config`
  esperando el borrador (presets, motor de recorrido) deben declarar cuál de
  las dos verdades quieren.

## Verificación cuando se implemente

Test de contrato: aceptar una corrida con config divergente → el workspace
queda **idéntico** al snapshot (igualdad profunda, no por campos elegidos);
mutante: un resello campo a campo con una clave omitida debe ponerlo rojo.
