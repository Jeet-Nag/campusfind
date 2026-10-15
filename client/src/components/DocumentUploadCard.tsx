import { useState, useRef } from 'preact/hooks';
import { DocumentImageState } from '../state/worker';
import { currentLanguage, t } from '../state/language';
import { CheckIcon, AlertCircleIcon, CameraIcon, ImageIcon, RefreshIcon, XIcon } from './icons';

interface DocumentUploadCardProps {
  title: string;
  subtitle?: string;
  imageState: DocumentImageState | null;
  onImageSelected: (state: DocumentImageState) => void;
  onRetake: () => void;
  isPhoto?: boolean;
  required?: boolean;
  hasExisting?: boolean;
}

export function DocumentUploadCard({
  title,
  subtitle,
  imageState,
  onImageSelected,
  onRetake,
  isPhoto = false,
  required = true,
  hasExisting = false,
}: DocumentUploadCardProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(isPhoto ? 'user' : 'environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const lang = currentLanguage.value || 'en';

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCapturedPreview(null);
  };

  const startCamera = async (targetFacing: 'user' | 'environment') => {
    setCameraError(null);
    setCapturedPreview(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      // Fallback: trigger file input directly with capture attribute
      if (fileInputRef.current) {
        fileInputRef.current.setAttribute('capture', targetFacing);
        fileInputRef.current.click();
      }
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: targetFacing },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setFacingMode(targetFacing);
      setCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      const msg = isDenied
        ? (lang === 'hi' ? 'कैमरा अनुमति अस्वीकृत की गई। कृपया गैलरी का उपयोग करें।' : 'Camera permission was denied. Please use gallery.')
        : (lang === 'hi' ? 'कैमरा शुरू नहीं हो सका। कृपया गैलरी का उपयोग करें।' : 'Could not access camera. Please use gallery.');
      setCameraError(msg);
      setCameraActive(false);

      // Fallback: trigger native file picker
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const switchCamera = () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    startCamera(nextFacing);
  };

  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPreview(dataUrl);
  };

  const confirmCapturedFrame = () => {
    if (!capturedPreview) return;
    const commaIdx = capturedPreview.indexOf(',');
    const base64 = commaIdx >= 0 ? capturedPreview.slice(commaIdx + 1) : capturedPreview;
    stopCameraStream();
    onImageSelected({
      base64,
      mime: 'image/jpeg',
      dataUrl: capturedPreview,
    });
  };

  const handleFileChange = (e: Event) => {
    setCameraError(null);
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setCameraError(lang === 'hi' ? 'कृपया एक वैध फोटो चुनें (JPG/PNG)।' : 'Please select a valid image (JPG/PNG).');
      target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Resize & normalize on canvas to ensure valid JPEG magic bytes and low payload
      const img = new Image();
      img.onload = () => {
        let maxDim = 1600;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const commaIdx = dataUrl.indexOf(',');
          const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
          onImageSelected({
            base64,
            mime: 'image/jpeg',
            dataUrl,
          });
        }
      };
      img.onerror = () => {
        setCameraError(lang === 'hi' ? 'अमान्य फोटो फ़ाइल।' : 'Invalid image file.');
      };
      img.src = result;
    };
    reader.onerror = () => {
      setCameraError(lang === 'hi' ? 'फ़ाइल पढ़ने में विफल।' : 'Failed to read file.');
    };
    reader.readAsDataURL(file);
    target.value = '';
  };

  return (
    <div class="bg-surface border border-border rounded-lg p-4 space-y-3">
      {/* Hidden file input for gallery or camera fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        class="hidden"
        aria-hidden="true"
      />

      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-text-main flex items-center space-x-1.5">
            <span>{title}</span>
            {required && <span class="text-danger">*</span>}
          </h3>
          {subtitle && <p class="text-xs text-text-sub mt-0.5">{subtitle}</p>}
        </div>

        {imageState ? (
          <span class="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-green-100 text-action-active text-xs font-bold border border-green-200">
            <CheckIcon size={14} class="text-action" />
            <span>{lang === 'hi' ? 'तैयार' : 'Ready'}</span>
          </span>
        ) : hasExisting ? (
          <span class="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-50 text-brand text-xs font-bold border border-blue-200">
            <CheckIcon size={14} class="text-brand" />
            <span>{t('onboarding.doc_on_file')}</span>
          </span>
        ) : null}
      </div>

      {cameraError && (
        <div class="p-2.5 rounded bg-red-50 border border-red-200 text-danger text-xs flex items-start space-x-2">
          <AlertCircleIcon size={16} class="mt-0.5 shrink-0" />
          <span class="leading-tight">{cameraError}</span>
        </div>
      )}

      {/* State A: Selected Preview */}
      {imageState ? (
        <div class="space-y-3">
          <div class="relative rounded-lg overflow-hidden border-2 border-action bg-slate-50 flex items-center justify-center max-h-56">
            <img
              src={imageState.dataUrl}
              alt={title}
              class="w-full h-auto max-h-56 object-contain"
            />
          </div>

          <div class="flex items-center space-x-2">
            <button
              type="button"
              onClick={onRetake}
              class="w-full min-h-[48px] px-4 py-2.5 border-2 border-border hover:border-brand text-text-main font-bold rounded-lg text-sm transition-colors flex items-center justify-center space-x-2 bg-white"
            >
              <RefreshIcon size={18} />
              <span>{t('onboarding.btn_retake')}</span>
            </button>
          </div>
        </div>
      ) : (
        /* State B: No Image Selected Yet -> Action Buttons */
        <div class="space-y-2">
          {hasExisting && (
            <div class="p-2.5 rounded bg-blue-50/70 border border-blue-200 text-text-sub text-xs flex items-center justify-between">
              <span class="font-medium text-brand">{t('onboarding.doc_on_file')}</span>
              <span class="text-[11px] text-text-sub">{t('onboarding.doc_replace_hint')}</span>
            </div>
          )}
          <div class="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => startCamera(isPhoto ? 'user' : 'environment')}
              class="min-h-[48px] px-3 py-2.5 border-2 border-brand text-brand hover:bg-brand/5 active:bg-brand/10 font-bold rounded-lg text-sm transition-colors flex items-center justify-center space-x-2 bg-white"
            >
              <CameraIcon size={20} />
              <span>{isPhoto ? t('onboarding.btn_take_photo') : t('onboarding.btn_camera')}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              class="min-h-[48px] px-3 py-2.5 border-2 border-border hover:border-text-main active:bg-slate-100 text-text-main font-bold rounded-lg text-sm transition-colors flex items-center justify-center space-x-2 bg-white"
            >
              <ImageIcon size={20} />
              <span>{isPhoto ? t('onboarding.btn_choose_gallery') : t('onboarding.btn_gallery')}</span>
            </button>
          </div>
        </div>
      )}

      {/* In-App Camera Modal Dialog */}
      {cameraActive && (
        <div class="fixed inset-0 z-50 bg-black/90 flex flex-col justify-between p-4" role="dialog" aria-modal="true">
          <div class="flex items-center justify-between text-white">
            <h4 class="text-base font-bold">{title}</h4>
            <button
              type="button"
              onClick={stopCameraStream}
              class="p-2 min-h-[48px] min-w-[48px] text-white hover:text-slate-300 rounded flex items-center justify-center"
              aria-label="Close camera"
            >
              <XIcon size={24} />
            </button>
          </div>

          <div class="my-auto flex flex-col items-center justify-center relative w-full max-w-md mx-auto">
            {capturedPreview ? (
              <img
                src={capturedPreview}
                alt="Captured preview"
                class="w-full max-h-[60vh] object-contain rounded-lg border-2 border-white"
              />
            ) : (
              <video
                ref={videoRef}
                autoplay
                playsinline
                muted
                class="w-full max-h-[60vh] object-cover rounded-lg border-2 border-white/40 bg-black"
              />
            )}
          </div>

          <div class="max-w-md mx-auto w-full space-y-3 pb-2">
            {capturedPreview ? (
              <div class="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCapturedPreview(null)}
                  class="min-h-[48px] px-4 py-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-lg text-sm flex items-center justify-center space-x-2"
                >
                  <RefreshIcon size={18} />
                  <span>{t('onboarding.btn_retake')}</span>
                </button>

                <button
                  type="button"
                  onClick={confirmCapturedFrame}
                  class="min-h-[48px] px-4 py-3 bg-action hover:bg-action-active text-white font-bold rounded-lg text-sm flex items-center justify-center space-x-2"
                >
                  <CheckIcon size={18} />
                  <span>{t('onboarding.btn_confirm_photo')}</span>
                </button>
              </div>
            ) : (
              <div class="flex items-center justify-between space-x-2">
                {isPhoto && (
                  <button
                    type="button"
                    onClick={switchCamera}
                    class="min-h-[48px] px-3 py-2 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-lg text-xs flex items-center justify-center space-x-1.5"
                  >
                    <RefreshIcon size={16} />
                    <span>{t('onboarding.btn_switch_camera')}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={captureFrame}
                  class="flex-1 min-h-[48px] px-6 py-3 bg-action hover:bg-action-active text-white font-bold rounded-lg text-base flex items-center justify-center space-x-2"
                >
                  <CameraIcon size={22} />
                  <span>{t('onboarding.btn_take_photo')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
