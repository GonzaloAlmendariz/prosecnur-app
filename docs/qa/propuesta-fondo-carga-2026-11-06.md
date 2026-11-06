# Propuesta: fondo de la pantalla de carga (warm start) — 2026-11-06

Artefacto para elegir: https://claude.ai/artifact/3cVPEhL8NGz3Nem4vSM5jg
(versión 3: Mosaico vivo y Recorrido, 35 escenas, proyecto y módulo en foco). Propuesta visual; no se tocó
código de la app. La decisión es de Gonzalo.

## Indicaciones de Gonzalo (6 nov 2026)

1. «No es que no me guste el fondo pero lo siento muy sencillo y plano […] uno más creativo con más énfasis en
   los distintos módulos en un artefacto».
2. Todos los fondos animados, construyéndose según el tiempo de la carga anterior.
3. Una dirección con el módulo a la derecha y su acción animada a la izquierda, en bucle (Recorrido).
4. Quedarse sólo con Mosaico vivo y Recorrido; entender en profundidad lo que hace cada módulo y sus geometrías
   reales; animaciones marca por módulo desde un repertorio común.
5. Abrir un módulo no debe parecerse a abrir el proyecto (hoy se lee como otra pantalla de inicio).
6. Unas cinco animaciones por módulo; el mosaico no debe repetir la misma escena de un módulo; al abrir un módulo,
   el foco son sus animaciones, no la tarjeta «Abriendo».
7. Recorrido más elegante y profesional, manteniendo la distribución.
8. No perder piezas como el mapa de lógica en canvas, el generador de láminas o los bloques de codificación.

## De dónde salen las escenas

Tres investigaciones en paralelo leyeron el código de cada módulo y unas 70 capturas reales de QA
(`tmp/visual-qa/quick/*`, `tmp/qa-*` y capturas de otras sesiones). Las fichas por módulo (qué hace, recorrido de
secciones, geometrías dominantes, acción característica, errores a evitar) quedaron en la carpeta de notas
compartidas de la sesión (`ficha-ui-<slug>.md`). Resumen de lo que cada módulo hace y de sus cinco escenas:

| Módulo | Qué hace | Escenas (la primera es la marca) |
|---|---|---|
| Cálculo de muestra | Declara el marco, calcula n (Cochran + deff + FPC) y sortea con semilla | Del marco a los titulares (Marco › Selección) · La cadena del n (Cálculo) · Universo, elegibles y muestra (Datos) · Cadenas de reemplazo (Selección) · Perfil por facultad (Selección) |
| Formularios | Construye y corrige el XLSForm | Outline que se arma (Constructor) · Hoja survey (Editor XLSForm) · Probar como encuestado · Mapa de lógica con secciones, puertos y conector en corchete · Avisos que se resuelven (Resumen) |
| Hojas de ruta | Diseña la muestra territorial y sortea manzanas (PPS) | Sorteo sobre los distritos (Manzanas) · Elegir el territorio · Pirámide de población · Reparto del N · Recorrido de la UMP |
| Material de campo | Una unidad, una ficha con su acceso (ADR 0108) | Fichas con QR que van al paquete · Receta de ocho bloques (Editor) · Catálogo de tipos · Paquetes · Campañas |
| Monitoreo | Cruza lo que llega del campo contra la meta | La meta se cruza (Avance) · Del Kobo a la meta · Cuotas contra su tic · Embudo del correo · Mapa de pendientes (territorial) |
| Procesamiento | Limpia, codifica, tabula y arma el informe | De lo crudo a la tabla (Codificar) · La lámina sale lista (Gráficos › Láminas) · 94 reglas (Validación) · Frecuencias en escala · Formulario y respuestas cruzados (Carga) |
| Dashboard | Publica el tablero interactivo del cliente | El tablero se publica · Pregunta por fila · Perfil de la muestra · FODA · Construcción del indicador |

Todas usan vocabulario real de la UI y cifras ilustrativas (nunca las de un cliente).

## Repertorio de movimientos de marca

Nueve movimientos, sólo `transform` y `opacity`, con los tokens `--motion-*`: caer, subir, encender (pop con leve
rebote), trazar (horizontal y vertical), crecer, viajar (una pieza a su lugar: una respuesta a su código, una ficha
a su paquete), girar (anillos y donas), barrer (revisión de reglas) y atenuar (descartes del marco, cifras que se
reemplazan). Cada escena dura un ciclo de diez veces `--motion-dur-slow` (4,2 s): se arma, se sostiene y se funde.
Cada pieza declara su instante `--k` dentro del ciclo; la escena se vuelve a montar al empezar el siguiente.

## Construcción por tiempo

El fondo sigue un avance `pc` que sale del transcurrido y de la apertura anterior (`estimacion.totalMs`):
`min(t/totalMs, 0.92)` con apertura anterior, `0.88·(1 − e^(−t/12 s))` sin ella, y cierre en 900 ms al terminar.
Cada panel o tesela declara su umbral; al cruzarlo aparece y empieza a jugar su escena. En Recorrido, cada tramo
dura la apertura anterior entre el número de pasos (3 a 9 s) y vuelve a empezar si la carga se alarga.

## Abrir el proyecto y abrir un módulo ya no se parecen

- **Proyecto**: ventana completa, la lámina de `PantallaDeCarga` al centro.
  - Recorrido: panel de la app a la izquierda con la escena, identidad del módulo a la derecha, barra segmentada
    de siete módulos que se llena con el tiempo.
  - Mosaico: 13 teselas en 6 × 4, dos por módulo (una para Material) y nunca la misma escena dos veces.
- **Módulo**: sin lámina. Se ve el chrome real (dock con el módulo activo, barra del módulo con sus secciones).
  Las secciones se encienden a medida que cargan y una pastilla discreta en la barra dice qué se prepara y cuánto
  falta.
  - Mosaico: sus cinco vistas, la principal en grande.
  - Recorrido: riel de pasos a la izquierda y la vista en grande.

## Implementación (cuando se decida)

- `frontend/src/components/fondo/escenas/<modulo>.tsx`: una escena por vista (SVG 320×200, `currentColor`, piezas
  con `--k`). `fondo/movimientos.css` con el repertorio. Todo pintable desde el chunk de arranque (sólo tokens que
  `boot.css` replica).
- `FondoMosaico.tsx` y `FondoRecorrido.tsx` reciben `transcurridoMs`, `estimacion` y, al abrir un módulo, el slug.
- Abrir un módulo: `ModuleWarmupBoundary` deja de montar la lámina; monta el chrome del módulo con la pastilla
  y el fondo en el área. Requisito nuevo: guardar la duración de cada apertura de módulo (hoy recibe
  `SIN_ESTIMACION`).
- Costo estimado: 4 a 5 días (35 escenas, dos composiciones, pastilla de módulo y registro de duraciones).
- Riesgos: mantener 35 escenas al día con la UI real; rendimiento con 13 teselas animadas (se mitiga con pausas
  desfasadas: nunca juegan todas a la vez); legibilidad de textos a tamaño tesela.

## Recomendación

Recorrido al abrir el proyecto (la lámina cuenta el tiempo y el recorrido cuenta qué hace cada módulo) y Mosaico
al abrir un módulo (su espacio de trabajo se arma con sus cinco vistas, sin parecer otra pantalla de inicio).

## Pendiente

- Pulido escena por escena frente a su captura real (en curso, loop de 3 minutos).
- Decisión de Gonzalo.
