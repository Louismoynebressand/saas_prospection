import { createClient } from '@/lib/supabase/client'

type FetchOptions = RequestInit & {
    headers?: Record<string, string>
}

export const authenticatedFetch = async (url: string, options: FetchOptions = {}) => {
    // Use the singleton client to avoid "split-brain" and lock contention
    const supabase = createClient()

    console.log(`🚀 [AuthenticatedFetch] Requesting: ${url}`)

    // 1. Get the current session token (non-forcing)
    console.log('🔐 [AuthenticatedFetch] Getting session...')
    const { data: { session } } = await supabase.auth.getSession()
    console.log(`🔑 [AuthenticatedFetch] Session retrieved (Token: ${session?.access_token ? 'Yes' : 'No'})`)

    const headers = new Headers(options.headers)
    if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`)
    }

    // 2. Execute Fetch with Error Handling
    let response
    try {
        console.log('📡 [AuthenticatedFetch] Executing fetch...')
        response = await fetch(url, { ...options, headers })
        console.log(`✅ [AuthenticatedFetch] Response received (Status: ${response.status})`)
    } catch (error: any) {
        console.error('🔥 [AuthenticatedFetch] Network/Abort Error:', error)
        throw error
    }

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
        try {
            response = await fetch(url, { ...options, headers })
        } catch (retryError) {
            console.error('🔥 [Global 401 Interceptor] Retry Failed:', retryError)
            throw retryError
        }
    }

    return response
}
