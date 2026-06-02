<?php

namespace Fleetbase\FleetOps\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class AuthenticateWmsIntegration
{
    public function handle(Request $request, Closure $next)
    {
        $configuredToken = (string) config('fleetops.wms_integration.token', '');
        $companyUuid     = (string) config('fleetops.wms_integration.company_uuid', '');

        if ($configuredToken === '' || $companyUuid === '') {
            return response()->json(['error' => 'WMS integration is not configured on this server.'], 503);
        }

        $providedToken = $this->extractBearerToken($request);
        if ($providedToken === null || !hash_equals($configuredToken, $providedToken)) {
            return response()->json(['error' => 'Invalid or missing WMS integration token.'], 401);
        }

        session(['company' => $companyUuid]);

        return $next($request);
    }

    private function extractBearerToken(Request $request): ?string
    {
        $header = $request->header('Authorization', '');
        if (is_array($header)) {
            $header = $header[0] ?? '';
        }

        if (stripos($header, 'Bearer ') !== 0) {
            return null;
        }

        $token = trim(substr($header, 7));

        return $token === '' ? null : $token;
    }
}
