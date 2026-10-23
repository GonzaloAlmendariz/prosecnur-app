# Revamp de Monitoreo · Cursos-horario — arquitectura y fichas por pestaña

Tipo: Especificación de maqueta (copia durable del lienzo)
Estado: Fichas completas con el esqueleto común (Insumos · Modelo · Control · Avance), pendientes de tu revisión
Fecha: 2026-10-23
Lienzo: https://claude.ai/artifact/DUz7BW49dHvfQX34wrmaPo («Revamp de Monitoreo · Cursos-horario», privado, 28 tableros)
Estándar: `docs/qa/revamp-monitoreo/estandar-de-ficha.md` (v2)
Procedimientos: `docs/qa/revamp-monitoreo/procedimientos-respondidos.md` manda sobre cualquier supuesto de este documento.

Proyectos de referencia (copias de trabajo, nunca los originales):

| Proyecto | Qué es | Corte | Para qué se usa |
|---|---|---|---|
| HSVG 2026, segundo sorteo | PUCP, hostigamiento. 174 titulares, 1,173 reservas encadenadas y 45 del banco; 15 facultades; eje de cuota **facultad**, atribución por aula; muestra 2,500, sobremuestra 1,250, meta operativa 3,750; Kobo EU con 3,610 respuestas; libro con 4 hojas del equipo y 190 partes; 31 aplicadores con disponibilidad | 01/10/26 15:03 (Lima) | Principal: todos los tableros |
| CCSS Perfil 2026 | Facultad de Ciencias Sociales. 50 titulares, 85 reservas y 1 extra; eje de cuota **nivel**, atribución por persona con el padrón DTI (1,354 matriculados); cuota 400 en los niveles 6 a 9; cruce de alumnos por código; hoja de aplicadores conectada (46 citas); traslape declarado con HSVG | 12/10/26 08:53 | Contraste: alterna con HSVG donde el modo cambia |

Cómo se obtuvieron las cifras: el `.pulso` de HSVG trae un tablero en caché recortado (sin agenda, sin brechas), así que se
reconstruyó sin red con `monitoreo_aulas_dashboard()` y `.mac_publicar_disponibilidad()` del motor sobre las copias, con el
plan, el libro, los partes, el control y la disponibilidad de cada `state.rds` (HSVG 14.8 s, CCSS 2.1 s). Las duraciones,
la hora y el día de respuesta se calcularon de `start` y `end` del Kobo. Scripts y datos en el scratchpad de la sesión
(`aulas2/scripts/build_dash.R`, `dur.R`, `data/*_dash.json`). Ninguna llamada a Kobo, Sheets ni publicación.

Datos personales: los docentes no aparecen (se muestran como «Docente 01…» donde la columna existe); los aplicadores se
muestran como «Aplicador 01…» con un orden alfabético estable; los códigos de alumno van enmascarados (`••••42`). Las notas
de campo no se reproducen.

En el lienzo, los tableros que difieren entre proyectos alternan con el botón del proyecto en la barra superior («otro
proyecto»): es un recurso del lienzo, no un control de la app.

---

## 0. Preguntas para Gonzalo

Lo que depende de estas respuestas quedó sin dibujar o como «Por definir» (marcadores numerados en el lienzo). Ninguna
detiene el resto.

| # | Pregunta | Opciones y qué haría con cada una |
|---|---|---|
| P1 | ¿Qué mira primero el equipo de cursos-horario en un día normal? En los otros modos ya respondiste (faltante por público, por UMP, por cuota); aquí no. | (a) La agenda de la semana: el modo aterriza en Control › Agenda. (b) Lo que falta por facultad o nivel: aterriza en Avance › Por facultad, como los demás modos. (c) Los partes por registrar: aterriza en Control › Registro de campo. Hoy aterriza en Fuentes, que en la propuesta es Insumos › Fuentes; con cualquiera de las tres se cambia solo `seccionInicialMonitoreo`. |
| P2 | Hoy «Traer respuestas» lee Kobo, lee el libro, recalcula **y re-publica** las hojas de la app («Base de control», «Plan del día», «Avance de campo», «Avance de agendación» y las condicionales). El estándar §2b dice que Actualizar no escribe hacia afuera. ¿Cómo se mantiene al día «Avance de campo», que el equipo mira en el Sheets? | (a) Publicar a mano desde Avance › Salidas, con «Revisar cambios» antes (es lo dibujado; P1a lo dice en «No publica las hojas de la app»). (b) Actualizar ofrece un paso 4 visible, «Publicar las hojas de la app», con su switch apagado por defecto: el recibo dice qué se escribió. (c) Publicación automática al terminar cada Actualizar, como hoy, pero listada como paso propio en el recibo. |
| P3 | El mismo gesto retira hoy las filas cerradas de las pestañas «Semana N» de la hoja de aplicadores (`distribucion_retiro`), sin confirmar. | (a) Un botón «Retirar las cerradas» en Control › Distribución, con ensayo (dibujado en CCSS). (b) Se deja de hacer: lo ordena el coordinador a mano. (c) Va dentro de Publicar, en Salidas, listado aparte. |
| P4 | Al declarar B (complemento), ¿hay que decir **qué curso-horario completa**? El backend solo exige la letra (`activation_origin`); `activated_for` existe pero no se pide. Marcador 2 en P3. | (a) Obligatorio: «Guardar» se habilita con el curso-horario elegido. (b) Prellenado con su titular y editable (dibujado). (c) No se pide: se quita el campo. |
| P5 | ¿Dónde se registra el parte? Los 190 partes de HSVG llegan de la hoja «Aulas Aplicadas (Campo)», y además la app tiene un formulario (Registro de campo, `POST /aulas/agenda`). | (a) Manda la hoja: Registro de campo queda como lectura del parte y lugar de la declaración B o C, sin formulario. (b) Las dos vías, como hoy (dibujado): el formulario se guarda en el proyecto y se publica en la Base de control. (c) Solo la app: la hoja deja de ser del equipo. |
| P6 | El formulario de hoy tiene «Encuestas aplicadas» (`applied_surveys`) y «Cantidad de encuestas aplicadas» (`effective_surveys`): dos rótulos casi iguales para dos campos. La hoja trae solo el segundo. Marcador 1 en Ctl4 y P3. | (a) Un solo campo «Encuestas aplicadas» que escribe `effective_surveys`; `applied_surveys` se retira (dibujado). (b) Dos campos con nombres distintos: «Encuestas entregadas» y «Encuestas aplicadas». (c) Un solo campo que escribe `applied_surveys`, y `effective_surveys` se calcula. |
| P7 | Cuando una cita cambia de día y ya estaba en la hoja de aplicadores, ¿quién quita la fila del día anterior? La app solo siembra la semana y agrega filas nuevas; lo manual manda. Marcador 3 en P4. | (a) El coordinador, a mano en la hoja; la app solo avisa en Distribución, «Cruce con la agenda». (b) La app, con ensayo, en el mismo botón que agrega lo nuevo. (c) La app la pinta en ámbar sin borrarla. |
| P8 | En 7 reservas de la semana 4 de HSVG (R 140.2, R 140.4, R 153.3, R 159.3, R 171.1, R 171.2 y otras) la agenda dice «pendiente» y el parte ya existe. ¿Qué manda para dar por aplicado un curso-horario? | (a) El parte (dibujado: Agenda, Registro y el inspector leen la existencia del parte). (b) La columna de la agenda: esos casos se ven pendientes hasta que el agendador la corrija. (c) Los dos, y la discrepancia entra a Calidad como señal. |
| P9 | ¿Qué cuenta la insignia de Control en la barra de secciones? | (a) Titulares por resolver (dibujado: 8 en HSVG, 0 en CCSS). (b) Titulares por resolver más partes que no cuadran (8 + 97). (c) Sin insignia en Control. |
| P10 | `AulasPronosticoDeCierre` quedó sin pantalla (checklist del 10/09, ítem 45). | (a) Se retira con sus tests. (b) Su lectura vive en Avance › Por facultad, columna «Al cierre», que ya usa `proyeccion` del motor (dibujado). (c) Panel propio en Avance › Resumen. |

---

## 1. Arquitectura: hoy → propuesta

