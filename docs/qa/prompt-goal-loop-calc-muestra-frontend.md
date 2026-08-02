# Prompt operativo — GOAL loop de superficie (afinado) de Cálculo de muestra

Tipo: Prompt de arranque de sesión / entrada de `/loop`
Estado: Vigente
Fecha: 2026-08-02
Autoridad: Lanza el loop de `goal-loop-calc-muestra-frontend-2026-08-02.md`; no lo redefine

Pegar el bloque siguiente tal cual en una sesión nueva (o como prompt de
`/loop`). Este es el loop de **superficie**: afinar visual y conceptualmente lo
ya construido. El loop v2 (`goal-loop-calc-muestra-v2-2026-08-01.md`) sigue
siendo el dueño del dato y del motor; los hallazgos de contrato se anotan allá.

---

Ejecuta el GOAL loop de superficie de Cálculo de muestra.

**PASO CERO, OBLIGATORIO E INNEGOCIABLE: lee COMPLETO
`docs/qa/goal-loop-calc-muestra-frontend-2026-08-02.md` antes de tocar
cualquier archivo, abrir cualquier server o lanzar cualquier agente.** El
estado del loop vive en ese doc: la vara (las cuatro pruebas), los mandatos
S1–S7, la cola de 13 lotes + 5 transversales, el ledger medido sobre el
instrumento, el instrumento declarado (`hsvg2026-seed-radiografia.pulso`, con
sus límites escritos) y el registro F1, F2, F3… La dirección de producto vive
en `Obsidian_Prosecnur/Boceto_Calculo_de_Aulas_v2.canvas`; el dato y el motor,
en el loop v2. Si no leíste el doc, no sabes qué lote toca ni qué instrumento
usar: cualquier trabajo sin leerlo se presume desperdiciado.

Después de leerlo, trabaja así:

1. Ejecuta la **siguiente iteración F** que el doc pida: la primera fila
   desbloqueada de la cola S1–S13, intercalando el transversal (T1–T5) que esa
   superficie abra. Una iteración = una superficie completa o un barrido de
   defectos afines; nunca un defecto suelto.
2. **Afinar es entregar, no decorar.** El producto de cada iteración es una
   superficie que pasa las cuatro pruebas de la vara (decisión, orden, hueco,
   vocabulario) con el dato correcto delante. Prioriza siempre la capacidad
   visible y su correcta aplicación como una sola cosa: menos texto nunca
   significa menos información, y ningún gráfico se rehace sin escala, eje y
   referencia que permitan comparar.
3. **Mide antes de tocar, con una medición por hallazgo.** «Se ve mal» no es un
   hallazgo; «cada boxplot se normaliza contra su propio rango, 0 comparables»
   sí. La medición previa evita el arreglo equivocado (F2 lo probó: la
   hipótesis del bulto era falsa).
4. Sigue la mecánica del doc al pie: auditar con `/ver-ui` sobre el estado
   sembrado → contrato proporcional (10–15 líneas para superficie) → peaje
   estructural de entrada → guard que falle solo → gate proporcional
   (typecheck + Vitest del feature + dos viewports 1440×1000 y 1024×600;
   `test-calc_muestra*` solo si tocaste dato) → commit atómico de la unidad
   (`/cerrar-trabajo`) → **ledger y registro actualizados en el doc**. Una
   iteración que no actualiza el doc no existió.

**REGLAS DE NO DETENCIÓN — el doc las fija y se cumplen literalmente:**

- **Este loop NO se detiene. Solo Gonzalo lo cierra.** Al cerrar una iteración,
  empieza la siguiente de inmediato, hasta agotar el contexto. Al vaciar S13 se
  reaudita desde S1 con la vara más alta.
- **No se detiene por una decisión** (a la bandeja con opciones y
  recomendación; máximo una nueva por iteración), **ni por el motor** (el
  bloqueo se anota en el v2 y se siembra un estado para seguir juzgando la
  superficie), **ni por un veto** (se repara dentro del mismo lote), **ni por
  alcance** (se cierra lo afín y se encola el resto con su medición). Solo un
  gate rojo detiene el **cierre** — nunca el loop.
- **NO termines la sesión con "próximos pasos"**: si puedes enunciarlo, lo
  ejecutas. **NO esperes aprobación de lo ya aprobado**: la existencia del goal
  es la aprobación; los gates son evidencia para veto.

Restricciones que no puedes relajar: React presenta y valida, **nunca
calcula** — todo estadístico o agregado nuevo se pide al loop v2; el
instrumento y sus límites se declaran en la evidencia (un screenshot sin estado
declarado no prueba nada); auditar sobre pantallas vacías no es auditar; el
árbol no acumula más de una unidad sin commitear y el trabajo ajeno sin
commitear se verifica antes de tocarse; `aulasParts` y los archivos grandes no
crecen; navegación por dirección canónica; el 8787 es del usuario y no se mata;
commits en español. Trampas medidas: backend R vivo no toma cambios de fuente;
`?pulso=` se consume una vez; Vitest da falsos rojos con el dev server
encendido.

Al final de tu turno reporta: iteraciones F ejecutadas, filas del ledger que se
movieron (antes → después, medidas), decisiones nuevas en bandeja si las hay, y
qué lote de la cola toca después — ya anotado en el doc, no solo en el mensaje.
