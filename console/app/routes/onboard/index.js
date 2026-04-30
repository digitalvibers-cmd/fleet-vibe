import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class OnboardIndexRoute extends Route {
    @service router;

    queryParams = {
        step: { refreshModel: false },
        session: { refreshModel: false },
        code: { refreshModel: false },
    };

    beforeModel() {
        return this.router.transitionTo('auth.login');
    }
}
