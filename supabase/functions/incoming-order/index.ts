
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

// Environment variables
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatically available in Edge Functions
const UBER_CLIENT_ID = Deno.env.get('UBER_CLIENT_ID')
const UBER_CLIENT_SECRET = Deno.env.get('UBER_CLIENT_SECRET')

serve(async (req) => {
    try {
        // 1. Validate Webhook (Simplified for initial setup, production should check X-Uber-Signature)
        const payload = await req.json()
        console.log("Received Payload:", JSON.stringify(payload))

        // Handle initial verification challenge if Uber sends one (though typically they send posted events)
        // Uber Eats webhook structure usually: { event_type: "orders.notification_created", meta: { resource_id: "order-id", ... } }

        // 2. Filter for Order Created Events
        if (payload.event_type !== "orders.notification_created") {
            return new Response("Ignored event type", { status: 200 })
        }

        const orderId = payload.meta.resource_id; // Retrieve the Uber Order ID
        const storeId = payload.meta.user_id; // Or however Uber sends the store context

        if (!orderId) {
            return new Response("No order ID found", { status: 400 })
        }

        // 3. Authenticate with Uber (Get Access Token)
        // Scope required: 'eats.store.orders.read'
        const tokenResponse = await fetch("https://login.uber.com/oauth/v2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: UBER_CLIENT_ID,
                client_secret: UBER_CLIENT_SECRET,
                grant_type: "client_credentials",
                scope: "eats.store.orders.read"
            })
        })

        const tokenData = await tokenResponse.json()
        if (!tokenData.access_token) {
            console.error("Failed to get Uber token", tokenData)
            return new Response("Failed to authenticate with Uber", { status: 500 })
        }

        // 4. Fetch Full Order Details
        const orderResponse = await fetch(`https://api.uber.com/v2/eats/order/${orderId}`, {
            headers: {
                "Authorization": `Bearer ${tokenData.access_token}`
            }
        })

        const orderDetails = await orderResponse.json()
        if (!orderResponse.ok) {
            console.error("Failed to fetch order", orderDetails)
            return new Response("Failed to fetch order details", { status: 500 })
        }

        // 5. Connect to Supabase
        const supabaseOps = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 6. Transform and Insert Order
        // Map Uber Eats JSON to our Database Structure
        // Note: This mapping depends on the exact structure of Uber's response and your DB

        const customerName = orderDetails.eater ? orderDetails.eater.first_name : "Uber Customer";
        const items = orderDetails.cart.items.map((item: any) => ({
            name: item.title,
            quantity: item.quantity,
            category: 'Main', // Defaulting to main, logic can be improved
            estimated_prep_time: 15,
            notes: item.special_requests
        }));

        // Insert Order
        const { data: newOrder, error: orderError } = await supabaseOps
            .from('orders')
            .insert({
                order_number: `UBER-${orderId.slice(-4)}`, // Shorten ID for display
                customer_name: customerName,
                type: 'Delivery',
                status: 'NEW',
                created_at: Date.now()
            })
            .select()
            .single();

        if (orderError) throw orderError;

        // Insert Items
        const { error: itemsError } = await supabaseOps
            .from('order_items')
            .insert(items.map((i: any) => ({ ...i, order_id: newOrder.id })));

        if (itemsError) throw itemsError;

        return new Response(JSON.stringify({ message: "Order processed successfully" }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        })

    } catch (error) {
        console.error(error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { "Content-Type": "application/json" },
            status: 400,
        })
    }
})
