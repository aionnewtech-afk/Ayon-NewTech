// netlify/functions/generate-content.js
//
// Gera copy real (LinkedIn + Instagram) usando a API da Anthropic.
// A chave fica só aqui no servidor (variável de ambiente ANTHROPIC_API_KEY),
// nunca é exposta no navegador do cliente.
//
// Configuração necessária no Netlify:
// Site settings → Environment variables → adicionar ANTHROPIC_API_KEY

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada no Netlify.' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Corpo da requisição inválido.' }) };
  }

  const { type, theme, client } = payload;
  if (!theme || !theme.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Tema não informado.' }) };
  }

  const typeLabels = {
    case: 'case de sucesso — prova social, resultado real entregue a um cliente',
    dica: 'dica técnica — mostra autoridade, ensina algo útil e aplicável',
    bastidores: 'bastidores — humaniza a marca, mostra o processo real de trabalho',
    anuncio: 'anúncio de serviço — chamada direta para ação/venda',
    posicionamento: 'frase de posicionamento — curta, de impacto, expressa a visão da empresa'
  };
  const typeLabel = typeLabels[type] || type;

  const prompt = `Você é o redator de conteúdo da AYON, uma boutique de engenharia de software que cria SaaS, automações com IA e sistemas sob medida para empresas brasileiras. Tom de voz: direto, confiante, sem jargão técnico vazio — fala com dono de negócio, não com programador. Nunca usa clichê de "revolucionar" ou "disruptivo".

Escreva um post do tipo "${typeLabel}", baseado neste tema/fato central fornecido pelo usuário: "${theme.trim()}"${client ? ` (cliente ou projeto relacionado: ${client})` : ''}.

Importante: reescreva e desenvolva a ideia com suas próprias palavras — não apenas repita o texto do tema literalmente. Transforme-o em um post pronto, bem escrito, seguindo a estrutura do tipo escolhido.

Gere DOIS textos:
1. "linkedin": mais longo (6 a 12 linhas), tom profissional, com quebras de linha entre parágrafos curtos, terminando com 4 a 5 hashtags relevantes em português.
2. "instagram": mais curto (3 a 6 linhas), tom mais direto e pessoal, pode usar 1 a 2 emojis com moderação, terminando com uma linha "." "." "." e depois 5 a 6 hashtags.

Responda SOMENTE com um JSON válido, sem markdown, sem crases, sem texto antes ou depois, exatamente neste formato:
{"linkedin": "texto aqui", "instagram": "texto aqui"}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { statusCode: resp.status, body: JSON.stringify({ error: 'Erro na API da Anthropic: ' + errText }) };
    }

    const data = await resp.json();
    const raw = (data.content && data.content[0] && data.content[0].text) || '';
    const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Não consegui interpretar a resposta da IA.', raw: clean }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
