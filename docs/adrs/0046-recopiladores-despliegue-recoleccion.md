# ADR 0046: Recopiladores prepara el despliegue de recolección

Estado: Aceptado

Implementacion: Completa

Fecha: 2026-07-27; aceptado el 2026-07-29; implementado el 2026-07-30

## Contexto

La ruta `/recopiladores` funciona hoy como generador de enlaces Kobo, QR y
fichas imprimibles para cursos-horario. La UI tiene identidad de módulo, pero
el estado y los endpoints pertenecen a Monitoreo de aulas. En paralelo,
Monitoreo descubre y clasifica collectors reales de SurveyMonkey. El campo
`collector_id` representa por momentos un canal remoto y por momentos una
unidad curso-horario.

La ampliación a acreditación multiactor, establecimientos, listados y otros
operativos no puede construirse extendiendo `MonitoreoAulasPlanRow` ni
suponiendo que Kobo y SurveyMonkey ofrecen el mismo concepto.

La salida actual tampoco constituye un motor de materiales: la ficha y portada
están fijadas en JSX y “Generar PDF” ejecuta `window.print()`. No existe una
plantilla versionada, preview autoritativa, job de render, checksum, manifest ni
artefacto registrado.

SurveyMonkey posee collectors remotos tipados, recipients, mensajes y
estadísticas. Kobo posee projects/assets desplegados, web-form links,
prefills y permisos. Puede personalizar un link con
`d[collectorID]=valor`, pero cada URL resultante no es una entidad remota con
lifecycle propio. Además, Prosecnur es local-first: credenciales, efectos
remotos y artefactos generados deben conservar fronteras explícitas.

La decisión afecta ownership entre módulos, endpoints, estado `.pulso`,
integraciones salientes, privacidad y compatibilidad con ADR 0019.

## Decisión

Recopiladores es el módulo responsable de preparar y
entregar el **despliegue pre-campo de la recolección**.

Su entrada será un plan/listado ya decidido y una revisión local inmutable del
instrumento. Su salida será un `collection_deployment/v1` versionado con target
de proveedor, bindings entre unidades y accesos, cobertura, artefactos y recibo
de handoff a Monitoreo.

Se adoptan estas reglas:

1. `provider_collector_id`, `logical_collector_id`, `recipient_id`, `unit_id`,
   `operator_id` y `access_id` son identidades separadas. El campo Kobo
   `collectorID` puede transportar la identidad lógica sin convertirse por ello
   en un collector remoto del proveedor.
2. Los providers se modelan mediante capabilities. SurveyMonkey puede aportar
   un collector remoto; Kobo aporta recopiladores lógicos personalizados sobre
   un perfil local de acceso y un asset/deployment, sin presentarlos como
   collectors remotos nativos.
3. La V1 solo descubre/vincula targets existentes y genera accesos/materiales
   localmente. No crea collectors, recipients, mensajes, permisos ni campañas
   remotas. `remote_write=disabled_v1` aplica a todos los adapters, aunque el
   proveedor o un cliente subyacente ya soporte la operación.
4. Kobo y SurveyMonkey permiten generación local condicionada cuando el usuario
   aporta una URL base válida: Kobo mediante `d[field]`; SurveyMonkey Web Link
   mediante Custom Variables ya definidas. La API es opcional para descubrir o
   verificar esos targets, pero obligatoria para crear recursos remotos y para
   recuperar desde el proveedor links nativos de recipients. Como alternativa,
   estos links ya aprovisionados pueden entrar mediante un handoff manual; nunca
   se fabrican localmente.
5. Toda futura mutación remota separa `preview` y `commit`, exige confirmación
   explícita y produce un recibo idempotente. Guardar estado local nunca ejecuta
   efectos externos.
6. Recopiladores posee `collection_plan/v1` y
   `collection_deployment/v1`; Monitoreo consume el deployment y conserva
   agenda viva, reprogramaciones, reemplazos activados, sincronización,
   respuestas, brechas, calidad y cierre.
7. La migración es aditiva. Los endpoints y keys de aulas v1 permanecen y un
   adapter siembra el contrato nuevo desde `monitoreo_aulas_plan` cuando sea
   necesario.
