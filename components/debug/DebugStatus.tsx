"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function DebugStatus() {
    const [status, setStatus] = useState<string>("Initializing...")
    const [sessionStatus, setSessionStatus] = useState<string>("Checking...")
    const [lastEvent, setLastEvent] = useState<string>("None")
    const [isVisible, setIsVisible] = useState(true)

    useEffect(() => {
        const supabase = createClient()

        // Check Session Immediately
        setStatus("Checking Session...")
        supabase.auth.getSession().then(({ data, error }: { data: { session: any }, error: any }) => {
            if (error) setSessionStatus(`Error: ${error.message}`)
            else if (data.session) setSessionStatus(`User: ${data.session.user.email}`)
            else setSessionStatus("No Session")
            setStatus("Ready")
        })

        // Listen for events
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
            setLastEvent(event)
            console.log(`[DebugStatus] Event: ${event}`)
        })

        return () => subscription.unsubscribe()
    }, [])

    if (!isVisible) return <button onClick={() => setIsVisible(true)} className="fixed bottom-2 right-2 bg-red-500 text-white p-1 text-xs z-50">Show Debug</button>

    return (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg z-[9999] text-xs font-mono w-64 border border-red-500 shadow-2xl">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-red-500">🚑 SYSTEM DEBUG</h3>
                <button onClick={() => setIsVisible(false)} className="text-gray-400 hover:text-white">x</button>
            </div>
            <div className="space-y-1">
                <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className="text-green-400">{status}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Session:</span>
                    <span className="truncate max-w-[120px]" title={sessionStatus}>{sessionStatus}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Last Event:</span>
                    <span className="text-yellow-400">{lastEvent}</span>
                </div>
                <div className="mt-2 text-[10px] text-gray-500">
                    If this box appears, Debug Mode is Active.
                    Reload the page. If "Status" stays "Checking..." significantly long, Auth Lock is present.
                </div>
            </div>
        </div>
    )
}
