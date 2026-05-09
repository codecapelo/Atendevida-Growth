# Atendevida Growth

> Sistema de automação de marketing e tráfego pago para a plataforma de telemedicina **Atendevida**.

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Railway](https://img.shields.io/badge/Railway-Deploy-0B0D0E?logo=railway&logoColor=white)](https://railway.app/)

---

## 📋 Índice

1. [Visão Geral](#-visão-geral)
2. [Contexto de Negócio](#-contexto-de-negócio)
3. [Relação com `atendevida-railway`](#-relação-com-atendevida-railway)
4. [Stack Técnica](#-stack-técnica)
5. [Estrutura do Projeto](#-estrutura-do-projeto)
6. [Banco de Dados](#-banco-de-dados)
7. [Variáveis de Ambiente](#-variáveis-de-ambiente)
8. [Setup Local](#-setup-local)
9. [Especificação dos Módulos](#-especificação-dos-módulos)
10. [Cron e Agendamento](#-cron-e-agendamento)
11. [Conformidade CFM e LGPD](#-conformidade-cfm-e-lgpd)
12. [Testes](#-testes)
13. [Deploy na Railway](#-deploy-na-railway)
14. [Convenções de Código](#-convenções-de-código)
15. [Roadmap](#-roadmap)
16. [Instruções para Claude Code](#-instruções-para-claude-code)

---

## 🎯 Visão Geral

`atendevida-growth` é um serviço Node.js separado, responsável por:

- **Gerar conteúdo orgânico** para Instagram via Claude API
- **Publicar posts automaticamente** 3x ao dia em horários estratégicos
- **Persistir histórico e métricas** para análise e impulsionamento posterior
- **Servir como fonte de verdade** do calendário editorial (alimentado pelo Project no Claude.ai)

Ele **não toca dados de pacientes**. Sua única interface com o app principal é a tabela `atendevida_social_posts` no Supabase.

---

## 🏥 Contexto de Negócio

### O que é o Atendevida

Plataforma de telemedicina nacional que oferece:

- **Pronto atendimento virtual 24/7** com clínico geral
- **Renovação de receitas médicas online**
- **Atendimento em todo o território brasileiro**

### Empresa
- Razão social: **R. Lima Capelo LTDA** (Capelo Serviços Médicos)
- CEO e Diretor Clínico: **Dr. Raul Lima Capelo**
- Sede: Eusébio/CE

### Público-alvo (persona)

Trabalhador **CLT brasileiro** (carteira assinada), 25-55 anos:

- Tem plano de saúde ruim ou só SUS
- Não pode faltar trabalho para ir ao médico
- Adoece à noite, fim de semana ou feriado
- Precisa renovar receita de uso contínuo (anti-hipertensivo, antidepressivo, anticoncepcional)
- Mora em cidade pequena sem especialista próximo
- Renda R$ 2k–R$ 8k/mês, sensível a preço, valoriza praticidade

### Pilares de conteúdo

1. **Educação médica** (quando procurar pronto atendimento)
2. **Casos comuns** ("dor de garganta de madrugada, e agora?")
3. **Bastidores éticos** (sem expor pacientes)
4. **Mitos sobre telemedicina**
5. **Renovação de receita** (alto volume de busca)

---

## 🔗 Relação com `atendevida-railway`

Este projeto **não importa nada** do app principal. Comunicação via Supabase apenas.

```
┌──────────────────────┐         ┌──────────────────────┐
│  atendevida-railway  │         │  atendevida-growth   │
│  (app clínico)       │         │  (este projeto)      │
└──────────┬───────────┘         └──────────┬───────────┘
           │                                │
           │ R/W tabelas clínicas           │ R/W somente
           │ (users, patients, etc.)        │ atendevida_social_posts
           ↓                                ↓
    ┌────────────────────────────────────────────┐
    │         Supabase (PostgreSQL)               │
    └────────────────────────────────────────────┘
```

**Regras invioláveis:**

- ❌ Nunca ler tabelas `atendevida_patients`, `atendevida_doctors`, `atendevida_users`, `atendevida_mevo_*` daqui
- ❌ Nunca usar `service_role_key` para acessar dados clínicos
- ✅ Restringir queries somente à tabela `atendevida_social_posts`
- ✅ Validar via RLS no Supabase (camada extra de segurança)

---

## 🛠 Stack Técnica

| Camada | Tecnologia | Versão | Propósito |
|---|---|---|---|
| Runtime | Node.js | 20.x LTS | Execução |
| Framework HTTP | Express | 4.x | Healthcheck e webhooks futuros |
| Cron | node-cron | 3.x | Agendamento dos posts |
| LLM | @anthropic-ai/sdk | latest | Geração e refinamento de copy |
| Database | @supabase/supabase-js | 2.x | Cliente Supabase |
| HTTP client | axios | 1.x | Chamadas Meta Graph API |
| Validação | zod | 3.x | Schemas de entrada |
| Logs | pino | 9.x | Logs estruturados |
| Env | dotenv | 16.x | Variáveis locais |
| Testes | vitest | 1.x | Unit + integração |

---

## 📂 Estrutura do Projeto

```
atendevida-growth/
├── src/
│   ├── server.js                  # Express minimalista (healthcheck + cron loader)
│   ├── jobs/
│   │   ├── instagram-poster.js    # Orquestração: pega post → posta → atualiza
│   │   └── metrics-collector.js   # Roda 1x/dia, busca insights da Meta
│   ├── services/
│   │   ├── caption-generator.js   # Wrapper da Claude API
│   │   ├── meta-publisher.js      # Wrapper da Meta Graph API
│   │   └── supabase-client.js     # Cliente único reutilizável
│   ├── lib/
│   │   ├── logger.js              # Pino configurado
│   │   ├── prompts.js             # Templates de prompts para Claude
│   │   └── compliance.js          # Validador anti-CFM (regex de termos proibidos)
│   ├── config/
│   │   ├── env.js                 # Validação de env vars com Zod
│   │   └── schedule.js            # Horários e timezone
│   └── routes/
│       ├── health.js              # GET /health
│       └── webhook.js             # POST /webhook/meta (futuro)
├── tests/
│   ├── caption-generator.test.js
│   ├── meta-publisher.test.js
│   └── compliance.test.js
├── scripts/
│   ├── seed-posts.js              # Popula tabela com posts de exemplo
│   └── test-meta-token.js         # Valida token sem postar
├── .env.example
├── .gitignore
├── .nvmrc
├── package.json
├── railway.json
└── README.md
```

---

## 🗄 Banco de Dados

### Schema da tabela `atendevida_social_posts`

Rode no SQL Editor do Supabase **antes** de iniciar o projeto:

```sql
-- ═══════════════════════════════════════════════════════════
-- TABELA: atendevida_social_posts
-- Calendário editorial e histórico de publicações no Instagram
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS atendevida_social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Agendamento
  data_agendada DATE NOT NULL,
  horario TIME NOT NULL,
  janela TEXT NOT NULL CHECK (janela IN ('manha', 'almoco', 'noite')),
  timezone TEXT NOT NULL DEFAULT 'America/Fortaleza',

  -- Conteúdo
  pilar TEXT NOT NULL CHECK (pilar IN (
    'educacao', 'casos_comuns', 'bastidores',
    'mitos', 'renovacao_receita'
  )),
  formato TEXT NOT NULL CHECK (formato IN (
    'carrossel', 'reel', 'estatico', 'story'
  )),
  tema TEXT NOT NULL,
  copy_principal TEXT NOT NULL,
  copy_curta TEXT,
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  cta TEXT,

  -- Mídia
  imagem_url TEXT,
  imagem_prompt TEXT,
  video_url TEXT,

  -- Estado e rastreamento
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN (
    'rascunho', 'agendado', 'publicando', 'publicado', 'falhou', 'cancelado'
  )),
  instagram_post_id TEXT,
  instagram_permalink TEXT,
  erro_mensagem TEXT,

  -- Métricas (preenchidas pelo metrics-collector)
  metricas JSONB DEFAULT '{}',
  -- Ex: { "impressions": 1234, "reach": 890, "likes": 45, "saves": 12 }

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  posted_at TIMESTAMPTZ,
  metrics_collected_at TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX idx_social_posts_status_data
  ON atendevida_social_posts (status, data_agendada);
CREATE INDEX idx_social_posts_pilar
  ON atendevida_social_posts (pilar);
CREATE INDEX idx_social_posts_posted_at
  ON atendevida_social_posts (posted_at DESC) WHERE posted_at IS NOT NULL;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_social_posts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_social_posts_updated_at
  BEFORE UPDATE ON atendevida_social_posts
  FOR EACH ROW EXECUTE FUNCTION update_social_posts_timestamp();

-- Row Level Security
ALTER TABLE atendevida_social_posts ENABLE ROW LEVEL SECURITY;

-- Policy: somente service_role pode mexer
CREATE POLICY "service_role_full_access"
  ON atendevida_social_posts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

### Query do post do dia/janela

```sql
SELECT *
FROM atendevida_social_posts
WHERE status = 'agendado'
  AND data_agendada = CURRENT_DATE
  AND janela = $1  -- 'manha' | 'almoco' | 'noite'
ORDER BY horario ASC
LIMIT 1;
```

---

## 🔐 Variáveis de Ambiente

Crie um `.env` local (não commitar) e configure no Railway:

```bash
# ─── Node ─────────────────────────────────────────────
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# ─── Supabase ────────────────────────────────────────
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx
# ⚠️ NUNCA usar a anon key. Service role é necessária pro cron bypassar RLS.

# ─── Anthropic (Claude API) ──────────────────────────
ANTHROPIC_API_KEY=sk-ant-xxxxx
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# ─── Meta Graph API (Instagram) ──────────────────────
META_ACCESS_TOKEN=EAABxxxxx
META_IG_BUSINESS_ID=17841xxxxx
META_GRAPH_API_VERSION=v21.0

# ─── Configuração de horários ────────────────────────
TZ=America/Fortaleza
SCHEDULE_MORNING=0 7 * * *
SCHEDULE_LUNCH=0 12 * * *
SCHEDULE_NIGHT=0 21 * * *
SCHEDULE_METRICS=0 3 * * *

# ─── Feature flags ───────────────────────────────────
ENABLE_AUTOPOST=true
ENABLE_METRICS_COLLECTOR=true
DRY_RUN=false  # se true, gera copy mas não publica
```

`.env.example` deve ter todos os campos com valores fictícios.

---

## 🚀 Setup Local

### Pré-requisitos

- Node.js 20.x (use `nvm` — tem `.nvmrc` no repo)
- Conta Supabase com projeto criado
- App no [Meta for Developers](https://developers.facebook.com/) com:
  - Permissão `instagram_content_publish`
  - Permissão `instagram_basic`
  - Permissão `pages_show_list`
- Conta Instagram **Business** vinculada a página do Facebook
- Chave da Anthropic API

### Passos

```bash
# 1. Clonar
git clone https://github.com/codecapelo/atendevida-growth.git
cd atendevida-growth

# 2. Instalar deps
nvm use
npm install

# 3. Configurar env
cp .env.example .env
# Editar .env com suas credenciais

# 4. Criar tabela no Supabase
# (rodar o SQL da seção "Banco de Dados" no SQL Editor)

# 5. Testar token da Meta sem postar
npm run test:meta-token

# 6. Popular tabela com posts de exemplo
npm run seed

# 7. Rodar em modo dry-run (não publica)
DRY_RUN=true npm run dev

# 8. Rodar em modo real (publica)
npm run dev
```

---

## 🧩 Especificação dos Módulos

### `src/server.js`

Express mínimo, expõe healthcheck e carrega os crons.

```javascript
// Pseudocódigo de referência
import express from 'express';
import { startCronJobs } from './jobs/instagram-poster.js';
import { startMetricsCollector } from './jobs/metrics-collector.js';
import healthRoute from './routes/health.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

const app = express();
app.use('/health', healthRoute);

if (env.ENABLE_AUTOPOST) startCronJobs();
if (env.ENABLE_METRICS_COLLECTOR) startMetricsCollector();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Server up');
});
```

---

### `src/jobs/instagram-poster.js`

Orquestrador. Para cada janela (manhã/almoço/noite):

1. Busca post do dia/janela com `status = 'agendado'`
2. Marca como `'publicando'` (lock otimista)
3. Chama `caption-generator` para refinar a copy
4. Roda validador `compliance.js` — se falhar, marca `'falhou'` com motivo
5. Chama `meta-publisher.publish()`
6. Atualiza linha com `instagram_post_id`, `instagram_permalink`, `posted_at`, `status = 'publicado'`
7. Em caso de erro: log + marca `'falhou'` + alerta (opcional: webhook Slack/Telegram)

**Tratamento de erros obrigatório:**

- Retry com backoff exponencial (3 tentativas) em erros de rede
- Não retry em erros 4xx da Meta
- Sempre logar `request_id` da Meta quando disponível

---

### `src/services/caption-generator.js`

Wrapper da Claude API. Recebe um `post` e retorna `{ caption, hashtags }`.

```javascript
async function refineCaption(post) {
  const prompt = buildPrompt(post); // de lib/prompts.js
  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });
  return parseResponse(response);
}
```

**Prompt template** (em `src/lib/prompts.js`):

```
Você é o redator do Atendevida, plataforma de telemedicina 24/7
para trabalhadores CLT no Brasil.

Refine este post para o Instagram mantendo:
- Tom acolhedor mas técnico
- Foco na dor do CLT (sem tempo, sem dinheiro, sem acesso)
- CTA claro: "Atendimento em minutos pelo link da bio"
- 10 hashtags relevantes
- 220 caracteres na copy_curta

NUNCA:
- Prometer cura, diagnóstico garantido ou resultado
- Mencionar medicamento controlado por nome
- Usar antes/depois, sensacionalismo
- Substituir o CRM/responsável técnico

Pilar: {pilar}
Tema: {tema}
Copy base: {copy_principal}

Retorne em JSON:
{
  "caption": "texto completo do post",
  "hashtags": ["#tag1", "#tag2", ...],
  "copy_curta": "versão de 220 chars"
}
```

---

### `src/services/meta-publisher.js`

Wrapper da Meta Graph API. Implementa o fluxo de 2 etapas:

```javascript
// 1. Criar container de mídia
const containerRes = await axios.post(
  `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${env.META_IG_BUSINESS_ID}/media`,
  {
    image_url: post.imagem_url,
    caption: caption,
    access_token: env.META_ACCESS_TOKEN,
  }
);
const creationId = containerRes.data.id;

// 2. Publicar container
const publishRes = await axios.post(
  `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${env.META_IG_BUSINESS_ID}/media_publish`,
  {
    creation_id: creationId,
    access_token: env.META_ACCESS_TOKEN,
  }
);
const igPostId = publishRes.data.id;

// 3. Buscar permalink
const permaRes = await axios.get(
  `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${igPostId}`,
  { params: { fields: 'permalink', access_token: env.META_ACCESS_TOKEN } }
);
return { igPostId, permalink: permaRes.data.permalink };
```

**Para Reels** (vídeo): usar `media_type=REELS` e `video_url`. Aguardar `status_code = FINISHED` antes de publicar (polling a cada 5s, timeout de 5min).

---

### `src/services/supabase-client.js`

Singleton do cliente Supabase. **Sempre** inicializado com `service_role_key`:

```javascript
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);
```

---

### `src/lib/compliance.js`

Validador anti-CFM. Regex contra termos proibidos. Retorna `{ valid, violations }`.

```javascript
const TERMOS_PROIBIDOS = [
  /\bcura(do|da)?\b/i,
  /\bgarant(ido|ida|imos)\b/i,
  /\bantes e depois\b/i,
  /\bmilagre/i,
  /\b100% (eficaz|seguro)\b/i,
  /\bsem efeitos colaterais\b/i,
];

export function validateCaption(caption) {
  const violations = TERMOS_PROIBIDOS
    .filter(rx => rx.test(caption))
    .map(rx => rx.source);
  return { valid: violations.length === 0, violations };
}
```

---

### `src/jobs/metrics-collector.js`

Roda 1x/dia (3h da manhã). Para cada post `'publicado'` dos últimos 7 dias:

1. Busca insights via `GET /{ig-media-id}/insights?metric=impressions,reach,likes,saves,comments,shares`
2. Atualiza `metricas` (JSONB) e `metrics_collected_at`
3. Loga top 3 da semana para análise futura

---

## ⏰ Cron e Agendamento

3 janelas otimizadas para CLT:

| Janela | Hora (BRT) | Cron expression | Racional |
|---|---|---|---|
| Manhã | 07:00 | `0 7 * * *` | Antes de bater ponto |
| Almoço | 12:00 | `0 12 * * *` | Hora de almoço |
| Noite | 21:00 | `0 21 * * *` | Depois do jantar |
| Métricas | 03:00 | `0 3 * * *` | Madrugada (sem load) |

Timezone fixa: `America/Fortaleza` (sem horário de verão).

---

## ⚖️ Conformidade CFM e LGPD

### CFM
- **Resolução 2.314/2022** (telemedicina)
- **Resolução 2.336/2023** (publicidade médica)

Toda copy precisa:
- ✅ Incluir CRM do responsável técnico nos materiais
- ❌ Não prometer cura, diagnóstico ou resultado
- ❌ Não usar antes/depois ou sensacionalismo
- ❌ Não mencionar medicamento controlado (azul/amarela) por nome
- ❌ Não usar "consulta grátis" como gancho principal

### LGPD
- ❌ Nenhum dado de paciente em copy sem autorização escrita
- ❌ Depoimentos só com termo assinado
- ✅ Logs sem PII (sem nome, email, CPF, telefone)

### Validador automatizado

`compliance.js` roda **antes** de cada publicação. Se detectar violação:
- Marca o post como `'falhou'`
- Salva `erro_mensagem` com a violação
- **Não publica** e alerta o operador

---

## 🧪 Testes

```bash
npm test              # roda todos os testes
npm run test:watch    # modo watch
npm run test:cov      # cobertura
```

**Testes obrigatórios:**

| Arquivo | Cobertura mínima |
|---|---|
| `compliance.test.js` | 100% — toda regex testada |
| `caption-generator.test.js` | mock da Claude API |
| `meta-publisher.test.js` | mock do axios |
| `instagram-poster.test.js` | fluxo de retry e estados |

---

## 🚂 Deploy na Railway

### Estrutura no Railway

```
Project: Atendevida
├── Service: atendevida-railway (existente)
└── Service: atendevida-growth (novo)
```

### `railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node src/server.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### Passos

1. `gh repo create atendevida-growth --private --source=. --push`
2. No Railway: New Service → Deploy from GitHub → escolher `atendevida-growth`
3. Configurar Variables (copiar do `.env`)
4. Verificar logs: deve aparecer `Server up` + `Cron jobs started`

---

## 📐 Convenções de Código

- **Módulos ES** (`"type": "module"` no `package.json`)
- **Nada de `var`**, sempre `const`/`let`
- **Async/await** sempre, nunca `.then()` em cadeia
- **Erros** sempre tipados com `class Error` customizada quando faz sentido (`MetaPublishError`, `ComplianceError`)
- **Logs estruturados** via Pino: `logger.info({ post_id, janela }, 'Posting')` — nunca `console.log`
- **Sem PII em logs**: nunca logar caption completa, só os primeiros 50 chars
- **Imports absolutos** via `imports` no `package.json`: `import { logger } from '#lib/logger.js'`
- **Nomes em inglês** no código, **comentários em pt-BR** quando explicar regra de negócio brasileira

### Lint e formato

```bash
npm run lint    # ESLint
npm run format  # Prettier
```

Pre-commit hook via `husky` + `lint-staged`.

---

## 🗺 Roadmap

### v0.1 — MVP (sprint 1)
- [x] Schema Supabase
- [ ] Estrutura base do projeto
- [ ] Cron + posting básico
- [ ] Validador CFM
- [ ] Deploy Railway

### v0.2 — Métricas (sprint 2)
- [ ] `metrics-collector` rodando
- [ ] Endpoint `/dashboard` com top posts da semana
- [ ] Webhook de notificação (Slack/Telegram) em falhas

### v0.3 — Reels (sprint 3)
- [ ] Suporte a `media_type=REELS`
- [ ] Polling de processamento de vídeo
- [ ] Geração automática de capa via OG image generator

### v0.4 — Tráfego pago (sprint 4)
- [ ] Identificar top 3 posts da semana automaticamente
- [ ] Endpoint para gerar copy de Ad a partir de post orgânico
- [ ] Integração com Meta Marketing API (criação de campanhas)
- [ ] **Atenção**: Ads precisam de aprovação humana antes de subir

### v1.0 — Multi-canal
- [ ] TikTok via TikTok Business API
- [ ] LinkedIn (B2B para RH de empresas)
- [ ] WhatsApp Business para nutrição de leads

---

## 🤖 Instruções para Claude Code

> Esta seção é o briefing direto para você, Claude Code, ao construir este projeto.

### Princípios

1. **Construa em ordem incremental.** Não tente fazer tudo de uma vez. Comece pelo `health` endpoint e vá adicionando.
2. **Cada módulo é independente.** Rode os testes do módulo antes de integrar.
3. **Quando em dúvida, pergunte ao Raul** antes de inferir regra de negócio. Ele é médico e CEO — a opinião dele sobre CFM/clínica é definitiva.
4. **Não invente endpoints da Meta API.** Sempre referencie a [doc oficial Instagram Graph API](https://developers.facebook.com/docs/instagram-api).
5. **Não toque em `atendevida-railway`.** Este projeto é isolado.

### Ordem sugerida de implementação

```
1. package.json + .nvmrc + .gitignore + .env.example
2. src/config/env.js (Zod schema)
3. src/lib/logger.js
4. src/services/supabase-client.js
5. src/lib/compliance.js + tests
6. src/services/caption-generator.js + tests (com mock)
7. src/services/meta-publisher.js + tests (com mock)
8. src/jobs/instagram-poster.js + tests
9. src/server.js (junta tudo)
10. src/jobs/metrics-collector.js
11. railway.json + deploy
```

### Quando criar PR

- 1 PR por módulo, no máximo 400 linhas
- Sempre rodar `npm test` antes de abrir
- Descrição em PT-BR explicando o que muda e por quê
- Marcar `@codecapelo` como reviewer

### Pontos de atenção específicos

- **Token da Meta expira a cada 60 dias.** Implementar refresh automático via `/oauth/access_token` é v0.2.
- **Rate limit da Meta**: 200 chamadas/hora por usuário. Não é problema com 3 posts/dia, mas o `metrics-collector` pode estourar — limitar a 50 chamadas com pausa de 1s.
- **Imagens precisam estar em URL pública.** Use o bucket `mevo-documents` do Supabase Storage com leitura pública (criar política específica) ou um bucket novo `social-media-assets`.
- **DRY_RUN=true não chama a Meta API.** Use sempre na primeira execução em produção.

---

## 📞 Contato

- **Dr. Raul Lima Capelo** — CEO/CTO
- GitHub: [@codecapelo](https://github.com/codecapelo)

---

## 📄 Licença

Proprietary. Todos os direitos reservados a R. Lima Capelo LTDA.
