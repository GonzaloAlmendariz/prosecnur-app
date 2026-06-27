/*
 * Tablero SurveyMonkey para estudios de acreditacion.
 *
 * Edita solo la seccion CONFIGURACION DEL ESTUDIO.
 * Luego usa el menu: SurveyMonkey > Actualizar datos
 */

/***** CONFIGURACION DEL ESTUDIO *****/

// 1) ENLACES DEL ESTUDIO ACTUAL.
// Cambia estos enlaces cada vez que reuses el codigo en otro estudio.

// Google Sheet nativo con las bases trabajadas. Debe tener una pestana por actor.
const URL_HOJA_UNIVERSO = "https://docs.google.com/spreadsheets/d/1UMiN7xVAzQOrglhMkVNSj2KQ2RgJntOh2mNbDQm5mbQ/edit";

// AVANCE INTERNO: BBDD de respuestas, resumen operativo, avance por dia y detalle por variables.
const URL_HOJA_INTERNA = "https://docs.google.com/spreadsheets/d/1htx4wsvw7eX67k_C1dmD5krsP_1gdDFa0Wd9g0bIJW4/edit";

// REPORTE: archivo compartible con el cliente.
const URL_HOJA_CLIENTE = "https://docs.google.com/spreadsheets/d/1BMXliDlvZCu5WZUjeiNuGpAqJPtuwY7BVBy0NYHr63U/edit?gid=0#gid=0";

const NOMBRE_AVANCE_INTERNO = "AVANCE INTERNO";
const NOMBRE_REPORTE_CLIENTE = "REPORTE";
const NOMBRE_ESTUDIO = "Estudio de Acreditacion de la Facultad de Ciencias Contables";
const TOKEN_SURVEYMONKEY = "5-ru8Y6yF4kAdudVXvnnHyzI9T-kiGgf-nTLme-TbpbzDwGq17J4tFI5LE.QqCHar3oR2qk4WG.Uw.4uuw-DXVbeOrqvARuYp.qf3ZbgB6ov.sz0KWj8DvwjWXkkkcvV";

// 2) ACTORES DEL ESTUDIO.

// Activa solo los actores que entren en el estudio.
const ACTORES_ESTUDIO = [
  { actor: "Administrativos", activo: true },
  { actor: "Docentes", activo: true },
  { actor: "Egresados", activo: true },
  { actor: "Estudiantes", activo: true },
];

// 3) BASES UNIVERSO.

// Cada actor activo debe tener una pestana en URL_HOJA_UNIVERSO.
const BASES_POR_ACTOR = [
  { actor: "Administrativos", activo: true, pestanaUniverso: "Administrativos" },
  { actor: "Docentes", activo: true, pestanaUniverso: "Docentes" },
  { actor: "Egresados", activo: true, pestanaUniverso: "Egresados" },
  { actor: "Estudiantes", activo: true, pestanaUniverso: "Estudiantes" },
];

// 4) UNIDADES, SEGMENTOS Y GRUPOS DE REPORTE.

// Las unidades definen que aparece como fila principal en Resumen/Reporte.
// tipo "actor": usa todo el actor. tipo "segmento": usa una parte del actor. tipo "grupo": suma segmentos.
const UNIDADES_REPORTE_ESTUDIO = [
  { activo: true, tipo: "actor", unidad: "Administrativos", etiqueta: "Administrativos", actor: "Administrativos" },
  { activo: true, tipo: "actor", unidad: "Docentes", etiqueta: "Docentes", actor: "Docentes" },
  { activo: true, tipo: "actor", unidad: "Egresados", etiqueta: "Egresados", actor: "Egresados" },
  { activo: true, tipo: "actor", unidad: "Estudiantes", etiqueta: "Estudiantes", actor: "Estudiantes" },
];

// Segmentos opcionales. Si un estudio necesita abrir Egresados por subgrupo, se agregan aqui.
const SEGMENTOS_ESTUDIO = [
  // Ejemplo:
  // { activo: true, actor: "Egresados", segmento: "Egresados 2021", etiqueta: "Egresados 2021", campo: "Ciclo de egreso", valorUniverso: "2021" },
];

// Grupos opcionales de segmentos. Sirven para reportar totales adicionales sin perder el detalle.
const GRUPOS_SEGMENTOS_ESTUDIO = [
  // Ejemplo:
  // { activo: true, grupo: "Egresados recientes", etiqueta: "Egresados recientes", actor: "Egresados", segmentos: ["Egresados 2023", "Egresados 2024"] },
];

// 5) VARIABLES DE CONTROL.

// Variables de control para tablas de detalle. El tipo "anio" agrupa ciclos como 2024-I y 2024-II en 2024.
const VARIABLES_CONTROL_ESTUDIO = [
  { actor: "Administrativos", activo: false, campo: "Área de trabajo", etiqueta: "Área de trabajo", tipo: "texto" },
  { actor: "Docentes", activo: true, campo: "Dedicación", etiqueta: "Dedicación", tipo: "texto" },
  { actor: "Docentes", activo: true, campo: "Categoría", etiqueta: "Categoría", tipo: "texto" },
  { actor: "Egresados", activo: true, campo: "Ciclo de egreso", etiqueta: "Año de egreso", tipo: "anio" },
  { actor: "Estudiantes", activo: false, campo: "Ciclo", etiqueta: "Ciclo", tipo: "texto" },
];

// 6) ENCUESTAS SURVEYMONKEY.

// Define cuantas encuestas se jalan, su actor y su canal.
const ENCUESTAS_ESTUDIO = [
  {
    activo: true,
    actor: "Estudiantes",
    canal: "Web",
    surveyId: "527327742",
    tituloReferencial: "Acreditacion Contabilidad PUCP Estudiantes",
  },
  {
    activo: true,
    actor: "Egresados",
    canal: "Telefonico",
    surveyId: "527574340",
    tituloReferencial: "Acreditacion Contabilidad PUCP - Egresados Telefonico",
  },
  {
    activo: true,
    actor: "Egresados",
    canal: "Web",
    surveyId: "422387259",
    tituloReferencial: "Acreditacion Contabilidad PUCP - Egresados",
  },
  {
    activo: true,
    actor: "Administrativos",
    canal: "Web",
    surveyId: "527239231",
    tituloReferencial: "Acreditacion Contabilidad PUCP - Administrativos",
  },
  {
    activo: true,
    actor: "Docentes",
    canal: "Web",
    surveyId: "422402983",
    tituloReferencial: "Acreditacion Contabilidad PUCP - Docentes",
  },
  {
    activo: true,
    actor: "Docentes",
    canal: "Web",
    surveyId: "422658144",
    tituloReferencial: "Acreditacion Contabilidad PUCP - Docentes Personalizado",
  },
];

// Campos que se usan para cruzar universo vs respuestas. Si el nombre exacto no aparece,
// el codigo tambien intenta detectar correo, telefono y codigo/id.
const CAMPOS_LLAVE_UNIVERSO = ["N°", "Nro", "Nro.", "No", "Número", "Numero", "CodPulso", "Cod Pulso", "Código Pulso", "Codigo Pulso", "id", "ID", "codigo", "Codigo", "Código", "Código PUCP", "Codigo PUCP", "correo", "email", "telefono", "celular"];
const CAMPOS_LLAVE_RESPUESTA = ["CodPulso", "Cod Pulso", "Código Pulso", "Codigo Pulso", "Código PUCP", "Codigo PUCP", "N°", "email_address", "recipient_email", "recipient_custom_value", "recipient_id", "custom_value", "cv_id"];
const USAR_NOMBRE_COMO_LLAVE_FALLBACK = false;

// ACRDCONTA: SurveyMonkey puede dejar como "partial" respuestas que tienen
// consentimiento y cuerpo suficiente. En egresados esas respuestas deben entrar
// como completas cuando cruzan con el universo, igual que en la app/PDF revisado.
const ACTORES_PARCIALES_REVISABLES_COMO_COMPLETAS = ["Egresados"];
const MINIMO_PREGUNTAS_CON_RESPUESTA_PARCIAL_COMPLETA = 15;

// Alias manuales para respuestas que llegan con una llave corta de SurveyMonkey.
// Se usan solo si apuntan a una unica fila del universo; si no, quedan como alerta.
// Ejemplo: SurveyMonkey trae custom_variables {"Id":"odb"} y el universo trae Codigo 8882.
const ALIAS_LLAVES_RESPUESTA = [
  {
    activo: true,
    actor: "Docentes",
    llaveRespuesta: "odb",
    codigoUniverso: "8882",
    descripcion: "Oscar Diaz Becerra",
  },
  {
    activo: true,
    actor: "Docentes",
    llaveRespuesta: "fdc",
    codigoUniverso: "1999225",
    descripcion: "Franklin Duarte Cueva",
  },
  {
    activo: true,
    actor: "Docentes",
    llaveRespuesta: "19886218",
    codigoUniverso: "2849",
    descripcion: "Javier Rosas Cuellar",
  },
];

// 7) REGLAS DE RECHAZO.

// Una respuesta puede estar completed en SurveyMonkey y aun asi ser rechazo efectivo.
// Para este tablero, rechazo significa que la persona no dio consentimiento/autorizacion.
const REGLAS_RECHAZO_POR_RESPUESTA = [
  {
    activo: true,
    actor: "",
    patronesPregunta: ["acepta participar", "autoriza", "almacenamiento"],
    respuestasRechazo: ["no"],
  },
];

// 8) MONITOREO TELEFONICO.

// Monitoreos telefonicos internos. La base de barrido manda para seguimiento operativo
// y SurveyMonkey manda para validar respuestas efectivas.
// IMPORTANTE:
// - urlHojaBarrido es el enlace del Google Sheet donde el equipo de campo trabaja el barrido.
// - pestanaBarrido es la pestana visible con los casos.
// - pestanaCorreosWebCompletos es el listado de correos que ya respondieron por web y no deben llamarse.
// - columnas se lee por nombre de encabezado, nunca por letra de columna. Puedes poner varios alias.
const MONITOREOS_TELEFONICOS = [
  {
    activo: true,
    actor: "Egresados",
    canal: "Telefonico",
    urlHojaBarrido: "https://docs.google.com/spreadsheets/d/1o5RDAjTkiQRw6CxwPE_DWBhYB3ZrWXKNTzxMFjdf9v0/edit?gid=100547119#gid=100547119",
    pestanaBarrido: "Barrido",
    pestanaCorreosWebCompletos: "Correo completos",
    columnas: {
      codPulso: ["CodPulso", "Cod Pulso", "ID", "id"],
      enlace: ["Enlace", "Enlace llamada", "Enlace encuesta", "Link", "Link llamada", "Link encuesta", "URL", "URL llamada", "URL encuesta"],
      codigoPucp: ["Código PUCP", "Codigo PUCP", "Código", "Codigo"],
      nombre: ["Nombre", "Nombre completo"],
      correo: ["Correo", "CORREO PUCP", "Email", "Correo electrónico"],
      responsable: ["Responsable", "Encuestador", "Enumerador", "Operador"],
      status: ["Status", "Estatus", "Estado", "Estado campo"],
      intentos: ["Intentos", "Nro intentos", "Número de intentos", "Numero de intentos"],
      fecha: ["Fecha", "Fecha barrido", "Fecha de contacto"],
      cicloEgreso: ["Ciclo de egreso", "Año de egreso", "Anio de egreso", "Promocion", "Promoción"],
      observacion: ["Observación", "Observacion", "Comentario", "Comentarios"],
    },
  },
];

// 9) CIERRES TELEFONICOS POR OTROS RECOPILADORES.

// A veces el equipo telefonico envia un enlace alternativo por WhatsApp u otro medio.
// Aunque ese enlace viva en una encuesta web, operativamente explica cierres del barrido telefonico.
// El cruce se hace por CodPulso/id contra la base de barrido, por lo que tambien recupera responsable.
// - surveyId es la encuesta donde vive ese recopilador alternativo.
// - recopilador es el nombre visible del recopilador en SurveyMonkey; si cambia mucho, usa collectorId.
// - etiqueta es el nombre corto que aparecera como columna en Monitoreo telefonico.
const RECOPILADORES_CIERRE_TELEFONICO = [
  {
    activo: true,
    actor: "Egresados",
    canalTelefonico: "Telefonico",
    surveyId: "422387259",
    recopilador: "Whatsapp",
    etiqueta: "WhatsApp",
  },
];

// 10) UMBRALES DE ALERTA.

// Ajusta estos valores para controlar que casos aparecen en la pestana interna Alertas.
const UMBRALES_ALERTA_ESTUDIO = {
  noContestaIntentosMinimos: 4,
  responsableNoContestaPocosIntentosMinimoCasos: 3,
  responsableNoBarridosMinimoCasos: 20,
  responsableNoBarridosPorcentaje: 0.50,
  casosSinResponsableMinimo: 5,
  diferenciaEfectivasDiaMinima: 1,
};

/***** FIN DE CONFIGURACION *****/

const URL_BASE_SURVEYMONKEY = "https://api.surveymonkey.com/v3";
const PESTANA_REPORTE_CLIENTE = "Reporte";
const PESTANA_AVANCE_ENCUESTA = "Avance por encuesta";
const PESTANA_RESUMEN_INTERNO = "Resumen";
const PESTANA_ALERTAS_INTERNO = "Alertas";
const PESTANA_MONITOREO_TELEFONICO = "Monitoreo telefónico";
const PESTANA_ESTADO_EJECUCION = "Estado ejecucion";
const PESTANA_DETALLE_AVANCE_CLIENTE = "Detalle del avance";
const PREFIJO_RESPUESTAS = "BBDD Respuestas ";
const SUFIJO_AVANCE_CLIENTE = " - Avance";

const ENCABEZADO_REPORTE = ["Total", "Completas", "Parciales", "Rechazos", "Sin respuesta", "Avance"];
const ENCABEZADO_RESUMEN_INTERNO = ["Unidad", "Universo", "Completas", "Parciales", "Rechazos", "Sin respuesta", "Avance total"];
const ENCABEZADO_AVANCE_ENCUESTA = ["Actor", "Canal operativo", "Titulo", "Completas", "Parciales", "Rechazos", "Total respuestas", "Ultima actualizacion"];
const ENCABEZADO_AVANCE_RECOPILADOR = ["Actor", "Canal encuesta", "Uso operativo", "Titulo", "Recopilador", "Tipo recopilador", "Completas", "Parciales", "Rechazos", "Total respuestas", "Ultima actualizacion"];
const ENCABEZADO_ALERTAS = ["Nivel", "Tipo alerta", "Detalle del tipo de alerta", "Responsable", "CodPulso", "Detalle"];
const COLUMNAS_BASE_AVANCE_DIA = ["Unidad", "Estado"];
const ENCABEZADO_DETALLE_VARIABLES = ["Actor", "Variable", "Valor", "Total", "Completas", "Parciales", "Rechazos", "Sin respuesta", "Avance"];
const ENCABEZADO_DISTRIBUCION_EGRESADOS = ["Unidad", "Variable", "Valor", "Universo", "% universo", "Efectivas", "% efectivas", "Diferencia distribución", "Avance efectivo", "Parciales", "Rechazos", "Sin respuesta"];
const COLUMNAS_AVANCE_ACTOR = ["Estado avance"];
const ORDEN_STATUS_TELEFONICO = [
  "Efectivo",
  "Rechazo",
  "Contactar después",
  "No contesta",
  "No barrido",
  "Apagado",
  "Número Incorrrecto",
  "Número Incorrecto",
  "No existe el número",
  "Número suspendido",
  "No efectivo / Fuera de servicio",
  "Colgó / Cortó la llamada",
  "Contactado por WhatsApp",
  "Contactado por mensaje de texto",
  "Sin status",
];

const CAMPOS_METADATA = [
  "Actor",
  "Canal",
  "survey_id",
  "Titulo encuesta",
  "response_id",
  "collector_id",
  "Nombre recopilador",
  "Tipo recopilador",
  "recipient_id",
  "Estado",
  "Estado avance",
  "Completa",
  "Parcial",
  "Rechazo",
  "Fecha creacion",
  "Fecha modificacion",
  "Llave conteo",
  "CodPulso",
  "Llave original SurveyMonkey",
  "Llave resuelta",
  "Metodo de cruce",
  "custom_value",
  "custom_variables",
  "email_address",
  "first_name",
  "last_name",
  "ip_address",
  "collection_mode",
  "language",
  "total_time",
  "edit_url",
  "analyze_url",
  "href",
  "metadata",
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("SurveyMonkey")
    .addItem("Actualizar datos - flujo completo", "actualizarDatos")
    .addSeparator()
    .addItem("Actualizar solo AVANCE INTERNO", "actualizarSoloAvanceInterno")
    .addItem("Actualizar solo REPORTE", "actualizarSoloReporteCliente")
    .addToUi();
}

function actualizarDatos() {
  ejecutarFlujoCompleto();
}

function actualizarSoloAvanceInterno() {
  ejecutarSoloAvanceInterno();
}

function actualizarSoloReporteCliente() {
  ejecutarSoloReporteCliente();
}

function ejecutarFlujoCompleto() {
  reiniciarEstadoEjecucion("Flujo completo");
  ejecutarPaso("Validar configuracion", validarConfiguracion);
  ejecutarPaso("Validar hoja universo", validarHojaUniverso);
  ejecutarPaso("Sincronizar respuestas SurveyMonkey", sincronizarRespuestas);
  ejecutarPaso("Publicar REPORTE", publicarHojaCliente);
  ejecutarPaso("Validar salidas publicadas", validarSalidasPublicadas);
  registrarProgreso("Flujo completo", "OK", "Proceso terminado.");
}

function ejecutarSoloAvanceInterno() {
  reiniciarEstadoEjecucion("Solo AVANCE INTERNO");
  ejecutarPaso("Validar configuracion", validarConfiguracion);
  ejecutarPaso("Validar hoja universo", validarHojaUniverso);
  ejecutarPaso("Sincronizar respuestas SurveyMonkey", sincronizarRespuestas);
  registrarProgreso("Solo AVANCE INTERNO", "OK", "AVANCE INTERNO actualizado. REPORTE no fue modificado.");
}

function ejecutarSoloReporteCliente() {
  reiniciarEstadoEjecucion("Solo REPORTE");
  ejecutarPaso("Validar configuracion", validarConfiguracion);
  ejecutarPaso("Validar hoja universo", validarHojaUniverso);
  ejecutarPaso("Publicar REPORTE", publicarHojaCliente);
  registrarProgreso("Solo REPORTE", "OK", "REPORTE actualizado con la BBDD interna existente. AVANCE INTERNO no fue sincronizado.");
}

function ejecutarPaso(nombrePaso, funcionPaso) {
  Logger.log("Iniciando: " + nombrePaso);
  registrarProgreso(nombrePaso, "En curso", "");
  try {
    const resultado = funcionPaso();
    Logger.log("OK: " + nombrePaso);
    registrarProgreso(nombrePaso, "OK", resultado || "");
    return resultado;
  } catch (error) {
    registrarProgreso(nombrePaso, "Error", error.message);
    throw new Error("Fallo en paso '" + nombrePaso + "': " + error.message);
  }
}

function reiniciarEstadoEjecucion(nombreFlujo) {
  try {
    const flujo = nombreFlujo || "Flujo completo";
    const libro = abrirLibro(URL_HOJA_INTERNA);
    const hoja = libro.getSheetByName(PESTANA_ESTADO_EJECUCION) || libro.insertSheet(PESTANA_ESTADO_EJECUCION, 0);
    limpiarHoja(hoja);
    asegurarTamanoHoja(hoja, 4, 4);
    hoja.getRange(1, 1, 1, 4).setValues([["Estado actual", "Paso", "Detalle", "Hora"]]);
    hoja.getRange(2, 1, 1, 4).setValues([["Iniciando", flujo, "", fechaHoraActual()]]);
    hoja.getRange(4, 1, 1, 4).setValues([["Hora", "Paso", "Estado", "Detalle"]]);
    hoja.getRange("A1:D1").setFontWeight("bold").setFontColor("#ffffff").setBackground("#0b3f66");
    hoja.getRange("A4:D4").setFontWeight("bold").setFontColor("#ffffff").setBackground("#0b3f66");
    hoja.setFrozenRows(4);
    mostrarToast("Iniciando " + flujo);
    SpreadsheetApp.flush();
  } catch (e) {
    Logger.log("No se pudo reiniciar estado de ejecucion: " + e.message);
  }
}

function registrarProgreso(paso, estado, detalle) {
  try {
    Logger.log(estado + " - " + paso + (detalle ? ": " + detalle : ""));
    const libro = abrirLibro(URL_HOJA_INTERNA);
    const hoja = libro.getSheetByName(PESTANA_ESTADO_EJECUCION) || libro.insertSheet(PESTANA_ESTADO_EJECUCION, 0);
    const hora = fechaHoraActual();

    if (hoja.getLastRow() < 4) reiniciarEstadoEjecucion();
    hoja.getRange(2, 1, 1, 4).setValues([[estado, paso, detalle || "", hora]]);
    hoja.appendRow([hora, paso, estado, detalle || ""]);
    formatearEstadoEjecucion(hoja, estado);
    mostrarToast(paso + " - " + estado + (detalle ? ": " + detalle : ""));
    SpreadsheetApp.flush();
  } catch (e) {
    Logger.log("No se pudo registrar progreso: " + e.message);
  }
}

function formatearEstadoEjecucion(hoja, estado) {
  const color = estado === "OK" ? "#d9ead3" : (estado === "Error" ? "#f4cccc" : "#fff2cc");
  hoja.getRange("A2:D2").setBackground(color).setFontWeight("bold");
  hoja.setColumnWidth(1, 150);
  hoja.setColumnWidth(2, 210);
  hoja.setColumnWidth(3, 420);
  hoja.setColumnWidth(4, 150);
  hoja.getRange(1, 1, Math.max(hoja.getLastRow(), 1), 4).setWrap(true);
}

function mostrarToast(mensaje) {
  try {
    const libroActivo = SpreadsheetApp.getActiveSpreadsheet();
    if (libroActivo) libroActivo.toast(String(mensaje).slice(0, 240), "SurveyMonkey", 5);
  } catch (e) {
    Logger.log("No se pudo mostrar toast: " + e.message);
  }
}

function fechaHoraActual() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Lima", "dd/MM/yyyy HH:mm:ss");
}

function verificarDestinoCliente() {
  const libroCliente = abrirLibro(URL_HOJA_CLIENTE);
  const mensaje = "Destino " + NOMBRE_REPORTE_CLIENTE + ": " + libroCliente.getName() + " | ID: " + libroCliente.getId() + " | URL: " + libroCliente.getUrl();
  Logger.log(mensaje);
  mostrarToast(mensaje);
  return mensaje;
}

function validarConfiguracion() {
  if (!URL_HOJA_UNIVERSO) throw new Error("Completa URL_HOJA_UNIVERSO.");
  if (!URL_HOJA_INTERNA) throw new Error("Completa URL_HOJA_INTERNA (" + NOMBRE_AVANCE_INTERNO + ").");
  if (!URL_HOJA_CLIENTE) throw new Error("Completa URL_HOJA_CLIENTE (" + NOMBRE_REPORTE_CLIENTE + ").");
  if (!TOKEN_SURVEYMONKEY || TOKEN_SURVEYMONKEY.indexOf("PEGAR") >= 0) throw new Error("Completa TOKEN_SURVEYMONKEY.");

  const actores = crearSet(obtenerActoresActivos());
  if (!Object.keys(actores).length) throw new Error("Activa por lo menos un actor en ACTORES_ESTUDIO.");
  const encuestasActivas = obtenerEncuestasActivas();
  const surveyIdsActivos = {};
  const canalesActivosPorActor = {};

  obtenerBasesActivas().forEach(function(base) {
    if (!actores[base.actor]) throw new Error("BASES_POR_ACTOR tiene un actor no activo: " + base.actor);
    if (!base.pestanaUniverso) throw new Error("Falta pestanaUniverso para " + base.actor);
  });
  validarUnidadesReporte();

  encuestasActivas.forEach(function(encuesta) {
    if (!actores[encuesta.actor]) throw new Error("ENCUESTAS_ESTUDIO tiene un actor no activo: " + encuesta.actor);
    if (!encuesta.surveyId) throw new Error("Falta surveyId para " + encuesta.actor + " / " + encuesta.canal);
    if (!encuesta.canal) throw new Error("Falta canal para encuesta " + encuesta.surveyId);
    surveyIdsActivos[String(encuesta.surveyId)] = true;
    canalesActivosPorActor[[normalizarTexto(encuesta.actor), normalizarTexto(encuesta.canal)].join("||")] = true;
  });

  REGLAS_RECHAZO_POR_RESPUESTA.filter(function(regla) { return regla.activo; }).forEach(function(regla) {
    if (regla.actor && !actores[regla.actor]) throw new Error("REGLAS_RECHAZO_POR_RESPUESTA tiene un actor no activo: " + regla.actor);
    if (!regla.patronesPregunta || !regla.patronesPregunta.length) throw new Error("Falta patronesPregunta en una regla de rechazo.");
    if (!regla.respuestasRechazo || !regla.respuestasRechazo.length) throw new Error("Falta respuestasRechazo en una regla de rechazo.");
  });

  obtenerVariablesControlActivas().forEach(function(variable) {
    if (!actores[variable.actor]) throw new Error("VARIABLES_CONTROL_ESTUDIO tiene un actor no activo: " + variable.actor);
    if (!variable.campo) throw new Error("Falta campo en variable de control para " + variable.actor);
  });

  obtenerAliasLlavesRespuestaActivos().forEach(function(alias) {
    if (!actores[alias.actor]) throw new Error("ALIAS_LLAVES_RESPUESTA tiene un actor no activo: " + alias.actor);
    if (!alias.llaveRespuesta) throw new Error("Cada alias de respuesta necesita llaveRespuesta.");
    if (!aliasTieneDestinoUniverso(alias)) throw new Error("El alias '" + alias.llaveRespuesta + "' necesita codigoUniverso, correoUniverso, telefonoUniverso, campoUniverso/valorUniverso o llavesUniverso.");
  });

  obtenerMonitoreosTelefonicosActivos().forEach(function(monitoreo) {
    if (!actores[monitoreo.actor]) throw new Error("MONITOREOS_TELEFONICOS tiene un actor no activo: " + monitoreo.actor);
    if (!monitoreo.canal) throw new Error("Falta canal en monitoreo telefonico para " + monitoreo.actor);
    if (!monitoreo.urlHojaBarrido) throw new Error("Falta urlHojaBarrido en monitoreo telefonico para " + monitoreo.actor);
    if (!monitoreo.pestanaBarrido) throw new Error("Falta pestanaBarrido en monitoreo telefonico para " + monitoreo.actor);
    if (!monitoreo.pestanaCorreosWebCompletos) throw new Error("Falta pestanaCorreosWebCompletos en monitoreo telefonico para " + monitoreo.actor);
  });

  obtenerRecopiladoresCierreTelefonicoActivos().forEach(function(regla) {
    if (!actores[regla.actor]) throw new Error("RECOPILADORES_CIERRE_TELEFONICO tiene un actor no activo: " + regla.actor);
    if (!regla.canalTelefonico) throw new Error("Falta canalTelefonico en RECOPILADORES_CIERRE_TELEFONICO para " + regla.actor);
    if (!regla.surveyId) throw new Error("Falta surveyId en RECOPILADORES_CIERRE_TELEFONICO para " + regla.actor + " / " + regla.canalTelefonico);
    if (!surveyIdsActivos[String(regla.surveyId)]) throw new Error("RECOPILADORES_CIERRE_TELEFONICO usa un surveyId no registrado en ENCUESTAS_ESTUDIO: " + regla.surveyId);
    if (!canalesActivosPorActor[[normalizarTexto(regla.actor), normalizarTexto(regla.canalTelefonico)].join("||")]) throw new Error("RECOPILADORES_CIERRE_TELEFONICO apunta a un canal telefonico no registrado en ENCUESTAS_ESTUDIO: " + regla.actor + " / " + regla.canalTelefonico);
    if (!regla.recopilador && !regla.collectorId) throw new Error("Cada cierre telefonico necesita recopilador o collectorId.");
  });

  validarUmbralesAlertas();

  return "Configuracion OK.";
}

