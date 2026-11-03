# Revamp de Material de campo: lo que hay que construir (v5, 2 nov 2026)

Diseño aprobable en el artefacto «Material de campo, revamp»
(https://claude.ai/artifact/M7cbp4RzDHzpmhe5gMRKVs). La base es el inventario
[inventario-material-de-campo-2026-11-02.md](inventario-material-de-campo-2026-11-02.md) y el ADR 0125.

Este documento es para la sesión dueña («Hojas de ruta y Material»). Dice, tablero por tablero:

- qué cambia en código;
- de dónde sale cada dato;
- qué falta en el backend.

Nada de esto está implementado.

## 0. Piezas comunes (primero, porque las usan todos)

| Pieza | Qué es | Dónde | Notas |
|---|---|---|---|
| Barra con recorrido | `ModuleCommandBar` con tres zonas: chip de entrada, `SectionPillbar` con contador y chip de entrega | `campanas/CabeceraDeCampana.tsx`, nuevo `campanas/ChipsDelRecorrido.tsx` | Reemplaza indicadores y estado actuales. El chip de entrada lleva el color del módulo de origen (Hojas `--pulso-module-routes`, Cálculo `--pulso-module-sample`, Monitoreo `--pulso-module-monitoring`) |
| Contador de sección | Ámbar = pendientes de la sección; ✓ = lista; nada si no aplica | `SectionPillbar` (prop `estado: {pendientes?: number, lista?: boolean}`) | Una sola regla, sin fracciones. En la píldora activa el ámbar se conserva; es regla del kit, no de cada vista |
| Inspector | Panel derecho de 360 px (400 a 1440) con cabecera, datos y acción principal al pie | `AdaptiveSplitView` + `usePanelDireccionable` (`?panel=ump&foco=<id>`) | Entra con `translateX(12px)` + opacidad, 280 ms, `--prosecnur-ease-drawer` |
| Movimiento | Press `scale(.97)` 120 ms; menús desde su disparador 160 ms; secciones con fundido de 4 px en 160 ms; confirmaciones con toast 280 ms y salida 160 ms; esqueleto con brillo lineal | Tokens `--prosecnur-dur-*` y `--prosecnur-ease-*` de `branding/tokens` | Hover sólo con `(hover: hover) and (pointer: fine)`. Con `prefers-reduced-motion`: sólo fundido, sin desplazamiento ni escala |
| Foco | Anillo de 2 px en musgo con separación de 2 px en botones, píldoras, pestañas, enlaces, campos y `summary` | CSS del módulo | Hoy varios controles dependen del anillo por defecto |
| Escala | Espacios 4/8/12/16/20/24/32; radios 10/14/16/píldora; letra 11/12/13/15/17/20/24 | CSS del módulo | Sin medios píxeles |

## 1. Registro de campañas (`/material-campo`)

**Construir:**
- Agrupar las campañas por público (acreditación) en filas. Cada fila lleva sus campañas en el orden de la ronda, con flecha entre ellas, y tiene su propio desplazamiento horizontal.
- La supervisión cuelga bajo su telefónica con un codo.
- Tarjeta: tipo y ronda, nombre, una línea de procedencia («Viene de la ronda 1, quien no respondió el correo») y tres tramos (entra, arma, entrega).
- Ronda declarada en el Modelo sin campaña: tarjeta punteada con «Abrir su campaña». Abre `?panel=nueva-campana` con la ronda elegida.
- Quitar todo «Sumar ronda» de Material.
- Indicador del estudio: «Entregadas a Monitoreo n de m».
- Supervisión: menú ⋯ con «Renombrar…», «Ver el lote en Monitoreo» y «Archivar». Hoy `accionesDeCampana.ts:48` devuelve `[]`.
- Conservar «Archivadas (n)».

**Datos:** `relacion` (`publico`, `ronda`, `viene_de`) de la entrada del registro; `canales` del Modelo vía `/api/planner/modos`; `resumenDeTarjeta` para los tramos.

**Falta en backend:** nada. Que la ronda declarada sin campaña aparezca en `tipos_del_estudio` o equivalente.

**Pruebas:**
- vitest de `modeloRegistro` (agrupación por público, orden, `viene_de`);
- `accionesDeCampana` para supervisión;
- `make gate-front AREA=recopiladores`.

## 2. Territorial UMP › Unidades

**Construir:**
- Toolbar con segmentado con «Por revisar», «Sin encuestador» y «Todas» (abre en «Por revisar»), selector de distrito y búsqueda. La franja de seis tarjetas de distrito se va.
- Tabla con columna «Observación», que reemplaza la columna Estado vacía (D15).
- Inspector de la UMP: datos, su reemplazo, miniatura de las dos caras y acciones «Pedir un reemplazo puntual» (va a Paquetes con la UMP preseleccionada), «Abrir la ficha» y «Ver en Hojas de ruta».
- A 1440 se suma la columna Encuestas y el inspector pasa a 400 px. A 1280 se quitan Encuestas y Reemplazo.

**Datos:** observaciones de Hojas (las «por revisar» del envío), asignación (`/asignacion`) y reemplazo emparejado del envío.

**Falta en backend:** nada nuevo.

## 3. Territorial UMP › Paquetes

**Construir:**
- Lista de piezas (ZIP por distrito, Excel operativo, ruteo y consolidados) con formato, estado, fecha y una acción por fila. Arriba, «n de m listas» y una acción principal contextual.
- El ZIP tiene fila desplegable «Ver por distrito», que resuelve D16.
- Columna secundaria «Reemplazos puntuales» con las UMP elegidas desde Unidades.

**Requiere dato:**
- desfase de ruteo y consolidados cuando cambia la asignación después de generar;
- porcentaje del job del ZIP (`jobs.R` tiene archivo de progreso: exponerlo si no llega al front).

Sin esos datos, el chip no se pinta.

## 4. Territorial UMP › Catálogo

**Construir:**
- Escenario con las dos caras de la ficha a tamaño legible y panel derecho con selector de UMP, «Abrir el PDF», «Las 300» y, como bloque secundario al pie, «PDF de prueba» con tres perfiles.
- Rail con 5 pestañas, sin cambios.
- Así se elimina el hueco sin dueño de hoy (C3).

## 5. Territorial por cuotas › Entrega (y el resto del modo cuotas)

**Construir:**
- Franja de pendientes arriba («Sin encuestador», «Faltan 20»), cada uno con su acción.
- Tabla zona ↔ encuestador con partes.
- Rotular la sección «Zonas» en lugar de «Unidades» cuando `kind = "cuotas"`. Es un cambio en `modules.ts`; decide la sesión dueña.
- Sacar todo texto con «UMP» del modo cuotas: Entrega, Catálogo, Paquetes y la tarjeta del registro.

**Falta en backend:** `plan` y `hoja-dia` no aceptan cuotas. En cuotas no se muestra «Plan de campo» hasta que existan.

## 6. Aulas › Unidades y › Entrega

**Construir:**
- Unidades: banda de origen («El plan coincide con el sorteo…», enlace a Origen); tabla agrupada por facultad con papel (titular o banco); columna «Por facultad» con barras ordenadas de mayor a menor.
- Entrega: el bloqueo va arriba («2 fichas cambiaron de acceso…», «Regenerar en Paquetes», «Volver a entregar» deshabilitado). Debajo, el recibo pieza por pieza y el par de Sheets (tablas que campo llena y distribución) con alturas iguales.

**Datos:** `collection_origen.R`, el registro de artefactos con su desfase (ya existe en `DeliverySection`).

**Pendiente de ADR:** la asignación de aplicadores (R7). Mientras tanto, el enlace a Monitoreo › Control › Equipo.

## 7. Telefónica › Casos y › Barrido

**Construir:**
- Casos:
  - dos bloques de igual alto, «Casos del barrido» y «Contacto»;
  - el segmentado marca la opción elegida con ✓ y anillo musgo (D18);
  - interruptores para columnas fuera del Sheets.
- Barrido:
  - en primer plano, el documento de los enumeradores con «Abrir el Sheets» y 4 pasos con estado: pestaña construida, casos declarados, nombres y teléfonos pegados, conectado en Monitoreo;
  - columnas y reglas en una columna lateral;
  - Excel como alternativa en una línea.

**Requiere dato:** saber desde Material si el barrido está conectado como fuente en Monitoreo. Hoy no se lee: `material_telefonica_sheets` frente a la fuente de `/api/monitoreo/sheets/source`. Sin ese dato, el chip de entrega dice «Sheets construido».

## 8. Supervisión › Columnas

**Construir:** tres columnas de igual alto (del barrido, de los resultados con búsqueda, de la supervisión fijas con el catálogo del veredicto) y la franja «Encabezados de la base» con el origen de cada columna.

**Corregir:** el origen del barrido no puede usar el naranja de aviso. Hay que darle forma o color propio.

## 9. Correo (editor y contactos) y Nueva campaña

**Construir:**
- Correo dentro del chrome común: miga, ronda, secciones y «Exportar a Mailchimp ▾» en la barra. Hoy la miga vive dentro de cada pestaña.
- Editor en tres columnas: bloques, lienzo y envíos.
- Contactos:
  - resumen de 4 cifras;
  - segmentado que abre en «Sin correo válido»;
  - tabla con motivo y estado.
- Nueva campaña, paso 2: elegir la ronda del Modelo con su «viene de». La que ya tiene campaña queda deshabilitada y dice por qué. Al pie, «¿Falta una ronda? Súmala en Monitoreo › Modelo».

**Requiere dato:** el motivo del correo inválido (sin arroba, dominio, duplicado), si el validador de `collection_mail_contactos.R` no lo clasifica. Si no lo hace, mostrar «Correo inválido».

## 10. Estados

Cada vista declara sus cinco casos con la barra v2:

- vacío legítimo, que nombra la entrada que falta;
- carga con esqueleto;
- entrada desfasada (409), con la acción al módulo de origen;
- error de lectura (500), con el `error_id`;
- destino equivocado (409 del Sheets de control).

Falta diseñar: el job que falla a la mitad.

## Orden sugerido

1. Piezas comunes: barra, contador, foco y movimiento.
2. Registro.
3. Unidades y Paquetes UMP.
4. Barrido y Casos.
5. Cuotas.
6. Aulas.
7. Correo y Contactos.
8. Supervisión.

Cada paso cierra con `make gate-front AREA=recopiladores` y una captura a 1280 y 1440 sobre las copias D1.

## Estado de la implementación (2 nov 2026, noche)

Implementado por la sesión del revamp, dueña del código de Material desde la aprobación de Gonzalo («Sí, implementar»).
Cada fila pasó `make gate-front AREA=recopiladores`; las que tienen copia D1, una captura a 1280 sin problemas reportados.

| Tablero | Commit | Estado |
|---|---|---|
| Barra con recorrido y regla de números | 706d0c130 | Hecho: `SectionPillbar` con `pendientes` y `lista`, `ChipDeEntrada`, chip de entrega |
| UMP › Unidades | 42e8abe69 | Hecho: Por revisar, distrito en selector, Encuestador y Observación (D15), inspector |
| UMP › Paquetes | acbdec845 | Hecho: piezas con estado, detalle por distrito (D16), reemplazos a un lado. Estado de sesión: el backend no guarda cuándo se generó |
| Telefónica › Barrido | 202e90bc7 | Hecho, con dato nuevo en R (`collection_barrido_estado.R`): documento del barrido y si Monitoreo lo conectó |
| Cuotas | 00a8a527a | Hecho: «Zonas» en `modules.ts` (`labelsPorVariante`), quién cubre cada zona. Plan de campo en cuotas: sin inventar, con nota |
| Aulas | e54c8d7ea | Hecho: entrada del plan, ✓ por sección, bloqueo por materiales desfasados arriba. Sin captura con datos (D17) |
| Supervisión | 7c94242a7 | Hecho: menú ⋯ con renombrar, ver el lote y archivar. Sin captura: ninguna copia D1 la tiene |
| Registro por público y ronda | 2d3cac005 | Hecho: un bloque por público en orden de ronda, procedencia en cada tarjeta |
| Correo en el chrome común | | **Excepción declarada** (Gonzalo, 2 nov 2026: «Sin banda, como el 20/10»). El correo no lleva banda de módulo: la miga vive en la barra de cada pestaña para que el cuerpo gane alto. No se aplica el chrome común ni el chip de entrada |

| Movimiento | b922d1e7d | Hecho: menú desde su disparador, fundido de 4 px al cambiar de sección, movimiento reducido = fundido. El press ya lo daba el kit |
| Aulas › Unidades | 8b63429f2 | Hecho: «Coincide con la selección vigente» sólo con los dos veredictos del backend; origen, desfase y facultades ya existían |
| Territorial › Catálogo › Fichas | f83b43045 | Hecho: escenario con la ficha y panel de acciones; PDF de prueba como bloque secundario |
| Telefónica › Casos | ce6dfd06f | Hecho: bloques pares (C2) y ✓ en la opción elegida (D18) |
| Correo › Contactos | | Ya existía: cuatro cifras y «Fuera del envío» con su motivo (sin correo, inválido, repetido), que el backend ya clasifica. La nota «requiere dato» del diseño era incorrecta |
| Densidad a 1440 y Nueva campaña | | Ya existían: inspector de 400 px a 1440 y la ronda del Modelo con su «Viene de» |

Datos que el backend aún no entrega: el desfase de ruteo y consolidados cuando cambia la asignación, la fecha en que se
generó cada pieza territorial y el porcentaje del ZIP. Sin ellos, Paquetes no pinta esos estados.

## Pasada de elegancia (2 nov 2026, noche)

Gonzalo: «Hay [vistas] que aún se ven bastante feas, les falta formato y elegancia». La vara sale de su
ejemplo, la cabecera de la tabla del plan de aulas: metadatos en la letra del sistema y en una línea, sin
redundancias, cifras con separador de miles y contadores subordinados al título.

Recorrido: 26 capturas a 1280×800 sobre las copias D1 (UMP, cuotas, aulas con plan sembrado y
telefónico), 26 md5 distintos. Se juzga la estética, no la geometría.

### Ranking, de la más fea a la menos fea

| # | Vista | Por qué | Estado |
|---|---|---|---|
| 1 | Aulas › Accesos (Vinculación y Canales) | El vacío de Vinculación parte «30 aulas» en una columna propia; Canales es un vacío de 18 px que explica tres cosas; «profile-… (sin credenciales)» se lee como depuración; los dos botones de la cabecera, apagados y sin primario | pendiente |
| 2 | Territorial › Entrega (UMP y cuotas) | Formulario sin marco: párrafo largo, caja «Encuestadores» vacía de 90 px, el rótulo «Plan de campo» flotando, inputs y dos botones chicos; en cuotas el formulario entero queda apagado con una disculpa al pie | pendiente |
| 3 | Aulas › Entrega › Traspaso | Dos vacíos apilados de texto grande que dicen lo mismo, cuatro filas de «—» y un primario apagado a todo el ancho | pendiente |
| 4 | Aulas › Paquetes | Tres botones apagados sin jerarquía, el colector de prueba con monoespaciada y rayas, «pendiente» y «sin preparar» en minúscula, desglose con puntos medios | pendiente |
| 5 | Aulas › Entrega › Plantillas | Los nombres de cada plantilla (17 px) pesan más que el título de la tarjeta; los «Excel» son botones apagados mínimos; al lado, una tarjeta con sólo «Leyendo la entrega…» | pendiente |
| 6 | Territorial › Catálogo (Zonas, Ruteo, Consolidados, Códigos) | Una tarjeta delgada arriba y 450 px de vacío debajo; el selector de UMP a todo el ancho con puntos medios; Códigos se queda en «Leyendo los códigos…» | pendiente |
| 7 | Telefónica › Entrega | Dos tarjetas de texto en letra de 12 px y el resto vacío; correcta pero pobre | pendiente |
| 8 | Telefónica › Casos | Inputs en «0» crudos y «Sin cambios.» suelto al pie | pendiente |
| 9 | Aulas › Unidades › Origen | Títulos y metadatos cosidos con puntos medios («Selección de cursos-horario · Cálculo de muestra», «a3e1…c8 · sorteo») | pendiente |
| 10 | Territorial › Paquetes | Chips «UMP 13 · no alcanza» con punto medio y un botón apagado a todo el ancho que sólo pide elegir | pendiente |
| 11 | Aulas › Unidades › Lista | La cabecera que marcó Gonzalo; queda «sin docente» en minúscula repetido por fila | **hecho (L14)** |
| 12 | Registro de campañas | «Campo real · enviada el 02/11»; la cabecera de la tarjeta es un ícono grande sobre vacío | pendiente |
| 13 | Telefónica › Barrido | «Sin Sheets:» como etiqueta suelta con el enlace del Excel al pie | pendiente |
| 14 | Territorial › Unidades y Cuotas › Zonas | Tablas limpias; «Hombre 96 · Mujer 104» con punto medio | pendiente |
| 15 | Territorial › Catálogo › Fichas | Bien; la maqueta repite puntos medios («ATE · Zona 00300 · Manzana 0140») | pendiente |
| 16 | Aulas › Catálogo (Tipos y Editor) | Las mejor resueltas del módulo | — |

### Patrones que se repiten

- **Punto medio como separador**: unos doce sitios. Se cambia por coma, «y» o una segunda línea.
- **Vacíos con texto de 17–18 px centrado** que pesan más que el título de su tarjeta (Accesos, Traspaso,
  Paquetes). El vacío va en la letra del cuerpo y subordinado.
- **Estados en minúscula** dentro de rótulos («pendiente», «sin preparar», «accesos sin preparar»).
- **Filas de botones apagados sin un primario**: la acción que toca no se distingue de las que aún no.
- **Tarjeta delgada arriba de un panel vacío** (Catálogo territorial, Entrega telefónica).
- **«Leyendo…» que se queda** en la captura (Códigos, Encuestadores, Traspaso): falta comprobar si es
  carga lenta o un vacío sin clasificar.

### L14, cabecera del plan de aulas (hecho)

- La meta de la tabla queda en una sola línea y en la letra del sistema, sólo con el instrumento
  («Sin instrumento fijado» o «Instrumento rev-1»); los cursos-horario y el banco ya los dice el resumen
  de al lado y el chip de entrada.
- «Página 1 de 1» con los dos botones apagados ya no se pinta: la paginación aparece con dos páginas o más.
- El origen dice «Cálculo de muestra, sorteo del…» en vez de «calc-muestra · sorteo del…»
  (`nombreDelModulo` reconoce también `calc-muestra-aulas`).
- Composición: «10 facultades, 977 alumnos elegibles y 11 reservas por aula», sin «11.0».
- El chip de estado de la barra va con mayúscula inicial («Accesos sin preparar»).

## Causas compartidas (2 nov 2026, noche)

Gonzalo, vía coordinación: «no es solo un pequeño ajuste, es un tema sistemático que debe solucionarse».
Por eso el ranking de arriba deja de ser una lista de pantallas por arreglar. Lo que sigue son las causas,
cada una con la fuente donde nace, su conteo en `features/recopiladores/` y el guard que impedirá que
vuelva. Las vistas citadas salen de las 26 capturas a 1280.

| # | Patrón | Dónde nace | Conteo | Vistas | Arreglo en la fuente | Guard |
|---|---|---|---|---|---|---|
| P1 | Letra en píxeles, sin roles: los contadores pesan más que el título, vacíos de 17–18 px, nombres de plantilla más grandes que el título de su tarjeta | `app/tipografia.css` tiene 8 roles, pero `app/letraPorRol.contract.test.ts` gobierna Home, Dashboard, Formularios, Analítica, Carga y Procesamiento, **no Material** | 440 `font-size: Npx` en 50 hojas (12 tamaños de 10 a 17 px; 130 de 12, 80 de 12.5, 79 de 13, 51 de 11.5); sólo 60 por rol | las 26 | Migrar cada hoja a `var(--pulso-type-<rol>-size)`, como Carga (614 → 0) y Analítica (196 → 0) | Sumar `features/recopiladores` a `MODULOS` del ratchet: el conteo por hoja sólo baja; excepciones declaradas, como la maqueta que dibuja el papel |
| P2 | Dos gramáticas de bloque: aulas usa `Panel` (rótulo, título y acciones); territorial y telefónica, cajas propias con ícono y título de 14 px. De ahí salen los bloques sin marco, las tarjetas delgadas y la meta en sitios distintos | No hay cabecera de bloque común en Material, y el `Panel` del kit no trae una línea de metadatos | `Panel`: 11 usos en 6 archivos. Cajas propias (borde, radio y padding): 107 en 40 hojas. 67 `h2/h3` sueltos y 18 rótulos en versalitas propios en 14 hojas | ~20 | Una sola cabecera de bloque: rótulo opcional, título, **línea de metadatos** (una línea, letra del sistema, `caption`, `text-faint`) y acciones a la derecha | Ratchet de cajas propias y de `h2/h3` fuera de la primitiva en recopiladores, por hoja, sólo baja |
| P3 | Punto medio como separador | Frases cosidas a mano en componentes y modelos (`origen.ts` 5, `modeloCorreo.ts` 5, `DialogoNuevaCampana` 5, `modeloRegistro` 4, `ZonasDeCuotas` 4…) | 104 líneas en 57 archivos (algunas son comentarios largos; el ratchet fija la cifra exacta) | 12 | Helper `unirFrase(partes)` que arma «a, b y c», y una segunda línea cuando son datos de distinto tipo | Ratchet de «·» en literales de JSX y strings de recopiladores, por archivo, sólo baja |
| P4 | Cifras sin separador de miles | No hay formateador compartido: `miles` local en `ComposicionPorFacultad`; en Cálculo de muestra hay `fmtInt` y `formatearEntero` | 16 `{x.length}` crudos y 5 `toFixed` en JSX, frente a 60 formateados | las que pasan de 999 (plan de aulas, registro, paquetes) | `entero(n)` y `decimal(n, max)` en `lib/`, en es-PE | Ratchet de `{….length}` y `toFixed(` en JSX de recopiladores |
| P5 | Vacíos y cargas a mano | Tres recetas conviven: `EstadoVacio` del kit (18 usos en 13 archivos), `.rec-contained-empty` propio (8 en 6; es flex en fila, así que parte «30 aulas» en una columna) y `.rec-loading` (5), más ~30 «Leyendo…» sueltos en `<p>`/`<small>` con clases distintas, cuando el kit ya tiene `Skeleton` | 8 + 5 + ~30 | 8 (Accesos ×2, Traspaso, Paquetes, Plantillas, Códigos, Entrega territorial ×2) | Todo vacío por `EstadoVacio` y toda carga por la del kit; borrar `.rec-contained-empty` y `.rec-loading` | Ratchet de clases propias de vacío y carga en recopiladores, con meta 0 |
| P6 | Estado mezclado con acción, y estados en minúscula | El chip de estado de `ModuleCommandBar` (kit, lo usan otros módulos) va pegado a «Actualizar» sin separación. Hay 19 clases propias de chip o estado (`rec-terr-pieza-estado`, `rec-tel-paso-estado`, `rec-sync-estado`, `rec-origen-chip`…), y los rótulos llegan en minúscula desde los modelos (`deploymentStatusLabel`, «pendiente», «sin preparar», «sin docente», «manual») | 19 clases; 4 shells con `estado` | todas las de campaña | Una primitiva `EstadoChip` (tono y rótulo con mayúscula inicial) que reemplace las 19 clases, y separar estado de acciones en la barra (**toca el kit: requiere OK**) | Test de que los rótulos de estado empiezan con mayúscula, más ratchet de clases `*-estado` y `*-chip` propias |
| P7 | Filas de botones apagados sin uno primario | Cada sección arma su fila de `PulsoButton` y no hay regla de una acción primaria por bloque | 34 primarios, 66 secundarios y 28 ghost; se ve en Accesos, Paquetes, Plantillas y Entrega de cuotas | 4 | Regla de gramática: un bloque con acciones tiene exactamente una que va como primaria (la que toca), y las demás van como secundarias aunque estén apagadas | Revisión de captura; no hay manera mecánica confiable |
| P8 | Monoespaciada para metadatos | `<code>` y reglas `monospace` sueltas | 9 `<code>` en 8 archivos y 11 reglas en 7 hojas; fuera del correo (donde el HTML sí es código), 5 son metadatos: huella en Entrega, colector de prueba en Paquetes, `origen.css`, telefónica y `MaterialsSection` | 3 | La meta va en la letra del sistema; el valor técnico, en `title` | Ratchet de `<code>` fuera de `correos/` |
| P9 | Texto redundante: la misma cifra en el chip de entrada, el resumen y la tabla, o un subtítulo que repite la sección | Cada vista decide por su cuenta qué cifra repite | sin conteo mecánico | ~6 | Regla de gramática: cada cifra vive en un sitio; antes de agregar una, mirar el chip de entrada y la tarjeta vecina | Revisión de captura |

Las tablas ya tienen guard propio (`tablasDelKit`, cinco tablas a mano de Material en su foto), así que
no entran como causa nueva.

### Gramática corta (aprobada por coordinación el 2 nov 2026)

Toda vista de Material se arma con estas piezas. Nadie las reinventa por pantalla.

1. **Cabecera de bloque**: rótulo opcional, título, línea de metadatos y acciones a la derecha, todo en una
   misma fila. Un bloque sin cabecera no lleva marco propio.
2. **Línea de metadatos**: una sola línea, en la letra del sistema (`caption`, `text-faint`), subordinada al
   título. No va en monoespaciada (el valor técnico se guarda en `title`). Sus partes se unen con coma o «y»,
   nunca con punto medio.
3. **Contador**: subordinado al título que cuenta. Pesa menos que el título y lleva separador de miles (es-PE:
   «1,234.5»).
4. **Estado frente a acción**: un estado es un `EstadoChip` (tono más rótulo con mayúscula inicial) y vive en
   su propio slot. Una acción es un botón. Nunca comparten fila sin separación.
5. **Una primaria por bloque (P7)**: si un bloque tiene acciones, exactamente una va como primaria (la que
   toca) y las demás como secundarias, aunque estén apagadas. Se controla en la revisión de captura.
6. **Cada cifra en un solo sitio (P9)**: antes de pintar una cifra, mirar si ya la dicen el chip de entrada, el
   resumen o la tarjeta vecina. Se controla en la revisión de captura.
7. **Vacío y carga**: el vacío es `EstadoVacio` (ícono, título y UNA línea) y la carga es `LoadingBlock`.
   Ninguna espera va escrita como texto suelto. Lo vigila `vaciosYCargasDelKit.contract.test.ts`.
8. **Letra por rol**: `var(--pulso-type-<rol>-size)`, nunca en px. Lo vigila `letraPorRol.contract.test.ts`.

### P5, vacíos y cargas (hecho)

- 8 `.rec-loading`, 8 `.rec-contained-empty` y 12 «Leyendo…» sueltos pasan a `LoadingBlock` (20 usos) y `EstadoVacio`.
  Se borran las reglas CSS de las clases viejas, incluida la fila `1fr` de Accesos que estiraba el vacío.
- Guard: `vaciosYCargasDelKit.contract.test.ts`, con meta 0 y centinelas (306 fuentes, 20 `LoadingBlock`).
- Capturas: antes en `est-*` y después en `p5-*` (26 vistas, 26 md5 distintos, textosFuera 0). Cuotas sale `ok=false`
  antes y después por el mismo `geometryCoverageMisses: 1`, que ya existía.

### P5b, readiness que espera a sus bloques (hecho)

Tres vistas se declaran listas antes de que termine el fetch de un bloque, así que la captura mide una pantalla a medio
cargar: Territorial › Catálogo › Códigos (`CodigosDeResultado`), Territorial › Entrega (`AsignacionEquipo`) y
Aulas › Entrega › Plantillas («Traspaso a Monitoreo», `PlantillasDelEquipo`). Se arreglan con el patrón readinessAnidada:
cada bloque avisa a su shell que está cargando, y si el fetch falla cuenta como listo con su error, sin un false terminal.
- Arreglo en la fuente: `CargaDeBloque` (un `LoadingBlock` en línea dentro de `data-audit-ready="false"`) reemplaza las
  12 cargas en línea de Material, no sólo las tres. Queda declarado en `FALSE_TRANSITORIO` de `readinessAnidada`.
- De paso: Telefónica › Entrega decía «Leyendo la campaña…» para siempre si la campaña no declaraba columnas. Ahora
  lo dice, con su test (`telefonica/EntregaTelefonica.test.tsx`).
- Guard: `vaciosYCargasDelKit.contract.test.ts` exige que toda carga en línea pase por `CargaDeBloque`.
- Recaptura: Códigos, Entrega UMP, Entrega cuotas, Plantillas y Entrega telefónica muestran el dato (ok=true).

### P1, letra por rol (hecho)

- Los 440 `font-size` en px de 50 hojas pasan a `var(--pulso-type-<rol>-size)` con la regla de Analítica y Carga:
  ≥18 px → kpi; 15–17 → title; 12–14.5 → subtitle si la regla es seminegrita y body si no; 10.6–11.5 → eyebrow si
  va en mayúsculas y caption si no; ≤10.5 → micro. El reemplazo es línea por línea, así que ninguna hoja crece.
- Guard: `features/recopiladores` entra en `MODULOS` de `app/letraPorRol.contract.test.ts` con meta 0.
- Capturas: `p1-*` (26 vistas, textosFuera 0). No hay recortes; el cambio es sutil, como se esperaba.

### Vista faro: Territorial › Entrega (2 nov 2026, noche)

Gonzalo, tras P5 y P1: «en verdad se ve mal diseñado, se ven con fondos grandes, ausencia de contenedores, ausencia
de elementos UI sofisticados… todavía faltan kilómetros de años luz». Ordenar el código no responde a eso. Se
rediseña una vista entera al nivel del Sistema Pabellón para fijar la vara antes de extenderla:

- Cuatro cifras en tarjetas (UMP titulares, equipo, asignadas con barra, sin encuestador en tono de aviso).
- Reparto por distrito: una tarjeta por distrito con su barra y cada UMP como ficha teñida del color de su
  encuestador (gris punteado si no tiene).
- Equipo: las 26 personas con avatar de color determinista, código y barra de carga, sin techo.
- Asignación y Plan de campo en tarjetas con cabecera. En cuotas ya no se pinta el formulario apagado del plan.
- Modelo puro `territorial/modeloTablero.ts` con 5 tests. Capturas `faro-ump` (1280 y 1440) y `faro-cuotas`.

### Qué se reusa y qué es nuevo (pedido de coordinación, para no abrir una tercera gramática)

| Pieza | Decisión | Por qué |
|---|---|---|
| Bloque con cabecera | **Se reusa `components/Panel.tsx`** (título con ícono, `hint` como línea, `actions`) | Ya existía; el `BloqueDeTablero` local lo duplicaba y se borró antes de commitearse. P2 sigue siendo una sola gramática: `Panel`. |
| Cifras en tarjeta | **Nueva en `components/CifrasEnTarjeta.tsx`** | No había una compartida: cada módulo tiene la suya (`KpiCard` en Dashboard, `CifraMotor` en Cálculo de muestra, `Metric` en aulas). `CifrasPestana` de Analítica es otra cosa (chips de cabecera de pestaña) y se queda. Las otras pueden converger aquí cuando se toquen. |
| Barra de avance | **Nueva en `components/BarraDeAvance.tsx`** | Tampoco había: `JobProgress` es la de un job y Home, Monitoreo y Correo pintan la suya con `role="progressbar"`. Usa `--module-accent`, así sirve a cualquier módulo. Anima con scaleX (contrato de movimiento L37). |
| Reparto por distrito, equipo con avatares | Propio de Territorial (`TableroDeEntrega.tsx`, `tableroEntrega.css`) | Es contenido de la vista, no una primitiva. Los tonos copian el patrón del Sistema Pabellón sin importarlo, porque su módulo es de Monitoreo. |
| Chequeos del origen, aulas que esperan enlace | Propio de Accesos (`AccesosTablero.tsx`) | Ídem. |

### Extensión de la vara (Gonzalo, 2 nov 2026: «Sí, extiéndelo»)

Regla de cada vista: contenedor = `Panel`; cifras = `CifrasEnTarjeta`; avance = `BarraDeAvance`; lo propio de la vista
en su archivo. Captura antes y después, gate-front verde y un commit por vista.

| Vista | Qué cambió | Commit |
|---|---|---|
| Territorial › Entrega (faro) | cifras, reparto por distrito con fichas por encuestador, equipo con avatares | bc82383b9, f162c3aab |
| Aulas › Accesos | cifras del acceso, tres chequeos como lista, aulas como fichas que esperan enlace | 24b87e8a6 |
| Aulas › Entrega › Traspaso | cifras de la entrega; recorrido de cuatro pasos con estado y acción en vez de cuatro «—»; recibo pendiente que enseña sus campos; material generado con su rótulo | 194f5e036 |
| Aulas › Paquetes | cifras del lote (fichas con barra, titulares, reemplazos, banco); el motivo del bloqueo una vez arriba con «Ir a Accesos»; los tres formatos como tarjetas con descripción y el PDF como principal; ficha de prueba sin rayas ni monoespaciada | 3a7c1cd42 |
| Aulas › Entrega › Plantillas | las tres planillas como tarjetas de salida (la pieza de Paquetes) dentro de un Panel; el traspaso en su Panel, con «Todavía no hay entrega» como estado y el sello en el `title` | 62a0e9f64 |
| Territorial › Catálogo (Zonas, Ruteo, Consolidados) | el esquema de Fichas en las tres: la hoja de la UMP o zona elegida en maqueta legible (`MaquetaDeHoja.tsx`: columnas de ruteo, códigos y registro numerado, plano con rutas y «R») y el panel de acciones al lado | 4ceb29037 |
| Territorial › Paquetes | cifras del paquete (titulares, reemplazos, zonas, piezas listas con barra); «Para campo», hojas y reemplazos puntuales en Panel; fichas sugeridas con código y motivo, sin «·» y sin techo | 09c5130a0 |
| Telefónica (Casos, Barrido, Entrega) | cifras del barrido en el shell (casos, backup, teléfonos, documento); las siete tarjetas en Panel; Entrega con recorrido de tres pasos (la pieza del Traspaso); la clase de cada status como EstadoChip con tono | 715a6faa1 |
| Registro de campañas | sin «·» en la tarjeta (enumerar y comas); avance con BarraDeAvance y «x de y»; envíos con el nombre en negrita; tarjeta punteada «Nueva campaña» al final de la grilla; franja teñida por tipo | 7fe8b4ad2 |

### Pasada final (3 nov 2026)

- Kit y ratchets de Material: P3 `puntoMedio.contract.test.ts` («·» 116 → 61, casi todo en el correo; 5c27aaa7e),
  P4 `conteosConMiles.contract.test.ts` (83119d2c3), P5 `vaciosYCargasDelKit`, P1 `letraPorRol` (meta 0).
- 26 vistas a 1280 (`final-*`), 26 md5 distintos, textosFuera 0. Cuotas › Zonas arrastraba un contrato de geometría
  `owned` inválido desde antes del rediseño: corregido en 253a6ad52. Con eso las 26 salen ok=true.
- Queda abierto: los «·» del correo (61, bajo ratchet) y Códigos de resultado, que sigue como formulario.
