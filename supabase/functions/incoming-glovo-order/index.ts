
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

const GLOVO_AUTH_TOKEN = Deno.env.get('GLOVO_AUTH_TOKEN')

serve(async (req) => {
    try {
        // 1. Authorization Check
        const authHeader = req.headers.get('Authorization')
        // Glovo sends "Authorization: [token]" or "Authorization: Bearer [token]"?
        // Docs say: "Authorization: <your-secret-token>" (no Bearer prefix in some examples, but usually standard)
        // We will check if the header INCLUDES the token to be safe.
        if (GLOVO_AUTH_TOKEN && (!authHeader || !authHeader.includes(GLOVO_AUTH_TOKEN))) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
        }

        // 2. Parse Payload
        const payload = await req.json()
        console.log("Received Glovo Payload:", JSON.stringify(payload))

        // Mapping based on Glovo 'Order' schema from definition.yaml
        const orderId = payload.order_code || payload.order_id || `GL-${Date.now()}`;
        // Customer info might be sparse for marketplace orders
        const customerName = payload.customer?.name || "Glovo Customer";

        // Payment Method: CASH means customer pays driver. DELAYED means pre-paid on Glovo.
        const paymentMethod = payload.payment_method;

        // 3. Connect to Supabase
        const supabaseOps = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 4. Insert Order
        const { data: newOrder, error: orderError } = await supabaseOps
            .from('orders')
            .insert({
                order_number: orderId,
                customer_name: customerName,
                type: 'Delivery', // Glovo is always Delivery
                status: 'NEW',
                created_at: Date.now(),
                created_at: Date.now(),
                notes: `Glovo Order. Payment: ${paymentMethod}`,
                metadata: {
                    source: 'glovo',
                    store_id: payload.store_id, // Ensure we capture store_id for callbacks
                    glovo_order_id: payload.order_id,
                    payment_method: paymentMethod
                }
            })
            .select()
            .single();

        if (orderError) throw orderError;

        // 5. Map & Insert Items
        const items = (payload.products || []).map((item: any) => {
            // Price is in cents, convert to main currency unit if needed (assuming DB stores like that)
            // If DB stores floats/dollars: item.price / 100
            const price = item.price ? item.price / 100 : 0;

            // Attributes (options)
            const options = (item.attributes || []).map((attr: any) => attr.name).join(', ');

            return {
                order_id: newOrder.id,
                name: item.name || "Unknown Item",
                quantity: item.quantity || 1,
                category: 'Main',
                estimated_prep_time: 15, // Default
                notes: options ? `Options: ${options}` : null
            }
        });

        if (items.length > 0) {
            const { error: itemsError } = await supabaseOps
                .from('order_items')
                .insert(items);

            if (itemsError) throw itemsError;
        }

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
