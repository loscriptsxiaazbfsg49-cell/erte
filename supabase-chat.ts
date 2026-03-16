import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const OPENROUTER_SITEMAP_URL = 'https://openrouter.ai/sitemap.xml';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// ===== IN-MEMORY CACHES =====
let cachedApiKey: string | null = null;
let cachedModelsResponse: string | null = null;
let cachedModelsTimestamp = 0;
const MODELS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes server-side cache

// Prefixes in sitemap URLs that are NOT model pages
const SITEMAP_SKIP_PREFIXES = [
    'docs', 'apps', 'rankings', 'compare', 'settings', 'keys', 'activity',
    'credits', 'account', 'custom', 'workspace', 'provider', 'works-with-openrouter',
    'announcements', 'blog', 'collections', 'chat'
];

async function getOpenRouterKey(): Promise<string | null> {
    if (cachedApiKey) return cachedApiKey;

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await supabaseAdmin
        .from('api_keys')
        .select('api_key')
        .eq('service', 'openrouter')
        .single();

    if (error || !data) {
        console.error('Failed to fetch API key:', error);
        return null;
    }

    cachedApiKey = data.api_key;
    return cachedApiKey;
}

/**
 * Fetches the OpenRouter sitemap.xml and extracts all model IDs
 * that follow the pattern: https://openrouter.ai/{provider}/{model-name}
 */
async function fetchSitemapModelIds(): Promise<string[]> {
    try {
        const resp = await fetch(OPENROUTER_SITEMAP_URL);
        if (!resp.ok) return [];
        const xml = await resp.text();

        // Extract all <loc> URLs
        const locMatches = xml.match(/<loc>(.*?)<\/loc>/g);
        if (!locMatches) return [];

        const modelIds: string[] = [];
        for (const loc of locMatches) {
            const url = loc.replace(/<\/?loc>/g, '');
            const path = url.replace('https://openrouter.ai/', '');
            const parts = path.split('/');

            // Model pages have exactly 2 parts: provider/model-name
            if (parts.length !== 2) continue;

            // Skip non-model pages
            if (SITEMAP_SKIP_PREFIXES.some(prefix => path.startsWith(prefix))) continue;

            modelIds.push(path); // e.g. "black-forest-labs/flux.2-max"
        }

        return modelIds;
    } catch (err) {
        console.error('Sitemap fetch failed:', err);
        return [];
    }
}

/**
 * Builds a complete models response by:
 * 1. Fetching the standard OpenRouter /api/v1/models (with API key for auth)
 * 2. Fetching sitemap.xml to discover hidden models not in the API
 * 3. Merging them: API models keep full metadata, sitemap-only models get basic info
 */
async function buildCompleteModelsResponse(apiKey: string): Promise<string> {
    // Check server-side cache
    if (cachedModelsResponse && (Date.now() - cachedModelsTimestamp) < MODELS_CACHE_TTL) {
        return cachedModelsResponse;
    }

    // Fetch both in parallel for speed
    const [apiResp, sitemapIds] = await Promise.all([
        fetch(OPENROUTER_MODELS_URL, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://omegai.app',
                'X-Title': 'Omegai',
            }
        }).then(r => r.json()),
        fetchSitemapModelIds()
    ]);

    const apiModels: any[] = apiResp.data || [];
    const apiIdSet = new Set(apiModels.map((m: any) => m.id));

    // Find models in sitemap that are NOT in the API response
    const missingIds = sitemapIds.filter(id => !apiIdSet.has(id));

    // Build basic model objects for missing models
    for (const id of missingIds) {
        const parts = id.split('/');
        const provider = parts[0] || '';
        const modelSlug = parts[1] || '';

        // Generate a human-readable name from the slug
        const name = modelSlug
            .replace(/-/g, ' ')
            .replace(/\./g, ' ')
            .replace(/\b\w/g, (c: string) => c.toUpperCase());

        // Guess modality from known provider types
        let modality = 'text->text';
        if (provider === 'black-forest-labs' || modelSlug.includes('flux') || modelSlug.includes('sdxl') || modelSlug.includes('stable-diffusion') || modelSlug.includes('seedream')) {
            modality = 'text->text+image';
        } else if (modelSlug.includes('embed') || modelSlug.includes('embedding')) {
            modality = 'text->embedding';
        }

        apiModels.push({
            id,
            name: `${provider.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}: ${name}`,
            architecture: { modality },
            pricing: { prompt: '0', completion: '0' },
            _source: 'sitemap' // Flag to indicate this came from sitemap discovery
        });
    }

    const result = JSON.stringify({ data: apiModels });

    // Cache the merged result server-side
    cachedModelsResponse = result;
    cachedModelsTimestamp = Date.now();

    console.log(`[Omegai Edge] API: ${apiIdSet.size} models, Sitemap extra: ${missingIds.length}, Total: ${apiModels.length}`);

    return result;
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const pathParts = url.pathname.split('/');
        const action = pathParts[pathParts.length - 1];

        // GET /chat/models - complete model list (API + sitemap discovery)
        if (req.method === 'GET' && action === 'models') {
            const apiKey = await getOpenRouterKey();
            if (!apiKey) {
                return new Response(JSON.stringify({ error: 'API key not configured on server' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            const data = await buildCompleteModelsResponse(apiKey);
            return new Response(data, {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800' },
            });
        }

        // POST /chat - proxy chat completion
        if (req.method === 'POST') {
            const apiKey = await getOpenRouterKey();
            if (!apiKey) {
                return new Response(JSON.stringify({ error: 'API key not configured on server' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            const body = await req.json();

            // Validate required fields
            if (!body.model || !body.messages || !Array.isArray(body.messages)) {
                return new Response(JSON.stringify({ error: 'Missing model or messages' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            // Forward to OpenRouter
            const openrouterResp = await fetch(OPENROUTER_CHAT_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://omegai.app',
                    'X-Title': 'Omegai',
                },
                body: JSON.stringify({
                    model: body.model,
                    messages: body.messages,
                    stream: body.stream || false,
                    temperature: body.temperature,
                    max_tokens: body.max_tokens,
                }),
            });

            // Handle streaming responses
            if (body.stream && openrouterResp.body) {
                return new Response(openrouterResp.body, {
                    status: openrouterResp.status,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    },
                });
            }

            // Non-streaming response
            const data = await openrouterResp.text();
            return new Response(data, {
                status: openrouterResp.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
