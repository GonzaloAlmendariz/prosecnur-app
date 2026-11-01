# Inventario del Planner para la sesión de definición — 2026-11-01

Insumo para la sesión larga de preguntas y correcciones con Gonzalo. **No es un plan:
no se revierte ni se construye nada hasta esa sesión.** El Planner no crece mientras tanto.

Principios del 1/11 (Gonzalo), contra los que se mide cada sección:

- **P-guía.** El Planner es la herramienta inicial: ayuda al analista a decidir qué hacer con su estudio y a ordenarlo.
- **P-primero.** Va primero en el tiempo: no lee nada de un módulo posterior.
- **P-dueños.** No quita responsabilidades: cada módulo define lo suyo. Textual: «el planner define el tipo de
  monitoreo o el tipo de cálculo de la muestra pero no define el universo o no define el equipo, eso lo hacen sus
  módulos especializados».
- **P-tipo.** Define el tipo de estudio, no su contenido.

Propuestas posibles por sección: **queda** (es del Planner), **vuelve** (a su módulo dueño) o **pregunta** (se
convierte en una pregunta al analista, sin sembrarse desde otros módulos).

La propuesta de diseño que acompaña este inventario (seis preguntas y la ruta del estudio) está en el artefacto
«Planner como guía»: https://claude.ai/artifact/BGTjLb9JkzWDxUtDXrT16H. Hay copia local en la carpeta común de artefactos.

## Resumen

| Sección | Qué hace | Lee de un módulo posterior | Responsabilidad ajena | Propuesta |
|---|---|---|---|---|
| Estudio › Identidad | Nombre, código y cliente; muestra la fase activa | Sí: Cálculo (`calc_muestra_estudio`) y Dashboard (`dashboard_config`) | No | **Queda**, sin siembra: pregunta 1 |
| Estudio › Perfiles | Tipo de estudio, variante, quién diseña la muestra, poblaciones; fija los modos | Sí: Monitoreo (familia), Material (campañas), Cálculo (macro familia), bases de Procesamiento (poblaciones) | No | **Queda**: preguntas 2 y 3 (es lo que ya funciona) |
| Estudio › Insumos | Registro de padrones, listados y marcos con su archivo | Sí: Cálculo (`source_bindings` de su marco) | No | **Pregunta**: lista de lo que el cliente debe entregar |
| Muestra | Universo y variables de cuota por población, de lectura | Sí: Cálculo y Monitoreo (`design_targets`) | **Sí**: universo y cuotas son de Cálculo | **Vuelve** a Cálculo de muestra |
| Equipo | Lista del equipo, editable y en Excel | Sí: Monitoreo (roster territorial, disponibilidad de aulas) | **Sí**: el equipo es de Monitoreo (P7) | **Vuelve** a Monitoreo |
| Códigos › Resultado | Catálogo de la visita, versionado | Sí: Material (`material_territorial_formatos`) | **Sí**: códigos y campos de la hoja de ruteo son de Material | **Vuelve** a Material |
| Códigos › Barrido | Status del barrido telefónico | Sí: Material (campaña telefónica) | **Sí**: de Material | **Vuelve** a Material |
| Cronograma | Fases y fechas; ventana de campo (propuesta) y etapa operativa | Sí: Hojas de ruta (etapa), Monitoreo (etapa, ventana, fases) | No | **Queda**, sin siembra: pregunta 5 |
| Bitácora | Registro de decisiones y lienzo | No | No | **Queda** el registro como pregunta 6; el lienzo, por decidir |

## Detalle por sección

### Estudio › Identidad

- **Qué hace.** Nombre, código y cliente del estudio. Desde 95794b622 muestra «Fase activa» (etapa · ventana) con un
  enlace a Cronograma.
- **De dónde lee.** Si no se declaró, `.planner_proyectar_estudio` toma el nombre de `estudio$nombre`, del título de
  Cálculo o del Dashboard, y el cliente de Cálculo o del Dashboard. Cálculo y el Dashboard son posteriores.
