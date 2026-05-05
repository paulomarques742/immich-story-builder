# Map Block — Sistema de Skins

**Contexto:** Adicionar um sistema de skins ao bloco de mapa existente no Mémoire. O bloco atual (`ViewerMap` em `frontend/src/components/viewer/ViewerBlock.jsx`) usa Leaflet + OSM. Pretende-se manter esse comportamento como skin `standard` e adicionar duas novas: `memoire` e `ghost`.

---

## 1. Alterações ao Schema do Bloco

Adicionar o campo `skin` ao content JSON do bloco `map`:

```json
{
  "skin": "standard" | "memoire" | "ghost"
}
```

- Valor por omissão: `"standard"` (comportamento atual, sem regressão)
- Persistido em `blocks.content` como os restantes campos
- Editável no `BlockEditor` (ver secção 4)

---

## 2. Ficheiros a criar / modificar

```
frontend/src/components/viewer/
  ViewerBlock.jsx          ← modificar: importar ViewerMapSkinned, passar skin
  ViewerMapSkinned.jsx     ← criar: dispatcher de skins
  ViewerMapMemoire.jsx     ← criar: skin Mémoire (Leaflet + CartoDB + custom pins)
  ViewerMapGhost.jsx       ← criar: skin Ghost (SVG puro, sem container)

frontend/src/components/editor/
  BlockEditor.jsx          ← modificar: adicionar selector de skin no MapEditor
```

---

## 3. Skin: `standard`

Comportamento atual sem alterações. O `ViewerMapSkinned` simplesmente renderiza o código existente quando `skin === 'standard'` (ou quando `skin` é undefined).

Não alterar nada na lógica de markers, zoom, route, etc.

---

## 4. Skin: `memoire`

### Ficheiro: `ViewerMapMemoire.jsx`

Baseado no `ViewerMap` atual, com as seguintes diferenças:

**Tiles:** Substituir `OSM_URL` por CartoDB Voyager:
```js
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>';
```

**Filtro CSS nos tiles:** Aplicar via `<style>` injetado no `<head>` (scoped por classe única no wrapper):
```css
.mv-map-memoire .leaflet-tile-pane {
  filter: sepia(0.35) saturate(0.85) brightness(1.04) contrast(0.97) hue-rotate(-8deg);
}
```
Usar `useEffect` para injetar/remover o estilo. Garantir que o scope usa um id único por instância (ex: `mv-map-${blockId}`) para não colidir com múltiplos mapas na mesma página.

**Custom icons:** Substituir o `Marker` padrão do Leaflet por ícones SVG custom via `L.divIcon`:

```js
function createMemoireIcon(isPrimary = false) {
  const fill = isPrimary ? 'var(--mv-accent, #c4795a)' : '#3a3530';
  const shadow = isPrimary ? 'rgba(196,121,90,0.4)' : 'rgba(0,0,0,0.25)';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">
      <filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${shadow}"/></filter>
      <g filter="url(#s)">
        <path d="M13 1C7.48 1 3 5.48 3 11c0 7.75 10 21 10 21S23 18.75 23 11C23 5.48 18.52 1 13 1z" fill="${fill}"/>
        <circle cx="13" cy="11" r="4.5" fill="white" opacity="0.92"/>
        <circle cx="13" cy="11" r="2" fill="${fill}"/>
      </g>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -36],
  });
}
```

O primeiro marker (`i === 0`) usa `isPrimary = true`, os restantes `false`.

**Vignette overlay:** Div absoluto sobre o mapa, `pointerEvents: 'none'`, z-index 400 (acima dos tiles, abaixo dos controlos):
```js
background: 'radial-gradient(ellipse at center, transparent 55%, rgba(240,233,220,0.32) 100%)'
```

**Container:** Manter o mesmo wrapper com `border`, `borderRadius: 8`, `background: var(--paper-warm)`, header com `PinIcon` em `var(--mv-accent)` e título em `font-family: var(--font-display)`.

