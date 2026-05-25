// LogiVibe override of @fleetbase/ember-ui/components/custom-field/input.
// Extends the upstream class purely to pair with our local input.hbs override
// that drops the hardcoded `(or @currency "USD")` fallback so MoneyInput uses
// its own whois.currency.code default (RSD via console/app/services/current-user.js).
//
// The static marker exists ONLY to defeat Ember-CLI's "trivial re-export" build
// check, which throws at runtime when a JS file with a co-located template
// looks like a pure passthrough. With a real class body the check skips us.
//
// Re-apply on upstream fleetops sync — see CLAUDE.md.
import UpstreamCustomFieldInput from '@fleetbase/ember-ui/components/custom-field/input';

export default class CustomFieldInputComponent extends UpstreamCustomFieldInput {
    static logiVibeTemplateOverride = true;
}
