import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LABELS: Record<string, string> = {
  fat_total: "Faturamento Total",
  fat_proprio: "Faturamento Cardápio Próprio",
  fat_ifood: "Faturamento iFood",
  fat_mesa: "Faturamento Mesa",
  fat_delivery: "Faturamento Delivery Próprio",
  pedidos_mesa: "Pedidos Mesa",
  pedidos_delivery: "Pedidos Delivery",
  ticket_mesa: "Ticket Médio Mesa",
  ticket_delivery: "Ticket Médio Delivery",
  ticket_ifood: "Ticket Médio iFood",
  cp_visitas: "Cardápio Próprio — Visitas",
  cp_views: "Cardápio Próprio — Visualizações",
  cp_sacola: "Cardápio Próprio — Sacola",
  cp_revisao: "Cardápio Próprio — Revisão",
  cp_concluidos: "Cardápio Próprio — Concluídos",
  if_visitas: "iFood — Visitas",
  if_views: "iFood — Visualizações",
  if_sacola: "iFood — Sacola",
  if_revisao: "iFood — Revisão",
  if_concluidos: "iFood — Concluídos",
  meta_invest: "Meta Ads — Investido",
  meta_vendas: "Meta Ads — Vendas",
  google_invest: "Google Ads — Investido",
  google_vendas: "Google Ads — Vendas",
  google_visitas_loja: "Google — Visitas à Loja",
  google_rotas: "Google — Rotas",
  crm_invest: "CRM — Investido",
  crm_vendas: "CRM — Vendas",
  roas_meta: "ROAS Meta Ads",
  roas_google: "ROAS Google Ads",
  roas_crm: "ROAS CRM",
};

function fmtBRL(n: number) {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(n: number) {
  return Math.round(n).toLocaleString("pt-BR");
}

function buildMetricsBlock(metrics: Record<string, number>, prev: Record<string, number> | null): string {
  const moneyFields = ["fat_total","fat_proprio","fat_ifood","fat_mesa","fat_delivery","meta_invest","meta_vendas","google_invest","google_vendas","crm_invest","crm_vendas","ticket_mesa","ticket_delivery","ticket_ifood"];
  const lines: string[] = [];

  for (const [key, val] of Object.entries(metrics)) {
    const label = LABELS[key] || key;
    const isMoney = moneyFields.includes(key);
    const isRoas = key.startsWith("roas_");
    const formatted = isRoas ? val.toFixed(2) + "x" : isMoney ? fmtBRL(val) : fmtNum(val);

    let delta = "";
    if (prev && prev[key] && prev[key] > 0) {
      const diff = ((val - prev[key]) / prev[key]) * 100;
      const sign = diff >= 0 ? "+" : "";
      delta = ` (${sign}${diff.toFixed(1)}% vs mês anterior)`;
    }

    lines.push(`- ${label}: ${formatted}${delta}`);
  }

  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { raw_text, metrics, prev_metrics, period } = await req.json();

    if (!raw_text || typeof raw_text !== "string" || raw_text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "raw_text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metricsBlock = metrics ? buildMetricsBlock(metrics, prev_metrics) : "";

    const prompt = `Você é um redator de uma agência de marketing digital especializada em restaurantes. Gere um relatório de destaques do mês para o cliente ver no dashboard de resultados.

DADOS DO PERÍODO${period ? ` (${period})` : ""}:
${metricsBlock || "(nenhuma métrica disponível)"}

OBSERVAÇÕES DA EQUIPE:
${raw_text}

REGRAS DE FORMATAÇÃO:
- Separe por tópicos usando emojis relevantes (ex: 🚀 📈 🛵 📱 💰 🎯 📊)
- Cada tópico em uma linha separada com título em negrito: "emoji **Título**"
- Abaixo do título, 1-2 frases curtas sobre aquele assunto
- Tom amigável, celebratório nos acertos, construtivo nas quedas
- Use os números reais e os deltas quando relevante (ex: "crescimento de 15%")
- Contextualize os números com as observações da equipe
- Não invente dados que não estejam nos números ou nas observações
- Máximo 4-5 tópicos
- Responda APENAS com o texto final, sem explicações ou introduções`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errBody}`);
    }

    const data = await response.json();
    const polished = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(JSON.stringify({ polished }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