function validarUnidadesReporte() {
  const actores = crearSet(obtenerActoresActivos());
  const segmentos = crearSet(obtenerSegmentosActivos().map(function(segmento) { return segmento.segmento; }));
  const grupos = crearSet(obtenerGruposSegmentosActivos().map(function(grupo) { return grupo.grupo; }));
  if (!obtenerUnidadesReporteActivas().length) throw new Error("Configura por lo menos una unidad activa en UNIDADES_REPORTE_ESTUDIO.");

  (UNIDADES_REPORTE_ESTUDIO || []).filter(function(unidad) { return unidad.activo; }).forEach(function(unidad) {
    if (!actores[unidad.actor]) throw new Error("UNIDADES_REPORTE_ESTUDIO usa un actor no activo: " + unidad.actor);
    if (!unidad.unidad || !unidad.etiqueta) throw new Error("Cada unidad activa necesita unidad y etiqueta.");
    if (normalizarTexto(unidad.tipo) === "segmento" && !segmentos[unidad.segmento]) throw new Error("Unidad '" + unidad.unidad + "' usa un segmento no activo: " + unidad.segmento);
    if (normalizarTexto(unidad.tipo) === "grupo" && !grupos[unidad.grupo || unidad.unidad]) throw new Error("Unidad '" + unidad.unidad + "' usa un grupo no activo: " + (unidad.grupo || unidad.unidad));
  });

  obtenerGruposSegmentosActivos().forEach(function(grupo) {
    (grupo.segmentos || []).forEach(function(segmento) {
      if (!segmentos[segmento]) throw new Error("GRUPOS_SEGMENTOS_ESTUDIO '" + grupo.grupo + "' contiene un segmento no activo: " + segmento);
    });
  });
}

function validarUmbralesAlertas() {
  const umbrales = UMBRALES_ALERTA_ESTUDIO || {};
  [
    "noContestaIntentosMinimos",
    "responsableNoContestaPocosIntentosMinimoCasos",
    "responsableNoBarridosMinimoCasos",
    "responsableNoBarridosPorcentaje",
    "casosSinResponsableMinimo",
    "diferenciaEfectivasDiaMinima",
  ].forEach(function(campo) {
    const valor = Number(umbrales[campo]);
    if (!isFinite(valor) || valor < 0) throw new Error("UMBRALES_ALERTA_ESTUDIO." + campo + " debe ser un numero mayor o igual a 0.");
  });
}

function validarHojaUniverso() {
  const libroUniverso = abrirLibro(URL_HOJA_UNIVERSO);
  const problemas = [];

  obtenerBasesActivas().forEach(function(base) {
    const hoja = libroUniverso.getSheetByName(base.pestanaUniverso);
    if (!hoja) {
      problemas.push("No existe la pestana universo '" + base.pestanaUniverso + "' para " + base.actor + ".");
      return;
    }
    if (hoja.getLastRow() < 2 || hoja.getLastColumn() < 1) {
      problemas.push("La pestana '" + base.pestanaUniverso + "' debe tener encabezados y por lo menos una fila de base.");
      return;
    }

    const encabezados = normalizarEncabezados(hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0]);
    obtenerVariablesControlActivas(base.actor).forEach(function(variable) {
      if (encontrarIndiceEncabezado(encabezados, variable.campo) < 0) {
        problemas.push("No se encontro el campo de control '" + variable.campo + "' en la pestana universo '" + base.pestanaUniverso + "'.");
      }
    });
  });

  if (problemas.length) throw new Error(problemas.join(" "));
  return "Hoja universo OK.";
}

function sincronizarRespuestas() {
  validarConfiguracion();
  registrarProgreso(NOMBRE_AVANCE_INTERNO, "En curso", "Preparando descarga y tablas internas");

  const libroInterno = abrirLibro(URL_HOJA_INTERNA);
  const respuestasPorActor = crearMapaRespuestasVacio();
  const filasAvanceEncuesta = [];
  const monitoreosTelefonicos = [];

  obtenerEncuestasActivas().forEach(function(encuesta) {
    registrarProgreso("SurveyMonkey", "En curso", "Descargando detalles: " + encuesta.actor + " / " + encuesta.canal);
    const detalleEncuesta = consultarSurveyMonkey("/surveys/" + encodeURIComponent(encuesta.surveyId) + "/details");
    const mapaPreguntas = construirMapaPreguntas(detalleEncuesta);
    registrarProgreso("SurveyMonkey", "En curso", "Descargando recopiladores: " + encuesta.actor + " / " + encuesta.canal);
    const recopiladores = consultarRecopiladoresEncuesta(encuesta.surveyId);
    registrarProgreso("SurveyMonkey", "En curso", "Descargando respuestas: " + encuesta.actor + " / " + encuesta.canal);
    const respuestas = consultarTodasLasPaginas("/surveys/" + encodeURIComponent(encuesta.surveyId) + "/responses/bulk", { per_page: 100 });
    registrarProgreso("SurveyMonkey", "En curso", "Procesando " + respuestas.length + " respuestas: " + encuesta.actor + " / " + encuesta.canal);
    const resultado = convertirRespuestasABBDD(encuesta, detalleEncuesta, mapaPreguntas, respuestas, recopiladores);

    agregarRespuestasAlActor(respuestasPorActor[encuesta.actor], resultado);
    filasAvanceEncuesta.push([
      encuesta.actor,
      encuesta.canal,
      detalleEncuesta.title || encuesta.tituloReferencial || "",
      resultado.completas,
      resultado.parciales,
      resultado.rechazos,
      respuestas.length,
      resultado.ultimaActualizacion,
    ]);
  });

  obtenerActoresActivos().forEach(function(actor) {
    const acumulado = respuestasPorActor[actor];
    registrarProgreso(NOMBRE_AVANCE_INTERNO, "En curso", "Actualizando " + PREFIJO_RESPUESTAS + actor);
    escribirTabla(libroInterno, PREFIJO_RESPUESTAS + actor, acumulado.encabezados, acumulado.filas);
  });

  registrarProgreso(NOMBRE_AVANCE_INTERNO, "En curso", "Actualizando " + PESTANA_AVANCE_ENCUESTA);
  escribirAvanceEncuesta(libroInterno, respuestasPorActor);
  const avancesPorDia = construirAvancesPorDia(respuestasPorActor);

  const avancesPorActor = construirAvancesPorActor(respuestasPorActor);
  obtenerActoresActivos().forEach(function(actor) {
    const avance = avancesPorActor[actor];
    registrarProgreso(NOMBRE_AVANCE_INTERNO, "En curso", "Actualizando " + actor + SUFIJO_AVANCE_CLIENTE);
    escribirTabla(libroInterno, actor + SUFIJO_AVANCE_CLIENTE, avance.encabezados, avance.filas);
  });

  const detalleVariables = construirDetalleVariables(avancesPorActor);
  const distribucionEgresados = construirDistribucionEgresados(avancesPorActor);
  registrarProgreso(NOMBRE_AVANCE_INTERNO, "En curso", "Actualizando tablero " + PESTANA_RESUMEN_INTERNO);
  escribirResumenInterno(libroInterno, respuestasPorActor, avancesPorDia, detalleVariables, distribucionEgresados);
  registrarProgreso(NOMBRE_AVANCE_INTERNO, "En curso", "Actualizando " + PESTANA_DETALLE_AVANCE_CLIENTE);
  escribirDetalleAvanceCliente(libroInterno, detalleVariables, distribucionEgresados);
  obtenerMonitoreosTelefonicosActivos().forEach(function(monitoreo) {
    const nombrePestana = nombrePestanaMonitoreoTelefonico(monitoreo);
    registrarProgreso(NOMBRE_AVANCE_INTERNO, "En curso", "Actualizando " + nombrePestana);
    const datosMonitoreo = construirMonitoreoTelefonico(monitoreo, respuestasPorActor);
    monitoreosTelefonicos.push(datosMonitoreo);
    escribirMonitoreoTelefonico(libroInterno, nombrePestana, datosMonitoreo);
  });
  registrarProgreso(NOMBRE_AVANCE_INTERNO, "En curso", "Actualizando " + PESTANA_ALERTAS_INTERNO);
  escribirAlertasInternas(libroInterno, construirAlertasInternas(monitoreosTelefonicos, respuestasPorActor));
  registrarProgreso(NOMBRE_AVANCE_INTERNO, "En curso", "Ordenando y formateando pestanas internas");
  eliminarPestanasInternasSobrantes(libroInterno);
  ordenarPestanasInternas(libroInterno);
  formatearLibroBasico(libroInterno);

  return NOMBRE_AVANCE_INTERNO + " actualizado.";
}

function publicarHojaCliente() {
  validarHojaUniverso();
  registrarProgreso(NOMBRE_REPORTE_CLIENTE, "En curso", "Preparando REPORTE");

  const libroCliente = abrirLibro(URL_HOJA_CLIENTE);
  const libroUniverso = abrirLibro(URL_HOJA_UNIVERSO);
  const libroInterno = abrirLibro(URL_HOJA_INTERNA);
  const respuestasPorActor = leerRespuestasInternasPorActor(libroInterno);
  const avancesPorActor = {};

  obtenerActoresActivos().forEach(function(actor) {
    registrarProgreso(NOMBRE_REPORTE_CLIENTE, "En curso", "Cruzando base y respuestas: " + actor);
    const baseConfig = obtenerBasePorActor(actor);
    const universo = leerTablaDeLibro(libroUniverso, baseConfig.pestanaUniverso);
    const avance = construirAvanceActor(actor, universo, respuestasPorActor[actor] || []);
    avancesPorActor[actor] = avance;

    registrarProgreso(NOMBRE_REPORTE_CLIENTE, "En curso", "Actualizando " + actor + SUFIJO_AVANCE_CLIENTE);
    escribirTabla(libroCliente, actor + SUFIJO_AVANCE_CLIENTE, avance.encabezados, avance.filas);
  });
  const resumenCliente = construirResumenUnidadesDesdeRespuestas(respuestasPorActor, avancesPorActor).map(function(item) {
    return {
      unidad: item.etiqueta,
      total: item.total,
      completas: item.completas,
      parciales: item.parciales,
      rechazos: item.rechazos,
      sinRespuesta: item.sinRespuesta,
      avance: item.total ? item.completas / item.total : 0,
    };
  });
  const avancesPorDia = construirAvancesPorDia(respuestasPorActor);
  const distribucionEgresados = construirDistribucionEgresados(avancesPorActor);

  registrarProgreso(NOMBRE_REPORTE_CLIENTE, "En curso", "Actualizando " + PESTANA_REPORTE_CLIENTE);
  escribirReporteCliente(libroCliente, resumenCliente, avancesPorDia);
  registrarProgreso(NOMBRE_REPORTE_CLIENTE, "En curso", "Actualizando " + PESTANA_DETALLE_AVANCE_CLIENTE);
  escribirDetalleAvanceCliente(libroCliente, construirDetalleVariables(avancesPorActor), distribucionEgresados);
  registrarProgreso(NOMBRE_REPORTE_CLIENTE, "En curso", "Actualizando " + PESTANA_AVANCE_ENCUESTA);
  escribirAvanceEncuesta(libroCliente, respuestasPorActor);
  registrarProgreso(NOMBRE_REPORTE_CLIENTE, "En curso", "Ordenando y formateando REPORTE");
  eliminarPestanasClienteSobrantes(libroCliente);
  ordenarPestanasCliente(libroCliente);
  formatearCliente(libroCliente);

  return NOMBRE_REPORTE_CLIENTE + " publicado.";
}

function validarSalidasPublicadas() {
  const problemas = [];
  const libroInterno = abrirLibro(URL_HOJA_INTERNA);
  const libroCliente = abrirLibro(URL_HOJA_CLIENTE);

  validarAniosNormalizadosEnAvance(libroInterno, NOMBRE_AVANCE_INTERNO, problemas);
  validarAniosNormalizadosEnAvance(libroCliente, NOMBRE_REPORTE_CLIENTE, problemas);
  validarFormatosResumenInterno(libroInterno, problemas);
  validarFormatosAvanceEncuesta(libroInterno, NOMBRE_AVANCE_INTERNO, problemas);
  validarFormatosAvanceEncuesta(libroCliente, NOMBRE_REPORTE_CLIENTE, problemas);
  validarFormatoReporteCliente(libroCliente, problemas);
  validarPestanaAlertasInterna(libroInterno, problemas);
  validarReporteClienteSinPestanasInternas(libroCliente, problemas);
  validarMonitoreoTelefonicoV2(libroInterno, problemas);

  if (problemas.length) {
    throw new Error("Validacion de salidas publicadas: " + problemas.join(" | "));
  }
  return "Salidas publicadas OK: alertas, monitoreo, anos, conteos y porcentajes validados.";
}

function validarPestanaAlertasInterna(libroInterno, problemas) {
  const hoja = libroInterno.getSheetByName(PESTANA_ALERTAS_INTERNO);
  if (!hoja) {
    problemas.push(NOMBRE_AVANCE_INTERNO + ": falta la pestana interna " + PESTANA_ALERTAS_INTERNO + ".");
    return;
  }
  if (hoja.getLastRow() < 2) problemas.push(NOMBRE_AVANCE_INTERNO + " / " + PESTANA_ALERTAS_INTERNO + ": debe tener encabezados y por lo menos una fila.");
}

function validarReporteClienteSinPestanasInternas(libroCliente, problemas) {
  const internas = {};
  internas[PESTANA_RESUMEN_INTERNO] = true;
  internas[PESTANA_ALERTAS_INTERNO] = true;
  internas[PESTANA_MONITOREO_TELEFONICO] = true;
  internas[PESTANA_ESTADO_EJECUCION] = true;

  libroCliente.getSheets().forEach(function(hoja) {
    const nombre = hoja.getName();
    if (internas[nombre] || nombre.indexOf(PREFIJO_RESPUESTAS) === 0) {
      problemas.push(NOMBRE_REPORTE_CLIENTE + ": no debe contener la pestana interna '" + nombre + "'.");
    }
  });
}

function validarMonitoreoTelefonicoV2(libroInterno, problemas) {
  obtenerMonitoreosTelefonicosActivos().forEach(function(monitoreo) {
    const nombrePestana = nombrePestanaMonitoreoTelefonico(monitoreo);
    const hoja = libroInterno.getSheetByName(nombrePestana);
    if (!hoja) {
      problemas.push(NOMBRE_AVANCE_INTERNO + ": falta " + nombrePestana + ".");
      return;
    }
    validarBloqueProduccionDiaSoloEfectivas(hoja, problemas);
    validarBloqueProduccionDiaResponsableSoloEfectivas(hoja, problemas);
    if (!encontrarFilaConTexto(hoja, "Efectivas por día: barrido vs SurveyMonkey")) {
      problemas.push(NOMBRE_AVANCE_INTERNO + " / " + nombrePestana + ": falta el bloque Efectivas por día: barrido vs SurveyMonkey.");
    }
  });
}

function validarBloqueProduccionDiaSoloEfectivas(hoja, problemas) {
  const filaTitulo = encontrarFilaConTexto(hoja, "Producción por día");
  if (!filaTitulo) {
    problemas.push(NOMBRE_AVANCE_INTERNO + " / " + hoja.getName() + ": falta Producción por día.");
    return;
  }
  const valores = leerFilasBloque(hoja, filaTitulo);
  const filasDatos = valores.slice(2).filter(function(fila) { return String(fila[0] || "").trim() !== ""; });
  if (filasDatos.length !== 1 || normalizarTexto(filasDatos[0][0]) !== "efectivas") {
    problemas.push(NOMBRE_AVANCE_INTERNO + " / " + hoja.getName() + ": Producción por día debe tener solo una fila llamada Efectivas.");
  }
}

function validarBloqueProduccionDiaResponsableSoloEfectivas(hoja, problemas) {
  const filaTitulo = encontrarFilaConTexto(hoja, "Producción por día por responsable");
  if (!filaTitulo) {
    problemas.push(NOMBRE_AVANCE_INTERNO + " / " + hoja.getName() + ": falta Producción por día por responsable.");
    return;
  }
  const valores = leerFilasBloque(hoja, filaTitulo);
  const filasDatos = valores.slice(2).filter(function(fila) { return String(fila[0] || "").trim() !== ""; });
  const malas = filasDatos.filter(function(fila) { return normalizarTexto(fila[1]) !== "efectivas"; });
  if (malas.length) {
    problemas.push(NOMBRE_AVANCE_INTERNO + " / " + hoja.getName() + ": Producción por día por responsable debe usar solo Indicador=Efectivas.");
  }
}

function leerFilasBloque(hoja, filaTitulo) {
  const columnas = hoja.getLastColumn();
  const valores = hoja.getRange(filaTitulo, 1, hoja.getLastRow() - filaTitulo + 1, columnas).getValues();
  const salida = [];
  for (let i = 0; i < valores.length; i++) {
    const vacia = valores[i].every(function(celda) { return String(celda || "").trim() === ""; });
    if (i > 0 && vacia) break;
    salida.push(valores[i]);
  }
  return salida;
}

function validarAniosNormalizadosEnAvance(libro, nombreLibro, problemas) {
  obtenerVariablesControlActivas().filter(function(variable) {
    return variable.tipo === "anio";
  }).forEach(function(variable) {
    const hoja = libro.getSheetByName(variable.actor + SUFIJO_AVANCE_CLIENTE);
    if (!hoja || hoja.getLastRow() < 2) return;

    const encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
    const indice = encontrarIndiceEncabezado(encabezados, variable.campo);
    if (indice < 0) {
      problemas.push(nombreLibro + " / " + hoja.getName() + ": no se encontro la columna '" + variable.campo + "'.");
      return;
    }

    const valores = hoja.getRange(2, indice + 1, hoja.getLastRow() - 1, 1).getValues();
    const ejemplos = [];
    valores.forEach(function(fila, i) {
      const valor = fila[0];
      if (valor === "" || valor === null || valor === undefined) return;
      const texto = String(valor).trim();
      if (texto === "Sin dato" || /^(19|20)\d{2}$/.test(texto)) return;
      ejemplos.push("fila " + (i + 2) + " = " + texto);
    });

    if (ejemplos.length) {
      problemas.push(nombreLibro + " / " + hoja.getName() + ": '" + variable.campo + "' debe estar normalizado como ano, no como fecha/serial. Ejemplos: " + ejemplos.slice(0, 5).join(", "));
    }
  });
}

function validarFormatosResumenInterno(libro, problemas) {
  const hoja = libro.getSheetByName(PESTANA_RESUMEN_INTERNO);
  if (!hoja || hoja.getLastRow() < 2) return;
  const filaTitulo = encontrarFilaConTexto(hoja, "Resumen por unidad") || encontrarFilaConTexto(hoja, "Resumen por actor");
  if (!filaTitulo) return;

  validarFormatosPorEncabezadoEnFila(
    hoja,
    NOMBRE_AVANCE_INTERNO,
    filaTitulo + 1,
    obtenerUnidadesReporteActivas().length,
    ["Universo", "Completas", "Parciales", "Rechazos", "Sin respuesta"],
    ["Avance total"],
    problemas
  );
}

function validarFormatosAvanceEncuesta(libro, nombreLibro, problemas) {
  const hoja = libro.getSheetByName(PESTANA_AVANCE_ENCUESTA);
  if (!hoja || hoja.getLastRow() < 2) return;
  const filaEncabezado = encontrarFilaConTexto(hoja, "Actor");
  if (!filaEncabezado) {
    validarFechasAvanceEncuestaLegibles(hoja, nombreLibro, problemas);
    return;
  }

  validarFormatosPorEncabezadoEnFila(
    hoja,
    nombreLibro,
    filaEncabezado,
    hoja.getLastRow() - filaEncabezado,
    ["Completas", "Parciales", "Rechazos", "Total respuestas"],
    [],
    problemas
  );
  validarFechasAvanceEncuestaLegibles(hoja, nombreLibro, problemas);
}

function validarFechasAvanceEncuestaLegibles(hoja, nombreLibro, problemas) {
  const filas = hoja.getLastRow();
  const columnas = hoja.getLastColumn();
  if (!filas || !columnas) return;

  const valores = hoja.getRange(1, 1, filas, columnas).getValues();
  for (let r = 0; r < valores.length; r++) {
    for (let c = 0; c < valores[r].length; c++) {
      if (normalizarTexto(valores[r][c]) !== "ultima actualizacion") continue;
      const ultimaFila = encontrarUltimaFilaBloqueResumenInterno(valores, r);
      for (let i = r + 1; i <= ultimaFila; i++) {
        const valor = valores[i][c];
        if (valor === "" || valor === null || valor === undefined) continue;
        if (obtenerSerialFecha(valor)) {
          problemas.push(nombreLibro + " / " + hoja.getName() + ": 'Ultima actualizacion' aparece como serial de fecha en fila " + (i + 1) + ".");
          return;
        }
      }
    }
  }
}

function validarFormatosPorEncabezado(hoja, nombreLibro, columnasConteo, columnasPorcentaje, problemas) {
  validarFormatosPorEncabezadoEnFila(
    hoja,
    nombreLibro,
    1,
    hoja.getLastRow() - 1,
    columnasConteo,
    columnasPorcentaje,
    problemas
  );
}

function validarFormatosPorEncabezadoEnFila(hoja, nombreLibro, filaEncabezados, cantidadFilasDatos, columnasConteo, columnasPorcentaje, problemas) {
  const filas = hoja.getLastRow();
  const columnas = hoja.getLastColumn();
  if (!columnas || cantidadFilasDatos < 1 || filaEncabezados >= filas) return;

  const encabezados = hoja.getRange(filaEncabezados, 1, 1, columnas).getValues()[0];
  columnasConteo.forEach(function(nombreColumna) {
    const indice = encontrarIndiceEncabezado(encabezados, nombreColumna);
    if (indice < 0) return;
    if (rangoTieneFormatoPorcentaje(hoja.getRange(filaEncabezados + 1, indice + 1, cantidadFilasDatos, 1))) {
      problemas.push(nombreLibro + " / " + hoja.getName() + ": la columna de conteo '" + nombreColumna + "' esta formateada como porcentaje.");
    }
  });

  columnasPorcentaje.forEach(function(nombreColumna) {
    const indice = encontrarIndiceEncabezado(encabezados, nombreColumna);
    if (indice < 0) return;
    if (!rangoTieneFormatoPorcentaje(hoja.getRange(filaEncabezados + 1, indice + 1, cantidadFilasDatos, 1))) {
      problemas.push(nombreLibro + " / " + hoja.getName() + ": la columna '" + nombreColumna + "' debe verse como porcentaje.");
    }
  });
}

function encontrarFilaConTexto(hoja, textoBuscado) {
  const valores = hoja.getRange(1, 1, hoja.getLastRow(), 1).getValues();
  const buscado = normalizarTexto(textoBuscado);
  for (let i = 0; i < valores.length; i++) {
    if (normalizarTexto(valores[i][0]) === buscado) return i + 1;
  }
  return 0;
}

function validarFormatoReporteCliente(libro, problemas) {
  const hoja = libro.getSheetByName(PESTANA_REPORTE_CLIENTE);
  if (!hoja || hoja.getLastRow() < 6) return;
  const filaEncabezado = encontrarFilaConTexto(hoja, "Unidad") || encontrarFilaConTexto(hoja, "Actor");
  if (filaEncabezado) {
    validarFormatosPorEncabezadoEnFila(
      hoja,
      NOMBRE_REPORTE_CLIENTE,
      filaEncabezado,
      hoja.getLastRow() - filaEncabezado,
      ["Universo", "Completas", "Parciales", "Rechazos", "Sin respuesta"],
      ["Avance total"],
      problemas
    );
  }
  validarFormatoBloquesEjecutivosReporteCliente(hoja, problemas);
}

function validarFormatoBloquesEjecutivosReporteCliente(hoja, problemas) {
  const filas = hoja.getLastRow();
  let bloques = 0;
  for (let r = 1; r <= filas - 2; r++) {
    const valorA = hoja.getRange(r, 1).getValue();
    const valorB = hoja.getRange(r, 2).getValue();
    if (!esEncabezadoEjecutivoReporteCliente(valorA, valorB)) continue;
    bloques++;

    const formatosConteo = hoja.getRange(r + 2, 1, 1, 5).getNumberFormats()[0];
    if (formatosConteo.some(function(formato) { return String(formato || "").indexOf("%") >= 0; })) {
      problemas.push(NOMBRE_REPORTE_CLIENTE + " / " + hoja.getName() + ": un cuadro ejecutivo tiene conteos formateados como porcentaje.");
    }
    const formatoAvance = String(hoja.getRange(r + 2, 6).getNumberFormat() || "");
    if (formatoAvance.indexOf("%") < 0) {
      problemas.push(NOMBRE_REPORTE_CLIENTE + " / " + hoja.getName() + ": el avance de un cuadro ejecutivo debe verse como porcentaje.");
    }
  }
  if (!bloques) problemas.push(NOMBRE_REPORTE_CLIENTE + " / " + hoja.getName() + ": falta el resumen ejecutivo por unidad.");
}

function rangoTieneFormatoPorcentaje(rango) {
  return rango.getNumberFormats().some(function(fila) {
    return fila.some(function(formato) {
      return String(formato || "").indexOf("%") >= 0;
    });
  });
}

function convertirRespuestasABBDD(encuesta, detalleEncuesta, mapaPreguntas, respuestas, recopiladores) {
  const encabezadosPreguntas = Object.keys(mapaPreguntas.porId).map(function(questionId) {
    return mapaPreguntas.porId[questionId].encabezado;
  });
  const encabezados = CAMPOS_METADATA.concat(encabezadosPreguntas);
  const filas = [];
  const objetos = [];
  let completas = 0;
  let parciales = 0;
  let rechazos = 0;
  let ultimaActualizacion = "";

  respuestas.forEach(function(respuesta) {
    const estado = normalizarEstado(respuesta.response_status || respuesta.status || "");
    const codPulso = extraerCodPulso(respuesta);
    const respuestasPorPregunta = extraerRespuestasPorPregunta(respuesta, mapaPreguntas);
    const rechazo = esRechazoPorRespuesta(encuesta, respuestasPorPregunta);
    const decision = clasificarRespuestaEncuesta(encuesta, estado, respuestasPorPregunta, rechazo);
    const completa = decision.completa;
    const parcial = decision.parcial;
    const objeto = {};

    if (completa) completas++;
    if (parcial) parciales++;
    if (rechazo) rechazos++;
    ultimaActualizacion = maxFechaIso(ultimaActualizacion, respuesta.date_modified || respuesta.date_created || "");

    CAMPOS_METADATA.forEach(function(campo) {
      objeto[campo] = valorMetadata(campo, encuesta, detalleEncuesta, respuesta, estado, completa, parcial, rechazo, codPulso, recopiladores);
    });
    encabezadosPreguntas.forEach(function(encabezado) {
      objeto[encabezado] = respuestasPorPregunta[encabezado] || "";
    });

    objetos.push(objeto);
    filas.push(encabezados.map(function(encabezado) { return objeto[encabezado] === undefined ? "" : objeto[encabezado]; }));
  });

  return { encabezados: encabezados, filas: filas, objetos: objetos, completas: completas, parciales: parciales, rechazos: rechazos, ultimaActualizacion: ultimaActualizacion };
}

function construirMapaPreguntas(detalleEncuesta) {
  const contadorTitulos = {};
  const porId = {};

  (detalleEncuesta.pages || []).forEach(function(page) {
    (page.questions || []).forEach(function(question) {
      const tituloBase = limpiarTituloPregunta(question.headings);
      contadorTitulos[tituloBase] = (contadorTitulos[tituloBase] || 0) + 1;
      porId[String(question.id)] = {
        encabezado: contadorTitulos[tituloBase] > 1 ? tituloBase + " [" + question.id + "]" : tituloBase,
        opciones: construirMapaOpcionesPregunta(question),
      };
    });
  });

  return { porId: porId };
}

