---
name: scope-lock
description: Arranca una tarea no trivial en Prosecnur con el protocolo de loops de reparación - scope lock explícito, enrutamiento al agente implementador correcto y stopping rule. Usar al empezar una feature, un fix complejo o un refactor, o cuando el usuario pida "hazlo con scope lock" / "arranca en orden".
---

# Scope lock

Operacionaliza el protocolo `AGENTS.md` → `docs/loops-reparacion.md`: antes de tocar código de producto, la tarea queda acotada por escrito y con su comando de validación definido.

## Flujo

1. **Inspecciona el estado**: `git status --short` — si hay trabajo ajeno a la tarea en el tree, anótalo como "a preservar" (jamás lo pises; considera sugerir `/cerrar-trabajo` primero si es enorme).
2. **Corre o justifica el baseline**: elige el chequeo más estrecho de `docs/loops-reparacion.md` que pueda detectar el fallo antes del cambio. Registra comando y resultado; si es docs-only o el chequeo no aplica, registra el motivo de omisión.
3. **Escribe el scope lock** y muéstralo al usuario en un bloque:
   ```
   SCOPE LOCK
   Módulo: <módulo/feature>
   Archivos a tocar: <lista concreta>
   Explícitamente fuera: <archivos congelados u otros temas cercanos que NO se tocan>
   Riesgo principal: <una línea>
   Validación mínima: <comando(s) exactos que probarán el cambio>
   Stopping rule: <condición observable de "terminado">
   ```
   Recuerda los archivos congelados a crecimiento: `monitoreo_engine.R`, `router_monitoreo.R`, `reporte_plan_ppt.R`, `MonitoreoPage.tsx` — si la tarea los roza, el scope lock debe decir dónde irá el código nuevo en su lugar.
4. **Enruta la implementación**: backend R → agente `backend-r`; frontend → agente `frontend-react`; si cruza ambos, define primero el contrato (endpoint + tipos en `client.ts`) y lanza ambos con el contrato fijado. Tareas de PDF → skill global `prosecnur-pdf-engine`; decisiones de arquitectura → skill global `prosecnur-architecture` (y evalúa si amerita ADR).
5. **Registra cada iteración**: usa el `Iteration Contract` de `docs/loops-reparacion.md` con fallo, cambio enfocado, archivos, validación, resultado, comparación y próxima acción. Si aparece un tema fuera del scope lock, NO lo arregles inline — regístralo como tarea o nota y sigue.
6. **Cierra con verificación**: al terminar la implementación, lanza el agente `verificador` con el scope lock y los contratos de iteración como referencia. La tarea no se declara terminada sin su veredicto.
7. **Sugiere `/cerrar-trabajo`** si el diff quedó listo para commitear.
