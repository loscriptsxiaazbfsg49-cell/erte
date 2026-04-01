# 🤖 Omegai — Documentation Technique

> **Omegai** est une interface de chat IA unifiée qui agrège l'intégralité des modèles disponibles sur OpenRouter (LLM, vision, image, audio, vidéo…). Elle propose une sélection dynamique de fournisseur et de modèle, un classement intelligent en temps réel basé sur le prompt, la gestion de fichiers joints, et une interface chat élégante adaptée mobile et desktop.

---

## 📁 Structure du Projet

```
omegai/
├── index.html               # Page principale (HTML + config Tailwind)
├── styles.css               # Tous les styles CSS personnalisés
├── app.js                   # Logique JavaScript principale (~3600 lignes)
├── splash.js                # Animation splash screen + favicon arrondi
├── logo.png                 # Logo Omegai (favicon + splash)
└── README.md                # Ce fichier
```

---

## 📄 Description des Fichiers

### `index.html`
Page HTML principale. Contient :
- **Configuration Tailwind CSS** : thème personnalisé (couleurs, polices, ombres, arrondis, dark mode)
- **Splash Screen** : animation SVG du logo Ωi au chargement
- **Sidebar gauche** : navigation (recherche, nouveau chat, espace de travail, historique épinglé, profil)
- **Zone centrale** : titre animé, suggestions, zone de chat, barre de saisie
- **Barre de saisie (`#inputBar`)** :
  - Structure en `flex-col` : zone thumbnails fichiers (`#inputFilesPreview`) en haut, contrôles (trombone + textarea + boutons) dans `#inputControlsRow` en bas
  - Bouton trombone `#attachBtn`, textarea `#chatTextarea`, boutons Éditer / Voix / Envoyer
- **Sélection des IA — 2 Dispositions** :
  - *Disposition Pyramide* (par défaut) : logos centrés au-dessus de la barre de saisie avec pagination horizontale
  - *Disposition Sidebar droite* : `#aiProviderSidebar` (72px, `right:0`), colonne de logos scrollable
- **Panneau de modèles** : `#modelSelectorBar` (pop-up dynamique des modèles du provider sélectionné, avec recherche)
- **Badge de classement IA** (`#modelRankingIndicator`) : badge flottant indiquant le type de tâche détecté
- **Menus contextuels** : clic droit sur textarea, bulles IA, sidebar, conversations
- **Panneau trombone mobile** : panel flottant bas-gauche (`#toolsMobilePanel`) avec Camera / Photos / Fichiers

### `styles.css`
Feuille de styles organisée en sections :

| Section | Description |
|---------|-------------|
| **Base** | Police Inter, dark theme global |
| **Scrollbar** | Scrollbar fine 5px, transparente sur mobile |
| **Left Sidebar** | Collapse/expand animé + bouton toggle |
| **Splash Screen** | Animations SVG : dessin, remplissage, rétrécissement, heartbeat |
| **Animations** | `fadeInUp`, `spin`, `slideInRight`, `slideInUp` |
| **Textarea** | Masquage scrollbar natif, auto-resize |
| **Focus Mode** | Masquage suggestions quand textarea actif |
| **AI Provider Sidebar** | Boutons logos, état hover/selected, scrollbar cachée |
| **Provider Tooltip** | Tooltip portal `position:fixed` (sidebar uniquement) |
| **Model Selector** | Items de modèle avec hover et état sélectionné |
| **Code Blocks** | Numérotation hljs-ln, scrollbar horizontale stylisée |
| **Mobile Panel** | Panneau trombone mobile : hauteur max, scroll interne |
| **Input Files Preview** | Thumbnails dans la barre de saisie (72×72px, border-radius:14px) |

### `app.js`
Logique JavaScript principale (~3600 lignes), organisée en modules :

#### Modules principaux

