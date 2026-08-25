# ADR 0080 — Un estudio a medio declarar calcula igual, y esa es la falla

- **Estado**: aceptada
- **Fecha**: 2026-08-25
- **Contexto**: recorrido completo de Cálculo de muestra → Monitoreo sobre las
  bases reales de HSVG PUCP 2026, hecho íntegramente desde la aplicación.

## El hecho que lo motiva

La app pidió **403 cursos-horario titulares** para un diseño cuyo documento
metodológico pide **190**. El cálculo no estaba mal: era el resultado correcto
de un estudio declarado a medias. Nada en el recorrido avisó de que faltaran
piezas —ni al construir el marco, ni al calcular, ni al sortear, ni al pasar el
plan a Monitoreo—. Las 403 atravesaron el módulo entero sin que ninguna
superficie chirriara.

Al declarar el estudio completo, la misma app da **184** con la misma base, la
misma fórmula y el mismo estadístico.

## Las cinco piezas que faltaban, medidas

| Pieza | Cómo estaba | Consecuencia medida |
|---|---|---|
| Criterio de alumno «18 años o más» | sin declarar | 1.537 menores y 8.595 matrículas dentro (7,3 %) |
| Criterios de curso (modalidad, sesión, docente, condición) | **imposibles de declarar**: ninguna ruta montaba `CriteriosMarcoTab` con `scope="aula"` | los cuatro criterios que retiran 277 + 465 + 103 aulas nunca se aplicaban |
| Mínimo de elegibles por facultad | un único umbral global | P25 de Artes Escénicas en **1**; 117 de las 403 aulas se las llevaba esa facultad |
| Multiplicador de efectividad por facultad | `cfg$efectividad` **NULL en los seis `.pulso` del repo** | `factor_facultad` = 1 en las 5.269 filas; las quince facultades con la misma tasa |
| Mapeo de variables | «6 de 6 requeridas confirmadas», en verde | Edad y Tipo de docente figuran **OPCIONAL** y quedaban sin usar |

Ninguna de las cinco produce un error. Las cinco producen un número.

## Decisión

**1 · Una capacidad sin punto de montaje es una capacidad que no existe.**
`CriteriosMarcoTab` soportaba `scope="aula"` desde que se escribió —con su
`showAula` y su filtro por `v.scope === "aula"`— y ninguna ruta lo montaba. No
hay test que detecte eso: el componente existe, sus tests pasan, el motor sabe
leer lo que produciría. Sólo se ve abriendo la app e intentando declarar el
criterio. Al añadir superficies, el punto de montaje es parte del entregable.

**2 · El verde de una lista se refiere a esa lista, no al estudio.**
«6 de 6 requeridas confirmadas» era cierto y engañoso a la vez: el conjunto
*requerido* estaba completo, el conjunto *del estudio* no. Un indicador de
completitud declara sobre qué conjunto habla, o no declara nada.

**3 · Ningún criterio del estudio es global.** El mínimo de elegibles, los
rangos de nivel, el filtro de taller y el multiplicador de efectividad se
declaran **por facultad**. El valor general es un defecto sobre el que las
facultades escriben, no una regla que las sustituya. Un umbral único no
significa lo mismo en una facultad de aulas de 40 que en una de aulas de 14.

**4 · El multiplicador de efectividad se sella desde el histórico y se aplica
sólo con base suficiente.** τ = `E × R(tamaño) × F(facultad)`. La F es
observado ÷ esperado sobre las aulas aplicadas del estudio anterior, con el
**esperado ponderado por elegibles** (decisión de Gonzalo, 2026-08-25: las aulas
grandes pesan lo que aportan, no una por una). Se publica desde **12 aulas
aplicadas**; por debajo, el multiplicador es **1** y la facultad conserva su
composición. Vive en `calc_muestra_aulas_efectividad_sello.R` y se sella en el
router **antes** de construir el marco, porque `calc_muestra_aulas_construir()`
no recibe la referencia y anotar después llega tarde.

**5 · Un proyecto nuevo no hereda el marco de otro.** Un `.pulso` recién creado
no arrastra criterios, mínimos ni sellos de un estudio anterior. El preset
«Partir de los criterios de un estudio anterior» es explícitamente un punto de
partida —la propia app lo dice: «no es una regla de este»— y **no coincide con
el diseño vigente**: medido, arrastra un criterio de condición del curso que
HSVG 2026 no tiene y omite el rango de niveles.

**6 · Un camino descartado que sigue escrito se lee como el camino vigente.**
`.cm_tau_para_dimensionar()` se retiró el 2026-08-21 y su hermana
`.cm_tau_por_facultad()` quedó sin consumidor. Leyéndolas hoy, cualquiera —lo
hice yo— concluye que hay que reconectarlas, que es exactamente la decisión que
el equipo había rechazado. Cuando se retira un camino, se retira su código o se
escribe en el sitio por qué no se reconecta.

**7 · Lo que se persiste es la clave normalizada, así que el normalizador es
un contrato.** Los criterios del estudio no guardan «ARTE Y DISEÑO», guardan
`arte_y_dise_no`. Al reparar `.cm_aulas_text_key()` para que la eñe dejara de
partirse, esa misma facultad pasó a normalizar como `arte_y_diseno` y el
criterio de facultad —un `include`— dejó de reconocer sus propias categorías
guardadas: 248 aulas con `eligible_n = 0`, 5.327 alumnos excluidos, la facultad
fuera del perfil y la tabla del cálculo con 14 filas presentándose como el
estudio completo. Reparar un normalizador cuyo resultado se persiste es un
cambio de contrato, no una corrección interna, y exige leer también la forma
anterior. La compatibilidad va del lado de la **lectura**
(`calc_muestra_aulas_claves_legadas.R`): migrar el archivo al abrirlo arregla
ese `.pulso` y deja rotos los que no se abran, además de mutar el archivo del
cliente sin que nadie lo pida.

## Consecuencias

- El recorrido desde cero es reproducible y está escrito paso a paso en
  `docs/qa/checklist-motor-aulas-2026-08-24.md`.
- El preset carga siete variables en un borrador **por pestaña**: el de
  Criterios del estudiante no llega al de Radiografía. Hay que pulsarlo en las
  dos.
- Queda pendiente lo que este ADR no resuelve: **nada avisa de que un estudio
  está a medio declarar**. Las cinco piezas se detectaron abriendo la app, no
  por una señal suya. Un indicador de «diseño declarado / diseño pendiente» en
  la mesa de muestra es el trabajo natural que sigue.

## Referencias

- `docs/qa/criterios-dimensionamiento-aulas-2026-08-21.md` — veredicto
  `E × R(tamaño) × F(facultad)`.
- `api/R/calc_muestra_aulas_efectividad_sello.R` — el sello y su aritmética.
- `api/R/calc_muestra_aulas_tau_facultad.R` — por qué no se reconecta el
  selector de tasas.
- `api/R/calc_muestra_aulas_claves_legadas.R` — la lectura tolerante de claves
  persistidas y por qué no se migra el archivo.
- ADR 0043 y 0044 — proyectos de referencia y gramática de navegación.
