# Agentic OS de Prosecnur

El agentic OS usa una sola fuente de conocimiento para Claude y Codex sin
renombrar las rutas históricas de Claude.

## Contrato de compatibilidad

- `AGENTS.md` contiene las reglas durables que Codex descubre al abrir el repo.
- `CLAUDE.md` contiene el router y las reglas de la casa ya usadas por Claude.
- `.claude/skills/*/SKILL.md` y `.claude/agents/*.md` siguen siendo las fuentes
  canónicas editables.
- `.agents/skills/*/SKILL.md` son adaptadores de descubrimiento para Codex. Cada
  adaptador carga el skill canónico correspondiente de `.claude/skills/`.
- `.codex/agents/*.toml` registra para Codex los agentes especializados y les
  ordena cargar su definición canónica de `.claude/agents/`.
- `.codex/config.toml` limita la orquestación a cuatro hilos y profundidad uno;
  no fija modelos, permisos ni herramientas.
- `agentic/manifest.json` inventaría rutas, agentes, skills, dependencias
  externas y políticas transversales.

Así, una mejora realizada por Claude o Codex se hace en la misma fuente bajo
`.claude/`; los adaptadores solo transportan descubrimiento y nunca copian el
procedimiento completo.

## Sincronización segura

La comprobación es de solo lectura y es el comando predeterminado:

```bash
node agentic/sync-agentic-os.mjs --check
```

Después de agregar, retirar o cambiar el nombre/descripción de un agente o
skill canónico:

```bash
node agentic/sync-agentic-os.mjs --write
node agentic/sync-agentic-os.mjs --check
```

`--write` solo regenera los adaptadores Codex. No modifica archivos canónicos de
Claude, código de producto, configuración local, secretos ni proyectos
`.pulso`. Si alguien edita un adaptador a mano, `--check` detecta la divergencia.

## Agregar capacidades

1. Crear primero el agente o skill canónico en `.claude/`.
2. Añadir su nombre a `agentic/manifest.json`.
3. Ejecutar `--write` y después `--check`.
4. Validar el frontmatter del skill y el TOML del agente.
5. Mantener en `AGENTS.md` únicamente las reglas durables y concisas; el detalle
   operativo pertenece al skill o agente especializado.

Las ubicaciones de los adaptadores siguen las superficies oficiales de Codex:
[skills de repositorio](https://developers.openai.com/codex/skills) y
[agentes personalizados de proyecto](https://learn.chatgpt.com/codex/agent-configuration/subagents).
