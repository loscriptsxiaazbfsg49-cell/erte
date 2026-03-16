# 📘 Omegai — Documentation Technique

> **Omegai** est une interface de chat IA unifiée qui agrège les modèles de multiples fournisseurs d'IA via l'API OpenRouter. L'application permet de sélectionner dynamiquement un fournisseur et un modèle, puis d'interagir via une interface de chat élégante.

---

## 📁 Structure du Projet

```
omegai/
├── index.html               # Page principale (HTML + config Tailwind)
├── styles.css               # Tous les styles CSS
├── app.js                   # Logique JavaScript principale
├── splash.js                # Animation splash screen + favicon arrondi
├── logo.png                 # Logo Omegai (utilisé en favicon + splash)
└── README.md                # Ce fichier de documentation
```

---

## 📄 Description des Fichiers

### `index.html`
Page HTML principale de l'application. Contient :
- **Configuration Tailwind CSS** : thème personnalisé (couleurs, polices, ombres, arrondis)
- **Splash Screen** : animation SVG du logo au chargement
- **Sidebar gauche** : navigation (recherche, nouveau chat, espace de travail, historique, profil)
- **Zone centrale** : titre, zone de saisie dynamique (agrandissement auto) avec boutons (vocal, édition, envoi)
- **Sélection des IA (2 Dispositions)** :
  - *Disposition Pyramide* (par défaut) : centrée au-dessus de la barre de recherche avec pagination horizontale
  - *Disposition Colonne* (Sidebar Droite) : logos des fournisseurs empilés verticalement à droite
- **Panneau de sélection de modèle** : pop-up dynamique des modèles du fournisseur sélectionné
- **Menus contextuels** : clic droit personnalisé sur le textarea et divers éléments (copier, sélectionner, éditer)
- **Dropdowns** : Qualité (maximale/éco/eco ultra) et Confidentialité (privé/public)
- **Plugin highlight.js** : `highlightjs-line-numbers.js` pour la numérotation correcte des lignes dans les blocs de code

### `styles.css`
Feuille de styles contenant tous les styles personnalisés, organisés en sections :

| Section | Description |
|---------|-------------|
| **Base** | Police Inter par défaut |
| **Scrollbar** | Scrollbar personnalisée fine (5px) |
| **Left Sidebar** | Collapse/expand avec animation + bouton toggle |
| **Splash Screen** | Animations SVG (dessin, remplissage, rétrécissement, heartbeat) |
| **Animations** | `fadeInUp`, `spin`, `slideInRight` |
| **Textarea** | Masquage du scrollbar natif |
| **Focus Mode** | Masquage des suggestions quand le textarea est actif |
| **AI Provider Sidebar** | Boutons logos, état hover/selected |
| **Provider Tooltip** | Tooltip CSS (disposition 1 uniquement) + tooltip JS portal (`#providerHoverTooltip`) |
| **Model Selector** | Items de modèle avec hover et état sélectionné |
| **Code Blocks** | Numérotation des lignes via plugin hljs-ln, scrollbar horizontal stylisée |

### `app.js`
Logique JavaScript principale, organisée en modules initialisés au `DOMContentLoaded` :

#### Fonctions principales

| Fonction | Description |
|----------|-------------|
| `toggleSidebar()` | Réduit/déploie la sidebar gauche (globale, appelée par `onclick`) |
| `initSidebar()` | Position initiale du bouton toggle |
| `initDropdowns()` | Initialise les dropdowns Qualité et Confidentialité (hover + click + sélection active) |
| `setupDropdown(id, btnId, menuId)` | Configure un dropdown avec comportement hover/click/auto-fermeture |
| `setupSelectableDropdown(...)` | Étend `setupDropdown` avec sélection d'item, check visuel et callback |
| `initFocusMode()` | Gère le mode focus : masque les suggestions quand on tape, restaure quand on efface |
| `initContextMenu()` | Menu contextuel personnalisé pour le textarea |
| `initAIProviders()` | Module complet de gestion des fournisseurs/modèles IA (Pyramide & Sidebar) |
| `updateLayoutToggleButtons()` | Gestion centralisée de la visibilité des boutons de changement de disposition |
| `adjustPyramidShift()` | Repositionne dynamiquement les éléments centraux selon la hauteur de la barre de recherche |
| `initChat()` | Logique d'envoi de messages, bulles de chat, indicateur de frappe, éditeur brouillon |
| `copyCodeBlock(btn)` | Copie le contenu d'un bloc de code dans le presse-papier avec feedback visuel |
| `showProviderTooltip(btn, name)` | Affiche le tooltip du provider via un élément `fixed` sur le `<body>` (portal pattern) |
| `hideProviderTooltip()` | Masque le tooltip provider avec animation de fondu |

