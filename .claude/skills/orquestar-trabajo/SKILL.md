---
name: orquestar-trabajo
description: Orquesta tareas no triviales de Prosecnur en oleadas paralelas seguras. Usar automáticamente cuando haya dos o más líneas independientes de investigación, implementación o revisión; cuando la tarea cruce frontend/backend/tests/metodología/QA; en auditorías profundas, bugs ambiguos, features multilayer o cuando el usuario pida agentes, delegación o trabajo paralelo. Mantiene seriales las tareas pequeñas, conflictivas, destructivas o externas.
---

# Orquestar trabajo

El agente raíz es el lead. Conserva decisiones, lectura de skills, scope lock,
contratos, integración y acciones externas. Los agentes hijos ejecutan tareas
acotadas; nunca delegan de nuevo.

## Decidir si paralelizar

Lanza 2–3 agentes en la misma oleada cuando existan al menos dos líneas
independientes: hipótesis, capas, módulos, pruebas o lentes de revisión. Mantén
la tarea serial si es un cambio trivial, hay dependencia inmediata, se tocaría
el mismo archivo, el contrato sigue abierto, existe migración `.pulso`, o la
acción es destructiva, publica, usa credenciales o llama un servicio externo.

Límites: máximo 3 trabajadores, máximo 2 escritores, profundidad 1. El tercer
slot de una oleada con escritores se reserva para lectura/revisión. En Claude,
si Teams no está disponible usa subagentes; si background no está disponible
usa foreground; si no hay subagentes ejecuta las líneas en serie. En Codex, si
no hay subagentes usa serie. Registra `FALLBACK: sequential (<razón>)` al
degradar a un solo agente.

## Contrato obligatorio

Antes de lanzar, muestra una versión breve y pasa a cada agente:

```text
ORCHESTRATION CONTRACT
Ruta/oleada:
Objetivo:
Perfil y can_edit:
Evidencia requerida:
Allowed globs:
Excluded globs:
Dependencias/contrato de entrada:
Condición de unión:
Stopping rule:
Salida: COMPLETE | BLOCKED | FAILED + hallazgos/cambios + archivos + evidencia + pendientes
```

No lances dos escritores con globs solapados. Un archivo de contrato compartido
(`client.ts`, router, session store, manifiesto, theme o archivo congelado) tiene
un único dueño. Si participa `autor-regresiones`, posee tests/fixtures en
exclusiva. El especialista prevalece sobre el generalista en integraciones,
entregables y packaging.

Antes de abrir una oleada de escritura, materializa los globs en una lista
exacta `ownedFiles` y ejecuta el preflight de colisiones. Prefiere entradas
`{ path, kind: "file" | "tree" }`; trata los strings heredados como archivos,
salvo cuando terminan en `/`. Preserva rutas y casing: no normalices casing,
`.` ni `..`. Rechaza rutas absolutas, backslashes, caracteres de control,
segmentos vacíos o ambiguos, globs y `kind` desconocidos. Un writer sin
`ownedFiles`, un perfil desconocido, una identidad inválida o una colisión
exacta o tree/descendiente bloquea el lanzamiento. Si sobran líneas por los
caps, consérvalas como `pending` para la siguiente oleada; ninguna se pierde.

## Oleadas

1. **Preparar**: el lead lee instrucciones, inspecciona estado, fija scope y
   clasifica la ruta.
2. **Descubrir**: diagnóstico, contratos, metodología o QA investigan en
   paralelo, sin editar.
3. **Congelar**: el lead sintetiza y fija comportamiento, interfaces y
   ownership. Ningún escritor parte con contrato abierto.
4. **Implementar**: hasta dos escritores trabajan en superficies disjuntas.
5. **Revisar**: hasta tres revisores comprueban visual, contrato, metodología y
   pruebas según corresponda.
6. **Cerrar**: `verificador` corre serialmente después de todas las revisiones;
   luego puede actuar `cerrar-trabajo`.

Para bugs: diagnóstico paralelo → test rojo → implementación → revisiones →
gate. Para features cross-layer: revisiones iniciales → contrato congelado →
frontend/backend en paralelo → revisiones → gate. Para deuda, reparte ejes entre
tres `auditor-deuda`. En cierre, `verificador` y `curador-commits` pueden
analizar en paralelo, pero el curador queda plan-only hasta aprobación.

## Control y fallos

El lead espera todas las respuestas de una oleada y sintetiza contradicciones;
no concatena reportes. Si un agente falla, reintenta o reasigna una vez. Si
vuelve a fallar, marca la línea `FAILED` y no declara la tarea aprobada. Si
aparece trabajo fuera del ownership, el hijo se detiene y devuelve `BLOCKED`.
Ante una nueva instrucción del usuario, el lead interrumpe agentes que quedaron
obsoletos antes de replanificar.

Claude solicita subagentes background cuando están disponibles y reserva Agent
Teams para trabajadores que necesiten debatir o coordinarse directamente.
Codex usa subagentes directos. En ambos casos el lead conserva la síntesis y el
gate final.
