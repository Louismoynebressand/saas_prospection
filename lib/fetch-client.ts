import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type FetchOptions = RequestInit & {
    headers?: Record<string, string>
}

export const authenticatedFetch = async (url: string, options: FetchOptions = {}) => {
    // 1. Get the current session token (non-forcing)
    const { data: { session } } = await supabase.auth.getSession()

    const headers = new Headers(options.headers)
    if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`)
    }

    // 2. Execute Fetch
    let response = await fetch(url, { ...options, headers })

    // 3. The Anti-Freeze Interceptor
    if (response.status === 401) {
        console.error('🛑 [Global 401 Interceptor] Triggered. Initiating Recovery.')

        // Attempt to refresh the session manually
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()

        if (refreshError || !refreshData.session) {
            // If refresh fails, the session is dead.
            // Force a hard navigation to login to clear all memory state.
            console.error('💀 [Global 401 Interceptor] Refresh Failed -> Force Login.')
            window.location.href = '/login?reason=session_expired'
            return response // Return original response (caller should prevent further action)
        }

        // If refresh succeeded, retry the request with the new token
        console.log('✅ [Global 401 Interceptor] Refresh Success -> Retrying Request.')
        headers.set('Authorization', `Bearer ${refreshData.session.access_token}`)

        // Retry the original fetch
        response = await fetch(url, { ...options, headers })
    }

    return response
}
