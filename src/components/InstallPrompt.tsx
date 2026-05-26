import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(localStorage.getItem('installDismissed') === '1');

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as { standalone?: boolean }).standalone === true;
    if (!standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      setShowIosHint(true);
    }
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  function dismiss() {
    setDismissed(true);
    localStorage.setItem('installDismissed', '1');
  }

  if (dismissed) return null;

  if (deferred) {
    return (
      <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 mb-4 flex items-center justify-between gap-2">
        <span className="text-sm">📱 홈 화면에 추가하면 앱처럼 쓸 수 있어요</span>
        <div className="flex gap-2">
          <button onClick={async()=>{await deferred.prompt(); setDeferred(null);}} className="text-xs bg-pink-500 text-white px-3 py-1 rounded">설치</button>
          <button onClick={dismiss} className="text-xs text-gray-500">닫기</button>
        </div>
      </div>
    );
  }

  if (showIosHint) {
    return (
      <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 mb-4 text-sm">
        📱 <strong>홈 화면 추가:</strong> 사파리 하단 공유 버튼 <span className="font-mono">⬆️</span> → "홈 화면에 추가"
        <button onClick={dismiss} className="ml-2 text-xs text-gray-500 underline">안 보기</button>
      </div>
    );
  }
  return null;
}
