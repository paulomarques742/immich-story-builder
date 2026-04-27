# Memoire — Especificação de Design
## Documento de referência para implementação

> Este documento descreve exaustivamente o design visual e de interacção da página pública do Memoire. O HTML de referência (`memoire-story-page.html`) é o protótipo canónico — qualquer divergência deve ser resolvida a favor deste documento.

---

## 1. Filosofia de Design

**Editorial minimalism.** O Memoire apresenta memórias como objectos curados — mais próximo de um livro de fotografia do que de uma galeria digital. Cada decisão de design serve este princípio:

- Generoso espaço negativo — o conteúdo respira
- As fotografias são as protagonistas; a UI recua
- Tipografia com personalidade mas sem ostentação
- Animações que revelam, nunca que distram
- Cor quente, orgânica — não tech

---

## 2. Tokens de Design

### 2.1 Paleta de Cor

Todas as cores são definidas como CSS custom properties no `:root`. Os nomes têm semântica intencional — usar sempre os tokens, nunca valores hardcoded.

```css
/* Texto */
--ink:         #1a1814   /* quase-preto com toque castanho — mais orgânico que #000 */
--ink-soft:    #3d3a35   /* texto secundário, parágrafos de corpo */
--ink-muted:   #7a756d   /* labels, metadata, captions */
--ink-faint:   #b8b2a8   /* placeholders, separadores de texto, datas */

/* Fundo */
--paper:       #faf8f5   /* fundo base — branco creme, nunca branco puro */
--paper-warm:  #f4f0ea   /* fundo de cards, formulários, áreas elevadas */
--paper-deep:  #ede8e0   /* bordas, separadores, fundo de inputs */

/* Acento */
--accent:      #c4795a   /* terracotta — acções primárias, pins de mapa, estado activo */
--accent-soft: #d9957a   /* hover states do acento */
--accent-pale: #f2e4dc   /* fundo de badges com acento, decoração de pull quote */

/* Semântica */
--success:     #5a8a6a
--warning:     #c49a3a
--error:       #b05050
```

#### Dark Mode

Activado automaticamente via `@media (prefers-color-scheme: dark)`. Redefine apenas os tokens — os componentes não mudam.

```css
@media (prefers-color-scheme: dark) {
  --ink:        #e8e2d8
  --ink-soft:   #c8c0b4
  --ink-muted:  #8a8378
  --ink-faint:  #4a4640
  --paper:      #16140f
  --paper-warm: #1f1d17
  --paper-deep: #2a271f
  --accent:     #d9957a   /* ligeiramente mais claro no dark */
  --accent-soft:#c4795a
  --accent-pale:rgba(196,121,90,0.12)
}
```

### 2.2 Tipografia

Dois typefaces, papéis distintos e complementares:

| Token | Fonte | Uso |
|---|---|---|
| `--font-display` | Cormorant Garamond | Títulos, headings de secção, dividers, pull quotes, captions, nome do logo |
| `--font-body` | DM Sans | UI funcional — botões, labels, metadata, parágrafos de corpo, inputs |

**Carregamento:** Google Fonts, pesos `300, 400, 500` em ambos, com variante `italic` para Cormorant Garamond.

```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap" rel="stylesheet">
```

**Regra de ouro:** Cormorant Garamond `italic weight 300` é a voz do Memoire — usada no título hero, dividers, pull quotes e labels das fotos. É o elemento mais distintivo do produto.

#### Escala tipográfica

```
Hero title:        Cormorant Garamond, italic, 300, clamp(3rem, 7vw, 5.5rem), line-height 1.0
Heading de secção: Cormorant Garamond, normal, 400, clamp(2rem, 4vw, 2.8rem), line-height 1.15
Divider label:     Cormorant Garamond, italic, 300, 1.6rem
Pull quote:        Cormorant Garamond, italic, 300, clamp(1.4rem, 3vw, 1.9rem), line-height 1.4
Map title:         Cormorant Garamond, normal, 400, 1.1rem
Comments heading:  Cormorant Garamond, normal, 400, 2rem
Video label:       Cormorant Garamond, italic, 300, 1.2rem

Body paragraph:    DM Sans, 300, 1rem, line-height 1.85
Caption de foto:   DM Sans, italic, 300, 0.8rem
Label uppercase:   DM Sans, 500, 0.7rem, letter-spacing 0.16em, uppercase
Metadata / dates:  DM Sans, 300, 0.72–0.8rem
```

