# Système table — architecture figée

Ce document décrit le contrat stable entre **convives (QR)**, **serveur (tablette)** et **base de données**.  
Ne pas contourner ces règles dans de nouveaux fichiers sans mettre à jour `npm run test:handoff`.

## Modèles Prisma (obligatoires en prod)

| Modèle | Rôle |
|--------|------|
| `TableOrderMaster` | Verrou « téléphone maître » par table (`tableId` PK) |
| `TableDraftCart` | Panier brouillon partagé (items, convives, noms) |

Migration : `20260611180000_table_order_master`, `20260618130000_table_draft_cart`  
Déploiement : `npx prisma migrate deploy` (automatique au build Vercel via `vercel.json`).

## Identifiants appareil

| Acteur | Format | Exemple |
|--------|--------|---------|
| Convive | UUID localStorage `table:deviceId` | `a1b2c3d4-...` |
| Serveur | `staff-serv-{tableId}` | `staff-serv-1` |

Source unique : `lib/table-contract.ts` → `getStaffTableDeviceId()`.

## API — contrat HTTP

### `GET/POST/DELETE /api/tables/[tableId]/master`

- **POST `force: true`** : réservé au serveur (cookie `kitchen` ou `admin` + deviceId `staff-serv-*`).
- **POST client** : claim normal ; 409 si autre maître actif non expiré.
- **DELETE staff** : libère le verrou sans exiger d'être maître courant.

### `GET/PUT/DELETE /api/tables/[tableId]/draft-cart`

- Seul le **maître courant** peut PUT (sauf rattrapage client documenté dans la route).
- DELETE sans auth : vide le brouillon (reset accueil table).

### Health check

`GET /api/health/table-system` → vérifie que les deux tables Prisma répondent.

## Flux convive

1. Scan QR → `/table/{id}` (accueil, pas de `order=1`).
2. « Je gère la commande » → `POST /master` → `PUT /draft-cart` (sync auto).
3. Fermeture page maître convive → `DELETE /master` + clear draft + fin de session (`sessionStorage`).
4. Nouvelle ouverture QR (nouvel onglet / app fermée) → pas de session active : reset local + clear draft si table libre ou si ce téléphone était maître abandonné.

## Flux serveur

1. Login `/kitchen/login` → cookie `kitchen`.
2. `/serveur` → lien `/table/{id}?staff=1&order=1`.
3. Auto-claim : `POST /master` `{ force: true, deviceId: staff-serv-{id} }`.
4. « Redonner la main » → `DELETE /master` (staff) → retour `/serveur`.

## Timeouts verrous (lib/table-master.ts)

| Constante | Valeur | Usage |
|-----------|--------|-------|
| `STAFF_MASTER_IDLE_MS` | 45 s | Verrou staff abandonné |
| `CLIENT_MASTER_IDLE_MS` | 3 min | Verrou convive sans activité |
| `TABLE_MASTER_TTL_MS` | 4 h | Expiration absolue |

## Tests de non-régression

```bash
npm run test:handoff          # Prisma : convive → serveur → client
npm run typecheck
npm run prisma:validate
```

Table de test : `99` (`TEST_HANDOFF_TABLE_ID`). **Ne jamais tester sur la table 1 en prod.**

## Fichiers clés (ne pas dupliquer la logique)

| Fichier | Responsabilité |
|---------|----------------|
| `lib/table-contract.ts` | Constantes + IDs staff |
| `lib/table-master.ts` | Verrous Prisma |
| `lib/table-draft-cart.ts` | Brouillon Prisma |
| `lib/table-ordering-session.ts` | Session convive par onglet (`sessionStorage`) |
| `app/table/[id]/page.tsx` | UI convive + serveur |
| `app/api/tables/[tableId]/master/route.ts` | API verrous |
| `app/api/tables/[tableId]/draft-cart/route.ts` | API brouillon |
