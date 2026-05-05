const { GoogleGenAI } = require('@google/genai');

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function getClient() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

const FALLBACK_SCORE = { score: 5, theme: 'travel', mood: 'serene', subject: 'photo', is_hero: false, caption_pt: '', title_pt: '' };

async function withRetry(fn, maxAttempts = 4) {
  let delay = 2000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status || err?.response?.status;
      if ((status === 429 || status === 503) && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
}

async function analysePhoto(base64Image, mimeType = 'image/jpeg', locationContext = null) {
  const ai = getClient();
  const locationLine = locationContext?.city
    ? `Location: ${locationContext.city}${locationContext.country ? ', ' + locationContext.country : ''}`
    : '';
  const dateLine = locationContext?.date ? `Date: ${locationContext.date}` : '';
  const contextBlock = [locationLine, dateLine].filter(Boolean).join('\n');

  const prompt = `Analyse this photo and respond ONLY with valid JSON, no markdown, no explanation.
${contextBlock ? '\n' + contextBlock + '\n' : ''}
Schema:
{
  "score": number 1-10,
  "theme": string,
  "mood": string,
  "subject": string,
  "is_hero": boolean,
  "caption_pt": string,
  "title_pt": string
}

score = overall quality (composition, sharpness, visual interest).
theme = one of: landscape, portrait, group, food, architecture, detail, night, water, event, travel.
mood = one of: joyful, serene, dramatic, intimate, nostalgic, energetic, melancholic.
subject = brief description in English (max 5 words).
is_hero = true only if this photo deserves to be a full-width hero (excellent composition, clear subject, strong emotional impact).
caption_pt = one poetic sentence in European Portuguese (max 15 words), suitable as a story caption. No clichés.
title_pt = a short evocative title in European Portuguese (max 5 words) for use as a hero overlay text. Only generate if the photo truly deserves a title (iconic moment, striking landscape, key event). Empty string otherwise.`;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: base64Image } },
            { text: prompt },
          ],
        },
      ],
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });

    const text = response.text?.().trim() || '';
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return { ...FALLBACK_SCORE };
    }
  }).catch(() => ({ ...FALLBACK_SCORE }));
}

async function generateNarrative(base64Images, theme, language = 'pt', location = null) {
  const ai = getClient();
  const locationPhrase = location?.city
    ? `from ${location.city}${location.country ? ', ' + location.country : ''} `
    : '';

  const prompt = `You are a travel writer. Given these photos ${locationPhrase}from a section with theme "${theme}", write a short narrative paragraph in ${language === 'pt' ? 'European Portuguese' : language === 'es' ? 'Spanish' : 'English'}.
Max 3 sentences. Poetic but not sentimental.
Focus on light, space, feeling. No hashtags, no clichés.
Respond ONLY with the text, no JSON, no quotes.`;

  const parts = base64Images.map((img) => ({
    inlineData: { mimeType: 'image/jpeg', data: img },
  }));
  parts.push({ text: prompt });

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ parts }],
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    return response.text?.().trim() || '';
  }).catch(() => '');
}

