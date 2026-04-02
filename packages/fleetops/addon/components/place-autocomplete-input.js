import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { later } from '@ember/runloop';
import loadGoogleMaps from '../utils/google-maps-loader';

/**
 * PlaceAutocompleteInput Component
 *
 * A Google Maps Places Autocomplete input that lets users search for
 * addresses and returns Place-compatible data objects.
 *
 * Usage:
 *   <PlaceAutocompleteInput
 *     @selectedPlace={{this.pickup}}
 *     @placeholder="Search pickup address..."
 *     @onSelect={{fn this.setPlace "pickup"}}
 *     @onClear={{fn this.clearPlace "pickup"}}
 *     @disabled={{false}}
 *   />
 *
 * The component does NOT create a Place entity in the database.
 * It returns a plain object with place attributes that can be passed
 * to the backend for deferred creation via Place::createFromMixed().
 */
export default class PlaceAutocompleteInputComponent extends Component {
    @service store;
    @service notifications;

    @tracked isLoading = false;
    @tracked isFocused = false;
    @tracked inputValue = '';
    @tracked googleMaps = null;
    @tracked autocomplete = null;

    /**
     * The display address for the selected place.
     * Prioritizes street + number format for truncation.
     */
    get displayAddress() {
        const place = this.args.selectedPlace;
        if (!place) return '';

        // Priority: street1 (street + number), then full address, then name
        const street = place.street1 || place.get?.('street1');
        const city = place.city || place.get?.('city');
        const address = place.address || place.get?.('address');

        if (street && city) {
            return `${street}, ${city}`;
        }
        if (street) {
            return street;
        }
        if (address) {
            return address;
        }
        return place.name || place.get?.('name') || '';
    }

    get hasSelection() {
        return !!this.args.selectedPlace;
    }

    get isDisabled() {
        return this.args.disabled || false;
    }

    get placeholderText() {
        return this.args.placeholder || 'Search address...';
    }

    @action
    async setupAutocomplete(element) {
        this._inputElement = element.querySelector('.place-autocomplete-input__search');
        if (!this._inputElement) return;

        try {
            this.googleMaps = await loadGoogleMaps();
            this.autocomplete = new this.googleMaps.places.Autocomplete(this._inputElement, {
                types: ['address'],
                fields: ['address_components', 'formatted_address', 'geometry', 'name', 'place_id'],
            });

            this.autocomplete.addListener('place_changed', () => {
                this._handlePlaceChanged();
            });
        } catch (error) {
            console.error('Failed to initialize Google Maps Autocomplete:', error);
            this.notifications.error('Failed to load Google Maps. Please try again.');
        }
    }

    @action
    teardownAutocomplete() {
        if (this.autocomplete) {
            this.googleMaps?.event?.clearInstanceListeners(this.autocomplete);
            this.autocomplete = null;
        }
        this._inputElement = null;
    }

    @action
    onFocus() {
        this.isFocused = true;
    }

    @action
    onBlur() {
        later(this, () => {
            this.isFocused = false;
        }, 200);
    }

    @action
    onInput(event) {
        this.inputValue = event.target.value;
    }

    @action
    clearSelection() {
        this.inputValue = '';
        if (this._inputElement) {
            this._inputElement.value = '';
        }

        if (typeof this.args.onClear === 'function') {
            this.args.onClear();
        }
        if (typeof this.args.onSelect === 'function') {
            this.args.onSelect(null);
        }

        // Re-focus the input after clearing
        later(this, () => {
            if (this._inputElement) {
                this._inputElement.focus();
            }
        }, 100);
    }

    /**
     * Handle the place_changed event from Google Autocomplete.
     * Extracts address components and creates a local Place-like object.
     */
    _handlePlaceChanged() {
        const googlePlace = this.autocomplete.getPlace();

        if (!googlePlace || !googlePlace.geometry) {
            // User pressed Enter without selecting a result
            return;
        }

        this.isLoading = true;

        try {
            const placeData = this._extractPlaceData(googlePlace);

            // Create a proper Ember Data record so it can be used as a
            // belongsTo relationship value on the Payload model.
            // The record is local-only (not saved) until the order is submitted;
            // the backend resolves it via Place::createFromMixed().
            const placeRecord = this.store.createRecord('place', placeData);

            // Update display
            this.inputValue = '';
            if (this._inputElement) {
                this._inputElement.value = '';
            }

            if (typeof this.args.onSelect === 'function') {
                this.args.onSelect(placeRecord);
            }
        } catch (error) {
            console.error('Error processing place selection:', error);
            this.notifications.error('Failed to process address. Please try again.');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Extract structured place data from a Google Place object.
     * Maps Google's address_components to Fleetbase Place attributes.
     *
     * @param {google.maps.places.PlaceResult} googlePlace
     * @returns {Object} Place-compatible attributes
     */
    _extractPlaceData(googlePlace) {
        const components = googlePlace.address_components || [];
        const geometry = googlePlace.geometry;

        // Helper to find a component by type
        const getComponent = (type, useShort = false) => {
            const comp = components.find(c => c.types.includes(type));
            return comp ? (useShort ? comp.short_name : comp.long_name) : null;
        };

        const streetNumber = getComponent('street_number');
        const streetName = getComponent('route');
        const city = getComponent('locality') || getComponent('administrative_area_level_2');
        const neighborhood = getComponent('neighborhood') || getComponent('sublocality_level_1') || getComponent('sublocality');
        const province = getComponent('administrative_area_level_1');
        const country = getComponent('country', true); // ISO code
        const postalCode = getComponent('postal_code');

        // Build street1: prioritize "StreetNumber StreetName" format
        let street1 = '';
        if (streetNumber && streetName) {
            street1 = `${streetNumber} ${streetName}`;
        } else if (streetName) {
            street1 = streetName;
        } else if (googlePlace.formatted_address) {
            // Fallback: use first part of formatted address
            const parts = googlePlace.formatted_address.split(',');
            street1 = parts[0]?.trim() || googlePlace.formatted_address;
        }

        const lat = geometry.location.lat();
        const lng = geometry.location.lng();

        return {
            name: street1 || googlePlace.name,
            address: googlePlace.formatted_address,
            street1: street1,
            city: city,
            neighborhood: neighborhood,
            province: province,
            country: country,
            postal_code: postalCode,
            building: streetNumber,
            // NOTE: Do NOT pass latitude/longitude directly — they are computed
            // properties on the Place model derived from `location`. Setting them
            // in createRecord triggers "Cannot override computed property" error.
            location: {
                type: 'Point',
                coordinates: [lng, lat],
            },
            meta: {
                google_place_id: googlePlace.place_id,
                formatted_address: googlePlace.formatted_address,
            },
        };
    }
}