| Module/Fonction | Description |
|----------------|-------------|
| `toggleSidebar()` | Réduit/déploie la sidebar gauche |
| `initSidebar()` | Position initiale du bouton toggle |
| `initDropdowns()` | Dropdowns Qualité et Confidentialité |
| `setupDropdown()` | Dropdown hover/click/auto-fermeture |
| `setupSelectableDropdown()` | Dropdown avec sélection, check visuel, callback |
| `initFocusMode()` | Mode focus : masque suggestions quand on tape |
| `initContextMenu()` | Menu contextuel textarea |
| `initAIContextMenu()` | Menu contextuel bulles assistant (Copier, Résumer, Humaniser) |
| `initAIProviders()` | Module complet fournisseurs/modèles IA |
| `initChat()` | Logique envoi messages, bulles, streaming, historique |
| `initToolsMenu()` | Bouton trombone : panel mobile + desktop file pickers |
| `scheduleModelRanking()` | Déclencheur debounced du classement IA |
| `rankProvidersByPrompt()` | Moteur de scoring des providers |
| `showRankingIndicator()` | Badge flottant indiquant le classement actif |
| `copyCodeBlock()` | Copie code sans numéros de ligne, feedback visuel |
| `showProviderTooltip()` | Tooltip provider (portal `position:fixed`) |
| `addMessageBubble()` | Bulle de message user/assistant avec vignettes fichiers |
| `renderMarkdown()` | Markdown → HTML avec hljs + numérotation lignes |
| `openModelSearchModal()` | Modale de recherche globale de modèles filtrés par type |

---

## 🔌 APIs et Services Externes

### OpenRouter API
- **URL** : Supabase Edge Function `/chat/models` (proxy sécurisé)
- **Données** : liste complète des modèles (`id`, `name`, `context_length`, `pricing`, `architecture`, modalités)
- **Cache** : `sessionStorage` avec clé versionnée (`openrouter_models_v8`), TTL 30 min
- **Endpoint modèles** : `https://zumhjpzbvnqtcntvwvff.supabase.co/functions/v1/chat/models`

### Google Favicon API
- **URL** : `https://www.google.com/s2/favicons?domain={domain}&sz=64`
- **Mapping `DOMAINS`** : slug → domaine réel produit (ex: `anthropic` → `claude.ai`, `google` → `gemini.google.com`)
- **Fallback** : initiales colorées générées via Canvas (couleur HSL unique par hash du slug)
- **Tri** : providers avec favicon connu en tête, ceux en initiales relégués en bas

### Supabase (Backend)
- **Projet** : `omegai` (région eu-west-1)
- **URL** : `https://zumhjpzbvnqtcntvwvff.supabase.co`
- **Edge Function `chat`** : proxy sécurisé → lit la clé API depuis la DB, forward vers OpenRouter
- **Edge Function `chat/models`** : agrège l'API standard OpenRouter + sitemap pour les modèles cachés
- **Tables** :
  - `api_keys` : clés API (accès RLS strict, jamais exposée côté client)
  - `conversations` : titre, modèle, épinglage, compteur messages
  - `messages` : rôle (user/assistant), contenu, `conversation_id`
- **Realtime** : souscription aux changements de `conversations` pour mise à jour live de la sidebar

### highlightjs + plugin line-numbers
- **CDN highlight.js** : thème `atom-one-dark`
- **Plugin** : `highlightjs-line-numbers.js` v2.8 (numérotation correcte multi-lignes)
- **Méthode** : `hljs.lineNumbersValue(html)` → tableau `<table class="hljs-ln">`
- **Fallback** : découpage manuel par `\n` si plugin absent

### Google Fonts
- **Inter** (300→700) : police principale
- **Material Symbols Outlined** : icônes Material Design

### Tailwind CSS
- CDN avec plugins `forms` et `container-queries`
- Thème étendu : couleurs, arrondis, ombres, polices

---

## 🧠 Classement Intelligent des Providers

### Fonctionnement
À chaque frappe dans le textarea (debounce 300ms), `rankProvidersByPrompt()` :
1. **Détecte des signaux** dans le texte via regex (12 catégories)
2. **Score chaque provider** selon ses forces déclarées dans `PROVIDER_SIGNALS`
3. **Rewrites `state.providerMap`** dans le nouvel ordre de pertinence
4. **Re-render** la barre de providers → les plus adaptés apparaissent en premier
5. **Affiche le badge** `#modelRankingIndicator` indiquant le type de tâche détecté

### Signaux Détectés