#### Module `initAIProviders()` — Détail

Ce module gère toute l'interaction avec les fournisseurs d'IA :

| Sous-fonction | Description |
|---------------|-------------|
| `getSlug(id)` | Extrait le slug du fournisseur depuis l'ID du modèle (`openai/gpt-4o` → `openai`) |
| `getLogo(slug)` | Retourne l'URL du favicon via Google Favicon API (DOMAINS map) ou initiales en fallback |
| `getInitials(name)` | Génère les initiales pour le fallback (ex: `"OpenAI"` → `"OA"`) |
| `slugColor(slug)` | Génère une couleur HSL unique basée sur un hash du slug |
| `getName(slug)` | Retourne le nom d'affichage du fournisseur (extrait dynamiquement de l'API) |
| `fetchModels()` | Récupère les modèles depuis OpenRouter avec cache sessionStorage (TTL: 30 min) |
| `processModels()` | Extrait les noms, groupe par fournisseur, **trie : favicon connus en tête, initiales en bas** |
| `renderProviders()` | Affiche les boutons logos dans la disposition active (Pyramid ou Sidebar) |
| `selectProvider(slug)` | Sélectionne un fournisseur et affiche ses modèles |
| `positionModelBar()` | Positionne le panneau de modèles en alignement avec la barre de saisie |
| `renderModels(models)` | Affiche la liste des modèles avec nom, ID, contexte et prix |
| `showBadge(name, slug)` | Affiche/met à jour le badge du modèle sélectionné au-dessus de la barre |
| `sendChatMessage(msg)` | Envoie un message via Supabase Edge Function (clé sécurisée serveur) |
| `createConversation(title)` | Crée une conversation dans Supabase DB |

#### Module `initChat()` — Détail

| Sous-fonction | Description |
|---------------|-------------|
| `switchToChatMode()` | Bascule de l'écran d'accueil au mode conversation |
| `addMessageBubble(role, content)` | Ajoute une bulle de message (user/assistant) |
| `renderMarkdown(text)` | Rendu markdown avec blocs de code colorisés et numérotés (via hljs + plugin) |
| `showTypingIndicator()` | Affiche l'indicateur de frappe animé |
| `handleSend()` | Gère l'envoi complet (validation, UI, appel API, réponse) |
| `autoNameConversation()` | Génère automatiquement un titre pour la conversation via IA |

#### Variables d'état

| Variable | Type | Description |
|----------|------|-------------|
| `allModels` | `Array` | Tous les modèles retournés par l'API |
| `providerMap` | `Object` | Modèles groupés par fournisseur (`{ slug: { name, logoUrl, models[] } }`) |
| `providerDisplayNames` | `Object` | Noms d'affichage extraits des données API |
| `selectedProvider` | `string\|null` | Slug du fournisseur actuellement sélectionné |
| `selectedProviderSlug` | `string\|null` | Slug sauvegardé lors de la sélection d'un modèle |
| `selectedModel` | `string\|null` | ID du modèle actuellement sélectionné |
| `currentConversationId` | `string\|null` | UUID de la conversation en cours |
| `chatMessages` | `Array` | Historique des messages pour le contexte API |
| `conversationStarted` | `boolean` | Indique si la conversation est en cours |
| `titleAutoSet` | `boolean` | Empêche le renommage automatique multiple |
| `isSending` | `boolean` | Verrou anti-double envoi |
| `providerLayout` | `string` | Disposition active (`'sidebar'` ou `'pyramid'`) |

### `splash.js`
Script chargé en premier, contient deux parties :

1. **Favicon arrondi** : charge `logo.png`, dessine sur un canvas avec clip arrondis, et remplace le favicon du navigateur
2. **Animation splash** : calcule le dessin SVG, fondu d'apparition. Peut être ignorée dynamiquement si `sessionStorage.getItem('skipSplash')` est présent.

---

## 🔌 APIs et Services Externes

### OpenRouter API
- **URL** : `https://openrouter.ai/api/v1/models`
- **Méthode** : `GET`
- **Données retournées** : liste de modèles avec `id`, `name`, `context_length`, `pricing`, `architecture`
- **Cache** : les données sont mises en cache dans `sessionStorage` pendant 30 minutes