**Toggle Standard ↔ Mémoire:** Pill no canto direito do header. Ao clicar, altera estado local `skin` entre `'standard'` e `'memoire'`. Este toggle é apenas visual (não persiste no bloco), serve para o leitor comparar. O estado inicial vem de `content.skin`.

```jsx
// pill
<button onClick={() => setActiveSkin(s => s === 'memoire' ? 'standard' : 'memoire')}
  style={{
    padding: '3px 10px', borderRadius: 20, border: '1px solid var(--paper-deep)',
    background: activeSkin === 'memoire' ? 'var(--mv-accent)' : 'transparent',
    color: activeSkin === 'memoire' ? '#fff' : 'var(--ink-muted)',
    fontSize: '0.68rem', fontFamily: 'var(--font-body)', cursor: 'pointer',
    transition: 'all 200ms ease',
  }}>
  {activeSkin === 'memoire' ? 'Mémoire' : 'Standard'}
</button>
```

---

## 5. Skin: `ghost`

### Ficheiro: `ViewerMapGhost.jsx`

Mapa desenhado inteiramente em SVG — sem Leaflet, sem tiles, sem container visível. Funde-se com o fundo da página.

### 5.1 Estrutura do componente

```jsx
export default function ViewerMapGhost({ content }) {
  const { mode, label, lat, lng, resolved_markers } = content;
  const markers = /* mesma lógica de markers que ViewerMap */;
  
  if (markers.length === 0) return <GhostEmpty />;
  
  const { viewBox, projected } = projectMarkers(markers);
  
  return (
    <div style={{ position: 'relative', margin: '2.5rem 0' }}>
      <GhostSvg viewBox={viewBox} markers={projected} label={label} />
      <GhostMeta count={markers.length} />
    </div>
  );
}
```

### 5.2 Projeção de coordenadas

Converter lat/lng para coordenadas SVG. O viewBox é calculado dinamicamente a partir do bounding box dos markers com padding:

```js
function projectMarkers(markers, svgWidth = 680, svgHeight = 300) {
  const lats = markers.map(m => m.lat);
  const lngs = markers.map(m => m.lng);
  
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  
  // padding de 20% em cada lado
  const padLat = (maxLat - minLat) * 0.35 || 0.05;
  const padLng = (maxLng - minLng) * 0.35 || 0.05;
  
  const bMinLat = minLat - padLat, bMaxLat = maxLat + padLat;
  const bMinLng = minLng - padLng, bMaxLng = maxLng + padLng;
  
  const project = (lat, lng) => ({
    x: ((lng - bMinLng) / (bMaxLng - bMinLng)) * svgWidth,
    y: ((bMaxLat - lat) / (bMaxLat - bMinLat)) * svgHeight,
  });
  
  return {
    viewBox: `0 0 ${svgWidth} ${svgHeight}`,
    projected: markers.map((m, i) => ({ ...m, ...project(m.lat, m.lng), index: i })),
  };
}
```

**Nota:** Para um único marker, o padding de 0.05 grau (~5.5km) garante que o ponto não fica no centro exacto sem contexto.

### 5.3 SVG Ghost

O SVG não tem background, não tem border, não tem container — apenas os elementos gráficos sobre o fundo da página:

```jsx
function GhostSvg({ viewBox, markers, label }) {
  return (
    <svg
      viewBox={viewBox}
      style={{ display: 'block', width: '100%', height: 300, overflow: 'visible' }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* linha de rota entre markers (se > 1) */}
      {markers.length > 1 && (
        <polyline
          points={markers.map(m => `${m.x},${m.y}`).join(' ')}
          fill="none"
          stroke="var(--paper-deep)"
          strokeWidth="1"
          strokeDasharray="5 4"
          opacity="0.6"
          className="ghost-route"
        />
      )}

      {/* pins */}
      {markers.map((m, i) => (
        <GhostPin key={i} x={m.x} y={m.y} isPrimary={i === 0} label={i === 0 ? (m.label || label) : null} index={i} />
      ))}
    </svg>
  );
}
```

### 5.4 GhostPin

Cada pin é um grupo de círculos concêntricos sem stroke, só fill com opacidades diferentes. **Sem container teardrop** — círculos puros:

