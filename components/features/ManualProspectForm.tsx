"use client"

import { useState } from 'react'
import { Building2, Mail, Globe, Phone, MapPin, Briefcase, Tag, FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ProspectImportData } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { toast } from 'sonner'

// Zod schema for validation
const prospectSchema = z.object({
    titre: z.string().min(1, 'Le titre est obligatoire'),
    email: z.string().email('Format email invalide').optional().or(z.literal('')),
    site_web: z.string().url('Format URL invalide').optional().or(z.literal('')),
    telephone: z.string().optional(),
    rue: z.string().optional(),
    ville: z.string().optional(),
    code_postal: z.string().optional(),
    secteur: z.string().optional(),
    categorie: z.string().optional(),
    notes: z.string().optional(),
})

type ProspectFormData = z.infer<typeof prospectSchema>

export function ManualProspectForm() {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<ProspectFormData>({
        resolver: zodResolver(prospectSchema),
        defaultValues: {
            titre: '',
            email: '',
            site_web: '',
            telephone: '',
            rue: '',
            ville: '',
            code_postal: '',
            secteur: '',
            categorie: '',
            notes: '',
        },
    })

    const onSubmit = async (data: ProspectFormData) => {
        setIsSubmitting(true)

        try {
            // Convert to ProspectImportData format
            const prospectData: ProspectImportData = {
                titre: data.titre,
                email: data.email || undefined,
                site_web: data.site_web || undefined,
                telephone: data.telephone || undefined,
                rue: data.rue || undefined,
                ville: data.ville || undefined,
                code_postal: data.code_postal || undefined,
                secteur: data.secteur || undefined,
                categorie: data.categorie || undefined,
                notes: data.notes || undefined,
            }

            const response = await fetch('/api/prospects/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prospects: [prospectData] }),
            })

            const result = await response.json()

            if (!response.ok) {
                toast.error(result.error || 'Erreur lors de l\'ajout du prospect')
                return
            }

            toast.success('Prospect ajouté avec succès !')
            form.reset()

            // Redirect to prospects list after 1 second
            setTimeout(() => {
                router.push('/prospects')
            }, 1000)

        } catch (error) {
            console.error('Error submitting prospect:', error)
            toast.error('Erreur lors de l\'ajout du prospect')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ajouter un prospect manuellement</CardTitle>
                <CardDescription>
                    Remplissez les informations du prospect. Les champs marqués d'un * sont obligatoires.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        {/* Titre - Required */}
                        <FormField
                            control={form.control}
                            name="titre"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4" />
                                        Titre / Nom de l'entreprise *
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: Le Marais Restaurant Paris" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Email - Recommended */}
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-orange-600" />
                                        Email
                                        <span className="text-xs text-orange-600">(fortement recommandé)</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder="contact@exemple.fr" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Site web - Recommended */}
                        <FormField
                            control={form.control}
                            name="site_web"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-orange-600" />
                                        Site web
                                        <span className="text-xs text-orange-600">(fortement recommandé pour Deep Search)</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="https://www.exemple.fr" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Téléphone - Recommended */}
                        <FormField
                            control={form.control}
                            name="telephone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-orange-600" />
                                        Téléphone
                                        <span className="text-xs text-orange-600">(recommandé pour appels à froid)</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="+33 1 23 45 67 89" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Address Section */}
                        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                            <h3 className="font-medium flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-orange-600" />
                                Adresse
                                <span className="text-xs text-orange-600 font-normal">(recommandée pour Deep Search)</span>
                            </h3>

                            <FormField
                                control={form.control}
                                name="rue"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Rue</FormLabel>
                                        <FormControl>
                                            <Input placeholder="47 Rue de Turbigo" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="ville"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Ville</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Paris" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="code_postal"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Code postal</FormLabel>
                                            <FormControl>
                                                <Input placeholder="75003" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Secteur - Recommended */}
                        <FormField
                            control={form.control}
                            name="secteur"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Briefcase className="h-4 w-4 text-orange-600" />
                                        Secteur d'activité
                                        <span className="text-xs text-orange-600">(recommandé pour Deep Search)</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: Restaurant, Tech, Immobilier..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Catégorie - Optional */}
                        <FormField
                            control={form.control}
                            name="categorie"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Tag className="h-4 w-4" />
                                        Catégorie
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: Restaurant méditerranéen" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Notes - Optional */}
                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        Notes additionnelles
                                    </FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Ajoutez des notes supplémentaires sur ce prospect..."
                                            className="resize-none"
                                            rows={4}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => form.reset()}
                                disabled={isSubmitting}
                            >
                                Réinitialiser
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Ajout en cours...' : 'Ajouter le prospect'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