- **Quién lo lee del Planner.** La cabecera de Cálculo (`usePlannerIdentidad`), las hojas impresas de Material
  (`collection_territorial_papel.R`), la siembra de aulas (`collection_aulas_siembra.R`) y el Home.
- **Propuesta.** Queda; deja de sembrarse. Cálculo y el Dashboard dejan de tener su propia copia del nombre.

### Estudio › Perfiles

- **Qué hace.** Perfiles de recojo (territorial con UMP aleatoria o conveniencia, aulas con conglomerados o marco,
  telefónico, acreditación), quién diseña la muestra (Cálculo, Hojas de ruta, el cliente, cuotas) y poblaciones.
  Fija el modo de Cálculo, Material y Monitoreo (`/api/planner/modos`, P2).
- **De dónde lee.** Proyección por precedencia: familia de Monitoreo con ruta elegida, campañas de Material, macro
  familia de Cálculo. Las poblaciones salen de las unidades del perfil de Monitoreo o de las bases principales de
  Procesamiento (8ba68bce5). Todo eso es posterior.
- **Quién lo lee.** Cálculo y Monitoreo (aterrizaje en su modo), Material (campañas que abre y registro territorial),
  Hojas de ruta, el Home y el candado de versión mínima.
- **Responsabilidad ajena.** Ninguna: es el corazón de P-tipo.
- **Propuesta.** Queda. Cuidado: si se corta la siembra sin más, un proyecto viejo pierde su modo. Hace falta un
  «completar con lo que el proyecto ya dice» explícito y a la vista antes de cortar.

### Estudio › Insumos

- **Qué hace.** Registra insumos del cliente (padrón, listado, marco, otro) con el archivo del proyecto al que apuntan,
  su origen y la fecha.
- **De dónde lee.** Se siembra con los archivos que Cálculo leyó como marco (`source_bindings`). Es posterior.
- **Quién lo lee.** Nadie fuera del Planner.
- **Propuesta.** Pregunta: «¿qué tiene que entregar el cliente y para cuándo?», como lista de lo esperado. El archivo
  lo lee el módulo que lo usa. Por decidir en la sesión (Q5 del artefacto).

### Muestra

- **Qué hace.** Muestra por población el universo, la población del universo y las variables de cuota. Es de lectura
  y enlaza a Cálculo. Desde e3666de17 dice qué módulo la lee.
- **De dónde lee.** Lo declarado vive en `planner$perfiles[[i]]$poblaciones[[j]]$representatividad`. Lo escribe
  Cálculo de aulas por `.planner_declarar_representatividad` (ADR 0121 F4, `router_calc_muestra_representatividad.R`).
  Sin declarar, se proyecta desde `monitoreo_config$aulas_universitarias$design_targets`.
- **Quién lo lee.** Monitoreo de aulas, `monitoreo_aulas_representatividad_planner.R` (F4: 2c759f27a, 4b79bcd29),
  que cruza lo declarado con las celdas del diseño.
- **Responsabilidad ajena.** Sí: universo y cuotas son de Cálculo de muestra.
- **Propuesta.** Vuelve. Cálculo guarda la declaración en su propio estado y Monitoreo la lee de Cálculo. Los proyectos
  que ya la tienen en el Planner se leen de ahí como respaldo (migración de lectura, sin borrar). La sección sale del
  Planner cuando nadie la lea.

### Equipo

- **Qué hace.** Lista del equipo (código, nombre, rol, perfiles, activo), editable. Desde 9b3380299 se baja y se sube
  en Excel.
- **De dónde lee.** Se proyecta del roster territorial de Monitoreo (`enumerator_roster`) y de la disponibilidad de
  aulas. Es posterior.
- **Quién lo lee.** Material: el Excel de asignación territorial (`collection_territorial_asignacion.R`, e4ab73b02) y
  las plantillas de aulas (`collection_aulas_material.R`), por `.planner_equipo_de`.
- **Responsabilidad ajena.** Sí: el equipo es de Monitoreo (P7 revisada por Gonzalo), con el control de encuestadores
  y aplicadores.