```jsx
function GhostPin({ x, y, isPrimary, label, index }) {
  const accent = '#c4795a'; // var(--mv-accent) — hardcoded para SVG
  const neutral = 'var(--ink-muted, #8a8378)';
  
  if (isPrimary) {
    return (
      <g className={`ghost-pin ghost-pin-primary ghost-pin-delay-${index}`} style={{ transformOrigin: `${x}px ${y}px` }}>
        {/* anel exterior — pulse infinito após entrada */}
        <circle cx={x} cy={y} r="20" fill={accent} opacity="0.06" className="ghost-pulse-outer" />
        <circle cx={x} cy={y} r="12" fill={accent} opacity="0.12" />
        <circle cx={x} cy={y} r="5"  fill={accent} opacity="0.9" />
        <circle cx={x} cy={y} r="5"  fill="none" stroke={accent} strokeWidth="1" opacity="0.3" />
        {label && (
          <text
            x={x} y={y - 18}
            textAnchor="middle"
            fontFamily="var(--font-display, 'Cormorant Garamond', serif)"
            fontStyle="italic"
            fontWeight="300"
            fontSize="11"
            fill="var(--ink-muted, #8a8378)"
            opacity="0.8"
            className="ghost-label"
          >{label}</text>
        )}
      </g>
    );
  }
  
  return (
    <g className={`ghost-pin ghost-pin-delay-${index}`} style={{ transformOrigin: `${x}px ${y}px` }}>
      <circle cx={x} cy={y} r="10" fill={neutral} opacity="0.12" />
      <circle cx={x} cy={y} r="3"  fill={neutral} opacity="0.5" />
    </g>
  );
}
```

### 5.5 Animação de entrada

Injetar via `<style>` no componente (ou em `index.css` global):

```css
/* Pins — entrada com micro-bounce, stagger por index */
.ghost-pin {
  opacity: 0;
  transform: scale(0) translateY(0);
}

/* Usar animation-delay por index, não classes separadas */
/* Aplicar no componente via style inline: */
/* style={{ animationDelay: `${1200 + index * 140}ms` }} */

@keyframes ghostPinIn {
  0%   { opacity: 0; transform: scale(0.2) translateY(4px); }
  65%  { opacity: 1; transform: scale(1.18) translateY(-3px); }
  85%  { transform: scale(0.95) translateY(1px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

/* label fadeUp após os pins */
.ghost-label {
  opacity: 0;
  animation: ghostLabelUp 600ms cubic-bezier(0.16,1,0.3,1) forwards;
}
@keyframes ghostLabelUp {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 0.8; transform: translateY(0); }
}

/* pulse ring no pin primário — começa após entrada */
@keyframes ghostPulse {
  0%   { r: 5;  opacity: 0.4; }
  100% { r: 22; opacity: 0; }
}
.ghost-pulse-outer {
  animation: ghostPulse 2400ms cubic-bezier(0.16,1,0.3,1) infinite;
}
```

**Aplicar `animation-delay` no render:**

```jsx
// No GhostPin, adicionar ao <g>:
style={{
  transformOrigin: `${x}px ${y}px`,
  animation: `ghostPinIn 650ms cubic-bezier(0.16,1,0.3,1) ${1100 + index * 140}ms both`,
}}

// No label <text>:
style={{
  animationDelay: `${1800 + index * 140}ms`,
}}

// No pulse-outer circle (só primary):
style={{
  animationDelay: `${2200}ms`,
}}
```

**Nota importante:** `transform-origin` em SVG precisa de ser definido em coordenadas absolutas (`${x}px ${y}px`), não em percentagem, para o scale funcionar centrado no pin.

### 5.6 GhostMeta

Dois elementos de texto absolutamente posicionados fora do SVG, com `opacity` muito baixa:

