import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptField, encryptField, isEncrypted } from "./fieldCrypto";

afterEach(() => vi.unstubAllEnvs());

describe("fieldCrypto", () => {
  it("암호화 후 복호화하면 원문이 나와요", () => {
    const plain = "한화생명 신상품 출시 보도자료 — 가입 시간 10분";
    const enc = encryptField(plain);
    expect(enc).not.toBe(plain);
    expect(isEncrypted(enc)).toBe(true);
    expect(decryptField(enc)).toBe(plain);
  });

  it("레거시 평문은 복호화 시 그대로 통과해요 (마이그레이션 불필요)", () => {
    const legacy = "암호화 이전에 저장된 평문 텍스트";
    expect(isEncrypted(legacy)).toBe(false);
    expect(decryptField(legacy)).toBe(legacy);
  });

  it("매 호출마다 다른 IV로 다른 암호문을 만들어요", () => {
    const a = encryptField("같은 내용");
    const b = encryptField("같은 내용");
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe(decryptField(b));
  });

  it("변조된 암호문은 복호화에 실패해요 (GCM 인증)", () => {
    const enc = encryptField("무결성 테스트");
    const tampered = enc.slice(0, -4) + "AAAA";
    expect(() => decryptField(tampered)).toThrow();
  });

  it("빈 문자열도 왕복해요", () => {
    const enc = encryptField("");
    expect(decryptField(enc)).toBe("");
  });

  it("프로덕션에서 키 미설정이면 에러", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DOCUMENT_ENCRYPTION_KEY", "");
    expect(() => encryptField("x")).toThrow(/DOCUMENT_ENCRYPTION_KEY/);
  });
});
