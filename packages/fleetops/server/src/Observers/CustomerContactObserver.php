<?php

namespace Fleetbase\FleetOps\Observers;

use Fleetbase\FleetOps\Mail\CustomerCredentialsMail;
use Fleetbase\FleetOps\Models\Contact;
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

            Mail::to($contact->email)->send(new CustomerCredentialsMail($password, $contact));
        } catch (\Throwable $e) {
            Log::error('CustomerContactObserver failed to send welcome email', [
                'contact' => $contact->uuid ?? null,
                'error'   => $e->getMessage(),
            ]);
        }
    }
}
