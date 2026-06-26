# BYmyCAR Tools Catalogue

Catalogue centralisé de tous les outils du groupe BYmyCAR / Cosmobilis.

## Objectif

**Single Source of Truth** pour l'ensemble des outils du groupe :
- Chaque **équipe** maintient **son propre fichier YAML** dans `/tools/`
- Un **JSON statique** est généré automatiquement (`dist/tools-catalogue.json`)
- Le projet **BYmAIcar Portal** (Boîte à Idées) embarque les données en TypeScript
- **Zéro base de données** nécessaire : les données voyagent du YAML au code

## Architecture

```
                        GitHub Repo
                    bymycar-tools-catalogue
                    │
        ┌───────────┼──────────────┐
        ▼           ▼              ▼
   tools/        scripts/       .github/
   *.yaml       generate-       workflows/
   (SSOT)       json.js         build-and-deploy.yml
        │           │              │
        │           ▼              ▼
        │      dist/             GitHub Actions
        │      tools-catalogue    (validation +
        │      .json              génération JSON)
        │           │
        └───────────┘
                    │
                    ▼
           BYmAIcar Portal
           (Lovable project)
           src/lib/tools-catalogue-data.ts
           (données embarquées en TypeScript)
                    │
                    ▼
           Boîte à Idées Chatbot
           (recherche d'outils locale,
            zéro appel réseau)
```

## Comment ça marche

### Pour les équipes

1. **Modifiez** le fichier YAML de votre outil dans `/tools/`
2. **Créez une Pull Request** sur GitHub
3. La GitHub Action **valide** automatiquement le format YAML
4. Un review est fait → **Merge** sur `main`
5. La GitHub Action **génère** `dist/tools-catalogue.json`
6. Un développeur **importe le JSON** dans le projet BYmAIcar Portal
   (script `node scripts/generate-json.js` → copier dans le projet Lovable)

### Pour les développeurs Lovable

Quand les YAML sont mis à jour :

```bash
git pull
node scripts/generate-json.js
# Copier dist/tools-catalogue.json dans le projet Lovable
# Et mettre à jour src/lib/tools-catalogue-data.ts
```

Ou bien le projet Lovable peut fetch le JSON depuis :
```
https://raw.githubusercontent.com/johnmelek-bmc/bymycar-tools-catalogue/main/dist/tools-catalogue.json
```

## Format d'une fiche outil

```yaml
tool:
  id: mon-outil                    # slug unique
  name: "Mon Outil"                # nom court
  display_name: "Mon Outil (X)"    # nom d'affichage
  version: "1.0.0"                 # version semver

  team:
    name: "Équipe X"               # équipe responsable
    owners:
      - email: "contact@bymycar.fr"
        name: "Prénom Nom"
        role: "Product Owner"

  description_fr: "..."            # description complète

  access_url: "https://..."        # lien vers l'outil
  documentation_url: "https://..." # documentation
  support_contact: "#canal-slack"  # contact support

  categories: [ "Cat1", "Cat2" ]   # catégories
  tags: [ "tag1", "tag2" ]         # mots-clés

  use_cases:                       # pour le chatbot
    - problem: "Problème utilisateur"
      solution: "Solution apportée par l'outil"

  features:                        # fonctionnalités détaillées
    - name: "Feature"
      description: "..."
```

## Fichiers importants

| Fichier | Rôle |
|---|---|
| `tools/*.yaml` | Source de vérité : fiches outils (une par fichier) |
| `scripts/generate-json.js` | Génère `dist/tools-catalogue.json` depuis les YAML |
| `dist/tools-catalogue.json` | JSON consolidé, consommable par tous les projets |
| `.github/workflows/sync-to-supabase.yml` | GitHub Action : validation + build + déploiement |
| (projet Lovable) `src/lib/tools-catalogue-data.ts` | Données embarquées en TypeScript dans le Portal |
| (projet Lovable) `src/lib/ideas.functions.ts` | Fonction de recherche d'outils (searchToolsLocal) |

## Outils actuellement référencés

| Outil | Équipe | Catégories |
|---|---|---|
| [Hub Autometrics](tools/hub-autometrics.yaml) | Data & Performance | Pilotage, Stock & Ventes, Performance |
| [MyANAPro (ANA)](tools/myanapro.yaml) | Process & Administration | Administratif, Processus, Documents |
| [OpenFlex & OFM](tools/openflex-marketing.yaml) | CRM & Marketing Digital | CRM, Marketing, Ventes, Data |

## Accès

Chaque outil a ses propres règles d'accès. Consultez la fiche YAML de l'outil
pour savoir comment demander l'accès.
