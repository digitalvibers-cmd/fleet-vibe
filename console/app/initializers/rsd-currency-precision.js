import getCurrency from '@fleetbase/ember-ui/utils/get-currency';

export function initialize() {
    const all = getCurrency();
    const rsd = all && all.find((c) => c.code === 'RSD');
    if (rsd) {
        rsd.precision = 0;
        rsd.decimalSeparator = '';
    }
}

export default { initialize };
