/**
 * Corpus metodológico destilado para la capa didáctica del recorrido
 * "Muestra de aulas" (encuestas universitarias en aula).
 *
 * Todo el contenido proviene de la documentación metodológica y los
 * materiales de campo reales de estudios de referencia aplicados en
 * universidades peruanas entre 2024 y 2026. Los nombres institucionales
 * se anonimizaron; las cifras, fórmulas y decisiones metodológicas se
 * conservan tal como aparecen en el corpus.
 */

export type FuenteRef = {
  id: string;
  titulo: string;
  descripcion: string;
  secciones?: string;
};

export type GlosarioEntry = {
  termino: string;
  llano: string;
  tecnico: string;
  fuenteId: string;
};

export type PasoRespaldo = {
  pasoId: 'definicion' | 'marco' | 'calculo' | 'aulas' | 'aplicacion';
  titulo: string;
  parrafos: string[];
  fuenteIds: string[];
};

export type GuiaCampoSeccion = {
  id: string;
  titulo: string;
  icono:
    | 'coordinacion'
    | 'kit'
    | 'speech'
    | 'consentimiento'
    | 'filtros'
    | 'aplicacion'
    | 'cierre'
    | 'incidencias';
  resumen: string;
  pasos: string[];
  citaTextual?: string;
  fuenteId: string;
};

export const FUENTES: FuenteRef[] = [
  {
    id: 'metodologia-2025',
    titulo: 'Metodología completa de un estudio de referencia (2025)',
    descripcion:
      'Documenta de punta a punta el diseño muestral aplicado: cálculo con deff, p calibrado con evidencia previa, selección sistemática, sobremuestra y ponderación final.',
  },
  {
    id: 'propuesta-2026',
    titulo: 'Propuesta muestral de referencia (2026)',
    descripcion:
      'Paso a paso reproducible del método: filtros del marco, cuotas por facultad y sexo, tasas de rendimiento medidas por aula, salto sistemático k y bolsas de reemplazo.',
    secciones: '§4-§10',
  },
  {
    id: 'comparacion-estudios',
    titulo: 'Comparación de estudios en universidades peruanas (2024-2026)',
    descripcion:
      'Glosario comparado de parámetros, modalidades de aplicación (aula con QR, mixta, online) y aprendizajes transferibles entre estudios.',
  },
  {
    id: 'speech-aplicadores',
    titulo: 'Guion para aplicadores en aula',
    descripcion:
      'Guion real de presentación en aula: objetivo del estudio, anonimato, filtros en voz alta y consentimiento voluntario.',
  },
  {
    id: 'ruta-asignacion',
    titulo: 'Ruta de asignación para aplicación en aulas',
    descripcion:
      'Protocolo operativo de campo: coordinación previa con docentes, salida a campo, contacto en el aula y cierre con reporte de incidencias.',
  },
  {
    id: 'indicaciones-aplicadores',
    titulo: 'Indicaciones adicionales para aplicadores',
    descripcion:
      'Checklist de campo: kit del aplicador, tiempos de llegada, reportes en tiempo real y manejo de eventualidades.',
  },
  {
    id: 'metodologia-detallada',
    titulo: 'Compendio metodológico de estudios universitarios en aula',
    descripcion:
      'Respaldo metodológico profundo de tres estudios de referencia: marcos muestrales, criterios de exclusión, parámetros y buenas prácticas consolidadas.',
  },
];

