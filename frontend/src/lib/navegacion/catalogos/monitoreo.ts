import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BarChartBig,
  Boxes,
  Search,
  CalendarClock,
  CalendarRange,
  ClipboardCheck,
  Clock,
  Clock3,
  ContactRound,
  DatabaseZap,
  Download,
  Gauge,
  GitCompareArrows,
  Inbox,
  KeyRound,
  Layers3,
  LifeBuoy,
  Link2,
  ListChecks,
  Mail,
  MapPin,
  MapPinned,
  PhoneCall,
  PlugZap,
  Repeat,
  Route,
  MessageSquare,
  ShieldAlert,
  SlidersHorizontal,
  Building2,
  Table2,
  Target,
  TrendingUp,
  Trash2,
  Users,
  Workflow,
  type LucideIcon,
} from "../../../vendor/lucide-react";

export type MonitoreoModoId =
  | "acreditacion"
  | "telefonico"
  | "territorial"
  | "aulas";

export type MonitoreoSeccionId =
  | "insumos"
  | "fuentes"
  | "modelo"
  | "consultas"
  | "control"
  | "telefonico"
  | "avance"
  | "calidad"
  | "ocurrencias";

export type DisponibilidadPestanaMonitoreo = "siempre" | "condicional";

/**
 * Una pestaña de Monitoreo en sus dos bordes consumidores.
 *
 * `id` es el identificador del contrato de navegación y `key` es el nombre
 * histórico que consumen los rails de los perfiles. Ambos nacen del mismo
 * argumento del builder: no son dos declaraciones que puedan divergir.
 */
export type PestanaMonitoreoCatalogo<Key extends string = string> = {
  readonly id: Key;
  readonly key: Key;
  readonly label: string;
  readonly detail: string;
  readonly icon: LucideIcon;
  readonly to: string;
  readonly layoutPolicy: "viewport";
  readonly disponibilidad: DisponibilidadPestanaMonitoreo;
};

function pestana<const Key extends string>(
  modo: MonitoreoModoId,
  seccion: MonitoreoSeccionId,
  key: Key,
  label: string,
  detail: string,
  icon: LucideIcon,
  disponibilidad: DisponibilidadPestanaMonitoreo = "siempre",
): PestanaMonitoreoCatalogo<Key> {
  return {
    id: key,
    key,
    label,
    detail,
    icon,
    to: `/monitoreo?modo=${modo}&seccion=${seccion}&pestana=${key}`,
    layoutPolicy: "viewport",
    disponibilidad,
  };
}

/**
 * Fuente única de las pestañas posibles de los cuatro modos de Monitoreo.
 *
 * El contrato estático enumera posibilidades. El registro runtime publica el
 * subconjunto que realmente está visible en el proyecto montado.
 */
