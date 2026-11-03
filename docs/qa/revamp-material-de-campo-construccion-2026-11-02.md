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
