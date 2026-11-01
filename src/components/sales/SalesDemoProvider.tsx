"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  canTransitionSalesStatus,
  createSalesOrder,
  getInitialSalesOrders,
  isSalesOrder,
  SALES_DEMO_STORAGE_KEY,
  type SalesOrder,
  type SalesOrderInput,
  type SalesStatus,
} from "@/lib/sales-demo";

type SalesDemoState = {
  orders: SalesOrder[];
  ready: boolean;
  error: string;
};

type SalesDemoContextValue = SalesDemoState & {
  addOrder: (input: SalesOrderInput) => SalesOrder;
  updateStatus: (id: string, status: SalesStatus) => void;
};

const SalesDemoContext = createContext<SalesDemoContextValue | null>(null);
const serverState: SalesDemoState = {
  orders: getInitialSalesOrders(),
  ready: true,
  error: "",
};
let state = serverState;
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function saveOrders(orders: SalesOrder[]) {
  try {
    window.localStorage.setItem(SALES_DEMO_STORAGE_KEY, JSON.stringify(orders));
  } catch {
    throw new Error("تعذّر حفظ بيانات العرض في هذا المتصفح.");
  }
}

function loadState() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;

  try {
    const saved = window.localStorage.getItem(SALES_DEMO_STORAGE_KEY);
    if (saved === null) {
      saveOrders(serverState.orders);
      state = serverState;
      return;
    }

    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed) || !parsed.every(isSalesOrder)) {
      state = {
        orders: [],
        ready: true,
        error: "تعذّرت قراءة بيانات الطلبات المحفوظة. لم يتم تغييرها.",
      };
      return;
    }
    state = { orders: parsed, ready: true, error: "" };
  } catch {
    state = {
      orders: [],
      ready: true,
      error: "تعذّر الوصول إلى التخزين المحلي لهذا المتصفح.",
    };
  }
}

function getSnapshot() {
  loadState();
  return state;
}

function getServerSnapshot() {
  return serverState;
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  function syncFromOtherTab(event: StorageEvent) {
    if (event.key !== SALES_DEMO_STORAGE_KEY || event.newValue === null) return;
    try {
      const parsed: unknown = JSON.parse(event.newValue);
      if (!Array.isArray(parsed) || !parsed.every(isSalesOrder)) {
        state = { ...state, error: "بيانات الطلبات المحدثة في تبويب آخر غير صالحة." };
      } else {
        state = { orders: parsed, ready: true, error: "" };
      }
    } catch {
      state = { ...state, error: "تعذّرت مزامنة بيانات الطلبات من تبويب آخر." };
    }
    notify();
  }

  window.addEventListener("storage", syncFromOtherTab);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", syncFromOtherTab);
  };
}

function addOrder(input: SalesOrderInput) {
  const current = getSnapshot();
  if (current.error) throw new Error(current.error);
  const order = createSalesOrder(input, current.orders);
  const updatedOrders = [order, ...current.orders];
  saveOrders(updatedOrders);
  state = { orders: updatedOrders, ready: true, error: "" };
  notify();
  return order;
}

function updateStatus(id: string, status: SalesStatus) {
  const current = getSnapshot();
  if (current.error) throw new Error(current.error);
  const order = current.orders.find((candidate) => candidate.id === id);
  if (!order) throw new Error("طلب العميل غير موجود في بيانات العرض.");
  if (!canTransitionSalesStatus(order.status, status)) {
    throw new Error("لا يمكن الانتقال إلى حالة العرض المطلوبة.");
  }

  const updatedOrders = current.orders.map((candidate) =>
    candidate.id === id ? { ...candidate, status } : candidate,
  );
  saveOrders(updatedOrders);
  state = { orders: updatedOrders, ready: true, error: "" };
  notify();
}

export function SalesDemoProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const value = useMemo(
    () => ({ ...snapshot, addOrder, updateStatus }),
    [snapshot],
  );

  return (
    <SalesDemoContext.Provider value={value}>
      {children}
    </SalesDemoContext.Provider>
  );
}

export function useSalesDemo() {
  const context = useContext(SalesDemoContext);
  if (!context) {
    throw new Error("useSalesDemo must be used within SalesDemoProvider.");
  }
  return context;
}
