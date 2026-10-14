# Revamp — flujo SurveyMonkey → Formularios (2026-10-14)

Tipo: Dirección de revamp visual
Estado: Vigente
Fecha: 2026-10-14
Autoridad: Dirección de diseño congelada; no reemplaza un ADR

Pedido del usuario: «A la UI le falta pulir muchísimo» (sobre la vista previa de la campaña: un muro de 28 viñetas). Checklist de origen: `docs/qa/checklist-importacion-sm-arte-2026-10-14.md` (U1–U8, U10, U11, U15 y la cara de UI de H4). Identidad: «Instrumento sereno» (`branding/direccion-creativa-v3.md`): el dato aparece antes que el chrome, acento modular sólo en contexto/selección/foco, éxito/alerta/peligro no cambian con el módulo, voz en sentence case sin `snake_case` ni inglés.

Dimensión: todo vive en **Formularios → panel** (diálogos `PulsoDialog` sobre Radix) y en la biblioteca del módulo. No se crea navegación nueva.

## Problema y tarea primaria por superficie

### 1. Vista previa de la campaña (`CampanaVistaPreviaResumen`) — prioridad 1

Problema: decide «¿esta encuesta es una campaña de mi instrumento?» y hoy obliga a leer una lista plana de enunciados largos; el veredicto se pierde.

Dirección:
- **Veredicto primero**: una línea de estado con el color semántico (éxito ≥ 80 % sin faltantes relevantes; alerta ≥ 80 % con faltantes; peligro < 80 %: «no es una campaña») + **medidor de cobertura** (barra con el umbral del 80 % marcado) y «73 de 74 preguntas calzan».
- **Diferencias como resumen, no como lista**: tres contadores pares (Quedarán vacías · No entran · Ambiguas) en un grupo `equal`; cero se muestra en gris como «ninguna».
- **Detalle plegable**: cada grupo abre una lista **agrupada por sección** (título de página), filas de una línea: código (`p13_1`, mono, chip) + enunciado truncado a 1 línea con el texto completo al expandir o en `title`. Con ≤ 5 ítems el grupo abre por defecto; con más, cerrado y con «Ver las 28».
- Con bloqueo (< 80 %) el detalle queda cerrado: lo útil es la indicación (importarla como formulario propio + Equivalencias) con una acción directa, no la lista.

Capacidad: 0 diferencias (estado «calza completa»), 1, pocas (≤ 5, abierto), muchas (28+, cerrado, scroll del diálogo como único dueño, sin scroll anidado).

### 2. Diálogo «Agregar campaña complementaria» — prioridad 1

Ya pliega el selector al elegir (U15). Falta: explicación en dos líneas (no un párrafo), selector con **respuestas y número de preguntas** por encuesta (U5), estado de carga con esqueleto, foco al resultado.

### 3. Diálogo «Traducir encuesta de SurveyMonkey» — prioridad 2

- **U6 voz**: fuera «required», «validations», «Huella», «Perfil surveymonkey_api_xlsform/v1». Lo técnico va a un «Detalles técnicos» plegado, con copia explícita.
- **U8 un solo conteo**: «26 preguntas · 74 campos» con una ayuda de qué es cada uno; el editor usa el mismo par.
- **U4**: el chip «Conexión» refleja el estado real (lista, error, sin token).
- **U2**: con 401, ofrecer los otros perfiles guardados en el mismo lugar («Usar perfil Principal») o enlazar a Configuración › Conexiones; nada de «Revisa o genera un token nuevo» solo.
- **U5**: el buscador muestra respuestas, preguntas y fecha.
- **H4 / U7**: aviso honesto «SurveyMonkey no comparte la lógica de saltos por su API» + la sugerencia del consentimiento (`POST /api/xlsform-editor/surveymonkey/sugerencias-logica`) como tarjeta «Aplicar: si responde No → fin de encuesta» que crea la regla en la lógica visual existente; el resumen deja de prometer «saltos».

### 4. Biblioteca de formularios — prioridad 2

- **U1**: el «+» desplaza y enfoca «¿Cómo quieres empezar?».
- **U10**: la cabecera del editor no dice «Sin avisos» si la tarjeta dice «Lógica: revisión necesaria»: una sola fuente para el estado.
- **U11**: sugerir el público desde el título SM («Estudiantes», «Docentes», «Administrativos», «Egresados») como opción preseleccionable, no asignado en silencio.
- Tarjeta con campañas: bloque «Principal + N campañas» alineado al ritmo de la tarjeta, sin desplazar la grilla pareja.

## C1 — geometría declarada

| Grupo (`data-qa-geometry-group`) | Contrato | Miembros |
|---|---|---|
| `xlsform-campana-veredicto` | `intrinsic` | línea de estado + medidor |
| `xlsform-campana-contadores` | `equal` | Quedarán vacías · No entran · Ambiguas |
| `xlsform-campana-complementaria` | `intrinsic` | diálogo (existente) |
| `xlsform-import-sm-resumen` | `intrinsic` | resumen previo a crear |

## Criterio de éxito

- En 1440×1000 y 1024×600 el veredicto y los contadores se ven sin scroll; un solo dueño de scroll por diálogo.
- Ninguna palabra técnica en inglés ni `snake_case` en superficie (salvo códigos de variable en chip mono).
- `ui-quick-check --require-geometry` sin `geometry-undeclared` en los grupos nuevos; capturas antes/después distintas.
- Revisión de `qa-visual-desktop` y veredicto de `verificador`.
