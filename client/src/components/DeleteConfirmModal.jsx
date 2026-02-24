import React from 'react';

export default function DeleteConfirmModal({ isOpen, onClose, onConfirm, itemName, title = "Confirm Deletion" }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="card-base p-6 w-full max-w-md animate-slide-up text-center" style={{ background: 'rgba(15, 23, 42, 0.98)' }}>
                <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4 text-2xl border border-red-500/20">
                    ⚠️
                </div>
                <h2 className="text-xl font-bold text-[var(--text-main)] mb-2">{title}</h2>
                <p className="text-[var(--text-muted)] mb-6">
                    Are you sure you want to delete <span className="text-[var(--text-main)] font-medium">"{itemName}"</span>? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-[var(--border-main)] text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-all text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        id="confirm-delete-btn"
                        onClick={onConfirm}
                        className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-[var(--text-main)] font-bold transition-all shadow-lg shadow-red-500/20"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}
