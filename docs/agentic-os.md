# Agentic OS de Prosecnur

El agente raíz es el orquestador. Conserva el contexto del usuario, carga los
skills, fija alcance y ownership, delega, une resultados y controla cualquier
acción externa. Ningún especialista puede crear otros agentes.

## Fuente única y adaptadores

- `AGENTS.md` da a Codex la autorización y los límites durables.
- `CLAUDE.md` enruta capacidades y reglas de casa para Claude.
- `.claude/skills/*/SKILL.md` y `.claude/agents/*.md` son las únicas fuentes
  canónicas editables.
- `.agents/skills/` y `.codex/agents/` son adaptadores generados para Codex.
- `agentic/manifest.json` (schema v2) declara perfiles, proveedores, límites,
  pools por ruta, condiciones seriales y gate final.
- `agentic/orchestration-policy.mjs` selecciona una oleada y conserva las líneas
  pendientes; sus smokes deterministas no reemplazan el juicio del lead.

Los adaptadores llevan una marca generada. El sincronizador nunca sobrescribe
una colisión manual ni borra un archivo sin esa marca, protege `.claude/` y
escribe cada salida mediante archivo temporal + rename atómico.

## Contrato de orquestación

Toda tarea no trivial carga `orquestar-trabajo`; los cambios y reparaciones de
producto empiezan además con `scope-lock`. El lead publica un
`ORCHESTRATION CONTRACT` con ruta, oleadas, objetivo por línea,
perfil, evidencia, archivos permitidos, exclusiones, dependencias, condición de
unión y stopping rule.

La secuencia normal es:

1. El lead carga instrucciones, clasifica y bloquea el scope.
2. Hasta tres agentes read-only/reviewer investigan en paralelo.
3. El lead sintetiza y congela contratos y ownership.
4. Hasta dos writers trabajan en archivos disjuntos; el tercer worker puede
   revisar. Antes del spawn, los globs se materializan en `ownedFiles` exactos;
   una colisión o glob sin resolver detiene la oleada.
5. Contratos, metodología y QA visual revisan en paralelo cuando aplican.
6. `verificador` ejecuta el gate integrado de manera serial.

Se paralelizan investigación independiente, hipótesis competidoras, frontend y
backend ya contratados, autoría separada de regresiones y checks por capa. Se
serializan cambios triviales de un archivo, contratos indefinidos, ownership
solapado, migraciones `.pulso`, credenciales, acciones destructivas,
publicación y servicios externos. Si no hay subagentes, se mantienen las mismas
líneas en orden secuencial y se informa el fallback.

Límites de política: lead + tres workers, máximo dos writers, profundidad uno,
un reintento o reasignación. Codex aplica técnicamente hilos/profundidad; en
Claude el lead impone el cap por contrato. Un resultado incompleto nunca se
sintetiza como aprobado.

## Perfiles y especialistas

Los perfiles `read-only`, `reviewer`, `writer` y `gate` se convierten en el
sandbox Codex declarado por el manifiesto cuando el proveedor lo soporta. Los
no-writer prohíben `Write`, `Edit` y `NotebookEdit`; QA y gate pueden producir
evidencia temporal, pero no editar producto. Agent Teams hereda permisos del
lead: una oleada read-only requiere al lead en plan y nunca se combina con
bypass, accept-edits ni auto-approval. Donde no exista un sandbox granular, la
restricción de evidencia temporal es contractual y se verifica después.

Los 13 agentes son cinco capacidades generales y ocho especialistas:

- Generales: `backend-r`, `frontend-react`, `auditor-deuda`,
  `curador-commits`, `verificador`.
- Especialistas: `diagnosticador-regresiones`, `autor-regresiones`,
  `guardian-contratos`, `qa-visual-desktop`, `revisor-metodologico`,
  `especialista-entregables`, `especialista-integraciones`,
  `desktop-packaging`.

Cuando coinciden, el especialista prevalece sobre el generalista. El autor de
regresiones posee exclusivamente tests/fixtures asignados; el implementador
posee producto. `verificador` nunca comparte la oleada de escritura.

## Claude y Codex

Claude solicita subagentes background cuando la versión los ofrece.
`.claude/settings.json`
habilita `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` y modo `in-process`; Agent
Teams queda reservado para hipótesis que deban debatirse o features cross-layer
que necesiten comunicación directa. La cascada es Teams → subagentes background
→ subagentes foreground → ejecución serial con razón registrada.

Codex usa `features.multi_agent=true`, cuatro hilos, profundidad uno e
interrupciones habilitadas. El skill y `AGENTS.md` autorizan al lead a delegar;
los TOML generados prohíben fan-out y no fijan modelos.

## Sincronización y CI

Comprobación local, sin depender de skills globales:

```bash
node agentic/sync-agentic-os.mjs --check --platform=none
```

Comprobación de capacidades instaladas en esta máquina (ausencias externas son
warnings; `--strict-external` las vuelve error):

```bash
node agentic/sync-agentic-os.mjs --check --platform=all
```

Después de editar una fuente canónica o el manifiesto:

```bash
node agentic/sync-agentic-os.mjs --write --platform=none
node agentic/sync-agentic-os.mjs --check --platform=none
node --test agentic/tests/*.test.mjs
```

El job `Agentic OS` del workflow de calidad ejecuta tests, smokes de política y
el check reproducible. Cubre altas/bajas, inventario exacto, deriva, colisiones,
referencias inexistentes, rutas sin gate, límites, sandbox read-only y settings
híbridos de Claude.

Los smokes offline comprueban la política, no el runtime del proveedor. Los
smokes live son opt-in, parten de un árbol sin cambios y registran IDs, inicio,
fin y resultado de cada worker. La auditoría frontend/backend/tests debe mostrar
tres workers simultáneos, esperar los tres, producir una sola síntesis y dejar
idéntico el snapshot `git status --porcelain` anterior/posterior. En Claude se
repite con subagentes y con tres hipótesis comunicantes mediante Agent Teams.
Además se comprueba una tarea trivial sin spawn. El smoke de dos writers con
globs disjuntos y rechazo previo de un solape se ejecuta únicamente en una
fixture o worktree temporal desechable; el repositorio principal queda intacto.
Si el binario, versión o capacidad no están disponibles, se registra el
fallback; CI no depende de credenciales ni de servicios externos.

La escritura atómica es por adaptador, no una transacción global del lote.

Referencias: [subagentes de Codex](https://learn.chatgpt.com/docs/agent-configuration/subagents)
y [Agent Teams de Claude](https://code.claude.com/docs/en/agent-teams).