### 2.3 Espaçamento

Base: múltiplos de 0.25rem (4px). Tokens:

```
--space-1:  4px    --space-6:  24px
--space-2:  8px    --space-8:  32px
--space-3:  12px   --space-10: 40px
--space-4:  16px   --space-12: 48px
--space-5:  20px   --space-16: 64px
```

### 2.4 Raios e Sombras

```css
/* Raios */
border-radius das fotos: 4–6px (subtil — não arredondado em demasia)
border-radius dos cards: 8px
border-radius dos inputs: 4px
border-radius dos badges: 9999px (pill)
border-radius botões pill: 20px

/* Sombras */
foto full-width: 0 2px 12px rgba(26,24,20,0.10), 0 0 0 1px rgba(26,24,20,0.04)
foto duo:        0 1px 8px rgba(26,24,20,0.08)
lightbox foto:   0 8px 48px rgba(0,0,0,0.5)
```

### 2.5 Easing e Duração

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1)   /* entrada suave de elementos */
--ease:     cubic-bezier(0.4, 0, 0.2, 1)    /* transições gerais */

Duração base:      200ms
Secções (reveal):  700ms
Hero reveal:       1400ms
Fotos hover:       500–600ms
Lightbox open:     280ms
```

---

## 3. Layout Global

### 3.1 Estrutura da Página

```
┌─────────────────────────────────────────┐
│  TOPBAR (fixed, z-index 100, h: 52px)   │
├─────────────────────────────────────────┤
│                                         │
│  HERO (92vh, full-bleed)                │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  STORY BODY (max-width: 900px, centrado)│
│    SECTION: chegada                     │
│    SECTION: praia                       │
│    SECTION: …                           │
│    SECTION: comentários globais         │
│                                         │
├─────────────────────────────────────────┤
│  FOOTER                                 │
└─────────────────────────────────────────┘
     ▲
