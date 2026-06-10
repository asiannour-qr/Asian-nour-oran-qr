import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Ancienne URL « carte table » → accueil commande unifié sur /table */
export default function CartePage({ params }: { params: { id: string } }) {
  redirect(`/table/${params.id}`);
}
