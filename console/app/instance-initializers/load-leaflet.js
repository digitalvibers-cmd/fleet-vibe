import config from '@fleetbase/console/config/environment';
import patchLeafletTileLayer from '@fleetbase/console/utils/maptiler-tiles';

export function initialize(application) {
    const leafletService = application.lookup('service:leaflet');
    if (leafletService) {
        leafletService.load({
            onReady: function (L) {
                // This will prevent the awkward scroll bug produced by Chrome browsers
                // https://github.com/Leaflet/Leaflet/issues/4125#issuecomment-356289643
                L.Control.include({
                    _refocusOnMap: L.Util.falseFn,
                });

                // LogiVibe: CARTO basemaps now require an API key — serve MapTiler tiles instead.
                // Patch both the instance handed to us and the global one in case they differ.
                const mapTilerKey = config?.mapTiler?.apiKey;
                patchLeafletTileLayer(L, mapTilerKey);
                if (typeof window !== 'undefined' && window.L && window.L !== L) {
                    patchLeafletTileLayer(window.L, mapTilerKey);
                }
            },
        });
    }
}

export default {
    name: 'load-leaflet',
    initialize,
};