SIDE NAV (fixed right: 2rem, z-index 50)
LIGHTBOX (fixed inset-0, z-index 200)
```

### 3.2 Body

```css
background: var(--paper);
font-family: var(--font-body);
-webkit-font-smoothing: antialiased;
overflow-x: hidden;
```

### 3.3 Scrollbar personalizada

```css
::-webkit-scrollbar        { width: 4px }
::-webkit-scrollbar-track  { background: transparent }
::-webkit-scrollbar-thumb  { background: var(--paper-deep); border-radius: 2px }
::-webkit-scrollbar-thumb:hover { background: var(--ink-faint) }
```

---

## 4. Componentes da Página

### 4.1 Topbar

**Posicionamento:** `position: fixed`, `top: 0`, `left/right: 0`, `z-index: 100`, `height: 52px`.

**Fundo:** Glassmorphism — `backdrop-filter: blur(16px) saturate(1.4)` com `background: color-mix(in srgb, var(--paper) 88%, transparent)`. A borda inferior é semitransparente: `color-mix(in srgb, var(--paper-deep) 60%, transparent)`.

**Ao fazer scroll** (≥10px): a borda inferior fica ligeiramente mais opaca (`80%`). Implementado via `scroll` event listener.

**Conteúdo — lado esquerdo: Logo**
- Logomark: quadrado `26×26px`, `border-radius: 3px`, `background: var(--ink)`, com SVG de ícone a `fill: var(--paper)`
- O ícone SVG representa blocos em grelha (4 rectângulos com opacidades diferentes — 1.0, 0.6, 0.4, 0.3)
- Nome "Memoire" em Cormorant Garamond `400`, `1.1rem`, `letter-spacing: 0.04em`
- Todo o conjunto é um `<a href="/">` para a homepage

**Conteúdo — lado direito:**
1. **Botão Pesquisar** — pill com `border-radius: 20px`, ícone de lupa + texto "Pesquisar", `font-size: 0.8rem`, `font-weight: 300`, cor `var(--ink-muted)`. Hover: `border-color` → `var(--ink-faint)`, `background` → `var(--paper-deep)`
2. **Botão Partilhar** — pill com borda `1px solid var(--paper-deep)`, ícone de seta + texto "Partilhar", `font-size: 0.8rem`, `font-weight: 400`. Hover: borda mais escura, fundo `var(--paper-warm)`

---

### 4.2 Navegação Lateral (Side Nav)

**Posicionamento:** `position: fixed`, `right: 2rem`, `top: 50%`, `transform: translateY(-50%)`, `z-index: 50`. Escondida em mobile (`display: none` abaixo de 720px).

**Estrutura:** coluna de `<a>` items, cada um com um dot e um label.

**Dot:** círculo `5×5px`, `background: var(--ink-faint)`. No estado `:hover` e `.active`: aumenta para `7×7px`, `background: var(--ink)`. No estado `.active` especificamente: `background: var(--accent)` (terracotta).

**Label:** texto `0.7rem`, `font-weight: 400`, `color: var(--ink-muted)`. Por defeito: `opacity: 0`, `transform: translateX(4px)`. Ao hover e active: `opacity: 1`, `translateX(0)`. Transição `220ms var(--ease-out)`.

**Comportamento activo:** detectado via `IntersectionObserver` com `threshold: 0.4` nas secções. A secção mais visível activa o item correspondente.

**Disposição:** label à esquerda do dot (o dot está do lado do ecrã, o label aparece para dentro).

---

### 4.3 Hero

**Altura:** `92vh`, `min-height: 560px`. Full-bleed (sem max-width).

**Camadas (de baixo para cima):**
1. `.hero-bg` — a imagem/gradiente de fundo, com animação `heroReveal` (`scale(1.06) → scale(1)`, `opacity 0→1`, `duration: 1.4s`)
2. **Grain overlay** — pseudo-elemento `::after` com SVG de ruído fractal (`feTurbulence baseFrequency: 0.9`), `background-size: 200px 200px`, `opacity: 0.5`. Dá textura orgânica à imagem
3. `.hero-overlay` — gradiente `linear-gradient(to top, rgba(26,24,20,0.72) 0%, rgba(26,24,20,0.18) 45%, transparent 70%)`. Escurece a base para o texto ser legível
4. `.hero-content` — texto posicionado `bottom: 0`, com padding `4rem 5rem`. Animação `fadeUp` com `delay: 0.3s`

**Conteúdo do hero:**
- **Eyebrow:** DM Sans, `0.7rem`, `font-weight: 500`, `letter-spacing: 0.16em`, uppercase, `rgba(255,255,255,0.55)`. Ex: "Comporta · Agosto 2024"
- **Título:** Cormorant Garamond, italic, `300`, `clamp(3rem, 7vw, 5.5rem)`, branco, `text-shadow: 0 2px 20px rgba(0,0,0,0.2)`
- **Subtítulo:** DM Sans, `0.9rem`, `font-weight: 300`, `rgba(255,255,255,0.65)`, com separadores verticais (`1px × 12px`, `rgba(255,255,255,0.25)`) entre os items de metadata

**Scroll indicator:** canto inferior direito, `position: absolute`, `bottom: 2.5rem`, `right: 5rem`. Linha vertical animada (`scrollPulse`: opacity 0.3→0.7, infinite) + texto "scroll" em uppercase. Animação de entrada com `delay: 0.8s`.

---

### 4.4 Story Body

**Container:** `max-width: 900px`, `margin: 0 auto`, `padding: 0 2rem 6rem`.

**Sections:** cada secção tem `padding: 5rem 0 2rem`. Começam com `opacity: 0` e `transform: translateY(20px)`. Quando entram no viewport (`IntersectionObserver`, `threshold: 0.08`), recebem `.visible` que aplica `opacity: 1` e `translateY(0)`, `transition: 700ms var(--ease-out)`.

---

### 4.5 Bloco: Divider

Separador entre secções. Cria ritmo visual e identifica cada capítulo da story.

**Estrutura:** flex row com linha — label — linha.

```
─────────────  Dia 1 · Chegada  ─────────────
```

- Linhas: `flex: 1`, `height: 1px`, `background: var(--paper-deep)`
- Label: Cormorant Garamond, italic, `300`, `1.6rem`, `var(--ink-muted)`. Ex: "Dia 1 · Chegada", "Agosto · Comporta"
- Gap entre elementos: `2rem`
- Margens: `4rem 0 3rem`

---

### 4.6 Bloco: Texto

Container `max-width: 640px`, centrado, `padding: 1rem 0`.

- **`<h2>`:** Cormorant Garamond, `400`, `clamp(2rem, 4vw, 2.8rem)`, `line-height: 1.15`, `letter-spacing: -0.01em`, `var(--ink)`
- **`<p>`:** DM Sans, `300`, `1rem`, `line-height: 1.85`, `var(--ink-soft)`, `margin-bottom: 1rem`
- **`<strong>`:** `font-weight: 500`, `var(--ink)` (não bold em demasia)
- **`<em>`:** `font-style: italic`

---

### 4.7 Bloco: Foto Full-Width

Foto a toda a largura do container (900px) com legenda.

**Container:** `border-radius: 6px`, `overflow: hidden`, `box-shadow: 0 2px 12px rgba(26,24,20,0.10), 0 0 0 1px rgba(26,24,20,0.04)`. Cursor pointer. Data attribute `data-photo-id` e `data-caption` para o lightbox.

**Imagem:** `width: 100%`, `aspect-ratio: 16/9`, `object-fit: cover`. Hover: `transform: scale(1.02)`, `transition: 600ms var(--ease-out)`.

**Legenda:** `padding: 0.85rem 1.25rem`, `border-top: 1px solid var(--paper-deep)`, flex row com `justify-content: space-between`.
- Texto: DM Sans, italic, `300`, `0.8rem`, `var(--ink-muted)`
- Localização (lado direito): ícone de pin `10×10px` + texto `0.72rem`, `letter-spacing: 0.04em`, `var(--ink-faint)`, font-style normal

---

### 4.8 Bloco: Foto Duo

Duas fotos lado a lado em portrait.

**Grid:** `grid-template-columns: 1fr 1fr`, `gap: 0.625rem`, `margin: 2rem 0`.

**Cada item:** `border-radius: 5px`, `overflow: hidden`, `box-shadow: 0 1px 8px rgba(26,24,20,0.08)`. Data attributes para lightbox.

**Imagem:** `aspect-ratio: 3/4`, `object-fit: cover`. Hover: `scale(1.04)`, `transition: 550ms`.

---

### 4.9 Bloco: Grelha (Grid)

Múltiplas fotos em grelha quadrada.

**Variantes de colunas:**
- `.photo-grid-3`: `repeat(3, 1fr)` — a mais usada
- `.photo-grid-2x2`: `repeat(2, 1fr)`

**Gap:** `0.5rem`. `margin: 2rem 0`.

**Cada item:** `border-radius: 4px`, `overflow: hidden`, `cursor: zoom-in`. Data attributes para lightbox.

**Imagem:** `aspect-ratio: 1/1` (quadrado), `object-fit: cover`. Hover: `scale(1.06)`, `transition: 500ms`.

---

### 4.10 Bloco: Foto Assimétrica

Uma foto principal grande + duas pequenas empilhadas. Cria dinamismo visual.

**Variante padrão (2fr + 1fr):**
```
┌──────────────┬──────┐
│              │      │
│    MAIN      ├──────┤
│   (2fr)      │      │
└──────────────┴──────┘
```

**Variante invertida (1fr + 2fr):** `grid-template-columns: 1fr 2fr` — usada na última secção.

**Coluna principal:** `border-radius: 5px`, `overflow: hidden`. Imagem: `min-height: 280px`, `width/height: 100%`. Hover: `scale(1.03)`, `transition: 600ms`.

**Stack (coluna secundária):** flex column, `gap: 0.625rem`. Cada item: `flex: 1`, `border-radius: 5px`. Imagens: `height: 100%`, `object-fit: cover`. Hover: `scale(1.06)`, `transition: 550ms`.

---

### 4.11 Bloco: Pull Quote

Citação destacada, centrada, máx. 600px.

**Decoração:** pseudo-elemento `::before` com o carácter `"` em Cormorant Garamond, `8rem`, `font-weight: 300`, `color: var(--accent-pale)`, centrado e em `position: absolute` por detrás do texto.

