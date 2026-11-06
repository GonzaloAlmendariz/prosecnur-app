# Propuesta: pantalla de inicio y carga de Prosecnur — 2026-11-06

Artefacto: https://claude.ai/artifact/3cVPEhL8NGz3Nem4vSM5jg (versión 8). Propuesta visual; no se tocó código
de la app.

## Decisión de Gonzalo

**Recorrido.** El Mosaico vivo queda descartado («Al final nos quedamos con Recorrido, no Mosaico»). La carga de los
módulos «no tiene por qué ser tan compleja»: los módulos cargan rápido y basta con una animación sencilla en bucle.
A veces la carga es de una vista (Monitoreo › Control: «Leyendo el estado de Mailchimp…»). Y al final: «por su
sencillez, la carga de módulos sea sólo el ícono de logo de la app haciendo la misma apertura que ahora, en todos los
módulos y sus vistas, y dejamos la animación elegante sólo para la pantalla de inicio y carga».

## Dos niveles

| Carga | Duración típica | Qué se ve |
|---|---|---|
| Inicio y carga del proyecto (`BootGate`) | decenas de segundos a minutos | Lámina de `PantallaDeCarga` al centro. A la izquierda, un panel de la app con la escena del módulo en bucle; a la derecha, su identidad (ícono, «Módulo n de 7», nombre, qué hace, acción); abajo, barra segmentada de siete módulos que se llena con el tiempo. |
| Módulos y vistas (`ModuleWarmupBoundary`, `LoadingBlock` «panel») | segundos | El isotipo de la app latiendo en el tono del módulo, el rótulo de lo que se prepara y una barra indeterminada, dentro del espacio de trabajo. Es lo que ya hace `LoadingBlock`; sólo la apertura de módulo deja de usar la lámina del proyecto (fases y reloj). |

## Recorrido del proyecto

- Orden: Cálculo de muestra → Formularios → Hojas de ruta → Material de campo → Monitoreo → Procesamiento →
  Dashboard.
- Tiempo: cada tramo dura la apertura anterior entre siete (3 a 9 s), así que el recorrido termina cuando la carga
  debería terminar. Si se alarga, vuelve a empezar y cada módulo muestra otra de sus cinco escenas. Sin apertura
  anterior, 4 s por tramo.
- Geometría: panel de 336 × 286 px con rótulo de la vista y título; la escena a su tamaño natural (320 × 200). Sin
  velo encima de los laterales. Al cambiar de módulo, el anterior se apaga antes de que entre el siguiente.
- Variante quieta: cambia de módulo sin deslizarse y cada escena se muestra en su cuadro final.

## Escenas (35, cinco por módulo)

Salen de un estudio de cada módulo sobre su código y unas 70 capturas reales de QA. Las fichas por módulo están en
la carpeta de notas compartidas de la sesión (`ficha-ui-<slug>.md`). La primera de cada módulo es la marca.

| Módulo | Escenas (vista de la que sale) |
|---|---|
| Cálculo de muestra | Del marco a los titulares (Marco › Selección) · La cadena del n (Cálculo) · Universo, elegibles y muestra (Datos) · Cadenas de reemplazo (Selección › Reemplazos) · Perfil por facultad (Selección › Perfil) |
| Formularios | El formulario se arma (Constructor) · La hoja que lee Kobo (Editor XLSForm) · Así lo verá quien responde (Probar) · Qué pregunta abre a cuál (Mapa de lógica) · Avisos que se resuelven (Resumen) |
| Hojas de ruta | El sorteo cae sobre las manzanas (Manzanas) · Distritos del estudio (Territorio) · Pirámide (Población) · Reparto del N (Muestra) · Recorrido de la UMP (Selección › Titulares) |
| Material de campo | Una unidad, una ficha con su acceso (Paquetes) · Receta de ocho bloques (Catálogo › Editor) · Tipos de material (Catálogo › Tipos) · Paquetes listos · Campañas |
| Monitoreo | La meta se cruza (Avance › Resumen) · Del Kobo a la meta · Cuotas contra su meta (Por cuota) · Embudo del correo (Correo) · Dónde falta (Mapa territorial) |
| Procesamiento | De lo crudo a la tabla (Codificación › Codificar) · La lámina sale lista (Gráficos › Láminas) · 94 reglas (Validación) · Frecuencias en escala (Analítica) · Formulario y respuestas cruzados (Carga) |
| Dashboard | El tablero se publica · Pregunta por fila (Resumen) · Perfil de la muestra · FODA (Dimensiones) · Construcción del indicador |

Repertorio común de movimientos (sólo `transform` y `opacity`, tokens `--motion-*`): caer, subir, encender, trazar,
crecer, viajar, girar, barrer y atenuar. Cada escena dura un ciclo de diez veces `--motion-dur-slow` (4,2 s).
Cifras ilustrativas; vocabulario real de la UI.

## Implementación (cuando se decida)

- `frontend/src/components/escenas/<modulo>.tsx`: una escena por vista (SVG 320×200, `currentColor`, piezas con
  `--k`), y `escenas/movimientos.css` con el repertorio. Pintable desde el chunk de arranque (sólo tokens de `boot.css`).
- `FondoRecorrido.tsx` (proyecto): recibe `transcurridoMs` y `estimacion`; reemplaza a `VistaSkeleton` en `BootGate`.
- `ModuleWarmupBoundary`: deja de montar `PantallaDeCarga` y usa el mismo bloque de `LoadingBlock` «panel» (isotipo
  en el tono del módulo, rótulo, barra) en el área del módulo. `LoadingBlock` no cambia.
- Costo estimado: 3 días (35 escenas, recorrido y el cambio de `ModuleWarmupBoundary`).
- Riesgos: mantener las escenas al día con la UI real; peso de las 35 escenas en el chunk de arranque (cargar sólo
  las marcas en el arranque y el resto bajo demanda).

## Pendiente

- Pulido del recorrido y de cada escena a 332 px (loop de 3 minutos en curso).
- Decisión final de Gonzalo sobre el detalle.
