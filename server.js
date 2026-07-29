/* ============================================================================
   Liffey Pharmacy — API proxy (Render web service)
   ----------------------------------------------------------------------------
   Keeps the OpenAI API key SECRET on the server. The public GitHub Pages
   chatbot (index.html) POSTs {messages, tools} here; this proxy adds the
   secret key and forwards to OpenAI, then returns the response.

   The key is read from the OPENAI_API_KEY environment variable set in the
   Render dashboard — it is never in this code or in the public repo.

   Zero dependencies (uses Node's built-in http + fetch, Node 18+).
   Start:  node server.js   (Render sets PORT automatically)
   ============================================================================ */

const http = require("http");

const OPENAI_KEY   = process.env.OPENAI_API_KEY;                 // set in Render → Environment
const MODEL        = process.env.OPENAI_MODEL   || "gpt-4o-mini";
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN   || "*";          // e.g. https://paraudiana94-ux.github.io
const PORT         = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // --- CORS (allow the GitHub Pages site to call this proxy) ---
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  // Health check / friendly root
  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("Liffey Pharmacy API proxy is running. POST /chat with {messages, tools}.");
  }

  if (req.method === "POST") {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", async () => {
      try {
        if (!OPENAI_KEY) {
          res.writeHead(500, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "OPENAI_API_KEY is not set on the server (Render → Environment)." }));
        }
        const payload = JSON.parse(body || "{}");
        const oaBody = {
          model: MODEL,
          messages: payload.messages,
          temperature: 0.6
        };
        // Only include tools / tool_choice when tools are actually provided —
        // OpenAI rejects tool_choice on its own.
        if (Array.isArray(payload.tools) && payload.tools.length) {
          oaBody.tools = payload.tools;
          oaBody.tool_choice = payload.tool_choice || "auto";
        }
        const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_KEY}`
          },
          body: JSON.stringify(oaBody)
        });
        const text = await upstream.text();       // pass OpenAI's JSON straight through
        res.writeHead(upstream.status, { "Content-Type": "application/json" });
        res.end(text);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err && err.message || err) }));
      }
    });
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, () => console.log(`Liffey Pharmacy proxy listening on ${PORT}, model ${MODEL}`));