**Texto:** Cormorant Garamond, italic, `300`, `clamp(1.4rem, 3vw, 1.9rem)`, `line-height: 1.4`, `var(--ink)`.

**Autor:** DM Sans, `500`, `0.75rem`, `letter-spacing: 0.1em`, uppercase, `var(--ink-muted)`.

---

### 4.12 Bloco: Mapa

Mapa com header, canvas Leaflet e atribuição.

**Container:** `border-radius: 8px`, `overflow: hidden`, `border: 1px solid var(--paper-deep)`, `background: var(--paper-warm)`. `margin: 2.5rem 0`.

**Header:** `padding: 1rem 1.5rem`, `border-bottom: 1px solid var(--paper-deep)`, flex row.
- Ícone de pin: `14×14px`, `color: var(--accent)`
- Título: Cormorant Garamond, `400`, `1.1rem`
- Subtítulo: DM Sans, `300`, `0.75rem`, `var(--ink-muted)`

**Canvas:** `height: 280px`. No protótipo: gradiente de fundo simulado. Na implementação real: Leaflet com tiles OpenStreetMap.

**Pins Leaflet:** estilo customizado — diamond shape (`border-radius: 50% 50% 50% 0`, `rotate(-45deg)`), `28×28px`, `background: var(--accent)`, `border: 2px solid white`, `box-shadow: 0 2px 8px rgba(196,121,90,0.4)`. Label em pill branca.

