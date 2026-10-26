"use client";

import { useEffect, useRef } from "react";

import { normalizeBarcodeInput } from "@/lib/inventory/barcode";

type BarcodeDetectorLike = {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;
type ScannerControls = { stop: () => void };

export function CameraBarcodeScanner({
  active,
  onDetected,
  onError,
  normalizeValue = normalizeBarcodeInput,
}: {
  active: boolean;
  onDetected: (barcode: string) => void;
  onError: (message: string) => void;
  normalizeValue?: (value: string) => string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const foundRef = useRef(false);
  const controlsRef = useRef<ScannerControls | null>(null);

  useEffect(() => {
    if (!active) return;

    let mounted = true;

    const startNativeDetector = () => {
      const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      if (!Detector) return false;

      const detector = new Detector({
        formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e"],
      });

      const scan = async () => {
        if (!mounted || foundRef.current || !videoRef.current || videoRef.current.readyState < 2) {
          frameRef.current = window.requestAnimationFrame(scan);
          return;
        }

        try {
          const results = await detector.detect(videoRef.current);
          const value = normalizeValue(String(results[0]?.rawValue ?? ""));
          if (value) {
            foundRef.current = true;
            onDetected(value);
            return;
          }
        } catch {
          onError("Skanimi deshtoi. Provo perseri ose shkruaje barkodin manualisht.");
          return;
        }

        frameRef.current = window.requestAnimationFrame(scan);
      };

      void navigator.mediaDevices
        .getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        })
        .then((stream) => {
          if (!mounted) return;
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play();
          }
          frameRef.current = window.requestAnimationFrame(scan);
        })
        .catch(() => {
          onError("Kamera nuk u hap. Kontrollo lejet e browser-it.");
        });

      return true;
    };

    const startZxingFallback = async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (!mounted || !videoRef.current) return;

        const reader = new BrowserMultiFormatReader();
        controlsRef.current = await reader.decodeFromConstraints(
          {
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          },
          videoRef.current,
          (result, _error, controls) => {
            if (!mounted || foundRef.current) return;
            const value = normalizeValue(String(result?.getText?.() ?? ""));
            if (value) {
              foundRef.current = true;
              controls.stop();
              controlsRef.current = null;
              onDetected(value);
            }
          },
        );
      } catch {
        onError("Ky browser nuk e mbeshtet skanimin direkt. Shkruaje barkodin manualisht.");
      }
    };

    if (!startNativeDetector()) {
      void startZxingFallback();
    }

    return () => {
      mounted = false;
      foundRef.current = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [active, onDetected, onError, normalizeValue]);

  return <video ref={videoRef} className="aspect-[4/3] w-full rounded-md border bg-black object-cover" muted playsInline />;
}