8. Plan, hashes, IDs remotos no secretos, bindings mínimos y handoff pueden
   persistir en `.pulso`. Tokens, PII duplicada, links sensibles completos y
   artefactos PDF/Word/ZIP/QR/TSV quedan fuera salvo una política específica.
9. La UI conserva el módulo `/recopiladores` y usa cuatro secciones: Plan,
   Accesos, Materiales y Entrega, enlazables por dirección.
10. Recopiladores posee la semántica del material: templates, bloques, bindings,
    instancias, agrupación y recibos ligados al deployment. Un renderer puro
    compila la instancia; Archivos registra y guarda el binario; ninguno de esos
    servicios decide el contenido operativo.
11. Materiales será un editor semántico basado en presets y un registro cerrado
    de bloques/bindings. No será un editor PDF universal ni un canvas libre tipo
    Canva/Acrobat.
12. La preview autoritativa y el PDF final usan el mismo compilador. El render
    final corre como job y retorna `file_id`, MIME, SHA-256, page count y un
    manifest único. Binarios y previews regenerables quedan fuera del `.pulso`.
13. El QR se genera en el backend R con el paquete CRAN `qrcode`, elegido por ser
    R puro y no exigir librerías de sistema que el R embebido de Electron no
    puede garantizar. El frontend conserva su generador solo para preview no
    autoritativa, y el estado deja de persistir data-URLs de QR.
14. "El mismo compilador" es literal: la preview rasterizada ejecuta el mismo
    código `grid` del PDF cambiando únicamente el device a PNG. No se rasteriza
    el PDF ni se depende de ImageMagick.

El handoff idempotente quedó implementado. Recopiladores posee la preparación
pre-campo —plan, target, accesos, materiales, deployment y recibo— y proyecta el
deployment localmente hacia el contrato compatible de aulas. Monitoreo consume
esa proyección y conserva agenda viva, reprogramaciones, reemplazos activados,
sincronización, respuestas, brechas, calidad y cierre. Repetir el mismo handoff
no muta la revisión ni su sello temporal y nunca ejecuta efectos remotos.

La revisión parcial exigida por este ADR quedó materializada en
[ADR 0019](0019-monitoreo-aulas-universitarias.md). Los keys y endpoints de
aulas v1 permanecen como compatibilidad aditiva, no como autoridad del nuevo
recorrido de preparación.

## Consecuencias

Beneficios:

- Recopiladores obtiene una responsabilidad autónoma y reusable;
- se elimina la ambigüedad entre canal, unidad, operador y recipient;
- Kobo y SurveyMonkey conservan sus diferencias reales;
- los deployments se vuelven reproducibles, versionados y auditables;
- las fichas dejan de estar hardcodeadas y se vuelven templates reutilizables;
- Monitoreo deja de preparar el mismo material que después debe seguir;
- nuevos perfiles reutilizan contratos en lugar de copiar el flujo de aulas.

Costos y riesgos:

- la extracción de la pantalla monolítica y el estado/API propios amplían la
  superficie que debe mantenerse;
- ADR 0019 quedó actualizado parcialmente al materializar el handoff;
- permanece un periodo de doble lectura compatible entre schemas v1 y v2;
- links individuales pueden contener PII o comportarse como credenciales;
- el aprovisionamiento remoto futuro exige idempotencia, permisos, límites,
  consentimiento y recuperación de fallos parciales;
- los adapters deben inspeccionar capabilities en lugar de asumirlas por
  proveedor o plan;
- el editor y el compilador de layout son superficies nuevas con riesgo de
  overflow, drift de preview y scope creep;
- el contrato fino del renderer PDF quedó congelado y ahora exige compatibilidad
  explícita para futuras extensiones.

Se descarta convertir Recopiladores en herramienta de emailing/SMS en V1. Se
descarta también crear un asset Kobo por unidad: un deployment puede producir
múltiples accesos parametrizados.

## Cumplimiento

- JSON Schema o validadores equivalentes para `collection_plan/v1` y
  `collection_deployment/v1`.
