"use client";
import { useCallback } from "react";
import Icon from "@/components/Icon";

interface Props {
  storeName: string;
  lat?: number;
  lng?: number;
  naverPlaceId?: string;
  address?: string;
}

// 모바일 디바이스 감지
function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

// 네이버 지도 길찾기 deep link.
// 우선순위:
//  1) 좌표(lat/lng) 있으면 nmap://route/public — 도착지 자동 입력된 길찾기 화면
//  2) placeId 있으면 nmap://place — 장소 페이지 (사용자가 거기서 길찾기 탭)
//  3) 위 둘 다 없으면 매장명 검색
// 모바일에서 앱 미설치 시 800ms 후 웹 지도(map.naver.com)로 폴백.
function buildLinks({ storeName, lat, lng, naverPlaceId }: Props) {
  const APP = "com.catchrank.catchpass";
  const name = encodeURIComponent(storeName);

  let appUrl: string;
  let webUrl: string;

  if (lat != null && lng != null) {
    // 도보 기준 길찾기 (도착지 자동 채워짐 + 출발지는 사용자 현위치)
    appUrl = `nmap://route/walk?dlat=${lat}&dlng=${lng}&dname=${name}&appname=${APP}`;
    webUrl = `https://map.naver.com/p/directions/-/${lng},${lat},${name},,/-/walk`;
  } else if (naverPlaceId) {
    appUrl = `nmap://place?id=${naverPlaceId}&appname=${APP}`;
    webUrl = `https://m.place.naver.com/place/${naverPlaceId}`;
  } else {
    appUrl = `nmap://search?query=${name}&appname=${APP}`;
    webUrl = `https://map.naver.com/p/search/${storeName}`;
  }

  return { appUrl, webUrl };
}

export default function NaverMapButton(props: Props) {
  const onClick = useCallback(() => {
    const { appUrl, webUrl } = buildLinks(props);
    if (isMobile()) {
      // 앱 호출 시도
      const start = Date.now();
      window.location.href = appUrl;
      // 800ms 내 페이지 가시성 변화 없으면 앱 미설치로 간주, 웹으로 폴백
      setTimeout(() => {
        if (Date.now() - start < 1600 && document.visibilityState === "visible") {
          window.location.href = webUrl;
        }
      }, 800);
    } else {
      // 데스크탑은 웹 지도 새 탭
      window.open(webUrl, "_blank", "noopener,noreferrer");
    }
  }, [props]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${props.storeName} 길찾기`}
      className="cp-action group flex items-center gap-2 h-12 pl-3.5 pr-4 rounded-pill bg-canvas border border-hairline shadow-product text-ink"
    >
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand text-white">
        <Icon name="navigation" variant="bold" size={14} className="-rotate-12" />
      </span>
      <span className="text-[14px] font-semibold">길찾기</span>
    </button>
  );
}
