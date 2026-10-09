export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ingredients, mood, time } = req.body || {};
  if (!Array.isArray(ingredients) || !ingredients.length) {
    return res.status(400).json({ error: 'Aucun ingrédient' });
  }

  // Les contraintes facultatives ne sont ajoutées que si elles existent vraiment.
  // Avant, l'app n'envoyant pas "time", la consigne contenait littéralement
  // "Temps max : undefined", ce qui parasitait la réponse.
  const contraintes = [
    mood ? `Envie du moment : ${mood}.` : '',
    time ? `Temps de préparation maximum : ${time}.` : ''
  ].filter(Boolean).join(' ');

  const prompt = `Voici ce qu'il y a dans mon frigo : ${ingredients.join(', ')}.
${contraintes}

Propose-moi 4 plats connus et éprouvés : des recettes qu'on trouverait dans un
livre de cuisine ou à la carte d'un restaurant, avec un nom que les gens
reconnaissent.

Règles importantes :
1. Tu n'es PAS obligé d'utiliser tous mes ingrédients, et c'est même rarement une
   bonne idée. Chaque plat doit en utiliser au moins un, mais choisis seulement
   ceux qui vont ensemble dans une recette établie. Un classique qui n'utilise que
   deux de mes ingrédients vaut largement mieux qu'un plat tiré par les cheveux
   qui les case tous. Les ingrédients restants serviront pour un autre des 4 plats.
2. Donne le vrai nom du plat tel qu'on le connaît (Carbonara, Poulet tikka massala,
   Tzatziki, Blanquette de veau, Bibimbap...), jamais une description déguisée en
   titre du genre "poulet crémeux aux légumes frais".
3. Suppose que j'ai les basiques : sel, poivre, huile, beurre, farine, oeufs, lait,
   oignon, ail, épices et herbes courantes. Inutile de les compter comme manquants.
4. Tu peux compter sur un ou deux ingrédients courants que je n'ai pas cités, pas
   plus, et seulement s'ils se trouvent partout.
5. Varie les origines : quatre pays ou régions différents.
6. Les étapes doivent être vraiment exécutables : 4 à 7 étapes concrètes, avec les
   quantités, les temps et les températures quand ils comptent.

Réponds uniquement par un objet JSON de cette forme exacte :
{"plats":[{"name":"nom du plat","origin":"pays ou région","time":"25 min","description":"une phrase","ingredients":["200 g de ...","..."],"steps":["...","..."]}]}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        // Une température plus basse rend le modèle moins inventif, donc plus
        // fidèle aux recettes établies.
        temperature: 0.6,
        // Le mode JSON garantit une réponse analysable : plus besoin de retirer
        // à la main les ```json que le modèle ajoutait parfois autour.
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: "Tu es un chef cuisinier. Tu proposes des recettes traditionnelles et éprouvées plutôt que des créations improvisées, et tu réponds exclusivement en JSON valide." },
          { role: 'user', content: prompt }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('OpenAI:', data.error);
      return res.status(502).json({ error: 'Erreur IA', detail: data.error.message });
    }

    const brut = JSON.parse(data.choices[0].message.content);
    // Le modèle renvoie normalement {"plats":[...]}, mais on accepte aussi un
    // tableau nu ou une autre clé, pour ne pas casser sur un écart de forme.
    const plats = Array.isArray(brut) ? brut
                : Array.isArray(brut.plats) ? brut.plats
                : Object.values(brut).find(Array.isArray) || [];

    if (!plats.length) return res.status(502).json({ error: 'Aucun plat renvoyé' });
    res.status(200).json(plats);

  } catch (e) {
    console.error('frigo:', e);
    res.status(500).json({ error: 'Erreur IA' });
  }
}
