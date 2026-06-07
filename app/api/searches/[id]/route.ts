import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Initialize Supabase with service role key to bypass RLS if needed for cascading deletes
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        
        // 1. Authenticate user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
        }

        const searchId = params.id

        // 2. Verify ownership
        const { data: search, error: searchError } = await supabase
            .from('scrape_jobs')
            .select('id_user')
            .eq('id_jobs', searchId)
            .single()

        if (searchError || !search) {
            return NextResponse.json({ error: "Recherche introuvable" }, { status: 404 })
        }

        if (search.id_user !== user.id) {
            return NextResponse.json({ error: "Non autorisé à supprimer cette recherche" }, { status: 403 })
        }

        // 3. Fetch all prospects for this search to handle cascading delete
        const { data: prospects, error: fetchProspectsError } = await supabaseAdmin
            .from('scrape_prospect')
            .select('prospect_id')
            .eq('id_jobs', searchId)

        if (fetchProspectsError) {
            console.error("Failed to fetch prospects for deletion:", fetchProspectsError)
            return NextResponse.json({ error: "Erreur lors de la récupération des prospects associés" }, { status: 500 })
        }

        const prospectIds = prospects?.map(p => p.prospect_id) || []

        // 4. Chunk deletion to avoid URL limits in Supabase REST API
        if (prospectIds.length > 0) {
            const chunkSize = 100
            for (let i = 0; i < prospectIds.length; i += chunkSize) {
                const chunk = prospectIds.slice(i, i + chunkSize)

                // Delete sending histories
                await supabaseAdmin.from('email_sends').delete().in('prospect_id', chunk)
                
                // Delete generated emails
                await supabaseAdmin.from('cold_email_generations').delete().in('prospect_id', chunk)
                
                // Delete campaign links
                await supabaseAdmin.from('campaign_prospects').delete().in('prospect_id', chunk)
            }
        }

        // 5. Delete prospects
        const { error: deleteProspectsError } = await supabaseAdmin
            .from('scrape_prospect')
            .delete()
            .eq('id_jobs', searchId)

        if (deleteProspectsError) {
            console.error("Error deleting prospects:", deleteProspectsError)
            return NextResponse.json({ error: "Erreur lors de la suppression des prospects" }, { status: 500 })
        }

        // 6. Delete search job
        const { error: deleteJobError } = await supabaseAdmin
            .from('scrape_jobs')
            .delete()
            .eq('id_jobs', searchId)

        if (deleteJobError) {
            console.error("Error deleting scrape job:", deleteJobError)
            return NextResponse.json({ error: "Erreur lors de la suppression de la recherche" }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: "Recherche et données associées supprimées" })
    } catch (error: any) {
        console.error("DELETE /api/searches/[id] Error:", error)
        return NextResponse.json({ error: error.message || "Erreur serveur" }, { status: 500 })
    }
}
