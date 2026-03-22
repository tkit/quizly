export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-5 px-6 py-12 text-center">
      <h1 className="text-3xl font-black text-zinc-900">オフラインです</h1>
      <p className="text-base font-bold leading-relaxed text-zinc-700 sm:text-lg">
        ネットワーク接続を確認して、もう一度お試しください。
      </p>
      <p className="text-sm text-zinc-500">接続が戻ると自動で通常の画面に戻れます。</p>
    </main>
  );
}
