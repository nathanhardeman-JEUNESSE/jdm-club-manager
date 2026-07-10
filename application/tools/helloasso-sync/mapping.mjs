export const CONFIG = {
  apiBase: "https://api.helloasso.com",
  clubId: "jdm-lomme",
  defaultSeason: "2026-2027",
  pageSize: 100,
  collections: {
    adherents: "adherents",
    inscriptions: "inscriptions",
    orders: "helloassoOrders",
    payments: "helloassoPayments",
    syncStatus: "syncStatus",
    pendingUsers: "pendingUsers"
  }
};

export function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function firestoreId(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function customField(fields, words) {
  if (!Array.isArray(fields)) return "";
  const wanted = words.map(normalize);
  const found = fields.find((field) => {
    const label = normalize(field?.name ?? field?.label ?? field?.fieldName ?? field?.title);
    return wanted.every((word) => label.includes(word));
  });
  return found?.answer ?? found?.value ?? found?.displayValue ?? found?.text ?? "";
}