- Tests de identidad separada, fingerprints, `stale`, migración legacy,
  round-trip `.pulso` y handoff idempotente.
- Fixtures HTTP sin red para SurveyMonkey y Kobo; CI no usa credenciales.
- Checks que prueben que navegación/guardado no crea, despliega, envía ni
  modifica permisos.
- Secrets scan sobre `.pulso`, logs, manifests y artefactos.
- Outputs registrados como archivos descargables fuera del `.pulso`.
- Paridad funcional y QA visual del adapter `aulas_v1` antes de añadir otros
  perfiles.
- SurveyMonkey y Kobo exponen acciones solo cuando el target declara la
  capability correspondiente.
- Un Web Link SurveyMonkey con variables verificadas puede multiplicarse
  localmente sin API por unidad; email/SMS nunca fabrica recipient links.
- Una landing Kobo, un fragmento administrativo o un deployment no activo
  bloquean la generación de QR.
- Navegar, guardar, generar links y hacer handoff producen cero `POST`, `PATCH`
  o `DELETE` contra proveedores externos en V1.
- Templates y bindings usan schemas/allowlists; no aceptan HTML/CSS/JS,
  expresiones o URLs remotas arbitrarias.
- Cambiar template, deployment, instrumento o access marca la instancia
  `stale`.
- Preview y final se comparan desde páginas rasterizadas por el mismo renderer;
  se verifican overflow, texto, primera/intermedia/última página y paridad.
- Cada QR se valida por quiet zone, contraste, tamaño mínimo y decodificación
  independiente desde el PNG de página que emite el propio job.
- Cada entrega registra un solo manifest y artefactos con `file_id`, MIME,
  SHA-256, audiencia y sensibilidad; ningún binario entra al `.pulso`.
- Toda fase de mutación externa requiere autorización explícita del usuario y
  evidencia de resultado.

## Notas

### Evidencia de implementación

- `collection_state/v1`, `collection_plan/v1` y
  `collection_deployment/v1` persisten con revisión optimista, fingerprints,
  migración legacy y reconciliación `stale`.
- `/api/recopiladores/*` expone 13 rutas propias para estado, plan, deployment,
  handoff, preflight, preview, templates, instancias y render.
- Cinco adapters V1 inspeccionan aulas, enlaces manuales, Kobo y SurveyMonkey
  sin mutaciones remotas; `remote_write` permanece `disabled_v1`.
- El preset `ficha_aplicacion_a4_v1`, el registro cerrado de nueve bloques y el
  mismo compilador `grid` producen preview PNG, PDF y paquete con recibo único,
  SHA-256, `file_id` y conteo de páginas; los binarios quedan fuera del
  `.pulso`.
- La UI propia ofrece Plan, Accesos, Materiales y Entrega, editor semántico con
  undo/redo y direcciones canónicas. El gate visual con proyecto real cubrió
  las seis direcciones a 1710×1107 y 1024×600 sin overflow, clipping, scroll
  jail, errores de API ni incumplimientos geométricos. La selección real de
  2.373 aulas se adapta sin ensuciar el proyecto ni crear estado de Monitoreo,
  conserva `course_name`, `eligible_n`, muestra y ubicación, y se presenta en
  páginas contenidas con el último renglón alcanzable.
- La verificación de cierre ejecutó las suites específicas de R y frontend,
  typecheck, round-trip `.pulso` y un render asíncrono real en un worker R
  limpio; el plan enlazado conserva el detalle de comandos y criterios.

Plan e investigación detallados en
[Plan de Recopiladores 2026-07](../plan-recopiladores-2026-07.md).

Relacionado con [ADR 0004](0004-monolito-modular-microkernel.md),
[ADR 0005](0005-secretos-fuera-del-proyecto.md),
[ADR 0006](0006-modulos-por-dominio.md),
[ADR 0007](0007-integraciones-salientes-dashboard-publicable.md),
[ADR 0019](0019-monitoreo-aulas-universitarias.md),
[ADR 0032](0032-handoff-instrumento-siempre-local.md) y
[ADR 0045](0045-monitoreo-actores-modelo-telefonia-explicita.md).
