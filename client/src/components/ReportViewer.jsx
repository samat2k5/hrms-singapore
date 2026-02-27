import React from 'react';
import { X, Download, Printer } from 'lucide-react';

export default function ReportViewer({ isOpen, onClose, pdfUrl, title }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                            <Printer className="w-5 h-5 text-cyan-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-100">{title || 'Report Preview'}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const link = document.createElement('a');
                                link.href = pdfUrl;
                                link.download = `${title || 'report'}.pdf`;
                                link.click();
                            }}
                            className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Download PDF"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-slate-950 p-4 overflow-hidden rounded-b-2xl">
                    <iframe
                        src={pdfUrl}
                        className="w-full h-full rounded-lg border border-slate-800"
                        title="PDF Preview"
                    />
                </div>
            </div>
        </div>
    );
}
