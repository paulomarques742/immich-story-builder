# Memoire — Auto-Layout Inteligente com Gemini 3 Flash
**Especificação Técnica — Fase 3**

---

## 1. Visão Geral

Esta especificação descreve a implementação do **Auto-Layout Inteligente** para o Memoire — uma funcionalidade que analisa automaticamente as fotos de um álbum Immich através do modelo **Gemini 3 Flash** (Google AI) e gera a estrutura narrativa da story sem intervenção manual.

O utilizador importa um álbum e, em vez de receber uma grelha uniforme, recebe uma story já composta: heroes seleccionados pelas melhores fotos, secções temáticas com frases narrativas, e grids organizadas por relevância.

### 1.1 Objectivos

- Seleccionar automaticamente as melhores fotos como hero blocks
- Agrupar fotos por tema/mood (não apenas por data)
- Gerar text blocks com frases narrativas em português
- Minimizar custo de API — análise assíncrona em batch com cache por asset
- Preservar a capacidade de edição manual posterior

### 1.2 Modelo de IA Seleccionado

| Parâmetro | Valor |
|---|---|
| **Modelo** | `gemini-3-flash-preview` |
| **SDK** | `@google/genai` (novo SDK unificado Google) |
| **Input tokens** | $0.50 / 1M tokens |
| **Output tokens** | $3.00 / 1M tokens |
| **Custo estimado por álbum (200 fotos)** | ~$0.065 |
| **Free tier** | 1 500 req/dia (desenvolvimento) |
| **Thinking level** | `minimal` (para análise de fotos — sem reasoning overhead) |