```jsx
function GhostMeta({ count }) {
  return (
    <>
      <span style={{
        position: 'absolute', bottom: 0, left: 0,
        fontSize: '0.6rem', fontWeight: 300,
        fontFamily: 'var(--font-body)', color: 'var(--ink-muted)',
        opacity: 0.3, letterSpacing: '0.02em',
      }}>© OpenStreetMap</span>
      {count > 1 && (
        <span style={{
          position: 'absolute', bottom: 0, right: 0,
          fontSize: '0.65rem', fontWeight: 300, fontStyle: 'italic',
          fontFamily: 'var(--font-display)', color: 'var(--ink-muted)',
          opacity: 0.45,
        }}>{count} localizações</span>
      )}
    </>
  );
}
```

### 5.7 Estado vazio

```jsx
function GhostEmpty() {
  return (
    <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem',
                  fontStyle: 'italic', color: 'var(--ink-muted)', opacity: 0.5 }}>
        Sem coordenadas GPS
      </p>
    </div>
  );
}
```

---

## 6. Dispatcher: `ViewerMapSkinned.jsx`

```jsx
import ViewerMapMemoire from './ViewerMapMemoire';
import ViewerMapGhost   from './ViewerMapGhost';
// ViewerMap existente (standard) importado do mesmo ficheiro ou separado

export default function ViewerMapSkinned({ content }) {
  const skin = content.skin || 'standard';

  if (skin === 'ghost')   return <ViewerMapGhost   content={content} />;
  if (skin === 'memoire') return <ViewerMapMemoire content={content} />;
  return <ViewerMap content={content} />; // comportamento atual inalterado
}
```

---

## 7. Modificação em `ViewerBlock.jsx`

```jsx
// Substituir:
import ViewerMap from ... // ou o inline existente

// Por:
import ViewerMapSkinned from './ViewerMapSkinned';

// No switch:
case 'map':
  return (
    <div id={`block-${block.id}`} style={dimStyle}>
      <ViewerMapSkinned content={content} />
    </div>
  );
```

---

## 8. Editor: `BlockEditor.jsx` — MapEditor

Adicionar selector de skin no `MapEditor` existente, antes do selector de "Modo":

```jsx
<Field label="Estilo visual">
  <select
    style={s.input}
    value={content.skin || 'standard'}
    onChange={(e) => update('skin', e.target.value)}
  >
    <option value="standard">Standard</option>
    <option value="memoire">Mémoire</option>
    <option value="ghost">Ghost</option>
  </select>
</Field>
```

---

## 9. Checklist de implementação

- [ ] `ViewerMapSkinned.jsx` — dispatcher
- [ ] `ViewerMapMemoire.jsx` — Leaflet + CartoDB + custom icons + toggle
- [ ] `ViewerMapGhost.jsx` — SVG puro + projeção lat/lng + animação
- [ ] `ViewerBlock.jsx` — substituir `<ViewerMap>` por `<ViewerMapSkinned>`
- [ ] `BlockEditor.jsx` — adicionar field `skin` no MapEditor
- [ ] CSS de animação Ghost — pode ir em `index.css` junto aos `@keyframes` existentes (`fadeUp`, `heroReveal`) ou inline no componente
- [ ] Testar dark mode — o Ghost usa CSS vars, deve funcionar automaticamente; o Mémoire precisa que o filtro CSS seja validado sobre `--paper` escuro (o sepia+brightness pode clarear demasiado em dark mode — ajustar para `sepia(0.2) saturate(0.7) brightness(0.95)` no dark)

---

## 10. Notas

**Ghost e rotas:** O skin Ghost não suporta rota interativa (não tem Leaflet). Se `show_route: true`, desenha uma `<polyline>` SVG a tracejado entre os pontos — não é uma rota real, é uma linha recta entre markers. Comportamento adequado para o contexto editorial.

**Ghost e scroll reveal:** O componente Ghost deve ser envolvido pelo mesmo `IntersectionObserver` que as outras secções (`.mv-section` / `.mv-visible`). A animação de entrada dos pins **só deve arrancar quando o bloco entra no viewport** — usar `content-visibility` ou verificar se o wrapper pai tem `.mv-visible` antes de aplicar as animações. Sugestão: usar `animation-play-state: paused` por defeito e mudar para `running` quando visível.

**Regressão zero:** O field `skin` é opcional — blocos existentes sem esse campo continuam a renderizar o mapa standard sem alterações.