export const MONITOREO_PESTANAS = {
  // Esqueleto común de cuatro secciones (revamp de Monitoreo, 2026-10-23), con
  // las 20 pestañas de `docs/qa/revamp-monitoreo/acreditacion.md` §1. La
  // traducción a las vistas que la página monta por dentro está en
  // `features/monitoreo/profiles/acreditacion/navegacion/direccionAcreditacion.ts`.
  // Correo, Barrido, Reintentos y Equipo son el grupo Contacto de Control y
  // existen solo si el estudio declara ese canal.
  acreditacion: {
    insumos: [
      pestana("acreditacion", "insumos", "publicos", "Públicos", "Quiénes responden y contra qué padrón", Users),
      pestana("acreditacion", "insumos", "fuentes", "Fuentes", "Qué está conectado y por qué canal entra", PlugZap),
      pestana("acreditacion", "insumos", "reglas", "Reglas", "Cómo se lee y se cruza cada dato", SlidersHorizontal),
    ],
    modelo: [
      pestana("acreditacion", "modelo", "metas", "Metas", "Cuántas encuestas por público", Target),
      pestana("acreditacion", "modelo", "cuotas", "Cuotas", "Cuántas por categoría", BarChartBig),
      pestana("acreditacion", "modelo", "ventana", "Ventana de campo", "Cuándo entra cada público", CalendarRange),
    ],
    control: [
      pestana("acreditacion", "control", "correo", "Correo", "Cómo rinde cada envío", Mail, "condicional"),
      pestana("acreditacion", "control", "barrido", "Barrido", "Cuánto del padrón se llamó", PhoneCall, "condicional"),
      pestana("acreditacion", "control", "reintentos", "Reintentos", "En qué casos se sigue insistiendo", Repeat, "condicional"),
      pestana("acreditacion", "control", "equipo", "Equipo", "Cómo rinde cada responsable", ContactRound, "condicional"),
      pestana("acreditacion", "control", "resolver", "Por resolver", "Qué respuestas esperan una decisión", Inbox),
      pestana("acreditacion", "control", "cruce", "Cruce", "Cómo se volvió avance cada respuesta", Workflow),
      pestana("acreditacion", "control", "calidad", "Calidad", "Si hay respuestas sospechosas", ShieldAlert),
      pestana("acreditacion", "control", "personas", "Personas", "En qué está cada persona del padrón", Table2),
      pestana("acreditacion", "control", "respuestas", "Respuestas", "Qué llegó de cada plataforma", ListChecks),
    ],
    avance: [
      pestana("acreditacion", "avance", "resumen", "Resumen", "Si se llega a la meta", BarChart3),
      pestana("acreditacion", "avance", "publicos", "Por público", "Quién se queda atrás", Users),
      pestana("acreditacion", "avance", "cuotas", "Por cuota", "Si se cumple cada categoría", Target),
      pestana("acreditacion", "avance", "ritmo", "Ritmo", "A qué velocidad entra", CalendarRange),
      pestana("acreditacion", "avance", "salidas", "Salidas", "Qué se entrega y si está al día", Download),
    ],
  },
  // Esqueleto común de cuatro secciones (revamp de Monitoreo, 2026-10-23):
  // Insumos, Modelo, Control y Avance, en el orden del operativo. Lo que cada
  // pestaña absorbe de la arquitectura anterior está en
  // `docs/qa/revamp-monitoreo/telefonico.md` §1, y la traducción a las vistas
  // que la página monta por dentro, en
  // `features/monitoreo/profiles/telefonico/navegacion/direccionTelefonica.ts`.
  // Reserva (Modelo) y Reemplazos (Avance) son condicionales y todavía no se
  // declaran: dependen de las preguntas P8 y P9 del diseño. Supervisión
  // (Control) se declara con T9 (P5–P7 respondidas).
  telefonico: {
    insumos: [
      pestana("telefonico", "insumos", "fuentes", "Fuentes", "Qué se lee y qué declara el proyecto", PlugZap),
      pestana("telefonico", "insumos", "llave", "Llave y filtros", "Qué cuenta y cómo cruza", KeyRound),
      pestana("telefonico", "insumos", "estados", "Estados", "Qué significa cada status de la hoja", SlidersHorizontal),
    ],
    modelo: [
      pestana("telefonico", "modelo", "cuotas", "Cuotas y calendario", "Sobre qué variable y cuánto", Target),
    ],
    control: [
      pestana("telefonico", "control", "barrido", "Barrido", "Cómo rinde la hoja", PhoneCall),
      pestana("telefonico", "control", "insistencia", "Insistencia", "A quién se sigue llamando", Repeat),
      pestana("telefonico", "control", "equipo", "Equipo", "Cómo rinde cada responsable", ContactRound),
      pestana("telefonico", "control", "discrepancias", "Discrepancias", "Si Kobo y la hoja dicen lo mismo", GitCompareArrows),
      pestana("telefonico", "control", "respuestas", "Respuestas", "Qué envío es efectiva", ListChecks),
      pestana("telefonico", "control", "supervision", "Supervisión", "Qué efectivas se vuelven a llamar", ClipboardCheck),
      pestana("telefonico", "control", "avisos", "Avisos", "Qué hay que corregir", ShieldAlert),
    ],
    avance: [
      pestana("telefonico", "avance", "cuotas", "Cuotas", "Cuánto falta", Target),
      pestana("telefonico", "avance", "ritmo", "Ritmo", "A qué velocidad", CalendarRange),
      pestana("telefonico", "avance", "entregas", "Entregas", "Qué sale", Download),
    ],
  },
  // Esqueleto común de cuatro secciones (revamp de Monitoreo, 2026-10-23):
  // Insumos, Modelo, Control y Avance. Lo que cada pestaña absorbe de las seis
  // secciones anteriores está en `docs/qa/revamp-monitoreo/territorial.md` §1,
  // y la traducción a las vistas que la página todavía monta, en
  // `features/monitoreo/profiles/territorial/navegacion/direccionTerritorial.ts`.
  // Control agrupa sus pestañas en Calidad, Ocurrencias y Correcciones; las dos
  // de Ocurrencias son condicionales (parte del protocolo en ACNUR, opcionales
  // para otros clientes). El modo aterriza en Avance › Faltante por UMP.
  territorial: {
    insumos: [
      pestana("territorial", "insumos", "conexiones", "Conexiones", "Qué fuentes alimentan el modo", PlugZap),
      pestana("territorial", "insumos", "mapeo", "Mapeo y filtro", "Qué columna es cada cosa y qué cuenta", SlidersHorizontal),
      pestana("territorial", "insumos", "padron", "Padrón", "Quiénes son los aplicadores declarados", ContactRound),
      pestana("territorial", "insumos", "historial", "Historial", "Qué se leyó y cuándo", Clock),
    ],
    modelo: [
      pestana("territorial", "modelo", "metas", "Metas y muestra", "Cuánto, dónde y en qué fase", MapPinned),
      pestana("territorial", "modelo", "cuotas", "Cuotas", "Qué cuota declara el proyecto", Layers3),
    ],
    control: [
      pestana("territorial", "control", "bandeja", "Bandeja", "Qué reviso hoy y qué decido", ListChecks),
      pestana("territorial", "control", "senales", "Señales", "Si la calidad es pareja", MapPin),
      pestana("territorial", "control", "recorrido", "Recorrido", "Por dónde pasó cada aplicador", Route),
      pestana("territorial", "control", "equipo", "Equipo", "Quién produce cuánto", Users),
      pestana("territorial", "control", "ocurrencias", "Ocurrencias", "Por qué no se logra la entrevista", ClipboardCheck, "condicional"),
      pestana("territorial", "control", "reportes", "Reportes UMP", "Qué UMP no reporta o no cuadra", Table2, "condicional"),
      pestana("territorial", "control", "subsanaciones", "Subsanaciones", "Qué celda falta y de dónde se cubre", ArrowRight),
      pestana("territorial", "control", "anulaciones", "Anulaciones", "Qué salió del conteo", Trash2),
      pestana("territorial", "control", "conciliacion", "Conciliación", "Códigos y UMP corregidos", Link2),
    ],
    avance: [
      pestana("territorial", "avance", "faltante", "Faltante por UMP", "Qué celdas faltan y quién las cubre", Target),
      pestana("territorial", "avance", "resumen", "Resumen", "Cuánto cuenta y a qué ritmo", BarChart3),
      pestana("territorial", "avance", "mapa", "Mapa", "Dónde está el campo", MapPinned),
      pestana("territorial", "avance", "umps", "UMP", "Qué UMP están completas", Route),
      pestana("territorial", "avance", "salidas", "Salidas", "Qué se entrega", Download),
    ],
  },
  aulas: {
    fuentes: [],
    // Agenda tiene dos superficies con funciones distintas: consultar el plan y
    // registrar lo que pasó en el aula. Apiladas competían por el alto —a
    // 1024x600 el registro quedaba recortado sin forma de alcanzarlo—; como
    // pestañas cada una recibe la vista entera, igual que en telefónico y
    // acreditación.
    modelo: [
      pestana("aulas", "modelo", "agenda", "Agenda", "Plan y enlaces por curso-horario", Table2),
      // La agenda ordenada por curso-horario sirve para BUSCAR una fila cuando
      // ya se sabe el código; la pregunta de campo es la contraria —«hoy toca
      // esta facultad, ¿qué aulas son, a qué hora y en qué pabellón?»— y
      // contestarla obligaba a rastrear las 196 filas y rehacer el grupo a mano,
      // una vez por facultad y por día.
      pestana("aulas", "modelo", "facultad", "Por facultad", "A dónde hay que ir cada día", Building2),
      // «A quién llamo y por qué medio» es un trabajo distinto de consultar el
      // plan, y la agenda no tiene sitio para un tercer panel: su stack reparte
      // el alto entre dos.
      pestana("aulas", "modelo", "contacto", "Contacto", "Qué medio agenda mejor", PhoneCall),
      // Última de agendación a propósito: cierra el recorrido «qué aulas son →
      // a dónde ir → a quién llamo → cuánta gente hace falta». Las tres
      // anteriores listan el plan; ésta lo dimensiona, y sólo tiene sentido
      // cuando ya se sabe qué aulas son.
      //
      // Es la única superficie que lee el RANGO horario y no la hora de inicio:
      // sobre el plan de HSVG 2026 el pico contado por hora de inicio daba 8
      // aulas simultáneas y contado por rango da 19, que es el número que
      // dimensiona el equipo de campo.
      pestana("aulas", "modelo", "carga", "Carga", "Cuántos aplicadores por franja", CalendarClock),
    ],
    avance: [
      // **El orden lo fijó Gonzalo el 2026-08-29**: «la pestaña más importante
      // debería estar al inicio, entonces los cierres de cuota por facultad y
      // el avance general deben estar al principio».
      //
      // Es su norte, y estaba tercero: «lo que me interesa es que TODAS LAS
      // FACULTADES CUMPLAN CON SU CUOTA DE SEXO. Ese es lo fundamental de todo
      // esto». Quien abre Avance se encontraba antes con dos pantallas del
      // operativo —cuántas aulas se aplicaron, cómo va cada estrato del
      // sorteo— y la pregunta que decide quedaba detrás.
      // Se llama «Metas» y no «Cuotas» (Gonzalo, 2026-09-08). La pestaña habla de
      // dos metas —muestra y sobremuestra— y de lo que falta para cada una; «cuota»
      // era el vocabulario del diseño muestral, no el de quien mira el avance.
      // La CLAVE sigue siendo `cuotas`: cambiarla rompería las direcciones ya
      // enlazadas, los docs de direcciones y el recorrido de QA.
      // **Reordenado el 2026-09-09 por Gonzalo, y con Estratos FUERA.** Su
      // recorrido, textual: «resumen debería estar al inicio, seguido de metas,
      // luego rendimiento, luego efectividad y luego salidas». Es el orden de
      // las preguntas de quien entra: primero qué llevamos en total, después si
      // cada facultad llega a su cuota de sexo, después qué rinde, después si
      // el campo se comporta como el diseño supuso, y al final publicar.
      //
      // El orden anterior abría por Metas —decisión suya del 2026-08-29, cuando
      // Resumen todavía no resumía— y esa razón se cayó sola: Resumen ahora abre
      // con las respuestas efectivas, que es «el primer alcance que yo tengo
      // cuando entro a avance».
      pestana("aulas", "avance", "resumen", "Resumen", "Avance general del operativo", BarChart3),
      pestana("aulas", "avance", "cuotas", "Metas", "Avance hacia la muestra y la sobremuestra, por cada grupo de la cuota", Target),
      // El eje que sustituye a «aula válida / no válida», retirado por Gonzalo
      // el 2026-08-18: la unidad es la encuesta conseguida, no un porcentaje
      // contra un umbral. Va en pestaña propia y no apilada en Resumen, que ya
      // lleva siete paneles.
      pestana("aulas", "avance", "rendimiento", "Rendimiento", "Qué rinde más, por facultad", TrendingUp),
      // **«Estratos» se retiró el 2026-09-09.** Gonzalo, tres veces y la última
      // sin rodeos: «ya no entra porque, como ya te dije mil veces, yo no
      // conceptualizo los avances ni las metas ni el desarrollo del campo en
      // función de si hay una facultad donde la mayoría sea hombres o la
      // mayoría sea mujeres. Yo no lo conceptualizo de esa forma».
      //
      // No es un problema de formato: la pestaña partía el operativo por un eje
      // que él nunca usa para decidir. Sus dos paneles legítimos —cómo se
      // repartió el sorteo y cuánto se ha movido la composición— son del DISEÑO
      // muestral, no del avance, y si vuelven será a donde se decide la muestra.
      // `AulasPestanaEstratos` sigue en el árbol, sin montar.
      // **Pestaña propia, y no un panel dentro de Rendimiento** (ADR 0082,
      // decisión de Gonzalo del 2026-08-26). Las dos miden efectivas sobre
      // elegibles y ahí se acaba el parecido: Rendimiento ordena facultades por
      // lo que deja cada visita —un ranking para decidir a dónde ir mañana, con
      // el numerador del PARTE— y esto contrasta la τ que dimensionó la muestra
      // contra la que rinde el campo, con el numerador de PLATAFORMA. Apiladas,
      // los dos numeradores quedarían uno debajo del otro sin que nada los
      // distinga, que es el defecto más caro de este perfil; y la tabla de
      // decisión son quince filas con banda y reservas que necesitan la vista
      // entera. El `detail` es el que las separa: los rótulos cortos son
      // sinónimos en castellano.
      pestana("aulas", "avance", "efectividad", "Efectividad", "La τ del diseño contra la del campo", Gauge),
      pestana("aulas", "avance", "salidas", "Salidas", "Publicación a Sheets", Download),
    ],
    // Validación tenía las dos superficies apiladas y la hoja quedaba enterrada
    // bajo los avisos: para llegar a la «Base de control» —210 filas y 26
    // columnas— había que pasar seis alertas, un banner y tres KPIs. Es la misma
    // razón por la que Agenda se partió en dos: apiladas compiten por el alto y
    // una de las dos deja de existir en la práctica.
    //
    // Siguen en la MISMA sección porque las dos son control de calidad; lo que
    // cambia es que cada una recibe la vista entera. Y no son la misma medida:
    // arriba lo que deriva el motor, en la hoja lo que el equipo calcula en su
    // Excel.
    // **El registro de campo abre Validación, y ya no cuelga de Agenda.**
    //
    // Agendar es conseguir la cita con el docente; el control de campo empieza
    // cuando se sale a campo. Son dos trabajos, dos momentos y dos personas, y
    // tenerlos en la misma sección obligaba a quien registra a entrar por
    // «Agenda de cursos-horario», que no es lo suyo. Gonzalo: «ni siquiera sé
    // por qué registro de campo está en agenda… debería ser la primera sección
    // de validación».
    //
    // Y va PRIMERO porque Validación es el instrumento de dos personas: el jefe
    // de campo, que entra por lo que pasó en el aula, y el analista, que entra
    // por los controles. Lo que se registra viene antes de lo que se valida.
    calidad: [
      pestana("aulas", "calidad", "registro", "Registro de campo", "Cómo fue cada aplicación", ClipboardCheck),
      pestana("aulas", "calidad", "controles", "Controles", "Lo que el motor deriva del corte", ShieldAlert),
      pestana("aulas", "calidad", "base", "Base de control", "La hoja que llena el equipo", Table2),
      // **Pestaña propia, pedida asi**: «otra dimension de validacion que
      // podria ser un tap o una pestaña en si misma». Vivia dentro de Registro
      // de campo, apretada con otros seis paneles, y leer respuestas abiertas
      // es un trabajo entero: se entra a hacer eso y no a mirarlo de paso.
      // **Sólo existe en un estudio CONFIDENCIAL.** Gonzalo, 2026-09-22: «esta
      // pestaña sólo está disponible si la encuesta, en vez de ser anónima, es
      // confidencial» —las confidenciales piden un código identificador, las
      // anónimas no—. El catálogo la declara y `railDeAulas` la retira cuando el
      // estudio no pide código: el catálogo dice qué existe en el perfil, el
      // rail qué existe en ESTE estudio.
      pestana("aulas", "calidad", "alumnos", "Cruce de alumnos", "Quién respondió, por su código", Users),
      pestana("aulas", "calidad", "abiertas", "Respuestas abiertas", "Lo que se escribió a mano", MessageSquare),
    ],
    consultas: [
      // **La primera de Consultas, y a propósito.** Las otras cuatro contestan
      // preguntas de conjunto —la cadena, las brechas, el parte, los extras— y
      // ésta contesta por UNA fila concreta, que es lo que se pregunta cuando
      // alguien llama con un código en la mano. Gonzalo la pidió el 2026-09-09.
      pestana("aulas", "consultas", "ficha", "Buscar por código", "Un curso-horario, de CH o R a su ficha", Search),
      pestana("aulas", "consultas", "reemplazos", "Reemplazos", "Cadena por curso-horario caído", Link2),
      pestana("aulas", "consultas", "brechas", "Brechas", "Cursos-horario por debajo de su meta", AlertCircle),
      pestana("aulas", "consultas", "parte", "Parte de campo", "Lo que se anotó en cada aula", ClipboardCheck),
      // Aulas ADICIONALES, no reemplazos: existen para cerrar la cuota de
      // hombres y mujeres de cada facultad. Estaban en el plan —639 en el
      // estudio de 2026 contra 202 titulares— y no se veían en ninguna pantalla.
      pestana("aulas", "consultas", "extras", "Extras", "Aulas adicionales para la cuota por facultad", Boxes),
      // **Pestaña propia, y detrás de Extras, por pedido de Gonzalo del
      // 2026-09-11**: «los refuerzos deberían tener su propia pestaña en
      // Consultas luego de la pestaña Extras».
      //
      // Va después de Extras porque es su continuación: Extras dice qué
      // inventario hay, y Refuerzos qué se hace con él —cuáles conviene pedir
      // dentro de un techo, cuáles se pidieron ya y en qué punto está la
      // gestión de cada una—. Y va en pestaña propia porque es un circuito
      // entero con acciones: elegir el techo, marcar y seguir lo marcado no
      // caben de paso en un panel de Resumen.
      pestana("aulas", "consultas", "refuerzos", "Refuerzos", "Qué reforzar dentro del techo y en qué va lo pedido", LifeBuoy),
    ],
  },
} as const satisfies Record<
  MonitoreoModoId,
  Partial<Record<MonitoreoSeccionId, readonly PestanaMonitoreoCatalogo[]>>