**Rota:** polyline a tracejado, cor `#c4795a` (accent), `stroke-width: 2.5`, `stroke-dasharray: 6 4`, `opacity: 0.7`.

**Atribuição:** `padding: 0.5rem 1rem`, `font-size: 0.65rem`, `var(--ink-faint)`, `border-top`, flex com `justify-content: space-between`.

---

### 4.13 Bloco: Vídeo

Thumbnail de vídeo com play button sobreposto.

**Container:** `aspect-ratio: 16/9`, `border-radius: 6px`, `overflow: hidden`, `background: var(--ink)`, `cursor: pointer`.

**Fundo:** imagem de thumbnail com overlay escuro `opacity: 0.9`.

**Play button:** círculo `64×64px`, `background: rgba(255,255,255,0.12)`, `border: 1.5px solid rgba(255,255,255,0.3)`, `backdrop-filter: blur(4px)`. Hover (no container): `background: rgba(255,255,255,0.2)`.

**Label:** Cormorant Garamond, italic, `300`, `1.2rem`, `rgba(255,255,255,0.7)`. Ex: "O brinde · 0:34".

**Hover no container:** todo o grupo `.video-play` faz `scale(1.05)`, `transition: 300ms`.

---

### 4.14 Secção: Comentários Globais

Secção no final da story para comentários gerais (não por foto).

**Heading:** Cormorant Garamond, `400`, `2rem`, `var(--ink)`.
**Count:** DM Sans, `300`, `0.8rem`, `var(--ink-muted)`. Ex: "5 comentários nesta story".

**Lista de comentários:** flex column, `gap: 1.75rem`, `margin-bottom: 3rem`.

**Item de comentário:**
- Avatar: círculo `36×36px`, `background: var(--paper-deep)`, iniciais do nome em DM Sans `500`, `0.75rem`, `var(--ink-muted)`
- Nome: DM Sans, `500`, `0.875rem`, `var(--ink)`
- Data: DM Sans, `300`, `0.725rem`, `var(--ink-faint)`
- Badge de secção (opcional): pill `var(--accent-pale)` + `var(--accent)`, `0.72rem`. Ex: "📍 Dias de Praia"
- Badge "Autor": pill distinto para o criador da story
- Texto: DM Sans, `300`, `0.9rem`, `line-height: 1.7`, `var(--ink-soft)`
- Animação de entrada: `fadeUp 400ms` com stagger de 60ms

**Formulário de comentário:**
- Container: `background: var(--paper-warm)`, `border: 1px solid var(--paper-deep)`, `border-radius: 8px`, `padding: 1.75rem`
- Heading do form: Cormorant Garamond, `400`, `1.25rem`
- Grid 2 colunas: nome + email (email marcado como opcional)
- Textarea: `resize: vertical`
- Footer: flex com nota de privacidade (esquerda) e botão Publicar (direita)
- Botão: `background: var(--ink)`, `color: var(--paper)`, `border-radius: 4px`, `padding: 9px 20px`. Hover: `background: var(--ink-soft)`, `translateY(-1px)`, `box-shadow`

