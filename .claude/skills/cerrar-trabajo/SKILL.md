---
name: cerrar-trabajo
description: Cierra una unidad de trabajo en Prosecnur - verifica el diff con evidencia real y convierte el working tree en commits atómicos conventional. Usar cuando el usuario dice "cierra esto", "commitea el trabajo", "deja todo commiteado", al final de una sesión con cambios, o cuando el working tree acumuló cientos/miles de líneas sin commitear.
---

# Cerrar trabajo

Convierte el working tree en trabajo verificado y commiteado. Este repo tiene el hábito histórico de acumular ~13k líneas sin commitear y de shipping sin verificar (33% de los fixes corrigen el feat anterior) — este skill es el antídoto.

## Flujo

1. **Inventario rápido**: `git status --short` + `git diff --stat`. Si el tree está limpio, dilo y termina.
2. **Verifica primero** (en paralelo con el paso 3 si son agentes): lanza el agente `verificador` sobre el estado actual. Espera su veredicto.
   - RECHAZADO → presenta los fallos al usuario, NO commitees nada roto. Ofrece arreglar primero.
   - APROBADO CON PENDIENTES → los pendientes se anotan y pueden ir en el cuerpo del commit o como tarea siguiente; se puede commitear.
3. **Rebana**: lanza el agente `curador-commits` para producir el plan de rebanadas con mensajes conventional en español y riesgos marcados.
4. **Borrados riesgosos**: si el plan marca borrados sin justificación (🔴), pregunta al usuario ANTES de commitear esa rebanada — en este repo hay historial de borrar/restaurar páginas por accidente. Los demás commits pueden proceder.
5. **Ejecuta las rebanadas** (pide al curador-commits que las ejecute, o hazlo tú con `git add <paths>` + `git commit`). Entre commits, verifica `git status`. Cada commit debe dejar el árbol typecheck-limpio.
6. **Cierre**: reporta commits creados (SHA + mensaje), veredicto de verificación con su evidencia, y pendientes explícitos si los hubo. NO hagas push salvo pedido explícito.

## Reglas

- Nunca `git add -A` a ciegas: los artefactos generados (PNG/XLSX/HTML de QA) no entran; propón `.gitignore` si estorban.
- Nunca commitear con verificación RECHAZADA.
- Mensajes sin mención de herramientas de AI.
- Si el trabajo acumulado mezcla más de ~3 temas independientes, muestra el plan al usuario antes de ejecutar; con 1–2 temas claros, procede directo.
