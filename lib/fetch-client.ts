import { createClient } from '@/lib/supabase/client'

type FetchOptions = RequestInit & {
    headers?: Record<string, string>
}

export const authenticatedFetch = async (url: string, options: FetchOptions = {}) => {
    // 🔐 NO-LOCK FETCH STRATEGY
    // We rely purely on Browser Cookies for authentication.
    // We DO NOT call supabase.auth.getSession() to avoid "Navigator Lock" contention.

    console.log(`🚀 [AuthenticatedFetch] Requesting: ${url}`)

    // 1. Execute Fetch (Cookies are sent automatically by browser)
    let response
    try {
        response = await fetch(url, options)
        console.log(`✅ [AuthenticatedFetch] Response received (Status: ${response.status})`)
    } catch (error: any) {
        console.error('🔥 [AuthenticatedFetch] Network Error:', error)
        throw error
    }

    // 2. Simple 401 Handling (Redirect Only)
    // If we get 401, it means Cookies are invalid/expired.
    // We do NOT attempt to refresh token here to avoid Lock Contention.
    // We simply redirect to login.
    if (response.status === 401) {
        console.error('🛑 [Global 401 Interceptor] Unauthorized. Redirecting to Login.')
        window.location.href = '/login?reason=session_expired'
    }

    return response
}