> **Nota:** Usar `gemini-3-flash-preview` via Google AI Studio (não Vertex AI). A chave API é obtida em [ai.dev](https://ai.dev) e configurada via `GEMINI_API_KEY` no `.env`.

---

## 2. Variáveis de Ambiente

Adicionar ao `.env` e ao `docker-compose.yml`:

| Variável | Obrigatório | Default | Descrição |
|---|---|---|---|
| `GEMINI_API_KEY` | Sim (para AI) | — | Chave da Google AI Studio |
| `GEMINI_MODEL` | Não | `gemini-3-flash-preview` | Model ID |
| `AI_BATCH_SIZE` | Não | `10` | Fotos por batch |
| `AI_CONCURRENCY` | Não | `3` | Batches paralelos simultâneos |

> Se `GEMINI_API_KEY` estiver ausente, o endpoint retorna `501 Not Implemented` com mensagem clara. A funcionalidade é gracefully degraded — o import normal continua a funcionar sem alterações.

---

## 3. Endpoints Novos no Backend

### 3.1 `POST /api/stories/:storyId/blocks/ai-layout`

Endpoint principal. Analisa as fotos dos álbuns seleccionados via Gemini e gera os blocos da story de forma assíncrona.

**Request body:**
```json
{
  "album_ids": ["uuid1", "uuid2"],
  "language": "pt",
  "replace_existing": false
}
```

| Campo | Tipo | Default | Descrição |
|---|---|---|---|
| `album_ids` | `string[]` | — | IDs dos álbuns Immich (obrigatório) |
| `language` | `string` | `"pt"` | Idioma das frases geradas (`pt` / `en` / `es`) |
| `replace_existing` | `boolean` | `false` | Se `true`, apaga blocos existentes antes de inserir |

**Response (202 Accepted):**
```json
{
  "job_id": "uuid",
  "status": "processing",
  "total_assets": 87
}
```

> O endpoint retorna imediatamente. O processamento ocorre em background. O frontend faz polling via `GET /api/jobs/:jobId`.

---

### 3.2 `GET /api/jobs/:jobId`

Polling do estado do job de análise AI.

**Response:**
```json
{
  "status": "processing",
  "progress": 42,
  "processed": 37,
  "total": 87,
  "blocks_created": 0,
  "error": null
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `status` | `string` | `"pending"` \| `"processing"` \| `"done"` \| `"error"` |
| `progress` | `number` | Percentagem 0–100 |
| `processed` | `number` | Fotos analisadas até ao momento |
| `total` | `number` | Total de fotos a analisar |
| `blocks_created` | `number` | Blocos gerados (disponível quando `done`) |
| `error` | `string \| null` | Mensagem de erro (quando `status = "error"`) |

> O frontend faz polling a cada 2 segundos. Quando `status = "done"`, recarrega os blocos da story e fecha o modal de progresso.

---

## 4. Alterações à Base de Dados

### 4.1 Nova tabela: `ai_jobs`

```sql
CREATE TABLE IF NOT EXISTS ai_jobs (
  id             TEXT PRIMARY KEY,
  story_id       TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending',
  progress       INTEGER DEFAULT 0,
  processed      INTEGER DEFAULT 0,
  total          INTEGER DEFAULT 0,
  blocks_created INTEGER DEFAULT 0,
  error          TEXT,
  created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at     TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 Nova tabela: `asset_ai_scores`

Cache dos scores por asset — evita re-análise se o mesmo asset aparecer em múltiplas stories.

```sql
CREATE TABLE IF NOT EXISTS asset_ai_scores (
  asset_id          TEXT PRIMARY KEY,
  score             REAL,
  theme             TEXT,
  mood              TEXT,
  is_hero           INTEGER DEFAULT 0,
  subject           TEXT,
  suggested_caption TEXT,
  analysed_at       TEXT DEFAULT CURRENT_TIMESTAMP
);
```

> Se `asset_id` já existe em `asset_ai_scores` com `analysed_at` nas últimas 30 dias, reutilizar o score sem chamar a API Gemini.

Adicionar ambos os `CREATE TABLE IF NOT EXISTS` em `backend/src/db.js`, junto com as tabelas existentes.

---

## 5. Lógica de Análise AI

### 5.1 Preparação das imagens

Para cada asset, fazer fetch da thumbnail via o endpoint já existente `/api/immich/assets/:id/thumb?size=preview` e converter para base64.

- Usar o tamanho `preview` (~512px) — suficiente para análise, baixo custo em tokens
- Processar em batches de `AI_BATCH_SIZE` fotos (default 10)
- Batches paralelos limitados por `AI_CONCURRENCY` (default 3) usando `p-limit`
- Em caso de erro 429 (rate limit), retry com backoff exponencial: 2s → 4s → 8s → desistir

### 5.2 Prompt de análise individual

Para cada foto, enviar ao Gemini com `thinking_level: "minimal"`:

```
Analyse this photo and respond ONLY with valid JSON, no markdown, no explanation.

Schema:
{
  "score": number 1-10,
  "theme": string,
  "mood": string,
  "subject": string,
  "is_hero": boolean,
  "caption_pt": string
}

score = overall quality (composition, sharpness, visual interest).
theme = one of: landscape, portrait, group, food, architecture, detail, night, water, event, travel.
mood = one of: joyful, serene, dramatic, intimate, nostalgic, energetic, melancholic.
subject = brief description in English (max 5 words).
is_hero = true only if this photo deserves to be a full-width hero (excellent composition, clear subject, strong emotional impact).
caption_pt = one poetic sentence in European Portuguese (max 15 words), suitable as a story caption. No clichés.
```

> Sempre fazer `JSON.parse` com try/catch. Se falhar, atribuir `{ score: 5, is_hero: false, theme: "travel", mood: "serene" }` e continuar o batch sem interromper.

### 5.3 Agrupamento temático

Após receber os scores de todas as fotos:

1. Ordenar assets por `fileCreatedAt` (cronológico)
2. Agrupar por tema se ≥ 3 fotos consecutivas partilharem o mesmo tema
3. Grupos com < 3 fotos são absorvidos pelo grupo anterior/posterior
4. Dentro de cada grupo, ordenar por `score` decrescente para selecção do hero
5. Se nenhum tema dominar, fallback para agrupamento por dia (comportamento actual do `import-album`)

### 5.4 Regras de geração de blocos

| Situação | Bloco gerado |
|---|---|
| Início da story | `hero` com a foto de maior score geral |
| Início de novo grupo temático | `text` com frase narrativa → `hero` do melhor score do grupo |
| Fotos com score ≥ 7 num grupo | `grid` com `columns: 1` (foto full-width individual) |
| Fotos com score 4–6 | `grid` com `columns: 3, aspect: "square"` |
| Fotos com score < 4 | `grid` com `columns: 4, aspect: "square"` |
| Transição entre grupos | `divider` com label do tema (ex: `"Paisagem · Alentejo"`) |
| Fim da story | `text` com frase de encerramento gerada por AI |

### 5.5 Geração de text blocks narrativos

Para cada grupo, fazer **uma segunda chamada** ao Gemini com as 3 melhores fotos do grupo:

```
You are a travel writer. Given these photos from a section with theme "{theme}",
write a short narrative paragraph in {language}.
Max 3 sentences. Poetic but not sentimental.
Focus on light, space, feeling. No hashtags, no clichés.
Respond ONLY with the text, no JSON, no quotes.
```

> Esta chamada é feita uma vez por grupo (não por foto) — minimiza custo. Com `language: "pt"`, o texto é gerado directamente em português europeu.

---

## 6. Ficheiros a Criar e Modificar

### 6.1 Backend — ficheiros novos

| Ficheiro | Descrição |
|---|---|
| `backend/src/services/gemini.js` | Cliente Gemini: `analysePhoto()`, `generateNarrative()`, `analyseAlbumBatch()` |
| `backend/src/services/autoLayout.js` | Lógica de agrupamento e geração de blocos: `groupByTheme()`, `generateBlocksFromGroups()`, `runAutoLayout()` |
| `backend/src/routes/ai.js` | Router Express: `POST /ai-layout` e `GET /jobs/:jobId` |

### 6.2 Backend — ficheiros a modificar

| Ficheiro | Alteração |
|---|---|
| `backend/src/index.js` | Registar: `const aiRouter = require('./routes/ai'); app.use('/api', aiRouter);` |
| `backend/src/db.js` | Adicionar `CREATE TABLE IF NOT EXISTS ai_jobs` e `asset_ai_scores` na inicialização |
| `.env.example` | Adicionar `GEMINI_API_KEY=`, `GEMINI_MODEL=gemini-3-flash-preview`, `AI_BATCH_SIZE=10`, `AI_CONCURRENCY=3` |
| `docker-compose.yml` | Adicionar `GEMINI_API_KEY: ${GEMINI_API_KEY}` nos `environment` do serviço backend |

### 6.3 Frontend — ficheiros novos

| Ficheiro | Descrição |
|---|---|
| `frontend/src/components/editor/AiLayoutButton.jsx` | Botão "✨ AI Layout" com modal de configuração (selecção de álbuns, idioma, replace_existing) |
| `frontend/src/components/editor/AiProgressModal.jsx` | Modal de progresso com polling do `job_id`, barra animada e contagem "X / Y fotos analisadas" |
| `frontend/src/hooks/useAiLayout.js` | Hook: `triggerAiLayout()`, `pollJob()`, estado `loading / progress / error` |

### 6.4 Frontend — ficheiros a modificar

| Ficheiro | Alteração |
|---|---|
| `frontend/src/components/editor/EditorTopbar.jsx` | Adicionar `<AiLayoutButton>` entre o botão "↓ Importar álbum" e "Publicar" |

---

## 7. Fluxo do Utilizador

### 7.1 Happy path

1. Utilizador clica **"✨ AI Layout"** na topbar do editor
2. Modal abre: selecção de álbuns Immich + opção de idioma (PT / EN) + checkbox "Substituir blocos existentes"
3. Clica **"Gerar story"** → `POST /api/stories/:id/blocks/ai-layout` → recebe `job_id`
4. Modal de progresso aparece com barra animada e contagem em tempo real
5. Polling a cada 2s via `GET /api/jobs/:jobId`
6. Quando `status = "done"`: modal fecha, blocos carregam no editor
7. Utilizador vê a story gerada e pode editar manualmente qualquer bloco

### 7.2 Cenários de erro / fallback

| Situação | Comportamento |
|---|---|
| `GEMINI_API_KEY` ausente | Botão "✨ AI Layout" aparece com badge `"Config necessária"` e tooltip a explicar |
| API Gemini retorna 429 | Retry automático com backoff; se esgotar tentativas, marcar job como `"error"` |
| Foto individual falha parsing | Score 5, `is_hero: false`, continuar batch sem interromper |
| Timeout geral (> 5 min) | Marcar job como `"error"`, mostrar botão "Tentar novamente" |
| `replace_existing: false` com blocos existentes | Novos blocos adicionados a seguir aos existentes |

---

## 8. Dependências

### 8.1 Backend — instalar

```bash
cd backend && npm install @google/genai p-limit
```

| Package | Versão | Uso |
|---|---|---|
| `@google/genai` | `^1.0.0` | SDK oficial Google AI (novo SDK unificado — não usar `@google/generative-ai`) |
| `p-limit` | `^5.0.0` | Controlar concorrência dos batches |

### 8.2 Frontend

Sem dependências novas — usar `fetch` e hooks existentes.

---

## 9. Estrutura dos Serviços

### 9.1 `backend/src/services/gemini.js`

```javascript
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Analisa uma foto individual, retorna JSON com score/theme/mood/is_hero/caption_pt
async function analysePhoto(base64Image, mimeType = 'image/jpeg') { ... }

// Gera parágrafo narrativo para um grupo de fotos
async function generateNarrative(base64Images, theme, language = 'pt') { ... }

// Processa um álbum completo em batches com controlo de concorrência
// onProgress(processed, total) é chamado a cada foto concluída
async function analyseAlbumBatch(assets, fetchThumbFn, onProgress) { ... }

module.exports = { analysePhoto, generateNarrative, analyseAlbumBatch };
```

**Notas de implementação:**
- `thinking_level: "minimal"` em todas as chamadas de análise de foto (reduz custo e latência)
- Retry com backoff exponencial em caso de erro 429 ou 503
- Se `GEMINI_API_KEY` não estiver definido, as funções lançam `Error('GEMINI_API_KEY not configured')`

### 9.2 `backend/src/services/autoLayout.js`

```javascript
// Agrupa assets scored por tema (≥ 3 fotos consecutivas do mesmo tema)
function groupByTheme(scoredAssets) { ... }

// Converte grupos em array de blocos prontos para inserção na DB
async function generateBlocksFromGroups(groups, language) { ... }

// Função principal: orquestra análise + geração + inserção na DB
// Actualiza ai_jobs com progresso a cada batch concluído
async function runAutoLayout(storyId, albumIds, language, replaceExisting, db, immichClient) { ... }

module.exports = { runAutoLayout };
```

### 9.3 `backend/src/routes/ai.js`

```javascript
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const { runAutoLayout } = require('../services/autoLayout');
const db = require('../db');

const router = express.Router();

// POST /api/stories/:storyId/blocks/ai-layout
router.post('/stories/:storyId/blocks/ai-layout', requireAuth, async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(501).json({ error: 'AI Layout não configurado. Adiciona GEMINI_API_KEY ao .env.' });
  }
  // Criar job, retornar job_id, lançar runAutoLayout em background (não await)
  ...
});

// GET /api/jobs/:jobId
router.get('/jobs/:jobId', requireAuth, (req, res) => {
  const job = db.prepare('SELECT * FROM ai_jobs WHERE id = ?').get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

module.exports = router;
```

---

## 10. Checklist de Implementação

### Backend
- [ ] `cd backend && npm install @google/genai p-limit`
- [ ] Criar `backend/src/services/gemini.js`
- [ ] Criar `backend/src/services/autoLayout.js`
- [ ] Adicionar tabelas `ai_jobs` e `asset_ai_scores` em `backend/src/db.js`
- [ ] Criar `backend/src/routes/ai.js`
- [ ] Registar router em `backend/src/index.js`
- [ ] Actualizar `.env.example` e `docker-compose.yml`

### Frontend
- [ ] Criar `AiLayoutButton.jsx` com modal de configuração
- [ ] Criar `AiProgressModal.jsx` com polling e barra de progresso
- [ ] Criar `useAiLayout.js` hook
- [ ] Adicionar `AiLayoutButton` ao `EditorTopbar.jsx`

### Validação
- [ ] Testar com álbum de 10 fotos — verificar JSON retornado pelo Gemini
- [ ] Verificar custo na Google AI Console — deve ser < $0.01 para 10 fotos
- [ ] Testar fallback sem `GEMINI_API_KEY`
- [ ] Testar com álbum grande (100+ fotos) — verificar progresso no modal
- [ ] Verificar que `asset_ai_scores` evita re-análise em segunda importação do mesmo álbum

---

*— fim da especificação —*
