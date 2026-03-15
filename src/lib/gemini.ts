import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

export async function analyzeProductImage(base64Image: string) {
  if (!apiKey) throw new Error("API Key do Gemini não encontrada.");

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Remove data:image/jpeg;base64, prefix
  const base64Data = base64Image.split(",")[1];

  const prompt = `
    Você é um especialista em marketing de cosméticos.
    Analise esta imagem de produto e gere:
    1. Um nome atraente para o produto (se não houver um).
    2. Uma descrição curta e viciante (máximo 150 caracteres) focada em benefícios.
    
    Retorne APENAS um JSON no formato:
    {
      "suggestedName": "nome aqui",
      "suggestedDescription": "descrição aqui"
    }
  `;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: base64Data,
        mimeType: "image/jpeg"
      }
    }
  ]);

  const response = await result.response;
  const text = response.text();
  
  // Clean JSON from response if needed
  const jsonMatch = text.match(/\{.*\}/s);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error("Não foi possível gerar sugestões para esta imagem.");
}

export async function suggestPrice(productName: string, description: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const prompt = `
    Baseado no produto de cosméticos "${productName}" e na descrição "${description}", 
    sugira um preço de mercado competitivo em Reais (BRL).
    Retorne APENAS o número, sem R$ ou texto.
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return parseFloat(response.text().trim());
}
