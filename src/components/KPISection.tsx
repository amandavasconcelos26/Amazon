import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AuditSummary } from '@/src/types';
import { FileCheck, AlertTriangle, FileSearch, DollarSign, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

interface KPISectionProps {
  summary: AuditSummary;
}

export const KPISection: React.FC<KPISectionProps> = ({ summary }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card className="glass-card shadow-xl shadow-slate-950/40 rounded-[2.5rem] overflow-hidden hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-500 group border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-white/5 border-b border-white/10 p-6">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 font-sans">CTEs Analisados</CardTitle>
            <div className="p-2.5 bg-amber-600 rounded-xl shadow-lg shadow-amber-900/40 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 text-white">
              <FileCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-8">
            <div className="text-4xl font-black font-heading text-white tracking-tight leading-none">{summary.totalAnalizados}</div>
            <div className="h-1 w-10 bg-amber-500 mt-4 rounded-full group-hover:w-16 transition-all duration-500" />
            <p className="text-[10px] font-extrabold text-slate-500 mt-3 uppercase tracking-[0.1em]">Volume total auditado</p>
          </CardContent>
        </Card>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="glass-card shadow-xl shadow-slate-950/40 rounded-[2.5rem] overflow-hidden hover:shadow-2xl hover:shadow-rose-500/10 transition-all duration-500 group border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-white/5 border-b border-white/10 p-6">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 font-sans">Divergências</CardTitle>
            <div className="p-2.5 bg-rose-500 rounded-xl shadow-lg shadow-rose-900/40 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 text-white">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-8">
            <div className="text-4xl font-black font-heading text-rose-500 tracking-tight leading-none">{summary.divergencias}</div>
            <div className="h-1 w-10 bg-rose-500 mt-4 rounded-full group-hover:w-16 transition-all duration-500" />
            <div className="flex flex-col gap-1 mt-3">
              <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-[0.1em]">{summary.faltantes} ausentes</p>
              {summary.tolerance !== undefined && summary.tolerance > 0 && (
                <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider bg-rose-500/10 px-2 py-0.5 rounded-md inline-block w-fit">Tol: {formatCurrency(summary.tolerance)}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card className="glass-card shadow-xl shadow-slate-950/40 rounded-[2.5rem] overflow-hidden hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-500 group border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-white/5 border-b border-white/10 p-6">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 font-sans">Diferença Motorista</CardTitle>
            <div className="p-2.5 bg-amber-500 rounded-xl shadow-lg shadow-amber-900/40 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 text-white">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-8">
            <div className="text-3xl font-black font-heading text-amber-500 tracking-tight leading-none">
              {formatCurrency(summary.valorTotalDivergencia)}
            </div>
            <div className="h-1 w-10 bg-amber-500 mt-4 rounded-full group-hover:w-16 transition-all duration-500" />
            <p className="text-[10px] font-extrabold text-slate-500 mt-3 uppercase tracking-[0.1em]">Impacto total em fretes</p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="glass-card shadow-xl shadow-slate-950/40 rounded-[2.5rem] overflow-hidden hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-500 group border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-white/5 border-b border-white/10 p-6">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 font-sans">Diferença Empresa</CardTitle>
            <div className="p-2.5 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-900/40 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 text-white">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-8">
            <div className="text-3xl font-black font-heading text-emerald-500 tracking-tight leading-none">
              {formatCurrency(summary.totalEmpresaA - summary.totalEmpresaB)}
            </div>
            <div className="h-1 w-10 bg-emerald-500 mt-4 rounded-full group-hover:w-16 transition-all duration-500" />
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Margem A:</span>
              <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 rounded-md">{formatCurrency(summary.margemTotal)}</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {summary.lacunasSequenciais && summary.lacunasSequenciais.length > 0 && (
        <Card className="md:col-span-2 lg:col-span-4 border-amber-500/10 bg-amber-500/5 backdrop-blur-sm shadow-xl shadow-amber-950/40 rounded-[2rem] overflow-hidden">
          <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-4 border-b border-amber-500/10 p-6">
            <div className="p-2.5 bg-amber-500 rounded-xl shadow-lg shadow-amber-900/40 text-white">
              <FileSearch className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-black font-heading text-amber-200 tracking-tight uppercase">Lacunas Sequenciais</CardTitle>
              <p className="text-[10px] text-amber-500/60 font-bold uppercase tracking-widest pt-0.5">Descontinuidade na numeração de CTE</p>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-2.5">
              {summary.lacunasSequenciais.map((gap, idx) => (
                <span key={idx} className="px-4 py-2 bg-white/5 border border-amber-500/20 text-amber-200 text-xs font-black rounded-xl shadow-sm hover:scale-105 transition-transform cursor-default">
                  {gap}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
