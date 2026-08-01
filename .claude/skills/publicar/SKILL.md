---
name: publicar
description: Publica cambios o un release de Prosecnur con preflight local, efectos externos controlados y monitoreo hasta verificar el resultado real. Usar al pedir push, publicación o diagnóstico de un run remoto.
---

# Publicar

Publicación es una operación externa y fail-closed. El lead confirma alcance,
branch, SHA y autoridad antes de cada push, tag, reintento o edición de un
release; los workers sólo preparan evidencia local.

## 1. Preflight

1. Verifica `git status`, diff, commits y que el SHA candidato sea exactamente
   el revisado.
2. Lee `.github/workflows/quality.yml` y ejecuta localmente sus gates vigentes:
   Agentic OS, desktop, typecheck, tests, build de producción, suite R y audits
   de frontend/desktop.
3. Ejecuta además:

   ```bash
   node scripts/check-docs-governance.mjs
   node --test scripts/tests/release-contract.test.mjs
   pnpm -C frontend exec vitest run src/api/client.test.ts
   ```

4. Respeta la API modular: funcionalidad nueva vive en
   `frontend/src/api/<dominio>.ts`; `frontend/src/api/client.ts` sigue siendo un
   barrel pequeño de compatibilidad.
5. Si un audit de dependencias no puede consultar su servicio, marca el gate
   como **no ejecutado**. Nunca permite declarar verde ni publicar `stable`.
   Una vulnerabilidad `high` también detiene el proceso.
6. Si el diff toca UI, exige la evidencia visual proporcional y el mismo
   proyecto de referencia usado durante la implementación.

No se pushea “para ver si CI pasa”.

## 2. Selecciona el canal

### Cambios ordinarios

Push sólo del branch/SHA autorizado. No mezcles un tag de release. Monitorea el
run de Quality hasta estado terminal.

### Preview interno

Dispara manualmente `Release` sólo con autoridad explícita. Debe ejecutar
`internal-preview`: sin notas públicas, updater ni permisos de escritura sobre
releases.

### Release estable

Antes del tag exige:

- `/preparar-release` cerrado y cinco superficies alineadas;
- `.github/RELEASE_NOTES.md` completo y correspondiente a la versión;
- `node scripts/release-contract.mjs prepare` en verde;
- Quality verde en el mismo SHA;
- audits realmente ejecutados, no omitidos por indisponibilidad.

Después de crear localmente el tag autorizado, ejecuta
`node scripts/release-contract.mjs stable --tag vX.Y.Z`. El push del tag es un
segundo efecto externo y requiere autoridad. El workflow debe detenerse ante
cualquier plataforma o asset ausente. La firma de distribución ya no es uno de
esos gates (ADR 0056).

## 3. Monitoreo y diagnóstico

1. Localiza el run por workflow, branch/tag y SHA con `gh run list`.
2. Espera un estado terminal; no infieras éxito de un job parcial.
3. Ante fallo usa `gh run view <id> --log-failed`, identifica la primera causa
   y reproduce el gate focal localmente.
4. Repara una sola causa por iteración, vuelve a correr el preflight afectado y
   solicita autoridad antes de un nuevo push o rerun.

No relajes tests, firmas, globs de assets ni políticas para conseguir verde.
Una caída del servicio de audits se reintenta o queda como bloqueo.

## 4. Verificación del resultado

Para un push ordinario, confirma Quality verde en el SHA publicado. Para un
release estable, verifica además mediante GitHub API:

- release no draft y asociado al tag correcto;
- notas correspondientes a `.github/RELEASE_NOTES.md`;
- instalador y ZIP Windows íntegros, con `latest.yml` presente;
- dos DMG macOS, uno por arquitectura;
- ningún asset de otro canal.

El ADR 0056 retiró la exigencia de firma de distribución: los instalables salen
sin firmar y macOS no publica ZIP, `latest-mac.yml` ni blockmaps porque
`mac.target` no los emite. No los reclames como faltantes ni los reintroduzcas
en el workflow sin cargar antes los certificados.

Un job verde con release incompleto no es éxito. Cierra con SHA/tag, comandos
externos ejecutados, enlace al run/release, conclusión de cada gate y cualquier
bloqueo restante.