---

### 4.15 Footer

**Layout:** flex row, `justify-content: space-between`, `align-items: center`, `padding: 2rem 5rem`, `border-top: 1px solid var(--paper-deep)`, `margin-top: 4rem`.

**Esquerda:** Logo Memoire (logomark SVG + nome) em Cormorant Garamond, `0.95rem`, `var(--ink-muted)`. Link para a homepage.

**Direita:** texto informativo em DM Sans, `300`, `0.72rem`, `var(--ink-faint)`, `text-align: right`, `line-height: 1.8`. Ex: "94 fotografias · 3 álbuns Immich / Criado por Ricardo Fonseca · Agosto 2024".

---

## 5. Lightbox com Comentários por Foto

O lightbox é o elemento mais complexo da interface. É um painel split-screen que aparece ao clicar em qualquer foto.

### 5.1 Estrutura

```
┌─────────────────────────────┬──────────────┐
│                             │   HEADER     │
│                             │──────────────│
│      FOTO (flex: 1)         │   SCROLL     │
│                             │  (comentários│
│   [←]              [→]      │   + empty    │
│                             │   state)     │
│   legenda                   │──────────────│
│                             │   FORM       │
└─────────────────────────────┴──────────────┘
                               ← 340px →
```

### 5.2 Container (`.lightbox`)

`position: fixed`, `inset: 0`, `z-index: 200`. Layout: `display: flex`, `align-items: stretch`.

**Fundo:** `rgba(12,10,8,0.96)` com `backdrop-filter: blur(12px)`.

**Animação:** começa `opacity: 0`, `pointer-events: none`. Estado `.open`: `opacity: 1`, transição `280ms var(--ease)`.

### 5.3 Lado da Foto (`.lightbox-photo-side`)

`flex: 1`, `display: flex`, `flex-direction: column`, `align-items: center`, `justify-content: center`, `padding: 3.5rem 2.5rem 2.5rem`.

**Wrap da imagem:** `width: 100%`, `max-height: calc(100vh - 120px)`, `border-radius: 4px`, `box-shadow: 0 8px 48px rgba(0,0,0,0.5)`. Animação: começa `scale(0.96) translateY(8px)`, estado `.open`: `scale(1) translateY(0)`, `transition: 380ms var(--ease-out)`.

**Legenda:** abaixo da imagem, `margin-top: 1rem`, DM Sans italic `300`, `0.78rem`, `rgba(255,255,255,0.35)`, centrada.

**Botão fechar (X):** `position: absolute`, `top: 1rem`, `right: 1rem`, círculo `32×32px`, `background: rgba(255,255,255,0.06)`, `border: 1px solid rgba(255,255,255,0.10)`. Hover: mais opaco. Cor do ícone: `rgba(255,255,255,0.4)` → branco.

**Botões de navegação ← →:** `position: absolute`, centrados verticalmente. Círculos `36×36px`, `background: rgba(255,255,255,0.08)`, `border: 1px solid rgba(255,255,255,0.12)`, `backdrop-filter: blur(4px)`. SVG chevron `16×16px`. Hover: mais opaco.

**Animação de navegação:** ao mudar de foto, a imagem desliza para fora (opacity 0 + translateX) e a nova entra do lado oposto com `transition: opacity 250ms, transform 300ms cubic-bezier(0.16,1,0.3,1)`.

**Teclado:** `←` / `→` para navegar, `Escape` para fechar.

### 5.4 Painel de Comentários (`.lightbox-comments-side`)

`width: 340px`, `flex-shrink: 0`, `background: var(--paper)`. Animação: começa `translateX(20px)`, estado `.open`: `translateX(0)`, `transition: 380ms 60ms var(--ease-out)` (delay de 60ms em relação à foto).

**Header (`.lc-header`):** `padding: 1.25rem 1.5rem 1rem`, `border-bottom: 1px solid var(--paper-deep)`, flex row `justify-content: space-between`.
- Título "Comentários": Cormorant Garamond, `400`, `1.2rem`
- Count badge: DM Sans, `500`, pill `background: var(--paper-deep)`, `0.72rem`

