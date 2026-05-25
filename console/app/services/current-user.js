import CurrentUserService from '@fleetbase/ember-core/services/current-user';

// Upstream `current-user` populates `whois` from `GET /int/v1/lookup/whois`,
// which returns flat fields like `currency_code: "RSD"`. But MoneyInput and
// CurrencySelect read `whois.currency.code` (nested). Without this normalize
// step the lookup never resolves and money inputs fall back to hard-coded USD.
export default class CurrentUserOverrideService extends CurrentUserService {
    async loadWhois() {
        const whois = await super.loadWhois();
        if (whois && !whois.currency && whois.currency_code) {
            whois.currency = { code: whois.currency_code, name: whois.currency_name };
            this.setOption('whois', whois);
        }
        return whois;
    }
}
