<?php

namespace App\Providers;

use Fleetbase\Models\User;
use Fleetbase\Notifications\UserInvited;
use Illuminate\Notifications\Events\NotificationSending;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        //
    }

    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        // LogiVibe: customer-type users receive portal credentials via
        // CustomerCredentialsMail. Suppress the default Fleetbase UserInvited
        // (console invite) email that assignCompany() auto-dispatches.
        Notification::sending(function (NotificationSending $event) {
            if ($event->notification instanceof UserInvited
                && $event->notifiable instanceof User
                && $event->notifiable->type === 'customer') {
                return false;
            }
        });
    }
}
