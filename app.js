// ===== CONFIG SUPABASE =====
const SUPABASE_URL = 'https://zumhjpzbvnqtcntvwvff.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1bWhqcHpidm5xdGNudHZ3dmZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjczMjEsImV4cCI6MjA4NzIwMzMyMX0.yhDfU7qZLzCql0o5fVH-slsA5vYagFpgsWpU7R4elvo';
const CHAT_EDGE_FN = `${SUPABASE_URL}/functions/v1/chat`;
const MODELS_API_URL = `${CHAT_EDGE_FN}/models`;
const CACHE_VERSION = 8; // Increment this to force cache refresh
const CACHE_KEY = 'openrouter_models_v' + CACHE_VERSION;
const CACHE_TTL = 30 * 60 * 1000;

// ===== INITIALIZATION SUPABASE CLIENT =====
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SB_HEADERS = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
};

// ===== STATE =====
const state = {
    allModels: [],
    providerMap: {},
    providerDisplayNames: {},
    selectedProvider: null,
    selectedProviderSlug: null,
    selectedModel: null,
    providerLayout: 'sidebar', // 'sidebar' | 'pyramid'
    currentConversationId: null,
    chatMessages: [],
    conversations: [],
    ctxConversationId: null, // conversation targeted by context menu
    isSending: false,
    conversationStarted: false,
    titleAutoSet: false,
};

// ===== DOMAIN MAP FOR FAVICONS (slug -> website domain for favicon fetching) =====
const DOMAINS = {
    'openai': 'chatgpt.com',          // ChatGPT
    'anthropic': 'claude.ai',         // Claude
    'google': 'gemini.google.com',    // Gemini
    'meta-llama': 'meta.ai',          // Meta AI
    'mistralai': 'mistral.ai',
    'cohere': 'cohere.com',
    'perplexity': 'perplexity.ai',
    'deepseek': 'deepseek.com',
    'microsoft': 'copilot.microsoft.com',
    'nvidia': 'nvidia.com',
    'amazon': 'aws.amazon.com',
    'qwen': 'qwenlm.github.io',
    'x-ai': 'x.ai',
    'ai21': 'ai21.com',
    'databricks': 'databricks.com',
    'inflection': 'pi.ai',
    'deepcogito': 'deepcogito.com',
    'ibm-granite': 'ibm.com',
    'minimax': 'minimaxi.com',
    'stepfun': 'stepfun.com',
    'writer': 'writer.com',
    'liquid': 'liquid.ai',
    'black-forest-labs': 'blackforestlabs.ai',
    'moonshotai': 'moonshot.ai',
    'upstage': 'upstage.ai',
    'allenai': 'allenai.org',
    'arcee-ai': 'arcee.ai',
    'nousresearch': 'nousresearch.com',
    'openrouter': 'openrouter.ai',
    'featherless': 'featherless.ai',
    'prime-intellect': 'primeintellect.ai',
    'baidu': 'baidu.com',
    'bytedance': 'doubao.com',
    'bytedance-seed': 'doubao.com',
    'pygmalionai': 'pygmalion.chat',
    'aion-labs': 'aion-labs.com',
    'eleutherai': 'eleuther.ai',
    'mancer': 'mancer.tech',
    'tencent': 'hunyuan.tencent.com',
    // Nouveaux fournisseurs découverts:
    'sourceful': 'sourceful.io',
    'baai': 'baai.ac.cn',
    'sentence-transformers': 'huggingface.co',
    'intfloat': 'huggingface.co',
    'thenlper': 'huggingface.co',
};

// ===== HELPERS =====
const $ = (id) => document.getElementById(id);
const getSlug = (id) => id.split('/')[0];
const getInitials = (n) => n.split(/[\s-]+/).map(w => w[0]).join('').substring(0, 2).toUpperCase();
const slugColor = (slug) => {
    let h = 0;
    for (let i = 0; i < slug.length; i++) h = slug.charCodeAt(i) + ((h << 5) - h);
    return `hsl(${Math.abs(h) % 360}, 55%, 48%)`;
};
const getName = (slug) => state.providerDisplayNames[slug] || slug.charAt(0).toUpperCase() + slug.slice(1);
const iconCache = {};

function generateInitialsIcon(slug, name) {
    const size = 64, canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d'), color = slugColor(slug);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(getInitials(name || slug), size / 2, size / 2 + 1);
    return canvas.toDataURL('image/png');
}


const getLogo = (slug) => {
    const domain = DOMAINS[slug];
    if (domain) return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    if (!iconCache[slug]) iconCache[slug] = generateInitialsIcon(slug, state.providerDisplayNames[slug] || slug);
    return iconCache[slug];
};

function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ===== SUPABASE API CALLS =====

async function loadConversations() {
    const loadingState = $('convLoadingState');
    const emptyState = $('convEmptyState');

    try {
        if (loadingState) loadingState.style.display = 'flex';

        // Utilisation du client Supabase pour récupérer TOUTES les conversations
        // Triées par épinglage (desc) puis par date de mise à jour (desc)
        const { data, error } = await sb
            .from('conversations')
            .select('*')
            .order('pinned', { ascending: false })
            .order('updated_at', { ascending: false });

        if (error) throw error;

        state.conversations = data || [];
        renderConversationList();
    } catch (e) {
        console.error('[loadConversations] Error:', e);
        // En cas d'erreur, on rend quand même la liste (qui sera vide ou affichera l'état actuel)
        renderConversationList();
    } finally {
        if (loadingState) loadingState.style.display = 'none';
    }
}

async function createConversation(title) {
    // Optimistic UI: show conversation in sidebar immediately
    const tempId = 'temp-' + Date.now();
    const optimistic = {
        id: tempId,
        title: title || 'Nouveau chat',
        model_id: state.selectedModel,
        pinned: false,
        message_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    state.conversations.unshift(optimistic);
    state.currentConversationId = tempId;
    renderConversationList();
    setActiveConvInSidebar(tempId);

    try {
        const { data, error } = await sb
            .from('conversations')
            .insert({ title: title || 'Nouveau chat', model_id: state.selectedModel })
            .select();

        if (error) throw error;

        if (data?.[0]?.id) {
            const realId = data[0].id;
            const idx = state.conversations.findIndex(c => c.id === tempId);
            if (idx !== -1) state.conversations[idx] = data[0];
            else state.conversations.unshift(data[0]);

            state.currentConversationId = realId;
            renderConversationList();
            setActiveConvInSidebar(realId);
            return realId;
        }
    } catch (e) {
        console.error('[createConversation] Error:', e);
        // #35: Remove temp conversation on error to avoid orphaned entries
        state.conversations = state.conversations.filter(c => c.id !== tempId);
        state.currentConversationId = null;
        renderConversationList();
        return null;
    }
}


async function updateConversation(id, fields) {
    try {
        const { error } = await sb
            .from('conversations')
            .update(fields)
            .eq('id', id);

        if (error) throw error;

        const idx = state.conversations.findIndex(c => c.id === id);
        if (idx !== -1) Object.assign(state.conversations[idx], fields);
        renderConversationList();
        if (id === state.currentConversationId && fields.title) {
            updateConvTitleHeader(fields.title);
        }
    } catch (e) { console.error('updateConversation error:', e); }
}

async function deleteConversation(id) {
    try {
        const { error: msgErr } = await sb.from('messages').delete().eq('conversation_id', id);
        if (msgErr) throw msgErr;
        const { error: convErr } = await sb.from('conversations').delete().eq('id', id);
        if (convErr) throw convErr;
        state.conversations = state.conversations.filter(c => c.id !== id);
        if (state.currentConversationId === id) startNewChat();
        else renderConversationList();
    } catch (e) {
        console.error('deleteConversation error:', e);
        // #29: Visual feedback on error
        alert('Erreur lors de la suppression de la conversation. Veuillez réessayer.');
    }
}

async function loadMessages(conversationId) {
    try {
        const { data, error } = await sb
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('loadMessages error:', e);
        return [];
    }
}

async function saveMessage(conversationId, role, content, modelId) {
    if (!conversationId || conversationId.startsWith('temp-')) {
        return;
    }
    try {
        const { error } = await sb
            .from('messages')
            .insert({ conversation_id: conversationId, role, content, model_id: modelId });

        if (error) throw error;
    } catch (e) { console.error('[saveMessage] Error:', e); }
}

// Auto-generate title using AI after first message
async function autoNameConversation(userMessage, assistantMessage) {
    if (state.titleAutoSet || !state.currentConversationId) return;
    // #38: Capture the conversation ID at call time to avoid renaming wrong conv
    const targetConvId = state.currentConversationId;
    state.titleAutoSet = true;
    try {
        const namingMessages = [
            { role: 'user', content: userMessage },
            { role: 'assistant', content: assistantMessage },
            { role: 'user', content: "En te basant sur cet échange, génère un titre très court (3-6 mots max) qui résume le sujet. Réponds UNIQUEMENT avec le titre, sans ponctuation finale, sans guillemets, sans explication." }
        ];
        const resp = await fetch(CHAT_EDGE_FN, {
            method: 'POST',
            headers: SB_HEADERS,
            body: JSON.stringify({ model: state.selectedModel, messages: namingMessages, stream: false }),
        });
        if (!resp.ok) return;
        const data = await resp.json();
        let title = data.choices?.[0]?.message?.content?.trim();
        if (title) {
            title = title.replace(/^["'«»]+|["'«»]+$/g, '').substring(0, 60);
            await updateConversation(targetConvId, { title });
            // Only update header if still on the same conversation
            if (state.currentConversationId === targetConvId) {
                updateConvTitleHeader(title);
            }
        }
    } catch (e) { console.error('autoName error:', e); }
}

// ===== SEND CHAT MESSAGE =====
async function sendChatMessage(userMessage, onChunk) {
    if (!state.selectedModel) { alert('Veuillez sélectionner un modèle IA'); return null; }

    state.chatMessages.push({ role: 'user', content: userMessage });

    const conv = state.conversations.find(c => c.id === state.currentConversationId);
    let messages = state.chatMessages;
    if (conv?.system_prompt) {
        messages = [{ role: 'system', content: conv.system_prompt }, ...state.chatMessages];
    }

    if (state.currentConversationId) {
        await saveMessage(state.currentConversationId, 'user', userMessage, state.selectedModel);
    }

    try {
        const resp = await fetch(CHAT_EDGE_FN, {
            method: 'POST',
            headers: SB_HEADERS,
            body: JSON.stringify({ model: state.selectedModel, messages, stream: true }),
        });

        if (!resp.ok) {
            let errMsg = `Erreur ${resp.status}`;
            try { const eb = await resp.json(); errMsg = eb.error?.message || eb.error || JSON.stringify(eb); } catch (_) { }
            throw new Error(errMsg);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let assistantMsg = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6).trim();
                    if (dataStr === '[DONE]') break;
                    try {
                        const data = JSON.parse(dataStr);
                        const content = data.choices?.[0]?.delta?.content || '';
                        if (content) {
                            assistantMsg += content;
                            if (onChunk) onChunk(assistantMsg);
                        }
                    } catch (e) {
                        // Ignore parse errors for incomplete chunks
                    }
                }
            }
        }

        if (assistantMsg) {
            state.chatMessages.push({ role: 'assistant', content: assistantMsg });
            if (state.currentConversationId) {
                await saveMessage(state.currentConversationId, 'assistant', assistantMsg, state.selectedModel);
                await updateConversation(state.currentConversationId, {
                    model_id: state.selectedModel,
                    updated_at: new Date().toISOString()
                });
            }
            if (state.chatMessages.length === 2) {
                autoNameConversation(userMessage, assistantMsg);
            }
        }

        return assistantMsg;
    } catch (err) {
        console.error('Chat error:', err.message || err);
        return `⚠️ ${err.message || 'Erreur inconnue'}`;
    }
}

// ===== CONVERSATION SIDEBAR RENDER =====
function renderConversationList() {
    const pinned = state.conversations.filter(c => c.pinned);
    const recent = state.conversations.filter(c => !c.pinned);

    const pinnedSection = $('pinnedSection');
    const pinnedList = $('pinnedList');
    const convList = $('conversationList');
    const loadingState = $('convLoadingState');
    const emptyState = $('convEmptyState');

    // Hide loading spinner (keep in DOM so no null refs later)
    if (loadingState) loadingState.style.display = 'none';

    // Pinned section
    if (pinned.length > 0) {
        pinnedSection.classList.remove('hidden');
        pinnedList.innerHTML = '';
        pinned.forEach(c => pinnedList.appendChild(buildConvItem(c)));
    } else {
        pinnedSection.classList.add('hidden');
    }

    // Remove only conv-item elements (never remove emptyState from DOM)
    convList.querySelectorAll('.conv-item').forEach(el => el.remove());

    if (recent.length === 0 && pinned.length === 0) {
        // Show empty state
        emptyState.style.display = 'flex';
        emptyState.classList.remove('hidden');
    } else {
        // Hide empty state and build list
        emptyState.style.display = 'none';
        emptyState.classList.add('hidden');
        recent.forEach(c => convList.appendChild(buildConvItem(c)));
    }

    // Highlight active conversation
    if (state.currentConversationId) setActiveConvInSidebar(state.currentConversationId);
}

function buildConvItem(conv) {
    const el = document.createElement('div');
    el.className = 'conv-item group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm text-text-main hover:bg-background-light hover:shadow-sm transition-all';
    el.dataset.id = conv.id;

    const icon = conv.pinned ? 'push_pin' : 'chat_bubble';
    el.innerHTML = `
        <span class="material-symbols-outlined text-[16px] text-text-muted shrink-0">${icon}</span>
        <span class="conv-title flex-1 truncate">${escHtml(conv.title || 'Nouveau chat')}</span>
        <button class="conv-menu-btn opacity-0 group-hover:opacity-100 p-0.5 text-text-muted hover:text-primary rounded transition-all shrink-0" data-id="${conv.id}" title="Options">
            <span class="material-symbols-outlined text-[16px]">more_horiz</span>
        </button>
    `;

    el.addEventListener('click', (e) => {
        if (e.target.closest('.conv-menu-btn')) return;
        openConversation(conv.id);
    });

    el.querySelector('.conv-menu-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showConvContextMenu(conv.id, e.currentTarget);
    });

    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showConvContextMenu(conv.id, null, e.clientX, e.clientY);
    });

    return el;
}