export const GLOSARIO: GlosarioEntry[] = [
  {
    termino: 'marco muestral',
    llano:
      'Es la lista completa de donde puedes elegir: todos los salones de clase (con sus alumnos matriculados) que existen en la universidad este semestre. Si un salón no está en la lista, nunca podrá salir sorteado.',
    tecnico:
      'Registro exhaustivo de las unidades de muestreo disponibles. En estos estudios se construye a partir de la base de matrícula oficial del semestre, típicamente como dos bases relacionadas (alumno × curso-horario y curso-horario), depuradas con filtros de elegibilidad.',
    fuenteId: 'metodologia-detallada',
  },
  {
    termino: 'curso-horario',
    llano:
      'Un "salón" concreto: la combinación de un curso, su sección, su día, su hora, su aula y su docente. Es la unidad que se sortea, porque ahí encuentras a 20-60 estudiantes juntos en un solo lugar y momento.',
    tecnico:
      'Unidad primaria de muestreo del diseño por conglomerados de una etapa. Cada curso-horario agrupa a los estudiantes matriculados en esa sesión específica; la inferencia se realiza a nivel del universo de pregrado.',
    fuenteId: 'propuesta-2026',
  },
  {
    termino: 'estrato',
    llano:
      'Los "cajones" en los que divides a la población antes de sortear, para asegurarte de que ningún grupo importante quede fuera. Aquí los cajones principales son facultad y sexo.',
    tecnico:
      'Subdivisión de la población dentro de la cual se asigna y selecciona muestra de forma independiente. En los estudios de referencia se estratifica por facultad × sexo, con un estrato secundario operativo por tamaño de aula (G1 a G4).',
    fuenteId: 'propuesta-2026',
  },
  {
    termino: 'cuota',
    llano:
      'La meta de encuestas que le toca a cada cajón. Si Derecho pesa 10.8% de la universidad, le toca aproximadamente 10.8% de la muestra, repartida entre hombres y mujeres según su composición real.',
    tecnico:
      'Número de respuestas válidas asignado a cada combinación de estratos mediante asignación proporcional al tamaño poblacional, con redondeo hacia arriba en estratos pequeños para garantizar inferencia mínima. En un estudio de referencia se definieron 30 cuotas (15 facultades × 2 sexos).',
    fuenteId: 'metodologia-2025',
  },
  {
    termino: 'p (proporción esperada)',
    llano:
      'Tu mejor apuesta sobre qué porcentaje de gente responderá "sí" a la pregunta clave del estudio. Si no tienes ni idea, usas 0.50 (el peor caso, que exige la muestra más grande). Si un estudio anterior ya te dio una pista, puedes afinarla y ahorrar encuestas.',
    tecnico:
      'Proporción poblacional asumida para el cálculo de varianza p(1-p). En los estudios de referencia se partió de p = 0.50 (máxima varianza) y se calibró a p = 0.30 en olas posteriores, al observarse una prevalencia del indicador principal de 30.2%. Pasar de 0.50 a 0.30 redujo la muestra teórica en ~8.5% al mismo margen de error.',
    fuenteId: 'metodologia-2025',
  },
  {
    termino: 'margen de error (e)',
    llano:
      'El "más o menos" de tu resultado. Con e = ±2.5%, si obtienes 30%, el valor real de la población está muy probablemente entre 27.5% y 32.5%. Mientras más chico lo quieras, más encuestas necesitas.',
    tecnico:
      'Semiamplitud del intervalo de confianza para una proporción. Los estudios de referencia usaron entre ±2.5% y ±5% según la representatividad buscada; con n = 2,500 sobre N = 22,037 el margen efectivo retrocalculado fue ±2.39%.',
    fuenteId: 'metodologia-2025',
  },
  {
    termino: 'nivel de confianza (z)',
    llano:
      'Cuánto quieres poder confiar en ese "más o menos". El estándar es 95%: si repitieras el estudio muchas veces, 95 de cada 100 veces el resultado caería dentro del margen.',
    tecnico:
      'Probabilidad de cobertura del intervalo de confianza. Al 95% corresponde el valor crítico Z = 1.96 en la fórmula del tamaño muestral. Es el estándar en todos los estudios de referencia.',
    fuenteId: 'metodologia-detallada',
  },
  {
    termino: 'deff (efecto de diseño)',
    llano:
      'El "castigo" estadístico por encuestar salones enteros en vez de personas al azar: los estudiantes que comparten un salón se parecen entre sí, así que 30 respuestas de una misma aula valen menos que 30 respuestas de 30 aulas distintas. Para compensar, agrandas la muestra.',
    tecnico:
      'Razón entre la varianza del diseño por conglomerados y la de un muestreo aleatorio simple del mismo tamaño; refleja la correlación intra-aula. Los estudios de referencia usan deff = 2.0 como corrección estándar, lo que en la práctica duplica el componente de varianza en la fórmula.',
    fuenteId: 'propuesta-2026',
  },
  {
    termino: 'FPC (corrección por población finita)',
    llano:
      'Un descuento a tu favor: como la universidad no es infinita, encuestar a 2,500 de 22,000 ya cubre una porción apreciable del total, y eso te permite necesitar algo menos de muestra que si la población fuera enorme.',
    tecnico:
      'Ajuste (N-n)/(N-1) que reduce la varianza estimada cuando la fracción de muestreo n/N no es despreciable. Está incorporado en la fórmula usada en los estudios de referencia a través del término (N-1)·e² del denominador.',
    fuenteId: 'metodologia-2025',
  },
  {
    termino: 'salto k',
    llano:
      'El ritmo del sorteo: si tienes 271 salones en una facultad y necesitas 39, ordenas la lista, sorteas un punto de partida y tomas un salón "cada k" posiciones. Así la selección recorre toda la lista en vez de amontonarse.',
    tecnico:
      'Intervalo del muestreo sistemático: k = floor(N_cursos_en_marco / aulas_a_coordinar), calculado por facultad. Se sortea un arranque aleatorio entre 0 y k con semilla fija y se toman las posiciones arranque, arranque + k, arranque + 2k, etc. La probabilidad de inclusión resultante es 1/k.',
    fuenteId: 'propuesta-2026',
  },
  {
    termino: 'pi (probabilidad de inclusión)',
    llano:
      'La probabilidad que tenía cada salón de salir sorteado. Se guarda junto a cada aula seleccionada como su "partida de nacimiento": después sirve para reconstruir el sorteo y calcular pesos correctos.',
    tecnico:
      'Probabilidad de que una unidad del marco entre a la muestra bajo el diseño; en selección sistemática equivale a 1/k dentro de su estrato. Los estudios de referencia preservan los campos `probabilidad` y `salto (k)` en la base operativa para trazabilidad y cálculo de factores de expansión.',
    fuenteId: 'metodologia-2025',
  },
  {
    termino: 'sobremuestra',
    llano:
      'El colchón: planificas más encuestas de las que necesitas porque en el camino habrá docentes que no den permiso, alumnos que falten y cuestionarios inválidos. En los estudios de referencia el colchón es del 50% (para una meta de 2,500 se prepara un techo de 3,750).',
    tecnico:
      'Cuota adicional sobre la muestra objetivo que cubre no respuesta y depuración posterior. Los estudios de referencia iniciaron con 100% y la calibraron a 50% tras verificar una cobertura de aulas de 93.5%; se materializa operativamente en bolsas de aulas de reemplazo priorizadas.',
    fuenteId: 'metodologia-2025',
  },
  {
    termino: 'tasa de rendimiento',
    llano:
      'De todos los alumnos elegibles matriculados en un salón, qué fracción termina entregando una encuesta válida el día de la visita. Combina tres cosas: que asistan, que acepten responder y que su cuestionario sea válido.',
    tecnico:
      'Fracción de alumnos elegibles del curso-horario que aporta una respuesta válida: asistencia × aceptación intra-aula × validez del cuestionario. En la aplicación de referencia el promedio ponderado global fue 0.53 (3,296 respuestas sobre 6,232 elegibles en 194 aulas), con un rango por facultad de 0.39 (aulas masivas transversales) a 1.00 (facultades pequeñas).',
    fuenteId: 'propuesta-2026',
  },
  {
    termino: 'cuota de aulas por facultad',
    llano:
      'Cuántos salones visitar en cada facultad. No basta un promedio único de la universidad: hay facultades con salones de 13 elegibles y otras con salones de 41, así que cada facultad se calcula con su propio tamaño de aula y su propia tasa de rendimiento.',
    tecnico:
      'aulas_facultad = ceil(cuota_facultad / (promedio_matriculados_elegibles_facultad × tasa_rendimiento_facultad)). En el estudio de referencia el promedio de elegibles por aula varió de 12.9 a 41.4 según facultad, resultando en 170 aulas base.',
    fuenteId: 'propuesta-2026',
  },
  {
    termino: 'reemplazo (M1, M2, M3…)',
    llano:
      'El plan B ya sorteado: si un salón del plan principal falla (el docente no responde, cambió el horario), activas su "gemelo" de la segunda lista, con el mismo perfil de facultad y tamaño. Nada se improvisa el día de campo.',
    tecnico:
      'Bolsas de cursos-horario seleccionadas en cascada sobre el remanente del marco, con perfil equivalente a la muestra principal (M1). Se activan secuencialmente (M2, M3, …) ante fallas operativas; la cadena de sustituciones queda registrada para auditoría y ajuste de ponderadores.',
    fuenteId: 'metodologia-2025',
  },
  {
    termino: 'matriculados elegibles',
    llano:
      'No todos los matriculados de un salón cuentan para tu estudio: algunos son menores de edad o de otro nivel. Este número es el subconjunto que sí cumple los requisitos, y es el que debes usar para estimar cuántas respuestas te dará ese salón.',
    tecnico:
      'Distinción entre `matriculados_total` (inscritos nominales del curso-horario) y `matriculados_poblacion` (subconjunto que cumple los criterios de la población objetivo: ≥18 años, pregrado, matrícula regular). Refinamiento incorporado en 2025 para no sobreestimar la cuota esperada por aula.',
    fuenteId: 'metodologia-2025',
  },
  {
    termino: 'ponderación (peso)',
    llano:
      'El ajuste final de la balanza: si un grupo quedó con menos encuestas de las planeadas, sus respuestas "pesan" un poco más para que el total siga representando bien a la universidad. La mayoría de casos queda con peso 1 (sin ajuste).',
    tecnico:
      'Ajuste por celda facultad × sexo al cierre del campo: las celdas que sobrecumplen se recortan por downsample aleatorio con semilla fija (peso = 1) y las que no alcanzan la meta reciben peso = meta / n_cobrado (> 1). En el estudio de referencia el 83.6% de los casos quedó con peso 1.00 y el peso máximo fue 1.15.',
    fuenteId: 'metodologia-2025',
  },
];

