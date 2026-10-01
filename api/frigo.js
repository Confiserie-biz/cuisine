export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { ingredients, mood, time } = req.body;
  
  try {
    const prompt = `Tu es un chef du monde entier. J'ai ces ingrédients : ${ingredients.join(', ')}.${mood ? ` Je veux quelque chose de : ${mood}.` : ''} Temps max : ${time}. Propose 4 plats/sauces du monde entier. Réponds UNIQUEMENT en JSON:\n[{"name":"...","origin":"...","time":"...","description":"...","ingredients":["..."],"steps":["..."]}]`;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
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
