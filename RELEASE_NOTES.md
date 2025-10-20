# Asian Nour QR Ordering — Stable Snapshot (2025-10-20)

## Portée de la release
- Administration unifiée avec gestion des menus et QR codes.
- Menus composés avec étapes guidées pour la prise de commande.
- Pseudos convives et gestion des invités par table.
- Page “Carte” avant commande avec bouton de bascule vers la commande.
- Interface cuisine (Kitchen) inchangée.

## Démarrage local
1. `npm ci`
2. `cp .env.example .env.local` (adapter les identifiants si nécessaire)
3. `npm run dev`

## Vérification
- `npm run verify` (typecheck, lint, build Next.js)
