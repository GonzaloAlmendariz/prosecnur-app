# Arquitectura de campo: formatos, límite Material / Monitoreo y Planner

Doc vivo del loop de diseño y arquitectura que pidió Gonzalo el 2026-10-31. Lo mantiene la sesión de Hojas de ruta /
Material de campo. La versión para leer es el artefacto «Papel y Excel de campo»
(https://claude.ai/artifact/Rw3NyeQv5kF6UXizMpkYV7); este doc es su fuente y su memoria.

Fuentes que lo alimentan: `docs/qa/checklist-formatos-campo-2026-10-31.md` (C1–C8, D1, D2),
`docs/qa/contrato-equipo-territorial-2026-10-31.md`, ADR 0118 (y su enmienda del 31 oct), ADR 0121, y los aportes de
las sesiones «Monitoreo: cierre de Aulas y pendientes del loop» y «Meta B: revamp completo de la app».

## 1. Lo que dijo Gonzalo (textual)

Sobre cómo trabaja campo:

- «la asignación no suele hacerse desde la aplicación, sino que hay que generar una especie de documento Excel»
- «el equipo de campo no usa la app, o por lo menos le va a costar mucho aprenderla. Entonces, a veces es mucho más
  sencillo crear Excels en cierto formato que ellos puedan llenar y que nosotros luego podamos leer»
- «Esto es algo que hay que definir bien si va a ser finalmente monitoreo o lo vas a hacer tú. O lo vas a hacer tú y
  se lo vas a dar a monitoreo, porque a veces hay reasignaciones, las cosas pueden cambiar»
- «con respecto también al Excel o al PDF del recorrido o el PDF de consolidado, creo que has inventado tus propios
  mecanismos y tus propios PDFs, lo cual no está mal, pero también te sugiero que revises este ACNUR territorial»

Sobre el alcance:

- «hay mucho por hacer y no sé si necesariamente todo le pertenece a tu sesión»
- «esto afecta a todos los monitores y sus hojas o insumos para aplicar en campo o hacer seguimiento y su relación con
  el módulo de materiales»
- «bitácora en vez de llamarse bitácora puede llamarse planeador o algo más profesional como planner y puede ayudar a
  definir los campos, y un poco todo para que todos los módulos se conecten entre sí»

Sobre Material:

- «Material no tiene que ver con costos y precios, de eso se encarga otra persona»
- «ese módulo solo recibe la lista entonces debe mostrar mejor cada pestaña de una forma más profesional»

Sobre la forma de trabajar:

- «antes dame el plan de lo que piensas hacer en un artefacto porque no entiendo»
- «Arma un loop de diseño y arquitectura sólido, aprovecha para organizar todo lo que te he dicho muy bien y no pares
  de mejorarlo y hacerlo más intuitivo y ordenado cada 3 mins»

## 2. Lo que ya decidió

| Decisión | Respuesta de Gonzalo | Dónde quedó |
|---|---|---|
| I3: dónde se escribe el equipo de campo | «I3: equipo en Material» | Asignación UMP → código en Material (500e7a372) |
| Qué lista de encuestadores manda | «La de Monitoreo» | `enumerator_roster`; Material sólo la lee, sin DNI |
| C2: quién genera y lee el Excel de asignación | «Sí, Material» | Excel de asignación (6adbef00e) |
| D1 y D2: hojas de ruteo y consolidados; Hoja del día | «Sí, D1 y D2(a)» | Aprobado, sin construir: espera el visto bueno al plan |

## 3. Lo que falta decidir

Se dibuja en el artefacto, sección «Lo que necesitamos que decidas». Al día de hoy:

1. Visto bueno al plan para construir D1 y D2(a).
2. Conteos del consolidado transcritos en el Excel de asignación.
3. El «Estado» que llena campo: leerlo como declarado o quitarlo (C7).
4. El importador de la lista respeta el código del Excel.
5. Quién revisa el barrido telefónico del RMS (C8).
6. F4: el plan de campo desde la foto.
7. Adelantar «asignado frente a observado» (B3).
8. Dónde vive la lista de encuestadores (Monitoreo, Material o Planner).
9. Abrir el ADR del Planner.

## 4. Estructura (se completa tick a tick; ver el tablero del loop)

- Regla de reparto entre módulos.
- Circuito: lo que sale a campo, lo que llena campo, lo que vuelve.
- Perfil por perfil.
- Planner: campos del estudio, dueño, consumidores, dónde viven hoy y cómo se mudan.
- Contratos de lectura entre módulos.
- Glosario: una palabra por cosa.
- Formatos de papel y Excel, con maqueta.
- Datos personales.
- Hoja de ruta por fases y sesiones.
