#!/usr/bin/env node
/**
 * generate-json.js — Génère tools-catalogue.json depuis les fichiers YAML
 *
 * Usage : node scripts/generate-json.js
 * Output : dist/tools-catalogue.json
 *
 * Ce fichier JSON est ensuite :
 *   - Committé dans le repo pour être accessible via raw.githubusercontent.com
 *   - Fetché par le Lovable project BYmAIcar Portal au démarrage
 *   - Utilisé pour la recherche d'outils dans la Boîte à Idées
 */

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const TOOLS_DIR = path.resolve(__dirname, "..", "tools");
const OUT_DIR = path.resolve(__dirname, "..", "dist");
const OUT_FILE = path.join(OUT_DIR, "tools-catalogue.json");

function loadYaml(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const doc = YAML.parse(content);
  if (!doc || !doc.tool) {
    console.error(`  ⚠️  Structure invalide dans ${path.basename(filePath)}`);
    return null;
  }
  return doc.tool;
}

function formatTool(tool) {
  return {
    id: tool.id,
    name: tool.name,
    display_name: tool.display_name,
    version: tool.version || null,
    team: {
      name: tool.team?.name || "",
      owners: tool.team?.owners || [],
    },
    description_short: tool.description_short || "",
    description_fr: tool.description_fr || "",
    description_en: tool.description_en || "",
    access_url: tool.access_url || null,
    documentation_url: tool.documentation_url || null,
    support_contact: tool.support_contact || null,
    categories: tool.categories || [],
    tags: tool.tags || [],
    use_cases: (tool.use_cases || []).map((uc) => ({
      problem: uc.problem,
      solution: uc.solution,
      link: uc.link || null,
    })),
    features: (tool.features || []).map((f) => ({
      name: f.name,
      description: f.description,
      category: f.category || null,
    })),
    integrations: (tool.integrations || []).map((i) => ({
      name: i.name,
      type: i.type || null,
      description: i.description || null,
    })),
    needs_manager_approval: tool.access_required?.needs_manager_approval ?? true,
    how_to_request: tool.access_required?.how_to_request || "",
    available_to: tool.access_required?.available_to || "",
    last_updated: tool.last_updated || null,
    updated_by: tool.updated_by || null,
  };
}

function main() {
  console.log("=== BYmyCAR Tools Catalogue — JSON Generator ===\n");

  if (!fs.existsSync(TOOLS_DIR)) {
    console.error(`❌ Dossier ${TOOLS_DIR} introuvable`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(TOOLS_DIR)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();

  if (files.length === 0) {
    console.error("❌ Aucun fichier YAML trouvé dans tools/");
    process.exit(1);
  }

  console.log(`📁 ${files.length} fichier(s) trouvé(s) :`);
  files.forEach((f) => console.log(`   - ${f}`));

  const tools = [];
  let errors = 0;

  for (const file of files) {
    const filePath = path.join(TOOLS_DIR, file);
    const tool = loadYaml(filePath);
    if (tool) {
      tools.push(formatTool(tool));
      console.log(`  ✅ ${tool.display_name || tool.name}`);
    } else {
      errors++;
    }
  }

  if (errors > 0 && tools.length === 0) {
    console.error("\n❌ Aucun outil valide trouvé");
    process.exit(1);
  }

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const output = {
    $schema: "https://raw.githubusercontent.com/johnmelek-bmc/bymycar-tools-catalogue/main/schema/tools-catalogue-schema.json",
    generated_at: new Date().toISOString(),
    total_tools: tools.length,
    tools,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf8");
  console.log(
    `\n✅ ${tools.length} outil(s) généré(s) → ${OUT_FILE} (${(
      fs.statSync(OUT_FILE).size / 1024
    ).toFixed(1)} KB)`
  );
}

main();
