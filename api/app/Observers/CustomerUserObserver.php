<?php

namespace App\Observers;

use App\Services\CustomerAccessRevoker;
use Fleetbase\FleetOps\Models\Contact;
use Fleetbase\Models\User;

/**
 * LogiVibe: revoke customer-portal sessions when a customer User is
 * deactivated. Hooks the vendor `Fleetbase\Models\User` model from app-level
 * so the vendor package stays untouched.
 *
 * Why on `updated`: status flips can come from the admin UI through the
 * vendor User controller, which we don't override. The observer fires for
 * any User save — we only act when (a) status changed and is no longer
 * 'active' AND (b) the user is linked to a customer Contact.
 */
class CustomerUserObserver
{
    public function updated(User $user): void
    {
        if (!$user->wasChanged('status')) {
            return;
        }

        if ($user->status === 'active') {
            return;
        }

        $isCustomer = Contact::where('user_uuid', $user->uuid)
            ->where('type', 'customer')
            ->exists();

        if (!$isCustomer) {
            return;
        }

        app(CustomerAccessRevoker::class)->revokeTokens($user);
    }

    public function deleted(User $user): void
    {
        app(CustomerAccessRevoker::class)->purgeTokensByUuid($user->uuid);
    }
}
