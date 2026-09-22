import React from 'react';
import { AlertCircle, AlertTriangle, BellRing, X } from 'lucide-react';
import { AnomalyAlert } from '../types';

interface AlertsBannerProps {
  alerts: AnomalyAlert[];
  onDismiss: (id: string) => void;
  onScanPrompt?: () => void;
}

export const AlertsBanner: React.FC<AlertsBannerProps> = ({
  alerts,
  onDismiss,
  onScanPrompt,
}) => {
  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-sm w-full space-y-2 pointer-events-none">
      {alerts.slice(-3).map((alert) => {
        const isCritical = alert.level === 'Critical';
        const isUnusualNet = alert.level === 'Unusual network activity';

        return (
          <div
            key={alert.id}
            className={`pointer-events-auto p-3 rounded-xl border shadow-xl flex items-start gap-2.5 transition-all animate-in slide-in-from-bottom-2 ${
              isCritical
                ? 'bg-[#3b1218] border-red-500/60 text-white'
                : isUnusualNet
                ? 'bg-[#0e2442] border-blue-500/60 text-white'
                : 'bg-[#3d270e] border-amber-500/60 text-white'
            }`}
          >
            {isCritical ? (
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            ) : isUnusualNet ? (
              <BellRing className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">
                  {alert.level} resource activity
                </span>
                <span className="text-[10px] mono opacity-75">
                  {new Intl.DateTimeFormat(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(alert.timestamp)}
                </span>
              </div>
              <p className="text-[11px] opacity-90 mt-0.5 leading-snug">
                {alert.detail}
              </p>
              {onScanPrompt && (
                <button
                  onClick={onScanPrompt}
                  className="mt-1 text-[10px] mono font-bold text-[#42d7b0] hover:underline"
                >
                  Review in ThreatShield &rarr;
                </button>
              )}
            </div>

            <button
              onClick={() => onDismiss(alert.id)}
              className="opacity-70 hover:opacity-100 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
