# Encargo del loop F6 — motor nativo del recetario y editor nuevo de Gráficos

Tipo: Encargo de loop indefinido
Estado: Vigente
Fecha: 2026-10-10
Autoridad: pedidos textuales de Gonzalo en la sesión local del loop N8/F6.
Situación: traspaso a sesión en la nube.

## Traspaso a la nube (léelo primero)

- Gonzalo, textual (2026-10-10 ~21:25): «quiero hacer commit y push hasta aquí para que una sesión en la nube continúe con el
  loop indefinido y los múltiples procesos a la vez».
- Copia de este encargo en la sesión: si tu harness tiene scratchpad, crea ahí tu `ENCARGO_LOOP.md` a partir de este archivo y
  reescríbelo cada turno (skill `/preparar-loop-indefinido`). Este archivo versionado se actualiza al cerrar cada etapa.
- Reloj: `sleep 180` con run_in_background, description «TICK DEL LOOP F6 — retoma <ruta del encargo>». Cadencia de Gonzalo:
  180 s («aquí cambia el reloj a 3 minutos para que supervises de forma más pausada lo que hacen»). Un solo TICK.
- Lo que NO existe en la nube: los puertos locales 8787/8821/5173 de Gonzalo y la carpeta local `n8/` bajo `tmp` (copia de trabajo, scripts y el
  encargo histórico). Proyecto equivalente versionado: `api/inst/reference_projects/acrconta_mazo/` (anonimizado). Trabaja
  siempre sobre una COPIA de ese `.pulso`. Para QA visual levanta tu propia pila (backend con load_all + Vite con cacheDir
  privado) y ciérrala al terminar.
- Los ids de agentes citados abajo eran de la sesión local; en la nube se lanzan agentes nuevos con el mismo encargo.
- Las rutas de evidencia del scratchpad de la sesión local eran locales y no viajan: el veredicto de cada verificador está
  resumido aquí con sus cifras.

## Primer paso en la nube

1. Si este archivo no registra el veredicto del «verificador frontend-3» (commits a092e711e selector de partes ≥3,
   f61bd60e3 capas Avisos/Inspector + aviso en sessionStorage, c2a599513 control «Orden» D8), lanza un verificador nuevo
   sobre esos tres commits: estaba corriendo en la sesión local al traspasar.
2. Cierra los pendientes chicos de K15 y D8 (B-n abajo) y sigue con la cola en el orden F-a → F-b (F6.2) → B-a (K7) → F-e
   (F6.3) → B-c/B-d (K13/K6) → F-f (F6.4) → F-g (F6.5), siempre con verificador independiente al cierre de cada unidad.

## Encargo vigente (copia del encargo local al momento del traspaso)

RELOJ EN PAUSA (2026-10-10 ~20:55, pedido de Gonzalo: «pausamos el reloj y definimos todo lo pendiente para el siguiente reloj»).
AL REANUDAR (solo cuando Gonzalo lo pida): relanzar `sleep 180` con run_in_background y description
«TICK DEL LOOP N8 Word — retoma <`ENCARGO_LOOP.md` de la carpeta local `n8/`>». Cadencia elegida por Gonzalo: 180 s — «aquí cambia el reloj a 3
minutos para que supervises de forma más pausada lo que hacen»; solo él la cambia. Un solo TICK. Nunca ScheduleWakeup ni
CronCreate. Al cerrar CADA turno: reescribir este archivo y relanzar el ticker ANTES de redactar el cierre.
Histórico completo (591 líneas, todo lo anterior a este corte): `ENCARGO_LOOP_historico_hasta_2026-10-10.md` en la carpeta local `n8/`.

LOOP N8/F6 — motor nativo PPT/Word del recetario + editor nuevo de Gráficos, en ~/repos/Pulso/prosecnur-app (main). Encargo de Gonzalo.

INSTRUCCIONES TEXTUALES VIGENTES
- «el recetario siempre manda; si algo va a cambiar en el recetario, cambia en los defaults por defecto de la app; es como la
  constitución o como el libro de reglas de todos los defaults de la app». Si el recetario se contradice, manda lo dibujado.