function construirMapaOpcionesPregunta(question) {
  const opciones = {};
  const answers = question.answers || {};
  ["choices", "rows", "cols"].forEach(function(tipo) {
    (answers[tipo] || []).forEach(function(item) {
      if (item.id !== undefined && item.id !== null) opciones[String(item.id)] = limpiarTexto(item.text || item.label || item.heading || item.name || item.id);
    });
  });
  return opciones;
}

function extraerRespuestasPorPregunta(respuesta, mapaPreguntas) {
  const salida = {};
  (respuesta.pages || []).forEach(function(page) {
    (page.questions || []).forEach(function(question) {
      const info = mapaPreguntas.porId[String(question.id)];
      if (!info) return;
      const valores = (question.answers || []).map(function(answer) {
        return valorRespuesta(answer, info);
      }).filter(function(valor) { return valor !== ""; });
      salida[info.encabezado] = valores.join(" | ");
    });
  });
  return salida;
}

function valorRespuesta(answer, infoPregunta) {
  const partes = [];
  const opciones = (infoPregunta && infoPregunta.opciones) || {};

  agregarValorRespuesta(partes, answer.choice_id, opciones);
  agregarValorRespuesta(partes, answer.row_id, opciones);
  agregarValorRespuesta(partes, answer.col_id, opciones);
  ["text", "other_id", "choice_metadata", "tag"].forEach(function(campo) {
    if (answer[campo] !== undefined && answer[campo] !== null && String(answer[campo]).trim() !== "") partes.push(limpiarTexto(answer[campo]));
  });
  return partes.join(" / ");
}

function agregarValorRespuesta(partes, id, opciones) {
  if (id === undefined || id === null || String(id).trim() === "") return;
  partes.push(opciones[String(id)] || String(id));
}

function valorMetadata(campo, encuesta, detalleEncuesta, respuesta, estado, completa, parcial, rechazo, codPulso, recopiladores) {
  const recopilador = obtenerRecopiladorRespuesta(respuesta, recopiladores);
  const valores = {
    "Actor": encuesta.actor,
    "Canal": encuesta.canal,
    "survey_id": encuesta.surveyId,
    "Titulo encuesta": detalleEncuesta.title || encuesta.tituloReferencial || "",
    "response_id": respuesta.id || "",
    "collector_id": respuesta.collector_id || "",
    "Nombre recopilador": recopilador.nombre,
    "Tipo recopilador": recopilador.tipo,
    "recipient_id": respuesta.recipient_id || "",
    "Estado": estado,
    "Estado avance": rechazo ? "Rechazo" : (completa ? "Completa" : (parcial ? "Parcial" : "Sin respuesta")),
    "Completa": completa,
    "Parcial": parcial,
    "Rechazo": rechazo,
    "Fecha creacion": respuesta.date_created || "",
    "Fecha modificacion": respuesta.date_modified || "",
    "Llave conteo": codPulso || ("response_id:" + String(respuesta.id || "")),
    "CodPulso": codPulso,
    "Llave original SurveyMonkey": describirLlaveOriginalSurveyMonkey(respuesta),
    "Llave resuelta": describirLlaveResueltaRespuesta(encuesta.actor, respuesta),
    "Metodo de cruce": describirMetodoCruceRespuesta(encuesta.actor, respuesta, codPulso),
    "custom_value": respuesta.custom_value || "",
    "custom_variables": JSON.stringify(respuesta.custom_variables || {}),
    "email_address": respuesta.email_address || "",
    "first_name": respuesta.first_name || "",
    "last_name": respuesta.last_name || "",
    "ip_address": respuesta.ip_address || "",
    "collection_mode": respuesta.collection_mode || "",
    "language": respuesta.language || "",
    "total_time": respuesta.total_time || "",
    "edit_url": respuesta.edit_url || "",
    "analyze_url": respuesta.analyze_url || "",
    "href": respuesta.href || "",
    "metadata": JSON.stringify(respuesta.metadata || {}),
  };
  return valores[campo] === undefined ? "" : valores[campo];
}

function obtenerRecopiladorRespuesta(respuesta, recopiladores) {
  const id = String((respuesta && respuesta.collector_id) || "");
  const recopilador = id && recopiladores ? recopiladores[id] : null;
  return {
    nombre: recopilador ? recopilador.nombre : "",
    tipo: recopilador ? recopilador.tipo : "",
  };
}

function esRechazoPorRespuesta(encuesta, respuestasPorPregunta) {
  const reglas = obtenerReglasRechazoActivas(encuesta.actor);
  if (!reglas.length) return false;

  return Object.keys(respuestasPorPregunta || {}).some(function(pregunta) {
    const preguntaNormalizada = normalizarTexto(pregunta);
    const respuestaNormalizada = normalizarRespuestaValidacion(respuestasPorPregunta[pregunta]);

    return reglas.some(function(regla) {
      const coincidePregunta = (regla.patronesPregunta || []).every(function(patron) {
        return preguntaNormalizada.indexOf(normalizarTexto(patron)) >= 0;
      });
      if (!coincidePregunta) return false;

      return (regla.respuestasRechazo || []).some(function(respuestaRechazo) {
        return respuestaNormalizada === normalizarRespuestaValidacion(respuestaRechazo);
      });
    });
  });
}

function obtenerReglasRechazoActivas(actor) {
  return REGLAS_RECHAZO_POR_RESPUESTA.filter(function(regla) {
    if (!regla.activo) return false;
    return !regla.actor || regla.actor === actor;
  });
}

function normalizarRespuestaValidacion(valor) {
  return normalizarTexto(String(valor || "").replace(/\s*\|\s*/g, " ").replace(/\s*\/\s*/g, " "));
}

function clasificarRespuestaEncuesta(encuesta, estado, respuestasPorPregunta, rechazo) {
  if (rechazo) return { completa: false, parcial: false };
  if (esEstadoCompleto(estado)) return { completa: true, parcial: false };

  const parcial = esEstadoParcial(estado);
  if (parcial && actorPermiteParcialComoCompleta(encuesta.actor)) {
    const respondidas = contarPreguntasRespondidas(respuestasPorPregunta);
    if (respondidas >= MINIMO_PREGUNTAS_CON_RESPUESTA_PARCIAL_COMPLETA) {
      return { completa: true, parcial: false };
    }
  }

  return { completa: false, parcial: parcial };
}

function actorPermiteParcialComoCompleta(actor) {
  return ACTORES_PARCIALES_REVISABLES_COMO_COMPLETAS.map(normalizarTexto).indexOf(normalizarTexto(actor)) >= 0;
}

function contarPreguntasRespondidas(respuestasPorPregunta) {
  return Object.keys(respuestasPorPregunta || {}).filter(function(pregunta) {
    return String(respuestasPorPregunta[pregunta] || "").trim() !== "";
  }).length;
}

function construirAvanceActor(actor, universo, respuestas) {
  const encabezadosBase = normalizarEncabezados(universo.encabezados);
  const encabezados = COLUMNAS_AVANCE_ACTOR.concat(encabezadosBase);
  const indiceRespuestas = indexarRespuestas(actor, respuestas, universo);
  const filas = [];
  let completas = 0;
  let parciales = 0;
  let rechazos = 0;

  universo.filas.forEach(function(filaBase) {
    const objetoBase = filaAObjeto(encabezadosBase, filaBase);
    const respuesta = buscarRespuestaParaBase(actor, objetoBase, indiceRespuestas);
    const estado = estadoAvanceDesdeRespuesta(respuesta);

    if (estado === "Completa") completas++;
    if (estado === "Parcial") parciales++;
    if (estado === "Rechazo") rechazos++;

    filas.push([estado].concat(encabezadosBase.map(function(encabezado) {
      return valorBaseParaAvance(actor, encabezado, objetoBase[encabezado]);
    })));
  });

  const total = universo.filas.length;
  return {
    encabezados: encabezados,
    filas: filas,
    total: total,
    completas: completas,
    parciales: parciales,
    rechazos: rechazos,
    sinRespuesta: Math.max(total - completas - parciales - rechazos, 0),
  };
}

function valorBaseParaAvance(actor, encabezado, valor) {
  const variableAnio = obtenerVariablesControlActivas(actor).filter(function(variable) {
    return variable.tipo === "anio" && normalizarTexto(variable.campo) === normalizarTexto(encabezado);
  })[0];
  if (variableAnio) return normalizarAnioEgreso(valor);
  return valor === undefined || valor === null ? "" : valor;
}

function construirResumenActorDesdeRespuestas(actor, totalUniverso, respuestas) {
  const respuestasUnicas = deduplicarRespuestasParaConteo(actor, respuestas);
  let completas = 0;
  let parciales = 0;
  let rechazos = 0;

  respuestasUnicas.forEach(function(respuesta) {
    const estado = estadoAvanceDesdeRespuesta(respuesta);
    if (estado === "Completa") completas++;
    if (estado === "Parcial") parciales++;
    if (estado === "Rechazo") rechazos++;
  });

  return {
    total: totalUniverso,
    completas: completas,
    parciales: parciales,
    rechazos: rechazos,
    sinRespuesta: Math.max(totalUniverso - completas - parciales - rechazos, 0),
  };
}

function deduplicarRespuestasParaConteo(actor, respuestas) {
  const indice = {};

  respuestas.forEach(function(respuesta) {
    if (respuestaTieneConflictoCodigoPulso(respuesta)) return;
    const llaves = obtenerLlavesObjeto(actor, respuesta, "respuesta");
    const alias = obtenerAliasParaRespuesta(actor, respuesta);
    const llavesAlias = alias ? llavesAliasConfiguradas(alias) : [];
    const llavesConteo = limpiarDuplicados(llavesAlias.concat(llaves));
    const llaveConteo = llavesConteo.length ? llavesConteo[0] : ("response_id:" + String(respuesta.response_id || ""));
    if (!llaveConteo) return;
    if (!indice[llaveConteo] || compararPrioridadRespuesta(respuesta, indice[llaveConteo]) > 0) indice[llaveConteo] = respuesta;
  });

  return Object.keys(indice).map(function(llave) { return indice[llave]; });
}

function indexarRespuestas(actor, respuestas) {
  const universo = arguments.length > 2 ? arguments[2] : null;
  const contextoCruce = universo ? construirContextoCruceUniverso(actor, universo) : null;
  const indice = {};
  respuestas.forEach(function(respuesta) {
    if (respuestaTieneConflictoCodigoPulso(respuesta)) return;
    const llaves = obtenerLlavesObjeto(actor, respuesta, "respuesta");
    const resolucionAlias = contextoCruce ? resolverAliasRespuestaConUniverso(actor, respuesta, contextoCruce) : null;
    if (resolucionAlias && resolucionAlias.estado === "ok") {
      resolucionAlias.llaves.forEach(function(llave) { llaves.push(llave); });
    }

    limpiarDuplicados(llaves).forEach(function(llave) {
      if (!indice[llave] || compararPrioridadRespuesta(respuesta, indice[llave]) > 0) indice[llave] = respuesta;
    });
  });
  return indice;
}

function respuestaTieneConflictoCodigoPulso(respuesta) {
  const codigoResuelto = normalizarCodigo(leerCampoObjeto(respuesta, "CodPulso"));
  const codigoDigitado = normalizarCodigo(leerCampoObjeto(respuesta, [
    "Cod Pulso",
    "Código Pulso",
    "Codigo Pulso",
    "Código Pulso final",
    "Codigo Pulso final",
  ]));

  return !!(codigoResuelto && codigoDigitado && codigoResuelto !== codigoDigitado);
}

function buscarRespuestaParaBase(actor, objetoBase, indiceRespuestas) {
  const llaves = obtenerLlavesObjeto(actor, objetoBase, "universo");
  for (let i = 0; i < llaves.length; i++) {
    if (indiceRespuestas[llaves[i]]) return indiceRespuestas[llaves[i]];
  }
  return null;
}

function construirContextoCruceUniverso(actor, universo) {
  const encabezadosBase = normalizarEncabezados(universo.encabezados || []);
  const filas = [];
  const llaves = {};

  (universo.filas || []).forEach(function(filaBase) {
    const objetoBase = filaAObjeto(encabezadosBase, filaBase);
    const llavesBase = obtenerLlavesObjeto(actor, objetoBase, "universo");
    llavesBase.forEach(function(llave) { llaves[llave] = true; });
    filas.push({ objeto: objetoBase, llaves: llavesBase });
  });

  return { actor: actor, encabezados: encabezadosBase, filas: filas, llaves: llaves };
}

function resolverAliasRespuestaConUniverso(actor, respuesta, contextoCruce) {
  const alias = obtenerAliasParaRespuesta(actor, respuesta);
  if (!alias) return null;

  const candidatas = buscarFilasUniversoPorAlias(alias, contextoCruce);
  if (candidatas.length !== 1) {
    return { estado: candidatas.length ? "ambiguo" : "sin_fila", alias: alias, candidatas: candidatas };
  }
  return { estado: "ok", alias: alias, fila: candidatas[0], llaves: candidatas[0].llaves };
}

function buscarFilasUniversoPorAlias(alias, contextoCruce) {
  const llavesAlias = llavesAliasConfiguradas(alias);
  const candidatasPorLlave = {};

  if (llavesAlias.length) {
    contextoCruce.filas.forEach(function(fila) {
      const llavesFila = crearSet(fila.llaves);
      if (llavesAlias.some(function(llave) { return llavesFila[llave]; })) {
        candidatasPorLlave[fila.llaves.join("|")] = fila;
      }
    });
  }

  if (alias.campoUniverso) {
    contextoCruce.filas.forEach(function(fila) {
      const valor = leerCampoObjeto(fila.objeto, alias.campoUniverso);
      if (normalizarTexto(valor) === normalizarTexto(alias.valorUniverso)) {
        candidatasPorLlave[fila.llaves.join("|")] = fila;
      }
    });
  }

  return Object.keys(candidatasPorLlave).map(function(llave) { return candidatasPorLlave[llave]; });
}

function respuestaCruzaDirectamenteConUniverso(actor, respuesta, contextoCruce) {
  return obtenerLlavesObjeto(actor, respuesta, "respuesta").some(function(llave) {
    return !!contextoCruce.llaves[llave];
  });
}

function obtenerLlavesObjeto(actor, objeto, origen) {
  const llaves = [];
  const camposConfigurados = origen === "respuesta" ? CAMPOS_LLAVE_RESPUESTA : CAMPOS_LLAVE_UNIVERSO;

  Object.keys(objeto).forEach(function(campo) {
    const valor = objeto[campo];
    const nombre = normalizarTexto(campo);
    const campoConfigurado = estaEnListaNormalizada(nombre, camposConfigurados);
    if (valor === "" || valor === null || valor === undefined) return;
    if (origen === "respuesta" && esCampoRespuestaIgnorado(nombre)) return;

    if (campoConfigurado || esCampoEmail(nombre)) {
      if (esCampoEmail(nombre)) llaves.push("email:" + normalizarEmail(valor));
    }
    if (campoConfigurado || esCampoTelefono(nombre)) {
      if (esCampoTelefono(nombre)) llaves.push("telefono:" + normalizarTelefono(valor));
    }
    if (campoConfigurado || esCampoCodigo(nombre)) {
      if (esCampoCodigo(nombre)) agregarLlavesCodigo(llaves, valor);
    }
    if (campoConfigurado && !esCampoEmail(nombre) && !esCampoTelefono(nombre) && !esCampoCodigo(nombre)) {
      agregarLlavesCodigo(llaves, valor);
    }
  });

  if (USAR_NOMBRE_COMO_LLAVE_FALLBACK) {
    const nombre = construirNombreNormalizado(objeto);
    if (nombre) llaves.push("nombre:" + nombre);
  }

  return limpiarDuplicados(llaves.filter(function(llave) { return llave.split(":")[1]; }));
}

function esCampoRespuestaIgnorado(nombre) {
  return [
    "survey_id",
    "response_id",
    "collector_id",
    "nombre recopilador",
    "tipo recopilador",
    "recipient_id",
    "estado",
    "completa",
    "parcial",
    "rechazo",
    "total_time",
  ].indexOf(nombre) >= 0;
}

function estaEnListaNormalizada(nombre, lista) {
  return lista.map(normalizarTexto).indexOf(nombre) >= 0;
}

function esCampoEmail(nombre) {
  return nombre.indexOf("mail") >= 0 || nombre.indexOf("correo") >= 0;
}

function esCampoTelefono(nombre) {
  return nombre.indexOf("fono") >= 0 || nombre.indexOf("celular") >= 0 || nombre.indexOf("telefono") >= 0 || nombre.indexOf("phone") >= 0;
}

function esCampoCodigo(nombre) {
  return nombre.indexOf("codigo") >= 0 || nombre.indexOf("cod") >= 0 || nombre.indexOf("pulso") >= 0 || nombre === "id";
}

function construirNombreNormalizado(objeto) {
  const partes = [];
  Object.keys(objeto).forEach(function(campo) {
    const nombreCampo = normalizarTexto(campo);
    if (nombreCampo === "nombre recopilador" || nombreCampo === "tipo recopilador") return;
    if (nombreCampo.indexOf("nombre") >= 0 || nombreCampo.indexOf("apellido") >= 0) partes.push(objeto[campo]);
    if (nombreCampo === "first_name" || nombreCampo === "last_name") partes.push(objeto[campo]);
  });
  return normalizarTexto(partes.join(" "));
}

function compararPrioridadRespuesta(a, b) {
  const puntajeA = puntajeRespuesta(a);
  const puntajeB = puntajeRespuesta(b);
  if (puntajeA !== puntajeB) return puntajeA - puntajeB;
  return String(fechaRespuesta(a)).localeCompare(String(fechaRespuesta(b)));
}

function puntajeRespuesta(respuesta) {
  if (aBooleano(respuesta.Completa)) return 3;
  if (aBooleano(respuesta.Parcial)) return 2;
  if (aBooleano(respuesta.Rechazo)) return 1;
  return 0;
}

function fechaRespuesta(respuesta) {
  return respuesta["Fecha modificacion"] || respuesta["Fecha creacion"] || "";
}

function estadoAvanceDesdeRespuesta(respuesta) {
  if (!respuesta) return "Sin respuesta";
  if (aBooleano(respuesta.Completa)) return "Completa";
  if (aBooleano(respuesta.Parcial)) return "Parcial";
  if (aBooleano(respuesta.Rechazo)) return "Rechazo";
  return "Sin respuesta";
}

function agregarRespuestasAlActor(acumulado, resultado) {
  resultado.encabezados.forEach(function(encabezado) {
    if (acumulado.encabezados.indexOf(encabezado) < 0) acumulado.encabezados.push(encabezado);
  });
  resultado.objetos.forEach(function(objeto) { acumulado.objetos.push(objeto); });
  acumulado.completas += resultado.completas;
  acumulado.parciales += resultado.parciales;
  acumulado.rechazos += resultado.rechazos;
}

function obtenerRespuestasActor(respuestasPorActor, actor) {
  const entrada = respuestasPorActor[actor] || [];
  return entrada.objetos || entrada || [];
}

function construirAvancesPorActor(respuestasPorActor) {
  const libroUniverso = abrirLibro(URL_HOJA_UNIVERSO);
  const avances = {};

  obtenerActoresActivos().forEach(function(actor) {
    const base = obtenerBasePorActor(actor);
    const universo = leerTablaDeLibro(libroUniverso, base.pestanaUniverso);
    const respuestas = obtenerRespuestasActor(respuestasPorActor, actor);
    avances[actor] = construirAvanceActor(actor, universo, respuestas);
  });

  return avances;
}

function construirAvancesPorDia(respuestasPorActor) {
  const respuestasValidasPorActor = construirRespuestasValidasPorActor(respuestasPorActor);
  return {
    efectivo: construirAvancePorDiaModo(respuestasValidasPorActor, true),
    general: construirAvancePorDiaModo(respuestasValidasPorActor, false),
  };
}

function construirAvancePorDia(respuestasPorActor) {
  return construirAvancesPorDia(respuestasPorActor).general;
}

function construirRespuestasValidasPorActor(respuestasPorActor) {
  const libroUniverso = abrirLibro(URL_HOJA_UNIVERSO);
  const salida = {};

  obtenerActoresActivos().forEach(function(actor) {
    const base = obtenerBasePorActor(actor);
    const universo = leerTablaDeLibro(libroUniverso, base.pestanaUniverso);
    salida[actor] = obtenerRespuestasValidasActor(actor, universo, obtenerRespuestasActor(respuestasPorActor, actor));
  });

  return salida;
}

function obtenerRespuestasValidasActor(actor, universo, respuestas) {
  const encabezadosBase = normalizarEncabezados(universo.encabezados || []);
  const indiceRespuestas = indexarRespuestas(actor, respuestas || [], universo);
  const vistas = {};
  const salida = [];

  (universo.filas || []).forEach(function(filaBase) {
    const objetoBase = filaAObjeto(encabezadosBase, filaBase);
    const respuesta = buscarRespuestaParaBase(actor, objetoBase, indiceRespuestas);
    if (!respuesta) return;

    const llave = respuesta.response_id ? "response_id:" + respuesta.response_id : obtenerLlavesObjeto(actor, respuesta, "respuesta").join("|");
    if (vistas[llave]) return;
    vistas[llave] = true;
    salida.push(combinarRespuestaConUniverso(respuesta, objetoBase));
  });

  return salida;
}

function combinarRespuestaConUniverso(respuesta, objetoBase) {
  const salida = {};
  Object.keys(respuesta || {}).forEach(function(campo) { salida[campo] = respuesta[campo]; });
  Object.keys(objetoBase || {}).forEach(function(campo) {
    if (salida[campo] === undefined || salida[campo] === null || String(salida[campo]).trim() === "") salida[campo] = objetoBase[campo];
  });
  return salida;
}

function construirAvancePorDiaModo(respuestasPorActor, soloEfectivas) {
  const acumulado = {};
  const fechas = {};
  const estados = soloEfectivas ? [
    { valor: "Completa", etiqueta: "Efectivas" },
  ] : [
    { valor: "Completa", etiqueta: "Completas" },
    { valor: "Parcial", etiqueta: "Parciales" },
    { valor: "Rechazo", etiqueta: "Rechazos" },
  ];

  obtenerUnidadesReporteActivas().forEach(function(unidad) {
    const actor = unidad.actor;
    const respuestas = deduplicarRespuestasParaConteo(actor, obtenerRespuestasActor(respuestasPorActor, actor));
    respuestas.forEach(function(respuesta) {
      if (!respuestaPerteneceAUnidad(respuesta, unidad)) return;
      const fecha = normalizarFechaDia(respuesta["Fecha creacion"]);
      const estado = estadoAvanceDesdeRespuesta(respuesta);
      if (estado === "Sin respuesta") return;
      if (soloEfectivas && estado !== "Completa") return;

      fechas[fecha] = true;
      const llave = [unidad.etiqueta || unidad.unidad, estado, fecha].join("||");
      acumulado[llave] = (acumulado[llave] || 0) + 1;
    });
  });

  const fechasOrdenadas = Object.keys(fechas).sort(ordenarFechasAvanceDia);
  const encabezados = COLUMNAS_BASE_AVANCE_DIA.concat(fechasOrdenadas).concat(["Total"]);
  const filas = [];

  obtenerUnidadesReporteActivas().forEach(function(unidad) {
    const etiqueta = unidad.etiqueta || unidad.unidad;
    estados.forEach(function(estado) {
      const valores = fechasOrdenadas.map(function(fecha) {
        return acumulado[[etiqueta, estado.valor, fecha].join("||")] || 0;
      });
      const total = valores.reduce(function(suma, valor) { return suma + valor; }, 0);
      filas.push([etiqueta, estado.etiqueta].concat(valores).concat([total]));
    });
  });

  return { encabezados: encabezados, filas: filas };
}

function construirEfectivasPorDiaCanal(respuestasPorActor) {
  const canales = canalesReporteOrdenados();
  const fechas = {};
  const acumulado = {};

  obtenerUnidadesReporteActivas().forEach(function(unidad) {
    const actor = unidad.actor;
    const respuestas = deduplicarRespuestasParaConteo(actor, obtenerRespuestasActor(respuestasPorActor, actor));
    respuestas.forEach(function(respuesta) {
      if (!respuestaPerteneceAUnidad(respuesta, unidad)) return;
      if (estadoAvanceDesdeRespuesta(respuesta) !== "Completa") return;
      const canal = canalVisibleRespuesta(respuesta);
      const fecha = normalizarFechaDia(respuesta["Fecha creacion"]);
      const etiqueta = unidad.etiqueta || unidad.unidad;
      fechas[fecha] = true;
      acumulado[[canal, etiqueta, fecha].join("||")] = (acumulado[[canal, etiqueta, fecha].join("||")] || 0) + 1;
    });
  });

  const fechasOrdenadas = Object.keys(fechas).sort(ordenarFechasAvanceDia);
  const salida = {};
  canales.forEach(function(canal) {
    salida[canal] = {
      encabezados: ["Unidad"].concat(fechasOrdenadas).concat(["Total"]),
      filas: obtenerUnidadesReporteActivas().map(function(unidad) {
        const etiqueta = unidad.etiqueta || unidad.unidad;
        const valores = fechasOrdenadas.map(function(fecha) {
          return acumulado[[canal, etiqueta, fecha].join("||")] || 0;
        });
        return [etiqueta].concat(valores).concat([valores.reduce(function(suma, valor) { return suma + valor; }, 0)]);
      }),
    };
  });
  return salida;
}

function canalesReporteOrdenados() {
  return ["Telefónico", "Correo", "Enlace personalizado", "Ficha QR"];
}

function canalVisibleRespuesta(respuesta) {
  return canalEncuestaVisibleRespuesta(respuesta);
}

function canalEncuestaVisibleRespuesta(respuesta) {
  return canalVisibleDesdeTexto(respuesta.Canal);
}

function canalOperativoRespuesta(respuesta) {
  const regla = reglaUsoOperativoRecopilador(respuesta);
  if (regla && regla.canalTelefonico) return canalVisibleDesdeTexto(regla.canalTelefonico);
  return canalEncuestaVisibleRespuesta(respuesta);
}

function usoOperativoRespuesta(respuesta) {
  const regla = reglaUsoOperativoRecopilador(respuesta);
  if (regla) return "Cierre telefónico por " + nombreReglaCierreTelefonico(regla);
  return "Aplicación " + canalEncuestaVisibleRespuesta(respuesta);
}

function reglaUsoOperativoRecopilador(respuesta) {
  const reglas = obtenerRecopiladoresCierreTelefonicoActivos();
  for (let i = 0; i < reglas.length; i++) {
    if (respuestaCumpleReglaCierreTelefonico(respuesta, reglas[i])) return reglas[i];
  }
  return null;
}

function canalVisibleDesdeTexto(canalOriginal) {
  const canal = normalizarTexto(canalOriginal);
  if (canal.indexOf("telefon") >= 0) return "Telefónico";
  if (canal.indexOf("whatsapp") >= 0 || canal.indexOf("wsp") >= 0 || canal.indexOf("personalizado") >= 0) return "Enlace personalizado";
  if (canal.indexOf("qr") >= 0 || canal.indexOf("presencial") >= 0) return "Ficha QR";
  return "Correo";
}

