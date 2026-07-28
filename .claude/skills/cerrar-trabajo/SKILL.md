---
name: cerrar-trabajo
description: Cierra una unidad de trabajo en Prosecnur - verifica el diff con evidencia real y convierte el working tree en commits atómicos conventional. Usar cuando el usuario dice "cierra esto", "commitea el trabajo", "deja todo commiteado", al final de una sesión con cambios, o cuando el working tree acumuló cientos/miles de líneas sin commitear.
---

# Cerrar trabajo

Convierte el working tree en trabajo verificado y commiteado. Este repo tiene el hábito histórico de acumular ~13k líneas sin commitear y de shipping sin verificar (33% de los fixes corrigen el feat anterior) — este skill es el antídoto.

## Flujo

1. **Inventario rápido**: `git status --short` + `git diff --stat`. Si el tree está limpio, dilo y termina.
2. **Prepara dos líneas independientes**: lanza `verificador` sobre el estado actual y `curador-commits` para producir únicamente el plan de rebanadas. El curador permanece plan-only y no ejecuta `git add`/`git commit` mientras el gate está corriendo.
3. **Espera y une**: espera ambos resultados; primero decide con el veredicto y después usa el plan del curador.
   - RECHAZADO → presenta los fallos al usuario, NO commitees nada roto. Ofrece arreglar primero.
   - APROBADO CON PENDIENTES → los pendientes se anotan y pueden ir en el cuerpo del commit o como tarea siguiente; se puede commitear.
4. **Borrados riesgosos**: si el plan marca borrados sin justificación (🔴), pregunta al usuario ANTES de commitear esa rebanada — en este repo hay historial de borrar/restaurar páginas por accidente. Los demás commits pueden proceder.
5. **Ejecuta las rebanadas tras aprobación** (pide al curador-commits que las ejecute, o hazlo tú con `git add <paths>` + `git commit`). Entre commits, verifica `git status`. Cada commit debe dejar el árbol typecheck-limpio.
6. **Cierre**: reporta commits creados (SHA + mensaje), veredicto de verificación con su evidencia, y pendientes explícitos si los hubo. NO hagas push salvo pedido explícito.

## Escala la verificación al diff, no al miedo

El gate se paga en minutos de reloj del usuario. **Verificar de más no es prudencia: es un costo real** y una sesión de 5 archivos de frontend se fue a una hora por correr matrices completas donde bastaban dos rutas.

Regla: **el gate cubre lo que el diff toca, y solo eso.** Elige el nivel más barato que produzca evidencia literal.

| Alcance del diff | Chequeo visual que corresponde |
| --- | --- |
| 1–3 rutas identificadas | `make ui-quick-check PULSO=<copia> UI_QA_ARGS='--route /a --route /b --viewport …'` |
| Un módulo entero | las rutas de ese módulo, un fixture |
| Navegación, chrome, layout global, release | matriz completa, y ahí sí los dos fixtures |

Presupuesto por unidad de trabajo: **una** matriz completa como máximo, y solo si el diff la justifica. Los dos fixtures se reservan para corte de release.

Aplica igual al subagente: en el prompt del `verificador` **dale el alcance ya acotado** —"estas dos rutas, un fixture"— o correrá matrices completas y reintentos por su cuenta. Un verificador mal scopeado costó 45 minutos de los 60 de esa sesión.

Otras dos fugas medidas, del mismo orden de magnitud:

- **Warm start del `.pulso`**: abrir un fixture grande cuesta 2–3 min. Levanta el stack **una vez** y verifica todo en esa sesión; no una sesión por hallazgo.
- **Suite R completa**: ~48 min. Solo si el diff toca `api/R/`. Para un diff de frontend no se corre. Para R focalizado, `testthat::test_file`.

Si el usuario pide explícitamente exhaustividad, o el cambio es de release, sube el nivel — pero dilo y estima el costo antes de arrancar, no después.

## Reglas

- Nunca `git add -A` a ciegas: los artefactos generados (PNG/XLSX/HTML de QA) no entran; propón `.gitignore` si estorban.
- Nunca commitear con verificación RECHAZADA.
- Mensajes sin mención de herramientas de AI.
- Si el trabajo acumulado mezcla más de ~3 temas independientes, muestra el plan al usuario antes de ejecutar; con 1–2 temas claros, procede directo.
