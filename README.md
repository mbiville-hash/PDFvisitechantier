# PDFvisitechantier

Application terrain Fortis Rénovation pour créer une fiche visite salle de bain, conserver un brouillon persistant, puis générer un PDF de brief technique sous-traitant.

## Fonctionnement

- Le front est une app React/Vite mobile-first.
- L’accès se fait par PIN.
- Les photos sont compressées et envoyées sur Cloudinary.
- Les brouillons complets sont sauvegardés en JSON dans Google Drive via Apps Script.
- Les PDF sont générés par PDF.co depuis Apps Script.
- Notion reste propre : seule la propriété existante `Dossier Drive` de l’Affaire est lue ou mise à jour si le dossier doit être créé.
- Les fichiers sont rangés dans `Dossier Drive` de l’affaire, sous-dossier `Chiffrage`.

## Variables Vercel

```text
APP_PIN=****
SESSION_SECRET=****
NOTION_TOKEN=secret_****
WEBHOOK_URL=https://script.google.com/macros/s/.../exec
WEBHOOK_SECRET=****
VITE_CLOUDINARY_CLOUD_NAME=****
VITE_CLOUDINARY_UPLOAD_PRESET=****
```

## Propriétés Apps Script

À configurer dans le projet Apps Script séparé :

```text
NOTION_TOKEN=secret_****
PDFCO_API_KEY=****
WEBHOOK_SECRET=****
DRIVE_FALLBACK_FOLDER_ID=****
REPORTS_PARENT_FOLDER_ID=****
FRONTEND_BASE_URL=https://votre-app.vercel.app
```

`DRIVE_FALLBACK_FOLDER_ID` sert pour une fiche sans affaire Notion. `REPORTS_PARENT_FOLDER_ID` sert à créer automatiquement un dossier d’affaire si `Dossier Drive` est vide dans Notion.

## Déploiement Apps Script

1. Ouvrir le projet Apps Script dédié.
2. Copier le contenu de `appscript/Code.gs`.
3. Remplacer le manifeste par `appscript/appsscript.json`.
4. Ajouter les propriétés ci-dessus.
5. Exécuter une première fois une fonction du projet pour autoriser Drive et les requêtes externes.
6. Déployer en Web app.
7. Copier l’URL dans `WEBHOOK_URL` côté Vercel.

## Utilisation terrain

1. Ouvrir l’app et entrer le PIN.
2. Sélectionner une affaire existante ou coller l’URL/ID Notion de l’affaire.
3. Remplir les étapes disponibles. Les informations inconnues peuvent rester vides ou être marquées `À confirmer` / `Non visible`.
4. Utiliser `Enregistrer le brouillon` pour sauvegarder sans générer de PDF.
5. Rouvrir plus tard avec l’ID ou l’URL unique.
6. Utiliser `Générer le PDF` ou `Régénérer le PDF` depuis l’écran Synthèse.

## Commandes

```bash
npm install
npm run dev
npm run build
```