>;

/**
 * Vistas que la página telefónica monta por dentro.
 *
 * No son navegación pública: la dirección del modo Telefónico es la de
 * `MONITOREO_PESTANAS.telefonico` (Insumos, Modelo, Control y Avance), y
 * `direccionTelefonica.ts` traduce cada pestaña pública a una de estas vistas.
 * Se conservan con su clave histórica porque son las que la página congelada
 * sabe montar, y porque los enlaces guardados con esas claves se siguen leyendo
 * como alias. Nunca se escriben.
 */
export const MONITOREO_PESTANAS_INTERNAS_TELEFONICO = {
  fuentes: {
    activas: pestana("telefonico", "fuentes", "activas", "Fuentes activas", "Estado del paquete", PlugZap),
    sheets: pestana("telefonico", "fuentes", "sheets", "Universo y barrido", "Estados y colores", Table2),
    survey: pestana("telefonico", "fuentes", "survey", "Encuestas", "Quién responde y qué cuenta", ListChecks),
    collectors: pestana("telefonico", "fuentes", "collectors", "Recopiladores", "Inclusión y alias", ContactRound),
  },
  modelo: {
    estructura: pestana("telefonico", "modelo", "estructura", "Cuotas", "Metas por variable", Target),
    estrategias: pestana("telefonico", "modelo", "estrategias", "Cronograma", "Campo y reportes", CalendarRange),
    resumen: pestana("telefonico", "modelo", "resumen", "Lectura", "Lectura de Fuentes", BarChart3),
  },
  consultas: {
    plataforma: pestana("telefonico", "consultas", "plataforma", "Efectivas Kobo", "Respuestas que pasan el filtro", ListChecks),
    base: pestana("telefonico", "consultas", "base", "Estado de la base", "Actor por actor", Table2),
    cruces: pestana("telefonico", "consultas", "cruces", "CodPulso", "Cruce entre plataforma y barrido", Link2),
    subsanacion: pestana("telefonico", "consultas", "subsanacion", "Salvedades", "Efectivas no identificables", ShieldAlert, "condicional"),
  },
  telefonico: {
    resumen: pestana("telefonico", "telefonico", "resumen", "Resumen operativo", "Cumplimiento y casos", PhoneCall),
    consultados: pestana("telefonico", "telefonico", "consultados", "Consultados", "Efectivas Kobo", ListChecks),
    dia: pestana("telefonico", "telefonico", "dia", "Día", "Efectivas Kobo", CalendarRange),
    tiempos: pestana("telefonico", "telefonico", "tiempos", "Validación de tiempo", "Duración Kobo", Clock3),
    incidencia: pestana("telefonico", "telefonico", "incidencia", "Sin efectiva", "Insistencia y reintentos", AlertCircle),
    responsables: pestana("telefonico", "telefonico", "responsables", "Responsables", "Equipo y carga", ContactRound),
    alertas: pestana("telefonico", "telefonico", "alertas", "Alertas reales", "Alertas reales", ShieldAlert),
    supervision: pestana("telefonico", "telefonico", "supervision", "Supervisión telefónica", "Control y muestra", ClipboardCheck),
    // Control › Barrido › No barridos: casos asignados sin intento y su antigüedad.
    noBarridos: pestana("telefonico", "telefonico", "no-barridos", "No barridos", "Casos sin barrer por antigüedad", Clock3),
  },
  avance: {
    resumen: pestana("telefonico", "avance", "resumen", "Diario", "Ritmo Kobo", BarChart3),
    actores: pestana("telefonico", "avance", "actores", "Cuotas", "Brechas por categoría", Layers3),
    encuestas: pestana("telefonico", "avance", "encuestas", "Encuestas", "Fuentes y canales", ListChecks),
    detalle: pestana("telefonico", "avance", "detalle", "Detalle", "Controles", Table2),
    salidas: pestana("telefonico", "avance", "salidas", "Salidas", "PDF y hojas de avance", Download),
  },
} as const;