- Reencuadre: «Estamos en una de las etapas mas fundamentales… La remasterizacion de la UI… el UI tiene que estar a la altura».
- Animaciones: «elegantes, dinámicas y profesionales»; reducido: «lo normal es que alguien no tenga esa configuración activada y
  que todas las animaciones y desplazamientos funcionen bien».
- D8: «ambas opciones deben ser posibles e incluso debe permitir orden personalizado».
- K15: «sí» (alinear estándar al recetario). Fichas: «sí, regenera las fichas del recetario».
VARA: cada pieza = lo dibujado en el recetario, con test y verificador independiente que aprueba (no solo «gate verde»).
Docs vivos: docs/qa/checklist-editor-graficos-f6-2026-10-10.md (DIBUJARLO ENTERO al mencionarlo) ·
plan-integracion-f6-2026-10-10.md · decisiones-pendientes-f6-2026-10-10.md · contrato-orden-categorias-f6-2026-10-10.md ·
k15-estandar-vs-recetario-2026-10-10.md · contrato-movimiento-f6-2026-10-10.md.

AVANCE (dado a Gonzalo ~20:50): ~60 % hecho / ~40 % falta. Recetario+estándar ~90 · motor PPT nativo ~85 · Word N8 ~85 ·
contratos backend ~70 · editor F6 ~30 (F6.1 ~85, F6.2 ~10, F6.3–F6.5 0) · animaciones ~90.

══════════ 1. EN VUELO AL PAUSAR (agentes vivos; sus informes llegan aunque el reloj esté en pausa) ══════════
a) Entregables TERMINÓ (~21:00): K1–K4 + FICHAS regeneradas a8fff99fe (16 láminas, solo fichas; ejemplos idénticos) + doc 68b5adace.
   LANZADO verificador K15-3+fichas. Pendientes suyos: catalogo.json de ejemplos con sha del recetario viejo (correr
   recetario_ejemplos_generar.R si se quiere al día); recetario-moderna-guias.pptx y recetario-fiel.pptx con fichas viejas;
   ícono de cabecera pegado al título (tira, 5 y 6) = como el recetario. [histórico: ya commiteó K1–K4 (0c70448ce ícono 19/20 + aviso de supresión, 9c872c3c3 banda
   p174, f67fdec05, e7f596207 doc). Ahora: REGENERAR FICHAS del recetario (TIPOS de recetario_fichas.R ← exportar_estandar.R;
   recetario.R reescribe docs/qa/motor-ppt-2026-10-06/4-recetario/recetario-moderna.pptx; render antes/después por página; solo
   cambian fichas, no ejemplos).]
b) Verificador D8-2 (093b2b2bb torta/dona + base activa del endpoint, 758b53c10 doc).
c) Verificador frontend-3 (a092e711e selector de partes ≥3, f61bd60e3 capas Avisos/Inspector + aviso en sessionStorage,
   c2a599513 control «Orden»). Exporta PPT/Word para comprobar el orden elegido.
Si rechazan: reanudar al autor (frontend ad7ecbfabf96c3fdc · D8 backend ab4d04b863d1c4e40 · entregables a4cc5b7be1b04b8d4).

══════════ 2. COLA — FRONTEND (un writer; esperar cupo) ══════════
F-a Personalizado + Invertir: la lista se MUESTRA en el orden en que se dibuja (decisión del lead, WYSIWYG).
F-b F6.2 Selectores de tipo: ComposicionLamina, GlifoGrafico, selectores de lámina y de gráfico con variantes en miniatura;
    cambiar de tipo conserva gráficos y avisa ranuras sobrantes; SlideType a 33 tipos. (plan §4)
F-c Guías por capas en el visor (plan §8) sobre preview_formas (K11): filtrar, espacios de cada sección, tamaño de letra.
F-d Tarjeta de gráfico: Top/Bottom Two Box y «En el Word».
F-e F6.3 Vista general: clasificador con arrastre, capítulos/subcapítulos, cobertura, «Armar desde…», biblioteca de íconos,
    miniaturas reales (necesita K7).
