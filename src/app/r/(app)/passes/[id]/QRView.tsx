"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QRView({ code }: { code: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(code, { width: 240, margin: 1, errorCorrectionLevel: "M" }).then(setSrc);
  }, [code]);
  if (!src) return <div className="w-[240px] h-[240px] bg-surfaceSoft animate-pulse rounded-md" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="QR" width={240} height={240} className="rounded-md" />;
}
