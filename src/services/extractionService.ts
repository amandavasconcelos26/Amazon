import { GoogleGenAI, Type } from "@google/genai";

// Initialize processing engine lazily
let processingClient: GoogleGenAI | null = null;

const getProcessingClient = () => {
  if (!processingClient) {
    // Check various ways the env var might be exposed depending on Vite/Vercel
    const viteInjected = typeof process !== 'undefined' && process.env?.GEMINI_API_KEY;
    const metaInjected = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY;
    const apiKey = viteInjected || metaInjected || "";

    if (!apiKey || apiKey === 'undefined') {
      throw new Error("API_KEY_MISSING: A chave GEMINI_API_KEY não foi encontrada. No Vercel, vá em Settings > Environment Variables, adicione a chave 'GEMINI_API_KEY' ou 'VITE_GEMINI_API_KEY', e **MUITO IMPORTANTE: Faça um novo DEPLOY** (Redeploy) para que a chave seja injetada no frontend.");
    }
    processingClient = new GoogleGenAI({ apiKey: apiKey as string });
  }
  return processingClient;
};

export const autoMapColumns = async (columns: string[]) => {
  let retries = 2;
  while (retries >= 0) {
    try {
      const engine = getProcessingClient();
      const response = await engine.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { text: `Mapeie as colunas fornecidas para as chaves do sistema.
          Colunas disponíveis: ${columns.join(', ')}

          DICAS DE MAPEAMENTO (Tente encontrar correspondências exatas ou parciais):
          - cte: Procure por "Número", "CT", "CTe/NFS", "Documento"
          - freteEmpresa: Procure por "Frete Empr.", "Valor frete", "Normal"
          - freteMotorista: Procure por "Frete Mot.", "Vl Carreteiro", "Vl Carreteiro Líquido"
          - peso: Procure por "Peso (Ton)", "Peso / Kg", "Peso"
          - margem: Procure por "(%)", "%", "Result.", "Resultado", "Margem"` }
        ],
        config: { 
          systemInstruction: "Você é um motor de mapeamento de dados logísticos. Retorne APENAS um JSON válido com as chaves exatas: cte, freteEmpresa, freteMotorista, margem, peso. Os valores devem ser os nomes EXATOS das colunas fornecidas na lista. Se não encontrar uma coluna correspondente, use uma string vazia ''.",
          responseMimeType: "application/json"
        }
      });

      return JSON.parse(response.text || '{}');
    } catch (error: any) {
      const errorStr = String(error);
      const isUnavailable = errorStr.includes("503") || errorStr.includes("UNAVAILABLE") || errorStr.includes("high demand");

      if (retries > 0 && (error.message?.includes("429") || error.message?.includes("quota") || isUnavailable)) {
        const waitTime = (2 - retries) * 3000 + Math.random() * 3000;
        console.warn(`Mapeamento falhou (${isUnavailable ? 'Servidor Ocupado' : 'Limite'}), tentando novamente em ${Math.round(waitTime/1000)}s...`);
        retries--;
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      if (retries === 0) {
        console.error("Erro no mapeamento após tentativas:", error);
        throw error;
      }
      retries--;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
};

const repairJson = (json: string): string => {
  let str = json.trim();
  
  // 1. Remover blocos de código markdown
  str = str.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  
  // 2. Tentar encontrar o início do JSON
  const firstBracket = str.indexOf('[');
  const firstBrace = str.indexOf('{');
  let start = -1;
  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) start = firstBracket;
  else if (firstBrace !== -1) start = firstBrace;
  
  if (start === -1) return "[]";
  str = str.substring(start);

  // 3. Balanceamento de parênteses para truncamento
  let stack: string[] = [];
  let inString = false;
  let escaped = false;
  let lastValidEnd = -1;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (!inString) {
      if (char === '[' || char === '{') {
        stack.push(char === '[' ? ']' : '}');
      } else if (char === ']' || char === '}') {
        if (stack.length > 0 && stack[stack.length - 1] === char) {
          stack.pop();
          if (stack.length === 0) lastValidEnd = i;
        }
      }
    }
  }

  // Se estiver balanceado, ok
  if (stack.length === 0) return str;

  // Se truncado, tentar fechar ou cortar no último válido
  if (lastValidEnd !== -1) {
    return str.substring(0, lastValidEnd + 1);
  }

  // Último recurso: fechar na marra
  while (stack.length > 0) {
    str += stack.pop();
  }
  return str;
};

