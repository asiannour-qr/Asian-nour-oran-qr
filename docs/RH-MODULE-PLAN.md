# Module RH & Planning — Plan d'intégration (Oran · Fleury · Tours)

> Option payante Servio. Objectif : planning d'équipe en temps réel, gestion des absences
> et **suggestion automatique de remplaçants** à appeler. Intégré à l'admin existant.

## 0. Constat d'architecture (validé dans le code)

- **Un seul codebase**, déployé 3 fois (`lib/site.ts` → « Configuration propre à chaque instance Oran / Tours / Fleury »). Construire le module ici le rend disponible sur les 3 sites après déploiement.
- **Bases séparées par site** (un `DATABASE_URL` par instance). La migration Prisma sera exécutée sur chacune.
- **Horaires déjà en base** : `RestaurantSettings.openingHours` (JSON) + `SITE_CONFIG.timeZone`. Réutilisés pour borner les créneaux et détecter les trous de couverture.
  - Oran : service continu 11h00–00h00
  - Fleury : 11h30–14h30 · 18h30–22h30
  - Tours : 11h30–14h00 · 19h00–23h00
- **Auth** : cookies `ADMIN` / `KITCHEN` (`lib/staff-session.ts`), pas de compte par employé.
  → Le module RH est **piloté par le gérant** (session ADMIN). Les employés sont des **données**, pas des comptes.

## 1. Périmètre fonctionnel

- Répertoire **équipe** (titulaires) et **extras/remplaçants** : nom, téléphone, poste, statut.
- **Planning hebdomadaire** par poste × jour, avec horaires adaptés au service du site.
- **Absence en 1 clic** : marquer un créneau « absent » (motif + commentaire).
- **Suggestion de remplaçants** : liste priorisée d'extras disponibles (nom, tél, poste) + action *Appeler* / *WhatsApp* (`tel:` / `wa.me`).
- **Indicateurs** : effectif planifié, postes couverts, absences à remplacer, (option) masse salariale du service.
- **Temps réel** : rafraîchissement par polling (même approche que la cuisine).

Hors périmètre v1 (à discuter) : pointage/badgeuse, paie, comptes employés, notifications automatiques envoyées par le serveur.

## 2. Modèle de données (Prisma)

```prisma
model Employee {
  id        String   @id @default(cuid())
  name      String
  phone     String?
  role      String            // poste : Sushi, Cuisine chaude, Service, Caisse, Plonge…
  isExtra   Boolean  @default(false)   // true = pool remplaçants
  active    Boolean  @default(true)
  notes     String?
  shifts    Shift[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Shift {
  id           String   @id @default(cuid())
  employeeId   String
  employee     Employee @relation(fields: [employeeId], references: [id])
  date         DateTime          // jour du créneau (00:00 site TZ)
  role         String            // poste couvert
  startMin     Int               // minutes depuis minuit (ex. 690 = 11h30)
  endMin       Int
  status       ShiftStatus @default(PLANNED)
  absence      Absence?
  createdAt    DateTime @default(now())
  @@index([date])
}

model Absence {
  id            String   @id @default(cuid())
  shiftId       String   @unique
  shift         Shift    @relation(fields: [shiftId], references: [id])
  reason        String            // Maladie, Imprévu, Congé…
  note          String?
  replacedById  String?           // Employee.id (extra) retenu
  resolved      Boolean  @default(false)
  createdAt     DateTime @default(now())
}

enum ShiftStatus { PLANNED ABSENT REPLACED }
```

## 3. API (App Router, admin-only)

Toutes gardées par `assertStaffSession()` (cookie ADMIN).

| Route | Méthode | Rôle |
|---|---|---|
| `/api/admin/rh/employees` | GET/POST | liste / créer (titulaire ou extra) |
| `/api/admin/rh/employees/[id]` | PATCH/DELETE | éditer / désactiver |
| `/api/admin/rh/planning?week=YYYY-WW` | GET | grille de la semaine |
| `/api/admin/rh/shifts` | POST | créer un créneau |
| `/api/admin/rh/shifts/[id]` | PATCH/DELETE | modifier / retirer |
| `/api/admin/rh/shifts/[id]/absence` | POST | marquer absent + renvoyer les remplaçants suggérés |
| `/api/admin/rh/shifts/[id]/replace` | POST | affecter un remplaçant |

**Algorithme de suggestion** : extras `active && isExtra`, même `role` (ou polyvalents), **non déjà planifiés** sur le créneau qui chevauche, triés par (rôle exact, historique de disponibilité). Retourne `{name, phone, role}`.

## 4. UI admin

- Nouvelle entrée **« Équipe & Planning »** dans la nav admin (`app/admin/rh/`).
- Onglets : **Planning** (grille poste × jour), **Mon équipe**, **Répertoire d'extras**.
- Clic sur un créneau → panneau : marquer absent → **remplaçants proposés** avec boutons *Appeler* / *WhatsApp*.
- Bandeau KPIs en haut (effectif, couverture, absences à remplacer, masse salariale option).
- Créneaux bornés par `openingHours` du site + alerte si trou de couverture.
- Réutilise la maquette validée (`ByKdrCompany-Studio/demos/gestion-rh.html`) comme référence visuelle.

## 5. Multi-site & déploiement

1. Migration : `prisma migrate deploy` sur chaque `DATABASE_URL` (Oran, Fleury, Tours).
2. Seed des postes par défaut + import initial des équipes réelles (script par site).
3. Aucune spécificité de code par site : tout dérive de `RestaurantSettings.openingHours` + `SITE_CONFIG`.
4. Recette sur Oran d'abord (site pilote), puis Fleury et Tours.

## 6. Sécurité / conformité

- Accès module = session ADMIN uniquement.
- Données personnelles (nom, téléphone employés) : minimisation, pas d'export public, suppression = désactivation (soft) puis purge.
- Aucune donnée RH exposée côté client/serveur QR.

## 7. Phases & estimation

| Phase | Contenu | Estimation |
|---|---|---|
| 1 | Schéma Prisma + migration + seed | 0,5–1 j |
| 2 | API CRUD + moteur de suggestion | 1–1,5 j |
| 3 | UI admin (planning, équipe, extras, absence→remplaçant) | 2–3 j |
| 4 | Temps réel (polling) + KPIs + masse salariale | 0,5–1 j |
| 5 | Déploiement 3 instances + import équipes + recette | 0,5 j |
| **Total** | | **~5–7 j** |

## 8. Décisions v1 (validées)

1. **Pas de taux horaire / masse salariale** en v1 (champ retiré du modèle).
2. **Notifications** : boutons manuels *Appeler* (`tel:`) et *WhatsApp* (`wa.me`) — aucun envoi automatique.
3. **100 % côté gérant** : pas d'accès employé, pas de lien lecture seule.
4. **Seed initial** : 10 lignes placeholder — **2 titulaires par poste** (Sushiman, Wokman, Serveur, Piston) **+ 2 extras** polyvalents. À remplacer par les vrais effectifs quand disponibles.