export const RESPALDOS: PasoRespaldo[] = [
  {
    pasoId: 'definicion',
    titulo: 'Cómo se define la población en los estudios de referencia',
    parrafos: [
      'En estudios de referencia aplicados en universidades peruanas (2024-2026), la población objetivo se define con una fórmula estable: estudiantes de pregrado matriculados en el semestre de aplicación, mayores de 18 años. Se excluyen posgrado (maestrías y doctorados), escuelas de estudios especiales, consorcios y menores de edad. Esta definición se repite casi idéntica entre universidades porque delimita con precisión a quién representan los resultados.',
      'Una decisión temprana clave es la representatividad buscada. En un estudio de referencia se plantearon dos escenarios: representatividad al total de la universidad (margen ±2.5%, muestra de 2,500, 170 aulas) o representatividad por cada facultad (margen ±5%, muestra de 4,150, 249 aulas, ~60% más costo operativo). Se eligió el primero porque los reportes principales eran a nivel universidad y porque facilitaba la comparación con la ola anterior. La lección: define primero para qué nivel de detalle necesitas conclusiones confiables, porque eso puede cambiar la muestra en más de 60%.',
      'La proporción esperada (p) también se decide aquí. Sin evidencia previa se usa el valor conservador p = 0.50, que maximiza la muestra requerida. Cuando existe una medición anterior, se calibra: un estudio de referencia bajó p a 0.30 al observar que la prevalencia de su indicador principal fue 30.2%, y esa calibración redujo la muestra teórica en unas 250 encuestas al mismo margen de error, sin comprometer la inferencia.',
      'El universo se cuantifica con la matrícula oficial: en las olas de referencia, universos de 14,728 a 22,037 estudiantes elegibles repartidos en 15 facultades, con composición por sexo conocida (por ejemplo 48.4% mujeres y 51.6% hombres). Esa tabla poblacional por facultad y sexo es la columna vertebral de todo lo que viene después: cuotas, aulas y ponderación.',
    ],
    fuenteIds: ['metodologia-2025', 'metodologia-detallada', 'comparacion-estudios'],
  },
  {
    pasoId: 'marco',
    titulo: 'Cómo se construye y depura el marco muestral',
    parrafos: [
      'El marco muestral nace de la base de matrícula oficial del semestre, solicitada al área de sistemas o registro académico de la universidad. La buena práctica consolidada es pedirla como dos bases relacionadas: una de matrícula (un registro por cada par alumno × curso-horario) y una de cursos-horario (un registro por salón, con docente, día, hora, aula y matriculados). Un mismo estudiante aparece tantas veces como cursos lleva; el vínculo entre ambas bases es el código del curso-horario.',
      'Sobre el marco crudo se aplican filtros a nivel de aula: solo sesiones teóricas o teórico-prácticas (se excluyen laboratorios puros, asesorías y seminarios de tesis), solo modalidad presencial, solo pregrado, niveles 2 a 10 del plan de estudios (el nivel 1 se excluye por alta presencia de menores de edad), y un mínimo de matriculados por aula (15 en los estudios recientes, con excepciones justificadas en carreras pequeñas). Se añaden umbrales de prevalencia: al menos 80% de mayores de edad y 80% de estudiantes de pregrado en el aula.',
      'En paralelo se aplican criterios a nivel de alumno, en tres momentos: en el marco (edad, condición de matrícula activa, ciclo regular), en campo (asistencia, consentimiento, confirmación de elegibilidad) y en procesamiento (validez y completitud del cuestionario). Un aula apta puede contener alumnos no elegibles; por eso los estudios recientes distinguen `matriculados_total` de `matriculados_poblacion`, y dimensionan las cuotas con el segundo.',
      'El marco no suele quedar bien a la primera: en los estudios de referencia pasó por varias iteraciones con el área que lo entrega (observaciones, actualizaciones de matrícula, filtros progresivos) antes de consolidarse. Como referencia de escala: de una matrícula de ~22,000 estudiantes, el marco depurado quedó en 1,097 cursos-horario válidos. Presupuesta tiempo para ese ida y vuelta: sin marco confiable no hay cálculo posible.',
    ],
    fuenteIds: ['metodologia-2025', 'propuesta-2026', 'metodologia-detallada'],
  },
  {
    pasoId: 'calculo',
    titulo: 'El cálculo del tamaño de muestra, paso a paso',
    parrafos: [
      'La fórmula usada en los estudios de referencia es la clásica para proporciones con corrección de población finita, ajustada por el efecto de diseño del muestreo por conglomerados: n = (N · Z² · p(1-p) · deff) / ((N-1) · e² + Z² · p(1-p) · deff). Cada parámetro tiene una justificación concreta: Z = 1.96 por el 95% de confianza estándar, deff = 2.0 porque los estudiantes de una misma aula se parecen entre sí, y p y e según la evidencia y la precisión buscadas.',
      'Ejemplo real de referencia: con N = 22,037, p = 0.30, e = ±2.5% y deff = 2.0, la fórmula entrega n ≈ 2,310 respuestas válidas. Ese es el mínimo teórico, no la meta operativa: asume que el 100% de los invitados responde, cosa que no ocurre ni en aplicación presencial.',
      'Del teórico al operativo hay ajustes documentados: dividir entre la tasa de respuesta intra-aula esperada (~92.4% con base en la experiencia previa, lo que lleva 2,310 a ≈2,500), sumar los redondeos hacia arriba de las cuotas en facultades pequeñas (~15-25 encuestas) y cuadrar operativamente facultad por facultad. La meta quedó en 2,500 encuestas válidas. La verificación de consistencia se hace al revés: con n = 2,500, el margen de error efectivo retrocalculado es ±2.39%, ligeramente mejor que el ±2.5% declarado.',
      'Dos calibraciones de estos estudios valen la pena copiar. Primera: p se afina con evidencia (0.50 sin datos previos; 0.30 cuando la ola anterior midió 30.2% en el indicador más prevalente, tomándolo como cota superior). Segunda: la sobremuestra también se calibra con historia: se empezó con 100% y se bajó a 50% al comprobar que la cobertura de aulas alcanzaba 93.5%. Sobre la meta de 2,500 el techo con sobremuestra fue 3,750.',
      'Nota sobre el deff: usar 2.0 equivale a decir que cada encuesta hecha dentro de un conglomerado aporta la mitad de información que una encuesta aleatoria independiente. Es una corrección estándar y prudente para encuestas en aula; omitirla produce muestras engañosamente pequeñas y márgenes de error reales mayores a los declarados.',
    ],
    fuenteIds: ['metodologia-2025', 'propuesta-2026'],
  },
  {
    pasoId: 'aulas',
    titulo: 'De la muestra de personas a la lista de aulas',
    parrafos: [
      'Las encuestas no se reparten a personas sueltas sino a salones. El número de aulas se calcula facultad por facultad: aulas = ceil(cuota_facultad / (promedio de matriculados elegibles por aula × tasa de rendimiento)). En el estudio de referencia el tamaño promedio de aula varió de 12.9 elegibles (facultades pequeñas) a 41.4 (cursos servicio masivos), así que un promedio único de toda la universidad habría dado un plan equivocado.',
      'La tasa de rendimiento —qué fracción de los elegibles termina entregando respuesta válida— se midió empíricamente: promedio ponderado global de 0.53, con tres patrones claros por facultad. Facultades pequeñas y cohesionadas: 0.80 a 1.00. Facultades intermedias (el grupo más numeroso): 0.50 a 0.72. Aulas masivas transversales de estudios generales: 0.39 a 0.42, por su tamaño (45 alumnos promedio), su mezcla de carreras y la volatilidad de asistencia. Dimensionar con la tasa de cada facultad, no con una uniforme, es lo que hace realista el plan.',
      'La selección de qué aulas concretas visitar es un muestreo sistemático con arranque aleatorio: dentro de cada facultad se ordenan los cursos-horario por nivel de estudio, se calcula el salto k = floor(cursos_en_marco / aulas_a_coordinar), se sortea el arranque con semilla fija y se toma un curso cada k posiciones. Este método distribuye la muestra a lo largo de todo el marco, hereda naturalmente la composición por nivel y por tamaño de aula (verificado empíricamente contra grupos G1 a G4), y deja trazabilidad: cada aula conserva su probabilidad de selección (1/k).',
      'Las posiciones no seleccionadas no se botan: forman las bolsas de reemplazo M2, M3 y siguientes, cada aula con un "gemelo" de perfil equivalente. La cascada operativa es simple: se trabaja el plan base M1 (170 aulas en el caso de referencia); si un aula falla —docente que rechaza o no responde, cambio de horario, asistencia insuficiente— se activa su equivalente de M2, luego M3. En la práctica se aplican del orden de las aulas de M1 (194 aplicadas en el referencial, contra 170 previstas): las bolsas restantes son reserva priorizada, no encuestas adicionales. La propuesta más reciente añade además una bolsa operativa de +1 aula por facultad.',
    ],
    fuenteIds: ['propuesta-2026', 'metodologia-2025'],
  },
  {
    pasoId: 'aplicacion',
    titulo: 'Qué pasa el día de campo y después',
    parrafos: [
      'La aplicación en aula es autoadministrada con un código QR que lleva al cuestionario digital. Cada aula tiene su propio link parametrizado con un identificador de aula (collectorID): así se sabe de qué salón vino cada respuesta sin pedirle al estudiante ningún dato que lo identifique. Ese identificador permite verificar cuotas al cierre y construir ponderadores, preservando el anonimato completo.',
      'El operativo real sigue un protocolo fijo: coordinación previa con cada docente (correos institucionales y llamadas si no responden), llegada del aplicador una hora antes a la oficina de coordinación para recoger su kit, contacto con el docente en la puerta del aula, presentación con guion estandarizado, filtros en voz alta (mayores de 18, no haber respondido antes en otro curso), consentimiento voluntario, aplicación de 15 a 20 minutos y discurso de cierre. Todo se reporta en tiempo real a un chat grupal de supervisión: hora de llegada, hora de inicio, ocurrencias y hora de fin.',
      'El guion en voz alta cumple funciones metodológicas, no solo de cortesía: comunica que el salón fue seleccionado al azar (para que nadie se sienta señalado), garantiza el anonimato explícitamente, aplica los filtros de elegibilidad antes de empezar y formaliza que la participación es voluntaria: se puede saltar cualquier pregunta o dejar de responder en cualquier momento. En temas sensibles, esa transparencia es la base de una tasa de respuesta honesta.',
      'Después del campo viene el cierre estadístico. En el estudio de referencia se cobraron 3,296 respuestas válidas para una meta de 2,500: 27 de las 30 celdas facultad × sexo sobrecumplieron. El ajuste por celda recorta aleatoriamente el exceso (peso = 1) y compensa con peso > 1 las celdas que no llegaron (las dos celdas faltantes recibieron pesos de 1.02 y 1.15). El resultado: una base final de 2,471 casos físicos cuya suma de pesos es exactamente 2,500, representativa del diseño. Guardar la probabilidad de selección y la cadena de reemplazos de cada aula es lo que hace posible este cierre limpio.',
    ],
    fuenteIds: ['metodologia-2025', 'ruta-asignacion', 'speech-aplicadores', 'indicaciones-aplicadores'],
  },
];