function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setActiveConvInSidebar(id) {
    document.querySelectorAll('.conv-item').forEach(el => {
        el.classList.toggle('bg-background-light', el.dataset.id === id);
        el.classList.toggle('shadow-sm', el.dataset.id === id);
        el.classList.toggle('font-medium', el.dataset.id === id);
    });
}

// ===== OPEN CONVERSATION =====
async function openConversation(id) {
    if (window.innerWidth < 768 && !$('sidebar').classList.contains('sidebar-collapsed')) toggleSidebar();
    if (state.currentConversationId === id) return;

    const conv = state.conversations.find(c => c.id === id);
    if (!conv) return;

    // Reset UI
    const chatArea = $('chatMessagesArea');
    const titleArea = $('titleArea');
    const suggestionsGrid = $('suggestionsGrid');
    const contentArea = $('contentArea');

    chatArea.innerHTML = '';
    chatArea.classList.remove('hidden');
    chatArea.classList.add('flex', 'flex-col');
    titleArea.style.display = 'none';
    suggestionsGrid.style.display = 'none';
    contentArea.classList.remove('justify-center');
    contentArea.classList.add('justify-end');

    state.currentConversationId = id;
    state.conversationStarted = true;
    document.body.classList.add('conversation-started');
    state.titleAutoSet = true; // Don't auto-rename loaded convs
    state.chatMessages = [];

    // #6/#7: Hide AI sidebar, model selector, and layout toggle buttons
    const modelBar = $('modelSelectorBar');
    if (modelBar) modelBar.classList.add('hidden');
    const aiSidebar = $('aiProviderSidebar');
    if (aiSidebar) { aiSidebar.classList.add('hidden'); aiSidebar.classList.remove('sidebar-show'); }
    updateLayoutToggleButtons();

    setActiveConvInSidebar(id);
    updateConvTitleHeader(conv.title || 'Nouveau chat');

    // Restore model
    if (conv.model_id) {
        restoreModel(conv.model_id);
    }

    // Load messages
    chatArea.innerHTML = `<div class="flex justify-center py-8"><div class="w-5 h-5 border-2 border-border-subtle border-t-black rounded-full animate-spin"></div></div>`;
    const messages = await loadMessages(id);
    chatArea.innerHTML = '';

    messages.forEach(m => {
        if (m.role !== 'system') {
            state.chatMessages.push({ role: m.role, content: m.content });
            addMessageBubble(m.role, m.content, false);
        }
    });

    chatArea.scrollTop = chatArea.scrollHeight;
}

function restoreModel(modelId) {
    if (!modelId) return;
    state.selectedModel = modelId;
    state.selectedProviderSlug = getSlug(modelId);

    // Find model name for badge
    const model = state.allModels.find(m => m.id === modelId);
    const slug = getSlug(modelId);
    const shortName = modelId.split('/').slice(1).join('/');
    showBadge(model?.name || shortName, slug);

    // Update visual selection in provider list
    document.querySelectorAll('.provider-logo-btn').forEach(b => b.classList.toggle('selected', b.dataset.slug === slug));
}

// ===== START NEW CHAT =====
function startNewChat() {
    if (window.innerWidth < 768 && !$('sidebar').classList.contains('sidebar-collapsed')) toggleSidebar();
    state.currentConversationId = null;
    state.chatMessages = [];
    state.conversationStarted = false;
    state.titleAutoSet = false;
    state.selectedProvider = null; // #13: reset provider selection
    state.ctxConversationId = null; // #10: clear context menu target
    document.body.classList.remove('conversation-started');

    const chatArea = $('chatMessagesArea');
    const titleArea = $('titleArea');
    const suggestionsGrid = $('suggestionsGrid');
    const contentArea = $('contentArea');

    chatArea.innerHTML = '';
    chatArea.classList.add('hidden');
    chatArea.classList.remove('flex', 'flex-col');
    titleArea.style.display = '';
    suggestionsGrid.style.display = '';
    contentArea.classList.add('justify-center');
    contentArea.classList.remove('justify-end');

    // Hide title in header
    const titleArea2 = $('currentConvTitleArea');
    if (titleArea2) titleArea2.classList.add('hidden');
    const titleEl = $('currentConvTitle');
    if (titleEl) titleEl.textContent = '';

    // #7/#8: Hide model selector bar and AI sidebar
    const modelBar = $('modelSelectorBar');
    if (modelBar) modelBar.classList.add('hidden');
    const aiSidebar = $('aiProviderSidebar');
    if (aiSidebar) { aiSidebar.classList.add('hidden'); aiSidebar.classList.remove('sidebar-show'); }

    setActiveConvInSidebar(null);
    renderConversationList();

    // Hide badge if in pyramid mode (new chat = no badge in pyramid)
    const isPyramidNewChat = state.providerLayout === 'pyramid' && document.body.classList.contains('simplified-mode');
    const badge = $('selectedModelBadge');
    if (badge && isPyramidNewChat) {
        badge.style.display = 'none';
    }

    // Re-render providers to restore pyramid layout if needed
    if (window._renderProviders) window._renderProviders();

    $('chatTextarea').focus();
}

function updateConvTitleHeader(title) {
    const area = $('currentConvTitleArea');
    const el = $('currentConvTitle');
    if (area && el) {
        el.textContent = title;
        area.classList.remove('hidden');
        area.classList.add('flex');
    }
    const mobileTitle = $('mobileConvTitle');
    if (mobileTitle) mobileTitle.textContent = title;
}

// ===== CONTEXT MENU =====
function showConvContextMenu(id, anchor, x, y) {
    state.ctxConversationId = id;
    const menu = $('convContextMenu');
    const conv = state.conversations.find(c => c.id === id);

    // Update pin label
    $('ctxPinLabel').textContent = conv?.pinned ? 'Désépingler' : 'Épingler';

    menu.classList.remove('hidden');

    if (anchor) {
        const r = anchor.getBoundingClientRect();
        x = r.right + 4;
        y = r.top;
    }

    // Clamp to viewport
    menu.style.left = '0px'; menu.style.top = '0px';
    requestAnimationFrame(() => {
        const mr = menu.getBoundingClientRect();
        const cx = Math.min(x, window.innerWidth - mr.width - 8);
        const cy = Math.min(y, window.innerHeight - mr.height - 8);
        menu.style.left = cx + 'px';
        menu.style.top = cy + 'px';
    });
}

function hideConvContextMenu() {
    $('convContextMenu').classList.add('hidden');
    state.ctxConversationId = null;
}

// ===== RENAME MODAL =====
function openRenameModal(id) {
    const conv = state.conversations.find(c => c.id === id);
    if (!conv) return;
    $('renameInput').value = conv.title || '';
    $('renameModal').classList.remove('hidden');
    setTimeout(() => { $('renameInput').focus(); $('renameInput').select(); }, 50);
}

function closeRenameModal() { $('renameModal').classList.add('hidden'); }

// ===== SETTINGS MODAL =====
function openSettingsModal(id) {
    const conv = state.conversations.find(c => c.id === id);
    if (!conv) return;

    state.ctxConversationId = id;

    $('settingsCreatedAt').textContent = formatDate(conv.created_at);
    $('settingsMsgCount').textContent = `${conv.message_count ?? '—'} messages`;
    $('settingsModel').textContent = conv.model_id || '—';
    $('settingsTitleInput').value = conv.title || '';
    $('settingsSystemPrompt').value = conv.system_prompt || '';

    const toggle = $('settingsPinToggle');
    const knob = $('settingsPinKnob');
    const isPinned = !!conv.pinned;
    toggle.setAttribute('aria-checked', isPinned ? 'true' : 'false');
    toggle.classList.toggle('bg-black', isPinned);
    toggle.classList.toggle('bg-background-subtle', !isPinned);
    knob.classList.toggle('translate-x-5', isPinned);
    knob.classList.toggle('translate-x-0', !isPinned);

    $('convSettingsModal').classList.remove('hidden');
}

function closeSettingsModal() { $('convSettingsModal').classList.add('hidden'); }

// ===== DELETE CONFIRM =====
let pendingDeleteId = null;

function openDeleteConfirm(id) {
    pendingDeleteId = id;
    closeSettingsModal();
    $('deleteConfirmModal').classList.remove('hidden');
}

function closeDeleteConfirm() { $('deleteConfirmModal').classList.add('hidden'); pendingDeleteId = null; }

// ===== CHAT UI =====
function addMessageBubble(role, content, scroll = true) {
    const chatArea = $('chatMessagesArea');
    const wrapper = document.createElement('div');
    wrapper.className = `flex flex-col w-full mb-4 gap-1 ${role === 'user' ? 'items-end' : 'items-start'}`;

    const bubbleWrapper = document.createElement('div');
    bubbleWrapper.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} w-full`;

    const bubble = document.createElement('div');
    bubble.className = role === 'user'
        ? 'max-w-[80%] bg-background-subtle text-text-main rounded-3xl px-4 py-2.5 text-sm leading-relaxed'
        : 'max-w-full text-text-main py-2 text-sm leading-relaxed w-full';
    bubble.innerHTML = renderMarkdown(content);

    bubbleWrapper.appendChild(bubble);
    wrapper.appendChild(bubbleWrapper);

    // Ajout des boutons d'actions sous les réponses de l'IA
    if (role === 'assistant') {
        const actionRow = document.createElement('div');
        actionRow.className = 'flex gap-2 items-center mt-1 ml-1';

        const btnResume = document.createElement('button');
        btnResume.className = 'text-[11px] px-3 py-1.5 rounded-full bg-background-light border border-border-subtle hover:bg-background-subtle text-text-muted transition flex items-center gap-1 cursor-pointer';
        btnResume.innerHTML = '<span class="material-symbols-outlined text-[12px]">summarize</span> Résumer';
        btnResume.onclick = () => {
            const ta = $('chatTextarea');
            ta.value = "Fais un résumé clair et concis de ta dernière réponse.";
            ta.focus();
            setTimeout(handleSend, 10);
        };

        const btnReform = document.createElement('button');
        btnReform.className = 'text-[11px] px-3 py-1.5 rounded-full bg-background-light border border-border-subtle hover:bg-background-subtle text-text-muted transition flex items-center gap-1 cursor-pointer';
        btnReform.innerHTML = '<span class="material-symbols-outlined text-[12px]">edit_note</span> Humaniser';
        btnReform.title = "Reformuler pour masquer le fait que c'est une IA";
        btnReform.onclick = () => {
            const ta = $('chatTextarea');
            ta.value = "Reformule ta réponse de manière extrêmement humaine, fluide et naturelle, en supprimant toutes les tournures typiques d'une IA, afin qu'il soit impossible de deviner que c'est une machine qui a écrit ce texte.";
            ta.focus();
            setTimeout(handleSend, 10);
        };

        actionRow.appendChild(btnResume);
        actionRow.appendChild(btnReform);
        wrapper.appendChild(actionRow);
    }

    chatArea.appendChild(wrapper);
    if (scroll) chatArea.scrollTop = chatArea.scrollHeight;

    return bubble;
}

function renderMarkdown(text) {
    // 1. Extraire les blocs de code AVANT l'échappement HTML pour que hljs reçoive du code brut
    const codeBlocks = [];
    const textWithPlaceholders = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        let highlightedValue;
        if (typeof hljs !== 'undefined') {
            try {
                if (lang && hljs.getLanguage(lang)) {
                    highlightedValue = hljs.highlight(code, { language: lang }).value;
                } else {
                    highlightedValue = hljs.highlightAuto(code).value;
                }
            } catch (e) {
                highlightedValue = escHtml(code);
            }
        } else {
            highlightedValue = escHtml(code);
        }
        const idx = codeBlocks.length;
        codeBlocks.push({ html: highlightedValue, lang: lang || '' });
        return `%%CODEBLOCK_${idx}%%`;
    });

    // 2. Échapper le HTML dans le reste du texte
    const safeText = textWithPlaceholders
        .replace(/&(?!amp;|lt;|gt;|quot;|#)/g, '&amp;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 3. Appliquer les autres transformations markdown
    let result = safeText
        .replace(/`([^`]+)`/g, '<code class="bg-background-subtle text-text-main px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');

    // 4. Réinsérer les blocs de code avec numérotation via le plugin hljs.lineNumbersValue()
    //    Ce plugin gère correctement les <span> hljs ouverts sur plusieurs lignes.
    codeBlocks.forEach(({ html, lang }, idx) => {
        let numberedHtml = html;
        // Use plugin if available (it handles multi-line hljs spans correctly)
        if (typeof hljs !== 'undefined' && typeof hljs.lineNumbersValue === 'function') {
            numberedHtml = hljs.lineNumbersValue(html, { singleLine: true });
        } else {
            // Fallback: simple line splitting (may have minor alignment issues on multi-line tokens)
            const rawLines = html.split('\n');
            if (rawLines[rawLines.length - 1].trim() === '') rawLines.pop();
            numberedHtml = rawLines.map((line, i) =>
                `<span class="code-line-row"><span class="ln">${i + 1}</span><span class="lc">${line || ' '}</span></span>`
            ).join('');
        }
        result = result.replace(`%%CODEBLOCK_${idx}%%`,
            `<div class="code-block-wrapper" style="position:relative;">` +
            `<pre class="code-pre-num hljs-ln" style="background:#1e1e2e;border-radius:0.5rem;margin:0.5rem 0;overflow-x:auto;font-size:0.75rem;font-family:monospace;line-height:1.6;padding:0.75rem 0;">` +
            `<code class="hljs ${lang ? 'language-' + lang : ''}">${numberedHtml}</code></pre>` +
            `<button onclick="copyCodeBlock(this)" class="copy-code-btn" title="Copier le code" style="position:absolute;top:10px;right:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#9ca3af;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;transition:all 0.2s ease;">` +
            `<span class="material-symbols-outlined" style="font-size:14px;">content_copy</span></button></div>`
        );
    });

    return result;
}

