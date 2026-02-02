import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/prospects/template
 * Downloads a CSV template file for prospect import
 */
export async function GET(request: NextRequest) {
    try {
        // Define all CSV columns
        const headers = [
            'Titre*',
            'Email (recommandé)',
            'Site web (recommandé)',
            'Téléphone (recommandé)',
            'Rue (recommandé)',
            'Ville (recommandé)',
            'Code postal (recommandé)',
            'Secteur (recommandé)',
            'Nom de catégorie',
            'Score total',
            'Nombre d\'avis',
            'Latitude',
            'Longitude',
            'URL Google Maps',
            'Notes'
        ]

        // Example data row
        const exampleRow = [
            'Le Marais Restaurant Paris',
            'contact@lemarais.fr',
            'https://www.lemarais-restaurant.com',
            '+33987360913',
            '47 R. de Turbigo',
            'Paris',
            '75003',
            'Restaurant',
            'Restaurant méditerranéen',
            '4.5',
            '1851',
            '48.865138',
            '2.3540023',
            'https://www.google.com/maps/search/?api=1&query=Le%20Marais%20Restaurant',
            'Excellent restaurant avec terrasse'
        ]

        // Helper function to escape CSV values
        const escapeCsvValue = (value: string) => {
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                return `"${value.replace(/"/g, '""')}"`
            }
            return value
        }

        // Build CSV content
        const csvRows = [
            headers.map(escapeCsvValue).join(','),
            '# Champs obligatoires : Titre* | Champs recommandés : Email, Site web, Téléphone, Adresse, Secteur',
            exampleRow.map(escapeCsvValue).join(',')
        ]

        const csvContent = csvRows.join('\n')

        // Return CSV file
        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename="modele_import_prospects.csv"',
            },
        })
    } catch (error) {
        console.error('Error generating CSV template:', error)
        return NextResponse.json(
            { error: 'Erreur lors de la génération du modèle CSV' },
            { status: 500 }
        )
    }
}
