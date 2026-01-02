# 📁 CHZZK Auction System - Full Stack Development Specification

## 1. Project Overview
* **Project Name:** CHZZK Overwatch Auction System
* **Description:** 오버워치 내전/대회를 위한 치지직(Chzzk) 테마의 실시간 드래프트 경매 시스템.
* **Core Value:** 웹소켓(Socket.io)을 활용한 지연 없는 실시간 입찰 및 데이터 동기화.
* **Target Users:**
    * **Host (Streamer):** 경매 진행, 매물 관리, 시간 조절, 강제 낙찰/유찰, 포인트 관리.
    * **User (Captain):** 팀 생성, 대기, 실시간 입찰, 로스터 확인.

## 2. Tech Stack Recommendations
* **Frontend:**
    * Framework: React (Vite based)
    * Language: TypeScript
    * Styling: Styled-components or Tailwind CSS (Dark Mode/Neon Theme 필수)
    * State Management: Zustand or Recoil (Global State), React-Query (Data Fetching)
* **Backend:**
    * Runtime: Node.js
    * Framework: Express.js
    * Communication: Socket.io (Real-time Bidirectional)
* **Database (Optional for MVP):**
    * In-Memory (Variables) or Redis (Recommended for performance)
    * Simple JSON File Storage (Persistence)

---

## 3. UI/UX Flow

### 🅰️ Streamer (Host) Flow
1.  **Login (`/login`)**
    * 접근: 관리자 비밀번호 입력.
    * 액션: 인증 성공 시 Setup 페이지로 리다이렉트.
2.  **Setup (`/setup`)**
    * **Left Panel:**
        * 선수 등록 (수동: 이름/티어 입력, 자동: 디스코드 로그 파싱).
        * 게임 설정 (진행 방식: 순차/랜덤).
        * 초대 링크 생성 및 복사.
    * **Right Panel (Split View):**
        * Top: 등록된 선수 리스트 (삭제 가능).
        * Bottom: 접속한 팀장 리스트 (실시간 갱신, **초기 포인트 수정 가능**).
    * 액션: `START AUCTION` 클릭 시 게임 초기화 및 Streamer View로 이동.
3.  **Streamer View (`/streamer`)**
    * **Main Stage:** 현재 경매 대상 선수 표시.
    * **Controls:** 타이머 제어 (Start/Pause/Reset), 강제 낙찰(Sold), 유찰(Pass).
    * **Team List:** 모든 팀의 상태 확인 및 **포인트 강제 수정(Penalty/Bonus)**.

### 🅱️ Captain (User) Flow
1.  **Entry (`/join/:inviteCode`)**
    * 접근: 초대 링크를 통해 접속.
    * 입력: 팀명, 팀장 닉네임, 포지션별(T/D/H) 본인 티어.
    * 액션: 유효성 검사 후 Waiting Room 이동.
2.  **Waiting Room (`/waiting`)**
    * 상태: "HOST 대기 중" 애니메이션 표시.
    * 정보: 내 초기 포인트, 전체 경매 명단(Read-only) 확인.
    * 트리거: Host가 `START`하면 자동으로 Auction View로 전환.
3.  **Captain View (`/captain`)**
    * **Main Stage:** 현재 매물, 현재 최고 입찰가 확인.
    * **Bidding:** `+10`, `+50` 버튼으로 입찰 예정 금액 설정 -> `BID` 버튼으로 전송.
    * **Roster:** 본인 팀 및 타 팀 카드 Hover 시 상세 로스터(Expand View) 확인.

---

## 4. Functional Specifications

### 4.1. Common Features
* **Theme:** 배경 `#090909`, 포인트 `#00FFA3`, 폰트 `Pretendard`, 숫자 폰트 `Roboto Mono`.
* **Socket Sync:** 모든 클라이언트는 경매 상태(Current Bid, Timer, History)를 100ms 이내로 동기화.
* **Hover Expand:** 팀 카드 마우스 오버 시 높이가 확장되며 상세 로스터(이름, 티어) 표시.

### 4.2. Page-Specific Features

