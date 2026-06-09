# Variables d'environnement pour Vercel

## Variables requises

### 1. DATABASE_URL
- URL PostgreSQL (Neon, Supabase, Vercel Postgres…)
- Format : `postgresql://user:password@host:port/database?sslmode=require`

### 2. AUTH_SECRET
- **Indispensable** : clé secrète servant à signer les jetons de session admin/cuisine.
- Générer une valeur forte : `openssl rand -hex 32`
- Sans elle, le système retombe sur `ADMIN_PASSWORD`/`DATABASE_URL` comme secret (déconseillé).

### 3. BLOB_READ_WRITE_TOKEN
- Jeton Vercel Blob pour l'upload des photos (plats et menus composés) depuis l'admin.
- Créé automatiquement en liant un store Blob au projet Vercel (Storage → Blob).
- Sans lui, les uploads tentent d'écrire sur le disque local — impossible sur Vercel.

### 4. ADMIN_USER / ADMIN_PASSWORD
- Identifiants de secours pour l'accès admin (`/admin/login`).
- Utilisés seulement tant qu'aucun compte n'existe en base (`AppCredential`).
- Une fois le compte admin créé/modifié via *Admin → Compte*, c'est la base qui prime.

## Variables optionnelles

### NEXT_PUBLIC_BASE_URL
- URL de base de l'application (utilisée pour générer les QR codes).
- Exemple : `https://votre-projet.vercel.app`

### NEXT_PUBLIC_KITCHEN_SOUND_ENABLED
- Sons en cuisine : `"true"` ou `"false"` (défaut `"true"`).
- Modifiable aussi depuis *Admin → Réglages* (la base prime).

### NEXT_PUBLIC_SHOW_MENU_LANDING
- Page carte avant la commande : `"1"` pour activer.

## Check-list de déploiement

1. Renseigner les variables ci-dessus dans Vercel (Settings → Environment Variables).
2. `npx prisma migrate deploy` est exécuté au build (ou lancer manuellement sur la base prod).
3. Une fois en ligne : créer le compte admin et le compte cuisine via *Admin → Compte*.
4. Régénérer et réimprimer les QR codes (tables + façade emporter) avec l'URL de production.
5. Configurer l'imprimante thermique dans *Admin → Imprimantes* (IP locale du restaurant).
