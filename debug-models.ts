
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY || "");

async function listModels() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("Tentando listar modelos...");
    // O SDK v6+ não tem listModels direto no genAI de forma fácil sem o client REST às vezes, 
    // mas vamos tentar ver se conseguimos uma resposta simples ou mudar para um nome conhecido.
  } catch (e) {
    console.error(e);
  }
}

listModels();
