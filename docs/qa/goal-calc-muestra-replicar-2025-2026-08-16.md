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
| L1 | Reunir el material de 2025 | — | ◐ **parcial** (2026-08-16) · bases e histórico de asistencia localizados; **falta la selección de aulas de 2025** |
| L2 | Arrancar un proyecto **vacío** y cargar sólo las bases | V1 | ☐ |
| L3 | Aplicar criterios de alumno uno a uno, midiendo el recorte de cada uno | V1, V3 | ◐ **medido** (2026-08-16) · tabla abajo; falta el contraste con 2025 (L4, bloqueado) |
| L4 | Contrastar elegibles contra 2025 y explicar toda diferencia | V1 | ☐ |
| L5 | Aplicar criterios de curso-horario, mismo método | V2, V3 | ☐ |
| L6 | Contrastar CH elegibles contra 2025 | V2 | ☐ |
| L7 | Auditar que cada criterio muestra su efecto en la UI | V4 | ☐ |
| L8 | Calcular el tamaño y contrastar n contra 2025 | V5 | ☐ |
| L9 | Decidir alumnos por CH por facultad y contrastar | V6 | ☐ |
| L10 | Obtener aulas por facultad y contrastar el reparto | V7 | ☐ |
| L11 | Sortear con el cubo y comparar el perfil con la muestra de 2025 | V8 | ☐ |
| L12 | Verificar que titulares y reemplazos sirven en campo | V8 | ☐ |

## L1 · el material de 2025 (2026-08-16)

Gonzalo señaló `~/Documents/Pulso/HSTVG2026/HSVG2026.pulso` (19 MB, proyecto de
cliente **sin anonimizar** — se lee, no se copia al repo ni se commitea).

| Qué trae | |
|---|---|
| Bases | ✅ `BD estudiantes y curso-horario 2025-2.xlsx` + `Instrumento2026.xlsx` |
| Marco construido | ✅ 5.263 cursos-horario |
| **Histórico de asistencia** | ✅ `HSVBG2025_referencia_para_motor.xlsx` |
| Simulación de reemplazos | ✅ |
| **Aulas seleccionadas en 2025** | ❌ `calc_muestra_aulas_selection` vacía |
| Comparación de métodos | ❌ ausente |

El histórico, que es lo que hace medible V8:

```
agendados 1.012 · aplicados 194 · observados 194
tasa de asistencia 0,791 (k = 194)
glosario_completo = FALSE
```

**Qué desbloquea y qué no.** Con esto V1–V7 pueden medirse contra el marco y las
cuotas que este proyecto ya tiene. **V8 no**, o no del todo: el histórico dice
cómo *rindió* el campo 2025 —asistencia, cobertura— pero no **qué aulas se
sortearon**, que es contra lo que había que comparar el perfil de la muestra
nueva.

Ojo con el `glosario_completo = FALSE`: la referencia se leyó en modo degradado,
así que su tasa de asistencia es **bruta sobre matriculados**, no sobre
elegibles. Es la trampa del ADR 0060 y afecta a cómo se lee ese 0,791 —conviene
releer el intervalo antes de usarlo como vara.

## V1 · recorte de cada criterio de alumno (medido 2026-08-16)

Sobre el fixture reparado, 136.284 filas de la hoja `MATRICULADO`:

| Criterio | Pasan | Recorta | % | Capa |
|---|---:|---:|---:|---|
| `faculty` | 128.018 | 8.266 | 6,1 % | marco |
| `condition` | 124.167 | 12.117 | 8,9 % | marco |
| `formation` | 125.003 | 11.281 | 8,3 % | marco |
| `age` | 123.360 | 12.924 | 9,5 % | marco |
| `level` | 136.284 | **0** | **0,0 %** | marco |
| **Todos (capa marco)** | **106.013** | **30.271** | **22,2 %** | |

Las 30.271 cuadran con las exclusiones que publica el marco construido, así que
la medición es consistente con el motor.

**La suma de los recortes individuales (44.588) supera al conjunto (30.271)**
porque muchas filas caen por más de un criterio a la vez — se ve en las razones
combinadas que publica el marco (`age|condition`, `condition|formation`…). Eso
significa que **el recorte de un criterio no se puede leer aislado**: quitarlo no
devuelve sus 12.000 filas, devuelve sólo las que no caían también por otro.

### Hallazgo: `level` está activo y no recorta nada

Es un criterio de capa marco, declarado, con `kind = ordinal` y **`fromValue =
NA`**. Deja pasar las 136.284 filas.

Tres lecturas posibles, y hay que decidir cuál antes de tocar nada:

1. **Correcto y deliberado**: en 2025 no se filtró por ciclo, y el criterio está
   presente sólo para dejar constancia de que se consideró.
2. **Configurado a medias**: alguien lo activó y no fijó el umbral, así que
   parece que filtra y no filtra.
3. **Perdido en la anonimización**, como pasó con `faculty`.

Para V3 —«los criterios se entienden solos»— este caso es el más exigente: un
criterio que aparece activo y no recorta es exactamente lo que hace desconfiar
del resto. **La UI debería decir «este criterio no está recortando» sin que haya
que calcularlo.**

## Trampa medida: la columna se toma del mapping, no del nombre

Primera medición de esta tabla dio `level` recortando el **100 %**. El error era
mío: elegí la columna a ojo (`Ciclo (2025-I)`) cuando el mapping del proyecto
apunta a `Nivel curricular`. Dos columnas plausibles, y la equivocada convierte
un criterio inocuo en uno que vacía la base.

Vale para todo este loop: **las columnas se resuelven por
`frame$config$mapping`, nunca por el nombre que parece.**

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
| L1-bis | **Dónde está la selección de aulas de 2025**: el `.pulso` señalado trae bases, marco e histórico de asistencia, pero su `calc_muestra_aulas_selection` está vacía. ¿Existe en otro archivo —el entregable de campo, una hoja de ruta, el Excel que se mandó a la universidad—? | Sin ella, V8 sólo puede medirse por el rendimiento agregado (0,791 de asistencia), no por el perfil de las aulas sorteadas, que es lo que este loop quería contrastar |

## Cómo se corre cada visita

Reusar la pila propia antes de levantar nada; el **8787 es de Gonzalo y no se
toca**. Sondear el front por `localhost`, no por `127.0.0.1`. Toda espera de
servidor con bucle y tope de tiempo.

```bash
make dev-status
```