Hoy son 5 secciones, 20 pestañas y una hoja sin pestañas (catálogo `frontend/src/lib/navegacion/catalogos/monitoreo.ts`,
bloque `aulas`; secciones en `features/monitoreo/core/monitoreoRegistry.ts:180`): Fuentes (hoja) · Agenda 4 ·
Validación 5 · Consultas 6 · Avance 5. La propuesta aplica el esqueleto común: **Insumos · Modelo · Control · Avance**, en
ese orden, con 18 pestañas. Lo propio del modo (agenda, distribución de aplicadores, partes, relevos A, B y C) son pestañas
de Control, agrupadas en el rail en **Agenda**, **Campo** y **Casos**. No hace falta una quinta sección.

| Código | Sección | Pestaña | Pregunta que responde | Absorbe de hoy | Por qué aquí |
|---|---|---|---|---|---|
| I1 | 1 · Insumos | Fuentes | ¿qué está conectado y qué dejó la última lectura? | Fuentes (operación del plan, dos Sheets, de dónde salen las respuestas, «Importar plan», «Leer del Sheets») | Todo lo que se conecta antes de medir, con el recibo del libro. |
| I2 | | Reglas | ¿qué cuenta como efectiva y cómo se atribuye? | Fuentes › «Cómo mide el estudio», «Qué cuenta como encuesta efectiva», umbral de duración; criterio de aula de Controles | Toda regla que cambia una cifra antes de contarla. |
| I3 | | Aplicadores | ¿quién está disponible y cuándo? | Agenda › Carga › Disponibilidad y Tramos | La disponibilidad es un insumo; el reparto se opera en Control. |
| M1 | 2 · Modelo | Metas | ¿cuánto por facultad o nivel, y con qué tasa? | Avance › Metas (sus mandos), Avance › Efectividad (tasa del diseño) | Definir no es leer: Avance solo lee el cumplimiento. |
| M2 | | Muestra | ¿qué titulares, reservas y banco hay? | Consultas › Reemplazos (cadena y colchón), Consultas › Extras (alcance del banco), «Ver muestra de cursos-horario» | La muestra y su reserva son el modelo del operativo. |
| Ctl1 | 3 · Control | Agenda | ¿quién tiene cita esta semana y qué falta agendar? | Agenda › Agenda, Agenda › Por facultad, «A quién hay que agendar» | Grupo **Agenda** del rail. Una semana como calendario real. |
| Ctl2 | | Contacto | ¿a qué docente hay que volver a llamar? | Agenda › Contacto | Cola de contacto con lo que anota el agendador. |
| Ctl3 | | Distribución | ¿quién va a cada cita? | Agenda › Carga (patrón, calendario, asignación, hoja de aplicadores) | Operar el reparto; la disponibilidad quedó en I3. |
| Ctl4 | | Registro de campo | ¿qué parte falta y qué caso es cada reserva? | Validación › Registro de campo | Grupo **Campo**. Lugar de la declaración B o C. |
| Ctl5 | | Partes | ¿cuadra cada parte, consigo y con la plataforma? | Consultas › Parte de campo, «El parte contra la plataforma», «Cambio de aula» | Revisión de los partes, separada de su registro. |
| Ctl6 | | Calidad | ¿hay respuestas o aulas sospechosas? | Validación › Controles, Base de control, Respuestas abiertas; «Cuánto se tarda en responder» y «Qué descarta cada filtro» de Registro | Señales del corte en un solo lugar. |
| Ctl7 | | Brechas | ¿qué titular, aula o facultad necesita un relevo? | Consultas › Brechas, Refuerzos y la elección de Extras | Grupo **Casos**. Los tres caminos A, B y C juntos. |
| Ctl8 | | Alumnos ◇ | ¿quién respondió, por su código? | Validación › Cruce de alumnos | Solo en estudios que piden el código y cruzan un padrón. |
| A1 | 4 · Avance | Resumen | ¿llegamos a la muestra? | Avance › Resumen | |
| A2 | | Por facultad (Por nivel en CCSS) | ¿qué grupo no llega? | Avance › Metas | El rótulo es el eje que declara el proyecto. |
| A3 | | Cursos-horario | ¿cómo rindió cada aula? | Paneles de Resumen («Respuestas que pide el plan», «Cursos-horario por cobertura», «En qué punto está cada uno») y Efectividad › «Cada curso-horario contra su propio margen» | Grano aula. |
| A4 | | Rendimiento | ¿cuándo y quién rinde más? | Avance › Rendimiento y Avance › Efectividad | Ritmo, hora, día, tasa del campo contra la del diseño y aplicador. |
| A5 | | Salidas | ¿qué se publica y está al día? | Avance › Salidas y «Así se verá el libro» | Publicar vive aquí (L38). |

◇ condicional. **Consultas › Buscar por código deja de ser pestaña**: es el inspector del curso-horario
(`&panel=aula&foco=<código>`), que se abre desde cualquier tabla y desde el buscador de la cabecera de Control (tablero P2).
Ninguna pestaña de hoy se pierde: las 20 y la hoja tienen destino (tablero 0, columna de la derecha de cada fila).

Direcciones (`seccion` · `pestana`): `insumos`·`fuentes|reglas|aplicadores`, `modelo`·`metas|muestra`,
`control`·`agenda|contacto|distribucion|registro|partes|calidad|brechas|alumnos`,
`avance`·`resumen|porfacultad|cursos|rendimiento|salidas`. Las secciones de hoy (`fuentes`, `calidad`, `consultas`) y sus
pestañas se leen como alias y redirigen a su destino; nunca se escriben. Aterrizaje: ver **P1**.

---

## 1b. Lo que ya existe y dónde queda (estándar §0)

Inventario leído del código de `frontend/src/features/monitoreo/profiles/aulas/` (682 archivos; página
`AulasMonitoreoPage.tsx`, 2,446 líneas) y de los endpoints `/api/monitoreo/aulas/*`. Ninguna capacidad se pierde.