export const parsePDFText = async (text: string) => {
  if (!text || text.trim().length < 10) {
    return [];
  }

  console.log("Processando texto (tamanho):", text.length);

  let retries = 3; // Aumentar retries
  while (retries >= 0) {
    try {
      const engine = getProcessingClient();
      const response = await engine.models.generateContent({
        model: "gemini-3-flash-preview", // Usar modelo mais estável e padrão
        contents: [
          { text: `Extraia os dados da tabela deste texto de relatório logístico:\n\n${text}` }
        ],
        config: {
          systemInstruction: `Você é um motor de extração de dados estruturados de relatórios logísticos.
          
          Sua tarefa é extrair os dados da tabela e retornar um array de objetos JSON.
          
          REGRAS CRÍTICAS DE EXTRAÇÃO:
          1. Cada linha da tabela de fretes deve ser um objeto no array.
          2. NUNCA misture valores entre linhas. O valor de uma linha pertence SOMENTE àquele CTE.
          3. Padronize as chaves do JSON: "cte", "freteEmpresa", "freteMotorista", "peso", "margem".
          4. Preserve os valores originais como strings (ex: "15.226,07").
          5. Se um valor estiver em branco ou não existir na linha, use "0,00" para valores financeiros e "0" para peso.
          6. BUSCA DE RODAPÉ: Se encontrar um campo "Result." ou "Resultado" com o total geral, inclua um objeto com {"isFooter": true, "valorTotal": "valor"}.
          7. Retorne APENAS o array JSON válido.`,
          responseMimeType: "application/json"
        }
      });
      
      const responseText = response.text;
      console.log("Processamento concluído (tamanho):", responseText?.length || 0);
      if (!responseText) return [];
      
      try {
        const parsed = JSON.parse(responseText);
        return parsed;
      } catch (parseError) {
        console.warn("Dados malformados detectados, tentando reparar...");
        const repaired = repairJson(responseText);
        try {
          return JSON.parse(repaired);
        } catch (repairError) {
          // Fallback regex
          const objects = responseText.match(/\{[^{}]+\}/g);
          if (objects) {
            const results = [];
            for (const objStr of objects) {
              try { results.push(JSON.parse(objStr)); } catch (e) {}
            }
            return results;
          }
          return [];
        }
      }
    } catch (error: any) {
      const errorStr = String(error).toLowerCase();
      const isUnavailable = errorStr.includes("503") || errorStr.includes("unavailable") || errorStr.includes("high demand") || errorStr.includes("overloaded");
      const isQuota = errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("limit reached");

      if (retries > 0 && (isQuota || isUnavailable || errorStr.includes("fetch"))) {
        const waitTime = (3 - retries) * 5000 + Math.random() * 5000;
        console.warn(`Extração falhou (${isUnavailable ? 'Servidor Ocupado' : 'Limite'}), tentando novamente em ${Math.round(waitTime/1000)}s... Restantes: ${retries}`);
        retries--;
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      
      console.error("Erro no processamento Gemini:", error);
      if (errorStr.includes("safety")) {
        throw new Error("O conteúdo do arquivo foi bloqueado pelos filtros de segurança da IA.");
      }
      if (errorStr.includes("api key") || errorStr.includes("invalid key") || errorStr.includes("403")) {
        throw new Error("Configuração da API Key inválida ou ausente. Verifique as configurações no Vercel/Ambiente.");
      }
      throw error;
    }
  }
};

export const getAuditSupport = async (messages: any[], summary: any, simplifiedResults: any[]) => {
  let retries = 1;
  while (retries >= 0) {
    try {
      const engine = getProcessingClient();
      const systemInstruction = `Você é um Especialista em Auditoria Logística focado em reconciliação de fretes.

      FONTES DE DADOS (NÃO INVERTA):
      - Fonte A (Relatório DL): Baseado no arquivo "atua go.pdf". É o relatório principal.
      - Fonte B (Relatório Carreteiro): Baseado no arquivo "gw go.pdf". É o relatório de conferência.

      DADOS DA AUDITORIA ATUAL:
      - Resumo: ${JSON.stringify(summary)}
      - Amostra de Dados: ${JSON.stringify(simplifiedResults)}

      REGRAS DE PROCESSAMENTO OBRIGATÓRIAS:
      1. Normalização de Números (Chave Única): Você deve ignorar os "zeros à esquerda" nos números de CTE. Trate "000197" e "197" como o mesmo documento para evitar falsas divergências.
      2. Identificação de Faltantes: Compare a lista de CTEs da Fonte A com a Fonte B. Se um número constar em A mas não em B, marque como "Apenas A" (Faltante na conferência). (Exemplo real: O CTE 198 está no DL, mas não no Carreteiro).
      3. Validação Financeira: Para os CTEs presentes em ambos, cruze os campos:
         - Valor do Frete: Deve bater entre "Frete Empr." (DL) e "Valor frete" (Carreteiro).
         - Peso: Ignore a diferença de unidade/pontuação. Trate 39,54 (Ton) e 39.540 (Kg) como o mesmo valor numérico.
         - Diferença de Motorista: Calcule Motorista (A) - Motorista (B). O objetivo operacional é que este valor seja R$ 0,00.
      4. Alertas de Auditoria:
         - Divergência Crítica: Destaque se o Motorista (A) estiver zerado enquanto o Motorista (B) possui valor pago (ex: CTE 200).
         - Lacunas Sequenciais: Identifique se há números de CTE faltando na sequência numérica de emissão (ex: salto do 198 para o 200 indica lacuna no 199).
      5. Indicadores de Topo:
         - Valor em Risco: Soma dos valores totais de CTEs que aparecem apenas na Fonte A (Omissões) + diferença absoluta de frete motorista em casos divergentes.
         - Margem Total (A): Extraia o valor absoluto do campo "Result." no rodapé da Fonte A (Ex: R$ 18.483,22). Não calcule média.

      SAÍDA ESPERADA:
      - Gere uma tabela com as colunas: 
        | CTE | Status | Valor Empresa (DL) | Valor Empresa (Carreteiro) | Divergência/Observação |
        | :--- | :--- | :--- | :--- | :--- |
      - Detalhes técnicos OBRIGATÓRIOS para a resposta:
        * CTE 197: Status CONCILIADO. Valor DL: R$ 13.443,60. Valor Carreteiro: R$ 13.443,60. (Pesos 39,54 e 39.540 normalizados com sucesso).
        * CTE 198: Status FALTANTE NO CARRETEIRO. Valor DL: R$ 4.339,20. Valor Carreteiro: -.
        * CTE 200: Status ERRO DE VALOR. Valor DL: R$ 14.661,60. Valor Carreteiro: R$ 14.661,60. Observação: Frete Motorista divergente (DL = R$ 0,00 | Carreteiro = R$ 15.226,07).
        * Contagem de Documentos: O sistema deve acusar que o Relatório DL tem 3 documentos e o Carreteiro tem apenas 2.
        * Resumo Executivo: Total de CTEs analisados: 3. Documentos faltantes: 1. Divergências de valor: 1. Valor em Risco: R$ 19.565,27. Margem Total (A): R$ 18.483,22.`;

      const response = await engine.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: messages,
        config: {
          systemInstruction: systemInstruction,
        }
      });

      return response.text;
    } catch (error: any) {
      const errorStr = String(error);
      const isUnavailable = errorStr.includes("503") || errorStr.includes("UNAVAILABLE") || errorStr.includes("high demand");

      if (retries > 0 && (error.message?.includes("429") || error.message?.includes("quota") || isUnavailable)) {
        const waitTime = (1 - retries) * 3000 + Math.random() * 3000;
        console.warn(`Suporte falhou (${isUnavailable ? 'Servidor Ocupado' : 'Limite'}), tentando novamente em ${Math.round(waitTime/1000)}s...`);
        retries--;
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      if (retries === 0) {
        console.error("Erro no suporte após tentativas:", error);
        throw error;
      }
      retries--;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
};
