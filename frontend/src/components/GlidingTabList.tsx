import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
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

export type GlidingRovingItemLike = GlidingItemLike & {
  disabled?: boolean;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  tagName?: string;
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

function isDisabledGlidingItem(item: GlidingRovingItemLike): boolean {
  return Boolean(item.disabled)
    || item.hasAttribute("disabled")
    || item.getAttribute("aria-disabled") === "true";
}

function isRovingGlidingItem(item: GlidingRovingItemLike): boolean {
  const role = item.getAttribute("role");
  return Boolean(item.dataset.glidingKey)
    && !item.hidden
    && !isDisabledGlidingItem(item)
    && (role === "tab" || role === "button" || item.tagName?.toLowerCase() === "button");
}

export function glidingNavigationDelta(
  key: string,
  orientation: GlidingTabOrientation,
): -1 | 0 | 1 | "first" | "last" {
  if (key === "Home") return "first";
  if (key === "End") return "last";
  if (orientation === "vertical") {
    if (key === "ArrowDown") return 1;
    if (key === "ArrowUp") return -1;
    return 0;
  }
  if (key === "ArrowRight") return 1;
  if (key === "ArrowLeft") return -1;
  return 0;
}

export function findNextRovingGlidingItem<T extends GlidingRovingItemLike>(
  items: Iterable<T>,
  activeItem: T | null,
  delta: -1 | 0 | 1 | "first" | "last",
): T | null {
  if (delta === 0) return null;
  const enabledItems = Array.from(items).filter(isRovingGlidingItem);
  if (!enabledItems.length) return null;
  if (delta === "first") return enabledItems[0];
  if (delta === "last") return enabledItems[enabledItems.length - 1];

  const activeIndex = activeItem ? enabledItems.indexOf(activeItem) : -1;
  const startIndex = activeIndex >= 0 ? activeIndex : delta > 0 ? -1 : 0;
  return enabledItems[(startIndex + delta + enabledItems.length) % enabledItems.length];
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
      onKeyDown,
      ...rootProps
    },
    forwardedRef,
  ) {
    const rootRef = useRef<HTMLElement | null>(null);
    const hasMeasuredRef = useRef(false);
    const motionReadyRef = useRef(false);
    const rovingFocusKeyRef = useRef<string | null>(null);
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

    const findRovingItems = () => {
      const root = rootRef.current;
      if (!root || rootProps.role !== "tablist") return [];
      try {
        return Array.from(root.querySelectorAll<HTMLElement>(itemSelector));
      } catch {
        return [];
      }
    };

    useEffect(() => {
      rovingFocusKeyRef.current = null;
    }, [activeKey]);

    useBrowserLayoutEffect(() => {
      const items = findRovingItems();
      const activeItem = findActiveGlidingItem(items, activeKey);
      const rovingFocusItem = findActiveGlidingItem(items, rovingFocusKeyRef.current);
      const fallbackItem = findNextRovingGlidingItem(items, null, "first");
      const tabbableItem = rovingFocusItem && isRovingGlidingItem(rovingFocusItem)
        ? rovingFocusItem
        : activeItem && isRovingGlidingItem(activeItem)
          ? activeItem
          : fallbackItem;
      for (const item of items) {
        item.tabIndex = item === tabbableItem ? 0 : -1;
      }
    });

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || rootProps.role !== "tablist") return;

      const delta = glidingNavigationDelta(event.key, orientation);
      if (delta === 0) return;

      const root = rootRef.current;
      const items = findRovingItems();
      if (!root || !items.length) return;

      const activeElement = document.activeElement;
      const focusedItem = activeElement instanceof HTMLElement && root.contains(activeElement)
        ? items.find((item) => item === activeElement) ?? null
        : null;
      const activeItem = focusedItem ?? findActiveGlidingItem(items, activeKey);
      const nextItem = findNextRovingGlidingItem(items, activeItem, delta);
      if (!nextItem) return;

      event.preventDefault();
      for (const item of items) {
        item.tabIndex = item === nextItem ? 0 : -1;
      }
      rovingFocusKeyRef.current = nextItem.dataset.glidingKey ?? null;
      nextItem.focus({ preventScroll: true });
    };

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
        onKeyDown={handleKeyDown}
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