function escribirAvanceEncuesta(libro, respuestasPorActor) {
  const hoja = libro.getSheetByName(PESTANA_AVANCE_ENCUESTA) || libro.insertSheet(PESTANA_AVANCE_ENCUESTA);
  const respuestasConciliadasPorActor = construirRespuestasValidasPorActor(respuestasPorActor);
  const bloquesCanal = construirEfectivasPorDiaCanal(respuestasConciliadasPorActor);
  const filasRecopilador = construirAvancePorRecopilador(respuestasConciliadasPorActor);
  const filasGenerales = construirAvanceEncuestaGeneral(respuestasConciliadasPorActor);
  const ancho = Math.max(ENCABEZADO_AVANCE_ENCUESTA.length, ENCABEZADO_AVANCE_RECOPILADOR.length, anchoBloquesCanal(bloquesCanal));
  const filas = [];

  canalesReporteOrdenados().forEach(function(canal) {
    const bloque = bloquesCanal[canal] || { encabezados: ["Unidad", "Total"], filas: [] };
    filas.push(["Efectivas por día - " + canal]);
    filas.push(bloque.encabezados);
    bloque.filas.forEach(function(fila) { filas.push(fila); });
    filas.push([]);
  });

  if (filasRecopilador.length) {
    filas.push(["Avance por recopilador"]);
    filas.push(ENCABEZADO_AVANCE_RECOPILADOR);
    filasRecopilador.forEach(function(fila) { filas.push(fila); });
    filas.push([]);
  }

  filas.push(["Resumen general por encuesta"]);
  filas.push(ENCABEZADO_AVANCE_ENCUESTA);
  filasGenerales.forEach(function(fila) { filas.push(fila); });

  limpiarHoja(hoja);
  asegurarTamanoHoja(hoja, Math.max(filas.length, 1), ancho);
  hoja.getRange(1, 1, filas.length, ancho).setValues(normalizarAncho(filas, ancho));
  formatearAvanceEncuesta(hoja);
}

function anchoBloquesCanal(bloquesCanal) {
  return canalesReporteOrdenados().reduce(function(maximo, canal) {
    const bloque = bloquesCanal[canal] || {};
    return Math.max(maximo, (bloque.encabezados || []).length);
  }, 1);
}

function construirAvancePorRecopilador(respuestasPorActor) {
  const grupos = {};

  obtenerActoresActivos().forEach(function(actor) {
    obtenerRespuestasActor(respuestasPorActor, actor).forEach(function(respuesta) {
      const recopilador = nombreRecopiladorVisible(respuesta);
      if (!recopilador) return;
      const canalEncuesta = canalEncuestaVisibleRespuesta(respuesta);
      const usoOperativo = usoOperativoRespuesta(respuesta);
      const titulo = respuesta["Titulo encuesta"] || "";
      const tipo = respuesta["Tipo recopilador"] || "";
      const llave = [actor, canalEncuesta, usoOperativo, titulo, String(respuesta.collector_id || ""), recopilador, tipo].join("||");
      const grupo = grupos[llave] || { actor: actor, canalEncuesta: canalEncuesta, usoOperativo: usoOperativo, titulo: titulo, recopilador: recopilador, tipo: tipo, completas: 0, parciales: 0, rechazos: 0, total: 0, ultima: "" };
      grupos[llave] = grupo;
      grupo.total++;
      if (aBooleano(respuesta.Completa)) grupo.completas++;
      if (aBooleano(respuesta.Parcial)) grupo.parciales++;
      if (aBooleano(respuesta.Rechazo)) grupo.rechazos++;
      grupo.ultima = maxFechaIso(grupo.ultima, fechaRespuesta(respuesta));
    });
  });

  return Object.keys(grupos).sort().map(function(llave) {
    const grupo = grupos[llave];
    return [grupo.actor, grupo.canalEncuesta, grupo.usoOperativo, grupo.titulo, grupo.recopilador, tipoRecopiladorVisible(grupo.tipo), grupo.completas, grupo.parciales, grupo.rechazos, grupo.total, formatearFechaHoraReporte(grupo.ultima)];
  });
}

function nombreRecopiladorVisible(respuesta) {
  const nombre = String(respuesta["Nombre recopilador"] || "").trim();
  if (nombre) return nombre;
  const id = String(respuesta.collector_id || "").trim();
  if (id) return "Recopilador " + id;
  return "";
}

function tipoRecopiladorVisible(tipo) {
  const valor = normalizarTexto(tipo);
  if (valor === "email") return "Correo electrónico";
  if (valor === "weblink" || valor === "web link") return "Enlace Web";
  return String(tipo || "").trim();
}

function construirAvanceEncuestaGeneral(respuestasPorActor) {
  const grupos = {};

  obtenerActoresActivos().forEach(function(actor) {
    obtenerRespuestasActor(respuestasPorActor, actor).forEach(function(respuesta) {
      const canal = canalVisibleRespuesta(respuesta);
      const titulo = respuesta["Titulo encuesta"] || "";
      const llave = [actor, canal, titulo].join("||");
      const grupo = grupos[llave] || { actor: actor, canal: canal, titulo: titulo, completas: 0, parciales: 0, rechazos: 0, total: 0, ultima: "" };
      grupos[llave] = grupo;
      grupo.total++;
      if (aBooleano(respuesta.Completa)) grupo.completas++;
      if (aBooleano(respuesta.Parcial)) grupo.parciales++;
      if (aBooleano(respuesta.Rechazo)) grupo.rechazos++;
      grupo.ultima = maxFechaIso(grupo.ultima, fechaRespuesta(respuesta));
    });
  });

  return Object.keys(grupos).sort().map(function(llave) {
    const grupo = grupos[llave];
    return [grupo.actor, grupo.canal, grupo.titulo, grupo.completas, grupo.parciales, grupo.rechazos, grupo.total, formatearFechaHoraReporte(grupo.ultima)];
  });
}

function ordenarFechasAvanceDia(a, b) {
  if (a === "Sin fecha") return 1;
  if (b === "Sin fecha") return -1;
  return String(a).localeCompare(String(b));
}

function construirDetalleVariables(avancesPorActor) {
  const filas = [];

  obtenerActoresActivos().forEach(function(actor) {
    const avance = avancesPorActor[actor];
    if (!avance) return;

    obtenerVariablesControlActivas(actor).forEach(function(variable) {
      const indiceCampo = encontrarIndiceEncabezado(avance.encabezados, variable.campo);
      if (indiceCampo < 0) {
        filas.push([actor, variable.etiqueta || variable.campo, "Campo no encontrado: " + variable.campo, 0, 0, 0, 0, 0, ""]);
        return;
      }

      const grupos = {};
      avance.filas.forEach(function(fila) {
        const estado = String(fila[0] || "Sin respuesta");
        const valor = normalizarValorVariable(actor, variable, fila[indiceCampo]);
        if (!grupos[valor]) grupos[valor] = { total: 0, completas: 0, parciales: 0, rechazos: 0, sinRespuesta: 0 };

        grupos[valor].total++;
        if (estado === "Completa") grupos[valor].completas++;
        else if (estado === "Parcial") grupos[valor].parciales++;
        else if (estado === "Rechazo") grupos[valor].rechazos++;
        else grupos[valor].sinRespuesta++;
      });

      Object.keys(grupos).sort(ordenarValoresDetalle).forEach(function(valor) {
        const grupo = grupos[valor];
        filas.push([
          actor,
          variable.etiqueta || variable.campo,
          valor,
          grupo.total,
          grupo.completas,
          grupo.parciales,
          grupo.rechazos,
          grupo.sinRespuesta,
          grupo.total ? grupo.completas / grupo.total : 0,
        ]);
      });
    });
  });

  return filas;
}

function construirDistribucionEgresados(avancesPorActor) {
  const variable = obtenerVariablesControlActivas("Egresados").filter(function(item) {
    return item.tipo === "anio";
  })[0];
  const avance = avancesPorActor.Egresados;
  if (!variable || !avance) return [];

  const indiceCampo = encontrarIndiceEncabezado(avance.encabezados, variable.campo);
  if (indiceCampo < 0) return [];

  const filas = [];
  obtenerUnidadesReporteActivas().filter(function(unidad) {
    return normalizarTexto(unidad.actor) === "egresados";
  }).forEach(function(unidad) {
    const filasAvance = filasAvanceParaUnidadGenerica(unidad, avance);
    const grupos = {};
    let totalUniverso = 0;
    let totalEfectivas = 0;

    filasAvance.forEach(function(fila) {
      const anio = normalizarValorVariable("Egresados", variable, fila[indiceCampo]);
      const estado = String(fila[0] || "Sin respuesta");
      const grupo = grupos[anio] || { universo: 0, efectivas: 0, parciales: 0, rechazos: 0, sinRespuesta: 0 };
      grupos[anio] = grupo;
      grupo.universo++;
      totalUniverso++;
      if (estado === "Completa") {
        grupo.efectivas++;
        totalEfectivas++;
      } else if (estado === "Parcial") grupo.parciales++;
      else if (estado === "Rechazo") grupo.rechazos++;
      else grupo.sinRespuesta++;
    });

    Object.keys(grupos).sort(ordenarValoresDetalle).forEach(function(anio) {
      const grupo = grupos[anio];
      const porcentajeUniverso = totalUniverso ? grupo.universo / totalUniverso : 0;
      const porcentajeEfectivas = totalEfectivas ? grupo.efectivas / totalEfectivas : 0;
      const diferenciaDistribucion = Math.abs(porcentajeEfectivas - porcentajeUniverso);
      const avanceEfectivo = grupo.universo ? grupo.efectivas / grupo.universo : 0;
      filas.push([
        unidad.etiqueta || unidad.unidad,
        variable.etiqueta || variable.campo,
        anio,
        grupo.universo,
        porcentajeUniverso,
        grupo.efectivas,
        porcentajeEfectivas,
        diferenciaDistribucion,
        avanceEfectivo,
        grupo.parciales,
        grupo.rechazos,
        grupo.sinRespuesta,
      ]);
    });
  });

  return filas;
}

function construirMonitoreoTelefonico(monitoreo, respuestasPorActor) {
  const libroBarrido = abrirLibro(monitoreo.urlHojaBarrido);
  const tablaBarrido = leerTablaDeLibro(libroBarrido, monitoreo.pestanaBarrido);
  validarEncabezadosBarridoTelefonico(tablaBarrido, monitoreo);
  const respuestasActor = obtenerRespuestasActor(respuestasPorActor, monitoreo.actor);
  const correosWebCompletos = combinarMapasCorreos(
    leerCorreosWebCompletos(libroBarrido, monitoreo.pestanaCorreosWebCompletos),
    obtenerCorreosCompletosNoTelefonicos(respuestasActor, monitoreo.canal)
  );
  const respuestasTelefonicas = respuestasActor.filter(function(respuesta) {
    return normalizarTexto(respuesta.Canal) === normalizarTexto(monitoreo.canal);
  });
  const recopiladoresCierreTelefonico = obtenerRecopiladoresCierreTelefonicoParaMonitoreo(monitoreo);
  const respuestasCierreTelefonico = obtenerRespuestasCierreTelefonico(monitoreo, respuestasActor, recopiladoresCierreTelefonico);
  const indicePlataforma = indexarRespuestasTelefonicasPorCodPulso(respuestasTelefonicas);
  const indiceCierreTelefonico = indexarRespuestasTelefonicasPorCodPulso(respuestasCierreTelefonico);
  const filasBarrido = normalizarBarridoTelefonico(tablaBarrido, monitoreo, correosWebCompletos);

  return {
    monitoreo: monitoreo,
    filasBarrido: filasBarrido,
    correosWebCompletos: correosWebCompletos,
    respuestasTelefonicas: respuestasTelefonicas,
    respuestasCierreTelefonico: respuestasCierreTelefonico,
    recopiladoresCierreTelefonico: recopiladoresCierreTelefonico,
    indicePlataforma: indicePlataforma,
    indiceCierreTelefonico: indiceCierreTelefonico,
    statusOrdenados: obtenerStatusOrdenadosMonitoreo(filasBarrido),
    fechasOrdenadas: obtenerFechasOrdenadasMonitoreo(filasBarrido),
  };
}

function obtenerRecopiladoresCierreTelefonicoActivos() {
  return (RECOPILADORES_CIERRE_TELEFONICO || []).filter(function(regla) {
    return regla.activo;
  });
}

function obtenerRecopiladoresCierreTelefonicoParaMonitoreo(monitoreo) {
  const actor = normalizarTexto(monitoreo.actor);
  const canalTelefonico = normalizarTexto(monitoreo.canal);
  return obtenerRecopiladoresCierreTelefonicoActivos().filter(function(regla) {
    return normalizarTexto(regla.actor) === actor && normalizarTexto(regla.canalTelefonico) === canalTelefonico;
  });
}

function obtenerRespuestasCierreTelefonico(monitoreo, respuestasActor, reglas) {
  if (!reglas || !reglas.length) return [];
  const canalTelefonico = normalizarTexto(monitoreo.canal);
  return (respuestasActor || []).filter(function(respuesta) {
    if (normalizarTexto(respuesta.Canal) === canalTelefonico) return false;
    return reglas.some(function(regla) {
      return respuestaCumpleReglaCierreTelefonico(respuesta, regla);
    });
  });
}

function respuestaCumpleReglaCierreTelefonico(respuesta, regla) {
  if (regla.surveyId && String(respuesta.survey_id || "") !== String(regla.surveyId)) return false;
  if (regla.collectorId && String(respuesta.collector_id || "") !== String(regla.collectorId)) return false;
  if (regla.recopilador && normalizarTexto(respuesta["Nombre recopilador"]) !== normalizarTexto(regla.recopilador)) return false;
  return true;
}

function etiquetaCierreTelefonico(datos) {
  return "Efectivas validadas por " + nombreCierreTelefonico(datos);
}

function nombreCierreTelefonico(datos) {
  const etiquetas = {};
  (datos.recopiladoresCierreTelefonico || []).forEach(function(regla) {
    etiquetas[nombreReglaCierreTelefonico(regla)] = true;
  });
  const lista = Object.keys(etiquetas);
  if (lista.length === 1) return lista[0];
  if (lista.length > 1) return "cierre operativo";
  return "cierre operativo";
}

function nombreReglaCierreTelefonico(regla) {
  return regla.etiqueta || regla.recopilador || regla.collectorId || "cierre operativo";
}

function estadoPlataformaGestionTelefonica(datos, codPulso) {
  const directa = estadoAvanceDesdeRespuesta(datos.indicePlataforma[codPulso]);
  const cierre = estadoAvanceDesdeRespuesta(datos.indiceCierreTelefonico[codPulso]);
  if (directa === "Completa" || cierre === "Completa") return "Completa";
  if (directa === "Rechazo" || cierre === "Rechazo") return "Rechazo";
  if (directa === "Parcial" || cierre === "Parcial") return "Parcial";
  return "Sin respuesta";
}

function normalizarBarridoTelefonico(tablaBarrido, monitoreo, correosWebCompletos) {
  const columnas = monitoreo.columnas || {};
  return tablaBarrido.filas.map(function(fila) {
    const objeto = filaAObjeto(tablaBarrido.encabezados, fila);
    const correo = normalizarEmail(leerCampoObjeto(objeto, columnas.correo));
    const status = etiquetaStatusTelefonico(leerCampoObjeto(objeto, columnas.status));
    const codPulso = String(leerCampoObjeto(objeto, columnas.codPulso) || "").trim();
    const enlace = String(leerCampoObjeto(objeto, columnas.enlace) || "").trim();
    const webCompleto = correo && correosWebCompletos[correo];

    return {
      codPulso: codPulso,
      enlace: enlace,
      idEnlace: extraerIdEnlaceTelefonico(enlace),
      codigoPucp: leerCampoObjeto(objeto, columnas.codigoPucp),
      nombre: leerCampoObjeto(objeto, columnas.nombre),
      correo: correo,
      responsable: String(leerCampoObjeto(objeto, columnas.responsable) || "Sin responsable").trim() || "Sin responsable",
      status: status,
      statusNormalizado: normalizarTexto(status),
      intentos: numeroIntentos(leerCampoObjeto(objeto, columnas.intentos)),
      fecha: normalizarFechaCampo(leerCampoObjeto(objeto, columnas.fecha)),
      cicloEgreso: leerCampoObjeto(objeto, columnas.cicloEgreso),
      anioEgreso: normalizarAnioEgreso(leerCampoObjeto(objeto, columnas.cicloEgreso)),
      observacion: leerCampoObjeto(objeto, columnas.observacion),
      webCompleto: !!webCompleto,
    };
  }).filter(function(fila) {
    return fila.codPulso || fila.correo || fila.nombre || fila.enlace;
  }).filter(function(fila) {
    return !fila.webCompleto;
  });
}

function validarEncabezadosBarridoTelefonico(tablaBarrido, monitoreo) {
  const columnas = monitoreo.columnas || {};
  const obligatorias = [
    ["codPulso", "CodPulso/id"],
    ["enlace", "Enlace"],
    ["correo", "Correo"],
    ["responsable", "Responsable"],
    ["status", "Status/Estatus"],
    ["intentos", "Intentos"],
    ["fecha", "Fecha"],
  ];
  const faltantes = [];

  obligatorias.forEach(function(item) {
    const llave = item[0];
    const etiqueta = item[1];
    if (!existeCampoEnEncabezados(tablaBarrido.encabezados, columnas[llave])) faltantes.push(etiqueta + " (" + describirNombresCampo(columnas[llave]) + ")");
  });

  if (faltantes.length) {
    throw new Error(
      "La pestana de barrido '" + monitoreo.pestanaBarrido + "' no tiene encabezados esperados para " +
      monitoreo.actor + " / " + monitoreo.canal + ": " + faltantes.join(", ") +
      ". Ajusta MONITOREOS_TELEFONICOS.columnas; se buscan nombres de encabezado, no letras de columna."
    );
  }
}

function leerCorreosWebCompletos(libroBarrido, nombrePestana) {
  const hoja = libroBarrido.getSheetByName(nombrePestana);
  const correos = {};
  if (!hoja || hoja.getLastRow() < 1 || hoja.getLastColumn() < 1) return correos;

  const valores = hoja.getRange(1, 1, hoja.getLastRow(), hoja.getLastColumn()).getValues();
  valores.forEach(function(fila) {
    fila.forEach(function(celda) {
      extraerEmails(celda).forEach(function(email) { correos[email] = true; });
    });
  });
  return correos;
}

function obtenerCorreosCompletosNoTelefonicos(respuestasActor, canalTelefonico) {
  const correos = {};
  const canalExcluido = normalizarTexto(canalTelefonico);

  respuestasActor.forEach(function(respuesta) {
    if (normalizarTexto(respuesta.Canal) === canalExcluido) return;
    if (estadoAvanceDesdeRespuesta(respuesta) !== "Completa") return;

    const correo = normalizarEmail(respuesta.email_address || "");
    if (correo) correos[correo] = true;
  });

  return correos;
}

function combinarMapasCorreos() {
  const salida = {};
  Array.prototype.slice.call(arguments).forEach(function(mapa) {
    Object.keys(mapa || {}).forEach(function(correo) {
      salida[normalizarEmail(correo)] = true;
    });
  });
  return salida;
}

function extraerEmails(valor) {
  const texto = String(valor || "");
  const encontrados = texto.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig) || [];
  return encontrados.map(normalizarEmail);
}

function indexarRespuestasTelefonicasPorCodPulso(respuestasTelefonicas) {
  const indice = {};
  respuestasTelefonicas.forEach(function(respuesta) {
    const codPulso = String(respuesta.CodPulso || "").trim();
    if (!codPulso) return;
    if (!indice[codPulso] || compararPrioridadRespuesta(respuesta, indice[codPulso]) > 0) indice[codPulso] = respuesta;
  });
  return indice;
}

function obtenerStatusOrdenadosMonitoreo(filasBarrido) {
  const status = {};
  filasBarrido.forEach(function(fila) {
    status[fila.status] = true;
  });
  return Object.keys(status).sort(ordenarStatusTelefonico);
}

function obtenerFechasOrdenadasMonitoreo(filasBarrido) {
  const fechas = {};
  filasBarrido.forEach(function(fila) {
    fechas[fila.fecha || "Sin fecha"] = true;
  });
  return Object.keys(fechas).sort(ordenarFechasAvanceDia);
}

function construirFilasMonitoreoTelefonico(datos) {
  const filas = [];
  const ancho = anchoMonitoreoTelefonico(datos);

  agregarBloqueResumenTelefonico(filas, datos);
  filas.push([]);
  agregarBloqueProduccionDia(filas, datos);
  filas.push([]);
  agregarBloqueComparacionEfectivasDia(filas, datos);
  filas.push([]);
  agregarBloqueAvanceAnioEgreso(filas, datos);
  filas.push([]);
  agregarBloqueEfectivosResponsable(filas, datos);
  filas.push([]);
  agregarBloqueDetalleCierresTelefonicos(filas, datos);
  filas.push([]);
  agregarBloqueResponsablesARevisar(filas, datos);
  filas.push([]);
  agregarBloqueEstatusResponsable(filas, datos);
  filas.push([]);
  agregarBloqueProduccionDiaResponsable(filas, datos);
  filas.push([]);
  agregarBloqueInsistenciaTelefonica(filas, datos);
  filas.push([]);
  agregarBloqueAuditoriaTelefonica(filas, datos);

  return normalizarAncho(filas, ancho);
}

function anchoMonitoreoTelefonico(datos) {
  const anchoEstatusResponsable = 4 + datos.statusOrdenados.length;
  const anchoDia = 1 + datos.fechasOrdenadas.length + 1;
  const anchoDiaResponsable = 2 + datos.fechasOrdenadas.length + 1;
  const anchoAnioEgreso = 2 + datos.statusOrdenados.length + 2;
  const anchoResponsablesARevisar = 8;
  const anchoInsistencia = 13;
  const anchoAuditoria = 8;
  const anchoDetalleCierres = 9;
  return Math.max(8, anchoEstatusResponsable, anchoDia, anchoDiaResponsable, anchoAnioEgreso, anchoResponsablesARevisar, anchoInsistencia, anchoAuditoria, anchoDetalleCierres);
}

