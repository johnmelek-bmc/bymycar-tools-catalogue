# 🧰 BYmyCAR Tools Catalogue

Catalogue centralisé de tous les outils du groupe BYmyCAR / Cosmobilis.

## 🎯 Objectif

**Single Source of Truth** pour l'ensemble des outils du groupe :
- Chaque équipe maintient **son propre fichier YAML** dans `/tools/`
- Les données sont **automatiquement synchronisées** vers Supabase
- Tous les projets (chatbot Boîte à Idées, dashboards, etc.) **consomment les mêmes données à jour**

## 📂 Structure

```
bymycar-tools-catalogue/
├── tools/                          # Fiches outils (un fichier par outil)
│   ├── hub-autometrics.yaml        # Hub Autometrics
│   ├── myanapro.yaml               # MyANAPro (ANA)
│   └── openflex-marketing.yaml     # OpenFlex & OpenFlex Marketing
├── schema/
│   └── tool-schema.yaml            # Schéma de validation YAML
├── scripts/
│   └── validate-and-sync.js        # Script de validation + sync Supabase
├── .github/workflows/
│   └── sync-to-supabase.yml        # GitHub Action : sync automatique
└── README.md
```

## 🚀 Comment ça marche

### Pour les équipes

1. **Modifiez** le fichier YAML de votre outil dans `/tools/`
2. **Créez une Pull Request** sur GitHub
3. La GitHub Action **valide** automatiquement le format
4. Un review est fait → **Merge** sur `main`
5. La GitHub Action **synchronise** les données vers Supabase
6. **Tous les projets** utilisant ces données sont **mis à jour automatiquement**

### Format d'une fiche outil

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

## 🔄 Propagation automatique

```
Équipe modifie son YAML
        │
        ▼
  Pull Request → Validation automatique
        │
        ▼
  Merge sur main
        │
        ▼
  GitHub Action : sync-to-supabase
        │
        ├──► Supabase table : tools_catalogue
        │
        ├──► Invalidations cache CDN
        │
        └──► Webhooks → projets consommateurs
                  │
                  ├──► Boîte à Idées Chatbot
                  ├──► BYmyCAR Satisfaction Platform
                  └──► (futurs projets)
```

## 📋 Outils actuellement référencés

| Outil | Équipe | Statut |
|---|---|---|
| [Hub Autometrics](tools/hub-autometrics.yaml) | Data & Performance | ✅ |
| [MyANAPro (ANA)](tools/myanapro.yaml) | Process & Administration | ✅ |
| [OpenFlex & OFM](tools/openflex-marketing.yaml) | CRM & Marketing Digital | ✅ |

## 🔐 Accès

Chaque outil a ses propres règles d'accès. Consultez la fiche YAML de l'outil
pour savoir comment demander l'accès.
