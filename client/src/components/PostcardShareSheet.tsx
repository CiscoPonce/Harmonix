'use client';

import { useEffect, useId, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Loader2,
  Mail,
  MessageCircle,
  Share2,
  X,
} from 'lucide-react';
import {
  canShareFiles,
  canUseNativeShare,
  copyShareText,
  downloadPostcardFile,
  mailtoShareHref,
  shareBody,
  smsShareHref,
  telegramShareHref,
  tryNativeShare,
  whatsappShareHref,
  type PostcardSharePayload,
} from '@/lib/sharePostcard';
import { useTranslation } from '@/lib/i18n';

type Props = {
  open: boolean;
  payload: PostcardSharePayload | null;
  onClose: () => void;
};

export function PostcardShareSheet({ open, payload, onClose }: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const [busy, setBusy] = useState<'native' | 'copy' | 'download' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setBusy(null);
      setToast(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !payload?.file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(payload.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [open, payload?.file]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !payload) return null;

  const body = shareBody(payload);
  const nativeReady = canUseNativeShare();
  const filesReady = canShareFiles(payload.file);
  const hasPng = Boolean(payload.file);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const onNative = async () => {
    setBusy('native');
    try {
      const result = await tryNativeShare(payload);
      if (result === 'shared') {
        flash(filesReady ? 'Shared with image' : 'Shared link');
        onClose();
      } else if (result === 'unsupported') {
        flash('Use Download or Copy below');
      }
    } finally {
      setBusy(null);
    }
  };

  const onCopy = async () => {
    setBusy('copy');
    try {
      await copyShareText(payload);
      flash('Link copied');
    } catch {
      flash('Could not copy');
    } finally {
      setBusy(null);
    }
  };

  const onDownload = () => {
    if (!payload.file) {
      flash('Image not ready');
      return;
    }
    setBusy('download');
    try {
      downloadPostcardFile(payload.file);
      flash('PNG downloaded');
    } finally {
      setBusy(null);
    }
  };

  const openExternal = (href: string) => {
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#0C1210] p-5 shadow-2xl sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              id={titleId}
              className="font-display text-xl font-bold italic text-[#3DCF7A]"
            >
              {t('share_postcard')}
            </p>
            <p className="mt-1 truncate text-sm text-[#9AABA0]">{payload.title}</p>
            <p className="mt-1 text-xs text-[#5C6B62]">
              {hasPng
                ? 'PNG image + link — works with WhatsApp, Messages, Mail, and more'
                : 'Link ready — image still loading; try Download again in a moment'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#9AABA0] hover:bg-white/5 hover:text-white"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Postcard preview"
            className="mb-4 aspect-[1200/630] w-full rounded-xl border border-white/10 object-cover"
          />
        ) : null}

        <div className="grid gap-2">
          {nativeReady ? (
            <button
              type="button"
              onClick={() => void onNative()}
              disabled={busy !== null}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#3DCF7A] px-4 text-sm font-bold text-[#0C1210] hover:bg-[#2FB86A] disabled:opacity-60"
            >
              {busy === 'native' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              {t('share')}
            </button>
          ) : null}

          <button
            type="button"
            onClick={onDownload}
            disabled={!hasPng || busy !== null}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#3DCF7A]/40 bg-[#3DCF7A]/10 px-4 text-sm font-bold text-[#3DCF7A] hover:bg-[#3DCF7A]/20 disabled:opacity-50"
          >
            {busy === 'download' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t('download_png')}
          </button>

          <button
            type="button"
            onClick={() => void onCopy()}
            disabled={busy !== null}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-60"
          >
            {busy === 'copy' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : toast === 'Link copied' ? (
              <Check className="h-4 w-4 text-[#3DCF7A]" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {toast === 'Link copied' ? t('link_copied') : t('copy_link')}
          </button>

          <div className="mt-1 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                if (hasPng && !filesReady) onDownload();
                openExternal(whatsappShareHref(body));
              }}
              className="inline-flex h-11 flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/10 bg-[#128C7E]/20 text-[10px] font-bold uppercase tracking-wider text-[#25D366] hover:bg-[#128C7E]/30"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => {
                if (hasPng && !filesReady) onDownload();
                openExternal(telegramShareHref(payload.shareUrl, payload.caption));
              }}
              className="inline-flex h-11 flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/10 bg-[#229ED9]/15 text-[10px] font-bold uppercase tracking-wider text-[#6EC1E4] hover:bg-[#229ED9]/25"
            >
              <Share2 className="h-4 w-4" />
              Telegram
            </button>
            <a
              href={mailtoShareHref(`${payload.title} · Harmonix`, body)}
              className="inline-flex h-11 flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-wider text-[#9AABA0] hover:bg-white/10"
            >
              <Mail className="h-4 w-4" />
              Email
            </a>
          </div>

          <a
            href={smsShareHref(body)}
            className="inline-flex h-10 items-center justify-center rounded-full text-xs font-bold text-[#7A8A80] underline-offset-4 hover:text-[#3DCF7A] hover:underline sm:hidden"
          >
            Messages / SMS
          </a>
        </div>

        {hasPng && !filesReady ? (
          <p className="mt-3 text-center text-[11px] leading-relaxed text-[#5C6B62]">
            Tip: on desktop, Download PNG then attach it in WhatsApp or Mail. On
            phone, use <span className="text-[#9AABA0]">Share image &amp; link</span>{' '}
            when available.
          </p>
        ) : null}

        {toast ? (
          <p
            role="status"
            className="mt-3 text-center text-xs font-bold text-[#3DCF7A]"
          >
            {toast}
          </p>
        ) : null}
      </div>
    </div>
  );
}
