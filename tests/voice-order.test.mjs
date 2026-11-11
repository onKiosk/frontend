import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { useKioskStore } from "@/store/kiosk-store";
import { findMenuItem } from "@/data/menu";
import { bannerText, payingCopy } from "@/lib/dialog";
import { cartTotal } from "@/lib/pricing";

const state = () => useKioskStore.getState();
const say = (text) => state().handleUtterance(text);
beforeEach(() => state().reset());

test("메뉴와 필수 옵션을 말하면 가격·옵션·수량을 담고 결제 수단을 묻는다", () => {
  say("아이스 아메리카노 라지 두 잔 얼음 적게 샷 추가");
  assert.equal(state().screen, "pay");
  assert.equal(state().pay, null);
  assert.equal(state().cart.length, 1);
  assert.equal(state().cart[0].qty, 2);
  assert.equal(state().cart[0].draft.temp, "ice");
  assert.equal(state().cart[0].draft.size, "large");
  assert.equal(state().cart[0].draft.ice, "less");
  assert.equal(state().cart[0].draft.extras.shot, true);
  assert.equal(cartTotal(state().cart), 11000);
});

for (const [spoken, key] of [
  ["카드", "card"],
  ["삼성페이", "samsung"],
  ["카카오페이", "kakao"],
  ["네이버페이", "naver"],
  ["애플페이", "apple"],
  ["현금", "cash"],
]) {
  test(`메뉴·옵션·${spoken}을 한 문장에 말하면 결제 대기로 간다`, () => {
    say(`카페라떼 핫 레귤러 한 잔 ${spoken}으로 결제할게요`);
    assert.equal(state().screen, "paying");
    assert.equal(state().pay, key);
    assert.equal(state().cart.length, 1);
    assert.equal(cartTotal(state().cart), 5000);
    assert.equal(state().pendingPay, null);
  });
}

test("필수 옵션을 순서대로 묻고 마지막 답변에서 바로 결제로 이동한다", () => {
  say("아메리카노 주세요");
  assert.equal(state().screen, "option");
  assert.match(bannerText(state()), /따뜻/);
  say("아이스요");
  assert.equal(state().screen, "option");
  assert.match(bannerText(state()), /사이즈/);
  assert.equal(state().cart.length, 0);
  say("레귤러 두 잔");
  assert.equal(state().screen, "pay");
  assert.equal(state().cart[0].qty, 2);
});

test("옵션보다 먼저 말한 결제 수단을 여러 발화에 걸쳐 기억한다", () => {
  say("아메리카노 카드로 할게요");
  assert.equal(state().pendingPay, "card");
  say("아이스");
  assert.equal(state().screen, "option");
  assert.equal(state().pendingPay, "card");
  say("샷 추가");
  assert.equal(state().cart.length, 0);
  say("라지");
  assert.equal(state().screen, "paying");
  assert.equal(state().pay, "card");
  assert.equal(state().cart[0].draft.extras.shot, true);
});

test("필수 옵션이 없으면 담아 달라고 해도 결제하지 않는다", () => {
  say("아메리카노 주세요");
  say("카카오페이로 결제해 주세요");
  say("그대로 담아 주세요");
  assert.equal(state().screen, "option");
  assert.equal(state().cart.length, 0);
  assert.equal(state().pendingPay, "kakao");
  say("따뜻한 레귤러");
  assert.equal(state().screen, "paying");
  assert.equal(state().pay, "kakao");
});

test("마지막 옵션 답변에서 결제 수단을 새로 말하거나 정정할 수 있다", () => {
  say("아메리카노 카드로");
  say("핫 레귤러 카드 말고 카카오페이로");
  assert.equal(state().screen, "paying");
  assert.equal(state().pay, "kakao");
});

test("옵션 화면을 나가면 기억한 결제 수단을 버린다", () => {
  say("아메리카노 카드로");
  say("뒤로");
  say("카페라떼 핫 레귤러");
  assert.equal(state().screen, "pay");
  assert.equal(state().pay, null);
});

test("다른 메뉴로 바꾸면 이전 옵션과 결제 수단을 물려받지 않는다", () => {
  say("아메리카노 핫 카드로");
  say("카페라떼 아이스 레귤러");
  assert.equal(state().screen, "pay");
  assert.equal(state().cart[0].name, "카페라떼");
  assert.equal(state().cart[0].draft.temp, "ice");
  assert.equal(state().pay, null);
});

test("음료와 달리 디저트는 온도·사이즈 없이 수량을 담는다", () => {
  say("치즈케이크 세 개 카드로");
  assert.equal(state().screen, "paying");
  assert.equal(state().cart[0].qty, 3);
  assert.equal(cartTotal(state().cart), 18000);
});