| Page | Feature | Detail |
| :--- | :--- | :--- |
| **Login** | Admin Auth | 환경변수(`ADMIN_PW`)와 대조하여 인증 토큰 발급. |
| **Setup** | Parse Log | 텍스트(디스코드 로그)를 정규식으로 파싱하여 `{name, t, d, s}` 배열로 변환. |
| **Setup** | Live Team List | 팀장이 `join` 할 때마다 리스트 즉시 갱신. 호스트가 여기서 포인트 수정 시 팀장 화면에도 반영. |
| **Streamer** | Timer Control | 소켓으로 `pause`, `resume`, `reset` 신호 브로드캐스팅. |
| **Streamer** | Admin Actions | `Force Sold`: 현재 입찰가로 즉시 낙찰. `Force Pass`: 유찰 목록으로 이동. |
| **Captain** | Pending Bid | 입찰 버튼 클릭 시 즉시 전송하지 않고, `Local State`에 더할 금액을 저장 후 `BID` 버튼으로 최종 전송. |
| **Captain** | Validation | 잔여 포인트보다 높은 입찰 시도 시 버튼 비활성화 또는 에러 토스트. |

---

## 5. Data Schema (TypeScript Interfaces)

### A. Player (매물)
```typescript
interface Player {
  id: string;          // UUID
  name: string;
  tiers: {
    tank: string;
    dps: string;
    supp: string;
  };
  status: 'waiting' | 'bidding' | 'sold' | 'unsold';
  soldToTeamId?: string | null;
  soldPrice?: number;
}
```
### B. Team (참가자)
```ts
interface Team {
  id: string;          // Socket ID or UUID
  name: string;        // 팀명
  captainName: string; // 팀장명
  points: number;      // 잔여 포인트
  roster: Player[];    // 영입한 선수 목록
  captainStats: {      // 팀장 본인 티어
    tank: string;
    dps: string;
    supp: string;
  };
}
```

### C. GameState (서버 상태)
```ts
interface GameState {
  phase: 'SETUP' | 'WAITING' | 'AUCTION' | 'ENDED';
  currentPlayer: Player | null; // 현재 경매 중인 선수
  currentBid: number;           // 현재 입찰가
  highBidder: string | null;    // 현재 최고 입찰 팀 ID
  timerValue: number;           // 남은 시간 (초)
  isTimerRunning: boolean;
  bidHistory: string[];         // 로그용 ("Team A bid 200")
}
```

## 6. Socket.io Event Specification

### 📤 Client Emits (클라이언트 -> 서버)
```
Event Name,Payload,Sender,Description
join_lobby,"{ teamName, captain, tiers }",Captain,대기실 입장 요청.
start_game,"{ playerList, orderType }",Streamer,게임 시작. Player 순서 셔플 후 상태 변경.
bid,{ amount },Captain,입찰 요청. (Server: 유효성 검사 후 브로드캐스트)
admin_timer,`{ action: 'start','pause','reset' }`
admin_decision,`{ action: 'sold','pass' }`,Streamer
update_points,"{ teamId, points }",Streamer,특정 팀 포인트 강제 변경.
```

### 📥 Server Emits (서버 -> 클라이언트)
```
Event Name,Payload,Target,Description
lobby_update,"{ teams, players }",All,대기실 인원 및 선수 명단 동기화.
game_started,-,All,화면 라우팅을 /captain으로 변경 트리거.
new_round,"{ player, endTime }",All,새로운 선수 경매 시작.
bid_update,"{ currentBid, highBidder, log }",All,입찰 발생 시 가격 및 최고 입찰자 갱신.
timer_sync,"{ timeLeft, isRunning }",All,타이머 동기화 (1초 주기 or 상태 변경 시).
round_end,`{ result: 'sold',"'pass', player, ... }`",All
point_change,"{ teamId, newPoints }",All,포인트 변경 알림 (팀장 UI 반영).
```

## 7. React Component Structure (Suggested)

```
src/
├── components/
│   ├── common/            # Buttons, Inputs, Cards (Styled-components)
│   ├── auction/           # AuctionStage, BidControls, TimerDisplay
│   ├── team/              # TeamCard (with Expand logic), RosterGrid
│   └── admin/             # PlayerForm, ControlPanel
├── pages/
│   ├── Login.tsx
│   ├── Setup.tsx          # Split View implementation
│   ├── Join.tsx
│   ├── Waiting.tsx
│   ├── StreamerMode.tsx
│   └── CaptainMode.tsx
├── hooks/
│   ├── useSocket.ts       # Socket.io connection & event listeners
│   └── useAuctionStore.ts # Zustand store for GameState
└── types/
    └── index.ts           # Schema interfaces
```