function copyCodeBlock(btn) {
    const wrapper = btn.closest('.code-block-wrapper');
    const codeEl = wrapper.querySelector('code');
    if (!codeEl) return;

    let text;
    // Plugin format: <td class="hljs-ln-code"> per line
    const pluginCells = codeEl.querySelectorAll('td.hljs-ln-code');
    if (pluginCells.length > 0) {
        text = Array.from(pluginCells).map(td => td.textContent).join('\n');
    } else {
        // Fallback format: <span class="lc"> per line
        const fallbackCells = codeEl.querySelectorAll('.lc');
        text = fallbackCells.length > 0
            ? Array.from(fallbackCells).map(el => el.textContent).join('\n')
            : codeEl.textContent;
    }

    navigator.clipboard.writeText(text).then(() => {
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = 'check';
        btn.style.color = '#4ade80';
        btn.style.borderColor = 'rgba(74,222,128,0.4)';
        setTimeout(() => {
            if (icon) icon.textContent = 'content_copy';
            btn.style.color = '#9ca3af';
            btn.style.borderColor = 'rgba(255,255,255,0.15)';
        }, 2000);
    }).catch(err => {
        console.error('Copy failed:', err);
    });
}


function showTypingIndicator() {
    const chatArea = $('chatMessagesArea');
    const wrapper = document.createElement('div');
    wrapper.className = 'flex justify-start w-full';
    wrapper.id = 'typingIndicator';
    wrapper.innerHTML = `<div class="bg-background-subtle border border-border-subtle rounded-2xl rounded-bl-md px-4 py-3 shadow-sm flex items-center gap-1.5">
        <span class="w-2 h-2 bg-text-muted rounded-full animate-bounce" style="animation-delay:0ms"></span>
        <span class="w-2 h-2 bg-text-muted rounded-full animate-bounce" style="animation-delay:150ms"></span>
        <span class="w-2 h-2 bg-text-muted rounded-full animate-bounce" style="animation-delay:300ms"></span>
    </div>`;
    chatArea.appendChild(wrapper);
    chatArea.scrollTop = chatArea.scrollHeight;
}

function removeTypingIndicator() { const el = $('typingIndicator'); if (el) el.remove(); }

// ===== HANDLE SEND =====
async function handleSend() {
    const textarea = $('chatTextarea');
    const sendBtn = $('sendBtn');
    const msg = textarea.value.trim();
    if (!msg || state.isSending) return;
    if (!state.selectedModel) { alert("Veuillez d'abord sélectionner un modèle IA dans la barre à droite"); return; }

    state.isSending = true;
    sendBtn.disabled = true;

    if (!state.conversationStarted) {
        state.conversationStarted = true;
        document.body.classList.add('conversation-started');
        const titleArea = $('titleArea');
        const suggestionsGrid = $('suggestionsGrid');
        const chatArea = $('chatMessagesArea');
        const contentArea = $('contentArea');
        titleArea.style.display = 'none';
        suggestionsGrid.style.display = 'none';
        chatArea.classList.remove('hidden');
        chatArea.classList.add('flex', 'flex-col');
        contentArea.classList.remove('justify-center');
        contentArea.classList.add('justify-end');

        // Hide layout toggle buttons when conversation starts
        updateLayoutToggleButtons();

        // Show the model badge above the input bar (especially important for pyramid mode)
        if (state.selectedModel) {
            const model = state.allModels.find(m => m.id === state.selectedModel);
            const slug = getSlug(state.selectedModel);
            const shortName = state.selectedModel.split('/').slice(1).join('/');
            showBadge(model?.name || shortName, slug);
        }
    }

    if (!state.currentConversationId) {
        const convId = await createConversation('Nouveau chat');
        // #35: If conv creation failed, abort sending
        if (!convId) {
            state.isSending = false;
            sendBtn.disabled = false;
            return;
        }
    }

    addMessageBubble('user', msg);
    textarea.value = '';
    textarea.style.height = '44px';
    // #23: Only reset positioning if in pyramid mode
    const isPyr = state.providerLayout === 'pyramid';
    if (isPyr) {
        $('inputContainer').style.top = '';
        const tArea = $('titleArea');
        if (tArea) tArea.style.bottom = '';
    }
    showTypingIndicator();

    // Create placeholder for assistant response
    let assistantBubble = null;
    const reply = await sendChatMessage(msg, (fullText) => {
        removeTypingIndicator();
        if (!assistantBubble) {
            assistantBubble = addMessageBubble('assistant', fullText);
        } else {
            assistantBubble.innerHTML = renderMarkdown(fullText);
            const chatArea = $('chatMessagesArea');
            chatArea.scrollTop = chatArea.scrollHeight;
        }
    });

    removeTypingIndicator();
    if (!assistantBubble && reply) {
        addMessageBubble('assistant', reply);
    }

    state.isSending = false;
    sendBtn.disabled = false;
    textarea.focus();
}

// ===== PROVIDER TOOLTIP (fixed portal — avoids all overflow clipping) =====
let _provTooltipEl = null;
let _provTooltipTimer = null;

function getProvTooltipEl() {
    if (!_provTooltipEl) {
        _provTooltipEl = document.createElement('div');
        _provTooltipEl.id = 'providerHoverTooltip';
        _provTooltipEl.style.cssText = [
            'position:fixed',
            'z-index:9999',
            'pointer-events:none',
            'opacity:0',
            'transform:translateX(4px)',
            'transition:opacity 0.15s ease,transform 0.15s ease',
            'background:var(--tooltip-bg,#1e1e2e)',
            'color:var(--tooltip-color,#f0f0f0)',
            'font-size:12px',
            'font-weight:600',
            'padding:5px 12px',
            'border-radius:8px',
            'white-space:nowrap',
            'border:1px solid rgba(255,255,255,0.12)',
            'box-shadow:0 4px 16px rgba(0,0,0,0.25),0 1px 4px rgba(0,0,0,0.15)',
            'display:flex',
            'align-items:center',
            'gap:0',
        ].join(';');

        // Arrow pointing right toward the icon
        const arrow = document.createElement('span');
        arrow.style.cssText = [
            'position:absolute',
            'right:-7px',
            'top:50%',
            'transform:translateY(-50%)',
            'width:0',
            'height:0',
            'border-style:solid',
            'border-width:5px 0 5px 7px',
            'border-color:transparent transparent transparent rgba(255,255,255,0.12)',
        ].join(';');
        _provTooltipEl.appendChild(arrow);

        const arrowInner = document.createElement('span');
        arrowInner.style.cssText = [
            'position:absolute',
            'right:-5px',
            'top:50%',
            'transform:translateY(-50%)',
            'width:0',
            'height:0',
            'border-style:solid',
            'border-width:4px 0 4px 6px',
            'border-color:transparent transparent transparent #1e1e2e',
            'z-index:1',
        ].join(';');
        _provTooltipEl.appendChild(arrowInner);

        document.body.appendChild(_provTooltipEl);
    }

    // Sync colors with current theme
    const isDark = document.documentElement.classList.contains('dark');
    const bg = isDark ? '#1e1e2e' : getComputedStyle(document.documentElement).getPropertyValue('--color-background-light') || '#ffffff';
    const fg = isDark ? '#f0f0f0' : '#111827';
    _provTooltipEl.style.background = bg;
    _provTooltipEl.style.color = fg;
    // Update arrow inner to match bg
    if (_provTooltipEl.children[1]) _provTooltipEl.children[1].style.borderLeftColor = bg;

    return _provTooltipEl;
}

function showProviderTooltip(btn, name) {
    clearTimeout(_provTooltipTimer);
    const el = getProvTooltipEl();
    // Set text (first text node, before the arrow spans)
    el.childNodes[0]?.nodeType === Node.TEXT_NODE
        ? el.childNodes[0].textContent = name
        : el.insertBefore(document.createTextNode(name), el.firstChild);

    // Position: to the left of the button
    el.style.opacity = '0';
    el.style.display = 'flex';

    requestAnimationFrame(() => {
        const rect = btn.getBoundingClientRect();
        const tw = el.offsetWidth;
        const th = el.offsetHeight;
        const top = rect.top + (rect.height - th) / 2;
        const left = rect.left - tw - 14; // 14px gap

        el.style.top = Math.max(4, top) + 'px';
        el.style.left = Math.max(4, left) + 'px';

        // Animate in
        _provTooltipTimer = setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateX(0)';
        }, 30);
    });
}

function hideProviderTooltip() {
    clearTimeout(_provTooltipTimer);
    if (_provTooltipEl) {
        _provTooltipEl.style.opacity = '0';
        _provTooltipEl.style.transform = 'translateX(4px)';
    }
}