async function analyseAlbumBatch(assets, fetchThumbFn, fetchExifFn, onProgress, db) {
  const pLimit = (await import('p-limit')).default;
  const batchSize = parseInt(process.env.AI_BATCH_SIZE || '10', 10);
  const concurrency = parseInt(process.env.AI_CONCURRENCY || '3', 10);
  const limit = pLimit(concurrency);
  const results = [];
  const total = assets.length;
  let processed = 0;

  const cacheStmt = db.prepare("SELECT * FROM asset_ai_scores WHERE asset_id = ? AND analysed_at > datetime('now', '-30 days')");
  const insertCache = db.prepare(`
    INSERT OR REPLACE INTO asset_ai_scores
      (asset_id, score, theme, mood, is_hero, subject, suggested_caption, title_pt, city, country, lat, lng, analysed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  const processAsset = async (asset) => {
    const isVideo = asset.type === 'VIDEO';
    const cached = cacheStmt.get(asset.id);

    if (cached) {
      processed++;
      onProgress(processed, total);
      return { asset, score: cached, assetType: asset.type || 'IMAGE' };
    }

    // Videos: skip Gemini analysis, use fallback
    if (isVideo) {
      const score = { ...FALLBACK_SCORE, is_hero: false };
      insertCache.run(
        asset.id, score.score, score.theme, score.mood,
        0, score.subject, score.caption_pt, score.title_pt,
        null, null, null, null,
      );
      processed++;
      onProgress(processed, total);
      return { asset, score, assetType: 'VIDEO' };
    }

    // Fetch EXIF and thumb in parallel
    const [thumbBase64, exif] = await Promise.all([
      fetchThumbFn(asset.id).catch(() => null),
      fetchExifFn(asset.id).catch(() => null),
    ]);

    const locationContext = exif
      ? { city: exif.city, country: exif.country, date: asset.fileCreatedAt }
      : { date: asset.fileCreatedAt };

    const score = thumbBase64
      ? await analysePhoto(thumbBase64, 'image/jpeg', locationContext)
      : { ...FALLBACK_SCORE };

    score.title_pt = score.title_pt || '';
    score.city = exif?.city || null;
    score.country = exif?.country || null;
    score.lat = exif?.lat || null;
    score.lng = exif?.lng || null;

    insertCache.run(
      asset.id, score.score, score.theme, score.mood,
      score.is_hero ? 1 : 0, score.subject, score.caption_pt, score.title_pt,
      score.city, score.country, score.lat, score.lng,
    );

    processed++;
    onProgress(processed, total);
    return { asset, score, assetType: 'IMAGE' };
  };

  for (let i = 0; i < assets.length; i += batchSize) {
    const batch = assets.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((asset) => limit(() => processAsset(asset))));
    results.push(...batchResults);
  }

  return results;
}

async function generateCaption(base64Image, mimeType = 'image/jpeg', context = {}) {
  const ai = getClient();
  const locationLine = context.city
    ? `Local: ${context.city}${context.country ? ', ' + context.country : ''}`
    : '';
  const dateLine = context.date ? `Data: ${context.date.slice(0, 10)}` : '';
  const peopleLine = context.people?.length ? `Pessoas: ${context.people.join(', ')}` : '';
  const ctxBlock = [locationLine, dateLine, peopleLine].filter(Boolean).join('\n');

  const prompt = `Escreve UMA frase poética em português europeu (máx. 15 palavras) para usar como legenda desta fotografia. Sem clichés, sem hashtags. Responde APENAS com a frase, sem aspas.${ctxBlock ? '\n\n' + ctxBlock : ''}`;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{
        parts: [
          { inlineData: { mimeType, data: base64Image } },
          { text: prompt },
        ],
      }],
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    return (response.text?.().trim() || '').replace(/^["«»]|["«»]$/g, '');
  }).catch(() => '');
}

async function generateStoryConcepts(albumSummary, sampleBase64Images) {
  const ai = getClient();
  const { peopleNames, cities, dateRange, totalPhotos, favoritesCount, dominantTags } = albumSummary;

  const metaSummary = [
    `Total de fotos: ${totalPhotos}`,
    favoritesCount ? `Favoritas: ${favoritesCount}` : '',
    peopleNames.length ? `Pessoas identificadas: ${peopleNames.join(', ')}` : '',
    cities.length ? `Localizações: ${cities.join(', ')}` : '',
    dateRange ? `Período: ${dateRange.from} a ${dateRange.to}` : '',
    dominantTags.length ? `Tags dominantes: ${dominantTags.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `És um editor de histórias visuais. Com base nestas fotografias e nos seus metadados, sugere EXACTAMENTE 3 conceitos distintos de story narrativa.

Metadados do álbum:
${metaSummary}

Cada conceito deve ter uma abordagem diferente de organização: por exemplo cronológica, por pessoa, por localização, por tema visual, ou mista.

Responde APENAS com JSON válido, sem markdown, sem explicação:
[
  {
    "title_pt": "título em PT (máx 6 palavras)",
    "description_pt": "descrição em 2 frases em PT, poética mas concisa",
    "strategy": "chronological|by_person|by_location|by_theme|mixed",
    "tone": "palavra que descreve o tom: nostálgico|aventureiro|íntimo|documental|lírico",
    "hero_hint": "descreve em inglês qual foto seria o hero ideal (ex: 'sunset over Lisbon waterfront')"
  }
]`;

  const parts = sampleBase64Images.slice(0, 10).map((img) => ({
    inlineData: { mimeType: 'image/jpeg', data: img },
  }));
  parts.push({ text: prompt });

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ parts }],
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    const text = (response.text?.().trim() || '').replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
    } catch {
      return [];
    }
  }).catch(() => []);
}

module.exports = { analysePhoto, generateNarrative, analyseAlbumBatch, generateCaption, generateStoryConcepts };
