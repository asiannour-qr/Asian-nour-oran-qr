export type CartItem = {
  id: string;
  name: string;
  qty: number;
  price?: number;     // centimes
  personId?: string;  // P1, P2, ...
  comment?: string;   // (plus utilisé côté UI)
};

export type Cart = {
  tableId: string;
  items: CartItem[];
  updatedAt: number;
  peopleCount?: number;   // nb de convives
  tableComment?: string | null;  // commentaire global de table
};

// ----- Store mémoire global (dev) -----
const g = globalThis as any;
if (!g.__CARTS__) g.__CARTS__ = new Map<string, Cart>();
const CARTS: Map<string, Cart> = g.__CARTS__;

export type TableCommentListener = () => void;

export let tableComment: string | null = null;
const tableCommentListeners = new Set<TableCommentListener>();

export function subscribeTableComment(listener: TableCommentListener) {
  tableCommentListeners.add(listener);
  return () => {
    tableCommentListeners.delete(listener);
  };
}

function emitTableComment() {
  for (const listener of tableCommentListeners) listener();
}

export function getTableCommentSnapshot() {
  return tableComment;
}

// Récupère (ou crée) le panier d'une table
export function getCart(tableId: string): Cart {
  const c = CARTS.get(tableId);
  if (c) return c;
  const fresh: Cart = {
    tableId,
    items: [],
    updatedAt: Date.now(),
    peopleCount: 1,
    tableComment: null
  };
  CARTS.set(tableId, fresh);
  return fresh;
}

// Met à jour le nombre de personnes
export function setPeopleCount(tableId: string, count: number) {
  const cart = getCart(tableId);
  cart.peopleCount = Math.max(1, Math.min(12, Math.floor(count || 1)));
  cart.updatedAt = Date.now();
  return cart;
}

export function setTableComment(value: string | null): void;
export function setTableComment(tableId: string, text: string): Cart;
// Définit le commentaire global de table ou met à jour le store client
export function setTableComment(arg1: string | null, arg2?: string) {
  if (arg2 === undefined && (typeof arg1 === "string" || arg1 === null)) {
    tableComment = arg1 ?? null;
    emitTableComment();
    return;
  }
  const tableId = String(arg1);
  const cart = getCart(tableId);
  const text = (arg2 ?? "").slice(0, 300);
  cart.tableComment = text || null;
  cart.updatedAt = Date.now();
  tableComment = cart.tableComment ?? null;
  emitTableComment();
  return cart;
}

// Clé d'unicité (même produit + même prix + même personne + même commentaire)
function keyFor(it: { id: string; price?: number; personId?: string; comment?: string }) {
  return `${it.id}|${it.price ?? 0}|${it.personId ?? "-"}|${(it.comment ?? "").trim()}`;
}

// Ajouter 1 (fusionne selon keyFor)
export function addItem(
  tableId: string,
  payload: { id: string; name: string; price?: number; personId?: string; comment?: string }
) {
  const cart = getCart(tableId);
  const k = keyFor(payload);
  const found = cart.items.find(i => keyFor(i) === k);
  if (found) found.qty += 1;
  else cart.items.push({ ...payload, qty: 1 });
  cart.updatedAt = Date.now();
  return cart;
}

// Modifier quantité (+1 / -1) pour la bonne ligne
export function changeQty(
  tableId: string,
  payload: { id: string; price?: number; personId?: string; comment?: string; delta: number }
) {
  const cart = getCart(tableId);
  const k = keyFor(payload);
  const idx = cart.items.findIndex(i => keyFor(i) === k);
  if (idx >= 0) {
    cart.items[idx].qty += payload.delta;
    if (cart.items[idx].qty <= 0) cart.items.splice(idx, 1);
    cart.updatedAt = Date.now();
  }
  return cart;
}

// Vider panier (commentaire + convives remis à zéro pour la prochaine commande)
export function clearCart(tableId: string) {
  const cart = getCart(tableId);
  cart.items = [];
  cart.tableComment = null;
  cart.peopleCount = 1;
  cart.updatedAt = Date.now();
  if (tableComment !== null) {
    tableComment = null;
    emitTableComment();
  }
  return cart;
}

// Total en centimes
export function totalCents(cart: Cart) {
  return cart.items.reduce((sum, it) => sum + (it.price ?? 0) * it.qty, 0);
}

// (debug) récupérer tous les paniers
export function getAllCarts() {
  const m: Map<string, Cart> = g.__CARTS__ ?? new Map<string, Cart>();
  return Array.from(m.values());
}
