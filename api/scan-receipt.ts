import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { base64Data, mimeType, apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'Missing Gemini API key. Please set your API key in settings.' });
  }
  if (!base64Data) {
    return res.status(400).json({ error: 'Missing image data.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType || 'image/jpeg' } },
          {
            text: "Extract all individual line items from this receipt. For each item, provide the name and the final price. Also extract the subtotal and the total tax amount. If an item has a quantity greater than 1, please list it as a single entry with the total price for that line. Return the data in JSON format."
          }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  price: { type: Type.NUMBER }
                },
                required: ["name", "price"]
              }
            },
            tax: { type: Type.NUMBER },
            subtotal: { type: Type.NUMBER }
          },
          required: ["items", "tax", "subtotal"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      return res.status(500).json({ error: 'No response from Gemini AI.' });
    }

    const data = JSON.parse(text);
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Gemini API error:', error);

    if (error?.status === 401 || error?.message?.includes('API key')) {
      return res.status(401).json({ error: 'Invalid Gemini API key. Please check your key and try again.' });
    }
    if (error?.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment and try again.' });
    }

    return res.status(500).json({ error: 'Failed to process receipt. Please try again.' });
  }
}
