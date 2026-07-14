import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type MutableRefObject,
  type ReactNode,
  type Ref,
} from "react";

export type GlidingTabOrientation = "horizontal" | "vertical";

export type GlidingIndicatorGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type RectLike = Pick<DOMRect, "left" | "top" | "width" | "height">;

export function computeGlidingIndicatorGeometry(
  rootRect: RectLike,
  itemRect: RectLike,
  rootMetrics: Pick<HTMLElement, "scrollLeft" | "scrollTop" | "clientLeft" | "clientTop">,
): GlidingIndicatorGeometry {
  return {
    x: itemRect.left - rootRect.left + rootMetrics.scrollLeft - rootMetrics.clientLeft,
    y: itemRect.top - rootRect.top + rootMetrics.scrollTop - rootMetrics.clientTop,
    width: itemRect.width,
    height: itemRect.height,
  };
}

export type GlidingTabListProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  as?: "div" | "nav";
  activeKey: string | number | null | undefined;
  orientation?: GlidingTabOrientation;
  itemSelector?: string;
  indicatorClassName?: string;
  children: ReactNode;
};

type IndicatorStyle = CSSProperties & {
  "--pulso-glide-x": string;
  "--pulso-glide-y": string;
  "--pulso-glide-width": string;
  "--pulso-glide-height": string;
  "--pulso-gliding-indicator-radius": string;
};

const DEFAULT_ITEM_SELECTOR = "[data-gliding-key]";
const ZERO_GEOMETRY: GlidingIndicatorGeometry = { x: 0, y: 0, width: 0, height: 0 };
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type GlidingItemLike = {
  dataset: { glidingKey?: string };
  hidden: boolean;
};

export function findActiveGlidingItem<T extends GlidingItemLike>(
  items: Iterable<T>,
  activeKey: string | number | null | undefined,
): T | null {
  if (activeKey === null || activeKey === undefined) return null;
  const serializedKey = String(activeKey);
  return Array.from(items).find(
    (item) => item.dataset.glidingKey === serializedKey && !item.hidden,
  ) ?? null;
}

function setForwardedRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    (ref as MutableRefObject<T | null>).current = value;
  }
}

function geometryEquals(a: GlidingIndicatorGeometry, b: GlidingIndicatorGeometry) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export const GlidingTabList = forwardRef<HTMLElement, GlidingTabListProps>(
  function GlidingTabList(
    {
      as: Element = "div",
      activeKey,
      orientation = "horizontal",
      itemSelector = DEFAULT_ITEM_SELECTOR,
      indicatorClassName,
      className,
      children,
      ...rootProps
    },
    forwardedRef,
  ) {
    const rootRef = useRef<HTMLElement | null>(null);
    const hasMeasuredRef = useRef(false);
    const motionReadyRef = useRef(false);
    const [geometry, setGeometry] = useState(ZERO_GEOMETRY);
    const [indicatorRadius, setIndicatorRadius] = useState("0px");
    const [visible, setVisible] = useState(false);
    const [canAnimate, setCanAnimate] = useState(false);

    const assignRootRef = (node: HTMLElement | null) => {
      rootRef.current = node;
      setForwardedRef(forwardedRef, node);
    };

    useBrowserLayoutEffect(() => {
      const root = rootRef.current;
      if (!root) return;

      let measureFrame = 0;
      let enableMotionFrame = 0;

      const findActiveItem = () => {
        let items: NodeListOf<HTMLElement>;
        try {
          items = root.querySelectorAll<HTMLElement>(itemSelector);
        } catch {
          return null;
        }
        return findActiveGlidingItem(items, activeKey);
      };

      const measure = () => {
        measureFrame = 0;
        const activeItem = findActiveItem();
        if (!activeItem) {
          setVisible(false);
          return;
        }

        const nextGeometry = computeGlidingIndicatorGeometry(
          root.getBoundingClientRect(),
          activeItem.getBoundingClientRect(),
          root,
        );
        const nextRadius = getComputedStyle(activeItem).borderRadius || "0px";
        setGeometry((current) => geometryEquals(current, nextGeometry) ? current : nextGeometry);
        setIndicatorRadius((current) => current === nextRadius ? current : nextRadius);
        setVisible(true);

        if (!hasMeasuredRef.current) {
          hasMeasuredRef.current = true;
          enableMotionFrame = window.requestAnimationFrame(() => {
            motionReadyRef.current = true;
            setCanAnimate(true);
          });
        }
      };

      const scheduleMeasure = () => {
        if (measureFrame) window.cancelAnimationFrame(measureFrame);
        measureFrame = window.requestAnimationFrame(measure);
      };

      const resizeObserver = typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleMeasure);

      const observeSizedElements = () => {
        if (!resizeObserver) return;
        resizeObserver.disconnect();
        resizeObserver.observe(root);
        try {
          root.querySelectorAll<HTMLElement>(itemSelector).forEach((item) => resizeObserver.observe(item));
        } catch {
          // An invalid consumer selector simply leaves the indicator hidden.
        }
      };

      const mutationObserver = typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            observeSizedElements();
            scheduleMeasure();
          });

      observeSizedElements();
      mutationObserver?.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["data-gliding-key", "hidden", "disabled"],
      });
      window.addEventListener("resize", scheduleMeasure);
      measure();

      return () => {
        if (measureFrame) window.cancelAnimationFrame(measureFrame);
        if (enableMotionFrame && !motionReadyRef.current) {
          window.cancelAnimationFrame(enableMotionFrame);
          hasMeasuredRef.current = false;
        }
        resizeObserver?.disconnect();
        mutationObserver?.disconnect();
        window.removeEventListener("resize", scheduleMeasure);
      };
    }, [activeKey, itemSelector]);

    const indicatorStyle: IndicatorStyle = {
      "--pulso-glide-x": `${geometry.x}px`,
      "--pulso-glide-y": `${geometry.y}px`,
      "--pulso-glide-width": `${geometry.width}px`,
      "--pulso-glide-height": `${geometry.height}px`,
      "--pulso-gliding-indicator-radius": indicatorRadius,
    };
    const indicatorClasses = [
      "pulso-gliding-tab-indicator",
      visible ? "is-visible" : "",
      canAnimate ? "is-motion-ready" : "",
      indicatorClassName,
    ].filter(Boolean).join(" ");

    return (
      <Element
        {...rootProps}
        ref={assignRootRef}
        className={["pulso-gliding-tab-list", className].filter(Boolean).join(" ")}
        data-gliding-orientation={orientation}
        aria-orientation={rootProps.role === "tablist" ? orientation : undefined}
      >
        <span
          className={indicatorClasses}
          style={indicatorStyle}
          aria-hidden="true"
        />
        {children}
      </Element>
    );
  },
);

GlidingTabList.displayName = "GlidingTabList";