/**
 * Vistas que la página territorial monta por dentro.
 *
 * No son navegación pública: la dirección del modo Territorial es la de
 * `MONITOREO_PESTANAS.territorial` (Insumos, Modelo, Control y Avance), y
 * `direccionTerritorial.ts` traduce cada pestaña pública a la vista que la
 * absorbe mientras no tiene contenido propio. Se conservan con su clave
 * histórica porque son las que la página sabe montar y porque los enlaces
 * guardados con esas claves se leen como alias. Nunca se escriben.
 */
export const MONITOREO_PESTANAS_INTERNAS_TERRITORIAL = {
  fuentes: [
    pestana("territorial", "fuentes", "form", "Formulario", "Kobo y corte local", DatabaseZap),
    pestana("territorial", "fuentes", "filter", "Filtro y distritos", "Efectivas y alcance", SlidersHorizontal),
    pestana("territorial", "fuentes", "roster", "Encuestadores", "Códigos Pulso", ContactRound),
    pestana("territorial", "fuentes", "reconciliation", "Reconciliación", "Códigos y UMP", Link2),
    pestana("territorial", "fuentes", "history", "Historial", "Eventos del corte", Clock),
  ],
  modelo: [
    // Va primera —y por eso es la pestaña por defecto de Modelo— porque es
    // lo que hay que resolver antes de creerle una cifra al resto del módulo.
    pestana("territorial", "modelo", "variables", "Variables", "Mapeo manual de la base", ListChecks),
    pestana("territorial", "modelo", "resumen", "Cobertura", "Zonas, UMP y responsables", BarChart3),
    pestana("territorial", "modelo", "tabla", "Manzanas", "Orden, titulares y reemplazos", Table2),
  ],
  calidad: [
    pestana("territorial", "calidad", "geolocalizacion", "Geolocalización", "GPS y cartografía", MapPin),
    pestana("territorial", "calidad", "reconciliacion", "Reconciliación UMP", "Sospechas espaciales", Route),
    pestana("territorial", "calidad", "duracion", "Duración de tiempo", "Normal, corta y muy corta", Clock),
    pestana("territorial", "calidad", "cuotas", "Cuotas", "Marginales y brechas", Target),
    pestana("territorial", "calidad", "anulacion", "Anulación", "Tacha auditada", Trash2),
  ],
  consultas: [
    pestana("territorial", "consultas", "registro", "Registro", "Tabla principal", Table2),
    pestana("territorial", "consultas", "gps", "GPS con señal", "Distancia y cruce", MapPin),
    pestana("territorial", "consultas", "duracion", "Tiempo corto/muy corto", "Normal, corta y muy corta", Clock),
    pestana("territorial", "consultas", "responsable", "Cruce responsable", "UMP y equipo", ContactRound),
    pestana("territorial", "consultas", "subsanaciones", "Subsanaciones", "Excedentes y brechas", ArrowRight),
  ],
  avance: [
    pestana("territorial", "avance", "resumen", "Resumen", "Estado del campo y corte", BarChart3),
    pestana("territorial", "avance", "distritos", "Distritos", "Cobertura y cuotas", MapPinned),
    pestana("territorial", "avance", "ump", "Mapa y UMP", "Ritmo por manzana", Route),
    pestana("territorial", "avance", "ritmo", "Ritmo diario", "Tendencia del corte", CalendarRange),
    pestana("territorial", "avance", "salidas", "Salidas", "PDF y Sheets", Download),
  ],
  ocurrencias: [
    pestana("territorial", "ocurrencias", "states", "Resumen", "No efectividad y motivos", ClipboardCheck),
    pestana("territorial", "ocurrencias", "distritos", "Distritos", "Estados por distrito", MapPinned),
    pestana("territorial", "ocurrencias", "registro", "Reporte UMP", "Con/sin reporte", Table2),
    pestana("territorial", "ocurrencias", "ump", "UMP", "Con/sin ocurrencia", Route),
    pestana("territorial", "ocurrencias", "alerts", "Alertas", "Cruces y observaciones", ShieldAlert),
    pestana("territorial", "ocurrencias", "rhythm", "Ritmo", "Días e historial", CalendarRange),
  ],
} as const;

