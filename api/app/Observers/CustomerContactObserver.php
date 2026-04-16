<?php

namespace App\Observers;

use Fleetbase\FleetOps\Mail\CustomerCredentialsMail;
use Fleetbase\FleetOps\Models\Contact;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class CustomerContactObserver
{
    /**
     * Fired after a Contact is created. When the contact is a customer with an email,
     * auto-provision a linked User with a random password and send the credentials
     * email (which includes the LogiVibe customer portal URL).
     */
    public function created(Contact $contact): void
    {
        if ($contact->type !== 'customer') {
            return;
        }

        if (empty($contact->email)) {
            return;
        }

        // Skip if a user is already linked (manual or race condition)
        if (!empty($contact->user_uuid)) {
            return;
        }

        try {
            $password = Str::random(12);

            // createUser() creates the User and sets $contact->user_uuid
            $user = $contact->createUser(false);
            if (!$user) {
                Log::warning('CustomerContactObserver: createUser returned null', ['contact' => $contact->uuid]);
                return;
            }

            $user->changePassword($password);

            Mail::to($user)->send(new CustomerCredentialsMail($password, $contact));
        } catch (\Throwable $e) {
            Log::error('CustomerContactObserver failed to send welcome email', [
                'contact' => $contact->uuid ?? null,
                'error'   => $e->getMessage(),
            ]);
        }
    }
}
