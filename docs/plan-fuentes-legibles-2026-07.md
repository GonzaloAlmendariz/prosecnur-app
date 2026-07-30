# Plan de Fuentes legibles — Monitoreo

Dirección congelada para que la sección **Fuentes** de Monitoreo la entienda
alguien que no conoce la app por dentro. Se implementa modo por modo:
Acreditación primero, y de ahí se traslada a Telefónico y Territorial.

| Campo | Valor |
|---|---|
| Versión | 1.0 |
| Fecha | 2026-07-28 |
| Estado | Dirección congelada; implementación en curso en el modo Acreditación |
| Alcance | Sección `fuentes` de Monitoreo en los modos Acreditación, Telefónico y Territorial: estructura de pestañas, vocabulario, enlaces y contrato geométrico |
| Fuera de alcance | Motor R de fuentes, contrato del `.pulso`, sincronización, y la divergencia numérica de `recibidas` en Territorial (se trata como bug aparte) |
| Modo en curso | Acreditación — proyecto de referencia `acrconta` |

## Estado al 2026-07-28

**Hecho y verificado** (typecheck limpio, 1.957 vitest, 3.532 testthat):

- Pestañas de 4 a 3, nombradas por pregunta, con alias de las claves viejas.
- `Resumen` reconstruido: agrupación por papel, nombre humano, enlaces reales,
  mapa de cobertura por actor, identificadores en detalle plegado.
- Panel `Conectar fuente`: una puerta, tres pasos, validación local en vivo,
  verificación antes de guardar y aviso de duplicado.
- Franja de fuentes repartida en una fila.
- Timeout en los tres caminos de red hacia Google (N7).

`Universo` reconstruido como lista de cobertura por actor: deja de ser un
formulario —era la segunda puerta de conexión, sin verificación— y conectar o
cambiar abre la puerta única con el actor precargado por `?foco=`. El barrido
sale del `details` cerrado. `AcreditacionSheetsByActorView` se retiró.

`Encuestas y recopiladores`: el `survey_id` deja el subtítulo, el vocabulario
compartido reemplaza `Base X · N heredan · N excepciones` y `Sin alias
operativo`, y de las cuatro métricas de recopilador queda la única que era un
número —`Uso`, `Alias` y `Barrido` valían 1/0 y repetían sus propios controles—.
Se retiraron los dos `details` que duplicaban la puerta (N1).

> **C1 — todos los recopiladores caían en el canal de su encuesta.** Reportado
> por el usuario y reproducido en `acrconta`: los 20 recopiladores de la
> encuesta de Estudiantes salían como «Presencial (Ficha QR)», incluidos los
> **10 que la plataforma reporta como `email`**. Causa: el orden de los
> fallbacks en `acreditacionCollectorsForSource`,
> `saved?.channel || sourceChannel || platform?.channel`, donde el canal de la
> encuesta gana al del recopilador.
>
> El arreglo no fue invertir el orden. `collector.channel` es un campo **blando**
> —arrastra nombres heredados como «Correo institucional historico» en
> recopiladores que no son de correo— y un test previo ya protegía que el canal
> de la encuesta le ganara. El dato **duro** es `collector_type`: un `email` no
> es presencial por mucho que su encuesta se aplique con ficha QR, mientras que
> un `weblink` no determina nada —una ficha QR, un enlace de WhatsApp y un link
> abierto son todos weblinks—. El orden nuevo es: confirmado por el usuario →
> lo que el tipo determina → canal de la encuesta → campo blando.
>
> Regresión en `AcreditacionCanalRecopilador.test.ts`, con el caso real de
> 10 de 20. Agravante que motivó el reporte: la tarjeta remataba con «20
> recopiladores usan este canal · **ninguno con excepción**», presentando como
> confirmado algo que nadie confirmó.

## Acreditación fuera de Fuentes — reportado el 2026-07-28

Fuentes no era el único problema del modo. Lista del usuario, ordenada por
profundidad, porque mezclarlas ha sido la forma de no terminar ninguna.

### Cosmético acotado