| Capacidad de hoy | Componente o función | Dónde queda | Qué mejora |
|---|---|---|---|
| Operación del plan: Importar plan, Traer respuestas, Generar libro, Leer libro llenado, Leer del Sheets, Publicar al Sheets, Releer el cruce | `AulasOperationsPanel.tsx`, `AulasDosSheets.tsx` | I1 Fuentes (importar, leer), Actualizar (traer), A5 Salidas (publicar, generar) | Un verbo por dirección: leer en Insumos y Actualizar, escribir solo en Salidas; «Importar plan» confirma porque reemplaza |
| Traza del plan: selección, metodología, marco | `AulasOperationsPanel.tsx` (tarjetas de traza) | I1 Fuentes, fila «Plan del sorteo» con su corrida | Una fila por fuente con volumen, lectura y estado |
| De dónde salen las respuestas | `AulasFuentesDelEstudio.tsx` | I1 Fuentes y «Cómo se une cada respuesta» | El camino de 3,610 a 3,571 con curso-horario, con su llave |
| Recibo del libro (hojas ausentes, estados desconocidos, códigos sin plan, reservas sin cadena) | `monitoreo_aulas_libro_recibo()`, `AulasOrigenDesfasado.tsx` | I1, «Recibo de la última lectura del libro» | Hoy viaja como aviso; aquí queda visible con su fecha |
| Cómo mide el estudio: eje de cuota, agrupación operativa, inicio de campo, padrón | `AulasComoMideElEstudio.tsx` | I2 Reglas, «Eje de la cuota» y «Variables de la respuesta» | El eje con su vocabulario cerrado como selector |
| Qué cuenta como efectiva: condiciones, descartes de colector, facultad declarada, umbral de duración | `AulasFiltrosDeEfectiva.tsx`, `AulasUmbralDeDuracion.tsx`, `AulasCadenaDeFiltros.tsx` | I2 Reglas | Cada condición con cuánto descarta; histograma de duraciones con el umbral |
| Criterio de aula | `AulasCriterioDeAula.tsx` | I2, «Cuándo un curso-horario se da por aplicado» | Switches |
| Disponibilidad de aplicadores (importar, plantilla) y tramos | `AulasDisponibilidadDeAplicadores.tsx`, `AulasTramosDelOperativo.tsx` | I3 Aplicadores | Semana de cada aplicador dibujada; mapa de calor por franja |
| Mandos de metas por facultad y sexo; tasa del diseño | `AulasMetasMandos.tsx`, `AulasEfectividadSeguimiento.tsx` (τ prevista) | M1 Metas | Cuota, reparto por sexo, tasa prevista y meta de cada aula en una vista |
| Cadena de reemplazos, colchón por facultad, alcance del banco | `AulasHistoriaCadena.tsx`, `AulasCadenaChart.tsx`, `AulasColchonPorFacultad.tsx`, `AulasAlcanceDelBanco.tsx`, `AulasBancoExtras.tsx` | M2 Muestra | Composición por facultad, reservas libres por titular, cadenas ya usadas con su caso |
| Agenda con selector de eslabón, agenda por día, mapa de horas, agenda por facultad | `AulasSeccionModelo.tsx`, `AulasAgendaPorDia.tsx`, `AulasMapaDeHoras.tsx`, `AulasAgendaPorFacultad.tsx`, `AulasSelectorDeEslabon.tsx` | Ctl1 Agenda («Por día» y «Por facultad») | Calendario de la semana con la hora real; sin cita y vencidas al costado |
| Alerta de anticipación | `AulasAlertaDeAnticipacion.tsx` | Ctl1, lista «Sin cita» | Con gestiones y último resultado |
| Medio de contacto, ritmo de agendación, cola de contacto | `AulasMedioDeContacto.tsx`, `AulasRitmoDeAgendacion.tsx`, `AulasColaDeContacto.tsx` | Ctl2 Contacto | Días desde el último contacto; resultado del último contacto agregado |
| Carga de campo: patrón semanal, calendario, asignación, resortear, concentrar, fijar o soltar, copiar el aviso del día, publicar y sincronizar con la hoja | `AulasCargaDeCampo.tsx`, `AulasAsignacionDeAplicadores.tsx` | Ctl3 Distribución | Matriz aplicador por día con chips Pabellón; cruce con la agenda en los dos sentidos |
| Registro de campo: estado, motivo, asistentes, rechazos, duplicados, encuestas, aula real, aplicador, fecha, observaciones; activar o elegir reemplazo | `RegistroDeCampo.tsx`, `AulasPopoverReemplazo.tsx` | Ctl4 Registro de campo | Contexto de la meta y de Kobo junto al formulario; cuadre del parte al guardar; **pregunta B o C** (P3) |
| Observaciones de campo, trabajo de los equipos, parte contra plataforma, partes que no cuadran, cambio de aula, embudo del aula | `AulasObservacionesDeCampo.tsx`, `AulasTrabajoDeLosEquipos.tsx`, `AulasParteContraPlataforma.tsx`, `AulasPartesQueNoCuadran.tsx`, `AulasCambioDeAula.tsx`, `AulasEmbudoDelAula.tsx` | Ctl5 Partes (y A4 «Por aplicador») | Las 97 que no cuadran con su cuenta; del aula a las efectivas con base |
| Controles, ficha del curso-horario, base de control, lo que falta para cerrar, abiertas, tiempos | `AulasControles.tsx`, `AulasFichaDeAula.tsx`, `AulasControlDelLibro.tsx`, `AulasLoQueFalta.tsx`, `AulasTextoAbierto.tsx`, `AulasTiemposDeRespuesta.tsx` | Ctl6 Calidad (la ficha pasa al inspector P2) | Señales con su estado; duración por aula con su rango |
| Facultad declarada frente a la del aula | `AulasFacultadDeclarada.tsx` | Ctl6 Calidad | Coincide y distinta, con su base |
| Cruce de alumnos por carrera | `AulasCrucePorCarrera.tsx` | Ctl8 Alumnos ◇ | Cobertura por carrera contra el padrón |
| Buscar por código (agenda, partes, dos tasas, control) | `AulasFichaDeCursoHorario.tsx` | Inspector P2 | Se abre desde cualquier tabla; deja de ser pestaña |
| Tres caminos A, B y C; deuda por facultad; brechas del corte; llamada de facultad | `AulasTresCaminos.tsx`, `AulasComoVaCadaFacultad.tsx`, `AulasBrechasDelCorte.tsx`, `AulasLlamadaDeFacultad.tsx` | Ctl7 Brechas | Los tres caminos como tarjetas con su cifra y una lista por camino |
| Refuerzos dentro del techo, elección por facultad, refuerzo por código, pedidos, retirar, pintar en el Sheets | `AulasRepartoDelTecho.tsx`, `AulasEleccionPorFacultad.tsx`, `AulasRefuerzoPorCodigo.tsx`, `AulasRefuerzosPedidos.tsx`, `useMarcarRefuerzo.ts` | Ctl7 Brechas («Refuerzos por contactar», «Facultades que no cierran») | «Pintar en el Sheets» pasa por «Revisar cambios en la hoja» (hoy se salta el ensayo) |
| Elegir reemplazo (su cadena, al aire, banco), popover de refuerzo | `AulasPopoverReemplazo.tsx`, `AulasPopoverRefuerzo.tsx` | Ctl7 («Elegir relevo», «Buscar complemento») y Ctl4 | Se conservan tal cual; no se redibujan en este lienzo |
| Banda de KPIs por sección | `kpisDeAulas.ts`, `AulasKpiBand` | Cada pestaña lleva su franja propia; Avance la preside en A1 | Una cifra, una base (G4) |
| Avance: respuestas, por grupo, respuestas que pide el plan, ritmo, agendación, desenlaces, estado por rol, cierre por agenda, facultades en riesgo y que se alejan, cobertura | `AulasPestanaResumen.tsx` y sus paneles | A1 (cifra, curva, por eje), A3 (estado por rol, cobertura, aula contra su tasa) | Sin repetir la misma lectura en tres paneles |
| Metas: cinta, avance, barras, metas y aulas, consumo de la reserva, bolsas, tres lecturas, reserva dirigida, composición referencial | `AulasPestanaCuotas.tsx` y sus paneles | A2 Por facultad (Por nivel) | Facultad por sexo con «Al cierre»; qué rindió cada tipo; consumo de la reserva |
| Rendimiento y efectividad: quién consigue más, franja, día, serie por facultad, τ del campo contra la del diseño, señales por aula | `AulasPestanaRendimiento.tsx`, `AulasPestanaEfectividad.tsx` | A4 Rendimiento y A3 | Diagrama de pesas diseño-campo por facultad |
| Salidas: Sheets cliente e interno, PDF, vista previa del libro | `MonitoreoOutputsWorkbench family="aulas"`, `AulasVistaPreviaDelLibro.tsx` | A5 Salidas | Qué toca Publicar, hoja por hoja; las del equipo marcadas «Nunca se escribe» |
| Selector de foco por eje | `AulasSelectorDeFoco.tsx` | Filtro de A1, A2 y A3 (`foco=facultad:X`) | Igual que hoy, sin cambiar de pestaña |

---

## 2. Patrones globales (las fichas los citan por código)

**G1 · Cabecera única, igual que Territorial y Acreditación.** Barra de módulos y chip del proyecto («guardado») · barra
de modo: MODO «Cursos-horario», MUESTRA «174 cursos-horario» (titulares del sorteo), píldoras Insumos · Modelo · Control ·
Avance con su insignia (Control: titulares por resolver, ver P9; Avance: avance a la muestra, «133 %»), CORTE con fecha y
hora, píldora de estado («Al día», «Actualizando, paso N de M», «Falló», «Preparando») y **Actualizar ▾**. Título de 44 px
con ícono carmesí y antetítulo «Sección · Grupo» («Control · Campo / Registro de campo»). Se retiran el botón «Avance»
(que recarga sin traer), el botón «Traer respuestas» y el eyebrow «Cursos-horario» de cada pestaña.

**G2 · Rail de todo el alto con CORTE al pie.** 54 px, íconos de trazo con `aria-label`; en Control, divisores entre
Agenda (Ctl1–Ctl3), Campo (Ctl4–Ctl6) y Casos (Ctl7–Ctl8); el `title` dice «Grupo · Pestaña». Al pie, «CORTE» y «dd/mm»,
«hh:mm» (`MonitoreoRailLastUpdate`). Los contadores de `railDeAulas.ts` pasan a las insignias de la cabecera de cada
pestaña.

