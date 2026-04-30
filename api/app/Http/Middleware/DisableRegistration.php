<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class DisableRegistration
{
    /**
     * POST endpoints blocked in this single-tenant deployment.
     * Invite-acceptance flows (auth/join-organization, users/accept-company-invite) are intentionally not blocked.
     */
    private const BLOCKED_PATHS = [
        'onboard/create-account',
        'auth/create-organization',
    ];

    public function handle(Request $request, Closure $next)
    {
        if ($request->isMethod('POST')) {
            $path = $request->path();
            foreach (self::BLOCKED_PATHS as $blocked) {
                if (str_ends_with($path, $blocked)) {
                    return response()->json(
                        ['error' => 'This action is not permitted on this deployment.'],
                        403
                    );
                }
            }
        }

        return $next($request);
    }
}
