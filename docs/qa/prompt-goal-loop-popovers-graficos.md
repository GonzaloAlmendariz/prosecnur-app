# Prompt operativo — GOAL loop de las bibliotecas de Gráficos

Tipo: Prompt de arranque de sesión / entrada de `/loop`
Estado: Vigente
Fecha: 2026-08-07
Autoridad: Lanza el loop de `goal-loop-popovers-graficos-2026-08-07.md`; no lo redefine

Pegar el bloque siguiente tal cual en una sesión nueva (o como prompt de
`/loop`).

---

Ejecuta el GOAL loop de las bibliotecas de Gráficos (popover de slides y
popover de graficadores).

**MANDATO PERMANENTE (Gonzalo, 2026-08-07): este goal es INDEFINIDO — no
termina, no finaliza y no se detiene por absolutamente nada.** El popover de
slides merece un esfuerzo alto y enorme de reconfiguración; el de
graficadores debe alcanzar la misma gramática. Al agotar un lote se pasa al
siguiente; al agotar la cola se re-censa y se re-audita con vara más alta.

**PASO CERO, OBLIGATORIO E INNEGOCIABLE: lee COMPLETO
`docs/qa/goal-loop-popovers-graficos-2026-08-07.md` antes de tocar cualquier
archivo, abrir cualquier server o lanzar cualquier agente.** Ahí viven la
vara (V1–V8), el censo, el baseline (B1–B18), la cola de lotes (L1–L6), el
ledger y el registro de iteraciones. Cualquier trabajo sin leerlo se presume
desperdiciado.

Reglas de operación:

1. **Toma el primer lote pendiente de la cola** (prioridad L1: la
   reconfiguración del SlidePicker) y ejecútalo entero por la Rama 2 del
   agentic OS: dirección visual congelada antes de escribir código, un solo
   writer frontend con globs acotados, QA independiente, `verificador` al
   final.
2. **CSS nuevo en hoja propia** — `editor-v2.css` está congelado; ni una
   línea más ahí.
3. **Evidencia o no pasó**: screenshot antes/después por hallazgo, en
   1440x1000 y 1024x600, con el popover abierto de verdad (`/ver-ui`,
   proyecto `acnur_acg` de referencia; el popover de slides abre con la
   tecla `N` dentro de Gráficos).
4. **La vara se cita por código** (`V2 en SlidePicker > tile población`),
   nunca «se ve raro». Verde por conformidad, no por ausencia.
5. **No te detengas**: decisiones a la bandeja del doc con recomendación y
   supuesto conservador; hallazgos ajenos al loop que corresponda (motor
   PPT, multibase, ADR); defectos grandes se acotan con guard y entran como
   lote nuevo.
6. **Cierra cada lote actualizando el doc** (ledger + registro I<n>) y con
   commit conventional en español. Un lote que no actualiza el doc no
   existió.