- **Datos personales.** `planner$equipo$personas` lleva nombres. Lo cubren el anonimizador y el gate de datos
  personales (ec07d41d0). Esa cobertura se mantiene mientras haya proyectos con el campo.
- **Propuesta.** Vuelve. Material lee el roster de Monitoreo, con el Planner como respaldo de lectura para proyectos
  ya guardados. La plantilla Excel del equipo, si sirve, se muda a Monitoreo o se retira.

### Códigos › Resultado de la visita y › Status del barrido

- **Qué hace.** Dos catálogos versionados: los números de la visita (hoja de ruteo y consolidados) y los status del
  barrido telefónico. Un código no se borra, se retira; el rótulo es editable.
- **De dónde lee.** De Material: el catálogo de formatos territorial y la configuración de la campaña telefónica (o los
  14 status del RMS). Es posterior.
- **Quién lo lee.** Material, en `collection_territorial_formatos.R`, que toma lo declarado en el Planner antes que lo
  suyo.
- **Responsabilidad ajena.** Sí: códigos y campos de la hoja de ruteo son de Material.
- **Propuesta.** Vuelve. Material vuelve a ser la única fuente. Los proyectos que ya declararon códigos en el Planner
  se leen de ahí como respaldo hasta pasarlos, a la vista, al catálogo de Material.

### Cronograma

- **Qué hace.** Fases y fechas del cronograma (plan de trabajo de la Bitácora), con vistas Fases, Gantt y Lista. La
  franja de arriba declara la **ventana de campo** (propuesta, 265abc9de) y la **etapa operativa** (piloto o campo).
- **De dónde lee.** La etapa se siembra de Hojas de ruta y de Monitoreo territorial cuando están en uso. La ventana se
  siembra de las fases de Monitoreo (`strategy_phases`) o del inicio territorial (`phase_windows`), y si no, de la
  fase Campo del cronograma. Monitoreo y Hojas son posteriores.
- **Quién lo lee.** Hojas de ruta (`hojas_ruta_etapa.R`, etapa con la suya de respaldo) y Monitoreo («Alinear la fase»
  y «Alinear la ventana», `etapaDelPlanner.ts`).
- **Propuesta.** Queda; deja de sembrarse desde Monitoreo y Hojas. La ventana se siembra a lo más de la fase Campo del
  propio cronograma.

### Bitácora

- **Qué hace.** El registro del estudio y el lienzo, heredados de la Bitácora vieja.
- **De dónde lee.** De nada posterior.
- **Propuesta.** El registro queda como «¿qué decidimos y por qué?». Del lienzo se decide en la sesión si sale o queda
  como vista del cronograma.

## Unidades del 31/10 y el 1/11 que van contra los principios

No se revierten hasta la sesión (pedido de Meta B, 1/11).

| Commit | Qué hizo | Choca con |
|---|---|---|
| 9b3380299 | Equipo se baja y se sube en Excel | P-dueños |
| e3666de17 | Muestra dice qué módulo la lee | P-dueños |
| 8ba68bce5 | Poblaciones desde las bases de Procesamiento | P-primero |
| 265abc9de | Ventana sembrada desde Monitoreo (declararla sí es del Planner) | P-primero |

En el árbol quedan sin commitear cambios a `PlannerMuestra.tsx`, `PlannerCodigos.tsx` y sus tests. Crecen dos
secciones que salen; se descartan cuando la sesión lo confirme.

## Lo que no se puede romper al desmontar

- Los modos de Cálculo, Material y Monitoreo, que salen de los perfiles.
- La etapa que lee Hojas de ruta y el «Alinear» de Monitoreo.
- Los `.pulso` ya guardados con `planner/v1` y su candado de versión mínima: toda mudanza es **migración de lectura,
  sin borrar** (el dueño lee lo suyo y, si falta, lo que el proyecto tiene en el Planner).
- La cobertura del anonimizador sobre `planner$equipo$personas`, mientras exista el campo en proyectos guardados.
