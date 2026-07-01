import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';

export default class ManagementContactsCustomersDetailsController extends Controller {
    @service hostRouter;
    @service intl;
    @service('customerActions') customerActions;
    @tracked tabs = [
        {
            route: 'management.contacts.customers.details.index',
            label: 'Overview',
        },
    ];

    get actionButtons() {
        return [
            {
                type: 'default',
                icon: 'key',
                text: this.intl.t('customer.reset-password'),
                permission: 'iam create user',
                fn: () => this.customerActions.resetCredentials(this.model),
            },
            {
                icon: 'pencil',
                fn: () => this.hostRouter.transitionTo('console.fleet-ops.management.contacts.customers.edit', this.model),
            },
        ];
    }
}