F-f F6.4 Word y Estilo del cliente: esquema/páginas/opciones/regenerar; documentoWord en store; estilo «Del recetario»/«Propio»
    con logos (K6) y tamaño de letra por perfil (K13).
F-g F6.5 Paridad y retiro: checklist 1–22 con evidencia, matriz de viewports, revisor metodológico, ADR + confirmación de
    Gonzalo; luego borrar el editor anterior (doble confirmación).
F-h Coordinar con la otra sesión: su L37 (docs/qa/censo-animaciones-2026-10-10.md) → migrar --motion-* de
    laminas/movimiento.css a tokens globales cuando los congele; su L17 toca GraficosPage.tsx:281 (PageFrame/toolbar) → no tocar
    ese archivo sin coordinar. Su plan dice que NO toca features/graficos/.

══════════ 3. COLA — BACKEND / MOTOR ══════════
B-a K7 miniaturas en lote (job POST /api/graficos/miniaturas, hash por lámina) — necesario para F6.3.
B-b /preview-slide asíncrono (hoy bloquea plumber ~2 min con cargas grandes).
B-c K13 tamaño de letra por perfil (enganche en .std_pt, estandar_tokens.R:73; ~95 tamaños fijos por mapear). Spec:
    docs/qa/spec-tamano-letra-perfil-f6-2026-10-10.md.
B-d K6 logos: PULSO por defecto + subir propios (config.estilo_cliente con procedencia).
B-e K8 avisos por lámina (opcional POST /api/graficos/plan/avisos).
B-f K15 restos: respaldo de nativos 13/14/18/21/22 (layouts graficos_3_1mas2, graficos_3_1arriba, 4_paneles,
    poblacion_3_cifras, cifras_y_graficos) a la correspondencia de plantilla_layouts_estandar.R; quitar el desempate de 0.002 in
    renumerando el contrato pic1..pic6 (reporte_plan_slides.R:1785-1797/:1831-1844) con test de render.
B-g Textos de avisos con jerga/ids: «Lamina degradada a canvas 'Sin datos'…» (sin tilde, id interno), «El ícono '318ecf24-…'»,
    «La lámina 'p_slide_objetivo_icono'», radar «escala_valor = "proporcion_100"».
B-h Memoria: ggplot2::last_plot() retiene `data` (~46 MB) hasta el siguiente gráfico.
B-i Borrar el código de población antigua (p_slide_2/3/4_graficos_poblacion) con ADR y doble confirmación de Gonzalo.
B-j /ppt-all real sobre un .pulso multibase independiente (hoy solo test).
B-k Corona: pie dice «Base: 52 respuestas»; la p160 «52 docentes» (depende de sufijo_auto del proyecto).
B-l Fixture de graficos-cifra muestra códigos («1»/«2») en vez de etiquetas.
B-m Homologar `transition-duration: 1ms !important` de home-v2, validacion-v2, codificacion-v2, bitacora, dashboard, carga-v2,
    analitica-v2, xf-*, editor-v2 con la regla de reducido (fundidos sí) — coordinar con L37 de la otra sesión.

══════════ 4. DECISIONES QUE ESPERAN A GONZALO ══════════
- Etiquetas cortas por CATEGORÍA de respuesta (hoy solo por variable; no hay contrato).
- «Masculino (33)» (n junto al rótulo) solo en la dicotomía de la corona, como la p160 — ¿aceptable para entregables a cliente?
- ¿plantilla_acnur_16_9.pptx también se alinea al estándar? (solo se tocó plantilla_16_9).
- S1–S4 base ponderada (docs/qa/hallazgo-base-ponderada-2026-10-10.md).
- A2 reemplazar el fixture acrconta_mazo por la versión con Top Two Box (carpeta local `n8/fixture/`). A3 release Windows: P8 o revertir
  f073f9eb9 antes de push.
- D1–D7, D9–D16 y E2 de decisiones-pendientes-f6 (D8 y D17 ya respondidas).
- PUSH: hay ~2 459 commits locales sin push en main (de varias sesiones). Construir no autoriza pushear; requiere su pedido y
  el pre-flight /publicar.