| # | Superficie | Qué |
|---|---|---|
| ✅ A1 | Rail · cápsula de actualización | Estaba en `font-size: 7px` —el piso de la escala es 10— y gastaba un tercio del ancho en el año. Sin año, a 10 px; el año queda en el `title`. **Hecho.** |
| ~~A2~~ | Teléfono · Ritmo diario | **Resuelto.** `.mon-phone-trend` era un grid sin `grid-template-rows`, así que sus tres filas se repartían el alto casi por igual: cada tarjeta ocupaba 191 px para un número y dos palabras. Con las filas declaradas y `align-content: start` en el `span`, las cuatro juntas pasan a 65 px. Sin media query: medir desmintió el 2×2 en pantalla baja —139 px contra 65 en fila única— porque en pantalla baja lo que escasea es el alto |
| ~~A3~~ | Consultas · pestañas | **Resuelto.** No faltaba copy: cada pestaña ya tenía encabezado, icono y tono, y `isTableOnlyTab` los **apagaba** para dar alto a la tabla. Vuelve en una línea (16 px). Y el tono tampoco separaba: `pending` (#365d8f) y `base` (#2f6f90) eran el mismo azul —medido, `rgb(54,93,143)` contra `rgb(47,111,144)`—; «Estado de la base» pasó a ámbar. Distancia de color de 6 a **177** |

### Estructural

| # | Superficie | Qué |
|---|---|---|
| ~~B1~~ | Modelo | **Superado por decisión posterior del usuario (2026-07-29)**, no ejecutado. B1 pedía quitar subpestañas de Modelo; después se pidieron dos más —Distribución por actor y Cronograma del campo— porque la vista tenía que responder preguntas distintas, no solo cuotas. Se deja anotado para que no se «repare» más adelante deshaciéndolas |
| ~~B2~~ | Teléfono | **Resuelto.** La tira se retiró del render —la sección «Estado de la base de llamadas» mostraba los mismos cinco estados sin recortarlos a «Sin conta…»— y ahora se retiran también el componente y sus 16 reglas de CSS, que habían quedado muertos. `acreditacionPhoneStatusLegendItems` se conserva: es quien calcula los estados |

### Dominio — exigen decisión metodológica, no son pulido

| # | Superficie | Qué |
|---|---|---|
| ~~C1~~ | Teléfono · cuotas telefónicas | **Resuelto.** El estudio declara `interest_variables` por actor —varias si hace falta—; el catálogo de columnas viaja con su distribución y su normalización sugerida, ordenado por cobertura descendente. Modelo gana la pestaña Distribución por actor y Avance › Detalles reporta lo declarado |
| ~~C2~~ | Teléfono · estados del barrido | **Implementado**, pendiente de verificación visual. Pestaña `Estados` en Teléfono: lista los crudos que trae el corte con su volumen, deja reasignar familia y fija el color de cada una. Lo confirmado gana sobre la heurística también en cortes futuros. Persiste en `state_rules`, que ya viajaba en el `.pulso` sin que nadie lo usara desde la UI; el campo `color` se añadió a la whitelist de R |
| ~~A4~~ | Teléfono · Ritmo diario | **Implementado.** Apilado por día que respeta la regla de fotografía: no acumula, cada día es su última actualización, y los colores salen del definidor de C2 —ningún estado se pinta con un literal en la vista—. En el backend, `estatus_dia` se publicaba solo dentro de `standalone_phone` aunque siempre se calculaba |

> **Los estados son fotografías, no eventos.** Regla de dominio del usuario,
> 2026-07-28, y gobierna todo lo que se dibuje con ellos:
>
> - La base de barrido tiene N casos, y **cada caso tiene un solo estado en
>   cada momento**. Los estados no se acumulan.
> - Cada actualización es una **fotografía completa** de esos mismos N casos.
>   Lo que el eje temporal cuenta no es producción, es **redistribución**: cómo
>   fueron cambiando de estado los mismos casos.
> - Si un día tiene **más de una actualización, manda la última**.
>
> Consecuencias, que son las que hacen que esto no sea un detalle:
>
> - **Sumar los estados de dos fotografías cuenta el mismo caso dos veces.** Un
>   apilado construido como histograma de eventos daría totales crecientes y
>   falsos.
> - El total de cada día debe ser **constante** e igual al tamaño de la base.
>   Si no lo es, la serie está mal construida y hay que decirlo, no dibujarla.
> - El gráfico correcto es de **composición** —área o barra apilada de total
>   estable—, no de volumen.
>
> La regla está implementada y con regresión en
> `AcreditacionFotografiasDeEstado.ts`. **Pero el dato para alimentarla todavía
> no existe**, y conviene saberlo antes de intentar el gráfico:
>
> - El motor tiene un bloque `estatus_dia` («Estados telefónicos por día») que
>   parece justo lo que hace falta, y además **solo se publica cuando la familia
>   es `telefonico`** —en acreditación se calcula y se descarta—, lo que a
>   primera vista es una desconexión de las de C5 categoría 3.
> - No lo es. Ese bloque cuenta
>   `sum(status == label & dates == day)`: casos por **fecha de llamada**, o sea
>   un histograma de eventos, con `Total` sumado a lo largo de los días.
>   Conectarlo daría exactamente el gráfico falso que la regla prohíbe.
> - Lo que falta es un **histórico de fotografías**: hoy cada sincronización
>   sobreescribe el estado y no se guarda el reparto anterior, así que no hay
>   con qué dibujar la redistribución.
>
> Conclusión: **A4 depende de infraestructura de motor que no existe**, no de
> conectar un cable. Antes de dibujarlo hay que decidir dónde se guarda la serie
> de cortes y qué se conserva de cada uno.

> **Corrección (2026-07-29): A4 está hecho, y la conclusión de arriba era
> demasiado pesimista.** Lo que sigue en pie es la mitad buena del diagnóstico:
> `estatus_dia` no es una serie de fotografías, y acumularlo para simular la
> redistribución sería el gráfico falso que la regla prohíbe. Lo que estaba mal
> era la conclusión práctica.
>
> El bloque no es un histograma de eventos: es una **partición**. Cada caso
> barrido aparece una sola vez, en el día de su última lectura y con su estado
> final, así que dibujarlo tal cual —una barra por día, sin acumular— responde
> una pregunta legítima y distinta: **qué estados se registraron cada día**. No
> hacía falta ningún histórico para eso.
>
> Y no era infraestructura: `status_day` **ya se calculaba siempre**, sin
> depender de la familia; solo su publicación estaba dentro de
> `if (isTRUE(standalone_phone))`. Sacarlo de ese guard fue una línea, sin coste
> de cómputo. El error fue leer "se calcula y se descarta" como si el cálculo
> también estuviera condicionado.
>
> Lo entregado: barra apilada bajo el ritmo diario, con los colores que el
> usuario declaró en el definidor (C2) y hover por segmento. El título dice
> explícitamente «Cada barra es lo que se registró ese día, no el estado de toda
> la base», porque la confusión que el diagnóstico temía es real y la única
> defensa es nombrarla. Dos defectos salieron al verificar en pantalla: los días
> se ordenaban por texto —`10 jun` antes que `3 jun`— y el hover repetía la
> familia cuando el estado crudo se llamaba igual.
| ~~C1~~ | Teléfono · cuotas | **Resuelto** por la vía de variables de interés. Ver abajo |

> **C1 — resuelto, y el diagnóstico anterior era incorrecto.** Escribí que
> estaba «bloqueado por motor» porque `/api/monitoreo/state` devolvía
> `variables: []`. Confundí dos cosas: `state.variables` es la lista que se arma
> para la interfaz, pero el motor de cuotas **no la usa** — le basta con que la
> columna exista en `phone`, que es un subconjunto de FILAS
> (`data[mask, , drop = FALSE]`), no de columnas. El año de egreso siempre
> estuvo ahí.
>
> **Lo entregado**, en cuatro capas:
>
> 1. **Catálogo** (`monitoreo_variables_interes.R`): el reparto por categoría de
>    cada columna, no solo seis ejemplos. Se calcula únicamente donde tiene
>    sentido —por encima de 60 categorías distintas es un identificador— y el
>    recorte del top se declara con cuántas quedaron fuera y cuántos casos
>    representan. El orden lo manda la cobertura.
> 2. **Normalización**: `2021-1` y `2021-2` → `2021`. El patrón `AAAA-S` se
>    detecta **por mayoría, no por unanimidad**: una hoja de 270 personas trae
>    erratas y una celda mal escrita no puede impedir agrupar la cohorte.
> 3. **Persistencia por actor**: `interest_variables` en la whitelist de
>    `.monitoreo_operational_model()` — sin eso el campo se descarta en silencio
>    al guardar. Un actor puede declarar VARIAS variables; lo que no se repite es
>    el par actor+variable.
> 4. **Modelo > Distribución**: pestaña propia con el catálogo por actor. Lo que
>    no puede segmentar no se oculta, se marca con su motivo — incluido
>    `sin-analizar` para un `.pulso` guardado antes de que el catálogo trajera
>    reparto. Tratar esa ausencia como «una sola categoría» marcaba las 27
>    columnas de Egresados como inservibles.
>
> **Conexión con Avance > Detalle.** Lo declarado manda sobre las specs de
> `.monitoreo_report_control_specs()`, que estaban **hardcodeadas** para cuatro
> pares actor/variable; las fijas quedan de respaldo donde no hay declaración.
> El eslabón que faltaba: la detección de controles solo corría al **publicar**,
> así que el reporte de avance recibía `controls` vacío y la vista decía «Sin
> variables de control detectadas» — con specs de fábrica incluidas. Verificado
> en `acrconta`: Administrativos por área, Docentes por categoría y dedicación,
> Egresados por año de egreso, con universo contra corte efectivo y desvío en pp.

> **La trampa del cache, en carne propia.** Tras conectar el motor, la vista
> seguía diciendo «0 variables» con el cálculo ya arreglado —comprobado en R:
> el mismo `.pulso` daba 13 filas—. El cache estaba sirviendo lo que calculó la
> versión anterior del motor: un cambio de **código** no altera ni los datos ni
> la configuración, así que la clave no cambiaba y el `hit` era válido.
>
> Hay **dos** claves que gobiernan esto y hubo que subir las dos:
> `.MONITOREO_ACR_CACHE_SCHEMA` (v1 → v2) y `.monitoreo_dashboard_cache_key`,
> que es anterior en la cadena y ganaba. La regla queda escrita en ambos sitios:
> **subir la versión cuando cambia la forma de calcular, no solo la de
> guardar.** Es el precio de cachear, y se paga una vez.

> **Modelo recupera sus pestañas.** Tres, una por decisión: cuánto quiero de cada
> actor (metas), cómo lo quiero repartido (distribución) y cuándo se hace el
> campo (cronograma). En B1 se había quedado con una porque las tres subpestañas
> de entonces subdividían la misma decisión; «Lectura de Fuentes» sigue retirada
> por eso mismo. Al añadirlas apareció un defecto que las metas tapaban:
> `.mon-stage` declara `auto minmax(0,1fr)` para dos hijos y Modelo solo tiene el
> panel, así que caía en la fila `auto` y la de `1fr` quedaba reservada y vacía
> —256 px de aire muerto—. Resuelto con el patrón de `.mon-stage--sources`.
| C3 | Teléfono · base de barrido | Falta **mapear columnas**. Es feature de tres capas, no pulido — ver abajo |

> **§4.4 — Fuentes del modelo telefónico.** El rediseño de Fuentes se había
> aplicado solo a la rama no telefónica: `FuentesResumen` y `FuentesUniverso`
> están detrás de `!isPhoneSourceModel`, así que un estudio telefónico —también
> dentro de Acreditación, no solo en el fork— seguía viendo el render viejo.
>
> Lo reparado en las **dos copias** del panel de contrato
> (`AcreditacionPhoneSourcesContractPanel`, que vive duplicado en los dos
> page-files):
>
> - **R2, el defecto de fondo**: la tarjeta de cada fuente mostraba
>   `shortenMiddle(sourceExternalId(primary), 38)` — 38 caracteres de
>   `asset_uid` que no dicen nada y no llevan a ninguna parte. Ahora la fila
>   principal es **Abrir**, con el enlace real vía `enlaceDeFuente`; cuando no
>   hay dirección construible se explica por qué en vez de ofrecer un enlace
>   roto, y el identificador baja a detalle técnico.
> - **R1**: `Spreadsheet` → `Pestaña`, `Encuesta / asset` → `Servicio`,
>   `Lectura` → `Se lee`, `Fuente` → `Nombre` (con `nombreDeFuente`).
> - Los encabezados dejan de rotularse por proveedor: `eyebrow: "Kobo"` →
>   `"Encuestas"`, `"Base y barrido"` → `"Universo y barrido"`, `"Paquete"` →
>   `"Fuentes activas"`, y los títulos pasan a nombrar la pregunta («A quién
>   llamar y qué pasó en cada llamada», «Qué respuesta cuenta como efectiva»).
> - **R3**: fuera los `detail` que empezaban con «Aquí se…».
> - `"Falta Kobo"` → `"Falta la encuesta"` en los dos sitios donde aparecía.
>
> **Sin verificación visual.** No hay proyecto de referencia con
> `family === "telefonico"`, y este panel solo se monta con `isPhoneSourceModel`,
> así que en `acrconta` es inerte y no hay nada que mirar en pantalla. La
> evidencia es un contrato de código que corre sobre **las dos copias** con
> `it.each`, comprobado por mutación: al revertir `<em>Abrir</em>` y
> `eyebrow: "Encuestas"` caen dos casos. Queda pendiente pasarlo por un estudio
> telefónico real.

> **Telefónico hereda el patrón.** El perfil es un fork deliberado, así que las
> mejoras se aplican dos veces. Para que la segunda copia no divergiera en
> silencio, la lógica pura se movió a `core/` —`motivoDeNoCruce`,
> `balanceDeCruce`, `crucesDeCasos`— y la ruta a
> `components/RutaDeSubsanacion`, con nombres ya sin el prefijo
> `acreditacion*`. Eso comparte el dominio sin fusionar la UI, que es lo que se
> decidió mantener separado.
>
> En Telefónico se aplicó todo salvo un matiz: el balance de cruce solo entra en
> el modo que **no** tiene resumen propio; el modo teléfono ya trae su
> alineación barrido↔Kobo y no se sustituye. El `colSpan` del encabezado de
> grupo es 4 u 5 según el modo, porque en teléfono la tabla no lleva Evidencia.
>
> No hay proyecto de referencia con `family === "telefonico"`, así que esta vista
> no se puede abrir en la app con los fixtures actuales. La verificación es un
> contrato de código (`TelefonicoSubsanacionGuia.test.ts`), comprobado por
> mutación: al revertir el `colSpan` por modo y el conteo sobre casos visibles,
> dos casos se ponen en rojo.

> **C3 — qué costaría.** Hoy las columnas se resuelven con
> `.monitoreo_report_col`, que prueba listas de alias fijas: primero coincidencia
> exacta normalizada y luego substring. Funciona mientras la hoja use un nombre
> previsto; cuando no, no hay forma de corregirlo desde la app. Un mapeo
> declarado por el usuario necesita tres cosas a la vez: un campo nuevo
> persistido en la config —y por tanto en la whitelist de
> `.monitoreo_operational_model()`, o se descarta en silencio al guardar—, que
> `.monitoreo_report_col` consulte ese mapeo antes que sus alias, y una
> superficie para declararlo contra las columnas reales de la hoja.

> **C1 — por qué no se puede declarar la variable de interés.** Medido sobre
> `acrconta`: el panel de Teléfono ofrece solo **Actor, Carrera y Segmento**, y
> "Actor" tiene **una sola categoría** (Egresados), así que no estratifica nada.
> No hay año de egreso ni sexo, y no es un problema de la lista de opciones:
>
> 1. `AcreditacionPhoneQuotaEditor` —el único sitio que escribe `control_vars`—
>    se monta bajo `isPhoneModel`, que exige `family === "telefonico"`. En
>    Acreditación **nunca se renderiza**: comprobado en la app, no hay ningún
>    nodo con clase `quota-editor` en Modelo.
> 2. `/api/monitoreo/state` en Acreditación devuelve `variables: []` y
>    `control_vars: []`. Aunque se montara el editor, no habría nada que
>    ofrecer.
>
> Las tres variables que sí aparecen vienen del reporte
> (`.monitoreo_report_phone_quota_vars`), que las deriva de `cfg$control_vars` o
> de los **filtros de las metas**. Ese es hoy el único camino, y por ahí apunta
> ahora el vacío del panel.
>
> Para cerrarlo de verdad hacen falta dos cosas del motor: que el estado de
> Acreditación exponga las variables disponibles de la base de público objetivo,
> y que el reporte acepte cuotas cruzadas si se quiere "año de egreso **y**
> sexo" a la vez (hoy cada fila del reporte lleva una sola `Variable`).
> Mismo patrón que A4: no es cablear, es infraestructura que no existe.

> **C4b — Cruces definitivos.** Aquí no faltaba razón por caso: cada fila ya
> traía título, detalle, evidencia y acción. Faltaba **balance y jerarquía**. La
> cabecera decía solo el total (`1,277 casos explicados`) y las 160 filas iban
> planas. Ahora la lectura es contable —`212 de 488 cruzaron; 276 no. 247 son
> recuperables`— y la tabla se agrupa con la misma escala que Subsanación, en
> una sola tabla para que las columnas sigan alineadas entre grupos.
>
> Trampa encontrada al verificar: con un tope **global** de 160 filas, los 247
> recuperables se lo comían entero y los otros tres grupos quedaban
> inalcanzables — un C4 introducido por la propia agrupación. El límite es por
> grupo, y cada cabecera declara su total real para que el recorte se vea.
| ~~C4~~ | Consultas · Subsanación | **Implementado** (Cruces definitivos, pendiente). Ver el diagnóstico y la regla de recuperabilidad abajo |

> **C4 — el diagnóstico medido.** No faltaba guía: **sobraba**. Había dos rutas
> de tres pasos compitiendo en la misma pantalla —«Prioriza / Comprueba /
> Decide» sobre la lista y «Revisar persona / Leer nota / Mantener
> trazabilidad» sobre el caso— y ninguna era clicable, así que ninguna mandaba.
> Los tres pasos de la lista además se recortaban (`269 acciona…`, `llave y
> auxili…`): `repeat(3, minmax(0,1fr))` con texto real dentro del panel
> izquierdo. Y las 276 filas mostraban **la misma frase** —la regla que las
> agrupa, no lo que le pasa a cada una—, de modo que no había forma de elegir
> cuál trabajar.
>
> Reparación: la ruta de la lista se queda y **filtra de verdad**; la de la
> ficha pasa a viñetas para que acompañe sin competir. Los pasos se apilan en
> filas, que es lo que elimina el recorte. Cada fila dice su motivo concreto
> (`AcreditacionMotivoDeNoCruce.ts`) y su segunda línea lleva fecha y
> recopilador —por dónde entró—, porque cuando 247 casos comparten motivo lo
> que distingue es dónde ir a buscar a la persona.

> **Regla de dominio: no todo no cruce pesa igual.** Un caso **completo** que no
> cruza es *recuperable*, y por eso va primero: se rescata y suma una efectiva.
> Un rechazo o una parcial temprana no. Y el canal decide cuándo la ausencia de
> llave es siquiera un defecto: por **teléfono, WhatsApp y QR** el código es una
> pregunta *dentro* del cuestionario (`telefono_enlace_y_codigo_final`,
> `pregunta_pucp_whatsapp`, `pregunta_pucp_qr`), así que quien cortó antes nunca
> la vio —ausencia *esperable*—; por **correo** la llave viaja en la metadata del
> envío (`correo_envio`), de modo que su ausencia sí señala captura rota
> —*revisable*—. De ahí los tres grupos de la bandeja: Recuperables, Por
> revisar, Explicados por el canal.

> **Deuda encontrada de paso.** `MonitoringProfilesReadinessContract` resuelve
> identificadores de forma transitiva y cada nombre dispara un recorrido del AST
> completo: sobre los page-files de perfil cuesta ~3.5 s (Acreditación) y ~3.6 s
> (Telefónico, que no se tocó) contra un presupuesto de 5 s. Pasaba aislado y se
> caía en la suite completa por contención. Se le dio un límite acorde a lo que
> hace; el arreglo de fondo es que el page-file deje de ser un monolito.

> **A4 depende de C2, y por eso va después.** El apilado por día necesita un
> color por estado, y C2 es donde el usuario los define. Construirlo antes
> obligaría a inventar una paleta fija y a rehacerla al llegar el definidor.
> El orden correcto es: primero el definidor —estados confirmados **con su
> color**—, y el gráfico después, leyendo de ahí.
>
> Corolario que vale desde ya: **ningún estado telefónico se pinta con un color
> escrito a mano en una vista**. Sale de una única función que hoy puede tener
> defaults y mañana lee lo que el usuario declaró. Hoy los colores viven
> repartidos como literales (`#168a55`, `#5e7fa5`, `#a61d4f` en el `style` de la
> tira de estados), que es exactamente lo que impide cambiarlos en un sitio.

> **Abrir `acrconta` cuesta mucho más de lo documentado.** Medido el
> 2026-07-28 en cuatro aperturas seguidas: la barra se detiene largos ratos en
> «Preparando avance y cuotas» (91 %) y en «Preparando Monitoreo».
>
> Cuidado con el diagnóstico fácil: una muestra puntual dio **0,3 % de CPU** y
> pareció un cuelgue, pero cuatro minutos después el mismo proceso estaba al
> **94,2 %** y el proyecto acabó abriendo. **Alterna entre ráfagas de cálculo y
> pausas largas**, así que una sola medición de CPU no distingue «detenido» de
> «entre ráfagas» — hacen falta dos separadas antes de afirmar nada.
>
> Es lo que impidió verificar en pantalla el definidor de estados. Merece
> diagnóstico propio antes de seguir puliendo Teléfono: sin poder abrir el
> proyecto de referencia en un tiempo razonable no hay QA visual posible. El
> dato de partida, ya conocido, es que estos proyectos son read-only (`0444`) y
> sus caches de warm start nunca se escriben de vuelta.

> **Hallazgo no reportado, visible en las capturas.** El embudo de Teléfono dice
> `1,277 snapshot → 0 procesables → 534 efectivas` con `−1,277 registros fuera
> del universo`, mientras Modelo dice `1,277 → 519 procesables → 418 efectivas`.
> Dos secciones del mismo corte con denominadores distintos, y una de ellas
> declara **cero procesables junto a 534 efectivas**, que no puede ser. Tiene la
> firma de C1 en Fuentes. Se diagnostica aparte, antes de tocar nada de
> Teléfono: rediseñar sobre un número que miente es trabajo perdido.

**Resuelto el 2026-07-29**, al cerrar Acreditación:

- En el paso 3 del panel el actor ya es corregible sin volver al paso 1, y si el
  nombre de la fuente menciona a otro actor del estudio se avisa antes de
  guardar (`actorQueContradiceElNombre`, con test). Era un error silencioso: no
  fallaba nada y el corte repartía las respuestas al actor equivocado hasta que
  alguien revisaba denominadores.
- La cabecera de Encuestas dice «N encuestas conectadas» y el proveedor pasa al
  `title` (R1). Aplicado en Acreditación y en Telefónico.
- El embudo de Teléfono ya no puede decir `0 procesables → 534 efectivas`: el
  oficial es subconjunto del procesable, así que esa combinación declara el
  procesable indeterminado en vez de pintarlo (`corteContract.ts`, con test).

**Pendiente**, en este orden:

1. `AcreditacionSurveySourcePicker` quedó sin montar tras retirar su `details`.
   Se retira cuando se confirme en producción que el catálogo del panel lo
   cubre; el de Kobo sigue vivo porque lo usa el contrato telefónico.
2. Territorial (§4.2).
5. La divergencia `1.693` vs `1.697` de Territorial (T3), como diagnóstico
   aparte.
6. La línea base de `api/R/reporte_plan_ppt.R` en `agentic/manifest.json` quedó
   desfasada (+8) por un commit anterior; la auditoría lo reporta y no es de
   este trabajo.

## Telefónico y el panel de conexión — 2026-07-29

Reportado por el usuario sobre `acnur_pdm`: las tres pestañas de Fuentes «no
están bien diferenciadas conceptualmente», y el panel de conectar «se ve muy
genérico».

**Las tres pestañas mostraban lo mismo, y la causa era estructural.** Se
llamaban por su pregunta pero renderizaban un solo componente con un `focus`
que sólo gobernaba las tarjetas: los dos bloques de configuración se montaban
en las tres —«Encuestas» ofrecía configurar hojas de cálculo—, y «Fuentes
activas» era la unión literal de las otras dos. El reparto pasó a
`profiles/telefonico/fuentes/repartoDePestanas.ts`, con test: cada decisión
aparece en una pestaña y sólo en una.

| Pestaña | Qué responde | Qué tiene |
|---|---|---|
| **Fuentes activas** (1.ª) | De dónde salen los números | La cadena + la lista de lo conectado + la puerta para conectar. Ningún editor |
| **Universo y barrido** | A quién llamar y qué pasó | Las dos tarjetas de hoja y su editor. Nada de Kobo |
| **Encuestas** | Qué cuenta como efectiva | El formulario y el filtro de efectiva. Nada de hojas |

El resumen pasa a primero y es donde se aterriza: es la única que se lee sin
decidir nada.

**La cadena** (`fuentes/CadenaDeFuentes.tsx`) sustituye a tres piezas que decían
lo mismo —una tira de estados, un párrafo con el reparto y una lista de pasos
pendientes—. Tres eslabones unidos por un conector que se apaga donde la cadena
se corta; la dependencia es el dibujo, no una frase.

**El panel de conexión no sabía en qué modo estaba.** Preguntaba el servicio
—Google Sheets / Kobo / SurveyMonkey— igual para todos: en un estudio telefónico
ofrecía SurveyMonkey con el mismo peso que las otras dos y preseleccionaba
«Universo» cuando lo que ordena el estudio es el barrido. Ahora manda el guion de
la familia (`fuentes/guionDeConexion.ts`):

- **Telefónico**: barrido → universo → encuesta. El servicio no se pregunta
  —una hoja de barrido es una hoja de cálculo— y ese paso desaparece del flujo.
- **Acreditación**: parte de los instrumentos, dice qué actores ya tienen el
  suyo, y sumar otro es el caso normal, no el final del flujo.
- Al conectar, el panel **no se cierra si queda algo**: avanza a la pieza
  siguiente, y en una pieza por actor a la siguiente **de ese mismo actor**.
- Sideover a alto completo, dos columnas —guion y trabajo— con el acento de
  Monitoreo declarado en el propio panel (va en portal al `body`).

> **`cubiertaPor` no es un atajo, es dominio.** Muchos estudios telefónicos
> llevan universo y barrido en la misma hoja: cada fila es una persona a llamar
> con su estado al lado. El motor ya lo resolvía así, y sin declararlo el guion
> pedía conectar un padrón que el estudio ya tenía, contradiciendo a la pantalla
> de al lado que lo daba por completo.

Duplicaciones retiradas, todas medidas en pantalla: la franja de fuentes decía
`Fuentes 3/3 · Base 1 · Kobo 1` bajo otra que decía `Fuentes 3/3 · Base 2.726 ·
Corte Listo` —«Base» con dos significados a 20 px—; el antetítulo del panel
repetía el nombre de la pestaña activa; «Último sync» salía tres veces; y
«Fuentes configuradas» declaraba `3/3 operativas` sobre una lista con una fuente
marcada INACTIVA, porque contaba piezas del contrato bajo una cabecera que
contaba fuentes.

`LlenadoDeFuentes` se retiró: la cadena lo absorbe. `AcreditacionPhoneSheetsDecision`
también —repetía universo, barrido y sync de las tarjetas de arriba; lo único
suyo, que los estados del barrido no son las efectivas de Kobo, pasó al detalle
del encabezado—. `TelefonicoMonitoreoPage.tsx` queda 58 líneas por debajo de su
línea base.

**Verificado** en `acnur_pdm` a 1440×1000 y 1024×600: typecheck limpio, 2.426
vitest, auditoría del agentic OS sin ERROR. **Acreditación no se verificó en
pantalla** —su guion está cubierto por test pero abrir `acrconta` cuesta ~3,5 min
por recarga—.

> **Trampa operativa medida:** abrir `acrconta` cuesta ~3,5 min de warm start, y
> se paga **en cada recarga** del navegador. Los proyectos de referencia son
> read-only a propósito (`0444`), así que los caches del warm start no se
> escriben de vuelta y nunca hay arranque caliente. Para iterar sobre la UI,
> navegar con `window.__pulsoNav.ir(...)` en vez de recargar; una edición de un
> archivo `.tsx` que fuerce full reload vuelve a pagar los 3,5 min.

---

## 0. Tesis

Fuentes es el punto de partida de todo monitoreo: si no se entiende de dónde
vienen los números, ninguna pestaña posterior es creíble. Hoy la sección está
escrita para quien construyó la integración, no para quien dirige el estudio.

El problema no es de estética. Es que la sección **está organizada por servicio
externo** (SurveyMonkey, Google Sheets, recopiladores) cuando el usuario llega
con **preguntas de estudio**: de dónde salen mis datos, qué le falta a esto para
estar completo, y qué tengo que decidir yo.

---

## 1. Evidencia del ANTES

Medido en la app el 2026-07-28, viewport `1440x1000`, contra los proyectos de
referencia del ADR 0043 (`acrconta` para Acreditación, `acnur_acg` para
Territorial). No se leyó CSS para producir estos hallazgos: se leyó la pantalla.

### 1.1 Acreditación (`acrconta` — 13 fuentes, 4 actores, 1.277 registros)

| # | Hallazgo | Evidencia literal |
|---|---|---|
| A1 | Las pestañas nombran el servicio, no la pregunta | `Encuestas en plataforma · SurveyMonkey/Kobo`, `Bases en Sheets`, `Recopiladores`, `Fuentes activas` |
| A2 | La pestaña que responde «¿de dónde salen mis números?» es la última | `Fuentes activas` es la 4.ª de 4 y es la más legible de todas |
| A3 | El identificador desplaza al enlace en Sheets | Campo `SPREADSHEET` con `1UMlN7xVAzQOrglhMkVNSj2KQ2RgJntOh2mNbDQm5mbQ` pelado; sin nombre del documento ni forma de abrirlo |
| A4 | El identificador desplaza al nombre en encuestas | Cada tarjeta lleva `527327742` de subtítulo permanente y la encuesta no es alcanzable desde la app |
| A5 | Jerga de implementación en títulos de superficie | `DECLARACIÓN ACTOR-CANAL`, `CANAL BASE`, `20 heredan · 0 excepciones`, `Base Ficha QR`, `Sin alias operativo`, `Metadata real lista`, `Snapshot local listo`, `Catálogo cerrado por defecto` |
| A6 | La misma etiqueta con dos cifras a 20 px | Franja de sección `BASE 1,277`; franja siguiente `BASE 4` |
| A7 | El mismo dato repetido tres veces | `13/13` en la barra de módulo (`ACTIVAS`), en la franja de sección (`FUENTES`) y en la franja de contadores (`FUENTES`) |
| A8 | Una pestaña concentra todas las decisiones repetidas | `Recopiladores`: 20+ filas × (4 métricas + incluir/excluir + alias + clasificación + canal) |
| A9 | Texto operativo recortado | `Cuenta en este ca…` en cada fila de recopilador |
| A10 | Vacío exterior sin dueño | `Bases en Sheets` deja ~45 % del alto vacío bajo la tarjeta del actor seleccionado |

### 1.2 Territorial (`acnur_acg`)

| # | Hallazgo | Evidencia literal |
|---|---|---|
| T1 | El selector de fase se pinta dos veces seguidas, con dos tratamientos | `FORMATO TERRITORIAL: Piloto / Campo`, y debajo `Piloto · FORMULARIO PILOTO` / `Campo · FORMULARIO DE CAMPO` |
| T2 | El nombre de la encuesta se repite 5 veces, 2 de ellas cortado a mitad de palabra | `Encuesta de Percep...cogida - Perú 2026` |
| T3 | Dos cifras bajo la misma palabra en la misma pantalla | franja `1,697 RECIBIDAS` vs KPI `RESPUESTAS RECIBIDAS 1,693` vs cabecera `1,693 en el snapshot` |
| T4 | Dos conceptos distintos con palabras que se leen como sinónimas | cabecera `1,283 efectivas` vs `1,404 PASAN FILTRO` |
| T5 | Vocabulario de implementación sin traducir | `snapshot`, `CHOICES 61`, `DESPLIEGUE Activo` |
| T6 | Etiquetas recortadas en la tira de Hoja de Ruta | `0 sin primera e…`, `0 UMP sospech…` |
| T7 | Un input sin procedencia | `SPREADSHEET` vacío, sin decir de dónde se saca esa URL |
| T8 | Tres decisiones sin relación en un solo scroll | fase + formulario Kobo, conexión de Hoja de Ruta, e inspección/sincronización, todas en la pestaña `Formulario` |

### 1.3 Telefónico

`TelefonicoMonitoreoPage.tsx` declara su propio `ACREDITACION_SOURCE_TABS`
idéntico al de Acreditación y renderiza las mismas vistas con `phoneMode`.
Hereda A1–A10 sin excepción. Por eso Acreditación va primero: lo que se aprenda
ahí se traslada casi sin traducir.

> **T3 no es cosmético.** `1.693` vs `1.697` bajo la palabra «recibidas» tiene la
> firma del patrón de fallbacks `||` que ya cambió denominadores bajo la misma
> etiqueta en acreditación. Se diagnostica aparte; este plan no lo repara ni lo
> disimula.

---

## 2. Las cuatro reglas

Valen para los tres modos y son auditables una por una.

### R1 — El nombre humano manda; el identificador es metadato

El título de una fuente es el nombre del documento o de la encuesta. El
identificador (`survey_id`, `asset_uid`, `spreadsheet_id`, `source_id`) **nunca
es subtítulo**: vive en un renglón «Detalle técnico» plegado, o como `title` del
enlace que ya lo lleva.

*Se audita:* ningún identificador opaco aparece en un `strong`, un `h*` ni en el
subtítulo directo de un título.

### R2 — Todo identificador con URL se muestra como enlace

`survey_id` → la encuesta en SurveyMonkey. `asset_uid` + `base_url` → el
formulario en Kobo. `sheet_binding.spreadsheet_id` → el Google Sheet. Cuando no
se puede armar el enlace, la superficie dice **qué falta para tenerlo**, no que
falta.

El tono ya existe en el repo y no se inventa otro —
`captureUrlMessage()` en `lib/captureUrl.ts`:

> «Abre el proyecto en Kobo, copia el enlace del formulario web y pégalo aquí.»

*Se audita:* toda fuente con los datos necesarios expone un `a[href]`; ninguna
muestra un identificador sin enlace ni explicación.

### R3 — Un dato, un lugar, con su denominador

Un mismo número no se pinta dos veces en la misma pantalla. Si dos cifras
parecidas tienen grano distinto, el rótulo lo dice (`recibidas en el corte` vs
`recibidas de esta fase`), y si no se puede distinguir, se muestra una sola.

*Se audita:* ninguna etiqueta se repite con dos valores; ningún valor se repite
en tres superficies de la misma vista.

### R4 — Guiar es nombrar el siguiente paso concreto

«Falta la pestaña de barrido» es guía. «Las fuentes son el punto de partida del
monitoreo» es relleno, y el Contrato de Superficie lo prohíbe explícitamente
(«copy, explicaciones o texto ornamental para llenar espacio»).

*Se audita:* toda superficie con estado pendiente nombra la acción que lo
resuelve; ninguna superficie completa agrega prosa explicativa.

---

## 3. Vocabulario: qué se traduce y qué no

**Se conserva** el vocabulario del estudio, porque el metodólogo lo usa y
traducirlo lo empobrece: *actor, canal, efectiva, cuota, corte, UMP, Código
Pulso, barrido, universo, recopilador*.

**Se traduce** el vocabulario de implementación:

| Antes | Después |
|---|---|
| `snapshot` / `Snapshot local listo` | copia local · *fecha de la última actualización* |
| `choices` | opciones |
| `DECLARACIÓN ACTOR-CANAL` | Quién responde cada encuesta |
| `CANAL BASE` | Canal por defecto |
| `20 heredan · 0 excepciones` | 20 recopiladores usan este canal · ninguno con excepción |
| `Base Ficha QR` | Canal por defecto: Ficha QR |
| `Sin alias operativo` | Sin nombre propio *(usa el de la plataforma)* |
| `Metadata real lista` | *fecha de la última lectura de la plataforma* |
| `Catálogo cerrado por defecto` | *(se elimina: describe una decisión de implementación)* |
| `SPREADSHEET` | Enlace del Google Sheet |
| `Source ID` / `Asset Kobo` | *(bajan a «Detalle técnico»)* |

Regla de crecimiento: una traducción nueva se agrega al vocabulario compartido,
no se escribe suelta en la vista.

---

## 4. Estructura de pestañas

No se agregan pestañas por agregar. Se corta por **pregunta**, y las decisiones
que se condicionan entre sí quedan juntas.

### 4.1 Acreditación — de 4 a 3

| Hoy | Mañana | Por qué |
|---|---|---|
| `activas` — Fuentes activas | **1 · Resumen** | Responde «¿de dónde salen mis números?». Sube a primera y pierde toda decisión: es lectura |
| `sheets` — Bases en Sheets | **2 · Universo** | La base por actor: qué documento, qué pestaña, qué rango |
| `survey` — Encuestas en plataforma | **3 · Encuestas y recopiladores** | Se unen |
| `collectors` — Recopiladores | ↑ | Porque el recopilador **hereda el canal de su encuesta** (`20 heredan · 0 excepciones`): hoy la regla se declara en una pestaña y la excepción se decide en otra |

La pestaña 3 es master/detail: la encuesta arriba con su declaración de actor y
canal, y sus recopiladores debajo con un filtro por defecto en **«por
clasificar»** — así A8 deja de poner 20 decisiones abiertas cuando solo 2
requieren atención.

Compatibilidad de direcciones (ADR 0044): las claves `activas`, `sheets`,
`survey` y `collectors` se siguen **leyendo** como alias y nunca se **escriben**.
Las claves canónicas nuevas son `resumen`, `universo`, `encuestas`.

### 4.2 Territorial — de 5 a 6 (pendiente, tras Acreditación)

`Formulario` mete tres decisiones sin relación en un scroll (T8). Se parte en
`Formulario` (fase + Kobo + inspección) y `Hoja de ruta` (la Google Sheet), y el
selector de fase se pinta **una** vez (T1).

### 4.3 Conectar una fuente — el flujo, no solo su lectura (pendiente)

Medido el 2026-07-28 en `acrconta`. Conectar una fuente hoy no es un flujo: son
tres formularios distintos repartidos por pestaña, sin punto de entrada común.

| # | Hallazgo | Evidencia |
|---|---|---|
| N1 | No existe una sola puerta «conectar fuente» | `+ Agregar SurveyMonkey` en una pestaña, `Seleccionar encuesta Kobo` en la misma, y un campo `SPREADSHEET` suelto en otra |
| N2 | Se pide pegar un identificador sin decir de dónde sale | el input muestra `1UMlN7xVAzQOrglhMkVNSj2KQ2RgJntOh2mNbDQm5mbQ` y no ofrece pegar la URL del documento |
| N3 | Dos botones sin orden ni resultado visible | `Leer pestañas` y `Confirmar base`, sin decir cuál va primero ni qué quedó leído |
| N4 | Texto libre donde debería haber una lista | `PESTAÑA DEL ACTOR` es un input aunque `Leer pestañas` ya trae los nombres reales |
| N5 | Sin estado de progreso ni confirmación de lectura | no se ve «probando», ni cuántas filas ni qué columnas entraron |
| N6 | Vacío exterior sin dueño | ~45 % del alto queda en blanco bajo el formulario (es A10 visto desde el flujo) |

> **N7 — un identificador mal pegado tumbaba el backend entero.** Al probar el
> paso 3 con el enlace de un spreadsheet inexistente,
> `/api/monitoreo/sheets/inspect` quedó esperando a Google sin límite. Plumber
> atiende en un solo hilo, así que con esa petición murieron también
> `/api/system/health` y la apertura del módulo, que pasó a responder
> `HTTP_500`. Causa: `.monitoreo_google_api_once()` armaba su handle con
> `curl::new_handle()` sin `timeout` ni `connecttimeout`. Reparado en
> `api/R/monitoreo_google_http.R`, con regresión en
> `test-monitoreo-google-http.R`.

Dirección: **una sola puerta, tres pasos siempre iguales, resultado verificado
antes de guardar.** Elegir servicio → pegar la dirección (URL, no ID) y que la
app la valide mientras se escribe, con el diagnóstico concreto que ya escribe
`captureUrlMessage()` → elegir hoja/encuesta de una lista real y confirmar
contra una previsualización que diga qué se leyó. El paso 3 es el que hoy no
existe y es el que convierte «guardé algo» en «sé qué guardé».

### 4.4 Telefónico — igual que Acreditación (en curso)

Se decide al llegar si reusa los componentes extraídos o los forka. **No se
fusiona el perfil**: el fork telefónico se mantiene por decisión previa; lo que
se comparte es infraestructura genérica, no el modelo de dominio.

**Hecho el 2026-07-29**: las pestañas de Fuentes pasan a nombrarse por pregunta
—«Universo · La base de cada actor», «Encuestas · Quién responde y qué cuenta»—
en vez de por proveedor («Bases en Sheets», «SurveyMonkey/Kobo»), y el embudo
deja de decir «registros del snapshot». Los colores de los cinco desenlaces
salen de `coloresDeResultado.ts`.

> **Dónde viven las fuentes de telefónico** —y una lección de método—. Al
> inspeccionar `ACNUR_PDM.pulso` (family `telefonico`, 2.726 registros, metas por
> 5 sedes) se leyó `monitoreo_config$sources`, que está **vacío**, y se concluyó
> que el perfil no conecta fuentes. **Es falso**: la app muestra 3 fuentes, con
> una hoja `Barrido!A1:Y2297` de 2.726 filas sincronizada el 2/07. Viven en
> `state$monitoreo_sources`, hermana de la config y no dentro de ella.
>
> Así que §4.4 sí aplica: telefónico conecta fuentes como acreditación. La
> lección es de método —mirar una clave y generalizar del vacío a «no existe»— y
> la comprobación que lo desmintió costó abrir la app, no leer más código.
>
> El perfil además se configura por columnas (`enumerator_var`, `status_var`,
> `contact_var`, `date_var`, `duration_var`), que es lo que no tiene acreditación.
>
> Sus estados vienen declarados, con el vocabulario del cliente:
> `complete ← completed, complete, valid` · `pending ← no_barrido,
> contactar_despues, contactado_whatsapp` · `refusal ← rejected, rechazo,
> refusal` · `non_effective ← no_contesta, apagado, colgo_corto` ·
> `excluded ← not_eligible, no_elegible`.

**Pendiente de §2 (no sobreexplicar), diagnosticado y sin aplicar** porque
`TelefonicoMonitoreoPage.tsx` está siendo partido en módulos por otro frente y
editarlo ahora sería pisarlo:

1. `Kobo aporta efectivas; el barrido conserva estados telefónicos en paralelo.`
   (cabecera de Modelo telefónico) y `Kobo aporta efectivas; el barrido aporta
   estado de llamada.` (cabecera de Cuotas): **el mismo hecho con dos
   redacciones distintas en dos superficies**, y en ninguna de las dos habla de
   lo que esa superficie mide —ambas son de metas, no de fuentes—. Además es
   redundante con el propio etiquetado: cada cifra ya se llama «Efectivas Kobo»
   o «barridos». Se retira de las dos cabeceras; en Cuotas se conserva el dato
   que la acompaña (`N categorías`).
2. `Una entrevista muy corta puede indicar que se saltaron preguntas. No cambia
   el estado de la llamada.` La primera frase es interpretación sobre un título
   que ya dice qué mide; **la segunda no se toca**, porque previene un
   malentendido con consecuencias (creer que una entrevista corta invalida la
   llamada). Queda solo la salvedad.

Lo que **no** se cambia, revisado uno por uno: los `small` que llevan cifra o
estado concreto, y los vacíos que nombran la acción que los resuelve —esos
cumplen C3 y R4, no son relleno—.

> **Medido en pantalla el 2026-07-29** sobre `ACNUR_PDM.pulso`, sección Fuentes ›
> Universo y barrido. Todo lo que sigue vive en el page-file y espera a que
> termine su partición en módulos:
>
> - **El título se dice tres veces seguidas**: eyebrow «Universo y barrido»,
>   título «A quién llamar y qué pasó en cada llamada», subtítulo «Universo y
>   barrido» otra vez.
> - **Tres párrafos explican el mismo reparto** en la misma pantalla: «La base de
>   universo fija la población; la hoja de barrido registra responsable, intentos,
>   estado y fecha», «La hoja activa también define casos, cuotas y población
>   objetivo» (ya corregido: vive en `TelefonicoSourcesModel`) y «La base define a
>   quién llamar; el barrido conserva responsables, intentos, estados y fechas.
>   Kobo queda separado como validación de efectivas».
> - **§3, un dato un lugar**: `FUENTES 3/3` aparece dos veces; el volumen tres
>   —«2.726 en el snapshot», «BASE 2.726», «UNIVERSO 2.726»—; y `ÚLTIMO SYNC
>   2/07/26 8:51 p. m.` tres veces en la misma vista.
> - Las tarjetas «Base telefónica / universo» y «Barrido telefónico» muestran
>   **valores idénticos** (misma hoja, mismo rango, mismo sync) porque en este
>   estudio una sola hoja cubre las dos cosas. Con la duplicación de arriba, la
>   pantalla repite el mismo dato hasta seis veces.
> - Queda «2.726 en el snapshot» (`TelefonicoMonitoreoPage`). El mismo rótulo en
>   el panel de Salidas ya pasó a «recibidas», con su contrato semántico
>   actualizado: lo que ese test defiende es que el conteo crudo no se confunda
>   con las válidas, no la palabra.

---

## 5. Contrato de geometría y capacidad

Paleta: `--pulso-module-monitoring` vía `--module-accent`. Nada de hex.
`PageFrame`: `workbench`. Radios, alturas de control y pesos salen de los tokens
`--pulso-*` de `theme.css` (radio de tarjeta 14, panel 16, chip 999; control
28/36; seis pesos y nada entre medio).

| Grupo | Contrato | Ejes gobernados | Cardinalidades a probar | Dueño del overflow |
|---|---|---|---|---|
| Tarjeta de papel (Resumen: Universo / Respuestas / Barrido) | `equal` | alto y ancho, tol. 2 px | 0 / 1 / 8 fuentes por papel | lista interna de la tarjeta |
| Tarjeta de actor (Universo) | `equal` | alto y ancho, tol. 2 px | 0 / 1 / 4 / 12 actores | lista interna de la tarjeta |
| Tarjeta de encuesta (Encuestas) | `equal` | alto y ancho, tol. 2 px | 0 / 1 / 7 / 30 encuestas | lista de recopiladores de la tarjeta |
| Fila de recopilador | `equal` | alto, tol. 2 px | 0 / 1 / 20 / 200 | lista de la tarjeta padre |
| Tira de contadores de sección | `equal` | alto, tol. 2 px | siempre 3 | — |
| Bloques de la vista (Resumen, Universo…) | `intrinsic` | — | — | `.pulso-main` |

Reglas que se derivan:

- **C1**: todo grupo par declara `data-qa-geometry-group` y su contrato
  `equal`/`intrinsic` **al construir**, no en el QA.
  > Lección de la primera vuelta: las tres tarjetas de papel se declararon
  > `intrinsic` razonando que eran «secciones independientes», y en `acrconta`
  > Barrido —una sola fuente— quedó como un muñón de 90 px junto a dos tarjetas
  > de 285. Tres hermanas del mismo rol son un grupo par: el contrato es `equal`
  > y el vacío de la que tiene menos es capacidad interior legítima. La duda
  > entre `intrinsic` y `equal` se resuelve mirándolo con datos reales, no
  > razonando sobre la semántica.
- **C2**: el marco no crece con `items.length`; una tarjeta de actor sin fuentes
  conserva la caja de su variante y resuelve el vacío **dentro**.
- **C3**: A10 se repara entregándole el alto disponible a la lista, no
  estirando la tarjeta.
- **C4**: un solo dueño de scroll por pantalla; cero recorte de texto operativo
  (A9, T6). Elipsis en etiqueta larga sí; en dato operativo no.
- **C5**: toda superficie vacía se clasifica antes de tocarla — vacío legítimo,
  vacío por fixture, o vacío por desconexión. Solo la tercera autoriza añadir.

---

## 6. Dónde vive el código

`AcreditacionMonitoreoPage.tsx` (19.691 líneas), `TelefonicoMonitoreoPage.tsx`,
`monitoreo.css` (38.160) y `profilePage.css` (20.167) están **congelados a
crecimiento** (`agentic/manifest.json`). Por eso el rediseño es también una
extracción, y eso es deliberado:

```
frontend/src/features/monitoreo/fuentes/          ← infraestructura compartida
  enlacesDeFuente.ts        R2: nombre humano + URL de cualquier MonitoreoSource
  vocabulario.ts            §3: el glosario, en un solo lugar
frontend/src/features/monitoreo/profiles/acreditacion/fuentes/
  pestanas.ts               §4.1: catálogo canónico + alias
  FuentesResumen.tsx
  FuentesUniverso.tsx
  FuentesEncuestas.tsx
  fuentes.css               tokens --pulso-* únicamente
```

La página congelada solo pierde líneas: cambia bloques inline por llamadas a los
componentes nuevos.

---

## 7. Verificación

- `pnpm --dir frontend typecheck` y `pnpm --dir frontend test`.
- `make ui-quick-check` con `--require-geometry` sobre `acrconta`, matriz
  `1440x1000` y `1024x600`, mismo proyecto que en el ANTES.
- Por cada grupo par: marco y región de contenido medidos por separado en
  cardinalidad baja y alta.
- Gate final con el agente `verificador`. Verde por conformidad, no por
  ausencia: un `visualIssues=0` con geometría no declarada no aprueba.
