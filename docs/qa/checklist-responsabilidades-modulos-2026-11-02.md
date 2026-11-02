# Checklist — responsabilidades y traspasos entre módulos (2026-11-02)

Dirección de Gonzalo (noche del 1/11), textual: «que las vistas de algunos
módulos se vean incluso mejor en general: material de campo (imprimibles y excel
que campo llena como asignaciones, las llena al inicio para que se usen en campo
pero no les da seguimiento, de eso se encarga monitoreo), que se entienda mejor
con cálculo de muestra (cálculo de muestra de todo menos de territorial
aleatorio), generador de hojas de zona (generador de cálculo de muestra o
selección de los territorios para ser impresos y ser pasados a materiales y que
monitoreo tenga claro las metas) y monitoreo (seguimiento de campo en términos de
avance, control del equipo, control de calidad, reporte de avance, ritmo, etc).
Que se hable mejor y tengan mejor claro sus responsabilidades».

## La cadena

```
Cálculo de muestra (todo menos territorial aleatorio) ─┐
Hojas de ruta (territorial aleatorio: sortea y elige) ─┴→ Material de campo → Monitoreo
                                                        (imprime y llena     (avance, equipo,
                                                         al inicio; sin      calidad, reporte,
                                                         seguimiento)        ritmo; conoce las metas)
```

| Módulo | Recibe de | Entrega a | Responsabilidad, en una línea |
|---|---|---|---|
| Cálculo de muestra | el estudio (marco) | Material (plan con titulares y reemplazos) y Monitoreo (metas) | Calcula y selecciona la muestra de todo salvo el territorial aleatorio |
| Hojas de ruta | el marco territorial (INEI) | Material (envío de titulares y reemplazos) y Monitoreo (metas por distrito) | Sortea y elige los territorios que se van a imprimir |
| Material de campo | Cálculo u Hojas de ruta | Monitoreo (entrega con recibo) | Produce imprimibles, accesos y planillas que campo llena al inicio; no hace seguimiento |
| Monitoreo | Material (entrega) y Cálculo/Hojas (metas) | el cliente (reporte de avance) | Sigue el campo: avance, equipo, calidad, reporte, ritmo |

## Fricciones

Cómo se midió: lectura de `lib/modules.ts` (manifiesto que pinta Home y chrome),
de la tarjeta de cada módulo en `features/home/moduleCardModel.ts` y un escaneo de
las cadenas visibles de cada módulo que nombran a otro o a una responsabilidad
ajena (`scratchpad/escanear_responsabilidades.py`, 102 cadenas). Dueños: Cálculo y
Monitoreo → sesión Monitoreo-Cálculo; Hojas de ruta y Material → sesión Hojas;
manifiesto, Home, chrome y enlaces entre módulos → Revamp (esta sesión).

| # | Fricción | Dónde vive | Dueño | Estado |
|---|---|---|---|---|
| R1 | El manifiesto dice que Cálculo selecciona «manzanas o viviendas» y tiene «procedimientos por… territorio»: contradice que el territorial aleatorio es de Hojas de ruta | `lib/modules.ts` › `calc-muestra` (`blurb`, `features`) | Revamp | ⛔ bloqueado: `lib/modules.ts` tiene cambios sin commit de otra sesión (retiro del Planner) |
| R2 | El manifiesto dice que Cálculo «se enlaza con Monitoreo» y se salta a Material, que es quien recibe el plan para producir el material | `lib/modules.ts` › `calc-muestra` (`blurb`, último `feature`) | Revamp | ⛔ bloqueado (mismo motivo que R1) |
| R3 | El manifiesto presenta Hojas de ruta como «hojas imprimibles… paquete listo para impresión»: imprimir es de Material. Su propia UI ya lo dice bien («Envía la muestra a Material de campo, que produce las fichas, las hojas de zona y el paquete») | `lib/modules.ts` › `hojas-ruta` (`blurb`, `features`) | Revamp | ⛔ bloqueado (mismo motivo que R1) |
| R4 | Cálculo dice que Monitoreo «prepara fichas QR/PDF»: las fichas son de Material | `calcMuestra/universidad/salidas/SalidasMonitoreoTab.tsx:154` | Monitoreo-Cálculo | ☑ (2026-11-02): «para que Material imprima las fichas QR y Monitoreo siga el avance» |
| R5 | Monitoreo de cursos-horario declara como fuente propia «Fichas QR: enlace de Kobo, QR, Word/PDF»: es material, no seguimiento | `monitoreo/core/monitoreoRegistry.ts:141` | Monitoreo-Cálculo | ☐ |
| R6 | Cálculo entrega su plan directo a Monitoreo («Plan para Monitoreo», «Pase a Monitoreo») y Material también lee la selección de Cálculo («Origen»): Monitoreo tiene dos entradas y la UI no dice cuál manda | `calcMuestra/universidad/salidas/SalidasMonitoreoTab.tsx:108-183`; `recopiladores` › Unidades › Origen; `monitoreo/profiles/aulas/insumos/EntregaDeMaterial.tsx` | Monitoreo-Cálculo + Hojas | ☐ decisión de flujo: ¿Cálculo → Material → Monitoreo, con las metas aparte? |
| R7 | El equipo de campo se asigna en dos lugares: Material territorial («Asignación del equipo», lee la lista de Monitoreo) y Monitoreo de aulas («Asignación de aplicadores», con sorteo de empates) | `recopiladores/territorial/AsignacionEquipo.tsx`; `monitoreo/profiles/aulas/AulasAsignacionDeAplicadores.tsx` | Monitoreo-Cálculo + Hojas | ☐ decisión: por la dirección, la asignación inicial es de Material (planilla que campo llena al inicio) y el control del equipo, de Monitoreo |
| R8 | Material › Correo › Contactos muestra «efectivos del corte», cruces y tablero de perfil: es lectura de avance, que es de Monitoreo | `recopiladores/correos/contactos/` (`CruceDeVariables`, `TableroDePerfil`, `FiltrosActivos`) | Hojas | ☐ revisar si es selección de destinatarios (de Material) o avance (de Monitoreo) |
| R9 | El traspaso de Cálculo a Hojas de ruta dice que el territorial «se diseña mejor» en Hojas: suena a opción, cuando el territorial aleatorio vive sólo allí | `calcMuestra/general/TerritorialHandoff.tsx:13` | Monitoreo-Cálculo | ☑ (2026-11-02): «El territorial aleatorio se diseña en Hojas de Ruta» y el texto dice que Cálculo cubre todo menos eso; el botón «Abrir Hojas de Ruta» se queda |
| R10 | El recibo de la entrega de Material no enlazaba a Monitoreo ni decía que el seguimiento sigue allá | `recopiladores/DeliverySection.tsx` | Revamp (enlace entre módulos) | ◐ en código: «Material termina aquí. Monitoreo trae esta entrega en Insumos › Fuentes…» + «Abrir Monitoreo» |
| R11 | El envío de Hojas de ruta a Material sí enlaza a la campaña territorial una vez enviado | `hojasRuta/mapa/seleccion/SalidasPanel.tsx` | — | ☑ sin cambio: ya conforme |
| R12 | Material telefónica explica qué lee Monitoreo del Sheets del barrido y que una fila sin Status «sale del avance»: es correcto (Material prepara la planilla y avisa qué la rompe) | `recopiladores/telefonica/SeccionesTelefonicas.tsx:232-245` | — | ☑ conforme: no es seguimiento, es el contrato de la planilla |