function agregarBloqueResumenTelefonico(filas, datos) {
  const resumen = calcularResumenGeneralTelefonico(datos);
  filas.push(["Monitoreo telefónico - " + datos.monitoreo.actor + " / " + datos.monitoreo.canal]);
  filas.push(["Ultima actualizacion", Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Lima", "dd/MM/yyyy HH:mm")]);
  filas.push(["Base de barrido", datos.monitoreo.urlHojaBarrido]);
  filas.push([]);
  filas.push(["Resumen general"]);
  filas.push(["Indicador", "Casos", "% del total telefónico"]);
  filas.push(["Casos barridos", resumen.casosBarridos, resumen.totalTelefonico ? resumen.casosBarridos / resumen.totalTelefonico : 0]);
  filas.push(["No barridos", resumen.noBarridos, resumen.totalTelefonico ? resumen.noBarridos / resumen.totalTelefonico : 0]);
  filas.push(["Total telefónico", resumen.totalTelefonico, resumen.totalTelefonico ? 1 : 0]);
  filas.push([]);
  filas.push(["Distribución por estatus"]);
  filas.push(["Estatus", "Casos", "% del total telefónico"]);

  datos.statusOrdenados.forEach(function(status) {
    const cantidad = resumen.porStatus[status] || 0;
    filas.push([status, cantidad, resumen.totalTelefonico ? cantidad / resumen.totalTelefonico : 0]);
  });
}

function calcularResumenGeneralTelefonico(datos) {
  const resumen = {
    totalTelefonico: datos.filasBarrido.length,
    casosBarridos: 0,
    noBarridos: 0,
    porStatus: {},
  };

  datos.filasBarrido.forEach(function(fila) {
    resumen.porStatus[fila.status] = (resumen.porStatus[fila.status] || 0) + 1;
    if (esNoBarridoTelefonico(fila.status)) resumen.noBarridos++;
    else if (!esSinStatusTelefonico(fila.status)) resumen.casosBarridos++;
  });

  return resumen;
}

function agregarBloqueEfectivosResponsable(filas, datos) {
  const acumulados = calcularProduccionPorResponsable(datos);
  const etiquetaCierre = etiquetaCierreTelefonico(datos);

  filas.push(["Conciliación de efectivos por responsable"]);
  filas.push(["Responsable", "Casos en barrido", "Efectivos reportados en barrido", "Efectivos validados en link telefónico", etiquetaCierre, "Efectivos validados total", "Por revisar (barrido - SurveyMonkey)", "% validados sobre barrido"]);

  Object.keys(acumulados).sort(function(a, b) {
    return a.localeCompare(b, "es", { numeric: true });
  }).forEach(function(responsable) {
    const item = acumulados[responsable];
    filas.push([
      responsable,
      item.totalTelefonico,
      item.efectivosCampo,
      item.efectivosPlataforma,
      item.efectivosCierreTelefonico,
      item.efectivosPlataformaGestion,
      item.efectivosCampo - item.efectivosPlataformaGestion,
      item.totalTelefonico ? item.efectivosPlataformaGestion / item.totalTelefonico : 0,
    ]);
  });
}

function agregarBloqueDetalleCierresTelefonicos(filas, datos) {
  if (!datos.recopiladoresCierreTelefonico.length && !datos.respuestasCierreTelefonico.length) return;

  const filasPorCod = {};
  datos.filasBarrido.forEach(function(fila) {
    if (fila.codPulso && !filasPorCod[fila.codPulso]) filasPorCod[fila.codPulso] = fila;
  });

  filas.push([tituloDetalleCierresTelefonicos(datos)]);
  filas.push(["CodPulso", "Nombre", "Responsable", "Status campo", "Estado cierre", "Recopilador", "response_id", "Fecha respuesta", "Observación"]);

  if (!datos.respuestasCierreTelefonico.length) {
    filas.push(["Sin cierres por este recopilador", "", "", "", "", "", "", "", ""]);
    return;
  }

  datos.respuestasCierreTelefonico
    .slice()
    .sort(function(a, b) {
      return String(fechaRespuesta(a)).localeCompare(String(fechaRespuesta(b)));
    })
    .forEach(function(respuesta) {
      const codPulso = String(respuesta.CodPulso || "").trim();
      const fila = filasPorCod[codPulso] || {};
      filas.push([
        codPulso,
        fila.nombre || "",
        fila.responsable || "",
        fila.status || (codPulso ? "No encontrado en barrido" : "Sin CodPulso"),
        estadoAvanceDesdeRespuesta(respuesta),
        respuesta["Nombre recopilador"] || "",
        respuesta.response_id || "",
        formatearFechaHoraReporte(fechaRespuesta(respuesta)),
        fila.observacion || "",
      ]);
    });
}

function tituloDetalleCierresTelefonicos(datos) {
  return "Detalle de cierres por " + nombreCierreTelefonico(datos);
}

function agregarBloqueEstatusResponsable(filas, datos) {
  const acumulados = calcularProduccionPorResponsable(datos);
  const encabezado = ["Responsable", "Total telefónico", "Casos barridos", "No barridos"].concat(datos.statusOrdenados);

  filas.push(["Estatus por responsable"]);
  filas.push(encabezado);

  Object.keys(acumulados).sort(function(a, b) {
    return a.localeCompare(b, "es", { numeric: true });
  }).forEach(function(responsable) {
    const item = acumulados[responsable];
    const status = datos.statusOrdenados.map(function(nombreStatus) { return item.porStatus[nombreStatus] || 0; });
    filas.push([
      responsable,
      item.totalTelefonico,
      item.casosBarridos,
      item.noBarridos,
    ].concat(status));
  });
}

function agregarBloqueResponsablesARevisar(filas, datos) {
  const responsables = construirResponsablesARevisar(datos);
  const etiquetaCierre = etiquetaCierreTelefonico(datos);
  filas.push(["Responsables a revisar"]);
  filas.push(["Responsable", "Casos en barrido", "Efectivas validadas en link telefónico", etiquetaCierre, "Por revisar (barrido - SurveyMonkey)", "No barridos", "No contesta con pocos intentos", "Prioridad"]);

  if (!responsables.length) {
    filas.push(["Sin responsables a revisar", "", "", "", "", "", "", "OK"]);
    return;
  }

  responsables.forEach(function(item) {
    filas.push([
      item.responsable,
      item.totalTelefonico,
      item.efectivasPlataformaTelefonica,
      item.efectivasCierreTelefonico,
      item.diferenciaReal,
      item.noBarridos,
      item.noContestaPocosIntentos,
      item.prioridad,
    ]);
  });
}

function construirResponsablesARevisar(datos) {
  const produccion = calcularProduccionPorResponsable(datos);
  const insistencia = calcularInsistenciaTelefonica(datos);
  const filas = [];
  const umbrales = obtenerUmbralesAlerta();

  Object.keys(produccion).forEach(function(responsable) {
    if (esResponsableSinAsignar(responsable)) return;

    const item = produccion[responsable];
    const noContestaPocosIntentos = contarNoContestaConPocosIntentos(insistencia[responsable], umbrales.noContestaIntentosMinimos);
    const diferencia = item.efectivosCampo - item.efectivosPlataformaGestion;
    const porcentajeNoBarridos = item.totalTelefonico ? item.noBarridos / item.totalTelefonico : 0;
    let prioridad = "";

    if (Math.abs(diferencia) >= umbrales.diferenciaEfectivasDiaMinima) prioridad = "Alta";
    else if (noContestaPocosIntentos >= umbrales.responsableNoContestaPocosIntentosMinimoCasos || item.noBarridos >= umbrales.responsableNoBarridosMinimoCasos || porcentajeNoBarridos >= umbrales.responsableNoBarridosPorcentaje) prioridad = "Baja";

    if (!prioridad) return;
    filas.push({
      responsable: responsable,
      totalTelefonico: item.totalTelefonico,
      efectivasPlataformaTelefonica: item.efectivosPlataforma,
      efectivasCierreTelefonico: item.efectivosCierreTelefonico,
      diferenciaReal: diferencia,
      noBarridos: item.noBarridos,
      noContestaPocosIntentos: noContestaPocosIntentos,
      prioridad: prioridad,
    });
  });

  return filas.sort(function(a, b) {
    const orden = { Alta: 1, Media: 2, Baja: 3 };
    if (orden[a.prioridad] !== orden[b.prioridad]) return orden[a.prioridad] - orden[b.prioridad];
    return String(a.responsable).localeCompare(String(b.responsable), "es", { numeric: true });
  });
}

function calcularProduccionPorResponsable(datos) {
  const acumulados = {};

  datos.filasBarrido.forEach(function(fila) {
    const responsable = fila.responsable || "Sin responsable";
    const item = acumulados[responsable] || crearAcumuladoResponsable();
    acumulados[responsable] = item;

    item.totalTelefonico++;
    item.porStatus[fila.status] = (item.porStatus[fila.status] || 0) + 1;
    if (esNoBarridoTelefonico(fila.status)) item.noBarridos++;
    else if (!esSinStatusTelefonico(fila.status)) item.casosBarridos++;
    if (esEfectivoTelefonico(fila.status)) item.efectivosCampo++;

    const estadoTelefonico = estadoAvanceDesdeRespuesta(datos.indicePlataforma[fila.codPulso]);
    const estadoCierre = estadoAvanceDesdeRespuesta(datos.indiceCierreTelefonico[fila.codPulso]);
    if (estadoTelefonico === "Completa") item.efectivosPlataforma++;
    if (estadoCierre === "Completa") item.efectivosCierreTelefonico++;
    if (estadoTelefonico === "Completa" || estadoCierre === "Completa") item.efectivosPlataformaGestion++;
  });

  return acumulados;
}

function crearAcumuladoResponsable() {
  return {
    totalTelefonico: 0,
    casosBarridos: 0,
    noBarridos: 0,
    efectivosCampo: 0,
    efectivosPlataforma: 0,
    efectivosCierreTelefonico: 0,
    efectivosPlataformaGestion: 0,
    porStatus: {},
  };
}

function agregarBloqueProduccionDia(filas, datos) {
  // Produccion diaria toma solo efectivas de SurveyMonkey; las diferencias con campo viven en otros cuadros.
  const acumulado = calcularProduccionPorDiaEfectivasSurveyMonkey(datos);
  const encabezado = ["Indicador"].concat(datos.fechasOrdenadas).concat(["Total"]);

  filas.push(["Producción por día"]);
  filas.push(encabezado);

  const valores = datos.fechasOrdenadas.map(function(fecha) {
    return acumulado[fecha] || 0;
  });
  const total = valores.reduce(function(suma, valor) { return suma + valor; }, 0);
  filas.push(["Efectivas"].concat(valores).concat([total]));
}

function calcularProduccionPorDiaEfectivasSurveyMonkey(datos) {
  const acumulado = {};

  datos.filasBarrido.forEach(function(fila) {
    if (estadoPlataformaGestionTelefonica(datos, fila.codPulso) === "Completa") {
      const fecha = fila.fecha || "Sin fecha";
      acumulado[fecha] = (acumulado[fecha] || 0) + 1;
    }
  });

  return acumulado;
}

function agregarBloqueComparacionEfectivasDia(filas, datos) {
  const acumulado = calcularComparacionEfectivasDia(datos);
  const encabezado = ["Indicador"].concat(datos.fechasOrdenadas).concat(["Total"]);
  const indicadores = [
    "Efectivas reportadas en barrido",
    "Efectivas validadas en link telefónico",
    etiquetaCierreTelefonico(datos),
    "Efectivas validadas total",
    "Por revisar (barrido - SurveyMonkey)",
  ];

  filas.push(["Efectivas por día: barrido vs SurveyMonkey"]);
  filas.push(encabezado);

  indicadores.forEach(function(indicador) {
    const valores = datos.fechasOrdenadas.map(function(fecha) {
      return acumulado[[indicador, fecha].join("||")] || 0;
    });
    const total = valores.reduce(function(suma, valor) { return suma + valor; }, 0);
    filas.push([indicador].concat(valores).concat([total]));
  });
}

function calcularComparacionEfectivasDia(datos) {
  const acumulado = {};

  datos.filasBarrido.forEach(function(fila) {
    const fecha = fila.fecha || "Sin fecha";
    if (esEfectivoTelefonico(fila.status)) {
      sumarAcumuladoComparacionDia(acumulado, "Efectivas reportadas en barrido", fecha, 1);
    }
    const estadoTelefonico = estadoAvanceDesdeRespuesta(datos.indicePlataforma[fila.codPulso]);
    const estadoCierre = estadoAvanceDesdeRespuesta(datos.indiceCierreTelefonico[fila.codPulso]);
    if (estadoTelefonico === "Completa") {
      sumarAcumuladoComparacionDia(acumulado, "Efectivas validadas en link telefónico", fecha, 1);
    }
    if (estadoCierre === "Completa") {
      sumarAcumuladoComparacionDia(acumulado, etiquetaCierreTelefonico(datos), fecha, 1);
    }
    if (estadoTelefonico === "Completa" || estadoCierre === "Completa") {
      sumarAcumuladoComparacionDia(acumulado, "Efectivas validadas total", fecha, 1);
    }
  });

  datos.fechasOrdenadas.forEach(function(fecha) {
    const reportadas = acumulado[["Efectivas reportadas en barrido", fecha].join("||")] || 0;
    const gestion = acumulado[["Efectivas validadas total", fecha].join("||")] || 0;
    acumulado[["Por revisar (barrido - SurveyMonkey)", fecha].join("||")] = reportadas - gestion;
  });

  return acumulado;
}

function sumarAcumuladoComparacionDia(acumulado, indicador, fecha, valor) {
  const llave = [indicador, fecha].join("||");
  acumulado[llave] = (acumulado[llave] || 0) + valor;
}

function agregarBloqueAvanceAnioEgreso(filas, datos) {
  const acumulados = calcularAvanceAnioEgresoTelefonico(datos);
  const encabezado = ["Año de egreso", "Total telefónico"]
    .concat(datos.statusOrdenados)
    .concat(["Efectivos validados total", "% validados sobre total"]);

  filas.push(["Avance por año de egreso"]);
  filas.push(encabezado);

  Object.keys(acumulados).sort(ordenarValoresDetalle).forEach(function(anio) {
    const item = acumulados[anio];
    const status = datos.statusOrdenados.map(function(nombreStatus) { return item.porStatus[nombreStatus] || 0; });
    filas.push([
      anio,
      item.totalTelefonico,
    ].concat(status).concat([
      item.efectivosPlataformaGestion,
      item.totalTelefonico ? item.efectivosPlataformaGestion / item.totalTelefonico : 0,
    ]));
  });
}

function calcularAvanceAnioEgresoTelefonico(datos) {
  const acumulados = {};

  datos.filasBarrido.forEach(function(fila) {
    const anio = fila.anioEgreso || "Sin dato";
    const item = acumulados[anio] || { totalTelefonico: 0, efectivosPlataformaGestion: 0, porStatus: {} };
    acumulados[anio] = item;

    item.totalTelefonico++;
    item.porStatus[fila.status] = (item.porStatus[fila.status] || 0) + 1;
    if (estadoPlataformaGestionTelefonica(datos, fila.codPulso) === "Completa") item.efectivosPlataformaGestion++;
  });

  return acumulados;
}

function agregarBloqueProduccionDiaResponsable(filas, datos) {
  // Mismo criterio del bloque general: por responsable se muestran solo efectivas de SurveyMonkey.
  const acumulado = calcularProduccionPorDiaResponsableSurveyMonkey(datos);
  const encabezado = ["Responsable", "Indicador"].concat(datos.fechasOrdenadas).concat(["Total"]);

  filas.push(["Producción por día por responsable"]);
  filas.push(encabezado);

  obtenerResponsablesMonitoreo(datos.filasBarrido).forEach(function(responsable) {
    const valores = datos.fechasOrdenadas.map(function(fecha) {
      return acumulado[[responsable, fecha].join("||")] || 0;
    });
    const total = valores.reduce(function(suma, valor) { return suma + valor; }, 0);
    if (total) filas.push([responsable, "Efectivas"].concat(valores).concat([total]));
  });
}

function calcularProduccionPorDiaResponsableSurveyMonkey(datos) {
  const acumulado = {};

  datos.filasBarrido.forEach(function(fila) {
    if (estadoPlataformaGestionTelefonica(datos, fila.codPulso) === "Completa") {
      const responsable = fila.responsable || "Sin responsable";
      const fecha = fila.fecha || "Sin fecha";
      const llave = [responsable, fecha].join("||");
      acumulado[llave] = (acumulado[llave] || 0) + 1;
    }
  });

  return acumulado;
}

function obtenerResponsablesMonitoreo(filasBarrido) {
  const responsables = {};
  filasBarrido.forEach(function(fila) {
    responsables[fila.responsable || "Sin responsable"] = true;
  });
  return Object.keys(responsables).sort(function(a, b) {
    return a.localeCompare(b, "es", { numeric: true });
  });
}

function agregarBloqueInsistenciaTelefonica(filas, datos) {
  const acumulados = calcularInsistenciaTelefonica(datos);
  filas.push(["Insistencia / rebarrido: No contesta"]);
  filas.push(["Responsable", "Casos No contesta", "Suma intentos", "Promedio intentos", "Sin intentos", "1 intento", "2 intentos", "3 intentos", "4 intentos", "5 intentos", "6 intentos", "7 intentos", "Más de 7 intentos"]);

  Object.keys(acumulados).sort(function(a, b) {
    return a.localeCompare(b, "es", { numeric: true });
  }).forEach(function(responsable) {
    const item = acumulados[responsable];
    filas.push([
      responsable,
      item.casos,
      item.sumaIntentos,
      item.casos ? item.sumaIntentos / item.casos : 0,
      item.sinIntentos,
      item.intento1,
      item.intento2,
      item.intento3,
      item.intento4,
      item.intento5,
      item.intento6,
      item.intento7,
      item.intentoMas7,
    ]);
  });
}

function calcularInsistenciaTelefonica(datos) {
  const acumulados = {};

  datos.filasBarrido.forEach(function(fila) {
    if (!esNoContestaTelefonico(fila.status)) return;
    const responsable = fila.responsable || "Sin responsable";
    const item = acumulados[responsable] || {
      casos: 0,
      sumaIntentos: 0,
      sinIntentos: 0,
      intento1: 0,
      intento2: 0,
      intento3: 0,
      intento4: 0,
      intento5: 0,
      intento6: 0,
      intento7: 0,
      intentoMas7: 0,
    };
    acumulados[responsable] = item;

    item.casos++;
    item.sumaIntentos += fila.intentos;
    if (!fila.intentos) item.sinIntentos++;
    else if (fila.intentos === 1) item.intento1++;
    else if (fila.intentos === 2) item.intento2++;
    else if (fila.intentos === 3) item.intento3++;
    else if (fila.intentos === 4) item.intento4++;
    else if (fila.intentos === 5) item.intento5++;
    else if (fila.intentos === 6) item.intento6++;
    else if (fila.intentos === 7) item.intento7++;
    else item.intentoMas7++;
  });

  return acumulados;
}

function agregarBloqueAuditoriaTelefonica(filas, datos) {
  const auditoria = construirAuditoriaTelefonica(datos);
  filas.push(["Auditoría de coherencia"]);
  filas.push(["Tipo alerta", "CodPulso", "Responsable", "Status campo", "Estado SurveyMonkey total", "Correo", "Enlace", "Detalle"]);

  if (!auditoria.length) {
    filas.push(["Sin alertas", "", "", "", "", "", "", "Barrido y SurveyMonkey telefonico no muestran diferencias criticas."]);
    return;
  }

  auditoria.forEach(function(alerta) { filas.push(alerta); });
}

function construirAuditoriaTelefonica(datos) {
  const alertas = [];
  const filasPorCod = {};

  datos.filasBarrido.forEach(function(fila) {
    const estadoTelefonico = estadoAvanceDesdeRespuesta(datos.indicePlataforma[fila.codPulso]);
    const estadoCierre = estadoAvanceDesdeRespuesta(datos.indiceCierreTelefonico[fila.codPulso]);
    const estadoGestion = estadoPlataformaGestionTelefonica(datos, fila.codPulso);
    const detalleEstados = detalleEstadosGestionTelefonica(estadoTelefonico, estadoCierre);

    if (!fila.codPulso) {
      alertas.push(alertaTelefonica("CodPulso vacío", fila, estadoGestion, "La fila de Barrido no tiene CodPulso."));
      return;
    }
    if (filasPorCod[fila.codPulso]) {
      alertas.push(alertaTelefonica("CodPulso duplicado en Barrido", fila, estadoGestion, "Ya existe otra fila con este CodPulso."));
    }
    filasPorCod[fila.codPulso] = fila;

    if (fila.idEnlace && normalizarCodigo(fila.idEnlace) !== normalizarCodigo(fila.codPulso)) {
      alertas.push(alertaTelefonica("Enlace con id distinto", fila, estadoGestion, "El enlace usa id=" + fila.idEnlace + " pero la fila tiene CodPulso=" + fila.codPulso + "."));
    }

    if (esEfectivoTelefonico(fila.status) && estadoGestion !== "Completa") {
      alertas.push(alertaTelefonica("Efectivo campo sin completa plataforma", fila, estadoGestion, "Barrido dice Efectivo, pero SurveyMonkey no muestra una completa efectiva. " + detalleEstados));
    }
    if (estadoGestion === "Completa" && !esEfectivoTelefonico(fila.status)) {
      alertas.push(alertaTelefonica("Completa plataforma sin efectivo campo", fila, estadoGestion, "SurveyMonkey tiene completa efectiva, pero Barrido no dice Efectivo. " + detalleEstados));
    }
    if (estadoGestion === "Rechazo" && !esRechazoTelefonico(fila.status)) {
      alertas.push(alertaTelefonica("Rechazo plataforma sin rechazo campo", fila, estadoGestion, "SurveyMonkey clasifica rechazo por consentimiento, pero Barrido no dice Rechazo. " + detalleEstados));
    }
  });

  agregarAuditoriaRespuestasFueraBarrido(alertas, filasPorCod, datos.respuestasTelefonicas, "Respuesta telefónica");
  agregarAuditoriaRespuestasFueraBarrido(alertas, filasPorCod, datos.respuestasCierreTelefonico, "Respuesta cierre operativo");

  return alertas;
}

function detalleEstadosGestionTelefonica(estadoTelefonico, estadoCierre) {
  return "Estado telefonico directo: " + estadoTelefonico + "; cierre operativo: " + estadoCierre + ".";
}

function agregarAuditoriaRespuestasFueraBarrido(alertas, filasPorCod, respuestas, etiquetaFuente) {
  (respuestas || []).forEach(function(respuesta) {
    const codPulso = String(respuesta.CodPulso || "").trim();
    const estado = estadoAvanceDesdeRespuesta(respuesta);
    const recopilador = respuesta["Nombre recopilador"] ? " Recopilador: " + respuesta["Nombre recopilador"] + "." : "";
    if (!codPulso) {
      alertas.push([etiquetaFuente + " sin CodPulso", "", "", "", estado, "", "", "response_id: " + (respuesta.response_id || "") + "." + recopilador]);
      return;
    }
    if (!filasPorCod[codPulso]) {
      alertas.push([etiquetaFuente + " fuera de base telefónica", codPulso, "", "", estado, respuesta.email_address || "", "", "No aparece en la base telefonica aplicable. response_id: " + (respuesta.response_id || "") + "." + recopilador]);
    }
  });
}

function alertaTelefonica(tipo, fila, estadoPlataforma, detalle) {
  return [
    tipo,
    fila.codPulso || "",
    fila.responsable || "",
    fila.status || "",
    estadoPlataforma || "",
    fila.correo || "",
    fila.enlace || "",
    detalle || "",
  ];
}

function construirAlertasInternas(monitoreosTelefonicos, respuestasPorActor) {
  const alertas = [];
  agregarAlertasCruceUniverso(alertas, respuestasPorActor);
  (monitoreosTelefonicos || []).forEach(function(datos) {
    agregarAlertasCoherenciaTelefonica(alertas, datos);
    agregarAlertasInsistenciaTelefonica(alertas, datos);
    agregarAlertasResponsablesNoBarridos(alertas, datos);
    agregarAlertasDiferenciasEfectivasDia(alertas, datos);
  });

  if (!alertas.length) {
    return [crearAlertaInterna({
      nivel: "OK",
      tipo: "Sin alertas",
      detalle: "No se detectaron alertas operativas en los monitoreos activos.",
      detalleTipo: "No hay casos que requieran revision segun las reglas activas.",
      fuente: NOMBRE_AVANCE_INTERNO,
    })];
  }

  return alertas.sort(ordenarAlertasInternas);
}

function agregarAlertasCruceUniverso(alertas, respuestasPorActor) {
  if (!respuestasPorActor) return;
  const libroUniverso = abrirLibro(URL_HOJA_UNIVERSO);

  obtenerActoresActivos().forEach(function(actor) {
    const base = obtenerBasePorActor(actor);
    if (!base) return;
    const universo = leerTablaDeLibro(libroUniverso, base.pestanaUniverso);
    const contextoCruce = construirContextoCruceUniverso(actor, universo);

    obtenerRespuestasActor(respuestasPorActor, actor).forEach(function(respuesta) {
      const alias = obtenerAliasParaRespuesta(actor, respuesta);
      if (alias) {
        const resolucion = resolverAliasRespuestaConUniverso(actor, respuesta, contextoCruce);
        agregarAlertaResolucionAlias(alertas, actor, respuesta, resolucion);
        return;
      }
      agregarAlertaLlaveCortaNoResuelta(alertas, actor, respuesta, contextoCruce);
    });
  });
}

function agregarAlertaResolucionAlias(alertas, actor, respuesta, resolucion) {
  const alias = resolucion && resolucion.alias;
  const llaveOriginal = describirLlaveOriginalSurveyMonkey(respuesta);
  const responseId = respuesta.response_id || "";

  if (resolucion && resolucion.estado === "ok") {
    alertas.push(crearAlertaInterna({
      nivel: "Baja",
      tipo: "Respuesta resuelta por alias",
      codPulso: respuesta.CodPulso || alias.llaveRespuesta,
      detalle: "response_id " + responseId + " usa " + llaveOriginal + " y se cruza con " + describirDestinoAlias(alias) + ".",
      detalleTipo: "Respuesta con llave corta resuelta por alias manual.",
    }));
    return;
  }

  alertas.push(crearAlertaInterna({
    nivel: "Alta",
    tipo: resolucion && resolucion.estado === "ambiguo" ? "Alias ambiguo en universo" : "Alias sin fila unica en universo",
    codPulso: respuesta.CodPulso || (alias ? alias.llaveRespuesta : ""),
    detalle: "response_id " + responseId + " usa " + llaveOriginal + ", pero el alias '" + (alias ? alias.llaveRespuesta : "") + "' no apunta a una unica fila del universo.",
    detalleTipo: "Alias manual que no puede contarse porque no resuelve exactamente un caso.",
  }));
}

function agregarAlertaLlaveCortaNoResuelta(alertas, actor, respuesta, contextoCruce) {
  const llaveOriginal = describirLlaveOriginalSurveyMonkey(respuesta);
  if (!llaveOriginal) return;
  if (!tieneLlaveIdentificadoraSurveyMonkey(respuesta)) return;
  if (respuestaCruzaDirectamenteConUniverso(actor, respuesta, contextoCruce)) return;

  const valores = obtenerValoresLlaveRespuestaParaAlias(respuesta);
  const candidatos = buscarCandidatosPorInicialesUniverso(valores, contextoCruce);
  if (candidatos.length === 1) {
    alertas.push(crearAlertaInterna({
      nivel: "Media",
      tipo: "Llave corta con posible cruce por iniciales",
      codPulso: respuesta.CodPulso || valores[0] || "",
      detalle: "response_id " + (respuesta.response_id || "") + " usa " + llaveOriginal + ". Hay una coincidencia posible por iniciales, pero no se cuenta sin alias manual.",
      detalleTipo: "Llave corta no configurada como alias; revisar si debe agregarse a ALIAS_LLAVES_RESPUESTA.",
    }));
    return;
  }

  alertas.push(crearAlertaInterna({
    nivel: "Alta",
    tipo: candidatos.length > 1 ? "Llave corta ambigua" : "Llave corta no resuelta",
    codPulso: respuesta.CodPulso || valores[0] || "",
    detalle: "response_id " + (respuesta.response_id || "") + " usa " + llaveOriginal + " y no cruza directo contra el universo.",
    detalleTipo: candidatos.length > 1 ? "La llave corta coincide con mas de un patron posible; no se cuenta." : "Respuesta con llave corta sin alias manual y sin cruce directo.",
  }));
}

function buscarCandidatosPorInicialesUniverso(valores, contextoCruce) {
  const valoresSet = crearSet((valores || []).map(normalizarCodigo));
  return contextoCruce.filas.filter(function(fila) {
    const iniciales = inicialesObjetoUniverso(fila.objeto);
    return iniciales && valoresSet[iniciales];
  });
}

function inicialesObjetoUniverso(objeto) {
  const nombre = construirNombreNormalizado(objeto);
  if (!nombre) return "";
  return normalizarCodigo(nombre.split(" ").map(function(parte) { return parte.charAt(0); }).join(""));
}

function agregarAlertasCoherenciaTelefonica(alertas, datos) {
  const filasPorCod = {};
  const monitoreo = datos.monitoreo;

  datos.filasBarrido.forEach(function(fila) {
    const estadoTelefonico = estadoAvanceDesdeRespuesta(datos.indicePlataforma[fila.codPulso]);
    const estadoCierre = estadoAvanceDesdeRespuesta(datos.indiceCierreTelefonico[fila.codPulso]);
    const estadoGestion = estadoPlataformaGestionTelefonica(datos, fila.codPulso);
    const detalleEstados = detalleEstadosGestionTelefonica(estadoTelefonico, estadoCierre);

    if (!fila.codPulso) {
      alertas.push(crearAlertaInterna({
        nivel: "Alta",
        tipo: "CodPulso vacío en barrido",
        actor: monitoreo.actor,
        canal: monitoreo.canal,
        responsable: fila.responsable,
        detalle: "Una fila de Barrido no tiene CodPulso.",
        detalleTipo: "Fila de barrido sin identificador para cruzar con SurveyMonkey.",
        fuente: nombrePestanaMonitoreoTelefonico(monitoreo),
      }));
    } else if (filasPorCod[fila.codPulso]) {
      alertas.push(crearAlertaInterna({
        nivel: "Alta",
        tipo: "CodPulso duplicado en barrido",
        actor: monitoreo.actor,
        canal: monitoreo.canal,
        responsable: fila.responsable,
        codPulso: fila.codPulso,
        detalle: "Existe mas de una fila de Barrido con el mismo CodPulso.",
        detalleTipo: "El mismo identificador aparece en mas de una fila de barrido.",
        fuente: nombrePestanaMonitoreoTelefonico(monitoreo),
      }));
    }
    if (fila.codPulso) filasPorCod[fila.codPulso] = fila;

    if (fila.idEnlace && normalizarCodigo(fila.idEnlace) !== normalizarCodigo(fila.codPulso)) {
      alertas.push(crearAlertaInterna({
        nivel: "Alta",
        tipo: "Enlace con id distinto",
        actor: monitoreo.actor,
        canal: monitoreo.canal,
        responsable: fila.responsable,
        codPulso: fila.codPulso,
        detalle: "El enlace usa id=" + fila.idEnlace + " pero la fila tiene CodPulso=" + fila.codPulso + ".",
        detalleTipo: "El enlace telefonico apunta a un id diferente al CodPulso de la fila.",
        fuente: nombrePestanaMonitoreoTelefonico(monitoreo),
      }));
    }

    if (esEfectivoTelefonico(fila.status) && estadoGestion !== "Completa") {
      alertas.push(crearAlertaInterna({
        nivel: "Alta",
        tipo: "Efectiva reportada sin SurveyMonkey",
        actor: monitoreo.actor,
        canal: monitoreo.canal,
        responsable: fila.responsable,
        codPulso: fila.codPulso,
        detalle: "Barrido reporta Efectivo, pero SurveyMonkey muestra '" + estadoGestion + "'. " + detalleEstados,
        detalleTipo: "Campo marca Efectivo, pero SurveyMonkey no confirma una respuesta efectiva en telefono directo ni en cierre operativo.",
        fuente: "Barrido vs SurveyMonkey",
      }));
    }

    if (estadoGestion === "Completa" && !esEfectivoTelefonico(fila.status)) {
      alertas.push(crearAlertaInterna({
        nivel: "Alta",
        tipo: "SurveyMonkey efectiva sin campo",
        actor: monitoreo.actor,
        canal: monitoreo.canal,
        responsable: fila.responsable,
        codPulso: fila.codPulso,
        detalle: "SurveyMonkey tiene una efectiva, pero Barrido esta como '" + fila.status + "'. " + detalleEstados,
        detalleTipo: "SurveyMonkey confirma efectiva, pero barrido no esta marcado como Efectivo.",
        fuente: "SurveyMonkey vs Barrido",
      }));
    }
  });

  agregarAlertasRespuestasFueraBarrido(alertas, datos.respuestasTelefonicas, filasPorCod, monitoreo, "Respuesta telefonica");
  agregarAlertasRespuestasFueraBarrido(alertas, datos.respuestasCierreTelefonico, filasPorCod, monitoreo, "Respuesta cierre operativo");
}

function agregarAlertasRespuestasFueraBarrido(alertas, respuestas, filasPorCod, monitoreo, etiquetaFuente) {
  (respuestas || []).forEach(function(respuesta) {
    const codPulso = String(respuesta.CodPulso || "").trim();
    if (!codPulso) {
      alertas.push(crearAlertaInterna({
        nivel: "Alta",
        tipo: "Respuesta SurveyMonkey sin CodPulso",
        actor: monitoreo.actor,
        canal: monitoreo.canal,
        detalle: etiquetaFuente + " sin CodPulso. response_id: " + (respuesta.response_id || ""),
        detalleTipo: etiquetaFuente + " sin identificador del caso.",
        fuente: "SurveyMonkey",
      }));
      return;
    }
    if (!filasPorCod[codPulso]) {
      alertas.push(crearAlertaInterna({
        nivel: "Alta",
        tipo: "CodPulso SurveyMonkey inexistente en barrido",
        actor: monitoreo.actor,
        canal: monitoreo.canal,
        codPulso: codPulso,
        detalle: "Hay " + etiquetaFuente.toLowerCase() + " en SurveyMonkey, pero el CodPulso no existe en la base de barrido aplicable.",
        detalleTipo: etiquetaFuente + " con CodPulso que no existe en la base de barrido.",
        fuente: "SurveyMonkey",
      }));
    }
  });
}

function agregarAlertasInsistenciaTelefonica(alertas, datos) {
  const umbrales = obtenerUmbralesAlerta();
  datos.filasBarrido.forEach(function(fila) {
    if (!esNoContestaTelefonico(fila.status) || fila.intentos >= umbrales.noContestaIntentosMinimos) return;
    alertas.push(crearAlertaInterna({
      nivel: "Baja",
      tipo: "No contesta con pocos intentos",
      actor: datos.monitoreo.actor,
      canal: datos.monitoreo.canal,
      responsable: fila.responsable,
      codPulso: fila.codPulso,
      detalle: "Caso No contesta con " + fila.intentos + " intentos registrados.",
      detalleTipo: "Caso No contesta que todavia requiere insistencia.",
      fuente: nombrePestanaMonitoreoTelefonico(datos.monitoreo),
    }));
  });
}

function agregarAlertasResponsablesNoBarridos(alertas, datos) {
  const produccion = calcularProduccionPorResponsable(datos);
  const umbrales = obtenerUmbralesAlerta();

  Object.keys(produccion).forEach(function(responsable) {
    const item = produccion[responsable];
    const porcentaje = item.totalTelefonico ? item.noBarridos / item.totalTelefonico : 0;

    if (esResponsableSinAsignar(responsable)) {
      if (item.totalTelefonico < umbrales.casosSinResponsableMinimo) return;

      alertas.push(crearAlertaInterna({
        nivel: "Media",
        tipo: "Casos sin responsable asignado",
        actor: datos.monitoreo.actor,
        canal: datos.monitoreo.canal,
        detalle: item.totalTelefonico + " casos telefonicos no tienen responsable asignado.",
        detalleTipo: "Casos pendientes de asignacion a un responsable de campo.",
        fuente: "Monitoreo telefónico",
      }));
      return;
    }

    if (item.noBarridos < umbrales.responsableNoBarridosMinimoCasos && porcentaje < umbrales.responsableNoBarridosPorcentaje) return;

    alertas.push(crearAlertaInterna({
      nivel: "Baja",
      tipo: "Responsable con muchos no barridos",
      actor: datos.monitoreo.actor,
      canal: datos.monitoreo.canal,
      responsable: responsable,
      detalle: item.noBarridos + " de " + item.totalTelefonico + " casos siguen No barrido (" + Math.round(porcentaje * 100) + "%).",
      detalleTipo: "Responsable con volumen o porcentaje alto de casos sin barrer.",
      fuente: "Monitoreo telefónico",
    }));
  });
}

function agregarAlertasDiferenciasEfectivasDia(alertas, datos) {
  const acumulado = calcularComparacionEfectivasDia(datos);
  const umbrales = obtenerUmbralesAlerta();

  datos.fechasOrdenadas.forEach(function(fecha) {
    const reportadas = acumulado[["Efectivas reportadas en barrido", fecha].join("||")] || 0;
    const gestion = acumulado[["Efectivas validadas total", fecha].join("||")] || 0;
    const diferencia = reportadas - gestion;
    if (Math.abs(diferencia) < umbrales.diferenciaEfectivasDiaMinima) return;

    alertas.push(crearAlertaInterna({
      nivel: "Alta",
      tipo: "Diferencia diaria de efectivas",
      actor: datos.monitoreo.actor,
      canal: datos.monitoreo.canal,
      detalle: fecha + ": barrido reporta " + reportadas + " efectivas y SurveyMonkey valida " + gestion + ". Por revisar: " + diferencia + ".",
      detalleTipo: "Las efectivas del dia no coinciden entre campo y SurveyMonkey, considerando telefono directo y cierre operativo.",
      fuente: "Efectivas por día: barrido vs SurveyMonkey",
    }));
  });
}

function crearAlertaInterna(datos) {
  return [
    datos.nivel || "Media",
    datos.tipo || "",
    datos.detalleTipo || "",
    datos.responsable || "",
    datos.codPulso || "",
    datos.detalle || "",
  ];
}

function ordenarAlertasInternas(a, b) {
  const orden = { Alta: 1, Media: 2, Baja: 3, OK: 9 };
  const nivelA = orden[a[0]] || 5;
  const nivelB = orden[b[0]] || 5;
  if (nivelA !== nivelB) return nivelA - nivelB;
  return String(a[1]).localeCompare(String(b[1]), "es", { numeric: true });
}

function obtenerUmbralesAlerta() {
  return {
    noContestaIntentosMinimos: Number(UMBRALES_ALERTA_ESTUDIO.noContestaIntentosMinimos || 0),
    responsableNoContestaPocosIntentosMinimoCasos: Number(UMBRALES_ALERTA_ESTUDIO.responsableNoContestaPocosIntentosMinimoCasos || 0),
    responsableNoBarridosMinimoCasos: Number(UMBRALES_ALERTA_ESTUDIO.responsableNoBarridosMinimoCasos || 0),
    responsableNoBarridosPorcentaje: Number(UMBRALES_ALERTA_ESTUDIO.responsableNoBarridosPorcentaje || 0),
    casosSinResponsableMinimo: Number(UMBRALES_ALERTA_ESTUDIO.casosSinResponsableMinimo || 0),
    diferenciaEfectivasDiaMinima: Number(UMBRALES_ALERTA_ESTUDIO.diferenciaEfectivasDiaMinima || 0),
  };
}

function esResponsableSinAsignar(responsable) {
  const texto = normalizarTexto(responsable);
  return !texto || texto === "sin responsable" || texto === "sin asignar";
}

function contarNoContestaConPocosIntentos(item, minimoIntentos) {
  if (!item) return 0;
  let total = 0;
  if (minimoIntentos > 0) total += item.sinIntentos || 0;
  if (minimoIntentos > 1) total += item.intento1 || 0;
  if (minimoIntentos > 2) total += item.intento2 || 0;
  if (minimoIntentos > 3) total += item.intento3 || 0;
  if (minimoIntentos > 4) total += item.intento4 || 0;
  if (minimoIntentos > 5) total += item.intento5 || 0;
  if (minimoIntentos > 6) total += item.intento6 || 0;
  if (minimoIntentos > 7) total += item.intento7 || 0;
  if (minimoIntentos > 8) total += item.intentoMas7 || 0;
  return total;
}

function normalizarValorVariable(actor, variable, valor) {
  const texto = String(valor || "").trim();
  if (!texto) return "Sin dato";
  if (variable.tipo === "anio") return normalizarAnioEgreso(texto);
  return texto;
}

function normalizarAnioEgreso(valor) {
  const serial = obtenerSerialFecha(valor);
  if (serial) return formatearSerialFechaGoogle(serial, "yyyy");

  const match = String(valor || "").match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "Sin dato";
}

function normalizarFechaDia(valor) {
  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor.getTime())) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone() || "America/Lima", "yyyy-MM-dd");
  }

  const serial = obtenerSerialFecha(valor);
  if (serial) return formatearSerialFechaGoogle(serial, "yyyy-MM-dd");

  const texto = String(valor || "").trim();
  if (!texto) return "Sin fecha";
  const match = texto.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : texto.slice(0, 10);
}

