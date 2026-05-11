import React, { useCallback } from 'react';
import { Upload, FileText, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface FileUploadProps {
  label: string;
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  accept?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ label, onFileSelect, selectedFile, accept = ".csv,.xlsx,.xls,.pdf" }) => {
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <Card 
      className={cn(
        "relative border-2 border-dashed p-6 transition-all duration-500 ease-in-out rounded-3xl group overflow-hidden perspective-1000",
        selectedFile 
          ? "border-amber-500 bg-white/5 shadow-xl shadow-amber-900/40" 
          : cn(
              "border-white/5 bg-white/5 backdrop-blur-sm hover:border-amber-400 hover:bg-white/10 hover:shadow-2xl hover:shadow-amber-900/20 hover:-translate-y-1",
              isDragging && "border-amber-500 bg-amber-500/10 ring-8 ring-amber-500/5"
            )
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center space-y-4 text-center relative z-10">
        <div className={cn(
          "rounded-2xl p-4 transition-all duration-500 shadow-sm border border-white/10",
          selectedFile 
            ? "bg-amber-600 text-white scale-110 shadow-2xl shadow-amber-900/40 rotate-0" 
            : "bg-slate-800 text-slate-500 group-hover:scale-110 group-hover:rotate-6 group-hover:text-amber-400 group-hover:shadow-xl group-hover:shadow-amber-900/40"
        )}>
          {selectedFile ? <CheckCircle2 className="h-8 w-8" /> : <Upload className="h-8 w-8" />}
        </div>
        
        <div className="space-y-2">
          <p className="text-lg font-extrabold font-heading text-white tracking-tight leading-tight">{label}</p>
          <div className="flex flex-col items-center gap-1.5">
            {selectedFile ? (
              <div className="flex items-center gap-3 px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl shadow-sm">
                <FileText className="h-4 w-4 text-amber-400" />
                <span className="text-sm text-amber-300 font-bold truncate max-w-[200px]">{selectedFile.name}</span>
              </div>
            ) : (
              <p className="text-sm text-slate-400 font-medium">
                Arraste o arquivo aqui ou <span className="text-amber-400 font-extrabold underline decoration-2 underline-offset-4 cursor-pointer hover:text-amber-300 transition-colors">procure</span>
              </p>
            )}
            <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-[0.2em] mt-0.5 bg-white/5 px-2.5 py-0.5 rounded-full">PDF · EXCEL · CSV</p>
          </div>
        </div>

        <input
          type="file"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={handleFileChange}
          accept={accept}
        />
      </div>
      
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-700 bg-gradient-to-br from-amber-500/[0.02] via-transparent to-amber-500/[0.02]" />
    </Card>
  );
};
