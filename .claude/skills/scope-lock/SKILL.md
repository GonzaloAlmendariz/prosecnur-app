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
   Si la tarea roza un archivo congelado a crecimiento, el scope lock debe decir dónde irá el código nuevo en su lugar. La lista viva está en `agentic/manifest.json` (`policy.frozen_growth_files`); consúltala con `node agentic/sync-agentic-os.mjs --audit` en vez de fiarte de una copia en prosa.
4. **Congela la orquestación**: para trabajo complejo o con dos líneas independientes, carga `orquestar-trabajo` y escribe su `ORCHESTRATION CONTRACT` antes de delegar. El scope lock controla el cambio; el contrato controla oleadas, perfiles, ownership, dependencias y unión. Si los archivos se solapan o el contrato aún no está definido, trabaja en serie.
5. **Enruta por especialidad**: regresiones → `diagnosticador-regresiones` + `autor-regresiones`; backend general → `backend-r`; frontend → `frontend-react`; contratos → `guardian-contratos`; metodología → `revisor-metodologico`; exports → `especialista-entregables`; conectores → `especialista-integraciones`; Electron/instaladores → `desktop-packaging`; UI real → `qa-visual-desktop`. El especialista prevalece sobre el generalista. Si cruza capas, fija primero el contrato compartido y asigna globs disjuntos.
6. **Registra cada iteración**: usa el `Iteration Contract` de `docs/loops-reparacion.md` con fallo, cambio enfocado, archivos, validación, resultado, comparación y próxima acción. Si aparece un tema fuera del scope lock, NO lo arregles inline — regístralo como tarea o nota y sigue.
7. **Cierra con verificación serial**: tras unir todas las oleadas, lanza `verificador` con el scope lock y los contratos de iteración. La tarea no se declara terminada sin su veredicto.
8. **Sugiere `/cerrar-trabajo`** si el diff quedó listo para commitear.
