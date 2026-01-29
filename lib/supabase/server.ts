import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                // The "Null Operation" Setter
                // By leaving set/remove empty, we disable the SDK's ability to 
                // trigger the refresh flow's write phase. 
                // This effectively turns the client into "Read-Only" mode.
                set(name: string, value: string, options: CookieOptions) {
                    // Intentionally empty. 
                    // Server Components cannot write cookies.
                },
                remove(name: string, options: CookieOptions) {
                    // Intentionally empty.
                },
            },
        }
    )
}
