// Estado de la matriz de equivalencias (ADR 0062, ADR 0104): la declaración
// guardada, el catálogo de preguntas por base y la matriz en edición. Movido
// tal cual desde `EquivalenciasPanel`, que ahora solo compone la mesa; las
// reglas de fusión (armonización, compuesto, segmentos) no cambian.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getEquivalencias,
  getVariablesEquivalencias,
  guardarEquivalencias,
  type EquivalenciaFila,
  type EquivalenciasEstado,
  type EquivalenciasImportacion,
  type ImportacionBloques,
  type VariableDeBase,
} from "../../../../api/equivalencias";
import {
  aFilasEditor,
  asignarPregunta,
  confirmarFila,
  editarCampo,
  filaVacia,
  filasParaGuardar,
  ordenarBasesPorSerie,
  quitarFila,
  type FilaEditor,
} from "../../equivalenciasEditorModel";
import { fusionarCompuestoGuardado } from "../../indicadorCompuestoModel";
import { EVENTO_SEGMENTOS } from "../../panelesCarga";
import { etiquetaDePregunta } from "../../preguntaEquivalenteModel";
import { fusionarFilasCruce, searchConSegmentos } from "../../segmentos/segmentosModel";
import { EVENTO_VARIABLES_BASE } from "../../variablesBase/variablesBaseModel";

const SIN_FILAS: readonly EquivalenciaFila[] = [];

function resumenAplicacion(imp: EquivalenciasImportacion): { aplicadas: number; conservadas: number } {
  return Object.values(imp.aplicacion ?? {}).reduce(
    (acc, base) => ({
      aplicadas: acc.aplicadas + (base.aplicadas ?? 0),
      conservadas: acc.conservadas + (base.conservadas ?? 0),
    }),
    { aplicadas: 0, conservadas: 0 },
  );
}

export type EstadoDeGuardado = "saving" | "dirty" | "saved" | "idle";

