<?php

namespace Fleetbase\FleetOps\Observers;

use Fleetbase\FleetOps\Mail\CustomerCredentialsMail;
use Fleetbase\FleetOps\Models\Contact;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * LogiVibe-specific observer: when a Contact of type 'customer' is created,
 * auto-provision a linked User with a random password and email the credentials
 * (with the LogiVibe customer portal URL baked into the credentials mail view).
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

        if (!empty($contact->user_uuid)) {
            return;
        }

        try {
            $password = Str::random(12);

            $user = $contact->createUser(false);
            if (!$user) {
                Log::warning('CustomerContactObserver: createUser returned null', ['contact' => $contact->uuid]);
                return;
            }

            $user->changePassword($password);

            // Mail::to($user) can fail if the returned User object lacks email attribute;
            // use the contact's email directly which we already validated is non-empty.
            Mail::to($contact->email)->send(new CustomerCredentialsMail($password, $contact));
        } catch (\Throwable $e) {
            Log::error('CustomerContactObserver failed to send welcome email', [
                'contact' => $contact->uuid ?? null,
                'error'   => $e->getMessage(),
            ]);
        }
    }
}
