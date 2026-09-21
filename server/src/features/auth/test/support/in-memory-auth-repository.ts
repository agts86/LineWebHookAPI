import type {
	AuthRepository,
	NewRefreshToken,
	StoredRefreshToken,
} from "../../src/auth.repository.js";

/** テスト用のインメモリAuthRepository実装。auth.service.test.tsとauth.controller.test.tsで共有する */
export class InMemoryAuthRepository implements AuthRepository {
	private tokens = new Map<string, StoredRefreshToken>();
	private idSeq = 0;

	async findByTokenHash(tokenHash: string): Promise<StoredRefreshToken | null> {
		for (const token of this.tokens.values()) {
			if (token.tokenHash === tokenHash) return token;
		}
		return null;
	}

	async replaceUserTokens(userName: string, newToken: NewRefreshToken): Promise<void> {
		for (const [id, token] of this.tokens) {
			if (token.userName === userName) this.tokens.delete(id);
		}
		this.insert(newToken);
	}

	async rotateToken(oldId: string, newToken: NewRefreshToken): Promise<void> {
		this.tokens.delete(oldId);
		this.insert(newToken);
	}

	async revoke(id: string): Promise<void> {
		this.tokens.delete(id);
	}

	size(): number {
		return this.tokens.size;
	}

	private insert(newToken: NewRefreshToken): void {
		const id = String(this.idSeq++);
		this.tokens.set(id, { id, ...newToken });
	}
}
