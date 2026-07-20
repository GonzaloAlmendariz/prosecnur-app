# ADR 0039: Agentic OS multirepo neutral al proveedor

Estado: Aceptado

Fecha: 2026-07-19

## Contexto

La auditoría de 28 repositorios encontró tres implementaciones sustantivas de
Agentic OS, cuatro repositorios con configuración aislada y 21 sin una capa
agentic. Prosecnur y Art_app comparten nueve nombres de skills, pero sus
contenidos y reglas de producto divergen. Copiar cualquiera de esas variantes a
una instalación global produciría colisiones nominales y autoridad ambigua.

Claude y Codex también expresan agentes, skills y restricciones de manera
distinta. Mantener dos catálogos manuales duplicaría instrucciones, perdería
trazabilidad y haría difícil demostrar qué archivos pertenecen al generador.
Al mismo tiempo, un catálogo global no debe desplazar las reglas, skills o
estado canónico de cada repositorio.

## Decisión

Se adopta una arquitectura de tres capas:

1. **Núcleo global universal.** Un catálogo neutral schema v3, en un checkout
   independiente llamado `AgenticOS`, publica únicamente capacidades
   namespaced `agentic-core-*`. Renderers separados materializan salidas para
   Claude y Codex desde la misma definición.
2. **Packs de stack opt-in.** Capacidades reutilizables de React, Electron, R,
   publicación u otros stacks se instalan sólo cuando el repositorio las
   selecciona expresamente. No se infieren por la presencia de archivos ni se
   despliegan en masa.
3. **Overlays de dominio repo-locales.** Reglas, skills y agentes específicos
   de Prosecnur, Art_app u otro producto permanecen en su repositorio. Nunca se
   copian globalmente ni se renombran como si fueran universales.

La instalación global aporta disponibilidad; la autoridad sigue siendo el
proyecto. Las instrucciones del repositorio, sus fuentes canónicas y sus
overlays gobiernan la tarea. El núcleo global no sobrescribe `AGENTS.md`,
`CLAUDE.md`, skills locales ni agentes locales.

### Contrato de generación

El instalador debe operar fail-closed:

- declarar namespace, versión del catálogo, proveedor, scope y target;
- registrar para cada salida fuente, estado administrado y hash esperado;
- resolver y validar todas las colisiones antes de escribir;
- preservar archivos manuales o de otro namespace;
- rechazar rutas absolutas del catálogo, traversal, globs no materializados,
  backslashes y cualquier path que atraviese un symlink;
- mantener cada salida contenida en el target explícito;
- promover sólo el lote prevalidado y conservar evidencia suficiente para
  comprobar deriva;
- ante fallo, revertir únicamente salidas propias cuyo hash siga siendo el
  esperado; nunca ejecutar un rollback amplio del repositorio.

La configuración de cada proveedor se inspecciona, pero no se toma como
propiedad del catálogo si ya era manual. Las restricciones que el proveedor no
pueda imponer nativamente permanecen contractuales y visibles en el artefacto
renderizado.

## Consecuencias

- Los nombres universales dejan de competir con skills de producto gracias al
  prefijo `agentic-core-*`.
- Claude y Codex pueden evolucionar sus formatos sin bifurcar el significado
  del catálogo.
- Cada repositorio conserva autonomía y puede adoptar sólo el núcleo, un pack o
  ninguno.
- La instalación global introduce una versión compartida que debe auditarse;
  no reemplaza el versionado ni los checks locales.
- Los packs y overlays requieren ownership explícito. Una coincidencia de
  nombre no demuestra equivalencia semántica.
- Un repositorio dirty, vendorizado, temporal o con autoridad indefinida queda
  fuera del rollout automático.

## Cumplimiento

Toda adopción usa un checkout explícito y un target explícito.
`AGENTIC_OS_ROOT` apunta al checkout independiente y `AGENTIC_TARGET` al root
global controlado; ninguno se infiere desde el repositorio activo:

```bash
node "$AGENTIC_OS_ROOT/bin/agentic-core.mjs" dry-run --scope global --target "$AGENTIC_TARGET" --providers claude,codex
node "$AGENTIC_OS_ROOT/bin/agentic-core.mjs" init --scope global --target "$AGENTIC_TARGET" --providers claude,codex
node "$AGENTIC_OS_ROOT/bin/agentic-core.mjs" sync --scope global --target "$AGENTIC_TARGET" --providers claude,codex
node "$AGENTIC_OS_ROOT/bin/agentic-core.mjs" check --scope global --target "$AGENTIC_TARGET" --providers claude,codex
node "$AGENTIC_OS_ROOT/bin/agentic-core.mjs" doctor --scope global --target "$AGENTIC_TARGET" --providers claude,codex
```

El lead debe conservar la salida de los cinco pasos, verificar que el dry-run
no propone sobrescrituras y ejecutar además los checks locales del repositorio
piloto. Ninguna instalación se considera completada sólo por estar disponible
globalmente.

## Notas

- [Contrato local del Agentic OS de Prosecnur](../agentic-os.md)
- [Auditoría y plan de rollout del 2026-07-19](../qa/agentic-os-rollout-2026-07-19.md)
