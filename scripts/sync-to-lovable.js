#!/usr/bin/env node
/**
 * sync-to-lovable.js — Synchronise dist/tools-catalogue.json vers le projet Lovable
 *
 * Usage :
 *   node scripts/sync-to-lovable.js <project_id>
 *
 * Nécessite les variables d'environnement :
 *   LOVABLE_CLIENT_ID     — Client ID OAuth Lovable
 *   LOVABLE_REFRESH_TOKEN — Refresh token OAuth Lovable
 *   GITHUB_SHA            — (optionnel) commit SHA pour le message
 *
 * Ce script :
 *   1. Lit dist/tools-catalogue.json
 *   2. Obtient un access token via refresh token
 *   3. Appelle l'API MCP Lovable (send_message) pour remplacer les données
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PROJECT_ID = process.argv[2];
const CLIENT_ID = process.env.LOVABLE_CLIENT_ID;
const REFRESH_TOKEN = process.env.LOVABLE_REFRESH_TOKEN;
const GITHUB_SHA = process.env.GITHUB_SHA || "inconnu";

if (!PROJECT_ID) {
  console.error("❌ Usage : node sync-to-lovable.js <project_id>");
  console.error("   (ou définir LOVABLE_PROJECT_ID dans l'environnement)");
  process.exit(1);
}

if (!CLIENT_ID || !REFRESH_TOKEN) {
  console.error("ℹ️  LOVABLE_CLIENT_ID ou LOVABLE_REFRESH_TOKEN non définis");
  console.error("   Activez la sync en ajoutant ces secrets GitHub");
  process.exit(0); // non-bloquant
}

function post(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith("https");
    const lib = isHttps ? https : http;
    const urlObj = new URL(url);
    const payload = typeof data === "string" ? data : JSON.stringify(data);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "Content-Length": Buffer.byteLength(payload),
        ...headers,
      },
    };

    const req = lib.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve(body));
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log("=== Sync BYmyCAR → Lovable MCP ===\n");

  // 1. Lire le JSON
  const jsonPath = path.resolve(__dirname, "..", "dist", "tools-catalogue.json");
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Fichier introuvable : ${jsonPath}`);
    console.error("   Exécutez d'abord : node scripts/generate-json.js");
    process.exit(1);
  }
  const jsonData = fs.readFileSync(jsonPath, "utf8");
  const parsed = JSON.parse(jsonData);
  console.log(`📦 ${parsed.total_tools} outil(s) chargé(s)`);

  // 2. Obtenir un access token
  console.log("\n🔄 Obtention du token Lovable...");
  const tokenBody =
    `grant_type=refresh_token&client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&refresh_token=${encodeURIComponent(REFRESH_TOKEN)}`;

  const tokenResp = await post(
    "https://lovable.dev/oauth/token",
    tokenBody,
    { "Content-Type": "application/x-www-form-urlencoded" }
  );

  let accessToken;
  try {
    accessToken = JSON.parse(tokenResp).access_token;
  } catch {
    console.error("❌ Échec de l'obtention du token :", tokenResp.slice(0, 200));
    console.error("   Le refresh token a peut-être expiré.");
    console.error("   Régénérez-le depuis la session Lovable.");
    process.exit(0); // non-bloquant
  }
  console.log("✅ Token obtenu");

  // 3. Construire le message MCP
  // On envoie la donnée brute dans un bloc de code pour que l'agent la recopie
  const message = [
    "🔁 **MISE À JOUR AUTOMATIQUE DU CATALOGUE OUTILS**",
    "",
    `Commit : \`${GITHUB_SHA}\``,
    `Outils : ${parsed.total_tools}`,
    `Généré le : ${parsed.generated_at}`,
    "",
    "**ACTION :** Remplace le contenu de `src/lib/tools-catalogue-data.ts` par les nouvelles données ci-dessous.",
    "Ne modifie **rien d'autre** dans le projet.",
    "",
    "⚠️ Conserve **exactement** les types existants (ToolOwner, ToolTeam, ToolUseCase, etc.).",
    "Remplace uniquement le tableau `TOOLS` et la fonction `searchTools`.",
    "Après remplacement, vérifie que le type-check passe.",
    "",
    "**NOUVELLES DONNÉES :**",
    "```json",
    JSON.stringify(parsed, null, 2),
    "```",
  ].join("\n");

  const mcpPayload = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "send_message",
      arguments: {
        project_id: PROJECT_ID,
        wait: true,
        timeout_seconds: 300,
        message,
      },
    },
  };

  console.log(`\n📤 Envoi à l'API MCP Lovable (projet: ${PROJECT_ID})...`);
  console.log(`   Taille du message : ${message.length} caractères`);
  console.log(`   ⏱  Attente jusqu'à 5 minutes...`);

  const mcpResp = await post(
    "https://mcp.lovable.dev",
    mcpPayload,
    { Authorization: `Bearer ${accessToken}` }
  );

  // 4. Analyser la réponse SSE (Server-Sent Events)
  // Format : event: message\ndata: {"result":{...},"jsonrpc":"2.0","id":1}
  const dataLine = mcpResp.match(/^data: (.+)$/m);
  let status = "inconnu";
  let cost = "?";
  let preview = null;

  if (dataLine) {
    try {
      const sseData = JSON.parse(dataLine[1]);
      const content =
        sseData.result?.content?.[0]?.text ||
        JSON.stringify(sseData.result);

      // Le contenu est une chaîne JSON (double-encodée)
      let inner;
      try {
        inner = JSON.parse(content);
      } catch {
        inner = { status: content };
      }
      status = inner.status || "completed";
      cost = sseData.result?.cost_credits ?? sseData.result?.cost ?? "?";
      preview = sseData.result?.preview_url ?? null;

      console.log(`\n✅ Statut : ${status}`);
      console.log(`💳 Crédits utilisés : ${cost}`);
      if (preview) console.log(`🔗 Preview : ${preview}`);

      if (status === "completed") {
        console.log("\n✅ BYmAIcar Portal mis à jour avec succès !");
      } else {
        console.log(`\n⚠️  Statut : ${status}`);
        console.log("   Le JSON est déjà déployé sur GitHub Pages.");
      }
    } catch (e) {
      console.log("\n⚠️  Impossible d'analyser la réponse MCP :", e.message);
      console.log("   Réponse brute (200 premiers chars) :", mcpResp.slice(0, 200));
    }
  } else {
    // Réponse JSON simple (non-SSE)
    try {
      const simple = JSON.parse(mcpResp);
      status = simple.status || "completed";
      cost = simple.cost_credits ?? simple.cost ?? "?";
      preview = simple.preview_url ?? null;
      console.log(`\n✅ Statut : ${status}`);
      console.log(`💳 Crédits utilisés : ${cost}`);
      if (preview) console.log(`🔗 Preview : ${preview}`);
      if (status === "completed") {
        console.log("\n✅ BYmAIcar Portal mis à jour avec succès !");
      } else {
        console.log(`\n⚠️  Statut : ${status}`);
      }
    } catch (e) {
      console.log("\n⚠️  Réponse inattendue :", mcpResp.slice(0, 300));
    }
  }
}

main().catch((err) => {
  console.error("❌ Erreur :", err.message);
  process.exit(1);
});
