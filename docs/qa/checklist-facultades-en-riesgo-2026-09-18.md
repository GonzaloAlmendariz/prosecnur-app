# Facultades en riesgo + la facultad declarada que no se pierde — 2026-09-18

Pedido de Gonzalo, textual:

> «Sí, hazla. Y ademas recuperar la infor sobre su facultad declaradsa y
> segurate que no la peirda y que la actualice cada vez que guarda el documetno
> y se actualiza la data. Adeas la hoja de facultades en riesgo debe tener
> bastante contexto util, como las aulas que estan agedgadas, cuanot es eprar
> tener con ellas, si eso nos deja al maejor por debao d ela meta o por encima.
> que tal lejos estan als agendaicones, si ya se aplicaonr todas sus aulas,ect
> hay que ser bastante precsos ton codas es informaicon»

Contexto: el `.pulso` guardado el 2026-09-18 a las 10:14 publicó el libro con la
hoja «Control de facultad» muda, porque `source_mapping$faculty_var` y `tramos`
habían quedado vacíos. El del 2026-09-16 los traía (`datos_demo/P7`, 15
etiquetas, 2 tramos).

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| A1 | Hoja «Facultades en riesgo» en el libro publicable | `api/R/carga_aulas_libro_riesgo.R` (nuevo) + los 6 puntos del publicador + la lista blanca de pestañas | ☑ |
| A2 | …con las aulas AGENDADAS de cada facultad | `.malr_citas_pendientes()`, que reproduce `agend` del motor pieza por pieza | ☑ |
| A3 | …cuánto se espera tener con ellas | columna «Esperado de lo agendado», y «Aforo agendado» al lado | ☑ |
| A4 | …si eso deja por encima o por debajo de la meta | «Al cierre» + «Sobre / bajo la meta», con numFmt de signo en xlsx y Sheets | ☑ |
| A5 | …qué tan lejos están las agendaciones | «Próxima cita», «Última cita» y «Días hasta la última» | ☑ |
| A6 | …si ya se aplicaron todas sus aulas | las cuatro columnas + «Estado del campo» + reservas libres | ☑ |
| A7 | Recuperar la facultad declarada en el proyecto vivo | **te toca a ti**: el panel de la app. El catálogo está abajo | ◐ |
| A8 | Que NO se pierda al guardar | `router_monitoreo.R`: el POST de config ahora pasa `previous`. Rojo reproducido por HTTP y luego verde | ☑ |
| A9 | Que se reafirme en cada sync de datos | pendiente: con A8 ya no se pierde, falta que se REPONGA sola si alguna vez faltó | ☐ |
| A11 | Seguimiento de refuerzos: distinguir reemplazo de cadena de refuerzo «al aire» | por decidir — el plan tiene los campos y nadie los escribe | ☐ |
| A10 | Gate del área | `make gate-area AREA=aulas` + `gate-front AREA=monitoreo/profiles/aulas` | ☐ |

## A11 — el pedido nuevo del 2026-09-18, con lo ya medido

> «en consultas refuerzo no le has hecho seguimiento a los refuerzos que
> establecimos, muchos ya se aplicaron y no hay forma de distinguir tan bien si
> un reemplazo fue por reemplazo orgánico o en verdad fue un reemplazo al aire
> que fue seleccionado por el selector de refuerzos que escoge el mejor refuerzo
> de entre los reemplazos al aire o disponibles»

Medido sobre `HSVG26ULT2.pulso` del 2026-09-18:

| Cifra | Valor |
|---|---|
| Filas del plan | 1 392 (174 titulares · 1 173 reservas de cadena · 45 extras) |
| En juego hoy | 155 titulares · **19 reservas de cadena** · 45 extras |
| Partes de campo | 150 — 136 de titulares, **11 de reservas de cadena, 3 de extras** |
| Filas con `activation_origin` | **1** de 1 392 (vale `complemento`) |
| Filas con `activation_reason` | **0** de 1 392 |
| Filas con `replacement_reason` | **0** |

**El diagnóstico.** El plan YA tiene los campos donde vive esa distinción
—`activation_origin`, `activation_reason`, `activated_for`, `activated_at`,
`replacement_reason`— y están vacíos: quien activa una reserva no los escribe.
Así que **14 aulas ya aplicadas no son titulares y de ninguna consta por qué se
activó**. No es que la vista no lo muestre: es que el dato no se guarda, y una
vista no puede mostrar lo que nadie escribió.

Ojo con el otro eje: `operational_status` vale `planificada` en las 1 392 filas
—lo aplicado vive en los partes de campo, no en el plan—, así que el seguimiento
de refuerzos se arma cruzando plan × partes, no leyendo el estado del plan.

**Bloqueado, no pendiente**: la pantalla donde esto se ve
(`AulasSeccionConsultas.tsx`, `AulasPopoverReemplazo.tsx`) y el motor de
agendación (`monitoreo_aulas_agendada.R`) los lleva otra sesión sobre este mismo
árbol. Escribir la procedencia en la activación toca su camino y hay que
acordarlo antes, no en paralelo.

## Lo aprendido, para no reinvestigarlo

- `monitoreo_aulas_normalize_config()` **sí conserva** `faculty_var`, `faculty_labels`
  y `tramos`: probado con la config del 16/09, una y dos pasadas. El whitelist no
  es la causa.
- El cruce con el mapping del 16/09 sobre los datos del 18/09 da **2.745
  comparables · 2.608 coinciden · 137 declaran otra facultad (5,0 %)**.
- Señal de catálogo correcto: coincidencia ~95 %. Corrido una posición: ~1 %.
  Sirve como verificación de una auto-declaración.


## El catálogo que hay que volver a declarar (A7)

Variable: **`datos_demo/P7`**. Códigos → facultad:

| | | | |
|---|---|---|---|
| 1 ARQUITECTURA Y URBANISMO | 2 ARTE Y DISEÑO | 3 ARTES ESCÉNICAS | 4 CIENCIAS CONTABLES |
| 5 CIENCIAS E INGENIERIA | 6 CIENCIAS SOCIALES | 7 CIENCIAS Y ARTES DE LA COMUNICACIÓN | 8 DERECHO |
| 9 EDUCACION | 10 ESTUDIOS GENERALES CIENCIAS | 11 ESTUDIOS GENERALES LETRAS | 12 GASTRONOMÍA, HOTELERÍA Y TURISMO |
| 13 GESTIÓN Y ALTA DIRECCIÓN | 14 LETRAS Y CIENCIAS HUMANAS | 15 PSICOLOGÍA | |

Con este catálogo, sobre los datos del 18/09, el cruce coincide en **95,0 %**.
Un catálogo corrido una posición da ~1 %: esa es la señal de que está bien puesto.
