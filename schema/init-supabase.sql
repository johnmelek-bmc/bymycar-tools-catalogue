-- =============================================================================
-- BYmyCAR Tools Catalogue — Initialisation Supabase
-- =============================================================================
-- Exécutez ce script dans l'éditeur SQL de Supabase (projet bymAIcar Portal)
-- pour créer la table tools_catalogue et les politiques de sécurité.
-- =============================================================================

-- 1. Extension pour la recherche full-text
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Table principale : outils
CREATE TABLE IF NOT EXISTS tools_catalogue (
  id TEXT PRIMARY KEY,                          -- slug unique (ex: "hub-autometrics")
  name TEXT NOT NULL,                           -- nom court
  display_name TEXT NOT NULL,                   -- nom d'affichage
  version TEXT NOT NULL DEFAULT '1.0.0',        -- version semver
  
  -- Équipe
  team_name TEXT NOT NULL DEFAULT '',
  team_owners JSONB DEFAULT '[]'::jsonb,        -- [{email, name, role}]
  
  -- Description
  description_short TEXT DEFAULT '',
  description_fr TEXT NOT NULL DEFAULT '',
  description_en TEXT DEFAULT '',
  
  -- Accès
  access_url TEXT NOT NULL DEFAULT '',
  documentation_url TEXT DEFAULT '',
  support_contact TEXT DEFAULT '',
  
  -- Catégorisation
  categories TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  
  -- Cas d'usage (pour le chatbot)
  use_cases JSONB DEFAULT '[]'::jsonb,          -- [{problem, solution, link?}]
  
  -- Fonctionnalités
  features JSONB DEFAULT '[]'::jsonb,           -- [{name, description, category?}]
  
  -- Intégrations
  integrations JSONB DEFAULT '[]'::jsonb,       -- [{name, type, description}]
  
  -- Accès requis
  needs_manager_approval BOOLEAN DEFAULT true,
  how_to_request TEXT DEFAULT '',
  available_to TEXT DEFAULT '',
  
  -- Métadonnées
  last_updated DATE,
  updated_by TEXT DEFAULT '',
  schema_version TEXT DEFAULT '1.0',
  raw_yaml TEXT DEFAULT '',                      -- fichier YAML original
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Index pour la recherche full-text
CREATE INDEX IF NOT EXISTS idx_tools_catalogue_tags ON tools_catalogue USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_tools_catalogue_categories ON tools_catalogue USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_tools_catalogue_name_trgm ON tools_catalogue USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tools_catalogue_updated ON tools_catalogue (last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_tools_catalogue_team ON tools_catalogue (team_name);

-- 4. Index pour la recherche plein texte sur les descriptions
ALTER TABLE tools_catalogue ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('french', 
      COALESCE(name, '') || ' ' || 
      COALESCE(display_name, '') || ' ' || 
      COALESCE(description_fr, '') || ' ' || 
      COALESCE(description_short, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_tools_catalogue_search ON tools_catalogue USING GIN (search_vector);

-- 5. Trigger auto : updated_at
CREATE OR REPLACE FUNCTION update_tools_catalogue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tools_catalogue_updated_at ON tools_catalogue;
CREATE TRIGGER trg_tools_catalogue_updated_at
  BEFORE UPDATE ON tools_catalogue
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_catalogue_updated_at();

-- 6. Sécurité : Row Level Security
ALTER TABLE tools_catalogue ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire (les données sont publiques dans l'entreprise)
CREATE POLICY "Tout le monde peut lire tools_catalogue"
  ON tools_catalogue FOR SELECT
  USING (true);

-- Seulement le service role (GitHub Action) peut écrire
CREATE POLICY "Service role peut écrire tools_catalogue"
  ON tools_catalogue FOR ALL
  USING (auth.role() = 'service_role');

-- 7. Vue simplifiée pour le chatbot
CREATE OR REPLACE VIEW tools_catalogue_light AS
SELECT
  id,
  name,
  display_name,
  description_short,
  description_fr,
  access_url,
  documentation_url,
  categories,
  tags,
  team_name,
  use_cases,
  features,
  needs_manager_approval,
  how_to_request,
  available_to,
  last_updated
FROM tools_catalogue
ORDER BY name;

-- 8. Fonction de recherche intelligente pour le chatbot
CREATE OR REPLACE FUNCTION search_tools(
  search_query TEXT,
  category_filter TEXT[] DEFAULT NULL
)
RETURNS SETOF tools_catalogue_light AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM tools_catalogue_light
  WHERE
    -- Recherche plein texte
    (search_query IS NULL OR search_query = '' OR 
     search_vector @@ plainto_tsquery('french', search_query) OR
     name ILIKE '%' || search_query || '%' OR
     display_name ILIKE '%' || search_query || '%' OR
     EXISTS (
       SELECT 1 FROM unnest(tags) t WHERE t ILIKE '%' || search_query || '%'
     ) OR
     EXISTS (
       SELECT 1 FROM jsonb_array_elements(use_cases) uc 
       WHERE uc->>'problem' ILIKE '%' || search_query || '%'
          OR uc->>'solution' ILIKE '%' || search_query || '%'
     ))
    AND
    -- Filtre par catégorie
    (category_filter IS NULL OR categories && category_filter)
  ORDER BY
    CASE WHEN search_query IS NULL OR search_query = '' THEN 0
         ELSE ts_rank(search_vector, plainto_tsquery('french', search_query))
    END DESC,
    name ASC;
END;
$$ LANGUAGE plpgsql STABLE;
