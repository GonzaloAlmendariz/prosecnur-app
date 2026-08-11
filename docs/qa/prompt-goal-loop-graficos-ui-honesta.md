# Prompt del loop — interfaz de Gráficos honesta

Pegar como prompt del `/loop`. El estado vive en
[goal-loop-graficos-ui-honesta-2026-08-10.md](goal-loop-graficos-ui-honesta-2026-08-10.md).

---

Continúa el GOAL loop de `docs/qa/goal-loop-graficos-ui-honesta-2026-08-10.md`.

Lee el doc primero: la vara, la restricción dura y la cola están ahí, no aquí.

En esta iteración:

1. Elige **UN** ítem de la cola. Si la cola tiene menos de tres, **mide algo
   nuevo** de la interfaz de Gráficos y añádelo antes de trabajar.
2. Mide el estado actual con un número o una captura **antes** de tocar nada.
3. Aplícalo respetando la restricción dura: **añadir, no mover**. Si el ítem
   exige reorganizar, renombrar o cambiar dónde vive un control, o cambiar un
   default que mueva mazos ya entregados, **NO lo apliques**: escríbelo en
   §Propuestas con su evidencia y pasa a otro ítem.
4. Verifica de verdad: `pnpm exec tsc --noEmit` desde `frontend/`, vitest del
   feature tocado, y la UI real abierta sobre
   `~/Documents/Pulso/ACRD CONTA/Conta 10-08 equivalencias.pulso`. Si tocaste el
   motor, además renderiza el `.pulso` y compara.
5. Registra la iteración en §Bitácora: qué mediste, qué cambiaste, qué demuestra
   que funciona. Commit con conventional commit en español.

Reglas que no se negocian:

- **Sin evidencia no está hecho.** Nada de «debería funcionar».
- **Una cosa por iteración.** Es preferible cerrar una bien que dejar tres a medias.
- Si no encuentras nada que mejorar sin romper algo, **dilo y no inventes**:
  registra la iteración como sin cambios y qué revisaste.
- No toques archivos congelados por encima de su línea base
  (`node agentic/sync-agentic-os.mjs --audit`).
- Apaga los servers de preview que levantes; el 8787 es del usuario.
