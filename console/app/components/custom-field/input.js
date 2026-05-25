// Same shape as packages/fleetops/addon/components/custom-field/input.js — needed
// at console-app level for the main (non-engine) bundle. Real class body avoids
// Ember-CLI's "trivial re-export with co-located template" runtime error.
import UpstreamCustomFieldInput from '@fleetbase/ember-ui/components/custom-field/input';

export default class CustomFieldInputComponent extends UpstreamCustomFieldInput {
    static logiVibeTemplateOverride = true;
}
