export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { name, desc, cat, time } = req.body;
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Génère une recette de ${cat || 'plat'} pour : "${name || desc}".${time ? ` En moins de ${time}.` : ''} Réponds UNIQUEMENT en JSON:\n{"ingredients":["..."],"steps":["..."],"time":"XX min"}\nMax 8 ingrédients, 6 étapes.`
        }]
      })
    });
    const data = await response.json();
    const text = data.choices[0].message.content.replace(/```json|```/g, '').trim();
    const json = JSON.parse(text);
    res.status(200).json(json);
  } catch(e) {
    res.status(500).json({ error: 'Erreur IA' });
  }
}
