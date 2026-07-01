import type { Metadata } from "next";
import RhClient from "./RhClient";

export const metadata: Metadata = { title: "Équipe & Planning — Admin" };
export const dynamic = "force-dynamic";

export default function RhPage() {
  return <RhClient />;
}