// ===== AI PROVIDERS =====
function initAIProviders() {
    const sidebar = $('aiProviderSidebar');
    const logoList = $('providerLogoList');
    const modelBar = $('modelSelectorBar');
    const modelListEl = $('modelList');
    const selLogo = $('selectedProviderLogo');
    const selName = $('selectedProviderName');
    const closeBtn = $('closeModelSelector');
    const textarea = $('chatTextarea');

    async function fetchModels() {
        try {
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (cached) {
                const { data, ts } = JSON.parse(cached);
                if (Date.now() - ts < CACHE_TTL) {
                    state.allModels = data;
                    console.log(`[Omegai] Loaded ${data.length} models from cache`);
                    processModels(); return;
                }
            }
            // Clear old cache keys
            Object.keys(sessionStorage).filter(k => k.startsWith('openrouter_models')).forEach(k => sessionStorage.removeItem(k));
            const resp = await fetch(MODELS_API_URL, { headers: SB_HEADERS });
            const json = await resp.json();
            state.allModels = json.data || [];

            console.log(`[Omegai] Fetched ${state.allModels.length} models from OpenRouter API + Sitemap`);
            try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: state.allModels, ts: Date.now() })); } catch (_) { }
            processModels();
        } catch (err) {
            console.error('Models fetch failed:', err);
            logoList.innerHTML = '<p class="text-xs text-text-muted text-center p-4">Erreur de chargement</p>';
        }
    }

    function processModels() {
        state.allModels.forEach(m => {
            const slug = getSlug(m.id);
            if (!state.providerDisplayNames[slug] && m.name?.includes(':')) {
                state.providerDisplayNames[slug] = m.name.split(':')[0].trim();
            }
        });
        state.providerMap = {};
        state.allModels.forEach(m => {
            const slug = getSlug(m.id);
            if (!state.providerMap[slug]) state.providerMap[slug] = { name: getName(slug), logoUrl: getLogo(slug), models: [] };
            state.providerMap[slug].models.push(m);
        });

        // Sort: providers with a known favicon domain first (sorted by model count),
        // then providers that will show initials (not in DOMAINS map), also sorted by model count.
        const sorted = {};
        const allSlugs = Object.keys(state.providerMap);
        const withFavicon = allSlugs.filter(s => DOMAINS[s]).sort((a, b) => state.providerMap[b].models.length - state.providerMap[a].models.length);
        const withInitials = allSlugs.filter(s => !DOMAINS[s]).sort((a, b) => state.providerMap[b].models.length - state.providerMap[a].models.length);
        [...withFavicon, ...withInitials].forEach(k => sorted[k] = state.providerMap[k]);
        state.providerMap = sorted;
        console.log(`[Omegai] ${Object.keys(sorted).length} providers (${withFavicon.length} with favicon, ${withInitials.length} with initials), ${state.allModels.length} total models`);
        renderProviders();
    }

    function renderProviders() {
        const isPyramid = state.providerLayout === 'pyramid' && document.body.classList.contains('simplified-mode') && !state.conversationStarted;
        const pyramidContainer = $('pyramidProviders');
        const sidebarEl = $('aiProviderSidebar');

        const elements = [];

        // Deselect button
        const desel = document.createElement('button');
        desel.className = 'provider-logo-btn shrink-0'; desel.dataset.slug = '__none__';
        desel.innerHTML = `<span class="material-symbols-outlined text-[24px] text-text-muted" style="display:flex;align-items:center;justify-content:center;">block</span>
            <span class="provider-pill-text text-[13px] font-medium text-text-main whitespace-nowrap overflow-hidden text-ellipsis">Aucun modèle</span>
            <span class="provider-tooltip">Aucun modèle</span>`;
        desel.addEventListener('click', () => {
            state.selectedModel = state.selectedProvider = state.selectedProviderSlug = null;
            modelBar.classList.add('hidden');
            document.querySelectorAll('.provider-logo-btn').forEach(b => b.classList.remove('selected'));
            const badge = $('selectedModelBadge'); if (badge) badge.style.display = 'none';
            if (!textarea.value.trim() && !isPyramid) { sidebarEl.classList.add('hidden'); sidebarEl.classList.remove('sidebar-show'); }
        });
        elements.push(desel);

        // Model search button for pyramid layout — appears after "Aucun modèle"
        if (isPyramid) {
            const searchPillBtn = document.createElement('button');
            searchPillBtn.className = 'provider-logo-btn shrink-0';
            searchPillBtn.dataset.slug = '__search__';
            searchPillBtn.title = 'Rechercher un modèle';
            searchPillBtn.innerHTML = `<span class="material-symbols-outlined text-[20px] text-text-muted" style="display:flex;align-items:center;justify-content:center;">search</span>
                <span class="provider-pill-text text-[13px] font-medium text-text-main whitespace-nowrap">Rechercher</span>
                <span class="provider-tooltip">Rechercher un modèle</span>`;
            searchPillBtn.addEventListener('click', () => openModelSearchModal());
            elements.push(searchPillBtn);
        }

        Object.entries(state.providerMap).forEach(([slug, prov]) => {
            const btn = document.createElement('button');
            btn.className = 'provider-logo-btn shrink-0'; btn.dataset.slug = slug;
            btn.dataset.provName = prov.name; // store name for tooltip
            const color = slugColor(slug);
            const logoUrl = getLogo(slug);
            btn.innerHTML = `<img src="${logoUrl}" alt="${prov.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
                <span style="display:none;font-size:13px;font-weight:700;color:${color};align-items:center;justify-content:center;width:100%;height:100%;">${getInitials(prov.name)}</span>
                <span class="provider-pill-text text-[13px] font-medium text-text-main whitespace-nowrap overflow-hidden text-ellipsis">${prov.name}</span>
                <span class="provider-tooltip">${isPyramid ? '' : prov.name + ' (' + prov.models.length + ')'}</span>`;

            // Tooltip via fixed portal (only in sidebar mode, not pyramid)
            if (!isPyramid) {
                btn.addEventListener('mouseenter', () => showProviderTooltip(btn, prov.name));
                btn.addEventListener('mouseleave', hideProviderTooltip);
            }

            btn.addEventListener('click', () => selectProvider(slug));
            elements.push(btn);
        });

        // Setup pyramid layout if active
        if (isPyramid && pyramidContainer) {
            sidebarEl.classList.add('hidden'); sidebarEl.classList.remove('sidebar-show');
            pyramidContainer.classList.remove('hidden');
            pyramidContainer.innerHTML = '';

            state.pyramidPage = state.pyramidPage || 0;

            // Calculate pyramid capacity based on inputBar width
            const barW = $('inputBar')?.offsetWidth || 600;
            // Target ~115px button (pill) + 12px gap (gap-3)
            let wMax = Math.max(3, Math.floor((barW + 12) / (115 + 12)));

            // For a 4-row pyramid: row 1 -> wMax, row 2 -> wMax-1, row 3 -> wMax-2, row 4 -> wMax-3
            // Base capacity = wMax + (wMax-1) + (wMax-2) + (wMax-3) = 4*wMax - 6
            const capacityTotal = (4 * wMax) - 6;

            // Chunk elements into pages
            let chunks = [];
            let i = 0;
            while (i < elements.length) {
                // If the very first page can hold EVERYTHING without prev/next
                if (i === 0 && elements.length <= capacityTotal) {
                    chunks.push(elements.slice(0, elements.length));
                    break;
                }

                // If it's the first page but there's more remaining (needs Next)
                if (i === 0) {
                    chunks.push(elements.slice(0, capacityTotal - 1));
                    i += capacityTotal - 1;
                }
                // Any middle/last page
                else {
                    let cap = capacityTotal - 2; // Needs Prev + Next
                    if (elements.length - i <= capacityTotal - 1) {
                        cap = capacityTotal - 1; // Last page, only needs Prev
                    }
                    chunks.push(elements.slice(i, i + cap));
                    i += cap;
                }
            }
            if (chunks.length === 0) chunks.push([]);
            if (state.pyramidPage >= chunks.length) state.pyramidPage = chunks.length - 1;

            let pageItems = [...chunks[state.pyramidPage]];

            if (state.pyramidPage > 0) {
                const prevBtn = document.createElement('button');
                prevBtn.className = 'provider-logo-btn shrink-0';
                prevBtn.innerHTML = `<span class="material-symbols-outlined text-[24px] text-text-muted" style="display:flex;align-items:center;justify-content:center;">arrow_back</span>
                    <span class="provider-pill-text text-[13px] font-medium text-text-main whitespace-nowrap">Précédent</span>
                    <span class="provider-tooltip">Précédent</span>`;
                prevBtn.addEventListener('click', () => { state.pyramidPage--; renderProviders(); });
                pageItems.unshift(prevBtn);
            }

            if (state.pyramidPage < chunks.length - 1) {
                const nextBtn = document.createElement('button');
                nextBtn.className = 'provider-logo-btn shrink-0';
                nextBtn.innerHTML = `<span class="material-symbols-outlined text-[24px] text-text-muted" style="display:flex;align-items:center;justify-content:center;">more_horiz</span>
                    <span class="provider-pill-text text-[13px] font-medium text-text-main whitespace-nowrap">Suivant</span>
                    <span class="provider-tooltip">Suivant</span>`;
                nextBtn.addEventListener('click', () => { state.pyramidPage++; renderProviders(); });
                pageItems.push(nextBtn);
            }

            // Remainder logic removed, we use CSS natural width

            // Build the inverted right-aligned pyramid out of pageItems
            // Figure out the optimal 'w' for the current pageItems to make it look like a triangle
            // We know we can use up to 4 rows, and 'wMax' width.
            let currentN = pageItems.length;
            // Let's find smallest `w` (up to wMax) where w + w-1 + w-2 + w-3 >= currentN
            let w = Math.ceil((currentN + 6) / 4);
            if (w > wMax) w = wMax;

            const pyramidGrid = document.createElement('div');
            pyramidGrid.className = 'flex flex-col items-end gap-3 w-max max-w-full';

            let rowsUsed = 0;
            while (pageItems.length > 0 && rowsUsed < 4) {
                let count = Math.min(w, pageItems.length);
                if (rowsUsed === 3 && pageItems.length > count) count = pageItems.length;

                let rowDiv = document.createElement('div');
                rowDiv.className = 'flex flex-wrap justify-end gap-3 w-max max-w-full';
                for (let j = 0; j < count; j++) {
                    rowDiv.appendChild(pageItems.shift());
                }
                pyramidGrid.appendChild(rowDiv);
                w--;
                if (w < 1) w = 1;
                rowsUsed++;
            }

            // Outer wrapper pour tenir la grille et le bouton l'un sous l'autre
            const outerWrapper = document.createElement('div');
            outerWrapper.className = 'flex flex-col items-end gap-4 relative right-4 md:right-6 w-full max-w-[calc(100vw-32px)] pt-2 pl-2';
            outerWrapper.appendChild(pyramidGrid);
            pyramidContainer.appendChild(outerWrapper);

            // Ensure pyramid toggle button exists (created once, visibility managed by updateLayoutToggleButtons)
            let fixedLayBtn = document.getElementById('pyramidLayoutToggleBtn');
            if (!fixedLayBtn) {
                fixedLayBtn = document.createElement('button');
                fixedLayBtn.id = 'pyramidLayoutToggleBtn';
                // Position: same spot as the sidebar layout toggle btn — to the left of the right AI sidebar
                // The right sidebar is 72px wide; button sits 8px further left = right: 80px
                fixedLayBtn.className = 'p-2 text-text-muted hover:text-primary rounded-full hover:bg-background-subtle transition-colors flex items-center justify-center bg-background-light shadow-md border border-border-subtle cursor-pointer z-[100]';
                fixedLayBtn.title = 'Changer la disposition';
                fixedLayBtn.style.cssText = 'position:fixed;bottom:24px;right:80px;width:42px;height:42px;display:none;';
                fixedLayBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]">dashboard_customize</span>`;
                fixedLayBtn.onclick = () => {
                    state.providerLayout = 'sidebar';
                    if (window._renderProviders) window._renderProviders();
                    if (window._adjustPyramidShift) window._adjustPyramidShift();
                    updateLayoutToggleButtons();
                };
                document.body.appendChild(fixedLayBtn);
            }
            // Visibility will be set by updateLayoutToggleButtons() below

        } else {
            // Normal sidebar layout
            if (pyramidContainer) { pyramidContainer.classList.add('hidden'); pyramidContainer.innerHTML = ''; }
            const frag = document.createDocumentFragment();
            elements.forEach(e => frag.appendChild(e));
            logoList.innerHTML = '';
            logoList.appendChild(frag);

            // Ensure sidebar toggle button exists inside the sidebar
            const sidebarEl = document.getElementById('aiProviderSidebar');

            // Add model search button in sidebar (above layout toggle)
            let existingSearchBtn = sidebarEl.querySelector('#sidebarModelSearchBtn');
            if (!existingSearchBtn) {
                const searchBtn = document.createElement('button');
                searchBtn.id = 'sidebarModelSearchBtn';
                searchBtn.className = 'absolute p-2 text-text-muted hover:text-primary rounded-full hover:bg-background-subtle transition-colors flex items-center justify-center bg-background-light shadow-md border border-border-subtle';
                searchBtn.title = 'Rechercher un modèle';
                searchBtn.style.width = '42px';
                searchBtn.style.height = '42px';
                searchBtn.style.right = 'calc(100% + 8px)';
                searchBtn.style.left = 'auto';
                // layout toggle is at bottom:24px (bottom-6), height 42px → top at 66px → add 14px gap → search at 80px
                searchBtn.style.bottom = '80px';
                searchBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]">search</span>`;
                searchBtn.onclick = () => openModelSearchModal();
                sidebarEl.appendChild(searchBtn);
            }

            let existingLayBtn = sidebarEl.querySelector('#sidebarLayoutToggleBtn');
            if (!existingLayBtn) {
                const layBtn = document.createElement('button');
                layBtn.id = 'sidebarLayoutToggleBtn';
                layBtn.className = 'absolute bottom-6 p-2 text-text-muted hover:text-primary rounded-full hover:bg-background-subtle transition-colors flex items-center justify-center bg-background-light shadow-md border border-border-subtle';
                layBtn.title = 'Changer la disposition';
                layBtn.style.width = '42px';
                layBtn.style.height = '42px';
                layBtn.style.display = 'none';
                layBtn.style.right = 'calc(100% + 8px)';
                layBtn.style.left = 'auto';
                layBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]">dashboard_customize</span>`;
                layBtn.onclick = () => {
                    state.providerLayout = 'pyramid';
                    if (window._renderProviders) window._renderProviders();
                    if (window._adjustPyramidShift) window._adjustPyramidShift();
                    updateLayoutToggleButtons();
                };
                sidebarEl.appendChild(layBtn);
            }
        }

        // Restore selection if model is set
        if (state.selectedModel) {
            const slug = getSlug(state.selectedModel);
            document.querySelectorAll('.provider-logo-btn').forEach(b => b.classList.toggle('selected', b.dataset.slug === slug));

            const badge = $('selectedModelBadge');
            if (badge) {
                badge.style.display = isPyramid ? 'none' : 'flex';
            }
        }
    }

    // Expose renderProviders for toggling layout
    window._renderProviders = renderProviders;

    // After initial render, update button visibility
    updateLayoutToggleButtons();

    function selectProvider(slug) {
        state.selectedProvider = slug;
        const prov = state.providerMap[slug];
        if (!prov) return;
        document.querySelectorAll('.provider-logo-btn').forEach(b => b.classList.toggle('selected', b.dataset.slug === slug));
        selLogo.src = prov.logoUrl; selLogo.alt = prov.name;
        selName.textContent = prov.name;
        renderModels(prov.models);
        modelBar.classList.remove('hidden');
        positionModelBar();

        const isPyramid = state.providerLayout === 'pyramid' && document.body.classList.contains('simplified-mode') && !state.conversationStarted;
        if (!isPyramid) {
            sidebar.classList.remove('hidden'); sidebar.classList.add('sidebar-show');
        }

        const badge = $('selectedModelBadge');
        if (badge) badge.style.display = 'none';
    }

    function positionModelBar() {
        const bar = $('inputBar'), inner = $('modelSelectorInner'), list = $('modelList');
        if (!bar || !inner) return;
        const r = bar.getBoundingClientRect();
        modelBar.style.left = r.left + 'px';
        modelBar.style.width = r.width + 'px';
        const isSimplifiedNoConv = document.body.classList.contains('simplified-mode') && !document.body.classList.contains('conversation-started');
        if (isSimplifiedNoConv) {
            modelBar.style.bottom = 'auto';
            modelBar.style.top = (r.bottom + 8) + 'px';
            if (list) {
                // Determine space left below input bar minus header/margins (~70px)
                const spaceAvailable = window.innerHeight - (r.bottom + 8) - 70;
                list.style.maxHeight = Math.max(80, Math.min(spaceAvailable, 500)) + 'px';
            }
        } else {
            modelBar.style.top = 'auto';
            modelBar.style.bottom = (window.innerHeight - r.top + 8) + 'px';
            if (list) {
                const spaceAvailable = r.top - 70;
                list.style.maxHeight = Math.max(200, Math.min(spaceAvailable, 500)) + 'px';
            }
        }
        inner.style.width = '100%';
    }

    function renderModels(models) {
        const frag = document.createDocumentFragment();
        models.forEach(m => {
            const short = m.id.split('/').slice(1).join('/');
            const cost = m.pricing?.prompt ? `$${(parseFloat(m.pricing.prompt) * 1e6).toFixed(2)}/M` : '';
            const div = document.createElement('div');
            div.className = 'model-item' + (state.selectedModel === m.id ? ' selected' : '');
            div.innerHTML = `<div><div class="text-sm text-text-main">${m.name || short}</div><div class="text-xs text-text-muted">${short}</div></div>
                <div class="flex items-center gap-2">
                    ${m.context_length ? `<span class="text-[10px] bg-background-subtle text-text-muted px-1.5 py-0.5 rounded-md">${(m.context_length / 1000).toFixed(0)}K ctx</span>` : ''}
                    ${cost ? `<span class="text-[10px] bg-background-subtle text-text-muted px-1.5 py-0.5 rounded-md">${cost}</span>` : ''}
                </div>`;
            div.addEventListener('click', () => {
                state.selectedModel = m.id;
                state.selectedProviderSlug = state.selectedProvider;
                modelBar.classList.add('hidden');
                logoList.querySelectorAll('.provider-logo-btn').forEach(b => b.classList.remove('selected'));
                showBadge(m.name || short, state.selectedProviderSlug);
                textarea.focus();
            });
            frag.appendChild(div);
        });
        modelListEl.innerHTML = ''; modelListEl.appendChild(frag);
    }

    closeBtn.addEventListener('click', () => {
        modelBar.classList.add('hidden');
        logoList.querySelectorAll('.provider-logo-btn').forEach(b => b.classList.remove('selected'));
        state.selectedProvider = null;
        // #24: Only show badge if not in pyramid mode
        const badge = $('selectedModelBadge');
        const isPyr = state.providerLayout === 'pyramid' && document.body.classList.contains('simplified-mode') && !state.conversationStarted;
        if (badge && !isPyr) badge.style.display = 'flex';
    });

    document.addEventListener('mousedown', (e) => {
        if (e.button === 2) return; // Ignorer le clic droit s'il déclenche le mousedown

        if (!modelBar.classList.contains('hidden')) {
            const bar = $('inputBar'), badge = $('selectedModelBadge');
            if (![sidebar, modelBar, bar, badge].some(el => el?.contains(e.target))) {
                modelBar.classList.add('hidden');
                logoList.querySelectorAll('.provider-logo-btn').forEach(b => b.classList.remove('selected'));
                state.selectedProvider = null;
                // #25: Only show badge if not in pyramid mode
                const isPyr = state.providerLayout === 'pyramid' && document.body.classList.contains('simplified-mode') && !state.conversationStarted;
                if (badge && !isPyr) badge.style.display = 'flex';
            }
        }

        // Fermer la sidebar si on clique à l'extérieur (hors context menus)
        setTimeout(() => {
            const menus = [$('pageContextMenu'), $('textContextMenu'), $('sidebarContextMenu'), $('convContextMenu')];
            const isAnyMenuOpen = menus.some(m => m && !m.classList.contains('hidden'));
            if (!isAnyMenuOpen && document.activeElement !== textarea && !sidebar.matches(':hover') && !modelBar.matches(':hover') && !shouldShowSidebar() && modelBar.classList.contains('hidden')) {
                hideSidebar();
            }
        }, 100);
    });

    const isPyramidActive = () => state.providerLayout === 'pyramid' && document.body.classList.contains('simplified-mode') && !state.conversationStarted;
    const shouldShowSidebar = () => {
        if (isPyramidActive()) return false;
        return $('chatTextarea').value.trim().length > 0 || !!state.selectedModel || !modelBar.classList.contains('hidden');
    };
    const showSidebar = () => {
        if (!isPyramidActive()) {
            sidebar.classList.remove('hidden'); sidebar.classList.add('sidebar-show');
            updateLayoutToggleButtons();
        }
    };
    const hideSidebar = () => { sidebar.classList.add('hidden'); sidebar.classList.remove('sidebar-show'); updateLayoutToggleButtons(); };

    textarea.addEventListener('focus', showSidebar);
    textarea.addEventListener('blur', () => {
        setTimeout(() => {
            const menus = [$('pageContextMenu'), $('textContextMenu'), $('sidebarContextMenu'), $('convContextMenu')];
            const isAnyMenuOpen = menus.some(m => m && !m.classList.contains('hidden'));
            if (isAnyMenuOpen) return;

            if (!sidebar.matches(':hover') && !modelBar.matches(':hover') && !shouldShowSidebar() && modelBar.classList.contains('hidden')) hideSidebar();
        }, 300);
    });
    textarea.addEventListener('input', () => { if (shouldShowSidebar()) showSidebar(); });
    sidebar.addEventListener('mouseleave', () => {
        if (document.activeElement !== textarea && !shouldShowSidebar()) {
            setTimeout(() => { if (!sidebar.matches(':hover')) hideSidebar(); }, 200);
        }
    });
    window.addEventListener('resize', () => {
        if (!modelBar.classList.contains('hidden')) positionModelBar();
        if (state.providerLayout === 'pyramid' && !state.conversationStarted && window._renderProviders) {
            window._renderProviders();
        }
    });

    window._positionModelBar = positionModelBar;

    fetchModels();
}