| Signal | Mots-clés types | Providers favorisés |
|--------|-----------------|---------------------|
| `vision` | image, photo, describe, screenshot, OCR | Google, OpenAI, Qwen |
| `code` | code, debug, function, JavaScript, Python... | DeepSeek, Mistral, Microsoft |
| `math` | calcul, équation, physique, chimie... | DeepSeek, Qwen, OpenAI |
| `creative` | écris, roman, poème, slogan, histoire... | Anthropic, Meta Llama |
| `search` | recherche, actualité, news, tendance... | Perplexity, Google, Cohere |
| `reasoning` | analyse, raisonne, pros/cons, stratégi... | Anthropic, DeepSeek, OpenAI |
| `chat` | comment, pourquoi, help, conseille... | Meta, X-AI, Anthropic |
| `audio` | musique, voix, transcribe, podcast... | Minimax, ByteDance |
| `video` | vidéo, montage, animation, clip... | ByteDance, Tencent |
| `longCtx` | fichier entier, résume ce livre... | Moonshot, Cohere, Anthropic |
| `shopping` | achète, prix, Amazon, comparaison... | Perplexity |
| `fast` | rapide, court, une phrase, résume en... | Meta Llama, Mistral |

> **Bonus vision** : si des images sont jointes (`state.pendingFiles`), les providers ayant des modèles vision (détectés via `architecture.input_modalities`) reçoivent +4 points.