**G3 · Actualizar explica su proceso (tableros P1a, P1b, P1c; error S3).** Pasos reales:

| Paso | HSVG | CCSS |
|---|---|---|
| 1 · Traer lo nuevo | Kobo «HSVG 2026 PUCP (Kobo EU)», solo lo nuevo desde el cursor (3,610 al corte) · Libro del operativo, 4 hojas del equipo (1,392 filas y 190 partes) · Hoja de los aplicadores: sin conectar, se omite | Kobo «CCSS Perfil 2026-II» (679) · Libro, 2 hojas del equipo (136 filas y 51 partes) · Hoja de los aplicadores (46 citas, solo lectura) |
| 2 · Recalcular | Tablero de cursos-horario ≈ 15 s (medido 14.8 s sin caché) | ≈ 2 s (medido 2.1 s) |
| 3 · Dejar recibo | Efectivas 3,327, titulares por resolver 8, partes 190, con su cambio | Efectivas en la cuota 465, titulares por resolver 0, partes 51 |

Chips de lo que **no toca**: no publica las hojas de la app, no escribe en las hojas del equipo, no toca la hoja de los
aplicadores, no cambia relevos ni refuerzos. Acciones: «Recalcular sin leer» y «Actualizar ahora». El tiempo de lectura por
fuente no está medido: `—` hasta que el job lo registre (el recibo lo aprende). La re-publicación y el retiro de filas que
hoy hace el sync dependen de **P2** y **P3**.

**G4 · Una cifra, una base.** Glosario del modo:

| Rótulo | HSVG | CCSS | Qué es |
|---|---|---|---|
| Titulares | 174 | 50 | cursos-horario del sorteo (`rol_y_estado.titulares.total`); nunca `total_aulas` (1,347), que suma reservas |
| Muestra | 2,500 | 400 | `avance_cuota.total.cuota` |
| Meta operativa | 3,750 | igual a la muestra | `avance_cuota.meta_operativa` (muestra más sobremuestra) |
| Cuentan para la muestra | 3,327 | 465 | `avance_cuota.total.respuestas_validas`: efectivas en celdas del eje |
| Efectivas del estudio | 3,327 | 644 | `invariante.total`: incluye las que no caen en una celda (CCSS: 140 de niveles sin meta, 22 sin nivel, 15 duplicadas, 2 sin curso-horario) |
| Avance a la muestra | 133.1 % | 116.2 % | cuentan ÷ muestra |
| Esperadas de un aula | elegibles × tasa prevista del aula | igual | `expected_valid` = `eligible_n` × `tasa_efectividad_aula` (CH 140: 44 × 55.0 % = 24.2) |

**G5 · Readiness por pestaña.** Hoy todo el perfil publica `monitoreo-aulas` (`AulasMonitoreoPage.tsx`, marca
`data-audit-ready`). Propuesta: `monitoreo-aulas-<seccion>-<pestana>`, en `false` mientras carga, prepara o un gráfico no
pinta.

**G6 · Estados dentro del marco (C2, C3).** Preparando = silueta de la misma pestaña con tiempo transcurrido y estimado
(S1); vacío con salida (S2); error con fuente, código `E_*`, `error_id` y «el corte anterior sigue vigente» (S3). El
chrome, el rail y el título no se mueven.

**G7 · Interruptores y acciones irreversibles.** Todo booleano es un switch (concentrar el día, descartar recopiladores de
prueba, excluir fuera del operativo, veredicto de la Base de control). Acciones que reemplazan («Importar plan»,
«Importar disponibilidad») confirman con la cifra; acciones que escriben en un Sheets («Publicar», «Agregar lo nuevo a la
hoja», «Retirar las cerradas», refuerzos) pasan por «Revisar cambios» antes.

**G8 · Archivos.** No crecen los congelados (`agentic/manifest.json`): `router_monitoreo.R`, `monitoreo_engine.R`,
`aulasMonitoreo.css`, `profilePage.css`, `monitoreo.css`. `AulasMonitoreoPage.tsx` (2,446 líneas) solo monta. Cada
pestaña nueva en `profiles/aulas/<seccion>/<Pestana>.tsx` con su modelo puro `.ts` y su `.css`; los componentes de hoy se
reutilizan desde ahí. Colores solo `--pulso-*`.

**G9 · Un proyecto no gobierna el modo (§4).** El eje de cuota (facultad o nivel), su atribución (aula o persona), la
agrupación operativa (facultad o carrera), los nombres de columna (`collectorID`, `datos_demo/P7`, `cod_pucp`, `A1`) y el
vocabulario de STATUS MUESTRA se muestran como los declara el proyecto. Condicionales: Alumnos (Ctl8), padrón, traslape,
hoja de aplicadores, sobremuestra.

**G10 · Paleta de datos.** Efectivas `#002457`; hombres o secundaria `#6f93c4`; reservas `#a9c3e3`; descartes, rechazos
y banco `#c2681c`; meta carmesí discontinua. Cumple en verde de éxito, no llega en naranja. El color de los chips de lugar
es identidad, nunca estado (G13).

**G11 · Escritura de producto.** Sin `=`, flechas, cadenas de `·` ni abreviaturas en la interfaz; cifras con su base en
frase («3,327 de 2,500», «57 de 62, faltan 5»). Formato es-PE: «1,392», «52.6 %». Fechas cortas «1 oct», «mié 30 set».

**G12 · Composición medida (§2a).** Verificada con `aulas2/scripts/medir.mjs` (Playwright sobre Chrome,
`getBoundingClientRect`), el medidor de Acreditación más el criterio (e2) de Territorial: toda lista `.scr` cuyo contenido
no cabe lleva barra visible (`con-sbar`) y una que cabe no la lleva. Resultado: **41 de 41 vistas pasan** (28 tableros, 13
con su variante CCSS); las 41 capturas son distintas byte a byte.

| Tablero | Variantes | a · pie | b · choques | c · escala | d · columnas | e · recortes | e2 · listas | f · vacío | g · texto | h · simetría |
|---|---|---|---|---|---|---|---|---|---|---|
| Main (arquitectura, 1920 × 1320) | 1 | sin chrome | 0 | — | — | 0 | 0 | 0 | 0 | 0 |
| I1 Fuentes, I2 Reglas, I3 Aplicadores | HSVG y CCSS | 0 px | 0 | 0 | 0 px | 0 | 0 | 0 | 0 | 0 |
| M1 Metas, M2 Muestra | HSVG y CCSS | 0 px | 0 | 0 | 0 px | 0 | 0 | 0 | 0 | 0 |
| Ctl1 Agenda, Ctl4 Registro, Ctl5 Partes, Ctl6 Calidad, Ctl7 Brechas | HSVG | 0 px | 0 | 0 | 0 px | 0 | 0 | 0 | 0 | 0 |
| Ctl2 Contacto, Ctl3 Distribución | HSVG y CCSS | 0 px | 0 | 0 | 0 px | 0 | 0 | 0 | 0 | 0 |
| Ctl8 Alumnos | CCSS | 0 px | 0 | 0 | — | 0 | 0 | 0 | 0 | 0 |
| A1 Resumen, A2 Por facultad | HSVG y CCSS | 0 px | 0 | 0 | 0 px | 0 | 0 | 0 | 0 | 0 |
| A3, A4, A5 | HSVG | 0 px | 0 | 0 | 0 px | 0 | 0 | 0 | 0 | 0 |
| P1a, P1b, P1c Actualizar; S3 Falló | HSVG y CCSS | 0 px | 0 | 0 | — | 0 | 0 | 0 | 0 | 0 |
| P2 Inspector, P3 Registro B o C, P4 Reagendado, S1, S2 | HSVG | 0 px | 0 | 0 | 0 px | 0 | 0 | 0 | 0 | 0 |

Además de la medición, cada captura se revisó a ojo. Lo que la medición no vio y se corrigió a mano: una cabecera de tabla
partida sobre la vecina en Ctl5 (el texto desbordaba sin recorte), bandas de duración que salían de su riel en Ctl6 y
tarjetas de agenda que se pisaban cuando dos citas caían a la misma hora (ahora se apilan en el orden del día).