### Google Favicon API
- **URL** : `https://www.google.com/s2/favicons?domain={domain}&sz=64`
- **Usage** : récupère le favicon de chaque fournisseur d'IA en 64x64px
- **Mapping `DOMAINS`** : dictionnaire slug → domaine réel du produit (ex: `openai` → `chatgpt.com`, `anthropic` → `claude.ai`, `google` → `gemini.google.com`)
- **Fallback** : si le slug n'est pas dans `DOMAINS`, génère des initiales colorées (HSL unique par slug)
- **Tri** : les providers avec un favicon connu apparaissent en tête de liste ; ceux en initiales sont relégués en bas

### highlightjs-line-numbers.js
- **CDN** : `https://cdnjs.cloudflare.com/ajax/libs/highlightjs-line-numbers.js/2.8.0/highlightjs-line-numbers.min.js`
- **Usage** : numérotation correcte des lignes dans les blocs de code, compatible avec les `<span>` hljs multi-lignes
- **Méthode** : `hljs.lineNumbersValue(html)` — génère un tableau `<table class="hljs-ln">` avec colonnes numéro / code

### Google Fonts
- **Inter** (300-700) : police principale de l'interface
- **Material Symbols Outlined** : icônes Material Design

### Tailwind CSS
- Chargé via CDN avec les plugins `forms` et `container-queries`
- Configuration personnalisée pour les couleurs, polices, arrondis et ombres

### Supabase (Backend)
- **Projet** : `omegai` (région: eu-west-1)
- **URL** : `https://zumhjpzbvnqtcntvwvff.supabase.co`
- **Edge Function `chat`** : proxy sécurisé qui lit la clé API depuis la DB et forward les requêtes vers OpenRouter
- **Tables** :
  - `api_keys` : stocke les clés API (RLS strict, aucun accès public)
  - `conversations` : stocke les conversations avec titre et modèle
  - `messages` : stocke les messages (user/assistant) liés aux conversations
- **Sécurité** : la clé OpenRouter ne transite jamais côté client

---

## 🎨 Thème et Design

### Palette de couleurs

| Token | Valeur | Usage |
|-------|--------|-------|
| `primary` | `#000000` | Éléments d'action principaux |
| `primary-content` | `#ffffff` | Texte sur fond primary |
| `background-light` | `#ffffff` | Fond de page |
| `background-subtle` | `#f9fafb` | Fonds secondaires (sidebar, inputs) |
| `border-subtle` | `#e5e7eb` | Bordures légères |
| `text-main` | `#111827` | Texte principal |
| `text-muted` | `#6b7280` | Texte secondaire / labels |

### Typographie
- **Police** : Inter (Google Fonts)
- **Poids** : 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Icônes** : Material Symbols Outlined

### Animations

| Animation | Durée | Usage |
|-----------|-------|-------|
| `splashDrawPath` | 3s | Dessin du logo SVG |
| `splashFillIn` | 0.5s | Remplissage noir du logo |
| `splashShrinkToBall` | 0.4s | Rétrécissement en boule |
| `splashBallAppear` | 0.4s | Apparition de la boule noire |
| `splashHeartbeat` | 1.2s | Battement de la boule |
| `fadeInUp` | 0.5s | Apparition du contenu central |
| `slideInRight` | 0.3s | Apparition de la sidebar IA |

---

## ⚙️ Fonctionnalités

### 1. Splash Screen
- Animation SVG du logo Omegai au chargement
- Transition fluide (fade-out/fade-in)
- **Ignorer (Skip)** : clic sur le logo actualise la page en esquivant l'animation (`sessionStorage`)

### 2. Sidebar gauche (Navigation)
- Recherche de chats (Modal global)
- Nouveau chat
- Espace de travail & Historique synchronisés en temps réel via Supabase Realtime
- Collapse/expand avec animation

### 3. Sélection de modèle IA (Double Disposition)
- **Disposition Pyramide** (Disposition 2) : logos centrés, flexbox avec pagination. Aucun tooltip n'apparaît au survol.
- **Disposition Sidebar droite** (Disposition 1) : colonne étroite à droite. Au survol de chaque logo, une **fenêtre contextuelle flottante** affiche le nom du provider à gauche de l'icône (portal `position:fixed` pour passer au-dessus de tous les conteneurs).
- **Changement de disposition** : uniquement possible avant le premier message envoyé.
- **Tri** : providers avec favicons connus en tête, ceux en initiales en bas de liste.

### 4. Blocs de code
- **Coloration syntaxique** : highlight.js (thème atom-one-dark)
- **Numérotation des lignes** : plugin `highlightjs-line-numbers.js` — gère correctement les `<span>` multi-lignes
- **Bouton Copier** : copie le code sans les numéros de ligne ; feedback visuel (icône check 2s)
- **Scrollbar horizontale** : stylisée en mode clair et sombre

