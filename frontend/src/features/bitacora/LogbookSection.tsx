import { useCallback, useEffect, useMemo, useState } from "react";

import {
  apiBitacoraEntradaArchivar,
  apiBitacoraEntradaBorrar,
  apiBitacoraEntradasExportar,
  apiBitacoraEstado,
  apiBitacoraPreferencias,
  type BitacoraEstado,
  type BitacoraPreferencias,
} from "../../api/bitacora";
import { apiBitacoraUpsert, type DisenoEstudioBitacoraEntry } from "../../api/client";
import { Alert } from "../../components/Alert";
import { LoadingBlock } from "../../components/States";
import { toast } from "../../components/toasterStore";
import { EntradaRapida } from "./logbook/EntradaRapida";
import { FiltrosBitacora, type FiltroBitacora } from "./logbook/FiltrosBitacora";
import { TimelinePorDia } from "./logbook/TimelinePorDia";
import "./logbook/logbook.css";

/**
 * Sección Bitácora (ADR 0047).
 *
 * Orquestador: la entrada rápida, los filtros y la timeline son componentes
 * propios. Antes esta sección era un formulario de cuatro campos más una lista
 * plana; el formulario era justamente lo que hacía que nadie registrara nada.
 */
export function LogbookSection({
  entries,
  onChange,
}: {
  entries: DisenoEstudioBitacoraEntry[];
  onChange: (entradas: DisenoEstudioBitacoraEntry[]) => void;
}) {
  const [estado, setEstado] = useState<BitacoraEstado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [porBorrar, setPorBorrar] = useState<DisenoEstudioBitacoraEntry | null>(null);

  const cargar = useCallback(async () => {
    try {
      const siguiente = await apiBitacoraEstado();
      setEstado(siguiente);
      onChange(siguiente.bitacora);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir la bitácora.");
    } finally {
      setCargando(false);
    }
  }, [onChange]);

  useEffect(() => {
    void cargar();
    // Solo al montar: las recargas posteriores las disparan las mutaciones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtro: FiltroBitacora = estado?.preferencias.bitacora ?? {
    tonos: [], modulos: [], etiquetas: [], texto: "", mostrar_archivadas: false,
  };

  const visibles = useMemo(
    () => filtrarLocal(estado?.bitacora ?? entries, filtro),
    [estado?.bitacora, entries, filtro],
  );

  async function guardarFiltro(parche: Partial<FiltroBitacora>) {
    const siguiente = { ...filtro, ...parche };
    // Optimista: el filtro se siente instantáneo y el guardado va detrás.
    setEstado((prev) =>
      prev ? { ...prev, preferencias: { ...prev.preferencias, bitacora: siguiente } } : prev,
    );
    try {
      setEstado(await apiBitacoraPreferencias({ bitacora: siguiente } as Partial<BitacoraPreferencias>));
    } catch {
      toast.error("El filtro no se pudo guardar en el proyecto");
    }
  }

  async function mutar(fn: () => Promise<BitacoraEstado>, exito?: string) {
    try {
      const siguiente = await fn();
      setEstado(siguiente);
      onChange(siguiente.bitacora);
      if (exito) toast.exito(exito);
    } catch (err) {
      toast.error("No se pudo completar la acción", {
        detalle: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function exportar() {
    setExportando(true);
    try {
      const res = await apiBitacoraEntradasExportar(filtro);
      descargar(res.markdown, `bitacora-${new Date().toISOString().slice(0, 10)}.md`);
      toast.exito(`${res.total} ${res.total === 1 ? "entrada exportada" : "entradas exportadas"}`);
    } catch (err) {
      toast.error("No se pudo exportar la bitácora", {
        detalle: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setExportando(false);
    }
  }

  if (cargando && !estado) return <LoadingBlock label="Abriendo la bitácora..." />;

  return (
    <div className="bit-logbook">
      {error && <Alert kind="error">{error}</Alert>}

      <EntradaRapida
        onGuardada={(siguientes) => {
          onChange(siguientes);
          void cargar();
        }}
      />

      <FiltrosBitacora
        filtro={filtro}
        total={estado?.bitacora.length ?? entries.length}
        visibles={visibles.length}
        exportando={exportando}
        onCambio={(parche) => void guardarFiltro(parche)}
        onExportar={() => void exportar()}
      />

      <TimelinePorDia
        entradas={visibles}
        onEditar={(entrada) => {
          // Editar reusa el alta: el backend detecta el id existente y empuja la
          // versión anterior al historial.
          const titulo = window.prompt("Título de la entrada", entrada.title);
          if (titulo === null) return;
          const cuerpo = window.prompt("Detalle", entrada.body);
          if (cuerpo === null) return;
          void mutar(async () => {
            await apiBitacoraUpsert({ ...entrada, title: titulo, body: cuerpo });
            return apiBitacoraEstado();
          }, "Entrada actualizada");
        }}
        onArchivar={(entrada) =>
          void mutar(
            () => apiBitacoraEntradaArchivar(entrada.id, !entrada.archived_at),
            entrada.archived_at ? "Entrada restaurada" : "Entrada archivada",
          )
        }
        onPurgar={(entrada) => setPorBorrar(entrada)}
      />

      {porBorrar && (
        <div className="bit-confirmar" role="alertdialog" aria-label="Confirmar borrado">
          <div>
            <strong>Borrar «{porBorrar.title}» para siempre</strong>
            {/* Archivar es la salida normal y se ofrece acá mismo: borrar una
                entrada destruye el registro y su historial de ediciones. */}
            <p>No se puede deshacer. Si solo quieres sacarla de la vista, archívala.</p>
          </div>
          <div className="bit-confirmar-acciones">
            <button type="button" className="bit-boton" onClick={() => setPorBorrar(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="bit-boton"
              onClick={() => {
                void mutar(() => apiBitacoraEntradaArchivar(porBorrar.id, true), "Entrada archivada");
                setPorBorrar(null);
              }}
            >
              Archivar
            </button>
            <button
              type="button"
              className="bit-boton bit-boton--peligro"
              onClick={() => {
                void mutar(() => apiBitacoraEntradaBorrar(porBorrar.id), "Entrada borrada");
                setPorBorrar(null);
              }}
            >
              Borrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Filtro local para que la vista responda sin esperar al servidor.
 *
 * Es un espejo del filtro de `bitacora_entradas.R` y solo se usa para PINTAR.
 * La exportación pide el filtro al servidor, así que el archivo nunca depende
 * de esta copia.
 */
function filtrarLocal(
  entradas: DisenoEstudioBitacoraEntry[],
  filtro: FiltroBitacora,
): DisenoEstudioBitacoraEntry[] {
  const texto = sinAcentos(filtro.texto);
  return entradas.filter((e) => {
    if (!filtro.mostrar_archivadas && e.archived_at) return false;
    if (filtro.tonos.length && !filtro.tonos.includes(e.tone)) return false;
    if (filtro.modulos.length && !filtro.modulos.includes(e.module_id)) return false;
    if (filtro.etiquetas.length && !filtro.etiquetas.some((t) => e.tags.includes(t))) return false;
    if (texto) {
      const heno = `${sinAcentos(e.title)} ${sinAcentos(e.body)}`;
      if (!heno.includes(texto)) return false;
    }
    return true;
  });
}

function sinAcentos(v: string): string {
  return (v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function descargar(contenido: string, nombre: string): void {
  const blob = new Blob([contenido], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