**Área de scroll (`.lc-scroll`):** `flex: 1`, `overflow-y: auto`, `padding: 1.25rem 1.5rem`, `gap: 1.25rem`. Scrollbar: `3px`, cor `var(--paper-deep)`.

**Estado vazio:** ícone de balão de comentário `28×28px` (opacity 0.3) + texto italic "Ainda não há comentários. / Sê o primeiro!". Centralizado verticalmente.

**Item de comentário no lightbox (`.lc-comment`):** igual ao comentário global mas mais compacto.
- Avatar: `30×30px`
- Nome: `0.8rem`
- Data: `0.68rem`
- Texto: `0.83rem`, `line-height: 1.65`
- Animação: `fadeUp 300ms` com stagger de 50ms

**Formulário (`.lc-form`):** `padding: 1rem 1.5rem 1.25rem`, `border-top: 1px solid var(--paper-deep)`, `background: var(--paper-warm)`.
- Label: DM Sans, `500`, `0.68rem`, uppercase
- Input nome: `height: ~34px`
- Textarea: `height: 64px`, `resize: none`
- Inputs: `background: var(--paper)`, `border: 1px solid var(--paper-deep)`, `border-radius: 4px`, focus: borda `var(--ink)` + `box-shadow: 0 0 0 2px rgba(26,24,20,0.06)`
- Validação: borda `var(--error)` se campos vazios ao submeter
- Botão Publicar: `background: var(--ink)`, `color: var(--paper)`, `font-size: 0.78rem`, `border-radius: 4px`

**Após submeter:** novo comentário adicionado ao estado local, painel rerenderiza, scroll automático para o fundo.

### 5.5 Mobile (≤ 720px)

O layout split torna-se vertical: foto em cima, painel de comentários em baixo (`height: 45vh`). A animação de entrada do painel muda de `translateX` para `translateY`.

---

## 6. Animações e Motion

### 6.1 Princípios

1. **Revelar, não decorar.** As animações servem para contextualizar o utilizador, não para mostrar habilidade técnica
2. **Ease-out para entradas.** `cubic-bezier(0.16, 1, 0.3, 1)` — começa rápido, termina suave. Nunca usar `ease-in` para elementos que entram
3. **Stagger subtil.** Diferenças de 50–100ms entre elementos criam sensação de fluidez natural
4. **As fotos têm o seu tempo.** Hover de imagens usa 500–600ms — mais lento que a UI — porque a foto é o conteúdo, não a interacção

### 6.2 Catálogo de Animações

| Elemento | Animação | Duração | Delay |
|---|---|---|---|
| Hero BG | `scale(1.06)→(1)` + `opacity 0→1` | 1400ms | 0 |
| Hero texto | `fadeUp` (translateY 24px→0) | 1000ms | 300ms |
| Scroll indicator | `fadeUp` | 1000ms | 800ms |
| Scroll indicator line | pulse opacity | ∞ loop | 1500ms |
| Secções (scroll reveal) | `opacity 0→1` + `translateY 20px→0` | 700ms | — |
| Lightbox open | `opacity 0→1` | 280ms | — |
| Lightbox foto | `scale(0.96) translateY(8px) → normal` | 380ms | 0 |
| Lightbox painel | `translateX(20px)→0` | 380ms | 60ms |
| Foto hover (full/asym) | `scale(1.02–1.03)` | 600ms | — |
| Foto hover (duo) | `scale(1.04)` | 550ms | — |
| Foto hover (grid) | `scale(1.06)` | 500ms | — |
| Comentário novo | `fadeUp` | 300ms | 0–n×50ms |

