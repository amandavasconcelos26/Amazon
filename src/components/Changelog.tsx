import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, CheckCircle2, Zap, ShieldCheck, BarChart3, FileText } from 'lucide-react';

export const Changelog: React.FC = () => {
  const updates = [
    {
      title: "Novo Indicador: Diferença Empresa",
      description: "Adicionamos um card no topo que mostra o desvio total entre o que foi cobrado no Relatório Sistema A e o que consta no Relatório GW.",
      icon: <BarChart3 className="h-5 w-5 text-emerald-600" />,
      tag: "Novo"
    },
    {
      title: "Restauração da Margem (B)",
      description: "A coluna de margem do relatório de carreteiro voltou à tabela, agora com destaque em vermelho para valores negativos, facilitando a identificação de prejuízos.",
      icon: <FileText className="h-5 w-5 text-blue-600" />,
      tag: "Melhoria"
    },
    {
      title: "Renomeação: Diferença Motorista",
      description: "O antigo 'Valor em Risco' agora se chama 'Diferença Motorista', tornando o indicador mais direto e fácil de explicar para a equipe.",
      icon: <Zap className="h-5 w-5 text-amber-600" />,
      tag: "Ajuste"
    },
    {
      title: "Mapeamento Automático Inteligente",
      description: "O sistema agora tenta identificar as colunas (CTE, Frete, Peso) automaticamente assim que você carrega os arquivos, economizando cliques.",
      icon: <Sparkles className="h-5 w-5 text-indigo-600" />,
      tag: "Produtividade"
    },
    {
      title: "Estabilidade para Múltiplos Usuários",
      description: "Implementamos um sistema de processamento em lotes para evitar que o servidor fique 'ocupado' quando várias pessoas usam a ferramenta ao mesmo tempo.",
      icon: <ShieldCheck className="h-5 w-5 text-rose-600" />,
      tag: "Estabilidade"
    },
    {
      title: "Relatórios Exportáveis Aprimorados",
      description: "Tanto o PDF quanto o Excel agora incluem as novas colunas e indicadores, garantindo que o relatório impresso seja idêntico ao que você vê na tela.",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
      tag: "Concluído"
    }
  ];

  return (
    <div className="space-y-12">
      <div className="glass-card p-10 rounded-3xl border border-white/10 shadow-xl shadow-slate-950/40">
        <h2 className="text-3xl font-extrabold font-heading text-white flex items-center gap-4 tracking-tight">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-900/40 text-white">
            <Sparkles className="h-6 w-6" />
          </div>
          Registro de Evolução
        </h2>
        <p className="text-slate-400 font-medium mt-4 max-w-2xl leading-relaxed">
          Acompanhe as últimas melhorias implementadas para tornar sua auditoria logística mais rápida, precisa e estratégica.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {updates.map((update, index) => (
          <Card key={index} className="glass-card border-white/10 shadow-xl shadow-slate-950/40 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 rounded-[2rem] overflow-hidden group hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center gap-5 space-y-0 pb-4 bg-white/5 border-b border-white/10 p-8">
              <div className="p-3 bg-slate-800 rounded-2xl shadow-lg shadow-slate-950 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                {update.icon}
              </div>
              <div className="flex-1">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-black font-heading text-white tracking-tight leading-tight">
                      {update.title}
                    </CardTitle>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full bg-slate-800 text-slate-500 w-fit">
                    {update.tag}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <p className="text-sm text-slate-400 leading-loose font-medium">
                {update.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-indigo-600 p-8 rounded-[2rem] flex items-start gap-6 shadow-2xl shadow-indigo-900/40 text-white">
        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <div>
          <h4 className="text-lg font-black font-heading uppercase tracking-widest">Dica de Produtividade</h4>
          <p className="text-sm text-indigo-100 mt-2 font-medium leading-relaxed opacity-90">
            Sempre que subir um arquivo novo, o sistema fará o mapeamento automático. Se alguma coluna não for identificada, você ainda pode ajustá-la manualmente na aba de Auditoria clicando no seletor de colunas.
          </p>
        </div>
      </div>
    </div>
  );
};
