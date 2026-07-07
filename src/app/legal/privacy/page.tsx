export const metadata = { title: "개인정보처리방침 | CATCHPASS" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[16px] font-bold text-ink">{title}</h2>
      <div className="mt-3 text-[14px] leading-[1.65] text-ink2 space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <article>
      <h1 className="text-[20px] font-bold text-ink tracking-title">개인정보처리방침</h1>
      <p className="mt-2 text-[13px] text-muted">시행일: 2026년 7월 1일 (VER.1)</p>
      <p className="mt-4 text-[14px] leading-[1.65] text-ink2">
        캐치랭크(이하 &ldquo;회사&rdquo;)는 캐치패스 서비스 제공을 위해 아래와 같이 개인정보를 수집·이용하며,
        개인정보보호법 등 관련 법령을 준수합니다.
      </p>

      <Section title="1. 수집하는 개인정보 항목">
        <p>
          <strong className="text-ink">체험자 (필수)</strong>: 이메일, 비밀번호(단방향 암호화 저장), 닉네임
        </p>
        <p>
          <strong className="text-ink">체험자 (선택)</strong>: SNS 채널 주소(네이버 블로그/인스타그램/틱톡)와
          채널 영향력 수치 — 등급 산정 목적으로만 사용
        </p>
        <p>
          <strong className="text-ink">사장님 (필수)</strong>: 이메일, 비밀번호(단방향 암호화 저장), 매장명, 업종, 지역
        </p>
        <p>
          <strong className="text-ink">자동 수집</strong>: 서비스 이용 기록(체험권 발급·사용·리뷰 제출 내역, 알림 수신 내역)
        </p>
      </Section>

      <Section title="2. 수집·이용 목적">
        <p>회원 식별 및 서비스 제공(체험권 발급·사용 처리·리뷰 검수), 채널 영향력 기반 등급 산정,
        캠페인 운영(사장님에게 참여 체험자의 닉네임·등급·리뷰 URL 제공), 고객 문의 대응, 부정 이용 방지.</p>
      </Section>

      <Section title="3. 보유 및 이용 기간">
        <p>회원 탈퇴 시 지체 없이 파기합니다. 다만 다음의 정보는 관련 법령에 따라 명시된 기간 동안 보존합니다.</p>
        <p>· 체험권 사용(거래) 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</p>
        <p>· 소비자 불만 또는 분쟁 처리 기록: 3년 (동법)</p>
        <p>· 보존되는 기록은 탈퇴 즉시 계정 정보(이메일·닉네임·SNS 주소)와 분리되어 개인을 식별할 수 없는 형태로 관리됩니다.</p>
      </Section>

      <Section title="4. 제3자 제공">
        <p>회사는 원칙적으로 개인정보를 제3자에게 제공하지 않습니다. 다만 서비스 구조상 다음 정보가 상대 회원에게 표시됩니다.</p>
        <p>· 캠페인에 참여한 체험자의 닉네임·채널 등급·리뷰 URL → 해당 캠페인의 사장님</p>
        <p>· 매장명·업종·지역·캠페인 정보 → 체험자</p>
      </Section>

      <Section title="5. 처리 위탁">
        <p>서비스 운영을 위해 클라우드 인프라(호스팅·데이터 저장) 사업자에게 개인정보 처리를 위탁할 수 있으며,
        위탁 시 관련 법령에 따라 안전하게 관리되도록 필요한 사항을 규정합니다.</p>
      </Section>

      <Section title="6. 파기 절차 및 방법">
        <p>보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 전자적 파일 형태의 경우 복구할 수 없는 방법으로 즉시 삭제합니다.
        회원 탈퇴는 서비스 내 MY &gt; 회원 탈퇴에서 직접 처리할 수 있습니다.</p>
      </Section>

      <Section title="7. 정보주체의 권리">
        <p>회원은 언제든지 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요구할 수 있습니다.
        서비스 내 기능 또는 고객센터(help@catchrank.co.kr)를 통해 요청하실 수 있으며, 회사는 지체 없이 조치합니다.</p>
      </Section>

      <Section title="8. 안전성 확보 조치">
        <p>비밀번호 단방향 암호화(bcrypt), 세션 토큰의 httpOnly·secure 쿠키 저장, 역할 기반 접근 통제(체험자/사장님/운영팀 분리)를
        적용하고 있습니다.</p>
      </Section>

      <Section title="9. 개인정보 보호책임자">
        <p>캐치랭크 개인정보 보호책임자 · help@catchrank.co.kr</p>
        <p>개인정보 침해에 대한 신고·상담은 개인정보침해신고센터(privacy.kisa.or.kr, 국번없이 118)에 문의하실 수 있습니다.</p>
      </Section>

      <Section title="10. 고지 의무">
        <p>이 방침의 내용 추가·삭제·수정이 있을 경우 시행 7일 전부터 서비스 내 공지를 통해 알립니다.</p>
      </Section>

      <p className="mt-12 text-[12px] text-muted leading-[1.6]">
        부칙: 이 방침은 2026년 7월 1일부터 시행합니다.<br />
        캐치랭크 · help@catchrank.co.kr
      </p>
    </article>
  );
}