### 6.3 keyframes

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes heroReveal {
  from { transform: scale(1.06); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}

@keyframes scrollPulse {
  0%, 100% { opacity: 0.3; transform: scaleY(1); }
  50%       { opacity: 0.7; transform: scaleY(1.1); }
}
```

---

## 7. Comportamento Responsivo

**Breakpoint principal: 720px**

| Elemento | Desktop | Mobile (≤720px) |
|---|---|---|
| Side nav | visível | `display: none` |
| Hero content padding | `4rem 5rem` | `2.5rem 1.5rem` |
| Scroll indicator | `right: 5rem` | `right: 1.5rem` |
| Story body padding | `0 2rem 6rem` | `0 1.25rem 4rem` |
| Photo duo | `1fr 1fr` | `1fr` (stacked) |
| Photo asym | `2fr 1fr` | `1fr` (stacked) |
| Photo grid 3col | `repeat(3, 1fr)` | `repeat(2, 1fr)` |
| Comment form | `grid 2col` | `1col` |
| Footer | flex row | flex column, centrado |
| Topbar padding | `0 2rem` | `0 1.25rem` |
| Lightbox layout | split horizontal | split vertical |
| Lightbox comments | `width: 340px` | `height: 45vh` |

---

## 8. Lógica de Comentários por Foto

### 8.1 Data Attributes

Cada elemento clicável usa `data-photo-id` (o `asset_id` do Immich) e `data-caption`:

```html
<div class="photo-full photo-clickable"
     data-photo-id="asset_abc123"
     data-caption="Vista da varanda ao fim da tarde">
  ...
</div>
```

### 8.2 Event Delegation

Um único listener no `document` apanha todos os cliques:

```js
document.addEventListener('click', e => {
  const target = e.target.closest('[data-photo-id]');
  if (target && !lightbox.classList.contains('open')) {
    openLightbox(target.dataset.photoId, target.dataset.caption || '');
  }
});
```

### 8.3 API (backend)

```
GET  /api/public/:slug/comments/:asset_id   → array de comentários
POST /api/public/:slug/comments/:asset_id   → { author_name, body }
```

Os comentários são indexados por `asset_id`, não por URL da foto. Isto garante que os comentários persistem mesmo que o editor reorganize os blocos.

### 8.4 Registo de Fotos para Navegação

O array `allPhotos` é construído ao inicializar a página, percorrendo todos os `[data-photo-id]` em ordem DOM. A navegação ← → usa este array para saber qual a foto anterior/seguinte.

---

## 9. Implementação em React

### 9.1 Componentes sugeridos

```
<StoryViewer>              ← página pública completa
  <Topbar>
  <SideNav sections={...} activeSection={...} />
  <HeroBlock asset={...} title={...} subtitle={...} />
  <StoryBody>
    <Section id="...">
      <DividerBlock label="..." />
      <TextBlock markdown="..." />
      <PhotoFullBlock asset={...} caption={...} />
      <PhotoDuoBlock assets={[...]} />
      <PhotoGridBlock assets={[...]} columns={3} />
      <PhotoAsymBlock mainAsset={...} stackAssets={[...]} />
      <PullQuoteBlock text="..." author="..." />
      <MapBlock mode="auto|manual" {...} />
      <VideoBlock asset={...} label="..." />
    </Section>
    <GlobalCommentsSection storyId={...} />
  </StoryBody>
  <StoryFooter />
  <PhotoLightbox
    photoId={activePhotoId}
    caption={activeCaption}
    allPhotos={photoRegistry}
    onClose={...}
    onNavigate={...}
  />
</StoryViewer>
```

### 9.2 CSS Variables

Definir os tokens num ficheiro `tokens.css` global. Os componentes referem sempre variáveis, nunca valores literais de cor ou tipografia.

### 9.3 Animações com Framer Motion (opcional)

Para as animações de scroll reveal, pode usar-se `motion.div` com `whileInView` em vez de `IntersectionObserver` manual:

```jsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
  viewport={{ once: true, amount: 0.08 }}
>
```

---

## 10. Ficheiros de Referência

| Ficheiro | Descrição |
|---|---|
| `memoire-story-page.html` | Protótipo HTML canónico — fonte da verdade para todos os detalhes visuais |
| `memoire-design-system.html` | Guia de estilos completo — paleta, tipografia, componentes base |
| `memoire-design-spec.md` | Este documento |
| `immich-story-builder-spec.md` | Especificação técnica da aplicação (backend, API, base de dados) |

> **Nota para o developer:** em caso de dúvida sobre qualquer detalhe visual, consultar `memoire-story-page.html` no browser. O HTML é a referência definitiva.
