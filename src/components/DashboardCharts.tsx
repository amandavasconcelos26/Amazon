import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AuditResult, AuditSummary } from '@/src/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface DashboardChartsProps {
  results: AuditResult[];
  summary: AuditSummary;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ results, summary }) => {
  const pieData = useMemo(() => [
    { name: 'Conciliados', value: results.filter(r => r.status === 'BOTH_MATCH').length, color: '#10b981' },
    { name: 'Divergentes', value: summary.divergencias, color: '#f43f5e' },
    { name: 'Faltantes', value: summary.faltantes, color: '#f59e0b' },
  ], [results, summary]);

  const topDivergences = useMemo(() => {
    return results
      .filter(r => r.status === 'BOTH_DIVERGENT' || r.status === 'A_ONLY')
      .map(r => {
        const totalDiff = r.status === 'A_ONLY' ? (r.sistemaA?.freteEmpresa || 0) : Math.abs(r.diferencaMotorista);
        return {
          cte: r.cte,
          diff: totalDiff
        };
      })
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 5);
  }, [results]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <Card className="border-white/10 shadow-2xl shadow-slate-950/50 rounded-[2rem] overflow-hidden glass-card">
        <CardHeader className="bg-white/5 border-b border-white/10 p-8">
          <CardTitle className="font-heading text-2xl font-extrabold tracking-tight text-white">Status da Auditoria</CardTitle>
          <CardDescription className="text-slate-400 font-medium pt-1">Distribuição percentual dos resultados processados</CardDescription>
        </CardHeader>
        <CardContent className="p-8 h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={8}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} className="hover:opacity-80 transition-opacity cursor-pointer" />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`${value} CTEs`, 'Quantidade']}
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                  borderRadius: '1.25rem', 
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)', 
                  fontWeight: 'bold',
                  backdropBlur: '12px'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle" 
                formatter={(value) => <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-white/10 shadow-2xl shadow-slate-950/50 rounded-[2rem] overflow-hidden glass-card">
        <CardHeader className="bg-white/5 border-b border-white/10 p-8">
          <CardTitle className="font-heading text-2xl font-extrabold tracking-tight text-white">Foco nas Divergências</CardTitle>
          <CardDescription className="text-slate-400 font-medium pt-1">Top 5 CTEs com maior impacto financeiro direto</CardDescription>
        </CardHeader>
        <CardContent className="p-8 h-[360px]">
          {topDivergences.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topDivergences} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tickFormatter={(val) => `R$${val}`} stroke="#475569" fontSize={10} fontWeight="bold" />
                <YAxis dataKey="cte" type="category" stroke="#475569" fontSize={10} width={100} fontWeight="black" />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Diferença Total']}
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                    borderRadius: '1.25rem', 
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)', 
                    fontWeight: 'bold',
                    backdropBlur: '12px'
                  }}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.02)', radius: 10 }}
                />
                <Bar dataKey="diff" fill="#6366f1" radius={[0, 10, 10, 0]} barSize={28} className="hover:opacity-80 transition-opacity" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
              <div className="p-5 bg-white/5 rounded-3xl">
                <PieChart className="h-10 w-10 opacity-20 text-white" />
              </div>
              <span className="text-sm font-bold opacity-60 uppercase tracking-widest">Nenhuma divergência detectada</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
