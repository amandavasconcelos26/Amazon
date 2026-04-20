import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, User, Info, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { AuditResult, AuditSummary } from '@/src/types';
import { getAuditSupport } from '../services/extractionService';

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface HelpCenterProps {
  results: AuditResult[];
  summary: AuditSummary;
}

export const HelpCenter: React.FC<HelpCenterProps> = ({ results, summary }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: 'Olá! Sou o suporte técnico do sistema. Carregue seus relatórios na aba "Auditoria" e me faça perguntas sobre os dados para que eu possa te ajudar na análise.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || results.length === 0) return;

    // @ts-ignore
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      setMessages(prev => [...prev, 
        { role: 'user', content: input.trim() },
        { role: 'model', content: '⚠️ Erro de Configuração: A chave de API do Gemini não foi encontrada no ambiente. Certifique-se de configurar GEMINI_API_KEY no Vercel.' }
      ]);
      setInput('');
      return;
    }

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      // Preparar dados resumidos para o processamento (removendo o 'raw' para economizar recursos)
      const simplifiedResults = results.slice(0, 150).map(r => ({
        cte: r.cte,
        status: r.status,
        empresaA: r.sistemaA?.freteEmpresa,
        empresaB: r.sistemaB?.freteEmpresa,
        motoristaA: r.sistemaA?.freteMotorista,
        motoristaB: r.sistemaB?.freteMotorista,
        pesoA: r.sistemaA?.peso,
        pesoB: r.sistemaB?.peso,
        diffEmpresa: r.divergencias.freteEmpresa,
        diffMotorista: r.divergencias.freteMotorista,
        diffPeso: r.divergencias.peso,
      }));

      const contents = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));
      contents.push({ role: 'user', parts: [{ text: userMsg }] });

      const aiResponse = await getAuditSupport(contents, summary, simplifiedResults);
      setMessages(prev => [...prev, { role: 'model', content: aiResponse || 'Desculpe, não consegui processar sua solicitação.' }]);
    } catch (error) {
      console.error("Erro no suporte:", error);
      setMessages(prev => [...prev, { role: 'model', content: 'Ocorreu um erro ao processar sua pergunta. Verifique se os arquivos não são muito grandes ou tente novamente.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-[700px] border-white/5 shadow-2xl shadow-slate-950/50 rounded-[2.5rem] overflow-hidden glass-card">
      <CardHeader className="bg-indigo-900/10 border-b border-white/5 p-8">
        <CardTitle className="flex items-center gap-4 font-heading text-2xl font-black text-white tracking-tight uppercase">
          <div className="p-4 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-900/40 text-white">
            <MessageSquare className="h-6 w-6" />
          </div>
          Consultor Amanda
        </CardTitle>
        <CardDescription className="text-slate-500 font-bold uppercase tracking-widest text-[10px] pt-1">Assistência Analítica com Inteligência Artificial</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden bg-white/5 backdrop-blur-sm">
        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {messages.map((msg, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn("flex gap-4 max-w-[85%]", msg.role === 'user' ? "ml-auto flex-row-reverse" : "")}
            >
              <div className={cn(
                "flex-shrink-0 h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg transition-transform hover:scale-110", 
                msg.role === 'user' ? "bg-indigo-600 text-white shadow-indigo-900/40" : "bg-slate-800 border border-white/5 text-indigo-400 shadow-slate-950"
              )}>
                {msg.role === 'user' ? <User className="h-5 w-5" /> : <Info className="h-5 w-5" />}
              </div>
              <div className={cn(
                "p-5 rounded-[1.5rem] text-sm shadow-xl leading-relaxed font-medium transition-all", 
                msg.role === 'user' 
                  ? "bg-indigo-600 text-white rounded-tr-none shadow-indigo-900/20" 
                  : "bg-slate-800 border border-white/10 text-slate-300 rounded-tl-none shadow-slate-950/40"
              )}>
                {msg.content}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div className="flex gap-4 max-w-[80%]">
              <div className="flex-shrink-0 h-10 w-10 rounded-2xl bg-slate-800 border border-white/5 text-indigo-400 flex items-center justify-center shadow-lg shadow-slate-950">
                <Info className="h-5 w-5" />
              </div>
              <div className="p-6 rounded-[1.5rem] bg-slate-800 border border-white/10 text-slate-500 rounded-tl-none flex items-center gap-2 shadow-xl shadow-slate-950/40">
                <div className="h-2.5 w-2.5 bg-indigo-500 rounded-full animate-bounce" />
                <div className="h-2.5 w-2.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="h-2.5 w-2.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-8 bg-black/20 backdrop-blur-md border-t border-white/5">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-4">
            <Input 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder={results.length ? "Pergunte algo estratégico sobre os dados..." : "Carregue os relatórios para começar..."}
              disabled={isLoading || results.length === 0}
              className="flex-1 border-white/10 rounded-2xl h-14 px-6 text-sm font-bold text-white placeholder:text-slate-600 focus-visible:ring-4 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 transition-all bg-white/5 shadow-inner"
            />
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim() || results.length === 0} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-900/40 h-14 w-14 rounded-2xl transition-all hover:scale-110 active:scale-95 group"
            >
              <Send className="h-6 w-6 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};