function showBadge(name, provSlug) {
    const isPyramid = state.providerLayout === 'pyramid' && document.body.classList.contains('simplified-mode') && !state.conversationStarted;

    let badge = $('selectedModelBadge');

    // Si c'est en pyramide, on n'affiche pas le badge en dessous de la barre. 
    // On peut le stocker dans le DOM au besoin mais en masqué.
    if (isPyramid && badge) {
        badge.style.display = 'none';
        return;
    } else if (isPyramid) {
        return; // ne rien créer
    }

    const inputBar = $('inputBar');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'selectedModelBadge';
        badge.className = 'flex items-center gap-1.5 px-3 py-1.5 bg-background-subtle rounded-full text-xs font-medium text-text-main cursor-pointer hover:bg-border-subtle transition-colors border border-border-subtle';
        badge.style.cssText = 'position:absolute;top:-36px;left:50%;transform:translateX(-50%);white-space:nowrap;z-index:10;';
        inputBar.style.position = 'relative';
        inputBar.appendChild(badge);
    }
    badge.style.display = 'flex';
    badge.innerHTML = `<span class="material-symbols-outlined text-[14px]">smart_toy</span> ${name} <span class="material-symbols-outlined text-[12px] text-text-muted">expand_more</span>`;
    badge.onclick = () => {
        if (provSlug && state.providerMap[provSlug]) {
            const btn = document.querySelector(`.provider-logo-btn[data-slug="${provSlug}"]`);
            if (btn) btn.click();
        }
    };
}

// ===== LAYOUT TOGGLE BUTTONS MANAGER =====
// Centralized control: ensures only the correct button is visible, never both at once.
// Rules:
//   - pyramidLayoutToggleBtn: visible ONLY when pyramid is active (pyramid layout + simplified-mode + no conversation started)
//   - sidebarLayoutToggleBtn: visible ONLY when sidebar layout is selected + sidebar is visible + simplified-mode + no conversation started
//   - During a conversation (conversationStarted=true): BOTH buttons hidden
//   - NEVER show both buttons at the same time
function updateLayoutToggleButtons() {
    const pyramidBtn = document.getElementById('pyramidLayoutToggleBtn');
    const sidebarBtn = document.getElementById('sidebarLayoutToggleBtn');
    const searchBtn = document.getElementById('sidebarModelSearchBtn');
    const isSimplified = document.body.classList.contains('simplified-mode');
    const isNewChat = !state.conversationStarted;
    const isPyramidLayout = state.providerLayout === 'pyramid';
    const sidebarVisible = document.getElementById('aiProviderSidebar')?.classList.contains('sidebar-show');

    // Pyramid button: only when pyramid layout is truly active (simplified + new chat + pyramid selected)
    const showPyramid = isPyramidLayout && isSimplified && isNewChat;
    // Sidebar button: only when sidebar layout + simplified + new chat + sidebar is actually visible on screen
    const showSidebar = !isPyramidLayout && isSimplified && isNewChat && sidebarVisible;

    if (pyramidBtn) pyramidBtn.style.display = showPyramid ? 'flex' : 'none';
    if (sidebarBtn) sidebarBtn.style.display = showSidebar ? 'flex' : 'none';
    // Search button follows same visibility as sidebar layout toggle
    if (searchBtn) searchBtn.style.display = showSidebar ? 'flex' : 'none';
}

function openSearchModal() {
    const modal = $('searchModal');
    const input = $('globalSearchInput');
    modal.classList.remove('hidden');
    input.value = '';
    handleGlobalSearch(); // Show all initially
    setTimeout(() => input.focus(), 50);
}

function closeSearchModal() {
    $('searchModal').classList.add('hidden');
}

// ===== MODEL SEARCH MODAL =====
function openModelSearchModal() {
    let modal = $('modelSearchModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modelSearchModal';
        modal.className = 'fixed inset-0 flex items-start justify-center pt-16';
        modal.style.cssText = 'z-index: 700; background: rgba(0,0,0,0.4); backdrop-filter: blur(6px);';
        modal.innerHTML = `
            <div class="bg-background-light rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-fade-in-up border border-border-subtle">
                <div class="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
                    <span class="material-symbols-outlined text-text-muted text-[20px]">search</span>
                    <input id="modelSearchInput" type="text"
                        class="flex-1 bg-transparent border-none text-sm text-text-main placeholder:text-text-muted focus:ring-0 outline-none"
                        placeholder="Rechercher un modèle ou une IA..." autocomplete="off" />
                    <button onclick="closeModelSearchModal()" class="p-1 text-text-muted hover:text-text-main rounded-full hover:bg-background-subtle transition-colors">
                        <span class="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>
                <div class="px-3 py-2 border-b border-border-subtle flex gap-1.5 flex-wrap" id="modelTypeFilter">
                    <button data-type="" class="model-type-pill active text-[11px] px-3 py-1 rounded-full bg-primary text-primary-content font-medium transition-all">Tous</button>
                    <button data-type="free" class="model-type-pill text-[11px] px-3 py-1 rounded-full bg-background-subtle text-text-muted hover:bg-background-light border border-border-subtle transition-all">🎁 Gratuit</button>
                    <button data-type="text" class="model-type-pill text-[11px] px-3 py-1 rounded-full bg-background-subtle text-text-muted hover:bg-background-light border border-border-subtle transition-all">💬 Texte</button>
                    <button data-type="vision" class="model-type-pill text-[11px] px-3 py-1 rounded-full bg-background-subtle text-text-muted hover:bg-background-light border border-border-subtle transition-all">👁 Vision</button>
                    <button data-type="image-gen" class="model-type-pill text-[11px] px-3 py-1 rounded-full bg-background-subtle text-text-muted hover:bg-background-light border border-border-subtle transition-all">🎨 Images</button>
                    <button data-type="audio" class="model-type-pill text-[11px] px-3 py-1 rounded-full bg-background-subtle text-text-muted hover:bg-background-light border border-border-subtle transition-all">🎵 Audio</button>
                    <button data-type="video" class="model-type-pill text-[11px] px-3 py-1 rounded-full bg-background-subtle text-text-muted hover:bg-background-light border border-border-subtle transition-all">🎬 Vidéo</button>
                    <button data-type="multimodal" class="model-type-pill text-[11px] px-3 py-1 rounded-full bg-background-subtle text-text-muted hover:bg-background-light border border-border-subtle transition-all">🔀 Multimodal</button>
                </div>
                <div id="modelSearchResults" class="max-h-[60vh] overflow-y-auto custom-scrollbar p-2 space-y-0.5"></div>
            </div>`;
        document.body.appendChild(modal);

        // Close on backdrop click
        modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeModelSearchModal(); });

        // Type filter pills
        const pills = modal.querySelectorAll('.model-type-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', () => {
                pills.forEach(p => {
                    p.classList.remove('active', 'bg-primary', 'text-primary-content');
                    p.classList.add('bg-background-subtle', 'text-text-muted');
                });
                pill.classList.add('active', 'bg-primary', 'text-primary-content');
                pill.classList.remove('bg-background-subtle', 'text-text-muted');
                renderModelSearchResults();
            });
        });

        const input = modal.querySelector('#modelSearchInput');
        let debounce = null;
        input.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(renderModelSearchResults, 150);
        });

        // ESC to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !$('modelSearchModal')?.classList.contains('hidden')) {
                closeModelSearchModal();
            }
        });
    }

    modal.classList.remove('hidden');
    const input = modal.querySelector('#modelSearchInput');
    if (input) { input.value = ''; setTimeout(() => input.focus(), 50); }
    renderModelSearchResults();
}

function closeModelSearchModal() {
    const modal = $('modelSearchModal');
    if (modal) modal.classList.add('hidden');
}

// Helper: classify a model by its modality string (e.g. "text+image->text+image")
function getModelCategory(m) {
    const inputs = m.architecture?.input_modalities || [];
    const outputs = m.architecture?.output_modalities || [];
    const mod = (m.architecture?.modality || '').toLowerCase();
    const idLow = (m.id || '').toLowerCase();

    const [inputStr = '', outputStr = ''] = mod.split('->');

    const hasImageOut = outputs.includes('image') || outputStr.includes('image');
    const hasAudio = inputs.includes('audio') || outputs.includes('audio') || inputStr.includes('audio') || outputStr.includes('audio');
    const hasVideo = inputs.includes('video') || outputs.includes('video') || inputStr.includes('video') || outputStr.includes('video');
    const hasImageIn = inputs.includes('image') || inputStr.includes('image');
    const hasFileIn = inputs.includes('file') || inputStr.includes('file');

    if (hasImageOut) return 'image-gen';
    if (hasAudio) return 'audio';
    if (hasVideo) return 'video';
    if (hasImageIn && !hasImageOut) return 'vision';
    if (hasFileIn) return 'multimodal';
    if (idLow.includes('flux') || idLow.includes('dall') || idLow.includes('stable-diffusion') || idLow.includes('sdxl') || idLow.includes('midjourney')) return 'image-gen';
    if (idLow.includes('vision') || idLow.includes('-vl') || idLow.includes('vl-')) return 'vision';
    if (idLow.includes('audio') || idLow.includes('-voice')) return 'audio';
    if (idLow.includes('video')) return 'video';

    return 'text';
}

// Helper: return a short badge label for the model's category
function getModalityBadge(category) {
    const badges = {
        'text': '💬 Texte',
        'vision': '👁 Vision',
        'image-gen': '🎨 Image',
        'audio': '🎵 Audio',
        'video': '🎬 Vidéo',
        'multimodal': '🔀 Multi',
    };
    return badges[category] || '💬 Texte';
}