══════════ 5. OPERACIÓN ══════════
- 8821 corre la config de .claude/launch.json «Backend F6 HEAD limpio (8821)» (NO commitear launch.json): launch.R de
  scratchpad/f6head (git archive de e7f596207) → load_all limpio. Paquete instalado desde ese mismo árbol (14:45:49 local).
  Para ver código nuevo: re-extraer f6head del HEAD nuevo (rm -rf + git archive | tar), comprobar pgrep "R CMD INSTALL" y sin
  00LOCK, R CMD INSTALL --no-docs --no-multiarch --library="$(Rscript -e 'cat(.libPaths()[1])')" f6head/api (NUNCA dos a la
  vez, NUNCA interrumpir), luego preview_stop + preview_start de esa config. Pedir/avisar a Gonzalo.
- 5173 = Vite de Gonzalo contra 8821 (HMR: el frontend se ve al día). NO reiniciar 5173/8821 sin pedirlo; NUNCA tocar 8787.
- Verificadores/agentes: Vite propio con cacheDir PRIVADO desde el primer arranque; backend propio con copia de launch.R SIN
  bloque de reinstalación; nunca R CMD INSTALL; evaluar sobre git archive.
- Copia de trabajo: `app/acrconta_mazo_trabajo.pulso` en la carpeta local `n8/`.

ZONAS PROHIBIDAS E HIGIENE: no trabajar en ~/Documents/Pulso/prosecnur-app; no usar ni commitear
«recetario-moderna  -  Repaired.pptx»; commit SOLO por nombre (otras sesiones editan .claude/launch.json, 3 tests R
—test-carga-sav-preview, test-engine-construir-plantilla-ppt, test-reporte-ppt-saneo-ooxml—, docs/qa/README.md y los docs de
remasterización/GOAL); api/R/reporte_plan_ppt.R congelado en 9817 líneas y tokens.css congelado (audit: node
agentic/sync-agentic-os.mjs --audit); workflows (P8) requieren aprobación; no commitear datos de cliente; máximo 3
trabajadores y 2 writers por oleada; todo cierra con verificador.

LECCIONES DE HOY: un gate verde no basta — cada vuelta la rechazó un verificador con un mutante que sobrevivía o un caso real
(3 partes, dona con preset heredado, ícono suprimido); correr TODAS las suites que nombran el símbolo cambiado (grep en
tests/); instalar/levantar desde git archive para no arrastrar cambios a medias; regenerar artefactos derivados
(ranurasEstandar.generated.ts) en el mismo commit que su fuente.

[~21:15] VERIF. K15-3 + FICHAS: APROBADO CON PENDIENTES (gate 42 suites 3205 pass; 19/20 con ícono en cabecera; aviso al suprimir; ACNUR/históricas sin cambio; 4 mutantes mueren; recetario: solo 16 fichas cambian, ejemplos idénticos, fichas ≤0.0005 in del estándar; acrconta idéntica). K15 CERRADO salvo: (1) catalogo.json de ejemplos con sha256 viejo d85036ec… → regenerar con api/scripts/recetario_ejemplos_generar.R (actual a7462669…) o anotar que es procedencia de los webp; (2) falta .pulso real con p_slide_5/6_graficos_poblacion; (3) fichas 19/20 no dibujan el ícono de cabecera (cosmético); (4) respaldo nativos 13/14/18/21/22 (B-f).

[~21:20] VERIF. D8-2: APROBADO CON PENDIENTES (41 suites 1103 pass; 72/72 casos de la matriz conformes; 15 de 16 mutantes mueren; acrconta 0 cambios de orden en 160 gráficos, 16 tortas idénticas; HTTP base activa OK). D8 backend CERRADO salvo: (1) test del ROUTER con dos bases y activa ≠ primera para matar M9b (router_graficos_categorias.R:20 pasa base_activa; hoy el test llama al payload directo) — cerrar re-aplicando `python3 -I scratchpad/g3/mutar3.py <scratchpad> M9b`; (2) fallback mudo graficos_orden_categorias.R:300-301 si base_activa no está en inst_sources → avisar; (3) dona nunca sale nativa en el fixture (verificada en espec/DrawingML/Word, no XML nativo). → cola B-n.
