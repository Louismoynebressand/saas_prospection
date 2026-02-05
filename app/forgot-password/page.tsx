"use client"

import { useState } from "react"
import Link from "next/link"
import { Mail, ArrowRight, Loader2, ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("")
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const supabase = createClient()
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
            })

            if (error) {
                throw error
            }

            setSuccess(true)
        } catch (err: any) {
            setError(err.message || "Une erreur est survenue")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/30 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-300">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white text-2xl font-bold">
                            N
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold">Mot de passe oublié</CardTitle>
                    <CardDescription>
                        Entrez votre email pour recevoir un lien de réinitialisation
                    </CardDescription>
                </CardHeader>

                {success ? (
                    <CardContent className="space-y-4">
                        <div className="p-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md text-center">
                            Un email vous a été envoyé. Cliquez sur le lien pour réinitialiser votre mot de passe.
                        </div>
                        <Button
                            variant="outline"
                            className="w-full"
                            asChild
                        >
                            <Link href="/login">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Retour à la connexion
                            </Link>
                        </Button>
                    </CardContent>
                ) : (
                    <form onSubmit={handleReset}>
                        <CardContent className="space-y-4">
                            {error && (
                                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-medium">
                                    Email
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="votre@email.com"
                                        className="pl-9"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Envoi en cours...
                                    </>
                                ) : (
                                    <>
                                        Envoyer le lien
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </CardContent>
                        <CardFooter className="flex flex-col space-y-4">
                            <Link
                                href="/login"
                                className="text-sm text-center text-muted-foreground hover:text-primary transition-colors flex items-center justify-center"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Retour à la connexion
                            </Link>
                        </CardFooter>
                    </form>
                )}
            </Card>
        </div>
    )
}