function renderModelSearchResults() {
    const modal = $('modelSearchModal');
    if (!modal) return;
    const input = modal.querySelector('#modelSearchInput');
    const results = modal.querySelector('#modelSearchResults');
    const activePill = modal.querySelector('.model-type-pill.active');
    const typeFilter = activePill ? activePill.dataset.type : '';
    const q = (input?.value || '').toLowerCase().trim();

    results.innerHTML = '';

    let filtered = state.allModels;

    // Apply category filter
    if (typeFilter) {
        filtered = filtered.filter(m => {
            if (typeFilter === 'free') {
                const p = parseFloat(m.pricing?.prompt || 0);
                const c = parseFloat(m.pricing?.completion || 0);
                return p === 0 && c === 0;
            }
            const cat = getModelCategory(m);
            if (typeFilter === 'vision') return cat === 'vision' || cat === 'multimodal';
            if (typeFilter === 'multimodal') return cat === 'multimodal' || cat === 'video';
            return cat === typeFilter;
        });
    }

    // Apply text search
    if (q) filtered = filtered.filter(m =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.id || '').toLowerCase().includes(q)
    );

    filtered = filtered.slice(0, 1000);

    if (filtered.length === 0) {
        results.innerHTML = `<div class="py-10 text-center text-sm text-text-muted">Aucun modèle trouvé</div>`;
        return;
    }

    filtered.forEach(m => {
        const slug = getSlug(m.id);
        const prov = state.providerMap[slug];
        const logoUrl = prov ? getLogo(slug) : '';
        const cost = m.pricing?.prompt ? `$${(parseFloat(m.pricing.prompt) * 1e6).toFixed(2)}/M` : '';
        const shortId = m.id.split('/').slice(1).join('/');
        const category = getModelCategory(m);
        const badge = getModalityBadge(category);
        const item = document.createElement('div');
        item.className = 'flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-background-subtle cursor-pointer transition-all group';
        item.innerHTML = `
            <div class="w-8 h-8 rounded-lg border border-border-subtle flex items-center justify-center overflow-hidden shrink-0 bg-background-light">
                ${logoUrl ? `<img src="${logoUrl}" alt="" class="w-6 h-6 object-contain" onerror="this.style.display='none'" />` : `<span class="text-xs font-bold" style="color:${slugColor(slug)}">${getInitials(m.name || slug)}</span>`}
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-text-main truncate">${escHtml(m.name || shortId)}</div>
                <div class="text-[11px] text-text-muted truncate">${escHtml(shortId)}</div>
            </div>
            <span class="text-[9px] px-1.5 py-0.5 rounded bg-background-subtle text-text-muted shrink-0">${badge}</span>
            ${cost ? `<span class="text-[10px] bg-background-subtle text-text-muted px-1.5 py-0.5 rounded shrink-0">${cost}</span>` : ''}
        `;
        item.addEventListener('click', () => {
            state.selectedModel = m.id;
            state.selectedProviderSlug = slug;
            const badge_name = m.name || shortId;
            showBadge(badge_name, slug);
            // Update visual selection
            document.querySelectorAll('.provider-logo-btn').forEach(b => b.classList.toggle('selected', b.dataset.slug === slug));
            closeModelSearchModal();
            $('chatTextarea')?.focus();
        });
        results.appendChild(item);
    });
}

function handleGlobalSearch() {
    const q = $('globalSearchInput').value.toLowerCase().trim();
    const results = $('searchResults');
    results.innerHTML = '';

    const filtered = q === ''
        ? state.conversations.slice(0, 10)
        : state.conversations.filter(c => (c.title || '').toLowerCase().includes(q));

    if (filtered.length === 0) {
        // #15: Escape HTML to prevent XSS
        results.innerHTML = `<div class="p-8 text-center text-sm text-text-muted">Aucun résultat trouvé pour "${escHtml(q)}"</div>`;
        return;
    }

    filtered.forEach(c => {
        const item = document.createElement('div');
        item.className = 'flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-background-subtle cursor-pointer transition-all group';
        item.innerHTML = `
            <div class="h-9 w-9 rounded-lg bg-background-light border border-border-subtle flex items-center justify-center shrink-0 shadow-sm group-hover:border-primary/20">
                <span class="material-symbols-outlined text-text-muted text-[18px] group-hover:text-primary">${c.pinned ? 'push_pin' : 'chat_bubble'}</span>
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-text-main truncate">${escHtml(c.title || 'Nouveau chat')}</div>
                <div class="text-[11px] text-text-muted mt-0.5">${formatDate(c.updated_at)} • ${c.message_count || 0} messages</div>
            </div>
            <span class="material-symbols-outlined text-text-muted opacity-0 group-hover:opacity-100 transition-opacity text-[18px]">chevron_right</span>
        `;
        item.onclick = () => {
            openConversation(c.id);
            closeSearchModal();
        };
        results.appendChild(item);
    });
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initDropdowns();
    initFocusMode();
    initContextMenu();
    initAIProviders();
    initChat();
    initConversationUI();
    initPageContextMenu();
    initSidebarContextMenu();
    initAIResponseContextMenu();
    initToolsMenu();
    initWebSearch();
    loadConversations();
    initRealtime();
});

function toggleSidebar() {
    const sidebar = $('sidebar'), icon = $('toggleIcon'), btn = $('sidebarToggle'), overlay = $('sidebarOverlay');
    const collapsed = sidebar.classList.toggle('sidebar-collapsed');
    icon.textContent = collapsed ? 'menu_open' : 'menu';
    btn.style.left = collapsed ? '12px' : '268px';

    // Manage overlay on mobile
    if (window.innerWidth < 768) {
        if (!collapsed) {
            overlay.classList.remove('hidden');
            setTimeout(() => overlay.classList.add('show'), 10);
        } else {
            overlay.classList.remove('show');
            setTimeout(() => { if (sidebar.classList.contains('sidebar-collapsed')) overlay.classList.add('hidden'); }, 300);
        }
    }
}

// Initialiser l'overlay pour fermer la sidebar
document.addEventListener('DOMContentLoaded', () => {
    const overlay = $('sidebarOverlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            if (!$('sidebar').classList.contains('sidebar-collapsed')) {
                toggleSidebar();
            }
        });
    }
});

function initSidebar() {
    const sidebar = $('sidebar'), btn = $('sidebarToggle');
    if (window.innerWidth < 768) {
        sidebar.classList.add('sidebar-collapsed');
        if (btn) btn.style.left = '12px';
        const icon = $('toggleIcon');
        if (icon) icon.textContent = 'menu_open';
    } else {
        if (sidebar && btn && !sidebar.classList.contains('sidebar-collapsed')) btn.style.left = '268px';
    }
}

function initDropdowns() {
    // #9: Make dropdown selections functional
    setupSelectableDropdown('qualityDropdown', 'qualityBtn', 'qualityMenu', (label) => {
        const btnText = $('qualityBtn');
        if (btnText) {
            btnText.querySelector('span:nth-child(2)').textContent = label;
        }
    });
    setupSelectableDropdown('privacyDropdown', 'privacyBtn', 'privacyMenu', (label) => {
        const btnText = $('privacyBtn');
        if (btnText) {
            const lblEl = btnText.querySelector('span:nth-child(2)');
            if (lblEl) lblEl.textContent = label;
        }
    });
    document.addEventListener('click', (e) => {
        ['qualityDropdown', 'privacyDropdown'].forEach(id => {
            const dd = $(id); if (!dd) return;
            if (!dd.contains(e.target)) {
                const menu = dd.querySelector('[id$="Menu"]');
                if (menu) { menu.classList.add('hidden'); menu.classList.remove('dropdown-menu-open'); }
            }
        });
    });
}

function setupDropdown(dropdownId, btnId, menuId) {
    const dropdown = $(dropdownId), btn = $(btnId), menu = $(menuId);
    if (!dropdown || !btn || !menu) return;
    let hideTimeout = null;
    const show = () => { clearTimeout(hideTimeout); document.querySelectorAll('.dropdown-menu-open').forEach(el => { if (el !== menu) { el.classList.add('hidden'); el.classList.remove('dropdown-menu-open'); } }); menu.classList.remove('hidden'); menu.classList.add('dropdown-menu-open'); };
    const hide = () => { hideTimeout = setTimeout(() => { menu.classList.add('hidden'); menu.classList.remove('dropdown-menu-open'); }, 150); };
    dropdown.addEventListener('mouseenter', show);
    dropdown.addEventListener('mouseleave', hide);
    btn.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.contains('hidden') ? show() : (clearTimeout(hideTimeout), menu.classList.add('hidden'), menu.classList.remove('dropdown-menu-open')); });
    menu.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
    menu.addEventListener('mouseleave', hide);
    return { show, hide };
}

// #9: Selectable dropdown — clicking an option selects it and updates the trigger button
function setupSelectableDropdown(dropdownId, btnId, menuId, onSelect) {
    const { show, hide } = setupDropdown(dropdownId, btnId, menuId) || {};
    const menu = $(menuId);
    if (!menu) return;

    const items = menu.querySelectorAll('button');
    items.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active state from all items
            items.forEach(i => {
                i.classList.remove('bg-background-subtle', 'font-medium', 'text-text-main');
                i.classList.add('hover:bg-background-subtle', 'text-text-muted', 'hover:text-primary');
                // Remove check icon if present
                const check = i.querySelector('.material-symbols-outlined.text-primary');
                if (check) check.remove();
            });
            // Set active state on clicked item
            item.classList.add('bg-background-subtle', 'font-medium', 'text-text-main');
            item.classList.remove('text-text-muted');
            // Add check icon
            const check = document.createElement('span');
            check.className = 'material-symbols-outlined text-primary text-[18px]';
            check.textContent = 'check';
            item.appendChild(check);
            // Get label text (first text span inside the button)
            const labelEl = item.querySelector('span:not(.material-symbols-outlined)') || item;
            const label = labelEl.textContent.trim();
            if (onSelect) onSelect(label);
            if (hide) hide();
        });
    });
}

function initFocusMode() {
    const textarea = $('chatTextarea'), grid = $('suggestionsGrid'), title = $('titleArea');
    if (!textarea || !grid || !title) return;
    textarea.addEventListener('focus', () => { grid.classList.add('suggestions-hidden'); title.classList.add('title-centered'); });
    textarea.addEventListener('blur', () => { if (!textarea.value.trim()) { grid.classList.remove('suggestions-hidden'); title.classList.remove('title-centered'); } });
    // #28: Also restore suggestions when input is cleared without blur
    textarea.addEventListener('input', () => {
        if (!textarea.value.trim() && document.activeElement !== textarea) {
            grid.classList.remove('suggestions-hidden');
            title.classList.remove('title-centered');
        }
    });
}

function initContextMenu() {
    const menu = $('textContextMenu'), dots = $('contextMenuDots'), ext = $('contextMenuExtended');
    const copyBtn = $('contextCopyBtn'), selAllBtn = $('contextSelectAllBtn'), improveBtn = $('improvePromptBtn');
    const textarea = $('chatTextarea'), inputBar = $('inputBar');
    if (!menu || !textarea || !inputBar) return;
    const position = () => { requestAnimationFrame(() => { const bar = inputBar.getBoundingClientRect(), mr = menu.getBoundingClientRect(); let x = bar.left + (bar.width - mr.width) / 2, y = bar.top - mr.height - 8; x = Math.max(8, Math.min(x, window.innerWidth - mr.width - 8)); y = Math.max(8, y); menu.style.left = x + 'px'; menu.style.top = y + 'px'; }); };
    const show = () => { menu.classList.remove('hidden'); ext.classList.add('hidden'); position(); };
    const hide = () => { menu.classList.add('hidden'); ext.classList.add('hidden'); };
    window._hideTextContextMenu = hide;
    textarea.addEventListener('contextmenu', (e) => { e.preventDefault(); show(); });
    let selTimer = null;
    textarea.addEventListener('mouseup', () => { clearTimeout(selTimer); selTimer = setTimeout(() => { if (textarea.selectionStart !== textarea.selectionEnd) show(); }, 100); });
    dots.addEventListener('click', (e) => { e.stopPropagation(); ext.classList.toggle('hidden'); position(); });
    copyBtn.addEventListener('click', () => { navigator.clipboard.writeText(textarea.value.substring(textarea.selectionStart, textarea.selectionEnd) || textarea.value); hide(); });
    selAllBtn.addEventListener('click', () => { textarea.focus(); textarea.select(); hide(); });
    improveBtn.addEventListener('click', hide);
    document.addEventListener('mousedown', (e) => { if (!menu.contains(e.target) && e.target !== textarea) hide(); });
    window.addEventListener('resize', hide);
    textarea.addEventListener('scroll', hide);
}

function initPageContextMenu() {
    const menu = $('pageContextMenu');
    const simplifyBtn = $('ctxSimplify');
    const restoreBtn = $('ctxRestore');
    const label = $('simplifyLabel');
    const toolboxBtn = $('ctxToolbox');
    const redirectBtn = $('ctxRedirectSettings');
    const divider = $('ctxSettingsDivider');

    if (!menu) return;

    const show = (x, y) => {
        const isSimplified = document.body.classList.contains('extra-simplified-mode');

        // Toggle buttons based on mode with explicit display
        simplifyBtn.style.display = isSimplified ? 'none' : 'flex';
        restoreBtn.style.display = isSimplified ? 'flex' : 'none';

        // Update theme toggle label/icon to reflect current state
        const isDark = document.documentElement.classList.contains('dark');
        const themeIcon = $('themeIcon');
        const themeLabel = $('themeLabel');
        if (themeIcon) themeIcon.textContent = isDark ? 'light_mode' : 'dark_mode';
        if (themeLabel) themeLabel.textContent = isDark ? 'Mode clair' : 'Mode sombre';

        menu.classList.remove('hidden');

        // Position
        requestAnimationFrame(() => {
            const mr = menu.getBoundingClientRect();
            let cx = Math.min(x, window.innerWidth - mr.width - 8);
            let cy = Math.min(y, window.innerHeight - mr.height - 8);
            menu.style.left = cx + 'px';
            menu.style.top = cy + 'px';
        });
    };

    const hide = () => menu.classList.add('hidden');

    document.addEventListener('contextmenu', (e) => {
        // Don't show if clicking on textarea, sidebar items, AI provider lists
        if (e.target.closest('#chatTextarea') ||
            e.target.closest('.conv-item') ||
            e.target.closest('#aiProviderSidebar') ||
            e.target.closest('#pyramidProviders')) return;

        // In chatMessagesArea: only block if clicking on an actual AI/user message bubble or action button
        if (e.target.closest('#chatMessagesArea')) {
            // Allow menu if not on a message bubble or action
            const onMessage = e.target.closest('.max-w-full.text-text-main') ||
                e.target.closest('.max-w-\\[80\\%\\]') ||
                e.target.closest('.flex.flex-col.items-start') ||
                e.target.closest('.flex.flex-col.items-end') ||
                e.target.closest('button');
            if (onMessage) return;
        }

        e.preventDefault();
        show(e.clientX, e.clientY);
    });

    document.addEventListener('mousedown', (e) => {
        if (!menu.contains(e.target)) hide();
    });

    simplifyBtn.addEventListener('click', () => {
        document.body.classList.add('extra-simplified-mode');
        hide();
    });

    restoreBtn.addEventListener('click', () => {
        document.body.classList.remove('extra-simplified-mode');
        hide();
    });

    toolboxBtn.addEventListener('click', () => {
        alert('Boîte à outils bientôt disponible !');
        hide();
    });

    redirectBtn.addEventListener('click', () => {
        // Redirection not yet defined, using placeholder
        // window.location.href = '/settings';
        alert('Redirection vers les paramètres...');
        hide();
    });
}

