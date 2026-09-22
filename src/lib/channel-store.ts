import { create } from "zustand";
import {
  ChannelId, Product, parseCsv, SAMPLE_CSV, autoFix, reportFor, ProductReport,
} from "./channels";

type ChannelState = {
  products: Product[];
  selected: ChannelId[];
  importedAt: string | null;
  setSelected: (ids: ChannelId[]) => void;
  toggleChannel: (id: ChannelId) => void;
  importCsv: (text: string) => number;
  loadSample: () => number;
  clear: () => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  fixOne: (id: string) => string[];
  fixAll: () => number;
  reports: () => ProductReport[];
};

const DEFAULT_CHANNELS: ChannelId[] = ["amazon-eu", "zalando", "otto", "google-css", "shopify"];

export const useChannels = create<ChannelState>((set, get) => ({
  products: [],
  selected: DEFAULT_CHANNELS,
  importedAt: null,

  setSelected: (ids) => set({ selected: ids }),
  toggleChannel: (id) =>
    set((s) => ({
      selected: s.selected.includes(id) ? s.selected.filter((c) => c !== id) : [...s.selected, id],
    })),

  importCsv: (text) => {
    const products = parseCsv(text);
    set({ products, importedAt: new Date().toISOString() });
    return products.length;
  },
  loadSample: () => get().importCsv(SAMPLE_CSV),
  clear: () => set({ products: [], importedAt: null }),

  updateProduct: (id, patch) =>
    set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

  fixOne: (id) => {
    const { products, selected } = get();
    const p = products.find((x) => x.id === id);
    if (!p) return [];
    const { product, applied } = autoFix(p, selected);
    set({ products: products.map((x) => (x.id === id ? product : x)) });
    return applied;
  },

  fixAll: () => {
    const { products, selected } = get();
    let changed = 0;
    const next = products.map((p) => {
      const { product, applied } = autoFix(p, selected);
      if (applied.length) changed++;
      return product;
    });
    set({ products: next });
    return changed;
  },

  reports: () => {
    const { products, selected } = get();
    return products.map((p) => reportFor(p, selected));
  },
}));
