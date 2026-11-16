'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Download, Share2, PlusSquare, X, CheckCircle, Smartphone } from 'lucide-react';

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if already installed as standalone PWA
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    setIsStandalone(isStandaloneMode);

    if (isStandaloneMode) {
      return;
    }

    // 2. Check iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isIosDevice);

    // 3. Check if user already dismissed recently
    const dismissedTime = localStorage.getItem('innoica_pwa_prompt_dismissed_at');
    const isDismissedRecently =
      dismissedTime && Date.now() - parseInt(dismissedTime, 10) < 1000 * 60 * 60 * 24 * 7; // 7 days

    // 4. Capture native beforeinstallprompt (Android / Chrome / Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isDismissedRecently) {
        setIsOpen(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. If iOS and not dismissed recently, show iOS install guide
    if (isIosDevice && !isDismissedRecently) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2500);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
      setTimeout(() => {
        setIsOpen(false);
      }, 1500);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem('innoica_pwa_prompt_dismissed_at', Date.now().toString());
    setIsOpen(false);
  };

  if (isStandalone || !isOpen) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full mx-auto p-4 sm:p-5 bg-zinc-950 text-white rounded-2xl border border-zinc-800 shadow-2xl animate-fade-in-up">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 rounded-xl overflow-hidden ring-1 ring-zinc-700 bg-black">
            <Image
              src="/images/innoica-logo.jpg"
              alt="INNOICA"
              fill
              className="object-cover"
            />
          </div>
          <div>
            <h4 className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
              <span>Installer INNOICA</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                PWA
              </span>
            </h4>
            <p className="text-xs text-zinc-400">Application mobile & bureau</p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          type="button"
          className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {installed ? (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-medium">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Application installée avec succès !</span>
        </div>
      ) : isIOS ? (
        <div className="space-y-3 pt-1">
          <p className="text-xs text-zinc-300 leading-relaxed">
            Pour installer l'application sur votre <strong>iPhone / iPad</strong> :
          </p>
          <ol className="space-y-2 text-xs text-zinc-300 bg-zinc-900/90 p-3 rounded-xl border border-zinc-800/80">
            <li className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-zinc-800 text-zinc-200 flex items-center justify-center font-mono text-[10px] shrink-0">
                1
              </span>
              <span>
                Touchez le bouton <strong className="text-white">Partager</strong>{' '}
                <Share2 className="inline h-3.5 w-3.5 text-blue-400 align-text-bottom mx-0.5" /> dans Safari.
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-zinc-800 text-zinc-200 flex items-center justify-center font-mono text-[10px] shrink-0">
                2
              </span>
              <span>
                Sélectionnez <strong className="text-white">Sur l'écran d'accueil</strong>{' '}
                <PlusSquare className="inline h-3.5 w-3.5 text-emerald-400 align-text-bottom mx-0.5" />.
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-zinc-800 text-zinc-200 flex items-center justify-center font-mono text-[10px] shrink-0">
                3
              </span>
              <span>
                Touchez <strong className="text-white">Ajouter</strong> en haut à droite.
              </span>
            </li>
          </ol>
          <div className="flex justify-end pt-1">
            <button
              onClick={handleDismiss}
              type="button"
              className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 font-medium transition-colors cursor-pointer"
            >
              J'ai compris
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          <p className="text-xs text-zinc-300 leading-relaxed">
            Ajoutez INNOICA à votre écran d'accueil pour un accès ultra-rapide, le mode plein écran et les notifications en direct.
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={handleDismiss}
              type="button"
              className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 font-medium transition-colors cursor-pointer"
            >
              Plus tard
            </button>
            <button
              onClick={handleInstallClick}
              type="button"
              className="inline-flex items-center gap-1.5 bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Installer l'App</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
