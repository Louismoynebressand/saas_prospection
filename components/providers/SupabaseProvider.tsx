'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState, useRef } from 'react'

type SupabaseContext = {
    supabase: ReturnType<typeof createBrowserClient>
}

const Context = createContext<SupabaseContext | undefined>(undefined)

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
    // Singleton Pattern: Create the client once.
    const [supabase] = useState(() =>
        createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
    )
    const router = useRouter()

    const isFirstEvent = useRef(true)

    useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            // 0. Handle Initial Event (Fix for Reload Freeze)
            // Supabase fires 'SIGNED_IN' or 'INITIAL_SESSION' immediately on mount.
            // We ignore this first event because the Server Components are already
            // rendered with the correct session (handled by Middleware).
            // Refreshing here causes a double-fetch and UI freeze.
            if (isFirstEvent.current) {
                isFirstEvent.current = false
                if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                    console.log('⚡️ [SupabaseProvider] Skipping Initial Session Event (No Refresh)')
                    return
                }
            }

            // 1. Token Refresh Event
            // When the browser auto-refreshes the token, we MUST tell Next.js.
            if (event === 'TOKEN_REFRESHED') {
                // This invalidates the Router Cache and triggers a server re-render
                // with the new cookies.
                console.log('🔄 [SupabaseProvider] Token Refreshed -> Refreshing Router')
                router.refresh()
            }

            // 2. Sign Out Event
            // Clear cache and redirect to prevent "Stale Auth" freeze.
            if (event === 'SIGNED_OUT') {
                console.log('👋 [SupabaseProvider] Signed Out -> Refreshing & Redirecting')
                router.refresh()
                router.push('/login')
            }

            // 3. Manual Recovery
            // If we are signed in but the server rendered a 401 (Router Cache Trap),
            // this refresh will fix it. (Only updates AFTER the initial load)
            if (event === 'SIGNED_IN') {
                console.log('✅ [SupabaseProvider] Signed In -> Refreshing Router')
                router.refresh()
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [router, supabase])

    return (
        <Context.Provider value={{ supabase }}>
            {children}
        </Context.Provider>
    )
}

export const useSupabase = () => {
    const context = useContext(Context)
    if (context === undefined) throw new Error('useSupabase must be used inside SupabaseProvider')
    return context.supabase
}