export const GUIA_CAMPO: GuiaCampoSeccion[] = [
  {
    id: 'coordinacion',
    titulo: 'Coordinación con docentes',
    icono: 'coordinacion',
    resumen:
      'Antes de pisar un aula, cada visita se agenda con el docente. Una buena coordinación previa es lo que explica coberturas de aulas superiores al 90%.',
    pasos: [
      'Difunde el proyecto a toda la comunidad universitaria desde el área de comunicaciones, para generar apertura de estudiantes y docentes.',
      'Envía correos personalizados a cada docente cuyo curso-horario salió seleccionado, explicando la intervención durante su horario de clase.',
      'Si no responde, llama por teléfono para agendar día y hora; como último recurso, visita el aula para acordar el horario en persona.',
      'Coordina con unos 15 días de antelación: la coordinación temprana es el factor que permitió reducir la sobremuestra de 100% a 50% en los estudios de referencia.',
      'Registra el estado de cada aula (confirmada, sin respuesta, rechazada) para decidir a tiempo si activas un aula de reemplazo.',
    ],
    fuenteId: 'ruta-asignacion',
  },
  {
    id: 'kit',
    titulo: 'Kit del aplicador',
    icono: 'kit',
    resumen:
      'Cada aplicador recibe un kit estandarizado antes de salir a campo. Nada se improvisa: el material identifica al equipo y lleva el QR exacto de cada aula.',
    pasos: [
      'Preséntate en la oficina de coordinación una hora antes del horario de aplicación.',
      'Recibe y verifica tu kit: instructivo (guion, filtros y recomendaciones), credencial, chaleco, tablilla y lapicero.',
      'Recoge el horario de aplicación de cada aula asignada y las fichas QR correspondientes.',
      'Lleva dos copias de la ficha QR por aula: una para mostrarla al salón y otra para hacerla circular entre los asientos.',
      'Confirma en qué pabellón y aula te toca: cada QR es específico de su curso-horario, no son intercambiables.',
    ],
    fuenteId: 'indicaciones-aplicadores',
  },
  {
    id: 'speech',
    titulo: 'Presentación en el aula',
    icono: 'speech',
    resumen:
      'El guion de presentación es estandarizado: quién eres, cuánto tomará, por qué ese salón y la garantía de anonimato. Decirlo igual en todas las aulas es parte del método.',
    pasos: [
      'Toca la puerta unos 10 minutos antes de la hora pactada para anunciarte y recordarle al docente la programación.',
      'Preséntate ante el docente primero y luego ante los estudiantes, con nombre completo y credencial visible.',
      'Explica el objetivo del estudio, la duración (15 a 20 minutos) y que el salón fue seleccionado al azar: el contenido no se refiere a ese curso ni a ese docente.',
      'Da las indicaciones para abrir la encuesta (QR) pero pide que nadie empiece a llenarla hasta terminar la explicación.',
      'Recalca el anonimato: nadie debe escribir su nombre, código ni ningún dato que identifique a otras personas.',
    ],
    citaTextual:
      '"Este horario de clases ha sido seleccionado al azar. Los contenidos del cuestionario no se refieren a este curso ni a este horario de clases. Sus respuestas son totalmente anónimas."',
    fuenteId: 'speech-aplicadores',
  },
  {
    id: 'consentimiento',
    titulo: 'Consentimiento informado',
    icono: 'consentimiento',
    resumen:
      'Participar es voluntario y eso se dice explícitamente, con sus consecuencias prácticas: saltar preguntas, responder "no sabe/no responde" o retirarse en cualquier momento.',
    pasos: [
      'Explica que la participación es voluntaria e importante para los objetivos del estudio, sin presionar.',
      'Aclara las tres libertades: no responder ninguna pregunta, marcar "no sabe/no responde" y pasar a la siguiente, o dejar de responder cuando lo deseen.',
      'Pide que quien acepte marque "Sí" en la pregunta de consentimiento del propio cuestionario: el consentimiento queda registrado en los datos, no en papel aparte.',
      'Recuerda que en el procesamiento solo se consideran válidas las respuestas con el consentimiento otorgado (en estudios con doble consentimiento, ambos).',
      'Cierra pidiendo lectura atenta de las indicaciones y respuestas sinceras: la sinceridad es lo que le da valor al estudio.',
    ],
    citaTextual:
      '"Si no desean responder ninguna pregunta de la encuesta tienen toda la libertad de no hacerlo. […] También pueden dejar de responder la encuesta en el momento en que ustedes lo deseen."',
    fuenteId: 'speech-aplicadores',
  },
  {
    id: 'filtros',
    titulo: 'Filtros en voz alta',
    icono: 'filtros',
    resumen:
      'Antes de empezar se aplican dos filtros de elegibilidad en voz alta: no haber respondido ya la encuesta en otro curso y ser mayor de 18 años.',
    pasos: [
      'Haz una pausa marcada en el guion antes de continuar: los filtros tienen su momento propio.',
      'Pregunta si alguien ya respondió esta encuesta en otro curso; como un estudiante lleva varios cursos, puede caer en más de un salón seleccionado y solo debe responder una vez.',
      'Pregunta si alguien tiene menos de 18 años; los menores de edad no forman parte de la población objetivo y no deben participar.',
      'Pide que quien esté en alguno de los dos casos simplemente lo indique y no participe, sin exponer sus motivos ante el salón.',
      'Recuerda que estos filtros también existen dentro del cuestionario: la doble verificación (oral y digital) protege la validez de la base.',
    ],
    citaTextual:
      '"Si alguno de ustedes ya respondió a esta encuesta en otro curso, o alguno tiene menos de 18 años, por favor debe indicárnoslo para no participar de la encuesta."',
    fuenteId: 'speech-aplicadores',
  },
  {
    id: 'aplicacion',
    titulo: 'Durante la aplicación',
    icono: 'aplicacion',
    resumen:
      'Mientras el salón responde, el aplicador supervisa sin mirar pantallas ajenas y reporta el avance en tiempo real al chat de supervisión.',
    pasos: [
      'Reporta al chat grupal la hora de llegada y el nombre del aula, la hora de inicio y luego la hora de finalización.',
      'Pide a los estudiantes que avisen (por ejemplo, mostrando la pantalla final de confirmación) apenas terminen de enviar la encuesta.',
      'Si alguien necesita más tiempo del pactado con el docente, dale facilidades para completarla y enviarla dentro de las horas siguientes, en lugar de forzar un cierre apurado.',
      'Si el docente no permite el ingreso a la hora pactada, reprograma en vez de aplicar con tiempo insuficiente: una aplicación recortada produce cuestionarios incompletos y problemas con la clase siguiente.',
      'Mantén el ambiente tranquilo y sin circulación innecesaria: es una encuesta sobre temas sensibles y la privacidad percibida afecta la sinceridad.',
    ],
    fuenteId: 'indicaciones-aplicadores',
  },
  {
    id: 'cierre',
    titulo: 'Cierre y agradecimiento',
    icono: 'cierre',
    resumen:
      'La visita termina con un discurso breve de salida y el retorno a la oficina de coordinación para devolver material y reportar cómo fue.',
    pasos: [
      'Ofrece el discurso de salida: agradece al salón y al docente por el tiempo cedido de su clase.',
      'Verifica que recogiste todo tu material (fichas QR, tablilla, credencial) antes de salir del aula.',
      'Regresa a la oficina de coordinación apenas termines, para devolver el material asignado.',
      'Informa el resultado de la visita: cuántos respondieron, cómo estuvo la asistencia y cualquier situación particular.',
      'Ese reporte alimenta el tablero de cuotas: con él, la coordinación decide si la cuota del estrato avanza según lo previsto o si toca activar reemplazos.',
    ],
    fuenteId: 'ruta-asignacion',
  },
  {
    id: 'incidencias',
    titulo: 'Manejo de incidencias',
    icono: 'incidencias',
    resumen:
      'Las fallas de campo son esperables y están previstas en el diseño: lo importante es reportarlas rápido y activar el reemplazo correcto, no improvisar.',
    pasos: [
      'Reporta cualquier eventualidad u observación al supervisor de turno lo antes posible, por el canal acordado.',
      'Registra las incidencias típicas con su aula: docente que rechaza o no responde, cambio de horario, suspensión de clase, asistencia muy baja.',
      'Ante un aula caída, la coordinación activa el aula equivalente de la siguiente bolsa (M2, luego M3), con el mismo perfil de facultad y tamaño: no elijas tú un salón "parecido" por tu cuenta.',
      'Documenta la cadena de sustituciones (qué aula reemplazó a cuál): esa trazabilidad se usa después para auditar el campo y ajustar ponderadores.',
      'Al final de cada jornada, comparte observaciones y sugerencias: en los estudios de referencia, esos reportes calibraron las tasas de rendimiento que dimensionan los estudios siguientes.',
    ],
    fuenteId: 'indicaciones-aplicadores',
  },
];