function normalizarFechaCampo(valor) {
  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor.getTime())) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone() || "America/Lima", "yyyy-MM-dd");
  }

  const serial = obtenerSerialFecha(valor);
  if (serial) return formatearSerialFechaGoogle(serial, "yyyy-MM-dd");

  const texto = String(valor || "").trim();
  if (!texto) return "Sin fecha";

  const iso = texto.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (iso) return iso[0];

  const fechaCorta = texto.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (fechaCorta) {
    return [
      fechaCorta[3],
      String(fechaCorta[2]).padStart(2, "0"),
      String(fechaCorta[1]).padStart(2, "0"),
    ].join("-");
  }

  return texto.slice(0, 10);
}

function obtenerSerialFecha(valor) {
  if (typeof valor === "number" && isFinite(valor) && valor >= 20000 && valor <= 80000) return valor;

  const texto = String(valor || "").trim().replace(",", ".");
  if (!/^\d{5}(\.\d+)?$/.test(texto)) return 0;

  const numero = parseFloat(texto);
  return isFinite(numero) && numero >= 20000 && numero <= 80000 ? numero : 0;
}

function formatearSerialFechaGoogle(serial, formato) {
  const fecha = new Date(Math.round((serial - 25569) * 86400000));
  return Utilities.formatDate(fecha, "GMT", formato);
}

function ordenarValoresDetalle(a, b) {
  if (a === "Sin dato") return 1;
  if (b === "Sin dato") return -1;
  return String(a).localeCompare(String(b), "es", { numeric: true });
}

function ordenarStatusTelefonico(a, b) {
  const orden = ORDEN_STATUS_TELEFONICO.map(normalizarTexto);
  const posA = orden.indexOf(normalizarTexto(a));
  const posB = orden.indexOf(normalizarTexto(b));
  const realA = posA < 0 ? 999 : posA;
  const realB = posB < 0 ? 999 : posB;
  if (realA !== realB) return realA - realB;
  return String(a).localeCompare(String(b), "es", { numeric: true });
}

function etiquetaStatusTelefonico(valor) {
  const texto = String(valor || "").trim();
  return texto || "Sin status";
}

function esEfectivoTelefonico(status) {
  return normalizarTexto(status) === "efectivo";
}

function esRechazoTelefonico(status) {
  return normalizarTexto(status) === "rechazo";
}

function esNoBarridoTelefonico(status) {
  return normalizarTexto(status) === "no barrido";
}

function esNoContestaTelefonico(status) {
  return normalizarTexto(status) === "no contesta";
}

function esSinStatusTelefonico(status) {
  return normalizarTexto(status) === "sin status";
}

function numeroIntentos(valor) {
  const match = String(valor || "").replace(",", ".").match(/\d+(\.\d+)?/);
  const numero = match ? parseFloat(match[0]) : 0;
  return isNaN(numero) ? 0 : numero;
}

