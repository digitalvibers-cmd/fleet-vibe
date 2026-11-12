import patchLeafletTileLayer, { rewriteTileUrl, MAPTILER_ATTRIBUTION } from '@fleetbase/console/utils/maptiler-tiles';
import { module, test } from 'qunit';

const LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
const DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

module('Unit | Utility | maptiler-tiles', function () {
    test('rewrites CARTO light and dark templates to MapTiler', function (assert) {
        assert.strictEqual(rewriteTileUrl(LIGHT, 'abc'), 'https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=abc');
        assert.strictEqual(rewriteTileUrl(DARK, 'abc'), 'https://api.maptiler.com/maps/streets-v2-dark/256/{z}/{x}/{y}.png?key=abc');
    });

    test('leaves the URL untouched without a key or for other providers', function (assert) {
        assert.strictEqual(rewriteTileUrl(LIGHT, ''), LIGHT);
        assert.strictEqual(rewriteTileUrl('https://tiles.example.com/{z}/{x}/{y}.png', 'abc'), 'https://tiles.example.com/{z}/{x}/{y}.png');
        assert.strictEqual(rewriteTileUrl(undefined, 'abc'), undefined);
    });

    test('patches TileLayer initialize and setUrl once', function (assert) {
        const calls = [];
        class TileLayer {
            initialize(url, options) {
                calls.push(['initialize', url, options]);
            }
            setUrl(url, noRedraw) {
                calls.push(['setUrl', url, noRedraw]);
            }
        }
        const L = { TileLayer };

        assert.true(patchLeafletTileLayer(L, 'abc'));
        assert.false(patchLeafletTileLayer(L, 'abc'), 'second patch is a no-op');

        const layer = new TileLayer();
        layer.initialize(LIGHT, { maxZoom: 19 });
        layer.setUrl(DARK, true);
        layer.initialize('https://tiles.example.com/{z}/{x}/{y}.png', { maxZoom: 5 });

        assert.deepEqual(calls[0], ['initialize', 'https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=abc', { maxZoom: 19, attribution: MAPTILER_ATTRIBUTION }]);
        assert.deepEqual(calls[1], ['setUrl', 'https://api.maptiler.com/maps/streets-v2-dark/256/{z}/{x}/{y}.png?key=abc', true]);
        assert.deepEqual(calls[2], ['initialize', 'https://tiles.example.com/{z}/{x}/{y}.png', { maxZoom: 5 }]);
    });
});
