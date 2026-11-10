# Propuesta: pantalla de inicio y carga de Prosecnur — 2026-11-06

Tipo: Propuesta de diseño
Estado: En curso
Fecha: 2026-11-06
Autoridad: decisión de Gonzalo por el Recorrido sobre la propuesta visual del artefacto

Artefacto: https://claude.ai/artifact/3cVPEhL8NGz3Nem4vSM5jg (versión 16). Propuesta visual; no se tocó código
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
| Inicio y carga del proyecto (`BootGate`) | decenas de segundos a minutos | Lámina de `PantallaDeCarga` angosta (372 px) a la izquierda, con la barra segmentada de los siete módulos debajo. El resto de la ventana es del módulo: «Módulo n de 7», su nombre a 50 px y qué hace; debajo, su escena a 2× sobre una superficie de la app que se sale por el borde derecho e inferior. |
| Módulos y vistas (`ModuleWarmupBoundary`, `LoadingBlock` «panel») | segundos | El isotipo de la app latiendo en el tono del módulo, el rótulo de lo que se prepara y una barra indeterminada, dentro del espacio de trabajo. Es lo que ya hace `LoadingBlock`; sólo la apertura de módulo deja de usar la lámina del proyecto (fases y reloj). |

## Recorrido del proyecto

- Orden: Cálculo de muestra → Formularios → Hojas de ruta → Material de campo → Monitoreo → Procesamiento →
  Dashboard.
- Tiempo: cada tramo dura la apertura anterior entre siete (3 a 9 s), así que el recorrido termina cuando la carga
  debería terminar; si se alarga, vuelve a empezar. Sin apertura anterior, 4 s por tramo.
- Escena: los módulos van siempre en orden; la escena de cada módulo se elige al azar entre sus cinco, sin repetir la
  última que mostró ese módulo.
- Geometría (v9, tras «la animación está atrapada en un bloque»): la escena se dibuja a 640 × 400 sobre una superficie
  de 880 × 600 que nace a 500 px del borde izquierdo y se sale por la derecha y por abajo, como una ventana de la app
  vista de cerca. Sin inclinar: las escenas son detalladas y se leen mejor rectas.
- Transición: la superficie del módulo que sale sube 14 px y se funde; la que entra sube 46 px desde abajo. El nombre
  cambia con un fundido corto y el ambiente de fondo toma el tono del módulo.
- Variante quieta: cambia de módulo sin deslizarse y cada escena se muestra en su cuadro final.

## Contrato de armonía (v10)

Tras «no hay elevaciones muy armónicas, ni una estructura o disposición de los elementos muy bien ordenada», la
composición sigue reglas medibles, recuperadas de los tokens de la app (`tokens.css`: escala `--pulso-space-*` sobre 4 px,
radios `--pulso-radius*`, sombras `--pulso-shadow-*`). Se verificaron midiendo el DOM del artefacto.

| Regla | Valor |
|---|---|
| Grilla | 12 columnas de 74 px, canal 24, margen 64 sobre 1280 × 800. Lámina en 1–4 (368 px), columna 5 libre, módulo desde la 6 (x 554). |
| Un solo borde | Rótulo «Módulo n de 7», nombre, descripción y superficie comparten x 554. |
| Rieles | 112 (arriba de la lámina y del rótulo) · 288 (superficie) · 736 (margen inferior). |
| Espacios | Sólo de la escala: 16 dentro de un grupo, 24 entre bloques cercanos, 40 entre secciones (lámina → barra de módulos, descripción → superficie). |
| Elevación | 0 fondo plano con ambiente · 1 superficie del módulo `--pulso-shadow-med` · 2 lámina de estado `--pulso-shadow-high`. Antes la superficie tenía una sombra propia mayor que la de la lámina e invertía la jerarquía. |
| Radios | 20 (`--pulso-radius-lens`) en las dos superficies grandes; 10 (`--pulso-radius`) en los chips. |
| Tipo | 12 rótulos en versalitas · 15 cuerpo · 18 entrada · 24 título de fase · 48 nombre; interlineados múltiplos de 8. |

## Escenas (35, cinco por módulo)

Salen de un estudio de cada módulo sobre su código y unas 70 capturas reales de QA. Las fichas por módulo están en
la carpeta de notas compartidas de la sesión (`ficha-ui-<slug>.md`). La primera de cada módulo es la marca.

| Módulo | Escenas (vista de la que sale) |
|---|---|
| Cálculo de muestra | Marco y sorteo de titulares (Marco › Selección) · Tamaño de muestra y cursos-horario (Cálculo) · Universo, elegibles y muestra (Datos) · Cadenas de reemplazo (Selección › Reemplazos) · Perfil por facultad: muestra y marco (Selección › Perfil) |
| Formularios | Secciones y preguntas (Constructor) · Hoja survey del XLSForm (Editor XLSForm) · Vista del encuestado (Probar) · Condiciones de apertura (Mapa de lógica) · Avisos de consistencia (Resumen) |
| Hojas de ruta | Manzanas sorteadas por distrito (Manzanas) · Distritos del estudio (Territorio) · Población por sexo y edad (Población) · Puntos GPS por manzana (Manzanas) · Recorrido de la UMP (Selección › Titulares) |
| Material de campo | Fichas con QR por unidad (Paquetes) · Ficha de aula: ocho bloques (Catálogo › Editor) · Fichas, croquis y hojas de ruteo (Catálogo › Tipos) · Paquetes de la campaña · Materiales por campaña |
| Monitoreo | Avance contra la meta (Avance › Resumen) · Plataforma frente a lo reportado en campo (Control) · Avance por cuota · Envíos, aperturas y respuestas (Correo) · Pendientes por distrito (Mapa territorial) |
| Procesamiento | Respuestas abiertas y sus códigos (Codificación) · Láminas del informe (Gráficos) · Reglas del formulario: 94 (Validación) · Frecuencias en escala de acuerdo (Analítica) · Variables del formulario y la base (Carga) |
| Dashboard | Edición y publicación del tablero · Cruce con selector de variables (Relaciones) · Cruce de cruces · Resumen por pregunta · Perfil de la muestra |

Nombres directos, sin paráfrasis ni clichés (regla en `CLAUDE.md` › «Redacción»; checklist
`docs/qa/checklist-escenas-carga-2026-11-06.md`).

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