/**
 * Vistas que la página de acreditación monta por dentro.
 *
 * Igual que en Telefónico, no son navegación pública: la dirección del modo es
 * la de `MONITOREO_PESTANAS.acreditacion` y `direccionAcreditacion.ts` traduce
 * cada pestaña pública a una de estas vistas. Conservan su clave histórica
 * porque la página congelada las monta así y porque los enlaces guardados con
 * esas claves se leen como alias. Nunca se escriben.
 */
export const MONITOREO_PESTANAS_INTERNAS_ACREDITACION = {
  fuentes: [
    pestana("acreditacion", "fuentes", "actores", "Actores", "Quiénes responden el estudio", Users),
    pestana("acreditacion", "fuentes", "fuentes", "Fuentes y universo", "Qué está conectado y de quién es", Layers3),
    pestana("acreditacion", "fuentes", "recopiladores", "Recopiladores", "Por dónde llegó cada respuesta", ListChecks),
  ],
  modelo: [
    pestana("acreditacion", "modelo", "estructura", "Modelo operativo", "Metas por actor", Target),
    pestana("acreditacion", "modelo", "distribucion", "Distribución", "Variable de interés por actor", BarChartBig),
    pestana("acreditacion", "modelo", "estrategias", "Cronograma", "Campo y reportes", CalendarRange),
  ],
  consultas: [
    pestana("acreditacion", "consultas", "plataforma", "Registros en plataforma", "Respuestas y cruce", ListChecks),
    pestana("acreditacion", "consultas", "base", "Estado de la base", "Actor por actor", Table2),
    pestana("acreditacion", "consultas", "cruces", "Cruces efectivos", "Razón de cruce", Link2),
    pestana("acreditacion", "consultas", "subsanacion", "Subsanación", "Decisión auditada", ShieldAlert),
  ],
  telefonico: [
    pestana("acreditacion", "telefonico", "resumen", "Barrido + Kobo", "Barrido telefónico", PhoneCall),
    pestana("acreditacion", "telefonico", "estados", "Estados", "Confirma y colorea", SlidersHorizontal),
    pestana("acreditacion", "telefonico", "dia", "Ritmo diario", "Efectivas Kobo", CalendarRange),
    pestana("acreditacion", "telefonico", "incidencia", "Sin efectiva", "Sin efectiva e insistencia", AlertCircle),
    pestana("acreditacion", "telefonico", "responsables", "Responsables", "Equipo y carga", ContactRound),
    pestana("acreditacion", "telefonico", "alertas", "Alertas reales", "Alertas reales", ShieldAlert),
    pestana("acreditacion", "telefonico", "supervision", "Supervisión", "Control y muestra", ClipboardCheck),
  ],
  avance: [
    pestana("acreditacion", "avance", "resumen", "Resumen", "Avance general", BarChart3),
    pestana("acreditacion", "avance", "actores", "Actores", "Brechas por unidad", Layers3),
    pestana("acreditacion", "avance", "cuotas", "Cuotas", "Metas por categoría", Target),
    pestana("acreditacion", "avance", "encuestas", "Encuestas", "Fuentes y canales", ListChecks),
    pestana("acreditacion", "avance", "detalle", "Detalle", "Controles", Table2),
    pestana("acreditacion", "avance", "correo", "Correo", "Envíos de Mailchimp", Mail),
    pestana("acreditacion", "avance", "salidas", "Salidas", "PDF y Sheets", Download),
  ],
} as const;

/**
 * Entrada histórica que Acreditación conserva en su tipo/export público para
 * compatibilidad, aunque no la renderiza ni forma parte de las 68 pestañas
 * navegables. Su definición sigue centralizada para evitar un segundo literal.
 */
export const MONITOREO_PESTANAS_COMPATIBILIDAD_ACREDITACION = {
  modelo: {
    resumen: pestana("acreditacion", "modelo", "resumen", "Resumen", "Lectura de Fuentes", BarChart3),
  },
} as const;

const SIN_PESTANAS: readonly PestanaMonitoreoCatalogo[] = [];

export function pestanasDeMonitoreo(
  modo: MonitoreoModoId,
  seccion: MonitoreoSeccionId,
): readonly PestanaMonitoreoCatalogo[] {
  const porSeccion = MONITOREO_PESTANAS[modo] as Partial<
    Record<MonitoreoSeccionId, readonly PestanaMonitoreoCatalogo[]>
  >;
  return porSeccion[seccion] ?? SIN_PESTANAS;
}

export const TOTAL_PESTANAS_MONITOREO = Object.values(MONITOREO_PESTANAS)
  .flatMap((porSeccion) => Object.values(porSeccion))
  .reduce((total, pestanas) => total + pestanas.length, 0);