export const EJEMPLO_TRABAJADO = {
  descripcion:
    'Ejemplo trabajado con los números reales de un estudio de referencia en una universidad peruana de ~22,000 estudiantes de pregrado (15 facultades), encuestados de manera presencial en aulas con código QR.',
  N: 22037,
  p: 0.3,
  confianza: 95,
  z: 1.96,
  e: 0.025,
  deff: 2.0,
  nTeorico: 2310,
  tasaRendimiento: 0.53,
  sobremuestraPct: 50,
  narrativa: [
    'Imagina una universidad peruana con 22,037 estudiantes de pregrado elegibles (mayores de 18 años, matriculados en el semestre) repartidos en 15 facultades. Queremos estimar la prevalencia de un fenómeno sensible con 95% de confianza y un margen de error de ±2.5%. Una ola anterior del estudio midió 30.2% en el indicador más prevalente, así que en lugar del conservador p = 0.50 calibramos p = 0.30 como cota superior razonable. Y como vamos a encuestar salones completos —donde los estudiantes se parecen entre sí— aplicamos un efecto de diseño deff = 2.0.',
    'Con la fórmula n = (N · Z² · p(1-p) · deff) / ((N-1) · e² + Z² · p(1-p) · deff), el numerador es 22,037 × 3.8416 × 0.21 × 2 ≈ 35,548 y el denominador es (22,036 × 0.000625) + (3.8416 × 0.21 × 2) ≈ 15.39. El resultado: n ≈ 2,310 respuestas válidas. Ese es el mínimo teórico. Como ni en aula responde el 100% (la experiencia previa indica ~92.4% de respuesta intra-aula efectiva), dividimos 2,310 / 0.924 ≈ 2,500, y con los redondeos hacia arriba de las cuotas en facultades pequeñas la meta operativa queda en 2,500 encuestas. Verificación: con n = 2,500 el margen de error efectivo retrocede a ±2.39%, mejor que el declarado.',
    'La muestra se reparte proporcionalmente entre las 15 facultades y, dentro de cada una, por sexo: 30 cuotas en total. Luego se traduce a salones: cada facultad tiene su propio tamaño de aula (de 12.9 a 41.4 elegibles en promedio) y su propia tasa de rendimiento medida (de 0.39 en aulas masivas transversales a 1.00 en facultades pequeñas; 0.53 de promedio global). Dividiendo cuota entre (elegibles promedio × tasa de rendimiento), facultad por facultad, salen 170 aulas base. Sobre la meta de 2,500 se prepara además una sobremuestra del 50% —techo de 3,750— que se materializa en bolsas de aulas de reemplazo (M2, M3, …) sorteadas con el mismo método.',
    'Las aulas concretas se eligen por muestreo sistemático: dentro de cada facultad se ordenan los cursos-horario por nivel, se calcula el salto k = floor(cursos del marco / aulas a coordinar), se sortea un arranque aleatorio y se toma un salón cada k posiciones. Cada aula seleccionada conserva su probabilidad de inclusión y su salto k en la base operativa, y cada una recibe un QR propio con identificador de aula, de modo que se sabe de qué salón vino cada respuesta sin identificar a nadie.',
    'El campo aplicó 194 aulas (las 170 previstas más reemplazos activados) y cobró 3,296 respuestas válidas: 27 de las 30 cuotas se sobrecumplieron. El cierre estadístico cuadra cada celda con su meta: el exceso se recorta por sorteo reproducible (peso = 1) y las dos celdas que no llegaron se compensan con pesos de 1.02 y 1.15. La base final: 2,471 casos físicos cuya suma de pesos es exactamente 2,500, lista para inferencia con el margen de error prometido. Del cálculo a la aplicación, cada número quedó trazado: esa es la marca de un buen diseño de muestra de aulas.',
  ],
} as const;
