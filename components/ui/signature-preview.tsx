"use client"

import { SignatureConfig } from "@/lib/email-signature-generator"
import { cn } from "@/lib/utils"

interface SignaturePreviewProps {
    config: SignatureConfig
    className?: string
}

export function SignaturePreview({ config, className }: SignaturePreviewProps) {
    const renderElement = (element: string) => {
        switch (element) {
            case 'name':
                if (!config.signature_name) return null
                return (
                    <div key="name" className="mb-1">
                        <strong className="text-base text-gray-900">{config.signature_name}</strong>
                    </div>
                )

            case 'title':
                if (!config.signature_title && !config.signature_company) return null
                const parts = []
                if (config.signature_title) parts.push(config.signature_title)
                if (config.signature_company) parts.push(config.signature_company)
                return (
                    <div key="title" className="mb-1 text-sm text-gray-600">
                        {parts.join(' • ')}
                    </div>
                )

            case 'company':
                // Handled in 'title'
                return null

            case 'phone':
                if (!config.signature_phone || config.signature_show_phone === false) return null
                return (
                    <div key="phone" className="mb-1 text-sm">
                        📞 <a href={`tel:${config.signature_phone}`} className="text-indigo-600 hover:underline">
                            {config.signature_phone}
                        </a>
                    </div>
                )

            case 'email':
                if (!config.signature_email || config.signature_show_email === false) return null
                return (
                    <div key="email" className="mb-1 text-sm">
                        \\✉️ <a href={`mailto:${config.signature_email}`} className="text-indigo-600 hover:underline">
                            {config.signature_email}
                        </a>
                    </div>
                )

            case 'website':
                if (!config.my_website || config.signature_show_website === false) return null
                const websiteText = config.signature_website_text || 'Visitez notre site web'
                return (
                    <div key="website" className="mb-1 text-sm">
                        🌐 <a href={config.my_website} className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">
                            {websiteText}
                        </a>
                    </div>
                )

            case 'custom_link':
                if (!config.signature_custom_link_url || !config.signature_custom_link_text) return null
                return (
                    <div key="custom_link" className="mb-1 text-sm">
                        🔗 <a href={config.signature_custom_link_url} className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">
                            {config.signature_custom_link_text}
                        </a>
                    </div>
                )

            case 'ps':
                if (!config.signature_ps) return null
                return (
                    <div key="ps" className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600 italic">
                        {config.signature_ps}
                    </div>
                )

            default:
                return null
        }
    }

    const order = config.signature_elements_order || [
        'name', 'title', 'company', 'phone', 'email', 'website', 'custom_link', 'ps'
    ]

    return (
        <div className={cn(
            "bg-gray-50 p-6 rounded-lg border border-gray-200",
            className
        )}>
            <div className="space-y-0.5">
                {order.map(renderElement).filter(Boolean)}
            </div>
        </div>
    )
}