**G13 · Sistema Pabellón: qué se conserva.** Se conservan, dentro de los contenedores comunes: (1) el chip de lugar con
color determinista por la letra del pabellón (8 tonos cíclicos, `tonoDePabellon`, `sistemaPabellon.css` única dueña de
`aulas-chip*`), el chip de hora y los badges neutros de facultad y fecha; (2) el orden canónico de la fila: lugar,
facultad, fecha, hora; (3) la jerarquía escaneable: código operativo fuerte primero; (4) listas completas sin techos:
nada de «y N más»; cuando no cabe, la lista lleva barra visible (e2). Lo que se reconcilia con el lenguaje común: el chip
de lugar es identidad y nunca estado (los estados usan la paleta común: éxito, aviso, peligro, azul); el rail, la cabecera,
las píldoras y los paneles son los de Monitoreo; ninguna pestaña tiene cabecera propia.

---

## 3. Fichas

### I1 · Insumos › Fuentes

- **Dirección**: `/monitoreo?modo=aulas&seccion=insumos&pestana=fuentes` · panel `&panel=conectar-fuente` · readiness `monitoreo-aulas-insumos-fuentes`
- **Tablero**: `I1-Fuentes.dc.html` (alterna)
- **Reemplaza**: la hoja Fuentes (franja «Seguimiento de la aplicación», operación del plan con nueve botones, embudo con prosa). Cierra: «Fuentes tiene 9 acciones, 5 contra Sheets» (censo de acciones §3.5).
- **Composición**: izquierda, tabla «Fuentes del estudio» (fuente con ícono y sub-rótulo, qué trae, volumen, última lectura, estado; filas condicionales con chip «Condicional») con «Importar plan» y «Conectar fuente», y pie de una línea; debajo, «Recibo de la última lectura del libro» (seis comprobaciones con su resultado, filas que reparten el alto). Derecha 440 px: «Libro del operativo» (en la agenda, partes, filas de control; hojas del equipo con candado y «Solo lectura»; hojas que escribe Monitoreo como chips; «Leer del Sheets») y «Cómo se une cada respuesta a su curso-horario» (leídas, con curso-horario, sin curso-horario, fuera del operativo; en CCSS además alumnos cruzados, sin cruce y dos veces).
- **Datos**: `monitoreo_sources[0]` (etiqueta, `last_sync_at`, `last_sync_mode`), `cfg.imported_at` y `selection_run_id`, `course_status_rol_y_estado` (174 + 1,173 + 45), `monitoreo_aulas_libro` (recibo), `cfg.libro_publicado` (13 hojas en HSVG: 4 del equipo y 9 de la app), `respuestas_desglose.total` (3,610; 39 sin aula; 37 fuera del operativo), `cruce_por_carrera.total` (CCSS 605, 22, 15). Los nombres de las 8 hojas de la app en CCSS se infirieron de las reglas de `monitoreo_aulas_publicar_libro.R` («Control de nivel» en lugar de «Control de facultad»; sin «Facultades en riesgo»): verificar en la app.
- **Estados**: sin plan → S2; fuente que falló en la última lectura → chip `bad` con su código.
- **Capacidad condicional**: hoja de aplicadores, padrón y traslape (CCSS sí; HSVG solo la hoja de aplicadores, sin conectar).
- **C1–C5**: C3 el recibo muestra «Todas presentes» y «Ninguno» en vez de vaciarse; C5 el volumen del Kobo es el del cursor.
- **Responsive**: 1366 y 1280: la columna derecha baja bajo la tabla; 1024 × 600: la tabla pierde la columna «Qué trae».
- **Archivos**: nuevo `profiles/aulas/insumos/Fuentes.tsx`, `fuentesModelo.ts`, `insumos.css`; reutiliza `AulasFuentesDelEstudio.tsx`, `AulasDosSheets.tsx`; retira `AulasOperationsPanel.tsx` al terminar.
- **Aceptación**: «Importar plan» abre confirmación con «Reemplaza los 1,392 cursos-horario del plan»; ningún botón de esta pestaña escribe en un Sheets.
- **Decisiones**: P2.

### I2 · Insumos › Reglas

- **Dirección**: `…&seccion=insumos&pestana=reglas` · readiness `monitoreo-aulas-insumos-reglas`
- **Tablero**: `I2-Reglas.dc.html` (alterna)
- **Reemplaza**: «Cómo mide el estudio», «Qué cuenta como encuesta efectiva», umbral de duración, criterio de aula.
- **Composición**: tres columnas. 1: «Qué cuenta como encuesta efectiva» (leídas, pasan, efectivas; cada condición con entran, quedan y «menos N»; switches de descartes y fuera del operativo; «Descartar» y «Guardar criterio») y «Lo que no cuenta, por facultad» (o por carrera). 2: «Eje de la cuota» (selector facultad, carrera, nivel; atribución; agrupación; categorías con meta), «Variables de la respuesta», «Etiquetas de la facultad que declara el alumno» (o del nivel). 3: «Duración sospechosa» (switch, umbral, marcadas, mediana, percentil 5, histograma de 0 a 30 minutos con el umbral en naranja), «Tiempos de una aplicación» (30, 30 y 15 minutos; 4 aulas por viaje), «Cuándo un curso-horario se da por aplicado».
- **Datos**: `cadena_filtros.pasos` (HSVG: consent_1 menos 166, consent_2 menos 59, filtro menos 25), `criterio_validez`, `source_mapping` (incluye `descartes` de CCSS: CAPACITACION, PRUEBA), `avance_cuota.eje`, `cfg.agrupacion_operativa`, `tiempos` (HSVG umbral 3 min, 513 de 3,610 marcadas, mediana 5.2; CCSS sin umbral, mediana 9.7), `reparto` (tiempos de aplicación), `control_calidad_resumen.veredicto` (96 y 93).
- **Estados**: cambiar una regla deja la píldora en «Pendiente de recalcular» (chip de la cabecera).
- **Capacidad condicional**: etiquetas de facultad declarada solo si `faculty_var` existe; de nivel declarado solo si `declared_level_var`.
- **C1–C5**: C5 el selector de eje usa el vocabulario cerrado de `monitoreo_aulas_ejes_declarables()`.
- **Responsive**: 1280: tres columnas pasan a dos (la tercera baja); 1024: una columna con scroll de documento.
- **Archivos**: nuevo `insumos/Reglas.tsx`, una tarjeta por archivo; reutiliza `AulasFiltrosDeEfectiva.tsx`, `AulasUmbralDeDuracion.tsx`, `AulasComoMideElEstudio.tsx`, `AulasCriterioDeAula.tsx`.
- **Aceptación**: el histograma suma las 3,610 respuestas; las barras bajo el umbral suman las 513 marcadas.

### I3 · Insumos › Aplicadores

- **Dirección**: `…&seccion=insumos&pestana=aplicadores` · readiness `monitoreo-aulas-insumos-aplicadores`
- **Tablero**: `I3-Aplicadores.dc.html` (alterna)
- **Reemplaza**: Agenda › Carga › Disponibilidad; tramos del operativo.
- **Composición**: izquierda, «Disponibilidad declarada» (una fila por aplicador con su semana dibujada de 7:00 a 22:00, horas, aulas aplicadas y citas en el rango del reparto), «Descargar plantilla» e «Importar disponibilidad». Derecha 380 px: «Tramos del operativo» (semana, fechas, aplicadas de citas) y «Aplicadores disponibles por franja» (mapa de calor día por media hora).
- **Datos**: `monitoreo_aulas_disponibilidad` (31 en HSVG, 5 en CCSS), `disponibilidad.dias[].franjas[].disponibles` (máximo 24), `tramos` (HSVG: 92 de 93, 62 de 65, 21 de 23, 11 de 12), `reparto.equidad`, partes por aplicador.
- **Estados**: sin disponibilidad → vacío con salida «Importar disponibilidad».
- **C1–C5**: C4 la lista larga lleva barra visible.
- **Archivos**: nuevo `insumos/Aplicadores.tsx`; reutiliza `AulasDisponibilidadDeAplicadores.tsx`, `AulasTramosDelOperativo.tsx`.
- **Aceptación**: importar reemplaza la disponibilidad entera y lo dice en la confirmación.

### M1 · Modelo › Metas

