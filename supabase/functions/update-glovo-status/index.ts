
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

const GLOVO_AUTH_TOKEN = Deno.env.get('GLOVO_AUTH_TOKEN')
// e.g. https://api.glovoapp.com
const GLOVO_API_URL = Deno.env.get('GLOVO_API_URL') || 'https://stageapi.glovoapp.com'

serve(async (req) => {
    // CORS headers
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            }
        })
    }

    try {
        const { orderId, status, storeId, glovoOrderId } = await req.json()

        if (!glovoOrderId || !storeId || !status) {
            throw new Error("Missing required fields: glovoOrderId, storeId, status")
        }

        console.log(`Updating Glovo Order ${glovoOrderId} to ${status}`)

        // Map KDS Status to Glovo Status
        // KDS: NEW -> PREPARING -> READY -> DISPATCHED
        // Glovo: ACCEPTED, READY_FOR_PICKUP, etc.
        let glovoStatus = ''
        let endpoint = ''

        if (status === 'PREPARING') {
            glovoStatus = 'ACCEPTED'
            endpoint = `/webhook/stores/${storeId}/orders/${glovoOrderId}/status`
        } else if (status === 'READY') {
            glovoStatus = 'READY_FOR_PICKUP'
            endpoint = `/webhook/stores/${storeId}/orders/${glovoOrderId}/status`
        } else {
            // Other statuses might not need syncing or need mapped logic
            return new Response(JSON.stringify({ message: "Status ignored" }), {
                headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' },
                status: 200,
            })
        }

        // Call Glovo API
        const response = await fetch(`${GLOVO_API_URL}${endpoint}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': GLOVO_AUTH_TOKEN ?? '' // The shared secret
                // Note: Real Glovo auth might need 'Bearer' prefix or simple string dependent on implementation
            },
            body: JSON.stringify({
                status: glovoStatus
            })
        })

        if (!response.ok) {
            const errText = await response.text()
            throw new Error(`Glovo API Error: ${response.status} - ${errText}`)
        }

        return new Response(JSON.stringify({ success: true, glovoStatus }), {
            headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' },
            status: 200,
        })

    } catch (error) {
        console.error(error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' },
            status: 400,
        })
    }
})
