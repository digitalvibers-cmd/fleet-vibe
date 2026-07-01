import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';

export default class ModalsResetCustomerCredentialsComponent extends Component {
    @service fetch;
    @service notifications;
    @tracked options = {};
    @tracked customer;

    constructor(owner, { options }) {
        super(...arguments);
        this.customer = options.customer;
        this.options = options;
        this.setupOptions();
    }

    setupOptions() {
        this.options.title = 'Reset Customer Credentials';
        this.options.acceptButtonText = 'Reset Credentials';
        this.options.declineButtonHidden = true;
        this.options.confirm = async (modal) => {
            modal.startLoading();

            try {
                // LogiVibe: no password fields — the API auto-generates a new password
                // and emails it to the customer (customer-portal credentials only).
                await this.fetch.post('customers/reset-credentials', {
                    customer: this.customer.id,
                    send_credentials: true,
                });

                this.notifications.success('Customer password reset.');

                if (typeof this.options.onPasswordResetComplete === 'function') {
                    this.options.onPasswordResetComplete();
                }

                modal.done();
            } catch (error) {
                this.notifications.serverError(error);
                modal.stopLoading();
            }
        };
    }
}
