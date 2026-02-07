
import { GoogleGenAI, Type } from "@google/genai";
import { Order, ChefInsight, OrderStatus } from "../types";

const MENU_URL = "https://potofjollof.africa.restaurant/";

export async function getChefInsights(orders: Order[]): Promise<{ insights: ChefInsight[]; sources: any[] }> {
  // Create a new instance right before making the API call to ensure the latest API key is used.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const orderSummary = orders.map(o => ({
    status: o.status,
    items: o.items.map(i => i.name),
    timeElapsed: Math.floor((Date.now() - o.createdAt) / 60000)
  }));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Context: You are the Head Chef AI at "Pot of Jollof Kitchen". 
      Reference the official menu at ${MENU_URL} to provide specific kitchen management advice.
      Current Kitchen State: ${JSON.stringify(orderSummary)}
      Provide 3 specific insights regarding prep times for Jollof variations, protein handling, or bottleneck warnings based on the actual menu items.`,
      config: {
        // Fix: Removed googleSearch because "do not attempt to parse it as JSON" rule applies when it is used.
        // We rely on responseSchema for structured programmatic access.
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              advice: { type: Type.STRING },
              urgency: { type: Type.STRING, enum: ['low', 'medium', 'high'] }
            },
            required: ['title', 'advice', 'urgency']
          }
        }
      }
    });

    const insights = JSON.parse(response.text || '[]');
    // Fix: Sources are empty as googleSearch tool was removed to ensure reliable JSON parsing.
    return { insights, sources: [] };
  } catch (error) {
    console.error("Gemini Insights Error:", error);
    // Rethrow to allow App.tsx to catch specific status codes like 429 or "Requested entity was not found."
    throw error;
  }
}

export async function generateSimulatedOrder(): Promise<Order> {
  // Create a new instance right before making the API call to ensure the latest API key is used.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Access the menu at ${MENU_URL} and create a single realistic customer order for "Pot of Jollof Kitchen".
      The order must include 2-4 items strictly from their menu (e.g., Jollof Rice, Suya, Fried Plantain, etc.).
      For each item, provide a realistic estimated preparation time in minutes based on how complex it is to prepare.
      Include a realistic Nigerian name for the customer and a random order type (Dine-in, Takeout, or Delivery).`,
      config: {
        // Fix: Removed googleSearch because "do not attempt to parse it as JSON" rule applies when it is used.
        // We rely on responseSchema for structured programmatic access.
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['Dine-in', 'Takeout', 'Delivery'] },
            tableNumber: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  category: { type: Type.STRING, enum: ['Main', 'Side', 'Drink', 'Dessert'] },
                  notes: { type: Type.STRING },
                  estimatedPrepTime: { type: Type.NUMBER }
                },
                required: ['name', 'quantity', 'category', 'estimatedPrepTime']
              }
            }
          },
          required: ['customerName', 'type', 'items']
        }
      }
    });

    const data = JSON.parse(response.text || '{}');
    // Fix: Sources are empty as googleSearch tool was removed to ensure reliable JSON parsing.
    const sources: any[] = [];

    return {
      id: Math.random().toString(36).substr(2, 9),
      orderNumber: `PJ-${Math.floor(100 + Math.random() * 899)}`,
      customerName: data.customerName,
      type: data.type,
      tableNumber: data.tableNumber,
      status: OrderStatus.NEW,
      createdAt: Date.now(),
      items: (data.items || []).map((item: any, idx: number) => ({
        id: `gen-${idx}`,
        ...item
      })),
      groundingSources: sources
    };
  } catch (error) {
    console.error("Order Simulation Error:", error);
    // Rethrow to allow App.tsx to catch specific status codes like 429 or "Requested entity was not found."
    throw error;
  }
}
