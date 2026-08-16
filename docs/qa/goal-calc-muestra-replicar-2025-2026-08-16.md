# GOAL — Cálculo de muestra: reconstruir HSyVbG desde cero y llegar al 2025

Tipo: Goal operativo (loop de convergencia)
Estado: Abierto
Fecha: 2026-08-16
Autoridad: Objetivo de trabajo medible; **sólo Gonzalo lo cierra**

## Por qué existe

El módulo tiene sus piezas verificadas una a una —el marco declara sus causas,
la π es la del sorteo ejecutado, el build no congela la app— pero **nadie ha
recorrido el camino entero de principio a fin con los ojos de quien lo usa por
primera vez**, comprobando en cada parada que el número que sale es el que
debería salir.

La vara de ese recorrido no es una opinión: es el **estudio HSyVbG 2025**, que ya
se hizo, con su marco, sus criterios, sus cuotas y sus aulas seleccionadas. Si
partiendo de las mismas bases el módulo no reproduce ese diseño —o produce uno
distinto y no sabe explicar por qué—, entonces no sirve para el 2026.

Este loop simula esa reconstrucción **desde cero**: sólo las bases, ninguna
decisión heredada, y validando cada eslabón antes de pasar al siguiente. No es
una auditoría de código: es una reconstrucción con testigo.

## La vara

Ocho paradas, en el orden en que ocurren. Cada una se cierra antes de abrir la
siguiente, y cada una se mide contra 2025.

| | Parada | Cómo se mide |
|---|---|---|
| **V1** | **Elegibles tras criterios de alumno** | El conteo reproduce el de 2025, o la diferencia tiene una causa nombrada y defendible |
| **V2** | **Cursos-horario elegibles tras criterios de CH** | Igual que V1, sobre la unidad de muestreo |
| **V3** | **Los criterios se entienden solos** | Alguien que no los escribió sabe qué recorta cada uno **antes** de aplicarlo, y lo confirma viendo el efecto |
| **V4** | **La UI deja ver lo que cada criterio hace** | Para cada criterio: cuántos llegan, cuántos deja fuera, sobre qué distribución corta — sin cambiar de pantalla |
| **V5** | **Tamaño de muestra** | n reproduce el de 2025 con los mismos parámetros, y cada parámetro (z, p, e, deff, m̄) es rastreable a una decisión |
| **V6** | **Alumnos por curso-horario, por facultad** | El estadístico por facultad reproduce el de 2025 y la elección (P25 / mediana / media) está justificada |
| **V7** | **Aulas por facultad** | El reparto reproduce el de 2025, y donde difiera se explica por el criterio que lo movió |
| **V8** | **Selección por cubo: titulares y reemplazos** | La muestra sorteada **se comporta como** la de 2025 —perfil por facultad, tamaño de aula, tipo de curso— y las cadenas de reemplazo son operables en campo |

**V8 no exige aulas idénticas.** Un sorteo probabilístico con otra semilla da
otras aulas y eso es correcto. Lo que tiene que reproducirse es el
**comportamiento**: si la muestra de 2026 se parece a la de 2025 en composición
y cobertura, el mecanismo sirve; si sistemáticamente sobrerrepresenta algo que
2025 no sobrerrepresentaba, hay un defecto.

## La cola

| # | Qué | Vara | Estado |
|---|---|---|---|
| L1 | Reunir el material de 2025: marco, criterios aplicados, cuotas, aulas seleccionadas | — | ☐ **sin empezar** · es el patrón de comparación; sin esto el loop no puede medir nada |
| L2 | Arrancar un proyecto **vacío** y cargar sólo las bases | V1 | ☐ |
| L3 | Aplicar criterios de alumno uno a uno, midiendo el recorte de cada uno | V1, V3 | ☐ |
| L4 | Contrastar elegibles contra 2025 y explicar toda diferencia | V1 | ☐ |
| L5 | Aplicar criterios de curso-horario, mismo método | V2, V3 | ☐ |
| L6 | Contrastar CH elegibles contra 2025 | V2 | ☐ |
| L7 | Auditar que cada criterio muestra su efecto en la UI | V4 | ☐ |
| L8 | Calcular el tamaño y contrastar n contra 2025 | V5 | ☐ |
| L9 | Decidir alumnos por CH por facultad y contrastar | V6 | ☐ |
| L10 | Obtener aulas por facultad y contrastar el reparto | V7 | ☐ |
| L11 | Sortear con el cubo y comparar el perfil con la muestra de 2025 | V8 | ☐ |
| L12 | Verificar que titulares y reemplazos sirven en campo | V8 | ☐ |

## Reglas de este loop

**Una parada por vez, y no se avanza con una diferencia sin explicar.** Un
número que no cuadra y se deja para después contamina todas las paradas
siguientes: si los elegibles difieren en 300, el tamaño, las cuotas y las aulas
heredan ese desvío y ya no se puede saber cuál de los cuatro falla.

**Diferencia explicada ≠ diferencia corregida.** Si 2026 excluye 40 alumnos que
2025 incluía porque el criterio de edad cambió a propósito, eso es una
diferencia **cerrada**. Lo que no vale es «serán redondeos».

**Se anota lo aprendido de cada parada, incluso cuando cuadra a la primera.** De
dónde sale cada cifra y qué la mueve es justo lo que la próxima reconstrucción
no tendrá que reinvestigar.

**El recorrido es el de un usuario, no el de la API.** Lo aprendido en el GOAL
hermano: `POST /calcular` devuelve `409 facultades_incompletas` porque el
handoff Marco → Cálculo vive en el frontend. Una validación sólo por HTTP se
salta pasos que el usuario sí recorre — y son justo los que fallan.

## Trampas heredadas (ya pagadas, no volver a pagarlas)

Vienen de `goal-calc-muestra-marco-defendible-2026-08-15.md`, que conviene leer
antes de empezar:

1. **Llamar al motor no es reproducir el flujo.** Se midió A1 por llamada
   directa y se dio por reparado cuando por la app seguía roto.
2. **Con la suite de criterios activa, los filtros legacy de alumno NO filtran**
   (`calc_muestra_aulas.R:1124`). Afecta directamente a V1.
3. **El fixture `hsvg2026` estuvo envenenado**: el anonimizador cambió los
   valores de facultad y no los criterios guardados. Reparado, pero explica por
   qué cualquier cifra vieja de ese proyecto es sospechosa.
4. **Las facultades del fixture son nombres de persona.** Se puede validar «por
   facultad» a nivel de conteo, no de nombre.
5. **El orden importa:** firmar la decisión de Alumnos por CH obliga a
   reconstruir el marco. Hacerlo al revés cuesta dos reconstrucciones de 4 min.
6. **`testthat::test_dir` con filtro da falsos rojos**; usar `test_file`, locale
   `en_US.UTF-8`.

## Lo que espera a Gonzalo

| # | Decisión | Por qué no puedo yo |
|---|---|---|
| L1 | Dónde vive el material de 2025 y qué cuenta como «lo que se hizo»: ¿el `.pulso` del estudio, los entregables finales, la selección de aulas que se aplicó en campo? | Sin patrón no hay vara. Y las tres fuentes pueden discrepar entre sí —la selección aplicada en campo puede diferir de la sorteada si hubo reemplazos—, así que elegir cuál manda es una decisión metodológica |

## Cómo se corre cada visita

Reusar la pila propia antes de levantar nada; el **8787 es de Gonzalo y no se
toca**. Sondear el front por `localhost`, no por `127.0.0.1`. Toda espera de
servidor con bucle y tope de tiempo.

```bash
make dev-status
```