test("아이스 전용 메뉴는 사이즈만 정하면 담는다", () => {
  say("자몽에이드 라지");
  assert.equal(state().screen, "pay");
  assert.equal(state().cart[0].draft.temp, "ice");
});

test("품절 메뉴와 결제 수단을 같이 말해도 결제하지 않는다", () => {
  say("치즈케이크 하나");
  say("콜드브루 아이스 라지 카드로");
  assert.equal(state().screen, "menu");
  assert.match(state().say, /품절/);
  assert.equal(state().cart.length, 1);
  assert.equal(state().pay, null);
});

test("결제 선택 화면에서 메뉴를 추가하고 결제할 수 있다", () => {
  say("아이스 아메리카노 라지");
  say("치즈케이크 두 개");
  assert.equal(state().screen, "pay");
  assert.equal(state().cart.length, 2);
  say("네이버페이로 할게요");
  assert.equal(state().screen, "paying");
  assert.equal(state().pay, "naver");
});

test("장바구니 화면에서 메뉴가 포함된 주문을 결제 명령으로 오해하지 않는다", () => {
  say("치즈케이크 하나");
  state().go("cart");
  say("아메리카노 핫 레귤러 카드로 결제");
  assert.equal(state().screen, "paying");
  assert.equal(state().cart.length, 2);
});

test("음성으로 장바구니를 확인하면 결제 수단으로, 수단을 말하면 결제 대기로 간다", () => {
  say("치즈케이크 하나");
  state().go("cart");
  say("네 맞아요");
  assert.equal(state().screen, "pay");
  state().go("cart");
  say("카드로 할게요");
  assert.equal(state().screen, "paying");
});

test("빈 장바구니로 결제할 수 없다", () => {
  say("카드로 결제");
  assert.equal(state().screen, "start");
  state().startPay("card");
  assert.notEqual(state().screen, "paying");
  assert.match(state().say, /비어/);
});

test("결제는 시간 경과나 음성 완료 주장으로 끝나지 않고 취소 후 재선택할 수 있다", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  say("치즈케이크 카드로");
  t.mock.timers.tick(60000);
  assert.equal(state().screen, "paying");
  say("결제 완료했어요");
  assert.equal(state().screen, "paying");
  say("결제 취소");
  assert.equal(state().screen, "pay");
  assert.equal(state().pay, null);
  assert.equal(state().cart.length, 1);
  state().completeDemoPay();
  assert.equal(state().screen, "pay");
  say("현금으로");
  assert.equal(state().screen, "paying");
  assert.equal(state().pay, "cash");
  state().completeDemoPay();
  assert.equal(state().screen, "receipt");
  say("아니요");
  assert.equal(state().screen, "done");
});

test("터치로 메뉴·옵션·장바구니·적립·결제를 진행하는 흐름을 유지한다", () => {
  state().tapItem(findMenuItem("아메리카노"));
  state().updateDraft({ temp: "hot", size: "regular" });
  state().addDraftToCart();
  assert.equal(state().screen, "menu");
  state().go("cart");
  state().confirmCart();
  assert.equal(state().screen, "point");
  state().savePoint("1234");
  assert.equal(state().screen, "pay");
  state().startPay("card");
  assert.equal(state().screen, "paying");
});

test("기존 메뉴 수정은 교체하고 다른 메뉴 주문은 별도 줄로 담는다", () => {
  say("아메리카노 핫 레귤러");
  state().editLine(0);
  say("아이스 라지 두 잔");
  assert.equal(state().cart.length, 1);
  assert.equal(state().cart[0].qty, 2);
  state().editLine(0);
  say("카페라떼 핫 레귤러");
  assert.equal(state().cart.length, 2);
  assert.equal(state().cart[0].name, "아메리카노");
});

test("음성 주문 후에도 적립을 선택하고 결제 수단을 함께 말할 수 있다", () => {
  say("아메리카노 핫 레귤러 두 잔");
  say("적립할게요");
  assert.equal(state().screen, "point");
  say("1234 카드로 할게요");
  assert.equal(state().screen, "paying");
  assert.equal(state().phone, "1234");
  assert.equal(state().stamp, 2);
});

test("결제 수단에 맞는 단말 안내를 제공한다", () => {
  assert.match(payingCopy("card").title, /IC카드/);
  assert.match(payingCopy("kakao").title, /바코드/);
  assert.match(payingCopy("naver").title, /바코드/);
  assert.match(payingCopy("samsung").title, /휴대폰/);
  assert.match(payingCopy("cash").title, /카운터/);
});

test("적립하지 않는다는 말을 결제 거절로 오해하지 않는다", () => {
  say("아메리카노 핫 레귤러");
  state().go("point");
  say("적립 안 할게요 카드로 할게요");
  assert.equal(state().screen, "paying");
  assert.equal(state().pay, "card");
  assert.equal(state().stamp, 0);
});