- **Dirección**: `…&seccion=modelo&pestana=metas` · readiness `monitoreo-aulas-modelo-metas`
- **Tablero**: `M1-Metas.dc.html` (alterna: facultad por sexo o nivel)
- **Reemplaza**: los mandos de Avance › Metas y la tasa del diseño de Efectividad.
- **Composición**: franja (muestra, sobremuestra, meta operativa, tasa prevista; «Del diseño en Cálculo de muestra» y «Abrir el diseño»). Izquierda: HSVG, «Cuota por facultad y sexo» (cuota, mujeres, hombres, tasa prevista, titulares, elegibles y barra apilada); CCSS, «Cuota por nivel» (cuota, en el padrón, cuota sobre el padrón, tasa; niveles 5 y 10 «Fuera del diseño») y «Padrón de la facultad por nivel». Derecha: «Meta de cada curso-horario» (elegibles por tasa prevista; esperadas de los titulares frente a la cuota) y «Tasa prevista por facultad» (puntos de 30 % a 90 %) o, en CCSS, «De dónde sale la cuota por nivel».
- **Datos**: `cfg.design_targets` (HSVG 2,500, 1,250, 3,750; Ciencias e Ingeniería 528 con 130 mujeres y 398 hombres, tasa 53.0 %), `efectividad_seguimiento.total.tau_previsto` (52.5 % y 50.0 %), `padron.por_nivel` (CCSS), suma de `expected_valid` de titulares (HSVG 3,158, 126.3 % de la cuota; CCSS 606, 151.5 %). En CCSS la cifra 238/243/193/125 sale del texto `design_targets.fuente`.
- **Estados**: diseño desfasado (`avance_cuota.vigencia` distinta de `vigente`) → aviso con «Abrir el diseño».
- **C1–C5**: C5 la meta mostrada es la que usa Avance.
- **Archivos**: nuevo `modelo/Metas.tsx`; reutiliza `AulasMetasMandos.tsx` (solo lectura: la meta se edita en Cálculo de muestra).
- **Aceptación**: la suma por sexo de cada facultad iguala su cuota.

### M2 · Modelo › Muestra

- **Dirección**: `…&seccion=modelo&pestana=muestra&foco=aula:<código>` · readiness `monitoreo-aulas-modelo-muestra`
- **Tablero**: `M2-Muestra.dc.html` (alterna)
- **Reemplaza**: Consultas › Reemplazos (historia y colchón), Consultas › Extras (alcance del banco).
- **Composición**: franja (titulares, reservas en cadena, banco); «Muestra por facultad» o «por carrera» (titulares, reservas, banco, usadas, esperadas, composición apilada); «Reservas libres por titular» (histograma; dos o menos en naranja). Derecha 440 px: «Cadena de CH 157» (titular y sus reservas en orden de parecido, chips de lugar y equivalencia, estado) y «Cadenas que ya se usaron» (titular, reservas usadas, caso).
- **Datos**: `agenda` por `sample_role`, `reserva_de_la_cadena` (HSVG: 14 titulares con dos o menos), `refuerzos.activadas` (22 titulares con su cadena usada; caso A, o «Sin declarar» cuando la procedencia es reconstruida), `equivalence_level`.
- **C1–C5**: C3 una cadena sin uso dice «En reserva» en cada eslabón.
- **Archivos**: nuevo `modelo/Muestra.tsx`; reutiliza `AulasHistoriaCadena.tsx`, `AulasColchonPorFacultad.tsx`, `AulasAlcanceDelBanco.tsx`.

### Ctl1 · Control › Agenda (grupo Agenda)

- **Dirección**: `…&seccion=control&pestana=agenda&vista=dia|facultad` · panel `&panel=aula&foco=aula:<código>` · readiness `monitoreo-aulas-control-agenda`
- **Tablero**: `Ctl1-Agenda.dc.html` (HSVG, semana 4); con el inspector abierto, P2; con la cita vencida o reagendada, P4.
- **Reemplaza**: Agenda › Agenda, Agenda › Por facultad, alerta de anticipación. Cierra: «Aulas planificadas» en «—» (censo §5.1).
- **Composición**: izquierda 300 px, «Sin cita» (12) y «Citas vencidas» (9), cada una con código, chip de lugar, elegibles, facultad y último resultado. Derecha: calendario de la semana (lunes a viernes, 7:00 a 22:00 a escala) con cada cita como tarjeta: código, chip de hora, papel, chip de lugar y estado («Aplicada, N efectivas», «N respuestas, sin parte», «Cita vencida», «Por aplicar»); la columna de hoy resaltada; navegación de semana y «Por día» o «Por facultad»; buscador de código en la cabecera.
- **Datos**: `agenda[].scheduled_date|scheduled_time|scheduled_venue`, existencia del parte en `partes_campo` (ver P8), `respuestas_validas`, `course_status_rol_y_estado.acciones` (`sin_agendar`, `agendado_vencido`).
- **Estados**: semana sin citas → columnas con «Sin citas» y la lista de «Sin cita» como salida.
- **Realismo operativo**: agendar y reagendar se hacen en «Aulas Agendadas», que la app nunca escribe; aquí se lee.
- **Responsive**: 1280: la lista izquierda pasa a un panel plegable; 1024: tres días visibles con desplazamiento horizontal declarado.
- **Archivos**: nuevo `control/agenda/Agenda.tsx`, `agendaSemanaModelo.ts`; reutiliza `AulasCalendarioDeAgenda.tsx`, `AulasAgendaPorFacultad.tsx`, `AulasAlertaDeAnticipacion.tsx`, `AulasSistemaPabellon.tsx`.
- **Aceptación**: dos citas a la misma hora no se pisan; una cita con parte nunca dice «sin parte».

### Ctl2 · Control › Contacto

- **Dirección**: `…&seccion=control&pestana=contacto` · readiness `monitoreo-aulas-control-contacto`
- **Tablero**: `Ctl2-Contacto.dc.html` (alterna)
- **Reemplaza**: Agenda › Contacto.
- **Composición**: «Cola de contacto» (código, papel, facultad, docente, medio, gestiones, último resultado con su color, último contacto, días), filtro Todos, Titulares, Reservas; pie «Las gestiones se anotan en la hoja de agenda; Monitoreo solo lee». Derecha: «Contactos por fecha» (por teléfono y por correo; barras por fecha del último contacto) y «Resultado del último contacto».
- **Datos**: `agenda[].contact_medium|contact_attempts|call_status|contact_date`; cola = `en_contacto` más titulares `sin_contactar` (HSVG 15). Los días se cuentan desde el corte.
- **Realismo operativo**: no hay historia de llamadas: la hoja guarda gestiones acumuladas, el último resultado y la fecha.
- **Archivos**: nuevo `control/agenda/Contacto.tsx`; reutiliza `AulasColaDeContacto.tsx`, `AulasMedioDeContacto.tsx`, `AulasRitmoDeAgendacion.tsx`.

### Ctl3 · Control › Distribución

- **Dirección**: `…&seccion=control&pestana=distribucion` · readiness `monitoreo-aulas-control-distribucion`
- **Tablero**: `Ctl3-Distribucion.dc.html` (alterna: hoja sin conectar en HSVG, conectada en CCSS)
- **Reemplaza**: Agenda › Carga (patrón semanal, calendario, asignación, hoja de los aplicadores).
- **Composición**: «Reparto del … al …» (aplicador por día, cada cita con código, hora y lugar; fijadas desde la hoja en rosado; switch «Concentrar el día de cada aplicador» y «Resortear»). Derecha 340 px: «Hoja de los aplicadores» (CCSS: «Revisar cambios», «Retirar las cerradas», «Agregar lo nuevo a la hoja»; HSVG: «Crear la hoja de los aplicadores»), «Cruce con la agenda» (agendadas sin aplicador, fijadas sin cita, citas fuera del rango) y «Citas por aplicador».
- **Datos**: `reparto` (HSVG rango 21 al 25 set, 9 aplicadores con citas, 95 fijadas, CH 143 fijada sin cita; CCSS 22 set al 5 oct, 52 fijadas, 15 fijadas sin cita), `cfg.distribucion_sheets`, `reparto.equidad`.
- **Realismo operativo**: lo que el equipo ajusta a mano en la hoja manda; la app siembra la semana y agrega filas por lo nuevo agendado.
- **Archivos**: nuevo `control/agenda/Distribucion.tsx`; reutiliza `AulasAsignacionDeAplicadores.tsx`, `AulasCargaDeCampo.tsx`.
- **Decisiones**: P3, P7.

