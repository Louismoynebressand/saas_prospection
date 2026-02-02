import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ProspectImportData } from '@/types'
import { validateProspectBatch } from '@/lib/csv-validator'

/**
 * POST /api/prospects/import
 * Imports prospects from CSV data
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Non authentifié' },
                { status: 401 }
            )
        }

        // Parse request body
        const body = await request.json()
        const { prospects } = body as { prospects: ProspectImportData[] }

        if (!prospects || !Array.isArray(prospects) || prospects.length === 0) {
            return NextResponse.json(
                { error: 'Aucun prospect à importer' },
                { status: 400 }
            )
        }

        // Validate all prospects
        const validatedProspects = validateProspectBatch(prospects)

        // Collect validation errors
        const errors: Array<{ line: number; error: string }> = []
        const validProspects: Array<{ line: number; data: ProspectImportData }> = []

        validatedProspects.forEach(({ index, validation, data }) => {
            if (!validation.isValid) {
                errors.push({
                    line: index + 1,
                    error: validation.errors.join(', ')
                })
            } else {
                validProspects.push({ line: index + 1, data })
            }
        })

        // If no valid prospects, return errors
        if (validProspects.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    imported_count: 0,
                    failed_count: prospects.length,
                    errors
                },
                { status: 400 }
            )
        }

        // ===== CREATE A SCRAPE JOB FOR THIS IMPORT =====
        // This is required for existing workflows to function properly
        const { data: jobData, error: jobError } = await supabase
            .from('scrape_job')
            .insert({
                id_user: user.id,
                request_search: JSON.stringify({
                    query: 'Import CSV',
                    type: 'import_csv',
                    count: validProspects.length
                }),
                request_url: null,
                resuest_ville: null,
                request_count: validProspects.length,
                localisation: null,
                deepscan: false,
                enrichie_emails: false,
                statut: 'ALLfinish', // Mark as completed immediately
            })
            .select()
            .single()

        if (jobError || !jobData) {
            console.error('Error creating scrape job:', jobError)
            return NextResponse.json(
                { error: 'Erreur lors de la création du job d\'importation', details: jobError?.message },
                { status: 500 }
            )
        }

        const jobId = jobData.id_jobs

        // Prepare data for insertion
        const prospectsToInsert = validProspects.map(({ data }) => {
            // Build data_scrapping JSON object
            const dataScrapping: any = {
                Titre: data.titre,
                Email: data.email || null,
                'Site web': data.site_web || null,
                Téléphone: data.telephone || null,
                Rue: data.rue || null,
                Ville: data.ville || null,
                'Code postal': data.code_postal || null,
                'Nom de catégorie': data.categorie || null,
                'Score total': data.score_total || null,
                'Nombre d\'avis': data.nombre_avis || null,
                'URL Google Maps': data.url_google_maps || null,
            }

            // Build localisation if lat/lng provided
            const localisation = (data.latitude && data.longitude) ? {
                lat: data.latitude,
                lng: data.longitude
            } : null

            return {
                id_user: user.id,
                id_jobs: jobId, // Link to the import job we just created
                data_scrapping: dataScrapping,
                ville: data.ville || null,
                secteur: data.secteur || null,
                localisation: localisation,
                email_adresse_verified: data.email || null,
                deep_search: null,
                resume: data.notes || null,
                check_email: false,
                succed_validation_smtp_email: false,
                email_scrap_etat: null,
                deep_search_charged: false,
            }
        })

        // Insert prospects into database
        const { data: insertedData, error: insertError } = await supabase
            .from('scrape_prospect')
            .insert(prospectsToInsert)
            .select()

        if (insertError) {
            console.error('Error inserting prospects:', insertError)
            return NextResponse.json(
                { error: 'Erreur lors de l\'insertion des prospects', details: insertError.message },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            imported_count: validProspects.length,
            failed_count: errors.length,
            errors: errors.length > 0 ? errors : undefined,
        })

    } catch (error) {
        console.error('Error importing prospects:', error)
        return NextResponse.json(
            { error: 'Erreur lors de l\'importation' },
            { status: 500 }
        )
    }
}
