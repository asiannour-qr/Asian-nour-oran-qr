import toast from "react-hot-toast";

const TOAST_ID = "cart-add-feedback";

function shortenName(name: string, max = 32): string {
  const trimmed = name.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

/** Retour visuel discret à chaque ajout au panier (table, emporter, serveur). */
export function toastAddedToCart(name?: string) {
  const label = name?.trim()
    ? `${shortenName(name)} — ajouté au panier`
    : "Ajouté au panier";

  toast.success(label, {
    id: TOAST_ID,
    duration: 1400,
    position: "bottom-center",
    style: {
      background: "rgba(26, 20, 16, 0.9)",
      color: "#f5efe6",
      fontSize: "13px",
      fontWeight: 500,
      padding: "10px 18px",
      borderRadius: "999px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
    },
  });
}