### 5. Mode "Simplified" (Vue d'accueil)
- Disparition des éléments inutiles au profit d'une barre centrale pure
- **Agrandissement Dynamique** : quand l'utilisateur tape un long prompt, la barre s'agrandit et le contenu se décale vers le haut

### 6. Menus Contextuels
- **Zone de chat vide** : clic droit → menu page (copier, coller, etc.)
- **Bulles de message IA** : clic droit → menu avec actions (Copier, Résumer, Humaniser)
- **Textarea** : clic droit → Améliorer le prompt, Copier, Tout sélectionner
- **Sidebar IA (Disposition 1)** : clic droit → changer la disposition (avant premier message uniquement)

### 7. Dropdowns
- **Qualité** : Maximale / Éco / Eco Ultra (sélection active avec check visuel)
- **Confidentialité** : Privé / Public (sélection active avec check visuel)
- Comportement hover + click, fermeture automatique, mise à jour du label du bouton

### 8. Raccourcis Clavier

| Raccourci | Action |
|-----------|--------|
| `Ctrl+Enter` | Envoyer le message |
| `Ctrl+N` | Nouveau chat |
| `Ctrl+K` | Rechercher des conversations |
| `/` | Recherche rapide (hors champ texte) |
| `Escape` | Ferme le modal le plus au-dessus (hiérarchie : suppression → renommage → paramètres → brouillon → recherche → sélecteur de modèles) |

---

## 🚀 Optimisations

| Optimisation | Description |
|--------------|-------------|
| **Cache API** | `sessionStorage` avec TTL de 30 min pour les modèles OpenRouter |
| **DocumentFragment** | Insertion batch des éléments DOM (providers, modèles) |
| **Séparation des fichiers** | CSS / JS séparés pour une meilleure maintenabilité et mise en cache |
| **Favicon dynamique** | Généré via Canvas avec coins arrondis depuis `logo.png` |
| **Logos dynamiques** | Google Favicon API avec mapping `DOMAINS` précis |
| **Noms dynamiques** | Extraits automatiquement des données de l'API (préfixe avant `:`) |
| **Fallback initiales** | Couleurs HSL uniques par hash pour les logos manquants |
| **Tooltip portal** | `position:fixed` + `getBoundingClientRect()` pour passer au-dessus de tout conteneur |

---

## 🌐 Compatibilité

- **Navigateurs** : Chrome, Firefox, Safari, Edge (récents)
- **Responsive** : adaptation mobile avec sidebar masquable et header mobile
- **Écran minimum** : 320px de largeur

---

## 📝 Notes de développement

- Le projet utilise Tailwind CSS via CDN (pas de build nécessaire)
- Le chat fonctionne via Supabase Edge Function (clé API sécurisée côté serveur)
- Les conversations et messages sont sauvegardés dans Supabase DB
- Envoi : clic sur le bouton ou Ctrl+Enter
- Les boutons de changement de disposition sont gérés de manière centralisée par `updateLayoutToggleButtons()`

---

## 🔧 Changelog

### 09 mars 2026
- **Numérotation des lignes** : plugin officiel `highlightjs-line-numbers.js` — résout le bug d'alignement des numéros sur les tokens hljs multi-lignes
- **Favicons IA** : mapping `DOMAINS` mis à jour avec les vrais domaines produits (`chatgpt.com`, `claude.ai`, `gemini.google.com`, `meta.ai`…)
- **Tri des providers** : ceux avec un favicon connu apparaissent en haut, ceux en initiales en bas
- **Tooltip provider (Disposition 1)** : implémentation portal `position:fixed` pour passer au-dessus de tous les conteneurs — affiche le nom de l'IA à gauche du logo au survol
- **Disposition 2** : suppression complète de tout tooltip/flèche au survol des icônes
- **Espacement boutons sidebar** : bouton Recherche repositionné à `bottom:80px` (plus de chevauchement avec le bouton Disposition)

### 03 mars 2026 — Audit complet
- **Ctrl+Enter** pour envoyer les messages
- **Bouton copier** sur les blocs de code générés par l'IA
- **Dropdowns fonctionnels** : sélection Qualité/Confidentialité avec check visuel
- **38 bugs corrigés** : envoi clavier, réinitialisation modèle, hiérarchie Escape, XSS, positionnement pyramide…

---

*Dernière mise à jour : 09 mars 2026*