function initSidebarContextMenu() {
    const menu = $('sidebarContextMenu');
    const changeLayoutBtn = $('ctxChangeLayout');
    const sidebar = $('aiProviderSidebar');
    if (!menu || !sidebar) return;

    const show = (x, y) => {
        // After first message: hide layout change option
        if (changeLayoutBtn) {
            changeLayoutBtn.style.display = state.conversationStarted ? 'none' : '';
        }
        // If all items hidden, don't show empty menu
        const visibleItems = menu.querySelectorAll('button:not([style*="display: none"])');
        if (visibleItems.length === 0) return;

        menu.classList.remove('hidden');
        requestAnimationFrame(() => {
            const mr = menu.getBoundingClientRect();
            let cx = Math.min(x, window.innerWidth - mr.width - 8);
            let cy = Math.min(y, window.innerHeight - mr.height - 8);
            menu.style.left = cx + 'px';
            menu.style.top = cy + 'px';
        });
    };

    const hide = () => menu.classList.add('hidden');

    const handleContext = (e) => {
        e.preventDefault();
        e.stopPropagation();
        show(e.clientX, e.clientY);
    };

    sidebar.addEventListener('contextmenu', handleContext);

    const pyramid = $('pyramidProviders');
    if (pyramid) {
        pyramid.addEventListener('contextmenu', handleContext);
    }

    document.addEventListener('mousedown', (e) => {
        if (!menu.contains(e.target)) hide();
    });

    if (changeLayoutBtn) {
        changeLayoutBtn.addEventListener('click', () => {
            if (state.conversationStarted) return; // Locked after first message
            state.providerLayout = state.providerLayout === 'sidebar' ? 'pyramid' : 'sidebar';
            if (window._renderProviders) window._renderProviders();
            if (window._adjustPyramidShift) window._adjustPyramidShift();
            updateLayoutToggleButtons();
            hide();
        });
    }
}

function initChat() {
    const textarea = $('chatTextarea'), sendBtn = $('sendBtn');
    if (!textarea || !sendBtn) return;
    sendBtn.addEventListener('click', handleSend);

    // Logique du bouton crayon (Éditeur plein écran / draft)
    const editBtn = $('editBtn');
    const draftModal = $('draftModal');
    const draftTextarea = $('draftTextarea');
    const draftSendBtn = $('draftSendBtn');
    const closeDraftBtn = $('closeDraftBtn');

    if (editBtn && draftModal) {
        const closeDraft = () => draftModal.classList.add('hidden');

        editBtn.addEventListener('click', () => {
            draftTextarea.value = textarea.value;
            draftModal.classList.remove('hidden');
            setTimeout(() => draftTextarea.focus(), 50);
        });

        closeDraftBtn?.addEventListener('click', closeDraft);

        draftSendBtn?.addEventListener('click', () => {
            const draftText = draftTextarea.value.trim();
            // #30: Don't send if draft is empty
            if (!draftText) return;
            textarea.value = draftTextarea.value;
            closeDraft();
            handleSend();
        });

        draftModal.addEventListener('mousedown', (e) => {
            if (e.target === draftModal) closeDraft();
        });
    }

    // ====== Fonction partagée : resize la barre + remonte tout le bloc en mode pyramide ======
    function adjustPyramidShift() {
        const isPyramid = state.providerLayout === 'pyramid' && document.body.classList.contains('simplified-mode') && !state.conversationStarted;
        const maxH = isPyramid ? 120 : 192;

        // Mesure correcte : on force la hauteur au minimum pour lire le scrollHeight réel
        textarea.style.height = '0px';
        const scrollH = textarea.scrollHeight;
        const newH = Math.max(44, Math.min(scrollH, maxH));
        textarea.style.height = newH + 'px';

        const diff = newH - 44;
        // #12: debug log removed

        const inputContainer = $('inputContainer');
        const titleArea = $('titleArea');

        if (isPyramid && diff > 0) {
            // Modifie directement top/bottom au lieu de transform (évite le conflit avec transform:none)
            inputContainer.style.top = `calc(50% - 30px - ${diff}px)`;
            titleArea.style.bottom = `calc(50% + 100px + ${diff}px)`;
        } else {
            // Reset aux valeurs d'origine
            inputContainer.style.top = '';
            titleArea.style.bottom = '';
        }

        // Fix : Recalculer la position du conteneur des modèles s'il est ouvert pendant l'agrandissement de la barre
        if (window._positionModelBar && !document.getElementById('modelSelectorBar').classList.contains('hidden')) {
            window._positionModelBar();
        }
        // Fix : Cacher le menu contextuel s'il est ouvert et que la barre bouge
        if (window._hideTextContextMenu) {
            window._hideTextContextMenu();
        }
    }

    // Expose for layout change
    window._adjustPyramidShift = adjustPyramidShift;

    // Déclencher sur TOUT : frappe de texte ET touche Entrée
    textarea.addEventListener('input', adjustPyramidShift);
    textarea.addEventListener('keyup', function (e) {
        if (e.key === 'Enter') adjustPyramidShift();
    });

    // #2: Ctrl+Enter to send message
    textarea.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSend();
        }
    });

    // Suggestion cards
    document.querySelectorAll('.suggestion-card').forEach(card => {
        card.addEventListener('click', () => {
            const text = card.querySelector('p')?.textContent;
            if (text) { textarea.value = text; textarea.focus(); handleSend(); }
        });
    });
}

function initConversationUI() {
    // New chat buttons
    $('newChatBtn')?.addEventListener('click', startNewChat);
    $('newChatBtnMobile')?.addEventListener('click', startNewChat);

    const mainLogo = $('mainHomeLogo');
    if (mainLogo) {
        mainLogo.addEventListener('click', () => {
            sessionStorage.setItem('skipSplash', 'true');
            window.location.reload();
        });
    }

    // Search modal (#26: debounced search)
    $('openSearchBtn')?.addEventListener('click', openSearchModal);
    $('searchModal')?.addEventListener('mousedown', (e) => { if (e.target === $('searchModal')) closeSearchModal(); });
    let searchDebounce = null;
    $('globalSearchInput')?.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(handleGlobalSearch, 150);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); startNewChat(); }
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearchModal(); }
        if (e.key === '/') {
            if (document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'INPUT') {
                e.preventDefault(); openSearchModal();
            }
        }
        // #5: Escape closes the top-most open modal, not always search
        if (e.key === 'Escape') {
            if (!$('deleteConfirmModal')?.classList.contains('hidden')) { closeDeleteConfirm(); }
            else if (!$('renameModal')?.classList.contains('hidden')) { closeRenameModal(); }
            else if (!$('convSettingsModal')?.classList.contains('hidden')) { closeSettingsModal(); }
            else if (!$('draftModal')?.classList.contains('hidden')) { $('draftModal').classList.add('hidden'); }
            else if (!$('searchModal')?.classList.contains('hidden')) { closeSearchModal(); }
            else if (!$('modelSelectorBar')?.classList.contains('hidden')) { $('modelSelectorBar').classList.add('hidden'); }
        }
    });

    // Context menu actions
    $('ctxRename')?.addEventListener('click', () => { const id = state.ctxConversationId; hideConvContextMenu(); openRenameModal(id); });
    $('ctxPin')?.addEventListener('click', async () => {
        const id = state.ctxConversationId; hideConvContextMenu();
        const conv = state.conversations.find(c => c.id === id);
        if (conv) await updateConversation(id, { pinned: !conv.pinned });
    });
    $('ctxSettings')?.addEventListener('click', () => { const id = state.ctxConversationId; hideConvContextMenu(); openSettingsModal(id); });
    $('ctxDelete')?.addEventListener('click', () => { const id = state.ctxConversationId; hideConvContextMenu(); openDeleteConfirm(id); });

    // Close context menu on outside click
    document.addEventListener('mousedown', (e) => { if (!$('convContextMenu').contains(e.target)) hideConvContextMenu(); });

    // Header rename/settings buttons
    $('renameConvBtn')?.addEventListener('click', () => { if (state.currentConversationId) openRenameModal(state.currentConversationId); });
    $('convSettingsBtn')?.addEventListener('click', () => { if (state.currentConversationId) openSettingsModal(state.currentConversationId); });

    // Rename modal
    $('renameCancelBtn')?.addEventListener('click', closeRenameModal);
    $('renameConfirmBtn')?.addEventListener('click', async () => {
        const newTitle = $('renameInput').value.trim();
        if (newTitle && state.ctxConversationId) {
            await updateConversation(state.ctxConversationId, { title: newTitle });
        } else if (newTitle && state.currentConversationId) {
            await updateConversation(state.currentConversationId, { title: newTitle });
        }
        closeRenameModal();
    });
    $('renameInput')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('renameConfirmBtn').click(); if (e.key === 'Escape') closeRenameModal(); });
    $('renameModal')?.addEventListener('mousedown', (e) => { if (e.target === $('renameModal')) closeRenameModal(); });

    // Settings modal
    $('closeConvSettings')?.addEventListener('click', closeSettingsModal);
    $('settingsCancelBtn')?.addEventListener('click', closeSettingsModal);
    $('convSettingsModal')?.addEventListener('mousedown', (e) => { if (e.target === $('convSettingsModal')) closeSettingsModal(); });

    // Pin toggle in settings
    $('settingsPinToggle')?.addEventListener('click', () => {
        const toggle = $('settingsPinToggle'), knob = $('settingsPinKnob');
        const isPinned = toggle.getAttribute('aria-checked') === 'true';
        toggle.setAttribute('aria-checked', !isPinned ? 'true' : 'false');
        toggle.classList.toggle('bg-black', !isPinned);
        toggle.classList.toggle('bg-background-subtle', isPinned);
        knob.classList.toggle('translate-x-5', !isPinned);
        knob.classList.toggle('translate-x-0', isPinned);
    });

    $('settingsSaveBtn')?.addEventListener('click', async () => {
        const id = state.ctxConversationId || state.currentConversationId;
        if (!id) { closeSettingsModal(); return; }
        const title = $('settingsTitleInput').value.trim();
        const systemPrompt = $('settingsSystemPrompt').value.trim();
        const pinned = $('settingsPinToggle').getAttribute('aria-checked') === 'true';
        await updateConversation(id, { title: title || 'Nouveau chat', system_prompt: systemPrompt || null, pinned });
        closeSettingsModal();
    });

    $('settingsDeleteBtn')?.addEventListener('click', () => { const id = state.ctxConversationId || state.currentConversationId; openDeleteConfirm(id); });

    // Delete confirm modal
    $('deleteCancelBtn')?.addEventListener('click', closeDeleteConfirm);
    $('deleteConfirmBtn')?.addEventListener('click', async () => {
        if (pendingDeleteId) await deleteConversation(pendingDeleteId);
        closeDeleteConfirm();
    });
    $('deleteConfirmModal')?.addEventListener('mousedown', (e) => { if (e.target === $('deleteConfirmModal')) closeDeleteConfirm(); });
}

// ===== AI RESPONSE CONTEXT MENU =====
function initAIResponseContextMenu() {
    const menu = $('aiResponseContextMenu');
    const subMenu = $('aiCtxSubMenu');
    const optionsBtn = $('aiCtxOptions');
    const copyBtn = $('aiCtxCopy');
    const summarizeBtn = $('aiCtxSummarize');
    const humanizeBtn = $('aiCtxHumanize');
    if (!menu) return;

    let targetBubble = null;

    const show = (x, y, bubble) => {
        targetBubble = bubble;
        subMenu.classList.add('hidden');
        menu.classList.remove('hidden');
        requestAnimationFrame(() => {
            const mr = menu.getBoundingClientRect();
            let cx = Math.min(x, window.innerWidth - mr.width - 220);
            let cy = Math.min(y, window.innerHeight - mr.height - 8);
            cx = Math.max(8, cx);
            cy = Math.max(8, cy);
            menu.style.left = cx + 'px';
            menu.style.top = cy + 'px';
        });
    };

    const hide = () => {
        menu.classList.add('hidden');
        subMenu.classList.add('hidden');
        targetBubble = null;
    };

    // Afficher le sous-menu Options
    optionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        subMenu.classList.toggle('hidden');
        // Repositionner le sous-menu si trop à droite
        requestAnimationFrame(() => {
            const subR = subMenu.getBoundingClientRect();
            if (subR.right > window.innerWidth - 8) {
                subMenu.style.left = 'auto';
                subMenu.style.right = '100%';
                subMenu.querySelector('div').style.marginLeft = '0';
                subMenu.querySelector('div').style.marginRight = '4px';
            }
        });
    });

    // Survol pour afficher le sous-menu
    optionsBtn.addEventListener('mouseenter', () => {
        subMenu.classList.remove('hidden');
    });

    const optionsWrapper = $('aiCtxOptionsWrapper');
    optionsWrapper.addEventListener('mouseleave', () => {
        subMenu.classList.add('hidden');
    });

    // Copier
    copyBtn.addEventListener('click', () => {
        if (targetBubble) {
            navigator.clipboard.writeText(targetBubble.textContent || '');
        }
        hide();
    });

    // Résumer
    summarizeBtn.addEventListener('click', () => {
        hide();
        const ta = $('chatTextarea');
        ta.value = "Fais un résumé clair et concis de ta dernière réponse.";
        ta.focus();
        setTimeout(handleSend, 10);
    });

    // Humaniser
    humanizeBtn.addEventListener('click', () => {
        hide();
        const ta = $('chatTextarea');
        ta.value = "Reformule ta réponse de manière extrêmement humaine, fluide et naturelle, en supprimant toutes les tournures typiques d'une IA, afin qu'il soit impossible de deviner que c'est une machine qui a écrit ce texte.";
        ta.focus();
        setTimeout(handleSend, 10);
    });

    // Clic droit sur les réponses IA
    document.addEventListener('contextmenu', (e) => {
        const chatArea = $('chatMessagesArea');
        if (!chatArea) return;

        // Chercher la bulle assistant la plus proche
        const bubble = e.target.closest('.flex.flex-col.items-start');
        if (!bubble || !chatArea.contains(bubble)) return;

        // Vérifier que c'est une bulle assistant (pas user)
        const bubbleContent = bubble.querySelector('.max-w-full.text-text-main');
        if (!bubbleContent) return;

        e.preventDefault();
        e.stopPropagation();
        show(e.clientX, e.clientY, bubbleContent);
    });

    // Fermer le menu sur clic en dehors
    document.addEventListener('mousedown', (e) => {
        if (!menu.contains(e.target)) hide();
    });
}

