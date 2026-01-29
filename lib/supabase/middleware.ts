import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ⚠️ DEVELOPMENT ONLY: Set to true to bypass auth for local testing
// ⚠️ IMPORTANT: Set back to false before deploying to production!
const DEV_BYPASS_AUTH = false

export async function updateSession(request: NextRequest) {
    // DEV MODE: Skip all auth checks if bypass is enabled
    if (DEV_BYPASS_AUTH && process.env.NODE_ENV === 'development') {
        console.log('🔓 [DEV MODE] Auth bypass enabled - skipping authentication')
        return NextResponse.next({
            request: {
                headers: request.headers,
            },
        })
    }

    // 1. Initialize Response Holder
    // We need a response object to attach cookies to, even before we know the outcome.
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                /* 
                 * CRITICAL: The "Dual-Write" Strategy
                 * When Supabase SDK calls 'set', we must update:
                 * 1. The Request: So Server Components get the valid token NOW.
                 * 2. The Response: So the Browser gets the valid token for LATER.
                 */
                set(name: string, value: string, options: CookieOptions) {
                    // Update the request cookies (propagates to Server Components)
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })

                    // Re-create the response to reflect the updated request headers
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })

                    // Update the response cookies (propagates to Browser)
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    // Same Dual-Write Pattern for removal
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })

                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })

                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    // 2. Token Refresh Trigger
    // This call is what triggers the 'set' method above if the token is expired.
    // We use getUser() instead of getSession() for security (validates against DB).
    const { data: { user } } = await supabase.auth.getUser()

    // 3. Protected Route Logic
    const protectedPaths = ['/dashboard', '/recherche-prospect', '/searches', '/prospects', '/emails', '/email-verifier', '/settings', '/billing']
    const isProtectedRoute = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))

    // Redirect to login if accessing protected route without auth
    if (isProtectedRoute && !user) {
        // Use 307 to preserve request context
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // Redirect to dashboard if logged in and trying to access login/signup
    if ((request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup') && user) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return response
}
