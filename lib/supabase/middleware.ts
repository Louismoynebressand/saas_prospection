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
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
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

    // Refresh session if needed
    const { data: { user } } = await supabase.auth.getUser()

    // Protected routes
    const protectedPaths = ['/dashboard', '/recherche-prospect', '/searches', '/prospects', '/emails', '/email-verifier', '/settings', '/billing']
    const isProtectedRoute = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))

    // Redirect to login if accessing protected route without auth
    if (isProtectedRoute && !user) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // Redirect to dashboard if logged in and trying to access login/signup
    if ((request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup') && user) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return response
}