// ===== TOOLS MENU (bouton trombone) =====
function initToolsMenu() {
    const attachBtn = $('attachBtn');
    const menu = $('toolsContextMenu');
    const subMenu = $('toolsSubMenu');
    const moreBtn = $('toolsMoreBtn');
    const moreWrapper = $('toolsMoreWrapper');
    if (!attachBtn || !menu) return;

    const show = () => {
        subMenu.classList.add('hidden');
        menu.classList.remove('hidden');
        // Positionner au-dessus du bouton
        requestAnimationFrame(() => {
            const btnR = attachBtn.getBoundingClientRect();
            const menuR = menu.getBoundingClientRect();
            let x = btnR.left;
            let y = btnR.top - menuR.height - 8;
            // Si pas assez de place en haut, afficher en dessous
            if (y < 8) y = btnR.bottom + 8;
            // Clamp horizontal
            x = Math.max(8, Math.min(x, window.innerWidth - menuR.width - 8));
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
        });
    };

    const hide = () => {
        menu.classList.add('hidden');
        subMenu.classList.add('hidden');
    };

    // Toggle au clic sur le trombone
    attachBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (menu.classList.contains('hidden')) {
            show();
        } else {
            hide();
        }
    });

    // Sous-menu "Plus" au survol
    moreBtn.addEventListener('mouseenter', () => {
        subMenu.classList.remove('hidden');
        // Repositionner si trop à droite
        requestAnimationFrame(() => {
            const subR = subMenu.getBoundingClientRect();
            if (subR.right > window.innerWidth - 8) {
                subMenu.style.left = 'auto';
                subMenu.style.right = '100%';
            }
        });
    });

    moreWrapper.addEventListener('mouseleave', () => {
        subMenu.classList.add('hidden');
    });

    moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        subMenu.classList.toggle('hidden');
    });

    // Fermer le menu sur clic en dehors
    document.addEventListener('mousedown', (e) => {
        if (!menu.contains(e.target) && e.target !== attachBtn && !attachBtn.contains(e.target)) {
            hide();
        }
    });

    // Actions placeholder pour chaque bouton  
    const actions = {
        'toolsAddFiles': 'Fonctionnalité d\'ajout de fichiers bientôt disponible !',
        'toolsReflexion': 'Mode réflexion bientôt disponible !',
        'toolsDeepSearch': 'Recherche approfondie bientôt disponible !',
        'toolsShopping': 'Assistant shopping bientôt disponible !',
        'toolsWebSearch': 'Recherche sur le Web bientôt disponible !',
        'toolsStudy': 'Mode étude bientôt disponible !',
        'toolsCanvas': 'Canevas bientôt disponible !',
        'toolsQuizzes': 'Quizzes bientôt disponibles !',
    };

    Object.entries(actions).forEach(([id, msg]) => {
        const btn = $(id);
        if (btn) {
            btn.addEventListener('click', () => {
                hide();
                alert(msg);
            });
        }
    });
}


function initWebSearch() {
    const overlay = $('webSearchOverlay');
    const input = $('webSearchInput');
    const closeBtn = $('closeWebSearch');
    const sponsoredResults = $('sponsoredResults');
    const sponsoredList = $('sponsoredList');
    const organicResults = $('organicResults');
    if (!overlay || !input) return;

    // Données de démo pour les résultats sponsorisés
    const sponsoredData = [
        { title: 'ChatGPT Plus — Intelligence Artificielle Premium', url: 'openai.com', desc: 'Accédez à GPT-4 Turbo et bien plus avec ChatGPT Plus. Essayez gratuitement.', icon: 'smart_toy' },
        { title: 'Copilot Pro — L\'IA intégrée à vos outils', url: 'microsoft.com', desc: 'Boostez votre productivité avec Copilot Pro. Disponible dans Office 365.', icon: 'assistant' },
    ];

    let mouseButtons = { left: false, right: false };
    let searchTimeout = null;
    let openedAt = 0; // timestamp pour éviter la fermeture instantanée

    const showOverlay = () => {
        overlay.classList.remove('hidden');
        openedAt = Date.now();
        setTimeout(() => input.focus(), 50);
    };

    const hideOverlay = () => {
        overlay.classList.add('hidden');
        input.value = '';
        sponsoredResults.classList.add('hidden');
        organicResults.innerHTML = '<div class="flex flex-col items-center justify-center py-12 text-text-muted"><span class="material-symbols-outlined text-[36px] mb-2">search</span><span class="text-sm">Tapez votre recherche pour commencer</span></div>';
    };

    // Exposer pour usage global
    window._webSearchActive = () => !overlay.classList.contains('hidden');
    window._hideWebSearch = hideOverlay;

    // Détecte les deux boutons simultanés
    let bothPressed = false;
    document.addEventListener('mousedown', (e) => {
        if (e.button === 0) mouseButtons.left = true;
        if (e.button === 2) mouseButtons.right = true;

        if (mouseButtons.left && mouseButtons.right) {
            e.preventDefault();
            bothPressed = true;
            if (overlay.classList.contains('hidden')) {
                showOverlay();
            } else {
                hideOverlay();
            }
        }
    });

    // Empêcher le menu contextuel natif quand les deux boutons sont pressés
    document.addEventListener('contextmenu', (e) => {
        if (bothPressed) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true); // 'true' = capture phase, intercepte AVANT les autres handlers

    document.addEventListener('mouseup', (e) => {
        if (e.button === 0) mouseButtons.left = false;
        if (e.button === 2) mouseButtons.right = false;
        // Réinitialiser après un court délai pour que le contextmenu soit bien bloqué
        if (!mouseButtons.left && !mouseButtons.right) {
            setTimeout(() => { bothPressed = false; }, 50);
        }
    });

    closeBtn.addEventListener('click', hideOverlay);

    // Fermer quand on clique n'importe où en dehors de la boîte de recherche
    document.addEventListener('click', (e) => {
        if (overlay.classList.contains('hidden')) return;
        // Ignorer les clics dans les 300ms suivant l'ouverture (évite fermeture instantanée)
        if (Date.now() - openedAt < 300) return;
        const searchBox = $('webSearchBox');
        if (searchBox && !searchBox.contains(e.target)) {
            hideOverlay();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
            hideOverlay();
        }
    });

    // Recherche simulée avec résultats
    input.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = input.value.trim();

        if (!q) {
            sponsoredResults.classList.add('hidden');
            organicResults.innerHTML = '<div class="flex flex-col items-center justify-center py-12 text-text-muted"><span class="material-symbols-outlined text-[36px] mb-2">search</span><span class="text-sm">Tapez votre recherche pour commencer</span></div>';
            return;
        }

        searchTimeout = setTimeout(() => {
            // Afficher les résultats sponsorisés
            sponsoredResults.classList.remove('hidden');
            sponsoredList.innerHTML = '';
            sponsoredData.forEach(s => {
                const item = document.createElement('div');
                item.className = 'flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-background-subtle cursor-pointer transition-all group';
                item.innerHTML = `
                    <div class="h-9 w-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-amber-600 text-[18px]">${s.icon}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-primary truncate group-hover:underline">${escHtml(s.title)}</div>
                        <div class="text-[11px] text-text-muted">${escHtml(s.url)}</div>
                        <div class="text-xs text-text-muted mt-0.5">${escHtml(s.desc)}</div>
                    </div>
                `;
                item.onclick = () => window.open(`https://${s.url}`, '_blank');
                sponsoredList.appendChild(item);
            });

            // Générer des résultats organiques simulés
            organicResults.innerHTML = '';
            const fakeResults = [
                { title: `${q} — Wikipédia`, url: 'fr.wikipedia.org', desc: `Article Wikipédia sur "${q}" — encyclopédie libre et collaborative.` },
                { title: `${q} : définition et explications`, url: 'futura-sciences.com', desc: `Découvrez tout ce que vous devez savoir sur "${q}".` },
                { title: `Qu'est-ce que ${q} ? Guide complet`, url: 'commentcamarche.net', desc: `Guide complet et détaillé sur "${q}" pour les débutants.` },
                { title: `${q} — Actualités et tendances`, url: 'lemonde.fr', desc: `Les dernières actualités sur "${q}" sur Le Monde.` },
                { title: `${q} — Forum et discussions`, url: 'reddit.com', desc: `Rejoignez la discussion autour de "${q}" sur Reddit.` },
            ];

            fakeResults.forEach(r => {
                const item = document.createElement('div');
                item.className = 'flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-background-subtle cursor-pointer transition-all group';
                item.innerHTML = `
                    <div class="h-9 w-9 rounded-lg bg-background-light border border-border-subtle flex items-center justify-center shrink-0 shadow-sm group-hover:border-primary/20">
                        <img src="https://www.google.com/s2/favicons?domain=${r.url}&sz=32" alt="" class="w-5 h-5 rounded" onerror="this.style.display='none'" />
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-primary truncate group-hover:underline">${escHtml(r.title)}</div>
                        <div class="text-[11px] text-text-muted">${escHtml(r.url)}</div>
                        <div class="text-xs text-text-muted mt-0.5">${escHtml(r.desc)}</div>
                    </div>
                `;
                item.onclick = () => window.open(`https://${r.url}/search?q=${encodeURIComponent(q)}`, '_blank');
                organicResults.appendChild(item);
            });
        }, 200);
    });
}

// ===== SUPABASE REALTIME =====
// Auto-updates sidebar whenever conversations change in DB (no page refresh needed)
function initRealtime() {
    // supabase global is loaded from CDN (supabase-js)
    if (typeof supabase === 'undefined') {
        console.warn('Supabase JS not loaded, Realtime disabled');
        return;
    }

    // Utilise le client global 'sb' déjà initialisé en haut du fichier
    const client = sb;

    client
        .channel('conversations-realtime')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'conversations' },
            (payload) => {
                const { eventType, new: newRow, old: oldRow } = payload;

                if (eventType === 'INSERT') {
                    const exists = state.conversations.find(c => c.id === newRow.id);
                    if (!exists) {
                        // #36: Only replace temp if it matches the current conversation
                        const tempIdx = state.conversations.findIndex(c => c.id?.startsWith('temp-') && c.id === state.currentConversationId);
                        if (tempIdx !== -1) {
                            state.conversations[tempIdx] = newRow;
                            state.currentConversationId = newRow.id; // Update the reference
                        } else {
                            // Remove any stale temps that don't match
                            state.conversations = state.conversations.filter(c => !c.id?.startsWith('temp-'));
                            state.conversations.unshift(newRow);
                        }
                    } else {
                        const idx = state.conversations.findIndex(c => c.id === newRow.id);
                        if (idx !== -1) state.conversations[idx] = newRow;
                    }
                    // Reorder: pinned first, then by updated_at desc
                    state.conversations.sort((a, b) => {
                        if (a.pinned !== b.pinned) return b.pinned - a.pinned;
                        return new Date(b.updated_at) - new Date(a.updated_at);
                    });
                    renderConversationList();

                } else if (eventType === 'UPDATE') {
                    const idx = state.conversations.findIndex(c => c.id === newRow.id);
                    if (idx !== -1) {
                        state.conversations[idx] = newRow;
                    } else {
                        state.conversations.unshift(newRow);
                    }
                    // Re-sort
                    state.conversations.sort((a, b) => {
                        if (a.pinned !== b.pinned) return b.pinned - a.pinned;
                        return new Date(b.updated_at) - new Date(a.updated_at);
                    });
                    renderConversationList();
                    // Update header if it's the current conversation
                    if (newRow.id === state.currentConversationId && newRow.title) {
                        updateConvTitleHeader(newRow.title);
                    }

                } else if (eventType === 'DELETE') {
                    state.conversations = state.conversations.filter(c => c.id !== oldRow.id);
                    if (state.currentConversationId === oldRow.id) {
                        state.chatMessages = []; // #37: Clear messages on remote delete
                        startNewChat();
                    } else {
                        renderConversationList();
                    }
                }
            }
        )
        .subscribe((status) => {
            console.log('[Realtime] status:', status);
        });
}

// ===== DARK MODE TOGGLE =====
document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('ctxThemeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const themeLabel = document.getElementById('themeLabel');
    const htmlEl = document.documentElement;

    function updateThemeUI() {
        const isDark = htmlEl.classList.contains('dark');
        if (themeIcon) themeIcon.textContent = isDark ? 'light_mode' : 'dark_mode';
        if (themeLabel) themeLabel.textContent = isDark ? 'Mode clair' : 'Mode sombre';
    }

    // Load saved theme
    if (localStorage.getItem('theme') === 'dark') {
        htmlEl.classList.add('dark');
    }
    updateThemeUI();

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            htmlEl.classList.toggle('dark');
            const isDark = htmlEl.classList.contains('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateThemeUI();
            // Hide the context menu if it was open
            const pageMenu = document.getElementById('pageContextMenu');
            if (pageMenu) pageMenu.classList.add('hidden');
        });
    }
});
