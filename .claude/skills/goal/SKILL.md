---
name: goal
description: Abre o continúa un GOAL - un loop de convergencia sobre una calidad que no se alcanza de una vez (el motor de gráficos, la coherencia visual, un motor de entregables). Usar cuando el usuario pida "configura un goal", "abre un goal de X", "sigue con el goal", o cuando una tarea evidentemente no cabe en una tanda y va a volver sesión tras sesión.
---

# GOAL — loop de convergencia

Un GOAL no es una lista de tareas: es una **vara** —cómo se ve el trabajo cuando está bien— y una **cola** de lo que falta para alcanzarla. Existe porque hay calidades que no se arreglan de una vez: el motor de gráficos, que la app se vea como una sola app, que un entregable salga sin retoques. Vuelven cada sesión y sin un documento vivo se reinvestigan desde cero.

**Sólo el usuario cierra un GOAL.** Ni el gate en verde ni «ya no encuentro nada» lo cierran.

## Abrir uno

1. **Nombra la calidad, no la tarea.** «El mazo sale sin retoques» es una vara; «arreglar el pie de la lámina 9» es un ítem.
2. **Escribe la vara**: 4–8 afirmaciones comprobables, cada una con **cómo se mide**. Si una no se puede medir, no es vara: es deseo.
3. **Crea el doc vivo** en `docs/qa/goal-<tema>-<fecha>.md` con tres bloques:
   - **Vara** (V1…Vn) — el estado deseado y su medición.
   - **Cola** (L1…Ln) — lo que falta, con dónde vive y su estado.
   - **Trampas** — lo que ya costó una conclusión falsa. Es la sección que evita repetir el error.
4. **Anótalo en la memoria** como `project_goal_<tema>` apuntando al doc.

## Continuar uno

1. **Dibuja el doc entero** antes de tocar nada — la cola completa, no un «faltan 3». Un contador oculta justo lo que el doc existe para hacer visible.
2. **Mide antes.** El número o la captura de partida entra en el doc.
3. **Toma el siguiente ítem de la cola**, no el más fácil ni el más vistoso.
4. **Mide después, con su control.** Un aserto que no distingue el caso bueno del malo no verifica nada: si el arreglo no cambiara nada, ¿este aserto seguiría pasando? Si sí, no sirve.
5. **Lo que aprendas de un ítem que NO tocaste también se anota** — de dónde sale un valor, qué lo bloquea. Eso es lo que evita reinvestigarlo.
6. **Gate escalado al diff** y commit por unidad coherente (`/cerrar-trabajo`).
7. **Cierra el turno dibujando el doc otra vez**, con lo movido y lo que espera al usuario.

## Estados de la cola

- `☐ sin empezar` · `◐ a medias` (di qué falta) · `☑ hecho` (con su evidencia)
- `⛔ bloqueado` — no se puede avanzar sin una decisión o una capacidad que no tienes. **Bloqueado no es pendiente**: se marca aparte y se dice qué lo desbloquea.
- Lo que espera al usuario va en su propia tabla, con **por qué no puedes tú**.

## Reglas que salieron de GOALs anteriores

- **Persistir no es aplicar.** Un valor guardado y visible en pantalla no dice nada del entregable. La prueba es el render.
- **El registro no es el motor.** Cambiar un `default` del catálogo no cambia lo que se dibuja.
- **La cadena de QA tiene su propia ceguera.** Anota lo que tu herramienta de verificación NO puede ver, en cuanto lo descubras: LibreOffice renderiza `vert` y `vert270` idénticos y resuelve un `<p:ph/>` vacío a horizontal, así que dos defectos reales del PPT no salían en los PNG.
- **Cada hallazgo de propina se anota como ítem nuevo**, aunque lo cierres en el momento. La cola crece y está bien: es lo que se estaba ignorando.
