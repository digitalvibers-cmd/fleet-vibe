import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class OnboardRoute extends Route {
    @service router;

    beforeModel() {
        return this.router.transitionTo('auth.login');
    }
}
