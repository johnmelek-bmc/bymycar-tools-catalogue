#!/usr/bin/env node
/**
 * BYmyCAR Tools Catalogue — Validation & Sync Script
 * 
 * Usage (local):
 *   node scripts/validate-and-sync.js
 * 
 * Usage (GitHub Action):
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_KEY=xxx node scripts/validate-and-sync.js
 * 
 * Ce script :
 *   1. Parcourt /tools/ et valide chaque fichier YAML
 *   2. Si SUPABASE_URL et SUPABASE_SERVICE_KEY sont définis, synchronise
 *   3. Génère un rapport de validation
 */

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const TOOLS_DIR = path.join(__dirname, "..", "tools");
const REPORT_PATH = path.join(__dirname, "..", "validation-report.json");

// ── Validation ──────────────────────────────────────────────────────

function validateTool(doc) {
  const errors = [];

  if (!doc || !doc.tool) errors.push("Structure 'tool' manquante");
  else {
    const t = doc.tool;
    if (!t.id) errors.push("id manquant");
    if (!t.name) errors.push("name manquant");
    if (!t.display_name) errors.push("display_name manquant");
    if (!t.version) errors.push("version manquante");
    if (!t.team?.name) errors.push("team.name manquant");
    if (!t.description_fr) errors.push("description_fr manquante");
    if (!t.access_url) errors.push("access_url manquante");
    if (!t.use_cases?.length) errors.push("use_cases manquants (min 1)");
    if (!t.features?.length) errors.push("features manquantes (min 1)");
    if (!t.last_updated) errors.push("last_updated manquant");
    if (!t.updated_by) errors.push("updated_by manquant");
  }

  return errors;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  BYmyCAR Tools Catalogue — Validation & Sync");
  console.log("=".repeat(60));

  // Read all tool files
  const files = fs
    .readdirSync(TOOLS_DIR)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  if (files.length === 0) {
    console.log("⚠️  Aucun fichier YAML trouvé dans /tools/");
    process.exit(0);
  }

  console.log(`\n📂 ${files.length} fichier(s) trouvé(s)\n`);

  const results = [];
  let hasErrors = false;

  for (const file of files) {
    const filePath = path.join(TOOLS_DIR, file);
    const content = fs.readFileSync(filePath, "utf8");

    let doc;
    try {
      doc = YAML.parse(content);
    } catch (e) {
      results.push({
        file,
        status: "error",
        errors: [`Erreur de parsing YAML : ${e.message}`],
      });
      hasErrors = true;
      continue;
    }

    const errors = validateTool(doc);

    if (errors.length > 0) {
      results.push({ file, status: "error", errors });
      hasErrors = true;
      console.log(`❌ ${file} — ${errors.length} erreur(s)`);
      errors.forEach((e) => console.log(`     • ${e}`));
    } else {
      results.push({ file, status: "ok", errors: [] });
      console.log(`✅ ${file} — ${doc.tool.display_name} (v${doc.tool.version})`);
    }
  }

  // Write report
  const report = {
    timestamp: new Date().toISOString(),
    total: files.length,
    ok: results.filter((r) => r.status === "ok").length,
    errors: results.filter((r) => r.status === "error").length,
    details: results,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\n📄 Rapport : ${REPORT_PATH}`);

  // ── Sync to Supabase ──────────────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (supabaseUrl && supabaseKey) {
    console.log("\n🔄 Synchronisation vers Supabase...");
    const { createClient } = require("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabaseKey);

    let syncOk = 0;
    let syncErrors = 0;

    for (const result of results) {
      if (result.status === "error") {
        syncErrors++;
        continue;
      }

      const filePath = path.join(TOOLS_DIR, result.file);
      const content = fs.readFileSync(filePath, "utf8");
      const doc = YAML.parse(content);
      const t = doc.tool;

      const { error } = await supabase.from("tools_catalogue").upsert(
        {
          id: t.id,
          name: t.name,
          display_name: t.display_name,
          version: t.version,
          team_name: t.team.name,
          team_owners: t.team.owners,
          description_short: t.description_short || "",
          description_fr: t.description_fr,
          description_en: t.description_en || "",
          access_url: t.access_url,
          documentation_url: t.documentation_url || "",
          support_contact: t.support_contact || "",
          categories: t.categories || [],
          tags: t.tags || [],
          use_cases: t.use_cases || [],
          features: t.features || [],
          integrations: t.integrations || [],
          needs_manager_approval: t.access_required?.needs_manager_approval ?? true,
          how_to_request: t.access_required?.how_to_request || "",
          available_to: t.access_required?.available_to || "",
          last_updated: t.last_updated,
          updated_by: t.updated_by,
          schema_version: t.schema_version || "1.0",
          raw_yaml: content,
        },
        { onConflict: "id" }
      );

      if (error) {
        console.log(`  ❌ ${result.file} — ${error.message}`);
        syncErrors++;
      } else {
        console.log(`  ✅ ${result.file} → ${t.display_name}`);
        syncOk++;
      }
    }

    console.log(`\n📊 Sync terminée : ${syncOk} OK, ${syncErrors} erreurs`);
  } else {
    console.log(
      '\n⚠️  SUPABASE_URL et SUPABASE_SERVICE_KEY non définis. Sync ignorée.'
    );
    console.log(
      '   Définissez ces variables d\'environnement pour synchroniser.'
    );
  }

  // ── Exit ──────────────────────────────────────────────────────────
  if (hasErrors) {
    console.log("\n❌ Validation échouée — corrigez les erreurs avant de merge.");
    process.exit(1);
  }

  console.log("\n✅ Validation réussie — tout est bon !");
}

main().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});