function extraerIdEnlaceTelefonico(enlace) {
  const match = String(enlace || "").match(/[?&]id=([^&#]+)/i);
  return match ? decodeURIComponent(match[1]) : "";
}

function leerCampoObjeto(objeto, nombreCampo) {
  const nombreReal = encontrarNombreCampoObjeto(objeto, nombreCampo);
  return nombreReal ? objeto[nombreReal] : "";
}

function encontrarNombreCampoObjeto(objeto, nombresCampo) {
  const nombres = Array.isArray(nombresCampo) ? nombresCampo : [nombresCampo];
  const llaves = Object.keys(objeto);

  for (let n = 0; n < nombres.length; n++) {
    const nombreCampo = nombres[n];
    if (!nombreCampo) continue;
    if (objeto[nombreCampo] !== undefined) return nombreCampo;

    const buscado = normalizarTexto(nombreCampo);
    for (let i = 0; i < llaves.length; i++) {
      if (normalizarTexto(llaves[i]) === buscado) return llaves[i];
    }
  }
  return "";
}

function existeCampoEnEncabezados(encabezados, nombresCampo) {
  const objetoEncabezados = {};
  encabezados.forEach(function(encabezado) { objetoEncabezados[encabezado] = true; });
  return !!encontrarNombreCampoObjeto(objetoEncabezados, nombresCampo);
}

function describirNombresCampo(nombresCampo) {
  if (Array.isArray(nombresCampo)) return nombresCampo.join(" / ");
  return String(nombresCampo || "");
}

function encontrarIndiceEncabezado(encabezados, campo) {
  const buscado = normalizarTexto(campo);
  for (let i = 0; i < encabezados.length; i++) {
    if (normalizarTexto(encabezados[i]) === buscado) return i;
  }
  return -1;
}

function escribirResumenInterno(libro, respuestasPorActor, avancesPorDia, detalleVariables, distribucionEgresados) {
  const avancesPorActor = construirAvancesPorActor(respuestasPorActor);
  const filasResumen = construirResumenUnidadesDesdeRespuestas(respuestasPorActor, avancesPorActor).map(function(item) {
    return [
      item.etiqueta,
      item.total,
      item.completas,
      item.parciales,
      item.rechazos,
      item.sinRespuesta,
      item.total ? item.completas / item.total : 0,
    ];
  });

  const hoja = libro.getSheetByName(PESTANA_RESUMEN_INTERNO) || libro.insertSheet(PESTANA_RESUMEN_INTERNO, 0);
  const avanceEfectivo = (avancesPorDia && avancesPorDia.efectivo) || { encabezados: COLUMNAS_BASE_AVANCE_DIA.concat(["Total"]), filas: [] };
  const avanceGeneral = (avancesPorDia && avancesPorDia.general) || { encabezados: COLUMNAS_BASE_AVANCE_DIA.concat(["Total"]), filas: [] };
  const filasDetalle = detalleVariables || [];
  const ancho = Math.max(
    8,
    ENCABEZADO_RESUMEN_INTERNO.length,
    avanceEfectivo.encabezados.length,
    avanceGeneral.encabezados.length,
    ENCABEZADO_DETALLE_VARIABLES.length,
    ENCABEZADO_DISTRIBUCION_EGRESADOS.length
  );
  const filas = [];

  filas.push([NOMBRE_AVANCE_INTERNO]);
  filas.push(["Ultima actualizacion", Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Lima", "dd/MM/yyyy HH:mm")]);
  filas.push([]);
  agregarBloqueResumenInterno(filas, "Resumen por unidad", ENCABEZADO_RESUMEN_INTERNO, filasResumen);
  agregarBloqueResumenInterno(filas, "Avance efectivo por día", avanceEfectivo.encabezados, avanceEfectivo.filas);
  agregarBloqueResumenInterno(filas, "Avance general por día", avanceGeneral.encabezados, avanceGeneral.filas);
  agregarBloqueResumenInterno(filas, "Distribución de egresados por año", ENCABEZADO_DISTRIBUCION_EGRESADOS, distribucionEgresados || []);
  agregarBloqueDetalleVariablesResumen(filas, filasDetalle);

  limpiarHoja(hoja);
  asegurarTamanoHoja(hoja, filas.length, ancho);
  hoja.getRange(1, 1, filas.length, ancho).setValues(normalizarAncho(filas, ancho));
  formatearResumenInterno(hoja);
}

function agregarBloqueResumenInterno(filas, titulo, encabezados, datos) {
  filas.push([titulo]);
  filas.push(encabezados);
  (datos || []).forEach(function(fila) { filas.push(fila); });
  filas.push([]);
}

function agregarBloqueDetalleVariablesResumen(filas, filasDetalle) {
  const encabezados = ENCABEZADO_DETALLE_VARIABLES.slice(1);
  filas.push(["Detalle por variables de control"]);

  obtenerActoresActivos().forEach(function(actor) {
    const filasActor = (filasDetalle || []).filter(function(fila) {
      return fila[0] === actor;
    });
    if (!filasActor.length) return;

    filas.push([actor]);
    filas.push(encabezados);
    filasActor.forEach(function(fila) {
      filas.push(fila.slice(1));
    });
    filas.push([]);
  });
}

function escribirReporteCliente(libroCliente, resumenCliente, avancesPorDia) {
  const hoja = libroCliente.getSheetByName(PESTANA_REPORTE_CLIENTE) || libroCliente.insertSheet(PESTANA_REPORTE_CLIENTE, 0);
  const avanceEfectivo = (avancesPorDia && avancesPorDia.efectivo) || { encabezados: COLUMNAS_BASE_AVANCE_DIA.concat(["Total"]), filas: [] };
  const avanceGeneral = (avancesPorDia && avancesPorDia.general) || { encabezados: COLUMNAS_BASE_AVANCE_DIA.concat(["Total"]), filas: [] };
  const ancho = Math.max(8, ANCHO_BLOQUE_REPORTE_CLIENTE, avanceEfectivo.encabezados.length, avanceGeneral.encabezados.length);
  const filas = [];
  filas.push([NOMBRE_ESTUDIO]);
  filas.push(["Seguimiento de Encuestas"]);
  filas.push(["Ultima actualizacion", Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Lima", "dd/MM/yyyy HH:mm")]);
  filas.push([]);

  resumenCliente.forEach(function(item) {
    agregarBloqueEjecutivoReporteCliente(filas, item);
  });

  filas.push([]);
  filas.push(["Detalle diario"]);
  agregarBloqueResumenInterno(filas, "Avance efectivo por día", avanceEfectivo.encabezados, avanceEfectivo.filas);
  agregarBloqueResumenInterno(filas, "Avance general por día", avanceGeneral.encabezados, avanceGeneral.filas);

  limpiarHoja(hoja);
  asegurarTamanoHoja(hoja, filas.length, ancho);
  hoja.getRange(1, 1, filas.length, ancho).setValues(normalizarAncho(filas, ancho));
}

const ANCHO_BLOQUE_REPORTE_CLIENTE = 6;

function agregarBloqueEjecutivoReporteCliente(filas, item) {
  filas.push([item.unidad || item.actor]);
  filas.push(["Total", "Respuestas en el sistema", "", "", "Sin respuesta", "Avance"]);
  filas.push(["", "Completas", "Parciales", "Rechazos", "", ""]);
  filas.push([
    item.total,
    item.completas,
    item.parciales,
    item.rechazos,
    item.sinRespuesta,
    item.avance,
  ]);
  filas.push([]);
}

function escribirDetalleAvanceCliente(libroCliente, filasDetalle, distribucionEgresados) {
  const hoja = libroCliente.getSheetByName(PESTANA_DETALLE_AVANCE_CLIENTE) || libroCliente.insertSheet(PESTANA_DETALLE_AVANCE_CLIENTE);
  const filas = [];
  const ancho = Math.max(ENCABEZADO_DETALLE_VARIABLES.length, ENCABEZADO_DISTRIBUCION_EGRESADOS.length);

  filas.push(["Distribución de egresados por año"]);
  filas.push(ENCABEZADO_DISTRIBUCION_EGRESADOS);
  (distribucionEgresados || []).forEach(function(fila) { filas.push(fila); });
  filas.push([]);
  filas.push(["Detalle completo por variables de control"]);

  obtenerActoresActivos().forEach(function(actor) {
    const filasActor = filasDetalle.filter(function(fila) { return fila[0] === actor; });
    if (!filasActor.length) return;

    filas.push([actor]);
    filas.push(ENCABEZADO_DETALLE_VARIABLES);
    filasActor.forEach(function(fila) { filas.push(fila); });
    filas.push([]);
  });

  limpiarHoja(hoja);
  asegurarTamanoHoja(hoja, Math.max(filas.length, 1), ancho);
  if (filas.length) hoja.getRange(1, 1, filas.length, ancho).setValues(normalizarAncho(filas, ancho));
}

function escribirMonitoreoTelefonico(libroInterno, nombrePestana, datos) {
  const hoja = libroInterno.getSheetByName(nombrePestana) || libroInterno.insertSheet(nombrePestana);
  const filas = construirFilasMonitoreoTelefonico(datos);
  const ancho = filas[0] ? filas[0].length : 8;

  limpiarHoja(hoja);
  asegurarTamanoHoja(hoja, Math.max(filas.length, 1), ancho);
  if (filas.length) hoja.getRange(1, 1, filas.length, ancho).setValues(filas);
  formatearMonitoreoTelefonico(hoja);
}

function escribirAlertasInternas(libroInterno, filasAlertas) {
  escribirTabla(libroInterno, PESTANA_ALERTAS_INTERNO, ENCABEZADO_ALERTAS, filasAlertas);
}

function escribirTabla(libro, nombrePestana, encabezados, filas) {
  const hoja = libro.getSheetByName(nombrePestana) || libro.insertSheet(nombrePestana);
  const salida = [encabezados].concat(normalizarFilas(encabezados, filas));
  limpiarHoja(hoja);
  asegurarTamanoHoja(hoja, salida.length, encabezados.length);
  hoja.getRange(1, 1, salida.length, encabezados.length).setValues(salida);
  formatearPestanaBasica(hoja);
}

function limpiarHoja(hoja) {
  hoja.getRange(1, 1, hoja.getMaxRows(), hoja.getMaxColumns()).breakApart();
  if (hoja.getFilter()) hoja.getFilter().remove();
  hoja.clear();
}

function asegurarTamanoHoja(hoja, filas, columnas) {
  if (hoja.getMaxRows() < filas) hoja.insertRowsAfter(hoja.getMaxRows(), filas - hoja.getMaxRows());
  if (hoja.getMaxColumns() < columnas) hoja.insertColumnsAfter(hoja.getMaxColumns(), columnas - hoja.getMaxColumns());
}

function leerTablaDeLibro(libro, nombrePestana) {
  const hoja = libro.getSheetByName(nombrePestana);
  if (!hoja || hoja.getLastRow() < 1) return { encabezados: [], filas: [] };
  const valores = hoja.getRange(1, 1, hoja.getLastRow(), hoja.getLastColumn()).getValues();
  const encabezados = normalizarEncabezados(valores.shift());
  const filas = valores.filter(function(fila) {
    return fila.some(function(celda) { return String(celda || "").trim() !== ""; });
  });
  return { encabezados: encabezados, filas: filas };
}

function leerObjetosDeLibro(libro, nombrePestana) {
  const tabla = leerTablaDeLibro(libro, nombrePestana);
  return tabla.filas.map(function(fila) { return filaAObjeto(tabla.encabezados, fila); });
}

function leerRespuestasInternasPorActor(libroInterno) {
  const salida = {};
  obtenerActoresActivos().forEach(function(actor) {
    salida[actor] = leerObjetosDeLibro(libroInterno, PREFIJO_RESPUESTAS + actor);
  });
  return salida;
}

function filaAObjeto(encabezados, fila) {
  const obj = {};
  encabezados.forEach(function(encabezado, i) { obj[encabezado] = fila[i]; });
  return obj;
}

function objetosAFilas(encabezados, objetos) {
  return objetos.map(function(obj) {
    return encabezados.map(function(h) { return obj[h] === undefined ? "" : obj[h]; });
  });
}

function normalizarFilas(encabezados, filas) {
  return filas.map(function(fila) {
    if (Array.isArray(fila)) {
      const salida = fila.slice();
      while (salida.length < encabezados.length) salida.push("");
      return salida.slice(0, encabezados.length);
    }
    return encabezados.map(function(encabezado) { return fila[encabezado] === undefined ? "" : fila[encabezado]; });
  });
}

function normalizarAncho(filas, ancho) {
  return filas.map(function(fila) {
    const salida = fila.slice();
    while (salida.length < ancho) salida.push("");
    return salida.slice(0, ancho);
  });
}

function normalizarEncabezados(encabezados) {
  const usados = {};
  return encabezados.map(function(valor, i) {
    const base = String(valor || "").trim() || ("Columna " + (i + 1));
    let h = base;
    if (usados[h]) {
      usados[h]++;
      h = h + " " + usados[h];
    } else {
      usados[h] = 1;
    }
    return h;
  });
}

function crearMapaRespuestasVacio() {
  const mapa = {};
  obtenerActoresActivos().forEach(function(actor) {
    mapa[actor] = { encabezados: CAMPOS_METADATA.slice(), objetos: [], completas: 0, parciales: 0, rechazos: 0 };
    Object.defineProperty(mapa[actor], "filas", {
      get: function() {
        return mapa[actor].objetos.map(function(obj) {
          return mapa[actor].encabezados.map(function(h) { return obj[h] === undefined ? "" : obj[h]; });
        });
      },
    });
  });
  return mapa;
}

function eliminarPestanasInternasSobrantes(libro) {
  const necesarias = {};
  necesarias[PESTANA_ESTADO_EJECUCION] = true;
  necesarias[PESTANA_RESUMEN_INTERNO] = true;
  necesarias[PESTANA_ALERTAS_INTERNO] = true;
  necesarias[PESTANA_DETALLE_AVANCE_CLIENTE] = true;
  necesarias[PESTANA_AVANCE_ENCUESTA] = true;
  obtenerMonitoreosTelefonicosActivos().forEach(function(monitoreo) {
    necesarias[nombrePestanaMonitoreoTelefonico(monitoreo)] = true;
  });
  obtenerActoresActivos().forEach(function(actor) { necesarias[actor + SUFIJO_AVANCE_CLIENTE] = true; });
  obtenerActoresActivos().forEach(function(actor) { necesarias[PREFIJO_RESPUESTAS + actor] = true; });
  eliminarPestanasNoNecesarias(libro, necesarias);
}

function eliminarPestanasClienteSobrantes(libro) {
  const necesarias = {};
  necesarias[PESTANA_REPORTE_CLIENTE] = true;
  necesarias[PESTANA_DETALLE_AVANCE_CLIENTE] = true;
  necesarias[PESTANA_AVANCE_ENCUESTA] = true;
  obtenerActoresActivos().forEach(function(actor) { necesarias[actor + SUFIJO_AVANCE_CLIENTE] = true; });
  eliminarPestanasNoNecesarias(libro, necesarias);
}

function eliminarPestanasNoNecesarias(libro, necesarias) {
  libro.getSheets().forEach(function(hoja) {
    if (!necesarias[hoja.getName()] && libro.getSheets().length > 1) libro.deleteSheet(hoja);
  });
}

function ordenarPestanasInternas(libro) {
  const actores = obtenerActoresActivos();
  const orden = [PESTANA_RESUMEN_INTERNO, PESTANA_ALERTAS_INTERNO]
    .concat(obtenerMonitoreosTelefonicosActivos().map(nombrePestanaMonitoreoTelefonico))
    .concat([PESTANA_DETALLE_AVANCE_CLIENTE])
    .concat(actores.map(function(actor) { return actor + SUFIJO_AVANCE_CLIENTE; }))
    .concat([PESTANA_AVANCE_ENCUESTA])
    .concat(actores.map(function(actor) { return PREFIJO_RESPUESTAS + actor; }))
    .concat([PESTANA_ESTADO_EJECUCION]);
  ordenarPestanas(libro, orden);
}

function ordenarPestanasCliente(libro) {
  const orden = [PESTANA_REPORTE_CLIENTE, PESTANA_DETALLE_AVANCE_CLIENTE, PESTANA_AVANCE_ENCUESTA]
    .concat(obtenerActoresActivos().map(function(actor) { return actor + SUFIJO_AVANCE_CLIENTE; }));
  ordenarPestanas(libro, orden);
}

function ordenarPestanas(libro, orden) {
  orden.forEach(function(nombre, i) {
    const hoja = libro.getSheetByName(nombre);
    if (!hoja) return;
    libro.setActiveSheet(hoja);
    libro.moveActiveSheet(i + 1);
  });
}

function formatearLibroBasico(libro) {
  libro.getSheets().forEach(function(hoja) {
    if (hoja.getName() !== PESTANA_ESTADO_EJECUCION) formatearPestanaBasica(hoja);
  });
}

function formatearPestanaBasica(hoja) {
  const filas = hoja.getLastRow();
  const columnas = hoja.getLastColumn();
  if (!filas || !columnas) return;
  if (esPestanaMonitoreoTelefonico(hoja.getName())) {
    formatearMonitoreoTelefonico(hoja);
    return;
  }
  if (hoja.getName() === PESTANA_RESUMEN_INTERNO) {
    formatearResumenInterno(hoja);
    return;
  }
  if (hoja.getName() === PESTANA_ALERTAS_INTERNO) {
    formatearAlertasInternas(hoja);
    return;
  }
  if (hoja.getName() === PESTANA_AVANCE_ENCUESTA) {
    formatearAvanceEncuesta(hoja);
    return;
  }
  hoja.setFrozenRows(1);
  hoja.getRange(1, 1, 1, columnas)
    .setFontWeight("bold")
    .setBackground("#f1f3f4")
    .setHorizontalAlignment("center")
    .setWrap(true);
  if (hoja.getFilter()) hoja.getFilter().remove();
  if (filas > 1) hoja.getRange(1, 1, filas, columnas).createFilter();
  formatearColumnasPorEncabezado(hoja);
  if (hoja.getName().slice(-SUFIJO_AVANCE_CLIENTE.length) === SUFIJO_AVANCE_CLIENTE) formatearColumnaEstadoAvance(hoja);
  ajustarAnchosInteligentes(hoja);
}

function formatearResumenInterno(hoja) {
  const filas = hoja.getLastRow();
  const columnas = hoja.getLastColumn();
  if (!filas || !columnas) return;

  if (hoja.getFilter()) hoja.getFilter().remove();
  hoja.getRange(1, 1, filas, columnas).breakApart();
  hoja.setFrozenRows(2);
  hoja.setFrozenColumns(0);
  hoja.getRange(1, 1, filas, columnas)
    .setFontFamily("Arial")
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setHorizontalAlignment("center")
    .setWrap(true)
    .setBorder(true, true, true, true, true, true, "#d9d9d9", SpreadsheetApp.BorderStyle.SOLID);
  hoja.getRange(1, 1, filas, 1).setHorizontalAlignment("left");

  hoja.getRange(1, 1, 1, columnas)
    .merge()
    .setFontSize(16)
    .setFontWeight("bold")
    .setFontColor("#ffffff")
    .setBackground("#0b3f66")
    .setHorizontalAlignment("center");
  hoja.getRange("A2:B2")
    .setFontWeight("bold")
    .setBackground("#e8f0fe")
    .setHorizontalAlignment("left");

  for (let r = 1; r <= filas; r++) {
    const valorA = String(hoja.getRange(r, 1).getValue() || "");
    const valorB = String(hoja.getRange(r, 2).getValue() || "");

    if (esTituloBloqueResumenInterno(valorA, valorB)) {
      hoja.getRange(r, 1, 1, columnas)
        .merge()
        .setFontWeight("bold")
        .setFontSize(12)
        .setFontColor("#ffffff")
        .setBackground("#0b3f66")
        .setHorizontalAlignment("left");
    }

    if (esSubtituloActorResumenInterno(valorA, valorB)) {
      hoja.getRange(r, 1, 1, columnas)
        .merge()
        .setFontWeight("bold")
        .setFontColor("#0b3f66")
        .setBackground("#d9eaf7")
        .setHorizontalAlignment("left");
    }

    if (esEncabezadoBloqueResumenInterno(valorA, valorB)) {
      hoja.getRange(r, 1, 1, columnas)
        .setFontWeight("bold")
        .setFontColor("#ffffff")
        .setBackground("#1f5f8b")
        .setHorizontalAlignment("center");
    }
  }

  formatearNumerosResumenInterno(hoja);
  corregirFechasSerializadasEnHoja(hoja);
  formatearFilasEstadoResumenInterno(hoja);
  hoja.setColumnWidth(1, 165);
  hoja.setColumnWidth(2, 175);
  hoja.setColumnWidth(3, 190);
  for (let c = 4; c <= columnas; c++) hoja.setColumnWidth(c, c === columnas ? 120 : 105);
}

function formatearAlertasInternas(hoja) {
  const filas = hoja.getLastRow();
  const columnas = hoja.getLastColumn();
  if (!filas || !columnas) return;

  hoja.setFrozenRows(1);
  hoja.getRange(1, 1, filas, columnas)
    .setFontFamily("Arial")
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setWrap(true)
    .setBorder(true, true, true, true, true, true, "#d9d9d9", SpreadsheetApp.BorderStyle.SOLID);
  hoja.getRange(1, 1, 1, columnas)
    .setFontWeight("bold")
    .setFontColor("#ffffff")
    .setBackground("#0b3f66")
    .setHorizontalAlignment("center");
  if (hoja.getFilter()) hoja.getFilter().remove();
  if (filas > 1) hoja.getRange(1, 1, filas, columnas).createFilter();

  if (filas > 1) {
    const rangoNivel = hoja.getRange(2, 1, filas - 1, 1);
    const valores = rangoNivel.getValues();
    const fondos = valores.map(function(fila) {
      const nivel = normalizarTexto(fila[0]);
      if (nivel === "alta") return ["#f4cccc"];
      if (nivel === "media") return ["#fff2cc"];
      if (nivel === "baja") return ["#d9eaf7"];
      if (nivel === "ok") return ["#d9ead3"];
      return ["#eeeeee"];
    });
    rangoNivel.setBackgrounds(fondos).setFontWeight("bold").setHorizontalAlignment("center");
  }

  hoja.setColumnWidth(1, 90);
  hoja.setColumnWidth(2, 230);
  hoja.setColumnWidth(3, 330);
  hoja.setColumnWidth(4, 190);
  hoja.setColumnWidth(5, 130);
  hoja.setColumnWidth(6, 380);
}

function formatearAvanceEncuesta(hoja) {
  const filas = hoja.getLastRow();
  const columnas = hoja.getLastColumn();
  if (!filas || !columnas) return;

  if (hoja.getFilter()) hoja.getFilter().remove();
  hoja.getRange(1, 1, filas, columnas).breakApart();
  hoja.getRange(1, 1, filas, columnas)
    .setFontFamily("Arial")
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setHorizontalAlignment("center")
    .setWrap(true)
    .setBorder(true, true, true, true, true, true, "#d9d9d9", SpreadsheetApp.BorderStyle.SOLID);
  hoja.getRange(1, 1, filas, 1).setHorizontalAlignment("left");

  for (let r = 1; r <= filas; r++) {
    const valorA = String(hoja.getRange(r, 1).getValue() || "");
    const valorB = String(hoja.getRange(r, 2).getValue() || "");
    if (esTituloBloqueAvanceEncuesta(valorA, valorB)) {
      hoja.getRange(r, 1, 1, columnas)
        .merge()
        .setFontWeight("bold")
        .setFontColor("#ffffff")
        .setBackground("#0b3f66")
        .setHorizontalAlignment("left");
    }
    if (esEncabezadoBloqueAvanceEncuesta(valorA, valorB)) {
      hoja.getRange(r, 1, 1, columnas)
        .setFontWeight("bold")
        .setFontColor("#ffffff")
        .setBackground("#1f5f8b")
        .setHorizontalAlignment("center");
    }
  }
  formatearNumerosResumenInterno(hoja);
  corregirFechasSerializadasEnHoja(hoja);
  corregirColumnasUltimaActualizacion(hoja);
  ajustarAnchosInteligentes(hoja);
  ajustarAnchosAvanceEncuesta(hoja);
}

function corregirColumnasUltimaActualizacion(hoja) {
  const filas = hoja.getLastRow();
  const columnas = hoja.getLastColumn();
  if (!filas || !columnas) return;

  const valores = hoja.getRange(1, 1, filas, columnas).getValues();
  for (let r = 0; r < valores.length; r++) {
    for (let c = 0; c < valores[r].length; c++) {
      if (normalizarTexto(valores[r][c]) !== "ultima actualizacion") continue;

      const ultimaFila = encontrarUltimaFilaBloqueResumenInterno(valores, r);
      const cantidad = Math.max(ultimaFila - r, 0);
      if (!cantidad) continue;

      const rango = hoja.getRange(r + 2, c + 1, cantidad, 1);
      const salida = rango.getValues().map(function(fila) {
        return [textoFechaHoraParaReporte(fila[0])];
      });
      rango.setNumberFormat("@").setValues(salida);
    }
  }
}

function textoFechaHoraParaReporte(valor) {
  if (valor === "" || valor === null || valor === undefined) return "";
  const serializada = textoFechaSerializada(valor, true);
  if (serializada) return serializada;

  const texto = String(valor || "").trim();
  if (!texto) return "";
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(texto)) return texto;

  const fecha = new Date(texto);
  if (!isNaN(fecha.getTime()) && /\d{4}-\d{2}-\d{2}/.test(texto)) {
    return Utilities.formatDate(fecha, Session.getScriptTimeZone() || "America/Lima", "dd/MM/yyyy HH:mm");
  }
  return texto;
}

function esTituloBloqueAvanceEncuesta(valorA, valorB) {
  if (!valorA || valorB) return false;
  return normalizarTexto(valorA).indexOf("efectivas por dia -") === 0 ||
    normalizarTexto(valorA) === "avance por recopilador" ||
    normalizarTexto(valorA) === "resumen general por encuesta";
}

function esEncabezadoBloqueAvanceEncuesta(valorA, valorB) {
  const a = normalizarTexto(valorA);
  const b = normalizarTexto(valorB);
  return (a === "unidad" && b) || (a === "actor" && b.indexOf("canal") === 0);
}

function ajustarAnchosAvanceEncuesta(hoja) {
  const columnas = hoja.getLastColumn();
  if (!columnas) return;
  const anchos = [170, 170, 260, 330, 300, 150, 125, 125, 125, 150, 170];
  for (let c = 1; c <= columnas; c++) hoja.setColumnWidth(c, anchos[c - 1] || 125);
}

function formatearNumerosResumenInterno(hoja) {
  const filas = hoja.getLastRow();
  const columnas = hoja.getLastColumn();
  if (filas < 2) return;

  hoja.getRange(1, 1, filas, columnas).setNumberFormat("General");
  const valores = hoja.getRange(1, 1, filas, columnas).getValues();
  for (let r = 0; r < valores.length; r++) {
    const valorA = String(valores[r][0] || "");
    const valorB = String(valores[r][1] || "");
    if (!esEncabezadoBloqueResumenInterno(valorA, valorB)) continue;

    const ultimaFilaBloque = encontrarUltimaFilaBloqueResumenInterno(valores, r);
    const cantidadFilas = Math.max(ultimaFilaBloque - r, 0);
    if (!cantidadFilas) continue;

    for (let c = 0; c < valores[r].length; c++) {
      const nombre = normalizarTexto(valores[r][c]);
      const rango = hoja.getRange(r + 2, c + 1, cantidadFilas, 1);
      if (nombre.indexOf("avance") >= 0 || nombre.indexOf("%") >= 0 || nombre.indexOf("diferencia") >= 0) {
        rango.setNumberFormat("0%");
      } else if (esColumnaConteo(nombre) || esEncabezadoFechaResumen(nombre) || nombre === "casos barridos" || nombre === "no barridos") {
        rango.setNumberFormat("0");
      }
    }
  }
}

function corregirFechasSerializadasEnHoja(hoja) {
  const filas = hoja.getLastRow();
  const columnas = hoja.getLastColumn();
  if (!filas || !columnas) return;

  const valores = hoja.getRange(1, 1, filas, columnas).getValues();
  for (let r = 0; r < filas; r++) {
    const primera = normalizarTexto(valores[r][0]);
    const filaConFechas = primera === "ultima actualizacion" ||
      primera === "estatus" ||
      primera === "indicador" ||
      primera === "responsable" ||
      primera === "actor" ||
      primera === "unidad";
    if (!filaConFechas) continue;

    for (let c = 1; c < columnas; c++) {
      const texto = textoFechaSerializada(valores[r][c], primera === "ultima actualizacion");
      if (!texto) continue;
      hoja.getRange(r + 1, c + 1).setNumberFormat("@").setValue(texto);
    }
  }
}

function textoFechaSerializada(valor, incluirHora) {
  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor.getTime())) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone() || "America/Lima", incluirHora ? "dd/MM/yyyy HH:mm" : "yyyy-MM-dd");
  }

  const serial = obtenerSerialFecha(valor);
  if (!serial) return "";
  const tieneHora = incluirHora || Math.abs(serial - Math.floor(serial)) > 0.00001;
  return formatearSerialFechaGoogle(serial, tieneHora ? "dd/MM/yyyy HH:mm" : "yyyy-MM-dd");
}

function formatearFilasEstadoResumenInterno(hoja) {
  const filas = hoja.getLastRow();
  const columnas = hoja.getLastColumn();
  if (filas < 2 || columnas < 2) return;

  const valores = hoja.getRange(1, 1, filas, Math.min(columnas, 2)).getValues();
  valores.forEach(function(fila, i) {
    const actor = String(fila[0] || "");
    const estado = normalizarTexto(fila[1]);
    if (obtenerActoresActivos().indexOf(actor) < 0) return;

    let fondo = "";
    if (estado === "completas") fondo = "#d9ead3";
    if (estado === "parciales") fondo = "#fff2cc";
    if (estado === "rechazos") fondo = "#f4cccc";
    if (fondo) hoja.getRange(i + 1, 2, 1, columnas - 1).setBackground(fondo).setFontColor("#202124");
  });
}

function encontrarUltimaFilaBloqueResumenInterno(valores, filaEncabezado) {
  for (let i = filaEncabezado + 1; i < valores.length; i++) {
    const vacia = valores[i].every(function(celda) { return String(celda || "").trim() === ""; });
    if (vacia) return i - 1;
  }
  return valores.length - 1;
}

function esTituloBloqueResumenInterno(valorA, valorB) {
  if (!valorA || valorB) return false;
  return [
    "Resumen por unidad",
    "Resumen por actor",
    "Avance por dia",
    "Avance efectivo por día",
    "Avance general por día",
    "Distribución de egresados por año",
    "Detalle por variables de control",
  ].map(normalizarTexto).indexOf(normalizarTexto(valorA)) >= 0;
}

function esSubtituloActorResumenInterno(valorA, valorB) {
  if (!valorA || valorB) return false;
  return obtenerActoresActivos().indexOf(valorA) >= 0;
}

function esEncabezadoBloqueResumenInterno(valorA, valorB) {
  const a = normalizarTexto(valorA);
  const b = normalizarTexto(valorB);
  if (a === "actor" && (b === "universo" || b === "estado")) return true;
  if (a === "unidad" && b) return true;
  if (a === "variable" && b === "valor") return true;
  return false;
}

function esEncabezadoFechaResumen(nombre) {
  return /^\d{4}-\d{2}-\d{2}$/.test(nombre) || nombre === "sin fecha";
}

function formatearCliente(libro) {
  const reporte = libro.getSheetByName(PESTANA_REPORTE_CLIENTE);
  if (reporte) formatearReporteCliente(reporte);
  libro.getSheets().forEach(function(hoja) {
    if (hoja.getName() !== PESTANA_REPORTE_CLIENTE) formatearPestanaCliente(hoja);
  });
}

function formatearReporteCliente(hoja) {
  const filas = hoja.getLastRow();
  const columnas = hoja.getLastColumn();
  if (!filas) return;

  hoja.getRange(1, 1, filas, columnas)
    .setFontFamily("Arial")
    .setFontSize(11)
    .setVerticalAlignment("middle")
    .setHorizontalAlignment("center")
    .setWrap(true)
    .setBorder(false, false, false, false, false, false);
  hoja.getRange(1, 1, filas, columnas).setNumberFormat("General");
  hoja.getRange("B3").setNumberFormat("dd/mm/yyyy hh:mm");
  hoja.setHiddenGridlines(true);

  hoja.getRange(1, 1, 1, columnas)
    .merge()
    .setFontSize(18)
    .setFontWeight("bold")
    .setFontColor("#ffffff")
    .setBackground("#0b3f66")
    .setHorizontalAlignment("center");
  hoja.getRange(2, 1, 1, columnas)
    .merge()
    .setFontSize(12)
    .setFontStyle("italic")
    .setFontColor("#0b3f66")
    .setHorizontalAlignment("left");
  hoja.getRange("A3:B3").setFontWeight("bold");

  if (hoja.getFilter()) hoja.getFilter().remove();
  hoja.setFrozenRows(3);

  for (let r = 1; r <= filas; r++) {
    const valorA = String(hoja.getRange(r, 1).getValue() || "");
    const valorB = String(hoja.getRange(r, 2).getValue() || "");

    if (esTituloUnidadReporteCliente(hoja, r)) formatearTituloUnidadReporteCliente(hoja, r);
    if (esEncabezadoEjecutivoReporteCliente(valorA, valorB)) formatearTablaEjecutivaReporteCliente(hoja, r);
    if (normalizarTexto(valorA) === "detalle diario") formatearTituloDetalleDiarioReporteCliente(hoja, r, columnas);
    if (esTituloBloqueResumenInterno(valorA, valorB) && normalizarTexto(valorA) !== "detalle diario") {
      hoja.getRange(r, 1, 1, columnas)
        .merge()
        .setFontWeight("bold")
        .setFontColor("#ffffff")
        .setBackground("#0b3f66")
        .setHorizontalAlignment("left");
    }
    if (esEncabezadoBloqueResumenInterno(valorA, valorB)) {
      hoja.getRange(r, 1, 1, columnas)
        .setFontWeight("bold")
        .setFontColor("#ffffff")
        .setBackground("#1f5f8b")
        .setHorizontalAlignment("center");
    }
  }

  formatearNumerosResumenInterno(hoja);
  formatearNumerosTablasEjecutivasReporteCliente(hoja);
  corregirFechasSerializadasEnHoja(hoja);
  ajustarAnchosReporteCliente(hoja);
}

function esTituloUnidadReporteCliente(hoja, fila) {
  const actual = String(hoja.getRange(fila, 1).getValue() || "").trim();
  const derecha = String(hoja.getRange(fila, 2).getValue() || "").trim();
  if (!actual || derecha) return false;
  if (normalizarTexto(actual) === "detalle diario") return false;
  if (fila >= hoja.getLastRow()) return false;
  return normalizarTexto(hoja.getRange(fila + 1, 1).getValue()) === "total" &&
    normalizarTexto(hoja.getRange(fila + 1, 2).getValue()) === "respuestas en el sistema";
}

function formatearTituloUnidadReporteCliente(hoja, fila) {
  hoja.getRange(fila, 1, 1, ANCHO_BLOQUE_REPORTE_CLIENTE)
    .merge()
    .setFontWeight("bold")
    .setFontSize(13)
    .setFontColor("#202124")
    .setBackground("#ffffff")
    .setHorizontalAlignment("left")
    .setBorder(false, false, false, false, false, false);
  hoja.setRowHeight(fila, 34);
}

function esEncabezadoEjecutivoReporteCliente(valorA, valorB) {
  return normalizarTexto(valorA) === "total" && normalizarTexto(valorB) === "respuestas en el sistema";
}

function formatearTablaEjecutivaReporteCliente(hoja, filaEncabezado) {
  const azul = "#0b3f66";
  const ancho = ANCHO_BLOQUE_REPORTE_CLIENTE;
  hoja.getRange(filaEncabezado, 1, 3, ancho)
    .setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  hoja.getRange(filaEncabezado, 1, 2, 1).merge();
  hoja.getRange(filaEncabezado, 2, 1, 3).merge();
  hoja.getRange(filaEncabezado, 5, 2, 1).merge();
  hoja.getRange(filaEncabezado, 6, 2, 1).merge();

  hoja.getRange(filaEncabezado, 1, 2, ancho)
    .setBackground(azul)
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setFontSize(12);
  hoja.getRange(filaEncabezado + 2, 1, 1, ancho)
    .setBackground("#ffffff")
    .setFontColor("#202124")
    .setFontWeight("normal")
    .setFontSize(12);
  hoja.getRange(filaEncabezado + 2, 1, 1, 5).setNumberFormat("0");
  hoja.getRange(filaEncabezado + 2, 6).setNumberFormat("0%");
  hoja.setRowHeights(filaEncabezado, 3, 34);
}

function formatearTituloDetalleDiarioReporteCliente(hoja, fila, columnas) {
  hoja.getRange(fila, 1, 1, columnas)
    .merge()
    .setFontWeight("bold")
    .setFontSize(12)
    .setFontColor("#ffffff")
    .setBackground("#0b3f66")
    .setHorizontalAlignment("left");
}

function formatearNumerosTablasEjecutivasReporteCliente(hoja) {
  const filas = hoja.getLastRow();
  for (let r = 1; r <= filas - 2; r++) {
    if (!esEncabezadoEjecutivoReporteCliente(hoja.getRange(r, 1).getValue(), hoja.getRange(r, 2).getValue())) continue;
    hoja.getRange(r + 2, 1, 1, 5).setNumberFormat("0");
    hoja.getRange(r + 2, 6).setNumberFormat("0%");
  }
}

function ajustarAnchosReporteCliente(hoja) {
  const columnas = hoja.getLastColumn();
  const anchos = [250, 135, 135, 135, 145, 135, 110, 110, 110, 110, 110, 110];
  for (let c = 1; c <= columnas; c++) hoja.setColumnWidth(c, anchos[c - 1] || 110);
}

function formatearPestanaCliente(hoja) {
  const filas = hoja.getLastRow();
  const columnas = hoja.getLastColumn();
  if (!filas || !columnas) return;

  if (hoja.getName() === PESTANA_DETALLE_AVANCE_CLIENTE) {
    formatearDetalleAvanceCliente(hoja);
    return;
  }
  if (hoja.getName() === PESTANA_AVANCE_ENCUESTA) {
    formatearAvanceEncuesta(hoja);
    return;
  }

  hoja.setFrozenRows(1);
  hoja.getRange(1, 1, 1, columnas)
    .setFontWeight("bold")
    .setFontColor("#ffffff")
    .setBackground("#0b3f66")
    .setHorizontalAlignment("center")
    .setWrap(true);
  hoja.getRange(1, 1, filas, columnas)
    .setFontFamily("Arial")
    .setFontSize(10)
    .setBorder(true, true, true, true, true, true, "#d9d9d9", SpreadsheetApp.BorderStyle.SOLID);
  if (hoja.getFilter()) hoja.getFilter().remove();
  if (filas > 1) hoja.getRange(1, 1, filas, columnas).createFilter();
  formatearColumnasPorEncabezado(hoja);
  if (hoja.getName().slice(-SUFIJO_AVANCE_CLIENTE.length) === SUFIJO_AVANCE_CLIENTE) formatearColumnaEstadoAvance(hoja);
  ajustarAnchosInteligentes(hoja);
}

function formatearDetalleAvanceCliente(hoja) {
  const filas = hoja.getLastRow();
  const columnas = hoja.getLastColumn();
  if (!filas || !columnas) return;

  hoja.setFrozenRows(0);
  hoja.getRange(1, 1, filas, columnas)
    .setFontFamily("Arial")
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setBorder(true, true, true, true, true, true, "#d9d9d9", SpreadsheetApp.BorderStyle.SOLID);

  for (let r = 1; r <= filas; r++) {
    const valorA = String(hoja.getRange(r, 1).getValue() || "");
    const valorB = String(hoja.getRange(r, 2).getValue() || "");

    if (valorA && !valorB && (
      normalizarTexto(valorA) === "distribucion de egresados por ano" ||
      normalizarTexto(valorA) === "detalle completo por variables de control"
    )) {
      hoja.getRange(r, 1, 1, columnas)
        .merge()
        .setFontWeight("bold")
        .setFontSize(12)
        .setFontColor("#ffffff")
        .setBackground("#0b3f66")
        .setHorizontalAlignment("left");
    }

    if (valorA && !valorB && obtenerActoresActivos().indexOf(valorA) >= 0) {
      hoja.getRange(r, 1, 1, columnas)
        .merge()
        .setFontWeight("bold")
        .setFontSize(12)
        .setFontColor("#ffffff")
        .setBackground("#0b3f66")
        .setHorizontalAlignment("left");
    }

    if (valorA === ENCABEZADO_DETALLE_VARIABLES[0] && valorB === ENCABEZADO_DETALLE_VARIABLES[1]) {
      hoja.getRange(r, 1, 1, columnas)
        .setFontWeight("bold")
        .setFontColor("#ffffff")
        .setBackground("#0b3f66")
        .setHorizontalAlignment("center")
        .setWrap(true);
    }
    if (valorA === ENCABEZADO_DISTRIBUCION_EGRESADOS[0] && valorB === ENCABEZADO_DISTRIBUCION_EGRESADOS[1]) {
      hoja.getRange(r, 1, 1, columnas)
        .setFontWeight("bold")
        .setFontColor("#ffffff")
        .setBackground("#0b3f66")
        .setHorizontalAlignment("center")
        .setWrap(true);
    }
  }

  formatearPorcentajesDetalleAvance(hoja);
  hoja.setColumnWidth(1, 165);
  hoja.setColumnWidth(2, 200);
  hoja.setColumnWidth(3, 190);
  hoja.setColumnWidths(4, 6, 125);
  hoja.setColumnWidth(8, 155);
  hoja.setColumnWidth(9, 125);
}

function formatearPorcentajesDetalleAvance(hoja) {
  const filas = hoja.getLastRow();
  const columnas = hoja.getLastColumn();
  const valores = hoja.getRange(1, 1, filas, columnas).getValues();
  for (let r = 0; r < valores.length; r++) {
    const esEncabezado = normalizarTexto(valores[r][0]) === "actor" || normalizarTexto(valores[r][0]) === "unidad";
    if (!esEncabezado) continue;
    const fin = encontrarUltimaFilaBloqueResumenInterno(valores, r);
    const cantidad = Math.max(fin - r, 0);
    if (!cantidad) continue;
    valores[r].forEach(function(encabezado, c) {
      const nombre = normalizarTexto(encabezado);
      if (nombre.indexOf("%") >= 0 || nombre.indexOf("avance") >= 0 || nombre.indexOf("diferencia") >= 0) {
        hoja.getRange(r + 2, c + 1, cantidad, 1).setNumberFormat("0%");
      } else if (esColumnaConteo(nombre)) {
        hoja.getRange(r + 2, c + 1, cantidad, 1).setNumberFormat("0");
      }
    });
  }
}

function formatearColumnasPorEncabezado(hoja) {
  const filas = hoja.getLastRow();
  const columnas = hoja.getLastColumn();
  if (filas < 2 || !columnas) return;

  const encabezados = hoja.getRange(1, 1, 1, columnas).getValues()[0];
  hoja.getRange(2, 1, filas - 1, columnas).setNumberFormat("General");
  encabezados.forEach(function(encabezado, i) {
    const nombre = normalizarTexto(encabezado);
    if (nombre === "avance" || nombre.indexOf("avance ") === 0) {
      hoja.getRange(2, i + 1, filas - 1, 1).setNumberFormat("0%");
    } else if (esColumnaConteo(nombre)) {
      hoja.getRange(2, i + 1, filas - 1, 1).setNumberFormat("0");
    }
  });
}

function esColumnaConteo(nombre) {
  return [
    "universo",
    "efectivas",
    "total",
    "completas",
    "parciales",
    "rechazos",
    "sin respuesta",
    "total respuestas",
  ].indexOf(nombre) >= 0;
}

function ajustarAnchosInteligentes(hoja) {
  const columnas = hoja.getLastColumn();
  if (!columnas) return;

  const encabezados = hoja.getRange(1, 1, 1, columnas).getValues()[0];
  encabezados.forEach(function(encabezado, i) {
    const columna = i + 1;
    const nombre = normalizarTexto(encabezado);
    const ancho = anchoColumnaPorEncabezado(nombre, columna);
    hoja.setColumnWidth(columna, ancho);

    if (ancho >= 180) {
      hoja.getRange(1, columna, Math.max(hoja.getLastRow(), 1), 1).setWrap(true);
    }
  });
}

function anchoColumnaPorEncabezado(nombre, columna) {
  if (nombre === "estado avance") return 155;
  if (nombre === "n°" || nombre === "n" || nombre === "no" || nombre.indexOf("numero") >= 0) return 75;
  if (nombre.indexOf("codigo") >= 0 || nombre.indexOf("cod") >= 0) return 130;
  if (nombre.indexOf("email") >= 0 || nombre.indexOf("correo") >= 0 || nombre.indexOf("mail") >= 0) return 260;
  if (nombre.indexOf("celular") >= 0 || nombre.indexOf("telefono") >= 0 || nombre.indexOf("fono") >= 0) return 145;
  if (nombre.indexOf("nombre") >= 0 || nombre.indexOf("apellido") >= 0) return 310;
  if (nombre === "recopilador") return 320;
  if (nombre === "tipo recopilador") return 145;
  if (nombre.indexOf("area") >= 0 || nombre.indexOf("dedicacion") >= 0 || nombre.indexOf("categoria") >= 0) return 190;
  if (nombre.indexOf("ciclo") >= 0 || nombre.indexOf("anio") >= 0 || nombre.indexOf("año") >= 0) return 145;
  if (nombre === "actor") return 165;
  if (nombre === "variable") return 205;
  if (nombre === "valor") return 190;
  if (nombre === "total" || nombre === "completas" || nombre === "parciales" || nombre === "rechazos" || nombre === "avance") return 125;
  if (nombre.indexOf("sin respuesta") >= 0) return 150;
  return columna <= 12 ? 170 : 130;
}

function formatearMonitoreoTelefonico(hoja) {
  const filas = hoja.getLastRow();
  const columnas = hoja.getLastColumn();
  if (!filas || !columnas) return;

  if (hoja.getFilter()) hoja.getFilter().remove();
  hoja.getRange(1, 1, filas, columnas).breakApart();
  hoja.setFrozenRows(0);
  hoja.setFrozenColumns(0);
  hoja.getRange(1, 1, filas, columnas)
    .setFontFamily("Arial")
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setHorizontalAlignment("center")
    .setWrap(true)
    .setBorder(true, true, true, true, true, true, "#d9d9d9", SpreadsheetApp.BorderStyle.SOLID);
  hoja.getRange(1, 1, filas, 1).setHorizontalAlignment("left");

  hoja.getRange(1, 1, 1, columnas)
    .merge()
    .setFontSize(15)
    .setFontWeight("bold")
    .setFontColor("#ffffff")
    .setBackground("#0b3f66")
    .setHorizontalAlignment("center");

  for (let r = 1; r <= filas; r++) {
    const valorA = String(hoja.getRange(r, 1).getValue() || "");
    const valorB = String(hoja.getRange(r, 2).getValue() || "");
    if (esTituloBloqueMonitoreo(valorA, valorB)) {
      hoja.getRange(r, 1, 1, columnas)
        .merge()
        .setFontWeight("bold")
        .setFontSize(12)
        .setFontColor("#ffffff")
        .setBackground("#0b3f66")
        .setHorizontalAlignment("left");
    }
    if (esEncabezadoBloqueMonitoreo(valorA, valorB)) {
      hoja.getRange(r, 1, 1, columnas)
        .setFontWeight("bold")
        .setFontColor("#ffffff")
        .setBackground("#1f5f8b")
        .setHorizontalAlignment("center");
    }
  }

  formatearNumerosMonitoreoTelefonico(hoja);
  corregirFechasSerializadasEnHoja(hoja);
  hoja.setColumnWidth(1, 240);
  for (let c = 2; c <= columnas; c++) hoja.setColumnWidth(c, c <= 8 ? 145 : 105);
  hoja.getRange(1, 1).setHorizontalAlignment("center");
}

function formatearNumerosMonitoreoTelefonico(hoja) {
  const filas = hoja.getLastRow();
  const columnas = hoja.getLastColumn();
  if (filas < 2) return;

  hoja.getRange(1, 1, filas, columnas).setNumberFormat("General");
  const valores = hoja.getRange(1, 1, filas, columnas).getValues();
  for (let r = 0; r < valores.length; r++) {
    for (let c = 0; c < valores[r].length; c++) {
      const encabezado = String(valores[r][c] || "");
      const nombre = normalizarTexto(encabezado);
      const ultimaFilaBloque = encontrarUltimaFilaBloqueMonitoreo(valores, r);
      const cantidadFilas = Math.max(ultimaFilaBloque - r, 0);
      if (!cantidadFilas) continue;

      if (nombre.indexOf("%") >= 0) {
        hoja.getRange(r + 2, c + 1, cantidadFilas, 1).setNumberFormat("0%");
      }
      if (nombre.indexOf("promedio intentos") >= 0) {
        hoja.getRange(r + 2, c + 1, cantidadFilas, 1).setNumberFormat("0.0");
      }
    }
  }
}

function encontrarUltimaFilaBloqueMonitoreo(valores, filaEncabezado) {
  for (let i = filaEncabezado + 1; i < valores.length; i++) {
    const vacia = valores[i].every(function(celda) { return String(celda || "").trim() === ""; });
    if (vacia) return i - 1;
  }
  return valores.length - 1;
}

function esTituloBloqueMonitoreo(valorA, valorB) {
  if (!valorA || valorB) return false;
  if (normalizarTexto(valorA).indexOf("detalle de cierres por ") === 0) return true;
  return [
    "Resumen general",
    "Distribución por estatus",
    "Avance por año de egreso",
    "Conciliación de efectivos por responsable",
    "Estatus por responsable",
    "Producción por día",
    "Efectivas por día: barrido vs SurveyMonkey",
    "Producción por día por responsable",
    "Responsables a revisar",
    "Insistencia / rebarrido: No contesta",
    "Auditoría de coherencia",
  ].map(normalizarTexto).indexOf(normalizarTexto(valorA)) >= 0;
}

function esEncabezadoBloqueMonitoreo(valorA, valorB) {
  const a = normalizarTexto(valorA);
  const b = normalizarTexto(valorB);
  if (a === "indicador" && b) return true;
  if ((a === "status" || a === "estatus") && b) return true;
  if (a === "año de egreso" && b === "total telefonico") return true;
  if (a === "responsable" && b) return true;
  if (a === "codpulso" && b === "nombre") return true;
  if (a === "tipo alerta" && b === "codpulso") return true;
  return false;
}

function formatearColumnaEstadoAvance(hoja) {
  const filas = hoja.getLastRow();
  if (filas < 2) return;

  const rango = hoja.getRange(2, 1, filas - 1, 1);
  const valores = rango.getValues();
  const fondos = valores.map(function(fila) {
    const estado = normalizarTexto(fila[0]);
    if (estado === "completa") return ["#d9ead3"];
    if (estado === "parcial") return ["#fff2cc"];
    if (estado === "rechazo") return ["#f4cccc"];
    return ["#eeeeee"];
  });

  hoja.setColumnWidth(1, 155);
  hoja.getRange(1, 1).setBackground("#0b3f66").setFontColor("#ffffff").setFontWeight("bold");
  rango.setBackgrounds(fondos).setFontWeight("bold").setHorizontalAlignment("center");
}

function obtenerUnidadesReporteActivas() {
  const actores = crearSet(obtenerActoresActivos());
  return (UNIDADES_REPORTE_ESTUDIO || []).filter(function(unidad) {
    return unidad.activo && actores[unidad.actor];
  });
}

function obtenerSegmentosActivos() {
  const actores = crearSet(obtenerActoresActivos());
  return (SEGMENTOS_ESTUDIO || []).filter(function(segmento) {
    return segmento.activo && actores[segmento.actor];
  });
}

function obtenerGruposSegmentosActivos() {
  const actores = crearSet(obtenerActoresActivos());
  return (GRUPOS_SEGMENTOS_ESTUDIO || []).filter(function(grupo) {
    return grupo.activo && actores[grupo.actor];
  });
}

function respuestaPerteneceAUnidad(respuesta, unidad) {
  if (!unidad || normalizarTexto(respuesta.Actor) !== normalizarTexto(unidad.actor)) return false;
  if (normalizarTexto(unidad.tipo) === "actor") return true;
  if (normalizarTexto(unidad.tipo) === "segmento") {
    return respuestaPerteneceASegmento(respuesta, obtenerSegmentoDeUnidad(unidad) || unidad);
  }
  if (normalizarTexto(unidad.tipo) === "grupo") {
    const grupo = obtenerGrupoSegmentos(unidad);
    if (!grupo) return false;
    return obtenerSegmentosDeGrupo(grupo, unidad.actor).some(function(segmento) {
      return respuestaPerteneceASegmento(respuesta, segmento);
    });
  }
  return false;
}

function construirResumenUnidadesDesdeAvances(avancesPorActor) {
  return obtenerUnidadesReporteActivas().map(function(unidad) {
    const avance = avancesPorActor[unidad.actor];
    if (!avance) return crearResumenUnidadVacio(unidad);
    return resumenUnidadDesdeFilas(unidad, filasAvanceParaUnidadGenerica(unidad, avance));
  });
}

function construirResumenUnidadesDesdeRespuestas(respuestasPorActor, avancesPorActor) {
  return construirResumenUnidadesDesdeAvances(avancesPorActor);
}

function contarEstadosRespuestas(actor, respuestas) {
  const resumen = { completas: 0, parciales: 0, rechazos: 0 };
  deduplicarRespuestasParaConteo(actor, respuestas || []).forEach(function(respuesta) {
    const estado = estadoAvanceDesdeRespuesta(respuesta);
    if (estado === "Completa") resumen.completas++;
    if (estado === "Parcial") resumen.parciales++;
    if (estado === "Rechazo") resumen.rechazos++;
  });
  return resumen;
}

function crearResumenUnidadVacio(unidad) {
  return { etiqueta: unidad.etiqueta || unidad.unidad, total: 0, completas: 0, parciales: 0, rechazos: 0, sinRespuesta: 0 };
}

function resumenUnidadDesdeFilas(unidad, filasAvance) {
  const resumen = crearResumenUnidadVacio(unidad);
  (filasAvance || []).forEach(function(fila) {
    const estado = String(fila[0] || "Sin respuesta");
    resumen.total++;
    if (estado === "Completa") resumen.completas++;
    else if (estado === "Parcial") resumen.parciales++;
    else if (estado === "Rechazo") resumen.rechazos++;
    else resumen.sinRespuesta++;
  });
  return resumen;
}

function filasAvanceParaUnidadGenerica(unidad, avance) {
  const tipo = normalizarTexto(unidad.tipo);
  if (tipo === "actor") return avance.filas || [];
  if (tipo === "segmento") return filtrarFilasAvancePorSegmento(unidad, avance);
  if (tipo === "grupo") {
    const grupo = obtenerGrupoSegmentos(unidad);
    if (!grupo) return [];
    const segmentos = obtenerSegmentosDeGrupo(grupo, unidad.actor);
    const incluidos = {};
    const filas = [];

    (avance.filas || []).forEach(function(fila, indice) {
      const pertenece = segmentos.some(function(segmento) {
        return filaPerteneceASegmento(fila, segmento, avance);
      });
      if (pertenece && !incluidos[indice]) {
        incluidos[indice] = true;
        filas.push(fila);
      }
    });
    return filas;
  }
  return [];
}

function filtrarFilasAvancePorSegmento(unidad, avance) {
  const segmento = obtenerSegmentoDeUnidad(unidad) || unidad;
  return (avance.filas || []).filter(function(fila) {
    return filaPerteneceASegmento(fila, segmento, avance);
  });
}

function filaPerteneceASegmento(fila, segmento, avance) {
  const campo = segmento.campo || "";
  if (!campo) return false;
  const indice = encontrarIndiceEncabezado(avance.encabezados, campo);
  if (indice < 0) return false;

  const valorFila = normalizarValorSegmentoReporte(segmento.actor, campo, fila[indice]);
  const valores = [
    segmento.valorUniverso,
    segmento.valor,
    segmento.segmento,
    segmento.etiqueta,
  ].filter(function(valor) { return valor !== undefined && valor !== null && String(valor).trim() !== ""; }).map(function(valor) {
    return normalizarValorSegmentoReporte(segmento.actor, campo, valor);
  });

  return valores.indexOf(valorFila) >= 0;
}

function respuestaPerteneceASegmento(respuesta, segmento) {
  const campo = segmento.campo || "";
  const valorRespuesta = campo ? respuesta[campo] : "";
  const valor = valorRespuesta || respuesta.Segmento || respuesta.Carrera || "";
  if (valor === "" || valor === null || valor === undefined) return false;

  const valorNormalizado = normalizarValorSegmentoReporte(segmento.actor, campo, valor);
  const valores = [
    segmento.valorRespuesta,
    segmento.valorUniverso,
    segmento.valor,
    segmento.segmento,
    segmento.etiqueta,
  ].filter(function(item) { return item !== undefined && item !== null && String(item).trim() !== ""; }).map(function(item) {
    return normalizarValorSegmentoReporte(segmento.actor, campo, item);
  });

  return valores.indexOf(valorNormalizado) >= 0;
}

function obtenerSegmentoDeUnidad(unidad) {
  const nombreUnidad = normalizarTexto(unidad.segmento || unidad.unidad || unidad.etiqueta);
  return obtenerSegmentosActivos().filter(function(segmento) {
    return normalizarTexto(segmento.actor) === normalizarTexto(unidad.actor) && (
      normalizarTexto(segmento.segmento) === nombreUnidad ||
      normalizarTexto(segmento.etiqueta) === nombreUnidad
    );
  })[0];
}

function obtenerGrupoSegmentos(unidad) {
  const nombreGrupo = normalizarTexto(unidad.grupo || unidad.unidad || unidad.etiqueta);
  return obtenerGruposSegmentosActivos().filter(function(grupo) {
    return normalizarTexto(grupo.actor) === normalizarTexto(unidad.actor) && (
      normalizarTexto(grupo.grupo) === nombreGrupo ||
      normalizarTexto(grupo.etiqueta) === nombreGrupo
    );
  })[0];
}

function obtenerSegmentosDeGrupo(grupo, actor) {
  const nombres = (grupo.segmentos || []).map(normalizarTexto);
  return obtenerSegmentosActivos().filter(function(segmento) {
    return normalizarTexto(segmento.actor) === normalizarTexto(actor) && (
      nombres.indexOf(normalizarTexto(segmento.segmento)) >= 0 ||
      nombres.indexOf(normalizarTexto(segmento.etiqueta)) >= 0
    );
  });
}

function normalizarValorSegmentoReporte(actor, campo, valor) {
  const variable = obtenerVariablesControlActivas(actor).filter(function(item) {
    return normalizarTexto(item.campo) === normalizarTexto(campo);
  })[0];
  if (variable && variable.tipo === "anio") return normalizarTexto(normalizarAnioEgreso(valor));
  return normalizarTexto(valor);
}

function obtenerMonitoreosTelefonicosActivos() {
  const actores = crearSet(obtenerActoresActivos());
  return (MONITOREOS_TELEFONICOS || []).filter(function(monitoreo) {
    return monitoreo.activo && actores[monitoreo.actor];
  });
}

function nombrePestanaMonitoreoTelefonico(monitoreo) {
  const activos = (MONITOREOS_TELEFONICOS || []).filter(function(item) { return item.activo; });
  if (activos.length <= 1) return PESTANA_MONITOREO_TELEFONICO;
  return PESTANA_MONITOREO_TELEFONICO + " - " + monitoreo.actor;
}

function esPestanaMonitoreoTelefonico(nombrePestana) {
  return obtenerMonitoreosTelefonicosActivos().some(function(monitoreo) {
    return nombrePestanaMonitoreoTelefonico(monitoreo) === nombrePestana;
  });
}

function obtenerActoresActivos() {
  return ACTORES_ESTUDIO.filter(function(item) { return item.activo; }).map(function(item) { return item.actor; });
}

function obtenerBasesActivas() {
  const actores = crearSet(obtenerActoresActivos());
  return BASES_POR_ACTOR.filter(function(base) { return base.activo && actores[base.actor]; });
}

function obtenerVariablesControlActivas(actor) {
  const actores = crearSet(obtenerActoresActivos());
  return VARIABLES_CONTROL_ESTUDIO.filter(function(variable) {
    if (!variable.activo || !actores[variable.actor]) return false;
    return actor ? variable.actor === actor : true;
  });
}

function obtenerEncuestasActivas() {
  const actores = crearSet(obtenerActoresActivos());
  return ENCUESTAS_ESTUDIO.filter(function(encuesta) { return encuesta.activo && actores[encuesta.actor]; });
}

function obtenerAliasLlavesRespuestaActivos(actor) {
  const actores = crearSet(obtenerActoresActivos());
  return (ALIAS_LLAVES_RESPUESTA || []).filter(function(alias) {
    if (!alias.activo || !actores[alias.actor]) return false;
    return actor ? alias.actor === actor : true;
  });
}

function aliasTieneDestinoUniverso(alias) {
  if (!alias) return false;
  if (alias.codigoUniverso || alias.correoUniverso || alias.telefonoUniverso) return true;
  if (alias.campoUniverso && alias.valorUniverso !== undefined && alias.valorUniverso !== null && String(alias.valorUniverso).trim() !== "") return true;
  return !!(alias.llavesUniverso && alias.llavesUniverso.length);
}

function obtenerBasePorActor(actor) {
  return obtenerBasesActivas().filter(function(base) { return base.actor === actor; })[0] || null;
}

function crearSet(valores) {
  const set = {};
  valores.forEach(function(v) { set[v] = true; });
  return set;
}

function consultarRecopiladoresEncuesta(surveyId) {
  const recopiladores = consultarTodasLasPaginas("/surveys/" + encodeURIComponent(surveyId) + "/collectors", { per_page: 100 });
  const indice = {};
  recopiladores.forEach(function(recopilador) {
    const id = String(recopilador.id || "");
    if (!id) return;
    indice[id] = {
      nombre: recopilador.name || recopilador.title || ("Recopilador " + id),
      tipo: recopilador.type || recopilador.collection_mode || "",
    };
  });
  return indice;
}

function consultarTodasLasPaginas(ruta, parametros) {
  const resultados = [];
  let url = URL_BASE_SURVEYMONKEY + ruta + "?" + construirQuery(parametros || {});
  while (url) {
    const respuesta = traerJson(url);
    (respuesta.data || []).forEach(function(item) { resultados.push(item); });
    url = obtenerSiguienteUrl(respuesta);
  }
  return resultados;
}

function obtenerSiguienteUrl(respuesta) {
  const siguiente = respuesta.links && respuesta.links.next ? respuesta.links.next : "";
  if (!siguiente) return "";
  if (String(siguiente).indexOf("http") === 0) return siguiente;
  return URL_BASE_SURVEYMONKEY + siguiente;
}

function consultarSurveyMonkey(ruta, parametros) {
  const query = parametros ? "?" + construirQuery(parametros) : "";
  return traerJson(URL_BASE_SURVEYMONKEY + ruta + query);
}

function traerJson(url) {
  const respuesta = UrlFetchApp.fetch(url, {
    method: "get",
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + TOKEN_SURVEYMONKEY, Accept: "application/json" },
  });
  const codigo = respuesta.getResponseCode();
  const cuerpo = respuesta.getContentText();

  if (codigo === 429) {
    Utilities.sleep(3000);
    return traerJson(url);
  }
  if (codigo < 200 || codigo >= 300) throw new Error(construirMensajeError("SurveyMonkey API", codigo, cuerpo));
  return cuerpo ? JSON.parse(cuerpo) : {};
}

function construirMensajeError(origen, codigo, cuerpo) {
  try {
    const payload = JSON.parse(cuerpo);
    const error = payload.error || {};
    return origen + " " + codigo + " - " + (error.name || "Error") + ": " + (error.message || cuerpo);
  } catch (e) {
    return origen + " " + codigo + ": " + String(cuerpo).slice(0, 500);
  }
}

function construirQuery(parametros) {
  return Object.keys(parametros || {}).map(function(k) {
    return encodeURIComponent(k) + "=" + encodeURIComponent(parametros[k]);
  }).join("&");
}

function limpiarTituloPregunta(headings) {
  const texto = ((headings || [])[0] || {}).heading || "Pregunta sin titulo";
  return limpiarTexto(texto).slice(0, 180);
}

function limpiarTexto(texto) {
  return String(texto || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extraerCodPulso(respuesta) {
  const variables = obtenerCustomVariablesNormalizadas(respuesta);
  const posibles = ["id", "CodPulso", "codPulso", "cod_pulso", "codpulso", "codigo", "CodigoPulso", "CODPULSO"];
  for (let i = 0; i < posibles.length; i++) {
    const llave = normalizarClaveVariableSurveyMonkey(posibles[i]);
    if (variables[llave] && String(variables[llave].valor || "").trim()) return String(variables[llave].valor).trim();
  }
  const customValue = leerCampoObjeto(respuesta, "custom_value");
  return customValue ? String(customValue).trim() : "";
}

function obtenerCustomVariablesRespuesta(respuesta) {
  const valor = respuesta ? respuesta.custom_variables : {};
  if (!valor) return {};
  if (typeof valor === "string") {
    try {
      return JSON.parse(valor || "{}") || {};
    } catch (e) {
      return {};
    }
  }
  return valor;
}

function obtenerCustomVariablesNormalizadas(respuesta) {
  const salida = {};
  const variables = obtenerCustomVariablesRespuesta(respuesta);
  Object.keys(variables || {}).forEach(function(llaveOriginal) {
    const valor = variables[llaveOriginal];
    if (valor === undefined || valor === null || String(valor).trim() === "") return;
    const llave = normalizarClaveVariableSurveyMonkey(llaveOriginal);
    if (!salida[llave]) salida[llave] = { llaveOriginal: llaveOriginal, valor: valor };
  });
  return salida;
}

function normalizarClaveVariableSurveyMonkey(llave) {
  return normalizarCodigo(llave);
}

function describirLlaveOriginalSurveyMonkey(respuesta) {
  const partes = [];
  const variables = obtenerCustomVariablesRespuesta(respuesta);
  Object.keys(variables || {}).forEach(function(llave) {
    const valor = variables[llave];
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") partes.push(llave + "=" + String(valor).trim());
  });
  const customValue = leerCampoObjeto(respuesta, "custom_value");
  if (customValue) partes.push("custom_value=" + String(customValue).trim());
  return limpiarDuplicados(partes).join("; ");
}

function tieneLlaveIdentificadoraSurveyMonkey(respuesta) {
  if (leerCampoObjeto(respuesta, "custom_value")) return true;
  if (leerCampoObjeto(respuesta, "CodPulso")) return true;

  const variables = obtenerCustomVariablesNormalizadas(respuesta);
  return ["id", "CodPulso", "codPulso", "cod_pulso", "codpulso", "codigo", "CodigoPulso", "CODPULSO"].some(function(llave) {
    return !!variables[normalizarClaveVariableSurveyMonkey(llave)];
  });
}

function describirLlaveResueltaRespuesta(actor, respuesta) {
  const alias = obtenerAliasParaRespuesta(actor, respuesta);
  if (alias) return describirDestinoAlias(alias);
  const codPulso = extraerCodPulso(respuesta);
  return codPulso ? "codigo:" + normalizarCodigo(codPulso) : "";
}

function describirMetodoCruceRespuesta(actor, respuesta, codPulso) {
  if (obtenerAliasParaRespuesta(actor, respuesta)) return "Alias manual configurado";
  if (codPulso) return "Llave directa SurveyMonkey";
  return "";
}

function obtenerAliasParaRespuesta(actor, respuesta) {
  const valores = obtenerValoresLlaveRespuestaParaAlias(respuesta);
  if (!valores.length) return null;
  const valoresSet = crearSet(valores.map(normalizarCodigo));

  return obtenerAliasLlavesRespuestaActivos(actor).filter(function(alias) {
    return valoresSet[normalizarCodigo(alias.llaveRespuesta)];
  })[0] || null;
}

function obtenerValoresLlaveRespuestaParaAlias(respuesta) {
  const valores = [];
  const variables = obtenerCustomVariablesRespuesta(respuesta);
  Object.keys(variables || {}).forEach(function(llave) {
    const valor = variables[llave];
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") valores.push(String(valor).trim());
  });
  Object.keys(respuesta || {}).forEach(function(campo) {
    const nombre = normalizarTexto(campo);
    if (esCampoRespuestaIgnorado(nombre)) return;
    const valor = respuesta[campo];
    if (valor === undefined || valor === null || String(valor).trim() === "") return;
    if (!estaEnListaNormalizada(nombre, CAMPOS_LLAVE_RESPUESTA) && !esCampoCodigo(nombre)) return;
    String(valor).split(";").forEach(function(parte) {
      const limpio = parte.indexOf("=") >= 0 ? parte.split("=").pop() : parte;
      if (String(limpio || "").trim()) valores.push(String(limpio).trim());
    });
  });
  ["CodPulso", "custom_value", "Llave original SurveyMonkey"].forEach(function(campo) {
    const valor = leerCampoObjeto(respuesta, campo);
    if (!valor) return;
    String(valor).split(";").forEach(function(parte) {
      const limpio = parte.indexOf("=") >= 0 ? parte.split("=").pop() : parte;
      if (String(limpio || "").trim()) valores.push(String(limpio).trim());
    });
  });
  return limpiarDuplicados(valores.map(normalizarCodigo).filter(function(valor) { return !!valor; }));
}

function describirDestinoAlias(alias) {
  if (!alias) return "";
  const partes = [];
  if (alias.descripcion) partes.push(alias.descripcion);
  partes.push(llavesAliasConfiguradas(alias).join(", "));
  if (alias.campoUniverso) partes.push(alias.campoUniverso + "=" + alias.valorUniverso);
  return partes.filter(function(parte) { return String(parte || "").trim(); }).join(" / ");
}

function llavesAliasConfiguradas(alias) {
  const llaves = [];
  if (alias.codigoUniverso) agregarLlavesCodigo(llaves, alias.codigoUniverso);
  if (alias.correoUniverso) llaves.push("email:" + normalizarEmail(alias.correoUniverso));
  if (alias.telefonoUniverso) llaves.push("telefono:" + normalizarTelefono(alias.telefonoUniverso));
  (alias.llavesUniverso || []).forEach(function(llave) {
    const limpia = normalizarLlaveUniversoConfigurada(llave);
    if (limpia) llaves.push(limpia);
  });
  return limpiarDuplicados(llaves);
}

function normalizarLlaveUniversoConfigurada(llave) {
  const partes = String(llave || "").split(":");
  if (partes.length < 2) return "";
  const tipo = normalizarTexto(partes.shift());
  const valor = partes.join(":");
  if (tipo === "email" || tipo === "correo") return "email:" + normalizarEmail(valor);
  if (tipo === "telefono" || tipo === "celular") return "telefono:" + normalizarTelefono(valor);
  if (tipo === "codigo" || tipo === "codpulso" || tipo === "id") return "codigo:" + normalizarCodigo(valor);
  if (tipo === "nombre") return "nombre:" + normalizarTexto(valor);
  return "";
}

function normalizarEstado(estado) {
  return String(estado || "").trim().toLowerCase();
}

function esEstadoCompleto(estado) {
  return ["completed", "complete", "completa", "completado"].indexOf(normalizarEstado(estado)) >= 0;
}

function esEstadoParcial(estado) {
  return ["partial", "parcial", "incomplete", "sin completar"].indexOf(normalizarEstado(estado)) >= 0;
}

function aBooleano(valor) {
  if (valor === true) return true;
  return ["true", "verdadero", "si", "yes", "1"].indexOf(String(valor || "").trim().toLowerCase()) >= 0;
}

function maxFechaIso(a, b) {
  if (!a) return b || "";
  if (!b) return a || "";
  return String(a) > String(b) ? a : b;
}

function formatearFechaHoraReporte(valor) {
  if (!valor) return "";
  const fecha = new Date(valor);
  if (isNaN(fecha.getTime())) return valor;
  return Utilities.formatDate(fecha, Session.getScriptTimeZone() || "America/Lima", "dd/MM/yyyy HH:mm");
}

function abrirLibro(urlOId) {
  return SpreadsheetApp.openById(extraerIdSpreadsheet(urlOId));
}

function extraerIdSpreadsheet(urlOId) {
  const texto = String(urlOId || "").trim();
  const match = texto.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : texto;
}

function normalizarTexto(texto) {
  return String(texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function normalizarEmail(valor) {
  return String(valor || "").trim().toLowerCase();
}

function normalizarTelefono(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function normalizarCodigo(valor) {
  return String(valor || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function agregarLlavesCodigo(llaves, valor) {
  const codigo = normalizarCodigo(valor);
  if (!codigo) return;
  llaves.push("codigo:" + codigo);
  const sinCeros = codigo.replace(/^0+/, "");
  if (sinCeros && sinCeros !== codigo) llaves.push("codigo:" + sinCeros);
}

function limpiarDuplicados(valores) {
  const vistos = {};
  return valores.filter(function(v) {
    if (vistos[v]) return false;
    vistos[v] = true;
    return true;
  });
}