## Traspaso Material → Monitoreo por Sheets

Dato de Gonzalo (2026-11-02), textual: «en material de campo es muy importante
tener conexión con sheets para poder construir sobre el enlace las tablas de
seguimiento que luego monitoreo supervisará y leerá». El traspaso, entonces, es:
**Material construye las tablas de seguimiento sobre el Sheets del estudio;
Monitoreo las lee y las supervisa.** Qué dice hoy la UI de cada lado (escaneo de
cadenas visibles, 2026-11-02):

| # | Campaña | Lo que dice Material | Lo que dice Monitoreo | Qué falta para que se lea claro | Dueño | Estado |
|---|---|---|---|---|---|---|
| R13 | Cursos-horario (aulas) | No nombra Sheets. Entrega «Plantillas del equipo» en `.xlsx`: «En blanco… Campo las llena; la lectura y el seguimiento siguen en Monitoreo» (`recopiladores/PlantillasDelEquipo.tsx:55`) | Es Monitoreo quien construye las tablas: «Generar libro», «Leer libro llenado» (`aulas/AulasOperationsPanel.tsx:280-294`), «Los dos Sheets del operativo», «Publicar al Sheets escribe aquí» (`aulas/AulasDosSheets.tsx:40-67`), «Pintar en el Sheets de agendación» (`aulas/AulasRefuerzosPedidos.tsx:98`) | **Responsabilidad invertida**: generar y publicar el libro del operativo debería vivir en Material (conectado al enlace del estudio) y Monitoreo, leerlo y supervisarlo. Material necesita la conexión a Sheets y un «Construir las tablas en el Sheets»; Monitoreo, decir «Lee el Sheets que armó Material» con enlace de vuelta | Hojas (Material) + Monitoreo-Cálculo | ☐ decisión de mudanza: qué acciones de `AulasOperationsPanel`/`AulasDosSheets` pasan a Material (generar, publicar, pintar) y cuáles quedan en Monitoreo (leer, supervisar, refuerzos pedidos) |
| R14 | Telefónica | Sí lo dice: «Qué lee Monitoreo del Sheets del barrido y qué no se debe tocar», «Lo que lee Monitoreo», «No cambies los encabezados de la fila 1 ni la llave» (`recopiladores/telefonica/`) | Conecta el Sheets como fuente: «Sheets define universo y barrido», «Registrando fuente Sheets», «Falta base Sheets» (`telefonico/TelefonicoMonitoreoPage.tsx`) | Material explica el contrato, pero no se ve que **construya** la planilla sobre el enlace (se lee como instrucciones para un Sheets ajeno); Monitoreo pide «conectar Sheets» sin decir que viene de Material. Falta que Monitoreo diga de dónde viene y enlace a Material › Barrido | Hojas (Material) + Monitoreo-Cálculo | ☐ |
| R15 | Territorial | Imprime «Hoja de consolidados» y fichas por UMP; no nombra Sheets | Abre el Sheets de la fuente (`territorial/TerritorialSourceConsole.tsx:1037`) | Ningún lado dice quién arma la tabla de seguimiento en Sheets ni que Monitoreo la lee de Material | Hojas (Material) + Monitoreo-Cálculo | ☐ |

Lo transversal (vocabulario) que se desprende, a aplicar cuando se desbloquee el
manifiesto: el `blurb` de Material debe decir que **construye las tablas de
seguimiento en el Sheets del estudio** y el de Monitoreo que **las lee y
supervisa** (hoy: «Seguimiento del trabajo de campo a partir de Kobo y
SurveyMonkey», sin Sheets).

## Pendiente de medir

- Recorrido en vivo con los proyectos de referencia (hsvg2026 para cursos-horario,
  acnur_acg para territorial, acnur_pdm para telefónico) para confirmar R4 a R8
  en pantalla y no sólo en el código.
- Tarjetas del Home: hoy describen bien a Hojas («Genera las rutas para el equipo
  de campo») y a Material; revisarlas cuando el Planner commitee su panel (no se
  toca `features/home` hasta entonces).
