<?php

namespace App\Providers;

use App\Observers\CustomerUserObserver;
use Fleetbase\Models\User;
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
        // LogiVibe: hook vendor User model from app-level so customer-portal
        // sessions are killed when a customer user is deactivated or deleted.
        User::observe(CustomerUserObserver::class);
    }
}