### Badge de Classement
- **Desktop** : pill vertical, juste à gauche du `#aiProviderSidebar` (right: 76px), centré verticalement, texte en `writing-mode: vertical-rl`
- **Mobile** : **Masqué** (désactivé sur mobile pour une interface plus épurée)
- Disparaît automatiquement quand le textarea est vidé (restauration de l'ordre par défaut)

---

## 📎 Gestion des Fichiers Joints

### Workflow
```
Trombone → panel (mobile) ou menu desktop
              ↓
    Sélection Caméra / Photos / Fichiers
              ↓
    handleFileSelection() → state.pendingFiles.push(f)
              ↓
    renderInputFilePreviews() → thumbnails dans #inputBar
              ↓
    L'utilisateur écrit son prompt + clique Envoyer
              ↓
    handleSend() → addMessageBubble(role, content, pendingFiles)
              ↓
    Bulle utilisateur avec vignettes + texte
    state.pendingFiles = [] — nettoyage
```

### Rendu des Vignettes
- **Images** : thumbnail 72×72px, `object-fit:cover`, `border-radius:14px`
- **Vidéos** : même taille + overlay icône `play_circle`
- **Documents** : pill avec icône + nom + taille en Ko
- **Bouton ✕** : supprime le fichier individuel de `state.pendingFiles` et rafraîchit l'affichage

---

## 🎨 Thème et Design

### Palette de Couleurs (Dark Theme)

| Token | Valeur | Usage |
|-------|--------|-------|
| `primary` | `#000000` | Éléments d'action principaux |
| `primary-content` | `#ffffff` | Texte sur fond primary |
| `background-light` | `#0f0f0f` | Fond de page (dark) |
| `background-subtle` | `#1a1a1a` | Fonds secondaires |
| `border-subtle` | `#2a2a2a` | Bordures |
| `text-main` | `#f0f0f0` | Texte principal |
| `text-muted` | `#888888` | Texte secondaire |

### Typographie
- **Police** : Inter (Google Fonts)
- **Poids** : 300 / 400 / 500 / 600 / 700
- **Icônes** : Material Symbols Outlined

### Animations

| Animation | Durée | Usage |
|-----------|-------|-------|
| `splashDrawPath` | 3s | Dessin du logo SVG |
| `splashFillIn` | 0.5s | Remplissage du logo |
| `splashShrinkToBall` | 0.4s | Rétrécissement en boule |
| `splashBallAppear` | 0.4s | Apparition boule noire |
| `splashHeartbeat` | 1.2s | Battement de la boule |
| `fadeInUp` | 0.5s | Apparition contenu central |
| `slideInRight` | 0.3s | Apparition sidebar IA |
| `slideInUp` | 0.3s | Panel mobile trombone |

---

## ⚙️ Fonctionnalités

### 1. Splash Screen
- Dessin SVG → remplissage → rétrécissement → heartbeat
- Ignoré si `sessionStorage.getItem('skipSplash')` est présent
- Clic sur le logo : recharge la page sans l'animation

### 2. Sidebar Gauche (Navigation)
- Recherche globale des conversations (modale `#searchModal`)
- Nouveau chat
- Historique en temps réel (Supabase Realtime)
- Épinglage de conversations
- Menu contextuel par conversation (renommer, supprimer, épingler)
- Collapse/expand animé

### 3. Sélection de Modèle IA — Double Disposition
- **Pyramide** : logos centrés, pagination, 5 logos max sans scroll
- **Sidebar droite** : colonne `#aiProviderSidebar` (72px), scroll vertical, tooltip portal au survol
- **Bascule de disposition** : uniquement avant le premier message (boutons `#layoutTogglePyramid` / `#layoutToggleSidebar`)
- **Badge modèle sélectionné** (`#selectedModelBadge`) : apparaît au-dessus de la barre après sélection
- **Modale de recherche** (`openModelSearchModal`) : filtre par catégorie (Texte, Image, Audio, Vidéo, Tout)

### 4. Classement Intelligent des Providers
- Analyse du prompt en temps réel (debounce 300ms)
- 12 signaux de tâche détectés par regex
- Poids configurables par provider (`PROVIDER_SIGNALS`)
- Bonus pour les modèles vision si image jointe
- Badge contextuel flottant — vertical desktop / horizontal mobile

### 5. Gestion des Fichiers Joints
- Trombone → panel mobile ou menu desktop
- Camera (capture environnement), Photos (galerie), Fichiers (génériques)
- Thumbnails dans la barre de saisie (72×72 ou pill)
- Bouton ✕ pour retirer un fichier
- Fichiers inclus dans la bulle de message à l'envoi

### 6. Chat
- Bulles `user` (fond subtil, alignée droite) avec vignettes fichiers si joint
- Bulles `assistant` (pleine largeur, markdown rendu)
- Actions rapides sous chaque réponse : **Résumer**, **Humaniser**
- Rendu Markdown : code colorisé hljs + numérotation lignes, bold, italic, inline code
- Bouton copier sur les blocs de code (feedback 2s)
- Indicateur de frappe animé (3 points)
- Auto-nommage de la conversation via IA

### 7. Menus Contextuels
- **Textarea** : Améliorer le prompt, Copier, Tout sélectionner
- **Bulles IA** : clic droit → Copier, Résumer, Humaniser
- **Sidebar conversations** : clic droit → Renommer, Épingler, Supprimer
- **Sidebar IA (disposition 1)** : clic droit → changer disposition

### 8. Éditeur de Brouillon (mobile)
- Ouverture de la barre de saisie en plein écran sur mobile
- Bouton d'édition `#editBtn`

### 9. Raccourcis Clavier

| Raccourci | Action |
|-----------|--------|
| `Ctrl+Enter` | Envoyer le message |
| `Ctrl+N` | Nouveau chat |
| `Ctrl+K` | Rechercher des conversations |
| `/` | Recherche rapide (hors champ texte) |
| `Escape` | Ferme le modal le plus au-dessus |

---

## 🏗️ Architecture de l'État Global

```javascript
const state = {
    allModels: [],              // Tous les modèles OpenRouter
    providerMap: {},            // { slug: { name, logoUrl, models[] } } — ordonnable
    providerDisplayNames: {},   // Noms extraits de l'API
    selectedProvider: null,     // Slug fournisseur en cours
    selectedProviderSlug: null, // Slug sauvegardé après sélection modèle
    selectedModel: null,        // ID modèle sélectionné (ex: "openai/gpt-4o")
    providerLayout: 'sidebar',  // 'sidebar' | 'pyramid'
    currentConversationId: null,// UUID conversation Supabase
    chatMessages: [],           // Historique pour contexte API
    conversations: [],          // Liste sidebar
    ctxConversationId: null,    // Conversation ciblée par menu contextuel
    isSending: false,           // Verrou anti-double envoi
    conversationStarted: false, // Bascule accueil → chat
    titleAutoSet: false,        // Empêche renommage multiple
    pendingFiles: [],           // Fichiers joints en attente d'envoi
};
```

---

## 🚀 Optimisations

| Optimisation | Description |
|--------------|-------------|
| **Cache API versionnée** | `sessionStorage` clé `openrouter_models_v{N}`, TTL 30 min |
| **DocumentFragment** | Insertion batch des providers/modèles dans le DOM |
| **Debounce ranking** | Classement IA déclenché 300ms après arrêt de frappe |
| **Snapshot providerMap** | `_defaultProviderOrder` sauvegardé une seule fois (pas de tri répété) |
| **Object URL** | `URL.createObjectURL()` pour les thumbnails (zéro upload) |
| **Favicon dynamique** | Canvas avec coins arrondis depuis `logo.png` |
| **Tooltip portal** | `position:fixed` + `getBoundingClientRect()` pour éviter le clipping |
| **Realtime Supabase** | Souscription unique aux events `conversations` |
| **Cache favicon** | `iconCache{}` pour les initiales générées (calcul canvas évité) |
| **Versioning CSS/JS** | Paramètre `?v=N` dans `index.html` pour vider le cache navigateur |

---

## 📱 Optimisations Mobile

| Élément | Comportement mobile |
|---------|---------------------|
| Sidebar gauche | Masquée par défaut, swipe pour ouvrir |
| Animation splash | Swipe/clic bloqué pendant l'animation |
| Barre d'input | Full-width, boutons optimisés tactile |
| Éditeur brouillon | Plein écran au clic sur `#editBtn` |
| Panel trombone | Flottant bas-gauche (pas plein écran), scroll interne |
| Badge classement | **Masqué** (exclusif desktop) |
| Modales | Plein écran sur mobile (searchModal, modelSearchModal) |
| Textarea auto-resize | Hauteur auto via `scrollHeight`, max 160px mobile |

---

## 🌐 Compatibilité

- **Navigateurs** : Chrome, Firefox, Safari, Edge (versions récentes)
- **Responsive** : adapté mobile (< 768px) et desktop
- **Écran minimum** : 320px

---

## 🔧 Changelog

### 01 avril 2026 — v#18
- **PWA Smart Theme** : Détection de l'installation en PWA (`display-mode: standalone`) pour synchroniser le mode clair/sombre avec le système. Si non-PWA, le thème sombre est imposé par défaut.
- **Swipe intelligent (Mobile)** : Réécriture du geste de balayage pour ouvrir/fermer le menu de gauche (`touchmove`). L'animation (menu + décalage page + fondu sombre) suit désormais dynamiquement le doigt en temps réel.
- **Protection anti-diagonales** : Analyse des axes X et Y pour désactiver le swipe latéral si le mouvement est trop vertical.
- **Focus Mobile** : L'extérieur de la barre de saisie grandit visuellement et masque proprement les icônes (Crayon/Micro) ainsi que le titre principal en cas de superposition.

### 19 mars 2026 — v#15
- **Badge classement IA** : Désactivation complète sur mobile. Désormais exclusif au desktop pour éviter l'encombrement visuel.
- **Badge classement IA repositionné** : vertical à gauche du sidebar IA sur desktop, `pointer-events:none`
- **Fichiers joints dans l'input bar** : thumbnails 72×72 dans `#inputFilesPreview` (dessus du textarea), ✕ individuel, workflow envoi correct
- **`addMessageBubble()` refactorée** : accepte `files[]` comme 3ème argument, backward-compatible avec `scroll` boolean
- **`state.pendingFiles`** : tableau accumulant les fichiers avant envoi, nettoyé après `handleSend()`
- **`handleSend()` mis à jour** : supporte l'envoi sans texte (fichiers seuls), nettoie la preview après envoi
- **Moteur de classement IA** (`rankProvidersByPrompt`) : 12 signaux, pondération par provider, debounce 300ms, restoration de l'ordre par défaut quand textarea vide
- **`renderInputFilePreviews()`** : insertion avant `#inputControlsRow` (structure `flex-col` correcte)
- **Structure `#inputBar` refaite** : `flex-col` avec `#inputControlsRow` pour séparer thumbnails et contrôles

### 16 mars 2026
- **Panneau trombone mobile** : panel flottant bas-gauche (pas plein écran), Caméra/Photos/Fichiers fonctionnels
- **Éditeur brouillon mobile** : plein écran avec fond noir, bouton d'envoi circulaire
- **Dark theme** : application globale dark mode
- **Titre mobile** : ajustement taille/position d'une ligne

### 09 mars 2026
- **Numérotation lignes** : plugin `highlightjs-line-numbers.js` — résout l'alignement multi-lignes
- **Favicons IA** : mapping `DOMAINS` mis à jour (chatgpt.com, claude.ai, gemini.google.com…)
- **Tri providers** : favicon connu en tête, initiales en bas
- **Tooltip provider (Sidebar)** : portal `position:fixed` — affiche le nom à gauche du logo au survol
- **Espacement boutons sidebar** : repositionnement pour éviter le chevauchement

### 03 mars 2026 — Audit complet
- **Ctrl+Enter** pour envoyer
- **Bouton Copier** sur les blocs de code
- **Dropdowns fonctionnels** : Qualité / Confidentialité
- **38 bugs corrigés** : envoi clavier, réinitialisation modèle, hiérarchie Escape, XSS, pyramide…

---

*Dernière mise à jour : 01 avril 2026 — v#18*