### Ctl4 · Control › Registro de campo (grupo Campo)

- **Dirección**: `…&seccion=control&pestana=registro&foco=aula:<código>` · readiness `monitoreo-aulas-control-registro`
- **Tablero**: `Ctl4-Registro.dc.html` (titular CH 144); `P3-RegistroBC.dc.html` (reserva R 140.2 con la pregunta B o C)
- **Reemplaza**: Validación › Registro de campo.
- **Composición**: izquierda 300 px, «Partes de la semana» (Todos, Sin parte, Con parte; cada uno con lugar, día, papel y estado). Centro: «Parte del curso-horario» (código, chips Pabellón, curso; franja elegibles, esperadas, efectivas en Kobo, mujeres y hombres; formulario de cuatro columnas: estado, aula real, aplicador, fecha y hora, asistentes, rechazos, ya habían respondido, encuestas aplicadas, observaciones y ficha escaneada; aviso del cuadre; «Descartar» y «Guardar parte»). Derecha 300 px: «Si no se pudo aplicar» (reservas libres, siguiente; «Activar la siguiente» y «Elegir relevo», habilitados solo con estado Sin acceso, Cancelado o Reemplazo pendiente) y «Partes de esta semana».
- **B o C (pendiente conocido)**: al guardar el parte o el estado agendado de una reserva cuyo titular no cayó, la app pregunta antes de enviar (P3): B, complemento, con la falta del curso-horario que completa y «Completa a» (P4); C, refuerzo, con la cuota de la facultad y lo conseguido. Envía `activation_origin` `b` o `c` en el mismo `POST /aulas/agenda`, de modo que el 422 `E_AULAS_RESERVA_SIN_CASO` no llega al usuario. El caso A no se pregunta.
- **Datos**: `agenda` (CH 144: 25 elegibles, 17.2 esperadas, 13 en Kobo, 10 mujeres y 3 hombres), `partes_campo`, `reserva_de_la_cadena`, `efectividad_seguimiento.facultades` (Gestión y Alta Dirección: cuota 105, 160 conseguidas).
- **Estados**: guardar con un parte que no cuadra → aviso, no bloqueo.
- **Archivos**: refactor de `RegistroDeCampo.tsx` en `control/campo/Registro.tsx`, `control/campo/DeclararCaso.tsx` (nuevo), `registroModelo.ts`.
- **Aceptación**: una reserva adicional sin caso no se puede guardar sin elegir B o C; con B o C, el `POST` lleva `activation_origin`.
- **Decisiones**: P4, P5, P6.

### Ctl5 · Control › Partes

- **Dirección**: `…&seccion=control&pestana=partes` · readiness `monitoreo-aulas-control-partes`
- **Tablero**: `Ctl5-Partes.dc.html` (HSVG)
- **Reemplaza**: Consultas › Parte de campo, el parte contra la plataforma, cambio de aula.
- **Composición**: franja (partes leídos 190, cuadran 80, no cuadran 97, sin datos para cuadrar 13, parte distinto del Kobo 137, cambiaron de aula 10); «Partes que no cuadran» (código, aplicador, asistentes, rechazos, ya respondieron, debería dar, declara, diferencia, Kobo), de la mayor diferencia a la menor. Derecha: «Cambiaron de aula» (agendada y real con chips de lugar) y «Del aula a las efectivas» (elegibles 6,591, asistentes 4,662, rechazos 90, ya habían respondido 390, aplicadas según el parte 3,478, efectivas en Kobo 3,320).
- **Datos**: `partes_campo[].esperado|diferencia|cuadra` (cuadra si asistentes menos rechazos y duplicados igualan lo que declara el parte).
- **Archivos**: nuevo `control/campo/Partes.tsx`; reutiliza `AulasPartesQueNoCuadran.tsx`, `AulasCambioDeAula.tsx`, `AulasEmbudoDelAula.tsx`.

### Ctl6 · Control › Calidad

- **Dirección**: `…&seccion=control&pestana=calidad` · readiness `monitoreo-aulas-control-calidad`
- **Tablero**: `Ctl6-Calidad.dc.html` (HSVG)
- **Reemplaza**: Validación › Controles, Base de control y Respuestas abiertas; tiempos y cadena de filtros de Registro.
- **Composición**: «Señales del corte» (12 comprobaciones, las dos por revisar arriba con «Revisar»); «Duración que se aparta del resto» (cursos-horario con su rango habitual, su mediana y la del resto, de 0 a 12 minutos); derecha, «Facultad que declara el alumno» (3,171 coinciden, 156 distinta), «Base de control del libro» (96 y 93) y «Respuestas abiertas» (vacío con causa: «Este estudio no trae instrumento» y «Cargar el instrumento»).
- **Datos**: `validation` (12 comprobaciones), `tiempos.por_aula[destaca]`, `control_facultad`, `control_calidad_resumen`, `texto_abierto`.
- **Estados**: sin instrumento → vacío con salida (dibujado).
- **Archivos**: nuevo `control/campo/Calidad.tsx`; reutiliza `AulasControles.tsx`, `AulasControlDelLibro.tsx`, `AulasTiemposDeRespuesta.tsx`, `AulasFacultadDeclarada.tsx`, `AulasTextoAbierto.tsx`.

### Ctl7 · Control › Brechas (grupo Casos)

- **Dirección**: `…&seccion=control&pestana=brechas` · paneles `aulas-reemplazo` y `aulas-refuerzo` (existentes) · readiness `monitoreo-aulas-control-brechas`
- **Tablero**: `Ctl7-Brechas.dc.html` (HSVG)
- **Reemplaza**: Consultas › Brechas, Refuerzos y la elección de Extras. Cierra: dos avisos idénticos seguidos en Refuerzos (censo §5.1); «Pintar en el Sheets» sin ensayo.
- **Composición**: tres tarjetas A, B y C con su cifra (8 titulares por resolver, 80 aplicados con brecha, 0 facultades por debajo). «Titulares por resolver» (código, facultad, por qué, esperadas, reservas libres, «Elegir relevo»); «Aplicados que se quedaron cortos» (esperadas, efectivas, faltan, «Buscar complemento»). Derecha: «Refuerzos por contactar» (5, con «Retirar» y «Revisar cambios en la hoja») y «Facultades que no cierran» (vacío con causa: «Ninguna facultad está por debajo de su cuota»).
- **Datos**: titulares no aplicados, sin reemplazo A aplicado y sin respuestas (CH 17, 34, 49, 70, 90, 114, 132, 152; coincide con `refuerzos.diseno.sin_resolver` = 8: 4 sin cita, 3 citas vencidas, 1 caída), `brechas` con respuestas mayores que cero (80 de 94), `sample_status = refuerzo_por_contactar`, `candidatos_refuerzo` (`ok: false`).
- **Archivos**: nuevo `control/casos/Brechas.tsx`; reutiliza `AulasTresCaminos.tsx`, `AulasBrechasDelCorte.tsx`, `AulasRefuerzosPedidos.tsx`, `AulasPopoverReemplazo.tsx`, `AulasPopoverRefuerzo.tsx`.
- **Aceptación**: la facultad es frontera dura en los tres caminos (409 `E_REEMPLAZO_OTRA_FACULTAD`).

### Ctl8 · Control › Alumnos ◇

- **Dirección**: `…&seccion=control&pestana=alumnos` · readiness `monitoreo-aulas-control-alumnos`
- **Tablero**: `Ctl8-Alumnos.dc.html` (CCSS)
- **Reemplaza**: Validación › Cruce de alumnos.
- **Composición**: franja (respuestas con código 642, alumnos distintos 605, dos veces 15, sin cruce 22, cruzan 96.6 %); «Sin cruce» (su código no está en el padrón, 22); «Cobertura por carrera» (alumnos, padrón, cobertura, barra); «Quién respondió, por su código» (código enmascarado, carrera, nivel, aula, día, respuesta) con «Exportar».
- **Datos**: `cruce_por_carrera` (tope 500, `truncado: true`).
- **Capacidad condicional**: solo si `cruce_por_carrera.aplica`; en HSVG la pestaña no existe.