export function useMatrizDeEquivalencias(onDeclaradas?: (n: number | "error") => void) {
  const [estado, setEstado] = useState<EquivalenciasEstado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState<"" | "guardar">("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [filas, setFilas] = useState<FilaEditor[]>([]);
  const [variablesPorBase, setVariablesPorBase] = useState<Record<string, VariableDeBase[]>>({});
  const [sucio, setSucio] = useState(false);
  // M14: "Guardado" solo justo después de guardar desde aquí; al editar vuelve a
  // "Cambios sin guardar" y al recargar, a "Sin cambios".
  const [guardadoAhora, setGuardadoAhora] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  // ADR 0107: la fila de un segmento se edita en su panel, no como fila suelta.
  const abrirSegmento = useCallback(
    (clave: string) =>
      navigate({ pathname: location.pathname, search: searchConSegmentos(location.search, clave || null) }, { replace: true }),
    [location.pathname, location.search, navigate],
  );

  const editar = useCallback((cambio: (p: FilaEditor[]) => FilaEditor[]) => {
    setFilas(cambio);
    setSucio(true);
    setGuardadoAhora(false);
  }, []);

  // ADR 0105: el indicador compuesto se guarda desde su panel, sobre la
  // declaración guardada. Con cambios pendientes, solo entra esa fila.
  const onCompuestoGuardado = useCallback(
    (out: EquivalenciasImportacion, indice: number, mensaje: string) => {
      setEstado(out.estado);
      const guardadas = out.estado.filas ?? [];
      setFilas((prev) => (sucio ? fusionarCompuestoGuardado(prev, guardadas, indice) : aFilasEditor(guardadas)));
      onDeclaradas?.(out.estado.n_filas ?? 0);
      setError("");
      setAviso(mensaje);
    },
    [onDeclaradas, sucio],
  );

  // Guardar una armonización (o el orden de la serie) reescribe la declaración
  // del servidor con sus filas tal como estaban guardadas. Si el editor tiene
  // cambios pendientes en otras filas no se pisan: solo se trae la armonización
  // de cada fila guardada, por su posición.
  const onArmonizacionGuardada = useCallback(
    (out: EquivalenciasImportacion, mensaje: string) => {
      setEstado(out.estado);
      const guardadas = out.estado.filas ?? [];
      if (!sucio) {
        setFilas(aFilasEditor(guardadas));
      } else {
        setFilas((prev) =>
          prev.map((f) => {
            if (typeof f.indice_declarado !== "number") return f;
            const arm = guardadas[f.indice_declarado]?.armonizacion;
            const { armonizacion: _previa, ...resto } = f;
            return arm ? { ...resto, armonizacion: arm } : resto;
          }),
        );
      }
      onDeclaradas?.(out.estado.n_filas ?? 0);
      setError("");
      setAviso(mensaje);
    },
    [onDeclaradas, sucio],
  );

  const onBloquesAplicados = useCallback(
    (res: ImportacionBloques) => {
      if (!res.estado) return;
      setEstado(res.estado);
      setFilas(aFilasEditor(res.estado.filas ?? []));
      setSucio(false);
      onDeclaradas?.(res.estado.n_filas ?? 0);
      setError("");
      const r = res.resumen;
      setAviso(
        `Serie de mediciones aplicada: ${r.nuevas} filas nuevas y ${r.actualizadas} actualizadas`
          + (r.n_con_armonizacion ? `, ${r.n_con_armonizacion} con armonización.` : "."),
      );
    },
    [onDeclaradas],
  );

  const refrescar = useCallback(async () => {
    setCargando(true);
    try {
      const est = await getEquivalencias();
      setEstado(est);
      setFilas(aFilasEditor(est.filas ?? []));
      onDeclaradas?.(est.n_filas ?? 0);
      setSucio(false);
      if (est.disponible) {
        // El catálogo va aparte del estado: son cientos de entradas y el estado
        // se pide en cada montaje.
        const cat = await getVariablesEquivalencias();
        setVariablesPorBase(cat.variables ?? {});
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      onDeclaradas?.("error");
    } finally {
      setCargando(false);
    }
  }, [onDeclaradas]);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  // ADR 0106: una columna incorporada o una variable calculada entra al catálogo
  // de su base. Solo se relee el catálogo: la matriz en edición no se toca.
  const disponible = Boolean(estado?.disponible);
  useEffect(() => {
    if (!disponible) return undefined;
    const releer = () => {
      getVariablesEquivalencias()
        .then((cat) => setVariablesPorBase(cat.variables ?? {}))
        // Si falla, el catálogo anterior sigue sirviendo; la próxima lectura completa lo trae.
        .catch(() => undefined);
    };
    window.addEventListener(EVENTO_VARIABLES_BASE, releer);
    return () => window.removeEventListener(EVENTO_VARIABLES_BASE, releer);
  }, [disponible]);

  // ADR 0107: guardar o quitar un segmento reescribe su fila `SEG-*`. Se relee
  // sin esqueleto y solo cambian las filas de cruce.
  const filasGuardadas = useRef<readonly EquivalenciaFila[]>(SIN_FILAS);
  filasGuardadas.current = estado?.filas ?? SIN_FILAS;
  useEffect(() => {
    if (!disponible) return undefined;
    const releer = () => {
      getEquivalencias()
        .then((est) => {
          const antes = filasGuardadas.current;
          setEstado(est);
          setFilas((prev) => fusionarFilasCruce(prev, antes, est.filas ?? []));
          onDeclaradas?.(est.n_filas ?? 0);
        })
        // Si falla, la próxima lectura completa trae la fila.
        .catch(() => undefined);
    };
    window.addEventListener(EVENTO_SEGMENTOS, releer);
    return () => window.removeEventListener(EVENTO_SEGMENTOS, releer);
  }, [disponible, onDeclaradas]);

  /** Guarda la matriz; devuelve las filas nuevas (con identidad nueva) o `null` si falló. */
  const onGuardar = useCallback(async (): Promise<FilaEditor[] | null> => {
    setOcupado("guardar");
    setError("");
    try {
      const out = await guardarEquivalencias(filasParaGuardar(filas));
      const nuevas = aFilasEditor(out.estado.filas ?? []);
      setEstado(out.estado);
      setFilas(nuevas);
      setSucio(false);
      setGuardadoAhora(true);
      onDeclaradas?.(out.estado.n_filas ?? 0);
      const { aplicadas, conservadas } = resumenAplicacion(out);
      setAviso(conservadas > 0
        ? `Guardado. ${aplicadas} etiquetas aplicadas, ${conservadas} conservadas por estar editadas a mano.`
        : `Guardado. ${aplicadas} etiquetas aplicadas.`);
      return nuevas;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setOcupado("");
    }
  }, [filas, onDeclaradas]);

  // G1: "Añadir a la matriz" desde el mapa de bases es el mismo "Añadir pregunta
  // equivalente", con la pregunta de esa base ya elegida. Queda sin guardar.
  const onAnadirDesdeMapa = useCallback(
    (base: string, variable: string): string => {
      const nueva = filaVacia();
      const etiqueta = etiquetaDePregunta(variablesPorBase[base] ?? [], variable);
      editar((p) => asignarPregunta([...p, nueva], nueva.id, base, variable, etiqueta === variable ? "" : etiqueta));
      setError("");
      setAviso(`Se añadió "${etiqueta}" a la matriz. Elige su pregunta en las otras bases y guarda.`);
      return nueva.id;
    },
    [editar, variablesPorBase],
  );

  /** Añade una fila vacía y devuelve su id, para elegirla en el inspector. */
  const onAgregarFila = useCallback((): string => {
    const nueva = filaVacia();
    editar((p) => [...p, nueva]);
    return nueva.id;
  }, [editar]);

  // Al elegir una pregunta, la fila sin nombre toma su etiqueta (ADR 0104).
  const onAsignar = useCallback(
    (id: string, base: string, v: string) => {
      const etiqueta = v ? etiquetaDePregunta(variablesPorBase[base] ?? [], v) : "";
      editar((p) => asignarPregunta(p, id, base, v, etiqueta === v ? "" : etiqueta));
    },
    [editar, variablesPorBase],
  );

  const onEditarNombre = useCallback(
    (id: string, valor: string) => editar((p) => editarCampo(p, id, "etiqueta_estandar", valor)),
    [editar],
  );
  const onQuitar = useCallback((id: string) => editar((p) => quitarFila(p, id)), [editar]);
  const onConfirmar = useCallback((id: string) => editar((p) => confirmarFila(p, id)), [editar]);

  // Las columnas siguen la serie declarada (2024, 2025, 2026), no el orden en
  // que se cargaron las bases.
  const bases = ordenarBasesPorSerie(estado?.bases ?? [], estado?.armonizacion_periodos);
  // Antes de guardar la primera fila el estado aún no trae las bases: la tabla
  // las toma del catálogo de variables.
  const basesDeTabla = bases.length ? bases : Object.keys(variablesPorBase);
  const clavesBasesDeTabla = basesDeTabla.join("|");
  const basesDeSerie = useMemo(
    () => ordenarBasesPorSerie(clavesBasesDeTabla ? clavesBasesDeTabla.split("|") : [], estado?.armonizacion_periodos),
    [clavesBasesDeTabla, estado?.armonizacion_periodos],
  );

  const guardado: EstadoDeGuardado = ocupado === "guardar" ? "saving" : sucio ? "dirty" : guardadoAhora ? "saved" : "idle";

  return {
    estado,
    cargando,
    ocupado,
    error,
    aviso,
    filas,
    filasGuardadas: estado?.filas ?? SIN_FILAS,
    variablesPorBase,
    sucio,
    guardado,
    bases,
    basesDeTabla,
    basesDeSerie,
    abrirSegmento,
    onCompuestoGuardado,
    onArmonizacionGuardada,
    onBloquesAplicados,
    onGuardar,
    onAnadirDesdeMapa,
    onAgregarFila,
    onAsignar,
    onEditarNombre,
    onQuitar,
    onConfirmar,
  };
}

export type MatrizDeEquivalencias = ReturnType<typeof useMatrizDeEquivalencias>;
