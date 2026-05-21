import Link from "next/link";

export default function HomePage() {
  return (
    <main className="launch">
      <section className="launch__panel">
        <p className="eyebrow">CATCHPASS</p>
        <h1>사장님과 체험단이 같은 캠페인 서버를 바라봅니다.</h1>
        <p>
          캠페인 생성, 체험단 신청, 완료 제출, 사장님 확인까지 하나의
          가상 서버에서 동기화됩니다.
        </p>
        <div className="launch__actions">
          <Link className="button button--primary" href="/owner">
            사장님용 열기
          </Link>
          <Link className="button button--secondary" href="/reviewer">
            체험단용 열기
          </Link>
        </div>
      </section>
    </main>
  );
}