### A1 · Avance › Resumen

- **Dirección**: `…&seccion=avance&pestana=resumen&foco=facultad:<clave>` · readiness `monitoreo-aulas-avance-resumen`
- **Tablero**: `A1-Resumen.dc.html` (alterna)
- **Composición**: izquierda 400 px, cifra protagonista (anillo con el avance, «3,327 de 2,500», chip «Muestra cumplida» o «Faltan 5 en el nivel 9»; meta operativa y lo que falta) y «De las efectivas a la cuota» (seis partes del invariante); derecha, «Efectivas acumuladas» (curva diaria, barras del día, metas en carmesí discontinuo). Abajo, «Por facultad» o «Por nivel» como tarjetas de menor a mayor avance, con las fuera del diseño al final.
- **Datos**: `avance_cuota.total` e `invariante.partes`, `ritmo_diario` (HSVG: 21 días con campo, mejor el 9 set con 466), `avance_cuota.facultades`.
- **Estados**: S1 preparando; sin respuestas → anillo en 0 con «Aún no hay efectivas».

### A2 · Avance › Por facultad (Por nivel)

- **Dirección**: `…&seccion=avance&pestana=porfacultad` · readiness `monitoreo-aulas-avance-porfacultad`
- **Tablero**: `A2-PorFacultad.dc.html` (alterna)
- **Composición**: HSVG, «Cuota por facultad y sexo» (logradas, cuota, barra, al cierre, lectura del motor); derecha, franja de reemplazos, complementos, refuerzos y caídos, «Qué rindió cada tipo de curso-horario» (titulares 52.6 %, reemplazos 57.5 %, adicionales sin declarar 32.8 %, banco 24.5 %) y «Consumo de la reserva» por facultad. CCSS, «Cuota por nivel» (nivel 9: 57 de 62, faltan 5) y «A quién se está alcanzando» (sexo y carrera, padrón frente a efectivas).
- **Datos**: `avance_sexo_facultad` (30 grupos, todos cumplen en HSVG), `refuerzos.rendimiento`, `reemplazos_por_tipo`, `avance_cuota.composicion`.
- **Decisiones**: P10.

### A3 · Avance › Cursos-horario

- **Dirección**: `…&seccion=avance&pestana=cursos` · readiness `monitoreo-aulas-avance-cursos`
- **Tablero**: `A3-CursosHorario.dc.html` (HSVG)
- **Composición**: «Cada curso-horario contra su tasa prevista» (elegibles, efectivas, prevista, observada, barra con la prevista en carmesí, lectura del motor), del que más se aleja hacia abajo; derecha, «Titulares» (barra apilada y cinco cifras; reservas y extras usados) y «Cobertura de lo esperado».
- **Datos**: `dos_tasas.aulas[].senal` (conforme 91, bajo 48, sobre 31), `course_status_rol_y_estado`, `course_status_cobertura`.

### A4 · Avance › Rendimiento

- **Dirección**: `…&seccion=avance&pestana=rendimiento` · readiness `monitoreo-aulas-avance-rendimiento`
- **Tablero**: `A4-Rendimiento.dc.html` (HSVG)
- **Composición**: «Efectivas por día» (sábados en azul claro) y «Hora en que se responde» (pico a las 11:00); «Tasa del campo contra la del diseño» (pesas por facultad); «Día de la semana» y «Por aplicador» (aulas, efectivas, tasa).
- **Datos**: `ritmo_diario`, hora y día de `end` del Kobo, `efectividad_seguimiento.facultades[].tau_previsto|tau_observado`, partes por aplicador.

### A5 · Avance › Salidas

- **Dirección**: `…&seccion=avance&pestana=salidas` · readiness `monitoreo-aulas-avance-salidas`
- **Tablero**: `A5-Salidas.dc.html` (HSVG)
- **Composición**: «Salidas del corte» (libro del operativo, «Revisar cambios» y «Publicar»; PDF de avance, generado el 25/09, «Anterior al corte»; Sheets del cliente sin conectar; libro en Excel bajo pedido); «Así se verá «Avance de campo»»; derecha, «Qué toca Publicar en el libro» (nueve hojas de la app: «Se reescribe», salvo «Asignación de aplicadores»: «Solo agrega filas nuevas»; cuatro del equipo: «Nunca se escribe»).
- **Datos**: `cfg.libro_publicado`, `monitoreo_client_report_pdf.generated_at`, `avance_cuota.facultades`, `aulas_por_facultad`.
- **Decisiones**: P2.

### Paneles y estados

| Tablero | Qué es | Datos |
|---|---|---|
| P1a, P1b, P1c | Actualizar abierto, corriendo y recibo (G3), sobre A1 | Pasos y tiempos medidos de cada proyecto |
| P2 Inspector | `&panel=aula&foco=aula:CH 154`, lateral de 470 px sobre la Agenda: meta, contacto, aplicación, cadena y aviso de que su reserva R 154.1 ya se aplicó como reemplazo | `agenda`, `refuerzos.activadas`, `reparto` |
| P3 Registro B o C | Diálogo sobre Registro de campo con R 140.2 | Ver Ctl4 |
| P4 Cita vencida y reagendada | Lateral que alterna dos casos reales: CH 114 (cita del 16 set, 0 efectivas, una reserva libre; tres salidas: reagendar en la hoja, reemplazar, darla por no aplicada) y CH 172 (horario del curso jueves 15:00 a 18:00 en Z415, cita reagendada al jueves 24 a las 17:20 en N407; parte con 7 asistentes y 1 aplicada mientras la agenda dice pendiente) | `agenda`, `partes_campo`, `reparto` |
| S1 Preparando | Silueta de A1 con «0:09 de unos 15 s» | tiempo medido |
| S2 Sin plan | Insumos › Fuentes vacía con «Importar plan desde Cálculo de muestra» | |
| S3 Falló | `E_KOBO_API_FAILED`, `error_id`, «El corte del 01/10 a las 15:03 sigue vigente», «Reintentar» | registro de errores |

Responsive de los paneles: a 1280 el lateral ocupa 420 px y a 1024 × 600 pasa a pantalla completa con «Volver».

---

## 4. Hallazgos que salieron de los datos

1. **La agenda dice «pendiente» con el parte ya escrito** (P8): 7 reservas de la semana 4 de HSVG.
2. **CH 154 tiene cita hoy y su reemplazo ya se aplicó**: R 154.1 se aplicó el 24 set como caso A («su titular no aplicó, agendada»). Si CH 154 se aplica, R 154.1 debería pasar a adicional y declararse. El inspector lo avisa.
3. **20 aulas «adicionales» sin caso declarado** en HSVG (procedencia reconstruida), con tasa de 32.8 %: son las que la regla del 10/10 obligará a declarar.
4. **97 de 190 partes no cuadran** consigo mismos (asistentes menos rechazos y duplicados frente a lo declarado), y 137 difieren del Kobo.
5. **El tablero de HSVG guardado en el `.pulso` está recortado** (sin agenda, brechas ni reemplazos): solo el tablero reconstruido trae las cifras de esta maqueta.
6. **CCSS: la hoja de agenda no escribe el titular de las reservas** (85 de 85; en HSVG 1,173 de 1,173): la cadena se deduce del código «R n.m».
7. **Cambio de aula con datos sucios**: «2» como aula agendada de CH 25 y «POMPEYANO» frente a «POMP» en R 154.1.

## 5. Datos que no se pudieron obtener

- Tiempo de lectura por fuente en Actualizar: no lo registra el job; `—`.
- Historia de gestiones por curso-horario: la hoja sobrescribe; solo hay acumulado, último resultado y fecha.
- Fecha original de una cita reagendada: la hoja la sobrescribe; P4 muestra horario del curso y cita vigente.
- Nombres exactos de las 8 hojas de la app en CCSS (inferidos de las reglas del publicador).

## 6. Falta tu decisión

Las diez preguntas de §0. Además, anotadas en sus checklists y sin cambio en esta maqueta: marco de matriculados o sexo
declarado (checklist del 10/09, ítem 47) y el orden de las secciones de la bitácora del 29/08 (ítem 18), que esta propuesta
resuelve con el esqueleto común.
