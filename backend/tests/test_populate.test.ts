import test, { describe } from "node:test";
import assert from "node:assert";
import { getOrCreateTestUser } from "./utils.js";

describe('Test create user', () => {
    test('should create user if it does not exist', async () => {
        const userId = await getOrCreateTestUser('barbara', 'test1@gmail.com');
        assert.strictEqual(userId, 1);
    })
})