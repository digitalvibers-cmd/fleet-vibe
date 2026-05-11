<?php

namespace Fleetbase\FleetOps\Observers;

use App\Services\CustomerAccessRevoker;
use Fleetbase\FleetOps\Mail\CustomerCredentialsMail;
use Fleetbase\FleetOps\Models\Contact;
use Fleetbase\Models\CompanyUser;
use Fleetbase\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * LogiVibe: when a new customer Contact is created, set a random password on the
 * linked User (created by ContactObserver::creating) and email the credentials
 * with the LogiVibe customer portal URL.
 */
class CustomerContactObserver
{
    public function created(Contact $contact): void
    {
        if ($contact->type !== 'customer') {
            return;
        }

        if (empty($contact->email)) {
            return;
        }

        try {
            // ContactObserver::creating() already created the User and set user_uuid.
            // Fetch it directly — do NOT call createUser() again.
            $user = User::where('uuid', $contact->user_uuid)->first();
            if (!$user) {
                Log::warning('CustomerContactObserver: no user found for contact', ['contact' => $contact->uuid]);
                return;
            }

            $password = Str::random(12);
            $user->changePassword($password);

            // Vendor ContactObserver::creating() creates the user with status=pending and
            // no email_verified_at. Activate immediately so the customer can log in.
            $user->update(['status' => 'active', 'email_verified_at' => now()]);
            CompanyUser::where('user_uuid', $user->uuid)->update(['status' => 'active']);

            Mail::to($contact->email)->send(new CustomerCredentialsMail($password, $contact));
        } catch (\Throwable $e) {
            Log::error('CustomerContactObserver failed to send welcome email', [
                'contact' => $contact->uuid ?? null,
                'error'   => $e->getMessage(),
            ]);
        }
    }

    /**
     * LogiVibe: purge all Sanctum tokens for the linked user BEFORE the vendor
     * ContactObserver::deleted hard-deletes the user. Uses the user_uuid
     * directly so it works regardless of observer execution order.
     */
    public function deleted(Contact $contact): void
    {
        if ($contact->type !== 'customer') {
            return;
        }

        if (empty($contact->user_uuid)) {
            return;
        }

        try {
            app(CustomerAccessRevoker::class)->purgeTokensByUuid($contact->user_uuid);
        } catch (\Throwable $e) {
            Log::error('CustomerContactObserver failed to revoke customer access', [
                'contact' => $contact->uuid ?? null,
                'error'   => $e->getMessage(),
            ]);
        }
    }
}
