import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * 문서 본문 필드(추출 텍스트·RAG 청크) 저장 시 암호화해요.
 *
 * 위협 모델(정직하게): DB 파일·백업이 유출됐을 때의 at-rest 보호예요.
 * 앱 서버가 장악되면 키에 접근 가능하므로 방어하지 못해요. 그 경우엔
 * 앱 레벨 접근 제어(팀 스코프·인증)가 방어선이에요.
 *
 * 저장 형식: "enc:v1:" 접두사 + base64url(iv|tag|ciphertext).
 * 접두사가 없으면 레거시 평문으로 간주해 그대로 반환해요(마이그레이션 불필요).
 */
const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const secret = process.env.DOCUMENT_ENCRYPTION_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "DOCUMENT_ENCRYPTION_KEY가 설정되지 않았어요. 프로덕션에서는 문서 암호화 키를 반드시 설정해야 해요.",
      );
    }
    return createHash("sha256").update("messagehouse-dev-document-secret").digest();
  }
  return createHash("sha256").update(secret).digest();
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptField(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64url");
}

/** 암호화된 값이면 복호화하고, 레거시 평문이면 그대로 반환해요. */
export function decryptField(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const buf = Buffer.from(stored.slice(PREFIX.length), "base64url");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const data = buf.subarray(IV_LEN + 16);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
