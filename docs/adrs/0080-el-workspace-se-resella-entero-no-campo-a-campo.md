# ADR 0080 — El workspace se resella entero, no campo a campo

- **Estado**: Propuesto (borrador del loop de Cálculo de muestra; la decisión
  es de Gonzalo)
- **Implementación**: No iniciada — este ADR primero
- **Ámbito**: Cálculo de muestra · `workspace.aulas_config` ↔ config de la
  corrida de Aulas · gates de acreditación
- **Fecha**: 2026-08-18
- **Relación**: hermano operativo de
  [ADR 0077](0077-avisa-fuerte-lo-que-sigue-produciendo-dano.md) (avisar
  fuerte) — aquí se decide **no producir la divergencia**, no solo avisarla.

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
