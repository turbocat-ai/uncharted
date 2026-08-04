import test, { describe } from "node:test";
import assert from "node:assert";
import { getOrCreateTestUser, populateCoordList } from "./utils.js";
import { type LatLng } from "../src/types/dataTypes.js";

describe('Test create user', () => {
    test('should create user if it does not exist', async () => {
        const userId = await getOrCreateTestUser('barbara', 'test1@gmail.com');
        assert.strictEqual(userId, 1);
    })
})


describe('Test add hexes', () => {
    test('should add 15 hexes to db for user ID 2', async () => {
        const coordsList: LatLng[] = [
            {latitude: 40.7010, longitude: -74.0175},
            {latitude: 40.7045, longitude: -74.0120},
            {latitude: 40.7075, longitude: -74.0080},
            {latitude: 40.7105, longitude: -74.0040},
            {latitude: 40.7135, longitude: -74.0000},
            {latitude: 40.7165, longitude: -73.9960},
            {latitude: 40.7195, longitude: -73.9920},
            {latitude: 40.7225, longitude: -73.9880},
            {latitude: 40.7255, longitude: -73.9840},
            {latitude: 40.7285, longitude: -73.9800},
            {latitude: 40.7060, longitude: -74.0155},
            {latitude: 40.7110, longitude: -74.0105},
            {latitude: 40.7170, longitude: -74.0055},
            {latitude: 40.7230, longitude: -74.0005},
            {latitude: 40.7290, longitude: -73.9955},
        ]

        const added = await populateCoordList(2, coordsList)
        assert.strictEqual(added, 15)
    })

    test('should not duplicate hexes for user ID 2', async () => {
        const coordsList: LatLng[] = [
            {latitude: 40.7010, longitude: -74.0175},
            {latitude: 40.7045, longitude: -74.0120},
            {latitude: 40.7075, longitude: -74.0080},
            {latitude: 40.7105, longitude: -74.0040},
            {latitude: 40.7135, longitude: -74.0000},
            {latitude: 40.7165, longitude: -73.9960},
            {latitude: 40.7195, longitude: -73.9920},
            {latitude: 40.7225, longitude: -73.9880},
            {latitude: 40.7255, longitude: -73.9840},
            {latitude: 40.7285, longitude: -73.9800},
            {latitude: 40.7060, longitude: -74.0155},
            {latitude: 40.7110, longitude: -74.0105},
            {latitude: 40.7170, longitude: -74.0055},
            {latitude: 40.7230, longitude: -74.0005},
            {latitude: 40.7290, longitude: -73.9955},
        ]

        const added = await populateCoordList(2, coordsList)
        assert.strictEqual(added, 0)
    })
})